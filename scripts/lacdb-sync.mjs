#!/usr/bin/env node
/**
 * Dry-run: map Matthew Shirley's LACDB listing feed onto War Room deals.
 *
 * Feed: public/agents/listings.json (served as /agents/listings.json).
 * PR 16 (WARROOM-171) staged that file as a one-time export. No generator
 * script is in this repo or on the listing-feed branches — refresh is manual.
 *
 * Default is --dry-run. This file never inserts, updates, or deletes.
 * --apply is refused on purpose. Reads, when they happen, are HTTP GET only.
 *
 * Match order:
 *   1. LACDB id already stored on the deal (deal_source "lacdb:<id>" or lacdb_url)
 *   2. Normalized street address (house number, name, suffix, city)
 * Listings that share an address attach to the same deal.
 * Deals whose stored LACDB id is absent from the feed are reported as
 * "Off LACDB". They are not deleted. Notes, deadlines, and commission
 * are never part of a payload.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_FEED = resolve(ROOT, 'public/agents/listings.json')
const DEFAULT_OUT = resolve(ROOT, 'docs/lacdb-sync-dry-run.md')

const LISTING_TYPES = new Set([
  'listing', 'active_listing', 'potential_listing', 'landlord', 'seller', 'landlord_rep',
])

const SUFFIX = {
  street: 'st', st: 'st', avenue: 'ave', ave: 'ave', boulevard: 'blvd', blvd: 'blvd',
  road: 'rd', rd: 'rd', drive: 'dr', dr: 'dr', lane: 'ln', ln: 'ln',
  court: 'ct', ct: 'ct', place: 'pl', pl: 'pl', highway: 'hwy', hwy: 'hwy',
  parkway: 'pkwy', pkwy: 'pkwy', circle: 'cir', cir: 'cir', trail: 'trl', trl: 'trl',
  terrace: 'ter', ter: 'ter', plaza: 'plz', plz: 'plz', loop: 'loop', way: 'way',
}

const SUFFIX_DISPLAY = {
  st: 'St.', ave: 'Ave.', blvd: 'Blvd.', rd: 'Rd.', dr: 'Dr.', ln: 'Ln.',
  ct: 'Ct.', pl: 'Pl.', hwy: 'Hwy.', pkwy: 'Pkwy.', cir: 'Cir.', trl: 'Trl.',
  ter: 'Ter.', plz: 'Plz.', loop: 'Loop', way: 'Way',
}

const CARDINAL = {
  northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw',
  north: 'n', south: 's', east: 'e', west: 'w',
  ne: 'ne', nw: 'nw', se: 'se', sw: 'sw', n: 'n', s: 's', e: 'e', w: 'w',
}

const PROP_MAP = {
  land: 'LAND', office: 'OFFICE', industrial: 'INDUSTRIAL', retail: 'RETAIL',
  hospitality: 'OTHER', other: 'OTHER', multifamily: 'OTHER',
}

const PROTECTED = [
  'deals.notes',
  'deals.commission_rate',
  'deals.commission_estimated',
  'deals.commission_collected',
  'deals.name (client name on an existing row)',
  'deals.status',
  'deals.type',
  'deals.representation_role',
  'deals.dropbox_link',
  'deals.rating',
  'deals.deal_source when it is a user label (anything other than lacdb:<id>)',
  'deal_economics.sale_commission_pct',
  'deal_economics.lease_commission_pct',
  'contract_deadlines (every row)',
]

function parseArgs(argv) {
  const out = { dryRun: true, apply: false, feed: DEFAULT_FEED, out: DEFAULT_OUT, selfTestOnly: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--apply') out.apply = true
    else if (a === '--self-test') out.selfTestOnly = true
    else if (a === '--feed') out.feed = resolve(argv[++i])
    else if (a === '--out') out.out = resolve(argv[++i])
    else if (a === '--help') out.help = true
    else throw new Error(`Unknown argument: ${a}`)
  }
  return out
}

function configuredSupabase() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (envUrl && envKey) return { url: envUrl, key: envKey, from: 'environment' }
  const src = readFileSync(resolve(ROOT, 'lib/supabase.ts'), 'utf8')
  const um = src.match(/NEXT_PUBLIC_SUPABASE_URL \|\| '([^']+)'/)
  const km = src.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY \|\| '([^']+)'/)
  if (!um || !km) return null
  return { url: um[1], key: km[1], from: 'lib/supabase.ts public client (no env vars set)' }
}

async function restGetAll(baseUrl, key, table, select) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  }
  const rows = []
  const page = 500
  for (let from = 0; from < 10000; from += page) {
    const path = `/rest/v1/${table}?select=${encodeURIComponent(select)}`
    const res = await fetch(baseUrl + path, {
      method: 'GET',
      headers: { ...headers, Range: `${from}-${from + page - 1}` },
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`${table} GET ${res.status}: ${body.slice(0, 240)}`)
    }
    const batch = await res.json()
    if (!Array.isArray(batch)) throw new Error(`${table} GET did not return an array`)
    rows.push(...batch)
    if (batch.length < page) break
  }
  return rows
}

function loadFeed(path) {
  const feed = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(feed.listings)) throw new Error('Feed has no listings array')
  return feed
}

function tidy(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/\binterstate\s+(\d+)\b/g, 'i$1')
    .replace(/\bi[\s-]+(\d+)\b/g, 'i$1')
    .replace(/\bla[\s-]*(\d+)\b/g, 'la$1')
    .replace(/suite\b.*$/g, ' ')
    .replace(/\b(ste|unit|apt|#)\b.*$/g, ' ')
    .replace(/['’]/g, '')
}

function tokensOf(raw) {
  return tidy(raw).split(/[^a-z0-9]+/).filter(Boolean)
}

function isHouseNumber(token) {
  return /^\d+[a-z]?$/.test(token)
}

export function normalizeLine(line, city) {
  const tokens = tokensOf(line)
  let number = ''
  let rest = tokens
  if (rest.length && isHouseNumber(rest[0]) && !/^tract$/.test(rest[0])) {
    number = rest[0]
    rest = rest.slice(1)
    if (rest.length && isHouseNumber(rest[0])) rest = rest.slice(1)
  } else if (rest.length && isHouseNumber(rest[rest.length - 1])) {
    number = rest[rest.length - 1]
    rest = rest.slice(0, -1)
  }

  let cardinal = ''
  if (rest.length >= 2 && CARDINAL[rest[0]]) {
    cardinal = CARDINAL[rest[0]]
    rest = rest.slice(1)
  } else if (rest.length >= 2 && CARDINAL[rest[rest.length - 1]]) {
    cardinal = CARDINAL[rest[rest.length - 1]]
    rest = rest.slice(0, -1)
  }

  let suffix = ''
  if (rest.length && SUFFIX[rest[rest.length - 1]]) {
    suffix = SUFFIX[rest[rest.length - 1]]
    rest = rest.slice(0, -1)
  }

  const name = rest.join(' ')
  const cityKey = tidy(city).replace(/[^a-z0-9]+/g, ' ').trim()
  return { number, name, suffix, cardinal, city: cityKey }
}

function addressKey(norm) {
  if (!norm.name && !norm.number) return ''
  return `${norm.number}|${norm.name}|${norm.suffix}|${norm.city}`
}

function addressKeyNoCity(norm) {
  if (!norm.name && !norm.number) return ''
  return `${norm.number}|${norm.name}|${norm.suffix}|`
}

function keysEqual(a, b) {
  if (!a || !b) return false
  if (!a.number && !b.number && a.name !== b.name) return false
  return a.number === b.number && a.name === b.name && a.suffix === b.suffix
    && (!a.city || !b.city || a.city === b.city)
}

function displayStreet(name, suffix) {
  if (/^la\d+$/.test(name)) return `LA-${name.slice(2)}`
  let shown = name
  if (/^i\d+/.test(name)) shown = name.replace(/^i(\d+)/, 'I-$1')
  const titled = shown.split(' ').filter(Boolean).map(w => {
    if (/^i-\d+$/i.test(w)) return w.toUpperCase()
    return w.charAt(0).toUpperCase() + w.slice(1)
  }).join(' ')
  const suf = suffix ? SUFFIX_DISPLAY[suffix] : ''
  return suf ? `${titled} ${suf}` : titled
}

function filingDisplay(norm, originalLine) {
  // No house number: keep the LACDB line. Peeling "North Morrison" or
  // "Between N 13th" into a filing name drops the only locator.
  if (!norm.number) return (originalLine || '').trim()
  if (!norm.name) return norm.number
  const street = displayStreet(norm.name, norm.suffix)
  const parts = [street]
  if (norm.cardinal) parts.push(`${norm.cardinal.toUpperCase()}.`)
  parts.push(norm.number)
  return parts.join(' ')
}

function replaceHouseNumber(raw, from, to) {
  if (!raw || !from || !to || from === to) return null
  const re = new RegExp(`\\b${from}\\b`)
  if (!re.test(String(raw))) return null
  return String(raw).replace(re, to)
}

function dirtyDisplay(value) {
  return /,{2,}|,\s*,|\s{2,}/.test(String(value || ''))
}

function moneyEqual(a, b) {
  if (a == null || b == null) return false
  const da = Number(a)
  const db = Number(b)
  if (!Number.isFinite(da) || !Number.isFinite(db)) return false
  const diff = Math.abs(da - db)
  if (diff <= 1) return true
  return diff / Math.max(Math.abs(da), Math.abs(db)) < 0.0015
}

function sfEqual(a, b) {
  if (a == null || b == null) return false
  return Math.round(Number(a)) === Math.round(Number(b))
}

function parseTotalLabel(label) {
  if (!label) return null
  const s = String(label).trim()
  if (/\/|month|sf|acre|-/i.test(s)) return null
  const m = s.match(/^\$?\s*([\d,.]+)\s*([kKmM])?$/)
  if (!m) return null
  let n = Number(m[1].replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  const unit = (m[2] || '').toLowerCase()
  if (unit === 'k') n *= 1000
  if (unit === 'm') n *= 1000000
  return Math.round(n)
}

function parseRateLabel(label) {
  if (!label) return null
  const s = String(label).trim()
  const range = s.match(/^\$?\s*([\d.]+)\s*-\s*\$?\s*([\d.]+)\s*(.*)$/i)
  if (range) {
    return {
      min: Number(range[1]),
      max: Number(range[2]),
      rest: range[3].trim(),
      range: true,
    }
  }
  const one = s.match(/^\$?\s*([\d.]+)\s*(sf\s*\/\s*year|sf\/year|per\s*sf)/i)
  if (one) return { min: Number(one[1]), max: Number(one[1]), rest: 'sfYear', range: false }
  return null
}

function tidOfListing(listing) {
  const id = listing?.source?.listing_id
  return id ? String(id).toLowerCase() : ''
}

function tidFromText(value) {
  if (!value) return ''
  const m = String(value).match(/(?:lacdb:|\/listings\/)([0-9a-f]{8})\b/i)
  return m ? m[1].toLowerCase() : ''
}

function dealTid(deal) {
  return tidFromText(deal.deal_source) || tidFromText(deal.lacdb_url)
}

function isListingDeal(deal) {
  return LISTING_TYPES.has(String(deal.type || '').toLowerCase())
}

function mapPropertyType(listing) {
  const raw = (listing.property_types || []).map(t => String(t).trim().toLowerCase()).filter(Boolean)
  if (!raw.length) return { value: null, gap: null }
  const mapped = [...new Set(raw.map(t => PROP_MAP[t] || 'OTHER'))]
  if (mapped.length > 1) return { value: null, gap: `property types disagree: ${raw.join(', ')}` }
  if (!PROP_MAP[raw[0]]) return { value: 'OTHER', gap: `${raw[0]} is not in the five-value property_type check; mapped to OTHER` }
  return { value: mapped[0], gap: null }
}

function lotSf(listing) {
  const max = listing.size?.lot_sf_max
  const min = listing.size?.lot_sf_min
  if (max == null && min == null) return { value: null, range: false }
  if (min != null && max != null && !sfEqual(min, max)) return { value: max, range: true, min, max }
  return { value: max ?? min, range: false }
}

function lotAcres(listing) {
  const max = listing.size?.lot_acres_max
  const min = listing.size?.lot_acres_min
  if (max == null && min == null) return { value: null, range: false }
  if (min != null && max != null && Math.abs(Number(min) - Number(max)) > 0.01) {
    return { value: max, range: true, min, max }
  }
  return { value: max ?? min, range: false }
}

function askingOf(listing) {
  const price = listing.price || {}
  const gaps = []
  if (price.unit === 'total' && price.amount != null) {
    return { value: Math.round(Number(price.amount)), gaps }
  }
  if (price.unit === 'per_sf') {
    const min = price.total_min
    const max = price.total_max
    if (min != null && max != null && moneyEqual(min, max)) {
      return { value: Math.round(Number(max)), gaps }
    }
    gaps.push(`price is ${price.label || price.amount + '/SF'} with total range ${min ?? '∅'}–${max ?? '∅'}; not written to asking_price`)
    return { value: null, gaps }
  }
  const parsed = parseTotalLabel(price.label)
  if (parsed != null) return { value: parsed, gaps }
  if (price.label) gaps.push(`price label ${JSON.stringify(price.label)} is not a single total`)
  return { value: null, gaps }
}

function leaseOf(listing) {
  const gaps = []
  const spaces = (listing.lease_spaces || []).filter(s => !s.status || s.status === 'available')
  if (spaces.length) {
    const rates = spaces
      .filter(s => s.rate_unit === 'sfYear' && s.rate_min != null && s.rate_max != null && Number(s.rate_min) === Number(s.rate_max))
      .map(s => Number(s.rate_min))
    const unique = [...new Set(rates.map(r => r.toFixed(2)))]
    const sfs = spaces.map(s => s.available_sf_max ?? s.available_sf_min).filter(n => n != null)
    const sf = sfs.length === spaces.length ? sfs.reduce((a, b) => a + Number(b), 0) : null
    if (spaces.some(s => s.rate_unit && s.rate_unit !== 'sfYear')) {
      gaps.push(`lease rate unit ${spaces.map(s => s.rate_unit).join(', ')} is not $/SF/year`)
    }
    const ranges = spaces
      .filter(s => s.rate_min != null && s.rate_max != null && Number(s.rate_min) !== Number(s.rate_max))
      .map(s => `${s.rate_min}–${s.rate_max} ${s.rate_unit || ''}`.trim())
    if (unique.length === 1 && !ranges.length) return { rate: Number(unique[0]), sf, gaps }
    if (ranges.length) gaps.push(`lease rate range ${ranges.join(', ')}; lease_rate_psf not written`)
    else if (unique.length > 1) gaps.push(`available spaces have different $/SF/year rates (${unique.join(', ')})`)
    else if (!rates.length) gaps.push('available lease spaces have no single sfYear rate')
    return { rate: null, sf, gaps }
  }
  const parsed = parseRateLabel(listing.price?.label)
  if (!parsed) {
    if (listing.transaction_type === 'lease' && listing.price?.label) {
      gaps.push(`summary rate label ${JSON.stringify(listing.price.label)} is not a structured sfYear rate`)
    }
    return { rate: null, sf: null, gaps }
  }
  if (parsed.range || !/sf/i.test(parsed.rest)) {
    gaps.push(`summary rate label ${JSON.stringify(listing.price.label)} is a range or not $/SF/year`)
    return { rate: null, sf: null, gaps }
  }
  if (listing.detail_level === 'summary') {
    gaps.push(`summary stub rate ${JSON.stringify(listing.price.label)} kept out of lease_rate_psf`)
    return { rate: null, sf: null, gaps }
  }
  return { rate: parsed.min, sf: null, gaps }
}

function fileNumbers(url) {
  const file = decodeURIComponent(String(url).split('/').pop() || '')
  return file.match(/\d{3,5}/g) || []
}

function photoForListing(listing, norm, houseNumbers) {
  const photos = listing.media?.photos || []
  if (!photos.length) return null
  if (!norm.number) return photos[0]
  const known = houseNumbers || new Set()
  const usable = photos.filter(url => !fileNumbers(url).some(n => known.has(n) && n !== norm.number))
  if (!usable.length) return null
  return usable.find(url => fileNumbers(url).includes(norm.number)) || usable[0]
}

function mapListing(listing, houseNumbers) {
  const norm = normalizeLine(listing.address?.street || '', listing.address?.city || '')
  const prop = mapPropertyType(listing)
  const ask = askingOf(listing)
  const lease = leaseOf(listing)
  const acres = lotAcres(listing)
  const land = lotSf(listing)
  const gaps = []
  if (prop.gap) gaps.push(prop.gap)
  gaps.push(...ask.gaps, ...lease.gaps)
  if (!listing.property_types?.length) gaps.push('property_types empty (summary stub or unset on LACDB)')
  if (acres.range) gaps.push(`lot acres ${acres.min}–${acres.max}; acreage not collapsed to one number`)
  if (land.range) gaps.push(`lot sf ${land.min}–${land.max}; land_sqft not collapsed`)
  if (!norm.number && norm.name) gaps.push('no house number — filing name falls back to the LACDB street line')
  const building = listing.size?.building_sf != null ? Math.round(Number(listing.size.building_sf)) : null
  const streetLine = listing.address?.street || ''
  const photo = photoForListing(listing, norm, houseNumbers)
  if ((listing.media?.photos || []).length && !photo && norm.number) {
    gaps.push(`photos are named with a different listing's street number, not ${norm.number}; photo_url not set`)
  }
  return {
    listing,
    tid: tidOfListing(listing),
    norm,
    key: addressKey(norm),
    keyNoCity: addressKeyNoCity(norm),
    filing: filingDisplay(norm, streetLine) || streetLine || listing.title,
    propertyType: prop.value,
    asking: ask.value,
    leaseRate: lease.rate,
    leaseSf: lease.sf != null ? Math.round(lease.sf) : null,
    buildingSf: building,
    landSqft: land.range ? null : (land.value != null ? Math.round(Number(land.value)) : null),
    acres: acres.range ? null : (acres.value != null ? Number(acres.value) : null),
    zip: listing.address?.postal_code || null,
    state: listing.address?.state || null,
    city: listing.address?.city || null,
    photo,
    url: listing.source?.url || null,
    gaps,
  }
}

function dealNorm(deal) {
  const street = [deal.addr_street_name, deal.addr_street_type].filter(Boolean).join(' ')
  const structured = (deal.addr_number || street)
    ? [deal.addr_number, deal.addr_direction, street].filter(Boolean).join(' ')
    : ''
  const primary = normalizeLine(structured || deal.addr_display || deal.address || '', deal.addr_city || '')
  const alts = [deal.addr_display, deal.address]
    .filter(Boolean)
    .map(line => normalizeLine(line, deal.addr_city || ''))
  const chosen = primary.number ? primary : (alts.find(a => a.number && a.name) || primary)
  return chosen
}

function blankDealFacts() {
  return {
    notes_present: false,
    commission_present: false,
    dropbox_present: false,
    deadline_count: 0,
    sale_commission_present: false,
    lease_commission_present: false,
  }
}

function redactDeal(row) {
  const facts = blankDealFacts()
  facts.notes_present = !!(row.notes && String(row.notes).trim())
  facts.commission_present = row.commission_estimated != null
    || row.commission_rate != null
    || (row.commission_collected != null && Number(row.commission_collected) !== 0)
  facts.dropbox_present = !!(row.dropbox_link && String(row.dropbox_link).trim())
  delete row.notes
  delete row.commission_estimated
  delete row.commission_rate
  delete row.commission_collected
  delete row.dropbox_link
  delete row.rating
  row._facts = facts
  row._norm = dealNorm(row)
  row._key = addressKey(row._norm)
  row._keyNoCity = addressKeyNoCity(row._norm)
  row._tid = dealTid(row)
  return row
}

function redactEcon(row) {
  const sale = row.sale_commission_pct != null
  const lease = row.lease_commission_pct != null
  delete row.sale_commission_pct
  delete row.lease_commission_pct
  return { ...row, sale_commission_present: sale, lease_commission_present: lease }
}

function indexDeals(deals) {
  const byTid = new Map()
  const byKey = new Map()
  const byKeyNoCity = new Map()
  function push(map, key, deal) {
    if (!key) return
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(deal)
  }
  for (const deal of deals) {
    push(byTid, deal._tid, deal)
    push(byKey, deal._key, deal)
    push(byKeyNoCity, deal._keyNoCity, deal)
  }
  return { byTid, byKey, byKeyNoCity }
}

function listingCandidates(mapped, index) {
  const tidHits = (index.byTid.get(mapped.tid) || []).filter(isListingDeal)
  if (tidHits.length === 1) return { deals: tidHits, how: 'lacdb id' }
  if (tidHits.length > 1) return { deals: tidHits, how: 'lacdb id ambiguous' }
  const full = index.byKey.get(mapped.key) || []
  const loose = mapped.norm.city ? [] : (index.byKeyNoCity.get(mapped.keyNoCity) || [])
  const pool = [...new Map([...full, ...loose].map(d => [d.id, d])).values()]
  const listingLike = pool.filter(isListingDeal)
  if (listingLike.length === 1) return { deals: listingLike, how: 'address' }
  if (listingLike.length > 1) return { deals: listingLike, how: 'address ambiguous' }
  if (pool.length) return { deals: pool, how: 'non-listing only' }
  return { deals: [], how: 'none' }
}

function sameZip(list) {
  const zips = [...new Set(list.map(m => m.zip).filter(Boolean))]
  return zips.length === 1 ? zips[0] : null
}

function sameCity(list) {
  const cities = [...new Set(list.map(m => (m.city || '').trim()).filter(Boolean))]
  return cities.length === 1 ? cities[0] : null
}

function sameState(list) {
  const states = [...new Set(list.map(m => (m.state || '').trim().toUpperCase()).filter(Boolean))]
  return states.length === 1 ? states[0] : null
}

function choosePrimary(group, preferredTid) {
  if (preferredTid) {
    const hit = group.find(m => m.tid === preferredTid)
    if (hit) return hit
  }
  const sales = group.filter(m => m.listing.transaction_type === 'sale')
  return sales.find(m => m.listing.detail_level !== 'summary')
    || sales[0]
    || group.find(m => m.listing.detail_level !== 'summary')
    || group[0]
}

function mergedProposal(group, preferredTid) {
  const gaps = []
  for (const m of group) gaps.push(...m.gaps.map(g => `${m.tid}: ${g}`))
  const full = group.filter(m => m.listing.detail_level !== 'summary')
  const pool = full.length ? full : group
  const primary = choosePrimary(group, preferredTid)

  function unanimous(pick) {
    const vals = pool.map(pick).filter(v => v != null)
    if (!vals.length) return { value: null, conflict: false }
    const first = vals[0]
    const conflict = vals.some(v => {
      if (typeof first === 'number') return !moneyEqual(first, v) && !sfEqual(first, v)
      return v !== first
    })
    if (conflict) return { value: null, conflict: true, vals }
    return { value: first, conflict: false }
  }

  const asking = unanimous(m => m.asking)
  const leaseRate = unanimous(m => m.leaseRate)
  const prop = unanimous(m => m.propertyType)
  if (asking.conflict) gaps.push(`asking prices disagree (${asking.vals.join(' vs ')}) — not written`)
  if (leaseRate.conflict) gaps.push(`lease rates disagree (${leaseRate.vals.join(' vs ')}) — not written`)
  if (prop.conflict) gaps.push(`property types disagree (${prop.vals.join(' vs ')}) — not written`)
  if (group.length > 1) {
    gaps.push(`grouped ${group.length} LACDB records on one deal; deal_source can store one id (${primary.tid})`)
  }
  const zips = [...new Set(group.map(m => m.zip).filter(Boolean))]
  if (zips.length > 1) gaps.push(`ZIP disagrees across records (${zips.join(' vs ')}) — addr_zip not written`)

  const building = unanimous(m => m.buildingSf)
  const land = unanimous(m => m.landSqft)
  const acres = unanimous(m => m.acres)
  const leaseSf = unanimous(m => m.leaseSf)
  let sqft = building.value
  if (sqft == null && prop.value === 'LAND') sqft = land.value
  if (sqft == null) sqft = leaseSf.value

  const hasSale = group.some(m => m.listing.transaction_type === 'sale' && m.asking != null)
  const hasLease = leaseRate.value != null
  let transaction = null
  if (hasSale && hasLease) transaction = 'both'
  else if (hasSale) transaction = 'sale'
  else if (hasLease) transaction = 'lease'
  else if (group.every(m => m.listing.transaction_type === 'lease')) transaction = null
  else if (group.some(m => m.listing.transaction_type === 'sale')) transaction = 'sale'

  return {
    primary,
    propertyType: prop.value,
    asking: asking.value,
    leaseRate: leaseRate.value,
    sqft,
    landSqft: land.value,
    acres: acres.value,
    transaction,
    zip: sameZip(group),
    city: sameCity(group),
    state: sameState(group),
    photo: group.find(m => m.photo)?.photo || null,
    url: primary.url,
    filing: primary.filing,
    norm: primary.norm,
    gaps,
  }
}

function pushDiff(diffs, field, from, to, note) {
  if (to == null || to === '') return
  if (typeof to === 'number' && typeof from === 'number') {
    if (field.endsWith('acreage') || field.endsWith('lease_rate_psf')) {
      if (Math.abs(from - to) < 0.01) return
    } else if (moneyEqual(from, to) || sfEqual(from, to)) return
  }
  if (from === to) return
  if (typeof from === 'string' && typeof to === 'string' && from.trim() === to.trim()) return
  diffs.push({ field, from: from ?? null, to, note: note || '' })
}

function addressDiffs(deal, proposal) {
  const diffs = []
  const gaps = []
  const cur = deal._norm
  const next = proposal.norm
  const sameSlots = keysEqual(cur, next)
  const numberCorrection = cur.number && next.number && cur.number !== next.number
    && cur.name === next.name && cur.suffix === next.suffix
  if (numberCorrection) {
    pushDiff(diffs, 'deals.addr_number', cur.number, next.number, 'same street, house number differs from the LACDB record this deal already points at')
    pushDiff(diffs, 'deals.addr_display', deal.addr_display, proposal.filing, 'filing display follows the LACDB house number')
    const replaced = replaceHouseNumber(deal.address, cur.number, next.number)
    if (replaced) pushDiff(diffs, 'deals.address', deal.address, replaced, 'house number only; the rest of the stored address stays')
  } else if (!sameSlots && cur.name && next.name && cur.name !== next.name) {
    gaps.push(`matched without the same normalized address (${deal.addr_display || deal.address || deal.name} vs ${proposal.filing}); address columns left as stored`)
  } else if (sameSlots && dirtyDisplay(deal.addr_display) && proposal.norm.number) {
    pushDiff(diffs, 'deals.addr_display', deal.addr_display, proposal.filing, 'display has broken punctuation; slots are unchanged')
  }
  if (!deal.addr_city && proposal.city) pushDiff(diffs, 'deals.addr_city', null, proposal.city)
  if (!deal.addr_state && proposal.state) pushDiff(diffs, 'deals.addr_state', null, proposal.state)
  if (!deal.addr_zip && proposal.zip) pushDiff(diffs, 'deals.addr_zip', null, proposal.zip)
  if (!deal.addr_street_name && next.name) pushDiff(diffs, 'deals.addr_street_name', null, displayStreet(next.name, '').replace(/\s+$/, ''))
  return { diffs, gaps }
}

function econDiffs(econ, proposal) {
  const diffs = []
  const cur = econ || {}
  pushDiff(diffs, 'deal_economics.asking_price', cur.asking_price ?? null, proposal.asking)
  pushDiff(diffs, 'deal_economics.sqft', cur.sqft ?? null, proposal.sqft)
  pushDiff(diffs, 'deal_economics.land_sqft', cur.land_sqft ?? null, proposal.landSqft)
  pushDiff(diffs, 'deal_economics.lease_rate_psf', cur.lease_rate_psf ?? null, proposal.leaseRate)
  if (proposal.transaction && cur.transaction_type && cur.transaction_type !== proposal.transaction) {
    if (cur.transaction_type === 'buyer') {
      diffs.push({
        field: 'deal_economics.transaction_type',
        from: cur.transaction_type,
        to: null,
        note: 'buyer economics left unchanged',
        blocked: true,
      })
    } else {
      pushDiff(diffs, 'deal_economics.transaction_type', cur.transaction_type, proposal.transaction)
    }
  } else if (proposal.transaction && !cur.transaction_type) {
    pushDiff(diffs, 'deal_economics.transaction_type', null, proposal.transaction)
  }
  if (!econ && (proposal.asking != null || proposal.sqft != null || proposal.leaseRate != null)) {
    // transaction_type on a brand-new economics row
    if (proposal.transaction && !diffs.some(d => d.field === 'deal_economics.transaction_type')) {
      pushDiff(diffs, 'deal_economics.transaction_type', null, proposal.transaction)
    }
  }
  return diffs.filter(d => !d.blocked)
}

function updateDiffs(deal, econ, proposal) {
  const diffs = []
  const gaps = [...proposal.gaps]
  if (!deal.lacdb_url && proposal.url) pushDiff(diffs, 'deals.lacdb_url', null, proposal.url)
  else if (deal.lacdb_url && proposal.url && tidFromText(deal.lacdb_url) && tidFromText(deal.lacdb_url) !== proposal.primary.tid) {
    gaps.push(`lacdb_url already points at ${tidFromText(deal.lacdb_url)}; not replaced with ${proposal.primary.tid}`)
  }
  if (!deal.photo_url && proposal.photo) {
    pushDiff(diffs, 'deals.photo_url', null, proposal.photo, 'first LACDB photo URL; not uploaded to the deal-photos bucket')
  }
  if (!deal.property_type && proposal.propertyType) pushDiff(diffs, 'deals.property_type', null, proposal.propertyType)
  else if (deal.property_type && proposal.propertyType && deal.property_type !== proposal.propertyType) {
    gaps.push(`property_type is ${deal.property_type} on the deal and ${proposal.propertyType} on LACDB; deal value kept`)
  }
  if ((deal.acreage == null || deal.acreage === '') && proposal.acres != null) {
    pushDiff(diffs, 'deals.acreage', null, proposal.acres)
  }
  const addr = addressDiffs(deal, proposal)
  diffs.push(...addr.diffs)
  gaps.push(...addr.gaps)
  diffs.push(...econDiffs(econ, proposal))
  return { diffs, gaps }
}

function createPayload(proposal) {
  const norm = proposal.norm
  const filed = !!norm.number
  const row = {
    name: proposal.filing,
    address: proposal.filing,
    addr_display: proposal.filing,
    addr_number: filed ? norm.number : null,
    addr_street_name: filed && norm.name ? displayStreet(norm.name, '') : null,
    addr_street_type: filed && norm.suffix ? (SUFFIX_DISPLAY[norm.suffix] || null) : null,
    addr_direction: filed && norm.cardinal ? norm.cardinal.toUpperCase() : null,
    addr_city: proposal.city,
    addr_state: proposal.state,
    addr_zip: proposal.zip,
    property_type: proposal.propertyType,
    status: 'active',
    type: 'listing',
    representation_role: 'landlord',
    lacdb_url: proposal.url,
    photo_url: proposal.photo,
    acreage: proposal.acres,
    deal_source: `lacdb:${proposal.primary.tid}`,
  }
  const econ = {
    transaction_type: proposal.transaction,
    asking_price: proposal.asking,
    sqft: proposal.sqft,
    land_sqft: proposal.landSqft,
    lease_rate_psf: proposal.leaseRate,
    property_type: proposal.propertyType,
  }
  return { row, econ }
}

function buildPlan(feed, deals, econs, deadlineCounts) {
  const active = []
  const pending = []
  const houseNumbers = new Set()
  for (const listing of feed.listings) {
    const n = normalizeLine(listing.address?.street || '', listing.address?.city || '').number
    if (n) houseNumbers.add(n)
  }
  for (const listing of feed.listings) {
    const mapped = mapListing(listing, houseNumbers)
    if (listing.status === 'active') active.push(mapped)
    else pending.push(mapped)
  }
  const index = indexDeals(deals)
  const econBy = new Map(econs.map(e => [e.deal_id, e]))
  const feedTids = new Set(feed.listings.map(tidOfListing).filter(Boolean))

  const assignment = new Map()
  for (const mapped of active) {
    assignment.set(mapped.tid, listingCandidates(mapped, index))
  }

  const byAddress = new Map()
  for (const mapped of active) {
    const k = mapped.key || mapped.keyNoCity
    if (!k) continue
    if (!byAddress.has(k)) byAddress.set(k, [])
    byAddress.get(k).push(mapped)
  }
  for (const group of byAddress.values()) {
    const claimed = group
      .map(m => assignment.get(m.tid))
      .find(a => a && a.deals.length === 1 && (a.how === 'lacdb id' || a.how === 'address'))
    if (!claimed) continue
    for (const mapped of group) {
      const cur = assignment.get(mapped.tid)
      if (cur.how === 'none') assignment.set(mapped.tid, { deals: claimed.deals, how: 'same address as ' + claimed.how })
    }
  }

  const creates = []
  const updates = []
  const reviews = []
  const rows = []

  const createGroups = new Map()
  for (const mapped of active) {
    const found = assignment.get(mapped.tid)
    if (found.how === 'address ambiguous' || found.how === 'lacdb id ambiguous' || found.how === 'non-listing only') {
      reviews.push({ mapped, found })
      rows.push({ mapped, action: 'REVIEW', deal: null, found })
      continue
    }
    if (found.deals.length === 1) {
      const deal = found.deals[0]
      rows.push({ mapped, action: 'MATCH', deal, found })
      continue
    }
    const k = mapped.key || mapped.tid
    if (!createGroups.has(k)) createGroups.set(k, [])
    createGroups.get(k).push(mapped)
    rows.push({ mapped, action: 'CREATE', deal: null, found })
  }

  for (const group of createGroups.values()) {
    const proposal = mergedProposal(group)
    const payload = createPayload(proposal)
    creates.push({ group, proposal, payload })
  }

  const matchGroups = new Map()
  for (const row of rows) {
    if (row.action !== 'MATCH') continue
    if (!matchGroups.has(row.deal.id)) matchGroups.set(row.deal.id, { deal: row.deal, group: [], hows: [] })
    const bucket = matchGroups.get(row.deal.id)
    bucket.group.push(row.mapped)
    bucket.hows.push(row.found.how)
  }
  for (const bucket of matchGroups.values()) {
    bucket.how = bucket.hows.some(h => h.startsWith('lacdb id'))
      ? 'lacdb id'
      : (bucket.hows.find(h => h.startsWith('address') || h.startsWith('same address')) || bucket.hows[0])
    const proposal = mergedProposal(bucket.group, bucket.deal._tid)
    const econ = econBy.get(bucket.deal.id) || null
    if (econ) {
      bucket.deal._facts.sale_commission_present = econ.sale_commission_present
      bucket.deal._facts.lease_commission_present = econ.lease_commission_present
    }
    bucket.deal._facts.deadline_count = deadlineCounts.get(bucket.deal.id) || 0
    const { diffs, gaps } = updateDiffs(bucket.deal, econ, proposal)
    const writable = diffs.filter(d => d.to != null)
    bucket.proposal = proposal
    bucket.diffs = writable
    bucket.gaps = gaps
    bucket.action = writable.length ? 'UPDATE' : 'UNCHANGED'
    if (writable.length) updates.push(bucket)
  }

  for (const row of rows) {
    if (row.action !== 'MATCH') continue
    const bucket = matchGroups.get(row.deal.id)
    row.action = bucket.action
    row.bucket = bucket
  }

  const off = []
  const notTagged = []
  for (const deal of deals) {
    if (!deal._tid) continue
    if (feedTids.has(deal._tid)) continue
    if (!isListingDeal(deal)) {
      notTagged.push(deal)
      continue
    }
    deal._facts.deadline_count = deadlineCounts.get(deal.id) || 0
    off.push(deal)
  }

  const pendingNotes = pending.map(mapped => {
    const found = listingCandidates(mapped, index)
    return { mapped, found }
  })

  return { active, pending: pendingNotes, rows, creates, updates, reviews, off, notTagged, feedTids }
}

function fmt(value) {
  if (value == null || value === '') return '∅'
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toLocaleString('en-US')
    return String(value)
  }
  return String(value).replace(/\|/g, '/').replace(/\n/g, ' ')
}

function cell(value) {
  return fmt(value).replace(/\|/g, '/')
}

function dealLabel(deal) {
  if (!deal) return '—'
  const addr = deal.addr_display || deal.address || '—'
  return `${deal.name || '—'} · ${addr} · ${deal.status || '—'} · ${deal.type || '—'}`
}

function render(feed, plan, meta) {
  const createListings = plan.rows.filter(r => r.action === 'CREATE').length
  const updateListings = plan.rows.filter(r => r.action === 'UPDATE').length
  const unchangedListings = plan.rows.filter(r => r.action === 'UNCHANGED').length
  const reviewListings = plan.rows.filter(r => r.action === 'REVIEW').length
  const lines = []
  lines.push('# LACDB → War Room deals dry run')
  lines.push('')
  lines.push(`Run: ${meta.runAt}. Mode: **dry-run**. No Supabase write was sent.`)
  lines.push('')
  lines.push(`Feed: \`${meta.feedPath}\` generated ${feed.generated_at}. ${feed.count} records (${feed.counts?.full ?? '?'} full, ${feed.counts?.summary ?? '?'} summary). ${plan.active.length} status=active, ${plan.pending.length} not active.`)
  lines.push('')
  lines.push(`Deals read: ${meta.dealCount} (\`${meta.source}\`). Economics rows: ${meta.econCount}. Deadline rows counted: ${meta.deadlineCount}. Requests: ${meta.gets} GET, 0 writes.`)
  lines.push('')
  lines.push('## Counts')
  lines.push('')
  lines.push('| Outcome | Listings | Deals |')
  lines.push('| --- | ---: | ---: |')
  lines.push(`| CREATE | ${createListings} | ${plan.creates.length} |`)
  lines.push(`| UPDATE | ${updateListings} | ${plan.updates.length} |`)
  lines.push(`| UNCHANGED (matched, no writable diff) | ${unchangedListings} | ${plan.rows.filter(r => r.action === 'UNCHANGED').reduce((s, r) => s.add(r.deal.id), new Set()).size} |`)
  const reviewDeals = new Set(plan.reviews.flatMap(r => r.found.deals.map(d => d.id)))
  lines.push(`| REVIEW (not created or updated) | ${reviewListings} | ${reviewDeals.size} candidates, none chosen |`)
  lines.push(`| Off LACDB (tag, never delete) | — | ${plan.off.length} |`)
  lines.push('')
  lines.push('CREATE and UPDATE deals are the sync result. Off LACDB is a tag list, not a delete. UNCHANGED rows already agree on the fields this script is allowed to write.')
  lines.push('')
  lines.push('## Per-listing table')
  lines.push('')
  lines.push('| LACDB id | Detail | Tx | Address | Action | Deal |')
  lines.push('| --- | --- | --- | --- | --- | --- |')
  for (const row of plan.rows) {
    const l = row.mapped.listing
    lines.push(`| ${row.mapped.tid} | ${l.detail_level || 'full'} | ${l.transaction_type} | ${cell(l.address?.street)}, ${cell(l.address?.city)} | ${row.action} | ${cell(dealLabel(row.deal))} |`)
  }
  lines.push('')

  lines.push('## CREATE')
  lines.push('')
  if (!plan.creates.length) lines.push('None.')
  for (const item of plan.creates) {
    const ids = item.group.map(m => m.tid).join(', ')
    lines.push(`### ${item.proposal.filing} (${ids})`)
    lines.push('')
    lines.push('Proposed `deals` insert (not sent):')
    lines.push('')
    lines.push('```json')
    lines.push(JSON.stringify(item.payload.row, null, 2))
    lines.push('```')
    lines.push('')
    lines.push('Proposed `deal_economics` insert (commission percents omitted):')
    lines.push('')
    lines.push('```json')
    lines.push(JSON.stringify(item.payload.econ, null, 2))
    lines.push('```')
    lines.push('')
    if (item.proposal.gaps.length) {
      lines.push('Gaps:')
      lines.push('')
      for (const g of item.proposal.gaps) lines.push(`- ${g}`)
      lines.push('')
    }
  }

  lines.push('## UPDATE')
  lines.push('')
  if (!plan.updates.length) lines.push('None.')
  for (const bucket of plan.updates) {
    const ids = bucket.group.map(m => m.tid).join(', ')
    lines.push(`### ${dealLabel(bucket.deal)}`)
    lines.push('')
    lines.push(`Matched by ${bucket.how}. Listings: ${ids}. Status, type, client name, notes, deadlines, and commission stay as they are.`)
    lines.push('')
    lines.push('| Field | From | To |')
    lines.push('| --- | --- | --- |')
    for (const d of bucket.diffs) {
      const note = d.note ? ` — ${d.note}` : ''
      lines.push(`| ${d.field}${note} | ${cell(d.from)} | ${cell(d.to)} |`)
    }
    lines.push('')
    const facts = bucket.deal._facts
    lines.push(`Protected on this row: notes ${facts.notes_present ? 'present' : 'empty'}, deadlines ${facts.deadline_count}, sale commission ${facts.sale_commission_present ? 'present' : 'empty'}, lease commission ${facts.lease_commission_present ? 'present' : 'empty'}, dropbox ${facts.dropbox_present ? 'present' : 'empty'}.`)
    lines.push('')
    if (bucket.gaps.length) {
      lines.push('Not written:')
      lines.push('')
      for (const g of [...new Set(bucket.gaps)]) lines.push(`- ${g}`)
      lines.push('')
    }
  }

  lines.push('## Off LACDB')
  lines.push('')
  lines.push('These listing deals store an LACDB id that is not in the current feed. The row stays. Status is not changed. `deal_source` is not rewritten, because that column is how the id is stored and there is no tag column.')
  lines.push('')
  if (!plan.off.length) lines.push('None.')
  else {
    lines.push('| Deal | Status | Type | Stored id | Notes | Deadlines |')
    lines.push('| --- | --- | --- | --- | --- | ---: |')
    for (const deal of plan.off) {
      lines.push(`| ${cell(dealLabel(deal))} | ${cell(deal.status)} | ${cell(deal.type)} | ${deal._tid} | ${deal._facts.notes_present ? 'present, kept' : 'empty'} | ${deal._facts.deadline_count} |`)
    }
    lines.push('')
    lines.push('Tag to apply later: **Off LACDB**. Delete: no.')
    lines.push('')
  }

  if (plan.notTagged.length) {
    lines.push('LACDB ids on deals that are not listings were not tagged:')
    lines.push('')
    for (const deal of plan.notTagged) {
      lines.push(`- ${dealLabel(deal)} — stored id ${deal._tid}`)
    }
    lines.push('')
  }

  lines.push('## REVIEW')
  lines.push('')
  if (!plan.reviews.length) lines.push('None.')
  for (const rev of plan.reviews) {
    const names = rev.found.deals.map(d => dealLabel(d)).join('; ')
    lines.push(`- **${rev.mapped.tid}** ${rev.mapped.listing.address?.street} — ${rev.found.how}: ${names}`)
  }
  lines.push('')

  lines.push('## Not active on the feed')
  lines.push('')
  if (!plan.pending.length) lines.push('None.')
  for (const item of plan.pending) {
    const hit = item.found.deals.length ? item.found.deals.map(d => dealLabel(d)).join('; ') : 'no address match'
    lines.push(`- **${item.mapped.tid}** status ${item.mapped.listing.status} — ${item.mapped.listing.address?.street}. Left unchanged. ${item.found.how}: ${hit}. Not Off LACDB; the record is still in the feed.`)
  }
  lines.push('')

  lines.push('## Field-mapping gaps')
  lines.push('')
  lines.push('- No generator script is in the repo. `public/agents/listings.json` is the PR 16 one-time export (`generated_at` above). This dry run did not pull LACDB again.')
  lines.push('- The feed excludes co-listed ids ' + (feed.source?.excluded_listing_ids || []).join(', ') + '. They are not created and are not tagged Off LACDB unless a deal already stores one of those ids.')
  lines.push('- `related_listing_ids` is empty on these records. Same-address sale and lease records are grouped here; the schema has one `deal_source` / one `lacdb_url` per deal.')
  lines.push('- Summary stubs often have no `property_types`, no `size`, and a price label instead of `price.amount`. Empty feed fields do not clear a deal.')
  lines.push('- `asking_price` is written only for a single total. `$ /SF` ranges (land splits) and conflicting totals are left out.')
  lines.push('- `lease_rate_psf` is written only for one `$/SF/year` figure. Ranges (`$12 - $22 SF/year`) and `$ /Month` labels are left out. A summary stub rate is left out.')
  lines.push('- Leased spaces are ignored. Available spaces with different rates are left out.')
  lines.push('- Land lot sf is proposed as `deal_economics.sqft` when there is no building sf, because existing land deals already store lot sf there, and also as `land_sqft`. Acreage goes to `deals.acreage` only when min and max agree.')
  lines.push('- `photo_url` would be the LACDB CDN url. The deal form uploads into the `deal-photos` bucket. This dry run does not download or upload photos. An existing photo is kept.')
  lines.push('- There is no Off LACDB column. `deals.emoji` does not exist. Putting the tag in `deal_source` would erase `lacdb:<id>`. The tag is the report, not a column write.')
  lines.push('- New deals would use `type: listing` and `representation_role: landlord`, which is what the deal form writes. Older rows use `active_listing`. Existing type and status are not remapped.')
  lines.push('- `deals.property_type` allows INDUSTRIAL, LAND, OFFICE, OTHER, RETAIL. The form also offers MULTIFAMILY; this feed has none.')
  lines.push('- House-number mismatches are a diff only when the deal already stores that LACDB id and the street name matches. A different place name (a tract legal description versus a name already on the deal) is not overwritten.')
  lines.push('- Client `name` is never overwritten. Notes, contract deadlines, and every commission column are omitted from every payload.')
  lines.push('')
  lines.push('## Protected columns')
  lines.push('')
  for (const item of PROTECTED) lines.push(`- ${item}`)
  lines.push('')
  lines.push('## Run')
  lines.push('')
  lines.push('```')
  lines.push('node scripts/lacdb-sync.mjs')
  lines.push('node scripts/lacdb-sync.mjs --dry-run')
  lines.push('node scripts/lacdb-sync.mjs --apply')
  lines.push('```')
  lines.push('')
  lines.push('`--apply` exits without sending a write. `--dry-run` is the default.')
  lines.push('')
  return lines.join('\n')
}

function selfTest() {
  function keyOf(line, city) {
    return addressKey(normalizeLine(line, city))
  }
  const pairs = [
    ['5229 Government St', 'Government St. 5229', 'Baton Rouge'],
    ['1400 -1500 Wooddale Blvd', 'Wooddale Blvd. 1400', 'Baton Rouge'],
    ['25035 LA-1', 'LA-1 25035', 'Plaquemine'],
    ['328 Desiard St', 'DeSiard St. 328', 'Monroe'],
    ['619 Jefferson Hwy', 'Jefferson Hwy. 619, Suite 2-G', 'Baton Rouge'],
    ['Interstate 12 Service Road', 'I-12 Service Rd.', 'Hammond'],
    ['12025 Industriplex Blvd', 'Industriplex Blvd., , 12025', 'Baton Rouge'],
  ]
  for (const [a, b, city] of pairs) {
    const ka = keyOf(a, city)
    const kb = keyOf(b, city)
    if (ka !== kb) throw new Error(`normalize mismatch\n  ${a} -> ${ka}\n  ${b} -> ${kb}`)
  }
  const tractA = keyOf('Tract A-2-A-4-1-B', 'Baton Rouge')
  const tractB = keyOf('Tract A-2-A-4-1-B', 'Baton Rouge')
  if (tractA !== tractB) throw new Error('tract key unstable')
  if (tractA.split('|')[0] !== '') throw new Error('tract picked up a house number: ' + tractA)
  const gov = normalizeLine('5229 Government St', 'Baton Rouge')
  if (filingDisplay(gov, '5229 Government St') !== 'Government St. 5229') throw new Error('filing ' + filingDisplay(gov, '5229 Government St'))
  const between = normalizeLine('Between N 13th and N 14th St', 'Baton Rouge')
  if (filingDisplay(between, 'Between N 13th and N 14th St') !== 'Between N 13th and N 14th St') {
    throw new Error('intersection filing changed')
  }
  if (replaceHouseNumber('5219 Government St, Baton Rouge, LA 70806, USA', '5219', '5229')
    !== '5229 Government St, Baton Rouge, LA 70806, USA') throw new Error('house number replace')
  const wrongPhoto = photoForListing({
    media: { photos: ['https://example.test/5d4a0303/5235-government-st-a.webp'] },
  }, { number: '5229' }, new Set(['5229', '5235']))
  if (wrongPhoto) throw new Error('photo from another street number was kept')
  const frontage = photoForListing({
    media: { photos: ['https://example.test/e0963f9a/-05-acre-tract-w-100-frontage.webp'] },
  }, { number: '4109' }, new Set(['4109', '5229']))
  if (!frontage) throw new Error('frontage number was treated as a street number')
  if (parseTotalLabel('$2,950,000') !== 2950000) throw new Error('label parse')
  if (parseTotalLabel('$10 - $13 SF/year') !== null) throw new Error('range label parsed as total')
  if (parseRateLabel('$1 SF/year')?.min !== 1) throw new Error('rate label')
  if (!moneyEqual(2950000, 2947487)) throw new Error('expected rounded totals to match')
  if (moneyEqual(3200000, 2957000)) throw new Error('wooddale prices should differ')
  if (tidFromText('lacdb:5d4a0303-084-acres-lit-hard-corner') !== '5d4a0303') throw new Error('tid slug')
  if (tidFromText('lacdb:e0963f9a-8235-4325-9f0d-f1d4a40ce237') !== 'e0963f9a') throw new Error('tid uuid')
  if (tidFromText('https://lacdb.resimplifi.com/listings/d36904f1-12025-industriplex-blvd') !== 'd36904f1') throw new Error('tid url')
  if (tidFromText('Duty')) throw new Error('user label parsed as tid')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('Usage: node scripts/lacdb-sync.mjs [--dry-run] [--feed path] [--out path]')
    console.log('       node scripts/lacdb-sync.mjs --apply   # refused, no write')
    return
  }
  if (args.apply) {
    console.error('Refusing --apply. This script is dry-run only and does not write to Supabase.')
    process.exitCode = 2
    return
  }
  selfTest()
  if (args.selfTestOnly) {
    console.log('self-test ok')
    return
  }

  const feed = loadFeed(args.feed)
  const cfg = configuredSupabase()
  let deals = []
  let econs = []
  let deadlineCounts = new Map()
  let gets = 0
  let source = 'schema only — deals were not read'
  if (cfg) {
    const dealSelect = [
      'id', 'name', 'address', 'addr_display', 'addr_number', 'addr_street_name', 'addr_street_type',
      'addr_direction', 'addr_city', 'addr_state', 'addr_zip', 'status', 'type', 'property_type',
      'lacdb_url', 'photo_url', 'deal_source', 'representation_role', 'acreage',
      'notes', 'dropbox_link', 'rating', 'commission_rate', 'commission_estimated', 'commission_collected',
    ].join(',')
    const econSelect = [
      'deal_id', 'transaction_type', 'property_type', 'asking_price', 'sqft', 'land_sqft',
      'lease_rate_psf', 'lease_term_years', 'sale_commission_pct', 'lease_commission_pct',
    ].join(',')
    deals = (await restGetAll(cfg.url, cfg.key, 'deals', dealSelect)).map(redactDeal)
    gets += 1
    econs = (await restGetAll(cfg.url, cfg.key, 'deal_economics', econSelect)).map(redactEcon)
    gets += 1
    const deadlines = await restGetAll(cfg.url, cfg.key, 'contract_deadlines', 'deal_id')
    gets += 1
    deadlineCounts = new Map()
    for (const row of deadlines) {
      deadlineCounts.set(row.deal_id, (deadlineCounts.get(row.deal_id) || 0) + 1)
    }
    source = `${cfg.from}; GET only`
  }

  const plan = buildPlan(feed, deals, econs, deadlineCounts)
  const markdown = render(feed, plan, {
    runAt: new Date().toISOString(),
    feedPath: args.feed.replace(ROOT + '/', ''),
    source,
    dealCount: deals.length,
    econCount: econs.length,
    deadlineCount: [...deadlineCounts.values()].reduce((a, b) => a + b, 0),
    gets,
  })
  if (markdown.includes('sb_publishable_') || markdown.includes('service_role')) {
    throw new Error('Report contained a key. Not writing it.')
  }
  mkdirSync(dirname(args.out), { recursive: true })
  writeFileSync(args.out, markdown)
  const createDeals = plan.creates.length
  const updateDeals = plan.updates.length
  const off = plan.off.length
  console.log(`CREATE deals: ${createDeals}`)
  console.log(`UPDATE deals: ${updateDeals}`)
  console.log(`Off LACDB deals: ${off}`)
  console.log(`REVIEW listings: ${plan.reviews.length}`)
  console.log(`Wrote ${args.out}`)
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (invoked) {
  main().catch(err => {
    console.error(err.message || err)
    process.exitCode = 1
  })
}

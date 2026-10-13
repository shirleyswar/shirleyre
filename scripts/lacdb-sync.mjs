#!/usr/bin/env node
/**
 * Dry-run: map Matthew Shirley's LACDB listing feed onto War Room deals.
 *
 * Feed: public/agents/listings.json (served as /agents/listings.json).
 * PR 16 (WARROOM-171) staged that file as a one-time export. No generator
 * script is in this repo or on the listing-feed branches — refresh is manual.
 *
 * Default is --dry-run. Reads are HTTP GET.
 * --apply is a one-time write of the CREATE and UPDATE plan. It does not
 * schedule a pull, and it does not touch Off-LACDB rows.
 * It writes a JSON pre-image of the update targets before any PATCH or POST.
 * --apply-jefferson is the later decision for 619 Jefferson (7eb337d8):
 * the Bob Belk row labeled Suite 2-G is Suite 2H, and Suite 1-D is leased
 * and is not written. It appends that pre-image to the same backup.
 *
 * Match order:
 *   1. LACDB id already stored on the deal (deal_source "lacdb:<id>" or lacdb_url)
 *   2. Normalized street address (house number, name, suffix, city)
 * Listings that share an address attach to the same deal.
 * Deals whose stored LACDB id is absent from the feed are reported as
 * "Off LACDB". They are not deleted. Notes, deadlines, and commission
 * are never part of a payload.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_FEED = resolve(ROOT, 'public/agents/listings.json')
const DEFAULT_OUT = resolve(ROOT, 'docs/lacdb-sync-dry-run.md')
const DEFAULT_BACKUP = resolve(ROOT, 'docs/lacdb-sync-backup.json')
const DEFAULT_APPLIED = resolve(ROOT, 'docs/lacdb-sync-applied.md')
const STORE_BACKUP = '/cursor/stores/self/lacdb-sync-backup.json'

const EXPECT_CREATE_TIDS = ['30f8f0a3', 'c10c62e0', '5296eedb']
const EXPECT_UPDATE_NAMES = [
  'Daniel Laborde', 'Anthony Kimble', 'UPals', 'Industriplex Blvd. 12025',
  'Hank Saurage', 'Charles Cooper', 'Food Bank', 'The Annex', 'Windy Gladney',
]
const SKIP_REVIEW_TID = '7eb337d8'
const JEFFERSON_2G_ID = 'b490c629-363b-41da-a63c-bb28e1c3a061'
const JEFFERSON_1D_ID = '5acf7068-4117-4840-9811-f046390fbef9'
const SUITE_2G = 'Suite 2-G'
const SUITE_2H = 'Suite 2H'
const SUITE_1D = 'Suite 1-D'

const UPDATE_DEAL_ALLOW = new Set([
  'lacdb_url', 'photo_url', 'acreage', 'addr_number', 'addr_display', 'address',
  'addr_state', 'addr_zip', 'addr_city', 'addr_street_name', 'addr_street_type', 'addr_direction',
])
const UPDATE_ECON_ALLOW = new Set([
  'asking_price', 'sqft', 'land_sqft', 'lease_rate_psf', 'transaction_type', 'property_type',
])
const CREATE_DEAL_ALLOW = new Set([
  ...UPDATE_DEAL_ALLOW,
  'name', 'status', 'type', 'representation_role', 'deal_source', 'property_type',
])
const DENY_ALWAYS = new Set([
  'notes', 'commission_rate', 'commission_estimated', 'commission_collected',
  'sale_commission_pct', 'lease_commission_pct', 'dropbox_link', 'rating',
])

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
  const out = {
    dryRun: true, apply: false, applyJefferson: false, feed: DEFAULT_FEED, out: DEFAULT_OUT,
    backup: DEFAULT_BACKUP, applied: DEFAULT_APPLIED, selfTestOnly: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--apply') out.apply = true
    else if (a === '--apply-jefferson') out.applyJefferson = true
    else if (a === '--self-test') out.selfTestOnly = true
    else if (a === '--feed') out.feed = resolve(argv[++i])
    else if (a === '--out') out.out = resolve(argv[++i])
    else if (a === '--backup') out.backup = resolve(argv[++i])
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
  lines.push('`--dry-run` is the default. `--apply` writes the CREATE and UPDATE plan once, after saving a JSON pre-image. It does not schedule a pull.')
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
  assertAllow({ lacdb_url: 'https://example.test' }, UPDATE_DEAL_ALLOW, 'deal')
  let denied = false
  try { assertAllow({ notes: 'x' }, UPDATE_DEAL_ALLOW, 'deal') } catch { denied = true }
  if (!denied) throw new Error('notes were allowed onto an update')
  const stripped = omitEmpty({ a: 1, b: null, c: '' })
  if (stripped.b !== undefined || stripped.c !== undefined || stripped.a !== 1) throw new Error('omitEmpty')
  const jefferson = JSON.parse(readFileSync(resolve(ROOT, 'public/agents/listings/7eb337d8.json'), 'utf8'))
  const mapped = mapListing(jefferson, new Set(['619']))
  if (mapped.tid !== SKIP_REVIEW_TID) throw new Error('jefferson tid')
  if (mapped.leaseRate !== 13.59 || mapped.leaseSf !== 1766) throw new Error('jefferson available space')
  if (mapped.asking != null) throw new Error('jefferson asking should be empty')
  const leasedSpaces = (jefferson.lease_spaces || []).filter(s => s.status === 'leased')
  if (leasedSpaces.length !== 1 || leasedSpaces[0].available_sf_max !== 1667) throw new Error('jefferson leased space')
  const patch = jeffersonDealPatch({
    name: 'Bob Belk',
    status: 'active',
    type: 'active_listing',
    notes: 'keep',
    dropbox_link: 'keep',
    deal_source: null,
    lacdb_url: null,
    photo_url: null,
    acreage: null,
    addr_state: null,
    addr_zip: null,
    addr_display: 'Jefferson Hwy. 619, Suite 2-G',
    address: '619 Jefferson Hwy. Suite 2-G',
  }, mapped)
  if (patch.addr_display !== 'Jefferson Hwy. 619, Suite 2H') throw new Error('display suite ' + patch.addr_display)
  if (patch.address !== '619 Jefferson Hwy. Suite 2H') throw new Error('address suite ' + patch.address)
  if (patch.name || patch.status || patch.type || patch.notes || patch.dropbox_link || patch.deal_source) {
    throw new Error('jefferson patch included a protected column')
  }
  if (!String(patch.lacdb_url).includes(SKIP_REVIEW_TID)) throw new Error('jefferson url')
  if (!patch.photo_url) throw new Error('jefferson photo')
  if (patch.addr_state !== 'LA' || patch.addr_zip !== '70806') throw new Error('jefferson state zip')
  if (replaceSuiteLabel('Jefferson Hwy. 619, Suite 1-D') !== 'Jefferson Hwy. 619, Suite 1-D') {
    throw new Error('suite 1-D label changed')
  }
  const econ = jeffersonEconPatch(null, mapped)
  if (econ.transaction_type !== 'lease' || econ.lease_rate_psf !== 13.59 || econ.sqft !== 1766) {
    throw new Error('jefferson economics ' + JSON.stringify(econ))
  }
  if ('sale_commission_pct' in econ || 'lease_commission_pct' in econ || 'asking_price' in econ) {
    throw new Error('jefferson economics invented a price or commission')
  }
  const filled = jeffersonDealPatch({
    lacdb_url: mapped.url,
    photo_url: mapped.photo,
    addr_state: 'LA',
    addr_zip: '70806',
    addr_display: 'Jefferson Hwy. 619, Suite 2H',
    address: '619 Jefferson Hwy. Suite 2H',
  }, mapped)
  if (Object.keys(filled).length) throw new Error('filled jefferson deal was patched again')
}

function omitEmpty(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '') continue
    out[k] = v
  }
  return out
}

function assertAllow(patch, allow, label) {
  for (const key of Object.keys(patch)) {
    if (DENY_ALWAYS.has(key) || !allow.has(key)) {
      throw new Error(`${label} field ${key} is not allowed`)
    }
  }
}

function replaceSuiteLabel(value) {
  if (value == null || value === '') return value
  const text = String(value)
  if (!text.includes(SUITE_2G)) return value
  return text.split(SUITE_2G).join(SUITE_2H)
}

function jeffersonDealPatch(deal, mapped) {
  const patch = {}
  if (!deal.lacdb_url && mapped.url) patch.lacdb_url = mapped.url
  if (!deal.photo_url && mapped.photo) patch.photo_url = mapped.photo
  if ((deal.acreage == null || deal.acreage === '') && mapped.acres != null) patch.acreage = mapped.acres
  if (!deal.addr_state && mapped.state) patch.addr_state = mapped.state
  if (!deal.addr_zip && mapped.zip) patch.addr_zip = mapped.zip
  const display = replaceSuiteLabel(deal.addr_display)
  if (display !== deal.addr_display) patch.addr_display = display
  const address = replaceSuiteLabel(deal.address)
  if (address !== deal.address) patch.address = address
  assertAllow(patch, UPDATE_DEAL_ALLOW, 'jefferson deal')
  return patch
}

function jeffersonEconPatch(econ, mapped) {
  const cur = econ || {}
  const patch = {}
  if ((cur.lease_rate_psf == null || cur.lease_rate_psf === '') && mapped.leaseRate != null) {
    patch.lease_rate_psf = mapped.leaseRate
  }
  if ((cur.sqft == null || cur.sqft === '') && mapped.leaseSf != null) patch.sqft = mapped.leaseSf
  if (!cur.transaction_type && mapped.leaseRate != null) patch.transaction_type = 'lease'
  assertAllow(patch, UPDATE_ECON_ALLOW, 'jefferson economics')
  return patch
}

function patchFromDiffs(diffs, table, allow) {
  const patch = {}
  for (const d of diffs) {
    const [tbl, col] = d.field.split('.')
    if (tbl !== table) continue
    if (d.to == null || d.to === '') continue
    patch[col] = d.to
  }
  assertAllow(patch, allow, table)
  return patch
}

function sameValue(actual, expected) {
  if ((actual == null || actual === '') && (expected == null || expected === '')) return true
  const actualText = String(actual)
  const expectedText = String(expected)
  if (/^-?\d+(\.\d+)?$/.test(actualText) && /^-?\d+(\.\d+)?$/.test(expectedText)) {
    return Math.abs(Number(actualText) - Number(expectedText)) < 0.001
  }
  return actualText === expectedText
}

function authHeaders(key, extra) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
    ...extra,
  }
}

async function restGet(baseUrl, key, path) {
  const res = await fetch(baseUrl + path, { method: 'GET', headers: authHeaders(key) })
  const text = await res.text()
  if (!res.ok) throw new Error(`GET ${path} ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text)
}

async function restWrite(baseUrl, key, method, path, body) {
  if (method !== 'POST' && method !== 'PATCH') throw new Error(`refusing ${method}`)
  const okPath = path.startsWith('/rest/v1/deals') || path.startsWith('/rest/v1/deal_economics')
  if (!okPath) throw new Error(`refusing path ${path}`)
  const res = await fetch(baseUrl + path, {
    method,
    headers: authHeaders(key, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${text.slice(0, 400)}`)
  const data = text ? JSON.parse(text) : null
  return Array.isArray(data) ? data[0] : data
}

function saveBackup(paths, backup) {
  const text = JSON.stringify(backup, null, 2)
  if (text.includes('sb_publishable_') || text.includes('service_role')) {
    throw new Error('Backup contained a key. Not writing it.')
  }
  const repoPath = paths[0]
  mkdirSync(dirname(repoPath), { recursive: true })
  writeFileSync(repoPath, text)
  for (const path of paths.slice(1)) {
    try {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, text)
    } catch (err) {
      console.error(`backup copy skipped at ${path}: ${err.message}`)
    }
  }
}

function approvedPlan(plan) {
  const createTids = plan.creates.map(c => c.proposal.primary.tid).sort()
  const expect = [...EXPECT_CREATE_TIDS].sort()
  if (createTids.join() !== expect.join()) {
    throw new Error(`CREATE set is ${createTids.join(', ')}; approved set is ${expect.join(', ')}`)
  }
  const names = plan.updates.map(u => u.deal.name).sort()
  const expectNames = [...EXPECT_UPDATE_NAMES].sort()
  if (names.join('|') !== expectNames.join('|')) {
    throw new Error(`UPDATE names are ${names.join(', ')}; approved set differs`)
  }
  const reviewTids = plan.reviews.map(r => r.mapped.tid)
  if (reviewTids.length !== 1 || reviewTids[0] !== SKIP_REVIEW_TID) {
    throw new Error(`REVIEW set is ${reviewTids.join(', ')}; only ${SKIP_REVIEW_TID} may be skipped`)
  }
  const reviewIds = new Set(plan.reviews.flatMap(r => r.found.deals.map(d => d.id)))
  for (const bucket of plan.updates) {
    if (reviewIds.has(bucket.deal.id)) throw new Error(`Jefferson deal ${bucket.deal.id} is in the update set`)
  }
  const offIds = new Set(plan.off.map(d => d.id))
  for (const bucket of plan.updates) {
    if (offIds.has(bucket.deal.id)) throw new Error(`Off-LACDB deal ${bucket.deal.name} is in the update set`)
  }
  const laborde = plan.updates.find(u => u.deal.name === 'Daniel Laborde')
  const number = laborde.diffs.find(d => d.field === 'deals.addr_number')
  if (!number || number.to !== '5229') throw new Error('Laborde address update is not 5229')
  return { reviewIds, offIds }
}

function buildWrites(plan) {
  const updates = plan.updates.map(bucket => {
    const dealPatch = patchFromDiffs(bucket.diffs, 'deals', UPDATE_DEAL_ALLOW)
    const econPatch = patchFromDiffs(bucket.diffs, 'deal_economics', UPDATE_ECON_ALLOW)
    if ('name' in dealPatch || 'status' in dealPatch || 'type' in dealPatch) {
      throw new Error(`update for ${bucket.deal.name} includes a protected column`)
    }
    return {
      id: bucket.deal.id,
      name: bucket.deal.name,
      tids: bucket.group.map(m => m.tid),
      dealPatch,
      econPatch,
    }
  })
  const creates = plan.creates.map(item => {
    const deal = omitEmpty(item.payload.row)
    const econ = omitEmpty(item.payload.econ)
    assertAllow(deal, CREATE_DEAL_ALLOW, 'create deal')
    assertAllow(econ, UPDATE_ECON_ALLOW, 'create economics')
    if (deal.status !== 'active' || deal.type !== 'listing') {
      throw new Error(`create ${deal.name} is not an active listing`)
    }
    return {
      name: deal.name,
      tid: item.proposal.primary.tid,
      tids: item.group.map(m => m.tid),
      deal,
      econ,
    }
  })
  return { updates, creates }
}

async function applyPlan(cfg, plan, paths) {
  approvedPlan(plan)
  const writes = buildWrites(plan)
  const ids = writes.updates.map(u => u.id)
  const idFilter = ids.join(',')
  const beforeDeals = await restGet(cfg.url, cfg.key, `/rest/v1/deals?id=in.(${idFilter})&select=*`)
  const beforeEcon = await restGet(cfg.url, cfg.key, `/rest/v1/deal_economics?deal_id=in.(${idFilter})&select=*`)
  const beforeDeadlines = await restGet(cfg.url, cfg.key, `/rest/v1/contract_deadlines?deal_id=in.(${idFilter})&select=*`)
  if (beforeDeals.length !== ids.length) {
    throw new Error(`snapshot loaded ${beforeDeals.length} deals, expected ${ids.length}`)
  }
  const offIds = plan.off.map(d => d.id).join(',')
  const offBefore = await restGet(cfg.url, cfg.key, `/rest/v1/deals?id=in.(${offIds})&select=id,name,status,updated_at,address,addr_display`)
  const backup = {
    taken_at: new Date().toISOString(),
    feed_generated_at: '2026-10-05T12:30:00Z',
    note: 'Pre-image of deals the one-time LACDB sync will update. Restore a deal by PATCH of these columns. Delete rows listed in created after a successful apply. Off-LACDB rows were not written.',
    applied: false,
    updates: ids.map(id => ({
      deal: beforeDeals.find(d => d.id === id),
      deal_economics: beforeEcon.filter(e => e.deal_id === id),
      contract_deadlines: beforeDeadlines.filter(d => d.deal_id === id),
    })),
    creates_planned: writes.creates.map(c => ({ name: c.name, tid: c.tid, tids: c.tids, deal: c.deal, econ: c.econ })),
    created: [],
    skipped_review: [SKIP_REVIEW_TID],
    off_lacdb_untouched: plan.off.map(d => ({
      id: d.id, name: d.name, status: d.status, tid: d._tid,
    })),
  }
  saveBackup(paths, backup)

  const written = []
  for (const op of writes.updates) {
    const dealRow = Object.keys(op.dealPatch).length
      ? await restWrite(cfg.url, cfg.key, 'PATCH', `/rest/v1/deals?id=eq.${op.id}`, op.dealPatch)
      : null
    let econAction = 'none'
    let econWritten = op.econPatch
    if (Object.keys(op.econPatch).length) {
      const existing = beforeEcon.filter(e => e.deal_id === op.id)
      if (existing.length) {
        await restWrite(cfg.url, cfg.key, 'PATCH', `/rest/v1/deal_economics?deal_id=eq.${op.id}`, op.econPatch)
        econAction = 'patch'
      } else {
        // Nulls keep the column default (3%) from inventing a commission on a new row.
        econWritten = { ...op.econPatch, sale_commission_pct: null, lease_commission_pct: null }
        await restWrite(cfg.url, cfg.key, 'POST', '/rest/v1/deal_economics', { deal_id: op.id, ...econWritten })
        econAction = 'insert'
      }
    }
    const check = await restGet(cfg.url, cfg.key, `/rest/v1/deals?id=eq.${op.id}&select=id,name,status,type,representation_role,notes,dropbox_link,addr_number,addr_display,address,addr_state,addr_zip,lacdb_url,photo_url,acreage`)
    const econCheck = await restGet(cfg.url, cfg.key, `/rest/v1/deal_economics?deal_id=eq.${op.id}&select=deal_id,asking_price,sqft,land_sqft,lease_rate_psf,transaction_type,sale_commission_pct,lease_commission_pct`)
    const row = check[0]
    const before = beforeDeals.find(d => d.id === op.id)
    if (row.name !== before.name || row.status !== before.status || row.type !== before.type || row.representation_role !== before.representation_role) {
      throw new Error(`${op.name}: protected deal column changed`)
    }
    if ((row.notes || '') !== (before.notes || '') || (row.dropbox_link || '') !== (before.dropbox_link || '')) {
      throw new Error(`${op.name}: notes or dropbox changed`)
    }
    for (const [col, value] of Object.entries(op.dealPatch)) {
      if (!sameValue(row[col], value)) throw new Error(`${op.name}: ${col} is ${row[col]}, expected ${value}`)
    }
    const econ = econCheck[0] || {}
    const beforeE = beforeEcon.find(e => e.deal_id === op.id) || {}
    if (Object.keys(op.econPatch).length) {
      if (beforeE.sale_commission_pct != null && !sameValue(econ.sale_commission_pct, beforeE.sale_commission_pct)) {
        throw new Error(`${op.name}: sale commission changed`)
      }
      if (beforeE.lease_commission_pct != null && !sameValue(econ.lease_commission_pct, beforeE.lease_commission_pct)) {
        throw new Error(`${op.name}: lease commission changed`)
      }
      for (const [col, value] of Object.entries(op.econPatch)) {
        if (!sameValue(econ[col], value)) throw new Error(`${op.name}: economics ${col} is ${econ[col]}, expected ${value}`)
      }
    }
    written.push({
      action: 'UPDATE',
      id: op.id,
      name: op.name,
      tids: op.tids,
      deal: op.dealPatch,
      economics: econWritten,
      economics_action: econAction,
      returned_id: dealRow?.id || op.id,
    })
    console.log(`updated ${op.name}`)
  }

  for (const op of writes.creates) {
    const created = await restWrite(cfg.url, cfg.key, 'POST', '/rest/v1/deals', op.deal)
    if (!created?.id) throw new Error(`create ${op.name} returned no id`)
    let econId = null
    const econWritten = Object.keys(op.econ).length
      ? { ...op.econ, sale_commission_pct: null, lease_commission_pct: null }
      : op.econ
    if (Object.keys(econWritten).length) {
      const econRow = await restWrite(cfg.url, cfg.key, 'POST', '/rest/v1/deal_economics', { deal_id: created.id, ...econWritten })
      econId = econRow?.id || null
    }
    backup.created.push({ id: created.id, economics_id: econId, name: op.name, tid: op.tid, tids: op.tids })
    saveBackup(paths, backup)
    const check = await restGet(cfg.url, cfg.key, `/rest/v1/deals?id=eq.${created.id}&select=id,name,address,addr_display,status,type,lacdb_url,deal_source,property_type`)
    const row = check[0]
    if (row.name !== op.deal.name || row.deal_source !== op.deal.deal_source) {
      throw new Error(`create ${op.name} did not persist`)
    }
    written.push({
      action: 'CREATE',
      id: created.id,
      name: op.name,
      tids: op.tids,
      deal: op.deal,
      economics: econWritten,
      economics_id: econId,
    })
    console.log(`created ${op.name} ${created.id}`)
  }

  const afterDeadlines = await restGet(cfg.url, cfg.key, `/rest/v1/contract_deadlines?deal_id=in.(${idFilter})&select=id`)
  const beforeDeadlineIds = beforeDeadlines.map(d => d.id).sort().join()
  const afterDeadlineIds = afterDeadlines.map(d => d.id).sort().join()
  if (beforeDeadlineIds !== afterDeadlineIds) throw new Error('contract deadlines on updated deals changed')

  const offAfter = await restGet(cfg.url, cfg.key, `/rest/v1/deals?id=in.(${offIds})&select=id,name,status,updated_at,address,addr_display`)
  for (const before of offBefore) {
    const after = offAfter.find(d => d.id === before.id)
    if (!after || after.updated_at !== before.updated_at || after.status !== before.status || after.address !== before.address) {
      throw new Error(`Off-LACDB row ${before.name} changed`)
    }
  }

  backup.applied = true
  backup.applied_at = new Date().toISOString()
  backup.written = written.map(w => ({
    action: w.action, id: w.id, name: w.name, tids: w.tids,
    deal: w.deal, economics: w.economics,
  }))
  saveBackup(paths, backup)
  return { written, off: plan.off, backup }
}

function renderApplied(result) {
  const lines = []
  lines.push('# LACDB sync applied')
  lines.push('')
  lines.push(`Applied at ${result.backup.applied_at}. One-time write from public/agents/listings.json (generated 2026-10-05T12:30:00Z). No schedule was added.`)
  lines.push('')
  lines.push('619 Jefferson (7eb337d8) was skipped. The 7 Off-LACDB deals were not modified.')
  lines.push('')
  lines.push('## Written')
  lines.push('')
  for (const row of result.backup.written) {
    lines.push(`### ${row.action} · ${row.name}`)
    lines.push('')
    lines.push(`Deal id \`${row.id}\`. Listings ${row.tids.join(', ')}.`)
    lines.push('')
    lines.push('`deals`:')
    lines.push('')
    lines.push('```json')
    lines.push(JSON.stringify(row.deal, null, 2))
    lines.push('```')
    lines.push('')
    lines.push('`deal_economics`:')
    lines.push('')
    lines.push('```json')
    lines.push(JSON.stringify(row.economics, null, 2))
    lines.push('```')
    lines.push('')
  }
  lines.push('## Off LACDB (unchanged)')
  lines.push('')
  for (const deal of result.off) {
    lines.push(`- ${deal.name} · ${deal.addr_display || deal.address || '—'} · ${deal.status} · ${deal._tid}`)
  }
  lines.push('')
  lines.push('## Skipped')
  lines.push('')
  lines.push('- 7eb337d8 619 Jefferson Hwy. Two suite deals were not updated.')
  lines.push('')
  return lines.join('\n')
}

function jeffersonReport(info) {
  const lines = []
  lines.push('### UPDATE · Bob Belk · Suite 2H')
  lines.push('')
  lines.push(`Deal id \`${info.id}\`. Listing ${SKIP_REVIEW_TID}. The row was labeled Suite 2-G; that label is now Suite 2H.`)
  lines.push('')
  lines.push('`deals`:')
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify(info.deal, null, 2))
  lines.push('```')
  lines.push('')
  lines.push('`deal_economics`:')
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify(info.economics, null, 2))
  lines.push('```')
  lines.push('')
  lines.push('## Suite 1-D (leased, not written)')
  lines.push('')
  lines.push(`- Bob Belk · Jefferson Hwy. 619, Suite 1-D · \`${JEFFERSON_1D_ID}\` · leased. No columns were changed. Database status remains \`${info.leasedStatus}\`.`)
  lines.push(`- The listing's leased space is ${info.leasedSf.toLocaleString('en-US')} SF at $${Number(info.leasedRate).toFixed(2)} SF/year. The available space is Suite 2H, 1,766 SF at $13.59 SF/year.`)
  lines.push('')
  return lines.join('\n')
}

function writeJeffersonReport(appliedPath, info) {
  if (!existsSync(appliedPath)) throw new Error(`Applied report is missing: ${appliedPath}`)
  let text = readFileSync(appliedPath, 'utf8')
  const intro = '619 Jefferson (7eb337d8) was skipped. The 7 Off-LACDB deals were not modified.'
  const introNext = '619 Jefferson (7eb337d8) is attached to Bob Belk Suite 2H. Suite 1-D was left unchanged and is leased. The 7 Off-LACDB deals were not modified.'
  if (!text.includes(intro) && !text.includes(introNext)) throw new Error('Applied report intro does not mention Jefferson')
  text = text.replace(intro, introNext)
  const block = jeffersonReport(info)
  if (!text.includes('### UPDATE · Bob Belk · Suite 2H')) {
    const marker = '\n## Off LACDB (unchanged)\n'
    if (!text.includes(marker)) throw new Error('Applied report is missing the Off LACDB section')
    text = text.replace(marker, `\n${block}${marker}`)
  }
  const skipped = '## Skipped\n\n- 7eb337d8 619 Jefferson Hwy. Two suite deals were not updated.\n'
  const skippedNext = '## Skipped\n\n- None. 619 Jefferson was resolved: Suite 2H was updated, Suite 1-D was listed as leased.\n'
  if (text.includes(skipped)) text = text.replace(skipped, skippedNext)
  if (text.includes('sb_publishable_') || text.includes('service_role')) throw new Error('Applied report contained a key')
  writeFileSync(appliedPath, text)
}

async function applyJefferson(cfg, feed, paths, appliedPath) {
  const listing = feed.listings.find(row => tidOfListing(row) === SKIP_REVIEW_TID)
  if (!listing) throw new Error('Feed has no 7eb337d8')
  const mapped = mapListing(listing, new Set(['619']))
  if (mapped.leaseRate !== 13.59 || mapped.leaseSf !== 1766) {
    throw new Error(`Jefferson available space is ${mapped.leaseRate} / ${mapped.leaseSf}`)
  }
  const leasedSpace = (listing.lease_spaces || []).find(s => s.status === 'leased')
  if (!leasedSpace) throw new Error('Jefferson listing has no leased space')
  if (!existsSync(paths[0])) throw new Error('Backup is missing. Refusing to write Jefferson without the original pre-image.')
  const backup = JSON.parse(readFileSync(paths[0], 'utf8'))
  if (!backup.applied) throw new Error('The original sync is not marked applied.')
  if (backup.jefferson?.applied) throw new Error('Jefferson was already applied. Refusing a second write.')

  const idFilter = `${JEFFERSON_2G_ID},${JEFFERSON_1D_ID}`
  const deals = await restGet(cfg.url, cfg.key, `/rest/v1/deals?id=in.(${idFilter})&select=*`)
  const econs = await restGet(cfg.url, cfg.key, `/rest/v1/deal_economics?deal_id=in.(${idFilter})&select=*`)
  const deadlines = await restGet(cfg.url, cfg.key, `/rest/v1/contract_deadlines?deal_id=in.(${idFilter})&select=*`)
  if (deals.length !== 2) throw new Error(`expected 2 Jefferson deals, got ${deals.length}`)
  const target = deals.find(d => d.id === JEFFERSON_2G_ID)
  const leased = deals.find(d => d.id === JEFFERSON_1D_ID)
  if (!target || !leased) throw new Error('Jefferson deal ids did not match the approved rows')
  if (target.name !== 'Bob Belk' || leased.name !== 'Bob Belk') throw new Error('Jefferson client name is not Bob Belk')
  const targetLabel = `${target.addr_display || ''} ${target.address || ''}`
  if (!targetLabel.includes(SUITE_2G) && !targetLabel.includes(SUITE_2H)) {
    throw new Error(`Suite 2H row is labeled ${target.addr_display}`)
  }
  const leasedLabel = `${leased.addr_display || ''} ${leased.address || ''}`
  if (!leasedLabel.includes(SUITE_1D)) throw new Error(`Suite 1-D row is labeled ${leased.addr_display}`)
  if (leasedLabel.includes(SUITE_2G)) throw new Error('Suite 1-D row contains the 2-G label')

  if (!backup.jefferson) {
    const plannedDeal = jeffersonDealPatch(target, mapped)
    const plannedEcon = jeffersonEconPatch(econs.find(e => e.deal_id === target.id) || null, mapped)
    backup.jefferson = {
      taken_at: new Date().toISOString(),
      applied: false,
      tid: SKIP_REVIEW_TID,
      note: 'Matthew, 13 Oct 2026: listing 7eb337d8 is Suite 2H. The Bob Belk row labeled Suite 2-G is that suite. Suite 1-D is leased and was not written.',
      suite_2h: {
        deal: target,
        deal_economics: econs.filter(e => e.deal_id === target.id),
        contract_deadlines: deadlines.filter(d => d.deal_id === target.id),
      },
      suite_1d_leased_untouched: {
        deal: leased,
        deal_economics: econs.filter(e => e.deal_id === leased.id),
        contract_deadlines: deadlines.filter(d => d.deal_id === leased.id),
      },
      written_deal: plannedDeal,
      written_economics: econs.some(e => e.deal_id === target.id)
        ? plannedEcon
        : { ...plannedEcon, sale_commission_pct: null, lease_commission_pct: null },
    }
    saveBackup(paths, backup)
  }

  const pre = backup.jefferson.suite_2h.deal
  const preLeased = backup.jefferson.suite_1d_leased_untouched.deal
  const dealPatch = jeffersonDealPatch(target, mapped)
  const existingEcon = econs.filter(e => e.deal_id === target.id)
  const econPatch = jeffersonEconPatch(existingEcon[0] || null, mapped)
  let econAction = existingEcon.length ? 'existing' : 'none'
  let econWritten = econPatch
  if (Object.keys(dealPatch).length) {
    await restWrite(cfg.url, cfg.key, 'PATCH', `/rest/v1/deals?id=eq.${target.id}`, dealPatch)
  }
  if (Object.keys(econPatch).length) {
    if (existingEcon.length) {
      await restWrite(cfg.url, cfg.key, 'PATCH', `/rest/v1/deal_economics?deal_id=eq.${target.id}`, econPatch)
      econAction = 'patch'
    } else {
      econWritten = { ...econPatch, sale_commission_pct: null, lease_commission_pct: null }
      const econRow = await restWrite(cfg.url, cfg.key, 'POST', '/rest/v1/deal_economics', { deal_id: target.id, ...econWritten })
      econAction = 'insert'
      backup.jefferson.economics_id = econRow?.id || null
    }
  }

  const check = await restGet(cfg.url, cfg.key, `/rest/v1/deals?id=eq.${target.id}&select=*`)
  const econCheck = await restGet(cfg.url, cfg.key, `/rest/v1/deal_economics?deal_id=eq.${target.id}&select=*`)
  const afterDeadlines = await restGet(cfg.url, cfg.key, `/rest/v1/contract_deadlines?deal_id=eq.${target.id}&select=id`)
  const row = check[0]
  if (row.name !== pre.name || row.status !== pre.status || row.type !== pre.type || row.representation_role !== pre.representation_role) {
    throw new Error('Jefferson protected deal column changed')
  }
  if ((row.notes || '') !== (pre.notes || '') || (row.dropbox_link || '') !== (pre.dropbox_link || '')) {
    throw new Error('Jefferson notes or dropbox changed')
  }
  if ((row.deal_source || '') !== (pre.deal_source || '')) throw new Error('Jefferson deal_source changed')
  if (!String(row.addr_display).includes(SUITE_2H) || !String(row.address).includes(SUITE_2H)) {
    throw new Error(`Suite label is ${row.addr_display} / ${row.address}`)
  }
  if (String(row.addr_display).includes(SUITE_2G) || String(row.address).includes(SUITE_2G)) {
    throw new Error('Suite 2-G label is still on the 2H row')
  }
  for (const [col, value] of Object.entries(dealPatch)) {
    if (!sameValue(row[col], value)) throw new Error(`Jefferson ${col} is ${row[col]}, expected ${value}`)
  }
  const econ = econCheck[0]
  if (!econ) throw new Error('Jefferson economics row is missing')
  const preEcon = backup.jefferson.suite_2h.deal_economics[0]
  if (preEcon) {
    if (!sameValue(econ.sale_commission_pct, preEcon.sale_commission_pct) || !sameValue(econ.lease_commission_pct, preEcon.lease_commission_pct)) {
      throw new Error('Jefferson commission changed')
    }
  } else if (econ.sale_commission_pct != null || econ.lease_commission_pct != null) {
    throw new Error('Jefferson economics invented a commission')
  }
  if (!sameValue(econ.lease_rate_psf, 13.59) || !sameValue(econ.sqft, 1766) || econ.transaction_type !== 'lease') {
    throw new Error(`Jefferson economics persisted as ${econ.transaction_type} ${econ.lease_rate_psf} ${econ.sqft}`)
  }
  const beforeDeadlineIds = (backup.jefferson.suite_2h.contract_deadlines || []).map(d => d.id).sort().join()
  const afterDeadlineIds = afterDeadlines.map(d => d.id).sort().join()
  if (beforeDeadlineIds !== afterDeadlineIds) throw new Error('Jefferson deadlines changed')

  const leasedAfter = await restGet(cfg.url, cfg.key, `/rest/v1/deals?id=eq.${JEFFERSON_1D_ID}&select=id,name,status,type,address,addr_display,updated_at,lacdb_url,notes,dropbox_link`)
  const leasedRow = leasedAfter[0]
  if (!leasedRow || leasedRow.updated_at !== preLeased.updated_at || leasedRow.status !== preLeased.status
    || leasedRow.address !== preLeased.address || leasedRow.addr_display !== preLeased.addr_display
    || leasedRow.name !== preLeased.name || (leasedRow.lacdb_url || '') !== (preLeased.lacdb_url || '')) {
    throw new Error('Suite 1-D changed')
  }

  const written = {
    action: 'UPDATE',
    id: target.id,
    name: 'Bob Belk',
    tids: [SKIP_REVIEW_TID],
    suite: SUITE_2H,
    deal: backup.jefferson.written_deal,
    economics: backup.jefferson.written_economics,
    economics_action: econAction,
  }
  backup.jefferson.applied = true
  backup.jefferson.applied_at = new Date().toISOString()
  backup.written = backup.written || []
  if (!backup.written.some(w => w.id === target.id)) backup.written.push(written)
  saveBackup(paths, backup)
  writeJeffersonReport(appliedPath, {
    id: target.id,
    deal: written.deal,
    economics: written.economics,
    leasedStatus: leasedRow.status,
    leasedSf: Number(leasedSpace.available_sf_max ?? leasedSpace.available_sf_min),
    leasedRate: Number(leasedSpace.rate_min),
  })
  return { id: target.id, deal: written.deal, economics: written.economics, leasedId: leased.id }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('Usage: node scripts/lacdb-sync.mjs [--dry-run] [--feed path] [--out path]')
    console.log('       node scripts/lacdb-sync.mjs --apply')
    console.log('       node scripts/lacdb-sync.mjs --apply-jefferson')
    return
  }
  if (args.apply && args.applyJefferson) throw new Error('Pass one of --apply or --apply-jefferson')
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

  if (args.applyJefferson) {
    if (!cfg) throw new Error('No Supabase client configured')
    const result = await applyJefferson(cfg, feed, [args.backup, STORE_BACKUP], args.applied)
    console.log(`Jefferson Suite 2H updated: ${result.id}`)
    console.log(`Suite 1-D leased, unchanged: ${result.leasedId}`)
    console.log(`Backup: ${args.backup}`)
    console.log(`Wrote ${args.applied}`)
    return
  }

  const plan = buildPlan(feed, deals, econs, deadlineCounts)
  if (args.apply) {
    if (!cfg) throw new Error('No Supabase client configured')
    if (existsSync(args.backup)) {
      const prev = JSON.parse(readFileSync(args.backup, 'utf8'))
      if (prev.applied) throw new Error('This snapshot was already applied. Refusing a second write.')
      throw new Error('A pre-image backup already exists and is not marked applied. Refusing to overwrite it.')
    }
    const result = await applyPlan(cfg, plan, [args.backup, STORE_BACKUP])
    const appliedMd = renderApplied(result)
    if (appliedMd.includes('sb_publishable_') || appliedMd.includes('service_role')) {
      throw new Error('Applied report contained a key')
    }
    writeFileSync(args.applied, appliedMd)
    console.log(`CREATE deals: ${result.backup.created.length}`)
    console.log(`UPDATE deals: ${result.backup.written.filter(w => w.action === 'UPDATE').length}`)
    console.log(`Off LACDB listed, unchanged: ${result.off.length}`)
    console.log(`Backup: ${args.backup}`)
    console.log(`Wrote ${args.applied}`)
    return
  }
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

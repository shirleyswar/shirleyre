/**
 * Refresh asking prices on the shipped Louisiana Commercial Database feed.
 *
 * The feed is public/agents/listings.json. Each record already has a public
 * listing URL. This reads that page's data endpoint and writes the total
 * asking price and status back into the same file, plus the per-listing
 * JSON when one exists. It does not add listings and it does not download photos.
 *
 *   node scripts/refresh-lacdb-prices.mjs
 *   node scripts/refresh-lacdb-prices.mjs --self-test
 *
 * A GitHub Action runs this every 6 hours and commits when a price or status changed.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FEED = resolve(ROOT, 'public/agents/listings.json')
const LISTING_DIR = resolve(ROOT, 'public/agents/listings')
const DATA_QUERY = '_data=routes/_app.listings.$slug'

export function priceFromRemix(body) {
  const listing = body?.listing
  if (!listing || typeof listing !== 'object') return null
  const meta = listing.meta || {}
  const filters = listing.filters || {}
  const type = meta.priceType || filters.priceType || null
  let amount = null
  if (type === 'total' && meta.price != null && Number.isFinite(Number(meta.price))) {
    amount = Math.round(Number(meta.price))
  } else if (type !== 'per_sf' && type !== 'per_acre') {
    const min = filters.priceTotal?.min
    const max = filters.priceTotal?.max
    if (min != null && max != null && Math.round(Number(min)) === Math.round(Number(max))) {
      amount = Math.round(Number(max))
    }
  }
  if (amount != null && amount <= 0) amount = null
  const tid = String(listing.tid || '').toLowerCase()
  return {
    tid: /^[0-9a-f]{8}$/.test(tid) ? tid : '',
    status: typeof listing.status === 'string' ? listing.status : null,
    amount,
  }
}

export function dollarLabel(amount) {
  return `$${Math.round(amount).toLocaleString('en-US')}`
}

export function applyLive(record, live, retrievedAt) {
  if (!record || !live) return false
  let changed = false
  if (live.status && record.status !== live.status) {
    record.status = live.status
    changed = true
  }
  if (live.amount != null) {
    if (!record.price || typeof record.price !== 'object') record.price = {}
    const label = dollarLabel(live.amount)
    if (record.price.amount !== live.amount) { record.price.amount = live.amount; changed = true }
    if (record.price.unit !== 'total') { record.price.unit = 'total'; changed = true }
    if (record.price.total_min !== live.amount) { record.price.total_min = live.amount; changed = true }
    if (record.price.total_max !== live.amount) { record.price.total_max = live.amount; changed = true }
    if (record.price.label !== label) { record.price.label = label; changed = true }
    if (!record.price.currency) record.price.currency = 'USD'
  }
  if (changed) {
    if (record.source && typeof record.source === 'object') record.source.retrieved_at = retrievedAt
    if ('last_updated' in record) record.last_updated = retrievedAt
  }
  return changed
}

function selfTest() {
  const live = priceFromRemix({
    listing: {
      tid: '138d8815',
      status: 'active',
      meta: { price: 2950000, priceType: 'total' },
      filters: { priceType: 'total', priceTotal: { min: 2950000, max: 2950000 } },
    },
  })
  if (!live || live.amount !== 2950000 || live.status !== 'active' || live.tid !== '138d8815') {
    throw new Error('priceFromRemix missed the Hudson total')
  }
  const perSf = priceFromRemix({
    listing: { tid: 'aaaaaaaa', status: 'active', meta: { price: 12, priceType: 'per_sf' }, filters: {} },
  })
  if (!perSf || perSf.amount != null) throw new Error('per-square-foot quote must not become a total')
  const record = { status: 'active', price: { amount: 3095000, unit: 'total', label: '$3.1M' }, source: {}, last_updated: '' }
  if (!applyLive(record, live, '2026-10-20T00:00:00.000Z')) throw new Error('expected a price change')
  if (record.price.amount !== 2950000 || record.price.label !== '$2,950,000') throw new Error('label')
  if (applyLive(record, live, '2026-10-20T00:00:00.000Z')) throw new Error('second apply should be a no-op')
  console.log('refresh-lacdb-prices self-test ok')
}

async function fetchLive(url) {
  const dataUrl = url.includes('_data=') ? url : `${url}${url.includes('?') ? '&' : '?'}${DATA_QUERY}`
  const res = await fetch(dataUrl, {
    headers: {
      accept: 'application/json',
      'user-agent': 'shirleyre-lacdb-price-refresh',
    },
  })
  if (!res.ok) throw new Error(`${res.status} ${dataUrl}`)
  return priceFromRemix(await res.json())
}

function listingTid(record) {
  const id = String(record?.source?.listing_id || '')
  const match = id.match(/^[0-9a-f]{8}/i)
  return match ? match[0].toLowerCase() : ''
}

async function main() {
  if (process.argv.includes('--self-test')) {
    selfTest()
    return
  }
  const feed = JSON.parse(readFileSync(FEED, 'utf8'))
  const listings = Array.isArray(feed.listings) ? feed.listings : []
  const retrievedAt = new Date().toISOString()
  let changed = 0
  let failed = 0
  for (const record of listings) {
    const url = record?.source?.url
    const tid = listingTid(record)
    if (!url || !tid) continue
    try {
      const live = await fetchLive(url)
      if (!live) throw new Error('no listing in the response')
      if (applyLive(record, live, retrievedAt)) {
        changed += 1
        const file = resolve(LISTING_DIR, `${tid}.json`)
        if (existsSync(file)) {
          const one = JSON.parse(readFileSync(file, 'utf8'))
          applyLive(one, live, retrievedAt)
          writeFileSync(file, JSON.stringify(one, null, 2) + '\n')
        }
        console.log(`${tid} ${record.status} ${record.price?.label || record.price?.amount || ''}`)
      } else {
        console.log(`${tid} unchanged`)
      }
    } catch (err) {
      failed += 1
      console.error(`${tid} failed: ${err.message}`)
    }
    await new Promise(r => setTimeout(r, 150))
  }
  if (changed > 0) {
    feed.generated_at = retrievedAt
    writeFileSync(FEED, JSON.stringify(feed, null, 2) + '\n')
  }
  console.log(`changed ${changed}, failed ${failed}, listings ${listings.length}`)
  if (failed > 0 && changed === 0) process.exitCode = 1
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect) main()

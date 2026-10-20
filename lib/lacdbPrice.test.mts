import assert from 'node:assert/strict'
import { activeAskingIndex, askingForDeal, totalAsking, type FeedPrice } from './lacdbPrice.ts'
import { fmtAsking } from './dealMath.ts'

const hudson: FeedPrice = {
  status: 'active',
  source: { listing_id: '138d8815' },
  price: { amount: 2950000, unit: 'total', label: '$2,950,000' },
}
const pending: FeedPrice = {
  status: 'pending',
  source: { listing_id: 'aaaaaaaa' },
  price: { amount: 1000000, unit: 'total' },
}
const perSf: FeedPrice = {
  status: 'active',
  source: { listing_id: 'bbbbbbbb' },
  price: { amount: 12, unit: 'per_sf', label: '$12/SF' },
}

assert.equal(totalAsking(hudson.price), 2950000)
assert.equal(totalAsking(perSf.price), null)
assert.equal(totalAsking({ total_min: 78000, total_max: 78000 }), 78000)

const index = activeAskingIndex([hudson, pending, perSf])
assert.equal(index.get('138d8815'), 2950000)
assert.equal(index.has('aaaaaaaa'), false)
assert.equal(index.has('bbbbbbbb'), false)

const deal = { lacdb_url: 'https://lacdb.resimplifi.com/listings/138d8815-leased-office-acredit-tenant', deal_source: null }
assert.equal(askingForDeal(deal, 3095000), 2950000)
assert.equal(askingForDeal({ lacdb_url: null, deal_source: null }, 3095000), 3095000)
assert.equal(askingForDeal({ lacdb_url: null, deal_source: null }, null), null)
assert.equal(fmtAsking(2950000), '$2,950,000')
assert.equal(fmtAsking(null), '')
assert.equal(fmtAsking(0), '')

console.log('lacdbPrice tests ok')

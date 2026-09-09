import assert from 'node:assert/strict'
import {
  formatListingFilingName,
  parseListingFilingName,
  looksLikeFilingName,
  formatDealTitle,
  editNamePrefill,
} from './formatAddress.ts'

assert.equal(formatListingFilingName('Wisteria', 'W', '1814'), 'Wisteria, W, 1814')
assert.equal(formatListingFilingName('Phantom Test Pkwy', '', '999'), 'Phantom Test Pkwy, , 999')
assert.equal(formatListingFilingName('Phantom Test Pkwy', null, '999'), 'Phantom Test Pkwy, , 999')
assert.equal(formatListingFilingName('Sunset', 'n.', '405'), 'Sunset, N, 405')
assert.equal(formatListingFilingName('', '', ''), '')

assert.deepEqual(parseListingFilingName('Wisteria, W, 1814'), {
  street: 'Wisteria', cardinal: 'W', number: '1814',
})
assert.deepEqual(parseListingFilingName('Phantom Test Pkwy, , 999'), {
  street: 'Phantom Test Pkwy', cardinal: '', number: '999',
})
assert.equal(parseListingFilingName('Phantom Test Pkwy 999'), null)
assert.equal(looksLikeFilingName('Phantom Test Pkwy, , 999'), true)
assert.equal(looksLikeFilingName('Phantom Test Pkwy 999'), false)

assert.equal(
  formatDealTitle({
    name: 'Phantom Test Pkwy 999',
    addr_display: '999 Phantom Test Pkwy',
    addr_street_name: 'Phantom Test Pkwy',
    addr_direction: null,
    addr_number: '999',
  }),
  'Phantom Test Pkwy, , 999',
)

assert.equal(
  formatDealTitle({
    name: 'Debbie Guerin',
    addr_display: 'Bluebonnet Blvd. 5139',
    addr_street_name: 'Bluebonnet',
    addr_number: '5139',
  }),
  'Bluebonnet Blvd. 5139',
)

assert.equal(
  formatDealTitle({
    name: 'Phantom Test Pkwy, , 999',
    addr_display: 'Phantom Test Pkwy, , 999',
    addr_street_name: 'Phantom Test Pkwy',
    addr_number: '999',
  }),
  'Phantom Test Pkwy, , 999',
)

assert.equal(
  editNamePrefill({
    name: 'Phantom Test Pkwy 999',
    addr_street_name: 'Phantom Test Pkwy',
    addr_number: '999',
  }),
  'Phantom Test Pkwy, , 999',
)

assert.equal(
  editNamePrefill({
    name: 'Debbie Guerin',
    addr_street_name: 'Bluebonnet',
    addr_number: '5139',
  }),
  'Debbie Guerin',
)

console.log('formatAddress listing-name tests ok')

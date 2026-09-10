import assert from 'node:assert/strict'
import {
  formatListingFilingName,
  parseListingFilingName,
  looksLikeFilingName,
  formatDealTitle,
  editNamePrefill,
} from './formatAddress.ts'

// ── formatListingFilingName ──────────────────────────────────────────────────
assert.equal(formatListingFilingName('Wisteria', 'W', '1814'), 'Wisteria, W, 1814')
// 156.1 / 156C.1: empty cardinal omits middle slot — never `, ,`
assert.equal(formatListingFilingName('Phantom Test Pkwy', '', '999'), 'Phantom Test Pkwy, 999')
assert.equal(formatListingFilingName('Phantom Test Pkwy', null, '999'), 'Phantom Test Pkwy, 999')
assert.equal(formatListingFilingName('Industriplex Blvd.', '', '12025'), 'Industriplex Blvd., 12025')
assert.equal(formatListingFilingName('Sunset', 'n.', '405'), 'Sunset, N, 405')
assert.equal(formatListingFilingName('', '', ''), '')

// ── parseListingFilingName ───────────────────────────────────────────────────
assert.deepEqual(parseListingFilingName('Wisteria, W, 1814'), {
  street: 'Wisteria', cardinal: 'W', number: '1814',
})
assert.deepEqual(parseListingFilingName('Phantom Test Pkwy, , 999'), {
  street: 'Phantom Test Pkwy', cardinal: '', number: '999',
})
// 2-part filing name (no cardinal)
assert.deepEqual(parseListingFilingName('Phantom Test Pkwy, 999'), {
  street: 'Phantom Test Pkwy', cardinal: '', number: '999',
})
assert.deepEqual(parseListingFilingName('Industriplex Blvd., 12025'), {
  street: 'Industriplex Blvd.', cardinal: '', number: '12025',
})
assert.equal(parseListingFilingName('Phantom Test Pkwy 999'), null)

// ── looksLikeFilingName ──────────────────────────────────────────────────────
assert.equal(looksLikeFilingName('Phantom Test Pkwy, , 999'), true)
assert.equal(looksLikeFilingName('Phantom Test Pkwy, 999'), true)
assert.equal(looksLikeFilingName('Industriplex Blvd., 12025'), true)
assert.equal(looksLikeFilingName('Phantom Test Pkwy 999'), false)

// ── formatDealTitle — 156C.1: must never show `, ,` on display ──────────────
// number-first display → rebuild from parts (no cardinal → no double-comma)
assert.equal(
  formatDealTitle({
    name: 'Phantom Test Pkwy 999',
    addr_display: '999 Phantom Test Pkwy',
    addr_street_name: 'Phantom Test Pkwy',
    addr_direction: null,
    addr_number: '999',
  }),
  'Phantom Test Pkwy, 999',
)

// free-text client-style name — untouched
assert.equal(
  formatDealTitle({
    name: 'Debbie Guerin',
    addr_display: 'Bluebonnet Blvd. 5139',
    addr_street_name: 'Bluebonnet',
    addr_number: '5139',
  }),
  'Bluebonnet Blvd. 5139',
)

// 156C.1 CORE: stored filing name with empty middle must normalize on DISPLAY
assert.equal(
  formatDealTitle({
    name: 'Phantom Test Pkwy, , 999',
    addr_display: 'Phantom Test Pkwy, , 999',
    addr_street_name: 'Phantom Test Pkwy',
    addr_number: '999',
  }),
  'Phantom Test Pkwy, 999',
)

// Industriplex FAIL case (evidence 05 repro)
assert.equal(
  formatDealTitle({
    name: 'Industriplex Blvd., , 12025',
    addr_display: 'Industriplex Blvd., , 12025',
    addr_street_name: 'Industriplex Blvd.',
    addr_direction: null,
    addr_number: '12025',
  }),
  'Industriplex Blvd., 12025',
)

// Cardinal present — still rendered correctly
assert.equal(
  formatDealTitle({
    name: 'Government, S, 4109',
    addr_display: 'Government, S, 4109',
    addr_street_name: 'Government',
    addr_direction: 'S',
    addr_number: '4109',
  }),
  'Government, S, 4109',
)

// ── editNamePrefill — 156C.1: normalize stored `, ,` on prefill ─────────────
assert.equal(
  editNamePrefill({
    name: 'Phantom Test Pkwy 999',
    addr_street_name: 'Phantom Test Pkwy',
    addr_number: '999',
  }),
  'Phantom Test Pkwy, 999',
)

assert.equal(
  editNamePrefill({
    name: 'Phantom Test Pkwy, , 999',
    addr_street_name: 'Phantom Test Pkwy',
    addr_number: '999',
  }),
  'Phantom Test Pkwy, 999',
)

// free-text client — untouched
assert.equal(
  editNamePrefill({
    name: 'Debbie Guerin',
    addr_street_name: 'Bluebonnet',
    addr_number: '5139',
  }),
  'Debbie Guerin',
)

console.log('formatAddress listing-name tests ok')

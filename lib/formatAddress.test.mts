import assert from 'node:assert/strict'
import {
  formatListingFilingName,
  parseListingFilingName,
  looksLikeFilingName,
  formatDealTitle,
  formatAddress,
  editNamePrefill,
  canonicalizeFilingSlots,
  filingSlotsFromPlaceRoute,
  parseStreetLine,
} from './formatAddress.ts'

const CABELA = { street: "Cabela's Pkwy.", cardinal: 'S', number: '2703' }

// ── spoken join: Street Cardinal. Number, blank cardinal has no dash ────────
assert.equal(formatListingFilingName('Wisteria', 'W', '1814'), 'Wisteria W. 1814')
assert.equal(formatListingFilingName('Phantom Test Pkwy', '', '999'), 'Phantom Test Pkwy. 999')
assert.equal(formatListingFilingName('Phantom Test Pkwy', null, '999'), 'Phantom Test Pkwy. 999')
assert.equal(formatListingFilingName('Phantom Test Pkwy', '—', '999'), 'Phantom Test Pkwy. 999')
assert.equal(formatListingFilingName('Phantom Test Pkwy', '-', '999'), 'Phantom Test Pkwy. 999')
assert.equal(formatListingFilingName('Industriplex Blvd.', '', '12025'), 'Industriplex Blvd. 12025')
assert.equal(formatListingFilingName('Sunset', 'n.', '405'), 'Sunset N. 405')
assert.equal(formatListingFilingName('', '', ''), '')
assert.equal(formatListingFilingName("Cabela's Pkwy.", 'S', '2703'), "Cabela's Pkwy. S. 2703")
assert.equal(formatListingFilingName("South Cabela's Parkway", '', '2703'), "Cabela's Pkwy. S. 2703")
assert.equal(formatListingFilingName("S. Cabela's Pkwy", null, '2703'), "Cabela's Pkwy. S. 2703")

// ── parse: direction must not remain in STREET ──────────────────────────────
assert.deepEqual(parseListingFilingName('Wisteria, W, 1814'), {
  street: 'Wisteria', cardinal: 'W', number: '1814',
})
assert.deepEqual(parseListingFilingName('Phantom Test Pkwy, , 999'), {
  street: 'Phantom Test Pkwy.', cardinal: '', number: '999',
})
assert.deepEqual(parseListingFilingName('Phantom Test Pkwy, —, 999'), {
  street: 'Phantom Test Pkwy.', cardinal: '', number: '999',
})
assert.deepEqual(parseListingFilingName('Phantom Test Pkwy, 999'), {
  street: 'Phantom Test Pkwy.', cardinal: '', number: '999',
})
assert.deepEqual(parseListingFilingName('Industriplex Blvd., 12025'), {
  street: 'Industriplex Blvd.', cardinal: '', number: '12025',
})
assert.deepEqual(parseListingFilingName("S. Cabela's Pkwy, 2703"), CABELA)
assert.deepEqual(parseListingFilingName("S. Cabela's Pkwy. 2703"), CABELA)
assert.deepEqual(parseListingFilingName("South Cabela's Parkway 2703"), CABELA)
assert.deepEqual(parseListingFilingName("Cabela's Pkwy. S. 2703"), CABELA)
assert.deepEqual(parseListingFilingName("2703 South Cabela's Parkway, Gonzales, LA 70737, USA"), CABELA)
assert.deepEqual(parseListingFilingName("2703 S Cabela's Pkwy, Gonzales, LA 70737"), CABELA)

// EDIT save of the spoken line is idempotent — second pass does not re-glue S.
const edited = parseListingFilingName("Cabela's Pkwy. S. 2703")
assert.ok(edited)
assert.equal(formatListingFilingName(edited.street, edited.cardinal, edited.number), "Cabela's Pkwy. S. 2703")
assert.deepEqual(parseListingFilingName("Cabela's Pkwy. S. 2703"), edited)
assert.equal(edited.street.includes('S.'), false)
assert.equal(edited.street.startsWith('S'), false)

// ── Places route (long_name is the full word; no separate direction component)
assert.deepEqual(filingSlotsFromPlaceRoute({
  routeLong: "South Cabela's Parkway",
  routeShort: "S Cabela's Pkwy",
  streetNumber: '2703',
  formattedAddress: "2703 S Cabela's Pkwy, Gonzales, LA 70737, USA",
}), CABELA)

// long_name omitted the direction; formatted street line still has it
assert.deepEqual(filingSlotsFromPlaceRoute({
  routeLong: "Cabela's Parkway",
  routeShort: "Cabela's Pkwy",
  streetNumber: '2703',
  formattedAddress: "2703 S Cabela's Pkwy, Gonzales, LA 70737, USA",
}), CABELA)

// short_name carries the abbreviation when long_name does not
assert.deepEqual(filingSlotsFromPlaceRoute({
  routeLong: "Cabela's Parkway",
  routeShort: "S Cabela's Pkwy",
  streetNumber: '2703',
}), CABELA)

assert.deepEqual(parseStreetLine('Reitz Ave. 5525'), {
  street: 'Reitz Ave.', cardinal: '', number: '5525',
})
assert.deepEqual(parseStreetLine("2703 South Cabela's Parkway"), CABELA)
assert.deepEqual(canonicalizeFilingSlots("S. Cabela's Pkwy.", '—', '2703'), CABELA)
assert.deepEqual(canonicalizeFilingSlots("Cabela's Parkway South", '', '2703'), CABELA)

// ── looksLikeFilingName ──────────────────────────────────────────────────────
assert.equal(looksLikeFilingName('Phantom Test Pkwy, , 999'), true)
assert.equal(looksLikeFilingName('Phantom Test Pkwy, 999'), true)
assert.equal(looksLikeFilingName('Industriplex Blvd., 12025'), true)
assert.equal(looksLikeFilingName('Phantom Test Pkwy 999'), true)
assert.equal(looksLikeFilingName("Cabela's Pkwy. S. 2703"), true)
assert.equal(looksLikeFilingName('Debbie Guerin'), false)

// ── formatDealTitle ──────────────────────────────────────────────────────────
assert.equal(
  formatDealTitle({
    name: 'Phantom Test Pkwy 999',
    addr_display: '999 Phantom Test Pkwy',
    addr_street_name: 'Phantom Test Pkwy',
    addr_direction: null,
    addr_number: '999',
  }),
  'Phantom Test Pkwy. 999',
)

// Street slot has no suffix — title is the slots, not a richer stored display.
assert.equal(
  formatDealTitle({
    name: 'Debbie Guerin',
    addr_display: 'Bluebonnet Blvd. 5139',
    addr_street_name: 'Bluebonnet',
    addr_number: '5139',
  }),
  'Bluebonnet 5139',
)

assert.equal(
  formatDealTitle({
    name: 'Phantom Test Pkwy, , 999',
    addr_display: 'Phantom Test Pkwy, , 999',
    addr_street_name: 'Phantom Test Pkwy',
    addr_number: '999',
  }),
  'Phantom Test Pkwy. 999',
)

assert.equal(
  formatDealTitle({
    name: 'Industriplex Blvd., , 12025',
    addr_display: 'Industriplex Blvd., , 12025',
    addr_street_name: 'Industriplex Blvd.',
    addr_direction: null,
    addr_number: '12025',
  }),
  'Industriplex Blvd. 12025',
)

assert.equal(
  formatDealTitle({
    name: 'Government, S, 4109',
    addr_display: 'Government, S, 4109',
    addr_street_name: 'Government',
    addr_direction: 'S',
    addr_number: '4109',
  }),
  'Government S. 4109',
)

// Legacy row: direction glued into STREET, cardinal column empty or a dash.
assert.equal(
  formatDealTitle({
    name: "S. Cabela's Pkwy, 2703",
    addr_display: "S. Cabela's Pkwy, 2703",
    addr_street_name: "S. Cabela's Pkwy",
    addr_direction: '—',
    addr_number: '2703',
  }),
  "Cabela's Pkwy. S. 2703",
)
assert.equal(
  formatDealTitle({
    addr_street_name: "South Cabela's Parkway",
    addr_direction: null,
    addr_number: '2703',
  }),
  "Cabela's Pkwy. S. 2703",
)
assert.equal(
  formatDealTitle({
    addr_street_name: "Cabela's Pkwy.",
    addr_direction: 'S',
    addr_number: '2703',
  }),
  "Cabela's Pkwy. S. 2703",
)

// No structured columns — repair the stored string anyway.
assert.equal(
  formatDealTitle({ name: "2703 S. Cabela's Pkwy" }),
  "Cabela's Pkwy. S. 2703",
)
assert.equal(
  formatAddress({ addr_display: "S. Cabela's Pkwy. 2703", addr_city: 'Gonzales' }),
  "Cabela's Pkwy. S. 2703 · Gonzales",
)
assert.equal(
  formatAddress({
    addr_street_name: "Cabela's Pkwy.",
    addr_direction: 'S',
    addr_number: '2703',
    addr_city: 'Baton Rouge',
  }),
  "Cabela's Pkwy. S. 2703",
)

// ── editNamePrefill ──────────────────────────────────────────────────────────
assert.equal(
  editNamePrefill({
    name: 'Phantom Test Pkwy 999',
    addr_street_name: 'Phantom Test Pkwy',
    addr_number: '999',
  }),
  'Phantom Test Pkwy. 999',
)
assert.equal(
  editNamePrefill({
    name: 'Phantom Test Pkwy, , 999',
    addr_street_name: 'Phantom Test Pkwy',
    addr_number: '999',
  }),
  'Phantom Test Pkwy. 999',
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

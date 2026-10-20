import assert from 'node:assert/strict'
import {
  compareLeadRows,
  formatLeadDate,
  isLeadsTableMissing,
  localDateISO,
  seriousRank,
  validateLeadDraft,
  emptyLeadDraft,
} from './dealLeads.ts'

const now = new Date()
const iso = localDateISO(now)
assert.equal(iso, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
assert.equal(localDateISO(new Date(2026, 0, 15, 23, 30)), '2026-01-15')
assert.equal(formatLeadDate('2026-01-15'), 'Jan 15, 2026')
assert.equal(formatLeadDate('2026-01-15T00:00:00.000Z'), 'Jan 15, 2026')
assert.equal(formatLeadDate(''), '')
assert.equal(formatLeadDate(null), '')

assert.equal(seriousRank('offer_likely') > seriousRank('hot'), true)
assert.equal(seriousRank('hot') > seriousRank('warm'), true)

const offer = { property: 'Hudson Ln. 1301', serious_level: 'offer_likely', lead_date: '2026-10-01', created_at: '2026-10-01T12:00:00Z' }
const hot = { property: 'Annex', serious_level: 'hot', lead_date: '2026-10-18', created_at: '2026-10-18T12:00:00Z' }
const warm = { property: '', serious_level: 'warm', lead_date: '2026-09-01', created_at: '2026-09-01T12:00:00Z' }
const bySerious = [warm, offer, hot].sort((a, b) => compareLeadRows(a, b, 'serious', 'desc'))
assert.deepEqual(bySerious.map(row => row.serious_level), ['offer_likely', 'hot', 'warm'])
const byDate = [warm, offer, hot].sort((a, b) => compareLeadRows(a, b, 'date', 'desc'))
assert.deepEqual(byDate.map(row => row.lead_date), ['2026-10-18', '2026-10-01', '2026-09-01'])
const byProperty = [warm, hot, offer].sort((a, b) => compareLeadRows(a, b, 'property', 'asc'))
assert.equal(byProperty[0].property, 'Annex')
assert.equal(byProperty[byProperty.length - 1].property, '')

const draft = emptyLeadDraft()
assert.match(draft.lead_date, /^\d{4}-\d{2}-\d{2}$/)
assert.equal(validateLeadDraft(draft), 'Name is required.')
assert.equal(validateLeadDraft({ ...draft, name: 'Ada', serious_level: 'hot', email: 'not-an-email' }), 'That email does not look complete.')
assert.equal(validateLeadDraft({ ...draft, name: 'Ada', serious_level: 'hot', email: 'ada@example.com' }), '')

assert.equal(isLeadsTableMissing({ code: 'PGRST205', message: "Could not find the table 'public.deal_leads' in the schema cache" }), true)
assert.equal(isLeadsTableMissing({ code: '42P01', message: 'relation "deal_leads" does not exist' }), true)
assert.equal(isLeadsTableMissing({ code: '42501', message: 'permission denied' }), false)
assert.equal(isLeadsTableMissing(null), false)

console.log('dealLeads ok')

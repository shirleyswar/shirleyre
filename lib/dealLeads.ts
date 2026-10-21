/**
 * Deal leads. Calendar dates stay calendar dates — never parsed as UTC instants.
 * Serious level order, highest first: Offer likely, Hot, Warm.
 */

export type SeriousLevel = 'warm' | 'hot' | 'offer_likely'

export interface DealLead {
  id: string
  deal_id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  serious_level: SeriousLevel
  lead_date: string
  note: string | null
  created_at: string
  updated_at?: string | null
}

export const SERIOUS_LEVELS: { value: SeriousLevel; label: string; rank: number }[] = [
  { value: 'warm', label: 'Warm', rank: 1 },
  { value: 'hot', label: 'Hot', rank: 2 },
  { value: 'offer_likely', label: 'Offer likely', rank: 3 },
]

const RANK: Record<string, number> = {
  warm: 1,
  hot: 2,
  offer_likely: 3,
}

export function seriousLabel(level: string | null | undefined): string {
  return SERIOUS_LEVELS.find(item => item.value === level)?.label ?? ''
}

export function seriousRank(level: string | null | undefined): number {
  if (!level) return 0
  return RANK[level] ?? 0
}

/** Local calendar day as YYYY-MM-DD. Not toISOString(), which is UTC. */
export function localDateISO(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseLocalDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return new Date(year, month - 1, day)
}

/** Display a stored calendar date. Blank when absent. Never a dash. */
export function formatLeadDate(iso: string | null | undefined): string {
  const date = parseLocalDate(iso)
  if (!date) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function isLeadsTableMissing(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false
  const code = error.code ?? ''
  const message = error.message ?? ''
  if (code === 'PGRST205' || code === '42P01') return true
  if (/could not find the table/i.test(message)) return true
  if (/relation ["']?(?:public\.)?deal_leads["']? does not exist/i.test(message)) return true
  if (code === 'PGRST204' && /deal_leads|serious_level|lead_date/i.test(message)) return true
  return false
}

export type LeadSortKey = 'property' | 'serious' | 'date'
export type LeadSortDir = 'asc' | 'desc'

export interface LeadSortRow {
  property: string
  serious_level: string | null
  lead_date: string | null
  created_at?: string | null
}

function blankLast(value: string, dir: LeadSortDir, compare: number): number {
  if (!value) return 1
  return dir === 'asc' ? compare : -compare
}

/** Blanks sort last in either direction. Date strings are YYYY-MM-DD, so they compare without a timezone. */
export function compareLeadRows(a: LeadSortRow, b: LeadSortRow, key: LeadSortKey, dir: LeadSortDir): number {
  if (key === 'serious') {
    const ar = seriousRank(a.serious_level)
    const br = seriousRank(b.serious_level)
    if (!ar && !br) return 0
    if (!ar) return 1
    if (!br) return -1
    const cmp = ar - br
    return dir === 'asc' ? cmp : -cmp
  }
  if (key === 'date') {
    const av = (a.lead_date ?? '').slice(0, 10)
    const bv = (b.lead_date ?? '').slice(0, 10)
    if (!av && !bv) return 0
    if (!av) return 1
    if (!bv) return -1
    if (av === bv) {
      const ac = a.created_at ?? ''
      const bc = b.created_at ?? ''
      if (ac === bc) return 0
      return dir === 'asc' ? (ac < bc ? -1 : 1) : (ac < bc ? 1 : -1)
    }
    return dir === 'asc' ? (av < bv ? -1 : 1) : (av < bv ? 1 : -1)
  }
  const av = a.property.trim().toLowerCase()
  const bv = b.property.trim().toLowerCase()
  if (!av && !bv) return 0
  if (!av) return 1
  if (!bv) return -1
  const cmp = av < bv ? -1 : av > bv ? 1 : 0
  return blankLast(av, dir, cmp)
}

export function blankToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export interface LeadDraft {
  name: string
  company: string
  phone: string
  email: string
  serious_level: SeriousLevel | ''
  lead_date: string
  note: string
}

export function emptyLeadDraft(): LeadDraft {
  return {
    name: '',
    company: '',
    phone: '',
    email: '',
    serious_level: '',
    lead_date: localDateISO(),
    note: '',
  }
}

export function draftFromLead(lead: DealLead): LeadDraft {
  return {
    name: lead.name ?? '',
    company: lead.company ?? '',
    phone: lead.phone ?? '',
    email: lead.email ?? '',
    serious_level: lead.serious_level,
    lead_date: (lead.lead_date ?? '').slice(0, 10) || localDateISO(),
    note: lead.note ?? '',
  }
}

/** Empty string when the draft can be saved. */
export function validateLeadDraft(draft: LeadDraft): string {
  if (!draft.name.trim()) return 'Name is required.'
  if (!draft.serious_level) return 'Choose a serious level.'
  if (!parseLocalDate(draft.lead_date)) return 'Choose a date.'
  const email = draft.email.trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'That email does not look complete.'
  return ''
}

export function leadWritePayload(dealId: string, draft: LeadDraft) {
  return {
    deal_id: dealId,
    name: draft.name.trim(),
    company: blankToNull(draft.company),
    phone: blankToNull(draft.phone),
    email: blankToNull(draft.email),
    serious_level: draft.serious_level,
    lead_date: draft.lead_date.slice(0, 10),
    note: blankToNull(draft.note),
  }
}

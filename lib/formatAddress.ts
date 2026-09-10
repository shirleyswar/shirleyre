/**
 * Formats a deal's address from structured addr_* columns per §5.11.9.
 * Reads columns, never parses deals.address string.
 * City rule: show addr_city only when NOT null AND NOT 'Baton Rouge'.
 *
 * LISTING filing/name (create + EDIT save) is separate: Street, Cardinal, Number.
 * Empty cardinal omits the middle slot (156.1).
 */

export interface AddrFields {
  addr_display?: string | null
  addr_street_name?: string | null
  addr_street_type?: string | null
  addr_direction?: string | null
  addr_number?: string | null
  addr_city?: string | null
  name?: string | null
  address?: string | null  // legacy param, ignored
}

export function formatAddress(d: AddrFields): string {
  if (d.addr_display) return d.addr_display

  if (d.addr_street_name) {
    const parts: string[] = [d.addr_street_name]
    if (d.addr_direction) parts.push(d.addr_direction + '.')
    if (d.addr_number) parts.push(d.addr_number)
    const city = d.addr_city && d.addr_city !== 'Baton Rouge' ? d.addr_city : null
    if (city) parts.push('·', city)
    return parts.join(' ')
  }

  return d.name ?? '—'
}

/** Strip trailing dots; cardinals are stored without a period (`W` not `W.`). */
export function normalizeCardinal(raw?: string | null): string {
  return (raw ?? '').trim().replace(/\.+$/, '').toUpperCase()
}

/**
 * LISTING filing name: `Street, Cardinal, Number`.
 * Empty cardinal: omit middle slot → `Street, Number` (never `Street, , Number`).
 * 156.1: fix double-comma on empty cardinal.
 */
export function formatListingFilingName(
  street?: string | null,
  cardinal?: string | null,
  number?: string | null,
): string {
  const s = (street ?? '').trim()
  const c = normalizeCardinal(cardinal)
  const n = (number ?? '').trim()
  if (!s && !c && !n) return ''
  const parts = [s, c, n].filter(p => p.length > 0)
  return parts.join(', ')
}

export function looksLikeFilingName(raw?: string | null): boolean {
  if (!raw) return false
  const parts = raw.split(',').length
  return parts === 2 || parts === 3
}

export function parseListingFilingName(raw: string): {
  street: string
  cardinal: string
  number: string
} | null {
  const parts = raw.split(',').map(p => p.trim())
  if (parts.length === 2) {
    return { street: parts[0], cardinal: '', number: parts[1] }
  }
  if (parts.length === 3) {
    return { street: parts[0], cardinal: normalizeCardinal(parts[1]), number: parts[2] }
  }
  return null
}

function isNumberFirst(raw?: string | null): boolean {
  if (!raw) return false
  return /^\d+[A-Za-z]?\s/.test(raw.trim())
}

/**
 * Deal hero + index ADDRESS.
 * New LISTING creates store Street, Cardinal, Number on `name` / `addr_display`.
 * Historical rows keep addr_display (e.g. `Bluebonnet Blvd. 5139`) unless the
 * stored title is number-first — then we rebuild from addr_* parts.
 * Does not rewrite the database.
 */
export function formatDealTitle(d: AddrFields): string {
  const name = (d.name ?? '').trim()
  if (looksLikeFilingName(name)) return name

  const filing = formatListingFilingName(d.addr_street_name, d.addr_direction, d.addr_number)
  const display = (d.addr_display ?? '').trim()
  if (filing && (isNumberFirst(display) || isNumberFirst(name))) return filing
  if (display) return display
  if (filing) return filing
  return name || '—'
}

/** Prefill the EDIT name field without turning a client-style name into an address. */
export function editNamePrefill(d: AddrFields): string {
  const name = (d.name ?? '').trim()
  if (looksLikeFilingName(name)) return name
  const filing = formatListingFilingName(d.addr_street_name, d.addr_direction, d.addr_number)
  const spaceJoined = [d.addr_street_name, d.addr_number].filter(Boolean).join(' ')
  const numberFirst = [d.addr_number, d.addr_street_name].filter(Boolean).join(' ')
  if (filing && (name === spaceJoined || name === numberFirst || isNumberFirst(name))) return filing
  return name
}

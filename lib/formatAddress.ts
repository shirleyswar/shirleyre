/**
 * Formats a deal's address from structured addr_* columns per §5.11.9.
 * Reads columns, never parses deals.address string.
 * City rule: show addr_city only when NOT null AND NOT 'Baton Rouge'.
 *
 * 158C.1: LISTING filing display = Street Cardinal. Number (space-joined).
 *   Matthew spoke it: "Cabela's Pkwy. S. 2703"
 *   STREET = thoroughfare without leading direction.
 *   CARDINAL = direction alone, period appended in display only.
 *   NUMBER = house number.
 *   NEVER glue direction onto front of street.
 *   Structured columns (addr_street_name / addr_direction / addr_number) take
 *   priority over stored addr_display / name, so a wrong stored value does not
 *   persist to the hero or index.
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

/** Cardinal abbreviations — matched case-insensitively after stripping trailing dots. */
const DIRECTIONS_LIST = ['NE', 'NW', 'SE', 'SW', 'N', 'S', 'E', 'W']

/** Strip trailing dots + uppercase for direction comparison. */
export function normalizeCardinal(raw?: string | null): string {
  return (raw ?? '').trim().replace(/\.+$/, '').toUpperCase()
}

/**
 * 158C.1 / 158C.2: treat empty, whitespace, and lone dash variants as empty.
 * Never write these glyphs into addr_direction or display them as a filled cardinal.
 */
export function cleanCardinalStrict(raw?: string | null): string {
  const c = normalizeCardinal(raw)
  if (!c || c === '-' || c === '—' || c === '–') return ''
  return c
}

/**
 * 158C.1: strip a leading cardinal token (N/S/E/W/NE/NW/SE/SW with optional dot)
 * from a street name string and return it separately.
 * e.g. "S. Cabela's Pkwy" → { street: "Cabela's Pkwy", cardinal: "S" }
 */
function splitLeadingCardinal(raw: string): { street: string; cardinal: string } {
  const tokens = raw.trim().split(/\s+/)
  if (tokens.length < 2) return { street: raw.trim(), cardinal: '' }
  const firstUp = tokens[0].replace(/\.+$/, '').toUpperCase()
  if (DIRECTIONS_LIST.includes(firstUp)) {
    return { street: tokens.slice(1).join(' '), cardinal: firstUp }
  }
  return { street: raw.trim(), cardinal: '' }
}

/**
 * 158C.1: spoken filing display — "Cabela's Pkwy. S. 2703"
 * Joins: Street + space + Cardinal. + space + Number
 * Strips leading cardinal from street if addr_direction is empty.
 * Cardinal gets a period appended in display only (never stored).
 * Empty cardinal → "Street Number" (no middle slot, no dash).
 */
export function spokenFilingDisplay(
  street?: string | null,
  cardinal?: string | null,
  number?: string | null,
): string {
  let s = (street ?? '').trim()
  let c = cleanCardinalStrict(cardinal)
  const n = (number ?? '').trim()

  // 158C.1: if no explicit cardinal but street starts with one, extract it
  if (s && !c) {
    const split = splitLeadingCardinal(s)
    if (split.cardinal) { s = split.street; c = split.cardinal }
  }

  if (!s && !n) return ''

  const parts: string[] = []
  if (s) parts.push(s)
  if (c) parts.push(c + '.')  // "S." — period is display-only
  if (n) parts.push(n)
  return parts.join(' ')  // "Cabela's Pkwy. S. 2703"
}

/**
 * LISTING filing name written to name + addr_display on create/EDIT SAVE.
 * 158C.1: produces spoken format "Street Cardinal. Number" (space-joined).
 * Strips leading cardinal from street when none explicitly provided.
 */
export function formatListingFilingName(
  street?: string | null,
  cardinal?: string | null,
  number?: string | null,
): string {
  return spokenFilingDisplay(street, cardinal, number)
}

export function looksLikeFilingName(raw?: string | null): boolean {
  if (!raw) return false
  // Comma-joined legacy (2–3 parts): "Street, Number" or "Street, Cardinal, Number"
  const commaParts = raw.split(',').length
  if (commaParts === 2 || commaParts === 3) return true
  // Space-joined spoken format: has a number token that is not at position 0
  // Pattern: at least two tokens, last token is numeric, first is not numeric
  const tokens = raw.trim().split(/\s+/)
  if (tokens.length >= 2 && /^\d+[A-Za-z]?$/.test(tokens[tokens.length - 1]) && !/^\d/.test(tokens[0])) return true
  return false
}

export function parseListingFilingName(raw: string): {
  street: string
  cardinal: string
  number: string
} | null {
  // Try comma-joined first (legacy)
  const commaParts = raw.split(',').map(p => p.trim())
  if (commaParts.length === 2) {
    return { street: commaParts[0], cardinal: '', number: commaParts[1] }
  }
  if (commaParts.length === 3) {
    return { street: commaParts[0], cardinal: normalizeCardinal(commaParts[1]), number: commaParts[2] }
  }
  // Try spoken format: "Street [Cardinal.] Number"
  const tokens = raw.trim().split(/\s+/)
  if (tokens.length >= 2) {
    const last = tokens[tokens.length - 1]
    if (/^\d+[A-Za-z]?$/.test(last)) {
      const rest = tokens.slice(0, -1)
      const penult = rest[rest.length - 1]
      const penultClean = penult ? penult.replace(/\.+$/, '').toUpperCase() : ''
      if (rest.length >= 2 && DIRECTIONS_LIST.includes(penultClean)) {
        return {
          street: rest.slice(0, -1).join(' '),
          cardinal: penultClean,
          number: last,
        }
      }
      return { street: rest.join(' '), cardinal: '', number: last }
    }
  }
  return null
}

function isNumberFirst(raw?: string | null): boolean {
  if (!raw) return false
  return /^\d+[A-Za-z]?\s/.test(raw.trim())
}

/**
 * Normalize a stored filing-shaped string for display.
 * Handles both legacy comma-joined and new spoken space-joined formats.
 * Strips leading cardinal from the street slot.
 * 158C.1 / 156C.1.
 */
function normalizeFilingDisplay(raw: string): string {
  const parsed = parseListingFilingName(raw)
  if (parsed) {
    return spokenFilingDisplay(parsed.street, parsed.cardinal, parsed.number)
  }
  return raw.trim()
}

/**
 * Deal hero + index ADDRESS — 158C.1.
 * Priority: structured columns (addr_street_name / addr_direction / addr_number)
 * because they allow correct spoke-format display even when stored name/addr_display
 * still has the wrong (cardinal-first) value.
 * Falls back to stored name/addr_display for legacy rows without structured columns.
 */
export function formatDealTitle(d: AddrFields): string {
  // 158C.1: structured columns first — produces correct spoken display
  // even when stored addr_display / name still contain wrong cardinal-first form
  const spoken = spokenFilingDisplay(d.addr_street_name, d.addr_direction, d.addr_number)
  if (spoken) return spoken

  // Legacy fallback: stored name / addr_display
  const name = (d.name ?? '').trim()
  const display = (d.addr_display ?? '').trim()
  const raw = name || display
  if (!raw) return '—'

  if (looksLikeFilingName(raw)) return normalizeFilingDisplay(raw)
  if (isNumberFirst(raw)) return raw  // can't restructure without structured columns
  return raw
}

/**
 * formatAddress — used for display outside LISTING filing contexts.
 * 158C.1: prefer structured columns for spoke-format display.
 */
export function formatAddress(d: AddrFields): string {
  // Prefer structured columns
  if (d.addr_street_name) {
    const spoken = spokenFilingDisplay(d.addr_street_name, d.addr_direction, d.addr_number)
    if (spoken) {
      const city = d.addr_city && d.addr_city !== 'Baton Rouge' ? d.addr_city : null
      return city ? spoken + ' · ' + city : spoken
    }
  }

  // Legacy fallback
  if (d.addr_display) return d.addr_display
  return d.name ?? '—'
}

/** Prefill the EDIT name field without turning a client-style name into an address. */
export function editNamePrefill(d: AddrFields): string {
  const spoken = spokenFilingDisplay(d.addr_street_name, d.addr_direction, d.addr_number)
  if (spoken) return spoken
  const name = (d.name ?? '').trim()
  if (looksLikeFilingName(name)) return normalizeFilingDisplay(name)
  return name
}

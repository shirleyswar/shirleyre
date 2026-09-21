/**
 * Formats a deal's address from structured addr_* columns per §5.11.9.
 * Reads columns, never parses deals.address string.
 * City rule: show addr_city only when NOT null AND NOT 'Baton Rouge'.
 *
 * LISTING filing (158C.1 / WARROOM-166):
 *   Display join spoken: "Cabela's Pkwy. S. 2703"
 *   STREET = thoroughfare without a leading (or trailing) direction.
 *   CARDINAL = direction alone (`S`), period appended in display only.
 *   NUMBER = house number.
 *   NEVER glue direction onto the front of the street name.
 *   Blank cardinal stays blank — never a dash.
 *   Google Places route long_name is often "South Cabela's Parkway" (full word,
 *   no separate direction component). Slot parsing must peel that word.
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

export interface FilingSlots {
  street: string
  cardinal: string
  number: string
}

/**
 * Full words and abbreviations. Google route long_name uses the word
 * ("South"); short_name and typed filing lines use the letter ("S" / "S.").
 * Compound tokens are listed before their single-letter spellings are matched
 * as whole tokens, so "Northeast" is NE and not N.
 */
const DIRECTION_TO_CARDINAL: Record<string, string> = {
  NORTHEAST: 'NE', NORTHWEST: 'NW', SOUTHEAST: 'SE', SOUTHWEST: 'SW',
  NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W',
  NE: 'NE', NW: 'NW', SE: 'SE', SW: 'SW',
  N: 'N', S: 'S', E: 'E', W: 'W',
}

/** Last-token thoroughfare suffix → spoken abbreviation (period is part of the street slot). */
const STREET_SUFFIX: Record<string, string> = {
  AVENUE: 'Ave.', AVE: 'Ave.',
  BOULEVARD: 'Blvd.', BLVD: 'Blvd.',
  STREET: 'St.', ST: 'St.',
  ROAD: 'Rd.', RD: 'Rd.',
  DRIVE: 'Dr.', DR: 'Dr.',
  LANE: 'Ln.', LN: 'Ln.',
  COURT: 'Ct.', CT: 'Ct.',
  PLACE: 'Pl.', PL: 'Pl.',
  CIRCLE: 'Cir.', CIR: 'Cir.',
  HIGHWAY: 'Hwy.', HWY: 'Hwy.',
  PARKWAY: 'Pkwy.', PKWY: 'Pkwy.',
  TRAIL: 'Trl.', TRL: 'Trl.',
  TERRACE: 'Ter.', TER: 'Ter.',
  PLAZA: 'Plz.', PLZ: 'Plz.',
  LOOP: 'Loop',
  WAY: 'Way',
}

/** Strip trailing dots + uppercase for direction comparison. */
export function normalizeCardinal(raw?: string | null): string {
  return (raw ?? '').trim().replace(/\.+$/, '').toUpperCase()
}

/**
 * Empty, whitespace, and lone dash variants are empty.
 * Never write these glyphs into addr_direction or display them as a filled cardinal.
 */
export function cleanCardinalStrict(raw?: string | null): string {
  const c = normalizeCardinal(raw)
  if (!c || c === '-' || c === '—' || c === '–') return ''
  return c
}

/** Map a direction token or stored cardinal to `S` / `NE` / … Empty if it is not a direction. */
export function cardinalAbbrev(raw?: string | null): string {
  const c = cleanCardinalStrict(raw)
  if (!c) return ''
  return DIRECTION_TO_CARDINAL[c] ?? ''
}

function cardinalOfToken(tok: string): string {
  return cardinalAbbrev(tok)
}

/**
 * Peel a leading predirectional, else a trailing postdirectional, off a street.
 * "South Cabela's Parkway" → { street: "Cabela's Parkway", cardinal: "S" }
 * "Cabela's Pkwy. S." → { street: "Cabela's Pkwy.", cardinal: "S" }
 * A one-token street is left alone ("West" is not a cardinal by itself).
 */
function peelEdgeCardinal(raw: string): { street: string; cardinal: string } {
  const tokens = raw.trim().split(/\s+/).filter(Boolean)
  if (tokens.length < 2) return { street: tokens.join(' '), cardinal: '' }
  const lead = cardinalOfToken(tokens[0])
  if (lead) return { street: tokens.slice(1).join(' '), cardinal: lead }
  const trail = cardinalOfToken(tokens[tokens.length - 1])
  if (trail) return { street: tokens.slice(0, -1).join(' '), cardinal: trail }
  return { street: tokens.join(' '), cardinal: '' }
}

function abbreviateStreetSuffix(raw: string): string {
  const tokens = raw.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return ''
  const last = tokens[tokens.length - 1]
  const key = last.replace(/\.+$/, '').toUpperCase()
  const abbr = STREET_SUFFIX[key]
  if (!abbr) return tokens.join(' ')
  tokens[tokens.length - 1] = abbr
  return tokens.join(' ')
}

/**
 * Canonical STREET / CARDINAL / NUMBER.
 * Street loses a glued leading or trailing direction.
 * Cardinal is the bare abbreviation, or '' (never a dash).
 * An explicit cardinal wins over a peeled one; the street is still peeled.
 */
export function canonicalizeFilingSlots(
  street?: string | null,
  cardinal?: string | null,
  number?: string | null,
): FilingSlots {
  const explicit = cardinalAbbrev(cardinal)
  const peeled = peelEdgeCardinal(street ?? '')
  return {
    street: abbreviateStreetSuffix(peeled.street),
    cardinal: explicit || peeled.cardinal,
    number: (number ?? '').trim(),
  }
}

/**
 * Parse one street line in either Google order ("2703 South Cabela's Parkway")
 * or filing order ("Cabela's Pkwy. S. 2703").
 */
export function parseStreetLine(line: string): FilingSlots {
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return { street: '', cardinal: '', number: '' }

  let number = ''
  let body = tokens
  if (/^\d+[A-Za-z]?$/.test(tokens[0])) {
    number = tokens[0]
    body = tokens.slice(1)
  } else if (/^\d+[A-Za-z]?$/.test(tokens[tokens.length - 1])) {
    number = tokens[tokens.length - 1]
    body = tokens.slice(0, -1)
  }

  const peeled = peelEdgeCardinal(body.join(' '))
  return {
    street: abbreviateStreetSuffix(peeled.street),
    cardinal: peeled.cardinal,
    number,
  }
}

/**
 * Places Details → filing slots.
 * route long_name often bakes the direction in as a word ("South Cabela's Parkway")
 * and there is no separate direction component. short_name ("S Cabela's Pkwy") and
 * the formatted street line ("2703 S Cabela's Pkwy") are fallbacks when the long
 * name omitted the direction.
 */
export function filingSlotsFromPlaceRoute(input: {
  routeLong?: string | null
  routeShort?: string | null
  streetNumber?: string | null
  formattedAddress?: string | null
}): FilingSlots {
  const number = (input.streetNumber ?? '').trim()
  const fromLong = canonicalizeFilingSlots(input.routeLong, '', number)

  let slots: FilingSlots = fromLong
  if (!slots.cardinal && input.routeShort) {
    const fromShort = canonicalizeFilingSlots(input.routeShort, '', number)
    if (fromShort.cardinal || !slots.street) slots = fromShort
  }
  if (!slots.cardinal && input.formattedAddress) {
    const line = input.formattedAddress.split(',')[0] ?? ''
    const fromLine = parseStreetLine(line)
    if (fromLine.cardinal || !slots.street) {
      slots = {
        street: fromLine.street || slots.street,
        cardinal: fromLine.cardinal || slots.cardinal,
        number: fromLine.number || slots.number,
      }
    }
  }
  if (!slots.number && number) slots = { ...slots, number }
  return slots
}

/**
 * Spoken filing display — "Cabela's Pkwy. S. 2703"
 * Joins: Street + space + Cardinal. + space + Number
 * Empty cardinal → "Street Number" (no middle slot, no dash).
 * Repairs a direction still glued onto the street.
 */
export function spokenFilingDisplay(
  street?: string | null,
  cardinal?: string | null,
  number?: string | null,
): string {
  const slots = canonicalizeFilingSlots(street, cardinal, number)
  if (!slots.street && !slots.number) return ''

  const parts: string[] = []
  if (slots.street) parts.push(slots.street)
  if (slots.cardinal) parts.push(slots.cardinal + '.')
  if (slots.number) parts.push(slots.number)
  return parts.join(' ')
}

/**
 * LISTING filing name written to name + addr_display on create/EDIT SAVE.
 */
export function formatListingFilingName(
  street?: string | null,
  cardinal?: string | null,
  number?: string | null,
): string {
  return spokenFilingDisplay(street, cardinal, number)
}

function isHouseNumber(raw: string): boolean {
  return /^\d+[A-Za-z]?$/.test(raw.trim())
}

export function looksLikeFilingName(raw?: string | null): boolean {
  if (!raw) return false
  const commaParts = raw.split(',').map(p => p.trim())
  if (commaParts.length === 2 && isHouseNumber(commaParts[1])) return true
  if (commaParts.length === 3 && isHouseNumber(commaParts[2])) return true
  const tokens = raw.trim().split(/\s+/)
  if (tokens.length >= 2 && isHouseNumber(tokens[tokens.length - 1]) && !/^\d/.test(tokens[0])) return true
  return false
}

export function parseListingFilingName(raw: string): FilingSlots | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const commaParts = trimmed.split(',').map(p => p.trim())
  if (commaParts.length === 2 && isHouseNumber(commaParts[1])) {
    return canonicalizeFilingSlots(commaParts[0], '', commaParts[1])
  }
  if (commaParts.length === 3 && isHouseNumber(commaParts[2])) {
    return canonicalizeFilingSlots(commaParts[0], commaParts[1], commaParts[2])
  }

  const tokens = trimmed.split(/\s+/)
  if (tokens.length >= 2 && isHouseNumber(tokens[tokens.length - 1]) && !/^\d/.test(tokens[0])) {
    const last = tokens[tokens.length - 1]
    const rest = tokens.slice(0, -1)
    const penultClean = cardinalOfToken(rest[rest.length - 1] ?? '')
    if (rest.length >= 2 && penultClean) {
      return canonicalizeFilingSlots(rest.slice(0, -1).join(' '), penultClean, last)
    }
    return canonicalizeFilingSlots(rest.join(' '), '', last)
  }

  // Google formatted street line, with or without the city tail.
  if (isNumberFirst(trimmed)) {
    const slots = parseStreetLine(trimmed.split(',')[0] ?? trimmed)
    if (slots.street || slots.number) return slots
  }
  return null
}

function isNumberFirst(raw?: string | null): boolean {
  if (!raw) return false
  return /^\d+[A-Za-z]?\s/.test(raw.trim())
}

/**
 * Normalize a stored filing-shaped string for display.
 * Repairs cardinal-first and full-word direction glued onto the street.
 */
function normalizeFilingDisplay(raw: string): string {
  const parsed = parseListingFilingName(raw)
  if (parsed && (parsed.street || parsed.number)) {
    return spokenFilingDisplay(parsed.street, parsed.cardinal, parsed.number)
  }
  return raw.trim()
}

/**
 * Deal hero + index ADDRESS.
 * Structured columns win, and a direction glued into the street is peeled
 * so a legacy row still paints "Cabela's Pkwy. S. 2703".
 */
export function formatDealTitle(d: AddrFields): string {
  // A street slot is required. Number-only columns must not hide a stored display.
  if ((d.addr_street_name ?? '').trim()) {
    const spoken = spokenFilingDisplay(d.addr_street_name, d.addr_direction, d.addr_number)
    if (spoken) return spoken
  }

  const name = (d.name ?? '').trim()
  const display = (d.addr_display ?? '').trim()
  const raw = name || display
  if (!raw) return '—'

  if (looksLikeFilingName(raw) || isNumberFirst(raw)) return normalizeFilingDisplay(raw)
  return raw
}

/**
 * formatAddress — display outside the deal-hero title, same filing join.
 * Appends a non-Baton-Rouge city.
 */
export function formatAddress(d: AddrFields): string {
  if ((d.addr_street_name ?? '').trim()) {
    const spoken = spokenFilingDisplay(d.addr_street_name, d.addr_direction, d.addr_number)
    if (spoken) {
      const city = d.addr_city && d.addr_city !== 'Baton Rouge' ? d.addr_city : null
      return city ? spoken + ' · ' + city : spoken
    }
  }

  const display = (d.addr_display ?? '').trim()
  const name = (d.name ?? '').trim()
  const raw = display || name
  if (raw && (looksLikeFilingName(raw) || isNumberFirst(raw))) {
    const norm = normalizeFilingDisplay(raw)
    if (norm) {
      const city = d.addr_city && d.addr_city !== 'Baton Rouge' ? d.addr_city : null
      return city ? norm + ' · ' + city : norm
    }
  }
  if (display) return display
  return name || '—'
}

/** Prefill the EDIT name field without turning a client-style name into an address. */
export function editNamePrefill(d: AddrFields): string {
  const name = (d.name ?? '').trim()
  if (name && !looksLikeFilingName(name) && !isNumberFirst(name)) return name
  if ((d.addr_street_name ?? '').trim()) {
    const spoken = spokenFilingDisplay(d.addr_street_name, d.addr_direction, d.addr_number)
    if (spoken) return spoken
  }
  if (name && (looksLikeFilingName(name) || isNumberFirst(name))) return normalizeFilingDisplay(name)
  return name
}

/**
 * Formats a raw address into ShirleyCRE filing convention:
 * Street Name, Type, Cardinal, Municipal number
 * Example: "1252 Government St N, Baton Rouge, LA" → "Government St. N. 1252"
 */
export function formatAddress(raw: string | null | undefined): string {
  if (!raw) return '—'

  // Strip filing emoji and city/state/zip/country
  let addr = raw
    .replace(/^📁\s*/, '')
    .replace(/,?\s*suite\s+[\w-]+/gi, '')   // strip suite if any
    .replace(/,\s*(LA|Louisiana)\s+\d{5}.*$/i, '')
    .replace(/,?\s*Baton Rouge\s*,?/gi, '')
    .replace(/,?\s*USA\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  // If starts with a street number, reformat: "1252 Government St N" → "Government St. N. 1252"
  const match = addr.match(/^(\d+[-\d]*)\s+(.+)$/)
  if (match) {
    const number = match[1]
    let street = match[2].trim()

    // Add periods to street type abbreviations (only if not already there)
    street = street
      .replace(/\bSt(?!\.)\b/g, 'St.')
      .replace(/\bAve(?!\.)\b/g, 'Ave.')
      .replace(/\bBlvd(?!\.)\b/g, 'Blvd.')
      .replace(/\bDr(?!\.)\b/g, 'Dr.')
      .replace(/\bRd(?!\.)\b/g, 'Rd.')
      .replace(/\bLn(?!\.)\b/g, 'Ln.')
      .replace(/\bCt(?!\.)\b/g, 'Ct.')
      .replace(/\bPl(?!\.)\b/g, 'Pl.')
      .replace(/\bHwy(?!\.)\b/g, 'Hwy.')
      .replace(/\bPkwy(?!\.)\b/g, 'Pkwy.')
      .replace(/\bTer(?!\.)\b/g, 'Ter.')
      // Cardinals — only standalone at word boundary
      .replace(/\bNE(?!\.)\b/g, 'NE.')
      .replace(/\bNW(?!\.)\b/g, 'NW.')
      .replace(/\bSE(?!\.)\b/g, 'SE.')
      .replace(/\bSW(?!\.)\b/g, 'SW.')
      .replace(/\bN(?!\.|\w)\b/g, 'N.')
      .replace(/\bS(?!\.|\w)\b/g, 'S.')
      .replace(/\bE(?!\.|\w)\b/g, 'E.')
      .replace(/\bW(?!\.|\w)\b/g, 'W.')

    return `${street} ${number}`
  }

  return addr
}

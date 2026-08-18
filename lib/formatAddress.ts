/**
 * Formats a deal's address from structured addr_* columns per §5.11.9.
 * Reads columns, never parses deals.address string.
 * City rule: show addr_city only when NOT null AND NOT 'Baton Rouge'.
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

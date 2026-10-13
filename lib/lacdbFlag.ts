/**
 * Render-time LACDB mark. Reads the shipped listing snapshot and the deal's
 * stored link. It does not write deals.
 *
 * Active: listing id is in public/agents/listings.json with status active.
 * The id is the first 8 hex of deal_source "lacdb:<id>" or of lacdb_url.
 * Off: the deal has one of those links and the id is not in that active set.
 */

export interface LacdbListingStub {
  status?: string | null
  source?: { listing_id?: string | null; url?: string | null } | null
}

export interface LacdbDealLink {
  lacdb_url?: string | null
  deal_source?: string | null
}

export interface LacdbMark {
  kind: 'active' | 'off'
  href: string | null
}

export function lacdbTid(value: string | null | undefined): string {
  if (!value) return ''
  const match = String(value).match(/(?:lacdb:|\/listings\/)([0-9a-f]{8})\b/i)
  return match ? match[1].toLowerCase() : ''
}

export function activeLacdbIndex(listings: LacdbListingStub[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const listing of listings) {
    if (listing.status !== 'active') continue
    const tid = lacdbTid(`lacdb:${listing.source?.listing_id ?? ''}`)
    if (!tid || index.has(tid)) continue
    index.set(tid, listing.source?.url?.trim() || '')
  }
  return index
}

export function lacdbFlagFor(deal: LacdbDealLink, active: Map<string, string>): LacdbMark | null {
  const tids = [lacdbTid(deal.deal_source), lacdbTid(deal.lacdb_url)].filter(Boolean)
  const activeTid = tids.find(tid => active.has(tid))
  if (activeTid) {
    const fromFeed = active.get(activeTid) || ''
    const href = fromFeed || deal.lacdb_url?.trim() || null
    return { kind: 'active', href }
  }
  const hadLink = tids.length > 0 || Boolean(deal.lacdb_url && deal.lacdb_url.trim())
  if (!hadLink) return null
  return { kind: 'off', href: null }
}

import feed from '../public/agents/listings.json'
import { lacdbTid, type LacdbDealLink } from './lacdbFlag'

export interface FeedPrice {
  status?: string | null
  source?: { listing_id?: string | null } | null
  price?: {
    amount?: number | null
    unit?: string | null
    total_min?: number | null
    total_max?: number | null
    label?: string | null
  } | null
}

/** Whole-dollar asking price from a feed record. Per-square-foot quotes are not a total. */
export function totalAsking(price: FeedPrice['price']): number | null {
  if (!price) return null
  if (price.unit === 'per_sf' || price.unit === 'per_acre') return null
  if (price.amount != null && Number.isFinite(Number(price.amount))) {
    const amount = Math.round(Number(price.amount))
    return amount > 0 ? amount : null
  }
  const min = price.total_min
  const max = price.total_max
  if (
    min != null && max != null
    && Number.isFinite(Number(min)) && Number.isFinite(Number(max))
    && Math.round(Number(min)) === Math.round(Number(max))
  ) {
    const amount = Math.round(Number(max))
    return amount > 0 ? amount : null
  }
  return null
}

/** Active listings only. A pending or off-market record does not override the stored price. */
export function activeAskingIndex(listings: FeedPrice[]): Map<string, number> {
  const index = new Map<string, number>()
  for (const listing of listings) {
    if (listing.status !== 'active') continue
    const tid = lacdbTid(`lacdb:${listing.source?.listing_id ?? ''}`)
    if (!tid || index.has(tid)) continue
    const amount = totalAsking(listing.price)
    if (amount == null) continue
    index.set(tid, amount)
  }
  return index
}

const ASKING = activeAskingIndex((feed.listings ?? []) as FeedPrice[])

/** Fresh asking price for a linked active listing, or null to keep the stored figure. */
export function freshAsking(deal: LacdbDealLink | null | undefined): number | null {
  if (!deal) return null
  const tids = [lacdbTid(deal.deal_source), lacdbTid(deal.lacdb_url)].filter(Boolean)
  for (const tid of tids) {
    const amount = ASKING.get(tid)
    if (amount != null) return amount
  }
  return null
}

export function askingForDeal(
  deal: LacdbDealLink | null | undefined,
  stored: number | null | undefined,
): number | null {
  const fresh = freshAsking(deal)
  if (fresh != null) return fresh
  if (stored == null || !Number.isFinite(Number(stored))) return null
  const amount = Math.round(Number(stored))
  return amount > 0 ? amount : null
}

export function applyFreshAsking<T extends { asking_price?: number | null }>(
  deal: LacdbDealLink | null | undefined,
  econ: T | null,
): T | null {
  if (!econ) return econ
  const fresh = freshAsking(deal)
  if (fresh == null || econ.asking_price === fresh) return econ
  return { ...econ, asking_price: fresh }
}

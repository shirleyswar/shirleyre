/**
 * Same-origin LACDB listing photo.
 *
 * public/agents/listings.json already carries media.photos. Those URLs live on
 * storage.googleapis.com and are not ours — a referrer rule or a deleted object
 * would blank every deal at once, and a static export cannot scrape LACDB.
 * scripts/mirror-lacdb-photos.mjs copies the chosen main photo into
 * public/agents/photos and writes this manifest. The deal page asks the
 * browser for /agents/photos/{file}. An uploaded deal photo still wins;
 * a missing file falls back to the empty photo state.
 */

import manifest from '../public/agents/photos/manifest.json'
import { lacdbTid, type LacdbDealLink } from './lacdbFlag'

const files = manifest as Record<string, string>

export function lacdbPhotoPath(deal: LacdbDealLink | null | undefined): string | null {
  if (!deal) return null
  const tid = lacdbTid(deal.deal_source) || lacdbTid(deal.lacdb_url)
  if (!tid) return null
  const file = files[tid]
  if (!file || !/^[0-9a-f]{8}\.(webp|jpe?g|png|gif)$/i.test(file)) return null
  return `/agents/photos/${file}`
}

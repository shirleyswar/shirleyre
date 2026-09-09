import { supabase } from './supabase'

/** Public Storage bucket for the deal hero photo. Created in 20260909000000 migration. */
export const DEAL_PHOTO_BUCKET = 'deal-photos'
export const DEAL_PHOTO_OBJECT = 'main'

export function dealPhotoObjectPath(dealId: string): string {
  return `${dealId}/${DEAL_PHOTO_OBJECT}`
}

export function dealPhotoPublicUrl(dealId: string, cacheBust?: number): string {
  const { data } = supabase.storage.from(DEAL_PHOTO_BUCKET).getPublicUrl(dealPhotoObjectPath(dealId))
  return cacheBust ? `${data.publicUrl}?t=${cacheBust}` : data.publicUrl
}

/**
 * Upload/replace the main deal photo at `{dealId}/main`.
 * Writes `deals.photo_url` when that column exists; ignores a missing-column error
 * so the object in Storage is still the source of truth.
 */
export async function uploadDealPhoto(dealId: string, file: File): Promise<string> {
  const path = dealPhotoObjectPath(dealId)
  const { error } = await supabase.storage.from(DEAL_PHOTO_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
    cacheControl: '3600',
  })
  if (error) throw error

  const publicUrl = dealPhotoPublicUrl(dealId)
  const { error: colErr } = await supabase
    .from('deals')
    .update({ photo_url: publicUrl })
    .eq('id', dealId)
  if (colErr && !/photo_url|schema cache|column/i.test(colErr.message ?? '')) {
    throw colErr
  }
  return dealPhotoPublicUrl(dealId, Date.now())
}

import { supabase } from '@/lib/supabase'

/**
 * Closed-deal disposition.
 *
 * Archive is a past sale or lease. The live deals.status check rejects a new
 * `archived` value, and this app cannot run DDL, so the sale/lease record is
 * an activity_log row. The deal row itself is not rewritten. Place In Service
 * is the existing `in_service` status; every other column stays.
 */
export type ArchiveKind = 'sale' | 'lease'

export const ARCHIVE_ACTION = 'archived'

export function asArchiveKind(value: string | null | undefined): ArchiveKind | null {
  const v = (value ?? '').trim().toLowerCase()
  if (v === 'sale' || v === 'lease') return v
  return null
}

export function latestArchiveKind(
  rows: { action_type?: string | null; description?: string | null; created_at?: string | null }[],
): ArchiveKind | null {
  let best: { at: string; kind: ArchiveKind } | null = null
  for (const row of rows) {
    if (row.action_type !== ARCHIVE_ACTION) continue
    const kind = asArchiveKind(row.description)
    if (!kind) continue
    const at = row.created_at ?? ''
    if (!best || at >= best.at) best = { at, kind }
  }
  return best?.kind ?? null
}

export async function recordArchive(dealId: string, kind: ArchiveKind): Promise<string | null> {
  const { error } = await supabase.from('activity_log').insert({
    deal_id: dealId,
    action_type: ARCHIVE_ACTION,
    description: kind,
    created_by: 'system',
  })
  return error?.message ?? null
}

export async function placeDealInService(dealId: string): Promise<string | null> {
  const { error } = await supabase.from('deals').update({ status: 'in_service' }).eq('id', dealId)
  return error?.message ?? null
}

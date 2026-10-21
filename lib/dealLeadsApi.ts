import { supabase } from './supabase'
import {
  isLeadsTableMissing,
  leadWritePayload,
  type DealLead,
  type LeadDraft,
} from './dealLeads'
import type { AddrFields } from './formatAddress'

const COLS = 'id, deal_id, name, company, phone, email, serious_level, lead_date, note, created_at, updated_at'

export interface LeadsLoad {
  leads: DealLead[]
  missing: boolean
  error: string
}

export function leadsFailure(error: { code?: string | null; message?: string | null } | null): LeadsLoad {
  if (isLeadsTableMissing(error)) return { leads: [], missing: true, error: '' }
  return { leads: [], missing: false, error: error?.message || 'Could not load leads.' }
}

export async function loadDealLeads(dealId: string): Promise<LeadsLoad> {
  const { data, error } = await supabase
    .from('deal_leads')
    .select(COLS)
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
  if (error) return leadsFailure(error)
  return { leads: (data ?? []) as DealLead[], missing: false, error: '' }
}

export interface MasterLead extends DealLead {
  deal: AddrFields | null
}

const DEAL_COLS = 'id, name, address, addr_display, addr_street_name, addr_street_type, addr_direction, addr_number, addr_city'

export async function loadAllLeads(): Promise<{ leads: MasterLead[]; missing: boolean; error: string }> {
  const embedded = await supabase
    .from('deal_leads')
    .select(`${COLS}, deals(${DEAL_COLS})`)
    .order('created_at', { ascending: false })
  if (!embedded.error) {
    const leads = ((embedded.data ?? []) as unknown as (DealLead & { deals: AddrFields | AddrFields[] | null })[]).map(row => {
      const deal = Array.isArray(row.deals) ? row.deals[0] ?? null : row.deals ?? null
      return { ...row, deal }
    })
    return { leads, missing: false, error: '' }
  }
  if (isLeadsTableMissing(embedded.error)) return { leads: [], missing: true, error: '' }

  const plain = await supabase
    .from('deal_leads')
    .select(COLS)
    .order('created_at', { ascending: false })
  if (plain.error) return { ...leadsFailure(plain.error), leads: [] }
  const rows = (plain.data ?? []) as DealLead[]
  const ids = Array.from(new Set(rows.map(row => row.deal_id).filter(Boolean)))
  let byId = new Map<string, AddrFields>()
  if (ids.length) {
    const deals = await supabase.from('deals').select(DEAL_COLS).in('id', ids)
    if (!deals.error) {
      byId = new Map(((deals.data ?? []) as (AddrFields & { id: string })[]).map(deal => [deal.id, deal]))
    }
  }
  return {
    leads: rows.map(row => ({ ...row, deal: byId.get(row.deal_id) ?? null })),
    missing: false,
    error: '',
  }
}

export async function saveLead(dealId: string, draft: LeadDraft, id?: string): Promise<{ lead: DealLead | null; missing: boolean; error: string }> {
  const payload = leadWritePayload(dealId, draft)
  if (id) {
    const { data, error } = await supabase
      .from('deal_leads')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(COLS)
      .single()
    if (error) {
      if (isLeadsTableMissing(error)) return { lead: null, missing: true, error: 'Leads not set up yet.' }
      return { lead: null, missing: false, error: error.message || 'Could not save this lead.' }
    }
    return { lead: data as DealLead, missing: false, error: '' }
  }
  const { data, error } = await supabase
    .from('deal_leads')
    .insert(payload)
    .select(COLS)
    .single()
  if (error) {
    if (isLeadsTableMissing(error)) return { lead: null, missing: true, error: 'Leads not set up yet.' }
    return { lead: null, missing: false, error: error.message || 'Could not save this lead.' }
  }
  return { lead: data as DealLead, missing: false, error: '' }
}

export async function deleteLead(id: string): Promise<{ ok: boolean; missing: boolean; error: string }> {
  const { error } = await supabase.from('deal_leads').delete().eq('id', id)
  if (error) {
    if (isLeadsTableMissing(error)) return { ok: false, missing: true, error: 'Leads not set up yet.' }
    return { ok: false, missing: false, error: error.message || 'Could not delete this lead.' }
  }
  return { ok: true, missing: false, error: '' }
}

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mtkyyaorvensylrfbhxv.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_qGuGE-6ExwYvFC01eBvV_g_ewDYx77M'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types aligned with migration.sql schema
export type DealStatus = 'pipeline' | 'active' | 'under_contract' | 'pending_payment' | 'closed' | 'expired' | 'dormant' | 'terminated' | 'in_review' | 'in_service' | 'hot'
export type DealType = 'listing' | 'buyer_rep' | 'tenant_rep' | 'landlord_rep' | 'consulting' | 'other' | 'potential_listing' | 'active_listing' | 'landlord' | 'seller' | 'tenant' | 'buyer' | 'referral' | 'x_develop_serv' | 'x_consulting' | 'in_service' | 'lease'
export type DealTier = 'tracked' | 'filed'
export type ContactPriority = 'ehvp' | 'hvp' | 'standard'
export type TaskStatus = 'open' | 'in_progress' | 'complete' | 'deferred'
export type FolderAction = 'create' | 'move'
export type FolderStatus = 'pending' | 'complete' | 'error'

export interface Deal {
  id: string
  name: string
  address: string | null
  type: DealType
  status: DealStatus
  tier: DealTier
  value: number | null
  commission_rate: number | null
  commission_estimated: number | null
  commission_collected: number | null
  deal_source: string | null
  notes: string | null
  dropbox_link: string | null
  parent_deal_id: string | null
  rating: number | null
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  deal_id: string | null
  title: string
  status: TaskStatus
  due_date: string | null
  completed_by: string | null
  parent_task_id: string | null
  created_at: string
}

export interface Contact {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  role: string | null
  referral_source: string | null
  notes: string | null
  priority: ContactPriority
  created_at: string
}

export interface DealContact {
  id: string
  deal_id: string
  contact_id: string
  relationship: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  deal_id: string | null
  contact_id: string | null
  action_type: string
  description: string | null
  created_by: string | null
  created_at: string
}

export interface FolderQueue {
  id: string
  deal_id: string
  action: FolderAction
  folder_name: string
  folder_path: string
  subfolder_template: string | null
  status: FolderStatus
  created_at: string
  completed_at: string | null
  error_message: string | null
}

// Contract deadline types
export type DeadlineType = 'inspection' | 'financing' | 'appraisal' | 'title' | 'survey' | 'closing' | 'custom'
export type DeadlineStatus = 'pending' | 'satisfied' | 'extended' | 'missed'

export interface ContractDeadline {
  id: string
  deal_id: string
  label: string
  deadline_date: string  // DATE as string YYYY-MM-DD
  deadline_type: DeadlineType
  status: DeadlineStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LacdbListing {
  id: string
  lacdb_id: string
  lacdb_slug: string | null
  name: string | null
  status: string | null
  listing_type: string | null
  property_types: string[]
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  county: string | null
  lat: number | null
  lng: number | null
  price: number | null
  price_label: string | null
  price_per_sf: number | null
  lease_rate: number | null
  rate_label: string | null
  sqft: number | null
  acres: number | null
  year_built: number | null
  description: string | null
  images: { url: string; thumb: string }[]
  lacdb_url: string | null
  list_date: string | null
  expiration_date: string | null
  synced_at: string
  created_at: string
}

// Session 2 types
export interface Entity {
  id: string
  name: string
  type: string | null
  notes: string | null
  dropbox_link: string | null
  created_at: string
}

export interface EntityItem {
  id: string
  entity_id: string
  title: string
  notes: string | null
  created_at: string
}

export interface PersonalTask {
  id: string
  title: string
  status: 'pending' | 'done'
  emoji: string
  sort_order: number
  created_at: string
}

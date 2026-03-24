'use client'

import { useState, useEffect } from 'react'
import { supabase, Deal, DealStatus, DealTier } from '@/lib/supabase'

const STATUS_LABELS: Record<DealStatus, string> = {
  pipeline: 'Pipeline',
  active: 'Active',
  under_contract: 'Under Contract',
  pending_payment: 'Pending Pmt',
  closed: 'Closed',
  dead: 'Dead',
}

const STATUS_CLASS: Record<DealStatus, string> = {
  pipeline: 'badge-pipeline',
  active: 'badge-active',
  under_contract: 'badge-contract',
  pending_payment: 'badge-pending',
  closed: 'badge-closed',
  dead: 'badge-dead',
}

function formatCurrency(n: number | null) {
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export default function DealPipelinePanel() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<DealStatus | 'all'>('all')
  const [tierFilter, setTierFilter] = useState<DealTier | 'all'>('all')
  const [sortBy, setSortBy] = useState<'commission_estimated' | 'created_at' | 'name'>('created_at')
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    fetchDeals()
  }, [filter, tierFilter, sortBy])

  async function fetchDeals() {
    try {
      let query = supabase.from('deals').select('*')
      if (filter !== 'all') query = query.eq('status', filter)
      if (tierFilter !== 'all') query = query.eq('tier', tierFilter)
      query = query.order(sortBy, { ascending: sortBy === 'name' })
      const { data } = await query.limit(50)
      if (data) setDeals(data as Deal[])
    } catch {
      setDeals(PLACEHOLDER_DEALS)
    } finally {
      setLoading(false)
    }
  }

  const filteredCount = deals.length
  const totalComm = deals.reduce((s, d) => s + (d.commission_estimated || 0), 0)

  return (
    <div className="wr-card">
      {/* Header */}
      <div className="wr-card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span style={{ color: 'var(--accent-gold)', display: 'flex' }}>
          <PipeIcon />
        </span>
        <span className="wr-card-title">Deal Pipeline</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {filteredCount} deals · {formatCurrency(totalComm)} commission
        </span>

        {/* Filters */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {/* Status filter */}
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as DealStatus | 'all')}
            style={selectStyle}
          >
            <option value="all">All Status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {/* Tier filter */}
          <select
            value={tierFilter}
            onChange={e => setTierFilter(e.target.value as DealTier | 'all')}
            style={selectStyle}
          >
            <option value="all">All Tiers</option>
            <option value="tracked">Tracked</option>
            <option value="filed">Filed</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            style={selectStyle}
          >
            <option value="created_at">Newest</option>
            <option value="commission_estimated">Commission ↓</option>
            <option value="name">Name</option>
          </select>

          {/* Add deal */}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              padding: '5px 12px',
              background: 'var(--accent-gold)',
              color: '#0D0F14',
              border: 'none',
              borderRadius: 5,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Deal
          </button>
        </div>
      </div>

      {/* Add deal form */}
      {showAddForm && <AddDealForm onAdd={(d) => { setDeals(prev => [d, ...prev]); setShowAddForm(false) }} />}

      {/* Table */}
      {loading ? (
        <SkeletonTable />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Deal Name', 'Address', 'Type', 'Status', 'Tier', 'Value', 'Commission', 'Source', 'Files'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left',
                    padding: '7px 10px',
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    No deals match this filter. Add one above ↑
                  </td>
                </tr>
              ) : (
                deals.map((deal, i) => (
                  <tr
                    key={deal.id}
                    style={{
                      borderBottom: i < deals.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      transition: 'background 0.1s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <td style={{ padding: '10px 10px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {deal.name}
                    </td>
                    <td style={{ padding: '10px 10px', color: 'var(--text-muted)', fontSize: 12 }}>
                      {deal.address || '—'}
                    </td>
                    <td style={{ padding: '10px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {deal.type.replace('_', ' ')}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span className={`badge ${STATUS_CLASS[deal.status as DealStatus]}`}>
                        {STATUS_LABELS[deal.status as DealStatus]}
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 3,
                        background: deal.tier === 'filed' ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.05)',
                        color: deal.tier === 'filed' ? '#60A5FA' : 'var(--text-muted)',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}>
                        {deal.tier}
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {formatCurrency(deal.value)}
                    </td>
                    <td style={{ padding: '10px 10px', color: 'var(--accent-gold)', fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {formatCurrency(deal.commission_estimated)}
                    </td>
                    <td style={{ padding: '10px 10px', color: 'var(--text-muted)', fontSize: 12 }}>
                      {deal.deal_source || '—'}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <DropboxButton url={deal.dropbox_link} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Quick add form
function AddDealForm({ onAdd }: { onAdd: (d: Deal) => void }) {
  const [form, setForm] = useState({ name: '', address: '', type: 'listing', status: 'pipeline', tier: 'tracked', deal_source: '' })
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const { data } = await supabase.from('deals').insert({
        name: form.name.trim(),
        address: form.address || null,
        type: form.type,
        status: form.status,
        tier: form.tier,
        deal_source: form.deal_source || null,
      }).select().single()
      if (data) onAdd(data as Deal)
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid rgba(201,147,58,0.2)',
      borderRadius: 8,
      padding: 16,
      marginBottom: 16,
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
    }}>
      <input placeholder="Deal name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{...inputStyle, flex: '1 1 180px'}} />
      <input placeholder="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} style={{...inputStyle, flex: '1 1 180px'}} />
      <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} style={{...selectStyle, flex: '1 1 120px'}}>
        <option value="listing">Listing</option>
        <option value="buyer_rep">Buyer Rep</option>
        <option value="tenant_rep">Tenant Rep</option>
        <option value="landlord_rep">Landlord Rep</option>
        <option value="consulting">Consulting</option>
        <option value="other">Other</option>
      </select>
      <select value={form.tier} onChange={e => setForm({...form, tier: e.target.value})} style={{...selectStyle, flex: '1 1 100px'}}>
        <option value="tracked">Tracked</option>
        <option value="filed">Filed</option>
      </select>
      <input placeholder="Source (referral, cold call...)" value={form.deal_source} onChange={e => setForm({...form, deal_source: e.target.value})} style={{...inputStyle, flex: '1 1 160px'}} />
      <button onClick={submit} disabled={saving || !form.name.trim()} style={{
        padding: '7px 16px', background: 'var(--accent-gold)', color: '#0D0F14', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        opacity: (!form.name.trim() || saving) ? 0.5 : 1,
      }}>
        {saving ? 'Saving...' : 'Create Deal'}
      </button>
    </div>
  )
}

function SkeletonTable() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
    </div>
  )
}

const PLACEHOLDER_DEALS: Deal[] = [
  {
    id: 'p1', name: 'Edinburgh Ave. N. 1873', address: 'Edinburgh Ave. N. 1873, Baton Rouge',
    type: 'listing', status: 'under_contract', tier: 'filed',
    value: 1200000, commission_rate: 0.06, commission_estimated: 72000, commission_collected: 0,
    deal_source: 'Referral', notes: null, dropbox_link: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'p2', name: 'French Truck Coffee — BR', address: null,
    type: 'tenant_rep', status: 'active', tier: 'tracked',
    value: 800000, commission_rate: 0.04, commission_estimated: 32000, commission_collected: 0,
    deal_source: 'Cold Call', notes: null, dropbox_link: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
]

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 5,
  padding: '5px 8px',
  fontSize: 12,
  color: 'var(--text-primary)',
  outline: 'none',
  cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 5,
  padding: '6px 10px',
  fontSize: 12,
  color: 'var(--text-primary)',
  outline: 'none',
}

function PipeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 12h18M3 6h18M3 18h12"/>
    </svg>
  )
}

const DROPBOX_FALLBACK = 'https://www.dropbox.com/scl/fo/r9dq6fwfmp81tv1ec02gb/ANqIOI6hM94j-v4jv9czcpo?rlkey=0bd4kas03bfl3vakbcln602tp&st=dc2a5sqy&dl=0'

function DropboxButton({ url }: { url: string | null | undefined }) {
  const href = url || DROPBOX_FALLBACK
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={url ? 'Open deal folder' : 'Open Active Listings folder'}
      onClick={e => e.stopPropagation()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 6,
        background: url ? 'rgba(0,97,255,0.12)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${url ? 'rgba(0,97,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
        color: url ? '#4F8EF7' : 'var(--text-dim)',
        transition: 'all 0.15s',
        textDecoration: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(0,97,255,0.22)'
        e.currentTarget.style.borderColor = 'rgba(0,97,255,0.5)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = url ? 'rgba(0,97,255,0.12)' : 'rgba(255,255,255,0.05)'
        e.currentTarget.style.borderColor = url ? 'rgba(0,97,255,0.3)' : 'rgba(255,255,255,0.08)'
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L6 6.5L12 11L18 6.5L12 2ZM6 6.5L0 11L6 15.5L12 11L6 6.5ZM18 6.5L12 11L18 15.5L24 11L18 6.5ZM6 15.5L12 20L18 15.5L12 11L6 15.5Z"/>
      </svg>
    </a>
  )
}

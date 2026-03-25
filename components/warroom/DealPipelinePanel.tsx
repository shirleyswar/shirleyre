'use client'

import { useState, useEffect } from 'react'
import { supabase, Deal, DealStatus, DealTier } from '@/lib/supabase'

const DEAL_TYPES: { value: string; label: string }[] = [
  { value: 'potential_listing',   label: 'Potential Listing' },
  { value: 'active_listing',      label: 'Active Listing' },
  { value: 'landlord',            label: 'Landlord' },
  { value: 'seller',              label: 'Seller' },
  { value: 'tenant',              label: 'Tenant' },
  { value: 'buyer',               label: 'Buyer' },
  { value: 'referral',            label: 'Referral' },
  { value: 'x_develop_serv',      label: 'X - Develop Serv' },
  { value: 'x_consulting',        label: 'X - Consulting' },
]

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
  const [sortBy, setSortBy] = useState<'commission_estimated' | 'created_at' | 'name' | 'address'>('created_at')
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    fetchDeals()
  }, [filter, tierFilter, sortBy])

  async function fetchDeals() {
    try {
      let query = supabase.from('deals').select('*')
      if (filter !== 'all') query = query.eq('status', filter)
      if (tierFilter !== 'all') query = query.eq('tier', tierFilter)
      query = query.order(sortBy, { ascending: sortBy === 'name' || sortBy === 'address' })
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
            <option value="address">Address A→Z</option>
            <option value="name">ID / Client A→Z</option>
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
                {['Address', 'ID / Client', 'Type', 'Status', 'Tier', 'Value', 'Commission', 'Source', 'Files', ''].map(h => (
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
                  <td colSpan={10} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    No deals match this filter. Add one above ↑
                  </td>
                </tr>
              ) : (
                deals.map((deal, i) => (
                  <DealRow
                    key={deal.id}
                    deal={deal}
                    isLast={i === deals.length - 1}
                    onUpdate={(updated) => setDeals(prev => prev.map(d => d.id === updated.id ? updated : d))}
                    onDelete={(id) => setDeals(prev => prev.filter(d => d.id !== id))}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Editable Deal Row ───────────────────────────────────────────────────────
const DELETE_PIN_HASH = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e' // SHA-256 of "1887"

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function DealRow({ deal, isLast, onUpdate, onDelete }: { deal: Deal; isLast: boolean; onUpdate: (d: Deal) => void; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(deal)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletePin, setDeletePin] = useState('')
  const [deleteError, setDeleteError] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(false)
    const hash = await sha256(deletePin)
    if (hash !== DELETE_PIN_HASH) {
      setDeleteError(true)
      setDeleting(false)
      return
    }
    try {
      await supabase.from('deals').delete().eq('id', deal.id)
      onDelete(deal.id)
    } catch {}
    setDeleting(false)
    setConfirmDelete(false)
  }

  async function save() {
    setSaving(true)
    try {
      await supabase.from('deals').update({
        name: draft.name,
        address: draft.address,
        type: draft.type,
        status: draft.status,
        tier: draft.tier,
        value: draft.value,
        commission_estimated: draft.commission_estimated,
        deal_source: draft.deal_source,
        dropbox_link: draft.dropbox_link,
      }).eq('id', deal.id)
      onUpdate(draft)
    } catch {}
    setSaving(false)
    setEditing(false)
  }

  const inp = (field: keyof Deal, placeholder?: string) => (
    <input
      value={(draft[field] as string) ?? ''}
      onChange={e => setDraft(prev => ({ ...prev, [field]: e.target.value }))}
      placeholder={placeholder}
      style={{ width: '100%', fontSize: 11, padding: '3px 6px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: 'var(--text-primary)', outline: 'none' }}
    />
  )

  const rowStyle: React.CSSProperties = {
    borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
    background: editing ? 'rgba(167,139,250,0.04)' : undefined,
    transition: 'background 0.1s',
  }

  if (editing) {
    return (
      <tr style={rowStyle}>
        <td style={{ padding: '6px 8px' }}>{inp('address', 'Address')}</td>
        <td style={{ padding: '6px 8px' }}>{inp('name', 'ID / Client')}</td>
        <td style={{ padding: '6px 8px' }}>
          <select value={draft.type} onChange={e => setDraft(p => ({ ...p, type: e.target.value as Deal['type'] }))} style={{ fontSize: 11, padding: '3px 4px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: 'var(--text-primary)' }}>
            {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </td>
        <td style={{ padding: '6px 8px' }}>
          <select value={draft.status} onChange={e => setDraft(p => ({ ...p, status: e.target.value as Deal['status'] }))} style={{ fontSize: 11, padding: '3px 4px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: 'var(--text-primary)' }}>
            {['pipeline','active','under_contract','pending_payment','closed','dead'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
          </select>
        </td>
        <td style={{ padding: '6px 8px' }}>
          <select value={draft.tier} onChange={e => setDraft(p => ({ ...p, tier: e.target.value as Deal['tier'] }))} style={{ fontSize: 11, padding: '3px 4px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: 'var(--text-primary)' }}>
            {['tracked','filed'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </td>
        <td style={{ padding: '6px 8px' }}>
          <input type="number" value={draft.value ?? ''} onChange={e => setDraft(p => ({ ...p, value: Number(e.target.value) || null }))} placeholder="Value" style={{ width: 80, fontSize: 11, padding: '3px 6px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: 'var(--text-primary)', outline: 'none' }} />
        </td>
        <td style={{ padding: '6px 8px' }}>
          <input type="number" value={draft.commission_estimated ?? ''} onChange={e => setDraft(p => ({ ...p, commission_estimated: Number(e.target.value) || null }))} placeholder="Commission" style={{ width: 90, fontSize: 11, padding: '3px 6px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: 'var(--text-primary)', outline: 'none' }} />
        </td>
        <td style={{ padding: '6px 8px' }}>{inp('deal_source', 'Source')}</td>
        <td style={{ padding: '6px 8px' }}>
          <input value={draft.dropbox_link ?? ''} onChange={e => setDraft(p => ({ ...p, dropbox_link: e.target.value || null }))} placeholder="Dropbox URL" style={{ width: 100, fontSize: 11, padding: '3px 6px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: 'var(--text-primary)', outline: 'none' }} />
        </td>
        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
          <button onClick={save} disabled={saving} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 5, color: '#A78BFA', cursor: 'pointer', marginRight: 4 }}>
            {saving ? '…' : '✓ Save'}
          </button>
          <button onClick={() => { setDraft(deal); setEditing(false) }} style={{ padding: '4px 8px', fontSize: 11, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
        </td>
      </tr>
    )
  }

  return (
    <tr style={rowStyle}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      onMouseLeave={e => (e.currentTarget.style.background = editing ? 'rgba(167,139,250,0.04)' : '')}
    >
      <td style={{ padding: '10px 10px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>{deal.address || '—'}</td>
      <td style={{ padding: '10px 10px', color: 'var(--text-muted)', fontSize: 12 }}>{deal.name}</td>
      <td style={{ padding: '10px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{DEAL_TYPES.find(t => t.value === deal.type)?.label ?? deal.type.replace(/_/g, ' ')}</td>
      <td style={{ padding: '10px 10px' }}>
        <span className={`badge ${STATUS_CLASS[deal.status as DealStatus]}`}>{STATUS_LABELS[deal.status as DealStatus]}</span>
      </td>
      <td style={{ padding: '10px 10px' }}>
        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: deal.tier === 'filed' ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.05)', color: deal.tier === 'filed' ? '#60A5FA' : 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {deal.tier}
        </span>
      </td>
      <td style={{ padding: '10px 10px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatCurrency(deal.value)}</td>
      <td style={{ padding: '10px 10px', color: 'var(--accent-gold)', fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatCurrency(deal.commission_estimated)}</td>
      <td style={{ padding: '10px 10px', color: 'var(--text-muted)', fontSize: 12 }}>{deal.deal_source || '—'}</td>
      <td style={{ padding: '10px 8px' }}>
        <DropboxCell dealId={deal.id} url={deal.dropbox_link} onSaved={(id, url) => onUpdate({ ...deal, dropbox_link: url })} />
      </td>
      <td style={{ padding: '10px 8px' }}>
        <button onClick={() => setEditing(true)} title="Edit row" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 5, background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12, marginRight: 4 }}>✎</button>
        <button onClick={() => { setConfirmDelete(true); setDeletePin(''); setDeleteError(false) }} title="Delete deal" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 5, background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.5)', cursor: 'pointer', fontSize: 12 }}>✕</button>
      </td>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <td colSpan={10} style={{ padding: 0 }}>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setConfirmDelete(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#13112A', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 14, padding: 28, minWidth: 300, maxWidth: 380 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0', marginBottom: 6 }}>Delete Deal?</div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
                <strong style={{ color: '#ccc' }}>{deal.address || deal.name}</strong> will be permanently deleted. Enter your PIN to confirm.
              </div>
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={deletePin}
                onChange={e => { setDeletePin(e.target.value); setDeleteError(false) }}
                onKeyDown={e => e.key === 'Enter' && deletePin.length === 4 && handleDelete()}
                placeholder="Enter PIN"
                style={{ width: '100%', fontSize: 20, textAlign: 'center', letterSpacing: '0.3em', padding: '10px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${deleteError ? '#ef4444' : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, color: '#f0f0f0', outline: 'none', marginBottom: 6, boxSizing: 'border-box' as const }}
              />
              {deleteError && <div style={{ color: '#ef4444', fontSize: 11, marginBottom: 10, textAlign: 'center' }}>Incorrect PIN</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, color: '#888', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button onClick={handleDelete} disabled={deletePin.length !== 4 || deleting} style={{ flex: 1, padding: '8px', background: deletePin.length === 4 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${deletePin.length === 4 ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 7, color: deletePin.length === 4 ? '#ef4444' : '#555', cursor: deletePin.length === 4 ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </td>
      )}
    </tr>
  )
}

// Quick add form
function AddDealForm({ onAdd }: { onAdd: (d: Deal) => void }) {
  const [form, setForm] = useState({ name: '', address: '', type: 'potential_listing', status: 'pipeline', tier: 'tracked', deal_source: '', isPortfolio: false })
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const { data } = await supabase.from('deals').insert({
        name: form.name.trim(),
        address: form.isPortfolio ? '!Portfolio' : (form.address || null),
        type: form.type,
        status: form.status,
        tier: form.tier,
        deal_source: form.deal_source || null,
        dropbox_link: null,
      }).select().single()
      if (data) onAdd(data as Deal)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(201,147,58,0.2)', borderRadius: 8, padding: 16, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {/* Address FIRST — left */}
      {form.isPortfolio ? (
        <div style={{ ...inputStyle, flex: '1 1 180px', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-gold)', fontWeight: 700, fontSize: 12 }}>
          📁 Portfolio of Properties
        </div>
      ) : (
        <input placeholder="Address *" value={form.address} onChange={e => setForm({...form, address: e.target.value})} style={{...inputStyle, flex: '1 1 180px'}} />
      )}
      {/* ID / Client */}
      <input placeholder="ID / Client *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{...inputStyle, flex: '1 1 180px'}} />
      {/* Portfolio toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
        <input type="checkbox" checked={form.isPortfolio} onChange={e => setForm({...form, isPortfolio: e.target.checked, address: ''})}
          style={{ width: 14, height: 14, accentColor: 'var(--accent-gold)', cursor: 'pointer' }} />
        !Portfolio
      </label>
      <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} style={{...selectStyle, flex: '1 1 120px'}}>
        {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <select value={form.tier} onChange={e => setForm({...form, tier: e.target.value})} style={{...selectStyle, flex: '1 1 100px'}}>
        <option value="tracked">Tracked</option>
        <option value="filed">Filed</option>
      </select>
      <input placeholder="Source (referral, cold call...)" value={form.deal_source} onChange={e => setForm({...form, deal_source: e.target.value})} style={{...inputStyle, flex: '1 1 160px'}} />
      <button onClick={submit} disabled={saving || !form.name.trim()} style={{ padding: '7px 16px', background: 'var(--accent-gold)', color: '#0D0F14', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (!form.name.trim() || saving) ? 0.5 : 1 }}>
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
    type: 'active_listing', status: 'under_contract', tier: 'filed',
    value: 1200000, commission_rate: 0.06, commission_estimated: 72000, commission_collected: 0,
    deal_source: 'Referral', notes: null, dropbox_link: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'p2', name: 'French Truck Coffee — BR', address: null,
    type: 'tenant', status: 'active', tier: 'tracked',
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

function DropboxCell({ dealId, url, onSaved }: { dealId: string; url: string | null | undefined; onSaved: (id: string, url: string | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(url || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const val = draft.trim() || null
    try {
      await supabase.from('deals').update({ dropbox_link: val }).eq('id', dealId)
      onSaved(dealId, val)
    } catch {}
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 200 }} onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          placeholder="Paste Dropbox link..."
          style={{
            flex: 1, fontSize: 11, padding: '4px 8px',
            background: 'var(--bg-elevated)', border: '1px solid rgba(0,97,255,0.4)',
            borderRadius: 5, color: 'var(--text-primary)', outline: 'none', minWidth: 0,
          }}
        />
        <button onClick={save} disabled={saving} style={{ padding: '4px 8px', fontSize: 11, fontWeight: 700, background: 'rgba(0,97,255,0.2)', border: '1px solid rgba(0,97,255,0.4)', borderRadius: 5, color: '#4F8EF7', cursor: 'pointer' }}>
          {saving ? '…' : '✓'}
        </button>
        <button onClick={() => setEditing(false)} style={{ padding: '4px 6px', fontSize: 11, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
      <a
        href={url || DROPBOX_FALLBACK}
        target="_blank"
        rel="noopener noreferrer"
        title={url ? 'Open deal folder' : 'Open Active Listings folder (no deal link set)'}
        onClick={e => e.stopPropagation()}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 6,
          background: url ? 'rgba(0,97,255,0.12)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${url ? 'rgba(0,97,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
          color: url ? '#4F8EF7' : 'var(--text-dim)',
          textDecoration: 'none', transition: 'all 0.15s',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L6 6.5L12 11L18 6.5L12 2ZM6 6.5L0 11L6 15.5L12 11L6 6.5ZM18 6.5L12 11L18 15.5L24 11L18 6.5ZM6 15.5L12 20L18 15.5L12 11L6 15.5Z"/>
        </svg>
      </a>
      <button
        onClick={() => { setDraft(url || ''); setEditing(true) }}
        title="Edit Dropbox link"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 5,
          background: 'transparent', border: '1px solid rgba(255,255,255,0.07)',
          color: 'var(--text-dim)', cursor: 'pointer', fontSize: 10, transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text-dim)' }}
      >
        ✎
      </button>
    </div>
  )
}

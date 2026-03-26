'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, Deal, DealStatus, DealTier, DealType, ContractDeadline, DeadlineType, DeadlineStatus } from '@/lib/supabase'
import { Suspense } from 'react'

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<DealStatus, string> = {
  active: 'Active',
  in_review: 'In Review',
  pipeline: 'Pipeline',
  in_service: 'In Service',
  under_contract: 'Under Contract',
  pending_payment: 'Pending Pmt',
  closed: 'Closed',
  expired: 'Expired',
  dormant: 'Dormant',
  terminated: 'Terminated',
}

const STATUS_COLORS: Record<DealStatus, { bg: string; text: string; border: string }> = {
  active:           { bg: 'rgba(34,197,94,0.15)',   text: '#22c55e', border: 'rgba(34,197,94,0.4)' },
  in_review:        { bg: 'rgba(251,191,36,0.15)',  text: '#fbbf24', border: 'rgba(251,191,36,0.4)' },
  pipeline:         { bg: 'rgba(79,142,247,0.15)',  text: '#4F8EF7', border: 'rgba(79,142,247,0.4)' },
  in_service:       { bg: 'rgba(45,212,191,0.15)',  text: '#2dd4bf', border: 'rgba(45,212,191,0.4)' },
  under_contract:   { bg: 'rgba(45,212,191,0.15)',  text: '#2dd4bf', border: 'rgba(45,212,191,0.4)' },
  pending_payment:  { bg: 'rgba(251,191,36,0.15)',  text: '#fbbf24', border: 'rgba(251,191,36,0.4)' },
  closed:           { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af', border: 'rgba(107,114,128,0.4)' },
  expired:          { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  dormant:          { bg: 'rgba(107,114,128,0.12)', text: '#6b7280', border: 'rgba(107,114,128,0.3)' },
  terminated:       { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
}

const DEAL_TYPES: { value: string; label: string }[] = [
  { value: 'potential_listing',  label: 'Potential Listing' },
  { value: 'active_listing',     label: 'Active Listing' },
  { value: 'landlord',           label: 'Landlord' },
  { value: 'seller',             label: 'Seller' },
  { value: 'tenant',             label: 'Tenant' },
  { value: 'buyer',              label: 'Buyer' },
  { value: 'referral',           label: 'Referral' },
  { value: 'x_develop_serv',     label: 'X - Develop Serv' },
  { value: 'x_consulting',       label: 'X - Consulting' },
  { value: 'lease',              label: 'Lease' },
  { value: 'listing',            label: 'Listing' },
  { value: 'buyer_rep',          label: 'Buyer Rep' },
  { value: 'tenant_rep',         label: 'Tenant Rep' },
  { value: 'landlord_rep',       label: 'Landlord Rep' },
  { value: 'consulting',         label: 'Consulting' },
  { value: 'other',              label: 'Other' },
]

const DEADLINE_TYPE_COLORS: Record<DeadlineType, { bg: string; text: string; label: string }> = {
  inspection: { bg: 'rgba(251,146,60,0.15)',  text: '#fb923c', label: 'Inspection' },
  financing:  { bg: 'rgba(79,142,247,0.15)',  text: '#4F8EF7', label: 'Financing' },
  appraisal:  { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa', label: 'Appraisal' },
  title:      { bg: 'rgba(45,212,191,0.15)',  text: '#2dd4bf', label: 'Title' },
  survey:     { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af', label: 'Survey' },
  closing:    { bg: 'rgba(251,191,36,0.15)',  text: '#fbbf24', label: 'Closing' },
  custom:     { bg: 'rgba(107,114,128,0.12)', text: '#6b7280', label: 'Custom' },
}

const DEADLINE_STATUS_STYLES: Record<DeadlineStatus, { bg: string; text: string; label: string }> = {
  pending:   { bg: 'rgba(79,142,247,0.15)',  text: '#4F8EF7', label: 'Pending' },
  satisfied: { bg: 'rgba(34,197,94,0.15)',   text: '#22c55e', label: 'Satisfied' },
  extended:  { bg: 'rgba(251,146,60,0.15)',  text: '#fb923c', label: 'Extended' },
  missed:    { bg: 'rgba(239,68,68,0.15)',   text: '#ef4444', label: 'Missed' },
}

const PIN_HASH = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function formatCurrency(n: number | null | undefined): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.floor((target.getTime() - now.getTime()) / 86400000)
}

function getDaysColor(days: number, status: DeadlineStatus): string {
  if (status === 'satisfied') return '#6b7280'
  if (days <= 1) return '#ef4444'
  if (days <= 7) return '#fb923c'
  return '#22c55e'
}

function typeLabel(type: string): string {
  return DEAL_TYPES.find(t => t.value === type)?.label ?? type
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: '#1A1E25',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  padding: '18px 20px',
  marginBottom: 16,
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#6b7280',
  marginBottom: 4,
}

const valueStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#F0F2FF',
  fontWeight: 500,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  padding: '7px 10px',
  fontSize: 13,
  color: '#F0F2FF',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const btnStyle = (color: string, bg: string, border: string): React.CSSProperties => ({
  padding: '7px 16px',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.06em',
  background: bg,
  border: `1px solid ${border}`,
  borderRadius: 8,
  color,
  cursor: 'pointer',
  transition: 'opacity 0.15s',
  fontFamily: 'inherit',
})

// ─── PIN Modal ───────────────────────────────────────────────────────────────

function PinModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  const [checking, setChecking] = useState(false)

  async function check() {
    setChecking(true)
    const hash = await sha256(pin)
    if (hash === PIN_HASH) {
      onConfirm()
    } else {
      setErr(true)
      setPin('')
    }
    setChecking(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1A1E25',
        border: '1px solid rgba(232,184,75,0.3)',
        borderRadius: 14,
        padding: '28px 32px',
        width: 300,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#E8B84B', marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Authorization Required
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>Enter PIN to continue</div>
        <input
          type="password"
          value={pin}
          onChange={e => { setPin(e.target.value); setErr(false) }}
          onKeyDown={e => e.key === 'Enter' && check()}
          placeholder="PIN"
          autoFocus
          style={{ ...inputStyle, textAlign: 'center', fontSize: 20, letterSpacing: '0.3em', marginBottom: 12 }}
        />
        {err && <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 10 }}>Incorrect PIN</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onCancel} style={btnStyle('#9ca3af', 'transparent', 'rgba(156,163,175,0.3)')}>
            Cancel
          </button>
          <button onClick={check} disabled={checking || pin.length === 0} style={btnStyle('#000', '#E8B84B', '#E8B84B')}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ padding: 32 }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      {[['60%', 28], ['35%', 18]].map(([w, h], i) => (
        <div key={i} style={{ width: w as string, height: h as number, borderRadius: 6, background: 'rgba(255,255,255,0.07)', marginBottom: 10, animation: 'pulse 1.6s ease-in-out infinite' }} />
      ))}
      <div style={{ marginTop: 32 }}>
        {[['100%', 120], ['100%', 80]].map(([w, h], i) => (
          <div key={i} style={{ width: w as string, height: h as number, borderRadius: 8, background: 'rgba(255,255,255,0.07)', marginBottom: 12, animation: 'pulse 1.6s ease-in-out infinite' }} />
        ))}
      </div>
    </div>
  )
}

// ─── Inner component (needs useSearchParams) ─────────────────────────────────

function DealDashboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dealId = searchParams.get('id')

  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Deal>>({})
  const [saving, setSaving] = useState(false)

  // Deadlines
  const [deadlines, setDeadlines] = useState<ContractDeadline[]>([])
  const [showAddDeadline, setShowAddDeadline] = useState(false)
  const [newDeadline, setNewDeadline] = useState({
    label: '', deadline_date: '', deadline_type: 'inspection' as DeadlineType, notes: '',
  })
  const [addingDeadline, setAddingDeadline] = useState(false)

  // Dropbox editing
  const [editingDropbox, setEditingDropbox] = useState(false)
  const [dropboxInput, setDropboxInput] = useState('')
  const [savingDropbox, setSavingDropbox] = useState(false)

  // PIN modal for destructive actions
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null)

  // Load deal
  const loadDeal = useCallback(async () => {
    if (!dealId) { setNotFound(true); setLoading(false); return }
    const { data, error } = await supabase.from('deals').select('*').eq('id', dealId).single()
    if (error || !data) {
      setNotFound(true)
    } else {
      setDeal(data as Deal)
      setDropboxInput((data as Deal).dropbox_link ?? '')
    }
    setLoading(false)
  }, [dealId])

  // Load deadlines
  const loadDeadlines = useCallback(async () => {
    if (!dealId) return
    const { data } = await supabase
      .from('contract_deadlines')
      .select('*')
      .eq('deal_id', dealId)
      .order('deadline_date', { ascending: true })
    if (data) setDeadlines(data as ContractDeadline[])
  }, [dealId])

  useEffect(() => { loadDeal() }, [loadDeal])
  useEffect(() => { if (deal?.status === 'under_contract') loadDeadlines() }, [deal, loadDeadlines])

  // ── Edit handlers ──

  function startEdit() {
    if (!deal) return
    setEditForm({
      address: deal.address ?? '',
      name: deal.name ?? '',
      type: deal.type,
      status: deal.status,
      tier: deal.tier,
      value: deal.value,
      commission_estimated: deal.commission_estimated,
      commission_collected: deal.commission_collected,
      deal_source: deal.deal_source ?? '',
      notes: deal.notes ?? '',
    })
    setEditing(true)
  }

  async function saveEdit() {
    if (!deal) return
    setSaving(true)
    const { data, error } = await supabase
      .from('deals')
      .update({ ...editForm, updated_at: new Date().toISOString() })
      .eq('id', deal.id)
      .select()
      .single()
    if (!error && data) {
      setDeal(data as Deal)
      setEditing(false)
    }
    setSaving(false)
  }

  async function saveDropbox() {
    if (!deal) return
    setSavingDropbox(true)
    const { data, error } = await supabase
      .from('deals')
      .update({ dropbox_link: dropboxInput || null, updated_at: new Date().toISOString() })
      .eq('id', deal.id)
      .select()
      .single()
    if (!error && data) {
      setDeal(data as Deal)
      setEditingDropbox(false)
    }
    setSavingDropbox(false)
  }

  // ── Deadline handlers ──

  async function addDeadline() {
    if (!newDeadline.label || !newDeadline.deadline_date || !dealId) return
    setAddingDeadline(true)
    const { data } = await supabase.from('contract_deadlines').insert({
      deal_id: dealId,
      label: newDeadline.label,
      deadline_date: newDeadline.deadline_date,
      deadline_type: newDeadline.deadline_type,
      notes: newDeadline.notes || null,
      status: 'pending',
    }).select().single()
    if (data) setDeadlines(d => [...d, data as ContractDeadline])
    setNewDeadline({ label: '', deadline_date: '', deadline_type: 'inspection', notes: '' })
    setShowAddDeadline(false)
    setAddingDeadline(false)
  }

  async function satisfyDeadline(id: string) {
    await supabase.from('contract_deadlines').update({ status: 'satisfied', updated_at: new Date().toISOString() }).eq('id', id)
    setDeadlines(d => d.map(x => x.id === id ? { ...x, status: 'satisfied' as DeadlineStatus } : x))
  }

  async function deleteDeadline(id: string) {
    await supabase.from('contract_deadlines').delete().eq('id', id)
    setDeadlines(d => d.filter(x => x.id !== id))
  }

  // ── Quick Actions ──

  async function doStatusChange(newStatus: DealStatus) {
    if (!deal) return
    const { data, error } = await supabase
      .from('deals')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', deal.id)
      .select()
      .single()
    if (!error && data) setDeal(data as Deal)
  }

  function pinGate(action: () => void) {
    setPendingAction(() => action)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0F1318', color: '#F0F2FF' }}>
      <Skeleton />
    </div>
  )

  if (notFound) return (
    <div style={{
      minHeight: '100vh', background: '#0F1318', color: '#F0F2FF',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <div style={{ fontSize: 48, opacity: 0.3 }}>404</div>
      <div style={{ fontSize: 16, color: '#6b7280' }}>Deal not found</div>
      <button onClick={() => router.push('/warroom')} style={btnStyle('#E8B84B', 'rgba(232,184,75,0.1)', 'rgba(232,184,75,0.4)')}>
        ← Back to Pipeline
      </button>
    </div>
  )

  if (!deal) return null

  const sc = STATUS_COLORS[deal.status]

  // Build quick actions
  type QAction = { label: string; color: string; bg: string; border: string; action: () => void }
  const quickActions: QAction[] = []
  if (deal.tier === 'filed' && deal.status === 'active') {
    quickActions.push({
      label: '→ Under Contract',
      color: '#2dd4bf', bg: 'rgba(45,212,191,0.1)', border: 'rgba(45,212,191,0.4)',
      action: () => pinGate(() => doStatusChange('under_contract')),
    })
  }
  if (deal.tier === 'filed' && deal.type === 'active_listing' && deal.status === 'active') {
    quickActions.push({
      label: 'Expire',
      color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.4)',
      action: () => pinGate(() => doStatusChange('expired')),
    })
  }
  if (deal.tier === 'filed' && deal.type !== 'active_listing' && deal.status === 'active') {
    quickActions.push({
      label: 'Dormant',
      color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.4)',
      action: () => pinGate(() => doStatusChange('dormant')),
    })
  }
  if (deal.tier === 'filed' && deal.dropbox_link && ['active', 'under_contract'].includes(deal.status)) {
    quickActions.push({
      label: 'Terminate',
      color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.35)',
      action: () => pinGate(() => doStatusChange('terminated')),
    })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F1318',
      color: '#F0F2FF',
      fontFamily: 'var(--font-body, system-ui, sans-serif)',
    }}>

      {/* PIN modal */}
      {pendingAction && (
        <PinModal
          onConfirm={() => { pendingAction!(); setPendingAction(null) }}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {/* ── Header ── */}
      <header style={{
        background: '#13171D',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        {/* Back */}
        <button
          onClick={() => router.push('/warroom')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '6px 14px',
            color: '#9ca3af',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.06em',
            flexShrink: 0,
            fontFamily: 'inherit',
          }}
        >
          ← Pipeline
        </button>

        {/* Address */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{
            fontSize: 'clamp(16px, 2.5vw, 22px)',
            fontWeight: 800,
            color: '#F0F2FF',
            lineHeight: 1.2,
          }}>
            {deal.address || deal.name}
          </div>
          {deal.name && deal.address && (
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{deal.name}</div>
          )}
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
          }}>
            {STATUS_LABELS[deal.status]}
          </span>
          <span style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            background: deal.tier === 'filed' ? 'rgba(232,184,75,0.12)' : 'rgba(107,114,128,0.12)',
            color: deal.tier === 'filed' ? '#E8B84B' : '#9ca3af',
            border: `1px solid ${deal.tier === 'filed' ? 'rgba(232,184,75,0.35)' : 'rgba(107,114,128,0.3)'}`,
          }}>
            {deal.tier === 'filed' ? '★ Filed' : 'Tracked'}
          </span>
          <span style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            color: '#9ca3af', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {typeLabel(deal.type)}
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{
        display: 'flex',
        gap: 20,
        padding: '24px',
        maxWidth: 1400,
        margin: '0 auto',
        alignItems: 'flex-start',
      }}>

        {/* ── LEFT COLUMN (60%) ── */}
        <div style={{ flex: '0 0 60%', minWidth: 0 }}>

          {/* Deal Info Card */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#E8B84B', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Deal Info
              </span>
              {!editing ? (
                <button onClick={startEdit} style={btnStyle('#E8B84B', 'rgba(232,184,75,0.1)', 'rgba(232,184,75,0.35)')}>
                  Edit
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditing(false)} style={btnStyle('#9ca3af', 'transparent', 'rgba(156,163,175,0.3)')}>
                    Cancel
                  </button>
                  <button onClick={saveEdit} disabled={saving} style={btnStyle('#000', '#E8B84B', '#E8B84B')}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
              {/* Address */}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={labelStyle}>Address</div>
                {editing ? (
                  <input style={inputStyle} value={(editForm.address as string) ?? ''} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
                ) : (
                  <div style={valueStyle}>{deal.address || '—'}</div>
                )}
              </div>

              {/* Client Name */}
              <div>
                <div style={labelStyle}>Client</div>
                {editing ? (
                  <input style={inputStyle} value={(editForm.name as string) ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                ) : (
                  <div style={valueStyle}>{deal.name || '—'}</div>
                )}
              </div>

              {/* Type */}
              <div>
                <div style={labelStyle}>Type</div>
                {editing ? (
                  <select style={inputStyle} value={(editForm.type as string) ?? deal.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value as DealType }))}>
                    {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                ) : (
                  <div style={valueStyle}>{typeLabel(deal.type)}</div>
                )}
              </div>

              {/* Status */}
              <div>
                <div style={labelStyle}>Status</div>
                {editing ? (
                  <select style={inputStyle} value={(editForm.status as string) ?? deal.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as DealStatus }))}>
                    {(Object.keys(STATUS_LABELS) as DealStatus[]).map(s => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                ) : (
                  <div style={valueStyle}>{STATUS_LABELS[deal.status]}</div>
                )}
              </div>

              {/* Tier */}
              <div>
                <div style={labelStyle}>Tier</div>
                {editing ? (
                  <select style={inputStyle} value={(editForm.tier as string) ?? deal.tier} onChange={e => setEditForm(f => ({ ...f, tier: e.target.value as DealTier }))}>
                    <option value="tracked">Tracked</option>
                    <option value="filed">Filed</option>
                  </select>
                ) : (
                  <div style={valueStyle}>{deal.tier === 'filed' ? '★ Filed' : 'Tracked'}</div>
                )}
              </div>

              {/* Value */}
              <div>
                <div style={labelStyle}>Deal Value</div>
                {editing ? (
                  <input type="number" style={inputStyle} value={editForm.value ?? ''} onChange={e => setEditForm(f => ({ ...f, value: e.target.value ? Number(e.target.value) : null }))} placeholder="0" />
                ) : (
                  <div style={{ ...valueStyle, color: '#E8B84B', fontFamily: 'monospace' }}>{formatCurrency(deal.value)}</div>
                )}
              </div>

              {/* Commission Estimated */}
              <div>
                <div style={labelStyle}>Est. Commission</div>
                {editing ? (
                  <input type="number" style={inputStyle} value={editForm.commission_estimated ?? ''} onChange={e => setEditForm(f => ({ ...f, commission_estimated: e.target.value ? Number(e.target.value) : null }))} placeholder="0" />
                ) : (
                  <div style={{ ...valueStyle, fontFamily: 'monospace' }}>{formatCurrency(deal.commission_estimated)}</div>
                )}
              </div>

              {/* Commission Collected */}
              <div>
                <div style={labelStyle}>Collected</div>
                {editing ? (
                  <input type="number" style={inputStyle} value={editForm.commission_collected ?? ''} onChange={e => setEditForm(f => ({ ...f, commission_collected: e.target.value ? Number(e.target.value) : null }))} placeholder="0" />
                ) : (
                  <div style={{ ...valueStyle, color: '#22c55e', fontFamily: 'monospace' }}>{formatCurrency(deal.commission_collected)}</div>
                )}
              </div>

              {/* Deal Source */}
              <div>
                <div style={labelStyle}>Source</div>
                {editing ? (
                  <input style={inputStyle} value={(editForm.deal_source as string) ?? ''} onChange={e => setEditForm(f => ({ ...f, deal_source: e.target.value }))} placeholder="Referral, cold call, etc." />
                ) : (
                  <div style={valueStyle}>{deal.deal_source || '—'}</div>
                )}
              </div>

              {/* Notes */}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={labelStyle}>Notes</div>
                {editing ? (
                  <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={(editForm.notes as string) ?? ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Deal notes…" />
                ) : (
                  <div style={{ ...valueStyle, whiteSpace: 'pre-wrap', color: deal.notes ? '#F0F2FF' : '#6b7280' }}>
                    {deal.notes || 'No notes'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Activity Log Card */}
          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#E8B84B', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
              Activity Log
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 10 }}>
              <div style={{ fontSize: 28, opacity: 0.25 }}>📋</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Activity log coming soon</div>
              <div style={{ fontSize: 11, color: '#4b5563' }}>All deal activity will be tracked here</div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (40%) ── */}
        <div style={{ flex: '0 0 40%', minWidth: 0 }}>

          {/* Dropbox Card */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#E8B84B', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Dropbox
              </span>
              {!editingDropbox ? (
                <button onClick={() => setEditingDropbox(true)} style={btnStyle('#E8B84B', 'rgba(232,184,75,0.1)', 'rgba(232,184,75,0.35)')}>
                  Edit Link
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setEditingDropbox(false); setDropboxInput(deal.dropbox_link ?? '') }} style={btnStyle('#9ca3af', 'transparent', 'rgba(156,163,175,0.3)')}>
                    Cancel
                  </button>
                  <button onClick={saveDropbox} disabled={savingDropbox} style={btnStyle('#000', '#E8B84B', '#E8B84B')}>
                    {savingDropbox ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {editingDropbox ? (
              <input style={inputStyle} value={dropboxInput} onChange={e => setDropboxInput(e.target.value)} placeholder="https://www.dropbox.com/..." />
            ) : deal.dropbox_link ? (
              <a
                href={deal.dropbox_link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px',
                  background: 'rgba(45,212,191,0.07)',
                  border: '1px solid rgba(45,212,191,0.25)',
                  borderRadius: 8,
                  color: '#2dd4bf',
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: 500,
                  wordBreak: 'break-all',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Open Folder
              </a>
            ) : (
              <div style={{ fontSize: 13, color: '#4b5563', fontStyle: 'italic' }}>No Dropbox link set</div>
            )}
          </div>

          {/* Deadlines Card — only if under_contract */}
          {deal.status === 'under_contract' && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#E8B84B', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Contract Deadlines
                </span>
                <button onClick={() => setShowAddDeadline(s => !s)} style={btnStyle('#2dd4bf', 'rgba(45,212,191,0.08)', 'rgba(45,212,191,0.35)')}>
                  + Add
                </button>
              </div>

              {showAddDeadline && (
                <div style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, padding: 14, marginBottom: 14,
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <input style={inputStyle} value={newDeadline.label} onChange={e => setNewDeadline(d => ({ ...d, label: e.target.value }))} placeholder="Label (e.g. Inspection)" />
                  <input type="date" style={inputStyle} value={newDeadline.deadline_date} onChange={e => setNewDeadline(d => ({ ...d, deadline_date: e.target.value }))} />
                  <select style={inputStyle} value={newDeadline.deadline_type} onChange={e => setNewDeadline(d => ({ ...d, deadline_type: e.target.value as DeadlineType }))}>
                    {(Object.keys(DEADLINE_TYPE_COLORS) as DeadlineType[]).map(t => (
                      <option key={t} value={t}>{DEADLINE_TYPE_COLORS[t].label}</option>
                    ))}
                  </select>
                  <input style={inputStyle} value={newDeadline.notes} onChange={e => setNewDeadline(d => ({ ...d, notes: e.target.value }))} placeholder="Notes (optional)" />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowAddDeadline(false)} style={btnStyle('#9ca3af', 'transparent', 'rgba(156,163,175,0.3)')}>Cancel</button>
                    <button onClick={addDeadline} disabled={addingDeadline || !newDeadline.label || !newDeadline.deadline_date} style={btnStyle('#000', '#2dd4bf', '#2dd4bf')}>
                      {addingDeadline ? 'Adding…' : 'Add Deadline'}
                    </button>
                  </div>
                </div>
              )}

              {deadlines.length === 0 ? (
                <div style={{ fontSize: 12, color: '#4b5563', textAlign: 'center', padding: '16px 0' }}>No deadlines yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {deadlines.map(dl => {
                    const days = daysUntil(dl.deadline_date)
                    const satisfied = dl.status === 'satisfied'
                    const typeInfo = DEADLINE_TYPE_COLORS[dl.deadline_type]
                    const statusInfo = DEADLINE_STATUS_STYLES[dl.status]
                    return (
                      <div key={dl.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: 7,
                        opacity: satisfied ? 0.6 : 1,
                      }}>
                        <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: satisfied ? '#6b7280' : '#F0F2FF', textDecoration: satisfied ? 'line-through' : 'none', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dl.label}
                        </div>
                        <span style={{ padding: '1px 6px', borderRadius: 20, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', background: typeInfo.bg, color: typeInfo.text, flexShrink: 0 }}>
                          {typeInfo.label}
                        </span>
                        <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', flexShrink: 0 }}>
                          {formatDate(dl.deadline_date)}
                        </span>
                        {!satisfied && (
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: getDaysColor(days, dl.status), flexShrink: 0 }}>
                            {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'Today' : `${days}d`}
                          </span>
                        )}
                        <span style={{ padding: '1px 6px', borderRadius: 20, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', background: statusInfo.bg, color: statusInfo.text, flexShrink: 0 }}>
                          {statusInfo.label}
                        </span>
                        {!satisfied && (
                          <button onClick={() => satisfyDeadline(dl.id)} title="Satisfy" style={{ padding: '2px 7px', fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 5, color: '#22c55e', cursor: 'pointer' }}>✓</button>
                        )}
                        <button onClick={() => deleteDeadline(dl.id)} title="Delete" style={{ padding: '2px 7px', fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 5, color: '#ef4444', cursor: 'pointer' }}>✕</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Quick Actions Card */}
          {quickActions.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#E8B84B', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
                Quick Actions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {quickActions.map((qa, i) => (
                  <button
                    key={i}
                    onClick={qa.action}
                    style={{ ...btnStyle(qa.color, qa.bg, qa.border), width: '100%', padding: '11px 16px', fontSize: 13, textAlign: 'left' }}
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div style={{ ...cardStyle, background: 'transparent', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4b5563', marginBottom: 10 }}>
              Metadata
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: '#6b7280' }}>Deal ID</span>
                <span style={{ color: '#4b5563', fontFamily: 'monospace', fontSize: 10 }}>{deal.id.slice(0, 8)}…</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: '#6b7280' }}>Created</span>
                <span style={{ color: '#9ca3af' }}>{new Date(deal.created_at).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: '#6b7280' }}>Updated</span>
                <span style={{ color: '#9ca3af' }}>{new Date(deal.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function DealDashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0F1318', color: '#F0F2FF' }}>
        <div style={{ padding: 32 }}>
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
          <div style={{ width: '60%', height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.07)', marginBottom: 10, animation: 'pulse 1.6s ease-in-out infinite' }} />
        </div>
      </div>
    }>
      <DealDashboardInner />
    </Suspense>
  )
}

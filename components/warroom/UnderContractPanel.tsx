'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatAddress } from '@/lib/formatAddress'
import { createPortal } from 'react-dom'
import { supabase, Deal, ContractDeadline, DeadlineType, DeadlineStatus, DealType } from '@/lib/supabase'
import SectionHeader from '@/components/warroom/SectionHeader'

interface ContractDeal extends Deal {
  days_since_contract?: number
}

function daysDiff(from: string) {
  return Math.floor((Date.now() - new Date(from).getTime()) / 86400000)
}

function formatCurrency(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.floor((target.getTime() - now.getTime()) / 86400000)
}

// Sparkline helpers
function generateSparkline(seed: number, count = 14): number[] {
  const pts: number[] = []
  let val = 35 + (seed % 40)
  for (let i = 0; i < count; i++) {
    val += ((seed * (i + 3) * 6257) % 19) - 8
    val = Math.max(8, Math.min(92, val))
    pts.push(val)
  }
  return pts
}

function buildSparkPaths(values: number[], w: number, h: number) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: h - ((v - min) / range) * (h * 0.82) - h * 0.05,
  }))
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`
  return { linePath, areaPath }
}

// Stage badge colors
const TYPE_COLORS: Record<DeadlineType, { bg: string; text: string; label: string }> = {
  inspection:       { bg: 'rgba(251,146,60,0.15)',  text: '#fb923c', label: 'Inspection' },
  financing:        { bg: 'rgba(79,142,247,0.15)',  text: '#4F8EF7', label: 'Financing' },
  appraisal:        { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa', label: 'Appraisal' },
  title:            { bg: 'rgba(45,212,191,0.15)',  text: '#2dd4bf', label: 'Title' },
  survey:           { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af', label: 'Survey' },
  closing:          { bg: 'rgba(251,191,36,0.15)',  text: '#fbbf24', label: 'Closing' },
  custom:           { bg: 'rgba(107,114,128,0.12)', text: '#6b7280', label: 'Custom' },
  contingency:      { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', label: 'Contingency' },
  psa_review:       { bg: 'rgba(139,92,246,0.15)',  text: '#a78bfa', label: 'PSA Review' },
  lease_review:     { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', label: 'Lease Review' },
  psa_draft:        { bg: 'rgba(139,92,246,0.10)',  text: '#c4b5fd', label: 'PSA Draft' },
  lease_draft:      { bg: 'rgba(59,130,246,0.10)',  text: '#93c5fd', label: 'Lease Draft' },
  lease_execution:  { bg: 'rgba(45,212,191,0.12)',  text: '#2dd4bf', label: 'Lease Execution' },
  lease_deliverables:{ bg: 'rgba(34,197,94,0.12)',  text: '#22c55e', label: 'Lease Deliverables' },
}

const STATUS_STYLES: Record<DeadlineStatus, { bg: string; text: string; label: string }> = {
  pending:   { bg: 'rgba(79,142,247,0.15)', text: '#4F8EF7', label: 'Pending' },
  satisfied: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', label: 'Satisfied' },
  extended:  { bg: 'rgba(251,146,60,0.15)', text: '#fb923c', label: 'Extended' },
  missed:    { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', label: 'Missed' },
}

function getDaysColor(days: number, status: DeadlineStatus): string {
  if (status === 'satisfied') return 'var(--text-dim)'
  if (days < 0) return '#ef4444'
  if (days <= 2) return '#ef4444'
  if (days <= 7) return '#fb923c'
  return '#4F8EF7'
}

// ─── Deadline Row ────────────────────────────────────────────────────────────

interface DeadlineRowProps {
  deadline: ContractDeadline
  onSatisfy: (id: string) => void
  onUndo: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (deadline: ContractDeadline) => void
}

function DeadlineRow({ deadline, onSatisfy, onUndo, onDelete, onEdit }: DeadlineRowProps) {
  const days = daysUntil(deadline.deadline_date)
  const satisfied = deadline.status === 'satisfied'
  const typeInfo = TYPE_COLORS[deadline.deadline_type]
  const statusInfo = STATUS_STYLES[deadline.status]

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '7px 12px',
      borderRadius: 6,
      background: 'rgba(255,255,255,0.02)',
      marginBottom: 4,
      opacity: satisfied ? 0.6 : 1,
    }}>
      {/* Label */}
      <div style={{ flex: '0 0 160px', minWidth: 0 }}>
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          textDecoration: satisfied ? 'line-through' : 'none',
          color: satisfied ? 'var(--text-dim)' : 'var(--text-primary)',
        } as React.CSSProperties}>
          {deadline.label}
        </span>
      </div>

      {/* Stage badge */}
      <div style={{ flex: '0 0 130px' }}>
        {deadline.deadline_type !== 'closing' && (
          <span style={{
            display: 'inline-block',
            padding: '1px 7px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            background: typeInfo.bg,
            color: typeInfo.text,
          }}>
            {typeInfo.label}
          </span>
        )}
        {deadline.deadline_type === 'closing' && <span />}
      </div>

      {/* Date */}
      <div style={{ flex: '0 0 60px', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
        {formatDate(deadline.deadline_date)}
      </div>

      {/* Days remaining */}
      <div style={{ flex: '0 0 70px', textAlign: 'right' }}>
        {satisfied ? (
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>—</span>
        ) : (
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: getDaysColor(days, deadline.status),
          }}>
            {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'Today' : `${days}d`}
          </span>
        )}
      </div>

      {/* Status badge */}
      <div style={{ flex: '0 0 70px' }}>
        <span style={{
          display: 'inline-block',
          padding: '1px 7px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          background: statusInfo.bg,
          color: statusInfo.text,
        }}>
          {statusInfo.label}
        </span>
      </div>

      {/* Notes */}
      {deadline.notes && (
        <div style={{ flex: 1, fontSize: 10, color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {deadline.notes}
        </div>
      )}
      {!deadline.notes && <div style={{ flex: 1 }} />}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {!satisfied && (
          <button
            onClick={() => onSatisfy(deadline.id)}
            title="Mark Satisfied"
            style={{
              padding: '3px 8px', fontSize: 11, fontWeight: 700,
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 5, color: '#22c55e', cursor: 'pointer',
            }}>
            ✓
          </button>
        )}
        {satisfied && (
          <button
            onClick={() => onUndo(deadline.id)}
            title="Revert to Pending"
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
              borderRadius: 5, color: '#fbbf24', cursor: 'pointer', fontSize: 14, fontWeight: 700,
            }}
          >↩</button>
        )}
        <button
          onClick={() => onEdit(deadline)}
          title="Edit"
          style={{
            padding: '3px 7px', fontSize: 11,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 5, color: 'var(--text-dim)', cursor: 'pointer',
          }}>
          ✎
        </button>
        <button
          onClick={() => onDelete(deadline.id)}
          title="Delete"
          style={{
            padding: '3px 7px', fontSize: 11,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 5, color: 'var(--text-dim)', cursor: 'pointer',
          }}>
          ✕
        </button>
      </div>
    </div>
  )
}

// ─── Add / Edit Deadline Form ─────────────────────────────────────────────────

interface DeadlineFormProps {
  dealId: string
  editing?: ContractDeadline | null
  onSaved: (deadline: ContractDeadline) => void
  onCancel: () => void
}

function DeadlineForm({ dealId, editing, onSaved, onCancel }: DeadlineFormProps) {
  const [label, setLabel] = useState(editing?.label ?? '')
  const [type, setType] = useState<DeadlineType>(editing?.deadline_type ?? 'inspection')
  const [date, setDate] = useState(editing?.deadline_date ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!label.trim() || !date) { setErr('Label and date are required'); return }
    setSaving(true)
    setErr('')

    const payload = {
      deal_id: dealId,
      label: label.trim(),
      deadline_type: type,
      deadline_date: date,
      notes: notes.trim() || null,
      status: (editing?.status ?? 'pending') as DeadlineStatus,
    }

    try {
      if (editing) {
        const { data, error } = await supabase
          .from('contract_deadlines')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editing.id)
          .select()
          .single()
        if (error) throw error
        onSaved(data as ContractDeadline)
      } else {
        const { data, error } = await supabase
          .from('contract_deadlines')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        onSaved(data as ContractDeadline)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      setErr(msg)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    flex: 1, fontSize: 11, padding: '5px 8px',
    background: 'var(--bg-elevated)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 5, color: 'var(--text-primary)', outline: 'none',
  }

  return (
    <div style={{
      padding: '10px 12px',
      background: 'rgba(45,212,191,0.04)',
      border: '1px solid rgba(45,212,191,0.15)',
      borderRadius: 8,
      marginTop: 8,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-teal)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
        {editing ? 'Edit Deadline' : 'Add Deadline'}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Label (e.g. Inspection Period)"
          style={{ ...inputStyle, minWidth: 180 }}
        />

        <select
          value={type}
          onChange={e => setType(e.target.value as DeadlineType)}
          style={{ ...inputStyle, flex: '0 0 150px', minWidth: 140 }}
        >
          <option value="contingency">Contingency</option>
          <option value="inspection">Inspection</option>
          <option value="psa_review">PSA Review</option>
          <option value="lease_review">Lease Review</option>
          <option value="psa_draft">PSA Draft</option>
          <option value="lease_draft">Lease Draft</option>
          <option value="lease_execution">Lease Execution</option>
          <option value="lease_deliverables">Lease Deliverables</option>
          <option value="financing">Financing</option>
          <option value="appraisal">Appraisal</option>
          <option value="title">Title</option>
          <option value="survey">Survey</option>
          <option value="closing">Closing</option>
          <option value="custom">Other</option>
        </select>

        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{ ...inputStyle, flex: '0 0 140px', minWidth: 130 }}
        />

        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          style={{ ...inputStyle, minWidth: 140 }}
        />

        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '5px 14px', fontSize: 13, fontWeight: 700,
            background: saving ? 'rgba(45,212,191,0.08)' : 'rgba(45,212,191,0.18)',
            border: '1px solid rgba(45,212,191,0.4)',
            borderRadius: 6, color: '#2dd4bf', cursor: saving ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
          }}>
          {saving ? '…' : (editing ? 'Update' : 'Save')}
        </button>

        <button
          onClick={onCancel}
          style={{
            padding: '5px 10px', fontSize: 13,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, color: 'var(--text-dim)', cursor: 'pointer',
          }}>
          Cancel
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#ef4444' }}>{err}</div>
      )}
    </div>
  )
}

// ─── Landed Flow Modal ───────────────────────────────────────────────────────

const PIN_HASH = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

const SALE_DEAL_TYPES: DealType[] = ['listing', 'active_listing', 'potential_listing', 'seller', 'buyer', 'buyer_rep']
const LEASE_DEAL_TYPES: DealType[] = ['lease', 'tenant', 'tenant_rep', 'landlord', 'landlord_rep']

interface LandedDealContact {
  id: string
  deal_id: string
  contact_id: string
  relationship: string | null
  contacts: {
    id: string
    name: string
    role: string | null
    phone: string | null
    email: string | null
  } | null
}

interface LandedFlowModalProps {
  deal: ContractDeal
  ucDetails: UCDetails | undefined
  onCancel: () => void
  onSuccess: (id: string) => void
}

function LandedFlowModal({ deal, ucDetails, onCancel, onSuccess }: LandedFlowModalProps) {
  const [stage, setStage] = useState<'pin' | 'confirm'>('pin')

  // PIN
  const [pin, setPin] = useState('')
  const [pinErr, setPinErr] = useState(false)

  // Determine deal type
  const dealTypeVal = deal.type as DealType
  const isClearlySale = SALE_DEAL_TYPES.includes(dealTypeVal)
  const isClearlyLease = LEASE_DEAL_TYPES.includes(dealTypeVal)
  const hasDealCategory = !!ucDetails?.deal_category
  const showTypeToggle = !hasDealCategory && !isClearlySale && !isClearlyLease

  let computedDefault: 'Sale' | 'Lease' = 'Sale'
  if (hasDealCategory) {
    const cat = (ucDetails!.deal_category ?? '').toLowerCase()
    computedDefault = (cat.includes('lease') || cat.includes('tenant') || cat.includes('landlord')) ? 'Lease' : 'Sale'
  } else if (isClearlyLease) {
    computedDefault = 'Lease'
  }

  // Confirmation form
  const [dealTypeChoice, setDealTypeChoice] = useState<'Sale' | 'Lease'>(computedDefault)
  const [contractPrice, setContractPrice] = useState(() => {
    const n = ucDetails?.contract_price ?? deal.value ?? null
    return n ? '$' + Math.round(n as number).toLocaleString('en-US') : ''
  })
  const [commissionPct, setCommissionPct] = useState(() => {
    const n = ucDetails?.commission_pct ?? null
    return n ? n.toFixed(2) + '%' : ''
  })
  const [coBrokerPct, setCoBrokerPct] = useState('0.00%')
  const [referralPct, setReferralPct] = useState('0.00%')
  const isDualRep = ucDetails?.dual_rep === true
  const [closeDate, setCloseDate] = useState(
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  )

  // Clients
  const [contacts, setContacts] = useState<LandedDealContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [addingClient, setAddingClient] = useState(false)
  const [clientForm, setClientForm] = useState({ name: '', role: '', phone: '', email: '' })
  const [clientErr, setClientErr] = useState('')
  const [savingClient, setSavingClient] = useState(false)

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState('')

  useEffect(() => {
    if (stage === 'confirm') fetchContacts()
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchContacts() {
    setContactsLoading(true)
    try {
      const { data } = await supabase
        .from('deal_contacts')
        .select('*, contacts(*)')
        .eq('deal_id', deal.id)
      setContacts((data as LandedDealContact[]) || [])
    } catch {}
    setContactsLoading(false)
  }

  // Computed commission
  const cpNum = parseFloat(contractPrice.replace(/[^0-9.]/g, '')) || 0
  const commPct = parseFloat(commissionPct.replace(/[^0-9.]/g, '')) || 0
  const cobPct = parseFloat(coBrokerPct.replace(/[^0-9.]/g, '')) || 0
  const refPct = parseFloat(referralPct.replace(/[^0-9.]/g, '')) || 0
  const totalGross = cpNum * (commPct / 100)
  const netToMatthew = totalGross * (1 - cobPct / 100) * (1 - refPct / 100) * 0.75

  async function handlePinChange(v: string) {
    setPin(v)
    setPinErr(false)
    if (v.length === 4) {
      const hash = await sha256(v)
      if (hash === PIN_HASH) {
        setStage('confirm')
      } else {
        setPinErr(true)
        setPin('')
      }
    }
  }

  async function addClient() {
    if (!clientForm.name.trim()) { setClientErr('Name is required'); return }
    setSavingClient(true); setClientErr('')
    try {
      // Case-insensitive check for existing contact
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .ilike('name', clientForm.name.trim())
        .limit(1)

      let contactId: string
      if (existing && existing.length > 0) {
        contactId = (existing[0] as { id: string }).id
      } else {
        const { data: c, error: ce } = await supabase
          .from('contacts')
          .insert({
            name: clientForm.name.trim(),
            role: clientForm.role.trim() || null,
            phone: clientForm.phone.trim() || null,
            email: clientForm.email.trim() || null,
            priority: 'standard',
          })
          .select()
          .single()
        if (ce) throw ce
        contactId = (c as { id: string }).id
      }

      const { data: dc, error: dce } = await supabase
        .from('deal_contacts')
        .insert({ deal_id: deal.id, contact_id: contactId, relationship: clientForm.role.trim() || null })
        .select('*, contacts(*)')
        .single()
      if (dce) throw dce

      setContacts(prev => [...prev, dc as LandedDealContact])
      setClientForm({ name: '', role: '', phone: '', email: '' })
      setAddingClient(false)
    } catch (e: unknown) {
      setClientErr(e instanceof Error ? e.message : 'Save failed')
    }
    setSavingClient(false)
  }

  async function handleConfirm() {
    setSubmitting(true)
    setSubmitErr('')
    try {
      const isSale = dealTypeChoice === 'Sale'

      // 1. Archive satisfied deadlines
      const { data: satisfiedDls } = await supabase
        .from('contract_deadlines')
        .select('id, notes')
        .eq('deal_id', deal.id)
        .eq('status', 'satisfied')

      if (satisfiedDls && satisfiedDls.length > 0) {
        for (const dl of satisfiedDls as { id: string; notes: string | null }[]) {
          const newNotes = dl.notes
            ? `[Archived ${closeDate}] ${dl.notes}`
            : `[Archived ${closeDate}]`
          const { error } = await supabase
            .from('contract_deadlines')
            .update({ notes: newNotes })
            .eq('id', dl.id)
          if (error) throw error
        }
      }

      if (isSale) {
        // Insert ar_item
        const { data: arItem, error: arErr } = await supabase
          .from('ar_items')
          .insert({
            deal_id: deal.id,
            deal_type: 'sale',
            commission_amount: totalGross,
            sr_portion_amount: netToMatthew,
            status: 'collected',
            collected_date: closeDate,
          })
          .select()
          .single()
        if (arErr) throw arErr

        // Insert ar_payment
        const { error: payErr } = await supabase
          .from('ar_payments')
          .insert({
            ar_item_id: (arItem as { id: string }).id,
            amount: netToMatthew,
            paid_date: closeDate,
            note: 'Paid at closing',
          })
        if (payErr) throw payErr

        // Update deal
        const { error: dealErr } = await supabase
          .from('deals')
          .update({ status: 'closed', commission_collected: netToMatthew })
          .eq('id', deal.id)
        if (dealErr) throw dealErr

      } else {
        // Lease — ar_item as receivable
        const { error: arErr } = await supabase
          .from('ar_items')
          .insert({
            deal_id: deal.id,
            deal_type: 'lease',
            commission_amount: totalGross,
            sr_portion_amount: netToMatthew,
            status: 'receivable',
          })
        if (arErr) throw arErr

        const { error: dealErr } = await supabase
          .from('deals')
          .update({ status: 'pending_payment' })
          .eq('id', deal.id)
        if (dealErr) throw dealErr
      }

      onSuccess(deal.id)
    } catch (e: unknown) {
      setSubmitErr(e instanceof Error ? e.message : 'An error occurred. Please try again.')
      setSubmitting(false)
    }
  }

  const mInp: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 7, padding: '8px 10px', fontSize: 13, color: '#F0F2FF',
    outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  }

  const mLbl: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
    marginBottom: 4, fontFamily: 'monospace', display: 'block',
  }

  // ── PIN gate stage ───────────────────────────────────────────────────────
  if (stage === 'pin') {
    return (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        onClick={onCancel}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'linear-gradient(160deg, #0a1f14 0%, #0d2818 50%, #091a10 100%)',
            border: '2px solid rgba(34,197,94,0.55)',
            borderRadius: 16,
            padding: '36px 32px',
            width: '90vw', maxWidth: 380,
            display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center',
            boxShadow: '0 0 60px rgba(34,197,94,0.15), 0 24px 64px rgba(0,0,0,0.8)',
          }}
        >
          {/* Icon */}
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(34,197,94,0.15)',
            border: '1.5px solid rgba(34,197,94,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>✓</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#bbf7d0', fontFamily: 'inherit', textAlign: 'center', marginBottom: 6 }}>LANDED</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 1.5 }}>
              This is final — enter PIN to<br />confirm close-out
            </div>
          </div>
          <input
            autoFocus
            type="tel"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4)
              handlePinChange(v)
            }}
            placeholder="· · · ·"
            style={{
              width: '100%', fontSize: 36, textAlign: 'center', letterSpacing: '0.55em',
              padding: '16px', background: 'rgba(34,197,94,0.06)',
              border: `2px solid ${pinErr ? '#ef4444' : 'rgba(34,197,94,0.45)'}`,
              borderRadius: 12, color: '#bbf7d0', outline: 'none', boxSizing: 'border-box',
              fontWeight: 700,
            }}
          />
          {pinErr && <div style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', marginTop: -12 }}>Incorrect PIN</div>}
          <button onClick={onCancel} style={{ padding: '9px 28px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#6b7280', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        </div>
      </div>
    )
  }

  // ── Confirmation stage ───────────────────────────────────────────────────
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflowY: 'auto' }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#13112A', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(34,197,94,0.7)', fontFamily: 'monospace', marginBottom: 4 }}>Close-Out</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F2FF' }}>{deal.name || deal.address || '—'}</div>
          </div>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {/* Deal type toggle — only if ambiguous */}
        {showTypeToggle ? (
          <div>
            <span style={mLbl}>Deal Type</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['Sale', 'Lease'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setDealTypeChoice(t)}
                  style={{
                    flex: 1, padding: '8px', fontSize: 13, fontWeight: 700,
                    background: dealTypeChoice === t ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${dealTypeChoice === t ? 'rgba(34,197,94,0.6)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 7, color: dealTypeChoice === t ? '#22c55e' : '#6b7280', cursor: 'pointer',
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Type:</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{dealTypeChoice}</span>
          </div>
        )}

        {/* Contract Price + Commission Rate */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={mLbl}>Contract Price</label>
            <input
              type="text" inputMode="decimal"
              value={contractPrice}
              onChange={e => setContractPrice(e.target.value)}
              onFocus={e => {
                const raw = e.target.value.replace(/[^0-9.]/g, '')
                setContractPrice(raw)
              }}
              onBlur={e => {
                const n = parseFloat(e.target.value.replace(/[^0-9.]/g, ''))
                if (!isNaN(n) && n > 0) setContractPrice('$' + Math.round(n).toLocaleString('en-US'))
              }}
              placeholder="$0"
              style={mInp}
            />
          </div>
          <div>
            <label style={mLbl}>Commission Rate %</label>
            <input
              type="text" inputMode="decimal"
              value={commissionPct}
              onChange={e => setCommissionPct(e.target.value)}
              onFocus={e => {
                const raw = e.target.value.replace(/[^0-9.]/g, '')
                setCommissionPct(raw)
              }}
              onBlur={e => {
                const n = parseFloat(e.target.value.replace(/[^0-9.]/g, ''))
                if (!isNaN(n) && n > 0) setCommissionPct(n.toFixed(2) + '%')
              }}
              placeholder="0%"
              style={mInp}
            />
          </div>
        </div>

        {/* Co-broker + Referral */}
        {!isDualRep && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={mLbl}>Co-Broker Split %</label>
            <input
              type="text" inputMode="decimal"
              value={coBrokerPct}
              onChange={e => setCoBrokerPct(e.target.value)}
              onFocus={e => {
                const raw = e.target.value.replace(/[^0-9.]/g, '')
                setCoBrokerPct(raw)
              }}
              onBlur={e => {
                const n = parseFloat(e.target.value.replace(/[^0-9.]/g, ''))
                setCoBrokerPct(!isNaN(n) ? n.toFixed(2) + '%' : '0.00%')
              }}
              placeholder="0.00%"
              style={mInp}
            />
          </div>
          <div>
            <label style={mLbl}>Referral %</label>
            <input
              type="text" inputMode="decimal"
              value={referralPct}
              onChange={e => setReferralPct(e.target.value)}
              onFocus={e => {
                const raw = e.target.value.replace(/[^0-9.]/g, '')
                setReferralPct(raw)
              }}
              onBlur={e => {
                const n = parseFloat(e.target.value.replace(/[^0-9.]/g, ''))
                setReferralPct(!isNaN(n) ? n.toFixed(2) + '%' : '0.00%')
              }}
              placeholder="0.00%"
              style={mInp}
            />
          </div>
        </div>
        )}

        {/* Net Commission hero */}
        <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '14px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(34,197,94,0.6)', fontFamily: 'monospace', marginBottom: 4 }}>Net Commission</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#22c55e', fontVariantNumeric: 'tabular-nums' }}>
            ${Math.round(netToMatthew).toLocaleString('en-US')}
          </div>
          {(cobPct > 0 || refPct > 0) && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
              Gross: ${Math.round(totalGross).toLocaleString('en-US')}
              {cobPct > 0 ? ` · Co-broker: ${cobPct}%` : ''}
              {refPct > 0 ? ` · Referral: ${refPct}%` : ''}
            </div>
          )}
        </div>

        {/* Clients */}
        <div>
          <label style={mLbl}>Clients</label>
          {contactsLoading ? (
            <div style={{ fontSize: 11, color: '#6b7280' }}>Loading…</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: contacts.length > 0 ? 8 : 0 }}>
              {contacts.map(dc => (
                <div key={dc.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 20, fontSize: 12, color: '#c4b5fd' }}>
                  <span>{dc.contacts?.name || '—'}</span>
                  {dc.relationship && <span style={{ opacity: 0.6 }}>· {dc.relationship}</span>}
                </div>
              ))}
            </div>
          )}
          {addingClient ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input autoFocus placeholder="Name *" value={clientForm.name} onChange={e => setClientForm(p => ({...p, name: e.target.value}))} style={mInp} />
                <input placeholder="Role" value={clientForm.role} onChange={e => setClientForm(p => ({...p, role: e.target.value}))} style={mInp} />
                <input placeholder="Phone" value={clientForm.phone} onChange={e => setClientForm(p => ({...p, phone: e.target.value}))} style={mInp} />
                <input placeholder="Email" value={clientForm.email} onChange={e => setClientForm(p => ({...p, email: e.target.value}))} style={mInp} />
              </div>
              {clientErr && <div style={{ fontSize: 11, color: '#ef4444' }}>{clientErr}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setAddingClient(false); setClientErr('') }} style={{ flex: 1, padding: '7px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#6b7280', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                <button onClick={addClient} disabled={savingClient} style={{ flex: 2, padding: '7px', background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 7, color: '#a78bfa', cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: savingClient ? 0.5 : 1 }}>
                  {savingClient ? 'Saving…' : 'Add'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingClient(true)}
              style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 7, color: '#a78bfa', cursor: 'pointer' }}>
              + Add Client
            </button>
          )}
        </div>

        {/* Close date */}
        <div>
          <label style={mLbl}>Close Date</label>
          <input
            type="date"
            value={closeDate}
            onChange={e => setCloseDate(e.target.value)}
            style={{ ...mInp, colorScheme: 'dark' } as React.CSSProperties}
          />
        </div>

        {/* Error */}
        {submitErr && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, fontSize: 12, color: '#ef4444' }}>
            {submitErr}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#6b7280', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            style={{
              flex: 2, padding: '11px',
              background: submitting ? 'rgba(34,197,94,0.1)' : 'linear-gradient(135deg, rgba(34,197,94,0.3) 0%, rgba(21,128,61,0.4) 100%)',
              border: '2px solid rgba(34,197,94,0.6)',
              borderRadius: 8, color: '#bbf7d0',
              fontSize: 14, fontWeight: 900,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: submitting ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: submitting ? 0.7 : 1,
            }}>
            {submitting ? 'Processing…' : '✓ Confirm LANDED'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Expanded Deal Subpanel ───────────────────────────────────────────────────

interface DealSubpanelProps {
  deal: ContractDeal
  onDeadlinesChange: (dealId: string, deadlines: ContractDeadline[]) => void
}

function DealSubpanel({ deal, onDeadlinesChange }: DealSubpanelProps) {
  const [deadlines, setDeadlines] = useState<ContractDeadline[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingDeadline, setEditingDeadline] = useState<ContractDeadline | null>(null)

  const fetchDeadlines = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('contract_deadlines')
        .select('*')
        .eq('deal_id', deal.id)
        .order('deadline_date')
      const list = (data as ContractDeadline[]) || []
      setDeadlines(list)
      onDeadlinesChange(deal.id, list)
    } catch {
      setDeadlines([])
    } finally {
      setLoading(false)
    }
  }, [deal.id, onDeadlinesChange])

  useEffect(() => {
    fetchDeadlines()
  }, [fetchDeadlines])

  async function handleSatisfy(id: string) {
    try {
      await supabase
        .from('contract_deadlines')
        .update({ status: 'satisfied', updated_at: new Date().toISOString() })
        .eq('id', id)
      setDeadlines(prev => prev.map(d => d.id === id ? { ...d, status: 'satisfied' as DeadlineStatus } : d))
      onDeadlinesChange(deal.id, deadlines.map(d => d.id === id ? { ...d, status: 'satisfied' as DeadlineStatus } : d))
    } catch {}
  }

  async function handleUndo(id: string) {
    try {
      await supabase
        .from('contract_deadlines')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', id)
      setDeadlines(prev => prev.map(d => d.id === id ? { ...d, status: 'pending' as DeadlineStatus } : d))
      onDeadlinesChange(deal.id, deadlines.map(d => d.id === id ? { ...d, status: 'pending' as DeadlineStatus } : d))
    } catch {}
  }

  async function handleDelete(id: string) {
    try {
      await supabase.from('contract_deadlines').delete().eq('id', id)
      const updated = deadlines.filter(d => d.id !== id)
      setDeadlines(updated)
      onDeadlinesChange(deal.id, updated)
    } catch {}
  }

  function handleEdit(deadline: ContractDeadline) {
    setEditingDeadline(deadline)
    setShowAddForm(false)
  }

  function handleSaved(saved: ContractDeadline) {
    if (editingDeadline) {
      const updated = deadlines.map(d => d.id === saved.id ? saved : d)
      setDeadlines(updated)
      onDeadlinesChange(deal.id, updated)
      setEditingDeadline(null)
    } else {
      const updated = [...deadlines, saved].sort((a, b) => a.deadline_date.localeCompare(b.deadline_date))
      setDeadlines(updated)
      onDeadlinesChange(deal.id, updated)
      setShowAddForm(false)
    }
  }

  return (
    <div style={{
      padding: '12px 16px 14px',
      background: 'rgba(255,255,255,0.02)',
      borderLeft: '2px solid rgba(45,212,191,0.3)',
      marginLeft: 8,
      borderRadius: '0 0 6px 6px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#2dd4bf', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Contingency Tracker
        </div>
        {!showAddForm && !editingDeadline && (
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              fontSize: 11, padding: '3px 10px', fontWeight: 600,
              background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.25)',
              borderRadius: 5, color: '#2dd4bf', cursor: 'pointer',
            }}>
            + Add Deadline
          </button>
        )}
      </div>

      {/* Column headers */}
      {!loading && deadlines.length > 0 && (
        <div style={{ display: 'flex', gap: 10, padding: '0 12px 4px', marginBottom: 2 }}>
          <div style={{ flex: '0 0 160px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Label</div>
          <div style={{ flex: '0 0 130px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Stage</div>
          <div style={{ flex: '0 0 60px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Deadline</div>
          <div style={{ flex: '0 0 70px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Days</div>
          <div style={{ flex: '0 0 70px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</div>
          <div style={{ flex: 1 }} />
          <div style={{ flex: '0 0 90px' }} />
        </div>
      )}

      {/* Deadline list */}
      {loading ? (
        <div style={{ padding: '8px 0', fontSize: 11, color: 'var(--text-dim)' }}>Loading…</div>
      ) : deadlines.length === 0 && !showAddForm ? (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '6px 0' }}>
          No deadlines tracked yet.{' '}
          <button
            onClick={() => setShowAddForm(true)}
            style={{ background: 'none', border: 'none', color: '#2dd4bf', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: 0 }}>
            + Add one
          </button>
        </div>
      ) : (
        <div>
          {deadlines.map(d => (
            editingDeadline?.id === d.id ? (
              <div key={d.id}>
                <DeadlineForm
                  dealId={deal.id}
                  editing={editingDeadline}
                  onSaved={handleSaved}
                  onCancel={() => setEditingDeadline(null)}
                />
              </div>
            ) : (
              <DeadlineRow
                key={d.id}
                deadline={d}
                onSatisfy={handleSatisfy}
                onUndo={handleUndo}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            )
          ))}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <DeadlineForm
          dealId={deal.id}
          editing={null}
          onSaved={handleSaved}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </div>
  )
}

// ─── Deadlines Summary Cell ───────────────────────────────────────────────────

interface DeadlinesSummaryProps {
  deadlines: ContractDeadline[]
  onExpand: () => void
  isExpanded: boolean
}

function DeadlinesSummary({ deadlines, onExpand, isExpanded }: DeadlinesSummaryProps) {
  const pending = deadlines.filter(d => d.status === 'pending')
  
  if (deadlines.length === 0) {
    return (
      <button
        onClick={onExpand}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, color: '#2dd4bf', padding: '2px 4px', fontWeight: 600,
        }}>
        + Add
      </button>
    )
  }

  const nearest = pending
    .map(d => ({ d, days: daysUntil(d.deadline_date) }))
    .sort((a, b) => a.days - b.days)[0]

  const urgentColor = nearest && nearest.days <= 3
    ? '#ef4444'
    : nearest && nearest.days <= 7
    ? '#fb923c'
    : nearest && nearest.days <= 45
    ? '#E8B84B'
    : 'var(--text-muted)'

  const showCountdown = nearest && nearest.days <= 45

  return (
    <button
      onClick={onExpand}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '2px 4px', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
      }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: pending.length > 0 ? '#4F8EF7' : 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
        {pending.length}
      </span>
      {showCountdown && (
        <span style={{ fontSize: 11, color: urgentColor, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {nearest!.days <= 0 ? 'PAST' : `${nearest!.days}d`} {isExpanded ? '▲' : '▼'}
        </span>
      )}
      {!showCountdown && (
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {isExpanded ? '▲' : '▼'}
        </span>
      )}
    </button>
  )
}

// ─── Contacts Cell ────────────────────────────────────────────────────────────

interface DealContact {
  id: string
  deal_id: string
  contact_id: string
  relationship: string | null
  contacts: {
    id: string
    name: string
    role: string | null
    phone: string | null
    email: string | null
  } | null
}

function ContactsCell({ dealId, dealName }: { dealId: string; dealName: string }) {
  const [open, setOpen] = useState(false)
  const [contacts, setContacts] = useState<DealContact[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', role: '', phone: '', email: '' })
  const [err, setErr] = useState('')

  async function fetchContacts() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('deal_contacts')
        .select('*, contacts(*)')
        .eq('deal_id', dealId)
      setContacts((data as DealContact[]) || [])
    } catch {}
    finally { setLoading(false) }
  }

  function openModal() {
    setOpen(true)
    fetchContacts()
  }

  async function addContact() {
    if (!form.name.trim()) { setErr('Name is required'); return }
    setSaving(true); setErr('')
    try {
      // 1. Insert contact
      const { data: c, error: ce } = await supabase
        .from('contacts')
        .insert({ name: form.name.trim(), role: form.role.trim() || null, phone: form.phone.trim() || null, email: form.email.trim() || null, priority: 'standard' })
        .select()
        .single()
      if (ce) throw ce

      // 2. Link to deal
      const { data: dc, error: dce } = await supabase
        .from('deal_contacts')
        .insert({ deal_id: dealId, contact_id: c.id, relationship: form.role.trim() || null })
        .select('*, contacts(*)')
        .single()
      if (dce) throw dce

      setContacts(prev => [...prev, dc as DealContact])
      setForm({ name: '', role: '', phone: '', email: '' })
      setAdding(false)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    }
    setSaving(false)
  }

  async function removeContact(dcId: string, contactId: string) {
    try {
      await supabase.from('deal_contacts').delete().eq('id', dcId)
      // Optionally delete the contact itself if it has no other deal links
      // For now, just remove the junction
      setContacts(prev => prev.filter(dc => dc.id !== dcId))
    } catch {}
  }

  const inp: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 7, padding: '8px 10px', fontSize: 13, color: '#F0F2FF',
    outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  }

  return (
    <>
      <button
        onClick={openModal}
        style={{
          padding: '3px 9px', fontSize: 10, fontWeight: 700,
          background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)',
          borderRadius: 5, color: '#a78bfa', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
        Contacts
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setOpen(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#13112A', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 500, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.6)', fontFamily: 'monospace', marginBottom: 4 }}>Contacts</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F2FF' }}>{dealName}</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>

            {/* Contact list */}
            {loading ? (
              <div style={{ fontSize: 12, color: '#6b7280', padding: '8px 0' }}>Loading…</div>
            ) : contacts.length === 0 ? (
              <div style={{ fontSize: 12, color: '#6b7280', padding: '8px 0', fontStyle: 'italic' }}>No contacts linked yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {contacts.map(dc => (
                  <div key={dc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 7, border: '1px solid rgba(167,139,250,0.15)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2FF' }}>{dc.contacts?.name || '—'}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                        {[dc.contacts?.role, dc.contacts?.phone, dc.contacts?.email].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {dc.relationship && (
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', fontWeight: 600 }}>
                        {dc.relationship}
                      </span>
                    )}
                    <button onClick={() => removeContact(dc.id, dc.contact_id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.5)', cursor: 'pointer', fontSize: 13 }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add contact */}
            {adding ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px', background: 'rgba(167,139,250,0.05)', borderRadius: 8, border: '1px solid rgba(167,139,250,0.2)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.6)', fontFamily: 'monospace' }}>Add Contact</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input autoFocus placeholder="Name *" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} style={inp} />
                  <input placeholder="Role (e.g. Buyer, Attorney)" value={form.role} onChange={e => setForm(p => ({...p, role: e.target.value}))} style={inp} />
                  <input placeholder="Phone" value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} style={inp} />
                  <input placeholder="Email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} style={inp} />
                </div>
                {err && <div style={{ fontSize: 11, color: '#ef4444' }}>{err}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setAdding(false); setErr('') }} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#6b7280', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                  <button onClick={addContact} disabled={saving} style={{ flex: 2, padding: '8px', background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.5)', borderRadius: 7, color: '#a78bfa', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: saving ? 0.5 : 1 }}>
                    {saving ? 'Saving…' : 'Add Contact'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                style={{ padding: '8px 18px', fontSize: 12, fontWeight: 700, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: 8, color: '#a78bfa', cursor: 'pointer' }}>
                + Add Contact
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface UCDetails {
  deal_id: string
  deal_category: string | null
  contract_price: number | null
  commission_pct: number | null
  commission_amount: number | null
  lease_rate: number | null
  lease_rate_unit: string | null
  lease_term_months: number | null
  dual_rep: boolean | null
}

export default function UnderContractPanel({ onLanded }: { onLanded?: () => void } = {}) {
  const [deals, setDeals] = useState<ContractDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null)
  const [dealDeadlines, setDealDeadlines] = useState<Record<string, ContractDeadline[]>>({})
  const [ucDetails, setUcDetails] = useState<Record<string, UCDetails>>({})
  const [landedDealId, setLandedDealId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDeals() {
      try {
        const { data } = await supabase
          .from('deals')
          .select('*')
          .eq('status', 'under_contract')
          .order('updated_at', { ascending: false })
        if (data) {
          const dealList = (data as Deal[]).map(d => ({
            ...d,
            days_since_contract: daysDiff(d.updated_at),
          }))
          setDeals(dealList)

          // Fetch uc_details and deadlines for all loaded deals upfront
          if (dealList.length > 0) {
            const ids = dealList.map(d => d.id)

            const { data: ucData } = await supabase
              .from('uc_details')
              .select('deal_id,deal_category,contract_price,commission_pct,commission_amount,lease_rate,lease_rate_unit,lease_term_months,dual_rep')
              .in('deal_id', ids)
            if (ucData) {
              const map: Record<string, UCDetails> = {}
              for (const row of ucData as UCDetails[]) map[row.deal_id] = row
              setUcDetails(map)
            }

            // Pre-fetch all deadlines so Next Deadline shows without expanding
            const { data: dlData } = await supabase
              .from('contract_deadlines')
              .select('*')
              .in('deal_id', ids)
              .order('deadline_date', { ascending: true })
            if (dlData) {
              const dlMap: Record<string, ContractDeadline[]> = {}
              for (const dl of dlData as ContractDeadline[]) {
                if (!dlMap[dl.deal_id]) dlMap[dl.deal_id] = []
                dlMap[dl.deal_id].push(dl)
              }
              setDealDeadlines(dlMap)
            }
          }
        }
      } catch {
        setDeals(PLACEHOLDER_DEALS)
      } finally {
        setLoading(false)
      }
    }
    fetchDeals()
    // Poll every 30s so newly-UC'd deals appear without manual refresh
    const interval = setInterval(fetchDeals, 30000)
    return () => clearInterval(interval)
  }, [])

  function handleToggleExpand(dealId: string) {
    setExpandedDeal(prev => prev === dealId ? null : dealId)
  }

  const handleDeadlinesChange = useCallback((dealId: string, deadlines: ContractDeadline[]) => {
    setDealDeadlines(prev => ({ ...prev, [dealId]: deadlines }))
  }, [])

  return (
    <div className="wr-card" style={{ boxShadow: '0 0 0 1px rgba(45,212,191,0.08), 0 8px 40px rgba(0,0,0,0.5), 0 0 60px rgba(45,212,191,0.04)' }}>
      {/* Panel header */}
      <SectionHeader
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>}
        label="Under Contract"
        color="#22C55E"
        stat={loading ? '—' : deals.length}
      />

      {loading ? (
        <SkeletonTable />
      ) : deals.length === 0 ? (
        <div className="wr-empty">
          <div className="wr-empty-text">No active contracts.</div>
          <div className="wr-empty-line" />
        </div>
      ) : (
        <div>
          {/* ── Desktop table (hidden on mobile via CSS) ── */}
          <table className="uc-desktop-table" style={{ borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {[
                  { label: '↗',            align: 'center' },
                  { label: 'Address',       align: 'left'   },
                  { label: 'Client',        align: 'left'   },
                  { label: 'Price',         align: 'right'  },
                  { label: 'Commission',    align: 'right'  },
                  { label: 'Next Deadline', align: 'center' },
                  { label: '',              align: 'center' },
                ].map((h, i) => (
                  <th key={i} style={{
                    textAlign: h.align as React.CSSProperties['textAlign'],
                    padding: '7px 8px',
                    fontSize: 10,
                    fontWeight: 800,
                    color: 'rgba(255,255,255,0.3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    whiteSpace: 'nowrap',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map((deal, i) => {
                const isExpanded = expandedDeal === deal.id
                const deadlines = dealDeadlines[deal.id] || []
                const uc = ucDetails[deal.id]

                // Contract price from uc_details, fallback to deal.value
                const contractPrice = uc?.contract_price ?? deal.value ?? null

                // My commission — always recalculate: contract price × commission % × 75%
                // Never trust stored commission_amount (may have been calculated incorrectly)
                let myCommission: number | null = null
                if (uc?.commission_pct && contractPrice && uc.deal_category !== 'lease') {
                  myCommission = Math.round(contractPrice * (uc.commission_pct / 100) * 0.75)
                } else if (uc?.commission_pct && uc.lease_rate && uc.lease_term_months) {
                  // Lease: rate × sqft (unknown here, skip) — show stored amount if present
                  if (uc.commission_amount) myCommission = uc.commission_amount
                }

                // Next pending deadline (soonest by date)
                const pendingDeadlines = deadlines.filter(d => d.status === 'pending')
                const nextDeadline = pendingDeadlines
                  .sort((a, b) => a.deadline_date.localeCompare(b.deadline_date))[0] ?? null
                const nextDays = nextDeadline ? daysUntil(nextDeadline.deadline_date) : null
                const deadlineColor = nextDays == null ? 'var(--text-dim)'
                  : nextDays < 0 ? '#ef4444'
                  : nextDays === 0 ? '#22c55e'
                  : '#4F8EF7'

                return (
                  <>
                    <tr
                      key={deal.id}
                      style={{
                        borderBottom: isExpanded
                          ? 'none'
                          : i < deals.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        transition: 'background 0.1s',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleToggleExpand(deal.id)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {/* Deal page arrow */}
                      <td style={{ width: 38, minWidth: 38, maxWidth: 38, padding: '6px 4px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <a
                          href={`/warroom/deal?id=${deal.id}`}
                          title="Open deal dashboard"
                          onClick={e => e.stopPropagation()}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 28, height: 28, borderRadius: 6,
                            background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.35)',
                            color: '#2dd4bf', textDecoration: 'none', fontSize: 14, lineHeight: 1,
                            transition: 'all 0.15s',
                          }}>
                          ↗
                        </a>
                      </td>

                      {/* Address */}
                      <td style={{ padding: '13px 8px', maxWidth: 220 }}>
                        <div className="wr-address" style={{ fontSize: 14, fontWeight: 700, color: '#F0F2FF', fontFamily: 'var(--font-body)' }}>
                          {formatAddress((deal as any).addr_display || deal.address || deal.name)}
                        </div>
                      </td>

                      {/* Client / ID */}
                      <td style={{ padding: '13px 8px', maxWidth: 160 }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 400 }}>
                          {deal.name || '—'}
                        </div>
                      </td>

                      {/* Contract Price */}
                      <td style={{ padding: '13px 8px', whiteSpace: 'nowrap', textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#F0F2FF', fontFamily: 'var(--font-body)', fontVariantNumeric: 'tabular-nums' }}>
                        {contractPrice ? formatCurrency(contractPrice) : '—'}
                      </td>

                      {/* My Commission */}
                      <td style={{ padding: '13px 8px', whiteSpace: 'nowrap', textAlign: 'right', fontSize: 14, fontFamily: 'var(--font-body)', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ color: '#22c55e', fontWeight: 700 }}>
                          {myCommission ? formatCurrency(myCommission) : '—'}
                        </span>
                      </td>

                      {/* Next Deadline */}
                      <td style={{ padding: '6px 8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        {nextDeadline ? (
                          <button
                            onClick={() => handleToggleExpand(deal.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', textAlign: 'left' }}>
                            {/* Date — hero line */}
                            <div style={{ fontSize: 13, fontWeight: 800, color: deadlineColor, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                              {new Date(nextDeadline.deadline_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            {/* Label + countdown */}
                            <div style={{ fontSize: 10, color: deadlineColor, fontWeight: 600, whiteSpace: 'nowrap', opacity: 0.75, marginTop: 2 }}>
                              {nextDeadline.label.length > 18 ? nextDeadline.label.slice(0, 18) + '…' : nextDeadline.label}
                              {' · '}
                              {nextDays! < 0 ? `${Math.abs(nextDays!)}d overdue` : nextDays === 0 ? 'TODAY' : `${nextDays}d`}
                            </div>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleExpand(deal.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#2dd4bf', padding: '2px 4px', fontWeight: 600 }}>
                            + Add
                          </button>
                        )}
                      </td>

                      {/* LANDED hero button */}
                      <td style={{ padding: '6px 10px 6px 4px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={e => { e.stopPropagation(); setLandedDealId(deal.id) }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            gap: 6,
                            padding: '9px 16px',
                            fontSize: 12, fontWeight: 900,
                            letterSpacing: '0.1em', textTransform: 'uppercase',
                            background: 'linear-gradient(135deg, rgba(34,197,94,0.28) 0%, rgba(21,128,61,0.38) 100%)',
                            border: '2px solid rgba(34,197,94,0.75)',
                            borderRadius: 10,
                            color: '#bbf7d0',
                            boxShadow: '0 0 20px rgba(34,197,94,0.25), 0 3px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 32px rgba(34,197,94,0.45), 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)'
                            ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(34,197,94,0.25), 0 3px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
                            ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
                          }}
                        >
                          ✓ LANDED
                        </button>
                      </td>

                    </tr>

                    {/* Expanded subpanel */}
                    {isExpanded && (
                      <tr key={`${deal.id}-expand`} style={{ borderBottom: i < deals.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <td colSpan={7} style={{ padding: '0 10px 10px' }}>
                          <DealSubpanel
                            deal={deal}
                            onDeadlinesChange={handleDeadlinesChange}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>

          {/* ── Mobile card list (hidden on desktop via CSS) ── */}
          <div className="uc-mobile-list" style={{ display: 'none' }}>
            {deals.map((deal) => {
              const isExpanded = expandedDeal === deal.id
              const deadlines = dealDeadlines[deal.id] || []
              const uc = ucDetails[deal.id]
              const contractPrice = uc?.contract_price ?? deal.value ?? null
              let myCommission: number | null = null
              if (uc?.commission_pct && contractPrice && uc.deal_category !== 'lease') {
                myCommission = Math.round(contractPrice * (uc.commission_pct / 100) * 0.75)
              } else if (uc?.commission_pct && uc.lease_rate && uc.lease_term_months) {
                if (uc.commission_amount) myCommission = uc.commission_amount
              }
              const pendingDeadlines = deadlines.filter(d => d.status === 'pending')
              const nextDeadline = pendingDeadlines.sort((a, b) => a.deadline_date.localeCompare(b.deadline_date))[0] ?? null
              const nextDays = nextDeadline ? daysUntil(nextDeadline.deadline_date) : null
              const deadlineColor = nextDays == null ? 'var(--text-dim)'
                : nextDays < 0 ? '#ef4444'
                : nextDays === 0 ? '#22c55e'
                : '#4F8EF7'

              return (
                <div key={deal.id} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}>
                  {/* Card header row: arrow + address + LANDED */}
                  <div
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 12px 8px', cursor: 'pointer' }}
                    onClick={() => handleToggleExpand(deal.id)}
                  >
                    {/* Arrow link */}
                    <a
                      href={`/warroom/deal?id=${deal.id}`}
                      onClick={e => e.stopPropagation()}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 28, height: 28, borderRadius: 6, flexShrink: 0, marginTop: 1,
                        background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.35)',
                        color: '#2dd4bf', textDecoration: 'none', fontSize: 14, lineHeight: 1,
                      }}
                    >↗</a>

                    {/* Address + client */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F2FF', fontFamily: 'var(--font-body)', lineHeight: 1.35, wordBreak: 'normal', overflowWrap: 'break-word' }}>
                        {formatAddress((deal as any).addr_display || deal.address || deal.name)}
                      </div>
                      {deal.name && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {deal.name}
                        </div>
                      )}
                    </div>

                    {/* LANDED button */}
                    <button
                      onClick={e => { e.stopPropagation(); setLandedDealId(deal.id) }}
                      style={{
                        flexShrink: 0,
                        padding: '6px 10px',
                        fontSize: 11, fontWeight: 900,
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                        background: 'linear-gradient(135deg, rgba(34,197,94,0.25) 0%, rgba(21,128,61,0.35) 100%)',
                        border: '1.5px solid rgba(34,197,94,0.7)',
                        borderRadius: 8,
                        color: '#bbf7d0',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        whiteSpace: 'nowrap',
                      }}
                    >✓ LANDED</button>
                  </div>

                  {/* Data row: Price / Commission / Deadline */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 0,
                    borderTop: '1px solid rgba(255,255,255,0.04)',
                    padding: '8px 12px 10px',
                  }}>
                    {/* Price */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Price</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#F0F2FF', fontFamily: 'var(--font-body)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {contractPrice ? formatCurrency(contractPrice) : '—'}
                      </div>
                    </div>
                    {/* Commission */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Comm.</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e', fontFamily: 'var(--font-body)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {myCommission ? formatCurrency(myCommission) : '—'}
                      </div>
                    </div>
                    {/* Next Deadline */}
                    <div
                      onClick={() => handleToggleExpand(deal.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Next Deadline</div>
                      {nextDeadline ? (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 800, color: deadlineColor, whiteSpace: 'nowrap' }}>
                            {new Date(nextDeadline.deadline_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div style={{ fontSize: 10, color: deadlineColor, fontWeight: 600, opacity: 0.75, marginTop: 1, whiteSpace: 'nowrap' }}>
                            {nextDays! < 0 ? `${Math.abs(nextDays!)}d overdue` : nextDays === 0 ? 'TODAY' : `${nextDays}d`} {isExpanded ? '▲' : '▼'}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: '#2dd4bf', fontWeight: 600 }}>+ Add {isExpanded ? '▲' : '▼'}</div>
                      )}
                    </div>
                  </div>

                  {/* Expanded subpanel */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <DealSubpanel
                        deal={deal}
                        onDeadlinesChange={handleDeadlinesChange}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Landed flow modal portal */}
      {landedDealId && typeof document !== 'undefined' && createPortal(
        <LandedFlowModal
          deal={deals.find(d => d.id === landedDealId)!}
          ucDetails={ucDetails[landedDealId]}
          onCancel={() => setLandedDealId(null)}
          onSuccess={(id) => {
            setDeals(prev => prev.filter(d => d.id !== id))
            setLandedDealId(null)
            onLanded?.()
          }}
        />,
        document.body
      )}
    </div>
  )
}

const PLACEHOLDER_DEALS: ContractDeal[] = [
  {
    id: 'p1', name: 'Edinburgh Ave. N. 1873', address: 'Edinburgh Ave. N., BR',
    type: 'listing', status: 'under_contract', tier: 'filed',
    value: 1200000, commission_rate: 0.06, commission_estimated: 72000, commission_collected: 0,
    deal_source: null, notes: null, dropbox_link: null, parent_deal_id: null,
    created_at: new Date().toISOString(), updated_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    days_since_contract: 12,
  },
]

function SkeletonTable() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
    </div>
  )
}

function DocIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
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
          style={{ flex: 1, fontSize: 11, padding: '4px 8px', background: 'var(--bg-elevated)', border: '1px solid rgba(0,97,255,0.4)', borderRadius: 5, color: 'var(--text-primary)', outline: 'none', minWidth: 0 }}
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
      <a href={url || DROPBOX_FALLBACK} target="_blank" rel="noopener noreferrer"
        title={url ? 'Open deal folder' : 'Open Active Listings folder'}
        onClick={e => e.stopPropagation()}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: url ? 'rgba(0,97,255,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${url ? 'rgba(0,97,255,0.3)' : 'rgba(255,255,255,0.08)'}`, color: url ? '#4F8EF7' : 'var(--text-dim)', textDecoration: 'none' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L6 6.5L12 11L18 6.5L12 2ZM6 6.5L0 11L6 15.5L12 11L6 6.5ZM18 6.5L12 11L18 15.5L24 11L18 6.5ZM6 15.5L12 20L18 15.5L12 11L6 15.5Z"/></svg>
      </a>
      <button onClick={() => { setDraft(url || ''); setEditing(true) }}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 5, background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 10 }}>
        ✎
      </button>
    </div>
  )
}

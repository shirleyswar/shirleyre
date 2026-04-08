'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, Deal, DealStatus, DealTier, DealType, ContractDeadline, DeadlineType, DeadlineStatus, Contact, DealContact, LacdbListing } from '@/lib/supabase'
import { Suspense } from 'react'

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<DealStatus, string> = {
  active: 'Active',
  in_review: 'In Review',
  pipeline: 'Pipeline',
  in_service: 'In Service',
  hot: 'Hot',
  under_contract: 'Under Contract',
  pending_payment: 'Pending Pmt',
  closed: 'Closed',
  expired: 'Expired',
  dormant: 'Dormant',
  terminated: 'Terminated',
}

const STATUS_COLORS: Record<DealStatus, { bg: string; text: string; border: string }> = {
  active:           { bg: 'rgba(34,197,94,0.15)',    text: '#22c55e',  border: 'rgba(34,197,94,0.4)' },
  in_review:        { bg: 'rgba(251,191,36,0.15)',   text: '#fbbf24',  border: 'rgba(251,191,36,0.4)' },
  pipeline:         { bg: 'rgba(79,142,247,0.15)',   text: '#4F8EF7',  border: 'rgba(79,142,247,0.4)' },
  in_service:       { bg: 'rgba(45,212,191,0.15)',   text: '#2dd4bf',  border: 'rgba(45,212,191,0.4)' },
  hot:              { bg: 'rgba(251,146,60,0.15)',   text: '#fb923c',  border: 'rgba(251,146,60,0.4)' },
  under_contract:   { bg: 'rgba(45,212,191,0.15)',   text: '#2dd4bf',  border: 'rgba(45,212,191,0.4)' },
  pending_payment:  { bg: 'rgba(251,191,36,0.15)',   text: '#fbbf24',  border: 'rgba(251,191,36,0.4)' },
  closed:           { bg: 'rgba(107,114,128,0.15)',  text: '#9ca3af',  border: 'rgba(107,114,128,0.4)' },
  expired:          { bg: 'rgba(239,68,68,0.12)',    text: '#ef4444',  border: 'rgba(239,68,68,0.3)' },
  dormant:          { bg: 'rgba(107,114,128,0.12)',  text: '#6b7280',  border: 'rgba(107,114,128,0.3)' },
  terminated:       { bg: 'rgba(239,68,68,0.12)',    text: '#ef4444',  border: 'rgba(239,68,68,0.3)' },
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
  inspection:        { bg: 'rgba(251,146,60,0.15)',  text: '#fb923c', label: 'Inspection' },
  financing:         { bg: 'rgba(79,142,247,0.15)',  text: '#4F8EF7', label: 'Financing' },
  appraisal:         { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa', label: 'Appraisal' },
  title:             { bg: 'rgba(45,212,191,0.15)',  text: '#2dd4bf', label: 'Title' },
  survey:            { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af', label: 'Survey' },
  closing:           { bg: 'rgba(251,191,36,0.15)',  text: '#fbbf24', label: 'Closing' },
  custom:            { bg: 'rgba(107,114,128,0.12)', text: '#6b7280', label: 'Custom' },
  contingency:       { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', label: 'Contingency' },
  psa_review:        { bg: 'rgba(139,92,246,0.15)',  text: '#a78bfa', label: 'PSA Review' },
  lease_review:      { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', label: 'Lease Review' },
  psa_draft:         { bg: 'rgba(139,92,246,0.10)',  text: '#c4b5fd', label: 'PSA Draft' },
  lease_draft:       { bg: 'rgba(59,130,246,0.10)',  text: '#93c5fd', label: 'Lease Draft' },
  lease_execution:   { bg: 'rgba(45,212,191,0.12)',  text: '#2dd4bf', label: 'Lease Execution' },
  lease_deliverables:{ bg: 'rgba(34,197,94,0.12)',   text: '#22c55e', label: 'Lease Deliverables' },
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
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
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
  colorScheme: 'dark',
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

// Purple orbit button style (Link / Launch)
const orbitBtnStyle: React.CSSProperties = {
  padding: '9px 20px',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.08em',
  background: 'linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(109,40,217,0.35) 100%)',
  border: '1px solid rgba(167,139,250,0.5)',
  borderRadius: 10,
  color: '#c4b5fd',
  cursor: 'pointer',
  fontFamily: 'inherit',
  boxShadow: '0 0 16px rgba(139,92,246,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
  animation: 'orbitPulse 2.8s ease-in-out infinite',
  position: 'relative',
  overflow: 'hidden',
}

const orbitBtnFullStyle: React.CSSProperties = {
  ...orbitBtnStyle,
  width: '100%',
  padding: '13px 16px',
  fontSize: 14,
  textAlign: 'center',
  borderRadius: 10,
}

const sectionHeadStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#E8B84B',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

// ─── PIN Modal ───────────────────────────────────────────────────────────────

function PinModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  const [checking, setChecking] = useState(false)

  async function checkPin(value: string) {
    if (value.length !== 4) return
    setChecking(true)
    const hash = await sha256(value)
    if (hash === PIN_HASH) {
      onConfirm()
    } else {
      setErr(true)
      setPin('')
    }
    setChecking(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4)
    setPin(raw)
    setErr(false)
    if (raw.length === 4) checkPin(raw)
  }

  // Dot indicators
  const dots = [0, 1, 2, 3]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '12vh',
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
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 24 }}>Enter 4-digit PIN</div>

        {/* Dot indicators */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 20 }}>
          {dots.map(i => (
            <div key={i} style={{
              width: 14, height: 14, borderRadius: '50%',
              background: i < pin.length ? '#E8B84B' : 'transparent',
              border: `2px solid ${i < pin.length ? '#E8B84B' : 'rgba(232,184,75,0.3)'}`,
              transition: 'all 0.15s',
            }} />
          ))}
        </div>

        {/* Hidden input — numeric keyboard on iOS */}
        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          value={pin}
          onChange={handleChange}
          autoFocus
          maxLength={4}
          style={{
            position: 'absolute',
            opacity: 0,
            width: 1,
            height: 1,
            pointerEvents: 'none',
          }}
        />

        {/* Tap area to focus the hidden input */}
        <div
          onClick={() => {
            const inp = document.querySelector('input[type="tel"]') as HTMLInputElement | null
            inp?.focus()
          }}
          style={{
            fontSize: 11, color: '#4b5563', marginBottom: 16, cursor: 'pointer',
            letterSpacing: '0.06em',
          }}
        >
          {err ? (
            <span style={{ color: '#ef4444', fontWeight: 700 }}>Incorrect PIN — try again</span>
          ) : checking ? (
            <span style={{ color: '#E8B84B' }}>Checking…</span>
          ) : (
            'Tap here if keyboard doesn\'t appear'
          )}
        </div>

        <button onClick={onCancel} style={{ ...btnStyle('#9ca3af', 'transparent', 'rgba(156,163,175,0.3)'), width: '100%' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Action Button ────────────────────────────────────────────────────────────

function ActionBtn({
  label, color, bg, border, onClick, icon, dim,
}: {
  label: string
  color: string
  bg: string
  border: string
  onClick: () => void
  icon?: React.ReactNode
  dim?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '8px 12px',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        color,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        opacity: dim ? 0.8 : 1,
        transition: 'opacity 0.15s, background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = bg.replace(/[\d.]+\)$/, '0.18)') }}
      onMouseLeave={e => { e.currentTarget.style.opacity = dim ? '0.8' : '1'; e.currentTarget.style.background = bg }}
    >
      {icon}
      {label}
    </button>
  )
}

// ─── Revert Status Button ─────────────────────────────────────────────────────

function RevertStatusButton({
  deal,
  onRevert,
  pinGate,
}: {
  deal: Deal
  onRevert: (status: DealStatus) => Promise<void>
  pinGate: (action: () => void) => void
}) {
  const [open, setOpen] = useState(false)
  const revertableStatuses: DealStatus[] = ['pipeline', 'active', 'in_review', 'in_service', 'hot', 'under_contract']

  async function handleSelect(newStatus: DealStatus) {
    setOpen(false)
    pinGate(async () => {
      await onRevert(newStatus)
      try {
        await supabase.from('activity_log').insert({
          action_type: 'status_reverted',
          description: `Status reverted from ${deal.status} to ${newStatus}`,
          created_by: 'matthew',
        })
      } catch {}
    })
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          padding: '7px 12px',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          background: 'transparent',
          border: '1px solid rgba(156,163,175,0.18)',
          borderRadius: 8,
          color: '#6b7280',
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(156,163,175,0.35)'; e.currentTarget.style.color = '#9ca3af' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(156,163,175,0.18)'; e.currentTarget.style.color = '#6b7280' }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
        Revert Status
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: '#13171D',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          overflow: 'hidden',
          zIndex: 50,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {revertableStatuses.map(s => (
            <button
              key={s}
              onClick={() => handleSelect(s)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '7px 12px',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#6b7280',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#9ca3af' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280' }}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Commission Panel (right column, below Deal Actions) ─────────────────────

function CommissionPanel({ dealId, dealStatus }: { dealId: string; dealStatus?: string }) {
  // Under contract / pending payment / closed → read from uc_details
  const isContracted = ['under_contract', 'pending_payment', 'closed'].includes(dealStatus ?? '')

  // Listing-mode data (deal_economics)
  const [econ, setEcon] = useState<{
    transaction_type: string | null
    sqft: number | null
    asking_price: number | null
    lease_rate_psf: number | null
    lease_term_years: number | null
    lease_commission_pct: number | null
    sale_commission_pct: number | null
    nnn_psf: number | null
  } | null>(null)

  // Contract-mode data (uc_details)
  const [uc, setUc] = useState<{
    deal_category: string | null
    contract_price: number | null
    commission_pct: number | null
    commission_amount: number | null
    lease_rate: number | null
    lease_rate_unit: string | null
    lease_term_months: number | null
  } | null>(null)

  useEffect(() => {
    supabase
      .from('deal_economics')
      .select('transaction_type,sqft,asking_price,lease_rate_psf,lease_term_years,lease_commission_pct,sale_commission_pct,nnn_psf')
      .eq('deal_id', dealId)
      .maybeSingle()
      .then(({ data: d }) => { if (d) setEcon(d as any) })

    supabase
      .from('uc_details')
      .select('deal_category,contract_price,commission_pct,commission_amount,lease_rate,lease_rate_unit,lease_term_months')
      .eq('deal_id', dealId)
      .maybeSingle()
      .then(({ data: d }) => { if (d) setUc(d as any) })
  }, [dealId])

  const $$ = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const pct = (n: number) => n.toFixed(2) + '%'

  const rows: { label: string; value: string; highlight?: boolean }[] = []

  // ── CONTRACT MODE: pull from uc_details ──
  if (isContracted && uc) {
    const isLease = uc.deal_category === 'lease'

    if (isLease) {
      // Lease contract
      if (uc.lease_rate) rows.push({ label: 'Contract Lease Rate', value: `$${uc.lease_rate.toFixed(2)} ${uc.lease_rate_unit ?? 'PSF/YR'}` })
      if (uc.lease_term_months) rows.push({ label: 'Lease Term', value: `${uc.lease_term_months} mo` })
      if (uc.commission_pct) rows.push({ label: 'Commission %', value: pct(uc.commission_pct) })
      if (uc.commission_amount) {
        rows.push({ label: 'Lease Commission', value: $$(uc.commission_amount), highlight: true })
      } else if (uc.commission_pct && uc.lease_rate && uc.lease_term_months) {
        // Fallback: calc from sqft in deal_economics if available
        const sqft = econ?.sqft ?? 0
        const gross = sqft > 0 ? uc.lease_rate * sqft * (uc.lease_term_months / 12) : null
        const calc = gross ? gross * (uc.commission_pct / 100) * 0.75 : null
        if (calc) rows.push({ label: 'Lease Commission', value: $$(calc), highlight: true })
      }
    } else {
      // Sale contract
      if (uc.contract_price) rows.push({ label: 'Contract Price', value: $$(uc.contract_price) })
      if (uc.commission_pct) rows.push({ label: 'Commission %', value: pct(uc.commission_pct) })
      if (uc.commission_amount) {
        rows.push({ label: 'Sale Commission', value: $$(uc.commission_amount), highlight: true })
      } else if (uc.contract_price && uc.commission_pct) {
        const calc = uc.contract_price * (uc.commission_pct / 100) * 0.75
        rows.push({ label: 'Sale Commission', value: $$(calc), highlight: true })
      }
    }
  } else if (econ) {
    // ── LISTING MODE: pull from deal_economics ──
    const sqft = econ.sqft ?? 0
    const isLease = econ.transaction_type === 'lease' || econ.transaction_type === 'both'
    const isSale  = econ.transaction_type === 'sale'  || econ.transaction_type === 'both'

    const leaseGross = sqft > 0 && econ.lease_rate_psf && econ.lease_term_years
      ? econ.lease_rate_psf * sqft * econ.lease_term_years : null
    const leaseComm = leaseGross && econ.lease_commission_pct
      ? leaseGross * (econ.lease_commission_pct / 100) * 0.75 : null
    const saleComm = econ.asking_price && econ.sale_commission_pct
      ? econ.asking_price * (econ.sale_commission_pct / 100) * 0.75 : null

    if (isLease) {
      if (econ.lease_term_years) rows.push({ label: 'Lease Term', value: econ.lease_term_years + ' yrs' })
      if (leaseGross) rows.push({ label: 'Total Lease Value', value: $$(leaseGross) })
      if (econ.lease_commission_pct) rows.push({ label: 'Commission %', value: pct(econ.lease_commission_pct) })
      if (leaseComm) rows.push({ label: 'Lease Commission', value: $$(leaseComm), highlight: true })
    }
    if (isSale) {
      if (econ.asking_price) rows.push({ label: 'Sale Price', value: $$(econ.asking_price) })
      if (econ.sale_commission_pct) rows.push({ label: 'Commission %', value: pct(econ.sale_commission_pct) })
      if (saleComm) rows.push({ label: 'Sale Commission', value: $$(saleComm), highlight: true })
    }
  }

  if (rows.length === 0) return null

  return (
    <div style={{
      background: '#1A1E25',
      border: isContracted ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12,
      padding: '14px 16px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: 'rgba(212,168,71,0.55)',
          fontFamily: 'var(--font-body)',
        }}>
          Commission
        </div>
        {isContracted && (
          <div style={{
            fontSize: 8, fontWeight: 800, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: '#3b82f6',
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 4, padding: '2px 7px',
          }}>
            Under Contract
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {rows.map((row, i) => (
          <div key={row.label} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
            borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          }}>
            <span style={{
              fontSize: 10, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: '#7E9AB0',
            }}>
              {row.label}
            </span>
            <span style={{
              fontSize: row.highlight ? 16 : 13,
              fontWeight: row.highlight ? 800 : 600,
              color: row.highlight ? '#22c55e' : '#F2EDE4',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: row.highlight ? '-0.01em' : '0.02em',
            }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Deal Glance Card (mobile quick-view) ────────────────────────────────────

function DealGlanceCard({ deal }: { deal: Deal }) {
  const [econ, setEcon] = useState<{
    transaction_type: string | null
    sqft: number | null
    asking_price: number | null
    lease_rate_psf: number | null
    lease_type: string | null
    nnn_psf: number | null
  } | null>(null)

  useEffect(() => {
    supabase
      .from('deal_economics')
      .select('transaction_type,sqft,asking_price,lease_rate_psf,lease_type,nnn_psf')
      .eq('deal_id', deal.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setEcon(data as any) })
  }, [deal.id])

  if (!econ) return null

  const sqft = econ.sqft ?? 0
  const isLease = econ.transaction_type === 'lease' || econ.transaction_type === 'both'
  const isSale  = econ.transaction_type === 'sale'  || econ.transaction_type === 'both'
  const isNNN   = econ.lease_type === 'NNN'

  // Lease calcs
  const baseMonthly  = sqft > 0 && econ.lease_rate_psf ? (econ.lease_rate_psf * sqft) / 12 : null
  const nnnMonthly   = sqft > 0 && econ.nnn_psf        ? (econ.nnn_psf * sqft) / 12 : null
  const totalMonthly = baseMonthly != null && nnnMonthly != null ? baseMonthly + nnnMonthly : baseMonthly

  // Sale calcs
  const pricePsf = sqft > 0 && econ.asking_price ? econ.asking_price / sqft : null

  const $ = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const $2 = (n: number) => '$' + n.toFixed(2)
  const fmtSqft = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' SF'

  const statStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  }
  const statLabel: React.CSSProperties = {
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#4b5563',
    whiteSpace: 'nowrap',
  }
  const statVal: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 800,
    color: '#E8B84B',
    fontFamily: 'var(--font-body)',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.1,
  }
  const divider = (
    <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', alignSelf: 'stretch', flexShrink: 0 }} />
  )

  return (
    <div style={{
      background: 'linear-gradient(135deg, #111418 0%, #161B22 100%)',
      border: '1px solid rgba(232,184,75,0.15)',
      borderRadius: 12,
      padding: '14px 16px',
      marginBottom: 16,
      boxShadow: '0 0 0 1px rgba(232,184,75,0.06), 0 4px 24px rgba(0,0,0,0.4)',
    }}>
      {/* Label */}
      <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.4)', marginBottom: 12 }}>
        Quick Glance
      </div>

      {/* SqFt — always, sits above both sections */}
      {sqft > 0 && (
        <div style={{ marginBottom: 10 }}>
          <span style={{ ...statLabel }}>SqFt</span>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#E8B84B', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2, marginTop: 2 }}>
            {fmtSqft(sqft)}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── LEASE SECTION ── */}
        {isLease && (
          <div>
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.55)', marginBottom: 8, borderBottom: '1px solid rgba(232,184,75,0.12)', paddingBottom: 4 }}>
              Lease Details
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {econ.lease_rate_psf && (
                <>
                  <div style={statStyle}>
                    <span style={statLabel}>Rent PSF / yr</span>
                    <span style={statVal}>{$2(econ.lease_rate_psf)}</span>
                  </div>
                  {divider}
                </>
              )}
              {baseMonthly != null && (
                <>
                  <div style={statStyle}>
                    <span style={statLabel}>Base Rent / mo</span>
                    <span style={statVal}>{$(baseMonthly)}</span>
                  </div>
                  {divider}
                </>
              )}
              {isNNN && econ.nnn_psf && (
                <>
                  <div style={statStyle}>
                    <span style={statLabel}>NNN / SF / yr</span>
                    <span style={statVal}>{$2(econ.nnn_psf)}</span>
                  </div>
                  {divider}
                  <div style={statStyle}>
                    <span style={statLabel}>NNN / mo</span>
                    <span style={statVal}>{nnnMonthly != null ? $(nnnMonthly) : '—'}</span>
                  </div>
                  {divider}
                  {totalMonthly != null && (
                    <div style={statStyle}>
                      <span style={statLabel}>Total NNN / mo</span>
                      <span style={{ ...statVal, color: '#22c55e' }}>{$(totalMonthly)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── SALE SECTION ── */}
        {isSale && econ.asking_price && (
          <div>
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.55)', marginBottom: 8, borderBottom: '1px solid rgba(232,184,75,0.12)', paddingBottom: 4 }}>
              Sale Details
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={statStyle}>
                <span style={statLabel}>Asking Price</span>
                <span style={statVal}>{$(econ.asking_price)}</span>
              </div>
              {pricePsf != null && (
                <>
                  {divider}
                  <div style={statStyle}>
                    <span style={statLabel}>Price / SF</span>
                    <span style={statVal}>{$2(pricePsf)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Lease Type Dropdown (custom — native select can't be styled when open) ───

const LEASE_TYPES = ['NNN', 'Modified Gross', 'Full Service', 'Gross', 'Absolute Net']

function LeaseTypeDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'rgba(232,184,75,0.5)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: 6,
          padding: '7px 10px',
          fontSize: 13,
          color: '#F0F2FF',
          outline: 'none',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
      >
        <span>{value}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s', color: 'rgba(232,184,75,0.6)' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Menu */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          zIndex: 9999,
          background: '#1A1E25',
          border: '1px solid rgba(232,184,75,0.25)',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        }}>
          {LEASE_TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => { onChange(t); setOpen(false) }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '9px 12px',
                fontSize: 13,
                color: t === value ? '#E8B84B' : '#F0F2FF',
                background: t === value ? 'rgba(232,184,75,0.08)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: t === value ? 700 : 400,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (t !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { if (t !== value) e.currentTarget.style.background = 'transparent' }}
            >
              {t === value && <span style={{ marginRight: 8, fontSize: 10 }}>✓</span>}
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Deal Economics Card ──────────────────────────────────────────────────────

function DealEconomicsCard({ deal, lacdbAutoFill }: { deal: Deal; lacdbAutoFill?: LacdbListing | null }) {
  const [propertyType, setPropertyType] = useState('Office')
  const [propertyTypeCustom, setPropertyTypeCustom] = useState('')
  const [transactionType, setTransactionType] = useState<'sale' | 'lease' | 'both'>('sale')
  const [sqft, setSqft] = useState('')
  const [acres, setAcres] = useState('')
  const [askingPrice, setAskingPrice] = useState('')
  const [saleCommPct, setSaleCommPct] = useState('3.0')
  const [leaseRatePsf, setLeaseRatePsf] = useState('')
  const [leaseType, setLeaseType] = useState('NNN')
  const [leaseTermYears, setLeaseTermYears] = useState('')
  const [leaseCommPct, setLeaseCommPct] = useState('3.0')
  const [nnnPsf, setNnnPsf] = useState('')       // per SF per year
  const [nnnMonthlyInput, setNnnMonthlyInput] = useState('') // per month (editable)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [econId, setEconId] = useState<string | null>(null)
  const [fillMsg, setFillMsg] = useState<string | null>(null)

  // Auto-fill from LACDB when parent triggers it
  useEffect(() => {
    if (!lacdbAutoFill) return
    const l = lacdbAutoFill

    // Property type mapping
    const ptMap: Record<string, string> = {
      Office: 'Office', Retail: 'Retail', Industrial: 'Industrial',
      Land: 'Vacant Land', 'Vacant Land': 'Vacant Land',
      Hospitality: 'Other', Mixed: 'Other',
    }
    const firstType = l.property_types?.[0] ?? ''
    const mappedType = ptMap[firstType] ?? 'Other'
    setPropertyType(mappedType)

    // Transaction type
    if (l.listing_type === 'sale') setTransactionType('sale')
    else if (l.listing_type === 'lease') setTransactionType('lease')
    else if (l.listing_type === 'both') setTransactionType('both')

    // Size
    if (l.sqft) { setSqft(String(l.sqft)); setAcres((l.sqft / 43560).toFixed(4)) }
    else if (l.acres) { setAcres(String(l.acres)); setSqft((l.acres * 43560).toFixed(0)) }

    // Price / rate
    if (l.price) setAskingPrice(String(l.price))
    if (l.lease_rate) setLeaseRatePsf(String(l.lease_rate))

    // Expand card so user sees the prefill
    setCollapsed(false)
    setFillMsg('✓ Filled from LACDB — review and save')
    setTimeout(() => setFillMsg(null), 4000)
  }, [lacdbAutoFill])

  useEffect(() => {
    async function loadEcon() {
      try {
        const { data, error } = await supabase
          .from('deal_economics')
          .select('*')
          .eq('deal_id', deal.id)
          .maybeSingle()
        if (error || !data) return
        setEconId(data.id)
        setPropertyType(data.property_type ?? 'Office')
        setPropertyTypeCustom(data.property_type_custom ?? '')
        setTransactionType((data.transaction_type ?? 'sale') as 'sale' | 'lease' | 'both')
        setSqft(data.sqft != null ? String(data.sqft) : '')
        if (data.sqft) {
          setAcres((data.sqft / 43560).toFixed(4))
        }
        setAskingPrice(data.asking_price != null ? String(data.asking_price) : '')
        setSaleCommPct(data.sale_commission_pct != null ? String(data.sale_commission_pct) : '3.0')
        setLeaseRatePsf(data.lease_rate_psf != null ? String(data.lease_rate_psf) : '')
        setLeaseType(data.lease_type ?? 'NNN')
        if (data.nnn_psf != null) {
          setNnnPsf(String(data.nnn_psf))
          const sq = data.sqft ?? 0
          if (sq > 0) setNnnMonthlyInput(((data.nnn_psf * sq) / 12).toFixed(2))
        }
        // Auto-collapse if data already saved
        setCollapsed(true)
        setLeaseTermYears(data.lease_term_years != null ? String(data.lease_term_years) : '')
        setLeaseCommPct(data.lease_commission_pct != null ? String(data.lease_commission_pct) : '3.0')
      } catch {}
    }
    loadEcon()
  }, [deal.id])

  const sqftNum = parseFloat(sqft) || 0
  const askingPriceNum = parseFloat(askingPrice) || 0
  const saleCommPctNum = parseFloat(saleCommPct) || 0
  const leaseRatePsfNum = parseFloat(leaseRatePsf) || 0
  const leaseTermYearsNum = parseFloat(leaseTermYears) || 0
  const leaseCommPctNum = parseFloat(leaseCommPct) || 0

  const pricePsf = sqftNum > 0 && askingPriceNum > 0 ? askingPriceNum / sqftNum : null
  const saleCommission = askingPriceNum > 0 ? askingPriceNum * (saleCommPctNum / 100) * 0.75 : null
  const leaseGrossValue = leaseRatePsfNum > 0 && sqftNum > 0 && leaseTermYearsNum > 0
    ? leaseRatePsfNum * sqftNum * leaseTermYearsNum : null
  const leaseCommission = leaseGrossValue != null ? leaseGrossValue * (leaseCommPctNum / 100) * 0.75 : null

  // Format helpers for display fields
  const formatMoney = (n: number | null) => n != null ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—'
  const fmtSqft = (n: number) => n > 0 ? n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' SF' : '—'
  const fmtSalePrice = (n: number) => n > 0 ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—'
  const fmtLeaseRate = (n: number) => n > 0 ? '$' + n.toFixed(2) + ' PSF/yr' : '—'
  const fmtCommPct = (n: number) => n.toFixed(2) + '%'

  async function saveEconomics() {
    setSaving(true)
    try {
      const payload = {
        deal_id: deal.id,
        property_type: propertyType,
        property_type_custom: propertyType === 'Other' ? propertyTypeCustom : null,
        transaction_type: transactionType,
        sqft: sqftNum || null,
        asking_price: askingPriceNum || null,
        sale_commission_pct: saleCommPctNum,
        lease_rate_psf: leaseRatePsfNum || null,
        lease_type: leaseType,
        lease_term_years: leaseTermYearsNum || null,
        lease_commission_pct: leaseCommPctNum,
        nnn_psf: leaseType === 'NNN' ? (parseFloat(nnnPsf) || null) : null,
        updated_at: new Date().toISOString(),
      }
      if (econId) {
        await supabase.from('deal_economics').update(payload).eq('id', econId)
      } else {
        const { data } = await supabase.from('deal_economics').insert(payload).select().single()
        if (data) setEconId(data.id)
      }
      setSaved(true)
      setTimeout(() => { setSaved(false); setCollapsed(true) }, 1000)
    } catch {}
    setSaving(false)
  }

  const calcInputStyle: React.CSSProperties = {
    ...inputStyle,
    background: 'rgba(232,184,75,0.06)',
    color: '#E8B84B',
    cursor: 'default',
  }

  const rowStyle: React.CSSProperties = { display: 'flex', gap: 12, marginBottom: 10 }
  const colStyle: React.CSSProperties = { flex: 1, minWidth: 0 }

  // ── Collapsed summary view ──
  if (collapsed && econId) {
    const isLease = transactionType === 'lease' || transactionType === 'both'
    const isSale  = transactionType === 'sale'  || transactionType === 'both'
    const isNNN   = leaseType === 'NNN'
    const baseMonthly = sqftNum > 0 && leaseRatePsfNum > 0 ? (leaseRatePsfNum * sqftNum) / 12 : null
    const nnnMo = sqftNum > 0 && parseFloat(nnnPsf) > 0 ? (parseFloat(nnnPsf) * sqftNum) / 12 : null
    const $ = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
    const $2 = (n: number) => '$' + n.toFixed(2)

    const rows: { label: string; value: string; highlight?: boolean }[] = []
    if (sqftNum > 0) rows.push({ label: 'SqFt', value: sqftNum.toLocaleString('en-US') + ' SF' })
    if (isSale && askingPriceNum > 0) {
      rows.push({ label: 'Asking Price', value: $(askingPriceNum) })
      if (pricePsf) rows.push({ label: 'Price / SF', value: $2(pricePsf) })
    }
    if (isLease && leaseRatePsfNum > 0) {
      rows.push({ label: 'Lease Rate', value: $2(leaseRatePsfNum) + ' PSF/yr' })
      rows.push({ label: 'Lease Type', value: leaseType })
      if (baseMonthly) rows.push({ label: 'Base Rent / mo', value: $(baseMonthly) })
      if (isNNN && nnnMo) {
        rows.push({ label: 'NNN / mo', value: $(nnnMo) })
        rows.push({ label: 'Total / mo', value: $(baseMonthly! + nnnMo), highlight: true })
      }
      if (leaseTermYearsNum > 0) rows.push({ label: 'Term', value: leaseTermYearsNum + ' yrs' })
    }

    return (
      <div style={{ ...cardStyle, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ ...sectionHeadStyle }}>Deal Economics</span>
          <button
            onClick={() => setCollapsed(false)}
            style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 10px', color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Edit
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px' }}>
          {rows.map(r => (
            <div key={r.label} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 80 }}>
              <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4b5563' }}>{r.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: r.highlight ? '#22c55e' : '#E8B84B', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: fillMsg ? 8 : 14 }}>
        <span style={{ ...sectionHeadStyle }}>Deal Economics</span>
        {econId && (
          <button
            onClick={() => setCollapsed(true)}
            style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 10px', color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Collapse
          </button>
        )}
      </div>
      {fillMsg && (
        <div style={{ fontSize: 12, color: '#22c55e', marginBottom: 12, fontWeight: 600 }}>{fillMsg}</div>
      )}

      {/* Row 1: Property Type + Transaction */}
      <div style={rowStyle}>
        <div style={colStyle}>
          <div style={labelStyle}>Property Type</div>
          <select
            value={propertyType}
            onChange={e => setPropertyType(e.target.value)}
            style={{ ...inputStyle }}
          >
            {['Office', 'Industrial', 'Retail', 'Vacant Land', 'Other'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div style={colStyle}>
          <div style={labelStyle}>Transaction</div>
          <select
            value={transactionType}
            onChange={e => setTransactionType(e.target.value as 'sale' | 'lease' | 'both')}
            style={{ ...inputStyle }}
          >
            <option value="sale">For Sale</option>
            <option value="lease">For Lease</option>
            <option value="both">Both</option>
          </select>
        </div>
      </div>

      {/* Custom property type */}
      {propertyType === 'Other' && (
        <div style={{ marginBottom: 10 }}>
          <div style={labelStyle}>Property Type (Custom)</div>
          <input
            value={propertyTypeCustom}
            onChange={e => setPropertyTypeCustom(e.target.value)}
            placeholder="e.g. Mixed Use"
            style={inputStyle}
          />
        </div>
      )}

      {/* Square Footage / Acreage — dual input for Vacant Land */}
      {propertyType === 'Vacant Land' ? (
        <div style={{ marginBottom: 10 }}>
          <div style={labelStyle}>Size</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Square Feet</div>
              <input
                type="number"
                value={sqft}
                onChange={e => {
                  const v = e.target.value
                  setSqft(v)
                  // Auto-fill acres
                  const sf = parseFloat(v)
                  if (!isNaN(sf) && sf > 0) setAcres((sf / 43560).toFixed(4))
                  else setAcres('')
                }}
                placeholder="e.g. 43560"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: 18, color: 'rgba(255,255,255,0.25)', fontSize: 14, fontWeight: 700 }}>↔</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Acres</div>
              <input
                type="number"
                value={acres}
                onChange={e => {
                  const v = e.target.value
                  setAcres(v)
                  // Auto-fill SF
                  const ac = parseFloat(v)
                  if (!isNaN(ac) && ac > 0) setSqft((ac * 43560).toFixed(0))
                  else setSqft('')
                }}
                placeholder="e.g. 1.00"
                style={inputStyle}
              />
            </div>
          </div>
          {sqftNum > 0 && (
            <div style={{ fontSize: 12, color: '#E8B84B', marginTop: 4, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {sqftNum.toLocaleString()} SF &nbsp;·&nbsp; {(sqftNum / 43560).toFixed(4)} acres
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 10 }}>
          <div style={labelStyle}>Land Size</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Square Feet</div>
              <input
                type="number"
                value={sqft}
                onChange={e => {
                  const v = e.target.value
                  setSqft(v)
                  const sf = parseFloat(v)
                  if (!isNaN(sf) && sf > 0) setAcres((sf / 43560).toFixed(4))
                  else setAcres('')
                }}
                placeholder="e.g. 5000"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: 18, color: 'rgba(255,255,255,0.25)', fontSize: 14, fontWeight: 700 }}>↔</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Acres</div>
              <input
                type="number"
                value={acres}
                onChange={e => {
                  const v = e.target.value
                  setAcres(v)
                  const ac = parseFloat(v)
                  if (!isNaN(ac) && ac > 0) setSqft((ac * 43560).toFixed(0))
                  else setSqft('')
                }}
                placeholder="e.g. 0.11"
                style={inputStyle}
              />
            </div>
          </div>
          {sqftNum > 0 && (
            <div style={{ fontSize: 12, color: '#E8B84B', marginTop: 4, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {sqftNum.toLocaleString()} SF &nbsp;·&nbsp; {(sqftNum / 43560).toFixed(4)} acres
            </div>
          )}
        </div>
      )}

      {/* Sale section */}
      {(transactionType === 'sale' || transactionType === 'both') && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: 8, marginTop: 4 }}>Sale</div>
          <div style={rowStyle}>
            <div style={colStyle}>
              <div style={labelStyle}>Asking Price</div>
              <input
                type="number"
                value={askingPrice}
                onChange={e => setAskingPrice(e.target.value)}
                placeholder="$"
                style={inputStyle}
              />
              {askingPriceNum > 0 && (
                <div style={{ fontSize: 12, color: '#E8B84B', marginTop: 4, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtSalePrice(askingPriceNum)}</div>
              )}
            </div>
            <div style={colStyle}>
              <div style={labelStyle}>Commission %</div>
              <input
                type="number"
                value={saleCommPct}
                onChange={e => setSaleCommPct(e.target.value)}
                step="0.01"
                style={inputStyle}
              />
              {saleCommPctNum > 0 && (
                <div style={{ fontSize: 12, color: '#E8B84B', marginTop: 4, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtCommPct(saleCommPctNum)}</div>
              )}
            </div>
          </div>
          <div style={rowStyle}>
            <div style={colStyle}>
              <div style={labelStyle}>Price / SF</div>
              <input readOnly value={pricePsf != null ? '$' + pricePsf.toFixed(2) : '—'} style={calcInputStyle} />
            </div>
            <div style={colStyle}>
              <div style={labelStyle}>Sale Commission</div>
              <input readOnly value={formatMoney(saleCommission)} style={calcInputStyle} />
            </div>
          </div>
        </div>
      )}

      {/* Lease section */}
      {(transactionType === 'lease' || transactionType === 'both') && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: 8, marginTop: 4 }}>Lease</div>
          <div style={rowStyle}>
            <div style={colStyle}>
              <div style={labelStyle}>Lease Rate PSF/yr</div>
              <input
                type="number"
                value={leaseRatePsf}
                onChange={e => setLeaseRatePsf(e.target.value)}
                placeholder="$"
                style={inputStyle}
              />
              {leaseRatePsfNum > 0 && (
                <div style={{ fontSize: 12, color: '#E8B84B', marginTop: 4, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtLeaseRate(leaseRatePsfNum)}</div>
              )}
            </div>
            <div style={{ ...colStyle, position: 'relative' }}>
              <div style={labelStyle}>Lease Type</div>
              <LeaseTypeDropdown value={leaseType} onChange={setLeaseType} />
            </div>
          </div>
          {/* NNN costs — two-way: type either PSF/yr OR monthly, other auto-fills */}
          {leaseType === 'NNN' && (
            <div style={{ ...rowStyle, marginBottom: 10 }}>
              <div style={colStyle}>
                <div style={labelStyle}>NNN / SF / YR</div>
                <input
                  type="number"
                  value={nnnPsf}
                  onChange={e => {
                    const v = e.target.value
                    setNnnPsf(v)
                    const psf = parseFloat(v)
                    if (psf > 0 && sqftNum > 0) {
                      setNnnMonthlyInput(((psf * sqftNum) / 12).toFixed(2))
                    } else if (!v) {
                      setNnnMonthlyInput('')
                    }
                  }}
                  placeholder="e.g. 4.50"
                  step="0.01"
                  style={inputStyle}
                />
                {parseFloat(nnnPsf) > 0 && (
                  <div style={{ fontSize: 12, color: '#E8B84B', marginTop: 4, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    ${parseFloat(nnnPsf).toFixed(2)} / SF / yr
                  </div>
                )}
              </div>
              <div style={colStyle}>
                <div style={labelStyle}>NNN / MO</div>
                <input
                  type="number"
                  value={nnnMonthlyInput}
                  onChange={e => {
                    const v = e.target.value
                    setNnnMonthlyInput(v)
                    const mo = parseFloat(v)
                    if (mo > 0 && sqftNum > 0) {
                      // back-calc PSF: monthly / sqft * 12
                      setNnnPsf(((mo / sqftNum) * 12).toFixed(4))
                    } else if (!v) {
                      setNnnPsf('')
                    }
                  }}
                  placeholder="e.g. 910"
                  step="0.01"
                  style={inputStyle}
                />
                {parseFloat(nnnMonthlyInput) > 0 && (
                  <div style={{ fontSize: 12, color: '#E8B84B', marginTop: 4, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    ${parseFloat(nnnMonthlyInput).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} / mo
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={rowStyle}>
            <div style={colStyle}>
              <div style={labelStyle}>Lease Term (years)</div>
              <input
                type="number"
                value={leaseTermYears}
                onChange={e => setLeaseTermYears(e.target.value)}
                placeholder="e.g. 5"
                style={inputStyle}
              />
            </div>
            <div style={colStyle}>
              <div style={labelStyle}>Commission %</div>
              <input
                type="number"
                value={leaseCommPct}
                onChange={e => setLeaseCommPct(e.target.value)}
                step="0.01"
                style={inputStyle}
              />
              {leaseCommPctNum > 0 && (
                <div style={{ fontSize: 12, color: '#E8B84B', marginTop: 4, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtCommPct(leaseCommPctNum)}</div>
              )}
            </div>
          </div>
          <div style={rowStyle}>
            <div style={colStyle}>
              <div style={labelStyle}>Gross Lease Value</div>
              <input readOnly value={formatMoney(leaseGrossValue)} style={calcInputStyle} />
            </div>
            <div style={colStyle}>
              <div style={labelStyle}>Lease Commission</div>
              <input readOnly value={formatMoney(leaseCommission)} style={calcInputStyle} />
            </div>
          </div>
        </div>
      )}

      <button
        onClick={saveEconomics}
        disabled={saving}
        style={{ ...btnStyle('#000', '#E8B84B', '#E8B84B'), padding: '9px 20px', fontSize: 12 }}
      >
        {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save Economics'}
      </button>
    </div>
  )
}

// ─── LACDB Card ───────────────────────────────────────────────────────────────

function LacdbCard({ deal, onLacdbIdSave, onAutoFill }: { deal: Deal; onLacdbIdSave: (id: string) => void; onAutoFill?: (listing: LacdbListing) => void }) {
  const [listing, setListing] = useState<LacdbListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(true)
  const [manualId, setManualId] = useState('')
  const [savingManual, setSavingManual] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [editingLink, setEditingLink] = useState(false)
  const [editLinkVal, setEditLinkVal] = useState('')
  // linkedSlug: slug/id that was saved but not yet in DB (show fallback link)
  const [linkedSlug, setLinkedSlug] = useState<string | null>(null)

  async function saveEditLink() {
    if (!editLinkVal.trim()) return
    setSavingManual(true)
    let id = editLinkVal.trim()
    const urlMatch = id.match(/\/listings\/([^/?#]+)/)
    if (urlMatch) id = urlMatch[1]
    await onLacdbIdSave(id)
    setEditingLink(false)
    setEditLinkVal('')
    setReloadKey(k => k + 1)
    setSavingManual(false)
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      let found: LacdbListing | null = null

      // Extract slug saved in deal_source (format: "lacdb:<slug>")
      const savedSlug = deal.deal_source?.startsWith('lacdb:')
        ? deal.deal_source.slice(6)
        : null

      if (savedSlug) {
        // 1. Try exact slug match (primary)
        const { data: bySlug } = await supabase
          .from('lacdb_listings')
          .select('*')
          .eq('lacdb_slug', savedSlug)
          .single()
        if (bySlug) found = bySlug as LacdbListing

        // 2. Try UUID prefix match on lacdb_id (slug starts with UUID)
        if (!found) {
          const uuidPrefix = savedSlug.split('-').slice(0, 5).join('-')
          const { data: byId } = await supabase
            .from('lacdb_listings')
            .select('*')
            .ilike('lacdb_id', `${uuidPrefix}%`)
            .single()
          if (byId) found = byId as LacdbListing
        }

        // 3. Also try matching by lacdb_id column directly
        if (!found) {
          const { data: byLacdbId } = await supabase
            .from('lacdb_listings')
            .select('*')
            .eq('lacdb_id', savedSlug)
            .single()
          if (byLacdbId) found = byLacdbId as LacdbListing
        }
      }

      // 4. Fuzzy match by address (no saved slug)
      if (!found && !savedSlug && deal.address) {
        const numMatch = deal.address.match(/\b(\d{3,5})\b/)
        const streetNum = numMatch ? numMatch[1] : null
        if (streetNum) {
          const { data } = await supabase
            .from('lacdb_listings')
            .select('*')
            .ilike('address', `${streetNum}%`)
            .limit(1)
          if (data && data.length > 0) found = data[0] as LacdbListing
        }
      }

      // Track linked slug for fallback display when not in DB yet
      setLinkedSlug(savedSlug && !found ? savedSlug : null)
      setListing(found)
      setLoading(false)
    }
    load()
  }, [deal.address, deal.deal_source, reloadKey])

  if (loading) return (
    <div style={cardStyle}>
      <div style={{ ...sectionHeadStyle, marginBottom: 12 }}>LACDB Listing</div>
      <div style={{ fontSize: 12, color: '#4b5563' }}>Checking for LACDB match…</div>
    </div>
  )

  if (!listing) return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={sectionHeadStyle}>LACDB Listing</span>
      </div>
      {linkedSlug ? (
        // Linked but not yet synced into DB — show fallback with direct link
        <div style={{
          padding: '14px 16px',
          background: 'rgba(139,92,246,0.06)',
          borderRadius: 8,
          border: '1px solid rgba(139,92,246,0.25)',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, color: '#c4b5fd', fontWeight: 700, marginBottom: 4 }}>✓ Linked</div>
          <div style={{ fontSize: 11, color: '#7c6fa0', marginBottom: 10, wordBreak: 'break-all' }}>{linkedSlug}</div>
          <a
            href={`https://lacdb.resimplifi.com/listings/${linkedSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              background: 'rgba(79,142,247,0.1)',
              border: '1px solid rgba(79,142,247,0.35)',
              borderRadius: 8,
              color: '#4F8EF7',
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            View on LACDB ↗
          </a>
          <div style={{ fontSize: 10, color: '#4b5563', marginTop: 8 }}>Full listing data will appear after next sync</div>
        </div>
      ) : (
        <div style={{
          padding: '16px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 8,
          border: '1px dashed rgba(255,255,255,0.08)',
          textAlign: 'center',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 20, marginBottom: 6, opacity: 0.3 }}>🔗</div>
          <div style={{ fontSize: 12, color: '#4b5563' }}>No LACDB listing linked</div>
          <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>Link manually below</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          value={manualId}
          onChange={e => setManualId(e.target.value)}
          placeholder="Paste LACDB URL or listing ID"
          onKeyDown={async e => {
            if (e.key === 'Enter' && manualId) {
              setSavingManual(true)
              // Extract slug/ID from full URL if pasted
              let id = manualId.trim()
              const urlMatch = id.match(/\/listings\/([^/?#]+)/)
              if (urlMatch) id = urlMatch[1]
              await onLacdbIdSave(id)
              setManualId('')
              setReloadKey(k => k + 1)
              setSavingManual(false)
            }
          }}
        />
        <button
          onClick={async () => {
            if (!manualId) return
            setSavingManual(true)
            let id = manualId.trim()
            const urlMatch = id.match(/\/listings\/([^/?#]+)/)
            if (urlMatch) id = urlMatch[1]
            await onLacdbIdSave(id)
            setManualId('')
            setReloadKey(k => k + 1)
            setSavingManual(false)
          }}
          disabled={savingManual || !manualId}
          style={orbitBtnStyle}
        >
          {savingManual ? 'Saving…' : 'Link'}
        </button>
      </div>
    </div>
  )

  const photo = listing.images?.[0]
  const priceDisplay = listing.price_label || listing.rate_label
  const sizeDisplay = listing.sqft
    ? `${listing.sqft.toLocaleString()} SF`
    : listing.acres
    ? `${listing.acres} ac`
    : null

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={sectionHeadStyle}>LACDB Listing</span>
        <span style={{ fontSize: 10, color: '#4b5563' }}>Synced {timeAgo(listing.synced_at)}</span>
      </div>

      {photo && (
        <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 12, maxHeight: 320 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={listing.name ?? ''}
            style={{ width: '100%', height: 'auto', objectFit: 'contain', maxHeight: 320 }}
          />
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        {listing.name && (
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F2FF', marginBottom: 2 }}>{listing.name}</div>
        )}
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          {[listing.address, listing.city, listing.state].filter(Boolean).join(', ')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        {priceDisplay && (
          <div>
            <div style={labelStyle}>Price / Rate</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#E8B84B' }}>{priceDisplay}</div>
          </div>
        )}
        {sizeDisplay && (
          <div>
            <div style={labelStyle}>Size</div>
            <div style={{ fontSize: 14, color: '#F0F2FF' }}>{sizeDisplay}</div>
          </div>
        )}
      </div>

      {listing.description && (
        <div style={{ marginBottom: 10 }}>
          <div style={labelStyle}>Description</div>
          <div style={{
            fontSize: 12, color: '#9ca3af', lineHeight: 1.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: collapsed ? 3 : undefined,
            WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
          } as React.CSSProperties}>
            {listing.description}
          </div>
          {listing.description.length > 200 && (
            <button
              onClick={() => setCollapsed(c => !c)}
              style={{ fontSize: 11, color: '#4F8EF7', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', marginTop: 4 }}
            >
              {collapsed ? 'Show more ↓' : 'Show less ↑'}
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {listing.lacdb_url && (
          <a
            href={listing.lacdb_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px',
              background: 'rgba(79,142,247,0.1)',
              border: '1px solid rgba(79,142,247,0.35)',
              borderRadius: 8,
              color: '#4F8EF7',
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            View on LACDB ↗
          </a>
        )}
        {onAutoFill && (listing.price || listing.sqft || listing.acres || listing.lease_rate) && (
          <button
            onClick={() => onAutoFill(listing)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.4)',
              borderRadius: 8,
              color: '#22c55e',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            → Fill Economics
          </button>
        )}
        <button
          onClick={() => { setEditingLink(e => !e); setEditLinkVal('') }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px',
            background: 'rgba(156,163,175,0.06)',
            border: '1px solid rgba(156,163,175,0.25)',
            borderRadius: 8,
            color: '#9ca3af',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ✎ Edit Link
        </button>
      </div>

      {editingLink && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <input
            autoFocus
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(232,184,75,0.4)',
              borderRadius: 6,
              padding: '7px 10px',
              fontSize: 13,
              color: '#F0F2FF',
              outline: 'none',
              fontFamily: 'inherit',
            }}
            value={editLinkVal}
            onChange={e => setEditLinkVal(e.target.value)}
            placeholder="Paste new LACDB URL or listing ID"
            onKeyDown={e => { if (e.key === 'Enter') saveEditLink(); if (e.key === 'Escape') setEditingLink(false) }}
          />
          <button
            onClick={saveEditLink}
            disabled={savingManual || !editLinkVal.trim()}
            style={{
              padding: '7px 14px',
              background: 'rgba(232,184,75,0.12)',
              border: '1px solid rgba(232,184,75,0.4)',
              borderRadius: 8,
              color: '#E8B84B',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {savingManual ? 'Saving…' : 'Update'}
          </button>
          <button
            onClick={() => setEditingLink(false)}
            style={{ padding: '7px 12px', background: 'transparent', border: '1px solid rgba(156,163,175,0.2)', borderRadius: 8, color: '#6b7280', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Documents Card ───────────────────────────────────────────────────────────

interface StorageFile {
  name: string
  metadata: { size: number; mimetype: string; lastModified: string } | null
  created_at: string | null
  updated_at: string | null
  id: string | null
}

function DocumentsCard({ deal }: { deal: Deal }) {
  const [files, setFiles] = useState<StorageFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [parsingFile, setParsingFile] = useState<string | null>(null)
  const [parseMsg, setParseMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function parseDeadlines(fileName: string) {
    setParsingFile(fileName)
    setParseMsg(null)
    try {
      const SUPABASE_URL = 'https://mtkyyaorvensylrfbhxv.supabase.co'
      const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a3l5YW9ydmVuc3lscmZiaHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTU0OTUsImV4cCI6MjA4ODc3MTQ5NX0.YqyuBjymYf26cA6JF534NVmsTmdMv7ohB1LBCmdsaJA'
      const res = await fetch(`${SUPABASE_URL}/functions/v1/parse-deadlines`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: deal.id,
          file_path: `deals/${deal.id}/${fileName}`,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setParseMsg({ text: `✓ ${data.deadlines_created} deadlines extracted — check contingency tracker`, ok: true })
      } else {
        setParseMsg({ text: `Error: ${data.error}`, ok: false })
      }
    } catch (e: unknown) {
      setParseMsg({ text: 'Network error', ok: false })
    }
    setParsingFile(null)
    setTimeout(() => setParseMsg(null), 6000)
  }

  const storagePrefix = `deals/${deal.id}`

  const loadFiles = useCallback(async () => {
    const { data } = await supabase.storage.from('deal-documents').list(storagePrefix)
    setFiles((data ?? []) as StorageFile[])
    setLoadingFiles(false)
  }, [storagePrefix])

  useEffect(() => { loadFiles() }, [loadFiles])

  async function uploadFile(file: File) {
    setUploading(true)
    const path = `${storagePrefix}/${file.name}`
    await supabase.storage.from('deal-documents').upload(path, file, { upsert: true })
    await loadFiles()
    setUploading(false)
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    for (const file of Array.from(fileList)) {
      await uploadFile(file)
    }
  }

  async function deleteFile(name: string) {
    await supabase.storage.from('deal-documents').remove([`${storagePrefix}/${name}`])
    setFiles(f => f.filter(x => x.name !== name))
  }

  async function getDownloadUrl(name: string) {
    const { data } = await supabase.storage
      .from('deal-documents')
      .createSignedUrl(`${storagePrefix}/${name}`, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={sectionHeadStyle}>Documents</span>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#E8B84B' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 8,
          padding: '20px',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: 14,
          background: dragging ? 'rgba(232,184,75,0.04)' : 'rgba(255,255,255,0.02)',
          transition: 'all 0.15s',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div style={{ fontSize: 12, color: '#E8B84B' }}>Uploading…</div>
        ) : (
          <>
            <div style={{ fontSize: 20, marginBottom: 4, opacity: 0.4 }}>📎</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Drop files here or click to upload</div>
            <div style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>PDF, Excel, Word, Images</div>
          </>
        )}
      </div>

      {/* Parse message */}
      {parseMsg && (
        <div style={{ marginBottom: 10, fontSize: 12, color: parseMsg.ok ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
          {parseMsg.text}
        </div>
      )}

      {/* File list */}
      {loadingFiles ? (
        <div style={{ fontSize: 12, color: '#4b5563' }}>Loading files…</div>
      ) : files.length === 0 ? (
        <div style={{ fontSize: 12, color: '#4b5563', textAlign: 'center', padding: '8px 0' }}>No files uploaded</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map(f => {
            const isPdf = f.name.toLowerCase().endsWith('.pdf')
            const isUC  = deal.status === 'under_contract'
            return (
            <div key={f.name} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 7,
              border: '1px solid rgba(255,255,255,0.04)',
              flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#F0F2FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </div>
                {f.metadata && (
                  <div style={{ fontSize: 10, color: '#4b5563', marginTop: 1 }}>
                    {formatFileSize(f.metadata.size)}
                    {f.updated_at && ` · ${new Date(f.updated_at).toLocaleDateString()}`}
                  </div>
                )}
              </div>
              {isPdf && isUC && (
                <button
                  onClick={() => parseDeadlines(f.name)}
                  disabled={parsingFile === f.name}
                  style={{ ...btnStyle('#a78bfa', 'rgba(139,92,246,0.1)', 'rgba(139,92,246,0.3)'), padding: '3px 8px', fontSize: 10, opacity: parsingFile === f.name ? 0.5 : 1, whiteSpace: 'nowrap' }}
                >
                  {parsingFile === f.name ? '⟳ Parsing…' : '✦ Parse Deadlines'}
                </button>
              )}
              <button
                onClick={() => getDownloadUrl(f.name)}
                style={{ ...btnStyle('#4F8EF7', 'rgba(79,142,247,0.08)', 'rgba(79,142,247,0.25)'), padding: '3px 8px', fontSize: 10 }}
              >
                ↓
              </button>
              <button
                onClick={() => deleteFile(f.name)}
                style={{ ...btnStyle('#ef4444', 'rgba(239,68,68,0.08)', 'rgba(239,68,68,0.25)'), padding: '3px 8px', fontSize: 10 }}
              >
                ✕
              </button>
            </div>
            )
          })}
        </div>
      )}

      {/* Links section */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {deal.dropbox_link && (
          <a
            href={deal.dropbox_link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 10px', borderRadius: 7, marginBottom: 6,
              background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.2)',
              color: '#2dd4bf', textDecoration: 'none', fontSize: 12, fontWeight: 600,
            }}
          >
            📁 Dropbox Folder ↗
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Contacts Card ────────────────────────────────────────────────────────────

interface DealContactFull extends DealContact {
  contact: Contact
}

function ContactsCard({ deal }: { deal: Deal }) {
  const [contacts, setContacts] = useState<DealContactFull[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Contact[]>([])
  const [searching, setSearching] = useState(false)
  const [newContact, setNewContact] = useState({ name: '', company: '', phone: '', email: '', relationship: '' })
  const [addMode, setAddMode] = useState<'search' | 'new'>('search')

  const loadContacts = useCallback(async () => {
    const { data } = await supabase
      .from('deal_contacts')
      .select('*, contact:contacts(*)')
      .eq('deal_id', deal.id)
    setContacts((data ?? []) as DealContactFull[])
    setLoading(false)
  }, [deal.id])

  useEffect(() => { loadContacts() }, [loadContacts])

  async function searchContacts(q: string) {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .ilike('name', `%${q}%`)
      .limit(10)
    setSearchResults((data ?? []) as Contact[])
    setSearching(false)
  }

  async function linkContact(contactId: string, relationship: string) {
    await supabase.from('deal_contacts').insert({
      deal_id: deal.id,
      contact_id: contactId,
      relationship: relationship || null,
    })
    await loadContacts()
    setShowAdd(false)
    setSearchQuery('')
    setSearchResults([])
  }

  async function addNewContact() {
    if (!newContact.name) return
    const { data: c } = await supabase.from('contacts').insert({
      name: newContact.name,
      company: newContact.company || null,
      phone: newContact.phone || null,
      email: newContact.email || null,
      priority: 'standard',
    }).select().single()
    if (c) {
      await linkContact(c.id, newContact.relationship)
    }
    setNewContact({ name: '', company: '', phone: '', email: '', relationship: '' })
  }

  async function removeContact(dealContactId: string) {
    await supabase.from('deal_contacts').delete().eq('id', dealContactId)
    setContacts(c => c.filter(x => x.id !== dealContactId))
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={sectionHeadStyle}>Contacts</span>
        <button onClick={() => setShowAdd(s => !s)} style={btnStyle('#2dd4bf', 'rgba(45,212,191,0.08)', 'rgba(45,212,191,0.35)')}>
          + Add
        </button>
      </div>

      {showAdd && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
        }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['search', 'new'] as const).map(m => (
              <button
                key={m}
                onClick={() => setAddMode(m)}
                style={{
                  ...btnStyle(addMode === m ? '#000' : '#9ca3af', addMode === m ? '#E8B84B' : 'transparent', addMode === m ? '#E8B84B' : 'rgba(156,163,175,0.3)'),
                  padding: '5px 12px',
                  fontSize: 11,
                }}
              >
                {m === 'search' ? 'Search Existing' : 'Add New'}
              </button>
            ))}
          </div>

          {addMode === 'search' ? (
            <div>
              <input
                style={{ ...inputStyle, marginBottom: 8 }}
                value={searchQuery}
                onChange={e => searchContacts(e.target.value)}
                placeholder="Search contacts by name…"
              />
              {searching && <div style={{ fontSize: 11, color: '#6b7280' }}>Searching…</div>}
              {searchResults.map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 8px', borderRadius: 6, marginBottom: 4,
                  background: 'rgba(255,255,255,0.03)',
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#F0F2FF', fontWeight: 600 }}>{c.name}</div>
                    {c.company && <div style={{ fontSize: 10, color: '#6b7280' }}>{c.company}</div>}
                  </div>
                  <button
                    onClick={() => linkContact(c.id, '')}
                    style={btnStyle('#22c55e', 'rgba(34,197,94,0.08)', 'rgba(34,197,94,0.3)')}
                  >
                    Link
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input style={inputStyle} value={newContact.name} onChange={e => setNewContact(n => ({ ...n, name: e.target.value }))} placeholder="Name*" />
              <input style={inputStyle} value={newContact.company} onChange={e => setNewContact(n => ({ ...n, company: e.target.value }))} placeholder="Company" />
              <input style={inputStyle} value={newContact.phone} onChange={e => setNewContact(n => ({ ...n, phone: e.target.value }))} placeholder="Phone" />
              <input style={inputStyle} value={newContact.email} onChange={e => setNewContact(n => ({ ...n, email: e.target.value }))} placeholder="Email" />
              <input style={inputStyle} value={newContact.relationship} onChange={e => setNewContact(n => ({ ...n, relationship: e.target.value }))} placeholder="Role / Relationship" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowAdd(false)} style={btnStyle('#9ca3af', 'transparent', 'rgba(156,163,175,0.3)')}>Cancel</button>
                <button onClick={addNewContact} disabled={!newContact.name} style={btnStyle('#000', '#E8B84B', '#E8B84B')}>Add Contact</button>
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 12, color: '#4b5563' }}>Loading contacts…</div>
      ) : contacts.length === 0 ? (
        <div style={{ fontSize: 12, color: '#4b5563', textAlign: 'center', padding: '16px 0' }}>No contacts linked</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {contacts.map(dc => (
            <div key={dc.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2FF' }}>{dc.contact.name}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                  {dc.contact.company && <span style={{ fontSize: 10, color: '#6b7280' }}>{dc.contact.company}</span>}
                  {dc.relationship && <span style={{ fontSize: 10, color: '#4F8EF7' }}>{dc.relationship}</span>}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                  {dc.contact.phone && <span style={{ fontSize: 11, color: '#9ca3af' }}>{dc.contact.phone}</span>}
                  {dc.contact.email && <span style={{ fontSize: 11, color: '#9ca3af' }}>{dc.contact.email}</span>}
                </div>
              </div>
              <button
                onClick={() => removeContact(dc.id)}
                style={{ ...btnStyle('#ef4444', 'rgba(239,68,68,0.08)', 'rgba(239,68,68,0.25)'), padding: '3px 8px', fontSize: 10, flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Inner component ──────────────────────────────────────────────────────────

// ─── Save to Contacts Dialog ─────────────────────────────────────────────────

function SaveContactDialog({
  name, firm, dealId, onClose, onSaved,
}: {
  name: string
  firm: string
  dealId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [contactName, setContactName] = useState(name)
  const [contactFirm, setContactFirm] = useState(firm)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const fInput: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
    padding: '8px 10px', fontSize: 13, color: '#F0F2FF',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', colorScheme: 'dark',
  }
  const fLabel: React.CSSProperties = {
    fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: '#6b7280', marginBottom: 4, display: 'block',
  }

  async function save() {
    if (!contactName.trim()) return
    setSaving(true)
    try {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .ilike('name', contactName.trim())
        .limit(1)

      let contactId: string | null = null

      if (existing && existing.length > 0) {
        contactId = existing[0].id
        await supabase.from('contacts').update({
          company: contactFirm.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
        }).eq('id', contactId)
      } else {
        const { data: newContact } = await supabase.from('contacts').insert({
          name: contactName.trim(),
          company: contactFirm.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          priority: 'standard',
        }).select().single()
        if (newContact) contactId = newContact.id
      }

      if (contactId) {
        await supabase.from('deal_contacts').upsert({
          deal_id: dealId,
          contact_id: contactId,
          relationship: 'Co-Broker',
        }, { onConflict: 'deal_id,contact_id' })
      }

      onSaved()
    } catch {}
    setSaving(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#1A1E25',
        border: '1px solid rgba(79,142,247,0.4)',
        borderRadius: 12,
        padding: '22px 24px',
        width: '90vw', maxWidth: 400,
        display: 'flex', flexDirection: 'column', gap: 12,
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#4F8EF7', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Save to Contacts
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div>
          <label style={fLabel}>Name *</label>
          <input style={fInput} value={contactName} onChange={e => setContactName(e.target.value)} autoFocus />
        </div>
        <div>
          <label style={fLabel}>Firm / Company</label>
          <input style={fInput} value={contactFirm} onChange={e => setContactFirm(e.target.value)} placeholder="Brokerage name" />
        </div>
        <div>
          <label style={fLabel}>Cell Phone</label>
          <input style={fInput} value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 225-555-1234" type="tel" />
        </div>
        <div>
          <label style={fLabel}>Email</label>
          <input style={fInput} value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. broker@firm.com" type="email" />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px', fontSize: 12, fontWeight: 700, background: 'transparent', border: '1px solid rgba(156,163,175,0.3)', borderRadius: 8, color: '#9ca3af', cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving || !contactName.trim()} style={{ flex: 2, padding: '9px', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.45)', borderRadius: 8, color: '#4F8EF7', cursor: 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : 'Save Contact'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── UC Broker Row (with Save to Contacts) ───────────────────────────────────

function UCBrokerRow({
  broker, onChange, fInput, dealId, contacts,
}: {
  broker: { name: string; firm: string; pct: string }
  onChange: (updated: { name: string; firm: string; pct: string }) => void
  fInput: React.CSSProperties
  dealId: string
  contacts?: { id: string; name: string; company: string | null }[]
}) {
  const [saved, setSaved] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const listId = `uc-broker-contacts-${dealId}-${Math.random().toString(36).slice(2, 7)}`

  function handleNameChange(val: string) {
    const match = contacts?.find(c => c.name.toLowerCase() === val.toLowerCase())
    if (match) {
      onChange({ ...broker, name: match.name, firm: match.company || broker.firm })
    } else {
      onChange({ ...broker, name: val })
    }
  }

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 72px', gap: 8, marginBottom: 4 }}>
          <div>
            <input style={fInput} placeholder="Broker Name" value={broker.name}
              onChange={e => handleNameChange(e.target.value)}
              list={listId} autoComplete="off" />
            <datalist id={listId}>
              {(contacts || []).map(c => (
                <option key={c.id} value={c.name} label={c.company || undefined} />
              ))}
            </datalist>
          </div>
          <input style={fInput} placeholder="Firm" value={broker.firm}
            onChange={e => onChange({ ...broker, firm: e.target.value })} />
          <input type="number" step="0.01" style={fInput} placeholder="%" value={broker.pct}
            onChange={e => onChange({ ...broker, pct: e.target.value })} />
        </div>
        {broker.name.trim() && (
          <button
            onClick={() => saved ? undefined : setShowDialog(true)}
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
              background: saved ? 'rgba(34,197,94,0.1)' : 'rgba(79,142,247,0.08)',
              border: `1px solid ${saved ? 'rgba(34,197,94,0.35)' : 'rgba(79,142,247,0.3)'}`,
              borderRadius: 5,
              color: saved ? '#22c55e' : '#4F8EF7',
              cursor: saved ? 'default' : 'pointer',
              padding: '3px 10px', fontFamily: 'inherit', transition: 'all 0.2s',
            }}
          >
            {saved ? '✓ Saved to Contacts' : '+ Save to Contacts'}
          </button>
        )}
      </div>
      {showDialog && typeof document !== 'undefined' && createPortal(
        <SaveContactDialog
          name={broker.name}
          firm={broker.firm}
          dealId={dealId}
          onClose={() => setShowDialog(false)}
          onSaved={() => { setSaved(true); setShowDialog(false) }}
        />,
        document.body
      )}
    </>
  )
}

function DealDashboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dealId = searchParams.get('id')

  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [lacdbAutoFill, setLacdbAutoFill] = useState<LacdbListing | null>(null)

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

  // Notes
  const [notesText, setNotesText] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // PIN modal
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null)

  // Earned modal
  const [showEarnedModal, setShowEarnedModal] = useState(false)

  // UC Dialog
  const [showUCDialog, setShowUCDialog] = useState(false)
  const [ucTransactionType, setUCTransactionType] = useState<'sale' | 'lease'>('sale')
  const [ucAvailableTypes, setUCAvailableTypes] = useState<'sale' | 'lease' | 'both'>('sale')
  const [allContacts, setAllContacts] = useState<{ id: string; name: string; company: string | null; phone: string | null; email: string | null }[]>([])
  const [ucForm, setUCForm] = useState({
    contractPrice: '',
    leaseRate: '',
    leaseRateUnit: '$/SF/YR',
    leaseTermMonths: '',
    notes: '',
    commissionPct: '',
    commissionAmount: '',
    cobrokeListingOn: false,
    cobrokeBuyerOn: false,
    dualRep: false,
    listingBrokers: [{ name: '', firm: '', pct: '' }],
    buyerBrokers: [{ name: '', firm: '', pct: '' }],
  })

  // Copied ID state
  const [copiedId, setCopiedId] = useState(false)

  const loadDeal = useCallback(async () => {
    if (!dealId) { setNotFound(true); setLoading(false); return }
    const { data, error } = await supabase.from('deals').select('*').eq('id', dealId).single()
    if (error || !data) {
      setNotFound(true)
    } else {
      setDeal(data as Deal)
      setNotesText((data as Deal).notes ?? '')
    }
    setLoading(false)
  }, [dealId])

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
      dropbox_link: deal.dropbox_link ?? '',
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
      setNotesText((data as Deal).notes ?? '')
      setEditing(false)
    }
    setSaving(false)
  }

  async function saveNotes() {
    if (!deal) return
    setSavingNotes(true)
    const { data, error } = await supabase
      .from('deals')
      .update({ notes: notesText, updated_at: new Date().toISOString() })
      .eq('id', deal.id)
      .select()
      .single()
    if (!error && data) setDeal(data as Deal)
    setSavingNotes(false)
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

  // ── Status/Tier actions ──

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

  async function openUCDialogWithContacts() {
    setShowUCDialog(true)

    // Load deal_economics to determine transaction type + pre-fill commission
    const { data: econ } = await supabase
      .from('deal_economics')
      .select('transaction_type, sale_commission_pct, lease_commission_pct, asking_price, lease_rate_psf, sqft, lease_term_years')
      .eq('deal_id', deal?.id || '')
      .maybeSingle()

    // Determine available types from economics, fall back to deal.type
    let available: 'sale' | 'lease' | 'both' = 'sale'
    if (econ?.transaction_type === 'lease') available = 'lease'
    else if (econ?.transaction_type === 'both') available = 'both'
    else {
      const typeStr = (deal?.type || '').toLowerCase()
      if (typeStr.includes('lease') || typeStr.includes('tenant')) available = 'lease'
    }
    setUCAvailableTypes(available)

    // Default to sale unless it's lease-only
    const defaultType = available === 'lease' ? 'lease' : 'sale'
    setUCTransactionType(defaultType)

    // Pre-fill commission from deal economics
    if (econ) {
      const commPct = defaultType === 'lease'
        ? (econ.lease_commission_pct ?? '')
        : (econ.sale_commission_pct ?? '')
      const commAmt = defaultType === 'sale' && econ.asking_price && econ.sale_commission_pct
        ? String(Math.round(econ.asking_price * (econ.sale_commission_pct / 100) * 0.75))
        : defaultType === 'lease' && econ.lease_rate_psf && econ.sqft && econ.lease_term_years && econ.lease_commission_pct
        ? String(Math.round(econ.lease_rate_psf * econ.sqft * econ.lease_term_years * (econ.lease_commission_pct / 100) * 0.75))
        : ''
      setUCForm(f => ({ ...f, commissionPct: commPct ? String(commPct) : '', commissionAmount: commAmt }))
    }

    // Load all contacts for autocomplete
    const { data } = await supabase.from('contacts').select('id,name,company,phone,email').order('name')
    if (data) setAllContacts(data as typeof allContacts)
  }

  async function submitUCDialog() {
    if (!deal) return
    const isLease = ucTransactionType === 'lease'

    // Validate required fields
    if (isLease) {
      if (!ucForm.leaseRate || !ucForm.leaseTermMonths) {
        alert('Lease rate and term are required')
        return
      }
    } else {
      if (!ucForm.contractPrice) {
        alert('Contract price is required')
        return
      }
    }

    // Save uc_details
    const ucPayload: Record<string, unknown> = {
      deal_id: deal.id,
      deal_category: isLease ? 'lease' : 'sale',
      notes: ucForm.notes || null,
      dual_rep: ucForm.dualRep || false,
      commission_pct: parseFloat(ucForm.commissionPct) || null,
      commission_amount: parseFloat(ucForm.commissionAmount) || null,
    }
    if (isLease) {
      ucPayload.lease_rate = parseFloat(ucForm.leaseRate)
      ucPayload.lease_rate_unit = ucForm.leaseRateUnit
      ucPayload.lease_term_months = parseInt(ucForm.leaseTermMonths)
    } else {
      ucPayload.contract_price = parseFloat(ucForm.contractPrice)
    }

    await supabase.from('uc_details').upsert(ucPayload, { onConflict: 'deal_id' })

    // Save co-brokers
    const sides: Array<{ key: 'cobrokeListingOn' | 'cobrokeBuyerOn'; brokerKey: 'listingBrokers' | 'buyerBrokers'; side: string }> = [
      { key: 'cobrokeListingOn', brokerKey: 'listingBrokers', side: 'listing' },
      { key: 'cobrokeBuyerOn', brokerKey: 'buyerBrokers', side: isLease ? 'tenant' : 'buyer' },
    ]
    for (const s of sides) {
      if (!ucForm[s.key]) continue
      const brokers = ucForm[s.brokerKey]
      for (let i = 0; i < brokers.length; i++) {
        const b = brokers[i]
        if (!b.name || !b.firm || !b.pct) continue
        await supabase.from('co_brokers').insert({
          deal_id: deal.id,
          side: s.side,
          broker_name: b.name,
          broker_firm: b.firm,
          commission_pct: parseFloat(b.pct),
          sort_order: i,
        })
      }
    }

    // Update deal status
    const { data, error } = await supabase
      .from('deals')
      .update({ status: 'under_contract', updated_at: new Date().toISOString() })
      .eq('id', deal.id)
      .select()
      .single()
    if (!error && data) setDeal(data as Deal)

    // Activity log
    const desc = isLease
      ? `Under Contract — Lease: ${ucForm.leaseRate} ${ucForm.leaseRateUnit}, ${ucForm.leaseTermMonths} months`
      : `Under Contract — Sale: $${parseFloat(ucForm.contractPrice).toLocaleString()}`
    await supabase.from('activity_log').insert({
      deal_id: deal.id,
      action_type: 'under_contract',
      description: desc,
      created_by: 'matthew',
    })

    // Reset and close
    setShowUCDialog(false)
    setUCForm({
      contractPrice: '', leaseRate: '', leaseRateUnit: '$/SF/YR', leaseTermMonths: '',
      notes: '', commissionPct: '', commissionAmount: '', cobrokeListingOn: false, cobrokeBuyerOn: false, dualRep: false,
      listingBrokers: [{ name: '', firm: '', pct: '' }],
      buyerBrokers: [{ name: '', firm: '', pct: '' }],
    })
  }

  async function doLaunch() {
    if (!deal) return
    const updates: Partial<Deal> & { updated_at: string } = {
      tier: 'filed',
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('deals')
      .update(updates)
      .eq('id', deal.id)
      .select()
      .single()
    if (!error && data) {
      setDeal(data as Deal)
      if (!deal.dropbox_link) {
        await supabase.from('folder_queue').insert({
          deal_id: deal.id,
          action: 'create',
          folder_name: deal.address || deal.name,
          folder_path: deal.address || deal.name,
          status: 'pending',
        })
      }
    }
  }

  async function doLanded() {
    if (!deal) return
    const { data, error } = await supabase
      .from('deals')
      .update({ status: 'pending_payment', updated_at: new Date().toISOString() })
      .eq('id', deal.id)
      .select()
      .single()
    if (!error && data) {
      setDeal(data as Deal)
      // Write to activity log
      try {
        await supabase.from('activity_log').insert({
          deal_id: deal.id,
          action_type: 'landed',
          description: 'Deal moved to Pending Payment — commission earned',
          created_by: 'matthew',
        })
      } catch {}
    }
  }

  async function doKillAction(newStatus: DealStatus, destination: string) {
    if (!deal) return
    const { data, error } = await supabase
      .from('deals')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', deal.id)
      .select()
      .single()
    if (!error && data) {
      setDeal(data as Deal)
      await supabase.from('folder_queue').insert({
        deal_id: deal.id,
        action: 'move',
        folder_name: deal.address || deal.name,
        folder_path: destination,
        status: 'pending',
      })
    }
  }

  function pinGate(action: () => void) {
    setPendingAction(() => action)
  }

  function copyId() {
    if (!deal) return
    navigator.clipboard.writeText(deal.id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 1800)
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0D0F14', color: '#F0F2FF' }}>
      <div style={{ padding: 32 }}>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} } @keyframes orbitPulse { 0%,100%{box-shadow:0 0 16px rgba(139,92,246,0.3),inset 0 1px 0 rgba(255,255,255,0.06)} 50%{box-shadow:0 0 28px rgba(139,92,246,0.55),0 0 8px rgba(167,139,250,0.25),inset 0 1px 0 rgba(255,255,255,0.1)} }`}</style>
        <div style={{ width: '60%', height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.07)', marginBottom: 10, animation: 'pulse 1.6s ease-in-out infinite' }} />
        <div style={{ width: '35%', height: 18, borderRadius: 6, background: 'rgba(255,255,255,0.07)', animation: 'pulse 1.6s ease-in-out infinite' }} />
      </div>
    </div>
  )

  if (notFound) return (
    <div style={{
      minHeight: '100vh', background: '#0D0F14', color: '#F0F2FF',
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

  return (
    <>
    <div style={{
      minHeight: '100vh',
      background: '#0D0F14',
      color: '#F0F2FF',
      fontFamily: 'var(--font-body, system-ui, sans-serif)',
    }}>
      <style>{`@keyframes orbitPulse { 0%,100%{box-shadow:0 0 16px rgba(139,92,246,0.3),inset 0 1px 0 rgba(255,255,255,0.06)} 50%{box-shadow:0 0 28px rgba(139,92,246,0.55),0 0 8px rgba(167,139,250,0.25),inset 0 1px 0 rgba(255,255,255,0.1)} }`}</style>
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

        {/* Address / Name */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{
            fontSize: 'clamp(16px, 2.5vw, 22px)',
            fontWeight: 800,
            color: '#E8B84B',
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

          {/* Edit toggle */}
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
      </header>

      {/* ── UNDER CONTRACT BANNER ── */}
      {deal.status === 'under_contract' && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(45,212,191,0.18) 0%, rgba(20,184,166,0.28) 100%)',
          border: '1px solid rgba(45,212,191,0.55)',
          borderLeft: '5px solid #2dd4bf',
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#2dd4bf', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              Under Contract
            </div>
            <div style={{ fontSize: 12, color: 'rgba(45,212,191,0.65)', marginTop: 2, letterSpacing: '0.05em' }}>
              {deal.address || deal.name} — monitor deadlines closely
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Glance — full width, top of page ── */}
      <div style={{ padding: '0 24px', maxWidth: 1400, margin: '0 auto' }}>
        <DealGlanceCard deal={deal} />
      </div>

      {/* ── UC PRIORITY SECTIONS: Deadlines + Documents (top of page, full width) ── */}
      {deal.status === 'under_contract' && (
        <div style={{ padding: '0 24px', maxWidth: 1400, margin: '0 auto' }}>

          {/* CONTRACT DEADLINES — Prominent full-width card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(45,212,191,0.08) 0%, rgba(20,184,166,0.14) 100%)',
            border: '2px solid rgba(45,212,191,0.45)',
            borderRadius: 14,
            padding: '20px 24px',
            marginBottom: 16,
            boxShadow: '0 0 32px rgba(45,212,191,0.12)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#2dd4bf', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Contract Deadlines
                </span>
              </div>
              <button
                onClick={() => setShowAddDeadline(s => !s)}
                style={{
                  padding: '7px 16px', fontSize: 12, fontWeight: 700,
                  background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.5)',
                  borderRadius: 8, color: '#2dd4bf', cursor: 'pointer', fontFamily: 'inherit',
                  letterSpacing: '0.06em',
                }}
              >
                + Add
              </button>
            </div>

            {/* Add Deadline Form */}
            {showAddDeadline && (
              <div style={{
                background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(45,212,191,0.2)',
                borderRadius: 10, padding: 16, marginBottom: 16,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input style={inputStyle} value={newDeadline.label} onChange={e => setNewDeadline(d => ({ ...d, label: e.target.value }))} placeholder="Label (e.g. Inspection)" />
                  <input type="date" style={inputStyle} value={newDeadline.deadline_date} onChange={e => setNewDeadline(d => ({ ...d, deadline_date: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <select style={inputStyle} value={newDeadline.deadline_type} onChange={e => setNewDeadline(d => ({ ...d, deadline_type: e.target.value as DeadlineType }))}>
                    {(Object.keys(DEADLINE_TYPE_COLORS) as DeadlineType[]).map(t => (
                      <option key={t} value={t}>{DEADLINE_TYPE_COLORS[t].label}</option>
                    ))}
                  </select>
                  <input style={inputStyle} value={newDeadline.notes} onChange={e => setNewDeadline(d => ({ ...d, notes: e.target.value }))} placeholder="Notes (optional)" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowAddDeadline(false)} style={btnStyle('#9ca3af', 'transparent', 'rgba(156,163,175,0.3)')}>Cancel</button>
                  <button onClick={addDeadline} disabled={addingDeadline || !newDeadline.label || !newDeadline.deadline_date} style={btnStyle('#000', '#2dd4bf', '#2dd4bf')}>
                    {addingDeadline ? 'Adding…' : 'Add Deadline'}
                  </button>
                </div>
              </div>
            )}

            {/* Deadline rows */}
            {deadlines.length === 0 ? (
              <div style={{ fontSize: 13, color: 'rgba(45,212,191,0.45)', textAlign: 'center', padding: '24px 0' }}>
                No deadlines yet — add your first deadline above
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {deadlines.map(dl => {
                  const days = daysUntil(dl.deadline_date)
                  const satisfied = dl.status === 'satisfied'
                  const daysColor = satisfied ? '#6b7280'
                    : days < 0 ? '#ef4444'
                    : days === 0 ? '#ef4444'
                    : days <= 3 ? '#ef4444'
                    : days <= 7 ? '#fb923c'
                    : '#9ca3af'
                  const daysLabel = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'TODAY' : `${days}d`
                  return (
                    <div key={dl.id} style={{
                      display: 'flex', flexDirection: 'column', gap: 0,
                      padding: '14px 16px',
                      background: 'rgba(0,0,0,0.25)',
                      border: `1px solid ${satisfied ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.09)'}`,
                      borderRadius: 10,
                      opacity: satisfied ? 0.55 : 1,
                    }}>
                      {/* DATE — big, prominent */}
                      <div style={{
                        fontSize: 17, fontWeight: 900,
                        color: satisfied ? '#6b7280' : '#F0F2FF',
                        letterSpacing: '-0.01em',
                        textDecoration: satisfied ? 'line-through' : 'none',
                        marginBottom: 4,
                        lineHeight: 1.1,
                      }}>
                        {formatDate(dl.deadline_date)}
                      </div>

                      {/* TITLE — full text, wraps freely */}
                      <div style={{
                        fontSize: 13, fontWeight: 600,
                        color: satisfied ? '#4b5563' : '#9ca3af',
                        lineHeight: 1.4,
                        textDecoration: satisfied ? 'line-through' : 'none',
                        marginBottom: 10,
                        wordBreak: 'break-word',
                      }}>
                        {dl.label}
                      </div>

                      {/* BOTTOM ROW: countdown + actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Days badge */}
                        {!satisfied ? (
                          <span style={{
                            fontSize: 12, fontWeight: 800,
                            color: daysColor,
                            fontFamily: 'monospace',
                            flex: 1,
                          }}>
                            {daysLabel}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', letterSpacing: '0.06em', textTransform: 'uppercase', flex: 1 }}>
                            ✓ Satisfied
                          </span>
                        )}

                        {/* Action buttons */}
                        {!satisfied && (
                          <button onClick={() => satisfyDeadline(dl.id)} title="Mark satisfied" style={{ padding: '5px 12px', fontSize: 14, fontWeight: 700, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 6, color: '#22c55e', cursor: 'pointer', flexShrink: 0 }}>✓</button>
                        )}
                        <button onClick={() => deleteDeadline(dl.id)} title="Delete" style={{ padding: '5px 12px', fontSize: 14, fontWeight: 700, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}>✕</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* DOCUMENTS — Prominent full-width section */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingLeft: 4 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8B84B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#E8B84B', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Documents
              </span>
            </div>
            <DocumentsCard deal={deal} />
          </div>

        </div>
      )}

      {/* ── Mobile-only action strip — deal actions hidden on desktop right col ── */}
      <div className="sm:hidden" style={{ padding: '0 24px 16px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Launch — tracked deals */}
        {deal.tier === 'tracked' && (
          <button
            onClick={() => pinGate(() => doLaunch())}
            style={{
              width: '100%',
              padding: '13px 16px',
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.35) 0%, rgba(109,40,217,0.48) 100%)',
              border: '1px solid rgba(167,139,250,0.55)',
              borderRadius: 10,
              color: '#c4b5fd',
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 0 24px rgba(139,92,246,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 3A10.5 10.5 0 0 1 21 14.5"/><path d="M3 9.5A10.5 10.5 0 0 1 14.5 21"/>
              <path d="m3 16 5 5"/><path d="M3 16h5v5"/><circle cx="17" cy="7" r="3"/>
            </svg>
            Launch Deal
          </button>
        )}
        {/* → Hot */}
        {deal.tier === 'filed' && deal.status === 'active' && (
          <button
            onClick={() => pinGate(() => doStatusChange('hot'))}
            style={{ width: '100%', padding: '11px', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.4)', borderRadius: 10, color: '#fb923c', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}
          >
            → Hot
          </button>
        )}
        {/* → Under Contract */}
        {deal.tier === 'filed' && (deal.status === 'active' || deal.status === 'hot') && (
          <button
            onClick={() => pinGate(() => openUCDialogWithContacts())}
            style={{ width: '100%', padding: '11px', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.4)', borderRadius: 10, color: '#2dd4bf', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}
          >
            → Under Contract
          </button>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col sm:flex-row sm:items-start" style={{
        gap: 20,
        padding: '0 24px 24px',
        maxWidth: 1400,
        margin: '0 auto',
      }}>

        {/* ── LEFT COLUMN ── */}
        <div className="w-full sm:w-[65%]" style={{ minWidth: 0 }}>

          {/* LACDB Card — first */}
          <LacdbCard
            deal={deal}
            onLacdbIdSave={async (lacdbId) => {
              const { data, error } = await supabase
                .from('deals')
                .update({ deal_source: `lacdb:${lacdbId}`, updated_at: new Date().toISOString() })
                .eq('id', deal.id)
                .select()
                .single()
              if (!error && data) setDeal(data as Deal)
            }}
            onAutoFill={(listing) => setLacdbAutoFill(listing)}
          />

          {/* Deal Economics — below LACDB */}
          <DealEconomicsCard deal={deal} lacdbAutoFill={lacdbAutoFill} />

          {/* Deal Info Card */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={sectionHeadStyle}>Deal Info</span>
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

              {/* Client */}
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
                  <div style={valueStyle}>{deal.deal_source?.startsWith('lacdb:') ? `LACDB: ${deal.deal_source.slice(6)}` : deal.deal_source || '—'}</div>
                )}
              </div>

              {/* Dropbox Link */}
              <div>
                <div style={labelStyle}>Dropbox Link</div>
                {editing ? (
                  <input style={inputStyle} value={(editForm.dropbox_link as string) ?? ''} onChange={e => setEditForm(f => ({ ...f, dropbox_link: e.target.value }))} placeholder="https://www.dropbox.com/…" />
                ) : deal.dropbox_link ? (
                  <a href={deal.dropbox_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#2dd4bf' }}>Open ↗</a>
                ) : (
                  <div style={{ ...valueStyle, color: '#4b5563' }}>—</div>
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

          {/* Documents Card — shown in left column only when NOT under contract (UC gets it at top) */}
          {deal.status !== 'under_contract' && (
            <DocumentsCard deal={deal} />
          )}

          {/* Notes / Activity Log */}
          <div style={cardStyle}>
            <div style={{ ...sectionHeadStyle, marginBottom: 14 }}>Notes</div>
            <textarea
              style={{ ...inputStyle, minHeight: 100, resize: 'vertical', marginBottom: 10 }}
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="Add notes here…"
            />
            <button
              onClick={saveNotes}
              disabled={savingNotes || notesText === (deal.notes ?? '')}
              style={btnStyle('#000', '#E8B84B', '#E8B84B')}
            >
              {savingNotes ? 'Saving…' : 'Save Notes'}
            </button>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ ...sectionHeadStyle, marginBottom: 12 }}>Activity Log</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: 8 }}>
                <div style={{ fontSize: 24, opacity: 0.2 }}>📋</div>
                <div style={{ fontSize: 12, color: '#4b5563' }}>Activity log coming soon</div>
                <div style={{ fontSize: 11, color: '#374151' }}>All deal activity will be tracked here</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN — visible on all screens (stacks below left on mobile) ── */}
        <div className="w-full sm:w-[35%]" style={{ minWidth: 0 }}>

          {/* ── PROSPECTS — big prominent button ── */}
          <button
            onClick={() => router.push(`/warroom/deal/prospects?id=${deal.id}`)}
            style={{
              width: '100%',
              marginBottom: 16,
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: 'linear-gradient(135deg, rgba(79,142,247,0.14) 0%, rgba(59,130,246,0.22) 100%)',
              border: '1px solid rgba(79,142,247,0.5)',
              borderRadius: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 0 24px rgba(79,142,247,0.12)',
              textAlign: 'left',
            }}
          >
            {/* Icon */}
            <div style={{
              width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(79,142,247,0.18)',
              border: '1px solid rgba(79,142,247,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F8EF7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            {/* Text */}
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#4F8EF7', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>
                Prospects
              </div>
              <div style={{ fontSize: 11, color: 'rgba(79,142,247,0.6)', fontWeight: 600 }}>
                Buyers · Tenants · Interested Parties
              </div>
            </div>
            {/* Arrow */}
            <div style={{ marginLeft: 'auto', color: 'rgba(79,142,247,0.5)', fontSize: 18 }}>›</div>
          </button>

          {/* Deal Actions Card */}
          <div style={{
            background: '#1A1E25',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 16,
          }}>
            {/* Header */}
            <div style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(232,184,75,0.5)',
              marginBottom: 12,
              fontFamily: 'var(--font-body)',
            }}>
              Deal Actions
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

              {/* Launch */}
              {deal.tier === 'tracked' && (
                <ActionBtn
                  label="Launch"
                  color="#A78BFA"
                  bg="rgba(139,92,246,0.12)"
                  border="rgba(139,92,246,0.4)"
                  onClick={() => pinGate(() => doLaunch())}
                  icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 3A10.5 10.5 0 0 1 21 14.5"/><path d="M3 9.5A10.5 10.5 0 0 1 14.5 21"/><path d="m3 16 5 5"/><path d="M3 16h5v5"/><circle cx="17" cy="7" r="3"/></svg>}
                />
              )}

              {/* → Hot */}
              {deal.tier === 'filed' && deal.status === 'active' && (
                <ActionBtn
                  label="→ Hot"
                  color="#fb923c"
                  bg="rgba(251,146,60,0.08)"
                  border="rgba(251,146,60,0.35)"
                  onClick={() => pinGate(() => doStatusChange('hot'))}
                />
              )}

              {/* → Under Contract */}
              {deal.tier === 'filed' && (deal.status === 'active' || deal.status === 'hot') && (
                <ActionBtn
                  label="→ Under Contract"
                  color="#2dd4bf"
                  bg="rgba(45,212,191,0.08)"
                  border="rgba(45,212,191,0.35)"
                  onClick={() => pinGate(() => openUCDialogWithContacts())}
                />
              )}

              {/* LANDED — under_contract only */}
              {deal.status === 'under_contract' && (
                <ActionBtn
                  label="LANDED"
                  color="#22c55e"
                  bg="rgba(34,197,94,0.12)"
                  border="rgba(34,197,94,0.45)"
                  onClick={() => pinGate(() => doLanded())}
                  icon={
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  }
                />
              )}

              {/* Earned — Commission section */}
              {deal.tier === 'filed' && (
                <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(34,197,94,0.5)', marginBottom: 6 }}>Commission</div>
                  {(deal as any).earned ? (
                    <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>✓ Earned — AR item created</div>
                  ) : (
                    <ActionBtn
                      label="Mark as EARNED"
                      color="#22c55e"
                      bg="rgba(34,197,94,0.1)"
                      border="rgba(34,197,94,0.35)"
                      onClick={() => setShowEarnedModal(true)}
                    />
                  )}
                </div>
              )}

              {/* Kill zone */}
              {deal.tier === 'filed' && (deal.type === 'active_listing' || deal.type === 'listing' || deal.dropbox_link) && (
                <div style={{
                  marginTop: 4,
                  paddingTop: 10,
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                }}>
                  <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#374151', marginBottom: 2 }}>
                    End Deal
                  </div>
                  {(deal.type === 'active_listing' || deal.type === 'listing') && (
                    <ActionBtn
                      label="Expire"
                      color="#fb923c"
                      bg="rgba(251,146,60,0.05)"
                      border="rgba(251,146,60,0.2)"
                      onClick={() => pinGate(() => doKillAction('expired', 'X - Expired Listings'))}
                      dim
                    />
                  )}
                  {deal.type !== 'active_listing' && deal.type !== 'listing' && (
                    <ActionBtn
                      label="Dormant"
                      color="#fb923c"
                      bg="rgba(251,146,60,0.05)"
                      border="rgba(251,146,60,0.2)"
                      onClick={() => pinGate(() => doKillAction('dormant', 'X - Dormant Projects'))}
                      dim
                    />
                  )}
                  {deal.dropbox_link && (
                    <ActionBtn
                      label="Terminate"
                      color="#ef4444"
                      bg="rgba(239,68,68,0.05)"
                      border="rgba(239,68,68,0.2)"
                      onClick={() => pinGate(() => doKillAction('terminated', 'X - Terminated'))}
                      dim
                    />
                  )}
                </div>
              )}

              {/* Revert Status */}
              {deal.tier === 'filed' && (
                <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <RevertStatusButton deal={deal} onRevert={doStatusChange} pinGate={pinGate} />
                </div>
              )}

              {/* No actions */}
              {deal.tier !== 'tracked' && deal.tier !== 'filed' && (
                <div style={{ fontSize: 11, color: '#374151', textAlign: 'center', padding: '12px 0', fontStyle: 'italic' }}>
                  No actions available
                </div>
              )}
            </div>
          </div>

          {/* Commission Panel */}
          <CommissionPanel dealId={deal.id} dealStatus={deal.status} />

          {/* Contacts */}
          <ContactsCard deal={deal} />

          {/* Deadlines are shown at top of page when UC — no duplicate here */}

          {/* Metadata */}
          <div style={{ ...cardStyle, background: 'transparent', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4b5563', marginBottom: 10 }}>
              Metadata
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                <span style={{ color: '#6b7280' }}>Deal ID</span>
                <button
                  onClick={copyId}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: copiedId ? '#22c55e' : '#4b5563',
                    fontFamily: 'monospace', fontSize: 10,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                  title="Copy ID"
                >
                  {deal.id.slice(0, 8)}…
                  <span style={{ fontSize: 9 }}>{copiedId ? '✓' : '⎘'}</span>
                </button>
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

    {/* Earned Modal Portal */}
    {showEarnedModal && deal && typeof document !== 'undefined' && createPortal(
      <EarnedModal
        deal={deal}
        onClose={() => setShowEarnedModal(false)}
        onSaved={(updatedDeal) => {
          setDeal(updatedDeal)
          setShowEarnedModal(false)
        }}
      />,
      document.body
    )}

    {/* UC Dialog */}
    {showUCDialog && deal && typeof document !== 'undefined' && createPortal(
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '8vh', paddingBottom: '6vh', overflowY: 'auto',
      }} onClick={() => setShowUCDialog(false)}>
        <div style={{
          background: '#1A1E25',
          border: '1px solid rgba(45,212,191,0.35)',
          borderRadius: 14,
          padding: '24px 28px',
          width: '90vw', maxWidth: 480,
          display: 'flex', flexDirection: 'column', gap: 14,
        }} onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#2dd4bf', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Under Contract — Deal Economics
            </div>
            <button onClick={() => setShowUCDialog(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
          </div>

          {(() => {
            const isLease = ucTransactionType === 'lease'
            const fLabel: React.CSSProperties = { fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4, display: 'block' }
            const fInput: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: '#F0F2FF', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', colorScheme: 'dark' }

            return (
              <>
                {/* Sale / Lease toggle — only show when deal supports both */}
                {ucAvailableTypes === 'both' && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                    {(['sale', 'lease'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setUCTransactionType(t)}
                        style={{
                          flex: 1, padding: '9px', fontSize: 12, fontWeight: 800,
                          letterSpacing: '0.08em', textTransform: 'uppercase',
                          background: ucTransactionType === t
                            ? (t === 'sale' ? 'rgba(45,212,191,0.18)' : 'rgba(167,139,250,0.18)')
                            : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${ucTransactionType === t
                            ? (t === 'sale' ? 'rgba(45,212,191,0.55)' : 'rgba(167,139,250,0.55)')
                            : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: 8,
                          color: ucTransactionType === t
                            ? (t === 'sale' ? '#2dd4bf' : '#c4b5fd')
                            : '#6b7280',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          transition: 'all 0.15s',
                        }}
                      >
                        {t === 'sale' ? '🏷 Sale' : '📄 Lease'}
                      </button>
                    ))}
                  </div>
                )}

                {/* Sale fields */}
                {!isLease && (
                  <div>
                    <label style={fLabel}>Contract Price ($) *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      style={fInput}
                      value={ucForm.contractPrice ? '$' + Number(ucForm.contractPrice.replace(/[^0-9]/g, '')).toLocaleString('en-US') : ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9]/g, '')
                        setUCForm(f => ({ ...f, contractPrice: raw }))
                      }}
                      placeholder="e.g. $750,000"
                      autoFocus
                    />
                    {ucForm.contractPrice && Number(ucForm.contractPrice) > 0 && (
                      <div style={{ fontSize: 11, color: '#2dd4bf', marginTop: 3, fontWeight: 600 }}>
                        ${Number(ucForm.contractPrice).toLocaleString('en-US')}
                      </div>
                    )}
                  </div>
                )}

                {/* Lease fields */}
                {isLease && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={fLabel}>Lease Rate *</label>
                        <input type="number" step="0.01" style={fInput} value={ucForm.leaseRate}
                          onChange={e => setUCForm(f => ({ ...f, leaseRate: e.target.value }))}
                          placeholder="e.g. 22.50" autoFocus />
                      </div>
                      <div>
                        <label style={fLabel}>Rate Unit *</label>
                        <select style={fInput} value={ucForm.leaseRateUnit}
                          onChange={e => setUCForm(f => ({ ...f, leaseRateUnit: e.target.value }))}>
                          <option>$/SF/YR</option>
                          <option>$/SF/MO</option>
                          <option>$/MO</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={fLabel}>Lease Term (months) *</label>
                      <input type="number" style={fInput} value={ucForm.leaseTermMonths}
                        onChange={e => setUCForm(f => ({ ...f, leaseTermMonths: e.target.value }))}
                        placeholder="e.g. 60" />
                    </div>
                  </>
                )}

                {/* Commission confirmation */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(34,197,94,0.6)', marginBottom: 8 }}>
                    Confirm Commission
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={fLabel}>Commission Rate (%)</label>
                      <input
                        type="number" step="0.01" style={fInput}
                        value={ucForm.commissionPct}
                        onChange={e => {
                          const pct = e.target.value
                          const price = parseFloat(ucForm.contractPrice) || 0
                          const rate = parseFloat(pct) || 0
                          const amt = price > 0 && rate > 0 ? String(Math.round(price * (rate / 100) * 0.75)) : ucForm.commissionAmount
                          setUCForm(f => ({ ...f, commissionPct: pct, commissionAmount: amt }))
                        }}
                        placeholder="e.g. 3.0"
                      />
                    </div>
                    <div>
                      <label style={fLabel}>Matthew&apos;s Commission ($)</label>
                      <input
                        type="text" inputMode="numeric" style={{ ...fInput, background: 'rgba(34,197,94,0.06)', color: '#22c55e' }}
                        value={ucForm.commissionAmount ? '$' + Number(ucForm.commissionAmount).toLocaleString('en-US') : ''}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9]/g, '')
                          setUCForm(f => ({ ...f, commissionAmount: raw }))
                        }}
                        placeholder="Auto-calculated"
                      />
                      {ucForm.commissionAmount && Number(ucForm.commissionAmount) > 0 && (
                        <div style={{ fontSize: 13, color: '#22c55e', marginTop: 3, fontWeight: 800 }}>
                          ${Number(ucForm.commissionAmount).toLocaleString('en-US')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label style={fLabel}>Notes (optional)</label>
                  <textarea style={{ ...fInput, minHeight: 60, resize: 'vertical' }} value={ucForm.notes}
                    onChange={e => setUCForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Any deal notes…" />
                </div>

                {/* Representation section */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>

                  {/* Dual Rep toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={ucForm.dualRep}
                      onChange={e => setUCForm(f => ({
                        ...f,
                        dualRep: e.target.checked,
                        // Dual rep = no co-brokers on either side
                        cobrokeListingOn: e.target.checked ? false : f.cobrokeListingOn,
                        cobrokeBuyerOn: e.target.checked ? false : f.cobrokeBuyerOn,
                      }))}
                      style={{ accentColor: '#E8B84B', width: 15, height: 15 }}
                    />
                    <span style={{
                      fontSize: 12,
                      fontWeight: ucForm.dualRep ? 700 : 400,
                      color: ucForm.dualRep ? '#E8B84B' : '#9ca3af',
                    }}>
                      Dual Rep — I represent both sides
                    </span>
                    {ucForm.dualRep && (
                      <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 4 }}>
                        (co-brokers disabled)
                      </span>
                    )}
                  </label>

                  {/* Co-broker — Listing Side (hidden if dual rep) */}
                  {!ucForm.dualRep && (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
                        <input type="checkbox" checked={ucForm.cobrokeListingOn}
                          onChange={e => setUCForm(f => ({ ...f, cobrokeListingOn: e.target.checked }))}
                          style={{ accentColor: '#2dd4bf', width: 14, height: 14 }} />
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>Co-Broker — Listing Side</span>
                      </label>
                      {ucForm.cobrokeListingOn && ucForm.listingBrokers.map((b, i) => (
                        <UCBrokerRow key={i} broker={b}
                          onChange={updated => setUCForm(f => { const a = [...f.listingBrokers]; a[i] = updated; return { ...f, listingBrokers: a } })}
                          fInput={fInput} dealId={deal.id} contacts={allContacts} />
                      ))}
                      {ucForm.cobrokeListingOn && (
                        <button onClick={() => setUCForm(f => ({ ...f, listingBrokers: [...f.listingBrokers, { name: '', firm: '', pct: '' }] }))}
                          style={{ fontSize: 11, color: '#2dd4bf', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2, marginBottom: 10 }}>+ Add Co-Broker</button>
                      )}

                      {/* Co-broker — Buyer/Tenant Side */}
                      <div style={{ marginTop: ucForm.cobrokeListingOn ? 4 : 0 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
                          <input type="checkbox" checked={ucForm.cobrokeBuyerOn}
                            onChange={e => setUCForm(f => ({ ...f, cobrokeBuyerOn: e.target.checked }))}
                            style={{ accentColor: '#2dd4bf', width: 14, height: 14 }} />
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>Co-Broker — {isLease ? 'Tenant' : 'Buyer'} Side</span>
                        </label>
                        {ucForm.cobrokeBuyerOn && ucForm.buyerBrokers.map((b, i) => (
                          <UCBrokerRow key={i} broker={b}
                            onChange={updated => setUCForm(f => { const a = [...f.buyerBrokers]; a[i] = updated; return { ...f, buyerBrokers: a } })}
                            fInput={fInput} dealId={deal.id} contacts={allContacts} />
                        ))}
                        {ucForm.cobrokeBuyerOn && (
                          <button onClick={() => setUCForm(f => ({ ...f, buyerBrokers: [...f.buyerBrokers, { name: '', firm: '', pct: '' }] }))}
                            style={{ fontSize: 11, color: '#2dd4bf', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}>+ Add Co-Broker</button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={() => setShowUCDialog(false)}
                    style={{ flex: 1, padding: '10px', fontSize: 12, fontWeight: 700, background: 'transparent', border: '1px solid rgba(156,163,175,0.3)', borderRadius: 8, color: '#9ca3af', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                  <button onClick={submitUCDialog}
                    style={{ flex: 2, padding: '10px', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'rgba(45,212,191,0.15)', border: '1px solid rgba(45,212,191,0.5)', borderRadius: 8, color: '#2dd4bf', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Confirm Under Contract
                  </button>
                </div>
              </>
            )
          })()}
        </div>
      </div>,
      document.body
    )}
    </>
  )
}

// ─── Earned Modal ─────────────────────────────────────────────────────────────

const AR_PIN_HASH = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'

async function sha256Earned(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

interface EarnedForm {
  gross_deal_value: string
  deal_type: string
  invoice_number: string
  commission_percent: string
  commission_amount: string
  sr_portion_percent: string
  sr_portion_amount: string
  payment_terms: string
  payment_terms_note: string
  co_broker: boolean
  co_broker_name: string
  co_broker_percent: string
  co_broker_amount: string
  co_broker_separate_invoice: boolean
  reimbursable_description: string
  reimbursable_amount: string
  deposit_retainage: string
}

function EarnedModal({ deal, onClose, onSaved }: {
  deal: Deal
  onClose: () => void
  onSaved: (updatedDeal: Deal) => void
}) {
  const [form, setForm] = useState<EarnedForm>({
    gross_deal_value: '',
    deal_type: '',
    invoice_number: '',
    commission_percent: '',
    commission_amount: '',
    sr_portion_percent: '75',
    sr_portion_amount: '',
    payment_terms: '',
    payment_terms_note: '',
    co_broker: false,
    co_broker_name: '',
    co_broker_percent: '',
    co_broker_amount: '',
    co_broker_separate_invoice: false,
    reimbursable_description: '',
    reimbursable_amount: '',
    deposit_retainage: '',
  })
  const [pin, setPin] = useState('')
  const [pinErr, setPinErr] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPin, setShowPin] = useState(false)

  const num = (v: string) => parseFloat(v) || 0

  // Auto-calc: when gross_deal_value or commission_percent changes, update commission_amount + sr_portion_amount
  function handleGrossOrPctChange(field: 'gross_deal_value' | 'commission_percent' | 'sr_portion_percent', value: string) {
    const updated = { ...form, [field]: value }
    const gross = parseFloat(updated.gross_deal_value) || 0
    const commPct = parseFloat(updated.commission_percent) || 0
    const srPct = parseFloat(updated.sr_portion_percent) || 75
    if (gross > 0 && commPct > 0) {
      const firmTotal = gross * (commPct / 100)
      updated.commission_amount = firmTotal.toFixed(2)
      updated.sr_portion_amount = (firmTotal * (srPct / 100)).toFixed(2)
    }
    setForm(updated)
  }

  const totalDue =
    num(form.sr_portion_amount)
    - (form.deal_type === 'sale' ? num(form.deposit_retainage) : 0)
    - 0 // paid_to_date starts at 0
    + num(form.reimbursable_amount)

  function set<K extends keyof EarnedForm>(k: K, v: EarnedForm[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSave(pinValue: string) {
    const hash = await sha256Earned(pinValue)
    if (hash !== AR_PIN_HASH) {
      setPinErr(true)
      setPin('')
      return
    }

    setSaving(true)
    try {
      // 1. Update deal earned=true
      const { data: updatedDeal, error: dealErr } = await supabase
        .from('deals')
        .update({ earned: true, updated_at: new Date().toISOString() })
        .eq('id', deal.id)
        .select()
        .single()

      if (dealErr) {
        console.error('Deal update error:', dealErr)
        setSaving(false)
        return
      }

      // 2. Insert ar_item
      const arPayload: Record<string, unknown> = {
        deal_id: deal.id,
        deal_type: form.deal_type || null,
        invoice_number: form.invoice_number || null,
        commission_percent: num(form.commission_percent) || null,
        commission_amount: num(form.commission_amount) || null,
        sr_portion_percent: num(form.sr_portion_percent) || null,
        sr_portion_amount: num(form.sr_portion_amount) || null,
        payment_terms: form.payment_terms || null,
        payment_terms_note: form.payment_terms_note || null,
        co_broker: form.co_broker,
        co_broker_name: form.co_broker ? (form.co_broker_name || null) : null,
        co_broker_percent: form.co_broker ? (num(form.co_broker_percent) || null) : null,
        co_broker_amount: form.co_broker ? (num(form.co_broker_amount) || null) : null,
        co_broker_separate_invoice: form.co_broker ? form.co_broker_separate_invoice : false,
        reimbursable_description: form.reimbursable_description || null,
        reimbursable_amount: num(form.reimbursable_amount) || null,
        deposit_retainage: form.deal_type === 'sale' ? (num(form.deposit_retainage) || null) : null,
        paid_to_date: 0,
        total_due: totalDue,
        status: 'receivable',
      }

      const { error: arErr } = await supabase.from('ar_items').insert(arPayload)
      if (arErr) {
        console.error('AR insert error:', arErr)
        setSaving(false)
        return
      }

      // 3. Update local state
      onSaved(updatedDeal as Deal)
    } finally {
      setSaving(false)
    }
  }

  const modalBase: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    paddingTop: '6vh', paddingBottom: '6vh',
    overflowY: 'auto',
  }

  const modalCard: React.CSSProperties = {
    background: '#1A1E25',
    border: '1px solid rgba(232,184,75,0.35)',
    borderRadius: 14,
    padding: '24px 28px',
    width: '90vw',
    maxWidth: 540,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    position: 'relative',
  }

  const fLabel: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: 4,
    display: 'block',
  }

  const fInput: React.CSSProperties = {
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
    colorScheme: 'dark',
  }

  return (
    <div style={modalBase} onClick={onClose}>
      <div style={modalCard} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#E8B84B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Mark as Earned
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          {deal.name} — Creates AR item and marks deal as earned.
        </div>

        {/* Gross Deal Value */}
        <div>
          <label style={fLabel}>Gross Deal Value ($) *</label>
          <input
            type="number"
            style={fInput}
            value={form.gross_deal_value}
            onChange={e => handleGrossOrPctChange('gross_deal_value', e.target.value)}
            placeholder="e.g. 1250000"
          />
          {num(form.gross_deal_value) > 0 && (
            <div style={{ fontSize: 11, color: '#E8B84B', marginTop: 3, fontWeight: 600 }}>
              ${num(form.gross_deal_value).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          )}
        </div>

        {/* Deal Type */}
        <div>
          <label style={fLabel}>Deal Type *</label>
          <select style={fInput} value={form.deal_type} onChange={e => set('deal_type', e.target.value)}>
            <option value="">Select…</option>
            <option value="full_service_lease">Full Service Lease</option>
            <option value="nnn_lease">NNN Lease</option>
            <option value="sale">Sale</option>
          </select>
        </div>

        {/* Invoice Number */}
        <div>
          <label style={fLabel}>Invoice Number *</label>
          <input style={fInput} value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} placeholder="e.g. INV-2024-001" />
        </div>

        {/* Commission */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={fLabel}>Commission % *</label>
            <input
              type="number" step="0.01" style={fInput}
              value={form.commission_percent}
              onChange={e => handleGrossOrPctChange('commission_percent', e.target.value)}
              placeholder="6.0"
            />
          </div>
          <div>
            <label style={fLabel}>Firm Total Commission ($)</label>
            <input
              type="number" step="0.01"
              style={{ ...fInput, background: 'rgba(232,184,75,0.06)', color: '#E8B84B' }}
              value={form.commission_amount}
              onChange={e => set('commission_amount', e.target.value)}
              placeholder="Auto-calculated"
            />
          </div>
        </div>

        {/* SR Portion */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={fLabel}>Matthew&apos;s Split %</label>
            <input
              type="number" step="0.01" style={fInput}
              value={form.sr_portion_percent}
              onChange={e => handleGrossOrPctChange('sr_portion_percent', e.target.value)}
              placeholder="75"
            />
          </div>
          <div>
            <label style={fLabel}>Matthew&apos;s Commission ($)</label>
            <input
              type="number" step="0.01"
              style={{ ...fInput, background: 'rgba(34,197,94,0.08)', color: '#22c55e' }}
              value={form.sr_portion_amount}
              onChange={e => set('sr_portion_amount', e.target.value)}
              placeholder="Auto-calculated"
            />
            {num(form.sr_portion_amount) > 0 && (
              <div style={{ fontSize: 13, color: '#22c55e', marginTop: 4, fontWeight: 800 }}>
                ${num(form.sr_portion_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>

        {/* Payment Terms */}
        <div>
          <label style={fLabel}>Payment Terms *</label>
          <select style={fInput} value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)}>
            <option value="">Select…</option>
            <option value="due_now">Due Now</option>
            <option value="50_50_rcd">50%/50% at RCD</option>
            <option value="upon_closing">Upon Closing</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {/* Payment Terms Note */}
        <div>
          <label style={fLabel}>Payment Terms Note</label>
          <input style={fInput} value={form.payment_terms_note} onChange={e => set('payment_terms_note', e.target.value)} placeholder="Optional note" />
        </div>

        {/* Co-Broker Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ ...fLabel, marginBottom: 0 }}>Co-Broker?</label>
          <button
            type="button"
            onClick={() => set('co_broker', !form.co_broker)}
            style={{
              padding: '4px 14px',
              fontSize: 11,
              fontWeight: 700,
              background: form.co_broker ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${form.co_broker ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 6,
              color: form.co_broker ? '#a78bfa' : '#6b7280',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {form.co_broker ? 'Yes' : 'No'}
          </button>
        </div>

        {/* Co-Broker Fields */}
        {form.co_broker && (
          <>
            <div>
              <label style={fLabel}>Co-Broker Name</label>
              <input style={fInput} value={form.co_broker_name} onChange={e => set('co_broker_name', e.target.value)} placeholder="Firm / Agent name" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={fLabel}>Co-Broker %</label>
                <input type="number" step="0.01" style={fInput} value={form.co_broker_percent} onChange={e => set('co_broker_percent', e.target.value)} placeholder="50" />
              </div>
              <div>
                <label style={fLabel}>Co-Broker Amount ($)</label>
                <input type="number" step="0.01" style={fInput} value={form.co_broker_amount} onChange={e => set('co_broker_amount', e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="co_broker_sep"
                checked={form.co_broker_separate_invoice}
                onChange={e => set('co_broker_separate_invoice', e.target.checked)}
                style={{ accentColor: '#a78bfa', width: 14, height: 14 }}
              />
              <label htmlFor="co_broker_sep" style={{ ...fLabel, marginBottom: 0, cursor: 'pointer' }}>Separate Invoice</label>
            </div>
          </>
        )}

        {/* Reimbursable */}
        <div>
          <label style={fLabel}>Reimbursable Description</label>
          <input style={fInput} value={form.reimbursable_description} onChange={e => set('reimbursable_description', e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label style={fLabel}>Reimbursable Amount ($)</label>
          <input type="number" step="0.01" style={fInput} value={form.reimbursable_amount} onChange={e => set('reimbursable_amount', e.target.value)} placeholder="0.00" />
        </div>

        {/* Deposit Retainage — only for sale */}
        {form.deal_type === 'sale' && (
          <div>
            <label style={fLabel}>Deposit Retainage ($)</label>
            <input type="number" step="0.01" style={fInput} value={form.deposit_retainage} onChange={e => set('deposit_retainage', e.target.value)} placeholder="0.00" />
          </div>
        )}

        {/* Total Due display */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px',
          background: 'rgba(34,197,94,0.06)',
          border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: 8,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total Due</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#22c55e', fontVariantNumeric: 'tabular-nums' }}>
            ${totalDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* PIN Entry / Save */}
        {!showPin ? (
          <button
            onClick={() => setShowPin(true)}
            style={{
              padding: '10px 0',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: 'rgba(232,184,75,0.12)',
              border: '1px solid rgba(232,184,75,0.4)',
              borderRadius: 8,
              color: '#E8B84B',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Save &amp; Mark Earned
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>Enter PIN to confirm</div>
            <input
              autoFocus
              type="tel"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                setPin(v)
                setPinErr(false)
                if (v.length === 4) handleSave(v)
              }}
              placeholder="· · · ·"
              style={{
                width: '100%',
                fontSize: 28,
                textAlign: 'center',
                letterSpacing: '0.4em',
                padding: '12px',
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${pinErr ? '#ef4444' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 8,
                color: '#f0f0f0',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
            {pinErr && <div style={{ color: '#ef4444', fontSize: 11, textAlign: 'center' }}>Incorrect PIN</div>}
            {saving && <div style={{ fontSize: 11, color: '#E8B84B', textAlign: 'center' }}>Saving…</div>}
            <button onClick={() => { setShowPin(false); setPin(''); setPinErr(false) }} style={{ padding: '6px 0', fontSize: 12, color: '#6b7280', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function DealDashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0D0F14', color: '#F0F2FF' }}>
        <div style={{ padding: 32 }}>
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} } @keyframes orbitPulse { 0%,100%{box-shadow:0 0 16px rgba(139,92,246,0.3),inset 0 1px 0 rgba(255,255,255,0.06)} 50%{box-shadow:0 0 28px rgba(139,92,246,0.55),0 0 8px rgba(167,139,250,0.25),inset 0 1px 0 rgba(255,255,255,0.1)} }`}</style>
          <div style={{ width: '60%', height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.07)', marginBottom: 10, animation: 'pulse 1.6s ease-in-out infinite' }} />
        </div>
      </div>
    }>
      <DealDashboardInner />
    </Suspense>
  )
}

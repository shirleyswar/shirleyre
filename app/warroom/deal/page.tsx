'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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

function CommissionPanel({ dealId }: { dealId: string }) {
  const [data, setData] = useState<{
    transaction_type: string | null
    sqft: number | null
    asking_price: number | null
    lease_rate_psf: number | null
    lease_term_years: number | null
    lease_commission_pct: number | null
    sale_commission_pct: number | null
    nnn_psf: number | null
  } | null>(null)

  useEffect(() => {
    supabase
      .from('deal_economics')
      .select('transaction_type,sqft,asking_price,lease_rate_psf,lease_term_years,lease_commission_pct,sale_commission_pct,nnn_psf')
      .eq('deal_id', dealId)
      .maybeSingle()
      .then(({ data: d }) => { if (d) setData(d as any) })
  }, [dealId])

  if (!data) return null

  const sqft = data.sqft ?? 0
  const isLease = data.transaction_type === 'lease' || data.transaction_type === 'both'
  const isSale  = data.transaction_type === 'sale'  || data.transaction_type === 'both'

  // Lease commission
  const leaseGross = sqft > 0 && data.lease_rate_psf && data.lease_term_years
    ? data.lease_rate_psf * sqft * data.lease_term_years : null
  const leaseComm = leaseGross && data.lease_commission_pct
    ? leaseGross * (data.lease_commission_pct / 100) * 0.75 : null

  // Sale commission
  const saleComm = data.asking_price && data.sale_commission_pct
    ? data.asking_price * (data.sale_commission_pct / 100) * 0.75 : null

  const $$ = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const pct = (n: number) => n.toFixed(2) + '%'

  const rows: { label: string; value: string; highlight?: boolean }[] = []

  if (isLease) {
    if (data.lease_term_years) rows.push({ label: 'Lease Term', value: data.lease_term_years + ' yrs' })
    if (leaseGross) rows.push({ label: 'Total Lease Value', value: $$(leaseGross) })
    if (data.lease_commission_pct) rows.push({ label: 'Commission %', value: pct(data.lease_commission_pct) })
    if (leaseComm) rows.push({ label: "Matthew's Commission", value: $$(leaseComm), highlight: true })
  }

  if (isSale) {
    if (data.asking_price) rows.push({ label: 'Sale Price', value: $$(data.asking_price) })
    if (data.sale_commission_pct) rows.push({ label: 'Commission %', value: pct(data.sale_commission_pct) })
    if (saleComm) rows.push({ label: "Matthew's Commission", value: $$(saleComm), highlight: true })
  }

  if (rows.length === 0) return null

  return (
    <div style={{
      background: '#1A1E25',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12,
      padding: '14px 16px',
      marginBottom: 16,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '0.18em',
        textTransform: 'uppercase', color: 'rgba(212,168,71,0.55)',
        marginBottom: 14, fontFamily: 'var(--font-body)',
      }}>
        Commission
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

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* SqFt — always */}
        {sqft > 0 && (
          <>
            <div style={statStyle}>
              <span style={statLabel}>SqFt</span>
              <span style={statVal}>{fmtSqft(sqft)}</span>
            </div>
            {divider}
          </>
        )}

        {/* ── LEASE ── */}
        {isLease && econ.lease_rate_psf && (
          <>
            <div style={statStyle}>
              <span style={statLabel}>Rent PSF / yr</span>
              <span style={statVal}>{$2(econ.lease_rate_psf)}</span>
            </div>
            {divider}
          </>
        )}

        {isLease && baseMonthly != null && (
          <>
            <div style={statStyle}>
              <span style={statLabel}>Base Rent / mo</span>
              <span style={statVal}>{$(baseMonthly)}</span>
            </div>
            {divider}
          </>
        )}

        {/* NNN only */}
        {isLease && isNNN && econ.nnn_psf && (
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
              <>
                <div style={statStyle}>
                  <span style={statLabel}>Total NNN / mo</span>
                  <span style={{ ...statVal, color: '#22c55e' }}>{$(totalMonthly)}</span>
                </div>
              </>
            )}
          </>
        )}

        {/* ── SALE ── */}
        {isSale && econ.asking_price && (
          <>
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
          </>
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

function DealEconomicsCard({ deal }: { deal: Deal }) {
  const [propertyType, setPropertyType] = useState('Office')
  const [propertyTypeCustom, setPropertyTypeCustom] = useState('')
  const [transactionType, setTransactionType] = useState<'sale' | 'lease' | 'both'>('sale')
  const [sqft, setSqft] = useState('')
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
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

      {/* Square Footage */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Square Footage</div>
        <input
          type="number"
          value={sqft}
          onChange={e => setSqft(e.target.value)}
          placeholder="e.g. 5000"
          style={inputStyle}
        />
        {sqftNum > 0 && (
          <div style={{ fontSize: 12, color: '#E8B84B', marginTop: 4, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtSqft(sqftNum)}</div>
        )}
      </div>

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
              <div style={labelStyle}>Matthew&apos;s Commission</div>
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
              <div style={labelStyle}>Matthew&apos;s Commission</div>
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

function LacdbCard({ deal, onLacdbIdSave }: { deal: Deal; onLacdbIdSave: (id: string) => void }) {
  const [listing, setListing] = useState<LacdbListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(true)
  const [manualId, setManualId] = useState('')
  const [savingManual, setSavingManual] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  // linkedSlug: slug/id that was saved but not yet in DB (show fallback link)
  const [linkedSlug, setLinkedSlug] = useState<string | null>(null)

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
  const fileInputRef = useRef<HTMLInputElement>(null)

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

      {/* File list */}
      {loadingFiles ? (
        <div style={{ fontSize: 12, color: '#4b5563' }}>Loading files…</div>
      ) : files.length === 0 ? (
        <div style={{ fontSize: 12, color: '#4b5563', textAlign: 'center', padding: '8px 0' }}>No files uploaded</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map(f => (
            <div key={f.name} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 7,
              border: '1px solid rgba(255,255,255,0.04)',
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
          ))}
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

  // Notes
  const [notesText, setNotesText] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // PIN modal
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null)

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

      {/* ── Quick Glance — full width, top of page ── */}
      <div style={{ padding: '0 24px', maxWidth: 1400, margin: '0 auto' }}>
        <DealGlanceCard deal={deal} />
      </div>

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
            onClick={() => pinGate(() => doStatusChange('under_contract'))}
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
          />

          {/* Deal Economics — below LACDB */}
          <DealEconomicsCard deal={deal} />

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

          {/* Documents Card */}
          <DocumentsCard deal={deal} />

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

        {/* ── RIGHT COLUMN — hidden on mobile ── */}
        <div className="hidden sm:block sm:w-[35%]" style={{ minWidth: 0 }}>

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
                  onClick={() => pinGate(() => doStatusChange('under_contract'))}
                />
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
          <CommissionPanel dealId={deal.id} />

          {/* Contacts */}
          <ContactsCard deal={deal} />

          {/* Deadlines (only UC) */}
          {deal.status === 'under_contract' && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={sectionHeadStyle}>Contract Deadlines</span>
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

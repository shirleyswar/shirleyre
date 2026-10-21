'use client'
/**
 * /warroom/deals — Deals Index
 * D5.2 · build(48l) · from frame 49a · spec D5.2 + D5.2.1a · 8.24.26 1645
 *
 * Four tabs: LISTINGS / TENANTS / BUYERS / TARGETS
 * LISTINGS: stage tabs (Pipeline through Closed, then In Service) plus TYPE,
 * sortable columns, LACDB icon for active listings, deadline date and label.
 * TENANTS / BUYERS / TARGETS: placeholder.
 *
 * Chrome (rail, band, tab row, filter row, col headers) does NOT scroll.
 * Group headers STICKY while body scrolls.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calcCommission, calcLeaseValue, calcSaleCommission, fmtAsking, fmtMoney } from '@/lib/dealMath'
import { applyFreshAsking } from '@/lib/lacdbPrice'
import { formatDealTitle } from '@/lib/formatAddress'
import PinGate from '@/components/warroom/PinGate'
import TaskModal from '@/app/warroom/TaskModal'
import type { Task } from '@/app/warroom/TaskModal'
import {
  DT1, DT2, DT3, DT7,
  DS3, DS5,
} from '@/components/warroom/desktopTypes'
import Fab from '@/assets/fab/Fab'
import { LACDB_ACTIVE } from '@/lib/lacdbCatalog'
import { lacdbFlagFor } from '@/lib/lacdbFlag'

// ── Auth ──────────────────────────────────────────────────────────────────────
const PIN_HASH    = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'
const SESSION_KEY = 'wr_session_exp_v2'
const SESSION_HOURS = 8

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Color tokens ──────────────────────────────────────────────────────────────
const C = {
  bgBase:      '#050509',
  bgPanel:     '#12111B',
  bgRail:      '#0C0B14',
  textHi:      '#EFEEF4',
  textMid:     '#B8B6C6',
  textLow:     '#8E8CA0',
  brand:       '#8B5CF6',
  brandLift:   '#A78BFA',
  brandStrong: '#7C3AED',
  moneyIn:     '#34D399',
  hot:         '#FFA23A',
  late:        '#FF4D4D',
  border:      'rgba(255,255,255,0.14)',
  borderPanel: 'rgba(255,255,255,0.11)',
  borderHair:  'rgba(255,255,255,0.10)',
} as const

const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISP = "'Space Grotesk', system-ui, sans-serif"

/** Shared left edge for the type row, stage tabs, totals, Address header, and Portfolios row. */
const HEADER_EDGE = 'var(--wr-edge)'
const TAB_GRAY = '#8E8CA0'
const COUNT_MUTED = '#6F6D80'

const headerFace: React.CSSProperties = {
  fontFamily: FONT_DISP,
  letterSpacing: 0,
  textTransform: 'none',
  lineHeight: 1,
}

function typeTitle(value: string): string {
  if (value === 'INDUSTRIAL') return 'Industrial'
  if (value === 'MULTIFAMILY') return 'Multifamily'
  const lower = value.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

// ── Column widths (from 49a frame) ────────────────────────────────────────────
const COL = {
  client:   188,
  deadline: 176,
  lacdb:     56,
  task:      48,
  rank:      92,
  value:    152,
  comm:     124,
  dbx:       52,
} as const

// ── Types ─────────────────────────────────────────────────────────────────────
type TabKey    = 'listings' | 'tenants' | 'buyers' | 'targets'
type StageKey  = 'all' | 'pipeline' | 'review' | 'active' | 'hot' | 'under_contract' | 'closed' | 'in_service'
type SortKey   = 'address' | 'client' | 'deadline' | 'rank' | 'value' | 'comm'
type SortDir   = 'asc' | 'desc'

interface DealRow {
  id: string
  name: string | null
  address: string | null
  addr_display: string | null
  addr_number: string | null
  addr_street_name: string | null
  addr_street_type: string | null
  addr_direction: string | null
  addr_city: string | null
  status: string | null
  type: string | null
  property_type: string | null
  rating: number | null
  lacdb_url: string | null
  deal_source: string | null
  dropbox_link: string | null
  portfolio_id: string | null
  is_money_mover: boolean | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deal_contacts: { contacts: any }[]
}

interface DealEcon {
  deal_id: string
  transaction_type: string | null
  asking_price?: number | null
  sale_commission_pct?: number | null
  sqft?: number | null
  lease_rate_psf?: number | null
  lease_term_years?: number | null
  lease_commission_pct?: number | null
  offer_price?: number | null
}

interface DeadlineRow {
  deal_id: string
  deadline_date: string
  deadline_type: string | null
  label: string | null
}

interface EnrichedDeal extends DealRow {
  _shortAddr:      string
  _client:         string
  _deadlineDays:   number | null
  _deadlineDate:   string | null
  _deadlineLabel:  string
  _value:          number | null
  _commission:     number | null
  _isMoneyMover:   boolean
}

interface PortfolioRollup {
  portfolioId: string
  name:        string
  siteCount:   number
  client:      string
  value:       number | null
  commission:  number | null
  firstDealId: string
}

interface TabCounts {
  listings: number
  tenants:  number
  buyers:   number
  targets:  number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayCST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function daysBetween(today: string, dateStr: string): number {
  const [ty, tm, td] = today.split('-').map(Number)
  const [y,  m,  d]  = dateStr.split('-').map(Number)
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(ty, tm - 1, td).getTime()) / 86400000)
}

function fmtDeadlineWhen(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const mon = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return `${mon} ${d}`
}

const STAGES: StageKey[] = ['all', 'pipeline', 'review', 'active', 'hot', 'under_contract', 'closed', 'in_service']

function isStageKey(value: string | null): value is StageKey {
  return !!value && (STAGES as string[]).includes(value)
}

/** Stored status → stage. HOT is the status itself, never a rating. */
function stageOf(status: string | null): StageKey | 'other' {
  switch ((status ?? '').toLowerCase()) {
    case 'pipeline': return 'pipeline'
    case 'review':
    case 'in_review': return 'review'
    case 'active':
    case 'active_listing': return 'active'
    case 'hot': return 'hot'
    case 'under_contract': return 'under_contract'
    case 'closed': return 'closed'
    case 'in_service': return 'in_service'
    default: return 'other'
  }
}

function stageLabel(status: string | null): string {
  switch (stageOf(status)) {
    case 'pipeline': return 'PIPELINE'
    case 'review': return 'REVIEW'
    case 'active': return 'ACTIVE'
    case 'hot': return 'HOT'
    case 'under_contract': return 'UNDER CONTRACT'
    case 'closed': return 'CLOSED'
    case 'in_service': return 'IN SERVICE'
    default: {
      if (!status) return ''
      if (status.toLowerCase() === 'pending_payment') return 'PENDING'
      return status.replace(/_/g, ' ').toUpperCase()
    }
  }
}

function stageTone(status: string | null): { color: string; background: string; border: string } {
  switch (stageOf(status)) {
    case 'pipeline':
      return { color: '#93C5FD', background: 'transparent', border: '1px solid rgba(147,197,253,0.72)' }
    case 'review':
      return { color: '#FBBF24', background: 'transparent', border: '1px solid rgba(251,191,36,0.78)' }
    case 'active':
      return { color: '#C4B5FD', background: 'transparent', border: '1px solid rgba(196,181,253,0.85)' }
    case 'hot':
      return { color: '#0A0A0F', background: C.hot, border: '1px solid transparent' }
    case 'under_contract':
      return { color: '#5EEAD4', background: 'transparent', border: '1px solid rgba(94,234,212,0.8)' }
    case 'closed':
      return { color: C.textLow, background: 'transparent', border: '1px solid rgba(255,255,255,0.18)' }
    case 'in_service':
      return { color: '#6F6D80', background: 'transparent', border: '1px solid rgba(255,255,255,0.14)' }
    default:
      return { color: C.textMid, background: 'transparent', border: '1px solid rgba(255,255,255,0.20)' }
  }
}

function StagePill({ status }: { status: string | null }) {
  const label = stageLabel(status)
  if (!label) return null
  const tone = stageTone(status)
  const wide = stageOf(status) === 'under_contract'
  return (
    <span data-stage={stageOf(status)} style={{
      fontFamily: FONT_MONO,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: wide ? '0.05em' : '0.08em',
      lineHeight: 1,
      color: tone.color,
      background: tone.background,
      border: tone.border,
      borderRadius: 4,
      padding: tone.background === 'transparent' ? '3px 6px' : '4px 7px',
      flexShrink: 0,
      whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

function shortDeadlineLabel(type: string | null, label: string | null): string {
  const kind = (type ?? '').toLowerCase()
  if (kind === 'closing') return 'CLOSING'
  if (kind === 'inspection') return 'INSPECTION'
  if (kind === 'due_diligence' || kind === 'diligence') return 'DILIGENCE'
  const raw = (label ?? '').replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim()
  const low = raw.toLowerCase()
  if (!raw) return kind && kind !== 'custom' ? kind.replace(/_/g, ' ').toUpperCase() : ''
  if (low.includes('clos')) return 'CLOSING'
  if (low.includes('counter')) return 'COUNTER'
  if (low.includes('feasib')) return 'FEASIBILITY'
  if (low.includes('inspect')) return 'INSPECTION'
  if (low.includes('lease')) return 'LEASE'
  const words = raw.split(' ').slice(0, 2).join(' ')
  return (words.length > 16 ? words.slice(0, 14).trim() : words).toUpperCase()
}

function deadlineInk(days: number | null): string {
  if (days == null) return C.textMid
  if (days < 0) return C.late
  if (days <= 14) return C.hot
  return C.textMid
}

function clientFromDeal(deal: DealRow): string {
  return deal.deal_contacts?.[0]?.contacts?.name ?? deal.name ?? '—'
}

// ── Clock ─────────────────────────────────────────────────────────────────────
function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])
  const DAYS   = ['SUN','MON','TUE','WED','THU','FRI','SAT']
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const h = now.getHours(); const min = now.getMinutes()
  const h12 = h % 12 || 12; const ampm = h >= 12 ? 'PM' : 'AM'
  return {
    dateStr: `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`,
    timeStr: `${h12}:${String(min).padStart(2,'0')} ${ampm}`,
  }
}

// ── IdentityBand ──────────────────────────────────────────────────────────────
function IdentityBand() {
  const { dateStr, timeStr } = useClock()
  return (
    <div className="wr-deals-band" style={{
      height: 112, flexShrink: 0, display: 'flex', alignItems: 'center',
      padding: '0 30px', gap: 26, borderBottom: `1px solid ${C.border}`, background: C.bgBase,
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wr-deals-mark" src="/icons/mark-256.png" alt="" width={64} height={64} style={{ display: 'block', flexShrink: 0 }} />
      <div className="wr-deals-word" style={{ flexShrink: 0, marginTop: -10, marginLeft: -3.5, display: 'flex', alignItems: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/wordmark/shirleycre-h176.png" alt="SHIRLEYCRE" height={88} style={{ height: 88, width: 'auto', display: 'block' }} />
      </div>
      <div style={{ width: 1, height: 40, background: C.border, flexShrink: 0 }} />
      <span style={{ ...DT1, letterSpacing: '0.19em', color: C.textMid, marginTop: 4, flexShrink: 0 }}>WAR ROOM</span>
      <div style={{ flex: 1 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wr-deals-plate" src="/assets/links/lacdb-h104.png" alt="LACDB"
        style={{ height: 52, width: 158, display: 'block', flexShrink: 0, cursor: 'pointer' }}
        onClick={() => window.open('https://www.lacdb.com', '_blank', 'noopener,noreferrer')} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wr-deals-plate" src="/assets/links/crexi-h104.png" alt="CREXI"
        style={{ height: 52, width: 158, display: 'block', flexShrink: 0, cursor: 'pointer' }}
        onClick={() => window.open('https://www.crexi.com', '_blank', 'noopener,noreferrer')} />
      <span className="wr-deals-clock" style={{ ...DT2, color: C.brandLift, flexShrink: 0 }}>{dateStr} · {timeStr}</span>
      <div className="wr-deals-clock" style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.moneyIn }} />
        <span style={{ ...DT3, color: C.moneyIn }}>LIVE</span>
      </div>
    </div>
  )
}

// ── LeftRail — 160: 10 slots ─────────────────────────────────────────────────
// HOME · DEALS · SCHED · DEADLINES · MONEY · PORTF · ENTITY · PEOPLE [spacer] LOGS · SET
type RailSlot = 'HOME' | 'DEALS' | 'LEADS' | 'SCHED' | 'DEADLINES' | 'MONEY' | 'PORTF' | 'ENTITY' | 'PEOPLE' | 'LOGS' | 'SET'

// SVG glyphs from /assets/rail/*.svg (inline to avoid img flicker)
const G_HOME = (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7.5" height="18"/><rect x="13.5" y="3" width="7.5" height="8"/><rect x="13.5" y="14" width="7.5" height="7"/>
  </svg>
)
const G_DEALS = (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="4" width="17" height="10" rx="1.5"/>
    <path d="M12 14v7M7 7.8h6M7 10.8h9"/>
  </svg>
)
const G_LEADS = (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.2" y="3.4" width="17.6" height="17.2" rx="2"/>
    <circle cx="8.6" cy="10.2" r="2.1"/>
    <path d="M5.2 16.8c.35-2.05 1.65-3.2 3.4-3.2s3.05 1.15 3.4 3.2"/>
    <path d="M13.8 8.4h4.6M13.8 11.6h4.6"/>
  </svg>
)
const G_SCHED = (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17"/><rect x="7" y="12.6" width="4" height="4" fill="currentColor" stroke="none"/>
  </svg>
)
const G_DEADLINES = (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 20.8V3.6"/><path d="M6 4.4h10.4l-1.7 4.1 1.7 4.1H6"/>
  </svg>
)
const G_MONEY = (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.6" y="6.4" width="18.8" height="11.2" rx="2.2"/><circle cx="12" cy="12" r="3"/>
  </svg>
)
const G_PORTF = (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.8 21 7.4l-9 4.6-9-4.6z"/><path d="M3 12.2 12 16.8l9-4.6"/><path d="M3 16.8 12 21.4l9-4.6"/>
  </svg>
)
const G_ENTITY = (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.6" y="3.2" width="10.2" height="17.6" rx="1.6"/><path d="M13.8 11.2h6.6v9.6h-6.6"/><path d="M6.6 7v1.8M11 7v1.8M6.6 11.1v1.8M11 11.1v1.8M6.6 15.2v1.8M11 15.2v1.8"/>
  </svg>
)
const G_PEOPLE = (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="8" r="3.2"/>
    <path d="M3 20c0-3.4 2.7-5.6 6-5.6s6 2.2 6 5.6"/>
    <path d="M16 5.4a3.2 3.2 0 0 1 0 6M17.5 14.9c2.1.6 3.5 2.4 3.5 5.1"/>
  </svg>
)
const G_SET = (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.4 8.6h4M13 8.6h7.6M3.4 15.4h7.1M16.1 15.4h4.5"/><circle cx="10.1" cy="8.6" r="2.6"/><circle cx="13.3" cy="15.4" r="2.6"/>
  </svg>
)
const G_LOGS = (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5.4" y="4" width="13.2" height="16"/>
    <path d="M8.6 8.4h7M8.6 12h7M8.6 15.6h4.2"/>
  </svg>
)

interface RailSlotDef {
  id: RailSlot
  label: string
  href: string | null  // null = inert slot
  glyph: React.ReactNode
}

function LeftRail({ active }: { active: RailSlot }) {
  const router = useRouter()

  // DI-1: 9 slots — slots without routes render inert (no click, no cursor pointer)
  const mainSlots: RailSlotDef[] = [
    { id: 'HOME',      label: 'HOME',      href: '/warroom',          glyph: G_HOME      },
    { id: 'DEALS',     label: 'DEALS',     href: '/warroom/deals',    glyph: G_DEALS     },
    { id: 'LEADS',     label: 'LEADS',     href: '/warroom/leads',    glyph: G_LEADS     },
    { id: 'SCHED',     label: 'SCHED',     href: null,                glyph: G_SCHED     },
    { id: 'DEADLINES', label: 'DEADLINES', href: null,                glyph: G_DEADLINES },
    { id: 'MONEY',     label: 'MONEY',     href: null,                glyph: G_MONEY     },
    { id: 'PORTF',     label: 'PORTF',     href: null,                glyph: G_PORTF     },
    { id: 'ENTITY',    label: 'ENTITY',    href: null,                glyph: G_ENTITY    },
    { id: 'PEOPLE',    label: 'PEOPLE',    href: '/warroom/contacts', glyph: G_PEOPLE    },
  ]
  const logsSlot: RailSlotDef = { id: 'LOGS', label: 'LOGS', href: '/warroom/logs', glyph: G_LOGS }
  const setSlot: RailSlotDef = { id: 'SET', label: 'SET', href: null, glyph: G_SET }

  function renderSlot(s: RailSlotDef) {
    const isActive = s.id === active
    const canClick = s.href !== null
    return (
      <button
        key={s.id}
        onClick={canClick ? () => router.push(s.href!) : undefined}
        style={{
          width: 76, padding: '13px 0', borderRadius: 10, border: 'none', flexShrink: 0,
          background: isActive ? 'rgba(139,92,246,0.14)' : 'transparent',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
          cursor: canClick ? 'pointer' : 'default', color: isActive ? C.brandLift : C.textLow,
        }}
      >
        {s.glyph}
        <span style={{
          fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500,
          letterSpacing: '0.10em', textTransform: 'uppercase', color: 'inherit',
          lineHeight: '15px', whiteSpace: 'nowrap',
        }}>{s.label}</span>
      </button>
    )
  }

  return (
    <div className="wr-deals-rail" style={{
      width: 96, flexShrink: 0, height: '100%', background: C.bgRail,
      borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
      alignItems: 'center', paddingTop: 8, boxSizing: 'border-box', overflowY: 'auto',
    }}>
      {/* Main 8 slots */}
      {mainSlots.map(s => renderSlot(s))}
      {/* Spacer */}
      <div style={{ flex: 1 }} />
      {/* Bottom group: LOGS · SET */}
      {renderSlot(logsSlot)}
      {renderSlot(setSlot)}
      <div style={{ height: 8 }} />
    </div>
  )
}

// ── StarRating — D5.2.3 ───────────────────────────────────────────────────────
function StarRating({ dealId, rating, onChange }: {
  dealId: string; rating: number | null;
  onChange: (id: string, r: number | null) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const current = rating ?? 0
  const display = hover !== null ? hover : current

  async function handleClick(n: number, e: React.MouseEvent) {
    e.stopPropagation()
    const prev = rating
    const next = current === n ? null : n
    onChange(dealId, next)
    const { error } = await supabase.from('deals').update({ rating: next }).eq('id', dealId)
    if (error) onChange(dealId, prev)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      onMouseLeave={() => setHover(null)}>
      <div style={{ display: 'flex', gap: 3 }}>
        {[1,2,3,4,5].map(n => {
          const filled = n <= display
          return (
            <svg key={n} width="14" height="14" viewBox="0 0 24 24"
              onMouseEnter={() => setHover(n)}
              onClick={(e) => handleClick(n, e)}
              style={{ cursor: 'pointer', flexShrink: 0, padding: 1 }}
            >
              {filled
                ? <path d="M12 2.5l2.9 6.2 6.6.8-4.8 4.7 1.2 6.8L12 17.6 6.1 21l1.2-6.8L2.5 9.5l6.6-.8L12 2.5Z" fill={C.textHi} />
                : <path d="M12 2.5l2.9 6.2 6.6.8-4.8 4.7 1.2 6.8L12 17.6 6.1 21l1.2-6.8L2.5 9.5l6.6-.8L12 2.5Z" fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="1.7" />
              }
            </svg>
          )
        })}
      </div>
      {/* 2px violet bar when rated */}
      {current > 0 && <div style={{ width: 78, height: 2, background: C.brandStrong }} />}
    </div>
  )
}

// ── LACDB cell ────────────────────────────────────────────────────────────────
const PLUS_BTN: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 7,
  border: '1px dashed rgba(255,255,255,0.22)', background: 'none', cursor: 'pointer',
}

function LacdbCell({ deal, onNavigate }: { deal: EnrichedDeal; onNavigate: (id: string) => void }) {
  const mark = lacdbFlagFor(deal, LACDB_ACTIVE)
  if (mark?.kind === 'active' && mark.href) {
    return (
      <a href={mark.href} target="_blank" rel="noopener noreferrer" data-lacdb="active"
        aria-label="Open LACDB listing" onClick={e => e.stopPropagation()}
        style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'rgba(139,92,246,0.14)', textDecoration:'none' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.brandLift} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 16 16 8M10 8h6v6"/>
        </svg>
      </a>
    )
  }
  return (
    <button className="wr-row-plus" aria-label="Add LACDB link"
      onClick={e => { e.stopPropagation(); onNavigate(deal.id) }} style={PLUS_BTN}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textLow} strokeWidth="2" strokeLinecap="round">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    </button>
  )
}

// ── Dropbox cell ──────────────────────────────────────────────────────────────
function DbxCell({ url, dealId, onNavigate }: { url: string | null; dealId: string; onNavigate: (id: string) => void }) {
  if (url) return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
      style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'rgba(139,92,246,0.14)', textDecoration:'none' }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.brandLift} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3 5.5 3.4L12 9.8 6.5 6.4 12 3ZM6.5 11.6 12 8.2l5.5 3.4L12 15 6.5 11.6ZM9.2 17.2 12 15.5l2.8 1.7-2.8 1.8-2.8-1.8Z"/>
      </svg>
    </a>
  )
  return (
    <button onClick={e => { e.stopPropagation(); onNavigate(dealId) }}
      style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, border:'1px dashed rgba(255,255,255,0.22)', background:'none', cursor:'pointer' }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textLow} strokeWidth="2" strokeLinecap="round">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    </button>
  )
}

// ── Type dropdown ─────────────────────────────────────────────────────────────
function TypeDropdown({ open, types, activeType, onSelect, onClose }: {
  open: boolean; types: string[]; activeType: string | null;
  onSelect: (t: string) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div ref={ref} style={{
      position:'absolute', top:'100%', left:0, marginTop:4,
      background:'#1E1D26', border:`1px solid ${C.border}`, borderRadius:8,
      overflow:'hidden', zIndex:200, minWidth:160,
    }}>
      <button onClick={() => onSelect('')} style={{
        display:'block', width:'100%', textAlign:'left', padding:'10px 14px',
        border:'none', cursor:'pointer',
        background: !activeType ? 'rgba(139,92,246,0.18)' : 'transparent',
        color: !activeType ? C.brandLift : C.textMid,
        ...headerFace, fontSize: 14,
      }}>All types</button>
      {types.length === 0 && <div style={{ ...headerFace, fontSize: 13, color:C.textLow, padding:'10px 14px' }}>No types</div>}
      {types.map(t => {
        return (
          <button key={t} onClick={() => onSelect(t)} style={{
            display:'block', width:'100%', textAlign:'left', padding:'10px 14px',
            border:'none', cursor:'pointer',
            background: t === activeType ? 'rgba(139,92,246,0.18)' : 'transparent',
            color: t === activeType ? C.brandLift : C.textMid,
            ...headerFace, fontSize: 14,
          }}>{typeTitle(t)}</button>
        )
      })}
    </div>
  )
}

// ── Column header cell ────────────────────────────────────────────────────────
function CH({ label, sk, activeSk, sortDir, onClick, style }: {
  label: string; sk: SortKey; activeSk: SortKey; sortDir: SortDir;
  onClick: () => void; style?: React.CSSProperties;
}) {
  const active = sk === activeSk
  return (
    <div onClick={onClick} style={{ cursor:'pointer', display:'flex', alignItems:'center', ...style }}>
      <span style={{
        ...headerFace, fontSize: 13,
        color: active ? C.textHi : C.textLow,
        fontWeight: active ? 600 : 500,
        userSelect: 'none', whiteSpace: 'nowrap',
      }}>
        {label}
        {active && <span style={{ color:C.brandLift, marginLeft:4, fontSize:10 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </div>
  )
}

// ── Group header (sticky) ─────────────────────────────────────────────────────
function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{
      position:'sticky', top:36, zIndex:10,
      display:'flex', alignItems:'center', height:30,
      padding:'0 14px 0 var(--wr-edge)', gap:10,
      background:C.bgPanel, borderBottom:`1px solid ${C.borderPanel}`,
      boxSizing:'border-box',
    }}>
      <span style={{ ...headerFace, fontSize: 13, color: C.textLow, fontWeight: 500 }}>{label}</span>
      <span style={{ ...headerFace, fontSize: 13, color: COUNT_MUTED }}>{count}</span>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ filterName }: { filterName: string }) {
  return (
    <div style={{ padding:'40px 0', textAlign:'center' }}>
      <span style={{ ...DT3, color:C.textLow, fontFamily:FONT_MONO }}>
        {filterName === 'NONE' ? 'NO DEALS YET' : `NO DEALS MATCH ${filterName}`}
      </span>
    </div>
  )
}

// ── LISTINGS deal row ─────────────────────────────────────────────────────────
function DealRow({ deal, ratings, onRatingChange, onTaskOpen, onNavigate }: {
  deal: EnrichedDeal;
  ratings: Record<string, number | null>;
  onRatingChange: (id: string, r: number | null) => void;
  onTaskOpen: (d: EnrichedDeal) => void;
  onNavigate: (id: string) => void;
}) {
  const rating = ratings[deal.id] ?? null
  const deadlineText = deal._deadlineDate
    ? [fmtDeadlineWhen(deal._deadlineDate), deal._deadlineLabel].filter(Boolean).join(' · ')
    : ''

  return (
    <div className="wr-deal-row" data-deal-id={deal.id} onClick={() => onNavigate(deal.id)}
      style={{ position:'relative', display:'flex', alignItems:'center', height:46, borderBottom:`1px solid ${C.borderHair}`, boxSizing:'border-box', cursor:'pointer' }}>

      {/* Address, then the stage pill */}
      <div style={{ flex:1, minWidth:0, padding:'0 14px 0 var(--wr-edge)', display:'flex', alignItems:'center', gap:8, boxSizing:'border-box', overflow:'hidden' }}>
        <span style={{ ...DS3, color:C.textHi, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>
          {deal._shortAddr}
        </span>
        <StagePill status={deal.status} />
      </div>

      {/* Client */}
      <div style={{ width:COL.client, flexShrink:0, padding:'0 14px', boxSizing:'border-box', overflow:'hidden' }}>
        <span style={{ ...DS5, color:C.textMid, display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{deal._client}</span>
      </div>

      {/* Next deadline */}
      <div style={{ width:COL.deadline, flexShrink:0, padding:'0 14px', boxSizing:'border-box', overflow:'hidden' }}>
        {deadlineText
          ? <span title={deal._deadlineLabel || deadlineText} style={{ ...DT7, letterSpacing:'0.04em', color: deadlineInk(deal._deadlineDays), whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'block' }}>{deadlineText}</span>
          : null
        }
      </div>

      {/* LACDB — icon when the listing is in the active feed; otherwise a hover plus */}
      <div style={{ width:COL.lacdb, flexShrink:0, display:'flex', justifyContent:'center', alignItems:'center' }}>
        <LacdbCell deal={deal} onNavigate={onNavigate} />
      </div>

      {/* Add Task — hover on pointer devices, always on touch */}
      <div style={{ width:COL.task, flexShrink:0, display:'flex', justifyContent:'center', alignItems:'center' }}>
        <button className="wr-row-plus" aria-label="Add task" onClick={e => { e.stopPropagation(); onTaskOpen(deal) }}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, border:`1px solid rgba(255,255,255,0.20)`, background:'none', cursor:'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textMid} strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </div>

      {/* ★ RANK */}
      <div style={{ width:COL.rank, flexShrink:0, display:'flex', justifyContent:'center', alignItems:'center' }}>
        <StarRating dealId={deal.id} rating={rating} onChange={onRatingChange} />
      </div>

      {/* Value */}
      <div style={{ width:COL.value, flexShrink:0, padding:'0 14px', boxSizing:'border-box', textAlign:'right' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color:C.textHi }}>
          {/* DI-5: blank when no value */}
          {deal._value != null ? fmtAsking(deal._value) : ''}
        </span>
      </div>

      {/* Commission */}
      <div style={{ width:COL.comm, flexShrink:0, padding:'0 14px', boxSizing:'border-box', textAlign:'right' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color:C.moneyIn }}>
          {/* DI-5: blank when no commission */}
          {deal._commission != null ? fmtMoney(deal._commission) : ''}
        </span>
      </div>

      {/* Dropbox */}
      <div style={{ width:COL.dbx, flexShrink:0, display:'flex', justifyContent:'center', alignItems:'center' }}>
        <DbxCell url={deal.dropbox_link} dealId={deal.id} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

// ── Portfolio rollup row ──────────────────────────────────────────────────────
function PortfolioRow({ portfolio, onNavigate }: { portfolio: PortfolioRollup; onNavigate: (id: string) => void }) {
  return (
    <div onClick={() => onNavigate(portfolio.firstDealId)}
      style={{ display:'flex', alignItems:'center', height:46, borderBottom:`1px solid ${C.borderHair}`, boxSizing:'border-box', cursor:'pointer' }}>

      {/* Address area — layers glyph + name + site count */}
      <div style={{ flex:1, minWidth:0, padding:'0 14px 0 var(--wr-edge)', display:'flex', alignItems:'center', gap:11, boxSizing:'border-box', overflow:'hidden' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.brandLift} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
          <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z"/>
          <path d="M3 12.5 12 17l9-4.5"/>
          <path d="M3 17 12 21.5l9-4.5"/>
        </svg>
        <span style={{ ...DS3, color:C.textHi, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{portfolio.name}</span>
        <span style={{ ...DT7, color:C.textLow, flexShrink:0 }}>{portfolio.siteCount} SITES</span>
      </div>

      {/* Client — DI-7: empty on rollup rows */}
      <div style={{ width:COL.client, flexShrink:0 }} />

      {/* Deadline — empty */}
      <div style={{ width:COL.deadline, flexShrink:0 }} />
      {/* LACDB — empty */}
      <div style={{ width:COL.lacdb, flexShrink:0 }} />
      {/* Task — empty */}
      <div style={{ width:COL.task, flexShrink:0 }} />
      {/* ★ — empty */}
      <div style={{ width:COL.rank, flexShrink:0 }} />

      {/* Value — summed */}
      <div style={{ width:COL.value, flexShrink:0, padding:'0 14px', boxSizing:'border-box', textAlign:'right' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color:C.textHi }}>
          {/* DI-5: blank when no value */}
          {portfolio.value != null ? fmtAsking(portfolio.value) : ''}
        </span>
      </div>

      {/* Commission — summed */}
      <div style={{ width:COL.comm, flexShrink:0, padding:'0 14px', boxSizing:'border-box', textAlign:'right' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color:C.moneyIn }}>
          {/* DI-5: blank when no commission */}
          {portfolio.commission != null ? fmtMoney(portfolio.commission) : ''}
        </span>
      </div>

      {/* DBX — empty */}
      <div style={{ width:COL.dbx, flexShrink:0 }} />
    </div>
  )
}

// ── DealsPage (inner, post-auth) ──────────────────────────────────────────────
function DealsPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const tab      = (searchParams.get('tab')      ?? 'listings') as TabKey
  const legacyFilter = searchParams.get('filter')
  const stage: StageKey = isStageKey(searchParams.get('stage'))
    ? (searchParams.get('stage') as StageKey)
    : legacyFilter === 'hot' ? 'hot'
    : legacyFilter === 'uc' ? 'under_contract'
    : 'all'
  const typeValue = searchParams.get('type_val') ?? null

  const [allDeals,     setAllDeals]     = useState<EnrichedDeal[]>([])
  const [portfolios,   setPortfolios]   = useState<PortfolioRollup[]>([])
  const [tabCounts,    setTabCounts]    = useState<TabCounts>({ listings: 0, tenants: 0, buyers: 0, targets: 0 })
  const [ratings,      setRatings]      = useState<Record<string, number | null>>({})
  const [allTypes,     setAllTypes]     = useState<string[]>([])
  const [loading,      setLoading]      = useState(true)
  const [taskDeal,     setTaskDeal]     = useState<EnrichedDeal | null>(null)
  const [taskSaveError, setTaskSaveError] = useState<string | null>(null)
  const [typeDropOpen, setTypeDropOpen] = useState(false)

  const [sortKey, setSortKey] = useState<SortKey>('address')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // ── Nav helpers ───────────────────────────────────────────────────────────
  function writeQuery(next: { stage?: StageKey; type?: string | null; tab?: TabKey }) {
    const p = new URLSearchParams(Array.from(searchParams.entries()))
    p.set('tab', next.tab ?? tab)
    p.set('stage', next.stage ?? stage)
    p.delete('filter')
    const tv = next.type === undefined ? typeValue : next.type
    if (tv) p.set('type_val', tv); else p.delete('type_val')
    router.replace(`/warroom/deals?${p.toString()}`)
    setTypeDropOpen(false)
  }
  function setTab(t: TabKey) { writeQuery({ tab: t, stage: 'all', type: null }) }
  function setStage(s: StageKey) { writeQuery({ stage: s }) }
  function setType(tv: string | null) { writeQuery({ type: tv }) }
  function handleSort(k: SortKey) {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }
  function navigate(id: string) { router.push(`/warroom/deal/?id=${id}`) }

  // ── Data fetch ────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [dealsRes, econRes, deadlinesRes, mmRes] = await Promise.all([
        supabase.from('deals').select(`
          id, name, address, addr_display, addr_number, addr_street_name, addr_street_type,
          addr_direction, addr_city, status, type, property_type, rating, lacdb_url, deal_source, dropbox_link,
          portfolio_id, is_money_mover, deal_contacts(contacts(name))
        `).order('addr_street_name'),

        supabase.from('deal_economics').select(
          'deal_id, transaction_type, asking_price, sale_commission_pct, sqft, lease_rate_psf, lease_term_years, lease_commission_pct, offer_price'
        ),

        supabase.from('contract_deadlines')
          .select('deal_id, deadline_date, deadline_type, label')
          .in('status', ['pending', 'extended'])
          .order('deadline_date'),

        supabase.from('money_movers').select('deal_id').not('deal_id', 'is', null),
      ])

      const rawDeals = (dealsRes.data ?? []) as DealRow[]
      const today    = todayCST()

      const econMap: Record<string, DealEcon> = {}
      for (const e of (econRes.data ?? []) as DealEcon[]) econMap[e.deal_id] = e

      const deadlineBuckets: Record<string, DeadlineRow[]> = {}
      for (const dl of (deadlinesRes.data ?? []) as DeadlineRow[]) {
        if (!dl.deadline_date) continue
        if (!deadlineBuckets[dl.deal_id]) deadlineBuckets[dl.deal_id] = []
        deadlineBuckets[dl.deal_id].push(dl)
      }
      const deadlineMap: Record<string, DeadlineRow> = {}
      for (const [dealId, rows] of Object.entries(deadlineBuckets)) {
        const upcoming = rows.filter(r => r.deadline_date >= today).sort((a, b) => a.deadline_date.localeCompare(b.deadline_date))
        const overdue = rows.filter(r => r.deadline_date < today).sort((a, b) => b.deadline_date.localeCompare(a.deadline_date))
        deadlineMap[dealId] = upcoming[0] ?? overdue[0]
      }

      const mmSet = new Set<string>()
      for (const mm of (mmRes.data ?? []) as { deal_id: string }[]) {
        if (mm.deal_id) mmSet.add(mm.deal_id)
      }

      const ratingInit: Record<string, number | null> = {}
      const enriched: EnrichedDeal[] = rawDeals.map(deal => {
        ratingInit[deal.id] = deal.rating

        const econ       = applyFreshAsking(deal, econMap[deal.id] ?? null)
        const isBuyerDeal = deal.type?.toLowerCase() === 'buyer'
        let value: number | null = null
        let commission: number | null = null
        if (econ) {
          if (isBuyerDeal) {
            value = econ.offer_price ?? null
            if (value != null && econ.sale_commission_pct != null) {
              commission = calcSaleCommission(value, econ.sale_commission_pct)
            }
          } else if ((econ.transaction_type === 'sale' || econ.transaction_type === 'both') && econ.asking_price != null) {
            value = econ.asking_price
            commission = calcCommission(econ)
          } else if (econ.transaction_type === 'lease') {
            value = calcLeaseValue(econ.sqft ?? null, econ.lease_rate_psf ?? null, econ.lease_term_years ?? null)
            commission = calcCommission(econ)
          }
        }

        const dl           = deadlineMap[deal.id] ?? null
        const deadlineDays = dl?.deadline_date ? daysBetween(today, dl.deadline_date) : null

        return {
          ...deal,
          _shortAddr:     formatDealTitle(deal),
          _client:        clientFromDeal(deal),
          _deadlineDays:  deadlineDays,
          _deadlineDate:  dl?.deadline_date ?? null,
          _deadlineLabel: dl ? shortDeadlineLabel(dl.deadline_type, dl.label) : '',
          _value:         value,
          _commission:    commission,
          _isMoneyMover:  mmSet.has(deal.id) || !!deal.is_money_mover,
        }
      })

      setRatings(ratingInit)
      setAllDeals(enriched)

      // 156.3: TYPE filter uses property_type, not deal engagement type
      setAllTypes(['OFFICE', 'RETAIL', 'INDUSTRIAL', 'MULTIFAMILY', 'LAND'])

      // Tab counts (LISTINGS = all, tenants/buyers/targets by type)
      setTabCounts({
        listings: rawDeals.length,
        tenants:  rawDeals.filter(d => d.type?.toLowerCase() === 'tenant_rep').length,
        buyers:   rawDeals.filter(d => d.type?.toLowerCase() === 'buyer').length,
        targets:  rawDeals.filter(d => d.type?.toLowerCase() === 'potential_listing' || d.type?.toLowerCase() === 'target').length,
      })

      // Portfolio rollups
      const portGroups: Record<string, EnrichedDeal[]> = {}
      for (const d of enriched) {
        if (!d.portfolio_id) continue
        if (!portGroups[d.portfolio_id]) portGroups[d.portfolio_id] = []
        portGroups[d.portfolio_id].push(d)
      }
      setPortfolios(Object.entries(portGroups).map(([pid, members]) => ({
        portfolioId: pid,
        name:        members[0].name ?? '—',
        siteCount:   members.length,
        client:      members[0]._client,
        value:       members.reduce<number | null>((acc, m) => m._value != null ? (acc ?? 0) + m._value : acc, null),
        commission:  members.reduce<number | null>((acc, m) => m._commission != null ? (acc ?? 0) + m._commission : acc, null),
        firstDealId: members[0].id,
      })))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function handleRatingChange(id: string, r: number | null) {
    setRatings(prev => ({ ...prev, [id]: r }))
    setAllDeals(prev => prev.map(d => d.id === id ? { ...d, rating: r } : d))
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  function matchesType(d: EnrichedDeal): boolean {
    if (!typeValue) return true
    return d.property_type?.toUpperCase() === typeValue.toUpperCase()
  }
  function matchesStage(d: EnrichedDeal): boolean {
    if (!matchesType(d)) return false
    if (stage === 'all') return true
    return stageOf(d.status) === stage
  }

  function cmpNullLast(av: number | null, bv: number | null): number {
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return sortDir === 'asc' ? av - bv : bv - av
  }

  // ── Sort ──────────────────────────────────────────────────────────────────
  function sortDeals(rows: EnrichedDeal[]): EnrichedDeal[] {
    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case 'address':  return sortDir === 'asc' ? a._shortAddr.localeCompare(b._shortAddr) : b._shortAddr.localeCompare(a._shortAddr)
        case 'client':   return sortDir === 'asc' ? a._client.localeCompare(b._client) : b._client.localeCompare(a._client)
        case 'deadline': return cmpNullLast(a._deadlineDays, b._deadlineDays)
        case 'value':    return cmpNullLast(a._value, b._value)
        case 'comm':     return cmpNullLast(a._commission, b._commission)
        case 'rank':     return cmpNullLast(a.rating && a.rating > 0 ? a.rating : null, b.rating && b.rating > 0 ? b.rating : null)
        default:         return a._shortAddr.localeCompare(b._shortAddr)
      }
    })
  }

  function sortPortfolios(rows: PortfolioRollup[]): PortfolioRollup[] {
    // On RANK/DEADLINE (unpopulated in portfolios), hold alphabetical
    const effKey = (sortKey === 'rank' || sortKey === 'deadline') ? 'address' : sortKey
    const effDir = (sortKey === 'rank' || sortKey === 'deadline') ? 'asc' : sortDir
    return [...rows].sort((a, b) => {
      let cmp = 0
      switch (effKey) {
        case 'address': cmp = a.name.localeCompare(b.name); break
        case 'client':  cmp = a.client.localeCompare(b.client); break
        case 'value':   cmp = (a.value ?? -1) - (b.value ?? -1); break
        case 'comm':    cmp = (a.commission ?? -1) - (b.commission ?? -1); break
        default:        cmp = a.name.localeCompare(b.name)
      }
      return effDir === 'asc' ? cmp : -cmp
    })
  }

  // Derived rows
  const typedDeals = allDeals.filter(matchesType)
  const stageCounts: Record<StageKey, number> = {
    all: typedDeals.length,
    pipeline: 0, review: 0, active: 0, hot: 0, under_contract: 0, closed: 0, in_service: 0,
  }
  for (const d of typedDeals) {
    const key = stageOf(d.status)
    if (key !== 'other') stageCounts[key] += 1
  }
  const matchedDeals = typedDeals.filter(d => stage === 'all' || stageOf(d.status) === stage)
  const totalValue = matchedDeals.reduce<number | null>((acc, d) => d._value != null ? (acc ?? 0) + d._value : acc, null)
  const totalComm  = matchedDeals.reduce<number | null>((acc, d) => d._commission != null ? (acc ?? 0) + d._commission : acc, null)

  const filteredDeals      = matchedDeals.filter(d => d.portfolio_id == null)
  const filteredPortfolios = portfolios.filter(p => {
    const members = allDeals.filter(d => d.portfolio_id === p.portfolioId)
    return members.some(d => matchesStage(d))
  })
  const sortedDeals      = sortDeals(filteredDeals)
  const sortedPortfolios = sortPortfolios(filteredPortfolios)

  // Stub task
  const stubTask: Task = {
    id: '', title: '', status: 'open', due_date: null,
    is_life: false, is_entity: false,
    deal_id: taskDeal?.id ?? null,
    deals: taskDeal ? {
      name: taskDeal.name ?? taskDeal._shortAddr,
      addr_display: taskDeal.addr_display,
      addr_street_name: taskDeal.addr_street_name,
      addr_number: taskDeal.addr_number,
      addr_city: taskDeal.addr_city,
    } : null,
  }

  // Filter label for empty state
  const stageNames: Record<StageKey, string> = {
    all: 'All', pipeline: 'Pipeline', review: 'Review', active: 'Active',
    hot: 'HOT', under_contract: 'Under Contract', closed: 'Closed', in_service: 'In Service',
  }
  const filterLabel = [stage === 'all' ? '' : stageNames[stage], typeValue ? typeTitle(typeValue) : ''].filter(Boolean).join(' · ') || 'NONE'

  const STAGE_TABS: { key: StageKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'closed', label: 'Closed' },
    { key: 'hot', label: 'HOT' },
    { key: 'in_service', label: 'In Service' },
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'review', label: 'Review' },
    { key: 'under_contract', label: 'Under Contract' },
  ]

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: 'buyers',   label: 'Buyers',   count: tabCounts.buyers   },
    { key: 'listings', label: 'Listings', count: tabCounts.listings },
    { key: 'targets',  label: 'Targets',  count: tabCounts.targets  },
    { key: 'tenants',  label: 'Tenants',  count: tabCounts.tenants  },
  ]

  function stageAccent(key: StageKey): string {
    switch (key) {
      case 'pipeline': return '#93C5FD'
      case 'review': return '#FBBF24'
      case 'active': return '#C4B5FD'
      case 'hot': return C.hot
      case 'under_contract': return '#5EEAD4'
      case 'closed': return '#D9D7E2'
      case 'in_service': return '#A78BFA'
      default: return C.textHi
    }
  }

  function stageTab(key: StageKey, label: string) {
    const isActive = stage === key
    const accent = stageAccent(key)
    return (
      <button key={key} onClick={() => setStage(key)} style={{
        display:'flex', alignItems:'center', justifyContent:'center', gap:6,
        position:'relative', background:'none', border:'none', cursor:'pointer',
        padding:0, height:'100%', flexShrink:0,
      }}>
        <span className="wr-stage-label" style={{
          ...headerFace, fontSize: 15,
          fontWeight: isActive ? 600 : 500,
          color: isActive ? accent : TAB_GRAY,
        }}>{label}</span>
        <span style={{
          ...headerFace, fontSize: 13, fontWeight: 500, color: COUNT_MUTED,
        }}>{stageCounts[key]}</span>
        {isActive && <div style={{ position:'absolute', left:0, right:0, bottom:0, height:2, background: accent }} />}
      </button>
    )
  }

  const typeLabel = typeValue ? typeTitle(typeValue) : 'Type'

  return (
    <div style={{ display:'flex', width:'100vw', maxWidth:'100vw', height:'100vh', background:C.bgBase, color:C.textHi, fontFamily:FONT_DISP, overflow:'hidden' }}>
      <style>{`
        .wr-stage-scroll { scrollbar-width: thin; }
        .wr-row-plus { opacity: 1; }
        @media (hover: hover) and (pointer: fine) {
          .wr-row-plus { opacity: 0; pointer-events: none; }
          .wr-deal-row:hover .wr-row-plus,
          .wr-deal-row:focus-within .wr-row-plus { opacity: 1; pointer-events: auto; }
        }
        .wr-deals-main { --wr-edge: 24px; }
        .wr-stage-scroll { gap: 18px; }
        @media (max-width: 1023px) {
          .wr-deals-main { --wr-edge: 16px; }
          .wr-deals-rail { display: none !important; }
          .wr-row-plus { opacity: 1 !important; pointer-events: auto !important; }
          .wr-deals-plate, .wr-deals-clock { display: none !important; }
          .wr-engage-row { height: 56px !important; padding: 0 var(--wr-edge) !important; }
          .wr-engage-scroll { gap: 14px !important; }
          .wr-type-label { font-size: 18px !important; letter-spacing: 0 !important; }
          .wr-stage-label { font-size: 14px !important; }
          .wr-stage-scroll { gap: 14px; }
          .wr-totals { font-size: 12px !important; }
          .wr-deals-band { height: 64px !important; padding: 0 16px !important; gap: 12px !important; }
          .wr-deals-mark { width: 36px !important; height: 36px !important; }
          .wr-deals-word { margin-top: 0 !important; }
          .wr-deals-word img { height: 36px !important; }
        }
      `}</style>

      {/* Left rail */}
      <LeftRail active="DEALS" />

      {/* Main column */}
      <div className="wr-deals-main" style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>

        {/* Identity band */}
        <IdentityBand />

        {/* ── Tab row — 62px, FIXED ── */}
        <div className="wr-engage-row" style={{
          height:72, flexShrink:0, display:'flex', alignItems:'center',
          padding:'0 var(--wr-edge)', boxSizing:'border-box', gap:12,
          borderBottom: tab === 'listings' ? 'none' : `1px solid ${C.border}`,
        }}>
          <div className="wr-engage-scroll" style={{ display:'flex', alignItems:'center', gap:22, flex:1, minWidth:0, overflowX:'auto' }}>
            {TABS.map((t) => {
              const isActive = t.key === tab
              return (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  position:'relative', display:'flex', alignItems:'center', gap:8,
                  background:'none', border:'none', cursor:'pointer', padding:0, height:'100%', flexShrink:0,
                }}>
                  <span className="wr-type-label" style={{
                    ...headerFace, fontSize: 22, fontWeight: isActive ? 600 : 500,
                    color: isActive ? C.textHi : TAB_GRAY,
                  }}>{t.label}</span>
                  <span style={{ ...headerFace, fontSize: 16, fontWeight: 500, color: COUNT_MUTED }}>{t.count}</span>
                  {isActive && <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background: C.brandStrong }} />}
                </button>
              )
            })}
          </div>
          <Fab label="Add listing" aria-label="Add listing" onClick={() => router.push('/warroom/deals/new')} />
        </div>

        {tab === 'listings' && (
          <>
            <div style={{
              height:46, flexShrink:0, display:'flex', alignItems:'stretch',
              borderBottom:`1px solid ${C.borderPanel}`, boxSizing:'border-box',
            }}>
              <div className="wr-stage-scroll" style={{
                flex:1, minWidth:0, display:'flex', alignItems:'stretch', overflowX:'auto', paddingLeft: HEADER_EDGE,
              }}>
                {STAGE_TABS.map(f => stageTab(f.key, f.label))}
              </div>
              <div style={{ display:'flex', alignItems:'center', position:'relative', flexShrink:0, borderLeft:`1px solid ${C.borderPanel}` }}>
                <button onClick={() => setTypeDropOpen(o => !o)} style={{
                  display:'flex', alignItems:'center', gap:5, background:'none', border:'none',
                  cursor:'pointer', padding:'0 16px', height:'100%', position:'relative',
                }}>
                  <span className="wr-stage-label" style={{
                    ...headerFace, fontSize: 15,
                    fontWeight: typeValue ? 600 : 500,
                    color: typeValue ? C.textHi : TAB_GRAY,
                  }}>{typeLabel}</span>
                  <span style={{ ...headerFace, fontSize: 13, color: COUNT_MUTED }}>▾</span>
                  {typeValue && <div style={{ position:'absolute', left:16, right:16, bottom:0, height:2, background: C.brandStrong }} />}
                </button>
                <TypeDropdown open={typeDropOpen} types={allTypes} activeType={typeValue}
                  onSelect={v => setType(v || null)} onClose={() => setTypeDropOpen(false)} />
              </div>
            </div>

            <div className="wr-totals" style={{
              height:32, flexShrink:0, display:'flex', alignItems:'center',
              padding:'0 var(--wr-edge)', borderBottom:`1px solid ${C.borderHair}`, boxSizing:'border-box',
              ...headerFace, fontSize: 13, color: C.textMid,
            }}>
              {matchedDeals.length} deals · {totalValue != null ? fmtAsking(totalValue) : ''} value · {totalComm != null ? fmtMoney(totalComm) : ''} commission
            </div>
          </>
        )}

        {/* ── Scrollable body. Headers travel with the sheet so narrow widths scroll as one. ── */}
        <div style={{ flex:1, overflow:'auto', position:'relative', minHeight:0 }}>
          {tab === 'listings' ? (
            loading ? (
              <div style={{ padding:40, textAlign:'center' }}>
                <span style={{ ...DT3, color:C.textLow, fontFamily:FONT_MONO }}>LOADING…</span>
              </div>
            ) : (
              <div style={{ minWidth:1100 }}>
                <div style={{
                  position:'sticky', top:0, zIndex:20, height:36, display:'flex', alignItems:'center',
                  background:C.bgPanel, borderBottom:`1px solid ${C.border}`, boxSizing:'border-box',
                }}>
                  <CH label="Address" sk="address" activeSk={sortKey} sortDir={sortDir} onClick={() => handleSort('address')}
                    style={{ flex:1, minWidth:0, padding:'0 14px 0 var(--wr-edge)', boxSizing:'border-box' }} />
                  <CH label="Client" sk="client" activeSk={sortKey} sortDir={sortDir} onClick={() => handleSort('client')}
                    style={{ width:COL.client, flexShrink:0, padding:'0 14px', boxSizing:'border-box' }} />
                  <CH label="Deadline" sk="deadline" activeSk={sortKey} sortDir={sortDir} onClick={() => handleSort('deadline')}
                    style={{ width:COL.deadline, flexShrink:0, padding:'0 14px', boxSizing:'border-box' }} />
                  <div style={{ width:COL.lacdb, flexShrink:0, display:'flex', justifyContent:'center', alignItems:'center' }}>
                    <span style={{ ...headerFace, fontSize: 13, color: C.textLow }}>LACDB</span>
                  </div>
                  <div style={{ width:COL.task, flexShrink:0, display:'flex', justifyContent:'center', alignItems:'center' }}>
                    <span style={{ ...headerFace, fontSize: 13, color: C.textLow }}>Task</span>
                  </div>
                  <CH label="Rank" sk="rank" activeSk={sortKey} sortDir={sortDir} onClick={() => handleSort('rank')}
                    style={{ width:COL.rank, flexShrink:0, padding:'0 14px', boxSizing:'border-box', display:'flex', justifyContent:'center' }} />
                  <CH label="Value" sk="value" activeSk={sortKey} sortDir={sortDir} onClick={() => handleSort('value')}
                    style={{ width:COL.value, flexShrink:0, padding:'0 14px', boxSizing:'border-box', display:'flex', justifyContent:'flex-end' }} />
                  <CH label="Comm" sk="comm" activeSk={sortKey} sortDir={sortDir} onClick={() => handleSort('comm')}
                    style={{ width:COL.comm, flexShrink:0, padding:'0 14px', boxSizing:'border-box', display:'flex', justifyContent:'flex-end' }} />
                  <div style={{ width:COL.dbx, flexShrink:0, display:'flex', justifyContent:'center', alignItems:'center' }}>
                    <span style={{ ...headerFace, fontSize: 13, color: C.textLow }}>DBX</span>
                  </div>
                </div>

                <GroupHeader label="Portfolios" count={sortedPortfolios.length} />
                {sortedPortfolios.map(p => (
                  <PortfolioRow key={p.portfolioId} portfolio={p} onNavigate={navigate} />
                ))}

                <GroupHeader label="Deals" count={sortedDeals.length} />
                {sortedDeals.length === 0
                  ? <EmptyState filterName={allDeals.length === 0 ? 'NONE' : filterLabel} />
                  : sortedDeals.map(d => (
                    <DealRow key={d.id} deal={d} ratings={ratings}
                      onRatingChange={handleRatingChange}
                      onTaskOpen={setTaskDeal}
                      onNavigate={navigate} />
                  ))
                }
              </div>
            )
          ) : tab === 'buyers' ? (
            filteredDeals.filter(d => d.type?.toLowerCase() === 'buyer').length === 0 ? (
              <div style={{ padding:'40px 44px' }}>
                <span style={{ ...DT3, color:C.textLow, fontFamily:FONT_MONO }}>NO BUYER ENGAGEMENTS</span>
              </div>
            ) : (
              <>
                {filteredDeals.filter(d => d.type?.toLowerCase() === 'buyer').map(d => (
                  <DealRow key={d.id} deal={d} ratings={ratings}
                    onRatingChange={handleRatingChange}
                    onTaskOpen={setTaskDeal}
                    onNavigate={navigate} />
                ))}
              </>
            )
          ) : (
            <div style={{ padding:'40px 44px' }}>
              <span style={{ ...DT3, color:C.textLow, fontFamily:FONT_MONO }}>
                {tab === 'tenants'  && 'TENANT ENGAGEMENTS WILL LIVE HERE'}
                {tab === 'targets'  && 'PROPERTY TARGETS WILL LIVE HERE'}
              </span>
            </div>
          )}
        </div>
      </div>

      {taskSaveError && (
        <div style={{ position: 'fixed', left: 24, right: 24, bottom: 24, zIndex: 400, padding: '10px 14px', borderRadius: 10, background: '#12111B', border: '1px solid rgba(255,77,77,0.4)', color: '#FF4D4D', fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 13, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ flex: 1 }}>{taskSaveError}</span>
          <button type="button" onClick={() => setTaskSaveError(null)} style={{ background: 'none', border: 'none', color: '#B8B6C6', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}
      {/* Task modal */}
      {taskDeal && (
        <TaskModal
          task={stubTask} isCreate
          onClose={() => setTaskDeal(null)}
          onCompleted={() => setTaskDeal(null)}
          onSaved={() => { setTaskDeal(null); fetchData() }}
          onCreateFailed={(_id, message) => setTaskSaveError(message)}
        />
      )}
    </div>
  )
}

// ── Root export — PIN gate ────────────────────────────────────────────────────
export default function DealsIndexPage() {
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    const expiry = localStorage.getItem(SESSION_KEY)
    if (expiry && Date.now() < parseInt(expiry)) setUnlocked(true)
  }, [])

  const handlePinSuccess = useCallback(() => {
    const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000
    localStorage.setItem(SESSION_KEY, expiry.toString())
    setUnlocked(true)
  }, [])

  if (!unlocked) {
    return <PinGate pinHash={PIN_HASH} sha256={sha256} onSuccess={handlePinSuccess} />
  }

  return <DealsPage />
}

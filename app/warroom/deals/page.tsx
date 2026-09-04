'use client'
/**
 * /warroom/deals — Deals Index
 * D5.2 · build(48l) · from frame 49a · spec D5.2 + D5.2.1a · 8.24.26 1645
 *
 * Four tabs: LISTINGS / TENANTS / BUYERS / TARGETS
 * LISTINGS: 9-column dense sortable table, 5 filter segments, portfolio rollup rows.
 * TENANTS / BUYERS / TARGETS: placeholder.
 *
 * Chrome (rail, band, tab row, filter row, col headers) does NOT scroll.
 * Group headers STICKY while body scrolls.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calcCommission, calcLeaseValue, fmtMoney } from '@/lib/dealMath'
import { formatAddress } from '@/lib/formatAddress'
import PinGate from '@/components/warroom/PinGate'
import TaskModal from '@/app/warroom/TaskModal'
import type { Task } from '@/app/warroom/TaskModal'
import Fab from '@/assets/fab/Fab'
import '@/assets/fab/fab.css'
import {
  DT1, DT2, DT3, DT5, DT7, DT8,
  DS3, DS5,
  DM1,
} from '@/components/warroom/desktopTypes'

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
  border:      'rgba(255,255,255,0.14)',
  borderPanel: 'rgba(255,255,255,0.11)',
  borderHair:  'rgba(255,255,255,0.10)',
} as const

const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISP = "'Space Grotesk', system-ui, sans-serif"

// ── Column widths (from 49a frame) ────────────────────────────────────────────
const COL = {
  client:   210,
  deadline: 150,
  lacdb:     64,
  task:      56,
  rank:      92,
  value:    140,
  comm:     150,
  dbx:       64,
} as const

// ── Types ─────────────────────────────────────────────────────────────────────
type TabKey    = 'listings' | 'tenants' | 'buyers' | 'targets'
type FilterKey = 'all' | 'hot' | 'uc' | 'money' | 'type'
type SortKey   = 'address' | 'client' | 'deadline' | 'lacdb' | 'task' | 'rank' | 'value' | 'comm' | 'dbx'
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
  rating: number | null
  lacdb_url: string | null
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
}

interface DeadlineRow {
  deal_id: string
  deadline_date: string
  deadline_type: string | null
}

interface EnrichedDeal extends DealRow {
  _shortAddr:    string
  _client:       string
  _deadlineDays: number | null
  _deadlineDate: string | null
  _value:        number | null
  _commission:   number | null
  _isMoneyMover: boolean
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

function fmtDeadline(days: number, dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt  = new Date(y, m - 1, d)
  const mon = dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return `${days}D · ${mon} ${d}`
}

function clientFromDeal(deal: DealRow): string {
  return deal.deal_contacts?.[0]?.contacts?.name ?? deal.name ?? '—'
}

function getStatusLabel(status: string | null): string {
  if (!status) return ''
  switch (status.toLowerCase()) {
    case 'hot':            return 'HOT'
    case 'under_contract': return 'UC'
    case 'pipeline':       return 'PIPELINE'
    case 'active':         return 'ACTIVE'
    case 'active_listing': return 'ACTIVE'
    case 'in_review':
    case 'review':         return 'REVIEW'
    case 'in_service':     return 'IN SERVICE'
    case 'pending_payment':return 'PENDING'
    case 'closed':         return 'CLOSED'
    default: return status.replace(/_/g, ' ').toUpperCase()
  }
}

function pillStyle(status: string | null): React.CSSProperties {
  const s = status?.toLowerCase() ?? ''
  if (s === 'hot') return {
    fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em',
    color: '#0A0A0F', background: C.hot, borderRadius: 4, padding: '4px 7px', flexShrink: 0,
  }
  if (s === 'under_contract') return {
    fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em',
    color: C.brandLift, border: `1px solid rgba(139,92,246,0.55)`, borderRadius: 4, padding: '3px 7px', flexShrink: 0,
  }
  return {
    fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em',
    color: C.textMid, border: `1px solid rgba(255,255,255,0.20)`, borderRadius: 4, padding: '3px 7px', flexShrink: 0,
  }
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
    <div style={{
      height: 112, flexShrink: 0, display: 'flex', alignItems: 'center',
      padding: '0 30px', gap: 26, borderBottom: `1px solid ${C.border}`, background: C.bgBase,
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/mark-256.png" alt="" width={64} height={64} style={{ display: 'block', flexShrink: 0 }} />
      <div style={{ flexShrink: 0, marginTop: -10, marginLeft: -3.5, display: 'flex', alignItems: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/wordmark/shirleycre-h176.png" alt="SHIRLEYCRE" height={88} style={{ height: 88, width: 'auto', display: 'block' }} />
      </div>
      <div style={{ width: 1, height: 40, background: C.border, flexShrink: 0 }} />
      <span style={{ ...DT1, letterSpacing: '0.19em', color: C.textMid, marginTop: 4, flexShrink: 0 }}>WAR ROOM</span>
      <div style={{ flex: 1 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/links/lacdb-h104.png" alt="LACDB"
        style={{ height: 52, width: 158, display: 'block', flexShrink: 0, cursor: 'pointer' }}
        onClick={() => window.open('https://www.lacdb.com', '_blank', 'noopener,noreferrer')} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/links/crexi-h104.png" alt="CREXI"
        style={{ height: 52, width: 158, display: 'block', flexShrink: 0, cursor: 'pointer' }}
        onClick={() => window.open('https://www.crexi.com', '_blank', 'noopener,noreferrer')} />
      <span style={{ ...DT2, color: C.brandLift, flexShrink: 0 }}>{dateStr} · {timeStr}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.moneyIn }} />
        <span style={{ ...DT3, color: C.moneyIn }}>LIVE</span>
      </div>
    </div>
  )
}

// ── LeftRail — HOME=1 · DEALS=2 · PEOPLE=3 ───────────────────────────────────
type RailSlot = 'HOME' | 'DEALS' | 'PEOPLE'

const G_HOME = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const G_DEALS = (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="4" width="17" height="10" rx="1.5"/>
    <path d="M12 14v7M7 7.8h6M7 10.8h9"/>
  </svg>
)
const G_PEOPLE = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="8" r="3.2"/>
    <path d="M3 20c0-3.4 2.7-5.6 6-5.6s6 2.2 6 5.6"/>
    <path d="M16 5.4a3.2 3.2 0 0 1 0 6M17.5 14.9c2.1.6 3.5 2.4 3.5 5.1"/>
  </svg>
)

function LeftRail({ active }: { active: RailSlot }) {
  const router = useRouter()
  const slots: { id: RailSlot; label: string; href: string; glyph: React.ReactNode }[] = [
    { id: 'HOME',   label: 'HOME',   href: '/warroom',          glyph: G_HOME   },
    { id: 'DEALS',  label: 'DEALS',  href: '/warroom/deals',    glyph: G_DEALS  },
    { id: 'PEOPLE', label: 'PEOPLE', href: '/warroom/contacts', glyph: G_PEOPLE },
  ]
  return (
    <div style={{
      width: 96, flexShrink: 0, height: '100%', background: C.bgRail,
      borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
      alignItems: 'center', paddingTop: 16, gap: 4,
    }}>
      {slots.map(s => {
        const isActive = s.id === active
        return (
          <button key={s.id} onClick={() => router.push(s.href)} style={{
            width: 76, padding: '13px 0', borderRadius: 10, border: 'none',
            background: isActive ? 'rgba(139,92,246,0.14)' : 'transparent',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
            cursor: 'pointer', color: isActive ? C.brandLift : C.textLow,
          }}>
            {s.glyph}
            <span style={{ ...DT5, color: 'inherit' }}>{s.label}</span>
          </button>
        )
      })}
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
    const next = current === n ? null : n
    onChange(dealId, next)
    if (next === null) {
      await supabase.from('deals').update({ rating: null }).eq('id', dealId)
    } else {
      await supabase.from('deals').update({ rating: next }).eq('id', dealId)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      onMouseLeave={() => setHover(null)}>
      <div style={{ display: 'flex', gap: 3 }}>
        {[1,2,3,4,5].map(n => {
          const filled = n <= display
          return (
            <svg key={n} width="13" height="13" viewBox="0 0 24 24"
              onMouseEnter={() => setHover(n)}
              onClick={(e) => handleClick(n, e)}
              style={{ cursor: 'pointer', flexShrink: 0 }}
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
function LacdbCell({ url, dealId, onNavigate }: { url: string | null; dealId: string; onNavigate: (id: string) => void }) {
  if (url) return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
      style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'rgba(139,92,246,0.14)', textDecoration:'none' }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.brandLift} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 16 16 8M10 8h6v6"/>
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
      {types.length === 0 && <div style={{ ...DT8, color:C.textLow, padding:'10px 14px' }}>NO TYPES</div>}
      {types.map(t => (
        <button key={t} onClick={() => onSelect(t)} style={{
          display:'block', width:'100%', textAlign:'left', padding:'10px 14px',
          border:'none', cursor:'pointer',
          background: t === activeType ? 'rgba(139,92,246,0.18)' : 'transparent',
          color: t === activeType ? C.brandLift : C.textMid,
          ...DT5,
        }}>{t.toUpperCase()}</button>
      ))}
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
        ...DT8, letterSpacing:'0.14em',
        color: active ? C.textHi : C.textLow,
        fontWeight: active ? 700 : 500,
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
      position:'sticky', top:0, zIndex:10,
      display:'flex', alignItems:'center', height:30,
      padding:'0 14px 0 44px', gap:10,
      background:C.bgPanel, borderBottom:`1px solid ${C.borderPanel}`,
      boxSizing:'border-box',
    }}>
      <span style={{ ...DT8, letterSpacing:'0.16em', color:C.textLow, fontWeight:700 }}>{label}</span>
      <span style={{ ...DT8, color:C.textLow }}>{count}</span>
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
  const isHot = deal.status?.toLowerCase() === 'hot' || (deal.rating ?? 0) >= 4
  const isUC  = deal.status?.toLowerCase() === 'under_contract'
  const deadlineUrgent = deal._deadlineDays !== null && deal._deadlineDays <= 7
  const label = getStatusLabel(deal.status)
  const rating = ratings[deal.id] ?? null

  return (
    <div onClick={() => onNavigate(deal.id)}
      style={{ position:'relative', display:'flex', alignItems:'center', height:46, borderBottom:`1px solid ${C.borderHair}`, boxSizing:'border-box', cursor:'pointer' }}>
      {/* Left spine */}
      {isUC && <div style={{ position:'absolute', left:0, top:9, bottom:9, width:3, background:C.brand }} />}
      {isHot && !isUC && <div style={{ position:'absolute', left:0, top:9, bottom:9, width:3, background:C.hot }} />}

      {/* Address */}
      <div style={{ flex:1, minWidth:0, padding:'0 14px 0 44px', display:'flex', alignItems:'center', gap:11, boxSizing:'border-box', overflow:'hidden' }}>
        <span style={{ ...DS3, color:C.textHi, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {deal._shortAddr}
        </span>
        {label && <span style={pillStyle(deal.status)}>{label}</span>}
      </div>

      {/* Client */}
      <div style={{ width:COL.client, flexShrink:0, padding:'0 14px', boxSizing:'border-box', overflow:'hidden' }}>
        <span style={{ ...DS5, color:C.textMid, display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{deal._client}</span>
      </div>

      {/* Next deadline */}
      <div style={{ width:COL.deadline, flexShrink:0, padding:'0 14px', boxSizing:'border-box' }}>
        {deal._deadlineDays !== null && deal._deadlineDate
          ? <span style={{ ...DT7, color: deadlineUrgent ? C.hot : C.textMid, whiteSpace:'nowrap' }}>{fmtDeadline(deal._deadlineDays, deal._deadlineDate)}</span>
          : <span style={{ ...DT8, color:C.textLow }}>—</span>
        }
      </div>

      {/* LACDB */}
      <div style={{ width:COL.lacdb, flexShrink:0, display:'flex', justifyContent:'center', alignItems:'center' }}>
        <LacdbCell url={deal.lacdb_url} dealId={deal.id} onNavigate={onNavigate} />
      </div>

      {/* Add Task */}
      <div style={{ width:COL.task, flexShrink:0, display:'flex', justifyContent:'center', alignItems:'center' }}>
        <button onClick={e => { e.stopPropagation(); onTaskOpen(deal) }}
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
        <span style={{ ...DM1, color:C.textHi, fontVariantNumeric:'tabular-nums' }}>
          {deal._value != null ? fmtMoney(deal._value) : '—'}
        </span>
      </div>

      {/* Commission */}
      <div style={{ width:COL.comm, flexShrink:0, padding:'0 14px', boxSizing:'border-box', textAlign:'right' }}>
        <span style={{ ...DM1, color:C.moneyIn, fontVariantNumeric:'tabular-nums' }}>
          {deal._commission != null ? fmtMoney(deal._commission) : '—'}
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
      <div style={{ flex:1, minWidth:0, padding:'0 14px 0 44px', display:'flex', alignItems:'center', gap:11, boxSizing:'border-box', overflow:'hidden' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.brandLift} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
          <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z"/>
          <path d="M3 12.5 12 17l9-4.5"/>
          <path d="M3 17 12 21.5l9-4.5"/>
        </svg>
        <span style={{ ...DS3, color:C.textHi, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{portfolio.name}</span>
        <span style={{ ...DT7, color:C.textLow, flexShrink:0 }}>{portfolio.siteCount} SITES</span>
      </div>

      {/* Client */}
      <div style={{ width:COL.client, flexShrink:0, padding:'0 14px', boxSizing:'border-box', overflow:'hidden' }}>
        <span style={{ ...DS5, color:C.textMid, display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{portfolio.client}</span>
      </div>

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
        <span style={{ ...DM1, color:C.textHi, fontVariantNumeric:'tabular-nums' }}>
          {portfolio.value != null ? fmtMoney(portfolio.value) : '—'}
        </span>
      </div>

      {/* Commission — summed */}
      <div style={{ width:COL.comm, flexShrink:0, padding:'0 14px', boxSizing:'border-box', textAlign:'right' }}>
        <span style={{ ...DM1, color:C.moneyIn, fontVariantNumeric:'tabular-nums' }}>
          {portfolio.commission != null ? fmtMoney(portfolio.commission) : '—'}
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
  const filter   = (searchParams.get('filter')   ?? 'all')      as FilterKey
  const typeValue = searchParams.get('type_val') ?? null

  const [allDeals,     setAllDeals]     = useState<EnrichedDeal[]>([])
  const [portfolios,   setPortfolios]   = useState<PortfolioRollup[]>([])
  const [tabCounts,    setTabCounts]    = useState<TabCounts>({ listings: 0, tenants: 0, buyers: 0, targets: 0 })
  const [ratings,      setRatings]      = useState<Record<string, number | null>>({})
  const [allTypes,     setAllTypes]     = useState<string[]>([])
  const [loading,      setLoading]      = useState(true)
  const [taskDeal,     setTaskDeal]     = useState<EnrichedDeal | null>(null)
  const [typeDropOpen, setTypeDropOpen] = useState(false)

  const [sortKey, setSortKey] = useState<SortKey>('address')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Entry-state sort — money arrives sorted by COMM▼
  useEffect(() => {
    if (filter === 'money') { setSortKey('comm'); setSortDir('desc') }
    else { setSortKey('address'); setSortDir('asc') }
  }, [filter])

  // ── Nav helpers ───────────────────────────────────────────────────────────
  function setTab(t: TabKey) {
    // Switching tabs resets filter to ALL
    router.replace(`/warroom/deals?tab=${t}&filter=all`)
  }
  function setFilter(f: FilterKey, tv?: string) {
    const p = new URLSearchParams(Array.from(searchParams.entries()))
    p.set('tab', tab); p.set('filter', f)
    if (tv) p.set('type_val', tv); else p.delete('type_val')
    router.replace(`/warroom/deals?${p.toString()}`)
    setTypeDropOpen(false)
  }
  function handleSort(k: SortKey) {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }
  function navigate(id: string) { router.push(`/warroom/deal?id=${id}`) }

  // ── Data fetch ────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [dealsRes, econRes, deadlinesRes, mmRes] = await Promise.all([
        supabase.from('deals').select(`
          id, name, address, addr_display, addr_number, addr_street_name, addr_street_type,
          addr_direction, addr_city, status, type, rating, lacdb_url, dropbox_link,
          portfolio_id, is_money_mover, deal_contacts(contacts(name))
        `).order('addr_street_name'),

        supabase.from('deal_economics').select(
          'deal_id, transaction_type, asking_price, sale_commission_pct, sqft, lease_rate_psf, lease_term_years, lease_commission_pct'
        ),

        supabase.from('contract_deadlines')
          .select('deal_id, deadline_date, deadline_type')
          .in('status', ['pending', 'extended'])
          .order('deadline_date'),

        supabase.from('money_movers').select('deal_id').not('deal_id', 'is', null),
      ])

      const rawDeals = (dealsRes.data ?? []) as DealRow[]
      const today    = todayCST()

      const econMap: Record<string, DealEcon> = {}
      for (const e of (econRes.data ?? []) as DealEcon[]) econMap[e.deal_id] = e

      const deadlineMap: Record<string, DeadlineRow> = {}
      for (const dl of (deadlinesRes.data ?? []) as DeadlineRow[]) {
        if (!dl.deadline_date || dl.deadline_date < today) continue
        if (!deadlineMap[dl.deal_id] || dl.deadline_date < deadlineMap[dl.deal_id].deadline_date) {
          deadlineMap[dl.deal_id] = dl
        }
      }

      const mmSet = new Set<string>()
      for (const mm of (mmRes.data ?? []) as { deal_id: string }[]) {
        if (mm.deal_id) mmSet.add(mm.deal_id)
      }

      const ratingInit: Record<string, number | null> = {}
      const enriched: EnrichedDeal[] = rawDeals.map(deal => {
        ratingInit[deal.id] = deal.rating

        const econ       = econMap[deal.id] ?? null
        const commission = econ ? calcCommission(econ) : null
        let value: number | null = null
        if (econ) {
          if ((econ.transaction_type === 'sale' || econ.transaction_type === 'both') && econ.asking_price != null) {
            value = econ.asking_price
          } else if (econ.transaction_type === 'lease') {
            value = calcLeaseValue(econ.sqft ?? null, econ.lease_rate_psf ?? null, econ.lease_term_years ?? null)
          }
        }

        const dl           = deadlineMap[deal.id] ?? null
        const deadlineDays = dl?.deadline_date ? daysBetween(today, dl.deadline_date) : null

        return {
          ...deal,
          _shortAddr:    formatAddress(deal),
          _client:       clientFromDeal(deal),
          _deadlineDays: deadlineDays,
          _deadlineDate: dl?.deadline_date ?? null,
          _value:        value,
          _commission:   commission,
          _isMoneyMover: mmSet.has(deal.id) || !!deal.is_money_mover,
        }
      })

      setRatings(ratingInit)
      setAllDeals(enriched)

      // Distinct types
      const typeSet = new Set<string>()
      rawDeals.forEach(d => { if (d.type) typeSet.add(d.type) })
      setAllTypes(Array.from(typeSet).sort())

      // Tab counts (LISTINGS = all, tenants/buyers/targets by type)
      setTabCounts({
        listings: rawDeals.length,
        tenants:  rawDeals.filter(d => d.type?.toLowerCase() === 'tenant_rep').length,
        buyers:   rawDeals.filter(d => d.type?.toLowerCase() === 'buyer_rep').length,
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
  function matchesFilter(d: EnrichedDeal): boolean {
    switch (filter) {
      case 'all':   return true
      case 'hot':   return (d.rating ?? 0) >= 4 || d.status?.toLowerCase() === 'hot'
      case 'uc':    return d.status?.toLowerCase() === 'under_contract'
      case 'money': return d._isMoneyMover
      case 'type':  return typeValue ? d.type?.toLowerCase() === typeValue.toLowerCase() : true
      default:      return true
    }
  }

  // ── Sort ──────────────────────────────────────────────────────────────────
  function sortDeals(rows: EnrichedDeal[]): EnrichedDeal[] {
    return [...rows].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'address':  cmp = a._shortAddr.localeCompare(b._shortAddr); break
        case 'client':   cmp = a._client.localeCompare(b._client); break
        case 'deadline': cmp = (a._deadlineDays ?? 9999) - (b._deadlineDays ?? 9999); break
        case 'value':    cmp = (a._value ?? -1) - (b._value ?? -1); break
        case 'comm':     cmp = (a._commission ?? -1) - (b._commission ?? -1); break
        case 'rank':     cmp = (a.rating ?? 0) - (b.rating ?? 0); break
        default:         cmp = a._shortAddr.localeCompare(b._shortAddr)
      }
      return sortDir === 'asc' ? cmp : -cmp
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
  const filteredDeals      = allDeals.filter(d => d.portfolio_id == null && matchesFilter(d))
  const filteredPortfolios = portfolios.filter(p => {
    if (filter === 'all') return true
    const members = allDeals.filter(d => d.portfolio_id === p.portfolioId)
    return members.some(d => matchesFilter(d))
  })
  const sortedDeals      = sortDeals(filteredDeals)
  const sortedPortfolios = sortPortfolios(filteredPortfolios)

  // Counts
  const portfolioMemberCount = allDeals.filter(d => d.portfolio_id != null).length
  const regularDealCount     = allDeals.length - portfolioMemberCount

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
  const filterLabel = filter === 'type' && typeValue
    ? typeValue.toUpperCase()
    : filter === 'all' ? 'NONE' : filter.toUpperCase()

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: 'listings', label: 'LISTINGS', count: tabCounts.listings },
    { key: 'tenants',  label: 'TENANTS',  count: tabCounts.tenants  },
    { key: 'buyers',   label: 'BUYERS',   count: tabCounts.buyers   },
    { key: 'targets',  label: 'TARGETS',  count: tabCounts.targets  },
  ]

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all',   label: 'ALL'   },
    { key: 'hot',   label: 'HOT'   },
    { key: 'uc',    label: 'UC'    },
    { key: 'money', label: 'MONEY' },
  ]

  return (
    <div style={{ display:'flex', width:'100vw', height:'100vh', background:C.bgBase, color:C.textHi, fontFamily:FONT_DISP, overflow:'hidden' }}>

      {/* Left rail */}
      <LeftRail active="DEALS" />

      {/* Main column */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>

        {/* Identity band */}
        <IdentityBand />

        {/* ── Tab row — 62px, FIXED ── */}
        <div style={{
          height:62, flexShrink:0, display:'flex', alignItems:'stretch',
          padding:'0 24px', boxSizing:'border-box',
          borderBottom: tab === 'listings' ? 'none' : `1px solid ${C.border}`,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:15, flex:1 }}>
            {TABS.map((t, i) => {
              const isActive = t.key === tab
              return (
                <React.Fragment key={t.key}>
                  <button onClick={() => setTab(t.key)} style={{
                    position:'relative', display:'flex', alignItems:'center', gap:9,
                    background:'none', border:'none', cursor:'pointer', padding:0, height:'100%',
                  }}>
                    <span style={{
                      fontFamily:FONT_MONO, fontSize:17, fontWeight:500, letterSpacing:'0.16em', lineHeight:1,
                      color: isActive ? C.textHi : C.textLow,
                    }}>{t.label}</span>
                    <span style={{
                      fontFamily:FONT_MONO, fontSize:13, fontWeight:400, letterSpacing:'0.10em', lineHeight:1, color:C.textLow,
                    }}>{t.count}</span>
                    {isActive && <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:C.brandStrong }} />}
                  </button>
                  {i < TABS.length - 1 && (
                    <div style={{ width:1, height:20, background:C.border, flexShrink:0 }} />
                  )}
                </React.Fragment>
              )
            })}
            <div style={{ flex:1 }} />
            {/* FAB — 31px */}
            <div className="wr-fab-desktop-wrap" style={{ flexShrink:0 }}>
              <Fab label="Add listing" onClick={() => {}} />
            </div>
          </div>
        </div>

        {/* ── LISTINGS-specific chrome — filter row + col headers ── */}
        {tab === 'listings' && (
          <>
            {/* Filter row — 46px FIXED */}
            <div style={{
              height:46, flexShrink:0, display:'flex', alignItems:'stretch',
              padding:'0 24px', borderBottom:`1px solid ${C.borderPanel}`,
              boxSizing:'border-box',
            }}>
              {FILTERS.map(f => {
                const isActive = filter === f.key
                return (
                  <button key={f.key} onClick={() => setFilter(f.key)} style={{
                    flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                    position:'relative', background:'none', border:'none', cursor:'pointer', padding:0,
                  }}>
                    <span style={{
                      fontFamily:FONT_MONO, fontSize:16, lineHeight:1,
                      fontWeight: isActive ? 700 : 600,
                      color: isActive ? C.textHi : C.textMid,
                    }}>{f.label}</span>
                    {isActive && <div style={{ position:'absolute', left:0, right:0, bottom:0, height:2, background:C.brandStrong }} />}
                  </button>
                )
              })}

              {/* TYPE ▾ */}
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                <button onClick={() => setTypeDropOpen(o => !o)} style={{
                  display:'flex', alignItems:'center', gap:7, background:'none', border:'none',
                  cursor:'pointer', padding:0, height:'100%', width:'100%', justifyContent:'center', position:'relative',
                }}>
                  <span style={{
                    fontFamily:FONT_MONO, fontSize:16, lineHeight:1,
                    fontWeight: filter === 'type' ? 700 : 600,
                    color: filter === 'type' ? C.textHi : C.textMid,
                  }}>TYPE</span>
                  <span style={{ fontFamily:FONT_MONO, fontSize:12, color:C.textLow }}>▾</span>
                  {filter === 'type' && <div style={{ position:'absolute', left:0, right:0, bottom:0, height:2, background:C.brandStrong }} />}
                </button>
                <TypeDropdown open={typeDropOpen} types={allTypes} activeType={typeValue}
                  onSelect={v => setFilter('type', v)} onClose={() => setTypeDropOpen(false)} />
              </div>
            </div>

            {/* Column headers — 36px FIXED */}
            <div style={{
              height:36, flexShrink:0, display:'flex', alignItems:'center',
              background:C.bgPanel, borderBottom:`1px solid ${C.border}`, boxSizing:'border-box',
            }}>
              <CH label="ADDRESS" sk="address" activeSk={sortKey} sortDir={sortDir} onClick={() => handleSort('address')}
                style={{ flex:1, minWidth:0, padding:'0 14px 0 44px', boxSizing:'border-box' }} />
              <CH label="CLIENT" sk="client" activeSk={sortKey} sortDir={sortDir} onClick={() => handleSort('client')}
                style={{ width:COL.client, flexShrink:0, padding:'0 14px', boxSizing:'border-box' }} />
              <CH label="DEADLINE" sk="deadline" activeSk={sortKey} sortDir={sortDir} onClick={() => handleSort('deadline')}
                style={{ width:COL.deadline, flexShrink:0, padding:'0 14px', boxSizing:'border-box' }} />
              {/* LACDB — non-sortable header (actionable column) */}
              <div style={{ width:COL.lacdb, flexShrink:0, display:'flex', justifyContent:'center', alignItems:'center' }}>
                <span style={{ ...DT8, letterSpacing:'0.10em', color:C.textLow }}>LACDB</span>
              </div>
              {/* TASK — non-sortable */}
              <div style={{ width:COL.task, flexShrink:0, display:'flex', justifyContent:'center', alignItems:'center' }}>
                <span style={{ ...DT8, letterSpacing:'0.10em', color:C.textLow }}>TASK</span>
              </div>
              <CH label="RANK" sk="rank" activeSk={sortKey} sortDir={sortDir} onClick={() => handleSort('rank')}
                style={{ width:COL.rank, flexShrink:0, padding:'0 14px', boxSizing:'border-box', display:'flex', justifyContent:'center' }} />
              <CH label="VALUE" sk="value" activeSk={sortKey} sortDir={sortDir} onClick={() => handleSort('value')}
                style={{ width:COL.value, flexShrink:0, padding:'0 14px', boxSizing:'border-box', display:'flex', justifyContent:'flex-end' }} />
              <CH label="COMM" sk="comm" activeSk={sortKey} sortDir={sortDir} onClick={() => handleSort('comm')}
                style={{ width:COL.comm, flexShrink:0, padding:'0 14px', boxSizing:'border-box', display:'flex', justifyContent:'flex-end' }} />
              {/* DBX — non-sortable */}
              <div style={{ width:COL.dbx, flexShrink:0, display:'flex', justifyContent:'center', alignItems:'center' }}>
                <span style={{ ...DT8, letterSpacing:'0.10em', color:C.textLow }}>DBX</span>
              </div>
            </div>
          </>
        )}

        {/* ── Scrollable body ── */}
        <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', position:'relative', minHeight:0 }}>
          {tab === 'listings' ? (
            loading ? (
              <div style={{ padding:40, textAlign:'center' }}>
                <span style={{ ...DT3, color:C.textLow, fontFamily:FONT_MONO }}>LOADING…</span>
              </div>
            ) : (
              <>
                {/* ── Item 139 — NEW DEAL PAGE sample link ── */}
                <div style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'0 24px', height:44, borderBottom:`1px solid ${C.borderHair}`,
                  background:'rgba(139,92,246,0.06)', flexShrink:0,
                }}>
                  <span style={{ fontFamily:FONT_MONO, fontSize:11, fontWeight:500, letterSpacing:'0.18em', color:C.textLow }}>
                    NEW DEAL PAGE
                  </span>
                  <a
                    href="/warroom/deal2?id=d30740cf-40bf-4dbd-bd88-93ccb170f073"
                    style={{
                      fontFamily:FONT_MONO, fontSize:11, fontWeight:700, letterSpacing:'0.14em',
                      color:C.brandLift, textDecoration:'none',
                      padding:'5px 12px', border:`1px solid rgba(139,92,246,0.40)`,
                      borderRadius:5, background:'rgba(139,92,246,0.10)',
                    }}
                  >
                    OPEN SAMPLE →
                  </a>
                </div>

                {/* PORTFOLIOS group — always present */}
                <GroupHeader label="PORTFOLIOS" count={sortedPortfolios.length} />
                {sortedPortfolios.length === 0
                  ? null
                  : sortedPortfolios.map(p => (
                    <PortfolioRow key={p.portfolioId} portfolio={p} onNavigate={navigate} />
                  ))
                }

                {/* DEALS group — always present */}
                <GroupHeader label="DEALS" count={regularDealCount} />
                {sortedDeals.length === 0
                  ? <EmptyState filterName={allDeals.length === 0 ? 'NONE' : filterLabel} />
                  : sortedDeals.map(d => (
                    <DealRow key={d.id} deal={d} ratings={ratings}
                      onRatingChange={handleRatingChange}
                      onTaskOpen={setTaskDeal}
                      onNavigate={navigate} />
                  ))
                }
              </>
            )
          ) : (
            /* Placeholder for TENANTS / BUYERS / TARGETS */
            <div style={{ padding:'40px 44px' }}>
              <span style={{ ...DT3, color:C.textLow, fontFamily:FONT_MONO }}>
                {tab === 'tenants'  && 'TENANT ENGAGEMENTS WILL LIVE HERE'}
                {tab === 'buyers'   && 'BUYER ENGAGEMENTS WILL LIVE HERE'}
                {tab === 'targets'  && 'PROPERTY TARGETS WILL LIVE HERE'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Task modal */}
      {taskDeal && (
        <TaskModal
          task={stubTask} isCreate
          onClose={() => setTaskDeal(null)}
          onCompleted={() => setTaskDeal(null)}
          onSaved={() => { setTaskDeal(null); fetchData() }}
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

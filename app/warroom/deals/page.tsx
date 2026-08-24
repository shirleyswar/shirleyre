'use client'

/**
 * /warroom/deals — Deals Index
 * D5.2 spec rebuild — build(48l)
 * Dense sortable table, group headers, filter row, interactive star rating.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calcCommission, fmtMoney } from '@/lib/dealMath'
import { formatAddress } from '@/lib/formatAddress'
import PinGate from '@/components/warroom/PinGate'
import TaskModal from '@/app/warroom/TaskModal'
import type { Task } from '@/app/warroom/TaskModal'
import {
  DT1, DT2, DT3, DT4, DT5, DT6, DT7, DT8,
  DS3, DS4, DS5, DS6, DS7, DS8,
  DM1, DM2,
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

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  bgBase:      '#050509',
  bgPanel:     '#12111B',
  bgRail:      '#0C0B14',
  bgRaise:     '#1E1D26',
  textHi:      '#EFEEF4',
  textMid:     '#B8B6C6',
  textLow:     '#8E8CA0',
  brand:       '#8B5CF6',
  brandLift:   '#A78BFA',
  brandStrong: '#7C3AED',
  moneyIn:     '#34D399',
  late:        '#FF4D4D',
  hot:         '#FFA23A',
  border:      'rgba(255,255,255,0.14)',
  borderPanel: 'rgba(255,255,255,0.11)',
  borderHair:  'rgba(255,255,255,0.10)',
} as const

const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISP = "'Space Grotesk', system-ui, sans-serif"

// ── Types ─────────────────────────────────────────────────────────────────────
type FilterKey = 'all' | 'hot' | 'uc' | 'listings' | 'tenants' | 'buyers' | 'targets'
type SortKey = 'address' | 'client' | 'deadline' | 'value' | 'commission' | 'rating'
type SortDir = 'asc' | 'desc'

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
  listing_rate?: number | null
  co_broker_on?: boolean | null
  co_broker_split?: number | null
}

interface DealDeadline {
  deal_id: string
  due_date: string | null
  label: string | null
}

interface EnrichedDeal extends DealRow {
  _shortAddr: string
  _client: string
  _deadlineDays: number | null
  _deadlineDate: string | null
  _value: number | null
  _commission: number | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function daysBetween(today: string, dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  const a = new Date(ty, tm - 1, td)
  const b = new Date(y, m - 1, d)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function fmtDeadline(days: number, dateStr: string): string {
  const dt = new Date(dateStr + 'T00:00:00')
  const mon = dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const day = dt.getDate()
  return `${days} DAYS · ${mon} ${day}`
}

function getStatusColor(status: string | null): string {
  if (!status) return C.textLow
  switch (status.toLowerCase()) {
    case 'active': case 'active_listing': return C.moneyIn
    case 'hot': return C.hot
    case 'under_contract': return C.brandLift
    case 'pipeline': return C.brand
    default: return C.textLow
  }
}

function shortStatus(status: string | null): string {
  if (!status) return ''
  switch (status.toLowerCase()) {
    case 'active': return 'ACTIVE'
    case 'active_listing': return 'ACTIVE'
    case 'hot': return 'HOT'
    case 'under_contract': return 'UC'
    case 'pipeline': return 'PIPE'
    case 'in_review': return 'REVIEW'
    case 'in_service': return 'SERVICE'
    case 'closed': return 'CLOSED'
    default: return status.toUpperCase().slice(0, 8)
  }
}

// ── Clock ──────────────────────────────────────────────────────────────────────
function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Chicago' }).toUpperCase()
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' })
  return { dateStr, timeStr }
}

// ── IdentityBand ──────────────────────────────────────────────────────────────
function IdentityBand() {
  const { dateStr, timeStr } = useClock()

  return (
    <div style={{
      height: 112,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      padding: '0 30px',
      gap: 26,
      borderBottom: `1px solid ${C.border}`,
      background: C.bgBase,
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/mark-256.png" alt="" width={64} height={64} style={{ display: 'block', flexShrink: 0 }} />
      <div style={{ width: 'auto', flexShrink: 0, marginTop: -10, marginLeft: -3.5, display: 'flex', alignItems: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/wordmark/shirleycre-h176.png" alt="SHIRLEYCRE" height={88} style={{ height: 88, width: 'auto', display: 'block' }} />
      </div>
      <div style={{ width: 1, height: 40, background: C.border, flexShrink: 0 }} />
      <span style={{ ...DT1, letterSpacing: '0.19em', color: C.textMid, marginTop: 4, flexShrink: 0 }}>WAR ROOM</span>
      <div style={{ flex: 1 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/links/lacdb-h104.png"
        alt="LACDB"
        style={{ height: 52, width: 158, display: 'block', flexShrink: 0, cursor: 'pointer', transition: 'filter 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.18)')}
        onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
        onClick={() => window.open('https://www.lacdb.com', '_blank', 'noopener,noreferrer')}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/links/crexi-h104.png"
        alt="CREXI"
        style={{ height: 52, width: 158, display: 'block', flexShrink: 0, cursor: 'pointer', transition: 'filter 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.18)')}
        onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
        onClick={() => window.open('https://www.crexi.com', '_blank', 'noopener,noreferrer')}
      />
      <span style={{ ...DT2, color: C.brandLift, flexShrink: 0 }}>{dateStr} · {timeStr}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.moneyIn }} />
        <span style={{ ...DT3, color: C.moneyIn }}>LIVE</span>
      </div>
    </div>
  )
}

// ── LeftRail ──────────────────────────────────────────────────────────────────
type RailSlot = 'HOME' | 'PEOPLE' | 'DEALS'

function LeftRail({ active }: { active: RailSlot }) {
  const router = useRouter()

  const slots: { id: RailSlot; label: string; glyph: React.ReactNode; href: string }[] = [
    {
      id: 'HOME', label: 'HOME',
      glyph: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
      href: '/warroom',
    },
    {
      id: 'PEOPLE', label: 'PEOPLE',
      glyph: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      href: '/warroom/contacts',
    },
    {
      id: 'DEALS', label: 'DEALS',
      glyph: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
      href: '/warroom/deals',
    },
  ]

  return (
    <div style={{
      width: 96,
      flexShrink: 0,
      height: '100%',
      background: C.bgRail,
      borderRight: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 16,
      gap: 4,
    }}>
      {slots.map(s => {
        const isActive = s.id === active
        return (
          <button
            key={s.id}
            onClick={() => router.push(s.href)}
            style={{
              width: 76,
              padding: '13px 0',
              borderRadius: 10,
              border: 'none',
              background: isActive ? 'rgba(139,92,246,0.14)' : 'transparent',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 7,
              cursor: 'pointer',
              color: isActive ? C.brandLift : C.textLow,
            }}
          >
            {s.glyph}
            <span style={{ ...DT5, color: 'inherit' }}>{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── StarRating ─────────────────────────────────────────────────────────────────
function StarRating({ dealId, rating, onChange }: { dealId: string; rating: number | null; onChange: (id: string, r: number | null) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const current = rating ?? 0

  async function handleClick(n: number) {
    const newRating = current === n ? null : n
    onChange(dealId, newRating)
    await supabase.from('deals').update({ rating: newRating }).eq('id', dealId)
  }

  return (
    <div style={{ display: 'flex', gap: 2, width: 78 }}>
      {[1, 2, 3, 4, 5].map(n => {
        const filled = hover !== null ? n <= hover : n <= current
        return (
          <span
            key={n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            onClick={() => handleClick(n)}
            style={{
              cursor: 'pointer',
              fontSize: 14,
              color: filled ? '#FFA23A' : C.textLow,
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            {filled ? '★' : '☆'}
          </span>
        )
      })}
    </div>
  )
}

// ── TypeDropdown ───────────────────────────────────────────────────────────────
const TYPE_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'listings', label: 'LISTINGS' },
  { key: 'tenants',  label: 'TENANTS' },
  { key: 'buyers',   label: 'BUYERS' },
  { key: 'targets',  label: 'TARGETS' },
]

function typeMatchesDeal(typeFilter: FilterKey, dealType: string | null): boolean {
  if (!dealType) return false
  const t = dealType.toLowerCase()
  switch (typeFilter) {
    case 'listings': return t === 'active_listing' || t === 'listing'
    case 'tenants':  return t === 'tenant_rep'
    case 'buyers':   return t === 'buyer_rep'
    case 'targets':  return t === 'potential_listing'
    default: return false
  }
}

// ── Deals Table Page ───────────────────────────────────────────────────────────
function DealsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [deals, setDeals] = useState<EnrichedDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('address')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [ratings, setRatings] = useState<Record<string, number | null>>({})
  const [taskModal, setTaskModal] = useState<{ deal: EnrichedDeal } | null>(null)
  const [typeDropOpen, setTypeDropOpen] = useState(false)
  const typeDropRef = useRef<HTMLDivElement>(null)

  // Filter from URL state
  const filter = (searchParams.get('filter') ?? 'all') as FilterKey

  function setFilter(f: FilterKey) {
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.set('filter', f)
    router.replace(`/warroom/deals?${params.toString()}`)
    setTypeDropOpen(false)
  }

  // Close type dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (typeDropRef.current && !typeDropRef.current.contains(e.target as Node)) {
        setTypeDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [dealsRes, econRes, deadlinesRes] = await Promise.all([
        supabase.from('deals').select(`
          id, name, address, addr_display, addr_number, addr_street_name, addr_street_type,
          addr_direction, addr_city, status, type, rating, lacdb_url, dropbox_link, portfolio_id,
          deal_contacts(contacts(name))
        `).order('addr_street_name'),
        supabase.from('deal_economics').select(
          'deal_id, transaction_type, asking_price, sale_commission_pct, sqft, lease_rate_psf, lease_term_years, lease_commission_pct, listing_rate, co_broker_on, co_broker_split'
        ),
        supabase.from('contract_deadlines').select('deal_id, due_date, label').order('due_date'),
      ])

      const rawDeals = (dealsRes.data ?? []) as DealRow[]
      const econMap: Record<string, DealEcon> = {}
      for (const e of (econRes.data ?? []) as DealEcon[]) {
        econMap[e.deal_id] = e
      }

      // Nearest future deadline per deal
      const today = todayLocal()
      const deadlineMap: Record<string, DealDeadline> = {}
      for (const dl of (deadlinesRes.data ?? []) as DealDeadline[]) {
        if (!dl.due_date || dl.due_date < today) continue
        if (!deadlineMap[dl.deal_id] || dl.due_date < deadlineMap[dl.deal_id].due_date!) {
          deadlineMap[dl.deal_id] = dl
        }
      }

      const ratingInit: Record<string, number | null> = {}
      const enriched: EnrichedDeal[] = rawDeals.map(deal => {
        ratingInit[deal.id] = deal.rating

        const econ = econMap[deal.id] ?? null
        const commission = econ ? calcCommission(econ) : null
        let value: number | null = null
        if (econ?.transaction_type === 'sale' && econ.asking_price != null) {
          value = econ.asking_price
        } else if (econ?.transaction_type === 'lease' && econ.sqft != null && econ.lease_rate_psf != null && econ.lease_term_years != null) {
          value = econ.sqft * econ.lease_rate_psf * econ.lease_term_years
        }

        const dl = deadlineMap[deal.id] ?? null
        let deadlineDays: number | null = null
        if (dl?.due_date) deadlineDays = daysBetween(today, dl.due_date)

        const client = deal.deal_contacts?.[0]?.contacts?.name ?? deal.name ?? '—'
        const shortAddr = formatAddress(deal)

        return {
          ...deal,
          _shortAddr: shortAddr,
          _client: client,
          _deadlineDays: deadlineDays,
          _deadlineDate: dl?.due_date ?? null,
          _value: value,
          _commission: commission,
        }
      })

      setRatings(ratingInit)
      setDeals(enriched)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function handleRatingChange(id: string, r: number | null) {
    setRatings(prev => ({ ...prev, [id]: r }))
    setDeals(prev => prev.map(d => d.id === id ? { ...d, rating: r } : d))
  }

  // ── Sort ───────────────────────────────────────────────────────────────────
  function handleSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  function sortIndicator(k: SortKey) {
    if (k !== sortKey) return null
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  // ── Filter ─────────────────────────────────────────────────────────────────
  function applyFilter(rows: EnrichedDeal[]): EnrichedDeal[] {
    switch (filter) {
      case 'all': return rows
      case 'hot': return rows.filter(d => (d.rating ?? 0) >= 4 || d.status === 'hot')
      case 'uc':  return rows.filter(d => d.status === 'under_contract')
      case 'listings':
      case 'tenants':
      case 'buyers':
      case 'targets':
        return rows.filter(d => typeMatchesDeal(filter, d.type))
      default: return rows
    }
  }

  function applySort(rows: EnrichedDeal[]): EnrichedDeal[] {
    return [...rows].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'address':    cmp = (a._shortAddr).localeCompare(b._shortAddr); break
        case 'client':     cmp = (a._client).localeCompare(b._client); break
        case 'deadline':   cmp = ((a._deadlineDays ?? 9999) - (b._deadlineDays ?? 9999)); break
        case 'value':      cmp = ((a._value ?? -1) - (b._value ?? -1)); break
        case 'commission': cmp = ((a._commission ?? -1) - (b._commission ?? -1)); break
        case 'rating':     cmp = ((a.rating ?? 0) - (b.rating ?? 0)); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  const filtered = applyFilter(deals)
  const sorted = applySort(filtered)
  const portfolioDeals = sorted.filter(d => d.portfolio_id != null)
  const regularDeals   = sorted.filter(d => d.portfolio_id == null)

  // ── Column headers ─────────────────────────────────────────────────────────
  const colHeaderStyle = (k: SortKey): React.CSSProperties => ({
    ...DT6,
    color: k === sortKey ? C.textHi : C.textLow,
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    padding: '0 10px',
    fontWeight: k === sortKey ? 700 : 500,
  })

  // ── Column widths ──────────────────────────────────────────────────────────
  const COL = {
    client:     140,
    deadline:   140,
    lacdb:       56,
    task:        44,
    stars:       90,
    value:      110,
    commission: 120,
    dropbox:     56,
  } as const

  // ── Row render ─────────────────────────────────────────────────────────────
  function renderRow(deal: EnrichedDeal, idx: number) {
    const deadlineColor = (deal._deadlineDays !== null && deal._deadlineDays <= 7) ? C.hot : C.textMid
    const statusLabel = shortStatus(deal.status)
    const statusColor = getStatusColor(deal.status)
    const rating = ratings[deal.id] ?? null

    return (
      <div
        key={deal.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: 36,
          borderBottom: `1px solid ${C.borderHair}`,
          background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
        }}
      >
        {/* Address */}
        <div style={{ flex: 1, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
          <span
            style={{ ...DS5, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
            onClick={() => router.push(`/warroom/deal?id=${deal.id}`)}
            title={deal._shortAddr}
          >
            {deal._shortAddr}
          </span>
          {statusLabel && (
            <span style={{
              ...DT7,
              color: statusColor,
              border: `1px solid ${statusColor}`,
              borderRadius: 3,
              padding: '1px 4px',
              flexShrink: 0,
              opacity: 0.85,
            }}>
              {statusLabel}
            </span>
          )}
        </div>

        {/* Client */}
        <div style={{ width: COL.client, padding: '0 10px', overflow: 'hidden' }}>
          <span style={{ ...DS6, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
            {deal._client}
          </span>
        </div>

        {/* Next deadline */}
        <div style={{ width: COL.deadline, padding: '0 10px' }}>
          {deal._deadlineDays !== null && deal._deadlineDate ? (
            <span style={{ ...DT7, color: deadlineColor, whiteSpace: 'nowrap' }}>
              {fmtDeadline(deal._deadlineDays, deal._deadlineDate)}
            </span>
          ) : (
            <span style={{ ...DT8, color: C.textLow }}>—</span>
          )}
        </div>

        {/* LACDB */}
        <div style={{ width: COL.lacdb, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {deal.lacdb_url ? (
            <button
              title="Open in LACDB"
              onClick={() => window.open(deal.lacdb_url!, '_blank', 'noopener,noreferrer')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.brand, padding: 4 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </button>
          ) : (
            <button
              title="Add LACDB link"
              onClick={() => router.push(`/warroom/deal?id=${deal.id}`)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLow, padding: 4 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          )}
        </div>

        {/* Add Task */}
        <div style={{ width: COL.task, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <button
            title="Add task"
            onClick={() => setTaskModal({ deal })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLow, padding: 4 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              <line x1="14" y1="12" x2="14" y2="18"/><line x1="11" y1="15" x2="17" y2="15"/>
            </svg>
          </button>
        </div>

        {/* Stars */}
        <div style={{ width: COL.stars, display: 'flex', alignItems: 'center', padding: '0 6px' }}>
          <StarRating dealId={deal.id} rating={rating} onChange={handleRatingChange} />
        </div>

        {/* Value */}
        <div style={{ width: COL.value, padding: '0 10px', textAlign: 'right' }}>
          <span style={{ ...DM2, color: C.textMid, whiteSpace: 'nowrap' }}>
            {deal._value != null ? fmtMoney(deal._value) : '—'}
          </span>
        </div>

        {/* Commission */}
        <div style={{ width: COL.commission, padding: '0 10px', textAlign: 'right' }}>
          <span style={{ ...DM2, color: C.moneyIn, whiteSpace: 'nowrap' }}>
            {deal._commission != null ? fmtMoney(deal._commission) : '—'}
          </span>
        </div>

        {/* Dropbox */}
        <div style={{ width: COL.dropbox, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {deal.dropbox_link ? (
            <button
              title="Open in Dropbox"
              onClick={() => window.open(deal.dropbox_link!, '_blank', 'noopener,noreferrer')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.brand, padding: 4 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          ) : (
            <button
              title="Add Dropbox link"
              onClick={() => router.push(`/warroom/deal?id=${deal.id}`)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLow, padding: 4 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Column header row ──────────────────────────────────────────────────────
  function ColHeaders() {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: 32,
        borderBottom: `1px solid ${C.border}`,
        background: C.bgBase,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ flex: 1, padding: '0 10px' }} onClick={() => handleSort('address')}>
          <span style={colHeaderStyle('address')}>ADDRESS{sortIndicator('address')}</span>
        </div>
        <div style={{ width: COL.client, padding: '0 10px' }} onClick={() => handleSort('client')}>
          <span style={colHeaderStyle('client')}>CLIENT{sortIndicator('client')}</span>
        </div>
        <div style={{ width: COL.deadline, padding: '0 10px' }} onClick={() => handleSort('deadline')}>
          <span style={colHeaderStyle('deadline')}>NEXT DL{sortIndicator('deadline')}</span>
        </div>
        <div style={{ width: COL.lacdb, textAlign: 'center' }}>
          <span style={{ ...DT6, color: C.textLow }}>LACDB</span>
        </div>
        <div style={{ width: COL.task, textAlign: 'center' }}>
          <span style={{ ...DT6, color: C.textLow }}>+TSK</span>
        </div>
        <div style={{ width: COL.stars, padding: '0 6px' }}>
          <span style={{ ...DT6, color: C.textLow }} onClick={() => handleSort('rating')}>
            ★{sortIndicator('rating')}
          </span>
        </div>
        <div style={{ width: COL.value, padding: '0 10px', textAlign: 'right' }} onClick={() => handleSort('value')}>
          <span style={colHeaderStyle('value')}>VALUE{sortIndicator('value')}</span>
        </div>
        <div style={{ width: COL.commission, padding: '0 10px', textAlign: 'right' }} onClick={() => handleSort('commission')}>
          <span style={colHeaderStyle('commission')}>COMMISSION{sortIndicator('commission')}</span>
        </div>
        <div style={{ width: COL.dropbox, textAlign: 'center' }}>
          <span style={{ ...DT6, color: C.textLow }}>DBX</span>
        </div>
      </div>
    )
  }

  // ── Group header ───────────────────────────────────────────────────────────
  function GroupHeader({ label, count }: { label: string; count: number }) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderBottom: `1px solid ${C.borderPanel}`,
        background: C.bgPanel,
      }}>
        <span style={{ ...DT5, color: C.brand }}>{label}</span>
        <span style={{ ...DT6, color: C.textLow }}>{count}</span>
      </div>
    )
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  function EmptyState({ forFilter }: { forFilter: FilterKey }) {
    const msg = deals.length === 0
      ? 'NO DEALS YET'
      : `NO DEALS MATCH ${forFilter.toUpperCase()}`
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: C.textLow,
      }}>
        <span style={DT3}>{msg}</span>
      </div>
    )
  }

  // ── Filter row labels ──────────────────────────────────────────────────────
  const isTypeFilter = ['listings', 'tenants', 'buyers', 'targets'].includes(filter)

  function filterTab(key: FilterKey, label: string, isType = false) {
    const isActive = isType ? isTypeFilter : filter === key
    return (
      <button
        key={key}
        onClick={() => !isType && setFilter(key)}
        style={{
          background: 'none',
          border: 'none',
          borderBottom: isActive ? `2px solid ${C.brandStrong}` : '2px solid transparent',
          padding: '0 0 8px 0',
          cursor: 'pointer',
          color: isActive ? C.textHi : C.textMid,
          fontWeight: isActive ? 700 : 600,
          ...DT4,
        }}
      >
        {label}
      </button>
    )
  }

  // ── Task modal stub deal ───────────────────────────────────────────────────
  const stubTask: Task = {
    id: '',
    title: '',
    status: 'open',
    due_date: null,
    is_life: false,
    is_entity: false,
    deal_id: taskModal?.deal.id ?? null,
    deals: taskModal ? {
      name: taskModal.deal.name ?? taskModal.deal._shortAddr,
      addr_display: taskModal.deal.addr_display,
      addr_street_name: taskModal.deal.addr_street_name,
      addr_number: taskModal.deal.addr_number,
      addr_city: taskModal.deal.addr_city,
    } : null,
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: C.bgBase, overflow: 'hidden' }}>
      <LeftRail active="DEALS" />

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <IdentityBand />

        {/* Page header + filter row */}
        <div style={{
          flexShrink: 0,
          padding: '16px 24px 0 24px',
          borderBottom: `1px solid ${C.border}`,
          background: C.bgBase,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, marginBottom: 12 }}>
            <span style={{ ...DT1, color: C.textHi }}>DEALS</span>
            <span style={{ ...DT5, color: C.textLow }}>{filtered.length} OF {deals.length}</span>
          </div>

          {/* Filter row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingBottom: 0 }}>
            {filterTab('all', 'ALL')}
            {filterTab('hot', 'HOT')}
            {filterTab('uc', 'UC')}

            {/* TYPE ▾ dropdown trigger */}
            <div ref={typeDropRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setTypeDropOpen(o => !o)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: isTypeFilter ? `2px solid ${C.brandStrong}` : '2px solid transparent',
                  padding: '0 0 8px 0',
                  cursor: 'pointer',
                  color: isTypeFilter ? C.textHi : C.textMid,
                  fontWeight: isTypeFilter ? 700 : 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  ...DT4,
                }}
              >
                TYPE ▾
              </button>
              {typeDropOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  background: C.bgPanel,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  overflow: 'hidden',
                  zIndex: 100,
                  minWidth: 140,
                }}>
                  {TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setFilter(opt.key)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '9px 14px',
                        textAlign: 'left',
                        background: filter === opt.key ? 'rgba(139,92,246,0.18)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: filter === opt.key ? C.brandLift : C.textMid,
                        ...DT5,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable table area */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <ColHeaders />

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <span style={{ ...DT4, color: C.textLow }}>LOADING…</span>
            </div>
          ) : sorted.length === 0 ? (
            <>
              {/* Portfolio group header stays visible */}
              <GroupHeader label="PORTFOLIOS" count={0} />
              <GroupHeader label="DEALS" count={0} />
              <EmptyState forFilter={filter} />
            </>
          ) : (
            <>
              {/* PORTFOLIOS group */}
              <GroupHeader label="PORTFOLIOS" count={portfolioDeals.length} />
              {portfolioDeals.length === 0 ? (
                <div style={{ padding: '8px 10px' }}>
                  <span style={{ ...DT8, color: C.textLow }}>NO PORTFOLIOS</span>
                </div>
              ) : (
                portfolioDeals.map((d, i) => renderRow(d, i))
              )}

              {/* DEALS group */}
              <GroupHeader label="DEALS" count={regularDeals.length} />
              {regularDeals.length === 0 ? (
                <div style={{ padding: '8px 10px' }}>
                  <span style={{ ...DT8, color: C.textLow }}>—</span>
                </div>
              ) : (
                regularDeals.map((d, i) => renderRow(d, portfolioDeals.length + i))
              )}
            </>
          )}
        </div>
      </div>

      {/* Task Modal */}
      {taskModal && (
        <TaskModal
          task={stubTask}
          isCreate
          onClose={() => setTaskModal(null)}
          onCompleted={() => setTaskModal(null)}
          onSaved={() => { setTaskModal(null); fetchData() }}
        />
      )}
    </div>
  )
}

// ── Root export with PIN gate ─────────────────────────────────────────────────
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
    return (
      <PinGate
        pinHash={PIN_HASH}
        sha256={sha256}
        onSuccess={handlePinSuccess}
      />
    )
  }

  return <DealsPage />
}

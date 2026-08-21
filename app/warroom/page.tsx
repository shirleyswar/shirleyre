'use client'

/**
 * /warroom — ShirleyCRE Desktop Control Station
 * D9 items 1–6 · 8.20.26 2145
 * Builds against SHIRLEYCRE_DESKTOP_SPEC 8.20.26 2145.md
 *
 * Layout: 100vh, no scroll, rail + identity band + NEXT48 + 3 columns.
 * Type: DS1–DS8 (Space Grotesk), DT1–DT8 (Mono labels), DM0–DM2 (Mono figures).
 * All type lives in desktopTypes.ts — no raw fontSize in this file.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { calcCommission, fmtMoney } from '@/lib/dealMath'
import { useRouter } from 'next/navigation'
import PinGate from '@/components/warroom/PinGate'
import TaskModal from '@/app/warroom/TaskModal'
import { supabase } from '@/lib/supabase'
import {
  DS1, DS2, DS3, DS4, DS5, DS6, DS7, DS8,
  DT1, DT2, DT3, DT4, DT5, DT7, DT8,
  DM0, DM1, DM2,
} from '@/components/warroom/desktopTypes'

// ── Auth ─────────────────────────────────────────────────────────────────────
const PIN_HASH    = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'
const SESSION_KEY = 'wr_session_exp_v2'
const SESSION_HOURS = 8

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Tokens — §2 (8.15.26 1101) ───────────────────────────────────────────────
const C = {
  bgBase:     '#050509',
  bgPanel:    '#12111B',
  bgRail:     '#0C0B14',
  bgRaise:    '#1E1D26',
  textHi:     '#EFEEF4',
  textMid:    '#B8B6C6',
  textLow:    '#8E8CA0',
  brand:      '#8B5CF6',
  brandLift:  '#A78BFA',
  brandStrong:'#7C3AED',
  moneyIn:    '#34D399',
  late:       '#FF4D4D',
  hot:        '#FFA23A',
  border:     'rgba(255,255,255,0.14)',
  borderPanel:'rgba(255,255,255,0.11)',
  borderHair: 'rgba(255,255,255,0.10)',
} as const

const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISP = "'Space Grotesk', system-ui, sans-serif"

// ── Types ─────────────────────────────────────────────────────────────────────
interface DealEconomics {
  deal_id: string
  transaction_type: string | null
  asking_price?: number | null
  sale_commission_pct?: number | null
  sqft?: number | null
  lease_rate_psf?: number | null
  lease_term_years?: number | null
  lease_commission_pct?: number | null
}

interface Task {
  id: string
  title: string
  status: string
  due_date: string | null
  completed_at: string | null
  deal_id: string | null
  deals?: { name: string; address: string | null } | null
}

interface Deal {
  id: string
  name: string
  address: string | null
  addr_display: string | null
  addr_street_name: string | null
  addr_number: string | null
  addr_city: string | null
  status: string
  commission_estimated: number | null
  value: number | null
  is_money_mover?: boolean | null
  deal_contacts: Array<{ contacts: { name: string } | null }>
}

interface ScheduleEvent {
  id: string
  title: string
  event_date?: string   // legacy alias
  date?: string         // schedule_events column name
  start_time?: string | null  // legacy alias
  time?: string | null        // schedule_events column name
  end_time?: string | null
  location: string | null
}

interface ArItem {
  id: string
  commission_amount: number | null
  paid_to_date: number | null
  status: 'receivable' | 'collected'
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt$(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function clientName(d: Deal): string {
  return d.deal_contacts?.[0]?.contacts?.name ?? '—'
}
function shortAddr(d: Deal): string {
  if (d.addr_display) return d.addr_display
  if (d.addr_street_name) {
    const parts: string[] = [d.addr_street_name]
    if (d.addr_city && d.addr_city !== 'Baton Rouge') parts.push('·', d.addr_city)
    if (d.addr_number) parts.push(d.addr_number)
    return parts.join(' ')
  }
  return d.name
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-').map(Number)
  const dt = new Date(y, m - 1, day)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysBetween(d: string): number {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const [y, mo, day] = d.split('-').map(Number)
  const today = new Date(ty, tm - 1, td)
  const target = new Date(y, mo - 1, day)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function cstNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }))
}

// ── D4.4 Elastic allocation ───────────────────────────────────────────────────
interface PanelSpec {
  header: number
  rowHeight: number
  rowCount: number
}

interface PanelAlloc {
  height: number
  visibleRows: number
}

function computeAlloc(budget: number, panels: PanelSpec[]): PanelAlloc[] {
  const GAP = 18
  const totalBudget = budget - (panels.length - 1) * GAP
  const demands = panels.map(p => p.header + p.rowCount * p.rowHeight)
  const floors = panels.map(p => p.header + 2 * p.rowHeight)
  const totalDemand = demands.reduce((a, b) => a + b, 0)

  let allocs: number[]
  if (totalDemand <= totalBudget) {
    allocs = [...demands]
    allocs[allocs.length - 1] += totalBudget - totalDemand
  } else {
    allocs = demands.map(d => Math.round((d / totalDemand) * totalBudget))
    // Raise any below floor, take from largest
    for (let i = 0; i < panels.length; i++) {
      if (allocs[i] < floors[i]) {
        const diff = floors[i] - allocs[i]
        allocs[i] = floors[i]
        // find largest alloc that isn't i
        let maxIdx = -1
        for (let j = 0; j < allocs.length; j++) {
          if (j !== i && (maxIdx === -1 || allocs[j] > allocs[maxIdx])) maxIdx = j
        }
        if (maxIdx >= 0) allocs[maxIdx] = Math.max(floors[maxIdx], allocs[maxIdx] - diff)
      }
    }
  }

  return panels.map((p, i) => ({
    height: allocs[i],
    visibleRows: Math.max(0, Math.floor((allocs[i] - p.header) / p.rowHeight)),
  }))
}

// ── Live clock ────────────────────────────────────────────────────────────────
function useClock() {
  const [t, setT] = useState(cstNow())
  useEffect(() => {
    const id = setInterval(() => setT(cstNow()), 30000)
    return () => clearInterval(id)
  }, [])
  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT']
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const h = t.getHours(), min = t.getMinutes()
  const h12 = h % 12 || 12
  const ampm = h >= 12 ? 'PM' : 'AM'
  return {
    dateStr: `${days[t.getDay()]} ${t.getDate()} ${months[t.getMonth()]}`,
    timeStr: `${h12}:${String(min).padStart(2,'0')} ${ampm}`,
  }
}

// ── Panel wrapper ─────────────────────────────────────────────────────────────
function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.bgPanel,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      boxSizing: 'border-box',
      ...style,
    }}>
      {children}
    </div>
  )
}

// Panel header — glyph + label + optional counts + optional action button
function PanelHeader({
  glyph,
  label,
  statusCount,
  statusColor,
  totalCount,
  actionLabel,
  onAction,
}: {
  glyph: React.ReactNode
  label: string
  statusCount?: string
  statusColor?: string
  totalCount?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div style={{
      flexShrink: 0,
      padding: '13px 18px 11px',
      borderBottom: `1px solid ${C.borderPanel}`,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <span style={{ color: C.brandLift, flexShrink: 0 }}>{glyph}</span>
      <span style={{ ...DT1, color: C.textMid }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: C.borderPanel }} />
      {statusCount && <span style={{ ...DT5, color: statusColor ?? C.textLow }}>{statusCount}</span>}
      {totalCount && <span style={{ ...DT5, color: C.textLow }}>{totalCount}</span>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            background: 'transparent',
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: '8px 13px',
            ...DS4,
            color: C.textMid,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

// Hairline separator between rows
function Hair() {
  return <div style={{ height: 1, background: C.borderHair, flexShrink: 0 }} />
}

// ── Glyphs (24-grid, 1.7px stroke, brand-lift, 17px render) ──────────────────
const G = {
  next48: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  battlePlan: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <line x1="9" y1="7" x2="20" y2="7"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="17" x2="20" y2="17"/>
      <polyline points="4 7 5 8 8 5"/><polyline points="4 12 5 13 8 10"/>
      <line x1="4" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  moneyMovers: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  underContract: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <polyline points="9 15 11 17 15 13"/>
    </svg>
  ),
  schedule: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  deadlines: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  ),
  receivables: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  ),
  people: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  agent: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2"/><path d="M12 2a10 10 0 0 1 10 10"/>
      <path d="M12 22a10 10 0 0 1-10-10"/><path d="M2 12a10 10 0 0 1 10-10"/>
      <path d="M22 12a10 10 0 0 1-10 10"/>
    </svg>
  ),
}

// ── BATTLE PLAN ───────────────────────────────────────────────────────────────
function BattlePlanPanel({ refreshKey, onSelectTask, onCreateTask }: { refreshKey: number; onSelectTask?: (t: Task) => void; onCreateTask?: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  // E: scroll container ref for custom thumb + bottom fade
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollState, setScrollState] = useState({ scrollTop: 0, clientHeight: 0, scrollHeight: 0 })
  const thumbTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [thumbVisible, setThumbVisible] = useState(false)
  const [fadeVisible, setFadeVisible] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('tasks')
        .select('id, title, status, due_date, completed_at, deal_id, deals(name, address)')
        .eq('status', 'open')
        .is('deleted_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(60)
      setTasks((data ?? []) as unknown as Task[])
      setLoading(false)
    }
    load()
  }, [refreshKey])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onScroll() {
      if (!el) return
      const st = el.scrollTop
      const ch = el.clientHeight
      const sh = el.scrollHeight
      setScrollState({ scrollTop: st, clientHeight: ch, scrollHeight: sh })
      setFadeVisible(st + ch < sh - 4)
      setThumbVisible(true)
      if (thumbTimeoutRef.current) clearTimeout(thumbTimeoutRef.current)
      thumbTimeoutRef.current = setTimeout(() => setThumbVisible(false), 600)
    }
    setScrollState({ scrollTop: el.scrollTop, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight })
    setFadeVisible(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [loading])

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

  const groups = {
    overdue:  tasks.filter(t => t.due_date && t.due_date < todayStr),
    today:    tasks.filter(t => t.due_date === todayStr),
    later:    tasks.filter(t => t.due_date && t.due_date > todayStr),
    noDate:   tasks.filter(t => !t.due_date),
  }

  const lateCount = groups.overdue.length
  const totalCount = tasks.length

  // D4.1: hairline rows, not cards. 20px reserved spine gutter.
  function TaskRow({ t, overdue }: { t: Task; overdue?: boolean }) {
    const days = t.due_date ? Math.abs(daysBetween(t.due_date)) : null
    const isOverdue = overdue && t.due_date && t.due_date < todayStr

    return (
      <div
        onClick={() => onSelectTask?.(t)}
        style={{
          padding: isOverdue ? '12px 14px 12px 17px' : '12px 14px 12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          minWidth: 0,
          borderLeft: isOverdue ? `3px solid ${C.late}` : '3px solid transparent',
          marginLeft: isOverdue ? -3 : 0,
        }}
      >
        <span style={{ ...DS3, color: C.textHi, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.title}
        </span>
        {t.deals && (
          <span style={{ ...DS6, color: C.textLow, flexShrink: 0 }}>
            {t.deals.name}
          </span>
        )}
        {isOverdue && days != null && (
          <span style={{ ...DT5, color: C.late, flexShrink: 0, width: 44, textAlign: 'right' }}>
            {days}d
          </span>
        )}
      </div>
    )
  }

  function Group({ label, items, overdue }: { label: string; items: Task[]; overdue?: boolean }) {
    if (items.length === 0) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 14px 4px 20px', minHeight: 24 }}>
        <span style={{ ...DT7 as React.CSSProperties, color: C.textLow }}>{label}</span>
        <span style={{ ...DT7 as React.CSSProperties, color: C.textLow }}>· 0</span>
        <div style={{ flex: 1, height: 1, background: C.borderHair }} />
      </div>
    )
    return (
      <div>
        <div style={{
          position: 'sticky',
          top: 0,
          background: C.bgPanel,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px 4px 20px',
          borderBottom: `1px solid ${C.borderHair}`,
        }}>
          <span style={{ ...DT7 as React.CSSProperties, color: C.textLow }}>{label}</span>
          <span style={{ ...DT7 as React.CSSProperties, color: C.textLow }}>·</span>
          <span style={{ ...DT7 as React.CSSProperties, color: C.textLow }}>{items.length}</span>
          <div style={{ flex: 1, height: 1, background: C.borderHair }} />
        </div>
        {items.map((t, i) => (
          <React.Fragment key={t.id}>
            <TaskRow t={t} overdue={overdue} />
            {i < items.length - 1 && <Hair />}
          </React.Fragment>
        ))}
      </div>
    )
  }

  const { scrollTop, clientHeight, scrollHeight } = scrollState
  const thumbH = scrollHeight > 0 ? Math.max(24, (clientHeight / scrollHeight) * clientHeight) : 0
  const thumbTop = scrollHeight > clientHeight ? (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - thumbH) : 0

  return (
    <Panel style={{ flex: 1 }}>
      {/* BattlePlanPanel header 55px — has create control */}
      <div style={{
        flexShrink: 0,
        padding: '13px 18px 11px',
        borderBottom: `1px solid ${C.borderPanel}`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 55,
        boxSizing: 'border-box',
      }}>
        <span style={{ color: C.brandLift, flexShrink: 0 }}>{G.battlePlan}</span>
        <span style={{ ...DT1, color: C.textMid }}>BATTLE PLAN</span>
        {lateCount > 0 && <span style={{ ...DT5, color: C.late }}>{lateCount} LATE</span>}
        <div style={{ flex: 1, height: 1, background: C.borderPanel }} />
        <span style={{ ...DT5, color: C.textLow }}>{totalCount}</span>
        {/* D2.4a FAB create control — 31×31 */}
        <button
          aria-label="Add task"
          onClick={() => onCreateTask?.()}
          style={{
            width: 31,
            height: 31,
            borderRadius: 10,
            border: 'none',
            background: 'radial-gradient(circle at 50% 30%, #B7A2FF 0%, #8B5CF6 45%, #6D28D9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            color: '#fff',
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          +
        </button>
      </div>
      {/* Scroll container with custom thumb + bottom fade */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div
          ref={scrollRef}
          style={{ height: '100%', overflowY: 'auto', padding: '4px 0 14px' }}
        >
          {loading ? (
            <div style={{ ...DS6, color: C.textLow, padding: '20px 0', textAlign: 'center' }}>Loading…</div>
          ) : (
            <>
              <Group label="OVERDUE" items={groups.overdue} overdue />
              <Group label="TODAY" items={groups.today} />
              <Group label="LATER" items={groups.later} />
              <Group label="NO DUE DATE" items={groups.noDate} />
            </>
          )}
        </div>
        {/* Bottom fade — visible when more content below */}
        {fadeVisible && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 28,
            background: `linear-gradient(to bottom, transparent, ${C.bgPanel})`,
            pointerEvents: 'none',
          }} />
        )}
        {/* Custom scroll thumb */}
        {thumbH > 0 && scrollHeight > clientHeight && (
          <div style={{
            position: 'absolute',
            right: 2,
            top: thumbTop,
            width: 6,
            height: thumbH,
            background: 'rgba(255,255,255,0.25)',
            borderRadius: 3,
            opacity: thumbVisible ? 1 : 0,
            transition: 'opacity 0.3s',
            pointerEvents: 'none',
          }} />
        )}
      </div>
    </Panel>
  )
}

// ── MONEY MOVERS ──────────────────────────────────────────────────────────────
// D4.4: No MM_DISPLAY_LIMIT — allocation drives visible rows.
// Header = 41px (no create control per D2.4a rule)
// rowHeight = 44px
const MM_HEADER = 41
const MM_ROW_H  = 44

function MoneyMoversPanel({ refreshKey, visibleRows }: { refreshKey: number; visibleRows: number }) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [econMap, setEconMap] = useState<Record<string, DealEconomics>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: dealData } = await supabase
        .from('deals')
        .select('id, name, address, addr_display, addr_street_name, addr_number, addr_city, status, deal_contacts(contacts(name))')
        .eq('is_money_mover', true)
        .not('status', 'in', '("closed","expired","dormant","terminated")')
        .limit(30)
      const rows = (dealData ?? []) as unknown as Deal[]
      setDeals(rows)

      if (rows.length > 0) {
        const ids = rows.map(d => d.id)
        const { data: econData } = await supabase
          .from('deal_economics')
          .select('deal_id, transaction_type, asking_price, sale_commission_pct, sqft, lease_rate_psf, lease_term_years, lease_commission_pct')
          .in('deal_id', ids)
        const map: Record<string, DealEconomics> = {}
        ;(econData ?? []).forEach((e: any) => { map[e.deal_id] = e as DealEconomics })
        setEconMap(map)
      }
      setLoading(false)
    }
    load()
  }, [refreshKey])

  const enriched = deals.map(d => {
    const econ = econMap[d.id] ?? null
    const commission = calcCommission(econ)
    let dealValue: number | null = null
    if (econ) {
      if (econ.transaction_type === 'sale' && econ.asking_price) dealValue = econ.asking_price
      else if ((econ.transaction_type === 'lease' || econ.transaction_type === 'both') && econ.sqft && econ.lease_rate_psf && econ.lease_term_years) {
        dealValue = econ.sqft * econ.lease_rate_psf * econ.lease_term_years
      }
    }
    return { ...d, _commission: commission, _dealValue: dealValue }
  })

  const headerTotal = enriched.reduce((s, d) => s + (d._commission ?? 0), 0)

  // D4.4 item 7: terminal row replaces last visible row
  const effectiveVisible = visibleRows > 0 ? visibleRows : enriched.length
  const displayDeals = enriched.length > effectiveVisible
    ? enriched.slice(0, Math.max(0, effectiveVisible - 1))
    : enriched
  const moreCount = enriched.length - displayDeals.length

  return (
    <Panel style={{ flexShrink: 0 }}>
      <PanelHeader glyph={G.moneyMovers} label="MONEY MOVERS" totalCount={headerTotal > 0 ? fmtMoney(headerTotal) : `${enriched.length}`} />
      {/* Column header */}
      <div style={{
        display: 'flex',
        padding: '7px 14px',
        borderBottom: `1px solid ${C.borderPanel}`,
        flexShrink: 0,
      }}>
        <span style={{ ...DT8, color: C.textLow, flex: 1 }}>ADDRESS</span>
        <span style={{ ...DT8, color: C.textLow, width: 78, textAlign: 'right' }}>VALUE</span>
        <span style={{ ...DT8, color: C.textLow, width: 70, textAlign: 'right' }}>COMM</span>
      </div>
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
        {loading ? (
          <div style={{ ...DS6, color: C.textLow, padding: '12px 14px' }}>Loading…</div>
        ) : displayDeals.length === 0 && moreCount === 0 ? (
          <div style={{ ...DS6, color: C.textLow, padding: '12px 14px' }}>No money movers.</div>
        ) : (
          <>
            {displayDeals.map((d, i) => (
              <React.Fragment key={d.id}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', minHeight: MM_ROW_H, boxSizing: 'border-box' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...DS3, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shortAddr(d)}
                    </div>
                    <div style={{ ...DS7, color: C.textLow }}>
                      {clientName(d)} · {d.status.replace(/_/g,' ')}
                    </div>
                  </div>
                  <div style={{ ...DM1, color: C.textHi, width: 78, textAlign: 'right', flexShrink: 0 }}>
                    {fmtMoney(d._dealValue)}
                  </div>
                  <div style={{ ...DM1, color: C.moneyIn, width: 70, textAlign: 'right', flexShrink: 0 }}>
                    {fmtMoney(d._commission)}
                  </div>
                </div>
                {i < displayDeals.length - 1 && <Hair />}
              </React.Fragment>
            ))}
            {/* D4.4 item 7: terminal row replaces last visible row */}
            {moreCount > 0 && (
              <div style={{ ...DS7, color: C.textLow, padding: '8px 14px' }}>+ {moreCount} MORE → DEALS</div>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}

// ── UNDER CONTRACT ────────────────────────────────────────────────────────────
// D4.4: No UC_DISPLAY_LIMIT — allocation drives visible rows.
// Header = 41px (no create control)
// rowHeight = 52px
const UC_HEADER = 41
const UC_ROW_H  = 52

function UnderContractPanel({ refreshKey, visibleRows }: { refreshKey: number; visibleRows: number }) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('deals')
        .select('id, name, address, addr_display, addr_street_name, addr_number, addr_city, status, commission_estimated, deal_contacts(contacts(name))')
        .eq('status', 'under_contract')
        .order('created_at', { ascending: true })
        .limit(30)
      setDeals((data ?? []) as unknown as Deal[])
      setLoading(false)
    }
    load()
  }, [refreshKey])

  // D4.4 item 7: terminal row replaces last visible row
  const effectiveVisible = visibleRows > 0 ? visibleRows : deals.length
  const displayDeals = deals.length > effectiveVisible
    ? deals.slice(0, Math.max(0, effectiveVisible - 1))
    : deals
  const moreCount = deals.length - displayDeals.length

  return (
    <Panel style={{ flexShrink: 0 }}>
      <PanelHeader glyph={G.underContract} label="UNDER CONTRACT" totalCount={String(deals.length)} />
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
        {loading ? (
          <div style={{ ...DS6, color: C.textLow, padding: '12px 14px' }}>Loading…</div>
        ) : displayDeals.length === 0 && moreCount === 0 ? (
          <div style={{ ...DS6, color: C.textLow, padding: '12px 14px' }}>No deals under contract.</div>
        ) : (
          <>
            {displayDeals.map((d, i) => (
              <React.Fragment key={d.id}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 8, minHeight: UC_ROW_H, boxSizing: 'border-box' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...DS3, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shortAddr(d)}
                    </div>
                    <div style={{ ...DS7, color: C.textLow }}>
                      {clientName(d)} · {d.status.replace(/_/g,' ')}
                    </div>
                  </div>
                  <div style={{ ...DM1, color: C.moneyIn, flexShrink: 0 }}>
                    {fmt$(d.commission_estimated)}
                  </div>
                  <button
                    onClick={() => router.push(`/warroom/deal?id=${d.id}`)}
                    style={{
                      border: `1px solid ${C.moneyIn}`,
                      borderRadius: 6,
                      padding: '4px 9px',
                      background: 'transparent',
                      ...DT5,
                      color: C.moneyIn,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    LANDED
                  </button>
                </div>
                {i < displayDeals.length - 1 && <Hair />}
              </React.Fragment>
            ))}
            {/* D4.4 item 7: terminal row replaces last visible row */}
            {moreCount > 0 && (
              <div style={{ ...DS7, color: C.textLow, padding: '8px 14px' }}>+ {moreCount} MORE → DEALS</div>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}

// ── NEXT 48 ───────────────────────────────────────────────────────────────────
type N48Item = {
  id: string
  kind: 'event' | 'deadline'
  deal_id: string | null
  date: string
  time: string | null
  title: string
  context: string
  spineColor: string
  bp_priority: number | null
}

function Next48Panel({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<N48Item[]>([])
  const [loading, setLoading] = useState(true)
  const bandRef = useRef<HTMLDivElement>(null)
  const [bandInnerWidth, setBandInnerWidth] = useState(0)

  useEffect(() => {
    if (!bandRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      setBandInnerWidth(entry.contentRect.width)
    })
    ro.observe(bandRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    async function load() {
      const cst = new Date().toLocaleString('en-CA', { timeZone: 'America/Chicago', hour12: false })
      const todayStr = cst.slice(0, 10)
      const d1 = new Date(new Date(todayStr).getTime() + 86400000).toISOString().slice(0, 10)
      const d2 = new Date(new Date(todayStr).getTime() + 86400000 * 2).toISOString().slice(0, 10)
      const d3 = new Date(new Date(todayStr).getTime() + 86400000 * 3).toISOString().slice(0, 10)

      const [{ data: events }, { data: deadlines }] = await Promise.all([
        supabase.from('schedule_events').select('id, title, date, time, location, deal_id').gte('date', todayStr).lte('date', d3).order('date').order('time'),
        supabase.from('tasks').select('id, title, due_date, deal_id, bp_priority, deals(name)').eq('status', 'open').is('deleted_at', null).gte('due_date', todayStr).lte('due_date', d3).order('due_date'),
      ])

      const seen = new Set<string>()
      const merged: N48Item[] = []

      for (const e of (events ?? []) as any[]) {
        const eDate = e.date ?? e.event_date ?? ''
        const eTime = e.time ?? e.start_time ?? null
        const key = `${e.deal_id ?? e.id}_${eDate}`
        seen.add(key)
        merged.push({ id: e.id, kind: 'event', deal_id: e.deal_id, date: eDate, time: eTime, title: e.title, context: e.location ?? '', spineColor: C.brand, bp_priority: null })
      }
      for (const t of (deadlines ?? [])) {
        const key = `${t.deal_id ?? t.id}_${t.due_date}`
        if (seen.has(key)) continue
        seen.add(key)
        merged.push({ id: t.id, kind: 'deadline', deal_id: t.deal_id, date: t.due_date!, time: null, title: t.title, context: (t as any).deals?.name ?? '', spineColor: C.hot, bp_priority: (t as any).bp_priority ?? null })
      }

      setItems(merged)
      setLoading(false)
    }
    load()
  }, [refreshKey])

  function getColDate(offset: number): string {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
    return new Date(new Date(todayStr).getTime() + 86400000 * offset).toISOString().slice(0, 10)
  }

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

  const COLS = [
    { label: 'TONIGHT', date: todayStr, dim: false },
    { label: (([y,m,d]) => new Date(y,m-1,d).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase())(getColDate(1).split('-').map(Number)), date: getColDate(1), dim: false },
    { label: (([y,m,d]) => new Date(y,m-1,d).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase())(getColDate(2).split('-').map(Number)), date: getColDate(2), dim: false },
    { label: 'JUST BEYOND', date: getColDate(3), dim: true },
  ]

  // D3.3a: weighted column allocation
  const FLOOR_RATIO = 0.16
  const colFloor = bandInnerWidth > 0 ? Math.max(120, Math.round(bandInnerWidth * FLOOR_RATIO)) : 180

  // Count rows for real day columns (excluding JUST BEYOND)
  const overdue = items.filter(i => i.date < todayStr)
  const colRowCounts = COLS.map((col, idx) => {
    if (col.label === 'JUST BEYOND') return 2 // floor-only
    const colItems = items.filter(i => i.date === col.date)
    const displayItems = col.date === todayStr ? [...overdue, ...colItems.filter(i => i.date === todayStr)] : colItems
    return displayItems.length
  })

  // Allocate widths: JUST BEYOND gets floor, real days share proportionally
  let colWidths: number[] = []
  if (bandInnerWidth > 0) {
    const justBeyondW = colFloor
    const remainingW = bandInnerWidth - justBeyondW - 3 * 16 // 3 gaps between 4 columns
    const realRowCounts = colRowCounts.slice(0, 3)
    const totalRealRows = realRowCounts.reduce((a, b) => a + b, 0)
    if (totalRealRows === 0) {
      colWidths = [remainingW / 3, remainingW / 3, remainingW / 3, justBeyondW]
    } else {
      colWidths = realRowCounts.map(c => {
        const prop = (c / totalRealRows) * remainingW
        return Math.max(colFloor, Math.round(prop))
      })
      colWidths.push(justBeyondW)
    }
  } else {
    colWidths = [200, 200, 200, 120]
  }

  const windowItemCount = COLS.filter(col => col.label !== 'JUST BEYOND').reduce((sum, col, idx) => {
    return sum + colRowCounts[idx]
  }, 0)

  return (
    <div style={{ flexShrink: 0, height: 236, overflow: 'hidden' }}>
      <Panel style={{ height: '100%' }}>
        <PanelHeader glyph={G.next48} label={`${windowItemCount} ITEMS · WINDOW 48H`} />
        <div
          ref={bandRef}
          style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16, padding: '0 14px 14px', overflow: 'hidden' }}
        >
          {COLS.map((col, colIdx) => {
            const colItems = items.filter(i => i.date === col.date)
            const displayItems = col.date === todayStr ? [...overdue, ...colItems.filter(i => i.date === todayStr)] : colItems
            const colW = colWidths[colIdx] || 180

            return (
              <div key={col.label} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: colW, flexShrink: 0 }}>
                {/* Column header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0 4px', flexShrink: 0 }}>
                  <span style={{ ...DT7 as React.CSSProperties, color: col.dim ? C.textLow : C.textHi }}>{col.label}</span>
                  <div style={{ flex: 1, height: 1, background: C.borderHair }} />
                  <span style={{ ...DT7 as React.CSSProperties, color: C.textLow }}>{displayItems.length}</span>
                </div>
                {/* Items — D3.3: hairline rows, no cards */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {loading ? null : displayItems.length === 0 ? (
                    <div style={{ ...DT4, color: C.textLow, padding: '8px 0', textAlign: 'center' }}>CLEAR</div>
                  ) : (() => {
                    const isJustBeyond = col.label === 'JUST BEYOND'
                    const sortedItems = isJustBeyond
                      ? [...displayItems].sort((a, b) => {
                          const aIsEvent = a.kind === 'event'
                          const bIsEvent = b.kind === 'event'
                          if (aIsEvent && !bIsEvent) return -1
                          if (!aIsEvent && bIsEvent) return 1
                          if (aIsEvent && bIsEvent) return a.date.localeCompare(b.date)
                          if (a.bp_priority === null && b.bp_priority === null) return a.date.localeCompare(b.date)
                          if (a.bp_priority === null) return 1
                          if (b.bp_priority === null) return -1
                          if (b.bp_priority !== a.bp_priority) return b.bp_priority - a.bp_priority
                          return a.date.localeCompare(b.date)
                        })
                      : displayItems
                    // D3.3a item 8: terminal row replaces last visible row
                    const maxVisible = isJustBeyond ? 1 : sortedItems.length
                    const visibleItems = sortedItems.slice(0, maxVisible)
                    const moreCount = isJustBeyond ? sortedItems.length - 1 : 0
                    return (
                      <>
                        {visibleItems.map((item, ii) => (
                          <React.Fragment key={item.id}>
                            <div
                              style={{
                                padding: '9px 0 9px 13px',
                                borderLeft: `3px solid ${item.spineColor}`,
                                display: 'flex',
                                gap: 6,
                                minWidth: 0,
                              }}
                            >
                              {/* D3.3: 40px fixed time gutter */}
                              <div style={{ flexShrink: 0, width: 40, ...DT8, color: item.time ? C.textHi : C.textLow }}>
                                {item.time ? item.time.slice(0, 5) : '—'}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ ...DS5, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                                {item.context && <div style={{ ...DS8, color: C.textLow }}>{item.context}</div>}
                              </div>
                            </div>
                            {ii < visibleItems.length - 1 && <Hair />}
                          </React.Fragment>
                        ))}
                        {moreCount > 0 && (
                          <div style={{ ...DT8, color: C.textLow, padding: '8px 0' }}>
                            + {moreCount} MORE TONIGHT
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}

// ── SCHEDULE ──────────────────────────────────────────────────────────────────
// D4.4: Header = 41px (no create control yet per D4.3 note)
// rowHeight = 36px (time gutter row)
const SCHED_HEADER = 41
const SCHED_ROW_H  = 36

function SchedulePanel({ refreshKey, panelHeight, visibleRows }: { refreshKey: number; panelHeight?: number; visibleRows: number }) {
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
      const d1 = new Date(new Date(todayStr).getTime() + 86400000).toISOString().slice(0, 10)
      const { data } = await supabase
        .from('schedule_events')
        .select('id, title, date, time, location')
        .gte('date', todayStr)
        .lte('date', d1)
        .order('date').order('time')
        .limit(30)
      setEvents((data ?? []) as ScheduleEvent[])
      setLoading(false)
    }
    load()
  }, [refreshKey])

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const d1 = new Date(new Date(todayStr).getTime() + 86400000).toISOString().slice(0, 10)

  const todays = events.filter(e => (e.date ?? e.event_date) === todayStr)
  const tomorrows = events.filter(e => (e.date ?? e.event_date) === d1)
  const allEvents = [...todays, ...tomorrows]

  // D4.4 item 7: terminal row replaces last visible row
  const effectiveVisible = visibleRows > 0 ? visibleRows : allEvents.length
  const displayEvents = allEvents.length > effectiveVisible
    ? allEvents.slice(0, Math.max(0, effectiveVisible - 1))
    : allEvents
  const moreCount = allEvents.length - displayEvents.length

  function fmt12(t: string | null): { time: string; ampm: string } {
    if (!t) return { time: '—', ampm: '' }
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return { time: `${h12}:${String(m).padStart(2,'0')}`, ampm }
  }

  function EventRow({ e, isNext }: { e: ScheduleEvent; isNext?: boolean }) {
    const { time, ampm } = fmt12(e.time ?? e.start_time ?? null)
    return (
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '9px 14px',
        minHeight: SCHED_ROW_H,
        boxSizing: 'border-box',
        borderLeft: isNext ? `3px solid ${C.brand}` : '3px solid transparent',
      }}>
        {/* Time gutter */}
        <div style={{ flexShrink: 0, width: 44 }}>
          <div style={{ ...DM2, color: C.textHi }}>{time}</div>
          {ampm && <div style={{ ...DT7 as React.CSSProperties, color: C.textLow }}>{ampm}</div>}
        </div>
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...DS4, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
          {e.location && <div style={{ ...DS7, color: C.textLow }}>{e.location}</div>}
        </div>
      </div>
    )
  }

  const h = panelHeight ? panelHeight : undefined

  return (
    <Panel style={{ flexShrink: 0, height: h }}>
      <PanelHeader glyph={G.schedule} label="SCHEDULE" />
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
        {loading ? (
          <div style={{ ...DS6, color: C.textLow, padding: '12px 14px' }}>Loading…</div>
        ) : displayEvents.length === 0 && moreCount === 0 ? (
          <div style={{ ...DT4, color: C.textLow, padding: '20px 14px', textAlign: 'center', fontFamily: FONT_MONO }}>NOTHING SCHEDULED</div>
        ) : (
          <>
            {displayEvents.map((e, i) => (
              <React.Fragment key={e.id}>
                <EventRow e={e} isNext={i === 0} />
                {i < displayEvents.length - 1 && <Hair />}
              </React.Fragment>
            ))}
            {moreCount > 0 && (
              <div style={{ ...DS7, color: C.textLow, padding: '8px 14px' }}>+ {moreCount} MORE → SCHED</div>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}

// ── DUE (was DEADLINES) ───────────────────────────────────────────────────────
// D4.3: Panel header label is "DUE" on screen everywhere.
// Past-due rows: "N D LATE" with late spine.
// Forward rows: "N D · MMM D" format.
// D4.4: Header = 41px (no create control yet), rowHeight = 44px
const DUE_HEADER = 41
const DUE_ROW_H  = 44

function DuePanel({ refreshKey, panelHeight, visibleRows }: { refreshKey: number; panelHeight?: number; visibleRows: number }) {
  const [deadlines, setDeadlines] = useState<Array<{
    id: string; title: string; due_date: string; kind: string;
    deals?: { name: string; address: string | null; addr_display: string | null; addr_street_name: string | null; addr_number: string | null; addr_city: string | null } | null
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
      const cutoff = new Date(new Date(todayStr).getTime() + 86400000 * 45).toISOString().slice(0, 10)
      const [{ data: pastDue }, { data: forward }] = await Promise.all([
        supabase
          .from('contract_deadlines')
          .select('id, label, deadline_date, deadline_type, status, deal_id')
          .in('status', ['pending', 'extended'])
          .lt('deadline_date', todayStr)
          .order('deadline_date', { ascending: true })
          .limit(10),
        supabase
          .from('contract_deadlines')
          .select('id, label, deadline_date, deadline_type, status, deal_id')
          .in('status', ['pending', 'extended'])
          .gte('deadline_date', todayStr)
          .lte('deadline_date', cutoff)
          .order('deadline_date', { ascending: true })
          .limit(30),
      ])
      const combined = [...(pastDue ?? []), ...(forward ?? [])]
      setDeadlines(combined.map((t: any) => ({ ...t, title: t.label ?? t.deadline_type ?? 'Deadline', due_date: t.deadline_date, kind: t.deadline_type ?? 'DEADLINE' })))
      setLoading(false)
    }
    load()
  }, [refreshKey])

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const pastDue = deadlines.filter(d => d.due_date < todayStr)
  const pastDueCount = pastDue.length

  // D4.4 item 7: terminal row replaces last visible row
  const effectiveVisible = visibleRows > 0 ? visibleRows : deadlines.length
  const displayDeadlines = deadlines.length > effectiveVisible
    ? deadlines.slice(0, Math.max(0, effectiveVisible - 1))
    : deadlines
  const moreCount = deadlines.length - displayDeadlines.length

  const h = panelHeight ? panelHeight : undefined

  return (
    <Panel style={{ flexShrink: 0, height: h }}>
      <PanelHeader
        glyph={G.deadlines}
        label="DUE"
        statusCount={pastDueCount > 0 ? `${pastDueCount} PAST DUE` : undefined}
        statusColor={C.late}
        totalCount={String(deadlines.length)}
      />
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
        {loading ? (
          <div style={{ ...DS6, color: C.textLow, padding: '12px 14px' }}>Loading…</div>
        ) : displayDeadlines.length === 0 && moreCount === 0 ? (
          <div style={{ ...DT4, color: C.textLow, padding: '20px 14px', textAlign: 'center', fontFamily: FONT_MONO }}>NO DEADLINES</div>
        ) : (
          <>
            {displayDeadlines.map((d, i) => {
              const days = daysBetween(d.due_date)
              const isPast = days < 0
              const absDays = Math.abs(days)
              const isUrgent = !isPast && days <= 7
              const isFirst = i === 0
              const isFirstFuture = !isPast && (i === 0 || deadlines.slice(0, i).every(x => daysBetween(x.due_date) < 0))

              return (
                <React.Fragment key={d.id}>
                  <div style={{
                    display: 'flex',
                    gap: 8,
                    padding: '9px 14px',
                    minHeight: DUE_ROW_H,
                    boxSizing: 'border-box',
                    background: isFirstFuture && !isPast ? `rgba(255,163,58,0.05)` : 'transparent',
                    borderLeft: isPast ? `3px solid ${C.late}` : isFirstFuture ? `3px solid ${C.hot}` : '3px solid transparent',
                    alignItems: 'flex-start',
                  }}>
                    {/* Days — D4.3: "N D LATE" when past, "N D · MMM D" when forward */}
                    <div style={{ flexShrink: 0, width: 84 }}>
                      {isPast ? (
                        <div style={{ ...DT7 as React.CSSProperties, color: C.late, whiteSpace: 'nowrap' }}>
                          {absDays}D LATE
                        </div>
                      ) : (
                        <div style={{ ...DT7 as React.CSSProperties, color: isUrgent ? C.hot : C.textMid, whiteSpace: 'nowrap' }}>
                          {days === 0 ? 'TODAY' : `${days}D · ${fmtDate(d.due_date)}`}
                        </div>
                      )}
                    </div>
                    {/* Kind */}
                    <div style={{ ...DT7 as React.CSSProperties, color: C.textLow, flexShrink: 0, textAlign: 'right' }}>{d.kind}</div>
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...DS3, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                      {d.deals && <div style={{ ...DS7, color: C.textLow }}>{d.deals.addr_display ?? d.deals.addr_street_name ?? d.deals.name}</div>}
                    </div>
                  </div>
                  {i < displayDeadlines.length - 1 && <Hair />}
                </React.Fragment>
              )
            })}
            {/* D4.4 item 7: terminal row replaces last visible row */}
            {moreCount > 0 && (
              <div style={{ ...DS7, color: C.textLow, padding: '8px 14px' }}>+ {moreCount} MORE → DUE</div>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}

// ── RECEIVABLES ───────────────────────────────────────────────────────────────
// D4.3: flex:none, 130px cap.
// Layout: two DM0 figures on one row, 6px bar, mono label row with % left and OUTSTANDING right.
// No terminal row, not clickable.
const RECV_HEIGHT = 130

function ReceivablesCard({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<ArItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('ar_items').select('id, commission_amount, paid_to_date, status').limit(50)
      setItems((data ?? []) as ArItem[])
      setLoading(false)
    }
    load()
  }, [refreshKey])

  const total = items.reduce((s, i) => s + (i.commission_amount ?? 0), 0)
  const collected = items.filter(i => i.status === 'collected').reduce((s, i) => s + (i.commission_amount ?? 0), 0)
  const outstanding = total - collected
  const pct = total > 0 ? Math.round((collected / total) * 100) : 0

  return (
    <div style={{
      flexShrink: 0,
      height: RECV_HEIGHT,
      boxSizing: 'border-box',
      borderRadius: 14,
      overflow: 'hidden',
      border: `1px solid ${C.border}`,
      background: 'linear-gradient(155deg, rgba(52,211,153,0.09), rgba(139,92,246,0.05))',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      {/* Panel header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ color: C.brandLift }}>{G.receivables}</span>
        <span style={{ ...DT1, color: C.textMid }}>RECEIVABLES</span>
      </div>
      {/* D4.3: two DM0 figures on one row — collected left (money-in), outstanding right (brand-lift) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexShrink: 0 }}>
        <div style={{ ...DM0, color: C.moneyIn, textShadow: 'none' }}>
          {loading ? '—' : fmtMoney(collected)}
        </div>
        <div style={{ ...DM0, color: C.brandLift, textShadow: 'none' }}>
          {loading ? '—' : fmtMoney(outstanding)}
        </div>
      </div>
      {/* D4.3: 6px split bar */}
      <div style={{ height: 6, borderRadius: 3, background: C.bgRaise, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: C.moneyIn, borderRadius: 3 }} />
      </div>
      {/* D4.3: mono label row — % left, OUTSTANDING right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ ...DT7 as React.CSSProperties, color: C.textLow }}>{pct}% COLLECTED</span>
        <span style={{ ...DT7 as React.CSSProperties, color: C.textLow }}>OUTSTANDING</span>
      </div>
    </div>
  )
}

// AgentCard removed in build(48) — Column C: SchedulePanel, DuePanel, ReceivablesCard only

// ── IDENTITY BAND ─────────────────────────────────────────────────────────────
function IdentityBand({ onSearch }: { onSearch?: () => void }) {
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

      <div style={{ width: 'auto', flexShrink: 0, marginTop: -10, marginLeft: -3.5, display:'flex', alignItems:'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/wordmark/shirleycre-h176.png" alt="SHIRLEYCRE" height={88} style={{ height: 88, width: 'auto', display: 'block' }} />
      </div>

      <div style={{ width: 1, height: 40, background: C.border, flexShrink: 0 }} />
      <span style={{ ...DT1, letterSpacing: '0.19em', color: C.textMid, marginTop: 4, flexShrink: 0 }}>WAR ROOM</span>
      <div style={{ width: 1, height: 40, background: C.border, flexShrink: 0 }} />

      <div
        onClick={onSearch}
        style={{
          flex: '0 1 380px',
          minWidth: 120,
          background: 'rgba(255,255,255,0.075)',
          borderRadius: 10,
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.textLow} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <div style={{ flex: 1 }} />
        <div style={{
          ...DT4,
          color: C.textLow,
          border: `1px solid rgba(255,255,255,0.18)`,
          borderRadius: 4,
          padding: '2px 5px',
          fontFamily: FONT_MONO,
        }}>⌘K</div>
      </div>

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

// ── LEFT RAIL ─────────────────────────────────────────────────────────────────
type RailSlot = 'HOME' | 'PEOPLE'

function LeftRail({ active }: { active: RailSlot }) {
  const router = useRouter()

  const slots: { id: RailSlot; label: string; glyph: React.ReactNode; href: string }[] = [
    { id: 'HOME',   label: 'HOME',   glyph: G.home,   href: '/warroom' },
    { id: 'PEOPLE', label: 'PEOPLE', glyph: G.people, href: '/warroom/contacts' },
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

// ── ROOT PAGE ─────────────────────────────────────────────────────────────────
export default function WarRoomPage() {
  const [unlocked, setUnlocked] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [drawerTask, setDrawerTask] = useState<Task | null>(null)
  const [createMode, setCreateMode] = useState(false)

  // D4.4: Column B ref for elastic allocation
  const colBRef = useRef<HTMLDivElement>(null)
  const [colBHeight, setColBHeight] = useState(0)

  // D4.4: Column C ref for elastic allocation
  const colCRef = useRef<HTMLDivElement>(null)
  const [colCHeight, setColCHeight] = useState(0)

  // D4.4: row counts from panels — lifted up so column-level allocation can use them
  // These are "demand row counts" — the actual number of records fetched
  // We use conservative defaults until panels load their data
  // For now: use ResizeObserver on columns + fixed row heights to compute allocations
  // Panel row counts are estimated from data — panels pass rowCount up via callback
  const [mmRowCount, setMmRowCount] = useState(5)
  const [ucRowCount, setUcRowCount] = useState(3)
  const [schedRowCount, setSchedRowCount] = useState(4)
  const [dueRowCount, setDueRowCount] = useState(6)

  useEffect(() => {
    const expiry = localStorage.getItem(SESSION_KEY)
    if (expiry && Date.now() < parseInt(expiry)) setUnlocked(true)
  }, [])

  const handlePinSuccess = useCallback(() => {
    const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000
    localStorage.setItem(SESSION_KEY, expiry.toString())
    setUnlocked(true)
  }, [])

  // D4.4: measure column B height
  useEffect(() => {
    if (!colBRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      setColBHeight(entry.contentRect.height)
    })
    ro.observe(colBRef.current)
    return () => ro.disconnect()
  }, [unlocked])

  // D4.4: measure column C height
  useEffect(() => {
    if (!colCRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      setColCHeight(entry.contentRect.height)
    })
    ro.observe(colCRef.current)
    return () => ro.disconnect()
  }, [unlocked])

  // D4.4: Compute column B allocations (MM + UC)
  const colBPanels: PanelSpec[] = [
    { header: MM_HEADER + 24, rowHeight: MM_ROW_H, rowCount: mmRowCount }, // +24 for column header row
    { header: UC_HEADER, rowHeight: UC_ROW_H, rowCount: ucRowCount },
  ]
  const colBAllocs = colBHeight > 0 ? computeAlloc(colBHeight, colBPanels) : [
    { height: 300, visibleRows: 5 },
    { height: 250, visibleRows: 4 },
  ]

  // D4.4: Compute column C allocations (SCHEDULE + DUE, RECEIVABLES is flex:none)
  const colCPanels: PanelSpec[] = [
    { header: SCHED_HEADER, rowHeight: SCHED_ROW_H, rowCount: schedRowCount },
    { header: DUE_HEADER, rowHeight: DUE_ROW_H, rowCount: dueRowCount },
  ]
  const colCBudget = colCHeight > 0 ? colCHeight - RECV_HEIGHT - 2 * 18 : 400
  const colCAllocs = colCBudget > 0 ? computeAlloc(colCBudget, colCPanels) : [
    { height: 200, visibleRows: 4 },
    { height: 200, visibleRows: 4 },
  ]

  // Create mode: open TaskModal with an empty-ish task for creation
  const createTask: Task = {
    id: '',
    title: '',
    status: 'open',
    due_date: null,
    completed_at: null,
    deal_id: null,
  }

  if (!unlocked) {
    return (
      <PinGate
        pinHash={PIN_HASH}
        sha256={sha256}
        onSuccess={handlePinSuccess}
      />
    )
  }

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      background: C.bgBase,
      color: C.textHi,
      fontFamily: FONT_DISP,
    }}>
      {/* ── Left rail — 96px, own plane ── */}
      <LeftRail active="HOME" />

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* ── Identity band — 112px ── */}
        <IdentityBand />

        {/* ── Content area ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '18px 24px 20px',
          gap: 18,
          overflow: 'hidden',
          minHeight: 0,
        }}>

          {/* ── NEXT 48 — 236px fixed ── */}
          <Next48Panel refreshKey={refreshKey} />

          {/* ── Three-column row ── */}
          <div style={{
            flex: 1,
            display: 'flex',
            gap: 18,
            minHeight: 0,
          }}>

            {/* Column A — 0.30 of content width, floored at 441px (D4.1) */}
            <div style={{ flex: '0 0 30%', minWidth: 441, boxSizing: 'border-box', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <BattlePlanPanel
                refreshKey={refreshKey}
                onSelectTask={setDrawerTask}
                onCreateTask={() => setCreateMode(true)}
              />
            </div>

            {/* Column B — 0.39 of content width (D4.2) */}
            <div
              ref={colBRef}
              style={{ flex: '0 0 39%', boxSizing: 'border-box', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 18 }}
            >
              <MoneyMoversPanel
                refreshKey={refreshKey}
                visibleRows={colBAllocs[0].visibleRows}
              />
              <UnderContractPanel
                refreshKey={refreshKey}
                visibleRows={colBAllocs[1].visibleRows}
              />
            </div>

            {/* Column C — 0.31 of content width (D4.3) */}
            <div
              ref={colCRef}
              style={{ flex: 1, boxSizing: 'border-box', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 18 }}
            >
              <SchedulePanel
                refreshKey={refreshKey}
                panelHeight={colCAllocs[0].height}
                visibleRows={colCAllocs[0].visibleRows}
              />
              <DuePanel
                refreshKey={refreshKey}
                panelHeight={colCAllocs[1].height}
                visibleRows={colCAllocs[1].visibleRows}
              />
              <ReceivablesCard refreshKey={refreshKey} />
            </div>

          </div>
        </div>
      </div>

      {/* D11 — Desktop task modal */}
      {(drawerTask || createMode) && (
        <TaskModal
          task={(drawerTask ?? createTask) as any}
          onClose={() => { setDrawerTask(null); setCreateMode(false) }}
          onCompleted={() => { setDrawerTask(null); setCreateMode(false); setRefreshKey(k => k + 1) }}
          onSaved={() => { setDrawerTask(null); setCreateMode(false); setRefreshKey(k => k + 1) }}
        />
      )}
    </div>
  )
}

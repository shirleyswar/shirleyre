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
import { calcCommission, calcLeaseValue, fmtMoney } from '@/lib/dealMath'
import Fab from '@/assets/fab/Fab'
import '@/assets/fab/fab.css'
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
  muted:      '#6a7a80',
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
  // Check 48: commission rate model fields
  listing_rate?: number | null
  co_broker_on?: boolean | null
  co_broker_split?: number | null
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
  commission: number | null
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
  const floors = panels.map(p => p.header + (p.rowCount === 0 ? 1 : 2) * p.rowHeight)
  // Check 30: effective demand must be at least the floor for each panel
  const effectiveDemands = demands.map((d, i) => Math.max(d, floors[i]))
  const totalDemand = effectiveDemands.reduce((a, b) => a + b, 0)

  let allocs: number[]
  if (totalDemand <= totalBudget) {
    allocs = [...effectiveDemands]
    allocs[allocs.length - 1] += totalBudget - totalDemand
  } else {
    allocs = effectiveDemands.map(d => Math.round((d / totalDemand) * totalBudget))
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

// Panel header — glyph + label + optional counts + optional action button + optional FAB
function PanelHeader({
  glyph,
  label,
  statusCount,
  statusColor,
  totalCount,
  actionLabel,
  onAction,
  fab,
  minHeight,
}: {
  glyph: React.ReactNode
  label: string
  statusCount?: string
  statusColor?: string
  totalCount?: string
  actionLabel?: string
  onAction?: () => void
  fab?: React.ReactNode
  minHeight?: number
}) {
  return (
    <div style={{
      flexShrink: 0,
      padding: '13px 18px 11px',
      borderBottom: `1px solid ${C.borderPanel}`,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      minHeight: minHeight,
      boxSizing: 'border-box',
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
      {fab && (
        <div className="wr-fab-desktop-wrap" style={{ flexShrink: 0 }}>
          {fab}
        </div>
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
        .select('id, title, status, due_date, completed_at, deal_id, deals(name, address, addr_display)')
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

  // D4.1: hairline rows. Check 31: title line 1, "address · client" subline, right-aligned date gutter.
  function TaskRow({ t, overdue }: { t: Task; overdue?: boolean }) {
    const days = t.due_date ? daysBetween(t.due_date) : null
    const absDays = days != null ? Math.abs(days) : null
    const isOverdue = overdue && t.due_date && t.due_date < todayStr

    // Check 31: "address · client" subline from deal data
    const dealAddr = (t as any).deals?.addr_display ?? (t as any).deals?.address ?? (t as any).deals?.name ?? null
    const dealClient = (t as any).deals?.name && (t as any).deals?.name !== dealAddr ? (t as any).deals.name : null
    const sublineParts: string[] = []
    if (dealAddr) sublineParts.push(dealAddr)
    if (dealClient) sublineParts.push(dealClient)
    const subline = sublineParts.join(' · ')

    // Check 31: date gutter — day count ("3D") and due date ("AUG 26"), 84px, nowrap
    const dayLabel = days != null ? (isOverdue ? `${absDays}D LATE` : days === 0 ? 'TODAY' : `${days}D`) : null
    const dateLabel = t.due_date ? fmtDate(t.due_date).toUpperCase() : null

    return (
      <div
        onClick={() => onSelectTask?.(t)}
        style={{
          padding: isOverdue ? '10px 14px 10px 17px' : '10px 14px 10px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          minWidth: 0,
          borderLeft: isOverdue ? `3px solid ${C.late}` : '3px solid transparent',
          marginLeft: isOverdue ? -3 : 0,
        }}
      >
        {/* Content: title + subline */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...DS3, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.title}
          </div>
          {subline && (
            <div style={{ ...DS7, color: C.textLow, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {subline}
            </div>
          )}
        </div>
        {/* Check 31: right-aligned date gutter 84px, two lines, nowrap */}
        {(dayLabel || dateLabel) && (
          <div style={{ flexShrink: 0, width: 84, textAlign: 'right' }}>
            {dayLabel && <div style={{ ...DT7 as React.CSSProperties, color: isOverdue ? C.late : C.textLow, whiteSpace: 'nowrap' }}>{dayLabel}</div>}
            {dateLabel && !isOverdue && <div style={{ ...DT7 as React.CSSProperties, color: C.textLow, whiteSpace: 'nowrap' }}>{dateLabel}</div>}
          </div>
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
        {/* D2.4a FAB create control — delivered asset, 31×31, no rim per spec */}
        <div className="wr-fab-desktop-wrap" style={{ flexShrink: 0 }}>
          <Fab label="Add task" onClick={() => onCreateTask?.()} />
        </div>
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
// Check 52: Header = 55px (has FAB create control)
// rowHeight = 44px
const MM_HEADER = 55
const MM_ROW_H  = 44

// Item 4: MoneyMovers now reads from money_movers table (not deals.is_money_mover).
interface MoneyMoverRow {
  id: string
  title: string
  deal_id: string | null
  commission: number | null
  note?: string | null
  note_typed_at?: string | null
}

// D11.15: MoneyMoverModal component
function MoneyMoverModal({ mm, dealMap, econMap, onClose, onCloseAndLog, onNoteAdded }: {
  mm: MoneyMoverRow & { _commission: number | null; _dealValue: number | null }
  dealMap: Record<string, any>
  econMap: Record<string, DealEconomics>
  onClose: () => void
  onCloseAndLog: (mmId: string) => void
  onNoteAdded: (mmId: string, note: string) => void
}) {
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const staged = noteText.trim().length > 0

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function writeNote() {
    if (!noteText.trim()) return
    setSaving(true)
    await supabase.from('money_movers').update({
      note: noteText.trim(),
      note_typed_at: new Date().toISOString(),
    }).eq('id', mm.id)
    onNoteAdded(mm.id, noteText.trim())
    setNoteText('')
    setSaving(false)
  }

  async function handleConfirm() {
    if (staged && !saving) {
      await writeNote()
    }
  }

  async function handleCloseAndLog() {
    if (staged && !saving) {
      await writeNote()
    }
    onCloseAndLog(mm.id)
  }

  const deal = mm.deal_id ? dealMap[mm.deal_id] : null
  const econ = mm.deal_id ? econMap[mm.deal_id] : null
  const commFromEcon = econ ? calcCommission(econ) : null
  const commProvenance = commFromEcon != null ? 'INHERITED · POST-HOUSE-SPLIT' : 'TYPED ON THIS RECORD'

  function fmtFigure(n: number | null) {
    if (n == null) return ''
    return '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  function fmtNoteTimestamp(iso: string) {
    const d = new Date(iso)
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
    const mon = months[d.getMonth()]
    const day = d.getDate()
    let h = d.getHours(); const m = d.getMinutes()
    const ampm = h >= 12 ? 'PM' : 'AM'
    if (h > 12) h -= 12; if (h === 0) h = 12
    return `${mon} ${day} · ${h}:${String(m).padStart(2,'0')} ${ampm}`
  }

  function fmtFooterTimestamp() {
    if (!mm.note_typed_at) return ''
    const typed = new Date(mm.note_typed_at)
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
    const tMon = months[typed.getMonth()]; const tDay = typed.getDate()
    return `TYPED ${tMon} ${tDay}`
  }

  // Deal client name
  const clientName = deal?.deal_contacts?.[0]?.contacts?.name ?? null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(5,5,9,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ width: 960, height: 548, background: '#12111B', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ height: 72, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.11)' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 18.5, fontWeight: 500, letterSpacing: '0.14em', color: '#B8B6C6', flex: 1 }}>MONEY MOVER</span>
          {/* Close and Log group */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={handleCloseAndLog}
          >
            <img src="/assets/check/check-h140.png" height={56} style={{ height: 56, width: 'auto' }} alt="" />
            <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 500, letterSpacing: '0.14em', color: staged ? '#EFEEF4' : '#B8B6C6' }}>CLOSE AND LOG</span>
          </div>
          {/* Divider */}
          <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.14)', margin: '0 20px' }} />
          {/* ESC button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }} onClick={onClose}>
            <span style={{ fontFamily: FONT_DISP, fontSize: 22, color: '#8E8CA0' }}>×</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.14em', color: '#8E8CA0' }}>ESC</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', padding: '0 20px', minHeight: 0 }}>
          {/* Left column */}
          <div style={{ width: 600, flexShrink: 0, padding: '22px 0', display: 'flex', flexDirection: 'column' }}>
            {/* Eyebrow */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', color: '#A78BFA' }}>LIVE</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', color: '#8E8CA0' }}>HOME · MONEY MOVERS</span>
            </div>
            <div style={{ height: 16 }} />
            {/* Title */}
            <div style={{ fontFamily: FONT_DISP, fontSize: 32, fontWeight: 500, color: '#EFEEF4', paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
              {mm.title}
            </div>
            <div style={{ height: 18 }} />
            {/* Deal row */}
            <div style={{ height: 65, flex: 'none', background: '#1E1D26', borderRadius: 12, padding: '0 16px', display: 'flex', alignItems: 'center' }}>
              {deal ? (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', color: '#8E8CA0' }}>DEAL</div>
                    <div style={{ height: 7 }} />
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, overflow: 'hidden' }}>
                      <span style={{ fontFamily: FONT_DISP, fontSize: 17, fontWeight: 500, color: '#EFEEF4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {deal.name ?? deal.addr_display ?? deal.addr_street_name ?? 'Deal'}
                      </span>
                      {(clientName || deal.addr_display) && (
                        <span style={{ fontFamily: FONT_DISP, fontSize: 13, color: '#8E8CA0', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {[clientName].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid rgba(139,92,246,0.45)', background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => window.open('/warroom/deal/?id=' + mm.deal_id, '_self')}
                  >
                    <span style={{ fontFamily: FONT_DISP, fontSize: 16, color: '#A78BFA' }}>↗</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: FONT_DISP, fontSize: 17, color: '#A78BFA' }}>+</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500, letterSpacing: '0.14em', color: '#A78BFA' }}>LINK A DEAL</span>
                  </div>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontFamily: FONT_DISP, fontSize: 13, color: '#8E8CA0' }}>Optional.</span>
                </>
              )}
            </div>
            <div style={{ height: 18 }} />
            {/* Figure pair */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.10)', padding: '16px 0', display: 'flex', gap: 40 }}>
              {mm.deal_id ? (
                <>
                  <div style={{ width: 210, flexShrink: 0 }}>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.14em', color: '#8E8CA0' }}>VALUE</div>
                    <div style={{ height: 9 }} />
                    <div style={{ fontFamily: FONT_MONO, fontSize: 26, lineHeight: 1.04, color: '#EFEEF4', fontVariantNumeric: 'tabular-nums' }}>{fmtFigure(mm._dealValue)}</div>
                    <div style={{ height: 7 }} />
                    <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '0.12em', color: '#8E8CA0' }}>INHERITED FROM THE DEAL</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.14em', color: '#8E8CA0' }}>COMM</div>
                    <div style={{ height: 9 }} />
                    <div style={{ fontFamily: FONT_MONO, fontSize: 26, lineHeight: 1.04, color: '#34D399', fontVariantNumeric: 'tabular-nums' }}>{fmtFigure(mm._commission)}</div>
                    <div style={{ height: 7 }} />
                    <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '0.12em', color: '#8E8CA0' }}>{commProvenance}</div>
                  </div>
                </>
              ) : (
                <div style={{ width: 210, flexShrink: 0 }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.14em', color: '#8E8CA0' }}>COMM</div>
                  <div style={{ height: 9 }} />
                  <div style={{ fontFamily: FONT_MONO, fontSize: 26, lineHeight: 1.04, color: '#34D399', fontVariantNumeric: 'tabular-nums' }}>{fmtFigure(mm._commission)}</div>
                  <div style={{ height: 7 }} />
                  <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '0.12em', color: '#8E8CA0' }}>TYPED ON THIS RECORD</div>
                </div>
              )}
            </div>
            {/* NEXT row */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.10)', paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.14em', color: '#8E8CA0' }}>NEXT</span>
                {mm.note && mm.note_typed_at && (
                  <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '0.12em', color: '#8E8CA0' }}>
                    TYPED {fmtNoteTimestamp(mm.note_typed_at)}
                  </span>
                )}
              </div>
              <div style={{ height: 12 }} />
              {mm.note ? (
                <div style={{ fontFamily: FONT_DISP, fontSize: 16.5, lineHeight: 1.3, color: '#B8B6C6', paddingBottom: 9, borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
                  {mm.note}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 9, borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
                  <span style={{ fontFamily: FONT_DISP, fontSize: 16.5, color: '#A78BFA' }}>+</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: '0.14em', color: '#A78BFA' }}>SET THE NEXT ACTION</span>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 20, display: 'flex', justifyContent: 'center', paddingTop: 22, paddingBottom: 22 }}>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.11)' }} />
          </div>

          {/* Right rail */}
          <div style={{ width: 300, flexShrink: 0, padding: '22px 0', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.14em', color: '#8E8CA0', flexShrink: 0 }}>NOTES</div>
            <div style={{ height: 14 }} />
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {mm.note && mm.note_typed_at ? (
                <>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '0.12em', color: '#8E8CA0' }}>{fmtNoteTimestamp(mm.note_typed_at)}</div>
                  <div style={{ height: 7 }} />
                  <div style={{ fontFamily: FONT_DISP, fontSize: 13.5, lineHeight: 1.45, color: '#B8B6C6' }}>{mm.note}</div>
                </>
              ) : (
                <span style={{ fontFamily: FONT_DISP, fontSize: 13.5, lineHeight: 1.45, color: '#8E8CA0' }}>No notes yet</span>
              )}
            </div>
            <div style={{ height: 14, flexShrink: 0 }} />
            {/* Composer */}
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Add a note…"
              style={{
                flex: 'none',
                height: 78,
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 10,
                padding: '12px 14px',
                fontFamily: FONT_DISP,
                fontSize: 13.5,
                lineHeight: 1.4,
                color: '#8E8CA0',
                background: 'transparent',
                resize: 'none',
                outline: 'none',
                boxSizing: 'border-box',
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ height: 72, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 20px', borderTop: '1px solid rgba(255,255,255,0.11)' }}>
          <div style={{ flex: 1 }}>
            {mm.note_typed_at && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: '0.14em', color: '#8E8CA0' }}>
                {fmtFooterTimestamp()}
              </span>
            )}
          </div>
          {staged ? (
            <img
              src="/assets/confirm/confirm-h180.png"
              height={60}
              style={{ height: 60, width: 'auto', cursor: 'pointer' }}
              alt="Confirm"
              onClick={handleConfirm}
            />
          ) : (
            <div style={{ border: '1px solid rgba(255,255,255,0.18)', borderRadius: 30, width: 148.3, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500, letterSpacing: '0.16em', color: '#8E8CA0' }}>CONFIRM</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MoneyMoversPanel({ refreshKey, visibleRows, onCountChange, panelHeight, onCreateFill }: { refreshKey: number; visibleRows: number; onCountChange?: (n: number) => void; panelHeight?: number; onCreateFill?: () => void }) {
  const [mmRows, setMmRows] = useState<MoneyMoverRow[]>([])
  const [econMap, setEconMap] = useState<Record<string, DealEconomics>>({})
  const [dealMap, setDealMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [selectedMM, setSelectedMM] = useState<(MoneyMoverRow & { _commission: number | null; _dealValue: number | null }) | null>(null)

  async function loadData() {
    // Try with note columns first (D4.2d); if columns don't exist yet degrade gracefully
    let mmData: any[] | null = null
    const { data: mmDataFull, error: mmErrFull } = await supabase
      .from('money_movers')
      .select('id, title, deal_id, commission, note, note_typed_at')
      .order('created_at', { ascending: false })
      .limit(30)
    if (!mmErrFull) {
      mmData = mmDataFull
    } else {
      // Columns not yet migrated — fall back to base columns
      const { data: mmDataBase } = await supabase
        .from('money_movers')
        .select('id, title, deal_id, commission')
        .order('created_at', { ascending: false })
        .limit(30)
      mmData = mmDataBase
    }
    const rows = (mmData ?? []) as MoneyMoverRow[]
    setMmRows(rows)
    onCountChange?.(rows.length)

    const dealIds = rows.map(r => r.deal_id).filter((id): id is string => id != null)
    if (dealIds.length > 0) {
      const { data: econData } = await supabase
        .from('deal_economics')
        .select('deal_id, transaction_type, asking_price, sale_commission_pct, sqft, lease_rate_psf, lease_term_years, lease_commission_pct')
        .in('deal_id', dealIds)
      const map: Record<string, DealEconomics> = {}
      ;(econData ?? []).forEach((e: any) => { map[e.deal_id] = e as DealEconomics })
      setEconMap(map)

      const { data: dealDetails } = await supabase
        .from('deals')
        .select('id, name, addr_display, addr_street_name, addr_number, deal_contacts(contacts(name))')
        .in('id', dealIds)
      const dmap: Record<string, any> = {}
      ;(dealDetails ?? []).forEach((d: any) => { dmap[d.id] = d })
      setDealMap(dmap)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadData().finally(() => setLoading(false))
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const enriched = mmRows.map(mm => {
    const econ = mm.deal_id ? (econMap[mm.deal_id] ?? null) : null
    const commission = econ ? calcCommission(econ) : null
    // Operator-typed value wins; otherwise compute from economics
    let dealValue: number | null = mm.commission ?? null
    if (dealValue == null && econ) {
      if ((econ.transaction_type === 'sale' || econ.transaction_type === 'both') && econ.asking_price) {
        dealValue = econ.asking_price
      } else if (econ.transaction_type === 'lease') {
        dealValue = calcLeaseValue(econ.sqft ?? null, econ.lease_rate_psf ?? null, econ.lease_term_years ?? null)
      }
    }
    return { ...mm, _commission: commission, _dealValue: dealValue }
  })

  const headerTotal = enriched.reduce((s, d) => s + (d._commission ?? 0), 0)
  const mmCount = enriched.length

  // D4.4 item 7: terminal row replaces last visible row
  const effectiveVisible = visibleRows > 0 ? visibleRows : enriched.length
  const displayRows = enriched.length > effectiveVisible
    ? enriched.slice(0, Math.max(0, effectiveVisible - 1))
    : enriched
  const moreCount = enriched.length - displayRows.length

  const h = panelHeight ? panelHeight : undefined

  return (
    <>
    <Panel style={{ flexShrink: 0, height: h }}>
      <PanelHeader
        glyph={G.moneyMovers}
        label="MONEY MOVERS"
        statusCount={mmCount > 0 ? `${mmCount} ITEMS` : undefined}
        statusColor={C.textLow}
        totalCount={headerTotal > 0 ? `$${Math.round(headerTotal / 1000)}K TOTAL STAKE` : undefined}
        minHeight={55}
        fab={<Fab label="Add money mover" aria-label="Add money mover" onClick={() => onCreateFill?.()} />}
      />

      {/* Column header */}
      <div style={{
        display: 'flex',
        padding: '7px 14px',
        borderBottom: `1px solid ${C.borderPanel}`,
        flexShrink: 0,
      }}>
        <span style={{ ...DT8, color: C.textLow, flex: 1 }}>ITEM</span>
        <span style={{ ...DT8, color: C.textLow, width: 210 }}>NOTE</span>
        <span style={{ ...DT8, color: C.textLow, width: 78, textAlign: 'right' }}>VALUE</span>
        <span style={{ ...DT8, color: C.textLow, width: 70, textAlign: 'right' }}>COMM</span>
      </div>
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
        {loading ? (
          <div style={{ ...DS6, color: C.textLow, padding: '12px 14px' }}>Loading…</div>
        ) : displayRows.length === 0 && moreCount === 0 ? (
          <div style={{ ...DS6, color: C.textLow, padding: '12px 14px' }}>No money movers.</div>
        ) : (
          <>
            {displayRows.map((mm, i) => (
              <React.Fragment key={mm.id}>
                <div
                  onClick={() => setSelectedMM(mm)}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.045)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ''}
                  style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', minHeight: MM_ROW_H, boxSizing: 'border-box', cursor: 'pointer' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...DS3, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mm.title}
                    </div>
                  </div>
                  {(() => {
                    const noteExpired = mm.note_typed_at ? (Date.now() - new Date(mm.note_typed_at).getTime()) > 7 * 86400000 : true
                    const noteText = (!noteExpired && mm.note) ? mm.note : ''
                    const valStr = mm._dealValue != null ? ('$' + Math.abs(mm._dealValue).toLocaleString('en-US', { maximumFractionDigits: 0 })) : ''
                    const commStr = mm._commission != null ? ('$' + Math.abs(mm._commission).toLocaleString('en-US', { maximumFractionDigits: 0 })) : ''
                    return (
                      <>
                        <div style={{ width: 210, flexShrink: 0, ...DS6, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{noteText}</div>
                        <div style={{ ...DM1, color: C.textHi, width: 78, textAlign: 'right', flexShrink: 0 }}>{valStr}</div>
                        <div style={{ ...DM1, color: C.moneyIn, width: 70, textAlign: 'right', flexShrink: 0 }}>{commStr}</div>
                      </>
                    )
                  })()}
                </div>
                {i < displayRows.length - 1 && <Hair />}
              </React.Fragment>
            ))}
            {moreCount > 0 && (
              <div style={{ ...DS7, color: C.textLow, padding: '8px 14px' }}>+ {moreCount} MORE</div>
            )}
          </>
        )}
      </div>
    </Panel>
    {selectedMM && (
      <MoneyMoverModal
        mm={selectedMM}
        dealMap={dealMap}
        econMap={econMap}
        onClose={() => setSelectedMM(null)}
        onCloseAndLog={(mmId) => {
          setMmRows(prev => prev.filter(r => r.id !== mmId))
          setSelectedMM(null)
        }}
        onNoteAdded={(mmId, note) => {
          setMmRows(prev => prev.map(r => r.id === mmId ? {...r, note, note_typed_at: new Date().toISOString()} : r))
        }}
      />
    )}
    </>
  )
}

// ── UNDER CONTRACT ────────────────────────────────────────────────────────────
// D4.4: No UC_DISPLAY_LIMIT — allocation drives visible rows.
// Header = 41px (no create control)
// rowHeight = 52px
const UC_HEADER = 41
const UC_ROW_H  = 52

interface DealWithClosing extends Deal {
  _closingDate?: string | null
}

function UnderContractPanel({ refreshKey, visibleRows, onCountChange, panelHeight }: { refreshKey: number; visibleRows: number; onCountChange?: (n: number) => void; panelHeight?: number }) {
  const [deals, setDeals] = useState<DealWithClosing[]>([])
  const [econMap, setEconMap] = useState<Record<string, DealEconomics>>({})
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
      const rows = (data ?? []) as unknown as Deal[]

      // Check 35: fetch closing deadlines for each deal
      let withClosing: DealWithClosing[] = rows.map(d => ({ ...d, _closingDate: null }))
      if (rows.length > 0) {
        const ids = rows.map(d => d.id)
        const { data: cdData } = await supabase
          .from('contract_deadlines')
          .select('deal_id, deadline_date')
          .in('deal_id', ids)
          .eq('deadline_type', 'closing')
          .in('status', ['pending', 'extended'])
          .order('deadline_date', { ascending: true })
        const closingMap: Record<string, string> = {}
        ;(cdData ?? []).forEach((cd: any) => {
          if (!closingMap[cd.deal_id]) closingMap[cd.deal_id] = cd.deadline_date
        })
        withClosing = rows.map(d => ({ ...d, _closingDate: closingMap[d.id] ?? null }))

        // Check 35: fetch deal_economics for VALUE and COMMISSION columns
        const { data: econData } = await supabase
          .from('deal_economics')
          .select('deal_id, transaction_type, asking_price, sale_commission_pct, sqft, lease_rate_psf, lease_term_years, lease_commission_pct, listing_rate, co_broker_on, co_broker_split')
          .in('deal_id', ids)
        const map: Record<string, DealEconomics> = {}
        ;(econData ?? []).forEach((e: any) => { map[e.deal_id] = e as DealEconomics })
        setEconMap(map)
      }

      setDeals(withClosing)
      // Check 30: report real count
      onCountChange?.(rows.length)
      setLoading(false)
    }
    load()
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // D4.4 item 7: terminal row replaces last visible row
  const effectiveVisible = visibleRows > 0 ? visibleRows : deals.length
  const displayDeals = deals.length > effectiveVisible
    ? deals.slice(0, Math.max(0, effectiveVisible - 1))
    : deals
  const moreCount = deals.length - displayDeals.length

  // Check 36: earliest upcoming closing date for header
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const nextClosing = deals
    .map(d => d._closingDate)
    .filter((d): d is string => !!d && d >= today)
    .sort()[0] ?? null

  const headerRight = nextClosing
    ? `CLOSES ${fmtDate(nextClosing).toUpperCase()}`
    : String(deals.length)

  const ucH = panelHeight ? panelHeight : undefined

  return (
    <Panel style={{ flexShrink: 0, height: ucH }}>
      {/* Check 36: show next closing in header */}
      <PanelHeader
        glyph={G.underContract}
        label="UNDER CONTRACT"
        statusCount={deals.length > 0 ? String(deals.length) : undefined}
        statusColor={C.textLow}
        totalCount={nextClosing ? headerRight : undefined}
      />
      {/* Check 35: column headers */}
      <div style={{ display: 'flex', padding: '7px 14px', borderBottom: `1px solid ${C.borderPanel}`, flexShrink: 0 }}>
        <span style={{ ...DT8, color: C.textLow, flex: 1 }}>ADDRESS</span>
        <span style={{ ...DT8, color: C.textLow, width: 78, textAlign: 'right' }}>VALUE</span>
        <span style={{ ...DT8, color: C.textLow, width: 70, textAlign: 'right' }}>COMM</span>
      </div>
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
        {loading ? (
          <div style={{ ...DS6, color: C.textLow, padding: '12px 14px' }}>Loading…</div>
        ) : displayDeals.length === 0 && moreCount === 0 ? (
          <div style={{ ...DS6, color: C.textLow, padding: '12px 14px' }}>No deals under contract.</div>
        ) : (
          <>
            {displayDeals.map((d, i) => {
              // Check 49: null name → blank
              const name = d.deal_contacts?.[0]?.contacts?.name ?? ''
              // Check 35: closing date subline
              const closingStr = d._closingDate ? `closes ${fmtDate(d._closingDate)}` : null
              const subline = name || closingStr ? [name, closingStr].filter(Boolean).join(' · ') : ''
              // Check 35: economics columns
              const econ = econMap[d.id] ?? null
              const commission = calcCommission(econ)
              let dealValue: number | null = null
              if (econ) {
                if ((econ.transaction_type === 'sale' || econ.transaction_type === 'both') && econ.asking_price) {
                  dealValue = econ.asking_price
                } else if (econ.transaction_type === 'lease') {
                  dealValue = calcLeaseValue(econ.sqft ?? null, econ.lease_rate_psf ?? null, econ.lease_term_years ?? null)
                }
              }
              return (
                <React.Fragment key={d.id}>
                  {/* Check 63: whole row clickable → deal page */}
                  <div
                    onClick={() => router.push('/warroom/deal/?id=' + d.id)}
                    style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', minHeight: UC_ROW_H, boxSizing: 'border-box', cursor: 'pointer' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...DS3, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {shortAddr(d)}
                      </div>
                      {subline && <div style={{ ...DS7, color: C.textLow }}>{subline}</div>}
                    </div>
                    {/* Check 35: VALUE and COMMISSION columns (Check 62: LANDED pill removed) */}
                    <div style={{ ...DM1, color: C.textHi, width: 78, textAlign: 'right', flexShrink: 0 }}>
                      {fmtMoney(dealValue)}
                    </div>
                    <div style={{ ...DM1, color: C.moneyIn, width: 70, textAlign: 'right', flexShrink: 0 }}>
                      {fmtMoney(commission)}
                    </div>
                  </div>
                  {i < displayDeals.length - 1 && <Hair />}
                </React.Fragment>
              )
            })}
            {/* D4.4 item 7: terminal row — arrow navigates to /warroom/deals?filter=uc */}
            {moreCount > 0 && (
              <div
                onClick={() => router.push('/warroom/deals?filter=uc')}
                style={{ ...DS7, color: C.textLow, padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                + {moreCount} MORE
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}

// ── NEXT 48 HERO (D3.3b) — 60px strip, full content width ─────────────────────
type HeroItem = {
  id: string
  kind: 'event' | 'task' | 'deadline'
  date: string
  time: string | null
  title: string
  property: string
  spineColor: string
  tintColor: string
  deal_id: string | null
  href: string | null
}

function fmtHeroGutter(dateStr: string, timeStr: string | null): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const day = ['SUN','MON','TUE','WED','THU','FRI','SAT'][dt.getDay()]
  if (!timeStr) return `${day} ${d} · —`
  const [h, min] = timeStr.split(':').map(Number)
  const h12 = h % 12 || 12
  const ampm = h >= 12 ? 'P' : 'A'
  return `${day} ${d} · ${h12}:${String(min).padStart(2,'0')}${ampm}`
}

function HeroNext48({ refreshKey, onHeroDeadlineId }: { refreshKey: number; onHeroDeadlineId?: (id: string | null) => void }) {
  const router = useRouter()
  const [hero, setHero] = useState<HeroItem | null>(null)
  const [windowCount, setWindowCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
      const d2 = new Date(new Date(todayStr).getTime() + 86400000 * 2).toISOString().slice(0, 10)

      const [evRes, taskRes, dlRes] = await Promise.all([
        supabase.from('schedule_events').select('id, title, date, time, location, deal_id').lte('date', d2).gte('date', todayStr).order('date').order('time'),
        supabase.from('tasks').select('id, title, due_date, deal_id, deals(name, addr_display)').eq('status','open').is('deleted_at',null).lte('due_date', d2).order('due_date').limit(30),
        supabase.from('contract_deadlines').select('id, label, deadline_type, deadline_date, deal_id, deals(name, addr_display)').in('status',['pending','extended']).lte('deadline_date', d2).order('deadline_date').limit(30),
      ])

      const seen = new Set<string>()
      const items: HeroItem[] = []
      const todayNow = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

      // Events first (they win dedup)
      for (const e of (evRes.data ?? []) as any[]) {
        const key = `${e.deal_id ?? e.id}_${e.date}`
        seen.add(key)
        items.push({ id: e.id, kind: 'event', date: e.date, time: e.time, title: e.title, property: e.location ?? '', spineColor: C.brand, tintColor: 'rgba(139,92,246,0.05)', deal_id: e.deal_id, href: e.deal_id ? `/warroom/deal/?id=${e.deal_id}` : null })
      }
      // Tasks
      for (const t of (taskRes.data ?? []) as any[]) {
        if (!t.due_date) continue
        const key = `task_${t.id}_${t.due_date}`
        if (seen.has(key)) continue
        seen.add(key)
        const prop = (t as any).deals?.addr_display ?? (t as any).deals?.name ?? ''
        items.push({ id: t.id, kind: 'task', date: t.due_date, time: null, title: t.title, property: prop, spineColor: C.late, tintColor: 'rgba(255,77,77,0.05)', deal_id: t.deal_id, href: t.deal_id ? `/warroom/deal/?id=${t.deal_id}` : null })
      }
      // Deadlines (skip if event already deduped)
      for (const dl of (dlRes.data ?? []) as any[]) {
        const key = `${dl.deal_id ?? dl.id}_${dl.deadline_date}`
        if (seen.has(key)) continue
        seen.add(key)
        const prop = (dl as any).deals?.addr_display ?? (dl as any).deals?.name ?? ''
        items.push({ id: dl.id, kind: 'deadline', date: dl.deadline_date, time: null, title: dl.label ?? dl.deadline_type ?? 'Deadline', property: prop, spineColor: C.hot, tintColor: 'rgba(255,162,58,0.05)', deal_id: dl.deal_id, href: dl.deal_id ? `/warroom/deal/?id=${dl.deal_id}` : null })
      }

      // Sort: overdue first, then ascending date
      items.sort((a, b) => {
        const aOverdue = a.date < todayNow
        const bOverdue = b.date < todayNow
        if (aOverdue && !bOverdue) return -1
        if (!aOverdue && bOverdue) return 1
        return a.date.localeCompare(b.date)
      })

      const first = items[0] ?? null
      setHero(first)
      setWindowCount(Math.max(0, items.length - 1))
      onHeroDeadlineId?.(first?.kind === 'deadline' ? first.id : null)
      setLoading(false)
    }
    load()
  }, [refreshKey]) // eslint-disable-line

  const spineColor = hero ? hero.spineColor : C.muted
  const tintBg = hero ? `linear-gradient(to right, ${hero.tintColor}, transparent 40%)` : 'none'

  return (
    <div
      onClick={() => { if (hero?.href) router.push(hero.href) }}
      style={{
        flexShrink: 0,
        height: 60,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        borderRadius: 14,
        border: `1px solid ${C.border}`,
        background: C.bgPanel,
        boxSizing: 'border-box',
        padding: '0 24px 0 27px',
        cursor: hero?.href ? 'pointer' : 'default',
        overflow: 'hidden',
      }}
    >
      {/* Tint wash */}
      {hero && <div style={{ position: 'absolute', inset: 0, background: tintBg, pointerEvents: 'none', borderRadius: 14 }} />}
      {/* Spine */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: spineColor, borderRadius: '14px 0 0 14px' }} />

      {/* Gutter — 104px */}
      <div style={{ width: 104, flexShrink: 0, fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500, color: hero ? hero.spineColor : C.muted, whiteSpace: 'nowrap', position: 'relative', zIndex: 1 }}>
        {!loading && hero ? fmtHeroGutter(hero.date, hero.time) : ''}
      </div>

      {/* Center */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        {loading ? null : hero ? (
          <>
            <div style={{ fontFamily: FONT_DISP, fontSize: 21, fontWeight: 500, color: C.textHi, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.15 }}>{hero.title}</div>
            {hero.property && <div style={{ fontSize: 15, fontWeight: 400, color: C.textLow, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>{hero.property}</div>}
          </>
        ) : (
          <div style={{ fontFamily: FONT_DISP, fontSize: 21, fontWeight: 500, color: C.textLow, letterSpacing: '-0.01em' }}>NOTHING IN THE NEXT 48</div>
        )}
      </div>

      {/* Right group */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1, marginLeft: 16 }}>
        {hero && !loading && (
          <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: '0.16em', color: C.textLow, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
            {windowCount > 0 ? `+${windowCount} MORE IN 48H` : 'NOTHING ELSE IN 48H'}
          </span>
        )}
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.14)' }} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: '0.16em', color: C.textLow }}>NEXT 48</span>
      </div>
    </div>
  )
}

// ── SCHEDULE ──────────────────────────────────────────────────────────────────
// D4.4: Header = 41px (no create control yet per D4.3 note)
// rowHeight = 36px (time gutter row)
const SCHED_HEADER = 55  // Check 28: 41→55 for FAB
const SCHED_ROW_H  = 36

function SchedulePanel({ refreshKey, panelHeight, visibleRows, onCountChange, onCreateFill }: { refreshKey: number; panelHeight?: number; visibleRows: number; onCountChange?: (n: number) => void; onCreateFill?: () => void }) {
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)

  async function loadEvents() {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
    const d1 = new Date(new Date(todayStr).getTime() + 86400000).toISOString().slice(0, 10)
    const { data } = await supabase
      .from('schedule_events')
      .select('id, title, date, time, location')
      .gte('date', todayStr)
      .lte('date', d1)
      .order('date').order('time')
      .limit(30)
    const rows = (data ?? []) as ScheduleEvent[]
    setEvents(rows)
    onCountChange?.(rows.length)
  }

  useEffect(() => {
    setLoading(true)
    loadEvents().finally(() => setLoading(false))
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* Check 28: SCHEDULE header with FAB, 55px */}
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
        <span style={{ color: C.brandLift, flexShrink: 0 }}>{G.schedule}</span>
        <span style={{ ...DT1, color: C.textMid }}>SCHEDULE</span>
        <div style={{ flex: 1, height: 1, background: C.borderPanel }} />
        <span style={{ ...DT5, color: C.textLow }}>{events.length}</span>
        <div className="wr-fab-desktop-wrap" style={{ flexShrink: 0 }}>
          <Fab label="Add event" onClick={() => onCreateFill?.()} />
        </div>
      </div>

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
              <div style={{ ...DS7, color: C.textLow, padding: '8px 14px' }}>+ {moreCount} MORE</div>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}

// ── DEADLINES (Check 46: renamed from DUE everywhere) ────────────────────────
// Past-due rows: "N D LATE" with late spine.
// Forward rows: "N D · MMM D" format.
// Check 29: Header = 55px (has FAB create control), rowHeight = 44px
const DUE_HEADER = 55  // Check 29: 41→55 for FAB
const DUE_ROW_H  = 44

interface DeadlineRow {
  id: string
  title: string
  due_date: string
  kind: string
  deal_id?: string | null
  deals?: { name: string; address: string | null; addr_display: string | null; addr_street_name: string | null; addr_number: string | null; addr_city: string | null } | null
}

function DuePanel({ refreshKey, panelHeight, visibleRows, onCountChange, onCreateFill, heroDeadlineId }: { refreshKey: number; panelHeight?: number; visibleRows: number; onCountChange?: (n: number) => void; onCreateFill?: () => void; heroDeadlineId?: string | null }) {
  const [deadlines, setDeadlines] = useState<DeadlineRow[]>([])
  const [loading, setLoading] = useState(true)

  async function loadDeadlines() {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
    const cutoff = new Date(new Date(todayStr).getTime() + 86400000 * 45).toISOString().slice(0, 10)
    const [{ data: pastDue }, { data: forward }] = await Promise.all([
      supabase
        .from('contract_deadlines')
        .select('id, label, deadline_date, deadline_type, status, deal_id, deals(addr_display, name)')
        .in('status', ['pending', 'extended'])
        .lt('deadline_date', todayStr)
        .order('deadline_date', { ascending: true })
        .limit(10),
      supabase
        .from('contract_deadlines')
        .select('id, label, deadline_date, deadline_type, status, deal_id, deals(addr_display, name)')
        .in('status', ['pending', 'extended'])
        .gte('deadline_date', todayStr)
        .lte('deadline_date', cutoff)
        .order('deadline_date', { ascending: true })
        .limit(30),
    ])
    const combined = [...(pastDue ?? []), ...(forward ?? [])]
    const rows: DeadlineRow[] = combined.map((t: any) => ({
      ...t,
      title: t.label ?? t.deadline_type ?? 'Deadline',
      due_date: t.deadline_date,
      kind: t.deadline_type ?? 'DEADLINE',
    }))
    setDeadlines(rows)
    onCountChange?.(rows.length)
  }

  useEffect(() => {
    setLoading(true)
    loadDeadlines().finally(() => setLoading(false))
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const pastDue = deadlines.filter(d => d.due_date < todayStr)
  const pastDueCount = pastDue.length

  // Check 14: terminal row IS the last slot — slice to effectiveVisible-1 data rows when overflow
  const effectiveVisible = visibleRows > 0 ? visibleRows : deadlines.length
  const displayDeadlines = deadlines.length > effectiveVisible
    ? deadlines.slice(0, Math.max(0, effectiveVisible - 1))
    : deadlines
  const moreCount = deadlines.length - displayDeadlines.length

  const h = panelHeight ? panelHeight : undefined

  return (
    <Panel style={{ flexShrink: 0, height: h }}>
      {/* Check 46: DEADLINES. Check 29: FAB, 55px header */}
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
        <span style={{ color: C.brandLift, flexShrink: 0 }}>{G.deadlines}</span>
        <span style={{ ...DT1, color: C.textMid }}>DEADLINES</span>
        {pastDueCount > 0 && <span style={{ ...DT5, color: C.late }}>{pastDueCount} PAST DUE</span>}
        <div style={{ flex: 1, height: 1, background: C.borderPanel }} />
        <span style={{ ...DT5, color: C.textLow }}>{deadlines.length}</span>
        <div className="wr-fab-desktop-wrap" style={{ flexShrink: 0 }}>
          <Fab label="Add deadline" onClick={() => onCreateFill?.()} />
        </div>
      </div>

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
              const isFirstFuture = !isPast && (i === 0 || deadlines.slice(0, i).every(x => daysBetween(x.due_date) < 0))
              const isHero = heroDeadlineId != null && d.id === heroDeadlineId

              return (
                <React.Fragment key={d.id}>
                  {/* Check 37: title first, property beneath, kind label right-aligned */}
                  <div style={{
                    display: 'flex',
                    gap: 8,
                    padding: '9px 14px',
                    minHeight: DUE_ROW_H,
                    boxSizing: 'border-box',
                    background: !isHero && isFirstFuture && !isPast ? `rgba(255,163,58,0.05)` : 'transparent',
                    borderLeft: isHero ? '3px solid transparent' : isPast ? `3px solid ${C.late}` : isFirstFuture ? `3px solid ${C.hot}` : '3px solid transparent',
                    alignItems: 'flex-start',
                  }}>
                    {/* Days gutter */}
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
                    {/* Content: title + property line */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...DS3, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                      {d.deals && <div style={{ ...DS7, color: C.textLow }}>{d.deals.addr_display ?? d.deals.addr_street_name ?? d.deals.name}</div>}
                    </div>
                    {/* Check 37: kind right-aligned */}
                    <div style={{ ...DT7 as React.CSSProperties, color: C.textLow, flexShrink: 0, textAlign: 'right', minWidth: 60 }}>{(d.kind || '').toUpperCase()}</div>
                  </div>
                  {i < displayDeadlines.length - 1 && <Hair />}
                </React.Fragment>
              )
            })}
            {/* Check 14: terminal IS the last slot */}
            {moreCount > 0 && (
              <div style={{ ...DS7, color: C.textLow, padding: '8px 14px' }}>+ {moreCount} MORE DEADLINES</div>
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

  // Check 1: reduce padding to 10px top/bottom and gap to 5 to fix scrollH overflow within 130px box
  return (
    <div style={{
      flexShrink: 0,
      height: RECV_HEIGHT,
      boxSizing: 'border-box',
      borderRadius: 14,
      overflow: 'hidden',
      border: `1px solid ${C.border}`,
      background: 'linear-gradient(155deg, rgba(52,211,153,0.09), rgba(139,92,246,0.05))',
      padding: '10px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
    }}>
      {/* Panel header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ color: C.brandLift }}>{G.receivables}</span>
        <span style={{ ...DT1, color: C.textMid }}>RECEIVABLES</span>
      </div>
      {/* D4.3: two DM0 figures on one row — collected left (money-in), outstanding right (brand-lift) */}
      {/* Check 1 close: fontSize reduced 34.5→28px to clear 3px scrollH overflow within 130px cap */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexShrink: 0 }}>
        <div style={{ ...DM0, fontSize: 28, color: C.moneyIn, textShadow: 'none' }}>
          {loading ? '—' : fmtMoney(collected)}
        </div>
        <div style={{ ...DM0, fontSize: 28, color: C.brandLift, textShadow: 'none' }}>
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

// ── LEFT RAIL ──────────────────────────────────────────────────────────────────────────────
// Rail SVG glyphs (inner content only; wrapped in <svg> below via dangerouslySetInnerHTML)
const RAIL_HOME_SVG = `<rect x="3" y="3" width="7.5" height="18"/><rect x="13.5" y="3" width="7.5" height="8"/><rect x="13.5" y="14" width="7.5" height="7"/>`
const RAIL_DEALS_SVG = `<rect x="3.5" y="4" width="17" height="10" rx="1.5"/><path d="M12 14v7M7 7.8h6M7 10.8h9"/>`
const RAIL_SCHED_SVG = `<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17"/><rect x="7" y="12.6" width="4" height="4" fill="currentColor" stroke="none"/>`
const RAIL_DEADLINES_SVG = `<path d="M6 20.8V3.6"/><path d="M6 4.4h10.4l-1.7 4.1 1.7 4.1H6"/>`
const RAIL_MONEY_SVG = `<rect x="2.6" y="6.4" width="18.8" height="11.2" rx="2.2"/><circle cx="12" cy="12" r="3"/>`
const RAIL_PORTF_SVG = `<path d="M12 2.8 21 7.4l-9 4.6-9-4.6z"/><path d="M3 12.2 12 16.8l9-4.6"/><path d="M3 16.8 12 21.4l9-4.6"/>`
const RAIL_ENTITY_SVG = `<rect x="3.6" y="3.2" width="10.2" height="17.6" rx="1.6"/><path d="M13.8 11.2h6.6v9.6h-6.6"/><path d="M6.6 7v1.8M11 7v1.8M6.6 11.1v1.8M11 11.1v1.8M6.6 15.2v1.8M11 15.2v1.8"/>`
const RAIL_PEOPLE_SVG = `<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.4 2.7-5.6 6-5.6s6 2.2 6 5.6"/><path d="M16 5.4a3.2 3.2 0 0 1 0 6M17.5 14.9c2.1.6 3.5 2.4 3.5 5.1"/>`
const RAIL_SET_SVG = `<path d="M3.4 8.6h4M13 8.6h7.6M3.4 15.4h7.1M16.1 15.4h4.5"/><circle cx="10.1" cy="8.6" r="2.6"/><circle cx="13.3" cy="15.4" r="2.6"/>`

type RailSlot2 = 'home' | 'deals' | 'sched' | 'deadlines' | 'money' | 'portf' | 'entity' | 'people' | 'set'
// Legacy alias kept for LeftRail prop type
type RailSlot = 'HOME' | 'PEOPLE' | 'DEALS'

function LeftRail({ active }: { active: RailSlot }) {
  const router = useRouter()

  const slots: { id: RailSlot2; label: string; svgInner: string; href: string | null; hasRoute: boolean }[] = [
    { id: 'home',      label: 'HOME',      svgInner: RAIL_HOME_SVG,      href: '/warroom',          hasRoute: true },
    { id: 'deals',     label: 'DEALS',     svgInner: RAIL_DEALS_SVG,     href: '/warroom/deals',    hasRoute: true },
    { id: 'sched',     label: 'SCHED',     svgInner: RAIL_SCHED_SVG,     href: null,                hasRoute: false },
    { id: 'deadlines', label: 'DEADLINES', svgInner: RAIL_DEADLINES_SVG, href: null,                hasRoute: false },
    { id: 'money',     label: 'MONEY',     svgInner: RAIL_MONEY_SVG,     href: null,                hasRoute: false },
    { id: 'portf',     label: 'PORTF',     svgInner: RAIL_PORTF_SVG,     href: null,                hasRoute: false },
    { id: 'entity',    label: 'ENTITY',    svgInner: RAIL_ENTITY_SVG,    href: null,                hasRoute: false },
    { id: 'people',    label: 'PEOPLE',    svgInner: RAIL_PEOPLE_SVG,    href: '/warroom/contacts', hasRoute: true },
  ]
  const setSlot = { id: 'set' as RailSlot2, label: 'SET', svgInner: RAIL_SET_SVG, href: null, hasRoute: false }

  function isSlotActive(slot: typeof slots[0]): boolean {
    if (!slot.hasRoute) return false
    if (slot.id === 'home') return active === 'HOME'
    if (slot.id === 'deals') return active === 'DEALS'
    if (slot.id === 'people') return active === 'PEOPLE'
    return false
  }

  function RailSlotEl({ slot, isSet }: { slot: typeof slots[0] | typeof setSlot; isSet?: boolean }) {
    const act = !isSet && isSlotActive(slot as typeof slots[0])
    const color = act ? C.brandLift : C.textLow
    const inert = !slot.hasRoute

    return (
      <button
        onClick={!inert && slot.href ? () => router.push(slot.href!) : undefined}
        aria-disabled={inert ? 'true' : undefined}
        style={{
          width: 76,
          padding: '13px 0',
          borderRadius: 10,
          border: 'none',
          background: act ? 'rgba(139,92,246,0.14)' : 'transparent',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 7,
          cursor: inert ? 'default' : 'pointer',
          color,
        }}
      >
        <span
          style={{ color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          dangerouslySetInnerHTML={{ __html: `<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${slot.svgInner}</svg>` }}
        />
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color }}>{slot.label}</span>
      </button>
    )
  }

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
      {slots.map(s => <RailSlotEl key={s.id} slot={s} />)}
      <div style={{ flex: 1 }} />
      <RailSlotEl slot={setSlot} isSet />
      <div style={{ height: 16 }} />
    </div>
  )
}


// ── ROOT PAGE ─────────────────────────────────────────────────────────────────
export default function WarRoomPage() {
  const router = useRouter()
  const [mobileRedirecting, setMobileRedirecting] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [drawerTask, setDrawerTask] = useState<Task | null>(null)
  const [createMode, setCreateMode] = useState(false)
  // Check 59: unified create shell fill mode
  const [fillMode, setFillMode] = useState<'task' | 'event' | 'deadline' | 'money_mover' | null>(null)

  // Check 5: container ref for ResizeObserver-computed column widths
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(0)

  // D4.4: Column B ref for elastic allocation
  const colBRef = useRef<HTMLDivElement>(null)
  const [colBHeight, setColBHeight] = useState(0)

  // D4.4: Column C ref for elastic allocation
  const colCRef = useRef<HTMLDivElement>(null)
  const [colCHeight, setColCHeight] = useState(0)

  // Check 30: real record counts from panels (lifted up for elastic allocator)
  const [mmRowCount, setMmRowCount] = useState(5)
  const [ucRowCount, setUcRowCount] = useState(3)
  const [schedRowCount, setSchedRowCount] = useState(4)
  const [dueRowCount, setDueRowCount] = useState(6)
  const [heroDeadlineId, setHeroDeadlineId] = useState<string | null>(null)

  // Item 149: P0 mobile redirect — phones go to /warroom3
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileRedirecting(true)
      router.replace('/warroom3')
    }
  }, [router])

  useEffect(() => {
    const expiry = localStorage.getItem(SESSION_KEY)
    if (expiry && Date.now() < parseInt(expiry)) setUnlocked(true)
  }, [])

  // Check 5: ResizeObserver on the three-column container for runtime column widths
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerW(entry.contentRect.width)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [unlocked])

  const handlePinSuccess = useCallback(() => {
    const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000
    localStorage.setItem(SESSION_KEY, expiry.toString())
    setUnlocked(true)
  }, [])

  // Check 5: Compute column widths from container
  // net = containerW - 2*18 (two outer gaps), A = max(0.30*net, 441), B = (net-A)*(0.39/0.70), C = net-A-B
  const GAP = 18
  const colWidths = (() => {
    if (containerW <= 0) return { A: 441, B: 400, C: 300 }
    const net = containerW - 2 * GAP
    const A = Math.max(0.30 * net, 441)
    const B = (net - A) * (0.39 / 0.70)
    const C = net - A - B
    return { A: Math.round(A), B: Math.round(B), C: Math.round(C) }
  })()

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
  // Check 52: MM_HEADER is now 55 (has FAB). +24 for the ADDRESS/VALUE/COMM column header row.
  const colBPanels: PanelSpec[] = [
    { header: MM_HEADER + 24, rowHeight: MM_ROW_H, rowCount: mmRowCount },
    { header: UC_HEADER + 24, rowHeight: UC_ROW_H, rowCount: ucRowCount },
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

  // Item 149: show blank dark screen while redirecting mobile to /warroom3
  if (mobileRedirecting) {
    return <div style={{ background: '#08080C', minHeight: '100vh' }} />
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
      maxWidth: '100vw',
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
          <HeroNext48 refreshKey={refreshKey} onHeroDeadlineId={setHeroDeadlineId} />

          {/* ── Three-column row — Check 5: widths computed via ResizeObserver ── */}
          <div
            ref={containerRef}
            style={{
              flex: 1,
              display: 'flex',
              gap: 18,
              minHeight: 0,
            }}
          >

            {/* Column A — Check 5: runtime width, floor 441px */}
            <div style={{ width: colWidths.A, flexShrink: 0, boxSizing: 'border-box', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <BattlePlanPanel
                refreshKey={refreshKey}
                onSelectTask={setDrawerTask}
                onCreateTask={() => setCreateMode(true)}
              />
            </div>

            {/* Column B — Check 5: runtime width */}
            <div
              ref={colBRef}
              style={{ width: colWidths.B, flexShrink: 0, boxSizing: 'border-box', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 18 }}
            >
              <MoneyMoversPanel
                refreshKey={refreshKey}
                visibleRows={colBAllocs[0].visibleRows}
                onCountChange={setMmRowCount}
                panelHeight={colBAllocs[0].height}
                onCreateFill={() => setFillMode('money_mover')}
              />
              <UnderContractPanel
                refreshKey={refreshKey}
                visibleRows={colBAllocs[1].visibleRows}
                onCountChange={setUcRowCount}
                panelHeight={colBAllocs[1].height}
              />
            </div>

            {/* Column C — Check 5: runtime width */}
            <div
              ref={colCRef}
              style={{ width: colWidths.C, flexShrink: 0, boxSizing: 'border-box', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 18 }}
            >
              <SchedulePanel
                refreshKey={refreshKey}
                panelHeight={colCAllocs[0].height}
                visibleRows={colCAllocs[0].visibleRows}
                onCountChange={setSchedRowCount}
                onCreateFill={() => setFillMode('event')}
              />
              <DuePanel
                refreshKey={refreshKey}
                panelHeight={colCAllocs[1].height}
                visibleRows={colCAllocs[1].visibleRows}
                onCountChange={setDueRowCount}
                onCreateFill={() => setFillMode('deadline')}
                heroDeadlineId={heroDeadlineId}
              />
              <ReceivablesCard refreshKey={refreshKey} />
            </div>

          </div>
        </div>
      </div>

      {/* D11 — Desktop task modal */}
      {(drawerTask || createMode || fillMode) && (
        <TaskModal
          task={(drawerTask ?? createTask) as any}
          onClose={() => { setDrawerTask(null); setCreateMode(false); setFillMode(null) }}
          onCompleted={() => { setDrawerTask(null); setCreateMode(false); setFillMode(null); setRefreshKey(k => k + 1) }}
          onSaved={() => { setDrawerTask(null); setCreateMode(false); setFillMode(null); setRefreshKey(k => k + 1) }}
          isCreate={createMode && !drawerTask}
          fill={fillMode ?? 'task'}
        />
      )}
    </div>
  )
}

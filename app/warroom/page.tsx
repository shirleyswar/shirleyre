'use client'

/**
 * /warroom — ShirleyCRE Desktop Control Station
 * D9 items 1–6 · 8.15.26 1101
 * Builds against SHIRLEYCRE_DESKTOP_SPEC 8.15.26 1101.md
 *
 * Layout: 100vh, no scroll, rail + identity band + NEXT48 + 3 columns.
 * Type: DS1–DS8 (Space Grotesk), DT1–DT8 (Mono labels), DM0–DM2 (Mono figures).
 * All type lives in desktopTypes.ts — no raw fontSize in this file.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
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
function BattlePlanPanel({ refreshKey, onSelectTask }: { refreshKey: number; onSelectTask?: (t: Task) => void }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('tasks')
        .select('id, title, status, due_date, completed_at, deal_id, deals(name, address)')
        .eq('status', 'open')  // tasks table holds 'open' and 'complete' only — NOT IN (done,cancelled) excluded nothing
        .is('deleted_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(60)
      setTasks((data ?? []) as unknown as Task[])
      setLoading(false)
    }
    load()
  }, [refreshKey])

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

  const groups = {
    overdue:  tasks.filter(t => t.due_date && t.due_date < todayStr),
    today:    tasks.filter(t => t.due_date === todayStr),
    later:    tasks.filter(t => t.due_date && t.due_date > todayStr),
    noDate:   tasks.filter(t => !t.due_date),
  }

  const lateCount = groups.overdue.length
  const totalCount = tasks.length

  function TaskRow({ t, overdue }: { t: Task; overdue?: boolean }) {
    const days = t.due_date ? Math.abs(daysBetween(t.due_date)) : null
    return (
      <div
        onClick={() => onSelectTask?.(t)}
        style={{
          padding: '12px 14px 12px 13px',
          borderRadius: 10,
          marginBottom: 6,
          background: 'rgba(255,255,255,0.025)',
          border: `1px solid ${C.border}`,
          borderLeft: overdue ? `3px solid ${C.late}` : `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
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
        {overdue && days != null && (
          <span style={{ ...DT5, color: C.late, flexShrink: 0, width: 44, textAlign: 'right' }}>
            {days}d
          </span>
        )}
      </div>
    )
  }

  function Group({ label, items, overdue }: { label: string; items: Task[]; overdue?: boolean }) {
    return (
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 4px' }}>
          <span style={{ ...DT7 as React.CSSProperties, color: C.textLow }}>{label}</span>
          <span style={{ ...DT7 as React.CSSProperties, color: C.textLow }}>·</span>
          <span style={{ ...DT7 as React.CSSProperties, color: C.textLow }}>{items.length}</span>
          <div style={{ flex: 1, height: 1, background: C.borderHair }} />
        </div>
        {items.map(t => <TaskRow key={t.id} t={t} overdue={overdue} />)}
      </div>
    )
  }

  return (
    <Panel style={{ flex: 1 }}>
      <PanelHeader
        glyph={G.battlePlan}
        label="BATTLE PLAN"
        statusCount={lateCount > 0 ? `${lateCount} LATE` : undefined}
        statusColor={C.late}
        totalCount={String(totalCount)}
        actionLabel="+ ITEM"
      />
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '8px 14px 14px' }}>
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
    </Panel>
  )
}

// ── MONEY MOVERS ──────────────────────────────────────────────────────────────
function MoneyMoversPanel({ refreshKey }: { refreshKey: number }) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState<number>(0)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('deals')
        .select('id, name, address, addr_display, addr_street_name, addr_number, addr_city, status, commission_estimated, value, deal_contacts(contacts(name))')
        .eq('is_money_mover', true)
        .not('status', 'in', '("closed","expired","dormant","terminated")')
        .limit(10)
      const rows = (data ?? []) as unknown as Deal[]
      setDeals(rows)
      setTotal(rows.reduce((s, d) => s + (d.commission_estimated ?? 0), 0))
      setLoading(false)
    }
    load()
  }, [refreshKey])

  return (
    <div style={{ flexShrink: 0, height: 435, display: 'flex', flexDirection: 'column' }}>
      <Panel style={{ flex: 1 }}>
        <PanelHeader glyph={G.moneyMovers} label="MONEY MOVERS" totalCount={fmt$(total)} />
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
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ ...DS6, color: C.textLow, padding: '12px 14px' }}>Loading…</div>
          ) : deals.length === 0 ? (
            <div style={{ ...DS6, color: C.textLow, padding: '12px 14px' }}>No money movers.</div>
          ) : deals.map((d, i) => (
            <React.Fragment key={d.id}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', minHeight: 44 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...DS3, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {shortAddr(d)}
                  </div>
                  <div style={{ ...DS7, color: C.textLow }}>
                    {clientName(d)} · {d.status.replace(/_/g,' ')}
                  </div>
                </div>
                <div style={{ ...DM1, color: C.textHi, width: 78, textAlign: 'right', flexShrink: 0 }}>
                  {d.value ? fmt$(d.value) : '—'}
                </div>
                <div style={{ ...DM1, color: C.moneyIn, width: 70, textAlign: 'right', flexShrink: 0 }}>
                  {fmt$(d.commission_estimated)}
                </div>
              </div>
              {i < deals.length - 1 && <Hair />}
            </React.Fragment>
          ))}
        </div>
      </Panel>
    </div>
  )
}

// ── UNDER CONTRACT ────────────────────────────────────────────────────────────
function UnderContractPanel({ refreshKey }: { refreshKey: number }) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('deals')
        .select('id, name, address, addr_display, addr_street_name, addr_number, addr_city, status, commission_estimated, deal_contacts(contacts(name))')
        .in('status', ['under_contract', 'pending_payment'])
        .order('created_at', { ascending: true })
        .limit(15)
      setDeals((data ?? []) as unknown as Deal[])
      setLoading(false)
    }
    load()
  }, [refreshKey])

  return (
    <Panel style={{ flex: 1 }}>
      <PanelHeader glyph={G.underContract} label="UNDER CONTRACT" totalCount={String(deals.length)} />
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading ? (
          <div style={{ ...DS6, color: C.textLow, padding: '12px 14px' }}>Loading…</div>
        ) : deals.length === 0 ? (
          <div style={{ ...DS6, color: C.textLow, padding: '12px 14px' }}>No deals under contract.</div>
        ) : deals.map((d, i) => (
          <React.Fragment key={d.id}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 8 }}>
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
            {i < deals.length - 1 && <Hair />}
          </React.Fragment>
        ))}
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
  bp_priority: number | null  // tasks only; null for events
}

function Next48Panel({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<N48Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const cst = new Date().toLocaleString('en-CA', { timeZone: 'America/Chicago', hour12: false })
      const todayStr = cst.slice(0, 10)
      const d1 = new Date(new Date(todayStr).getTime() + 86400000).toISOString().slice(0, 10)
      const d2 = new Date(new Date(todayStr).getTime() + 86400000 * 2).toISOString().slice(0, 10)
      const d3 = new Date(new Date(todayStr).getTime() + 86400000 * 3).toISOString().slice(0, 10)

      const [{ data: events }, { data: deadlines }] = await Promise.all([
                // 'events' table does not exist — real table is schedule_events (cols: date, time, title, location, deal_id)
        supabase.from('schedule_events').select('id, title, date, time, location, deal_id').gte('date', todayStr).lte('date', d3).order('date').order('time'),
        supabase.from('tasks').select('id, title, due_date, deal_id, bp_priority, deals(name)').eq('status', 'open').is('deleted_at', null).gte('due_date', todayStr).lte('due_date', d3).order('due_date'),
      ])

      // Merge, dedupe: if same deal+date exists as both event and deadline, keep event
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

  return (
    <div style={{ flexShrink: 0, height: 236 }}>
      <Panel style={{ height: '100%' }}>
        <PanelHeader glyph={G.next48} label="NEXT 48" />
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '0 14px 14px', overflow: 'hidden' }}>
          {COLS.map(col => {
            const colItems = items.filter(i => i.date === col.date)
            const overdue = items.filter(i => i.date < todayStr)
            const displayItems = col.date === todayStr ? [...overdue, ...colItems.filter(i => i.date === todayStr)] : colItems
            return (
              <div key={col.label} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: 170 }}>
                {/* Column header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0 4px', flexShrink: 0 }}>
                  <span style={{ ...DT7 as React.CSSProperties, color: col.dim ? C.textLow : C.textHi }}>{col.label}</span>
                  <div style={{ flex: 1, height: 1, background: C.borderHair }} />
                  <span style={{ ...DT7 as React.CSSProperties, color: C.textLow }}>{displayItems.length}</span>
                </div>
                {/* Items */}
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {loading ? null : displayItems.length === 0 ? (
                    col.date === todayStr ? (
                      <div style={{ ...DT4, color: C.textLow, padding: '8px 0', textAlign: 'center' }}>
                        {`CLEAR THROUGH ${(([y,m,d]) => new Date(y,m-1,d).toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase())(getColDate(2).split('-').map(Number))}`}
                      </div>
                    ) : null
                  ) : (() => {
                    // JUST BEYOND: sort by bp_priority DESC NULLS LAST, then due_date; show one + N more.
                    const isJustBeyond = col.label === 'JUST BEYOND'
                    const sortedItems = isJustBeyond
                      ? [...displayItems].sort((a, b) => {
                          // Two-class: events before tasks
                          const aIsEvent = a.kind === 'event'
                          const bIsEvent = b.kind === 'event'
                          if (aIsEvent && !bIsEvent) return -1
                          if (!aIsEvent && bIsEvent) return 1
                          // Within events: date ASC
                          if (aIsEvent && bIsEvent) return a.date.localeCompare(b.date)
                          // Within tasks: bp_priority DESC NULLS LAST, then due_date ASC
                          if (a.bp_priority === null && b.bp_priority === null) return a.date.localeCompare(b.date)
                          if (a.bp_priority === null) return 1
                          if (b.bp_priority === null) return -1
                          if (b.bp_priority !== a.bp_priority) return b.bp_priority - a.bp_priority
                          return a.date.localeCompare(b.date)
                        })
                      : displayItems
                    const visibleItems = isJustBeyond ? sortedItems.slice(0, 1) : sortedItems
                    const moreCount = isJustBeyond ? sortedItems.length - 1 : 0
                    return (
                      <>
                        {visibleItems.map(item => (
                          <div
                            key={item.id}
                            style={{
                              padding: '9px 10px 9px 9px',
                              borderRadius: 8,
                              background: 'rgba(255,255,255,0.025)',
                              border: `1px solid ${C.border}`,
                              borderLeft: `3px solid ${item.spineColor}`,
                              display: 'flex',
                              gap: 6,
                              minWidth: 0,
                            }}
                          >
                            <div style={{ flexShrink: 0, width: 34, ...DT8, color: item.time ? C.textHi : C.textLow, textAlign: 'right' }}>
                              {item.time ? item.time.slice(0, 5) : 'DUE'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ ...DS5, color: C.textHi, wordBreak: 'break-word' }}>{item.title}</div>
                              {item.context && <div style={{ ...DS8, color: C.textLow }}>{item.context}</div>}
                            </div>
                          </div>
                        ))}
                        {moreCount > 0 && (
                          <div style={{ ...DT8, color: C.brandLift, padding: '6px 2px' }}>
                            + {moreCount} more
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
function SchedulePanel({ refreshKey }: { refreshKey: number }) {
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
      const d1 = new Date(new Date(todayStr).getTime() + 86400000).toISOString().slice(0, 10)
      const { data } = await supabase
        .from('schedule_events')  // 'events' table does not exist; schedule_events uses date/time columns
        .select('id, title, date, time, location')
        .gte('date', todayStr)
        .lte('date', d1)
        .order('date').order('time')
        .limit(20)
      setEvents((data ?? []) as ScheduleEvent[])
      setLoading(false)
    }
    load()
  }, [refreshKey])

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const d1 = new Date(new Date(todayStr).getTime() + 86400000).toISOString().slice(0, 10)

  const todays = events.filter(e => (e.date ?? e.event_date) === todayStr)
  const tomorrows = events.filter(e => (e.date ?? e.event_date) === d1)

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
        borderLeft: isNext ? `3px solid ${C.brand}` : '3px solid transparent',
      }}>
        {/* Time gutter */}
        <div style={{ flexShrink: 0, width: 52 }}>
          <div style={{ ...DM2, color: C.textHi }}>{time}</div>
          <div style={{ ...DT7 as React.CSSProperties, color: C.textLow }}>{ampm}</div>
        </div>
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...DS4, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
          {e.location && <div style={{ ...DS7, color: C.textLow }}>{e.location}</div>}
        </div>
      </div>
    )
  }

  function GroupLabel({ label }: { label: string }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px 2px' }}>
        <span style={{ ...DT7 as React.CSSProperties, color: C.textLow }}>{label}</span>
        <div style={{ flex: 1, height: 1, background: C.borderHair }} />
      </div>
    )
  }

  return (
    <Panel style={{ flex: 1 }}>
      <PanelHeader glyph={G.schedule} label="SCHEDULE" actionLabel="+ EVENT" />
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading ? (
          <div style={{ ...DS6, color: C.textLow, padding: '12px 14px' }}>Loading…</div>
        ) : events.length === 0 ? (
          <div style={{ ...DT4, color: C.textLow, padding: '20px 14px', textAlign: 'center', fontFamily: FONT_MONO }}>NOTHING SCHEDULED</div>
        ) : (
          <>
            {todays.length > 0 && <><GroupLabel label="TODAY" />{todays.map((e, i) => <React.Fragment key={e.id}><EventRow e={e} isNext={i === 0} />{i < todays.length - 1 && <Hair />}</React.Fragment>)}</>}
            {tomorrows.length > 0 && <><GroupLabel label="TOMORROW" />{tomorrows.map((e, i) => <React.Fragment key={e.id}><EventRow e={e} />{i < tomorrows.length - 1 && <Hair />}</React.Fragment>)}</>}
          </>
        )}
      </div>
    </Panel>
  )
}

// ── DEADLINES ─────────────────────────────────────────────────────────────────
function DeadlinesPanel({ refreshKey }: { refreshKey: number }) {
  const [deadlines, setDeadlines] = useState<Array<{
    id: string; title: string; due_date: string; kind: string;
    deals?: { name: string; address: string | null; addr_display: string | null; addr_street_name: string | null; addr_number: string | null; addr_city: string | null } | null
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
      const cutoff = new Date(new Date(todayStr).getTime() + 86400000 * 45).toISOString().slice(0, 10)
      const { data } = await supabase
        .from('contract_deadlines')
        .select('id, label, deadline_date, deadline_type, status, deal_id')
        .in('status', ['pending', 'extended'])
        .gte('deadline_date', todayStr)
        .lte('deadline_date', cutoff)
        .order('deadline_date', { ascending: true })
        .limit(20)
      setDeadlines((data ?? []).map((t: any) => ({ ...t, title: t.label ?? t.deadline_type ?? 'Deadline', due_date: t.deadline_date, kind: t.deadline_type ?? 'DEADLINE' })))
      setLoading(false)
    }
    load()
  }, [refreshKey])

  return (
    <Panel style={{ flex: 1 }}>
      <PanelHeader glyph={G.deadlines} label="DEADLINES" actionLabel="45 DAYS" />
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading ? (
          <div style={{ ...DS6, color: C.textLow, padding: '12px 14px' }}>Loading…</div>
        ) : deadlines.length === 0 ? (
          <div style={{ ...DT4, color: C.textLow, padding: '20px 14px', textAlign: 'center', fontFamily: FONT_MONO }}>NO DEADLINES IN 45 DAYS</div>
        ) : deadlines.map((d, i) => {
          const days = daysBetween(d.due_date)
          const urgent = days <= 7
          const isFirst = i === 0
          return (
            <React.Fragment key={d.id}>
              <div style={{
                display: 'flex',
                gap: 8,
                padding: '9px 14px',
                background: isFirst ? `rgba(255,163,58,0.05)` : 'transparent',
                borderLeft: isFirst ? `3px solid ${C.hot}` : '3px solid transparent',
                alignItems: 'flex-start',
              }}>
                {/* Days + date */}
                <div style={{ flexShrink: 0, width: 80 }}>
                  <div style={{ ...DT7 as React.CSSProperties, color: urgent ? C.hot : C.textMid }}>
                    {days === 0 ? 'TODAY' : `${days}D · ${fmtDate(d.due_date)}`}
                  </div>
                </div>
                {/* Kind */}
                <div style={{ ...DT7 as React.CSSProperties, color: C.textLow, flexShrink: 0 }}>DEADLINE</div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...DS3, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                  {d.deals && <div style={{ ...DS7, color: C.textLow }}>{d.deals.addr_display ?? d.deals.addr_street_name ?? d.deals.name}</div>}
                </div>
              </div>
              {i < deadlines.length - 1 && <Hair />}
            </React.Fragment>
          )
        })}
      </div>
    </Panel>
  )
}

// ── RECEIVABLES ───────────────────────────────────────────────────────────────
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
      borderRadius: 14,
      overflow: 'hidden',
      border: `1px solid ${C.border}`,
      background: 'linear-gradient(155deg, rgba(52,211,153,0.09), rgba(139,92,246,0.05))',
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: C.brandLift }}>{G.receivables}</span>
        <span style={{ ...DT1, color: C.textMid }}>RECEIVABLES</span>
      </div>
      {/* Hero figure — NO text-shadow (D2.7: wordmark is the one glow) */}
      <div style={{ ...DM0, color: C.moneyIn, textShadow: 'none' }}>
        {loading ? '—' : fmt$(collected)}
      </div>
      <div style={{ ...DS7, color: C.textLow }}>Collected of {fmt$(total)} total</div>
      {/* Split progress bar */}
      <div style={{ height: 4, borderRadius: 2, background: C.bgRaise, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: C.moneyIn, borderRadius: 2 }} />
      </div>
      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ ...DS7, color: C.brandLift }}>Outstanding {fmt$(outstanding)}</span>
        <span style={{ ...DT5, color: C.textLow }}>{pct}%</span>
      </div>
    </div>
  )
}

// ── AGENT CARD ────────────────────────────────────────────────────────────────
function AgentCard() {
  return (
    <div style={{
      flexShrink: 0,
      borderRadius: 14,
      border: `1px solid ${C.border}`,
      background: C.bgPanel,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: `rgba(139,92,246,0.13)`, border: `1px solid rgba(139,92,246,0.28)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.brandLift, flexShrink: 0 }}>
        {G.agent}
      </div>
      <div>
        <div style={{ ...DT5, color: C.brandLift }}>SHIRLEYCRE AGENT</div>
        <div style={{ ...DS7, color: C.textLow }}>Phase 3 · standing by</div>
      </div>
      <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: C.moneyIn }} />
    </div>
  )
}

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
      {/* Geometric mark — 64px PNG */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/mark-256.png" alt="" width={64} height={64} style={{ display: 'block', flexShrink: 0 }} />

      {/* SHIRLEYCRE wordmark — h176 PNG at 88px, §D2.3 / §D2.3a */}
      <div style={{ width: 'auto', flexShrink: 0, marginTop: -10, marginLeft: -3.5, display:'flex', alignItems:'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/wordmark/shirleycre-h176.png" alt="SHIRLEYCRE" height={88} style={{ height: 88, width: 'auto', display: 'block' }} />
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 40, background: C.border, flexShrink: 0 }} />

      {/* WAR ROOM */}
      <span style={{ ...DT1, letterSpacing: '0.19em', color: C.textMid, marginTop: 4, flexShrink: 0 }}>WAR ROOM</span>

      {/* Divider */}
      <div style={{ width: 1, height: 40, background: C.border, flexShrink: 0 }} />

      {/* Search */}
      <div
        onClick={onSearch}
        style={{
          flex: '0 1 380px',  // §D2.3(b): shrinks first when band overflows — date + LIVE stay flex:none
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

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* LACDB plate — §D2.3b, 52×158, brightness(1.18) on hover */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/links/lacdb-h104.png"
        alt="LACDB"
        style={{ height: 52, width: 158, display: 'block', flexShrink: 0, cursor: 'pointer', transition: 'filter 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.18)')}
        onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
        onClick={() => window.open('https://www.lacdb.com', '_blank', 'noopener,noreferrer')}
      />

      {/* CREXI plate — §D2.3b, 52×158, brightness(1.18) on hover */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/links/crexi-h104.png"
        alt="CREXI"
        style={{ height: 52, width: 158, display: 'block', flexShrink: 0, cursor: 'pointer', transition: 'filter 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.18)')}
        onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
        onClick={() => window.open('https://www.crexi.com', '_blank', 'noopener,noreferrer')}
      />

      {/* Date/clock */}
      <span style={{ ...DT2, color: C.brandLift, flexShrink: 0 }}>{dateStr} · {timeStr}</span>

      {/* Live dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.moneyIn }} />
        <span style={{ ...DT3, color: C.moneyIn }}>LIVE</span>
      </div>
    </div>
  )
}

// WordmarkGlow removed — replaced by h176 PNG (§D2.3 / §D2.3a, 8.17.26)

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
  // §D4.1 / Item 6: Task drawer — 460px right-side, reuses §13.2 TaskDetailSheet
  const [drawerTask, setDrawerTask] = useState<Task | null>(null)

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

            {/* Column A — 0.41 of content box net of gaps */}
            <div style={{ flex: '0 0 41%', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <BattlePlanPanel refreshKey={refreshKey} onSelectTask={setDrawerTask} />
            </div>

            {/* Column B — 0.31 */}
            <div style={{ flex: '0 0 31%', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <MoneyMoversPanel refreshKey={refreshKey} />
              <UnderContractPanel refreshKey={refreshKey} />
            </div>

            {/* Column C — 0.28, flex remainder */}
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <SchedulePanel refreshKey={refreshKey} />
              <DeadlinesPanel refreshKey={refreshKey} />
              <ReceivablesCard refreshKey={refreshKey} />
              <AgentCard />
            </div>

          </div>
        </div>
      </div>

      {/* D11 — Desktop task modal: 960px two-column centred. */}
      {drawerTask && (
        <TaskModal
          task={drawerTask as any}
          onClose={() => setDrawerTask(null)}
          onCompleted={() => { setDrawerTask(null); setRefreshKey(k => k + 1) }}
          onSaved={() => { setDrawerTask(null); setRefreshKey(k => k + 1) }}
        />
      )}
    </div>
  )
}

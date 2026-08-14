'use client'

// /warroom3 — ShirleyCRE mobile spec v1, Step 3
// Home screen: identity row (§6 item 2), hero card (§5.10 / §6 item 3), 2×2 tile grid (§6 items 4–5).
// No mobile header (deleted Step 2). /warroom untouched.
// No chains (§14), no portfolio, no Battle Plan detail, no deal page (§13/15).

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PinGate from '@/components/warroom/PinGate'
import BottomTabBar, { TabId } from '@/components/warroom3/BottomTabBar'
import BottomSheet from '@/components/warroom3/BottomSheet'
import BattlePlanSheet from '@/components/warroom3/BattlePlanSheet'
import { DealPipelineBand, DealsSheet } from '@/components/warroom3/DealsSheet'
import ReceivablesCard from '@/components/warroom3/ReceivablesCard'
import MoneyMoversSheet from '@/components/warroom3/MoneyMoversSheet'
import DeadlinesSheet from '@/components/warroom3/DeadlinesSheet'
import UnderContractSheet from '@/components/warroom3/UnderContractSheet'
import QuickActionsSheet from '@/components/warroom3/QuickActionsSheet'
import VoiceNoteSheet from '@/components/warroom3/VoiceNoteSheet'
import TaskSheet from '@/components/warroom3/TaskSheet'
import EventSheet from '@/components/warroom3/EventSheet'
import PortfolioCreateSheet from '@/components/warroom3/PortfolioCreateSheet'
import NewDealSheet from '@/components/warroom3/NewDealSheet'
import { supabase } from '@/lib/supabase'
import { formatAddress } from '@/lib/formatAddress'

const PIN_HASH    = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'
const SESSION_KEY = 'wr3_session_exp'
const SESSION_HOURS = 8

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Spec tokens §2 ───────────────────────────────────────────────────────────
const T = {
  bgBase:    '#08080C',
  bgPanel:   '#101017',
  bgRaise:   '#16161F',
  textHi:    '#EFEEF4',
  textMid:   '#8B8A9B',
  textLow:   '#5C5B6B',
  brand:     '#8B5CF6',
  brandLift: '#A78BFA',
  moneyIn:   '#34D399',
  late:      '#FF4D4D',
  hot:       '#FFA23A',
} as const

// §3.1: UPPERCASE → JetBrains Mono. Sentence case → Space Grotesk.
const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

// T1 §3.2 — 12px / 500 / 0.14em / UPPER / text-mid — section labels (44a type scale)
const styleT1: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: T.textMid,
  lineHeight: 1,
}

// T2 §3.2 — 12px / 500 / 0.15em / UPPER / text-low — micro labels, eyebrows (44a type scale)
const styleT2: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color: T.textLow,
  lineHeight: 1,
}

// T3 §3.2 — 18px / 500 / 0 / sentence / text-hi — row primary (44a type scale)
const styleT3: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 18,
  fontWeight: 500,
  color: T.textHi,
  lineHeight: 1.25,
}

// T4 §3.2 — 14px / 400 / 0 / sentence / text-mid — row secondary (44a type scale)
const styleT4: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 14,
  fontWeight: 400,
  color: T.textMid,
  lineHeight: 1.5,
}

// D3 §3.2 — 23px / 500 / -0.02em / sentence / text-hi — hero statement
const styleD3: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 23,
  fontWeight: 500,
  letterSpacing: '-0.02em',
  color: T.textHi,
  lineHeight: 1.2,
}

// ── Data types ────────────────────────────────────────────────────────────────
interface HeroItem {
  title: string
  subtitle: string      // location / deal name
  accentToken: 'late' | 'hot' | 'brand'
  type: 'task' | 'deadline'
}

interface TileStat {
  label: string
  count: number
  urgentCount: number
  urgentToken: 'late' | 'hot' | null
  urgentLabel?: string // override chip text (e.g. 'URGENT' for date-proximity vs deal-status 'HOT')
  panelKey: string
  fetchFailed?: boolean
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayCST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function formatDateLabel(): string {
  const now = new Date()
  // T2 eyebrow: "FRI · JUL 31"
  const day = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short' }).toUpperCase()
  const date = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' }).toUpperCase()
  return `${day} · ${date}`
}

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0,0,0,0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.floor((target.getTime() - now.getTime()) / 86400000)
}

// ── Data loader ───────────────────────────────────────────────────────────────
async function loadHomeData(): Promise<{ hero: HeroItem | null; tiles: TileStat[] }> {
  const today = todayCST()

  // Parallel fetches — queries mirror /warroom panel sources exactly.
  const [tasksRes, deadlinesRes, mmRes, ucRes] = await Promise.allSettled([
    // Battle Plan: status = 'open' OR 'in_progress' — matches BattlePlanPanel.tsx filter
    supabase
      .from('tasks')
      .select('id, title, due_date, status, deal_id, deals(name, address)')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: true })
      .limit(200),
    // Deadlines: CLASS A FIX — past-due pinned, forward 45-day window, missed loaded.
    // OLD predicate (retired): deadline_date >= today AND deadline_date <= today+45 AND status != 'satisfied'
    // NEW: three subqueries unified below. For tile/hero we need past-due + forward counts.
    // Tile count = pastDue + forward (missed acknowledged, not counted).
    // Hero priority: oldest past-due beats any forward deadline (Part 3).
    supabase
      .from('contract_deadlines')
      .select('id, deadline_type, deadline_date, status, deals(name, address)')
      .in('status', ['pending', 'extended', 'missed'])
      .not('status', 'eq', 'satisfied')
      // No date filter — fetch all unsatisfied so we can split by date client-side
      .order('deadline_date', { ascending: true })
      .limit(100),
    // Money Movers: status = 'hot' ONLY — exact HotPanel predicate
    // HotPanel.tsx: supabase.from('deals').select('*').eq('status','hot')
    // HOT chip count = same result set length (every row IS hot)
    supabase
      .from('deals')
      .select('id, status')
      .eq('status', 'hot')
      .limit(200),
    // Under Contract: status = under_contract
    supabase
      .from('deals')
      .select('id, status')
      .eq('status', 'under_contract')
      .limit(200),
  ])

  // Treat PostgREST errors (fulfilled but error field set) same as rejected
  const tasksData     = tasksRes.status     === 'fulfilled' && !tasksRes.value.error     ? tasksRes.value.data     : null
  const deadlinesData = deadlinesRes.status === 'fulfilled' && !deadlinesRes.value.error ? deadlinesRes.value.data : null
  const mmData        = mmRes.status        === 'fulfilled' && !mmRes.value.error        ? mmRes.value.data        : null
  const ucData        = ucRes.status        === 'fulfilled' && !ucRes.value.error        ? ucRes.value.data        : null

  // null means "fetch failed" — distinct from [] which means "confirmed empty"
  const tasks     = tasksData     ?? []
  const deadlines = deadlinesData ?? []
  const mmDeals   = mmData        ?? []
  const ucDeals   = ucData        ?? []

  const tasksFailed     = tasksData     === null
  const deadlinesFailed = deadlinesData === null
  const mmFailed        = mmData        === null
  const ucFailed        = ucData        === null

  // ── Split deadlines by group (CLASS A FIX) ──────────────────────────────────
  const allDeadlines = deadlines as any[]
  const cutoffStr = (() => {
    const d = new Date(); d.setDate(d.getDate() + 45)
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  })()

  // past-due: status pending/extended AND deadline_date < today (not missed — those are acknowledged)
  const dlPastDue = allDeadlines.filter((d: any) =>
    ['pending','extended'].includes(d.status) && d.deadline_date < today
  )
  // forward: status pending/extended AND within 45-day window
  const dlForward = allDeadlines.filter((d: any) =>
    ['pending','extended'].includes(d.status) && d.deadline_date >= today && d.deadline_date <= cutoffStr
  )
  // missed: acknowledged blown — not counted in tile but still in data
  // const dlMissed = allDeadlines.filter((d: any) => d.status === 'missed')

  // ── Hero card: Part 3 — oldest past-due outranks any forward deadline ──────
  let hero: HeroItem | null = null

  if (dlPastDue.length > 0) {
    // Oldest past-due wins hero (already sorted ASC from query)
    const oldest = dlPastDue[0] as any
    const days = daysUntil(oldest.deadline_date)   // negative
    const dealName = formatAddress(oldest.deals?.address) || oldest.deals?.name || 'Deal'
    const typeLabel = (oldest.deadline_type as string).replace(/_/g, ' ')
    const absDays = Math.abs(days)
    hero = {
      title: `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} — PAST DUE ${absDays === 1 ? '1 day' : `${absDays} days`} ago`,
      subtitle: dealName,
      accentToken: 'late',
      type: 'deadline',
    }
  } else if (dlForward.length > 0) {
    const nearest = dlForward[0] as any
    const days = daysUntil(nearest.deadline_date)
    const dealName = formatAddress(nearest.deals?.address) || nearest.deals?.name || 'Deal'
    const typeLabel = (nearest.deadline_type as string).replace(/_/g, ' ')
    hero = {
      title: `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} deadline${days === 0 ? ' — TODAY' : ` in ${days} day${days === 1 ? '' : 's'}`}`,
      subtitle: dealName,
      accentToken: days <= 1 ? 'late' : days <= 7 ? 'hot' : 'brand',
      type: 'deadline',
    }
  } else {
    // Oldest overdue open task
    const overdue = (tasks as any[]).filter(t => t.due_date && t.due_date < today)
    if (overdue.length > 0) {
      const oldest = overdue[overdue.length - 1]
      const deal = formatAddress((oldest.deals as any)?.address) || (oldest.deals as any)?.name || null
      hero = {
        title: oldest.title || 'Overdue task',
        subtitle: deal || '',
        accentToken: 'late',
        type: 'task',
      }
    }
  }

  // ── Tile counts ──────────────────────────────────────────────────────────────
  const allTasks = tasks as any[]

  // Battle Plan: open/in_progress tasks
  const bpTotal = allTasks.length
  const bpOverdue = allTasks.filter(t => t.due_date && t.due_date < today).length
  const bpHot = allTasks.filter(t => t.due_date && t.due_date >= today && daysUntil(t.due_date) <= 7).length

  // Money Movers: exact HotPanel predicate = status='hot'. All results ARE hot.
  const mmTotal = mmDeals.length
  const mmHot = mmDeals.length

  // Deadlines tile (CLASS A FIX): count = pastDue + forward (missed not counted — acknowledged)
  // OLD: dlTotal = allDeadlines.length (forward-only, past-due invisible)
  const dlTotal = dlPastDue.length + dlForward.length
  const dlOverdue = dlPastDue.length   // all past-due pending rows
  const dlHot = dlForward.filter((d: any) => { const days = daysUntil(d.deadline_date); return days >= 0 && days <= 7 }).length

  // Under Contract: same as UnderContractPanel
  const ucTotal = ucDeals.length

  const tiles: TileStat[] = [
    {
      label: 'Battle Plan',
      count: bpTotal,
      urgentCount: bpOverdue > 0 ? bpOverdue : bpHot,
      urgentToken: bpOverdue > 0 ? 'late' : bpHot > 0 ? 'hot' : null,
      panelKey: 'battleplan',
      fetchFailed: tasksFailed,
    },
    {
      label: 'Money Movers',
      count: mmTotal,
      urgentCount: mmHot,
      urgentToken: mmHot > 0 ? 'hot' : null,
      panelKey: 'moneymovers',
      fetchFailed: mmFailed,
    },
    {
      label: 'Deadlines',
      count: dlTotal,
      urgentCount: dlOverdue > 0 ? dlOverdue : dlHot,
      urgentToken: dlOverdue > 0 ? 'late' : dlHot > 0 ? 'hot' : null,
      urgentLabel: dlOverdue > 0 ? 'LATE' : 'URGENT', // date urgency, not deal status
      panelKey: 'deadlines',
      fetchFailed: deadlinesFailed,
    },
    {
      label: 'Under Contract',
      count: ucTotal,
      urgentCount: 0,
      urgentToken: null,
      panelKey: 'undercontract',
      fetchFailed: ucFailed,
    },
  ]

  return { hero, tiles }
}

// ── Hero Card §5.10 ───────────────────────────────────────────────────────────
// §5.10: bg rgba(255,255,255,0.03), border-default, radius 20px, padding 20px,
// late spine. T2 eyebrow → 12px → D3 statement → 9px → T4 location →
// 17px → primary + secondary button row.
// §13.1: Open/Dismiss buttons deleted. The task sheet (§13.2) is the action surface.
// HeroCard is now display-only — tap the card itself to open the relevant sheet.
function HeroCard({ item, onAction, onDismiss }: { item: HeroItem; onAction?: () => void; onDismiss?: () => void }) {
  const spineColor = item.accentToken === 'late' ? T.late : item.accentToken === 'hot' ? T.hot : T.brand
  const eyebrow = item.type === 'deadline' ? 'DEADLINE' : 'OVERDUE TASK'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 20,
      padding: '20px 20px 20px 33px',  // 13px left spine gap per §5.2
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* §5.2 left spine — 3px, full-height */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3, background: spineColor,
      }} />
      {/* §5.10 step 1: T2 eyebrow */}
      <div style={{ ...styleT2, marginBottom: 12 }}>{eyebrow}</div>
      {/* §5.10 step 2: D3 statement */}
      <div style={{ ...styleD3, marginBottom: 9, textWrap: 'pretty' } as React.CSSProperties}>
        {item.title}
      </div>
      {/* §5.10 step 3: T4 location */}
      {item.subtitle ? (
        <div style={{ ...styleT4, marginBottom: 17 }}>{item.subtitle}</div>
      ) : (
        <div style={{ marginBottom: 17 }} />
      )}
      {/* §13.1: Open/Dismiss buttons deleted — action dialog is replaced by §13.2 task sheet */}
    </div>
  )
}

// ── Panel Tile §5.6 ───────────────────────────────────────────────────────────
// §5.6 2-up grid item. Contents top to bottom:
// 1. Row: D2 figure left, T5-scale mono status note right
// 2. 18px gap
// 3. T1 label
// Optional spine when urgent. Whole surface is a button.
// §7 tile press: scale 0.98, 90ms
function PanelTile({ stat, onPress }: { stat: TileStat; onPress: () => void }) {
  const [pressed, setPressed] = React.useState(false)
  const hasSpine = !stat.fetchFailed && stat.urgentToken !== null && stat.urgentCount > 0
  const spineColor = stat.urgentToken === 'late' ? T.late : stat.urgentToken === 'hot' ? T.hot : T.brand
  // §5.2 + directive item 7: tile background is bg-raise, flat. No status tint.
  // Tint carries no information the spine isn't already carrying.
  // §4.3: one accent per element — the spine is it.
  const spineBg = T.bgRaise  // always flat, regardless of accent

  // T5 status note color: urgent count in its accent, else text-low
  const statusColor = stat.urgentToken === 'late'
    ? T.late
    : stat.urgentToken === 'hot'
    ? T.hot
    : T.textLow

  // Status note text: uses urgentLabel if provided, else "LATE" / "HOT"
  const chipLabel = stat.urgentLabel ?? (stat.urgentToken === 'late' ? 'LATE' : 'HOT')
  const statusNote = stat.urgentCount > 0
    ? `${stat.urgentCount} ${chipLabel}`
    : ''

  return (
    <button
      onClick={onPress}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => { setTimeout(() => setPressed(false), 90) }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: T.bgRaise,  // always flat — directive item 7: no status tint on tiles
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: hasSpine ? '16px 15px 16px 18px' : '16px 15px',
        minHeight: 90,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        textAlign: 'left',
        width: '100%',
        // §7 tile press: scale 0.98, 90ms
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
        transition: 'transform 90ms ease',
      } as React.CSSProperties}
    >
      {/* §5.2 spine */}
      {hasSpine && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, background: spineColor,
        }} />
      )}

      {/* Row 1: D2 figure left, T5 status right */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
        {/* D2 §3.2: 32px / 700 / -0.03em / text-hi — or error indicator */}
        {stat.fetchFailed ? (
          <span style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#FF4D4D',
            lineHeight: 1,
          }}>!</span>
        ) : (
          <span style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: T.textHi,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {stat.count}
          </span>
        )}
        {/* T5 §3.2: JetBrains Mono 10px / 500 / 0.11em / UPPER */}
        {!stat.fetchFailed && statusNote ? (
          <span style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.11em',
            textTransform: 'uppercase',
            color: statusColor,
            lineHeight: 1,
            marginTop: 4,
          }}>
            {statusNote}
          </span>
        ) : stat.fetchFailed ? (
          <span style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.11em',
            textTransform: 'uppercase',
            color: '#FF4D4D',
            lineHeight: 1,
            marginTop: 4,
          }}>ERR</span>
        ) : null}
      </div>

      {/* Row 3: T1 label — 18px gap above per §5.6 */}
      <div style={{ ...styleT1, marginTop: 18 }}>{stat.label}</div>
    </button>
  )
}

// ── Home Screen §6 ────────────────────────────────────────────────────────────
// §18: quickactions/voicenote; §19: portfoliocreate; §20: newdeal
type SheetId = 'battleplan' | 'deals' | 'moneymovers' | 'deadlines' | 'undercontract' | 'quickactions' | 'voicenote' | 'portfoliocreate' | 'newdeal'

function HomeScreen({
  onTilePress,
  openSheet,
  setOpenSheet,
}: {
  onTilePress: (key: string) => void
  openSheet: SheetId | null
  setOpenSheet: (id: SheetId | null) => void
}) {
  const [loading, setLoading] = useState(true)
  const [hero, setHero] = useState<HeroItem | null>(null)
  const [tiles, setTiles] = useState<TileStat[]>([])
  const [dealsSearch, setDealsSearch] = useState('')
  const [taskSheetOpen, setTaskSheetOpen] = useState(false)
  const [eventSheetOpen, setEventSheetOpen] = useState(false)
  const dateLabel = formatDateLabel()

  useEffect(() => {
    loadHomeData()
      .then(({ hero, tiles }) => { setHero(hero); setTiles(tiles) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden',
      // §4.1 screen gutter 18px + §5.7 bottom pad 104px
      // Outer padding-top: 5px to pass §11 check 0 after 29b mark grew 40→48px.
      // Geometry: 52(status) + 5(this) + 14.5(text center in 48px row, 19px font) = 71.5px ≤ 72px. ✓
      // Previous 8px was sized for 40px row. 48px row shifts center down — padding recalculated.
      padding: '5px 18px 104px',
      background: T.bgBase,
    }}>
      {/* §6.2 Identity row — locked design 15c, scaled per 29b (12 Aug 2026). ONE flex row, 48px tall.
          29b changes: mark 40→48px · WAR ROOM D4 17→19px · date T2→T1 text-low · 34px circle retired → bare magnifier. */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: 48,
        marginBottom: 18,
      }}>
        {/* §6.2 + 29b: 48px geometric mark (was 40px). mark-64.png, flex:none, no radius, no plate, no CSS glow. */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            position: 'absolute',
            inset: -7,
            background: 'radial-gradient(circle, rgba(168,85,247,0.5), transparent 68%)',
            filter: 'blur(6px)',
            pointerEvents: 'none',
          }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/mark-64.png" alt="" width={48} height={48} style={{ display: 'block', position: 'relative' }} />
        </div>

        {/* §3.2 D4 + 29b: WAR ROOM — JetBrains Mono 19px / 700 / 0.13em / UPPER / #F7F6FB.
            Level moves from 17→19 because it has exactly one use (the level moves with the use). */}
        <span style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: '0.13em',
          textTransform: 'uppercase',
          color: '#F7F6FB',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          WAR ROOM
        </span>

        <div style={{ flex: 1 }} />

        {/* §6.2 + 29b: date rebinds to T1 at text-low (was T2). */}
        <span style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: T.textLow,
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>{dateLabel}</span>

        {/* §6.2 + 29b: 34px circle button RETIRED. Bare 22px magnifier, stroke 1.7, text-low.
            Inside 44×44 hit target. Matches §5.11.6 quiet-control pattern. */}
        <button
          style={{
            width: 44,
            height: 44,
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            WebkitTapHighlightColor: 'transparent',
            padding: 0,
          } as React.CSSProperties}
          aria-label="Search"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.textLow} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
      </div>

      {/* §6 item 3: Hero card — §5.10 */}
      {loading ? (
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          height: 160,
          marginBottom: 26,
          // skeleton shimmer
          backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.6s ease-in-out infinite',
        }} />
      ) : hero ? (
        <div style={{ marginBottom: 26 }}>
          <HeroCard
            item={hero}
            onDismiss={() => setHero(null)}
          />
        </div>
      ) : null /* §5.10: if nothing qualifies, card is not rendered */}

      {/* §6 items 4–5: PANELS label + 2×2 tile grid */}
      {/* §4.1: T2 label, then 12px gap to first content, 26px above section label */}
      <div style={{ ...styleT2, marginBottom: 12 }}>PANELS</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 11,  // §4.1 grid gap: 11px
      }}>
        {loading ? (
          // Skeleton tiles
          [0,1,2,3].map(i => (
            <div key={i} style={{
              background: T.bgPanel,
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              minHeight: 90,
              opacity: 0.5,
            }} />
          ))
        ) : (
          tiles.map(stat => (
            <PanelTile
              key={stat.panelKey}
              stat={stat}
              onPress={() => {
                if (stat.panelKey === 'battleplan') {
                  setOpenSheet('battleplan')
                } else if (stat.panelKey === 'moneymovers') {
                  setOpenSheet('moneymovers')
                } else if (stat.panelKey === 'deadlines') {
                  setOpenSheet('deadlines')
                } else if (stat.panelKey === 'undercontract') {
                  setOpenSheet('undercontract')
                } else {
                  onTilePress(stat.panelKey)
                }
              }}
            />
          ))
        )}
      </div>{/* ── end 2×2 grid — items below are full-width ── */}

      {/* §6 item 6: Deal Pipeline band — 11px gap above per §6 */}
      <div style={{ marginTop: 11 }}>
        <DealPipelineBand
          onOpenSheet={(search) => {
            setDealsSearch(search ?? '')
            setOpenSheet('deals')
          }}
        />
      </div>

      {/* §6 item 7: Receivables card — 11px gap above per §6 */}
      <div style={{ marginTop: 11 }}>
        <ReceivablesCard />
      </div>

      {/* Battle Plan sheet — §12 step 4 */}
      <BattlePlanSheet
        open={openSheet === 'battleplan'}
        onClose={() => setOpenSheet(null)}
      />

      {/* Deals sheet — §12 step 5 + §19.1 + §20 */}
      <DealsSheet
        open={openSheet === 'deals'}
        onClose={() => setOpenSheet(null)}
        initialSearch={dealsSearch}
        onOpenPortfolioCreate={() => setOpenSheet('portfoliocreate')}
        onOpenNewDeal={() => setOpenSheet('newdeal')}
      />

      {/* §12 step 7: remaining panel sheets */}
      <MoneyMoversSheet
        open={openSheet === 'moneymovers'}
        onClose={() => setOpenSheet(null)}
      />
      <DeadlinesSheet
        open={openSheet === 'deadlines'}
        onClose={() => setOpenSheet(null)}
      />
      <UnderContractSheet
        open={openSheet === 'undercontract'}
        onClose={() => setOpenSheet(null)}
      />

      {/* §18 Quick Actions — FAB's sheet */}
      <QuickActionsSheet
        open={openSheet === 'quickactions'}
        onClose={() => setOpenSheet(null)}
        onOpenVoiceNote={() => setOpenSheet('voicenote')}
        onOpenTask={() => { setOpenSheet(null); setTimeout(() => setTaskSheetOpen(true), 180) }}
        onOpenEvent={() => { setOpenSheet(null); setTimeout(() => setEventSheetOpen(true), 180) }}
      />

      {/* §18.3b Task sheet (36a) */}
      <TaskSheet
        open={taskSheetOpen}
        onClose={() => setTaskSheetOpen(false)}
      />

      {/* §18.3c Event sheet (36b) */}
      <EventSheet
        open={eventSheetOpen}
        onClose={() => setEventSheetOpen(false)}
      />

      {/* §18 Voice Note — full-height, field focused on open */}
      <VoiceNoteSheet
        open={openSheet === 'voicenote'}
        onClose={() => setOpenSheet(null)}
      />

      {/* §19 Portfolio creation — deliberate, never suggested */}
      <PortfolioCreateSheet
        open={openSheet === 'portfoliocreate'}
        onClose={() => setOpenSheet(null)}
        onCreated={() => setOpenSheet(null)}
      />

      {/* §20 New deal intake — five required fields, exactly one step written */}
      <NewDealSheet
        open={openSheet === 'newdeal'}
        onClose={() => setOpenSheet(null)}
        onCreated={() => setOpenSheet(null)}
      />

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}

// ── Placeholder screens ───────────────────────────────────────────────────────
function PlaceholderScreen({ label }: { label: string }) {
  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '18px 18px 104px',
      background: T.bgBase,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    }}>
      <span style={styleT1}>{label}</span>
      <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>
        Coming in next step
      </span>
    </div>
  )
}

// ── Unlock flash ──────────────────────────────────────────────────────────────
function UnlockFlash() {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.20) 0%, transparent 70%)',
        pointerEvents: 'none',
      }}
    />
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function WarRoom3Page() {
  const [unlocked, setUnlocked] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('home')
  // Sheet state lifted to root so FAB can reflect open state across all sheets
  const [openSheet, setOpenSheet] = useState<SheetId | null>(null)

  useEffect(() => {
    const expiry = localStorage.getItem(SESSION_KEY)
    if (expiry && Date.now() < parseInt(expiry)) setUnlocked(true)
  }, [])

  const handlePinSuccess = useCallback(() => {
    const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000
    localStorage.setItem(SESSION_KEY, expiry.toString())
    setShowFlash(true)
    setTimeout(() => { setShowFlash(false); setUnlocked(true) }, 800)
  }, [])

  const handleTilePress = useCallback((key: string) => {
    // non-home-screen tiles — no action yet
  }, [])

  // §18.1: FAB — two states, one condition: any sheet open?
  // No sheet open → + → opens Quick Actions
  // Any sheet open → × → closes that sheet and nothing else
  const handleFab = useCallback(() => {
    if (openSheet) {
      setOpenSheet(null)
    } else {
      setOpenSheet('quickactions')
    }
  }, [openSheet])

  if (!unlocked) {
    return (
      <>
        <PinGate pinHash={PIN_HASH} sha256={sha256} onSuccess={handlePinSuccess} />
        <AnimatePresence>{showFlash && <UnlockFlash />}</AnimatePresence>
      </>
    )
  }

  function renderScreen() {
    switch (activeTab) {
      case 'home':  return (
        <HomeScreen
          onTilePress={handleTilePress}
          openSheet={openSheet}
          setOpenSheet={setOpenSheet}
        />
      )
      case 'deals': return <PlaceholderScreen label="DEALS" />
      case 'money': return <PlaceholderScreen label="MONEY" />
      case 'more':  return <PlaceholderScreen label="MORE" />
    }
  }

  return (
    // §6 item 1: no mobile header on /warroom3 (deleted Step 2).
    // bg-base #08080C, position:fixed prevents iOS bounce on root.
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      width: '100vw',
      maxWidth: '100vw',
      background: T.bgBase,
      overflow: 'hidden',
      position: 'fixed',
      inset: 0,
    }}>
      {/* §6 item 1: 52px status area — iOS clock/indicators only */}
      <div style={{
        height: 52,
        flexShrink: 0,
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }} />

      {/* Screen content — §7: tab change is instant (opacity 0.1s only) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>

      {/* §5.7 Bottom tab bar + FAB "Deep aperture" 14b
          fabOpen: any sheet open → aria-expanded true → plus rotates to × */}
      <BottomTabBar
        active={activeTab}
        onTab={setActiveTab}
        onFab={handleFab}
        fabOpen={openSheet !== null}
      />
    </div>
  )
}

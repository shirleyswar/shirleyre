'use client'

// /warroom3 — ShirleyCRE mobile spec — Items 54-77 refresh build
// Production /warroom and /warroom/deal: untouched.

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PinGate from '@/components/warroom/PinGate'
import BottomTabBar, { TabId } from '@/components/warroom3/BottomTabBar'
import BottomSheet from '@/components/warroom3/BottomSheet'
import BattlePlanSheet from '@/components/warroom3/BattlePlanSheet'
import { DealsSheet } from '@/components/warroom3/DealsSheet'
import ReceivablesCard from '@/components/warroom3/ReceivablesCard'
import MoneyMoversSheet from '@/components/warroom3/MoneyMoversSheet'
import DeadlinesSheet from '@/components/warroom3/DeadlinesSheet'
import UnderContractSheet from '@/components/warroom3/UnderContractSheet'
import QuickActionsSheet from '@/components/warroom3/QuickActionsSheet'
import VoiceNoteSheet from '@/components/warroom3/VoiceNoteSheet'
import TaskSheet from '@/components/warroom3/TaskSheet'
import TaskDetailSheet, { Task as DetailTask } from '@/components/warroom3/TaskDetailSheet'
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

// ── Spec tokens ───────────────────────────────────────────────────────────────
const T = {
  bgBase:      '#08080C',
  bgPanel:     '#12111B',
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
} as const

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const styleT1: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: T.textMid,
  lineHeight: 1,
}

const styleT2: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color: T.textLow,
  lineHeight: 1,
}

const styleT3: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 18,
  fontWeight: 500,
  color: T.textHi,
  lineHeight: 1.25,
}

const styleT4: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 14,
  fontWeight: 400,
  color: T.textMid,
  lineHeight: 1.5,
}

// ── Data types ────────────────────────────────────────────────────────────────
interface UrgentItem {
  deadlineType: string
  daysUntil: number   // negative = past due
  title: string       // formatted address or deal name
  shortAddress: string
}

interface TileStat {
  label: string
  count: number
  urgentCount: number
  urgentToken: 'late' | 'hot' | null
  urgentLabel?: string
  panelKey: string
  fetchFailed?: boolean
}

interface DealsControl {
  hotCount: number
  ucCount: number
  activeCount: number
  pipelineCount: number
  total: number
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayCST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function formatDateLabel(): string {
  const now = new Date()
  const day = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short' }).toUpperCase()
  const date = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' }).toUpperCase()
  return `${day} · ${date}`
}

function daysUntilDate(dateStr: string): number {
  const now = new Date(); now.setHours(0,0,0,0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.floor((target.getTime() - now.getTime()) / 86400000)
}

// ── Data loader ───────────────────────────────────────────────────────────────
async function loadHomeData(): Promise<{
  urgentItem: UrgentItem | null
  tiles: TileStat[]
  dealsControl: DealsControl
}> {
  const today = todayCST()

  const [tasksRes, deadlinesRes, mmRes, ucRes, allDealsRes] = await Promise.allSettled([
    supabase
      .from('tasks')
      .select('id, title, due_date, status, deal_id, deals(name, address, addr_display, addr_street_name, addr_number, addr_city)')
      .eq('status', 'open')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(200),
    supabase
      .from('contract_deadlines')
      .select('id, deadline_type, deadline_date, status, deals(name, address, addr_display, addr_street_name, addr_number, addr_city)')
      .in('status', ['pending', 'extended', 'missed'])
      .order('deadline_date', { ascending: true })
      .limit(100),
    supabase
      .from('deals')
      .select('id, status, is_money_mover')
      .eq('is_money_mover', true)
      .limit(200),
    supabase
      .from('deals')
      .select('id, status')
      .eq('status', 'under_contract')
      .limit(200),
    supabase
      .from('deals')
      .select('id, status')
      .limit(500),
  ])

  const tasksData     = tasksRes.status     === 'fulfilled' && !tasksRes.value.error     ? tasksRes.value.data     : null
  const deadlinesData = deadlinesRes.status === 'fulfilled' && !deadlinesRes.value.error ? deadlinesRes.value.data : null
  const mmData        = mmRes.status        === 'fulfilled' && !mmRes.value.error        ? mmRes.value.data        : null
  const ucData        = ucRes.status        === 'fulfilled' && !ucRes.value.error        ? ucRes.value.data        : null
  const allDealsData  = allDealsRes.status  === 'fulfilled' && !allDealsRes.value.error  ? allDealsRes.value.data  : null

  const tasks     = tasksData     ?? []
  const deadlines = deadlinesData ?? []
  const mmDeals   = mmData        ?? []
  const ucDeals   = ucData        ?? []
  const allDeals  = allDealsData  ?? []

  const tasksFailed     = tasksData     === null
  const deadlinesFailed = deadlinesData === null
  const mmFailed        = mmData        === null
  const ucFailed        = ucData        === null

  const cutoffStr = (() => {
    const d = new Date(); d.setDate(d.getDate() + 45)
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  })()

  const allDl = deadlines as any[]
  const dlPastDue = allDl.filter((d: any) =>
    ['pending','extended'].includes(d.status) && d.deadline_date < today
  )
  const dlForward = allDl.filter((d: any) =>
    ['pending','extended'].includes(d.status) && d.deadline_date >= today && d.deadline_date <= cutoffStr
  )

  // ── Urgent item (item 56) ─────────────────────────────────────────────────
  // Qualification: deadline within 10 days OR past due
  let urgentItem: UrgentItem | null = null

  if (dlPastDue.length > 0) {
    const oldest = dlPastDue[0] as any
    const days = daysUntilDate(oldest.deadline_date)
    const shortAddr = formatAddress(oldest.deals) || oldest.deals?.name || 'Deal'
    const typeLabel = (oldest.deadline_type as string).replace(/_/g, ' ')
    urgentItem = {
      deadlineType: typeLabel,
      daysUntil: days,
      title: typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1),
      shortAddress: shortAddr,
    }
  } else {
    // Forward deadlines within 10 days qualify
    const soon = dlForward.filter((d: any) => daysUntilDate(d.deadline_date) <= 10)
    if (soon.length > 0) {
      const nearest = soon[0] as any
      const days = daysUntilDate(nearest.deadline_date)
      const shortAddr = formatAddress(nearest.deals) || nearest.deals?.name || 'Deal'
      const typeLabel = (nearest.deadline_type as string).replace(/_/g, ' ')
      urgentItem = {
        deadlineType: typeLabel,
        daysUntil: days,
        title: typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1),
        shortAddress: shortAddr,
      }
    }
  }

  // ── Tile counts ───────────────────────────────────────────────────────────
  const allTasks = tasks as any[]
  const bpTotal = allTasks.length
  const bpOverdue = allTasks.filter(t => t.due_date && t.due_date < today).length
  const bpHot = allTasks.filter(t => t.due_date && t.due_date >= today && daysUntilDate(t.due_date) <= 7).length

  const mmTotal = mmDeals.length
  const mmHot = mmDeals.filter((d: any) => d.status === 'hot').length

  const dlTotal = dlPastDue.length + dlForward.length
  const dlOverdue = dlPastDue.length
  const dlHot = dlForward.filter((d: any) => { const days = daysUntilDate(d.deadline_date); return days >= 0 && days <= 7 }).length

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
      urgentLabel: dlOverdue > 0 ? 'LATE' : 'URGENT',
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

  // ── Deals control ─────────────────────────────────────────────────────────
  const hotCount = allDeals.filter((d: any) => d.status === 'hot').length
  const ucCount  = allDeals.filter((d: any) => d.status === 'under_contract').length
  const activeCount = allDeals.filter((d: any) => d.status === 'active').length
  const pipelineCount = allDeals.filter((d: any) => d.status === 'pipeline').length

  return {
    urgentItem,
    tiles,
    dealsControl: { hotCount, ucCount, activeCount, pipelineCount, total: allDeals.length },
  }
}

// ── ITEM 56 — Urgent Row ──────────────────────────────────────────────────────
function UrgentRow({ item }: { item: UrgentItem }) {
  const days = item.daysUntil
  const isPast = days < 0
  const dayCount = isPast
    ? `${Math.abs(days)}d PAST`
    : days === 0 ? 'TODAY' : `${days}d`

  // Line 2: task title (left), short address (right)
  return (
    <div style={{
      height: 66,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      paddingLeft: 13,
      paddingRight: 18,
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Red spine at gutter */}
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: 3,
        background: T.late,
      }} />
      {/* Line 1: DEADLINE label + day count */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
      }}>
        <span style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: T.textLow,
          lineHeight: 1,
        }}>DEADLINE</span>
        <span style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: T.late,
          lineHeight: 1,
        }}>{dayCount}</span>
      </div>
      {/* Line 2: task title + address */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
      }}>
        <span style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 14,
          fontWeight: 500,
          color: T.textHi,
          lineHeight: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
        }}>{item.title}</span>
        <span style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 13,
          fontWeight: 400,
          color: T.textMid,
          lineHeight: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          maxWidth: '45%',
        }}>{item.shortAddress}</span>
      </div>
    </div>
  )
}

// ── ITEM 57 — Panel Tile ──────────────────────────────────────────────────────
function PanelTile({ stat, onPress }: { stat: TileStat; onPress: () => void }) {
  const [pressed, setPressed] = React.useState(false)
  const hasUrgency = !stat.fetchFailed && stat.urgentToken !== null && stat.urgentCount > 0
  const spineColor = stat.urgentToken === 'late' ? T.late : stat.urgentToken === 'hot' ? T.hot : T.brand
  const statusColor = stat.urgentToken === 'late' ? T.late : stat.urgentToken === 'hot' ? T.hot : T.textLow
  const chipLabel = stat.urgentLabel ?? (stat.urgentToken === 'late' ? 'LATE' : 'HOT')
  const statusNote = stat.urgentCount > 0 ? `${stat.urgentCount} ${chipLabel}` : ''

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
        background: T.bgPanel,
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 14,
        padding: hasUrgency ? '14px 14px 14px 17px' : '14px 14px',
        height: 78,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        textAlign: 'left',
        width: '100%',
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
        transition: 'transform 90ms ease',
        boxSizing: 'border-box',
      } as React.CSSProperties}
    >
      {/* Spine — quiet tile: absent */}
      {hasUrgency && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, background: spineColor,
        }} />
      )}

      {/* Top: count left, urgency micro-label top-right */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
        {stat.fetchFailed ? (
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: T.late, lineHeight: 1 }}>!</span>
        ) : (
          <span style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: T.textHi,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>{stat.count}</span>
        )}
        {/* micro-label top-right — quiet tile: absent */}
        {!stat.fetchFailed && hasUrgency && statusNote ? (
          <span style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.11em',
            textTransform: 'uppercase',
            color: statusColor,
            lineHeight: 1,
            marginTop: 3,
          }}>{statusNote}</span>
        ) : stat.fetchFailed ? (
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, color: T.late, lineHeight: 1, marginTop: 3 }}>ERR</span>
        ) : null}
      </div>

      {/* Bottom: label */}
      <div style={{ ...styleT1 }}>{stat.label}</div>
    </button>
  )
}

// ── ITEM 58 — Deals Control ───────────────────────────────────────────────────
// Rim sweep animation keyframe name: dealsRimSweep (16s)
function DealsControl({
  control,
  loading,
  onOpen,
}: {
  control: DealsControl
  loading: boolean
  onOpen: () => void
}) {
  const { hotCount, ucCount, activeCount, pipelineCount, total } = control

  // 5px proportion bar: hot | UC | active | pipeline
  const pctHot      = total > 0 ? hotCount      / total : 0
  const pctUC       = total > 0 ? ucCount       / total : 0
  const pctActive   = total > 0 ? activeCount   / total : 0
  const pctPipeline = total > 0 ? pipelineCount / total : 0

  return (
    <div>
      {/* Section header — no count, no chevron */}
      <div style={{ ...styleT2, marginBottom: 10 }}>Deals</div>

      {/* Three figures on one baseline */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 0,
        marginBottom: 8,
      }}>
        {/* hot count */}
        <span style={{
          fontFamily: FONT_MONO,
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: T.hot,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}>{loading ? '—' : hotCount}</span>
        <span style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: T.textLow,
          lineHeight: 1,
          marginLeft: 5,
          alignSelf: 'center',
        }}>HOT</span>

        <div style={{ width: 18 }} />

        {/* UC count */}
        <span style={{
          fontFamily: FONT_MONO,
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: T.textHi,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}>{loading ? '—' : ucCount}</span>
        <span style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: T.textLow,
          lineHeight: 1,
          marginLeft: 5,
          alignSelf: 'center',
        }}>UC</span>

        <div style={{ flex: 1 }} />

        {/* TOTAL right-aligned */}
        <span style={{
          fontFamily: FONT_MONO,
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: T.textHi,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}>{loading ? '—' : total}</span>
        <span style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: T.textLow,
          lineHeight: 1,
          marginLeft: 5,
          alignSelf: 'center',
        }}>TOTAL</span>
      </div>

      {/* 5px proportion bar: hot | UC | active | pipeline */}
      <div style={{
        display: 'flex',
        height: 5,
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 12,
        background: 'rgba(255,255,255,0.08)',
      }}>
        {!loading && total > 0 && (
          <>
            <div style={{ flex: pctHot,      background: T.hot,                    transition: 'flex 0.6s ease' }} />
            <div style={{ flex: pctUC,       background: T.brand,                  transition: 'flex 0.6s ease' }} />
            <div style={{ flex: pctActive,   background: T.brandLift,              transition: 'flex 0.6s ease' }} />
            <div style={{ flex: pctPipeline, background: 'rgba(255,255,255,0.20)', transition: 'flex 0.6s ease' }} />
          </>
        )}
      </div>

      {/* Aperture bar button — full-width, 52px, border-box, gutter to gutter, radius 17 */}
      {/* near-black body, rim sweep at 16s, NOT violet */}
      <button
        onClick={onOpen}
        className="deals-aperture-btn"
        style={{
          width: '100%',
          height: 52,
          boxSizing: 'border-box',
          borderRadius: 17,
          background: '#0D0C15',
          border: '1px solid rgba(255,255,255,0.16)',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        } as React.CSSProperties}
      >
        <span style={{
          fontFamily: FONT_MONO,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: T.textHi,
          lineHeight: 1,
          position: 'relative',
          zIndex: 1,
        }}>DEALS</span>
      </button>
    </div>
  )
}

// ── Home Screen ───────────────────────────────────────────────────────────────
type SheetId = 'battleplan' | 'deals' | 'moneymovers' | 'deadlines' | 'undercontract' | 'quickactions' | 'voicenote' | 'portfoliocreate' | 'newdeal' | 'task' | 'event'

function HomeScreen({
  onTilePress,
  openSheet,
  setOpenSheet,
  onTaskDetailOpenChange,
  selectedDetailTask,
  setSelectedDetailTask,
  taskDetailOpen,
  setTaskDetailOpen,
}: {
  onTilePress: (key: string) => void
  openSheet: SheetId | null
  setOpenSheet: (id: SheetId | null) => void
  onTaskDetailOpenChange?: (isOpen: boolean) => void
  selectedDetailTask: DetailTask | null
  setSelectedDetailTask: (t: DetailTask | null) => void
  taskDetailOpen: boolean
  setTaskDetailOpen: (v: boolean) => void
}) {
  const [loading, setLoading] = useState(true)
  const [urgentItem, setUrgentItem] = useState<UrgentItem | null>(null)
  const [tiles, setTiles] = useState<TileStat[]>([])
  const [dealsControl, setDealsControl] = useState<DealsControl>({ hotCount: 0, ucCount: 0, activeCount: 0, pipelineCount: 0, total: 0 })
  const [bpRefreshKey, setBpRefreshKey] = useState(0)
  const dateLabel = formatDateLabel()

  useEffect(() => {
    loadHomeData()
      .then(({ urgentItem, tiles, dealsControl }) => {
        setUrgentItem(urgentItem)
        setTiles(tiles)
        setDealsControl(dealsControl)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [bpRefreshKey])

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '0 18px 0',
      background: T.bgBase,
    }}>

      {/* ── ITEM 56 — URGENT ROW ─────────────────────────────────── */}
      {/* When nothing qualifies: absent. No placeholder, no shimmer. */}
      {!loading && urgentItem && (
        <UrgentRow item={urgentItem} />
      )}
      {/* Gap: if urgent row is absent, tile grid rises exactly 66px — achieved by
          having no spacer here. The urgent row itself is 66px when present. */}

      {/* ── ITEM 57 — TILE GRID (PANELS label STRUCK) ──────────── */}
      <div style={{ marginTop: 14 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}>
          {loading ? (
            [0,1,2,3].map(i => (
              <div key={i} style={{
                background: T.bgPanel,
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 14,
                height: 78,
                opacity: 0.5,
              }} />
            ))
          ) : (
            tiles.map(stat => (
              <PanelTile
                key={stat.panelKey}
                stat={stat}
                onPress={() => {
                  if (stat.panelKey === 'battleplan') setOpenSheet('battleplan')
                  else if (stat.panelKey === 'moneymovers') setOpenSheet('moneymovers')
                  else if (stat.panelKey === 'deadlines') setOpenSheet('deadlines')
                  else if (stat.panelKey === 'undercontract') setOpenSheet('undercontract')
                  else onTilePress(stat.panelKey)
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* ── ITEM 58 — DEALS CONTROL (DealPipelineBand STRUCK) ──── */}
      <div style={{ marginTop: 18 }}>
        <DealsControl
          control={dealsControl}
          loading={loading}
          onOpen={() => setOpenSheet('deals')}
        />
      </div>

      {/* ── ITEM 59 — RECEIVABLES RE-CUT ────────────────────────── */}
      <div style={{ marginTop: 18 }}>
        <ReceivablesCard />
      </div>

      {/* ── ITEM 60 — SCROLL TAIL ────────────────────────────────── */}
      {/* 104px explicit tail element, not bottom padding */}
      <div style={{ height: 104, flexShrink: 0 }} />

      {/* Battle Plan sheet */}
      <BattlePlanSheet
        open={openSheet === 'battleplan'}
        onClose={() => setOpenSheet(null)}
        refreshKey={bpRefreshKey}
        onOpenTaskDetail={(task) => {
          setSelectedDetailTask(task as DetailTask)
          setTaskDetailOpen(true)
          onTaskDetailOpenChange?.(true)
        }}
      />

      <TaskDetailSheet
        open={taskDetailOpen}
        task={selectedDetailTask}
        onClose={() => { setTaskDetailOpen(false); setSelectedDetailTask(null); onTaskDetailOpenChange?.(false) }}
        onCompleted={(t) => { setTaskDetailOpen(false); setSelectedDetailTask(null); onTaskDetailOpenChange?.(false); setBpRefreshKey(k => k + 1) }}
        onSaved={() => { setTaskDetailOpen(false); setSelectedDetailTask(null); onTaskDetailOpenChange?.(false); setBpRefreshKey(k => k + 1) }}
        onDeleted={() => { setTaskDetailOpen(false); setSelectedDetailTask(null); onTaskDetailOpenChange?.(false) }}
      />

      {/* ── ITEM 66 — DealsSheet: FAB × while open (handled at root) */}
      <DealsSheet
        open={openSheet === 'deals'}
        onClose={() => setOpenSheet(null)}
        onOpenPortfolioCreate={() => setOpenSheet('portfoliocreate')}
        onOpenNewDeal={() => setOpenSheet('newdeal')}
      />

      <MoneyMoversSheet open={openSheet === 'moneymovers'} onClose={() => setOpenSheet(null)} />
      <DeadlinesSheet open={openSheet === 'deadlines'} onClose={() => setOpenSheet(null)} />
      <UnderContractSheet open={openSheet === 'undercontract'} onClose={() => setOpenSheet(null)} />

      <QuickActionsSheet
        open={openSheet === 'quickactions'}
        onClose={() => setOpenSheet(null)}
        onOpenVoiceNote={() => setOpenSheet('voicenote')}
        onOpenTask={() => { setOpenSheet(null); setTimeout(() => setOpenSheet('task'), 180) }}
        onOpenEvent={() => { setOpenSheet(null); setTimeout(() => setOpenSheet('event'), 180) }}
      />

      <TaskSheet open={openSheet === 'task'} onClose={() => setOpenSheet(null)} />
      <EventSheet open={openSheet === 'event'} onClose={() => setOpenSheet(null)} />
      <VoiceNoteSheet open={openSheet === 'voicenote'} onClose={() => setOpenSheet(null)} />

      <PortfolioCreateSheet
        open={openSheet === 'portfoliocreate'}
        onClose={() => setOpenSheet(null)}
        onCreated={() => setOpenSheet(null)}
      />

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
        @keyframes dealsRimSweep {
          0%   { transform: translateX(-100%) skewX(-20deg); opacity: 0; }
          10%  { opacity: 0.25; }
          40%  { opacity: 0.18; }
          60%  { opacity: 0; }
          100% { transform: translateX(300%) skewX(-20deg); opacity: 0; }
        }
        .deals-aperture-btn::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent);
          transform: translateX(-100%) skewX(-20deg);
          animation: dealsRimSweep 16s ease-in-out infinite;
          pointer-events: none;
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
      padding: '18px 18px 104px',
      background: T.bgBase,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    }}>
      <span style={styleT1}>{label}</span>
      <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>Coming in next step</span>
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
  const [openSheet, setOpenSheet] = useState<SheetId | null>(null)
  const [taskDetailSheetOpen, setTaskDetailSheetOpen] = useState(false)
  const [selectedDetailTask, setSelectedDetailTask] = useState<DetailTask | null>(null)
  const [taskDetailOpen, setTaskDetailOpen] = useState(false)

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

  const handleTilePress = useCallback((key: string) => {}, [])

  const handleFab = useCallback(() => {
    if (taskDetailOpen) {
      setTaskDetailOpen(false)
      setSelectedDetailTask(null)
      setTaskDetailSheetOpen(false)
    } else if (openSheet) {
      setOpenSheet(null)
    } else {
      setOpenSheet('quickactions')
    }
  }, [openSheet, taskDetailOpen])

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
      case 'home': return (
        <HomeScreen
          onTilePress={handleTilePress}
          openSheet={openSheet}
          setOpenSheet={setOpenSheet}
          onTaskDetailOpenChange={setTaskDetailSheetOpen}
          selectedDetailTask={selectedDetailTask}
          setSelectedDetailTask={setSelectedDetailTask}
          taskDetailOpen={taskDetailOpen}
          setTaskDetailOpen={setTaskDetailOpen}
        />
      )
      case 'deals': return <PlaceholderScreen label="DEALS" />
      case 'money': return <PlaceholderScreen label="MONEY" />
      case 'more':  return <PlaceholderScreen label="MORE" />
    }
  }

  return (
    // ── ITEM 54 — IDENTITY BLOCK FIXED CHROME ──────────────────────────────
    // The outer wrapper is position:fixed, full viewport.
    // Inside: ONE fixed identity block pinned to top, scrolling body underneath.
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      width: '100vw',
      background: T.bgBase,
      overflow: 'hidden',
      position: 'fixed',
      inset: 0,
    }}>

      {/* ── ITEM 54 + 55 — IDENTITY BLOCK ─────────────────────────────────────
          ONE fixed block: status area + identity row = zero gap between.
          Height = env(safe-area-inset-top) + 14px gap + 56px row. Never a typed literal.
          NO hairline, no bottom border. Block does NOT scroll away.
          Scrolling body starts at this computed height via paddingTop on scroll container.
      */}
      <div
        id="identity-block"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          // Height is computed: safe-area + 14px gap + 56px row
          // We express this as paddingTop for the status area + explicit row height
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 0,
          background: T.bgBase,
          zIndex: 50,
          // NO hairline, no border-bottom
        }}
      >
        {/* 14px gap between status area bottom and identity row */}
        <div style={{ height: 14 }} />

        {/* ── ITEM 55 — IDENTITY ROW ───────────────────────────────
            56px tall, flex, 18px side padding, 12px gap
        */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          height: 56,
          paddingLeft: 18,
          paddingRight: 18,
          boxSizing: 'border-box',
        }}>
          {/* 48px app mark — NO CSS halo, no radius, no plate */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/mark-256.png"
            alt=""
            width={48}
            height={48}
            style={{ display: 'block', flexShrink: 0 }}
          />

          {/* SHIRLEYCRE wordmark — height 48px only, NEVER width typed */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/wordmark/shirleycre-h144.png"
            alt="SHIRLEYCRE"
            style={{ height: 48, width: 'auto', display: 'block', flexShrink: 0 }}
          />

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Date — right-aligned, brand-lift */}
          <span style={{
            fontFamily: FONT_MONO,
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: T.brandLift,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}>{formatDateLabel()}</span>
        </div>
        {/* NO margin/spacer below row inside block */}
      </div>

      {/* Scroll body — starts BELOW the fixed identity block.
          paddingTop must equal identity block's visual height: safe-area + 14px + 56px
          We use a CSS calc() so it's never a typed literal.
          The safe-area variable resolves to the device value at runtime.
      */}
      <div style={{
        flex: 1,
        // Offset the fixed header. calc(env(...) + 14px + 56px)
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px + 56px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }}>
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
      </div>

      <BottomTabBar
        active={activeTab}
        onTab={setActiveTab}
        onFab={handleFab}
        fabOpen={openSheet !== null || taskDetailOpen}
      />
    </div>
  )
}

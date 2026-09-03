'use client'

// /warroom3 — ShirleyCRE mobile spec — Items 89-97 HOME 72a build
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
  noCorner?: boolean   // CONTRACTS tile has no corner metric
  spineOverride?: string
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
  const m = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'numeric' })
  const d = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', day: 'numeric' })
  return `${m}.${d}`
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
      .select('id, status')
      .eq('status', 'hot')
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

  // ── Urgent item ────────────────────────────────────────────────────────────
  let urgentItem: UrgentItem | null = null

  if (dlPastDue.length > 0) {
    const oldest = dlPastDue[0] as any
    const days = daysUntilDate(oldest.deadline_date)
    const shortAddr = formatAddress(oldest.deals) || oldest.deals?.name || 'Deal'
    const typeLabel = (oldest.deadline_type as string).replace(/_/g, ' ')
    urgentItem = {
      deadlineType: typeLabel,
      daysUntil: days,
      title: typeLabel.toUpperCase(),
      shortAddress: shortAddr.toUpperCase(),
    }
  } else {
    const soon = dlForward.filter((d: any) => daysUntilDate(d.deadline_date) <= 10)
    if (soon.length > 0) {
      const nearest = soon[0] as any
      const days = daysUntilDate(nearest.deadline_date)
      const shortAddr = formatAddress(nearest.deals) || nearest.deals?.name || 'Deal'
      const typeLabel = (nearest.deadline_type as string).replace(/_/g, ' ')
      urgentItem = {
        deadlineType: typeLabel,
        daysUntil: days,
        title: typeLabel.toUpperCase(),
        shortAddress: shortAddr.toUpperCase(),
      }
    }
  }

  // ── Tile counts ───────────────────────────────────────────────────────────
  const allTasks = tasks as any[]
  const bpTotal = allTasks.length
  const bpOverdue = allTasks.filter(t => t.due_date && t.due_date < today).length
  const bpHot = allTasks.filter(t => t.due_date && t.due_date >= today && daysUntilDate(t.due_date) <= 7).length

  const mmTotal = mmDeals.length  // hot deals count
  const mmHot = 0                 // no corner on MM tile

  const dlTotal = dlPastDue.length + dlForward.length
  const dlOverdue = dlPastDue.length
  const dlHot = dlForward.filter((d: any) => { const days = daysUntilDate(d.deadline_date); return days >= 0 && days <= 7 }).length

  const ucTotal = ucDeals.length

  const tiles: TileStat[] = [
    {
      label: 'TO DO',
      count: bpTotal,
      urgentCount: bpOverdue > 0 ? bpOverdue : bpHot,
      urgentToken: bpOverdue > 0 ? 'late' : bpHot > 0 ? 'hot' : null,
      panelKey: 'battleplan',
      fetchFailed: tasksFailed,
      spineOverride: '#34D399',
    },
    {
      label: 'MONEY MOVERS',
      count: mmTotal,
      urgentCount: mmHot,
      urgentToken: mmHot > 0 ? 'hot' : null,
      panelKey: 'moneymovers',
      noCorner: true,
      spineOverride: '#FFA23A',  // amber spine always
      fetchFailed: false,        // never show ERR on MM tile
    },
    {
      label: 'DEADLINES',
      count: dlTotal,
      urgentCount: dlOverdue > 0 ? dlOverdue : dlHot,
      urgentToken: dlOverdue > 0 ? 'late' : dlHot > 0 ? 'hot' : null,
      urgentLabel: dlOverdue > 0 ? 'LATE' : 'URGENT',
      panelKey: 'deadlines',
      fetchFailed: deadlinesFailed,
    },
    {
      label: 'CONTRACTS',
      count: ucTotal,
      urgentCount: 0,
      urgentToken: null,
      panelKey: 'undercontract',
      fetchFailed: ucFailed,
      noCorner: true,
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
    dealsControl: { hotCount, ucCount, activeCount, pipelineCount, total: hotCount + ucCount + activeCount + pipelineCount },
  }
}

// ── Item 91 — Urgent Row (2-line, 72a spec) ────────────────────────────────
function UrgentRow({ item }: { item: UrgentItem }) {
  const days = item.daysUntil
  // NEVER add LATE or PAST — just the absolute day count + D
  const dayCount = Math.abs(days) + 'D'

  return (
    <div style={{
      margin: '0 -18px',
      padding: '0 18px',
      background: '#0F0E17',
      boxShadow: 'inset 0 1px 0 rgba(0,0,0,.60), inset 0 -1px 0 rgba(255,255,255,.05)',
      position: 'relative',
    }}>
      {/* Red spine — lives in well div so overflow:hidden on row doesn't clip it */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        background: '#FF4D4D',
      }} />
    <div style={{
      height: 66,
      boxSizing: 'border-box',
      padding: '13px 0 0 13px',
      position: 'relative',
      overflow: 'hidden',
      flexShrink: 0,
    }}>

      {/* Line 1: DEADLINE label centred + day count right */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'baseline',
      }}>
        {/* DEADLINE — absolute, centres on the column */}
        <span style={{
          position: 'absolute',
          left: -13,
          right: 0,
          textAlign: 'center',
          fontFamily: FONT_MONO,
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: T.textLow,
          lineHeight: 1,
        }}>DEADLINE</span>

        {/* Spacer — occupies flex width so day count goes to right */}
        <div style={{ flex: 1 }} />

        {/* Day count — right-aligned, red */}
        <span style={{
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '0.05em',
          color: '#FF4D4D',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: FONT_MONO,
          flexShrink: 0,
          lineHeight: 1,
        }}>{dayCount}</span>
      </div>

      {/* Line 2: type + address */}
      <div style={{
        marginTop: 12,
        display: 'flex',
        alignItems: 'baseline',
      }}>
        {/* Type — flex:1, truncates */}
        <span style={{
          fontSize: 19,
          fontFamily: FONT_DISPLAY,
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: '#EFEEF4',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1,
        }}>{item.title}</span>

        {/* Address — fixed right */}
        <span style={{
          fontSize: 12.5,
          fontFamily: 'system-ui',
          fontWeight: 400,
          color: T.textMid,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          lineHeight: 1,
          marginLeft: 8,
        }}>{item.shortAddress}</span>
      </div>
    </div>
    </div>
  )
}

// ── Item 92 — Panel Tile (four doors) ─────────────────────────────────────
function PanelTile({ stat, onPress }: { stat: TileStat; onPress: () => void }) {
  const [pressed, setPressed] = React.useState(false)
  const hasUrgency = !stat.fetchFailed && stat.urgentToken !== null && stat.urgentCount > 0
  const spineColor = stat.spineOverride ?? (stat.urgentToken === 'late' ? '#FF4D4D' : '#FFA23A')
  const cornerColor = stat.urgentToken === 'late' ? '#FF4D4D' : '#FFA23A'
  const showSpine = !!stat.spineOverride || (hasUrgency && !stat.noCorner)
  const cornerText = stat.urgentCount > 0 ? `${stat.urgentCount}` : null

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
        height: 78,
        borderRadius: 14,
        background: '#12111B',
        border: '1px solid rgba(255,255,255,.14)',
        padding: '13px 13px 12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
        transition: 'transform 90ms ease',
        textAlign: 'left',
        width: '100%',
      } as React.CSSProperties}
    >
      {/* Spine — when spineOverride exists OR has urgency and not CONTRACTS */}
      {showSpine && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: spineColor,
        }} />
      )}

      {/* Top row: figure + corner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        {/* Figure */}
        {stat.fetchFailed ? (
          <span style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: '#FF4D4D',
            fontFamily: FONT_DISPLAY,
            lineHeight: 1,
          }}>!</span>
        ) : (
          <span style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: '#EFEEF4',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: FONT_DISPLAY,
            lineHeight: 1,
          }}>{stat.count}</span>
        )}

        {/* Corner metric — absent for CONTRACTS and quiet tiles */}
        {!stat.noCorner && !stat.fetchFailed && hasUrgency && cornerText && (
          <span style={{
            fontSize: 9.5,
            fontWeight: 500,
            letterSpacing: '0.11em',
            marginTop: 3,
            fontFamily: FONT_MONO,
            lineHeight: 1,
            color: cornerColor,
          }}>{cornerText}</span>
        )}
        {stat.fetchFailed && (
          <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500, color: '#FF4D4D', lineHeight: 1, marginTop: 3 }}>ERR</span>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Label — bottom */}
      <span style={{
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '0.13em',
        textTransform: 'uppercase',
        color: T.textMid,
        fontFamily: FONT_MONO,
        lineHeight: 1,
      }}>{stat.label}</span>
    </button>
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
  // Item 94: pressed state for DEALS plate
  const [dealPressed, setDealPressed] = useState(false)

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

  const { hotCount, ucCount, total } = dealsControl
  const pctHot = total > 0 ? ((hotCount / total) * 100).toFixed(1) : '0'
  const pctUC  = total > 0 ? ((ucCount  / total) * 100).toFixed(1) : '0'

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '0 18px 0',
      background: T.bgBase,
    }}>

      {/* ── Item 91 — URGENT ROW ────────────────────────────────── */}
      {!loading && urgentItem && (
        <UrgentRow item={urgentItem} />
      )}

      {/* ── Item 92 — FOUR DOORS TILE GRID ─────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 11,
        marginTop: 22,
      }}>
        {loading ? (
          [0,1,2,3].map(i => (
            <div key={i} style={{
              height: 78,
              borderRadius: 14,
              background: T.bgPanel,
              border: '1px solid rgba(255,255,255,0.14)',
              opacity: 0.4,
            }} />
          ))
        ) : (
          tiles.map((stat) => {
            const onPress = () => {
              if (stat.panelKey === 'battleplan') setOpenSheet('battleplan')
              else if (stat.panelKey === 'moneymovers') setOpenSheet('moneymovers')
              else if (stat.panelKey === 'deadlines') setOpenSheet('deadlines')
              else if (stat.panelKey === 'undercontract') setOpenSheet('undercontract')
              else onTilePress(stat.panelKey)
            }
            return <PanelTile key={stat.panelKey} stat={stat} onPress={onPress} />
          })
        )}
      </div>

      {/* ── Item 93 — DEALS BAND ────────────────────────────────── */}

      {/* Stat trio */}
      <div style={{
        marginTop: 26,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 18,
      }}>
        {/* Left: hot count + HOT label below */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
          <span style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: '#FFA23A',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            lineHeight: 1,
          }}>{loading ? '—' : hotCount}</span>
          <span style={{
            fontSize: 9.5,
            fontWeight: 500,
            letterSpacing: '0.11em',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            lineHeight: 1,
            color: '#FFA23A',
            marginTop: 9,
          }}>HOT</span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 38, background: 'rgba(255,255,255,.12)', flexShrink: 0 }} />

        {/* Middle: UC count + UNDER CONTRACT label below */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <span style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: '#EFEEF4',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: FONT_DISPLAY,
            lineHeight: 1,
          }}>{loading ? '—' : ucCount}</span>
          <span style={{
            fontSize: 9.5,
            fontWeight: 500,
            letterSpacing: '0.11em',
            fontFamily: FONT_MONO,
            lineHeight: 1,
            color: T.textMid,
            textTransform: 'uppercase' as const,
          }}>UNDER CONTRACT</span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right: total + TOTAL label below */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: T.textMid,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: FONT_DISPLAY,
            lineHeight: 1,
          }}>{loading ? '—' : total}</span>
          <span style={{
            fontSize: 9.5,
            fontWeight: 500,
            letterSpacing: '0.11em',
            fontFamily: FONT_MONO,
            lineHeight: 1,
            color: T.textLow,
            textTransform: 'uppercase' as const,
          }}>TOTAL</span>
        </div>
      </div>

      {/* Proportion bar — 3 segments, 3px gaps */}
      <div style={{
        marginTop: 18,
        display: 'flex',
        gap: 3,
        height: 5,
      }}>
        {!loading && hotCount > 0 && (
          <div style={{ flex: `0 0 ${pctHot}%`, background: '#FFA23A', borderRadius: 2 }} />
        )}
        {!loading && ucCount > 0 && (
          <div style={{ flex: `0 0 ${pctUC}%`, background: '#D9D7E2', borderRadius: 2 }} />
        )}
        <div style={{ flex: 1, background: '#33323F', borderRadius: 2 }} />
      </div>

      {/* ── Item 95 — RECEIVABLES RE-CUT ────────────────────────── */}
      <div style={{ marginTop: 8 }}>
        <ReceivablesCard />
      </div>

      {/* ── Item 94 — DEALS PLATE (raster asset) — moved under receivables ── */}
      <div style={{ marginTop: 18 }}>
        <button
          onClick={() => setOpenSheet('deals')}
          aria-label="Open deals"
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
            transform: dealPressed ? 'translateY(2px)' : 'none',
            filter: dealPressed
              ? 'drop-shadow(0 2px 4px rgba(0,0,0,.8))'
              : 'drop-shadow(0 6px 10px rgba(0,0,0,.75)) drop-shadow(0 1px 0 rgba(255,255,255,.10))',
            transition: 'transform 120ms ease-out, filter 120ms ease-out',
          } as React.CSSProperties}
          onMouseDown={() => setDealPressed(true)}
          onMouseUp={() => setDealPressed(false)}
          onMouseLeave={() => setDealPressed(false)}
          onTouchStart={() => setDealPressed(true)}
          onTouchEnd={() => setTimeout(() => setDealPressed(false), 120)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/deals/deals-pill-v2.png"
            width={354}
            height={52}
            alt="DEALS"
            style={{ display: 'block' }}
          />
        </button>
      </div>

      {/* ── Item 97 — SCROLL TAIL (104px clearance) ─────────────── */}
      <div style={{ height: 104, flexShrink: 0 }} />

      {/* ── Sheets ───────────────────────────────────────────────── */}
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
        onCompleted={() => { setTaskDetailOpen(false); setSelectedDetailTask(null); onTaskDetailOpenChange?.(false); setBpRefreshKey(k => k + 1) }}
        onSaved={() => { setTaskDetailOpen(false); setSelectedDetailTask(null); onTaskDetailOpenChange?.(false); setBpRefreshKey(k => k + 1) }}
        onDeleted={() => { setTaskDetailOpen(false); setSelectedDetailTask(null); onTaskDetailOpenChange?.(false) }}
      />

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
      <span style={{
        fontFamily: FONT_MONO,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: T.textMid,
      }}>{label}</span>
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

      {/* ── Item 90 — IDENTITY BLOCK (fixed) ──────────────────────────────── */}
      <div
        id="identity-block"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: 'max(env(safe-area-inset-top, 0px), 44px)',
          background: '#08080C',
          zIndex: 50,
        }}
      >
        {/* 0px spacer — row sits directly against safe-area */}
        <div style={{ height: 0 }} />

        {/* Identity row — 80px, flex, 18px padding, 13px gap */}
        <div style={{
          height: 80,
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          boxSizing: 'border-box',
          gap: 13,
        }}>
          {/* Star mark — 80×80 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/mark-star-256.png"
            width={80}
            height={80}
            alt=""
            style={{ display: 'block', flexShrink: 0 }}
          />

          {/* Wordmark — 252×66, optical offset top:-1 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/wordmark/shirleycre-glow-1269.png"
            alt="SHIRLEYCRE"
            style={{
              width: 252,
              height: 66,
              position: 'relative',
              top: -1,
              flexShrink: 0,
              display: 'block',
            }}
          />

          {/* Date — marginLeft:auto (NOT a flex:1 div), #8E8CA0, marginTop:1 drops 1px */}
          <span style={{
            marginLeft: 'auto',
            marginTop: 1,
            fontFamily: FONT_MONO,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#8E8CA0',
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}>{formatDateLabel()}</span>
        </div>
      </div>

      {/* Scroll body — offset by identity block height */}
      <div style={{
        flex: 1,
        paddingTop: 'calc(max(env(safe-area-inset-top, 0px), 44px) + 80px)',
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

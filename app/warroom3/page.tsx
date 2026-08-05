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
import { supabase } from '@/lib/supabase'

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

// T1 §3.2 — 10.5px / 500 / 0.14em / UPPER / text-mid — section labels
const styleT1: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: T.textMid,
  lineHeight: 1,
}

// T2 §3.2 — 9.5px / 500 / 0.19em / UPPER / text-low — micro labels, eyebrows
const styleT2: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9.5,
  fontWeight: 500,
  letterSpacing: '0.19em',
  textTransform: 'uppercase',
  color: T.textLow,
  lineHeight: 1,
}

// T3 §3.2 — 14.5px / 500 / 0 / sentence / text-hi — row primary
const styleT3: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 14.5,
  fontWeight: 500,
  color: T.textHi,
  lineHeight: 1.25,
}

// T4 §3.2 — 11.5px / 400 / 0 / sentence / text-mid — row secondary
const styleT4: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 11.5,
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
  panelKey: string
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
    // Deadlines: 45-day window, not satisfied — matches SchedulePanel liveDeadlines
    supabase
      .from('contract_deadlines')
      .select('id, deadline_type, deadline_date, status, deals(name, address)')
      .neq('status', 'satisfied')
      .gte('deadline_date', today)
      .lte('deadline_date', (() => {
        const d = new Date(); d.setDate(d.getDate() + 45)
        return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
      })())
      .order('deadline_date', { ascending: true })
      .limit(50),
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

  const tasks     = (tasksRes.status     === 'fulfilled' ? tasksRes.value.data     : null) ?? []
  const deadlines = (deadlinesRes.status === 'fulfilled' ? deadlinesRes.value.data : null) ?? []
  const mmDeals   = (mmRes.status        === 'fulfilled' ? mmRes.value.data        : null) ?? []
  const ucDeals   = (ucRes.status        === 'fulfilled' ? ucRes.value.data        : null) ?? []

  // ── Hero card: nearest hard deadline, else oldest overdue task ──
  let hero: HeroItem | null = null

  if (deadlines.length > 0) {
    const nearest = deadlines[0] as any
    const days = daysUntil(nearest.deadline_date)
    const dealName = nearest.deals?.address || nearest.deals?.name || 'Deal'
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
      const deal = (oldest.deals as any)?.address || (oldest.deals as any)?.name || null
      hero = {
        title: oldest.title || 'Overdue task',
        subtitle: deal || '',
        accentToken: 'late',
        type: 'task',
      }
    }
  }

  // ── Tile counts — each mirrors its /warroom panel source ──
  const allTasks = tasks as any[]
  const allDeadlines = deadlines as any[]

  // Battle Plan: open/in_progress tasks — same population as BattlePlanPanel
  const bpTotal = allTasks.length
  const bpOverdue = allTasks.filter(t => t.due_date && t.due_date < today).length
  const bpHot = allTasks.filter(t => t.due_date && t.due_date >= today && daysUntil(t.due_date) <= 7).length

  // Money Movers: exact HotPanel predicate = status='hot'. All results ARE hot.
  // Total and HOT chip both come from the same result set — agreement by construction.
  const mmTotal = mmDeals.length
  const mmHot = mmDeals.length  // every deal in result has status=hot

  // Deadlines: 45-day window, not satisfied — same as SchedulePanel liveDeadlines
  const dlTotal = allDeadlines.length
  const dlOverdue = allDeadlines.filter((d: any) => daysUntil(d.deadline_date) < 0).length
  const dlHot = allDeadlines.filter((d: any) => { const days = daysUntil(d.deadline_date); return days >= 0 && days <= 7 }).length

  // Under Contract: same as UnderContractPanel
  const ucTotal = ucDeals.length

  const tiles: TileStat[] = [
    {
      label: 'Battle Plan',
      count: bpTotal,
      urgentCount: bpOverdue > 0 ? bpOverdue : bpHot,
      urgentToken: bpOverdue > 0 ? 'late' : bpHot > 0 ? 'hot' : null,
      panelKey: 'battleplan',
    },
    {
      label: 'Money Movers',
      count: mmTotal,
      urgentCount: mmHot,
      urgentToken: mmHot > 0 ? 'hot' : null,
      panelKey: 'moneymovers',
    },
    {
      label: 'Deadlines',
      count: dlTotal,
      urgentCount: dlOverdue > 0 ? dlOverdue : dlHot,
      urgentToken: dlOverdue > 0 ? 'late' : dlHot > 0 ? 'hot' : null,
      panelKey: 'deadlines',
    },
    {
      label: 'Under Contract',
      count: ucTotal,
      urgentCount: 0,
      urgentToken: null,
      panelKey: 'undercontract',
    },
  ]

  return { hero, tiles }
}

// ── Hero Card §5.10 ───────────────────────────────────────────────────────────
// §5.10: bg rgba(255,255,255,0.03), border-default, radius 20px, padding 20px,
// late spine. T2 eyebrow → 12px → D3 statement → 9px → T4 location →
// 17px → primary + secondary button row.
function HeroCard({ item, onAction }: { item: HeroItem; onAction?: () => void }) {
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
      {/* §5.10 step 4: primary + secondary button row §5.4 */}
      <div style={{ display: 'flex', gap: 9 }}>
        <button
          onClick={onAction}
          style={{
            flex: 1,
            // §5.4 Primary: background #EFEEF4, color #0A0A0F, radius 9px, padding 12px 0
            background: '#EFEEF4',
            color: '#0A0A0F',
            border: 'none',
            borderRadius: 9,
            padding: '12px 0',
            fontFamily: FONT_DISPLAY,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            minHeight: 44,  // §11.2 tap target
            WebkitTapHighlightColor: 'transparent',
          } as React.CSSProperties}
        >
          Open
        </button>
        <button
          style={{
            flex: 1,
            // §5.4 Secondary: border rgba(255,255,255,0.13), color text-mid, radius 9px
            background: 'transparent',
            color: T.textMid,
            border: '1px solid rgba(255,255,255,0.13)',
            borderRadius: 9,
            padding: '12px 0',
            fontFamily: FONT_DISPLAY,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            minHeight: 44,
            WebkitTapHighlightColor: 'transparent',
          } as React.CSSProperties}
        >
          Dismiss
        </button>
      </div>
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
  const hasSpine = stat.urgentToken !== null && stat.urgentCount > 0
  const spineColor = stat.urgentToken === 'late' ? T.late : stat.urgentToken === 'hot' ? T.hot : T.brand
  // §5.2: spined row gets 5% tint of accent as bg
  const spineBg = stat.urgentToken === 'late'
    ? 'rgba(255,77,77,0.05)'
    : stat.urgentToken === 'hot'
    ? 'rgba(255,162,58,0.05)'
    : 'transparent'

  // T5 status note color: urgent count in its accent, else text-low
  const statusColor = stat.urgentToken === 'late'
    ? T.late
    : stat.urgentToken === 'hot'
    ? T.hot
    : T.textLow

  // Status note text: "5 LATE" | "2 HOT" | "LANDED" (money-in) | neutral count in text-low
  const statusNote = stat.urgentCount > 0
    ? `${stat.urgentCount} ${stat.urgentToken === 'late' ? 'LATE' : 'HOT'}`
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
        background: hasSpine ? spineBg : T.bgPanel,
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
        {/* D2 §3.2: 32px / 700 / -0.03em / text-hi */}
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
        {/* T5 §3.2: JetBrains Mono 9px / 500 / 0.11em / UPPER */}
        {statusNote ? (
          <span style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.11em',
            textTransform: 'uppercase',
            color: statusColor,
            lineHeight: 1,
            marginTop: 4,
          }}>
            {statusNote}
          </span>
        ) : null}
      </div>

      {/* Row 3: T1 label — 18px gap above per §5.6 */}
      <div style={{ ...styleT1, marginTop: 18 }}>{stat.label}</div>
    </button>
  )
}

// ── Home Screen §6 ────────────────────────────────────────────────────────────
type SheetId = 'battleplan' | 'deals' | 'moneymovers' | 'deadlines' | 'undercontract'

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
      padding: '14px 18px 104px',
      background: T.bgBase,
    }}>
      {/* §6 item 2: Identity row
          30px app mark (radius 9), stacked T2 date + T3 greeting, 34px round search button.
          No glow on the mark — FAB is the one glow per §4.3 / §11.4. */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* App mark — official mark-64.png at 30px per WHERE-TO-USE-WHAT §4.
              No CSS glow, no box-shadow — glow is in the pixels (README §notes). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/mark-64.png"
            alt=""
            width={30}
            height={30}
            style={{ flexShrink: 0, display: 'block' }}
          />
          {/* Stacked date + greeting */}
          <div>
            {/* T2 date — per §6 */}
            <div style={{ ...styleT2, marginBottom: 3 }}>{dateLabel}</div>
            {/* T3 greeting — sentence case / Space Grotesk */}
            <div style={{ ...styleT3, fontSize: 15 }}>War Room</div>
          </div>
        </div>

        {/* 34px round search button — §6 item 2 */}
        <button
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: T.bgRaise,
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            WebkitTapHighlightColor: 'transparent',
            minWidth: 44, minHeight: 44,  // §11.2 tap target
          } as React.CSSProperties}
          aria-label="Search"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
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
          <HeroCard item={hero} />
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

      {/* Deals sheet — §12 step 5 */}
      <DealsSheet
        open={openSheet === 'deals'}
        onClose={() => setOpenSheet(null)}
        initialSearch={dealsSearch}
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

  // FAB tap: if a sheet is open, close it; otherwise no-op (future: open new-item sheet)
  const handleFab = useCallback(() => {
    if (openSheet) setOpenSheet(null)
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

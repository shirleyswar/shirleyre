'use client'

// Battle Plan bottom sheet — §5.11 + §12 step 4
// §5.11.1: Rows are hairline-separated. NO border, NO radius, NO background fill.
// §5.11.2: No red tint on overdue rows. Spine only.
// §14.9: Four buckets — OVERDUE · TODAY · LATER · NO DUE DATE
// §10 item 14: "View closed" link is RETIRED — not built here.
// All type references bound to §3.2 named levels. No pixel literals for text.

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import BottomSheet from '@/components/warroom3/BottomSheet'
import ListRow from '@/components/warroom3/ListRow'

// §3.1 / §3.2 — UPPERCASE → JetBrains Mono · sentence case → Space Grotesk
const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

// §18.10 check 11 — derive, never a literal
const TAB_BAR      = 94   // §5.7
const FAB_LIFT     = 23   // §5.7
const TAB_PAD_TOP  = 0    // measured: BottomTabBar has no padding-top
const CLEARANCE    = 14
const FOOTER_BOTTOM = TAB_BAR + FAB_LIFT - TAB_PAD_TOP + CLEARANCE  // = 131

const T = {
  textHi:    '#EFEEF4',
  textMid:   '#B8B6C6',
  textLow:   '#8E8CA0',
  late:      '#FF4D4D',
  hot:       '#FFA23A',
  brand:     '#8B5CF6',
  brandLift: '#A78BFA',
} as const

// T2 §3.2 — 12px / 500 / 0.15em / UPPER / text-low — group headers (44a type scale)
const styleT2: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  lineHeight: 1,
}

function todayCST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function daysOverdue(dateStr: string): number {
  const now = new Date(); now.setHours(0,0,0,0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.floor((now.getTime() - target.getTime()) / 86400000)
}

interface Task {
  id: string
  title: string
  status: string
  due_date: string | null
  deal_id: string | null
  is_life: boolean
  is_entity: boolean
  entity_id: string | null  // CODE: task.entity_id FK added — nullable, beside is_life|is_entity
  sort_order: number | null
  created_at: string
  deals?: { name?: string; address?: string; addr_display?: string | null; addr_street_name?: string | null; addr_number?: string | null; addr_city?: string | null } | null
  entities?: { name?: string } | null  // joined from entity_id FK
}

interface BattlePlanSheetProps {
  open: boolean
  onClose: () => void
  onOpenTaskDetail?: (task: Task) => void  // lifted to page — FAB × works automatically
  refreshKey?: number  // bump to force re-fetch after a task save (title edit, etc.)
}

// §5.1 Group header: T2 label · hairline · count
function GroupHeader({
  label,
  labelColor,
  count,
}: {
  label: string
  labelColor: string
  count: number
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      // §5.11.3: margin 20px 0 4px
      margin: '20px 18px 4px',
    }}>
      <span style={{ ...styleT2, color: labelColor }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.11)' }} />
      <span style={{
        fontFamily: FONT_MONO,
        fontSize: 12,
        fontWeight: 500,
        color: T.textLow,
        fontVariantNumeric: 'tabular-nums',
      }}>{count}</span>
    </div>
  )
}

// Sort helper — keeps tasks in bucket order after optimistic updates
function sortTasks(tasks: Task[]): Task[] {
  const today = todayCST()
  return [...tasks].sort((a, b) => {
    const aOverdue = !!(a.due_date && a.due_date < today)
    const bOverdue = !!(b.due_date && b.due_date < today)
    if (aOverdue && !bOverdue) return -1
    if (!aOverdue && bOverdue) return 1
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
    if (a.due_date) return -1
    if (b.due_date) return 1
    if (a.sort_order !== null && b.sort_order !== null) return a.sort_order - b.sort_order
    return a.created_at.localeCompare(b.created_at)
  })
}

// §13.1 SwipeRow — swipe right to complete, swipe left to expose Tomorrow/Next week
function SwipeRow({ task, children, onSwipeRight, onSwipeLeft, onNextWeek }: {
  task: Task
  children: React.ReactNode
  onSwipeRight: () => void
  onSwipeLeft: () => void
  onNextWeek: () => void
}) {
  const [startX, setStartX] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const THRESHOLD = 80

  // Reveal visibility: only show the relevant panel based on swipe direction.
  // Neither panel is visible at rest (offsetX === 0).
  const showRight = offsetX > 0   // swiping right → green DONE
  const showLeft  = offsetX < 0   // swiping left  → Tomorrow / Next week

  // Whether either reveal is open (snapped, not just mid-swipe)
  const revealOpen = offsetX === 188 || offsetX === -188

  return (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight: 64 }}>
      {/* Left reveal (swipe right exposes): green DONE — hidden unless swiping right. §13.1 gradient recolour (P1C). */}
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 50% 30%, #87DFBE 0%, #31A870 45%, #0E4B34 100%)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.25)', display: (showRight || offsetX === 188) ? 'flex' : 'none', alignItems:'center', paddingLeft:18 }}>
        <span style={{ fontFamily:"'Space Grotesk',system-ui,sans-serif", fontSize:14.5, fontWeight:700, letterSpacing:'0.02em', color:'#0A2E20', textTransform:'uppercase' }}>✓ DONE</span>
      </div>
      {/* Right reveal (swipe left exposes): Tomorrow + Next week — hidden unless swiping left. §13.1 gradient recolour (P1C). Width 94px (was 74). */}
      <div style={{ position:'absolute', inset:0, display: (showLeft || offsetX === -188) ? 'flex' : 'none', justifyContent:'flex-end', alignItems:'stretch' }}>
        <button
          onClick={() => { onSwipeLeft(); setOffsetX(0) }}
          style={{ width:94, background:'radial-gradient(circle at 50% 30%, #FFDDA8 0%, #FFA23A 48%, #B36A12 100%)', border:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2 }}>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:700, color:'#4A2A05', lineHeight:1 }}>›</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:700, letterSpacing:'0.11em', color:'#4A2A05', textTransform:'uppercase', lineHeight:1 }}>TOMORROW</span>
        </button>
        <button
          onClick={() => { setOffsetX(0); onNextWeek() }}
          style={{ width:94, background:'rgba(255,255,255,0.12)', border:'none', cursor:'pointer', fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:700, letterSpacing:'0.11em', color:'#B8B6C6', textTransform:'uppercase' }}>Next week</button>
      </div>
      {/* Row content — translates on swipe.
          When reveal is snapped open, pointer-events are disabled on the content div
          so taps pass through to the reveal buttons beneath it. */}
      <div
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? 'none' : 'transform 0.2s ease',
          pointerEvents: revealOpen ? 'none' : 'auto',
        }}
        onTouchStart={e => { if (revealOpen) { setOffsetX(0); return } setStartX(e.touches[0].clientX); setSwiping(true) }}
        onTouchMove={e => { if (!swiping) return; setOffsetX(e.touches[0].clientX - startX) }}
        onTouchEnd={() => {
          if (!swiping) return
          setSwiping(false)
          if (offsetX > THRESHOLD) { onSwipeRight(); setOffsetX(0) }
          else if (offsetX < -THRESHOLD) { /* reveal stays exposed for tap */ setOffsetX(-188) }
          else { setOffsetX(0) }
        }}
      >
        {children}
      </div>
    </div>
  )
}

export default function BattlePlanSheet({ open, onClose, onOpenTaskDetail, refreshKey = 0 }: BattlePlanSheetProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // §13.3 confirmation bar state
  const [completionBar, setCompletionBar] = useState<Task | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setLoadError(false)
    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('id, title, status, due_date, deal_id, is_life, is_entity, entity_id, sort_order, created_at, deals(name, address, addr_display, addr_street_name, addr_number, addr_city), entities(name)')
          .eq('status', 'open')  // tasks table: 'open' and 'complete' only
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
          .limit(200)
        if (error) { setLoadError(true); setLoading(false); return }
        if (!data) { setLoading(false); return }

        const today = todayCST()
        const sorted = [...(data as Task[])].sort((a, b) => {
          const aOverdue = !!(a.due_date && a.due_date < today)
          const bOverdue = !!(b.due_date && b.due_date < today)
          if (aOverdue && !bOverdue) return -1
          if (!aOverdue && bOverdue) return 1
          if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
          if (a.due_date) return -1
          if (b.due_date) return 1
          if (a.sort_order !== null && b.sort_order !== null) return a.sort_order - b.sort_order
          return a.created_at.localeCompare(b.created_at)
        })
        setTasks(sorted)
        setLoading(false)
      } catch {
        setLoadError(true)
        setLoading(false)
      }
    }
    run()
  }, [open, retryCount, refreshKey])

  const today = todayCST()

  // §14.9: Four buckets — OVERDUE · TODAY · LATER · NO DUE DATE
  const overdue  = tasks.filter(t => t.due_date && t.due_date < today)
  const todayBkt = tasks.filter(t => t.due_date && t.due_date === today)
  const later    = tasks.filter(t => t.due_date && t.due_date > today)
  const noDate   = tasks.filter(t => !t.due_date)

  function renderRow(task: Task) {
    const isOverdue = !!(task.due_date && task.due_date < today)
    const isToday   = task.due_date === today

    // Spine color — overdue = late, today = hot, later/no-date = none
    const spineColor: string | null = isOverdue ? T.late : isToday ? T.hot : null

    // Day count label — same accent as spine, never the background
    let dayCount: string | null = null
    let dayCountColor: string | null = null
    if (isOverdue && task.due_date) {
      const n = daysOverdue(task.due_date)
      dayCount = n === 0 ? 'TODAY' : `${n}D LATE`
      dayCountColor = T.late
    } else if (isToday) {
      dayCount = 'TODAY'
      dayCountColor = T.hot
    } else if (task.due_date) {
      // Format future date as "AUG 12"
      const [y, m, d] = task.due_date.split('-').map(Number)
      dayCount = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
      dayCountColor = T.textLow
    }

    const dealAddr = (task.deals as any)?.address || null
    const dealName = (task.deals as any)?.name || null
    // entity name from FK join (CODE: task.entity_id → entities.name)
    const entityName = (task.entities as any)?.name || null

    // §5.11.5 meta line decision:
    // - task on a deal → metaDeal (address preferred over name)
    // - task on entity (entity_id or is_entity) → metaBadge (entity name or ENTITY tag)
    // - task on life (is_life) → metaBadge LIFE
    // Badge and day count never contend — entity/life tasks have no deal
    let metaDeal: string | null = null
    let metaBadge: string | null = null

    if (task.is_life) {
      metaBadge = 'LIFE'
    } else if (task.entity_id || task.is_entity) {
      metaBadge = entityName || 'ENTITY'
    } else {
      metaDeal = dealAddr || dealName || null
    }

    async function handleSwipeComplete() {
      // Optimistic remove — row disappears immediately
      setTasks(prev => prev.filter(t => t.id !== task.id))
      setCompletionBar(task)
      setTimeout(() => setCompletionBar(null), 6000)
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'complete', completed_at: new Date().toISOString() })
        .eq('id', task.id)
      if (error) {
        // Rollback on failure
        setRetryCount(c => c + 1)
      }
    }

    async function handleSwipeTomorrow() {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
      // Optimistic update — re-sort immediately without waiting for reload
      setTasks(prev => {
        const updated = prev.map(t => t.id === task.id ? { ...t, due_date: dateStr } : t)
        return sortTasks(updated)
      })
      await supabase.from('tasks').update({ due_date: dateStr }).eq('id', task.id)
    }

    async function handleSwipeNextWeek() {
      const d = new Date()
      d.setDate(d.getDate() + 7)
      const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
      // Optimistic update — re-sort immediately without waiting for reload
      setTasks(prev => {
        const updated = prev.map(t => t.id === task.id ? { ...t, due_date: dateStr } : t)
        return sortTasks(updated)
      })
      await supabase.from('tasks').update({ due_date: dateStr }).eq('id', task.id)
    }

    return (
      <SwipeRow
        key={task.id}
        task={task}
        onSwipeRight={handleSwipeComplete}
        onSwipeLeft={handleSwipeTomorrow}
        onNextWeek={handleSwipeNextWeek}
      >
        <ListRow
          key={task.id}
          title={task.title}
          metaDeal={metaDeal}
          metaBadge={metaBadge}
          spineColor={spineColor}
          dayCount={dayCount}
          dayCountColor={dayCountColor}
          onPress={() => onOpenTaskDetail?.(task)}
        />
      </SwipeRow>
    )
  }

  return (
    <>
    <BottomSheet
      open={open}
      onClose={onClose}
      label="Battle Plan"
      count={loadError ? undefined : tasks.length}
      size="list"
    >
      {loading ? (
        <SkeletonRows />
      ) : loadError ? (
        <div style={{ padding: '32px 18px', textAlign: 'center' }}>
          <span
            onClick={() => setRetryCount(c => c + 1)}
            style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.late, cursor: 'pointer' }}
          >Could not load — tap to retry</span>
        </div>
      ) : tasks.length === 0 ? (
        <div style={{ padding: '32px 18px', textAlign: 'center' }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>No open tasks.</span>
        </div>
      ) : (
        <div>
          {/* OVERDUE bucket */}
          {overdue.length > 0 && (
            <>
              <GroupHeader label="OVERDUE" labelColor={T.late} count={overdue.length} />
              {overdue.map(renderRow)}
            </>
          )}
          {/* TODAY bucket */}
          {todayBkt.length > 0 && (
            <>
              <GroupHeader label="TODAY" labelColor={T.hot} count={todayBkt.length} />
              {todayBkt.map(renderRow)}
            </>
          )}
          {/* LATER bucket */}
          {later.length > 0 && (
            <>
              <GroupHeader label="LATER" labelColor={T.textLow} count={later.length} />
              {later.map(renderRow)}
            </>
          )}
          {/* NO DUE DATE bucket */}
          {noDate.length > 0 && (
            <>
              <GroupHeader label="NO DUE DATE" labelColor={T.textLow} count={noDate.length} />
              {noDate.map(renderRow)}
            </>
          )}
          {/* §10 item 14: "View closed" link is RETIRED. Not rendered. */}
        </div>
      )}
    </BottomSheet>

    {/* TaskDetailSheet lifted to page.tsx — FAB × routing works automatically */}

    {/* §13.3 Confirmation bar — above tab bar, derived offset 94+23-0+14=131 */}
    {completionBar && (
      <div style={{
        position: 'fixed',
        bottom: FOOTER_BOTTOM,  // derived: TAB_BAR + FAB_LIFT - TAB_PAD_TOP + CLEARANCE
        left: 14,
        right: 14,
        zIndex: 60,
        background: 'rgba(18,17,26,0.97)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderLeft: '3px solid #34D399',
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        {/* check-h280.png at 88×88 — §17.5 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/check/check-h280.png" alt="" width={88} height={88} style={{ display: 'block', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14.5, fontWeight:400, color:'#EFEEF4', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {completionBar.title}
          </div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11.5, fontWeight:400, color:'#8E8CA0', marginTop:3 }}>
            Completed · {completionBar.is_life ? 'Life' : (completionBar.deals ? ((completionBar.deals as any).addr_display || (completionBar.deals as any).addr_street_name || (completionBar.deals as any).name || '') : (completionBar.is_entity ? 'Entity' : 'Battle Plan'))}
          </div>
        </div>
        <button
          onClick={async () => {
            await supabase.from('tasks').update({ status:'open', completed_at: null }).eq('id', completionBar.id)
            setCompletionBar(null)
            setRetryCount(c => c+1)
          }}
          style={{ background:'none', border:'none', cursor:'pointer', color:'#A78BFA', fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:500, letterSpacing:'0.1em', textTransform:'uppercase', flexShrink:0 }}
        >UNDO</button>
      </div>
    )}
    </>
  )
}

function SkeletonRows() {
  return (
    <div style={{ padding: '22px 18px', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
        <div key={i} style={{
          height: 48,
          background: 'rgba(255,255,255,0.03)',
          backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.6s ease-in-out infinite',
        }} />
      ))}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  )
}

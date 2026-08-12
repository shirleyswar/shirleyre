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

const T = {
  textHi:    '#EFEEF4',
  textMid:   '#8B8A9B',
  textLow:   '#5C5B6B',
  late:      '#FF4D4D',
  hot:       '#FFA23A',
  brand:     '#8B5CF6',
  brandLift: '#A78BFA',
} as const

// T2 §3.2 — 9.5px / 500 / 0.19em / UPPER / text-low — group headers
const styleT2: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9.5,
  fontWeight: 500,
  letterSpacing: '0.19em',
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
  sort_order: number | null
  created_at: string
  deals?: { name?: string; address?: string } | null
}

interface BattlePlanSheetProps {
  open: boolean
  onClose: () => void
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
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
      <span style={{
        fontFamily: FONT_MONO,
        fontSize: 9.5,
        fontWeight: 500,
        color: T.textLow,
        fontVariantNumeric: 'tabular-nums',
      }}>{count}</span>
    </div>
  )
}

export default function BattlePlanSheet({ open, onClose }: BattlePlanSheetProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setLoadError(false)
    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('id, title, status, due_date, deal_id, is_life, is_entity, sort_order, created_at, deals(name, address)')
          .in('status', ['open', 'in_progress'])
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
  }, [open, retryCount])

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
    // Subline: deal address preferred, then name. If same as title, §5.11.5 suppresses it.
    const subline = dealAddr || dealName || undefined

    return (
      <ListRow
        key={task.id}
        title={task.title}
        subline={subline}
        spineColor={spineColor}
        dayCount={dayCount}
        dayCountColor={dayCountColor}
      />
    )
  }

  return (
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

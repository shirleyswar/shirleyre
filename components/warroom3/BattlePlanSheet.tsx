'use client'

// Battle Plan bottom sheet — §12 step 4
// Sheet component wired to Battle Plan first per spec.
// Shows open/in_progress tasks — same population as /warroom BattlePlanPanel.
// No task edit/complete actions (§13 — not in play until directed).
// No chains (§14).

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import BottomSheet from '@/components/warroom3/BottomSheet'

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

// T3 §3.2
const styleT3: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 14.5,
  fontWeight: 500,
  color: T.textHi,
  lineHeight: 1.25,
}

// T4 §3.2
const styleT4: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 11.5,
  fontWeight: 400,
  color: T.textMid,
  lineHeight: 1.5,
}

// T2 micro
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

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0,0,0,0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.floor((target.getTime() - now.getTime()) / 86400000)
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
        if (error) {
          console.error('[BattlePlanSheet] load error:', error)
          setLoadError(true)
          setLoading(false)
          return
        }
        if (!data) { setLoading(false); return }
        const today = todayCST()
        const sorted = [...(data as Task[])].sort((a, b) => {
          const aOverdue = a.due_date && a.due_date < today
          const bOverdue = b.due_date && b.due_date < today
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
      } catch (e: unknown) {
        console.error('[BattlePlanSheet] unexpected error:', e)
        setLoadError(true)
        setLoading(false)
      }
    }
    run()
  }, [open, retryCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const today = todayCST()

  // Group: OVERDUE → DUE SOON (≤7d) → UPCOMING → NO DATE
  const overdue    = tasks.filter(t => t.due_date && t.due_date < today)
  const dueSoon    = tasks.filter(t => t.due_date && t.due_date >= today && daysUntil(t.due_date) <= 7)
  const upcoming   = tasks.filter(t => t.due_date && daysUntil(t.due_date) > 7)
  const noDate     = tasks.filter(t => !t.due_date)

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="Battle Plan"
      count={loadError ? undefined : tasks.length}
      size="list"
    >
      {loading ? (
        <SkeletonList />
      ) : loadError ? (
        <div style={{ padding: '32px 18px', textAlign: 'center' }}>
          <span
            onClick={() => setRetryCount(c => c + 1)}
            style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: '#FF4D4D', cursor: 'pointer' }}
          >Could not load — tap to retry</span>
        </div>
      ) : tasks.length === 0 ? (
        <div style={{ padding: '32px 18px', textAlign: 'center' }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>No open tasks.</span>
        </div>
      ) : (
        <div style={{ padding: '0 18px' }}>
          {overdue.length > 0 && (
            <Group
              label="OVERDUE"
              labelColor={T.late}
              tasks={overdue}
              today={today}
            />
          )}
          {dueSoon.length > 0 && (
            <Group
              label="DUE SOON"
              labelColor={T.hot}
              tasks={dueSoon}
              today={today}
            />
          )}
          {upcoming.length > 0 && (
            <Group
              label="UPCOMING"
              labelColor={T.textLow}
              tasks={upcoming}
              today={today}
            />
          )}
          {noDate.length > 0 && (
            <Group
              label="NO DATE"
              labelColor={T.textLow}
              tasks={noDate}
              today={today}
            />
          )}
        </div>
      )}
    </BottomSheet>
  )
}

// Group header per §5.1 style (T1) with accent colour on label when urgent
function Group({ label, labelColor, tasks, today }: {
  label: string
  labelColor: string
  tasks: Task[]
  today: string
}) {
  return (
    <div style={{ marginTop: 22 }}>
      {/* §5.1 section header: T1 label · hairline · count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ ...styleT2, color: labelColor }}>{label}</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
        <span style={{
          fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500,
          color: T.textLow, fontVariantNumeric: 'tabular-nums',
        }}>{tasks.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {tasks.map(task => <TaskRow key={task.id} task={task} today={today} />)}
      </div>
    </div>
  )
}

// Task row — §5.2 spine for overdue/urgent, T3 title, T4 sub
function TaskRow({ task, today }: { task: Task; today: string }) {
  const isOverdue = task.due_date && task.due_date < today
  const days = task.due_date ? daysUntil(task.due_date) : null
  const isHot = !isOverdue && days !== null && days <= 7

  const spineColor = isOverdue ? T.late : isHot ? T.hot : null
  const spineBg = isOverdue
    ? 'rgba(255,77,77,0.05)'
    : isHot
    ? 'rgba(255,162,58,0.05)'
    : 'transparent'

  const dealName = (task.deals as any)?.address || (task.deals as any)?.name || null
  const badge = task.is_life ? 'LIFE' : task.is_entity ? 'ENTITY' : null

  let dueLabelColor: string = T.textLow
  let dueText = ''
  if (task.due_date) {
    if (isOverdue) {
      const overdueDays = Math.abs(days ?? 0)
      dueText = overdueDays === 0 ? 'TODAY' : `${overdueDays}D LATE`
      dueLabelColor = T.late
    } else if (days === 0) {
      dueText = 'TODAY'
      dueLabelColor = T.hot
    } else if (days !== null && days <= 7) {
      dueText = `${days}D`
      dueLabelColor = T.hot
    } else {
      // Format as "AUG 12"
      const [y, m, d] = task.due_date.split('-').map(Number)
      dueText = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
      dueLabelColor = T.textLow
    }
  }

  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      background: spineColor ? spineBg : 'rgba(255,255,255,0.02)',
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.05)',
      padding: spineColor ? '12px 14px 12px 17px' : '12px 14px',
      marginBottom: 6,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      // Minimum tap height §11.2
      minHeight: 44,
    }}>
      {/* §5.2 spine */}
      {spineColor && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, background: spineColor,
        }} />
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* T3 title */}
        <div style={{ ...styleT3, fontSize: 14 }}>{task.title}</div>
        {/* T4 sub-line: deal or badge */}
        {(dealName || badge) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            {dealName && <span style={{ ...styleT4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dealName}</span>}
            {badge && (
              <span style={{
                fontFamily: FONT_MONO,
                fontSize: 9,
                fontWeight: 500,
                letterSpacing: '0.11em',
                textTransform: 'uppercase',
                color: T.textLow,
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 4,
                padding: '2px 5px',
                flexShrink: 0,
              }}>{badge}</span>
            )}
          </div>
        )}
      </div>

      {/* Due label */}
      {dueText && (
        <span style={{
          ...styleT2,
          fontSize: 9,
          color: dueLabelColor,
          flexShrink: 0,
          marginTop: 2,
        }}>{dueText}</span>
      )}
    </div>
  )
}

function SkeletonList() {
  return (
    <div style={{ padding: '22px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          height: 52,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.04)',
          backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.6s ease-in-out infinite',
        }} />
      ))}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  )
}

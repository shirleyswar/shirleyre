'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LifeTask {
  id: string
  title: string
  status: string
  due_date: string | null
  completed_by: string | null
  created_at: string
  sort_order?: number | null
  completed_at?: string | null
  follow_up_of?: string | null
  is_life?: boolean | null
}

type Bucket = 'overdue' | 'today' | 'thisWeek' | 'later' | 'none'

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function getBucket(dueDate: string | null, today: string): Bucket {
  if (!dueDate) return 'none'
  if (dueDate < today) return 'overdue'
  if (dueDate === today) return 'today'
  if (dueDate <= addDays(today, 7)) return 'thisWeek'
  return 'later'
}

function formatRelativeDate(dueDate: string | null, today: string): string {
  if (!dueDate) return ''
  if (dueDate === today) return 'Today'
  const tomorrow = addDays(today, 1)
  if (dueDate === tomorrow) return 'Tomorrow'
  // Future
  if (dueDate > today) {
    const diff = Math.round(
      (new Date(dueDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000
    )
    if (diff <= 6) return `In ${diff} days`
    // beyond 7 days — Thu, Apr 2
    const d = new Date(dueDate + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  // Overdue
  const diff = Math.round(
    (new Date(today + 'T00:00:00').getTime() - new Date(dueDate + 'T00:00:00').getTime()) / 86400000
  )
  if (diff === 1) return '1 day ago'
  return `${diff} days ago`
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function LifePanel() {
  const [tasks, setTasks] = useState<LifeTask[]>([])
  const [loading, setLoading] = useState(true)
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set())
  const [completingAnimIds, setCompletingAnimIds] = useState<Set<string>>(new Set())
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [pendingComplete, setPendingComplete] = useState<LifeTask | null>(null)
  const dragIdRef = useRef<string | null>(null)

  // FAB / add form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('')
  const [adding, setAdding] = useState(false)

  // Collapsed buckets — overdue + today expanded by default
  const [collapsed, setCollapsed] = useState<Record<Bucket, boolean>>({
    overdue: false,
    today: false,
    thisWeek: true,
    later: true,
    none: true,
  })

  const today = getToday()

  useEffect(() => { fetchTasks() }, [])

  async function fetchTasks() {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_life', true)
        .order('sort_order', { ascending: true })
        .limit(200)

      if (error) {
        setTasks([])
        setLoading(false)
        return
      }

      if (!data) return

      // Show ALL open/in_progress tasks — no date filter
      const filtered = (data as LifeTask[]).filter(t => {
        return t.status === 'open' || t.status === 'in_progress'
      })

      filtered.sort((a, b) => {
        const aOrder = a.sort_order ?? null
        const bOrder = b.sort_order ?? null
        if (aOrder !== null && bOrder !== null) return aOrder - bOrder
        if (aOrder !== null) return -1
        if (bOrder !== null) return 1
        return a.created_at.localeCompare(b.created_at)
      })

      setTasks(filtered)
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  async function addTask() {
    if (!newTitle.trim()) return
    setAdding(true)
    try {
      const insertData: Record<string, unknown> = {
        title: newTitle.trim(),
        status: 'open',
        deal_id: null,
        is_life: true,
        due_date: newDue || null,
      }
      try {
        const minOrder = tasks.length > 0
          ? Math.min(...tasks.map(t => t.sort_order ?? 0)) - 1
          : 0
        insertData.sort_order = minOrder
      } catch {}

      const { data, error } = await supabase
        .from('tasks')
        .insert(insertData)
        .select()
        .single()

      if (data && !error) {
        setTasks(prev => [data as LifeTask, ...prev])
        setNewTitle('')
        setNewDue('')
        setShowAddForm(false)
      }
    } catch {}
    setAdding(false)
  }

  function completeTask(task: LifeTask) {
    setPendingComplete(task)
  }

  async function confirmComplete(task: LifeTask) {
    setPendingComplete(null)
    // Animation: fill checkbox
    setCompletingAnimIds(prev => new Set(prev).add(task.id))
    setTimeout(() => {
      setCompletingIds(prev => new Set(prev).add(task.id))
    }, 200)

    const updateData: Record<string, unknown> = {
      status: 'complete',
      completed_by: 'matthew',
      completed_at: new Date().toISOString(),
    }
    try {
      await supabase.from('tasks').update(updateData).eq('id', task.id)
    } catch {}

    setTimeout(() => {
      setTasks(prev => prev.filter(t => t.id !== task.id))
      setCompletingIds(prev => { const n = new Set(prev); n.delete(task.id); return n })
      setCompletingAnimIds(prev => { const n = new Set(prev); n.delete(task.id); return n })
    }, 700)
  }

  async function confirmCompleteWithFollowUp(task: LifeTask) {
    setPendingComplete(null)
    await confirmComplete(task)
    const insertData: Record<string, unknown> = {
      title: `Follow-up: ${task.title}`,
      status: 'open',
      deal_id: null,
      is_life: true,
    }
    try { insertData.follow_up_of = task.id } catch {}
    try {
      insertData.sort_order = tasks.length > 0
        ? Math.min(...tasks.map(t => t.sort_order ?? 0)) - 1
        : 0
    } catch {}
    try {
      const { data } = await supabase.from('tasks').insert(insertData).select().single()
      if (data) setTasks(prev => [data as LifeTask, ...prev])
    } catch {}
  }

  async function updateTask(id: string, updates: Partial<LifeTask>) {
    try {
      await supabase.from('tasks').update(updates).eq('id', id)
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    } catch {}
  }

  // Drag handlers
  const handleDragStart = useCallback((id: string) => { dragIdRef.current = id }, [])
  const handleDragOver = useCallback((e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id) }, [])
  const handleDrop = useCallback(async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    setDragOverId(null)
    const sourceId = dragIdRef.current
    if (!sourceId || sourceId === targetId) return
    setTasks(prev => {
      const arr = [...prev]
      const fromIdx = arr.findIndex(t => t.id === sourceId)
      const toIdx = arr.findIndex(t => t.id === targetId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [moved] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, moved)
      const updates = arr.map((t, i) => ({ id: t.id, sort_order: i }))
      Promise.all(
        updates.map(u => supabase.from('tasks').update({ sort_order: u.sort_order } as Record<string, unknown>).eq('id', u.id).then(() => {}))
      ).catch(() => {})
      return arr.map((t, i) => ({ ...t, sort_order: i }))
    })
    dragIdRef.current = null
  }, [])
  const handleDragEnd = useCallback(() => { setDragOverId(null); dragIdRef.current = null }, [])

  // Bucket grouping
  const bucketed: Record<Bucket, LifeTask[]> = { overdue: [], today: [], thisWeek: [], later: [], none: [] }
  for (const t of tasks) {
    bucketed[getBucket(t.due_date, today)].push(t)
  }

  const bucketConfig: Array<{ key: Bucket; label: string; color: string }> = [
    { key: 'overdue',  label: 'Overdue',    color: '#ef4444' },
    { key: 'today',    label: 'Today',      color: '#E8B84B' },
    { key: 'thisWeek', label: 'This Week',  color: '#4F8EF7' },
    { key: 'later',    label: 'Later',      color: 'rgba(255,255,255,0.3)' },
    { key: 'none',     label: 'No Due Date',color: 'rgba(255,255,255,0.2)' },
  ]

  const totalOpen = tasks.length

  return (
    <>
      <style>{`
        @keyframes lifeCheckFill {
          0%   { transform: scale(1);   background: transparent; }
          40%  { transform: scale(1.15); background: rgba(139,92,246,0.9); }
          100% { transform: scale(1);   background: rgba(139,92,246,0.6); }
        }
        @keyframes lifeRowFadeOut {
          0%   { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(8px); }
        }
        @keyframes lifeAddSlideDown {
          from { opacity: 0; transform: translateY(-10px); max-height: 0; }
          to   { opacity: 1; transform: translateY(0);    max-height: 120px; }
        }
        @keyframes lifeBucketSlide {
          from { transform: translateY(-6px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
        @keyframes slideUpSheet {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>

      <div style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #091520 100%)',
        border: '1.5px solid rgba(139,92,246,0.2)',
        borderRadius: 16,
        padding: '22px 24px 72px',  /* bottom padding for FAB clearance */
        boxShadow: '0 0 0 1px rgba(139,92,246,0.06), 0 8px 40px rgba(0,0,0,0.5)',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 220,
      }}>
        {/* Ambient radial glow */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* ── Header ── */}
        <div className="wr-card-header" style={{ marginBottom: 18 }}>
          <span style={{ color: '#F87171', display: 'flex', alignItems: 'center', filter: 'drop-shadow(0 0 8px rgba(248,113,113,0.7))' }}>
            <LifeIcon />
          </span>
          <span className="wr-rank1" style={{ color: '#F87171', textShadow: '0 0 16px rgba(248,113,113,0.5)' }}>Life</span>
          <div className="wr-panel-line" style={{ background: 'linear-gradient(to right, rgba(248,113,113,0.35), transparent)' }} />
          <span className="wr-panel-stat" style={{ fontSize: 18, fontWeight: 800, color: '#F87171' }}>
            {totalOpen > 0 ? totalOpen : '—'}
          </span>
        </div>

        {/* ── Add Form (inline, above buckets) ── */}
        {showAddForm && (
          <div style={{
            animation: 'lifeAddSlideDown 0.2s ease forwards',
            overflow: 'hidden',
            marginBottom: 16,
            background: 'rgba(139,92,246,0.06)',
            border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <input
              autoFocus
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') addTask()
                if (e.key === 'Escape') { setShowAddForm(false); setNewTitle(''); setNewDue('') }
              }}
              placeholder="What needs doing…"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(139,92,246,0.3)', borderRadius: 7,
                padding: '8px 12px', fontSize: 14, fontWeight: 500,
                color: '#F0F2FF', outline: 'none', fontFamily: 'var(--font-body)',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="date"
                value={newDue}
                onChange={e => setNewDue(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7,
                  padding: '7px 10px', fontSize: 12, color: 'rgba(255,255,255,0.5)',
                  outline: 'none', fontFamily: 'var(--font-body)',
                  colorScheme: 'dark' as React.CSSProperties['colorScheme'],
                  flex: 1,
                }}
              />
              <button
                onClick={addTask}
                disabled={adding || !newTitle.trim()}
                style={{
                  padding: '7px 16px', fontSize: 12, fontWeight: 700,
                  background: 'rgba(139,92,246,0.25)',
                  border: '1px solid rgba(167,139,250,0.5)', borderRadius: 7,
                  color: '#c4b5fd', cursor: 'pointer', fontFamily: 'var(--font-body)',
                  opacity: newTitle.trim() ? 1 : 0.4,
                }}
              >
                {adding ? '…' : 'Save'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewTitle(''); setNewDue('') }}
                style={{
                  padding: '7px 14px', fontSize: 12, fontWeight: 600,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7,
                  color: '#6B7280', cursor: 'pointer', fontFamily: 'var(--font-body)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Task List ── */}
        {loading ? (
          <SkeletonList />
        ) : tasks.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {bucketConfig.map(({ key, label, color }) => {
              const bucketTasks = bucketed[key]
              if (bucketTasks.length === 0) return null
              const isCollapsed = collapsed[key]
              return (
                <div key={key} style={{ marginBottom: 4 }}>
                  {/* Bucket header */}
                  <button
                    onClick={() => setCollapsed(prev => ({ ...prev, [key]: !isCollapsed }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      width: '100%', background: 'none', border: 'none',
                      padding: '8px 0 4px', cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
                      textTransform: 'uppercase', color,
                      fontFamily: 'monospace',
                    }}>
                      {label} · {bucketTasks.length}
                    </span>
                    <span style={{
                      fontSize: 9, color: 'rgba(255,255,255,0.2)',
                      marginLeft: 2,
                      transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.18s ease',
                      display: 'inline-block',
                      lineHeight: 1,
                    }}>▾</span>
                  </button>

                  {/* Tasks */}
                  {!isCollapsed && (
                    <div style={{ animation: 'lifeBucketSlide 0.18s ease forwards' }}>
                      {bucketTasks.map(task => (
                        <LifeTaskRow
                          key={task.id}
                          task={task}
                          today={today}
                          completing={completingIds.has(task.id)}
                          completingAnim={completingAnimIds.has(task.id)}
                          dragOverId={dragOverId}
                          onComplete={() => completeTask(task)}
                          onUpdate={(updates) => updateTask(task.id, updates)}
                          onDragStart={() => handleDragStart(task.id)}
                          onDragOver={(e) => handleDragOver(e, task.id)}
                          onDrop={(e) => handleDrop(e, task.id)}
                          onDragEnd={handleDragEnd}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── FAB ── */}
        <button
          onClick={() => { setShowAddForm(true); }}
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.8), rgba(109,40,217,0.9))',
            border: '1px solid rgba(167,139,250,0.5)',
            color: '#fff',
            fontSize: 24,
            fontWeight: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 0 24px rgba(139,92,246,0.4), 0 4px 16px rgba(0,0,0,0.4)',
            lineHeight: 1,
            zIndex: 10,
            flexShrink: 0,
          }}
          aria-label="Add task"
        >
          +
        </button>
      </div>

      {/* ── Completion Bottom Sheet ── */}
      {pendingComplete && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setPendingComplete(null)}
          />
          {/* Sheet */}
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              background: '#13112A',
              border: '1px solid rgba(139,92,246,0.35)',
              borderRadius: '20px 20px 0 0',
              padding: '0 24px 24px',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
              maxHeight: '80vh',
              overflowY: 'auto',
              animation: 'slideUpSheet 0.22s cubic-bezier(0.32, 0.72, 0, 1)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Drag pill */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
            </div>

            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.6)', fontFamily: 'monospace' }}>Life</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F2FF', lineHeight: 1.4 }}>{pendingComplete.title}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <button
                onClick={() => confirmComplete(pendingComplete)}
                style={{ padding: '12px 16px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 8, color: '#22C55E', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}
              >
                Log as Complete
              </button>
              <button
                onClick={() => confirmCompleteWithFollowUp(pendingComplete)}
                style={{ padding: '12px 16px', background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.35)', borderRadius: 8, color: '#14b8a6', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}
              >
                Create Next Flow
              </button>
              <button
                onClick={() => setPendingComplete(null)}
                style={{ padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#6B7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}
              >
                Cancel — Keep Open
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}

// ─── Life Task Row ────────────────────────────────────────────────────────────

interface LifeTaskRowProps {
  task: LifeTask
  today: string
  completing: boolean
  completingAnim: boolean
  dragOverId: string | null
  onComplete: () => void
  onUpdate: (updates: Partial<LifeTask>) => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
}

function LifeTaskRow({
  task, today, completing, completingAnim, dragOverId,
  onComplete, onUpdate,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: LifeTaskRowProps) {
  const [hovered, setHovered] = useState(false)
  const [cbHovered, setCbHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDue, setEditDue] = useState(task.due_date || '')

  const isDragTarget = dragOverId === task.id
  const isOverdue = task.due_date !== null && task.due_date < today
  const relDate = formatRelativeDate(task.due_date, today)

  function saveEdit() {
    if (editTitle.trim()) {
      onUpdate({ title: editTitle.trim(), due_date: editDue || null })
    }
    setEditing(false)
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: isDragTarget
          ? 'rgba(139,92,246,0.06)'
          : hovered
          ? 'rgba(255,255,255,0.02)'
          : 'transparent',
        opacity: completing ? 0 : 1,
        transform: completing ? 'translateX(8px)' : 'none',
        transition: completing ? 'opacity 0.4s ease, transform 0.4s ease' : 'background 0.12s ease',
        cursor: 'default',
      }}
    >
      {/* Checkbox */}
      <button
        onClick={onComplete}
        onMouseEnter={() => setCbHovered(true)}
        onMouseLeave={() => setCbHovered(false)}
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          border: `1.5px solid ${completingAnim ? 'rgba(139,92,246,0.9)' : cbHovered ? 'rgba(139,92,246,0.7)' : 'rgba(255,255,255,0.2)'}`,
          background: completingAnim
            ? 'rgba(139,92,246,0.8)'
            : cbHovered
            ? 'rgba(139,92,246,0.12)'
            : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.18s ease',
          animation: completingAnim ? 'lifeCheckFill 0.3s ease forwards' : 'none',
          transform: completingAnim ? 'scale(1.12)' : 'scale(1)',
        }}
        aria-label="Complete task"
      >
        {(cbHovered || completingAnim) && (
          <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 3" stroke={completingAnim ? '#fff' : 'rgba(139,92,246,0.9)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              autoFocus
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') setEditing(false)
              }}
              style={{
                width: '100%', background: 'transparent',
                border: '1px solid rgba(139,92,246,0.4)', borderRadius: 5,
                padding: '4px 8px', fontSize: 13, color: '#F0F2FF',
                outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="date"
                value={editDue}
                onChange={e => setEditDue(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 5, padding: '4px 8px', fontSize: 12, color: 'rgba(255,255,255,0.4)',
                  outline: 'none', fontFamily: 'var(--font-body)',
                  colorScheme: 'dark' as React.CSSProperties['colorScheme'],
                }}
              />
              <button onClick={saveEdit} style={{ padding: '3px 10px', background: 'rgba(139,92,246,0.25)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditing(false)} style={{ padding: '3px 10px', background: 'transparent', color: '#6B7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <span
            onClick={() => { setEditTitle(task.title); setEditDue(task.due_date || ''); setEditing(true) }}
            style={{
              fontSize: 14, fontWeight: 600, color: '#F0F2FF',
              lineHeight: 1.4, display: 'block', cursor: 'pointer',
            }}
          >
            {task.title}
          </span>
        )}
      </div>

      {/* Date — right-aligned secondary */}
      {relDate && !editing && (
        <span style={{
          fontSize: 11, fontWeight: 500,
          color: isOverdue ? '#ef4444' : 'rgba(255,255,255,0.3)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {relDate}
        </span>
      )}

      {/* Drag handle (visible on hover) */}
      {hovered && !editing && (
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.2)', cursor: 'grab', userSelect: 'none', flexShrink: 0 }}>⠿</span>
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[70, 55, 82, 45].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: 34, width: `${w}%`, borderRadius: 6 }} />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'rgba(34,197,94,0.08)',
        border: '1px solid rgba(34,197,94,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="16" height="16" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 5.5l2.5 2.5L8.5 2" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Clear skies.</span>
    </div>
  )
}

function LifeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/>
    </svg>
  )
}

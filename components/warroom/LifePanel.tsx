'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// LifePanel task type — uses tasks table with is_life: true
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

export default function LifePanel() {
  const [tasks, setTasks] = useState<LifeTask[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set())
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [pendingComplete, setPendingComplete] = useState<LifeTask | null>(null)
  const dragIdRef = useRef<string | null>(null)

  useEffect(() => { fetchTasks() }, [])

  async function fetchTasks() {
    try {
      const today = new Date().toISOString().split('T')[0]
      const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_life', true)
        .order('sort_order', { ascending: true })
        .limit(100)

      if (error) {
        // is_life column may not exist yet — show empty state
        setTasks([])
        setLoading(false)
        return
      }

      if (!data) return

      const filtered = (data as LifeTask[]).filter(t => {
        if (t.status === 'open' || t.status === 'in_progress') {
          return !t.due_date || t.due_date <= today
        }
        if (t.status === 'complete' || t.status === 'done') {
          const completedTime = t.completed_at || t.created_at
          return completedTime > cutoff24h
        }
        return false
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
      // Graceful degradation
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
      }
    } catch {}
    setAdding(false)
  }

  function completeTask(task: LifeTask) {
    setPendingComplete(task)
  }

  async function confirmComplete(task: LifeTask) {
    setPendingComplete(null)
    setCompletingIds(prev => new Set(prev).add(task.id))

    const updateData: Record<string, unknown> = {
      status: 'complete',
      completed_by: 'matthew',
    }
    try { updateData.completed_at = new Date().toISOString() } catch {}

    try {
      await supabase.from('tasks').update(updateData).eq('id', task.id)
    } catch {}

    setTimeout(() => {
      setTasks(prev => prev.filter(t => t.id !== task.id))
      setCompletingIds(prev => { const n = new Set(prev); n.delete(task.id); return n })
    }, 600)
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
  const handleDragStart = useCallback((id: string) => {
    dragIdRef.current = id
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault()
    setDragOverId(id)
  }, [])

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
        updates.map(u =>
          supabase.from('tasks').update({ sort_order: u.sort_order } as Record<string, unknown>).eq('id', u.id).then(() => {})
        )
      ).catch(() => {})
      return arr.map((t, i) => ({ ...t, sort_order: i }))
    })
    dragIdRef.current = null
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragOverId(null)
    dragIdRef.current = null
  }, [])

  const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress')

  return (
    <div className="wr-card h-full min-h-[320px]">
      <div className="wr-card-header">
        <span style={{ color: 'var(--accent-gold)', display: 'flex' }}>
          <LifeIcon />
        </span>
        <span className="wr-rank1">LIFE</span>
        <span className="wr-panel-line" />
        <span className="wr-panel-stat" style={{ fontSize: 16 }}>
          {openTasks.length > 0 ? openTasks.length : '—'}
        </span>
      </div>

      {/* Add task form */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          onClick={addTask}
          disabled={adding || !newTitle.trim()}
          className="wr-btn-orbit"
        >
          {adding ? '...' : '+ Add'}
        </button>
        <input
          type="text"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="Add life item..."
          style={{
            flex: 1,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '7px 12px',
            fontSize: 13,
            color: 'var(--text-primary)',
            outline: 'none',
            fontFamily: 'var(--font-body)',
          }}
          onFocus={e => (e.target.style.borderColor = 'rgba(232,184,75,0.4)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
        />
      </div>

      {/* Task list */}
      {loading ? (
        <SkeletonList />
      ) : openTasks.length === 0 ? (
        <EmptyState />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <th className="wr-rank2" style={{ width: 28, padding: '4px 6px' }}></th>
              <th className="wr-rank2" style={{ padding: '4px 8px', textAlign: 'left' }}>Action Item</th>
              <th className="wr-rank2" style={{ width: 80, padding: '4px 8px', textAlign: 'left' }}>Due</th>
              <th className="wr-rank2" style={{ width: 60, padding: '4px 6px' }}></th>
            </tr>
          </thead>
          <tbody>
            {openTasks.map(task => (
              <LifeTaskRow
                key={task.id}
                task={task}
                completing={completingIds.has(task.id)}
                dragOverId={dragOverId}
                onComplete={() => completeTask(task)}
                onUpdate={(updates) => updateTask(task.id, updates)}
                onDragStart={() => handleDragStart(task.id)}
                onDragOver={(e) => handleDragOver(e, task.id)}
                onDrop={(e) => handleDrop(e, task.id)}
                onDragEnd={handleDragEnd}
              />
            ))}
          </tbody>
        </table>
      )}

      {/* Completion Modal */}
      {pendingComplete && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setPendingComplete(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#13112A',
              border: '1px solid rgba(232,184,75,0.35)',
              borderRadius: 14,
              padding: 28,
              minWidth: 300,
              maxWidth: 400,
              width: '100%',
              boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.5)', marginBottom: 8, fontFamily: 'monospace' }}>
              Life
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20, lineHeight: 1.4 }}>
              {pendingComplete.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => confirmComplete(pendingComplete)}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(34,197,94,0.12)',
                  border: '1px solid rgba(34,197,94,0.35)',
                  borderRadius: 8,
                  color: '#22C55E',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Log as Complete
              </button>
              <button
                onClick={() => confirmCompleteWithFollowUp(pendingComplete)}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(20,184,166,0.12)',
                  border: '1px solid rgba(20,184,166,0.35)',
                  borderRadius: 8,
                  color: '#14b8a6',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Create Next Flow
              </button>
              <button
                onClick={() => setPendingComplete(null)}
                style={{
                  padding: '10px 16px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: '#6B7280',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Cancel — Keep Open
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Life Task Row ────────────────────────────────────────────────────────────

interface LifeTaskRowProps {
  task: LifeTask
  completing: boolean
  dragOverId: string | null
  onComplete: () => void
  onUpdate: (updates: Partial<LifeTask>) => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
}

function LifeTaskRow({
  task, completing, dragOverId,
  onComplete, onUpdate,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: LifeTaskRowProps) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDue, setEditDue] = useState(task.due_date || '')
  const [circleHovered, setCircleHovered] = useState(false)
  const isDragTarget = dragOverId === task.id

  function saveEdit() {
    if (editTitle.trim()) {
      onUpdate({ title: editTitle.trim(), due_date: editDue || null })
    }
    setEditing(false)
  }

  const isOverdue = task.due_date && task.due_date < new Date().toISOString().split('T')[0]

  return (
    <tr
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isDragTarget ? 'rgba(232,184,75,0.06)' : hovered ? 'rgba(255,255,255,0.02)' : 'transparent',
        borderBottom: '1px solid var(--border-subtle)',
        opacity: completing ? 0.4 : 1,
        transition: 'all 0.15s',
      }}
    >
      {/* Col 1: checkbox */}
      <td style={{ width: 28, padding: '8px 6px', verticalAlign: 'middle' }}>
        <button
          onClick={onComplete}
          onMouseEnter={() => setCircleHovered(true)}
          onMouseLeave={() => setCircleHovered(false)}
          style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            border: `1.5px solid ${circleHovered ? 'var(--accent-gold)' : 'rgba(232,184,75,0.4)'}`,
            background: circleHovered ? 'rgba(232,184,75,0.15)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
          }}
        >
          {circleHovered && (
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="var(--accent-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </td>

      {/* Col 2: Title */}
      <td style={{ padding: '8px 8px', verticalAlign: 'middle' }}>
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
                width: '100%',
                background: 'transparent',
                border: '1px solid var(--accent-gold)',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 13,
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'var(--font-body)',
              }}
            />
            <input
              type="date"
              value={editDue}
              onChange={e => setEditDue(e.target.value)}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--accent-gold)',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 12,
                color: 'var(--text-muted)',
                outline: 'none',
                fontFamily: 'var(--font-body)',
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={saveEdit}
                style={{
                  padding: '3px 10px',
                  background: 'var(--accent-gold)',
                  color: '#0D0F14',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                style={{
                  padding: '3px 10px',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: completing ? 'var(--text-muted)' : 'var(--text-primary)',
              lineHeight: 1.4,
              textDecoration: completing ? 'line-through' : 'none',
              transition: 'all 0.3s',
              display: 'block',
            }}
          >
            {task.title}
          </span>
        )}
      </td>

      {/* Col 3: Due date */}
      <td style={{ width: 80, padding: '8px 8px', verticalAlign: 'middle' }}>
        {task.due_date && (
          <span
            style={{
              fontSize: 11,
              color: isOverdue ? 'var(--danger, #ef4444)' : 'var(--text-muted)',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
            }}
          >
            {task.due_date}
          </span>
        )}
      </td>

      {/* Col 4: Actions */}
      <td style={{ width: 60, padding: '8px 6px', verticalAlign: 'middle' }}>
        {!editing && hovered && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => { setEditTitle(task.title); setEditDue(task.due_date || ''); setEditing(true) }}
              title="Edit"
              style={{
                padding: '2px 6px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                opacity: 0.65,
              }}
            >
              <PencilIcon />
            </button>
            <span
              draggable={false}
              style={{
                fontSize: 14,
                color: 'var(--text-muted)',
                cursor: 'grab',
                opacity: 0.6,
                userSelect: 'none',
              }}
            >⠿</span>
          </div>
        )}
      </td>
    </tr>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[65, 80, 50, 72].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: 38, width: `${w}%`, borderRadius: 6 }} />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: 13 }}>
      No open life items — clear skies.
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

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

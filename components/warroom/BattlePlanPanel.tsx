'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// Extended Task type with new columns (may not exist in DB yet)
interface BattlePlanTask {
  id: string
  deal_id: string | null
  title: string
  status: string
  due_date: string | null
  completed_by: string | null
  parent_task_id: string | null
  created_at: string
  // New columns (may be absent)
  sort_order?: number | null
  completed_at?: string | null
  follow_up_of?: string | null
}

interface DealOption {
  id: string
  name: string
  address: string | null
}

export default function BattlePlanPanel() {
  const [tasks, setTasks] = useState<BattlePlanTask[]>([])
  const [deals, setDeals] = useState<DealOption[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [newDealId, setNewDealId] = useState('')
  const [adding, setAdding] = useState(false)
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set())
  const [showFollowUpFor, setShowFollowUpFor] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  // Completion modal
  const [pendingComplete, setPendingComplete] = useState<BattlePlanTask | null>(null)
  const [addToLife, setAddToLife] = useState(false)
  const dragIdRef = useRef<string | null>(null)

  useEffect(() => {
    fetchDeals()
    fetchTasks()
  }, [])

  async function fetchDeals() {
    try {
      const { data } = await supabase
        .from('deals')
        .select('id, name, address')
        .order('name', { ascending: true })
        .limit(100)
      if (data) setDeals(data as DealOption[])
    } catch {}
  }

  async function fetchTasks() {
    try {
      const today = new Date().toISOString().split('T')[0]
      const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const { data } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100)

      if (!data) return

      // Daily rollover logic: show open tasks due today or earlier, or no due_date
      // Hide completed tasks older than 24h (stay in DB, just don't show)
      const filtered = (data as BattlePlanTask[]).filter(t => {
        if (t.status === 'open' || t.status === 'in_progress') {
          return !t.due_date || t.due_date <= today
        }
        if (t.status === 'complete' || t.status === 'done') {
          const completedTime = t.completed_at || t.created_at
          return completedTime > cutoff24h
        }
        return false
      })

      // Sort: by sort_order if available, fallback to created_at
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
      // DB columns may not exist yet
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
        deal_id: addToLife ? null : (newDealId || null),
      }
      // Try to include sort_order and is_life
      try {
        if (addToLife) {
          // Life tasks sort to top
          const minOrder = tasks.length > 0
            ? Math.min(...tasks.map(t => t.sort_order ?? 0)) - 1
            : -1
          insertData.sort_order = minOrder
          insertData.is_life = true
        } else {
          const maxOrder = tasks.length > 0
            ? Math.max(...tasks.map(t => t.sort_order ?? 0)) + 1
            : 0
          insertData.sort_order = maxOrder
        }
      } catch {}

      const { data, error } = await supabase
        .from('tasks')
        .insert(insertData)
        .select()
        .single()

      if (data && !error) {
        setTasks(prev => addToLife ? [data as BattlePlanTask, ...prev] : [...prev, data as BattlePlanTask])
        setNewTitle('')
        setNewDealId('')
        setAddToLife(false)
      }
    } catch {}
    setAdding(false)
  }

  // Show the modal — don't act yet
  function completeTask(task: BattlePlanTask) {
    setPendingComplete(task)
  }

  // Called when user confirms "Log as Complete" in modal
  async function confirmComplete(task: BattlePlanTask) {
    setPendingComplete(null)
    setCompletingIds(prev => new Set(prev).add(task.id))

    const updateData: Record<string, unknown> = {
      status: 'complete',
      completed_by: 'matthew',
    }
    try { updateData.completed_at = new Date().toISOString() } catch {}

    try {
      await supabase.from('tasks').update(updateData).eq('id', task.id)
      await supabase.from('activity_log').insert({
        action_type: 'task_completed',
        description: task.title,
        created_by: 'matthew',
      }).then(() => {})
    } catch {}

    setTimeout(() => {
      setTasks(prev => prev.filter(t => t.id !== task.id))
      setCompletingIds(prev => { const n = new Set(prev); n.delete(task.id); return n })
    }, 600)
  }

  // Called when user picks "Create Next Flow" in modal
  async function confirmCompleteWithFollowUp(task: BattlePlanTask) {
    setPendingComplete(null)
    // Mark complete
    await confirmComplete(task)
    // Create follow-up immediately
    const insertData: Record<string, unknown> = {
      title: `Follow-up: ${task.title}`,
      status: 'open',
      deal_id: task.deal_id || null,
    }
    try { insertData.follow_up_of = task.id } catch {}
    try {
      insertData.sort_order = tasks.length > 0
        ? Math.max(...tasks.map(t => t.sort_order ?? 0)) + 1
        : 0
    } catch {}
    try {
      const { data } = await supabase.from('tasks').insert(insertData).select().single()
      if (data) setTasks(prev => [...prev, data as BattlePlanTask])
    } catch {}
  }

  async function createFollowUp(parentTask: BattlePlanTask) {
    setShowFollowUpFor(null)
    const insertData: Record<string, unknown> = {
      title: `Follow-up: ${parentTask.title}`,
      status: 'open',
      deal_id: parentTask.deal_id || null,
    }
    try {
      insertData.follow_up_of = parentTask.id
    } catch {}
    try {
      insertData.sort_order = tasks.length > 0
        ? Math.max(...tasks.map(t => t.sort_order ?? 0)) + 1
        : 0
    } catch {}

    try {
      const { data } = await supabase
        .from('tasks')
        .insert(insertData)
        .select()
        .single()
      if (data) {
        setTasks(prev => [...prev, data as BattlePlanTask])
      }
    } catch {}
  }

  async function updateTask(id: string, updates: Partial<BattlePlanTask>) {
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
      // Save sort_order to DB
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
          <SwordIcon />
        </span>
        <span className="wr-rank1">BATTLE PLAN</span>
        <span className="wr-panel-line" />
        <span className="wr-panel-stat" style={{ fontSize: 16 }}>
          {openTasks.length > 0 ? openTasks.length : '—'}
        </span>
      </div>

      {/* Add task form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Add button — LEFT */}
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
            placeholder="Add action item..."
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
        {deals.length > 0 && (
          <select
            value={newDealId}
            onChange={e => setNewDealId(e.target.value)}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 13,
              color: newDealId ? 'var(--accent-gold)' : 'var(--text-muted)',
              outline: 'none',
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
            }}
          >
            <option value="">No deal linked</option>
            {deals.map(d => (
              <option key={d.id} value={d.id}>
                {d.address || d.name}
              </option>
            ))}
          </select>
        )}
        {/* Life checkbox */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={addToLife}
              onChange={e => setAddToLife(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: 'var(--accent-gold)', cursor: 'pointer' }}
            />
            Life
          </label>
        </div>
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
          {tasks
            .filter(t => t.status === 'open' || t.status === 'in_progress')
            .map(task => (
              <TaskRow
                key={task.id}
                task={task}
                deal={deals.find(d => d.id === task.deal_id) || null}
                completing={completingIds.has(task.id)}
                showFollowUp={showFollowUpFor === task.id}
                dragOverId={dragOverId}
                onComplete={() => completeTask(task)}
                onFollowUp={() => createFollowUp(task)}
                onUpdate={(updates) => updateTask(task.id, updates)}
                onDragStart={() => handleDragStart(task.id)}
                onDragOver={(e) => handleDragOver(e, task.id)}
                onDrop={(e) => handleDrop(e, task.id)}
                onDragEnd={handleDragEnd}
                deals={deals}
              />
            ))}
          </tbody>
        </table>
      )}

      {/* ── Completion Modal ── */}
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
            {/* Title */}
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.5)', marginBottom: 8, fontFamily: 'monospace' }}>
              Battle Plan
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F2FF', marginBottom: 6, lineHeight: 1.4 }}>
              {pendingComplete.title}
            </div>
            {pendingComplete.deal_id && (() => {
              const d = deals.find(x => x.id === pendingComplete.deal_id)
              return d ? (
                <div style={{ fontSize: 11, color: 'var(--accent-gold)', marginBottom: 16, fontFamily: 'monospace' }}>
                  {d.address || d.name}
                </div>
              ) : null
            })()}
            {!pendingComplete.deal_id && <div style={{ marginBottom: 16 }} />}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Log as Complete */}
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

              {/* Create Next Flow */}
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

              {/* Cancel */}
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

// ─── Task Row ────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: BattlePlanTask
  deal: DealOption | null
  completing: boolean
  showFollowUp: boolean
  dragOverId: string | null
  onComplete: () => void
  onFollowUp: () => void
  onUpdate: (updates: Partial<BattlePlanTask>) => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
  deals: DealOption[]
}

function TaskRow({
  task, deal, completing, showFollowUp, dragOverId,
  onComplete, onFollowUp, onUpdate,
  onDragStart, onDragOver, onDrop, onDragEnd,
  deals,
}: TaskRowProps) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDealId, setEditDealId] = useState(task.deal_id || '')
  const [circleHovered, setCircleHovered] = useState(false)
  const isDragTarget = dragOverId === task.id

  function saveEdit() {
    if (editTitle.trim()) {
      onUpdate({ title: editTitle.trim(), deal_id: editDealId || null })
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
      {/* Col 1: checkbox + drag handle (28px) */}
      <td style={{ width: 28, padding: '8px 6px', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Complete checkbox — square */}
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
              flexShrink: 0,
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
        </div>
      </td>

      {/* Col 2: Title + deal tag (flex) */}
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
            <select
              value={editDealId}
              onChange={e => setEditDealId(e.target.value)}
              style={{
                background: '#1a1e24',
                border: '1px solid var(--accent-gold)',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 13,
                color: editDealId ? 'var(--accent-gold)' : 'var(--text-muted)',
                outline: 'none',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              <option value="">No deal</option>
              {deals.map(d => (
                <option key={d.id} value={d.id}>
                  {d.address || d.name}
                </option>
              ))}
            </select>
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
          <>
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
            {deal && (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 3,
                  padding: '1px 7px',
                  background: 'rgba(232,184,75,0.1)',
                  border: '1px solid rgba(232,184,75,0.2)',
                  borderRadius: 10,
                  fontSize: 10,
                  color: 'var(--accent-gold)',
                  fontFamily: 'monospace',
                  letterSpacing: '0.02em',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {deal.address || deal.name}
              </span>
            )}
          </>
        )}
      </td>

      {/* Col 3: Due date (80px) */}
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

      {/* Col 4: Actions (60px) */}
      <td style={{ width: 60, padding: '8px 6px', verticalAlign: 'middle' }}>
        {!editing && (hovered || showFollowUp) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {hovered && (
              <button
                onClick={() => { setEditTitle(task.title); setEditDealId(task.deal_id || ''); setEditing(true) }}
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
            )}
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
        {showFollowUp && !hovered && (
          <button
            onClick={onFollowUp}
            style={{
              padding: '2px 6px',
              background: 'rgba(20,184,166,0.12)',
              border: '1px solid rgba(20,184,166,0.3)',
              borderRadius: 4,
              fontSize: 10,
              color: '#14b8a6',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            +FU
          </button>
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
      No open action items — clear skies.
    </div>
  )
}

function SwordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
      <path d="M13 19l6-6" />
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


'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface BattlePlanTask {
  id: string
  deal_id: string | null
  title: string
  status: string
  due_date: string | null
  completed_by: string | null
  parent_task_id: string | null
  created_at: string
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
  const [showAddForm, setShowAddForm] = useState(false)
  const [addToLife, setAddToLife] = useState(false)

  // Completion modal state
  const [pendingComplete, setPendingComplete] = useState<BattlePlanTask | null>(null)
  // When user picks "Create Next Flow" we show an input in the modal
  const [nextFlowMode, setNextFlowMode] = useState(false)
  const [nextFlowTitle, setNextFlowTitle] = useState('')

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

      filtered.sort((a, b) => {
        const aO = a.sort_order ?? null
        const bO = b.sort_order ?? null
        if (aO !== null && bO !== null) return aO - bO
        if (aO !== null) return -1
        if (bO !== null) return 1
        return a.created_at.localeCompare(b.created_at)
      })

      setTasks(filtered)
    } catch {}
    finally { setLoading(false) }
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
      try {
        if (addToLife) {
          const minOrder = tasks.length > 0 ? Math.min(...tasks.map(t => t.sort_order ?? 0)) - 1 : -1
          insertData.sort_order = minOrder
          insertData.is_life = true
        } else {
          const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.sort_order ?? 0)) + 1 : 0
          insertData.sort_order = maxOrder
        }
      } catch {}

      const { data, error } = await supabase.from('tasks').insert(insertData).select().single()

      if (data && !error) {
        setTasks(prev => addToLife ? [data as BattlePlanTask, ...prev] : [...prev, data as BattlePlanTask])
        setNewTitle('')
        setNewDealId('')
        setAddToLife(false)
        // Auto-dismiss the modal after save ✓
        setShowAddForm(false)
      }
    } catch {}
    setAdding(false)
  }

  function closeAddForm() {
    setShowAddForm(false)
    setNewTitle('')
    setNewDealId('')
    setAddToLife(false)
  }

  // Open completion modal
  function completeTask(task: BattlePlanTask) {
    setPendingComplete(task)
    setNextFlowMode(false)
    setNextFlowTitle('')
  }

  function closeCompletionModal() {
    setPendingComplete(null)
    setNextFlowMode(false)
    setNextFlowTitle('')
  }

  // Mark a task complete in DB + UI
  async function markComplete(task: BattlePlanTask) {
    setCompletingIds(prev => new Set(prev).add(task.id))
    const updateData: Record<string, unknown> = { status: 'complete', completed_by: 'matthew' }
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
    }, 500)
  }

  // "Log as Complete" — just mark done
  async function confirmComplete(task: BattlePlanTask) {
    closeCompletionModal()
    await markComplete(task)
  }

  // "Create Next Flow" step 1 — user clicked the button, show input
  function enterNextFlowMode(task: BattlePlanTask) {
    const deal = deals.find(d => d.id === task.deal_id)
    const dealLabel = deal ? (deal.address || deal.name) : ''
    // Pre-fill with blank so user types their own next action
    setNextFlowTitle('')
    setNextFlowMode(true)
    // hint in placeholder will show deal name
    void dealLabel
  }

  // "Create Next Flow" step 2 — save the follow-up + complete original
  async function confirmNextFlow(task: BattlePlanTask) {
    if (!nextFlowTitle.trim()) return
    closeCompletionModal()
    // Mark original complete
    await markComplete(task)
    // Create follow-up with user-specified title
    const insertData: Record<string, unknown> = {
      title: nextFlowTitle.trim(),
      status: 'open',
      deal_id: task.deal_id || null,
    }
    try { insertData.follow_up_of = task.id } catch {}
    try {
      insertData.sort_order = tasks.length > 0
        ? Math.max(...tasks.map(t => t.sort_order ?? 0)) + 1 : 0
    } catch {}
    try {
      const { data } = await supabase.from('tasks').insert(insertData).select().single()
      if (data) setTasks(prev => [...prev, data as BattlePlanTask])
    } catch {}
  }

  async function updateTask(id: string, updates: Partial<BattlePlanTask>) {
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
      Promise.all(updates.map(u =>
        supabase.from('tasks').update({ sort_order: u.sort_order } as Record<string, unknown>).eq('id', u.id)
      )).catch(() => {})
      return arr.map((t, i) => ({ ...t, sort_order: i }))
    })
    dragIdRef.current = null
  }, [])
  const handleDragEnd = useCallback(() => { setDragOverId(null); dragIdRef.current = null }, [])

  const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress')

  return (
    <div className="wr-card h-full min-h-[320px]">
      <div className="wr-card-header">
        <span style={{ color: 'var(--accent-gold)', display: 'flex' }}><SwordIcon /></span>
        <span className="wr-rank1">BATTLE PLAN</span>
        <span className="wr-panel-line" />
        <span className="wr-panel-stat" style={{ fontSize: 16 }}>
          {openTasks.length > 0 ? openTasks.length : '—'}
        </span>
      </div>

      {/* Add task button */}
      <div style={{ marginBottom: 14 }}>
        <button onClick={() => setShowAddForm(true)} className="wr-btn-orbit" style={{ fontSize: 12 }}>
          + Add Item
        </button>
      </div>

      {/* ── Add Task Modal ── */}
      {showAddForm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '80px 16px 24px' }}
          onClick={e => { if (e.target === e.currentTarget) closeAddForm() }}
        >
          <div style={{ background: '#13112A', border: '1px solid rgba(232,184,75,0.3)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.5)', fontFamily: 'monospace' }}>
              Add Action Item
            </div>
            <input
              autoFocus
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newTitle.trim()) addTask(); if (e.key === 'Escape') closeAddForm() }}
              placeholder="Action item..."
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)' }}
            />
            {deals.length > 0 && (
              <select
                value={newDealId}
                onChange={e => setNewDealId(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: newDealId ? 'var(--accent-gold)' : '#6B7280', outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
              >
                <option value="">No deal linked</option>
                {deals.map(d => <option key={d.id} value={d.id}>{(d as any).addr_display || d.address || d.name}</option>)}
              </select>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={addToLife} onChange={e => setAddToLife(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent-gold)', cursor: 'pointer' }} />
              Add to Life tab
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={closeAddForm} style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#6B7280', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Cancel
              </button>
              <button
                onClick={addTask}
                disabled={adding || !newTitle.trim()}
                style={{ flex: 2, padding: '11px', background: adding || !newTitle.trim() ? 'rgba(139,92,246,0.2)' : 'linear-gradient(135deg, rgba(139,92,246,0.4) 0%, rgba(109,40,217,0.5) 100%)', border: '1px solid rgba(167,139,250,0.5)', borderRadius: 8, color: '#c4b5fd', fontSize: 14, fontWeight: 700, cursor: adding || !newTitle.trim() ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', opacity: adding || !newTitle.trim() ? 0.5 : 1 }}
              >
                {adding ? 'Saving...' : 'Save Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Task List ── */}
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
              <th className="wr-rank2" style={{ width: 100, padding: '4px 8px', textAlign: 'left' }}>Deal</th>
              <th className="wr-rank2" style={{ width: 32, padding: '4px 6px' }}></th>
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
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => { if (!nextFlowMode) closeCompletionModal() }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#13112A', border: '1px solid rgba(232,184,75,0.35)', borderRadius: 14, padding: 28, minWidth: 300, maxWidth: 420, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.5)', marginBottom: 8, fontFamily: 'monospace' }}>
              Battle Plan
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F2FF', marginBottom: 4, lineHeight: 1.4 }}>
              {pendingComplete.title}
            </div>
            {pendingComplete.deal_id && (() => {
              const d = deals.find(x => x.id === pendingComplete.deal_id)
              return d ? (
                <div style={{ fontSize: 11, color: 'var(--accent-gold)', marginBottom: 16, fontFamily: 'monospace' }}>
                  {d.address || d.name}
                </div>
              ) : <div style={{ marginBottom: 16 }} />
            })()}
            {!pendingComplete.deal_id && <div style={{ marginBottom: 16 }} />}

            {/* ── "Create Next Flow" input mode ── */}
            {nextFlowMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 12, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
                  Next Action
                </div>
                <input
                  autoFocus
                  type="text"
                  value={nextFlowTitle}
                  onChange={e => setNextFlowTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && nextFlowTitle.trim()) confirmNextFlow(pendingComplete)
                    if (e.key === 'Escape') setNextFlowMode(false)
                  }}
                  placeholder="What's the next action?"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(20,184,166,0.4)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)' }}
                />
                {pendingComplete.deal_id && (() => {
                  const d = deals.find(x => x.id === pendingComplete.deal_id)
                  return d ? (
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      Deal: <span style={{ color: 'var(--accent-gold)' }}>{d.address || d.name}</span> — will stay linked
                    </div>
                  ) : null
                })()}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => setNextFlowMode(false)}
                    style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#6B7280', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => confirmNextFlow(pendingComplete)}
                    disabled={!nextFlowTitle.trim()}
                    style={{ flex: 2, padding: '10px', background: nextFlowTitle.trim() ? 'rgba(20,184,166,0.2)' : 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.4)', borderRadius: 8, color: '#14b8a6', fontSize: 14, fontWeight: 700, cursor: nextFlowTitle.trim() ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-body)', opacity: nextFlowTitle.trim() ? 1 : 0.5 }}
                  >
                    Complete + Create
                  </button>
                </div>
              </div>
            ) : (
              /* ── Default action buttons ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={() => confirmComplete(pendingComplete)}
                  style={{ padding: '12px 16px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 8, color: '#22C55E', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}
                >
                  ✓ Log as Complete
                </button>
                <button
                  onClick={() => enterNextFlowMode(pendingComplete)}
                  style={{ padding: '12px 16px', background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.35)', borderRadius: 8, color: '#14b8a6', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}
                >
                  → Create Next Flow
                </button>
                <button
                  onClick={closeCompletionModal}
                  style={{ padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#6B7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}
                >
                  Cancel — Keep Open
                </button>
              </div>
            )}
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
  onUpdate: (updates: Partial<BattlePlanTask>) => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
  deals: DealOption[]
}

function TaskRow({
  task, deal, completing, dragOverId,
  onComplete, onUpdate,
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
    if (editTitle.trim()) onUpdate({ title: editTitle.trim(), deal_id: editDealId || null })
    setEditing(false)
  }

  // Short deal label for the Deal column — abbreviate to ~14 chars
  const dealLabel = deal ? (deal.address || deal.name || '') : ''
  const dealShort = dealLabel.length > 18 ? dealLabel.slice(0, 16) + '…' : dealLabel

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
      {/* Col 1: Checkbox */}
      <td style={{ width: 28, padding: '8px 6px', verticalAlign: 'middle' }}>
        <button
          onClick={onComplete}
          onMouseEnter={() => setCircleHovered(true)}
          onMouseLeave={() => setCircleHovered(false)}
          style={{
            width: 16, height: 16, borderRadius: 3,
            border: `1.5px solid ${circleHovered ? 'var(--accent-gold)' : 'rgba(232,184,75,0.4)'}`,
            background: circleHovered ? 'rgba(232,184,75,0.15)' : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
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
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
              style={{ width: '100%', background: 'transparent', border: '1px solid var(--accent-gold)', borderRadius: 4, padding: '4px 8px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-body)' }}
            />
            <select
              value={editDealId}
              onChange={e => setEditDealId(e.target.value)}
              style={{ background: '#1a1e24', border: '1px solid var(--accent-gold)', borderRadius: 4, padding: '4px 8px', fontSize: 13, color: editDealId ? 'var(--accent-gold)' : 'var(--text-muted)', outline: 'none', fontFamily: 'var(--font-body)', cursor: 'pointer' }}
            >
              <option value="">No deal</option>
              {deals.map(d => <option key={d.id} value={d.id}>{d.address || d.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={saveEdit} style={{ padding: '3px 10px', background: 'var(--accent-gold)', color: '#0D0F14', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditing(false)} style={{ padding: '3px 10px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <span style={{
            fontSize: 13, color: completing ? 'var(--text-muted)' : 'var(--text-primary)',
            textDecoration: completing ? 'line-through' : 'none',
            transition: 'all 0.3s', display: 'block', lineHeight: 1.4,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {task.title}
          </span>
        )}
      </td>

      {/* Col 3: Deal (replaces Due) */}
      <td style={{ width: 100, padding: '8px 8px', verticalAlign: 'middle' }}>
        {deal ? (
          <span style={{
            fontSize: 10, color: 'var(--accent-gold)',
            fontFamily: 'monospace', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis', display: 'block',
          }} title={dealLabel}>
            {dealShort}
          </span>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--border-subtle)' }}>—</span>
        )}
      </td>

      {/* Col 4: Edit + drag handle */}
      <td style={{ width: 32, padding: '8px 6px', verticalAlign: 'middle' }}>
        {!editing && hovered && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => { setEditTitle(task.title); setEditDealId(task.deal_id || ''); setEditing(true) }}
              title="Edit"
              style={{ padding: '2px 5px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.65 }}
            >
              <PencilIcon />
            </button>
            <span style={{ fontSize: 14, color: 'var(--text-muted)', cursor: 'grab', opacity: 0.6, userSelect: 'none' }}>⠿</span>
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
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

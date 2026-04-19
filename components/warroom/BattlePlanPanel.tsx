'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
  contact_name?: string | null
  bp_priority?: number | null
  is_family?: boolean | null
  is_life?: boolean | null
  is_entity?: boolean | null
}

interface DealOption {
  id: string
  name: string
  address: string | null
}

export default function BattlePlanPanel() {
  const [tasks, setTasks] = useState<BattlePlanTask[]>([])
  const [deals, setDeals] = useState<DealOption[]>([])
  const [entityNames, setEntityNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [newDealId, setNewDealId] = useState('')
  const [adding, setAdding] = useState(false)
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set())
  const [showFollowUpFor, setShowFollowUpFor] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addToLife, setAddToLife] = useState(false)
  const [newContactName, setNewContactName] = useState('')
  const [newBpPriority, setNewBpPriority] = useState<number | null>(null)
  const [prioritySortDir, setPrioritySortDir] = useState<'desc' | 'asc'>('desc')
  const [sortMode, setSortMode] = useState<'due_date' | 'priority' | 'assignee' | 'recent'>('due_date')
  const [newIsFamily, setNewIsFamily] = useState(false)
  const [newIsEntity, setNewIsEntity] = useState(false)
  const [newDueDate, setNewDueDate] = useState('')

  // Completion modal state
  const [pendingComplete, setPendingComplete] = useState<BattlePlanTask | null>(null)
  // When user picks "Create Next Flow" we show an input in the modal
  const [nextFlowMode, setNextFlowMode] = useState(false)
  const [nextFlowTitle, setNextFlowTitle] = useState('')
  const [nextFlowDueDate, setNextFlowDueDate] = useState('')

  const dragIdRef = useRef<string | null>(null)

  useEffect(() => {
    fetchDeals()
    fetchTasks()
    fetchEntityNames()
  }, [])

  async function fetchEntityNames() {
    try {
      const { data } = await supabase.from('entities').select('name').limit(100)
      if (data) setEntityNames(data.map((e: { name: string }) => e.name).filter(Boolean))
    } catch {}
  }

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
          // Show ALL open tasks regardless of due_date — deadline is display-only, not a filter (v2)
          return true
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
        contact_name: addToLife ? 'LIFE' : (newContactName.trim() || null),
        bp_priority: newBpPriority || null,
        is_family: newIsFamily || null,
        is_entity: newIsEntity || null,
        due_date: newDueDate || null,
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
        setNewContactName('')
        setNewBpPriority(null)
        setNewIsFamily(false)
        setNewIsEntity(false)
        setAddToLife(false)
        setNewDueDate('')
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
    setNewContactName('')
    setNewBpPriority(null)
    setNewIsFamily(false)
    setNewIsEntity(false)
    setAddToLife(false)
    setNewDueDate('')
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
    setNextFlowDueDate('')
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
    setNextFlowDueDate('')
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
      due_date: nextFlowDueDate || null,
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

  // ── Pointer-based drag (smooth, no ghost image) ──────────────────────────
  const pointerDragRef = useRef<{ sourceId: string; startY: number } | null>(null)

  const handlePointerDragStart = useCallback((e: React.PointerEvent, id: string) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerDragRef.current = { sourceId: id, startY: e.clientY }
    dragIdRef.current = id
    setDraggingId(id)
  }, [])

  const handlePointerDragMove = useCallback((e: React.PointerEvent) => {
    if (!pointerDragRef.current) return
    // Find which row the pointer is over using elementFromPoint
    const els = document.elementsFromPoint(e.clientX, e.clientY)
    for (const el of els) {
      const row = el.closest('[data-task-id]') as HTMLElement | null
      if (row) {
        const targetId = row.dataset.taskId
        if (targetId && targetId !== pointerDragRef.current.sourceId) {
          setDragOverId(targetId)
          return
        }
      }
    }
  }, [])

  const handlePointerDragEnd = useCallback(async (e: React.PointerEvent) => {
    const drag = pointerDragRef.current
    pointerDragRef.current = null
    setDraggingId(null)

    const targetId = dragOverId
    setDragOverId(null)

    const sourceId = drag?.sourceId
    if (!sourceId || !targetId || sourceId === targetId) return

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
  }, [dragOverId])

  // Keep legacy drag handlers as stubs (no-ops) since TaskRow still references them
  const handleDragStart = useCallback(() => {}, [])
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault() }, [])
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault() }, [])
  const handleDragEnd = useCallback(() => {}, [])

  const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress')

  // ── Collapse bar state ───────────────────────────────────────────────────
  const [futureExpanded, setFutureExpanded] = useState(false)

  return (
    <div className="wr-card">
      <div className="wr-card-header">
        <span style={{ color: 'var(--accent-gold)', display: 'flex' }}><SwordIcon /></span>
        <span className="wr-rank1">BATTLE PLAN</span>
        <span className="wr-panel-line" />
        <span className="wr-panel-stat" style={{ fontSize: 16 }}>
          {openTasks.length > 0 ? openTasks.length : '—'}
        </span>
      </div>

      {/* Add task + Sort controls */}
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => setShowAddForm(true)} className="wr-btn-orbit" style={{ fontSize: 12, flexShrink: 0 }}>
          + Add Item
        </button>
        <div style={{ flex: 1 }} />
        {/* Sort dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            Sort
          </span>
          <select
            value={sortMode}
            onChange={e => setSortMode(e.target.value as typeof sortMode)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 11,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none' as React.CSSProperties['appearance'],
              WebkitAppearance: 'none' as React.CSSProperties['WebkitAppearance'],
              paddingRight: 20,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(255,255,255,0.3)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 6px center',
            }}
          >
            <option value="due_date">Due date</option>
            <option value="priority">Priority</option>
            <option value="assignee">Assignee</option>
            <option value="recent">Recently added</option>
          </select>
        </div>
      </div>

      {/* ── Add Task Modal ── */}
      {showAddForm && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '80px 16px 24px' }}
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
            {/* ID / Contact — autofill from existing deal names */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.5)', marginBottom: 5, fontFamily: 'monospace' }}>ID / Contact</div>
              <input
                type="text"
                value={newContactName}
                onChange={e => setNewContactName(e.target.value)}
                list="bp-contact-list"
                placeholder="Type name or pick from list..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
              />
              <datalist id="bp-contact-list">
                {Array.from(new Set([...deals.map(d => d.name), ...entityNames].filter(Boolean))).map(n => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            {/* Priority + Deadline row */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.5)', marginBottom: 5, fontFamily: 'monospace' }}>Priority</div>
                <BpStarPicker value={newBpPriority} onChange={setNewBpPriority} />
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.5)', marginBottom: 5, fontFamily: 'monospace' }}>Deadline</div>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                  style={{ fontSize: 12, padding: '6px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: addToLife ? '#f87171' : 'var(--text-muted)', cursor: 'pointer', fontWeight: addToLife ? 700 : 400 }}>
                <input type="checkbox" checked={addToLife} onChange={e => {
                  setAddToLife(e.target.checked)
                  if (e.target.checked) setNewContactName('LIFE')
                  else if (newContactName === 'LIFE') setNewContactName('')
                }} style={{ width: 16, height: 16, accentColor: '#f87171', cursor: 'pointer' }} />
                <span style={{ fontSize: 15 }}>♥</span> Life
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: newIsEntity ? '#4ade80' : 'var(--text-muted)', cursor: 'pointer', fontWeight: newIsEntity ? 700 : 400 }}>
                <input type="checkbox" checked={newIsEntity} onChange={e => setNewIsEntity(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#22c55e', cursor: 'pointer' }} />
                <span style={{ fontSize: 14 }}>🏢</span> Entity
              </label>
            </div>
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
        </div>,
        document.body
      )}

      {/* ── Task List ── */}
      {loading ? (
        <SkeletonList />
      ) : openTasks.length === 0 ? (
        <EmptyState />
      ) : (
        <>
        {(() => {
          const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

          let sorted = [...openTasks].sort((a, b) => {
            if (sortMode === 'priority') {
              const ap = a.bp_priority ?? 0
              const bp = b.bp_priority ?? 0
              return bp - ap  // highest priority first
            }
            if (sortMode === 'assignee') {
              return (a.contact_name ?? '').localeCompare(b.contact_name ?? '')
            }
            if (sortMode === 'recent') {
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            }
            // default: due_date — tasks with due dates first, then by date asc
            const aDate = a.due_date ?? null
            const bDate = b.due_date ?? null
            if (aDate && bDate && aDate !== bDate) return aDate.localeCompare(bDate)
            if (aDate && !bDate) return -1
            if (!aDate && bDate) return 1
            // tiebreak: priority desc
            const ap = a.bp_priority ?? 0
            const bp = b.bp_priority ?? 0
            return bp - ap
          })

          // Live drag preview
          if (draggingId && dragOverId && draggingId !== dragOverId) {
            const fromIdx = sorted.findIndex(t => t.id === draggingId)
            const toIdx = sorted.findIndex(t => t.id === dragOverId)
            if (fromIdx !== -1 && toIdx !== -1) {
              const preview = [...sorted]
              const [item] = preview.splice(fromIdx, 1)
              preview.splice(toIdx, 0, item)
              sorted = preview
            }
          }

          // Split into urgent (overdue + today) vs future/no-deadline
          const urgentTasks = sorted.filter(t => t.due_date && t.due_date <= today)
          const futureTasks = sorted.filter(t => !t.due_date || t.due_date > today)

          const renderRows = (taskList: BattlePlanTask[]) => taskList.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              deal={deals.find(d => d.id === task.deal_id) || null}
              completing={completingIds.has(task.id)}
              showFollowUp={showFollowUpFor === task.id}
              dragOverId={dragOverId}
              draggingId={draggingId}
              onComplete={() => completeTask(task)}
              onUpdate={(updates) => updateTask(task.id, updates)}
              onDragStart={() => handleDragStart()}
              onDragOver={(e) => handleDragOver(e)}
              onDrop={(e) => handleDrop(e)}
              onDragEnd={handleDragEnd}
              onPointerDragStart={(e) => handlePointerDragStart(e, task.id)}
              onPointerDragMove={handlePointerDragMove}
              onPointerDragEnd={handlePointerDragEnd}
              deals={deals}
              entityNames={entityNames}
            />
          ))

          return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Mobile-responsive grid styles */}
              <style>{`
                .bp-grid { display: grid; grid-template-columns: 110px 1fr 130px 90px; gap: 0 12px; align-items: center; width: 100%; }
                .bp-header { display: grid; grid-template-columns: 110px 1fr 130px 90px; gap: 0 12px; padding: 5px 12px 5px 42px; border-bottom: 1px solid rgba(139,92,246,0.2); margin-bottom: 2px; }
                .bp-col-id, .bp-col-priority { display: flex; }
                .bp-col-id-hdr, .bp-col-priority-hdr { display: block; }
                /* Mobile: hide DUE DATE column, ID, PRIORITY columns; single-column task */
                @media (max-width: 640px) {
                  .bp-grid { grid-template-columns: 1fr; }
                  .bp-header { display: none; }
                  .bp-col-due, .bp-col-id, .bp-col-priority { display: none !important; }
                  .bp-col-id-hdr, .bp-col-priority-hdr { display: none !important; }
                  /* Tighter row padding on mobile for density */
                  .bp-row-inner { padding-top: 7px !important; padding-bottom: 7px !important; }
                  .bp-check-cell { padding-top: 8px !important; padding-bottom: 8px !important; }
                }
              `}</style>

              {/* ── Column headers — desktop only ── */}
              <div className="bp-header">
                {[
                  { label: 'DUE DATE', align: 'center', cls: '' },
                  { label: 'TASK',     align: 'left',   cls: '' },
                  { label: 'ID',       align: 'center', cls: 'bp-col-id-hdr' },
                  { label: 'PRIORITY', align: 'center', cls: 'bp-col-priority-hdr' },
                ].map(col => (
                  <div key={col.label} className={col.cls} style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
                    textTransform: 'uppercase', color: 'rgba(139,92,246,0.55)',
                    fontFamily: 'monospace', textAlign: col.align as React.CSSProperties['textAlign'],
                  }}>
                    {col.label}
                  </div>
                ))}
              </div>

              {renderRows(urgentTasks)}

              {/* ── Collapse bar ── */}
              {futureTasks.length > 0 && (
                <button
                  onClick={() => setFutureExpanded(e => !e)}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    background: futureExpanded ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.025)',
                    border: 'none',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    borderBottom: futureExpanded ? '1px solid rgba(139,92,246,0.15)' : '1px solid rgba(255,255,255,0.06)',
                    color: futureExpanded ? 'rgba(167,139,250,0.75)' : 'rgba(255,255,255,0.5)',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'var(--font-body)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    letterSpacing: '0.03em',
                    marginTop: 6,
                    transition: 'all 0.15s',
                    minHeight: 44, // thumb-reachable tap target
                  }}
                >
                  <span>
                    {futureExpanded
                      ? `Hide upcoming ▴`
                      : `Show ${futureTasks.length} more ▾`
                    }
                  </span>
                </button>
              )}

              {/* Future tasks — hidden unless expanded */}
              {futureExpanded && (
                <>
                  <SectionDivider label="Upcoming" count={futureTasks.length} color="#4F8EF7" />
                  {renderRows(futureTasks)}
                </>
              )}
            </div>
          )
        })()}
        </>
      )}

      {/* ── Completion Modal ── */}
      {pendingComplete && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
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
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.5)', marginBottom: 5, fontFamily: 'monospace' }}>Due Date</div>
                  <input
                    type="date"
                    value={nextFlowDueDate}
                    onChange={e => setNextFlowDueDate(e.target.value)}
                    style={{ fontSize: 13, padding: '7px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 7, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)', colorScheme: 'dark' }}
                  />
                </div>
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
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Section Divider — minimal, no ribbon ────────────────────────────────────
// Subsection dividers intentionally smaller/dimmer than top-level panel count
// so the hierarchy stays clear: BATTLE PLAN "27" > UPCOMING "24"
function SectionDivider({ label, count, color, subtitle }: { label: string; count: number; color: string; subtitle?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '5px 14px 4px',
      marginBottom: 2,
      marginTop: 4,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.4)', fontFamily: 'monospace', lineHeight: 1 }}>
          {subtitle || label}
        </div>
      </div>
      {/* Dimmer, smaller pill — subordinate to panel-level count */}
      <div style={{
        fontSize: 9, fontWeight: 600, color: 'rgba(139,92,246,0.4)',
        background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)',
        borderRadius: 999, padding: '0px 7px', fontFamily: 'monospace',
      }}>
        {count}
      </div>
    </div>
  )
}

// ─── Task Row — card-strip design ────────────────────────────────────────────

interface TaskRowProps {
  onPointerDragStart?: (e: React.PointerEvent) => void
  onPointerDragMove?: (e: React.PointerEvent) => void
  onPointerDragEnd?: (e: React.PointerEvent) => void
  task: BattlePlanTask
  deal: DealOption | null
  completing: boolean
  showFollowUp: boolean
  dragOverId: string | null
  draggingId?: string | null
  onComplete: () => void
  onUpdate: (updates: Partial<BattlePlanTask>) => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
  deals: DealOption[]
  entityNames: string[]
}

function TaskRow({
  task, deal, completing, dragOverId, draggingId,
  onComplete, onUpdate,
  onPointerDragStart, onPointerDragMove, onPointerDragEnd,
  deals, entityNames,
}: TaskRowProps) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDealId, setEditDealId] = useState(task.deal_id || '')
  const [editContactName, setEditContactName] = useState(task.contact_name || '')
  const [editIsFamily, setEditIsFamily] = useState(!!task.is_family)
  const [editIsEntity, setEditIsEntity] = useState(!!task.is_entity)
  const [editIsLife, setEditIsLife] = useState(!!task.is_life)
  const [editDueDate, setEditDueDate] = useState(task.due_date ?? '')
  const [circleHovered, setCircleHovered] = useState(false)
  const isDragTarget = dragOverId === task.id && draggingId !== task.id
  const isDragging   = draggingId === task.id
  const isLong = task.title.length > 48

  // Determine accent color from urgency / category
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const isOverdue = task.due_date && task.due_date < today
  const isDueToday = task.due_date === today
  const accentColor = task.is_life
    ? '#f87171'
    : task.is_entity
    ? '#4ade80'
    : isOverdue
    ? '#ef4444'
    : isDueToday
    ? '#fb923c'
    : '#8B5CF6'

  async function saveEdit() {
    if (editTitle.trim()) {
      const updatePayload: Record<string, unknown> = { title: editTitle.trim(), deal_id: editDealId || null, contact_name: editContactName.trim() || null, is_family: editIsFamily || null, is_entity: editIsEntity || null, is_life: editIsLife || null, due_date: editDueDate || null }
      await supabase.from('tasks').update({ due_date: editDueDate || null } as Record<string, unknown>).eq('id', task.id)
      onUpdate(updatePayload as Partial<BattlePlanTask>)
    }
    setEditing(false)
  }

  return (
    <div
      data-task-id={task.id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0,
        background: isDragTarget
          ? 'rgba(232,184,75,0.07)'
          : hovered
          ? 'rgba(139,92,246,0.06)'
          : 'rgba(255,255,255,0.018)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        opacity: completing ? 0.3 : isDragging ? 0.35 : 1,
        transition: 'all 0.1s ease',
        borderRadius: '0 6px 6px 0',
        marginBottom: 2,
      }}
    >
      {/* Left: checkbox */}
      <div className="bp-check-cell" style={{ padding: '10px 10px 10px 12px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <button
          onClick={onComplete}
          onMouseEnter={() => setCircleHovered(true)}
          onMouseLeave={() => setCircleHovered(false)}
          style={{
            width: 18, height: 18, borderRadius: 4,
            border: `1.5px solid ${circleHovered ? 'rgba(139,92,246,0.9)' : 'rgba(139,92,246,0.3)'}`,
            background: circleHovered ? 'rgba(139,92,246,0.18)' : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          {circleHovered && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="rgba(139,92,246,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Center: main content */}
      <div className="bp-row-inner" style={{ flex: 1, padding: '9px 8px 9px 0', minWidth: 0 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              autoFocus
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${accentColor}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
            />
            <input
              value={editContactName}
              onChange={e => setEditContactName(e.target.value)}
              list="bp-contact-list-edit"
              placeholder="ID / Contact..."
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(232,184,75,0.3)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--accent-gold)', outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
            />
            <datalist id="bp-contact-list-edit">
              {Array.from(new Set([...deals.map(d => d.name), ...entityNames].filter(Boolean))).map(n => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.5)', marginBottom: 3, fontFamily: 'monospace' }}>Deadline</div>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={e => setEditDueDate(e.target.value)}
                  style={{ fontSize: 12, padding: '5px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)', colorScheme: 'dark' }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: editIsLife ? '#f87171' : 'var(--text-muted)', cursor: 'pointer', fontWeight: editIsLife ? 700 : 400, marginTop: 14 }}>
                <input type="checkbox" checked={editIsLife} onChange={e => setEditIsLife(e.target.checked)} style={{ width: 14, height: 14, accentColor: '#f87171', cursor: 'pointer' }} />
                <span style={{ fontSize: 13 }}>♥</span> Life
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: editIsEntity ? '#4ade80' : 'var(--text-muted)', cursor: 'pointer', fontWeight: editIsEntity ? 700 : 400, marginTop: 14 }}>
                <input type="checkbox" checked={editIsEntity} onChange={e => setEditIsEntity(e.target.checked)} style={{ width: 14, height: 14, accentColor: '#22c55e', cursor: 'pointer' }} />
                <span style={{ fontSize: 12 }}>🏢</span> Entity
              </label>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={saveEdit} style={{ padding: '4px 12px', background: accentColor, color: '#0D0F14', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditing(false)} style={{ padding: '4px 12px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          /* ── 4-column layout: DUE DATE | TASK | ID | PRIORITY ── */
          <div className="bp-grid">

            {/* Col 1: DUE DATE — centered, hidden on mobile */}
            <div className="bp-col-due" style={{ display: 'flex', justifyContent: 'center' }}>
              <DeadlinePicker
                value={task.due_date ?? null}
                onChange={async (d) => {
                  await supabase.from('tasks').update({ due_date: d } as Record<string, unknown>).eq('id', task.id)
                  onUpdate({ due_date: d })
                }}
              />
            </div>

            {/* Col 2: TASK — left aligned */}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                {task.is_family && <span style={{ flexShrink: 0, marginTop: 2 }}><FamilyIcon active={true} /></span>}
                <span
                  onClick={() => isLong && setExpanded(e => !e)}
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: completing ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: completing ? 'line-through' : 'none',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: expanded ? undefined : 2,
                    WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
                    overflow: expanded ? 'visible' : 'hidden',
                    cursor: isLong ? 'pointer' : 'default',
                    wordBreak: 'break-word',
                    textAlign: 'left',
                  } as React.CSSProperties}
                >
                  {task.title}
                </span>
              </div>
              {isLong && (
                <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 10, color: `${accentColor}80`, cursor: 'pointer', fontFamily: 'var(--font-body)', marginTop: 2 }}>
                  {expanded ? '▲ less' : '▼ more'}
                </button>
              )}
              {/* ID shown inline under task on mobile only */}
              {/* Mobile inline row: assignee chip + due-date indicator */}
              <div className="bp-col-id-mobile" style={{ marginTop: 3, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <style>{`.bp-col-id-mobile { display: none; } @media (max-width: 640px) { .bp-col-id-mobile { display: flex; } }`}</style>
                {task.contact_name && (
                  <ContactBadge contactName={task.contact_name} deal={deal} isLife={!!task.is_life} isEntity={!!task.is_entity} />
                )}
                {task.due_date && (() => {
                  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
                  const overdue = task.due_date < todayStr
                  const dueToday = task.due_date === todayStr
                  const color = overdue ? '#ef4444' : dueToday ? '#fb923c' : '#4F8EF7'
                  // overdue: icon only — text is redundant with red color
                  const label = overdue ? '⚠' : dueToday ? '● today' : (() => {
                    const [y2, m2, d2] = task.due_date.split('-').map(Number)
                    const dt2 = new Date(y2, m2 - 1, d2)
                    const dow2 = dt2.toLocaleDateString('en-US', { weekday: 'short' })
                    return `${dow2} ${m2}/${d2}`
                  })()
                  return (
                    <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: 'monospace', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                      {label}
                    </span>
                  )
                })()}
              </div>
            </div>

            {/* Col 3: ID — hidden on mobile */}
            <div className="bp-col-id" style={{ justifyContent: 'center' }}>
              <ContactBadge contactName={task.contact_name ?? null} deal={deal} isLife={!!task.is_life} isEntity={!!task.is_entity} />
            </div>

            {/* Col 4: PRIORITY — hidden on mobile */}
            <div className="bp-col-priority" style={{ justifyContent: 'center' }}>
              <BpStarPicker
                value={task.bp_priority ?? null}
                onChange={async (v) => {
                  await supabase.from('tasks').update({ bp_priority: v } as Record<string, unknown>).eq('id', task.id)
                  onUpdate({ bp_priority: v })
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Right: edit + drag (only on hover) */}
      {!editing && hovered && (
        <div style={{ padding: '12px 8px 12px 4px', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => { setEditTitle(task.title); setEditDealId(task.deal_id || ''); setEditContactName(task.contact_name || ''); setEditIsFamily(!!task.is_family); setEditIsEntity(!!task.is_entity); setEditIsLife(!!task.is_life); setEditDueDate(task.due_date ?? ''); setEditing(true) }}
            title="Edit"
            style={{ padding: '3px 6px', background: 'transparent', border: `1px solid ${accentColor}40`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.8 }}
          >
            <PencilIcon />
          </button>
          <span
            onPointerDown={onPointerDragStart}
            onPointerMove={onPointerDragMove}
            onPointerUp={onPointerDragEnd}
            onPointerCancel={onPointerDragEnd}
            style={{ fontSize: 15, color: 'var(--text-muted)', cursor: 'grab', opacity: 0.6, userSelect: 'none', touchAction: 'none', padding: '2px 4px' }}>
            ⠿
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Family Icon — home/shield SVG, red when active ──────────────────────────
function FamilyIcon({ active }: { active: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#ef4444' : 'currentColor'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, filter: active ? 'drop-shadow(0 0 4px rgba(239,68,68,0.5))' : 'none' }}
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

// ─── BP Star Picker ──────────────────────────────────────────────────────────
function BpStarPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value ?? 0
  return (
    <div style={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          onClick={() => onChange(value === i ? null : i)}
          style={{
            fontSize: 14, cursor: 'pointer',
            color: i <= display ? '#E8B84B' : 'rgba(255,255,255,0.15)',
            lineHeight: 1, transition: 'color 0.1s', userSelect: 'none',
          }}
        >★</span>
      ))}
    </div>
  )
}

// ─── Contact Badge — colored by matched deal status ───────────────────────────
const BP_STATUS_BADGE_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  active:          { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.35)',   color: '#22c55e' },
  hot:             { bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.35)',  color: '#fb923c' },
  in_review:       { bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.35)',  color: '#fbbf24' },
  in_service:      { bg: 'rgba(45,212,191,0.1)',   border: 'rgba(45,212,191,0.35)', color: '#2dd4bf' },
  under_contract:  { bg: 'rgba(45,212,191,0.1)',   border: 'rgba(45,212,191,0.35)', color: '#2dd4bf' },
  pending_payment: { bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.35)', color: '#fbbf24' },
  pipeline:        { bg: 'rgba(79,142,247,0.1)',   border: 'rgba(79,142,247,0.35)', color: '#4F8EF7' },
  closed:          { bg: 'rgba(107,114,128,0.1)',  border: 'rgba(107,114,128,0.3)', color: '#9ca3af' },
}
const BP_NEUTRAL_BADGE = { bg: 'rgba(232,184,75,0.08)', border: 'rgba(232,184,75,0.25)', color: 'rgba(232,184,75,0.8)' }

// Color rule: LIFE = red, entity/company = purple, person = gold
// is_entity flag = true → purple regardless of deal linkage
// No flag, no deal → gold (person assumed)
// Deal-linked person → gold with deal-status tint
function ContactBadge({ contactName, deal, isLife, isEntity }: { contactName: string | null; deal: DealOption | null; isLife?: boolean; isEntity?: boolean }) {
  // LIFE badge — red with heart icon (highest priority)
  if (isLife || contactName === 'LIFE') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '2px 8px',
        background: 'rgba(239,68,68,0.15)',
        borderRadius: 4, fontSize: 12, fontWeight: 700,
        color: '#f87171', whiteSpace: 'nowrap',
      }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="#f87171" stroke="#f87171" strokeWidth="1">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        LIFE
      </span>
    )
  }
  // ENTITY / COMPANY badge — purple
  if (isEntity) {
    return (
      <span style={{
        display: 'inline-block', padding: '2px 8px',
        background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)',
        borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#a78bfa',
        whiteSpace: 'nowrap', fontVariantCaps: 'small-caps' as React.CSSProperties['fontVariantCaps'],
      }} title={contactName ?? undefined}>
        {contactName || 'Entity'}
      </span>
    )
  }
  if (!contactName) return <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.1)' }}>—</span>
  // PERSON badge — gold (with deal-status tint if linked to a deal)
  const style = (deal as any)?.status ? (BP_STATUS_BADGE_COLORS[(deal as any).status] ?? BP_NEUTRAL_BADGE) : BP_NEUTRAL_BADGE
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      background: style.bg,
      border: `1px solid ${style.border}`,
      borderRadius: 4, fontSize: 12, fontWeight: 600, color: style.color,
      whiteSpace: 'nowrap', letterSpacing: '0.02em', fontVariantCaps: 'small-caps' as React.CSSProperties['fontVariantCaps'],
    }} title={contactName}>
      {contactName}
    </span>
  )
}

// ─── Deadline Picker ─────────────────────────────────────────────────────────
function DeadlinePicker({ value, onChange }: { value: string | null; onChange: (d: string | null) => void }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const isOverdue = value && value < today
  const isToday   = value === today
  const isSoon    = value && value > today && value <= new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

  function fmtDate(d: string) {
    const [y, m, day] = d.split('-').map(Number)
    const dt = new Date(y, m - 1, day)
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
    const [ty, tm, td] = todayStr.split('-').map(Number)
    const todayMidnight = new Date(ty, tm - 1, td)
    const diffDays = Math.round((dt.getTime() - todayMidnight.getTime()) / 86400000)
    if (diffDays === 0) return 'Today'
    // Always "Mon 4/20" format — unambiguous, compact, consistent
    const dow = dt.toLocaleDateString('en-US', { weekday: 'short' })  // "Mon"
    return `${dow} ${m}/${day}`
  }

  if (!value) {
    return (
      <input
        type="date"
        onChange={e => onChange(e.target.value || null)}
        style={{ width: 80, fontSize: 10, padding: '2px 4px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: 'rgba(255,255,255,0.2)', outline: 'none', cursor: 'pointer' }}
      />
    )
  }

  if (isOverdue) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <path d="M8 1.5L1 14.5h14L8 1.5z" stroke="#ef4444" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M8 6v3.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="8" cy="12" r="0.8" fill="#ef4444"/>
        </svg>
      </span>
    )
  }

  if (isToday) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center',
        fontSize: 13, fontWeight: 700,
        color: 'rgba(139,92,246,0.75)', whiteSpace: 'nowrap', letterSpacing: '0.06em',
        textTransform: 'uppercase', fontFamily: 'monospace',
      }}>
        Today
      </span>
    )
  }

  const color = '#4F8EF7'
  return (
    <span
      title={value}
      style={{ fontSize: 14, fontWeight: 600, color, fontFamily: 'monospace', whiteSpace: 'nowrap', fontVariantCaps: 'small-caps' as React.CSSProperties['fontVariantCaps'] }}>
      {fmtDate(value)}
    </span>
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

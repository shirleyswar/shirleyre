'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

// Count-up animation — rolls from 0 to target on mount/change
function useCountUp(target: number, duration = 600): number {
  const [display, setDisplay] = useState(0)
  const animRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const startRef = useRef(0)
  const startValRef = useRef(0)
  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    startRef.current = performance.now()
    startValRef.current = display
    function step(now: number) {
      const elapsed = now - startRef.current
      const p = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(startValRef.current + (target - startValRef.current) * eased))
      if (p < 1) animRef.current = requestAnimationFrame(step)
    }
    animRef.current = requestAnimationFrame(step)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps
  return display
}
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
  const animatedCount = useCountUp(openTasks.length, 700)

  // ── Bucket collapse state ────────────────────────────────────────────────
  const [collapsedBuckets, setCollapsedBuckets] = useState<{ overdue: boolean; today: boolean; thisWeek: boolean; later: boolean; none: boolean }>({ overdue: false, today: false, thisWeek: true, later: true, none: false })
  function toggleBucket(key: keyof typeof collapsedBuckets) {
    setCollapsedBuckets(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="wr-card" style={{ padding: 0, position: 'relative', paddingBottom: 80, background: 'linear-gradient(160deg, #0d1520 0%, #111827 60%, #0a1220 100%)', border: '1px solid rgba(139,92,246,0.15)' }}>
      {/* ── Panel Header — icon + title-case title ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '16px 20px 0',
        marginBottom: 12,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', marginRight: 8 }}>
          <SwordIcon />
        </span>
        <span style={{
          fontSize: 15, fontWeight: 600,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-body)',
          letterSpacing: '-0.01em',
        }}>
          Battle Plan
        </span>
        <span style={{
          marginLeft: 10,
          fontSize: 12, fontWeight: 500,
          color: 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {openTasks.length > 0 ? animatedCount : ''}
        </span>
        <div style={{ flex: 1 }} />
      </div>

      {/* ── Toolbar: Add Item button + sort dropdown ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px', marginBottom: 12 }}>
        {/* Add Item button — fallback for when FAB is not visible */}
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            height: 30, padding: '0 12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 7,
            color: 'rgba(255,255,255,0.7)',
            fontSize: 12, fontWeight: 500,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1, color: 'rgba(255,255,255,0.4)', fontWeight: 300 }}>+</span>
          Add Item
        </button>

        <div style={{ flex: 1 }} />

        {/* Sort dropdown — identical visual treatment to Add Item */}
        <select
          value={sortMode}
          onChange={e => setSortMode(e.target.value as typeof sortMode)}
          style={{
            height: 30,
            padding: '0 26px 0 10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.6)',
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            outline: 'none',
            appearance: 'none' as React.CSSProperties['appearance'],
            WebkitAppearance: 'none' as React.CSSProperties['WebkitAppearance'],
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='rgba(255,255,255,0.22)'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            minWidth: 108,
          }}
        >
          <option value="due_date">Due date</option>
          <option value="priority">Priority</option>
          <option value="assignee">Assignee</option>
          <option value="recent">Recently added</option>
        </select>
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

          // 5-bucket grouping
          const week7 = new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
          const buckets: { key: keyof typeof collapsedBuckets; label: string; color: string; tasks: BattlePlanTask[] }[] = [
            { key: 'overdue',  label: 'Overdue',      color: '#ef4444',              tasks: sorted.filter(t => t.due_date && t.due_date < today) },
            { key: 'today',    label: 'Today',        color: '#E8B84B',              tasks: sorted.filter(t => t.due_date === today) },
            { key: 'thisWeek', label: 'This Week',    color: '#4F8EF7',              tasks: sorted.filter(t => t.due_date && t.due_date > today && t.due_date <= week7) },
            { key: 'later',    label: 'Later',        color: 'rgba(255,255,255,0.35)', tasks: sorted.filter(t => t.due_date && t.due_date > week7) },
            { key: 'none',     label: 'No Due Date',  color: 'rgba(255,255,255,0.2)', tasks: sorted.filter(t => !t.due_date) },
          ]

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
              {/* Row grid system — desktop 4-col, mobile single-col */}
              <style>{`
                /* Row: checkbox | task+chip | spacer | date | priority | drag */
                .bp-grid { display: flex; align-items: center; width: 100%; gap: 0; }
                .bp-grid-task { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
                .bp-grid-date { width: 90px; flex-shrink: 0; display: flex; justify-content: flex-end; }
                .bp-grid-priority { width: 72px; flex-shrink: 0; display: flex; justify-content: center; }
                .bp-col-id { display: flex; align-items: center; }
                /* Mobile: hide date col, priority col, and assignee chips — let titles breathe */
                @media (max-width: 640px) {
                  .bp-grid-date { display: none; }
                  .bp-grid-priority { display: none; }
                  .bp-col-id { display: none; }
                  .bp-chip-hide-mobile { display: none !important; }
                }
              `}</style>

              {buckets.map(bucket => {
                if (bucket.tasks.length === 0) return null
                const isCollapsed = collapsedBuckets[bucket.key]
                return (
                  <div key={bucket.key}>
                    <button
                      onClick={() => toggleBucket(bucket.key)}
                      style={{ display:'flex', alignItems:'center', gap:6, width:'100%', background:'none', border:'none', padding:'10px 0 5px 20px', cursor:'pointer' }}
                    >
                      <span style={{ fontSize:9, fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase', color: bucket.color, fontFamily:'monospace' }}>
                        {bucket.label} · {bucket.tasks.length}
                      </span>
                      <span style={{ fontSize:9, color:'rgba(255,255,255,0.2)', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition:'transform 0.18s ease', display:'inline-block' }}>▾</span>
                    </button>
                    {!isCollapsed && renderRows(bucket.tasks)}
                  </div>
                )
              })}
            </div>
          )
        })()}
        </>
      )}

      {/* ── FAB — Add action item ── */}
      <button
        onClick={() => setShowAddForm(true)}
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.85), rgba(109,40,217,0.95))',
          border: '1px solid rgba(167,139,250,0.5)',
          color: '#fff',
          fontSize: 26,
          fontWeight: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 0 28px rgba(139,92,246,0.5), 0 4px 16px rgba(0,0,0,0.4)',
          lineHeight: 1,
          zIndex: 10,
          flexShrink: 0,
        }}
        aria-label="Add action item"
      >
        +
      </button>

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
                <div style={{ fontSize: 11, color: 'var(--accent-violet-lt)', marginBottom: 16, fontFamily: 'monospace' }}>
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
        alignItems: 'center',           // single vertical axis
        minHeight: 52,                   // locked row height — desktop
        background: isDragTarget
          ? 'rgba(232,184,75,0.05)'
          : hovered
          ? 'rgba(255,255,255,0.03)'
          : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        opacity: completing ? 0.3 : isDragging ? 0.35 : 1,
        transition: 'background 0.1s ease',
        position: 'relative',
      }}
    >

      {/* Checkbox — custom 4px-radius, animated check on hover/complete */}
      <div style={{ padding: '0 10px 0 16px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <button
          onClick={onComplete}
          onMouseEnter={() => setCircleHovered(true)}
          onMouseLeave={() => setCircleHovered(false)}
          style={{
            width: 22, height: 22,
            borderRadius: 11,  // full circle
            border: `2px solid ${
              circleHovered
                ? 'rgba(255,255,255,0.45)'
                : 'rgba(255,255,255,0.15)'
            }`,
            background: circleHovered
              ? 'rgba(255,255,255,0.08)'
              : 'transparent',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'border-color 0.15s, background 0.15s, transform 0.12s',
            transform: circleHovered ? 'scale(1.08)' : 'scale(1)',
            flexShrink: 0,
            padding: 0,
          }}
          aria-label="Complete task"
        >
          {/* Check mark — fades in on hover */}
          <svg
            width="9" height="7" viewBox="0 0 9 7" fill="none"
            style={{ opacity: circleHovered ? 1 : 0, transition: 'opacity 0.12s ease' }}
          >
            <path
              d="M1.5 3.5L3.5 5.5L7.5 1.5"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Main content — fills remaining width */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0, padding: '0 0 0 0' }}>
        {editing ? (
          /* ── Edit mode ── */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 16px 10px 0' }}>
            <input
              autoFocus
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.2)`, borderRadius: 6, padding: '7px 10px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
            />
            <input
              value={editContactName}
              onChange={e => setEditContactName(e.target.value)}
              list="bp-contact-list-edit"
              placeholder="Assignee / contact..."
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text-muted)', outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
            />
            <datalist id="bp-contact-list-edit">
              {Array.from(new Set([...deals.map(d => d.name), ...entityNames].filter(Boolean))).map(n => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 3, fontFamily: 'monospace' }}>Deadline</div>
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
              <button onClick={saveEdit} style={{ padding: '5px 14px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditing(false)} style={{ padding: '5px 14px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          /* ── View mode: single horizontal axis ── */
          <div className="bp-grid">
            {/* Task title — visual anchor, heavier weight */}
            <div className="bp-grid-task">
              {task.is_family && <span style={{ flexShrink: 0 }}><FamilyIcon active={true} /></span>}
              <span
                onClick={() => isLong && setExpanded(e => !e)}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: completing ? 'var(--text-muted)' : 'var(--text-primary)',
                  textDecoration: completing ? 'line-through' : 'none',
                  lineHeight: 1.35,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: expanded ? undefined : 1,
                  WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
                  cursor: isLong ? 'pointer' : 'default',
                  letterSpacing: '-0.01em',
                } as React.CSSProperties}
              >
                {task.title}
              </span>

              {/* Assignee chip — inline right of title; hidden on mobile for density */}
              {task.contact_name && (
                <span className="bp-chip-hide-mobile" style={{ flexShrink: 0 }}>
                  <ContactBadge contactName={task.contact_name} deal={deal} isLife={!!task.is_life} isEntity={!!task.is_entity} />
                </span>
              )}

              {/* Mobile: due date inline (hidden on desktop via bp-grid-date) */}
              {task.due_date && (() => {
                const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
                const isOvd = task.due_date < todayStr
                const isDT = task.due_date === todayStr
                const color = isOvd ? '#ef4444' : isDT ? '#E8B84B' : 'rgba(255,255,255,0.3)'
                const [, m2, d2] = task.due_date.split('-').map(Number)
                const dt2 = new Date(parseInt(task.due_date.split('-')[0]), m2 - 1, d2)
                const dow2 = dt2.toLocaleDateString('en-US', { weekday: 'short' })
                // overdue: show red date — accent bar owns the warning signal, no triangle
                const label = isOvd ? `${dow2} ${m2}/${d2}` : isDT ? '● today' : `${dow2} ${m2}/${d2}`
                return (
                  <span className="bp-mobile-date" style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, color, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    <style>{`.bp-mobile-date { display: none; } @media (max-width: 640px) { .bp-mobile-date { display: inline; } }`}</style>
                    {label}
                  </span>
                )
              })()}
            </div>

            {/* Desktop: date — right-aligned in its column */}
            <div className="bp-grid-date">
              <DeadlinePicker
                value={task.due_date ?? null}
                onChange={async (d) => {
                  await supabase.from('tasks').update({ due_date: d } as Record<string, unknown>).eq('id', task.id)
                  onUpdate({ due_date: d })
                }}
              />
            </div>

            {/* Desktop: priority stars */}
            <div className="bp-grid-priority">
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

      {/* Edit + drag — visible on hover, right edge */}
      {!editing && hovered && (
        <div style={{ padding: '0 12px 0 8px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => { setEditTitle(task.title); setEditDealId(task.deal_id || ''); setEditContactName(task.contact_name || ''); setEditIsFamily(!!task.is_family); setEditIsEntity(!!task.is_entity); setEditIsLife(!!task.is_life); setEditDueDate(task.due_date ?? ''); setEditing(true) }}
            title="Edit"
            style={{ padding: '3px 5px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.6, transition: 'opacity 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
          >
            <PencilIcon />
          </button>
          <span
            onPointerDown={onPointerDragStart}
            onPointerMove={onPointerDragMove}
            onPointerUp={onPointerDragEnd}
            onPointerCancel={onPointerDragEnd}
            style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', cursor: 'grab', userSelect: 'none', touchAction: 'none', padding: '2px 2px', letterSpacing: '0.05em' }}>
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
    // Triangle gone — left accent bar owns the overdue signal.
    // Show the date in red so user knows exactly which day it was due.
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, color: '#ef4444',
        fontFamily: 'monospace', whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
      }}>
        {fmtDate(value!)}
      </span>
    )
  }

  if (isToday) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center',
        fontSize: 13, fontWeight: 700,
        color: '#E8B84B', whiteSpace: 'nowrap', letterSpacing: '0.06em',
        textTransform: 'uppercase', fontFamily: 'monospace',
      }}>
        Today
      </span>
    )
  }

  const color = 'rgba(255,255,255,0.35)'
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
  // Vertical broadsword, point down — matches Sidebar icon vocabulary
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 L10.5 14 L12 16 L13.5 14 Z" />
      <line x1="7" y1="14" x2="17" y2="14" />
      <line x1="12" y1="14" x2="12" y2="20" />
      <circle cx="12" cy="21.5" r="1.5" />
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

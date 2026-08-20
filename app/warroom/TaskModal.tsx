'use client'
/**
 * D11 — Desktop Task Modal
 * 960px two-column centred modal over a scrim.
 * Spec: DESKTOP_TASK_MODAL_SPEC 8.18.26 2115.md
 * Commit: 8.18.26j
 */

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { isTaskStaged, TaskStagingState } from '@/lib/taskStagingPredicate'
import {
  DS0, DS2, DS4, DS5, DS6,
  DT0, DT3, DT4, DT5, DT7, DM2,
} from '@/components/warroom/desktopTypes'

// ── Tokens — same as page.tsx C object ───────────────────────────────────────
const C = {
  bgBase:      '#050509',
  bgPanel:     '#12111B',
  bgRail:      '#0C0B14',
  bgRaise:     '#1E1D26',
  textHi:      '#EFEEF4',
  textMid:     '#B8B6C6',
  textLow:     '#8E8CA0',
  brand:       '#8B5CF6',
  brandLift:   '#A78BFA',
  brandStrong: '#7C3AED',
  moneyIn:     '#34D399',
  late:        '#FF4D4D',
  hot:         '#FFA23A',
  border:      'rgba(255,255,255,0.14)',
  borderPanel: 'rgba(255,255,255,0.11)',
  borderHair:  'rgba(255,255,255,0.10)',
} as const

const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISP = "'Space Grotesk', system-ui, sans-serif"

const STAGED_GRADIENT = 'radial-gradient(circle at 50% 47%, #5B3FA8 0%, #2A1D52 26%, #120E22 62%, #07060C 100%)'

// ── Task type ─────────────────────────────────────────────────────────────────
export interface Task {
  id: string
  title: string
  status: string
  due_date: string | null
  completed_at?: string | null
  deal_id: string | null
  is_life: boolean
  is_entity: boolean
  entity_id?: string | null
  sort_order?: number | null
  created_at?: string
  deals?: {
    name?: string
    address?: string
    addr_display?: string | null
    addr_street_name?: string | null
    addr_number?: string | null
    addr_city?: string | null
  } | null
  entities?: { name?: string } | null
}

interface TaskNote {
  id: string
  task_id: string
  body: string
  created_at: string
}

export interface TaskModalProps {
  task: Task
  onClose: () => void
  onCompleted: (task: Task) => void
  onSaved: () => void
}

// ── Date helpers — D11.6, local calendar parse only ──────────────────────────
function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return dt.toLocaleDateString('en-CA')
}

function nextMonday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const diff = ((1 - dt.getDay()) + 7) % 7 || 7
  dt.setDate(dt.getDate() + diff)
  return dt.toLocaleDateString('en-CA')
}

function formatDue(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return dateStr < todayLocal()
}

function committedListType(task: Task): 'life' | 'entity' | null {
  if (task.is_life) return 'life'
  if (task.is_entity) return 'entity'
  return null
}

function formatNoteDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase()
}

// ── Trash icon ────────────────────────────────────────────────────────────────
function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  )
}

// ── External link icon ────────────────────────────────────────────────────────
function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  )
}

// ── TaskModal ─────────────────────────────────────────────────────────────────
export default function TaskModal({ task, onClose, onCompleted, onSaved }: TaskModalProps) {
  // ── State machine ──────────────────────────────────────────────────────────
  const [mode, setMode] = useState<'read' | 'edit'>('read')
  const [stagedDate, setStagedDate] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [localTitle, setLocalTitle] = useState(task.title)
  const [listType, setListType] = useState<'life' | 'entity' | null>(committedListType(task))
  const [notes, setNotes] = useState<TaskNote[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [committed, setCommitted] = useState(false)
  const [showDiscard, setShowDiscard] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pickerDate, setPickerDate] = useState('')

  const titleRef = useRef<HTMLTextAreaElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const desktopDeleteRef = useRef<HTMLButtonElement>(null)
  // Ref-copy of isActive — prevents stale closure in the Esc keydown handler.
  // Without this, a handler registered when isActive=false never sees it become true.
  const isActiveRef = useRef(false)
  // committedTitleRef tracks the last successfully-saved title.
  // task.title is the prop at open time and never updates during the modal's life.
  // After a successful CONFIRM we advance this ref so titleEdited returns false immediately —
  // preventing isTaskStaged() from staying true on stale prop comparison.
  const committedTitleRef = useRef(task.title)

  const titleEdited = localTitle !== committedTitleRef.current
  const committeListType = committedListType(task)

  // ── Staging predicate (D11.5) ──────────────────────────────────────────────
  const stagingState: TaskStagingState = {
    stagedDate,
    committedDate: task.due_date,
    noteText,
    titleEdited,
    listType,
    committedListType: committeListType,
  }
  const isActive = isTaskStaged(stagingState)
  // Keep ref in sync so the Esc handler always reads the current value without being re-registered.
  isActiveRef.current = isActive

  // ── Load notes ─────────────────────────────────────────────────────────────
  const loadNotes = useCallback(async () => {
    const { data } = await supabase
      .from('task_note')
      .select('id, task_id, body, created_at')
      .eq('task_id', task.id)
      .order('created_at', { ascending: false })
    setNotes((data ?? []) as TaskNote[])
  }, [task.id])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  // ── Focus trap + initial focus ────────────────────────────────────────────
  // Set focus on the modal container itself on mount so Tab is immediately trapped.
  useLayoutEffect(() => {
    modalRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (!modalRef.current) return
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      // If focus is outside the modal (e.g. on document.body), send it to first element
      if (!modalRef.current.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
        return
      }
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', handleTab)
    return () => window.removeEventListener('keydown', handleTab)
  }, [])

  // ── Esc key — D11.4 ruling 2 ──────────────────────────────────────────────
  // Registered once (empty dep array). Uses isActiveRef to read current staged state
  // without re-registering — fixes the "second press dead" bug where re-registration
  // on isActive change left a race window where the listener didn't exist.
  //
  // Two-step rule:
  //   1. A field has focus → blur it. (First Esc press out of a textarea.)
  //   2. No field has focus → attempt close. (Second Esc press.)
  //
  // We check document.activeElement BEFORE calling blur() so we read the element
  // that is currently focused, not whatever the browser has already transitioned to.
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const active = document.activeElement
      const isField = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      if (isField) {
        e.preventDefault()
        ;(active as HTMLElement).blur()
        return
      }
      // Nothing focused (or focus is on modal container / body) → attempt close
      if (isActiveRef.current) {
        setShowDiscard(true)
      } else {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function attemptClose() {
    // Uses isActiveRef so this is always current, even when called from stable callbacks.
    if (isActiveRef.current) {
      setShowDiscard(true)
    } else {
      onClose()
    }
  }

  // ── Commit path ───────────────────────────────────────────────────────────
  async function runCommit(): Promise<boolean> {
    setSaving(true)
    setError(null)
    const dueDateVal = stagedDate ?? null
    const noteBody = noteText.trim() || null
    const newTitle = titleEdited ? localTitle : null
    const newListType = listType !== committeListType ? listType : null

    const { error: rpcErr } = await supabase.rpc('commit_task_sheet', {
      p_task_id:  task.id,
      p_due_date: dueDateVal,
      p_list_type: newListType,
      p_note_body: noteBody,
      p_title:    newTitle,
    })
    setSaving(false)
    if (rpcErr) {
      setError(rpcErr.message || 'Save failed. Try again.')
      return false
    }
    return true
  }

  async function handleConfirm() {
    if (!isActive || saving || committed) return
    const ok = await runCommit()
    if (!ok) return
    // Advance committedTitleRef so titleEdited → false immediately.
    // task.title prop never updates during modal life; this is the only way to clear it.
    committedTitleRef.current = localTitle
    // Reset all staged values synchronously so isTaskStaged() returns false
    // before the committed flash ends. On failed commit nothing is touched.
    setStagedDate(null)
    setNoteText('')            // empties composer — prevents duplicate note on second CONFIRM
    setListType(committeListType)
    setCommitted(true)
    // Refresh notes in the background — do not await; it must not delay the flash or close.
    loadNotes().catch(() => {})
    // Ruling: CONFIRM closes. Hold committed state ~1.5s then close.
    setTimeout(() => {
      setCommitted(false)
      onSaved()                // triggers parent re-fetch + closes modal
    }, 1500)
  }

  async function handleDone() {
    // Commit staged changes, then mark complete
    const ok = await runCommit()
    if (!ok) return
    const { error: updateErr } = await supabase
      .from('tasks')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', task.id)
    if (updateErr) {
      setError('Staged changes saved — could not mark complete.')
      return
    }
    onCompleted(task)
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  // Hard delete — same model as mobile. task_note cascades.
  async function handleDelete() {
    setSaving(true)
    const { error: err } = await supabase.from('tasks').delete().eq('id', task.id)
    setSaving(false)
    if (err) {
      setError('Could not delete — try again')
      setShowDeleteConfirm(false)
      setTimeout(() => desktopDeleteRef.current?.focus(), 50)
      return
    }
    setShowDeleteConfirm(false)
    onClose()
  }

  // ── Chip dates ────────────────────────────────────────────────────────────
  const today = todayLocal()
  const tomorrow = addDays(today, 1)
  const nextMon = nextMonday(today)

  const chips: { label: string; value: string | 'pick' }[] = [
    { label: 'Today',    value: today },
    { label: 'Tomorrow', value: tomorrow },
    { label: 'Next Mon', value: nextMon },
    { label: 'Pick date', value: 'pick' },
  ]

  function chipClick(value: string) {
    if (value === 'pick') {
      setPickerDate(stagedDate ?? task.due_date ?? today)
      setShowDatePicker(true)
      return
    }
    setStagedDate(prev => prev === value ? null : value)
  }

  // ── Enter edit mode ───────────────────────────────────────────────────────
  function enterEdit() {
    setMode('edit')
    setTimeout(() => {
      titleRef.current?.focus()
      autoSizeTitle()
    }, 50)
  }

  // ── Auto-size title textarea — eliminates the ~90px dead band ─────────────
  // rows={3} at DS0 (32px/1.3) = ~125px for a one-liner title. Set height to
  // scrollHeight on every keystroke so the field is exactly as tall as its content.
  function autoSizeTitle() {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  function cancelEdit() {
    setMode('read')
    setLocalTitle(task.title)
  }

  // ── Deal address ──────────────────────────────────────────────────────────
  function dealAddr(): string {
    const d = task.deals
    if (!d) return ''
    if (d.addr_display) return d.addr_display
    if (d.addr_street_name) {
      const parts: string[] = [d.addr_street_name]
      if (d.addr_city && d.addr_city !== 'Baton Rouge') parts.push('·', d.addr_city)
      if (d.addr_number) parts.push(d.addr_number)
      return parts.join(' ')
    }
    return d.name ?? ''
  }

  // ── Due display ───────────────────────────────────────────────────────────
  const displayDate = stagedDate ?? task.due_date
  const overdue = isOverdue(task.due_date)

  // ── Scrim click — D11.4 ruling 3 ─────────────────────────────────────────
  function handleScrimClick() {
    if (isActive) return // inert when staged
    onClose()
  }

  return (
    <>
      {/* Scrim */}
      <div
        onClick={handleScrimClick}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          zIndex: 200,
        }}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}  // makes the container focusable so Tab trap can start here
        style={{
          outline: 'none',  // suppress focus ring on the container itself
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(960px, calc(100vw - 96px))',
          maxHeight: 'calc(100vh - 120px)',
          zIndex: 300,
          background: C.bgPanel,
          border: `1px solid ${C.border}`,
          borderRadius: 18,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: FONT_DISP,
          color: C.textHi,
        }}
      >
        {/* ── HEADER (72px) ──────────────────────────────────────────────── */}
        {/* Three-column flex: left (label, flex:1) · centre (DELETE, shrink-0) · right (actions, flex:1 justify-end)
            DELETE is immune to label length. × ESC is always the last child of the right zone. */}
        <div style={{
          height: 72,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          borderBottom: `1px solid ${C.borderPanel}`,
        }}>
          {/* Left zone — flex:1 so it absorbs available space */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <span style={{ ...DT0, color: C.textMid }}>
              {mode === 'edit' ? 'Edit Task' : 'Task'}
            </span>
          </div>

          {/* Centre zone — DELETE asset, edit state only. flexShrink:0 so it doesn't compress.
              Centred because both side zones are flex:1. Immune to label length.
              Desktop: pointer-driven — rendered image box is the target, same as ×.
              Mount by height (24px). 102.0px width is arithmetic; DOM measures it. */}
          {mode === 'edit' ? (
            <button
              ref={desktopDeleteRef}
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                flexShrink: 0,
                background: 'transparent', border: 'none', padding: 0,
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/delete/delete-h76.png"
                alt="Delete"
                height={24}
                style={{ height: 24, width: 'auto', display: 'block' }}
              />
            </button>
          ) : (
            <div style={{ flexShrink: 0, width: 0 }} />
          )}

          {/* Right zone — flex:1, children pushed right. × ESC always last and never moves. */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16 }}>
          {/* READ  → DONE caption + checkmark. EDIT → empty (DELETE is centred above). */}
          {mode === 'read' && (
            <button
              onClick={handleDone}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'transparent',
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                padding: 0,
                flexShrink: 0,
              }}
            >
              <span style={{ ...DM2, color: C.moneyIn }}>DONE</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/check/check-h140.png"
                alt="Done"
                width={56}
                height={56}
                style={{ width: 56, height: 56, display: 'block' }}
              />
            </button>
          )}

          {/* × ESC — always last in right zone, never moves. */}
          <button
            onClick={attemptClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 22, color: C.textLow, lineHeight: 1 }}>×</span>
            <span style={{ ...DT5, color: C.textLow }}>ESC</span>
          </button>
          </div>{/* end right zone */}
        </div>{/* end header */}

        {/* ── CONTENT ──────────────────────────────────────────────────────── */}
        <div style={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
          overflow: 'hidden',
        }}>
          {/* ── LEFT COLUMN (600px) ──────────────────────────────────────── */}
          <div style={{
            width: 600,
            flexShrink: 0,
            padding: 24,
            paddingBottom: 32,  // clearance so delete row doesn't press against the footer
            overflowY: 'auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}>
            {/* Error banner */}
            {error && (
              <div style={{
                background: `rgba(255,77,77,0.12)`,
                border: `1px solid rgba(255,77,77,0.30)`,
                borderRadius: 10,
                padding: '10px 14px',
                ...DS5,
                color: C.late,
              }}>
                {error}
              </div>
            )}

            {/* 1. Status eyebrow — DT4: 12px/500/0 mono UPPER (D2.5) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...DT4, color: overdue ? C.late : C.brandLift }}>
                {overdue ? 'OVERDUE' : 'OPEN'}
              </span>
              <span style={{ ...DT4, color: C.textLow }}>
                BATTLE PLAN
              </span>
            </div>

            {/* 2. Title */}
            {mode === 'read' ? (
              <div
                data-modal-title="true"
                onClick={enterEdit}
                style={{
                  ...DS0,
                  color: C.textHi,
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,255,255,0.09)',
                  paddingBottom: 12,
                  lineHeight: 1.3,
                }}
              >
                {localTitle}
              </div>
            ) : (
              <textarea
                ref={titleRef}
                value={localTitle}
                onChange={e => { setLocalTitle(e.target.value); autoSizeTitle() }}
                rows={1}
                style={{
                  ...DS0,
                  color: C.textHi,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 0,
                  padding: '0 0 12px',
                  resize: 'none',
                  width: '100%',
                  outline: 'none',
                  lineHeight: 1.3,
                  fontFamily: FONT_DISP,
                  overflow: 'hidden',  // prevents scrollbar flash during height transition
                }}
              />
            )}

            {/* 3. Deal row */}
            {task.deal_id && task.deals && (
              <a
                href={`/warroom/deal?id=${task.deal_id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: C.bgRaise,
                  borderRadius: 10,
                  padding: '10px 14px',
                  textDecoration: 'none',
                  border: `1px solid ${C.borderPanel}`,
                }}
              >
                <div>
                  <div style={{ ...DT5, color: C.textLow, marginBottom: 2 }}>DEAL</div>
                  <div style={{ ...DS5, color: C.textHi }}>{dealAddr() || task.deals.name}</div>
                </div>
                <div style={{ color: C.brandLift, flexShrink: 0 }}>
                  <ExternalIcon />
                </div>
              </a>
            )}

            {/* 4. DUE section */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ ...DT5, color: C.textLow }}>DUE</span>
                <span style={{ position: 'relative' }}>
                  {stagedDate && task.due_date && stagedDate !== task.due_date ? (
                    <span>
                      <span style={{ ...DS5, color: C.textMid, textDecoration: 'line-through', marginRight: 8 }}>
                        {formatDue(task.due_date)}
                      </span>
                      <span style={{ ...DS5, color: C.brandLift }}>
                        {formatDue(stagedDate)}
                      </span>
                    </span>
                  ) : displayDate ? (
                    <span style={{
                      ...DS5,
                      color: overdue && !stagedDate ? C.late : C.textMid,
                    }}>
                      {formatDue(displayDate)}
                    </span>
                  ) : (
                    <span style={{ ...DS5, color: C.textLow }}>No due date</span>
                  )}
                </span>
              </div>

              {/* Chips */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', position: 'relative' }}>
                {chips.map(chip => {
                  const isStaged = chip.value !== 'pick' && stagedDate === chip.value
                  return (
                    <button
                      key={chip.label}
                      onClick={() => chipClick(chip.value)}
                      style={{
                        padding: '12px 18px',
                        borderRadius: 10,
                        border: isStaged ? 'none' : `1px solid rgba(255,255,255,0.20)`,
                        background: isStaged ? STAGED_GRADIENT : 'transparent',
                        ...DS5,
                        color: isStaged ? C.textHi : C.textMid,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {chip.label}
                    </button>
                  )
                })}

                {/* Inline date picker (desktop — no CalendarPicker needed) */}
                {showDatePicker && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8, zIndex: 10 }}>
                    <input
                      type="date"
                      value={pickerDate}
                      onChange={e => {
                        const val = e.target.value
                        setPickerDate(val)
                        if (val) {
                          setStagedDate(val)
                          setShowDatePicker(false)
                        }
                      }}
                      onBlur={() => setShowDatePicker(false)}
                      autoFocus
                      style={{
                        background: C.bgRaise,
                        border: `1px solid ${C.border}`,
                        borderRadius: 10,
                        padding: '10px 14px',
                        ...DS5,
                        color: C.textHi,
                        colorScheme: 'dark',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 5. LIST — read-only value card in READ state (D11.2: "same field set as mobile as currently built").
                Mobile shows a bg-raise card with label over value in READ. Segmented control only in EDIT. */}
            <div>
              <div style={{ ...DT5, color: C.textLow, marginBottom: 8 }}>LIST</div>
              {mode === 'read' ? (
                // READ: plain value card — matches mobile §13.2 read state item 3
                <div style={{
                  background: C.bgRaise,
                  borderRadius: 10,
                  padding: '10px 14px',
                  border: `1px solid ${C.borderPanel}`,
                }}>
                  <span style={{ ...DS5, color: C.textHi, textTransform: 'capitalize' }}>
                    {listType ?? '—'}
                  </span>
                </div>
              ) : (
                // EDIT: segmented control
                <div style={{
                  display: 'flex',
                  background: C.bgRaise,
                  borderRadius: 10,
                  padding: 4,
                  gap: 4,
                  width: 'fit-content',
                }}>
                  {(['life', 'entity'] as const).map(lt => {
                    const isSelected = listType === lt
                    return (
                      <button
                        key={lt}
                        onClick={() => setListType(prev => prev === lt ? committeListType : lt)}
                        style={{
                          padding: '8px 20px',
                          borderRadius: 8,
                          border: 'none',
                          background: isSelected ? C.brand : 'transparent',
                          ...DS5,
                          color: isSelected ? C.textHi : C.textMid,
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                        }}
                      >
                        {lt === 'life' ? 'Life' : 'Entity'}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* D11.2 item 6 — STRUCK. Delete is behind the edit wall.
                Header slot in edit mode carries the DELETE asset. Read state has no path to destruction. */}
          </div>

          {/* ── Vertical rule in gap ──────────────────────────────────────── */}
          <div style={{ width: 1, background: C.borderHair, flexShrink: 0 }} />

          {/* ── RIGHT RAIL (300px) ────────────────────────────────────────── */}
          <div style={{
            width: 300,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}>
            {/* Rail header */}
            <div style={{
              flexShrink: 0,
              padding: '0 16px',
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${C.borderPanel}`,
            }}>
              <span style={{ ...DT5, color: C.textLow }}>NOTES</span>
              <span style={{ ...DT5, color: C.textLow }}>{notes.length}</span>
            </div>

            {/* Log — scrolls independently */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              minHeight: 0,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              {notes.length === 0 ? (
                <span style={{ ...DS6, color: C.textLow }}>No notes yet</span>
              ) : notes.map((note, i) => (
                <div key={note.id}>
                  {i > 0 && <div style={{ height: 1, background: C.borderHair, marginBottom: 12 }} />}
                  <div style={{ ...DT7, color: C.textLow, marginBottom: 4 } as React.CSSProperties}>
                    {formatNoteDate(note.created_at)}
                  </div>
                  <div style={{ ...DS6, color: C.textMid, lineHeight: 1.5 }}>
                    {note.body}
                  </div>
                </div>
              ))}
            </div>

            {/* Composer — pinned at foot, always visible in READ state */}
            <div style={{
              flexShrink: 0,
              padding: 16,
              borderTop: `1px solid ${C.borderPanel}`,
            }}>
              <div style={{ ...DT5, color: C.textLow, marginBottom: 8 }}>ADD A NOTE</div>
              <textarea
                ref={noteRef}
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Type a note…"
                style={{
                  ...DS2,  // 16.5px Space Grotesk 500 — D2.5, no raw fontSize
                  width: '100%',
                  minHeight: 72,
                  resize: 'none',
                  background: C.bgRaise,
                  border: `1px solid ${C.border}`,
                  borderRadius: 9,
                  padding: '12px 14px',
                  color: C.textHi,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── FOOTER (72px) ────────────────────────────────────────────────── */}
        <div style={{
          height: 72,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: 12,
          borderTop: `1px solid ${C.borderPanel}`,
        }}>
          {/* Left: EDIT / CANCEL asset slot — 161.5×60, PNG centred.
              Mount by height (60px → 148.33px art). Width follows aspect 2.4722.
              Asset names itself — no caption. */}
          <div style={{ width: 161.5, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              onClick={mode === 'read' ? enterEdit : cancelEdit}
              style={{
                background: 'transparent', border: 'none', padding: 0,
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mode === 'read' ? '/assets/edit/edit-h180.png' : '/assets/cancel/cancel-h180.png'}
                alt={mode === 'read' ? 'Edit' : 'Cancel'}
                height={60}
                style={{ height: 60, width: 'auto', display: 'block' }}
              />
            </button>
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* CONFIRM slot — always 148.3px wide */}
          <div style={{ width: 148.3, display: 'flex', justifyContent: 'flex-end' }}>
            {committed ? (
              // State: committed (1.5s flash)
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src="/assets/check/check-h280.png"
                alt="Saved"
                height={88}
                style={{ height: 88, width: 'auto' }}
              />
            ) : isActive ? (
              // State: live
              <button
                onClick={handleConfirm}
                disabled={saving}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/confirm/confirm-h180.png"
                  alt="Confirm"
                  height={60}
                  style={{ height: 60, width: 'auto' }}
                />
              </button>
            ) : (
              // State: inert
              <div style={{
                width: 148.3,
                height: 48,
                background: C.bgRaise,
                borderRadius: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ ...DT3, color: C.textLow, fontFamily: FONT_MONO }}>CONFIRM</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Discard guard ────────────────────────────────────────────────── */}
      {showDiscard && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowDiscard(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: C.bgPanel,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: '28px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              alignItems: 'center',
              minWidth: 300,
            }}
          >
            <span style={{ ...DS2, color: C.textHi }}>Discard changes?</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowDiscard(false)}
                style={{
                  height: 44,
                  padding: '0 24px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  background: 'transparent',
                  ...DS5,
                  color: C.textMid,
                  cursor: 'pointer',
                }}
              >
                Keep editing
              </button>
              <button
                onClick={() => { setShowDiscard(false); onClose() }}
                style={{
                  height: 44,
                  padding: '0 24px',
                  border: `1px solid ${C.late}`,
                  borderRadius: 10,
                  background: 'transparent',
                  ...DS5,
                  color: C.late,
                  cursor: 'pointer',
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm dialog ─────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => { setShowDeleteConfirm(false); setTimeout(() => desktopDeleteRef.current?.focus(), 50) }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: C.bgPanel, border: `1px solid ${C.border}`,
              borderRadius: 14, padding: '28px 32px',
              display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', minWidth: 320,
            }}
          >
            <span style={{ ...DS2, color: C.textHi }}>Delete this task?</span>
            <span style={{ ...DS5, color: C.textMid, textAlign: 'center' }}>
              This removes the task and all its notes. It cannot be undone.
            </span>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { setShowDeleteConfirm(false); setTimeout(() => desktopDeleteRef.current?.focus(), 50) }}
                style={{
                  height: 44, padding: '0 24px', border: `1px solid ${C.border}`,
                  borderRadius: 10, background: 'transparent', ...DS5, color: C.textMid, cursor: 'pointer',
                }}
              >
                Keep
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                style={{
                  height: 44, padding: '0 24px', border: 'none',
                  borderRadius: 10, background: C.late, ...DS5, color: '#0A0A0F',
                  cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? '…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

'use client'
/**
 * D11 — Desktop Task Modal
 * 960px two-column centred modal over a scrim.
 * Spec: DESKTOP_TASK_MODAL_SPEC 8.18.26 2115.md
 * Commit: 8.18.26j
 */

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatAddress } from '@/lib/formatAddress'
import { isTaskStaged, TaskStagingState } from '@/lib/taskStagingPredicate'
import {
  DS0, DS2, DS4, DS5, DS6,
  DT5, DT7,
} from '@/components/warroom/desktopTypes'
import MarkCompleteButton from '@/components/warroom/MarkCompleteButton'
import chrome from '@/components/warroom/taskItemChrome.module.css'

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

const FONT_DISP = "'Space Grotesk', system-ui, sans-serif"

// One label: small caps, one tracking. Used for the header kicker and every field label.
const LABEL: React.CSSProperties = {
  ...DT5,
  letterSpacing: '0.14em',
  fontWeight: 600,
  lineHeight: 1,
  color: C.textLow,
}

// Header kicker only. Field labels stay on LABEL.
const KICKER: React.CSSProperties = {
  ...DT5,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.12em',
  lineHeight: 1,
  color: '#B8B8C0',
}

const BORDER = 'rgba(255,255,255,0.14)'
const RADIUS = 16

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
    addr_direction?: string | null
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
  /** Check 40: when true, modal opens in edit mode with no DELETE, no EDIT button */
  isCreate?: boolean
  /**
   * Check 59: unified create shell — fill type determines which form is shown.
   * 'task' (default) = existing task create flow.
   * 'event' = schedule_events insert.
   * 'deadline' = contract_deadlines insert.
   * 'money_mover' = falls back to old inline form (table not yet created).
   */
  fill?: 'task' | 'event' | 'deadline' | 'money_mover'
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

function ChevronIcon() {
  return (
    <svg className={chrome.chevron} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6.2 L8 10.2 L12 6.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function NotesEmptyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3.5h7.2L19 8.2V19.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z"/>
      <path d="M14 3.5V8.2H19"/>
      <path d="M9 13h6M9 16.5h4"/>
    </svg>
  )
}

// ── TaskModal ─────────────────────────────────────────────────────────────────
export default function TaskModal({ task, onClose, onCompleted, onSaved, isCreate = false, fill = 'task' }: TaskModalProps) {
  // ── State machine ──────────────────────────────────────────────────────────
  // Check 40: create mode always starts in edit state
  const [mode, setMode] = useState<'read' | 'edit'>(isCreate ? 'edit' : 'read')
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

  // ── Check 59: fill-specific state ─────────────────────────────────────────
  // event fill
  const [evTitle, setEvTitle]       = useState('')
  const [evDate, setEvDate]         = useState(todayLocal())
  const [evTime, setEvTime]         = useState('')
  const [evLocation, setEvLocation] = useState('')
  // deadline fill
  const [dlLabel, setDlLabel]       = useState('')
  const [dlDate, setDlDate]         = useState(todayLocal())
  const [dlType, setDlType]         = useState('deadline')
  // money_mover fill
  const [mmTitle, setMmTitle]       = useState('')
  const [mmValue, setMmValue]       = useState('')

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
  // Check 39/40: in create mode, CONFIRM is active when title is non-empty
  // Check 59: for non-task fills, staged when label/title is non-empty
  const isActive = fill === 'event'       ? evTitle.trim().length > 0
                 : fill === 'deadline'    ? dlLabel.trim().length > 0
                 : fill === 'money_mover' ? mmTitle.trim().length > 0
                 : isCreate ? localTitle.trim().length > 0
                 : isTaskStaged(stagingState)
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

    // Check 59: fill-specific confirm paths
    if (fill === 'event') {
      setSaving(true)
      setError(null)
      const { error: evErr } = await supabase
        .from('schedule_events')
        .insert({
          title: evTitle.trim(),
          date: evDate,
          time: evTime || null,
          location: evLocation.trim() || null,
        })
      setSaving(false)
      if (evErr) { setError(evErr.message || 'Could not save event.'); return }
      setCommitted(true)
      setTimeout(() => { setCommitted(false); onSaved() }, 1500)
      return
    }

    if (fill === 'deadline') {
      setSaving(true)
      setError(null)
      const { error: dlErr } = await supabase
        .from('contract_deadlines')
        .insert({
          label: dlLabel.trim(),
          deadline_date: dlDate,
          deadline_type: dlType.trim().toLowerCase() || 'deadline',
          status: 'pending',
          deal_id: null,
        })
      setSaving(false)
      if (dlErr) { setError(dlErr.message || 'Could not save deadline.'); return }
      setCommitted(true)
      setTimeout(() => { setCommitted(false); onSaved() }, 1500)
      return
    }

    if (fill === 'money_mover') {
      setSaving(true)
      setError(null)
      const insertPayload: Record<string, unknown> = { title: mmTitle.trim() }
      const parsedVal = parseFloat(mmValue.replace(/[^0-9.]/g, ''))
      if (!isNaN(parsedVal) && parsedVal > 0) insertPayload.commission = parsedVal
      const { error: mmErr } = await supabase.from('money_movers').insert(insertPayload)
      setSaving(false)
      if (mmErr) { setError(mmErr.message || 'Could not save money mover.'); return }
      setCommitted(true)
      setTimeout(() => { setCommitted(false); onSaved() }, 1500)
      return
    }

    // Check 39: create mode — INSERT first, then close (do NOT call commit_task_sheet)
    if (isCreate) {
      setSaving(true)
      setError(null)
      const { error: insertErr } = await supabase
        .from('tasks')
        .insert({
          title: localTitle,
          status: 'open',
          due_date: stagedDate ?? null,
          is_life: listType === 'life',
          is_entity: listType === 'entity',
        })
      setSaving(false)
      if (insertErr) {
        setError(insertErr.message || 'Could not create task. Try again.')
        return
      }
      setCommitted(true)
      setTimeout(() => {
        setCommitted(false)
        onSaved()
      }, 1500)
      return
    }

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
    // 49a ruling: CONFIRM owns date. Checkmark does NOT commit a staged date.
    // Only title, note, and listType are committed by the checkmark.
    setSaving(true)
    setError(null)
    const noteBody = noteText.trim() || null
    const newTitle = titleEdited ? localTitle : null
    const newListType = listType !== committeListType ? listType : null
    const { error: rpcErr } = await supabase.rpc('commit_task_sheet', {
      p_task_id:   task.id,
      p_due_date:  null,        // date intentionally excluded — CONFIRM is the only path
      p_list_type: newListType,
      p_note_body: noteBody,
      p_title:     newTitle,
    })
    if (rpcErr) {
      setSaving(false)
      setError(rpcErr.message || 'Could not complete — try again')
      return false
    }
    const { error: updateErr } = await supabase
      .from('tasks')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', task.id)
    if (updateErr) {
      setSaving(false)
      setError('Staged changes saved — could not mark complete.')
      return false
    }
    onCompleted(task)
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  // Hard delete — same model as mobile. task_note cascades.
  async function handleDelete() {
    setSaving(true)
    const { error: err } = await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', task.id)
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
    const formatted = formatAddress(d)
    if (formatted && formatted !== '—') return formatted
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
          border: `1px solid ${BORDER}`,
          borderRadius: RADIUS,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: FONT_DISP,
          color: C.textHi,
        }}
      >
        {/* ── HEADER (56px) ──────────────────────────────────────────────── */}
        {/* Kicker left. Check and ESC share the center line of this bar. */}
        <div style={{
          height: 56,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: 16,
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <span style={KICKER}>
              {fill === 'event' ? 'ADD EVENT'
               : fill === 'deadline' ? 'ADD DEADLINE'
               : fill === 'money_mover' ? 'ADD MONEY MOVER'
               : isCreate ? 'NEW TASK'
               : mode === 'edit' ? 'BATTLE PLAN · EDIT'
               : <>BATTLE PLAN · <span style={{ color: overdue ? C.late : '#B8B8C0' }}>{overdue ? 'OVERDUE' : 'OPEN'}</span></>}
            </span>
          </div>

          {/* Centre zone — DELETE asset, edit state only, and NOT in create mode (Check 41) or fill mode. */}
          {mode === 'edit' && !isCreate && fill === 'task' ? (
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

          {/* Right zone — check and ESC are the same 44px row, so the ring and the close sit on one line. */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          {/* READ mode (non-create, non-fill) → checkmark. EDIT/create/fill → empty. */}
          {/* Check 40/41: no DONE in create mode (task not saved yet) */}
          {mode === 'read' && !isCreate && fill === 'task' && (
            <MarkCompleteButton
              onClick={handleDone}
              disabled={saving}
              hitSize={44}
            />
          )}

          {/* × ESC — always last in right zone, never moves. */}
          <button
            onClick={attemptClose}
            aria-label="Close"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 44,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0 8px',
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 3 L11 11 M11 3 L3 11" stroke={C.textLow} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span style={LABEL}>ESC</span>
          </button>
          </div>{/* end right zone */}
        </div>{/* end header */}

        {/* ── CONTENT ──────────────────────────────────────────────────────── */}
        <div style={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          minHeight: 0,
        }}>
          {/* ── LEFT COLUMN — its content sets the body height ───────────── */}
          <div style={{
            flex: 1,
            minWidth: 0,
            marginRight: 300,
            padding: '16px 24px 16px',
            overflowY: 'auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
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

            {/* ── Check 59: fill-specific bodies ──────────────────────────── */}
            {fill === 'event' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span style={{ ...LABEL, color: C.brandLift }}>NEW EVENT</span>
                <div>
                  <div style={{ ...LABEL, marginBottom: 8 }}>TITLE</div>
                  <input
                    autoFocus
                    value={evTitle}
                    onChange={e => setEvTitle(e.target.value)}
                    placeholder="Event title"
                    className={chrome.field}
                    style={DS4}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...LABEL, marginBottom: 8 }}>DATE</div>
                    <input
                      type="date"
                      value={evDate}
                      onChange={e => setEvDate(e.target.value)}
                      className={chrome.field}
                      style={{ ...DS4, colorScheme: 'dark' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...LABEL, marginBottom: 8 }}>TIME</div>
                    <input
                      type="time"
                      value={evTime}
                      onChange={e => setEvTime(e.target.value)}
                      className={chrome.field}
                      style={{ ...DS4, colorScheme: 'dark' }}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ ...LABEL, marginBottom: 8 }}>LOCATION (OPTIONAL)</div>
                  <input
                    value={evLocation}
                    onChange={e => setEvLocation(e.target.value)}
                    placeholder="Location"
                    className={chrome.field}
                    style={DS4}
                  />
                </div>
              </div>
            )}

            {fill === 'deadline' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span style={{ ...LABEL, color: C.brandLift }}>NEW DEADLINE</span>
                <div>
                  <div style={{ ...LABEL, marginBottom: 8 }}>LABEL</div>
                  <input
                    autoFocus
                    value={dlLabel}
                    onChange={e => setDlLabel(e.target.value)}
                    placeholder="Deadline label"
                    className={chrome.field}
                    style={DS4}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...LABEL, marginBottom: 8 }}>DATE</div>
                    <input
                      type="date"
                      value={dlDate}
                      onChange={e => setDlDate(e.target.value)}
                      className={chrome.field}
                      style={{ ...DS4, colorScheme: 'dark' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...LABEL, marginBottom: 8 }}>TYPE</div>
                    <input
                      value={dlType}
                      onChange={e => setDlType(e.target.value)}
                      placeholder="e.g. inspection"
                      className={chrome.field}
                    style={DS4}
                    />
                  </div>
                </div>
              </div>
            )}

            {fill === 'money_mover' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span style={{ ...LABEL, color: C.brandLift }}>NEW MONEY MOVER</span>
                <div>
                  <div style={{ ...LABEL, marginBottom: 8 }}>TITLE</div>
                  <input
                    autoFocus
                    value={mmTitle}
                    onChange={e => setMmTitle(e.target.value)}
                    placeholder="Money mover title"
                    className={chrome.field}
                    style={DS4}
                  />
                </div>
                <div>
                  <div style={{ ...LABEL, marginBottom: 8 }}>VALUE (OPTIONAL)</div>
                  <input
                    value={mmValue}
                    onChange={e => setMmValue(e.target.value)}
                    placeholder="e.g. 850000"
                    className={chrome.field}
                    style={DS4}
                  />
                </div>
              </div>
            )}

            {/* Normal task body — shown for fill='task' (or default) */}
            {fill === 'task' && <>
            {/* Title — status kicker lives in the header */}
            {mode === 'read' ? (
              <div
                data-modal-title="true"
                onClick={enterEdit}
                style={{
                  ...DS0,
                  color: C.textHi,
                  cursor: 'pointer',
                  borderBottom: `1px solid ${BORDER}`,
                  paddingBottom: 8,
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
                  borderBottom: `1px solid ${BORDER}`,
                  borderRadius: 0,
                  padding: '0 0 8px',
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
                href={`/warroom/deal/?id=${task.deal_id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: C.bgRaise,
                  borderRadius: 8,
                  padding: '8px 16px',
                  textDecoration: 'none',
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div>
                  <div style={{ ...LABEL, marginBottom: 8 }}>DEAL</div>
                  <div style={{ ...DS5, color: C.textHi }}>{dealAddr() || task.deals.name}</div>
                </div>
                <div style={{ color: C.brandLift, flexShrink: 0 }}>
                  <ExternalIcon />
                </div>
              </a>
            )}

            {/* 4. DUE section — date sits beside the label. Red only while the committed date is overdue. */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={LABEL}>DUE</span>
                {stagedDate && task.due_date && stagedDate !== task.due_date ? (
                  <>
                    <span style={{ ...DS5, color: C.textLow, textDecoration: 'line-through' }}>
                      {formatDue(task.due_date)}
                    </span>
                    <span style={{ ...DS5, color: C.brandLift }}>
                      {formatDue(stagedDate)}
                    </span>
                  </>
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
              </div>

              {/* Chips */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', position: 'relative' }}>
                {chips.map(chip => {
                  const preset = chip.value !== 'pick'
                  const pickSelected = !preset && (showDatePicker || (!!stagedDate && stagedDate !== today && stagedDate !== tomorrow && stagedDate !== nextMon))
                  const isStaged = (preset && stagedDate === chip.value) || pickSelected
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => chipClick(chip.value)}
                      className={isStaged ? `${chrome.chip} ${chrome.chipOn}` : chrome.chip}
                      style={DS5}
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
                      className={chrome.field}
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
                        ...DS5,
                        width: 'auto',
                        colorScheme: 'dark',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 5. LIST — value row in READ. Segmented control only in EDIT.
                Empty reads as a closed select: muted placeholder plus a chevron. */}
            <div>
              <div style={{ ...LABEL, marginBottom: 8 }}>LIST</div>
              {mode === 'read' ? (
                <div className={chrome.fieldStatic}>
                  <span style={{ ...DS5, color: listType ? C.textHi : C.textLow, textTransform: listType ? 'capitalize' : 'none' }}>
                    {listType === 'life' ? 'Life' : listType === 'entity' ? 'Entity' : 'No list'}
                  </span>
                  <ChevronIcon />
                </div>
              ) : (
                // EDIT: segmented control
                <div style={{
                  display: 'flex',
                  background: C.bgRaise,
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  padding: 4,
                  gap: 4,
                  width: 'fit-content',
                }}>
                  {(['life', 'entity'] as const).map(lt => {
                    const isSelected = listType === lt
                    return (
                      <button
                        key={lt}
                        type="button"
                        onClick={() => setListType(prev => prev === lt ? committeListType : lt)}
                        style={{
                          height: 36,
                          padding: '0 16px',
                          borderRadius: 8,
                          border: 'none',
                          background: isSelected ? 'rgba(124,58,237,0.22)' : 'transparent',
                          boxShadow: isSelected ? 'inset 0 0 0 1px #8B5CF6' : 'none',
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
            </>}
          </div>

          {/* ── RIGHT RAIL — pinned to the left column, so the note field
              shares the LIST field's bottom edge. Out of flow so its
              empty state cannot stretch the modal. ─────────────────────── */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 300,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            borderLeft: `1px solid ${BORDER}`,
          }}>
            {/* Rail header */}
            <div style={{
              flexShrink: 0,
              padding: '16px 16px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${BORDER}`,
            }}>
              <span style={LABEL}>NOTES</span>
              <span style={LABEL}>{notes.length}</span>
            </div>

            {/* Log — scrolls independently. Empty state is centered in the column. */}
            <div style={{
              flex: 1,
              overflowY: notes.length === 0 ? 'hidden' : 'auto',
              minHeight: 0,
              padding: notes.length === 0 ? 0 : 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}>
              {notes.length === 0 ? (
                <div className={chrome.notesEmpty}>
                  <NotesEmptyIcon />
                  <span style={{ ...DS6, color: C.textLow }}>No notes yet</span>
                </div>
              ) : notes.map((note, i) => (
                <div key={note.id}>
                  {i > 0 && <div style={{ height: 1, background: BORDER, marginBottom: 16 }} />}
                  <div style={{ ...DT7, color: C.textLow, marginBottom: 8 } as React.CSSProperties}>
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
              borderTop: `1px solid ${BORDER}`,
            }}>
              <div style={{ ...LABEL, marginBottom: 8 }}>ADD A NOTE</div>
              <textarea
                ref={noteRef}
                className={chrome.textarea}
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Type a note…"
                style={DS2}
              />
            </div>
          </div>
        </div>

        {/* ── FOOTER ───────────────────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box',
          height: 64,
          padding: '0 24px',
          gap: 16,
          borderTop: `1px solid ${BORDER}`,
        }}>
          {/* Left: EDIT / CANCEL. Hidden in create mode and fill modes. */}
          {!isCreate && fill === 'task' && (
            <button
              type="button"
              className={chrome.editHit}
              onClick={mode === 'read' ? enterEdit : cancelEdit}
              aria-label={mode === 'read' ? 'Edit' : 'Cancel'}
            >
              <span>{mode === 'read' ? 'EDIT' : 'CANCEL'}</span>
            </button>
          )}

          <div style={{ flex: 1 }} />

          {/* CONFIRM — inert outline until something is staged, violet fill once it is. */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            {committed ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src="/assets/check/check-h280.png"
                alt="Saved"
                height={40}
                style={{ height: 40, width: 'auto', display: 'block' }}
              />
            ) : (
              <button
                type="button"
                className={chrome.confirmHit}
                onClick={handleConfirm}
                disabled={!isActive || saving}
                aria-disabled={!isActive || saving}
              >
                <span className={isActive ? chrome.confirmOn : chrome.confirmOff} style={{ opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'SAVING…' : 'CONFIRM'}
                </span>
              </button>
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

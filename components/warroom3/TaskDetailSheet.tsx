'use client'
// §13.2 Task sheet — read/edit states on BottomSheet shell.
// §18.9: two exits only — swipe-down anywhere (inherited from BottomSheet) + FAB ×.
// §18.4: guard splits — staged chip discards silently; typed text keeps confirm-before-discard.
// FOOTER: flex:none rendered inside BottomSheet as a bottom panel — no position:fixed.
//   Fix for iOS mispositioning of position:fixed when keyboard resizes the visual viewport.
//   BottomSheet is a flex column: header flex:none · body flex:1 overflow-y:auto · footer flex:none.

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatAddress } from '@/lib/formatAddress'
import BottomSheet from '@/components/warroom3/BottomSheet'
import CalendarPicker from '@/components/warroom3/CalendarPicker'
import { isTaskStaged } from '@/lib/taskStagingPredicate'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

// §2 tokens — post-44a values
const T = {
  bgPanel:      '#12111B',
  bgRaise:      '#1E1D26',
  textHi:       '#EFEEF4',
  textMid:      '#B8B6C6',
  textLow:      '#8E8CA0',
  textInvert:   '#0A0A0F',
  brand:        '#8B5CF6',
  brandLift:    '#A78BFA',
  brandStrong:  '#7C3AED',
  moneyIn:      '#34D399',
  late:         '#FF4D4D',
  hot:          '#FFA23A',
  borderDefault: 'rgba(255,255,255,0.14)',
  borderStrong:  'rgba(255,255,255,0.20)',
}

// Staged chip gradient (FAB aperture fill)
const STAGED_GRADIENT = 'radial-gradient(circle at 50% 47%, #5B3FA8 0%, #2A1D52 26%, #120E22 62%, #07060C 100%)'

// §18.10 check 11 — footer bottom is derived, never a literal.
// With flex layout inside BottomSheet, the footer sits at the true bottom of the sheet
// and automatically clears the FAB (sheet top:34 + flex fill + footer height ≥ tab bar + FAB lift).
// The position:fixed approach was wrong — iOS mispositioning when keyboard resizes visual viewport.

// Type scale — §3.2 post-44a
const styleT2: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  lineHeight: 1,
}
const styleT3: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 14.5,
  fontWeight: 400,
  color: T.textHi,
}
const styleT4: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 11.5,
  fontWeight: 400,
  color: T.textLow,
}
const styleD3: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 23,
  fontWeight: 500,
  letterSpacing: '-0.02em',
  color: T.textHi,
  lineHeight: 1.3,
}

// ── Interfaces ──────────────────────────────────────────────────────────────
export interface Task {
  id: string
  title: string
  status: string
  due_date: string | null
  deal_id: string | null
  is_life: boolean
  is_entity: boolean
  entity_id: string | null
  sort_order: number | null
  created_at: string
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

export interface TaskDetailSheetProps {
  open: boolean
  task: Task | null
  onClose: () => void
  onCompleted: (task: Task) => void
  onSaved: () => void
  onDeleted: () => void
  onMorphRequest?: (task: Task) => void
}

interface TaskNote {
  id: string
  task_id: string
  body: string
  created_at: string
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function todayCST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function addDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function getNextMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = ((1 - day) + 7) % 7 || 7
  d.setDate(d.getDate() + diff)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function formatDueDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return dateStr < todayCST()
}

function daysOverdue(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.floor((now.getTime() - target.getTime()) / 86400000)
}

function formatNoteDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
}

// ── Component ────────────────────────────────────────────────────────────────
export default function TaskDetailSheet({
  open,
  task,
  onClose,
  onCompleted,
  onSaved,
  onDeleted,
  onMorphRequest,
}: TaskDetailSheetProps) {
  // State
  const [mode, setMode] = useState<'read' | 'edit'>('read')
  const [stagedDate, setStagedDate] = useState<string | null>(null)
  const [stagedChip, setStagedChip] = useState<'today' | 'tomorrow' | 'nextmon' | 'pick' | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [localTitle, setLocalTitle] = useState('')
  const [listType, setListType] = useState<'life' | 'entity'>('life')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<TaskNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [showDiscardGuard, setShowDiscardGuard] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const titleRef = useRef<HTMLTextAreaElement>(null)
  const deleteRef = useRef<HTMLButtonElement>(null)
  const origTitle = useRef('')

  // Reset when sheet opens on a new task
  useEffect(() => {
    if (open && task) {
      setMode('read')
      setStagedDate(null)
      setStagedChip(null)
      setShowCalendar(false)
      setNoteText('')
      setLocalTitle(task.title)
      origTitle.current = task.title
      setListType(task.is_life ? 'life' : 'entity')
      setSaving(false)
      setError(null)
      setShowDiscardGuard(false)
      setShowDeleteConfirm(false)
      // Load notes
      setNotesLoading(true)
      supabase
        .from('task_note')
        .select('id, task_id, body, created_at')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setNotes((data as TaskNote[]) ?? [])
          setNotesLoading(false)
        })
    }
  }, [open, task?.id])

  // Auto-focus + auto-size title field on edit mode
  useEffect(() => {
    if (mode === 'edit' && titleRef.current) {
      titleRef.current.focus()
      autoSizeTitle()
    }
  }, [mode])

  // Auto-size title textarea — eliminates the ~90px dead band.
  // rows={3} at 23px/1.3 lineHeight ≈ 90px for a one-liner. Set height to scrollHeight
  // on every render so the field is exactly as tall as its content.
  function autoSizeTitle() {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  // visualViewport listener removed — footer is now flex:none inside BottomSheet,
  // so it naturally tracks the visual bottom of the sheet without needing keyboard offset.

  if (!open || !task) return null

  const today = todayCST()
  const currentDue = task.due_date
  const displayedDue = stagedDate ?? currentDue
  const overdue = isOverdue(currentDue)
  const titleEdited = localTitle !== origTitle.current

  // §18.4 guard
  function handleDismiss() {
    const hasTyped = mode === 'edit' && (titleEdited || noteText.trim().length > 0)
    if (hasTyped) {
      setShowDiscardGuard(true)
    } else {
      resetAndClose()
    }
  }

  function resetAndClose() {
    setMode('read')
    setStagedDate(null)
    setStagedChip(null)
    setNoteText('')
    setLocalTitle(task?.title ?? '')
    setError(null)
    setShowDiscardGuard(false)
    onClose()
  }

  // Complete task — checkmark tap
  async function handleComplete() {
    if (!task) return
    setSaving(true)
    setError(null)

    // §18.10 item 11 ruling: checkmark carries staged changes.
    // If a date is staged or a note is typed, commit them along with completion.
    const dueDateVal = stagedDate ?? task.due_date
    const noteBody = noteText.trim() || null
    const newListType = task.is_life ? 'life' : task.is_entity ? 'entity' : null
    const newTitle = mode === 'edit' && titleEdited ? localTitle : null

    // 1. Commit staged fields + note via RPC (COALESCE-safe, RAISE on zero-row)
    const { error: rpcErr } = await (supabase as any).rpc('commit_task_sheet', {
      p_task_id:   task.id,
      p_due_date:  dueDateVal,
      p_list_type: newListType,
      p_note_body: noteBody,
      p_title:     newTitle,
    })
    if (rpcErr) {
      setSaving(false)
      setError('Could not complete — try again')
      return
    }
    // 2. Mark complete (separate write — RPC owns the task fields above)
    const { error: completeErr } = await supabase
      .from('tasks')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', task.id)
    if (completeErr) {
      setSaving(false)
      setError('Staged changes saved — could not mark complete. Try again.')
      return
    }
    setSaving(false)
    onCompleted(task)
    resetAndClose()
  }

  // CONFIRM tap — atomic write
  async function handleConfirm() {
    if (!task) return
    // Guard: only proceed if the shared predicate says something is staged
    if (!isActive) return

    setSaving(true)
    setError(null)

    try {
      // Compute due_at NOW from stagedDate (not at chip tap)
      const dueDateVal = stagedDate ?? task.due_date
      const noteBody = noteText.trim() || null
      const newListType = mode === 'edit' ? listType : (task.is_life ? 'life' : task.is_entity ? 'entity' : null)
      const newTitle = mode === 'edit' && titleEdited ? localTitle : null

      // RPC is deployed. null p_due_date / p_list_type / p_title → COALESCE keeps existing values.
      // RPC RAISEs on zero-row update — caught below and routed to §18.7 banner.
      const { error: rpcErr } = await (supabase as any).rpc('commit_task_sheet', {
        p_task_id:   task.id,
        p_due_date:  dueDateVal,    // null if no chip staged → COALESCE keeps committed date
        p_list_type: newListType,   // null if unchanged → COALESCE keeps existing flags
        p_note_body: noteBody,      // null or whitespace-only → RPC skips insert
        p_title:     newTitle,      // null if not edited → COALESCE keeps existing title
      })
      if (rpcErr) throw rpcErr

      setSaving(false)
      onSaved()
      resetAndClose()
    } catch (e: any) {
      setSaving(false)
      setError(e?.message || 'Save failed — nothing was lost')
    }
  }

  async function handleDelete() {
    if (!task) return
    setSaving(true)
    const { error: err } = await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', task.id)
    setSaving(false)
    if (err) {
      setError('Could not delete — try again')
      setShowDeleteConfirm(false)
      return
    }
    setShowDeleteConfirm(false)
    onDeleted()
    resetAndClose()
  }

  function handleChipTap(chip: 'today' | 'tomorrow' | 'nextmon' | 'pick') {
    if (chip === 'pick') {
      setStagedChip('pick')
      setShowCalendar(true)
      return
    }
    setStagedChip(chip)
    if (chip === 'today') setStagedDate(today)
    else if (chip === 'tomorrow') setStagedDate(addDays(1))
    else if (chip === 'nextmon') setStagedDate(getNextMonday())
  }

  // Eyebrow meta
  let eyebrowText = 'LATER'
  let eyebrowColor = T.textMid
  if (currentDue) {
    if (overdue) {
      const n = daysOverdue(currentDue)
      eyebrowText = `● ${n === 0 ? '0' : n} DAY${n === 1 ? '' : 'S'} LATE`
      eyebrowColor = T.late
    } else if (currentDue === today) {
      eyebrowText = 'TODAY'
      eyebrowColor = T.hot
    }
  }

  // D11.5 — shared staging predicate (lib/taskStagingPredicate.ts)
  const committedListType: 'life' | 'entity' | null = task
    ? (task.is_life ? 'life' : task.is_entity ? 'entity' : null)
    : null
  const isActive = task ? isTaskStaged({
    stagedDate,
    committedDate:    task.due_date,
    noteText,
    titleEdited,
    listType:         mode === 'edit' ? listType : committedListType,
    committedListType,
  }) : false

  // Chip style
  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '11px 15px',
    borderRadius: 9,
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    border: active ? 'none' : `1px solid ${T.borderStrong}`,
    background: active ? STAGED_GRADIENT : 'transparent',
    color: active ? T.textHi : T.textMid,
    WebkitTapHighlightColor: 'transparent',
  })

  // ── Header action — terminal action for the current mode.
  // READ  → DONE caption + checkmark (completion)
  // EDIT  → DELETE asset slot (104×44, right-aligned at 18px gutter)
  // One slot, one action, never both.
  const headerAction = mode === 'read' ? (
    // §13.2 / item 11 ruling: DONE caption + checkmark. Same pattern as CONFIRM plate.
    <button
      onClick={handleComplete}
      disabled={saving}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        border: 'none', background: 'transparent',
        cursor: saving ? 'default' : 'pointer',
        flexShrink: 0, padding: 0,
      }}
    >
      <span style={{
        fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase' as const, color: T.moneyIn,
      }}>DONE</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/check/check-h140.png" alt="Complete" width={44} height={44} style={{ display: 'block' }} />
    </button>
  ) : (
    // DELETE — 104×44 slot, right-aligned at the 18px gutter.
    // Asset names itself in its pixels — no caption.
    // Triggers the existing confirmation dialog (unchanged).
    <div style={{ width: 104, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
      <button
        ref={deleteRef}
        onClick={() => setShowDeleteConfirm(true)}
        style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center',
          WebkitTapHighlightColor: 'transparent' as const,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/delete/delete-h76.png"
          alt="Delete"
          height={21}
          style={{ height: 21, width: 'auto', display: 'block' }}
        />
      </button>
    </div>
  )

  // List name in read mode
  const listName = task.is_life
    ? 'Life'
    : task.entity_id && task.entities?.name
    ? task.entities.name
    : task.is_entity
    ? 'Entity'
    : '—'

  const dealAddr = task.deals ? formatAddress(task.deals as any) : null

  // Footer — rendered flex:none inside BottomSheet (no position:fixed).
  // Sheet is a flex column: header / scroll body / footer.
  // This eliminates the iOS visual-viewport mispositioning bug.
  const footerEl = (
    <div style={{
      padding: '12px 18px',
      paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
      display: 'flex',
      gap: 11,
      borderTop: `1px solid ${T.borderDefault}`,
      background: T.bgPanel,
    }}>
      {/* Secondary slot — EDIT / CANCEL asset slot.
          Fixed box 140×52. PNG centred inside. Asset names itself — no text label.
          Mount by height (52px → 128.55px art). Width follows aspect 2.4722. */}
      <div style={{ width: 140, height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          onClick={() => {
            if (mode === 'read') {
              setMode('edit')
            } else {
              const hasTyped = titleEdited || noteText.trim().length > 0
              if (hasTyped) {
                setShowDiscardGuard(true)
              } else {
                setStagedDate(null)
                setStagedChip(null)
                setNoteText('')
                setLocalTitle(task?.title ?? '')
                setMode('read')
              }
            }
          }}
          style={{
            background: 'transparent', border: 'none', padding: 0,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            WebkitTapHighlightColor: 'transparent' as const,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mode === 'read' ? '/assets/edit/edit-h180.png' : '/assets/cancel/cancel-h180.png'}
            alt={mode === 'read' ? 'Edit' : 'Cancel'}
            height={52}
            style={{ height: 52, width: 'auto', display: 'block' }}
          />
        </button>
      </div>

      {/* Primary slot — inert pill or CONFIRM plate */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        {isActive ? (
          <button
            onClick={handleConfirm}
            disabled={saving}
            style={{
              height: 52, padding: 0, border: 'none', background: 'transparent',
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.6 : 1,
              display: 'flex', alignItems: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/confirm/confirm-h180.png"
              alt="Confirm"
              height={52}
              style={{ height: 52, width: 'auto', display: 'block' }}
            />
          </button>
        ) : (
          <div style={{
            width: 128.55,
            height: 52,
            borderRadius: 12,
            background: T.bgRaise,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: FONT_MONO,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              color: T.textLow,
            }}>CONFIRM</span>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      <BottomSheet
        open={open}
        onClose={handleDismiss}
        label={mode === 'edit' ? 'EDIT TASK' : 'TASK'}
        noHandle
        size="full"
        headerAction={headerAction}
        scrollPaddingBottom={24}
        footer={footerEl}
      >
        {/* §18.7 Error banner */}
        {error && (
          <div style={{
            margin: '0 18px 14px',
            padding: '12px 14px',
            background: 'rgba(255,77,77,0.09)',
            border: '1px solid rgba(255,77,77,0.4)',
            borderLeft: `3px solid ${T.late}`,
            borderRadius: 10,
          }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 600, color: T.late, marginBottom: 4 }}>
              {error}
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: T.textMid }}>Nothing was lost.</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button
                onClick={() => { setError(null); handleConfirm() }}
                style={{ flex: 1, height: 36, borderRadius: 8, background: T.late, color: T.textInvert, fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >Try again</button>
              <button
                onClick={() => setError(null)}
                style={{ height: 36, padding: '0 16px', borderRadius: 8, border: `1px solid ${T.borderStrong}`, color: T.textMid, fontFamily: FONT_DISPLAY, fontSize: 13, background: 'transparent', cursor: 'pointer' }}
              >Keep draft</button>
            </div>
          </div>
        )}

        <div style={{ padding: '0 18px' }}>

          {/* READ MODE */}
          {mode === 'read' && (
            <>
              {/* 1. Title — D3, not a field */}
              <div style={{
                ...styleD3,
                marginBottom: 10,
                textWrap: 'pretty',
              } as React.CSSProperties}>
                {task.title}
              </div>

              {/* 2. Meta line */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ ...styleT2, color: eyebrowColor }}>{eyebrowText}</span>
                <span style={{ ...styleT2, color: T.textLow }}>BATTLE PLAN</span>
              </div>

              {/* 3. LIST card */}
              <div style={{
                background: T.bgRaise, borderRadius: 10, padding: 14, marginBottom: 12,
              }}>
                <div style={{ ...styleT2, color: T.textLow, marginBottom: 6 }}>LIST</div>
                <div style={styleT3}>{listName}</div>
              </div>

              {/* 4. DEAL card */}
              {task.deal_id && (
                <div style={{
                  background: T.bgRaise, borderRadius: 10, padding: 14, marginBottom: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ ...styleT2, color: T.textLow, marginBottom: 6 }}>DEAL</div>
                    <div style={styleT3}>{dealAddr || task.deals?.name || '—'}</div>
                  </div>
                  <button style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(139,92,246,0.13)',
                    border: '1px solid rgba(139,92,246,0.28)',
                    color: T.brandLift,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 15, flexShrink: 0,
                  }}>↗</button>
                </div>
              )}

              {/* 5. DUE section */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ ...styleT2, color: T.textLow }}>DUE</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {stagedDate && currentDue && stagedDate !== currentDue && (
                      <span style={{ ...styleT2, color: T.textLow, textDecoration: 'line-through' }}>
                        {formatDueDisplay(currentDue)}
                      </span>
                    )}
                    <span style={{ ...styleT2, color: stagedDate ? T.brandLift : (overdue ? T.late : T.textMid) }}>
                      {displayedDue ? formatDueDisplay(displayedDue) : '—'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(['today', 'tomorrow', 'nextmon', 'pick'] as const).map(chip => (
                    <button
                      key={chip}
                      onClick={() => handleChipTap(chip)}
                      style={chipStyle(stagedChip === chip)}
                    >
                      {chip === 'today' ? 'Today' : chip === 'tomorrow' ? 'Tomorrow' : chip === 'nextmon' ? 'Next Mon' : 'Pick date'}
                    </button>
                  ))}
                </div>
                {showCalendar && (
                  <div style={{ marginTop: 12 }}>
                    <CalendarPicker
                      value={displayedDue ? new Date(displayedDue + 'T00:00:00') : null}
                      onDone={(d: Date) => {
                        const dateStr = d.toLocaleDateString('en-CA')
                        setStagedDate(dateStr)
                        setStagedChip('pick')
                        setShowCalendar(false)
                      }}
                      onCancel={() => {
                        setShowCalendar(false)
                        setStagedChip(null)
                      }}
                    />
                  </div>
                )}
              </div>

              {/* 6. NOTES section */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ ...styleT2, color: T.textLow }}>NOTES</span>
                  <span style={{ ...styleT2, color: T.textLow }}>{notes.length}</span>
                </div>
                {notesLoading ? (
                  <div style={{ height: 40, background: T.bgRaise, borderRadius: 8, opacity: 0.5 }} />
                ) : notes.length === 0 ? (
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>No notes yet</div>
                ) : (
                  <div>
                    {notes.map((note, i) => (
                      <div key={note.id}>
                        {i > 0 && <div style={{ height: 1, background: T.borderDefault, margin: '10px 0' }} />}
                        <div style={{ ...styleT2, color: T.textLow, marginBottom: 4 }}>{formatNoteDate(note.created_at)}</div>
                        <div style={{ ...styleT4 }}>{note.body}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 6b. ADD A NOTE composer — in read state (ruling 8.18.26: composer moves here so checkmark + CONFIRM can carry note) */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ ...styleT2, color: T.textLow, marginBottom: 10 }}>ADD A NOTE</div>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Write what this is about…"
                  style={{
                    background: T.bgRaise, borderRadius: 10, padding: '12px 14px',
                    minHeight: 72, border: `1px solid ${T.borderDefault}`,
                    color: T.textHi, fontSize: 16, fontFamily: FONT_DISPLAY,  // 16px floor — iOS auto-zoom on focus
                    resize: 'none', outline: 'none', width: '100%',
                    boxSizing: 'border-box' as const,
                  }}
                  rows={3}
                />
              </div>

              {/* §13.2 item 8 delete row — REMOVED. Delete is behind the edit wall.
                  Header slot in edit mode carries the DELETE asset. Read state has no path to destruction. */}
            </>
          )}

          {/* EDIT MODE */}
          {mode === 'edit' && (
            <>
              {/* Title field — auto-focused, auto-sized to eliminate ~90px dead band */}
              <textarea
                ref={titleRef}
                value={localTitle}
                onChange={e => { setLocalTitle(e.target.value); autoSizeTitle() }}
                rows={1}
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 23,
                  fontWeight: 500,
                  color: T.textHi,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  width: '100%',
                  padding: 0,
                  borderBottom: '1px solid rgba(255,255,255,0.18)',
                  paddingBottom: 10,
                  marginBottom: 18,
                  lineHeight: 1.3,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              />

              {/* ADD A NOTE */}
              <div style={{ ...styleT2, color: T.textLow, marginBottom: 10 }}>ADD A NOTE</div>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Write what this is about…"
                style={{
                  background: T.bgRaise,
                  borderRadius: 10,
                  padding: '12px 14px',
                  minHeight: 72,
                  border: `1px solid ${T.borderDefault}`,
                  color: T.textHi,
                  fontSize: 16,  // 16px floor — iOS auto-zoom on focus
                  fontFamily: FONT_DISPLAY,
                  resize: 'none',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                  marginBottom: 18,
                }}
                rows={3}
              />

              {/* LIST segmented control */}
              <div style={{ ...styleT2, color: T.textLow, marginBottom: 10 }}>LIST</div>
              <div style={{
                display: 'flex', padding: 4, borderRadius: 11,
                background: 'rgba(255,255,255,0.05)', marginBottom: 18,
              }}>
                {(['life', 'entity'] as const).map(seg => (
                  <button
                    key={seg}
                    onClick={() => setListType(seg)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 500,
                      background: listType === seg ? T.textHi : 'transparent',
                      color: listType === seg ? T.textInvert : T.textMid,
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {seg === 'life' ? 'Life' : 'Entity'}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </BottomSheet>

      {/* Discard guard dialog */}
      {showDiscardGuard && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 600,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: T.bgRaise, borderRadius: 16, padding: 24,
            border: `1px solid ${T.borderDefault}`, maxWidth: 320, width: '100%',
          }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 600, color: T.textHi, marginBottom: 8 }}>
              Discard changes?
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: T.textMid, marginBottom: 20 }}>
              Your edits will not be saved.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  setShowDiscardGuard(false)
                  setNoteText('')
                  setLocalTitle(task.title)
                  setMode('read')
                  resetAndClose()
                }}
                style={{
                  flex: 1, height: 44, borderRadius: 10, background: T.late,
                  color: T.textInvert, fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                }}
              >Discard</button>
              <button
                onClick={() => setShowDiscardGuard(false)}
                style={{
                  flex: 1, height: 44, borderRadius: 10, border: `1px solid ${T.borderStrong}`,
                  color: T.textMid, fontFamily: FONT_DISPLAY, fontSize: 14, background: 'transparent', cursor: 'pointer',
                }}
              >Keep editing</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm dialog — scope addition 8.19.26.
          Mobile delete is a hard row delete. task_note cascades — one tap destroys the task
          AND every note on it. Copy makes this explicit before the user confirms. */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 600,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: T.bgRaise, borderRadius: 16, padding: 24,
            border: `1px solid ${T.borderDefault}`, maxWidth: 320, width: '100%',
          }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 600, color: T.textHi, marginBottom: 8 }}>
              Delete this task?
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: T.textMid, marginBottom: 20 }}>
              This removes the task and all its notes. It cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleDelete}
                disabled={saving}
                style={{
                  flex: 1, height: 44, borderRadius: 10, background: T.late,
                  color: T.textInvert, fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 600,
                  border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1,
                }}
              >{saving ? '…' : 'Delete'}</button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setTimeout(() => deleteRef.current?.focus(), 50) }}
                style={{
                  flex: 1, height: 44, borderRadius: 10, border: `1px solid ${T.borderStrong}`,
                  color: T.textMid, fontFamily: FONT_DISPLAY, fontSize: 14, background: 'transparent', cursor: 'pointer',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

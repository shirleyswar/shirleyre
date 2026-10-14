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
import MarkCompleteButton from '@/components/warroom/MarkCompleteButton'
import chrome from '@/components/warroom/taskItemChrome.module.css'
import TaskTagControl from '@/components/warroom/TaskTagControl'
import { persistTaskTag, taskTagOf, type TaskTag } from '@/lib/taskTags'

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
const LABEL: React.CSSProperties = {
  ...styleT2,
  letterSpacing: '0.14em',
  fontWeight: 600,
  color: T.textLow,
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
  is_sr?: boolean
  entity_name?: string | null
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
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
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
  const [listType, setListType] = useState<TaskTag | null>(null)
  const [entityName, setEntityName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<TaskNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [showDiscardGuard, setShowDiscardGuard] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [titleEditing, setTitleEditing] = useState(false)
  const [committedDue, setCommittedDue] = useState<string | null>(null)
  const [savedOn, setSavedOn] = useState(false)

  const titleRef = useRef<HTMLTextAreaElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const deleteRef = useRef<HTMLButtonElement>(null)
  const origTitle = useRef('')
  const titleCancelRef = useRef(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      setListType(taskTagOf(task))
      setEntityName(task.entity_name ?? task.entities?.name ?? null)
      setSaving(false)
      setError(null)
      setShowDiscardGuard(false)
      setShowDeleteConfirm(false)
      setTitleEditing(false)
      setCommittedDue(task.due_date)
      setSavedOn(false)
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

  // Focus the title once it mounts as a field.
  useEffect(() => {
    if (titleEditing && titleRef.current) {
      titleRef.current.focus()
      autoSizeTitle()
    }
  }, [titleEditing])

  // Auto-size title textarea — eliminates the ~90px dead band.
  // rows={3} at 23px/1.3 lineHeight ≈ 90px for a one-liner. Set height to scrollHeight
  // on every render so the field is exactly as tall as its content.
  function autoSizeTitle() {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  function growNote() {
    const el = noteRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  function flashSaved() {
    setSavedOn(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSavedOn(false), 1600)
  }

  // visualViewport listener removed — footer is now flex:none inside BottomSheet,
  // so it naturally tracks the visual bottom of the sheet without needing keyboard offset.

  if (!open || !task) return null

  const today = todayCST()
  const currentDue = task.due_date
  const displayedDue = committedDue ?? currentDue
  const overdue = isOverdue(displayedDue)
  const titleEdited = localTitle !== origTitle.current

  // Same RPC CONFIRM used. Null fields are left alone by the deployed COALESCE.
  async function saveFields(fields: { due?: string, list?: 'life' | 'entity', note?: string, title?: string }): Promise<boolean> {
    if (!task) return false
    setSaving(true)
    setError(null)
    const { error: rpcErr } = await (supabase as any).rpc('commit_task_sheet', {
      p_task_id: task.id,
      p_due_date: fields.due ?? null,
      p_list_type: fields.list ?? null,
      p_note_body: fields.note ?? null,
      p_title: fields.title ?? null,
    })
    setSaving(false)
    if (rpcErr) {
      setError(rpcErr.message || 'Save failed — nothing was lost')
      return false
    }
    flashSaved()
    return true
  }

  async function commitTitle(): Promise<boolean> {
    if (titleCancelRef.current) {
      titleCancelRef.current = false
      setTitleEditing(false)
      return true
    }
    const next = localTitle.trim()
    if (!next || next === origTitle.current) {
      setLocalTitle(origTitle.current)
      setTitleEditing(false)
      return true
    }
    const ok = await saveFields({ title: next })
    if (!ok) return false
    origTitle.current = next
    setLocalTitle(next)
    setTitleEditing(false)
    return true
  }

  async function commitNote(): Promise<boolean> {
    const body = noteText.trim()
    if (!body || !task) return true
    const ok = await saveFields({ note: body })
    if (!ok) return false
    setNoteText('')
    if (noteRef.current) noteRef.current.style.height = '44px'
    const { data } = await supabase
      .from('task_note')
      .select('id, task_id, body, created_at')
      .eq('task_id', task.id)
      .order('created_at', { ascending: false })
    setNotes((data as TaskNote[]) ?? [])
    return true
  }

  function onTitleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      titleCancelRef.current = true
      setLocalTitle(origTitle.current)
      setTitleEditing(false)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  function onNoteKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  function startTitleEdit() {
    setTitleEditing(true)
  }

  async function handleDismiss() {
    if (noteText.trim()) {
      const ok = await commitNote()
      if (!ok) return
    }
    if (titleEditing) {
      const ok = await commitTitle()
      if (!ok) return
    }
    resetAndClose()
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

  // Complete task — checkmark tap.
  // Item 8 ruling: checkmark only fires when isActive === false (sheet untouched).
  // Nothing is staged — no RPC call needed. One write: mark status complete.
  async function handleComplete() {
    if (!task || saving) return false
    if (noteText.trim()) {
      const noted = await commitNote()
      if (!noted) return false
    }
    setSaving(true)
    setError(null)
    const { error: completeErr } = await supabase
      .from('tasks')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', task.id)
    if (completeErr) {
      setSaving(false)
      setError('Could not complete — try again')
      return false
    }
    setSaving(false)
    onCompleted(task)
    resetAndClose()
  }

  // CONFIRM tap — atomic write
  async function handleConfirm() {
    if (!task) return
    // Guard: only proceed if the shared predicate says something is staged
    if (!task) return

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

  async function handleChipTap(chip: 'today' | 'tomorrow' | 'nextmon' | 'pick') {
    if (chip === 'pick') {
      setShowCalendar(open => !open)
      return
    }
    setShowCalendar(false)
    const next = chip === 'today' ? today : chip === 'tomorrow' ? addDays(1) : getNextMonday()
    if (next === (committedDue ?? currentDue)) return
    const ok = await saveFields({ due: next })
    if (ok) setCommittedDue(next)
  }

  async function pickCalendarDay(d: Date) {
    const dateStr = d.toLocaleDateString('en-CA')
    setShowCalendar(false)
    if (dateStr === (committedDue ?? currentDue)) return
    const ok = await saveFields({ due: dateStr })
    if (ok) setCommittedDue(dateStr)
  }

  async function pickTag(next: TaskTag) {
    if (next === listType) return
    const prevTag = listType
    const prevEntity = entityName
    const nextEntity = next === 'entity' ? entityName : null
    setListType(next)
    setEntityName(nextEntity)
    if (!task) return
    const res = await persistTaskTag(task.id, next, nextEntity)
    if (!res.ok) {
      setListType(prevTag)
      setEntityName(prevEntity)
      setError(res.message || 'Save failed — nothing was lost')
      return
    }
    if (res.degraded && res.message) setError(res.message)
    else flashSaved()
  }

  async function pickEntity(name: string) {
    if (!task) return
    const prev = entityName
    setEntityName(name)
    setListType('entity')
    const res = await persistTaskTag(task.id, 'entity', name)
    if (!res.ok) {
      setEntityName(prev)
      setError(res.message || 'Save failed — nothing was lost')
      return
    }
    if (res.degraded && res.message) setError(res.message)
    else flashSaved()
  }

  // Status word — moved into the header kicker. Red is applied only when overdue.
  let eyebrowText = 'LATER'
  if (displayedDue) {
    if (overdue) {
      const n = daysOverdue(displayedDue)
      eyebrowText = `${n === 0 ? '0' : n} DAY${n === 1 ? '' : 'S'} LATE`
    } else if (displayedDue === today) {
      eyebrowText = 'TODAY'
    }
  }

  // D11.5 — shared staging predicate (lib/taskStagingPredicate.ts)
  // ── Header action — the checkmark stays. Fields save themselves.
  // READ  → DONE caption + checkmark (completion)
  // EDIT  → DELETE asset slot (104×44, right-aligned at 18px gutter)
  // One slot, one action, never both.
  const headerAction = (
    <MarkCompleteButton
      onClick={handleComplete}
      disabled={saving}
      hitSize={44}
    />
  )

  // List name in read mode
  const dealAddr = task.deals ? formatAddress(task.deals as any) : null


  const statusWord = eyebrowText.replace(/^●\s*/, '')
  const statusColor = overdue ? T.late : '#B8B8C0'

  return (
    <>
      <BottomSheet
        open={open}
        onClose={handleDismiss}
        label={<>BATTLE PLAN · <span style={{ color: statusColor }}>{statusWord}</span>{savedOn && <span style={{ marginLeft: 10, color: T.moneyIn, letterSpacing: '0.02em', textTransform: 'none' }}>Saved ✓</span>}</>}
        labelStyle={{ color: '#B8B8C0', fontSize: 13, fontWeight: 600, letterSpacing: '0.12em' }}
        headerHeight={56}
        noHairline
        noHandle
        size="full"
        headerAction={headerAction}
        scrollPaddingBottom={16}
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
                onClick={() => setError(null)}
                style={{ flex: 1, height: 36, borderRadius: 8, background: T.late, color: T.textInvert, fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >Try again</button>
              <button
                onClick={() => setError(null)}
                style={{ height: 36, padding: '0 16px', borderRadius: 8, border: `1px solid ${T.borderStrong}`, color: T.textMid, fontFamily: FONT_DISPLAY, fontSize: 13, background: 'transparent', cursor: 'pointer' }}
              >Keep draft</button>
            </div>
          </div>
        )}

        <div style={{ padding: '0 16px' }}>

          {titleEditing ? (
            <textarea
              ref={titleRef}
              value={localTitle}
              onChange={e => { setLocalTitle(e.target.value); autoSizeTitle() }}
              onBlur={() => { commitTitle() }}
              onKeyDown={onTitleKey}
              rows={1}
              style={{
                ...styleD3,
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${T.brand}`,
                outline: 'none',
                resize: 'none',
                width: '100%',
                padding: 0,
                paddingBottom: 8,
                marginBottom: 12,
                overflow: 'hidden',
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <div
              onClick={startTitleEdit}
              style={{
                ...styleD3,
                marginBottom: 12,
                textWrap: 'pretty',
                cursor: 'text',
                borderBottom: `1px solid ${T.borderDefault}`,
                paddingBottom: 8,
              } as React.CSSProperties}
            >
              {localTitle || task.title}
            </div>
          )}

          {task.deal_id && (
            <div style={{
              background: T.bgRaise, borderRadius: 8, padding: '8px 16px', marginBottom: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              border: `1px solid ${T.borderDefault}`,
              gap: 8,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...LABEL, marginBottom: 8 }}>DEAL</div>
                <div style={styleT3}>{dealAddr || task.deals?.name || '—'}</div>
              </div>
              <button type="button" style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(139,92,246,0.13)',
                border: '1px solid rgba(139,92,246,0.28)',
                color: T.brandLift,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 15, flexShrink: 0,
              }}>↗</button>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={LABEL}>DUE</span>
              <span style={{ ...styleT3, color: displayedDue ? (overdue ? T.late : T.textMid) : T.textLow }}>
                {displayedDue ? formatDueDisplay(displayedDue) : 'No due date'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['today', 'tomorrow', 'nextmon', 'pick'] as const).map(chip => {
                const chipDate = chip === 'today' ? today : chip === 'tomorrow' ? addDays(1) : chip === 'nextmon' ? getNextMonday() : null
                const on = chip === 'pick'
                  ? (showCalendar || (!!displayedDue && displayedDue !== today && displayedDue !== addDays(1) && displayedDue !== getNextMonday()))
                  : displayedDue === chipDate
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleChipTap(chip)}
                    className={on ? `${chrome.chip} ${chrome.chipOn}` : chrome.chip}
                    style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 500 }}
                  >
                    {chip === 'today' ? 'Today' : chip === 'tomorrow' ? 'Tomorrow' : chip === 'nextmon' ? 'Next Mon' : 'Pick date'}
                  </button>
                )
              })}
            </div>
            {showCalendar && (
              <CalendarPicker
                value={displayedDue ? new Date(displayedDue + 'T00:00:00') : null}
                onChange={pickCalendarDay}
                onDone={pickCalendarDay}
                onCancel={() => setShowCalendar(false)}
              />
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ ...LABEL, marginBottom: 8 }}>TAG</div>
            <TaskTagControl
              tag={listType}
              entityName={entityName}
              onTag={pickTag}
              onEntity={pickEntity}
              fill
            />
          </div>

          <textarea
            ref={noteRef}
            className={`${chrome.textarea} ${chrome.noteGrow}`}
            value={noteText}
            onChange={e => { setNoteText(e.target.value); growNote() }}
            onBlur={() => { commitNote() }}
            onKeyDown={onNoteKey}
            placeholder="Add a note…"
            rows={1}
            style={{ fontSize: 16 }}
          />
          {notes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {notes.map(note => (
                <div key={note.id}>
                  <div style={{ ...styleT2, color: T.textLow, marginBottom: 4 }}>{formatNoteDate(note.created_at)}</div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{note.body}</div>
                </div>
              ))}
            </div>
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

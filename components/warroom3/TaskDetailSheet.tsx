'use client'
// §13.2 Task sheet — read/edit states on BottomSheet shell.
// §18.9: two exits only — swipe-down anywhere (inherited from BottomSheet) + FAB ×.
// §18.4: guard splits — staged chip discards silently; typed text keeps confirm-before-discard.

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatAddress } from '@/lib/formatAddress'
import BottomSheet from '@/components/warroom3/BottomSheet'
import CalendarPicker from '@/components/warroom3/CalendarPicker'

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

// §18.10 check 11 — derive at render, never a literal
const TAB_BAR     = 94    // §5.7
const FAB_LIFT    = 23    // §5.7
const TAB_PAD_TOP = 0     // measured: BottomTabBar has no padding-top
const CLEARANCE   = 14
const FOOTER_BOTTOM = TAB_BAR + FAB_LIFT - TAB_PAD_TOP + CLEARANCE  // = 131

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
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  const titleRef = useRef<HTMLTextAreaElement>(null)
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

  // Auto-focus title field on edit mode
  useEffect(() => {
    if (mode === 'edit' && titleRef.current) {
      titleRef.current.focus()
    }
  }, [mode])

  // Keyboard offset via visualViewport
  useEffect(() => {
    function handleResize() {
      if (!window.visualViewport) return
      const gap = window.innerHeight - window.visualViewport.height
      setKeyboardOffset(Math.max(0, gap))
    }
    window.visualViewport?.addEventListener('resize', handleResize)
    return () => window.visualViewport?.removeEventListener('resize', handleResize)
  }, [])

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
    const { error: err } = await supabase
      .from('tasks')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', task.id)
    setSaving(false)
    if (err) {
      setError('Could not complete — try again')
      return
    }
    onCompleted(task)
    resetAndClose()
  }

  // CONFIRM tap — atomic write
  async function handleConfirm() {
    if (!task) return
    const hasStaged = stagedDate !== null
    const hasEdits = titleEdited || noteText.trim().length > 0
    if (!hasStaged && !hasEdits) return

    setSaving(true)
    setError(null)

    try {
      // Compute due_at NOW from stagedDate (not at chip tap)
      const dueDateVal = stagedDate ?? task.due_date
      const noteBody = noteText.trim() || null
      const newListType = mode === 'edit' ? listType : (task.is_life ? 'life' : task.is_entity ? 'entity' : null)
      const newTitle = mode === 'edit' && titleEdited ? localTitle : null

      // Try RPC first
      const { error: rpcErr } = await (supabase as any).rpc('commit_task_sheet', {
        p_task_id:   task.id,
        p_due_date:  dueDateVal,
        p_list_type: newListType,
        p_note_body: noteBody,
      })

      if (rpcErr && (rpcErr.code === '42883' || rpcErr.code === 'PGRST202' || (rpcErr.message && rpcErr.message.includes('Could not find the function')))) {
        // RPC not yet deployed — fallback
        const patch: Record<string, unknown> = {
          due_date:   dueDateVal,
          is_life:    newListType === 'life',
          is_entity:  newListType === 'entity',
          updated_at: new Date().toISOString(),
        }
        if (newTitle) patch.title = newTitle
        const { error: updateErr } = await supabase.from('tasks').update(patch).eq('id', task.id)
        if (updateErr) throw updateErr
        if (noteBody) {
          const { error: noteErr } = await supabase
            .from('task_note')
            .insert({ task_id: task.id, body: noteBody, created_at: new Date().toISOString() })
          if (noteErr) throw noteErr
        }
      } else if (rpcErr) {
        throw rpcErr
      } else {
        // RPC succeeded but title update is separate (RPC handles due_date + list_type + note)
        if (newTitle) {
          const { error: titleErr } = await supabase
            .from('tasks')
            .update({ title: newTitle })
            .eq('id', task.id)
          if (titleErr) throw titleErr
        }
      }

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
    const { error: err } = await supabase.from('tasks').delete().eq('id', task.id)
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

  // Footer logic
  const isActive = stagedDate !== null || (mode === 'edit' && (titleEdited || noteText.trim().length > 0))

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

  // ── Header action — checkmark in read mode
  const headerAction = mode === 'read' ? (
    <button
      onClick={handleComplete}
      disabled={saving}
      style={{
        width: 44, height: 44, padding: 0,
        border: 'none', background: 'transparent',
        cursor: saving ? 'default' : 'pointer',
        opacity: saving ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/check/check-h140.png" alt="Complete" width={44} height={44} style={{ display: 'block' }} />
    </button>
  ) : null

  // List name in read mode
  const listName = task.is_life
    ? 'Life'
    : task.entity_id && task.entities?.name
    ? task.entities.name
    : task.is_entity
    ? 'Entity'
    : '—'

  const dealAddr = task.deals ? formatAddress(task.deals as any) : null

  return (
    <>
      <BottomSheet
        open={open}
        onClose={handleDismiss}
        label={mode === 'edit' ? 'EDIT TASK' : 'TASK'}
        noHandle
        size="full"
        headerAction={headerAction}
        scrollPaddingBottom={160}
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

              {/* 7. Delete task row */}
              <div style={{ borderTop: `1px solid ${T.borderDefault}`, paddingTop: 14, marginBottom: 20 }}>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', minHeight: 44, background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: T.textMid }}>Delete task</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.late} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            </>
          )}

          {/* EDIT MODE */}
          {mode === 'edit' && (
            <>
              {/* Title field — auto-focused */}
              <textarea
                ref={titleRef}
                value={localTitle}
                onChange={e => setLocalTitle(e.target.value)}
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
                }}
                rows={3}
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
                  fontSize: 13,
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

      {/* Pinned footer — outside BottomSheet scroll, fixed */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: FOOTER_BOTTOM + keyboardOffset,
          left: 0,
          right: 0,
          zIndex: 502,
          padding: '0 18px',
          display: 'flex',
          gap: 11,
        }}>
          {/* Secondary slot — EDIT / CANCEL */}
          <button
            onClick={() => {
              if (mode === 'read') {
                setMode('edit')
              } else {
                // Cancel edit — check for typed content
                const hasTyped = titleEdited || noteText.trim().length > 0
                if (hasTyped) {
                  setShowDiscardGuard(true)
                } else {
                  // staged chip only — discard silently
                  setStagedDate(null)
                  setStagedChip(null)
                  setNoteText('')
                  setLocalTitle(task.title)
                  setMode('read')
                }
              }
            }}
            style={{
              width: 140,
              height: 52,
              borderRadius: 12,
              border: `1px solid ${T.borderStrong}`,
              color: T.textMid,
              fontFamily: FONT_MONO,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: 'transparent',
              cursor: 'pointer',
              flexShrink: 0,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {mode === 'read' ? 'EDIT' : 'CANCEL'}
          </button>

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
                flex: 1,
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
                  textTransform: 'uppercase',
                  color: T.textLow,
                }}>CONFIRM</span>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* Delete confirm dialog */}
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
              This cannot be undone.
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
                onClick={() => setShowDeleteConfirm(false)}
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

'use client'

// §18.3b Task sheet (36a, locked 13 Aug)
// Full create-and-save sheet. Wraps in BottomSheet (size="list", label="New Task").
// Title field: Space Grotesk 22/500, underline border, autofocused.
// DUE: four chips (Today · Tomorrow · +3 · Pick date). Today default.
// Pick date: drawn CalendarPicker — never native <input type="date">.
// Save: INSERT to `tasks` table. Offline guard. Success → dismiss. Error → inline banner.
// EYES-AUTO: sheet layout with title focused.

import React, { useState, useEffect, useRef } from 'react'
import BottomSheet from '@/components/warroom3/BottomSheet'
import CalendarPicker from '@/components/warroom3/CalendarPicker'
import { FAB_APERTURE_GRADIENT, FAB_APERTURE_SHADOW } from '@/lib/fabGradient'
import chrome from '@/components/warroom/taskItemChrome.module.css'
import TaskTagControl from '@/components/warroom/TaskTagControl'
import { insertTaskRow, TASK_ARRIVE_MS, type TaskTag } from '@/lib/taskTags'

// §3.1: UPPERCASE → JetBrains Mono. Sentence case → Space Grotesk.
const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  textHi:     '#EFEEF4',
  textMid:    '#B8B6C6',
  textLow:    '#8E8CA0',
  textInvert: '#0A0A0F',
  bgRaise:    '#1E1D26',
} as const

// T2 §3.2 — 9.5px / 500 / 0.19em / UPPER / text-low — section eyebrow
const styleT2: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9.5,
  fontWeight: 500,
  letterSpacing: '0.19em',
  textTransform: 'uppercase',
  color: T.textLow,
  lineHeight: 1,
}

type DueChip = 'today' | 'tomorrow' | 'plus3' | 'pick'

function toISODate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function chipDate(chip: DueChip): string {
  const now = new Date()
  if (chip === 'today')    return toISODate(now)
  if (chip === 'tomorrow') { now.setDate(now.getDate() + 1); return toISODate(now) }
  if (chip === 'plus3')    { now.setDate(now.getDate() + 3); return toISODate(now) }
  return ''
}

export interface NewTaskDraft {
  id: string
  title: string
  status: string
  due_date: string | null
  deal_id: null
  is_life: boolean
  is_entity: boolean
  is_sr: boolean
  entity_name: string | null
  entity_id: null
  sort_order: null
  created_at: string
  clientKey: string
  flashUntil: number
}

interface TaskSheetProps {
  open: boolean
  onClose: () => void
  onOptimisticCreate?: (task: NewTaskDraft) => void
  onCreateFailed?: (id: string, message: string) => void
  onCreateSettled?: (tempId: string, realId: string, notice?: string) => void
}

export default function TaskSheet({ open, onClose, onOptimisticCreate, onCreateFailed, onCreateSettled }: TaskSheetProps) {
  const [title, setTitle]             = useState('')
  const [dueChip, setDueChip]         = useState<DueChip>('today')
  const [calOpen, setCalOpen]         = useState(false)
  const [pickedDate, setPickedDate]   = useState<Date | null>(null)
  const [tag, setTag]                 = useState<TaskTag | null>(null)
  const [entityName, setEntityName]   = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [offline, setOffline]         = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const saveLock = useRef(false)

  // Autofocus title on open
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => titleRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setTitle(''); setDueChip('today'); setCalOpen(false)
      setPickedDate(null); setTag(null); setEntityName(null)
      setSaving(false); setError(null); setOffline(false)
      saveLock.current = false
    }
  }, [open])

  const effectiveDueDate = dueChip === 'pick'
    ? (pickedDate ? toISODate(pickedDate) : '')
    : chipDate(dueChip)

  const canSave = title.trim().length > 0  // §item 3 ruling: live when title non-empty; date is optional

  // CODE: supabase insert logic
  const handleSave = async () => {
    if (!canSave || saving || saveLock.current) return

    if (!navigator.onLine) {
      setOffline(true)
      return
    }

    saveLock.current = true
    const tempId = `opt-${Date.now()}`
    const due = effectiveDueDate || null
    const draft: NewTaskDraft = {
      id: tempId,
      title: title.trim(),
      status: 'open',
      due_date: due,
      deal_id: null,
      is_life: tag === 'life',
      is_entity: tag === 'entity',
      is_sr: tag === 'sr',
      entity_name: tag === 'entity' ? entityName : null,
      entity_id: null,
      sort_order: null,
      created_at: new Date().toISOString(),
      clientKey: tempId,
      flashUntil: Date.now() + TASK_ARRIVE_MS,
    }
    onOptimisticCreate?.(draft)
    onClose()

    const result = await insertTaskRow({
      title: draft.title,
      status: 'open',
      due_date: due,
      created_at: draft.created_at,
      is_life: draft.is_life,
      is_entity: draft.is_entity,
      is_sr: draft.is_sr,
      entity_name: draft.entity_name,
    }, tag, tag === 'entity' ? entityName : null)

    if (result.error || !result.id) {
      onCreateFailed?.(tempId, result.error?.message || 'Save failed — try again')
      return
    }
    onCreateSettled?.(tempId, result.id, result.degraded ? 'Saved. SR and the entity name need the new database columns before they stick.' : undefined)
  }

  function chooseTag(next: TaskTag) {
    if (tag === next) {
      setTag(null)
      setEntityName(null)
      return
    }
    setTag(next)
    if (next !== 'entity') setEntityName(null)
  }

  const DUE_CHIPS: { key: DueChip; label: string }[] = [
    { key: 'today',    label: 'Today' },
    { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'plus3',    label: '+3' },
    { key: 'pick',     label: 'Pick date' },
  ]

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="New Task"
      size="list"
    >
      <div style={{ padding: '0 18px 24px' }}>

        {/* Title field — D3 style: Space Grotesk 22/500, underline border, no box radius */}
        {/* EYES-AUTO: sheet layout with title focused */}
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={e => { setTitle(e.target.value); setError(null) }}
          placeholder="What needs to get done?"
          aria-label="Task title"
          className={chrome.titleField}
          style={{ marginBottom: 28 }}
        />

        {/* DUE section */}
        <div style={{ ...styleT2, marginBottom: 12 }}>DUE</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: calOpen ? 0 : 24 }}>
          {DUE_CHIPS.map(chip => {
            const sel = dueChip === chip.key
            return (
              <button
                key={chip.key}
                onClick={() => {
                  setDueChip(chip.key)
                  if (chip.key !== 'pick') setCalOpen(false)
                  else setCalOpen(v => !v)
                }}
                style={{
                  // §13.2 chip style
                  padding: '11px 15px',
                  borderRadius: 9,
                  fontFamily: FONT_DISPLAY,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: sel ? 'none' : '1px solid rgba(255,255,255,0.20)',
                  background: sel ? FAB_APERTURE_GRADIENT : 'transparent',
                  boxShadow: sel ? FAB_APERTURE_SHADOW : 'none',
                  color: sel ? T.textInvert : T.textMid,
                  WebkitTapHighlightColor: 'transparent',
                  whiteSpace: 'nowrap',
                } as React.CSSProperties}
              >
                {chip.label}
              </button>
            )
          })}
        </div>

        {/* Drawn calendar — only when Pick date is selected */}
        {dueChip === 'pick' && calOpen && (
          <CalendarPicker
            value={pickedDate}
            onCancel={() => { setCalOpen(false); setDueChip('today') }}
            onDone={date => { setPickedDate(date); setCalOpen(false) }}
          />
        )}

        {/* Show picked date label when calendar is closed */}
        {dueChip === 'pick' && !calOpen && pickedDate && (
          <div style={{
            fontFamily: FONT_DISPLAY, fontSize: 12, color: T.textMid,
            marginTop: 6, marginBottom: 18,
          }}>
            {pickedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        )}

        <div style={{ ...styleT2, marginBottom: 12 }}>TAG</div>
        <div style={{ marginBottom: 8 }}>
          <TaskTagControl
            tag={tag}
            entityName={entityName}
            onTag={chooseTag}
            onEntity={name => { setTag('entity'); setEntityName(name) }}
            fill
          />
        </div>

        {/* Deal placeholder row — v1 stub, never pushes title off-screen */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 44,
          borderTop: '1px solid rgba(255,255,255,0.10)',
          marginTop: 18,
          paddingTop: 14,
        }}>
          <div style={{
            fontFamily: FONT_DISPLAY, fontSize: 12, color: T.textLow,
          }}>Link a deal (optional)</div>
        </div>

        {/* Offline banner */}
        {offline && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 9,
            background: 'rgba(255,162,58,0.10)',
            border: '1px solid rgba(255,162,58,0.22)',
            fontFamily: FONT_DISPLAY, fontSize: 12, color: '#FFA23A',
          }}>
            You&apos;re offline — saved locally
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 9,
            background: 'rgba(255,77,77,0.10)',
            border: '1px solid rgba(255,77,77,0.22)',
            fontFamily: FONT_DISPLAY, fontSize: 12, color: '#FF4D4D',
          }}>
            {error}
          </div>
        )}

        {/* Footer: Cancel + Save task */}
        <div style={{ display: 'flex', gap: 9, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, height: 46,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.20)',
              borderRadius: 11,
              color: T.textMid,
              fontFamily: FONT_DISPLAY,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{
              flex: 1, height: 46,
              background: canSave && !saving ? FAB_APERTURE_GRADIENT : 'rgba(139,92,246,0.3)',
              boxShadow: canSave && !saving ? FAB_APERTURE_SHADOW : 'none',
              border: 'none',
              borderRadius: 11,
              color: canSave && !saving ? T.textInvert : T.textLow,
              fontFamily: FONT_DISPLAY,
              fontSize: 13,
              fontWeight: 600,
              cursor: canSave && !saving ? 'pointer' : 'default',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties}
          >
            {saving ? 'Saving…' : 'Save task'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

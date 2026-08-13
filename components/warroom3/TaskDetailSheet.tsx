'use client'

// §13.2 Task detail / edit sheet.
// Opens when a Battle Plan row is tapped — NOT the "New Task" creation sheet.
// Full-height: top: 34px. Position fixed overlay, zIndex 50.

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import CalendarPicker from '@/components/warroom3/CalendarPicker'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  textHi:    '#EFEEF4',
  textMid:   '#8B8A9B',
  textLow:   '#5C5B6B',
  late:      '#FF4D4D',
  hot:       '#FFA23A',
  brand:     '#8B5CF6',
  brandLift: '#A78BFA',
} as const

// T2 §3.2 — 9.5px / 500 / 0.19em / UPPER / text-low
const styleT2: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9.5,
  fontWeight: 500,
  letterSpacing: '0.19em',
  textTransform: 'uppercase',
  lineHeight: 1,
}

// T3 §3.2 — Space Grotesk 14.5px / 400
const styleT3: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 14.5,
  fontWeight: 400,
  color: T.textHi,
}

// T4 §3.2 — Space Grotesk 11.5px / 400
const styleT4: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 11.5,
  fontWeight: 400,
  color: T.textLow,
}

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
  deals?: { name?: string; address?: string } | null
  entities?: { name?: string } | null
  note?: string | null
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

function todayCST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function formatDueLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return dateStr < todayCST()
}

function daysOverdue(dateStr: string): number {
  const now = new Date(); now.setHours(0,0,0,0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.floor((now.getTime() - target.getTime()) / 86400000)
}

function getNextMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = ((1 - day) + 7) % 7 || 7
  d.setDate(d.getDate() + diff)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

export default function TaskDetailSheet({
  open,
  task,
  onClose,
  onCompleted,
  onSaved,
  onDeleted,
  onMorphRequest,
}: TaskDetailSheetProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [localTitle, setLocalTitle] = useState('')
  const [selectedChip, setSelectedChip] = useState<'today' | 'tomorrow' | 'nextmon' | 'pick' | null>(null)
  const [localDue, setLocalDue] = useState<string | null>(null)
  const [listType, setListType] = useState<'life' | 'entity'>('life')
  const [note, setNote] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  // Sync local state when task changes
  useEffect(() => {
    if (task) {
      setLocalTitle(task.title)
      setSelectedChip(null)
      setLocalDue(null)
      setListType(task.is_life ? 'life' : 'entity')
      setNote((task as any).note || '')
      setEditingTitle(false)
      setError(null)
    }
  }, [task])

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus()
    }
  }, [editingTitle])

  if (!open || !task) return null

  const today = todayCST()
  const currentDue = localDue ?? task.due_date
  const overdue = isOverdue(currentDue)
  const dealAddr = (task.deals as any)?.address || (task.deals as any)?.name || null

  // Status eyebrow
  let eyebrowText = 'LATER'
  let eyebrowColor: string = T.textLow
  if (currentDue) {
    if (overdue) {
      const n = daysOverdue(currentDue)
      eyebrowText = n === 0 ? 'TODAY' : `OVERDUE · ${n} ${n === 1 ? 'DAY' : 'DAYS'} LATE`
      eyebrowColor = T.late
    } else if (currentDue === today) {
      eyebrowText = 'TODAY'
      eyebrowColor = T.hot
    }
  }

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
      setError('Could not complete — tap to retry')
      return
    }
    onCompleted(task)
    onClose()
  }

  async function handleSave() {
    if (!task) return
    setSaving(true)
    setError(null)
    const patch: Record<string, unknown> = {}
    if (localTitle !== task.title) patch.title = localTitle
    if (localDue !== null) patch.due_date = localDue
    if (listType !== (task.is_life ? 'life' : 'entity')) {
      patch.is_life = listType === 'life'
      patch.is_entity = listType === 'entity'
    }
    if (note !== ((task as any).note || '')) patch.note = note
    if (Object.keys(patch).length > 0) {
      const { error: err } = await supabase
        .from('tasks')
        .update(patch)
        .eq('id', task.id)
      setSaving(false)
      if (err) {
        setError('Could not save — tap to retry')
        return
      }
    } else {
      setSaving(false)
    }
    onClose()
    onSaved()
  }

  async function handleDelete() {
    if (!task) return
    if (!confirm('Delete this task?')) return
    const { error: err } = await supabase.from('tasks').delete().eq('id', task.id)
    if (err) {
      setError('Could not delete — try again')
      return
    }
    onClose()
    onDeleted()
  }

  function handleChip(chip: 'today' | 'tomorrow' | 'nextmon' | 'pick') {
    if (chip === 'pick') {
      setSelectedChip('pick')
      setShowCalendar(true)
      return
    }
    setSelectedChip(chip)
    if (chip === 'today') setLocalDue(today)
    else if (chip === 'tomorrow') setLocalDue(addDays(1))
    else if (chip === 'nextmon') setLocalDue(getNextMonday())
  }

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '11px 15px',
    borderRadius: 9,
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    border: active ? 'none' : '1px solid rgba(255,255,255,0.13)',
    background: active ? '#EFEEF4' : 'transparent',
    color: active ? '#0A0A0F' : T.textMid,
  })

  return (
    <>
      {/* Overlay backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 49,
        }}
        onClick={onClose}
      />

      {/* Full-height sheet: top 34px per §13.2 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          top: 34,
          background: '#0B0A12',
          zIndex: 50,
          overflowY: 'auto',
          paddingBottom: 120, // space for pinned footer + something happened row
        }}
      >
        {/* 1. Grab handle */}
        <div
          style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 8 }}
          onClick={onClose}
        >
          <div style={{
            width: 38,
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.18)',
            cursor: 'pointer',
          }} />
        </div>

        <div style={{ padding: '0 18px' }}>
          {/* 2. Status eyebrow row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ ...styleT2, color: eyebrowColor }}>{eyebrowText}</span>
            <span style={{ ...styleT2, color: T.textLow }}>BATTLE PLAN</span>
          </div>

          {/* 3. Title */}
          <div style={{ marginBottom: 18 }}>
            {editingTitle ? (
              <textarea
                ref={titleRef}
                value={localTitle}
                onChange={e => setLocalTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
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
                  borderBottom: '1px solid rgba(255,255,255,0.09)',
                  paddingBottom: 8,
                }}
                rows={3}
                autoFocus
              />
            ) : (
              <div
                onClick={() => setEditingTitle(true)}
                style={{ cursor: 'text' }}
              >
                <div style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 23,
                  fontWeight: 500,
                  color: T.textHi,
                  borderBottom: '1px solid rgba(255,255,255,0.09)',
                  paddingBottom: 8,
                  lineHeight: 1.3,
                }}>
                  {localTitle}
                </div>
                <div style={{ ...styleT2, color: T.textLow, marginTop: 6 }}>TAP TO EDIT</div>
              </div>
            )}
          </div>

          {/* 4. Deal row — only if deal_id is non-null */}
          {task.deal_id && (
            <div style={{
              background: '#16161F',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ ...styleT2, color: T.textLow, marginBottom: 5 }}>DEAL</div>
                <div style={styleT3}>{dealAddr || 'Deal'}</div>
              </div>
              <button style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(139,92,246,0.13)',
                border: '1px solid rgba(139,92,246,0.28)',
                color: T.brandLift,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 15,
                flexShrink: 0,
              }}>
                ↗
              </button>
            </div>
          )}

          {/* 5. DUE section */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ ...styleT2, color: T.textLow }}>DUE</span>
              {currentDue && (
                <span style={{
                  ...styleT2,
                  color: overdue ? T.late : T.textMid,
                }}>
                  {formatDueLabel(currentDue)}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={chipStyle(selectedChip === 'today')} onClick={() => handleChip('today')}>Today</button>
              <button style={chipStyle(selectedChip === 'tomorrow')} onClick={() => handleChip('tomorrow')}>Tomorrow</button>
              <button style={chipStyle(selectedChip === 'nextmon')} onClick={() => handleChip('nextmon')}>Next Mon</button>
              <button style={chipStyle(selectedChip === 'pick')} onClick={() => handleChip('pick')}>Pick date</button>
            </div>
            {showCalendar && (
              <div style={{ marginTop: 12 }}>
                <CalendarPicker
                  value={currentDue ? new Date(currentDue + 'T00:00:00') : null}
                  onDone={(d: Date) => {
                    setLocalDue(d.toLocaleDateString('en-CA'))
                    setShowCalendar(false)
                    setSelectedChip('pick')
                  }}
                  onCancel={() => {
                    setShowCalendar(false)
                    setSelectedChip(null)
                  }}
                />
              </div>
            )}
          </div>

          {/* 6. LIST segmented control */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ ...styleT2, color: T.textLow, marginBottom: 10 }}>LIST</div>
            <div style={{
              display: 'flex',
              padding: 4,
              borderRadius: 11,
              background: 'rgba(255,255,255,0.05)',
            }}>
              {(['life', 'entity'] as const).map(seg => (
                <button
                  key={seg}
                  onClick={() => setListType(seg)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: FONT_DISPLAY,
                    fontSize: 13,
                    fontWeight: 500,
                    background: listType === seg ? '#EFEEF4' : 'transparent',
                    color: listType === seg ? '#0A0A0F' : T.textMid,
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {seg === 'life' ? 'Life' : 'Entity'}
                </button>
              ))}
            </div>
          </div>

          {/* 7. NOTE */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ ...styleT2, color: T.textLow, marginBottom: 10 }}>NOTE</div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note…"
              style={{
                background: '#16161F',
                borderRadius: 10,
                padding: '12px 14px',
                minHeight: 56,
                border: '1px solid rgba(255,255,255,0.08)',
                color: T.textHi,
                fontSize: 13,
                fontFamily: FONT_DISPLAY,
                resize: 'none',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
              rows={3}
            />
          </div>

          {/* 8. Delete row */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...styleT4, color: T.textLow }}>Delete task</span>
              <button
                onClick={handleDelete}
                style={{
                  border: '1px solid #FF4D4D',
                  color: '#FF4D4D',
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 500,
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 9. Pinned footer — outside scroll, absolute bottom of the sheet overlay */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 51,
        background: '#0B0A12',
        padding: '12px 18px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
      }}>
        {/* 10. Something happened — above footer buttons, per spec §13.2 item 10 */}
        <div
          onClick={() => task && onMorphRequest?.(task)}
          style={{
            textAlign: 'center',
            padding: '8px 18px',
            fontFamily: FONT_DISPLAY,
            fontSize: 13,
            color: T.brandLift,
            cursor: 'pointer',
            // §14.2 morph sheet — not yet built
          }}
        >
          <span style={{ fontSize: 14, marginRight: 6 }}>⚡</span>Something happened…
        </div>

        <div style={{ display: 'flex', gap: 9 }}>
          {/* Complete button */}
          <button
            onClick={handleComplete}
            disabled={saving}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 10,
              background: '#34D399',
              color: '#0A0A0F',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: FONT_DISPLAY,
              border: 'none',
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            Complete
          </button>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              height: 48,
              padding: '0 20px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.13)',
              color: T.textMid,
              fontSize: 14,
              fontWeight: 500,
              fontFamily: FONT_DISPLAY,
              background: 'transparent',
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            Save
          </button>
        </div>

        {/* Inline error banner */}
        {error && (
          <div style={{
            marginTop: 8,
            padding: '8px 12px',
            background: 'rgba(255,77,77,0.12)',
            borderRadius: 8,
            color: T.late,
            fontSize: 12,
            fontFamily: FONT_DISPLAY,
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}
      </div>
    </>
  )
}

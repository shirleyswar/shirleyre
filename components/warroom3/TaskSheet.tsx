'use client'

// New-task sheet. Same card as the desktop create modal, anchored as a bottom sheet.
// Title is the hero. Due and tag stay collapsed until tapped.

import React, { useState, useEffect, useRef } from 'react'
import BottomSheet from '@/components/warroom3/BottomSheet'
import CalendarPicker from '@/components/warroom3/CalendarPicker'
import chrome from '@/components/warroom/taskItemChrome.module.css'
import CreateTaskFields from '@/components/warroom/CreateTaskFields'
import { insertTaskRow, TASK_ARRIVE_MS, type TaskTag } from '@/lib/taskTags'

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

function toISODate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
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

export default function TaskSheet({ open, onClose, onOptimisticCreate, onCreateFailed, onCreateSettled }: TaskSheetProps) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [dueOpen, setDueOpen] = useState(false)
  const [calOpen, setCalOpen] = useState(false)
  const [tag, setTag] = useState<TaskTag | null>(null)
  const [entityName, setEntityName] = useState<string | null>(null)
  const [tagOpen, setTagOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const saveLock = useRef(false)

  const today = toISODate(new Date())
  const tomorrow = addDays(today, 1)
  const nextMon = nextMonday(today)

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => titleRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        e.preventDefault()
        ;(active as HTMLElement).blur()
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setTitle('')
      setDueDate(null)
      setDueOpen(false)
      setCalOpen(false)
      setTag(null)
      setEntityName(null)
      setTagOpen(false)
      setSaving(false)
      setError(null)
      setOffline(false)
      saveLock.current = false
    }
  }, [open])

  const canSave = title.trim().length > 0

  const handleSave = async () => {
    if (!canSave || saving || saveLock.current) return

    if (!navigator.onLine) {
      setOffline(true)
      return
    }

    saveLock.current = true
    const tempId = `opt-${Date.now()}`
    const due = dueDate
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

  function chooseDue(value: string | 'pick') {
    if (value === 'pick') {
      setCalOpen(true)
      return
    }
    setDueDate(prev => prev === value ? null : value)
    setCalOpen(false)
    setDueOpen(false)
  }

  function chooseTag(next: TaskTag) {
    if (next === 'entity') {
      if (tag !== 'entity') {
        setTag('entity')
        setEntityName(null)
      }
      setTagOpen(true)
      return
    }
    if (tag === next) {
      setTag(null)
      setEntityName(null)
    } else {
      setTag(next)
      setEntityName(null)
    }
    setTagOpen(false)
  }

  const dueLabel = !dueDate ? 'No due date'
    : dueDate === today ? 'Today'
    : dueDate === tomorrow ? 'Tomorrow'
    : dueDate === nextMon ? 'Next Mon'
    : formatDue(dueDate)

  const activeDue: string | 'pick' | null = calOpen ? 'pick'
    : dueDate === today || dueDate === tomorrow || dueDate === nextMon ? dueDate
    : dueDate ? 'pick'
    : null

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="New Task"
      appearance="create"
    >
      <div style={{ padding: '12px 18px 18px' }}>
        <div className={chrome.createCloseRow}>
          <button type="button" className={chrome.createClose} onClick={onClose} aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            ESC
          </button>
        </div>

        <CreateTaskFields
          title={title}
          onTitle={value => { setTitle(value); setError(null) }}
          titleRef={titleRef}
          dueLabel={dueLabel}
          dueOpen={dueOpen}
          onToggleDue={() => { setDueOpen(open => !open); setTagOpen(false); setCalOpen(false) }}
          dueOptions={[
            { label: 'Today', value: today },
            { label: 'Tomorrow', value: tomorrow },
            { label: 'Next Mon', value: nextMon },
            { label: 'Pick date', value: 'pick' },
          ]}
          activeDue={activeDue}
          onDue={chooseDue}
          picker={calOpen ? (
            <CalendarPicker
              value={dueDate ? new Date(dueDate + 'T00:00:00') : null}
              onCancel={() => setCalOpen(false)}
              onDone={date => {
                setDueDate(toISODate(date))
                setCalOpen(false)
                setDueOpen(false)
              }}
            />
          ) : null}
          tag={tag}
          entityName={entityName}
          tagOpen={tagOpen}
          onToggleTag={() => { setTagOpen(open => !open); setDueOpen(false); setCalOpen(false) }}
          onTag={chooseTag}
          onEntity={name => { setTag('entity'); setEntityName(name); setTagOpen(false) }}
        />

        {offline && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 9,
            background: 'rgba(255,162,58,0.10)',
            border: '1px solid rgba(255,162,58,0.22)',
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontSize: 12,
            color: '#FFA23A',
          }}>
            You&apos;re offline — saved locally
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 9,
            background: 'rgba(255,77,77,0.10)',
            border: '1px solid rgba(255,77,77,0.22)',
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontSize: 12,
            color: '#FF4D4D',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            type="button"
            className={chrome.confirmHit}
            onClick={handleSave}
            disabled={!canSave || saving}
            aria-disabled={!canSave || saving}
          >
            <span className={canSave && !saving ? chrome.confirmOn : chrome.confirmOff}>
              {saving ? 'SAVING…' : 'CONFIRM'}
            </span>
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

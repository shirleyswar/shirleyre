'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ScheduleEvent {
  id: string
  title: string
  time: string
  date: string
  location: string | null
  deal_id: string | null
  created_at: string
}

interface DealOption {
  id: string
  name: string
  address: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayCST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const today = todayCST()
  if (dateStr === today) return 'Today'
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  if (dateStr === tomorrowStr) return 'Tomorrow'
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Smart date label for group headers: Today / Tomorrow / "Wednesday, April 2"
function formatGroupHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const today = todayCST()
  if (dateStr === today) return 'Today'
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  if (dateStr === tomorrowStr) return 'Tomorrow'
  // e.g. "Wednesday, April 2"
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatFullDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

// ─── Calendar Picker ──────────────────────────────────────────────────────────

function CalendarPicker({
  value,
  onChange,
  onClose,
}: {
  value: string
  onChange: (v: string) => void
  onClose: () => void
}) {
  const today = todayCST()
  const [y, m] = value.split('-').map(Number)
  const [viewYear, setViewYear] = useState(y)
  const [viewMonth, setViewMonth] = useState(m - 1) // 0-indexed

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = Array(firstDay).fill(null)
  for (let i = 1; i <= daysInMonth; i++) cells.push(i)
  while (cells.length % 7 !== 0) cells.push(null)

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(day: number) {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    onChange(`${viewYear}-${mm}-${dd}`)
    onClose()
  }

  const selectedDay = (() => {
    const [sy, sm, sd] = value.split('-').map(Number)
    if (sy === viewYear && sm - 1 === viewMonth) return sd
    return null
  })()

  const todayDay = (() => {
    const [ty, tm, td] = today.split('-').map(Number)
    if (ty === viewYear && tm - 1 === viewMonth) return td
    return null
  })()

  return (
    <div
      style={{
        background: '#0E0C1E',
        border: '1px solid rgba(232,184,75,0.35)',
        borderRadius: 12,
        padding: '14px 12px',
        width: 260,
        boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
        userSelect: 'none',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button
          type="button"
          onClick={prevMonth}
          style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 6px', borderRadius: 4 }}
        >‹</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#F2EDE4', letterSpacing: '0.05em' }}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 6px', borderRadius: 4 }}
        >›</button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', padding: '2px 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const isSelected = day === selectedDay
          const isToday = day === todayDay
          return (
            <button
              key={i}
              type="button"
              onClick={() => selectDay(day)}
              style={{
                width: '100%',
                aspectRatio: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: isSelected ? 800 : isToday ? 600 : 400,
                background: isSelected
                  ? 'var(--accent-gold)'
                  : isToday
                  ? 'rgba(232,184,75,0.15)'
                  : 'transparent',
                border: isToday && !isSelected ? '1px solid rgba(232,184,75,0.4)' : '1px solid transparent',
                borderRadius: 6,
                color: isSelected ? '#0D0F14' : isToday ? 'var(--accent-gold)' : '#D1D5DB',
                cursor: 'pointer',
                transition: 'all 0.1s',
                padding: 0,
              }}
              onMouseEnter={e => {
                if (!isSelected) e.currentTarget.style.background = 'rgba(232,184,75,0.2)'
              }}
              onMouseLeave={e => {
                if (!isSelected) e.currentTarget.style.background = isToday ? 'rgba(232,184,75,0.15)' : 'transparent'
              }}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Today shortcut */}
      <div style={{ marginTop: 10, textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => { onChange(todayCST()); onClose() }}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 11,
            color: 'rgba(232,184,75,0.55)',
            cursor: 'pointer',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          Today
        </button>
      </div>
    </div>
  )
}

// ─── Date trigger button (shows calendar popover) ─────────────────────────────

function DateSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.05)',
          border: open ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8,
          fontSize: 13,
          color: '#F2EDE4',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
          transition: 'border-color 0.15s',
          width: '100%',
        }}
      >
        <CalIconSmall />
        <span>{formatDisplayDate(value)}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(232,184,75,0.5)' }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 10000,
          }}
        >
          <CalendarPicker
            value={value}
            onChange={onChange}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function SchedulePanel() {
  // "upcoming" = next 5 events from today onward, grouped by date
  const [upcomingEvents, setUpcomingEvents] = useState<ScheduleEvent[]>([])
  const [deals, setDeals] = useState<DealOption[]>([])
  const [loading, setLoading] = useState(true)
  const [tableReady, setTableReady] = useState(true)

  // Add form state
  const [formDate, setFormDate] = useState(todayCST())
  const [formTime, setFormTime] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formDealId, setFormDealId] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    fetchDeals()
    fetchUpcoming()
  }, [])

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

  async function fetchUpcoming() {
    setLoading(true)
    try {
      const today = todayCST()
      const { data, error } = await supabase
        .from('schedule_events')
        .select('*')
        .gte('date', today)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(5)

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setTableReady(false)
        }
        setLoading(false)
        return
      }
      setUpcomingEvents((data ?? []) as ScheduleEvent[])
    } catch {
      setTableReady(false)
    } finally {
      setLoading(false)
    }
  }

  function openAddForm() {
    setFormDate(todayCST())
    setShowAddForm(true)
    if (typeof window !== 'undefined') document.body.style.overflow = 'hidden'
  }

  const closeModal = useCallback(() => {
    setShowAddForm(false)
    setFormTime('')
    setFormTitle('')
    setFormLocation('')
    setFormDealId('')
    setFormDate(todayCST())
    if (typeof window !== 'undefined') document.body.style.overflow = ''
  }, [])

  async function addEvent() {
    if (!formTitle.trim() || !formTime.trim()) return
    setAdding(true)
    try {
      const { data, error } = await supabase
        .from('schedule_events')
        .insert({
          title: formTitle.trim(),
          time: formTime.trim(),
          date: formDate,
          location: formLocation.trim() || null,
          deal_id: formDealId || null,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) setTableReady(false)
        setAdding(false)
        return
      }
      if (data) {
        setTableReady(true)
        closeModal()
        // Refresh the upcoming list
        await fetchUpcoming()
      }
    } catch {}
    setAdding(false)
  }

  async function deleteEvent(id: string) {
    try {
      await supabase.from('schedule_events').delete().eq('id', id)
      setUpcomingEvents(prev => prev.filter(e => e.id !== id))
    } catch {}
  }

  // Group events by date for display
  const grouped: { date: string; events: ScheduleEvent[] }[] = []
  for (const ev of upcomingEvents) {
    const last = grouped[grouped.length - 1]
    if (last && last.date === ev.date) {
      last.events.push(ev)
    } else {
      grouped.push({ date: ev.date, events: [ev] })
    }
  }

  return (
    <div className="wr-card h-full min-h-[240px]">
      <div className="wr-card-header">
        <span style={{ color: 'var(--accent-gold)', display: 'flex' }}><CalIcon /></span>
        <span className="wr-card-title" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--accent-gold)' }}>
          SCHEDULE
        </span>
        <span className="wr-panel-line" />
        {/* TODAY button — purple */}
        <button
          onClick={openAddForm}
          style={{
            padding: '4px 12px',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.35) 0%, rgba(109,40,217,0.45) 100%)',
            border: '1px solid rgba(167,139,250,0.5)',
            borderRadius: 20,
            color: '#c4b5fd',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            boxShadow: '0 0 10px rgba(139,92,246,0.25)',
          }}
        >
          + Add Event
        </button>
      </div>

      {/* TODAY purple pill below header */}
      <div style={{ marginBottom: 14 }}>
        <button
          onClick={openAddForm}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 16px',
            background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)',
            border: '1px solid rgba(167,139,250,0.6)',
            borderRadius: 20,
            color: '#EDE9FE',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            boxShadow: '0 0 18px rgba(124,58,237,0.4)',
          }}
        >
          <span style={{ fontSize: 14 }}>📅</span>
          TODAY — {new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' })}
        </button>
      </div>

      {/* Add Event Modal */}
      {showAddForm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '80px 16px 24px' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{ background: '#13112A', border: '1px solid rgba(232,184,75,0.3)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.5)', fontFamily: 'monospace' }}>Add Event</div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Date</div>
              <DateSelector value={formDate} onChange={setFormDate} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Time &amp; Title</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <TimeWheel value={formTime} onChange={setFormTime} />
                <input
                  autoFocus
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && formTitle.trim() && formTime) addEvent(); if (e.key === 'Escape') closeModal() }}
                  placeholder="Event title"
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)' }}
                />
              </div>
            </div>
            <input
              type="text"
              value={formLocation}
              onChange={e => setFormLocation(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && formTitle.trim() && formTime) addEvent(); if (e.key === 'Escape') closeModal() }}
              placeholder="Location (optional)"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)' }}
            />
            {deals.length > 0 && (
              <select
                value={formDealId}
                onChange={e => setFormDealId(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: formDealId ? 'var(--accent-gold)' : '#6B7280', outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
              >
                <option value="">No deal linked</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.address || d.name}</option>)}
              </select>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={closeModal} style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#6B7280', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Cancel
              </button>
              <button
                onClick={addEvent}
                disabled={adding || !formTitle.trim() || !formTime}
                style={{ flex: 2, padding: '11px', background: adding || !formTitle.trim() || !formTime ? 'rgba(139,92,246,0.2)' : 'linear-gradient(135deg, rgba(139,92,246,0.4) 0%, rgba(109,40,217,0.5) 100%)', border: '1px solid rgba(167,139,250,0.5)', borderRadius: 8, color: '#c4b5fd', fontSize: 14, fontWeight: 700, cursor: adding || !formTitle.trim() || !formTime ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', opacity: adding || !formTitle.trim() || !formTime ? 0.5 : 1 }}
              >
                {adding ? 'Saving...' : `Save — ${formatDisplayDate(formDate)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Upcoming Events List ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 6 }} />)}
        </div>
      ) : !tableReady ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', fontStyle: 'italic' }}>
          Schedule table not yet created. Add your first event above.
        </div>
      ) : grouped.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', fontStyle: 'italic' }}>
          No upcoming events. Tap + Add Event to schedule one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {grouped.map(group => (
            <div key={group.date}>
              {/* Date group header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
                marginTop: 8,
              }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: group.date === todayCST()
                    ? '#A78BFA'   // purple for today
                    : 'var(--text-muted)',
                  fontFamily: 'var(--font-body)',
                }}>
                  {formatGroupHeader(group.date)}
                </span>
                <div style={{ flex: 1, height: 1, background: group.date === todayCST() ? 'rgba(167,139,250,0.2)' : 'var(--border-subtle)' }} />
              </div>
              {/* Events under this date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 4 }}>
                {group.events.map(event => (
                  <EventRow key={event.id} event={event} onDelete={deleteEvent} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Event Row ────────────────────────────────────────────────────────────────

function EventRow({ event, onDelete }: { event: ScheduleEvent; onDelete: (id: string) => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        gap: 10,
        padding: '7px 10px',
        background: 'var(--bg-elevated)',
        borderRadius: 6,
        border: '1px solid var(--border-subtle)',
        alignItems: 'center',
      }}
    >
      {/* Time */}
      <div style={{
        width: 68,
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--accent-gold)',
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}>
        {event.time}
      </div>
      {/* Title + location */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {event.title}
        </div>
        {event.location && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {event.location}
          </div>
        )}
      </div>
      {/* Delete on hover */}
      {hovered && (
        <button
          onClick={() => onDelete(event.id)}
          title="Delete"
          style={{ background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.6)', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '2px 4px', borderRadius: 4, flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.6)')}
        >✕</button>
      )}
    </div>
  )
}

// ─── TimeWheel ────────────────────────────────────────────────────────────────

function TimeWheel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function parseTime(v: string) {
    const m = v.match(/(\d+):(\d+)\s*(AM|PM)/i)
    if (m) return { hour: parseInt(m[1]), minute: parseInt(m[2]), ampm: m[3].toUpperCase() as 'AM' | 'PM' }
    return { hour: 9, minute: 0, ampm: 'AM' as 'AM' | 'PM' }
  }

  const parsed = parseTime(value || '9:00 AM')
  const [hour, setHour] = useState(parsed.hour)
  const [minute, setMinute] = useState(parsed.minute)
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(parsed.ampm)
  const [open, setOpen] = useState(false)

  const HOURS = [1,2,3,4,5,6,7,8,9,10,11,12]
  const MINUTES = [0,15,30,45]

  function emit(h: number, m: number, ap: string) {
    onChange(`${h}:${m.toString().padStart(2,'0')} ${ap}`)
  }

  function selectHour(h: number) { setHour(h); emit(h, minute, ampm) }
  function selectMinute(m: number) { setMinute(m); emit(hour, m, ampm) }

  const displayVal = value || `${hour}:${minute.toString().padStart(2,'0')} ${ampm}`

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: 90,
          padding: '10px 8px',
          background: 'rgba(255,255,255,0.05)',
          border: open ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8,
          fontSize: 13,
          color: value ? '#F2EDE4' : '#6B7280',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
          textAlign: 'left',
          letterSpacing: '0.02em',
          fontVariantNumeric: 'tabular-nums',
          transition: 'border-color 0.15s',
        }}
      >
        {displayVal}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 10001,
            marginTop: 4,
            background: '#13112A',
            border: '1px solid rgba(232,184,75,0.3)',
            borderRadius: 10,
            padding: '12px 10px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
          }}
        >
          {/* Hour */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflowY: 'auto', scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'] }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' }}>HR</div>
            {HOURS.map(h => (
              <button key={h} type="button" onClick={() => selectHour(h)}
                style={{
                  width: 36, padding: '5px 0',
                  background: h === hour ? 'var(--accent-gold)' : 'transparent',
                  border: 'none', borderRadius: 5,
                  color: h === hour ? '#0D0F14' : 'var(--text-primary)',
                  fontSize: 13, fontWeight: h === hour ? 700 : 400, cursor: 'pointer',
                  fontVariantNumeric: 'tabular-nums', transition: 'all 0.1s',
                }}
                onMouseEnter={e => { if (h !== hour) e.currentTarget.style.background = 'rgba(232,184,75,0.12)' }}
                onMouseLeave={e => { if (h !== hour) e.currentTarget.style.background = 'transparent' }}
              >{h}</button>
            ))}
          </div>
          <div style={{ width: 1, height: 200, background: 'rgba(255,255,255,0.08)', flexShrink: 0, marginTop: 22 }} />
          {/* Minute */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' }}>MIN</div>
            {MINUTES.map(m => (
              <button key={m} type="button" onClick={() => selectMinute(m)}
                style={{
                  width: 36, padding: '5px 0',
                  background: m === minute ? 'var(--accent-gold)' : 'transparent',
                  border: 'none', borderRadius: 5,
                  color: m === minute ? '#0D0F14' : 'var(--text-primary)',
                  fontSize: 13, fontWeight: m === minute ? 700 : 400, cursor: 'pointer',
                  fontVariantNumeric: 'tabular-nums', transition: 'all 0.1s',
                }}
                onMouseEnter={e => { if (m !== minute) e.currentTarget.style.background = 'rgba(232,184,75,0.12)' }}
                onMouseLeave={e => { if (m !== minute) e.currentTarget.style.background = 'transparent' }}
              >{m.toString().padStart(2,'0')}</button>
            ))}
          </div>
          <div style={{ width: 1, height: 200, background: 'rgba(255,255,255,0.08)', flexShrink: 0, marginTop: 22 }} />
          {/* AM/PM */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.1em', color: 'transparent', marginBottom: 4 }}>--</div>
            {(['AM','PM'] as const).map(ap => (
              <button key={ap} type="button" onClick={() => { setAmpm(ap); emit(hour, minute, ap) }}
                style={{
                  width: 40, padding: '7px 0',
                  background: ap === ampm ? 'rgba(139,92,246,0.35)' : 'transparent',
                  border: ap === ampm ? '1px solid rgba(167,139,250,0.5)' : '1px solid transparent',
                  borderRadius: 6,
                  color: ap === ampm ? '#c4b5fd' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  letterSpacing: '0.05em', transition: 'all 0.15s',
                }}
              >{ap}</button>
            ))}
          </div>
          <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
            <button type="button" onClick={() => setOpen(false)}
              style={{
                padding: '3px 10px',
                background: 'var(--accent-gold)',
                border: 'none', borderRadius: 5,
                color: '#0D0F14', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function CalIconSmall() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0, color: 'var(--accent-gold)' }}>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

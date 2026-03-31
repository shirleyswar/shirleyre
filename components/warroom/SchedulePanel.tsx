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
  isDeadline?: boolean  // synthetic flag for contract deadlines
  deadlineType?: string
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
  const [upcomingEvents, setUpcomingEvents] = useState<ScheduleEvent[]>([])
  const [contractDeadlines, setContractDeadlines] = useState<ScheduleEvent[]>([])
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
    fetchContractDeadlines()
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
        .limit(50)

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

  async function fetchContractDeadlines() {
    try {
      const today = todayCST()
      // Only show deadlines within the next 21 days
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() + 21)
      const cutoffStr = cutoff.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
      const { data } = await supabase
        .from('contract_deadlines')
        .select('id, label, deadline_date, deadline_type, status, deal_id')
        .gte('deadline_date', today)
        .lte('deadline_date', cutoffStr)
        .neq('status', 'satisfied')
        .order('deadline_date', { ascending: true })
        .limit(30)

      if (!data) return

      // Get deal names for context
      const dealIds = Array.from(new Set(data.map((d: any) => d.deal_id).filter(Boolean)))
      let dealMap: Record<string, string> = {}
      if (dealIds.length > 0) {
        const { data: dealData } = await supabase
          .from('deals')
          .select('id,name,address')
          .in('id', dealIds)
        if (dealData) {
          dealData.forEach((d: any) => { dealMap[d.id] = d.address || d.name || '' })
        }
      }

      const synth: ScheduleEvent[] = data.map((d: any) => ({
        id: `deadline-${d.id}`,
        title: d.label,
        time: '11:59 PM',
        date: d.deadline_date,
        location: dealMap[d.deal_id] || null,
        deal_id: d.deal_id,
        created_at: d.deadline_date,
        isDeadline: true,
        deadlineType: d.deadline_type,
      }))

      setContractDeadlines(synth)
    } catch {}
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

  async function saveEvent(id: string, updates: Partial<ScheduleEvent>) {
    try {
      const { data, error } = await supabase
        .from('schedule_events')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (!error && data) {
        setUpcomingEvents(prev =>
          prev.map(e => e.id === id ? { ...e, ...data } : e)
            .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
        )
      }
    } catch {}
  }

  // Filter out events that have passed — re-evaluated every render (interval drives re-renders)
  const [nowTick, setNowTick] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  // Convert stored "H:MM AM/PM" time to 24h "HH:MM" for reliable comparison
  function to24h(t: string): string {
    const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (!m) return t.slice(0, 5) // already 24h or unknown — take first 5 chars
    let h = parseInt(m[1])
    const min = m[2]
    const ampm = m[3].toUpperCase()
    if (ampm === 'PM' && h !== 12) h += 12
    if (ampm === 'AM' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${min}`
  }

  const nowStr = new Date(nowTick).toLocaleString('en-CA', { timeZone: 'America/Chicago', hour12: false }).replace(', ', 'T').slice(0, 16) // "YYYY-MM-DDTHH:MM"
  // Calendar events only (no deadlines mixed in)
  const liveEvents = upcomingEvents
    .filter(e => {
      const t24 = to24h(e.time || '23:59')
      const evDT = `${e.date}T${t24}`
      return evDT >= nowStr
    })
    .sort((a, b) => a.date.localeCompare(b.date) || to24h(a.time || '').localeCompare(to24h(b.time || '')))

  // Contract deadlines only — already filtered to ≤21 days out by fetch
  const liveDeadlines = contractDeadlines
    .filter(e => e.date >= nowStr.slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Group calendar events by date
  const grouped: { date: string; events: ScheduleEvent[] }[] = []
  for (const ev of liveEvents) {
    const last = grouped[grouped.length - 1]
    if (last && last.date === ev.date) {
      last.events.push(ev)
    } else {
      grouped.push({ date: ev.date, events: [ev] })
    }
  }

  // Group deadlines by date
  const deadlineGrouped: { date: string; events: ScheduleEvent[] }[] = []
  for (const ev of liveDeadlines) {
    const last = deadlineGrouped[deadlineGrouped.length - 1]
    if (last && last.date === ev.date) {
      last.events.push(ev)
    } else {
      deadlineGrouped.push({ date: ev.date, events: [ev] })
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
          {/* ── Calendar Events ── */}
          {grouped.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0', fontStyle: 'italic' }}>
              No upcoming events. Tap + Add Event to schedule one.
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.date}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, marginTop: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: group.date === todayCST() ? '#A78BFA' : 'var(--text-muted)',
                    fontFamily: 'var(--font-body)',
                  }}>
                    {formatGroupHeader(group.date)}
                  </span>
                  <div style={{ flex: 1, height: 1, background: group.date === todayCST() ? 'rgba(167,139,250,0.2)' : 'var(--border-subtle)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 4 }}>
                  {group.events.map(event => (
                    <EventRow key={event.id} event={event} onDelete={deleteEvent} onSave={saveEvent} deals={deals} />
                  ))}
                </div>
              </div>
            ))
          )}

          {/* ── Contract Deadlines Section ── */}
          {liveDeadlines.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {/* Section header bubble */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                padding: '7px 12px',
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.25)',
                borderRadius: 8,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#60a5fa' }}>
                  Contract Deadlines
                </span>
                <div style={{ flex: 1, height: 1, background: 'rgba(59,130,246,0.2)' }} />
                <span style={{ fontSize: 9, color: 'rgba(96,165,250,0.6)', fontWeight: 600 }}>Next 21 days</span>
              </div>

              {/* Deadline groups by date */}
              {deadlineGrouped.map(group => (
                <div key={group.date}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, marginTop: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(96,165,250,0.7)', fontFamily: 'var(--font-body)' }}>
                      {formatGroupHeader(group.date)}
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(59,130,246,0.15)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 4 }}>
                    {group.events.map(event => (
                      <EventRow key={event.id} event={event} onDelete={deleteEvent} onSave={saveEvent} deals={deals} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Event Row ────────────────────────────────────────────────────────────────

function EventRow({
  event,
  onDelete,
  onSave,
  deals,
}: {
  event: ScheduleEvent
  onDelete: (id: string) => void
  onSave: (id: string, updates: Partial<ScheduleEvent>) => void
  deals: DealOption[]
}) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTime, setEditTime] = useState(event.time)
  const [editTitle, setEditTitle] = useState(event.title)
  const [editLocation, setEditLocation] = useState(event.location ?? '')

  function save() {
    if (!editTitle.trim()) return
    onSave(event.id, {
      time: editTime,
      title: editTitle.trim(),
      location: editLocation.trim() || null,
    })
    setEditing(false)
  }

  function cancel() {
    setEditTime(event.time)
    setEditTitle(event.title)
    setEditLocation(event.location ?? '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '10px 10px',
        background: 'rgba(232,184,75,0.05)',
        borderRadius: 6,
        border: '1px solid rgba(232,184,75,0.25)',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <TimeWheel value={editTime} onChange={setEditTime} />
          <input
            autoFocus
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(232,184,75,0.35)', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)' }}
          />
        </div>
        <input
          value={editLocation}
          onChange={e => setEditLocation(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          placeholder="Location (optional)"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)' }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={cancel} style={{ flex: 1, padding: '7px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#6B7280', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
          <button onClick={save} style={{ flex: 2, padding: '7px', background: 'rgba(232,184,75,0.15)', border: '1px solid rgba(232,184,75,0.4)', borderRadius: 6, color: '#E8B84B', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Save</button>
        </div>
      </div>
    )
  }

  // Contract deadline — redesigned for readability
  if (event.isDeadline) {
    // Days until deadline
    const today = new Date(); today.setHours(0,0,0,0)
    const due = new Date(event.date + 'T00:00:00')
    const daysOut = Math.round((due.getTime() - today.getTime()) / 86400000)
    const isToday = daysOut === 0
    const isUrgent = daysOut <= 3
    const isSoon = daysOut <= 7

    // Urgency color
    const urgentColor = isToday ? '#ef4444' : isUrgent ? '#fb923c' : isSoon ? '#fbbf24' : '#60a5fa'
    const urgentBg = isToday ? 'rgba(239,68,68,0.12)' : isUrgent ? 'rgba(251,146,60,0.12)' : isSoon ? 'rgba(251,191,36,0.1)' : 'rgba(30,41,59,0.6)'
    const urgentBorder = isToday ? 'rgba(239,68,68,0.4)' : isUrgent ? 'rgba(251,146,60,0.35)' : isSoon ? 'rgba(251,191,36,0.3)' : 'rgba(59,130,246,0.2)'

    const daysLabel = isToday ? 'TODAY' : daysOut === 1 ? '1 day' : `${daysOut} days`

    // Type label — capitalize and clean up
    const typeLabel = (event.deadlineType || 'deadline')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())

    return (
      <div style={{
        display: 'flex', gap: 12, padding: '9px 12px',
        background: urgentBg,
        borderRadius: 7,
        border: `1px solid ${urgentBorder}`,
        alignItems: 'center',
      }}>
        {/* Days countdown */}
        <div style={{
          flexShrink: 0, minWidth: 46, textAlign: 'center',
          padding: '4px 6px',
          background: isToday || isUrgent ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.15)',
          borderRadius: 5,
        }}>
          <div style={{ fontSize: isToday ? 10 : 14, fontWeight: 800, color: urgentColor, lineHeight: 1, letterSpacing: isToday ? '0.06em' : 0 }}>
            {daysLabel}
          </div>
          {!isToday && (
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>out</div>
          )}
        </div>

        {/* Title + property */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
            {event.title}
          </div>
          {event.location && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {event.location}
            </div>
          )}
        </div>

        {/* Type badge */}
        <div style={{
          fontSize: 9, fontWeight: 700, color: urgentColor,
          letterSpacing: '0.07em', textTransform: 'uppercase', flexShrink: 0,
          padding: '2px 7px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: 4,
          border: `1px solid ${urgentBorder}`,
        }}>
          {typeLabel}
        </div>
      </div>
    )
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={() => setEditing(true)}
      title="Double-click to edit"
      style={{
        display: 'flex',
        gap: 10,
        padding: '7px 10px',
        background: hovered ? 'rgba(232,184,75,0.04)' : 'var(--bg-elevated)',
        borderRadius: 6,
        border: '1px solid transparent',
        alignItems: 'center',
        cursor: 'default',
        transition: 'background 0.15s',
      }}
    >
      {/* Time */}
      <div style={{ width: 68, fontSize: 12, fontWeight: 700, color: 'var(--accent-gold)', flexShrink: 0, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
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
      {/* Action buttons — always in layout, invisible until hover to prevent layout shift */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s', pointerEvents: hovered ? 'auto' : 'none' }}>
        <button
          onClick={() => setEditing(true)}
          title="Edit"
          style={{ background: 'transparent', border: 'none', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '2px 5px' }}
        >✎</button>
        <button
          onClick={() => onDelete(event.id)}
          title="Delete"
          style={{ background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.5)', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '2px 4px', borderRadius: 4 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.5)')}
        >✕</button>
      </div>
    </div>
  )
}

// ─── TimeWheel ────────────────────────────────────────────────────────────────

function TimeWheel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function parseTime(v: string) {
    const m = v.match(/(\d+):(\d+)\s*(AM|PM)/i)
    if (m) return { hour: parseInt(m[1]), minute: parseInt(m[2]), ampm: m[3].toUpperCase() as 'AM' | 'PM' }
    return { hour: 12, minute: 0, ampm: 'PM' as 'AM' | 'PM' }
  }

  const parsed = parseTime(value || '12:00 PM')
  const [hour, setHour] = useState(parsed.hour)
  const [minute, setMinute] = useState(parsed.minute)
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(parsed.ampm)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const hourScrollRef = useRef<HTMLDivElement>(null)

  // HOURS ordered so 12 is in the middle: 6,7,8,9,10,11,12,1,2,3,4,5,6
  // Show 1-12 but scroll so selected is centered
  const HOURS = [1,2,3,4,5,6,7,8,9,10,11,12]
  const MINUTES = [0,15,30,45]
  const ITEM_HEIGHT = 34 // px per hour item including gap

  // Scroll hour column so selected hour is centered when dropdown opens
  useEffect(() => {
    if (!open || !hourScrollRef.current) return
    // 12 hours visible, center = index of selected hour
    const idx = HOURS.indexOf(hour)
    if (idx === -1) return
    const containerH = hourScrollRef.current.clientHeight
    const scrollTo = idx * ITEM_HEIGHT - (containerH / 2) + (ITEM_HEIGHT / 2)
    hourScrollRef.current.scrollTop = Math.max(0, scrollTo)
  }, [open])

  // Mouse wheel on hour column
  function handleHourWheel(e: React.WheelEvent) {
    e.preventDefault()
    const idx = HOURS.indexOf(hour)
    const delta = e.deltaY > 0 ? 1 : -1
    const newIdx = (idx + delta + HOURS.length) % HOURS.length
    const newHour = HOURS[newIdx]
    setHour(newHour)
    emit(newHour, minute, ampm)
  }

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function emit(h: number, m: number, ap: string) {
    onChange(`${h}:${m.toString().padStart(2,'0')} ${ap}`)
  }

  function selectHour(h: number) { setHour(h); emit(h, minute, ampm) }
  function selectMinute(m: number) { setMinute(m); emit(hour, m, ampm) }

  const displayVal = value || `${hour}:${minute.toString().padStart(2,'0')} ${ampm}`

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flexShrink: 0 }}>
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
            padding: '12px 10px 12px 10px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
          }}
        >
          {/* Hour */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' }}>HR</div>
            <div
              ref={hourScrollRef}
              onWheel={handleHourWheel}
              style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 204, overflowY: 'auto', scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'] }}
            >
              {HOURS.map(h => (
                <button key={h} type="button" onClick={() => selectHour(h)}
                  style={{
                    width: 36, height: ITEM_HEIGHT - 2, padding: '0',
                    flexShrink: 0,
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

'use client'

import { useState, useEffect, useCallback } from 'react'
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

export default function SchedulePanel() {
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [deals, setDeals] = useState<DealOption[]>([])
  const [loading, setLoading] = useState(true)
  const [tableReady, setTableReady] = useState(true)

  // Add form state
  const [formTime, setFormTime] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formDealId, setFormDealId] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }) // YYYY-MM-DD in CST
  const todayLabel = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  useEffect(() => {
    fetchDeals()
    fetchEvents()
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

  async function fetchEvents() {
    try {
      const { data, error } = await supabase
        .from('schedule_events')
        .select('*')
        .eq('date', today)
        .order('time', { ascending: true })

      if (error) {
        // Table likely doesn't exist yet — show empty state gracefully
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setTableReady(false)
        }
        return
      }
      if (data) setEvents(data as ScheduleEvent[])
    } catch {
      setTableReady(false)
    } finally {
      setLoading(false)
    }
  }

  async function addEvent() {
    if (!formTitle.trim() || !formTime.trim()) return
    setAdding(true)
    try {
      const { data, error } = await supabase
        .from('schedule_events')
        .insert({
          title: formTitle.trim(),
          time: formTime.trim(),
          date: today,
          location: formLocation.trim() || null,
          deal_id: formDealId || null,
        })
        .select()
        .single()

      if (error) {
        // Try to create table if it doesn't exist
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setTableReady(false)
        }
        return
      }

      if (data) {
        setEvents(prev => [...prev, data as ScheduleEvent].sort((a, b) => a.time.localeCompare(b.time)))
        setFormTime('')
        setFormTitle('')
        setFormLocation('')
        setFormDealId('')
        setTableReady(true)
        closeModal()
      }
    } catch {}
    setAdding(false)
  }

  // Close modal and snap viewport back on mobile
  const closeModal = useCallback(() => {
    setShowAddForm(false)
    setFormTime('')
    setFormTitle('')
    setFormLocation('')
    setFormDealId('')
    // Restore scroll position — prevents iOS viewport shift after keyboard dismiss
    if (typeof window !== 'undefined') {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      window.scrollTo(0, 0)
    }
  }, [])

  async function deleteEvent(id: string) {
    try {
      await supabase.from('schedule_events').delete().eq('id', id)
      setEvents(prev => prev.filter(e => e.id !== id))
    } catch {}
  }

  return (
    <div className="wr-card h-full min-h-[240px]">
      <div className="wr-card-header">
        <span style={{ color: 'var(--accent-gold)', display: 'flex' }}>
          <CalIcon />
        </span>
        <span className="wr-card-title" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--accent-gold)' }}>
          SCHEDULE
        </span>
        <span className="wr-panel-line" />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{todayLabel}</span>
      </div>

      {/* Add Event button */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => {
            setShowAddForm(true)
            if (typeof window !== 'undefined') {
              document.body.style.overflow = 'hidden'
              document.body.style.position = 'fixed'
              document.body.style.width = '100%'
            }
          }}
          className="wr-btn-orbit"
          style={{ fontSize: 12 }}
        >
          + Add Event
        </button>
      </div>

      {/* Add Event Modal */}
      {showAddForm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '80px 16px 24px' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{ background: '#13112A', border: '1px solid rgba(232,184,75,0.3)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Header */}
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.5)', fontFamily: 'monospace' }}>Add Event</div>
            {/* Time + Title */}
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
            {/* Location */}
            <input
              type="text"
              value={formLocation}
              onChange={e => setFormLocation(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && formTitle.trim() && formTime) addEvent(); if (e.key === 'Escape') closeModal() }}
              placeholder="Location (optional)"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)' }}
            />
            {/* Deal */}
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
            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                onClick={closeModal}
                style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#6B7280', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
              >
                Cancel
              </button>
              <button
                onClick={addEvent}
                disabled={adding || !formTitle.trim() || !formTime}
                style={{ flex: 2, padding: '11px', background: adding || !formTitle.trim() || !formTime ? 'rgba(139,92,246,0.2)' : 'linear-gradient(135deg, rgba(139,92,246,0.4) 0%, rgba(109,40,217,0.5) 100%)', border: '1px solid rgba(167,139,250,0.5)', borderRadius: 8, color: '#c4b5fd', fontSize: 14, fontWeight: 700, cursor: adding || !formTitle.trim() || !formTime ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', opacity: adding || !formTitle.trim() || !formTime ? 0.5 : 1 }}
              >
                {adding ? 'Saving...' : 'Save Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 44, borderRadius: 6 }} />
          ))}
        </div>
      ) : !tableReady ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', fontStyle: 'italic' }}>
          Schedule table not yet created. Add your first event to initialize.
        </div>
      ) : events.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', fontStyle: 'italic' }}>
          Nothing scheduled today.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {events.map(event => (
            <EventRow key={event.id} event={event} onDelete={deleteEvent} />
          ))}
        </div>
      )}
    </div>
  )
}

function EventRow({ event, onDelete }: { event: ScheduleEvent; onDelete: (id: string) => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        gap: 10,
        padding: '8px 10px',
        background: 'var(--bg-elevated)',
        borderRadius: 6,
        border: '1px solid var(--border-subtle)',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      <div style={{
        width: 64,
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--accent-gold)',
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {event.time}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{event.title}</div>
        {event.location && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{event.location}</div>
        )}
      </div>
      {hovered && (
        <button
          onClick={() => onDelete(event.id)}
          title="Delete event"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(239,68,68,0.6)',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            padding: '2px 4px',
            borderRadius: 4,
            flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.6)')}
        >
          ✕
        </button>
      )}
    </div>
  )
}


// ─── TimeWheel ────────────────────────────────────────────────────────────────
// 12hr wheel selector: hour wheel + 15-min increments + AM/PM toggle

function TimeWheel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Parse current value or default to 9:00 AM
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
  function toggleAmPm() { const next = ampm === 'AM' ? 'PM' : 'AM'; setAmpm(next); emit(hour, minute, next) }

  const displayVal = value || `${hour}:${minute.toString().padStart(2,'0')} ${ampm}`

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: 90,
          padding: '6px 8px',
          background: 'var(--bg-elevated)',
          border: open ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
          borderRadius: 6,
          fontSize: 13,
          color: value ? 'var(--text-primary)' : 'var(--text-muted)',
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

      {/* Dropdown wheel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 500,
            marginTop: 4,
            background: '#13112A',
            border: '1px solid rgba(232,184,75,0.3)',
            borderRadius: 10,
            padding: '12px 10px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
          }}
        >
          {/* Hour wheel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflowY: 'auto', scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'] }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' }}>HR</div>
            {HOURS.map(h => (
              <button
                key={h}
                type="button"
                onClick={() => selectHour(h)}
                style={{
                  width: 36,
                  padding: '5px 0',
                  background: h === hour ? 'var(--accent-gold)' : 'transparent',
                  border: 'none',
                  borderRadius: 5,
                  color: h === hour ? '#0D0F14' : 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: h === hour ? 700 : 400,
                  cursor: 'pointer',
                  fontVariantNumeric: 'tabular-nums',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={e => { if (h !== hour) e.currentTarget.style.background = 'rgba(232,184,75,0.12)' }}
                onMouseLeave={e => { if (h !== hour) e.currentTarget.style.background = 'transparent' }}
              >
                {h}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 200, background: 'rgba(255,255,255,0.08)', flexShrink: 0, marginTop: 22 }} />

          {/* Minute wheel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' }}>MIN</div>
            {MINUTES.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => selectMinute(m)}
                style={{
                  width: 36,
                  padding: '5px 0',
                  background: m === minute ? 'var(--accent-gold)' : 'transparent',
                  border: 'none',
                  borderRadius: 5,
                  color: m === minute ? '#0D0F14' : 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: m === minute ? 700 : 400,
                  cursor: 'pointer',
                  fontVariantNumeric: 'tabular-nums',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={e => { if (m !== minute) e.currentTarget.style.background = 'rgba(232,184,75,0.12)' }}
                onMouseLeave={e => { if (m !== minute) e.currentTarget.style.background = 'transparent' }}
              >
                {m.toString().padStart(2,'0')}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 200, background: 'rgba(255,255,255,0.08)', flexShrink: 0, marginTop: 22 }} />

          {/* AM/PM toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' }}>  </div>
            {(['AM','PM'] as const).map(ap => (
              <button
                key={ap}
                type="button"
                onClick={() => { setAmpm(ap); emit(hour, minute, ap) }}
                style={{
                  width: 40,
                  padding: '7px 0',
                  background: ap === ampm ? 'rgba(139,92,246,0.35)' : 'transparent',
                  border: ap === ampm ? '1px solid rgba(167,139,250,0.5)' : '1px solid transparent',
                  borderRadius: 6,
                  color: ap === ampm ? '#c4b5fd' : 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                  transition: 'all 0.15s',
                }}
              >
                {ap}
              </button>
            ))}
          </div>

          {/* Done button */}
          <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                padding: '3px 10px',
                background: 'var(--accent-gold)',
                border: 'none',
                borderRadius: 5,
                color: '#0D0F14',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

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

'use client'

import { useState, useEffect } from 'react'
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
      }
    } catch {}
    setAdding(false)
  }

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

      {/* Add Event Form */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        {/* Add button — LEFT */}
        <button
          onClick={addEvent}
          disabled={adding || !formTitle.trim() || !formTime.trim()}
          className="wr-btn-orbit"
        >
          {adding ? '...' : '+ Add'}
        </button>

        {/* Time input */}
        <input
          type="text"
          value={formTime}
          onChange={e => setFormTime(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addEvent()}
          placeholder="9:00 AM"
          style={{
            width: 80,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '6px 8px',
            fontSize: 12,
            color: 'var(--text-primary)',
            outline: 'none',
            fontFamily: 'var(--font-body)',
          }}
        />

        {/* Title input */}
        <input
          type="text"
          value={formTitle}
          onChange={e => setFormTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addEvent()}
          placeholder="Event title"
          style={{
            flex: '1 1 160px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--text-primary)',
            outline: 'none',
            fontFamily: 'var(--font-body)',
          }}
        />

        {/* Location input */}
        <input
          type="text"
          value={formLocation}
          onChange={e => setFormLocation(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addEvent()}
          placeholder="Location (optional)"
          style={{
            flex: '1 1 120px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--text-primary)',
            outline: 'none',
            fontFamily: 'var(--font-body)',
          }}
        />

        {/* Deal dropdown */}
        {deals.length > 0 && (
          <select
            value={formDealId}
            onChange={e => setFormDealId(e.target.value)}
            style={{
              flex: '0 1 160px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '6px 8px',
              fontSize: 12,
              color: formDealId ? 'var(--accent-gold)' : 'var(--text-muted)',
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            <option value="">No deal linked</option>
            {deals.map(d => (
              <option key={d.id} value={d.id}>{d.address || d.name}</option>
            ))}
          </select>
        )}
      </div>

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
        fontSize: 12,
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

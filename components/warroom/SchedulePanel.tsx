'use client'

import { useState } from 'react'

// Schedule is manual entry for now — Outlook sync is Phase 2
// Data model ready for MS Graph API integration later

interface ScheduleEvent {
  id: string
  title: string
  time: string
  location?: string
  dealRef?: string
}

const PLACEHOLDER_EVENTS: ScheduleEvent[] = [
  { id: '1', title: 'Property tour — Government St.', time: '9:00 AM', location: '4950 Government St.' },
  { id: '2', title: 'Client call — Frey Family', time: '11:30 AM' },
  { id: '3', title: 'Lunch + listing pitch', time: '12:00 PM', location: 'Capital City Grill' },
  { id: '4', title: 'PSA review — Worley', time: '3:00 PM' },
]

export default function SchedulePanel() {
  const [events] = useState<ScheduleEvent[]>(PLACEHOLDER_EVENTS)

  const now = new Date()
  const todayLabel = now.toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="wr-card h-full min-h-[240px]">
      <div className="wr-card-header">
        <span style={{ color: 'var(--accent-gold)', display: 'flex' }}>
          <CalIcon />
        </span>
        <span className="wr-card-title">Schedule</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
          Manual · Outlook sync Phase 2
        </span>
      </div>

      <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--text-muted)' }}>
        {todayLabel}
      </div>

      {events.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
          Nothing scheduled today.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map(event => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Phase 2 callout */}
      <div style={{
        marginTop: 16,
        padding: '8px 10px',
        background: 'rgba(201,147,58,0.06)',
        border: '1px solid rgba(201,147,58,0.15)',
        borderRadius: 6,
        fontSize: 11,
        color: 'var(--text-muted)',
      }}>
        📅 Outlook calendar sync — Phase 2. Manual entry active.
      </div>
    </div>
  )
}

function EventRow({ event }: { event: ScheduleEvent }) {
  return (
    <div style={{
      display: 'flex',
      gap: 10,
      padding: '8px 10px',
      background: 'var(--bg-elevated)',
      borderRadius: 6,
      border: '1px solid var(--border-subtle)',
    }}>
      <div style={{
        width: 60,
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--accent-gold)',
        flexShrink: 0,
        paddingTop: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {event.time}
      </div>
      <div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{event.title}</div>
        {event.location && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{event.location}</div>
        )}
      </div>
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

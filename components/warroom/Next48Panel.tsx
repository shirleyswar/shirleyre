'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface ScheduleEvent {
  id: string
  title: string
  time: string | null
  date: string
  location: string | null
  deal_id: string | null
  created_at: string
  isDeadline?: boolean
  deadlineType?: string
}

function todayCST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function tomorrowCST(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function formatTime(time: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

export default function Next48Panel() {
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchEvents() }, [])

  async function fetchEvents() {
    try {
      const today = todayCST()
      const tomorrow = tomorrowCST()
      const { data } = await supabase
        .from('schedule_events')
        .select('*')
        .gte('date', today)
        .lte('date', tomorrow)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(20)
      setEvents((data ?? []) as ScheduleEvent[])
    } catch {}
    finally { setLoading(false) }
  }

  const today = todayCST()
  const tomorrow = tomorrowCST()
  const todayEvents = events.filter(e => e.date === today)
  const tomorrowEvents = events.filter(e => e.date === tomorrow)
  const hasAny = todayEvents.length > 0 || tomorrowEvents.length > 0

  return (
    <div className="wr-card" style={{
      background: 'linear-gradient(160deg, #0d1a2e 0%, #101828 60%, #0a1520 100%)',
      border: '1px solid rgba(79,142,247,0.2)',
      position: 'relative',
      overflow: 'hidden',
      padding: 0,
    }}>
      {/* Atmospheric gradient */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 12, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(79,142,247,0.06) 0%, transparent 70%)',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'rgba(79,142,247,0.7)', display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4F8EF7', fontFamily: 'var(--font-body)' }}>
            Next 48
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-body)' }}>
            {hasAny ? `${events.length} event${events.length !== 1 ? 's' : ''}` : ''}
          </span>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: '20px 24px 24px' }}>
            {[1,2].map(i => (
              <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10, marginBottom: 8 }} />
            ))}
          </div>
        ) : !hasAny ? (
          /* Empty state */
          <div style={{ padding: '32px 24px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: 'rgba(255,255,255,0.08)', letterSpacing: '-0.03em', fontFamily: 'var(--font-body)', lineHeight: 1 }}>
              NONE
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Nothing scheduled today or tomorrow</div>
            <button
              style={{
                marginTop: 4,
                padding: '8px 18px',
                background: 'rgba(79,142,247,0.1)',
                border: '1px solid rgba(79,142,247,0.3)',
                borderRadius: 8,
                color: '#4F8EF7',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
              onClick={() => {/* scroll to schedule panel */}}
            >
              + Add event
            </button>
          </div>
        ) : (
          <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Today group */}
            {todayEvents.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4F8EF7', marginBottom: 10, fontFamily: 'var(--font-body)' }}>
                  Today
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {todayEvents.map((ev, i) => (
                    <EventCard key={ev.id} event={ev} featured={i === 0} />
                  ))}
                </div>
              </div>
            )}
            {/* Tomorrow group */}
            {tomorrowEvents.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 10, fontFamily: 'var(--font-body)' }}>
                  Tomorrow
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tomorrowEvents.map((ev, i) => (
                    <EventCard key={ev.id} event={ev} featured={false} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EventCard({ event, featured }: { event: ScheduleEvent; featured: boolean }) {
  const timeStr = formatTime(event.time)

  return (
    <div style={{
      background: featured
        ? 'linear-gradient(135deg, rgba(79,142,247,0.12) 0%, rgba(79,142,247,0.06) 100%)'
        : 'rgba(255,255,255,0.03)',
      border: `1px solid ${featured ? 'rgba(79,142,247,0.25)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 12,
      padding: featured ? '16px 18px' : '12px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      boxShadow: featured
        ? '0 0 28px rgba(79,142,247,0.12), 0 0 56px rgba(79,142,247,0.05), 0 4px 16px rgba(0,0,0,0.3)'
        : '0 2px 8px rgba(0,0,0,0.15)',
      transition: 'all 0.15s ease',
    }}>
      {/* Left: calendar icon */}
      <div style={{
        width: featured ? 40 : 32,
        height: featured ? 40 : 32,
        borderRadius: 10,
        background: featured ? 'rgba(79,142,247,0.2)' : 'rgba(79,142,247,0.1)',
        border: '1px solid rgba(79,142,247,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: '#4F8EF7',
      }}>
        <svg width={featured ? 18 : 14} height={featured ? 18 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>

      {/* Middle: title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: featured ? 17 : 14,
          fontWeight: featured ? 700 : 600,
          color: '#F0F2FF',
          lineHeight: 1.3,
          marginBottom: 4,
          fontFamily: 'var(--font-body)',
        }}>
          {event.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {timeStr && (
            <span style={{ fontSize: 12, color: featured ? 'rgba(79,142,247,0.85)' : 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
              {timeStr}
            </span>
          )}
          {event.location && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-body)' }}>
              · {event.location}
            </span>
          )}
        </div>
      </div>

      {/* Right: time pill for featured */}
      {featured && timeStr && (
        <div style={{
          padding: '4px 10px',
          background: 'rgba(79,142,247,0.15)',
          border: '1px solid rgba(79,142,247,0.3)',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700,
          color: '#4F8EF7',
          flexShrink: 0,
          fontFamily: 'var(--font-body)',
          whiteSpace: 'nowrap',
        }}>
          {timeStr}
        </div>
      )}
    </div>
  )
}

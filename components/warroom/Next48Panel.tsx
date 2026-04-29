'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { rawTo24h, formatEventTime, sortEventsByTime } from '@/lib/scheduleUtils'
import SectionHeader from '@/components/warroom/SectionHeader'

// ─── TIME PICKER — 15-minute intervals, 12-hour format ───────────────────────
// Replaces the native <input type="time"> which shows every minute
const TIME_OPTIONS: { label: string; value: string }[] = (() => {
  const opts: { label: string; value: string }[] = [{ label: 'No time', value: '' }]
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      const period = h >= 12 ? 'PM' : 'AM'
      const hour12 = h % 12 || 12
      const label = `${hour12}:${String(m).padStart(2, '0')} ${period}`
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      opts.push({ label, value })
    }
  }
  return opts
})()

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const selected = TIME_OPTIONS.find(o => o.value === value) ?? TIME_OPTIONS[0]

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'rgba(79,142,247,0.5)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: 8,
          padding: '10px 12px',
          fontSize: 13,
          color: value ? '#F2EDE4' : 'rgba(255,255,255,0.3)',
          outline: 'none',
          fontFamily: 'var(--font-body)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          textAlign: 'left',
        }}
      >
        <span>{selected.label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          bottom: '110%',
          left: 0, right: 0,
          background: '#1A1735',
          border: '1px solid rgba(79,142,247,0.3)',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          zIndex: 9999,
          maxHeight: 220,
          overflowY: 'auto',
          scrollbarWidth: 'thin' as React.CSSProperties['scrollbarWidth'],
        }}>
          {TIME_OPTIONS.map(opt => (
            <div
              key={opt.value || '__none'}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              style={{
                padding: '9px 14px',
                fontSize: 13,
                color: opt.value === value ? '#4F8EF7' : opt.value ? '#F2EDE4' : 'rgba(255,255,255,0.3)',
                background: opt.value === value ? 'rgba(79,142,247,0.12)' : 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontWeight: opt.value === value ? 700 : 400,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(79,142,247,0.08)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = opt.value === value ? 'rgba(79,142,247,0.12)' : 'transparent' }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// sortByTime is now sortEventsByTime from @/lib/scheduleUtils — imported above

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

interface ContractDeadlineEvent {
  id: string
  deal_id: string | null
  deadline_type: string
  deadline_date: string // YYYY-MM-DD
  status: string
  notes: string | null
  deal_name?: string // fetched from deals table
}

function todayCST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function tomorrowCST(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

// formatTime is now formatEventTime from @/lib/scheduleUtils — imported above

export default function Next48Panel() {
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [deadlines48, setDeadlines48] = useState<ContractDeadlineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editEvent, setEditEvent] = useState<ScheduleEvent | null>(null)
  // mounted guard — portals need document to exist (Next.js static export hydration)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

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

      const { data: deadlines } = await supabase
        .from('contract_deadlines')
        .select('*, deals(name, address)')
        .gte('deadline_date', today)
        .lte('deadline_date', tomorrow)
        .neq('status', 'satisfied')
        .order('deadline_date', { ascending: true })
      setDeadlines48((deadlines ?? []) as ContractDeadlineEvent[])
    } catch {}
    finally { setLoading(false) }
  }

  const today = todayCST()
  const tomorrow = tomorrowCST()

  // Burn off today's events that have already passed (compare against current CST time)
  function isEventExpired(ev: ScheduleEvent): boolean {
    if (!ev.time) return false // no-time events never auto-burn
    const h24 = rawTo24h(ev.time)
    const parts = h24.split(':')
    const h = parseInt(parts[0] ?? '0', 10)
    const m = parseInt(parts[1] ?? '0', 10)
    if (isNaN(h) || isNaN(m)) return false
    const now = new Date()
    const nowCST = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
    const nowMinutes = nowCST.getHours() * 60 + nowCST.getMinutes()
    const evMinutes = h * 60 + m
    return evMinutes < nowMinutes // strictly in the past
  }

  const todayEvents = sortEventsByTime(events.filter(e => e.date === today && !isEventExpired(e)))
  const tomorrowEvents = sortEventsByTime(events.filter(e => e.date === tomorrow))
  const todayDeadlines = deadlines48.filter(d => d.deadline_date === today)
  const tomorrowDeadlines = deadlines48.filter(d => d.deadline_date === tomorrow)

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
        <SectionHeader
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          label="Next 48"
          color="#4F8EF7"
        />

        {/* Content */}
        {loading ? (
          <div style={{ padding: '20px 24px 24px' }}>
            {[1,2].map(i => (
              <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10, marginBottom: 8 }} />
            ))}
          </div>
        ) : (
          <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* TODAY group — always rendered */}
            <div style={{ marginBottom: (tomorrowEvents.length > 0 || tomorrowDeadlines.length > 0) ? 20 : 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4F8EF7', marginBottom: 10, fontFamily: 'var(--font-body)' }}>
                Today
              </div>
              {(todayEvents.length > 0 || todayDeadlines.length > 0) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {todayEvents.map((ev, i) => (
                    <EventCard key={ev.id} event={ev} featured={i === 0} onEdit={() => setEditEvent(ev)} />
                  ))}
                  {todayDeadlines.map(dl => <DeadlineRow key={dl.id} deadline={dl} />)}
                </div>
              ) : (
                /* Empty state for TODAY — always rendered, never skipped */
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.22)', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>
                    None
                  </span>
                  <button
                    style={{
                      padding: '5px 13px',
                      background: 'rgba(79,142,247,0.08)',
                      border: '1px solid rgba(79,142,247,0.25)',
                      borderRadius: 7,
                      color: 'rgba(79,142,247,0.7)',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.02em',
                    }}
                    onClick={() => setShowAddModal(true)}
                  >
                    + Add Event
                  </button>
                </div>
              )}
            </div>
            {/* TOMORROW group — only when events or deadlines exist */}
            {(tomorrowEvents.length > 0 || tomorrowDeadlines.length > 0) && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 10, fontFamily: 'var(--font-body)' }}>
                  Tomorrow
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tomorrowEvents.map((ev, i) => (
                    <EventCard key={ev.id} event={ev} featured={false} onEdit={() => setEditEvent(ev)} />
                  ))}
                  {tomorrowDeadlines.map(dl => <DeadlineRow key={dl.id} deadline={dl} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {editEvent && mounted && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '80px 16px 24px' }}
          onClick={e => { if (e.target === e.currentTarget) setEditEvent(null) }}
        >
          <EditEventModal
            event={editEvent}
            onSave={async (updates) => {
              try {
                await supabase.from('schedule_events').update({
                  title: updates.title,
                  date: updates.date,
                  time: updates.time || null,
                  location: updates.location || null,
                }).eq('id', editEvent.id)
                await fetchEvents()
              } catch {}
              setEditEvent(null)
            }}
            onDelete={async () => {
              try {
                await supabase.from('schedule_events').delete().eq('id', editEvent.id)
                await fetchEvents()
              } catch {}
              setEditEvent(null)
            }}
            onClose={() => setEditEvent(null)}
          />
        </div>,
        document.body
      )}
      {showAddModal && mounted && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '80px 16px 24px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false) }}
        >
          <AddEventModal
            defaultDate={todayCST()}
            onSave={async (ev) => {
              try {
                await supabase.from('schedule_events').insert({
                  title: ev.title,
                  date: ev.date,
                  time: ev.time || null,
                  location: ev.location || null,
                })
                await fetchEvents()
              } catch {}
              setShowAddModal(false)
            }}
            onClose={() => setShowAddModal(false)}
          />
        </div>,
        document.body
      )}
    </div>
  )
}

function DeadlineHeroCard({ deadline }: { deadline: ContractDeadlineEvent }) {
  const daysOut = (() => {
    const now = new Date()
    now.setHours(0,0,0,0)
    const target = new Date(deadline.deadline_date + 'T00:00:00')
    return Math.floor((target.getTime() - now.getTime()) / 86400000)
  })()

  const typeColors: Record<string, { color: string; glow: string }> = {
    closing:            { color: '#fbbf24', glow: 'rgba(251,191,36,0.25)' },
    contingency:        { color: '#ef4444', glow: 'rgba(239,68,68,0.25)' },
    inspection:         { color: '#fb923c', glow: 'rgba(251,146,60,0.25)' },
    financing:          { color: '#4F8EF7', glow: 'rgba(79,142,247,0.25)' },
    appraisal:          { color: '#a78bfa', glow: 'rgba(167,139,250,0.25)' },
    title:              { color: '#2dd4bf', glow: 'rgba(45,212,191,0.25)' },
    survey:             { color: '#9ca3af', glow: 'rgba(156,163,175,0.2)'  },
    psa_review:         { color: '#a78bfa', glow: 'rgba(167,139,250,0.25)' },
    lease_review:       { color: '#60a5fa', glow: 'rgba(96,165,250,0.25)'  },
    psa_draft:          { color: '#c4b5fd', glow: 'rgba(196,181,253,0.2)'  },
    lease_draft:        { color: '#93c5fd', glow: 'rgba(147,197,253,0.2)'  },
    lease_execution:    { color: '#2dd4bf', glow: 'rgba(45,212,191,0.25)'  },
    lease_deliverables: { color: '#22c55e', glow: 'rgba(34,197,94,0.25)'   },
    custom:             { color: '#6b7280', glow: 'rgba(107,114,128,0.2)'  },
  }
  const tc = typeColors[deadline.deadline_type] ?? { color: '#fbbf24', glow: 'rgba(251,191,36,0.2)' }
  const typeLabel = deadline.deadline_type.replace(/_/g, ' ').toUpperCase()
  const dealDisplay = (deadline as any).deals?.address || (deadline as any).deals?.name || 'Deal'
  const [y, m, d] = deadline.deadline_date.split('-').map(Number)
  const dateDisplay = new Date(y, m-1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 100%)',
      border: `1px solid ${tc.color}55`,
      borderLeft: `3px solid ${tc.color}`,
      borderRadius: 12,
      padding: '14px 16px',
      marginBottom: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      boxShadow: `0 0 28px ${tc.glow}, 0 0 56px ${tc.glow.replace('0.25', '0.1')}, 0 4px 16px rgba(0,0,0,0.3)`,
    }}>
      {/* Day counter badge */}
      <div style={{
        flexShrink: 0,
        background: `${tc.color}20`,
        border: `1px solid ${tc.color}60`,
        borderRadius: 8,
        padding: '6px 10px',
        textAlign: 'center',
        minWidth: 64,
      }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: tc.color, lineHeight: 1, fontFamily: 'var(--font-body)' }}>
          {daysOut === 0 ? '!' : daysOut}
        </div>
        <div style={{ fontSize: 8, fontWeight: 700, color: tc.color, letterSpacing: '0.1em', opacity: 0.8, marginTop: 2 }}>
          {daysOut === 0 ? 'TODAY' : daysOut === 1 ? 'DAY OUT' : 'DAYS OUT'}
        </div>
      </div>
      {/* Center: type + deal */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: tc.color, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-body)' }}>
          {typeLabel}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2FF', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {dealDisplay}
        </div>
      </div>
      {/* Right: date */}
      <div style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: `${tc.color}cc`, fontFamily: 'var(--font-body)' }}>
        {dateDisplay}
      </div>
    </div>
  )
}

function DeadlineRow({ deadline }: { deadline: ContractDeadlineEvent }) {
  const typeColors: Record<string, { color: string; bg: string }> = {
    closing:            { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
    contingency:        { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    inspection:         { color: '#fb923c', bg: 'rgba(251,146,60,0.15)' },
    financing:          { color: '#4F8EF7', bg: 'rgba(79,142,247,0.15)' },
    appraisal:          { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
    title:              { color: '#2dd4bf', bg: 'rgba(45,212,191,0.15)' },
    survey:             { color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
    psa_review:         { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
    lease_review:       { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
    psa_draft:          { color: '#c4b5fd', bg: 'rgba(196,181,253,0.15)' },
    lease_draft:        { color: '#93c5fd', bg: 'rgba(147,197,253,0.15)' },
    lease_execution:    { color: '#2dd4bf', bg: 'rgba(45,212,191,0.15)' },
    lease_deliverables: { color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
    custom:             { color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
  }
  const tc = typeColors[deadline.deadline_type] ?? { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' }
  const typeLabel = deadline.deadline_type.replace(/_/g, ' ').toUpperCase()
  const dealDisplay = (deadline as any).deals?.address || (deadline as any).deals?.name || 'Deadline'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${tc.color}44`,
      borderLeft: `3px solid ${tc.color}`,
      borderRadius: 12,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: tc.bg, border: `1px solid ${tc.color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, color: tc.color,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: '#F0F2FF', lineHeight: 1.3,
          fontFamily: 'var(--font-body)', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {dealDisplay}
        </div>
      </div>
      <div style={{
        padding: '4px 10px', background: tc.bg, border: `1px solid ${tc.color}55`,
        borderRadius: 8, fontSize: 11, fontWeight: 700, color: tc.color,
        flexShrink: 0, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
        letterSpacing: '0.05em',
      }}>
        {typeLabel}
      </div>
    </div>
  )
}

// ─── EventCard ────────────────────────────────────────────────────────────────
// Layout: [icon] [time — fixed-width, right-aligned] [title — fills remaining]
// Time leads immediately after the icon so the eye scans: icon → time → title.
// Status/deadline badges stay right-aligned via existing DeadlineRow component.
// Single-line rows — no two-line stacking.
function EventCard({ event, featured, onEdit }: { event: ScheduleEvent; featured: boolean; onEdit: () => void }) {
  const timeStr = formatEventTime(event.time)

  return (
    <div
      onClick={onEdit}
      style={{
        background: featured
          ? 'linear-gradient(135deg, rgba(79,142,247,0.12) 0%, rgba(79,142,247,0.06) 100%)'
          : 'rgba(255,255,255,0.03)',
        border: `1px solid ${featured ? 'rgba(79,142,247,0.25)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 12,
        padding: featured ? '14px 16px' : '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: featured
          ? '0 0 28px rgba(79,142,247,0.12), 0 0 56px rgba(79,142,247,0.05), 0 4px 16px rgba(0,0,0,0.3)'
          : '0 2px 8px rgba(0,0,0,0.15)',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
        minHeight: featured ? 52 : 44,
      }}
    >
      {/* 1 — Calendar icon (fixed, left) */}
      <div style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: 'rgba(79,142,247,0.1)',
        border: '1px solid rgba(79,142,247,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: '#4F8EF7',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>

      {/* 2 — Time column: fixed width, right-aligned so colons stack */}
      <div style={{
        width: 68,           // desktop — enough for "12:00 PM"
        flexShrink: 0,
        textAlign: 'right',
        fontSize: featured ? 13 : 12,
        fontWeight: 700,
        color: featured ? '#4F8EF7' : 'rgba(79,142,247,0.8)',
        fontFamily: 'var(--font-body)',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
      }}>
        {timeStr || <span style={{ opacity: 0.25 }}>—</span>}
      </div>

      {/* 3 — Title (fills remaining width, single line) */}
      <div style={{
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: featured ? 15 : 14,
        fontWeight: featured ? 700 : 500,
        color: '#F0F2FF',
        fontFamily: 'var(--font-body)',
      }}>
        {event.title}
        {event.location && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', fontWeight: 400, marginLeft: 8 }}>
            {event.location}
          </span>
        )}
      </div>
    </div>
  )
}

function EditEventModal({ event, onSave, onDelete, onClose }: {
  event: ScheduleEvent
  onSave: (updates: { title: string; date: string; time: string; location: string }) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState(event.title)
  const [date, setDate] = useState(event.date)
  const [time, setTime] = useState(() => {
    if (!event.time) return ''
    let t = event.time
    if (t.includes('T')) t = t.split('T')[1] ?? ''
    // Normalize to HH:MM for the time input
    const parts = t.split(':')
    const h = (parts[0] ?? '').padStart(2, '0')
    const m = (parts[1] ?? '00').padStart(2, '0')
    return `${h}:${m}`
  })
  const [location, setLocation] = useState(event.location ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    await onSave({ title: title.trim(), date, time, location })
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }

  return (
    <div style={{ background: '#13112A', border: '1px solid rgba(79,142,247,0.35)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(79,142,247,0.6)', fontFamily: 'var(--font-body)' }}>
          Edit Event
        </div>
        {!confirmDelete && (
          <button onClick={() => setConfirmDelete(true)}
            style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, color: 'rgba(239,68,68,0.6)', fontSize: 11, padding: '3px 9px', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            Delete
          </button>
        )}
      </div>
      {confirmDelete ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>Delete <strong style={{ color: '#F0F2FF' }}>{event.title}</strong>? This can't be undone.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#6B7280', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
            <button onClick={handleDelete} disabled={deleting}
              style={{ flex: 1, padding: '10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              {deleting ? 'Deleting…' : 'Yes, Delete'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && title.trim()) handleSave(); if (e.key === 'Escape') onClose() }}
            placeholder="Event title *"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)' }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)', colorScheme: 'dark' as React.CSSProperties['colorScheme'] }} />
            <TimeSelect value={time} onChange={setTime} />
          </div>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)}
            placeholder="Location (optional)"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#6B7280', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !title.trim()}
              style={{ flex: 2, padding: '11px', background: saving || !title.trim() ? 'rgba(79,142,247,0.1)' : 'rgba(79,142,247,0.2)', border: '1px solid rgba(79,142,247,0.5)', borderRadius: 8, color: '#4F8EF7', fontSize: 14, fontWeight: 700, cursor: saving || !title.trim() ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', opacity: saving || !title.trim() ? 0.5 : 1 }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function AddEventModal({ defaultDate, onSave, onClose }: {
  defaultDate: string
  onSave: (ev: { title: string; date: string; time: string; location: string }) => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    await onSave({ title: title.trim(), date, time, location })
    setSaving(false)
  }

  return (
    <div style={{ background: '#13112A', border: '1px solid rgba(79,142,247,0.35)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(79,142,247,0.6)', fontFamily: 'var(--font-body)' }}>
        Add Event
      </div>
      <input autoFocus type="text" value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && title.trim()) handleSave(); if (e.key === 'Escape') onClose() }}
        placeholder="Event title *"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)' }} />
      <div style={{ display: 'flex', gap: 10 }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)', colorScheme: 'dark' as React.CSSProperties['colorScheme'] }} />
        <TimeSelect value={time} onChange={setTime} />
      </div>
      <input type="text" value={location} onChange={e => setLocation(e.target.value)}
        placeholder="Location (optional)"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#6B7280', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
        <button onClick={handleSave} disabled={saving || !title.trim()}
          style={{ flex: 2, padding: '11px', background: saving || !title.trim() ? 'rgba(79,142,247,0.1)' : 'rgba(79,142,247,0.2)', border: '1px solid rgba(79,142,247,0.5)', borderRadius: 8, color: '#4F8EF7', fontSize: 14, fontWeight: 700, cursor: saving || !title.trim() ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', opacity: saving || !title.trim() ? 0.5 : 1 }}>
          {saving ? 'Saving...' : 'Add Event'}
        </button>
      </div>
    </div>
  )
}

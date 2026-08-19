'use client'

// Deadlines bottom sheet — §12 step 7
// CLASS A FIX (2026-08-10): past-due deadlines pinned at top, red, never auto-expire.
//
// Query — NEW predicate (replaces forward-only window):
//   PAST-DUE:  status IN ('pending','extended') AND deadline_date < today
//   FORWARD:   status IN ('pending','extended') AND deadline_date >= today AND deadline_date <= today+45
//   MISSED:    status = 'missed' — always loaded, sorted below live past-due
//   (satisfied is excluded from all groups)
//
// OLD predicate (retired):
//   deadline_date >= today AND deadline_date <= today+45 AND status != 'satisfied'
//
// Sort order (per directive Part 4):
//   1. past-due pending — oldest deadline_date first
//   2. forward pending — deadline_date ASC
//   3. missed — deadline_date DESC (most recent first)
//
// Color spec (Part 2 — gray-for-past-due RETIRED):
//   past-due pending  → red #FF4D4D + "PAST DUE" label
//   0–1 days          → red #FF4D4D
//   2–7 days          → orange #FFA23A
//   8–30 days         → brand #8B5CF6
//   >30 days          → brand #8B5CF6
//   missed            → gray #5C5B6B + strikethrough
//
// Hero card priority (Part 3): oldest past-due beats any forward deadline.
//
// Status controls (Part 4):
//   satisfied  → row disappears (existing behavior, unchanged)
//   extended   → original row → status=extended, insert new row (prompt for date), no data write during testing
//   missed     → row stays, gray+strikethrough, optional note — no data write during testing
//   (all writes blocked with TEST_MODE_NO_WRITE guard)

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import BottomSheet from '@/components/warroom3/BottomSheet'
import { formatAddress } from '@/lib/formatAddress'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  bgRaise:   '#1E1D26',
  textHi:    '#EFEEF4',
  textMid:   '#B8B6C6',
  textLow:   '#8E8CA0',
  late:      '#FF4D4D',   // past-due + 0–1 day
  hot:       '#FFA23A',   // 2–7 days
  brand:     '#8B5CF6',   // 8+ days
  missed:    '#8E8CA0',   // acknowledged blown
} as const

// 44a type scale: T1=12px, T2=12px/0.15em, T3=18px, T4=14px
const styleT1: React.CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500,
  letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textMid, lineHeight: 1,
}
const styleT2: React.CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500,
  letterSpacing: '0.15em', textTransform: 'uppercase', lineHeight: 1,
}
const styleT3: React.CSSProperties = {
  fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 500, color: T.textHi, lineHeight: 1.25,
}
const styleT4: React.CSSProperties = {
  fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 400, color: T.textMid, lineHeight: 1.5,
}

function todayCST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.floor((target.getTime() - now.getTime()) / 86400000)
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const DEADLINE_LABELS: Record<string, string> = {
  inspection: 'Inspection', financing: 'Financing', appraisal: 'Appraisal',
  title: 'Title', survey: 'Survey', closing: 'Closing', custom: 'Custom',
  contingency: 'Contingency', psa_review: 'PSA Review', lease_review: 'Lease Review',
  psa_draft: 'PSA Draft', lease_draft: 'Lease Draft',
  lease_execution: 'Lease Execution', lease_deliverables: 'Lease Deliverables',
}

// Part 2: accent color for a row
function accentFor(days: number, status: string): string {
  if (status === 'missed') return T.missed
  if (days < 0) return T.late    // past-due: red (gray retired)
  if (days <= 1) return T.late
  if (days <= 7) return T.hot
  return T.brand
}

interface DeadlineRow {
  id: string
  label: string | null
  deadline_date: string
  deadline_type: string
  status: string
  notes: string | null
  deal_id: string | null
  dealLabel: string
  // computed
  days: number        // negative = past-due
  group: 'pastdue' | 'forward' | 'missed'
}

// ── Status action modal ────────────────────────────────────────────────────────
// Part 4: present satisfied / extended / missed controls per row.
// DATA WRITE IS BLOCKED (TEST_MODE_NO_WRITE). Prompts work visually but no Supabase write.
function StatusModal({
  row,
  onClose,
  onStatusChange,
}: {
  row: DeadlineRow
  onClose: () => void
  onStatusChange: (id: string, newStatus: string, meta?: { note?: string; newDate?: string }) => void
}) {
  const [newDate, setNewDate] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState<string | null>(null)

  const apply = useCallback((action: string) => {
    setPending(action)
    // TEST_MODE_NO_WRITE: all writes are deferred — no Supabase call here.
    // Production: remove this guard and implement the writes described in Part 4 comments.
    setTimeout(() => {
      if (action === 'satisfied') {
        onStatusChange(row.id, 'satisfied')
      } else if (action === 'extended') {
        if (!newDate) return
        onStatusChange(row.id, 'extended', { newDate })
      } else if (action === 'missed') {
        onStatusChange(row.id, 'missed', { note: note || undefined })
      }
      setPending(null)
      onClose()
    }, 0)
  }, [row.id, newDate, note, onStatusChange, onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.bgRaise,
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '16px 16px 0 0',
          padding: '20px 18px 36px',
          width: '100%', maxWidth: 480,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        {/* Header */}
        <div style={{ ...styleT1, marginBottom: 2 }}>Update Deadline</div>
        <div style={{ ...styleT3, fontSize: 13 }}>{row.label || DEADLINE_LABELS[row.deadline_type] || row.deadline_type}</div>
        <div style={{ ...styleT4, fontSize: 11 }}>{row.dealLabel} · {formatDateShort(row.deadline_date)}</div>

        {/* satisfied */}
        <button
          onClick={() => apply('satisfied')}
          disabled={pending !== null}
          style={{
            padding: '13px 16px', borderRadius: 10,
            background: 'rgba(52,211,153,0.08)',
            border: '1px solid rgba(52,211,153,0.25)',
            color: '#34D399', fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          ✓ Mark satisfied — removes from sheet
        </button>

        {/* extended */}
        <div style={{
          padding: '13px 16px', borderRadius: 10,
          background: 'rgba(139,92,246,0.06)',
          border: '1px solid rgba(139,92,246,0.20)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ color: T.brand, fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 600 }}>
            ↩ Mark extended — set new date
          </div>
          <input
            type="date"
            value={newDate}
            min={todayCST()}
            onChange={e => setNewDate(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, padding: '8px 10px',
              color: T.textHi, fontFamily: FONT_DISPLAY, fontSize: 16,  // iOS 16px floor
              outline: 'none', width: '100%',
            }}
          />
          <div style={{ fontSize: 10, color: T.textLow, fontFamily: FONT_MONO }}>
            Original row → status=extended · New row inserted with new date · notes reference amendment
          </div>
          <button
            onClick={() => apply('extended')}
            disabled={!newDate || pending !== null}
            style={{
              padding: '10px', borderRadius: 8,
              background: newDate ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${newDate ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.14)'}`,
              color: newDate ? '#A78BFA' : T.textLow,
              fontFamily: FONT_DISPLAY, fontSize: 12, fontWeight: 600,
              cursor: newDate ? 'pointer' : 'not-allowed',
            }}
          >
            Apply extension
          </button>
        </div>

        {/* missed */}
        <div style={{
          padding: '13px 16px', borderRadius: 10,
          background: 'rgba(255,77,77,0.04)',
          border: '1px solid rgba(255,77,77,0.15)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ color: T.late, fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 600 }}>
            ✕ Mark missed — stays visible, stops escalating
          </div>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Note (optional) — e.g. 'waived per Amendment II'"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 8, padding: '8px 10px',
              color: T.textHi, fontFamily: FONT_DISPLAY, fontSize: 16,  // iOS 16px floor
              outline: 'none', width: '100%',
            }}
          />
          <button
            onClick={() => apply('missed')}
            disabled={pending !== null}
            style={{
              padding: '10px', borderRadius: 8,
              background: 'rgba(255,77,77,0.12)',
              border: '1px solid rgba(255,77,77,0.25)',
              color: T.late, fontFamily: FONT_DISPLAY, fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Confirm missed
          </button>
        </div>

        {/* cancel */}
        <button
          onClick={onClose}
          style={{
            padding: '11px', borderRadius: 10,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.14)',
            color: T.textMid, fontFamily: FONT_DISPLAY, fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>

        {/* TEST MODE notice */}
        <div style={{ fontSize: 9, color: T.textLow, fontFamily: FONT_MONO, textAlign: 'center', letterSpacing: '0.08em' }}>
          TEST MODE — no writes to live data · production promotion not granted
        </div>
      </div>
    </div>
  )
}

// ── Individual deadline row ────────────────────────────────────────────────────
function DeadlineRowCard({
  row,
  onStatusAction,
}: {
  row: DeadlineRow
  onStatusAction: (row: DeadlineRow) => void
}) {
  const accent = accentFor(row.days, row.status)
  const isMissed = row.status === 'missed'
  const isPastDue = row.group === 'pastdue'

  const typeLabel = DEADLINE_LABELS[row.deadline_type] ?? row.deadline_type?.replace(/_/g, ' ') ?? 'Deadline'

  // Days label
  const absDays = Math.abs(row.days)
  let daysLabel: string
  if (isMissed) {
    daysLabel = row.days < 0 ? `${absDays}d past` : row.days === 0 ? 'Today' : `${row.days}d`
  } else if (isPastDue) {
    daysLabel = absDays === 1 ? '1 day ago' : `${absDays} days ago`
  } else if (row.days === 0) {
    daysLabel = 'Today'
  } else {
    daysLabel = `${row.days} day${row.days === 1 ? '' : 's'}`
  }

  const rowBg = isMissed
    ? 'rgba(255,255,255,0.01)'
    : isPastDue
    ? 'rgba(255,77,77,0.06)'     // stronger red tint for past-due
    : row.days <= 1
    ? 'rgba(255,77,77,0.04)'
    : row.days <= 7
    ? 'rgba(255,162,58,0.04)'
    : 'rgba(255,255,255,0.02)'

  return (
    <div
      style={{
        position: 'relative',
        padding: '12px 14px 12px 17px',
        borderRadius: 12,
        background: rowBg,
        border: `1px solid ${isMissed ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)'}`,
        borderLeft: `3px solid ${accent}`,
        opacity: isMissed ? 0.65 : 1,
      }}
    >
      {/* PAST DUE badge (Part 2 — replaces gray, adds persistent label) */}
      {isPastDue && !isMissed && (
        <div style={{
          position: 'absolute', top: 10, right: 12,
          background: 'rgba(255,77,77,0.15)',
          border: '1px solid rgba(255,77,77,0.35)',
          borderRadius: 5,
          padding: '2px 7px',
          fontFamily: FONT_MONO, fontSize: 8.5, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: T.late,
        }}>
          PAST DUE
        </div>
      )}

      {/* Row 1: type label + days */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
        <span style={{ ...styleT2, fontSize: 9, color: accent }}>{typeLabel}</span>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 9, fontWeight: 600,
          color: accent, letterSpacing: '0.04em',
          marginRight: isPastDue ? 70 : 0,  // clear the PAST DUE badge
        }}>
          {daysLabel}
        </span>
      </div>

      {/* Row 2: label + date */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          ...styleT3, fontSize: 13,
          textDecoration: isMissed ? 'line-through' : 'none',
          color: isMissed ? T.textMid : T.textHi,
        }}>
          {row.label || typeLabel}
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.textLow, flexShrink: 0, marginTop: 2 }}>
          {formatDateShort(row.deadline_date)}
        </span>
      </div>

      {/* Row 3: deal label */}
      {row.dealLabel ? (
        <div style={{ ...styleT4, fontSize: 11, marginTop: 3 }}>{row.dealLabel}</div>
      ) : null}

      {/* Row 4: note (missed rows) */}
      {isMissed && row.notes ? (
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 10.5, color: T.textLow, marginTop: 4, fontStyle: 'italic' }}>
          {row.notes}
        </div>
      ) : null}

      {/* Status action button — all non-missed non-satisfied rows */}
      {!isMissed && (
        <button
          onClick={() => onStatusAction(row)}
          style={{
            marginTop: 10,
            padding: '5px 10px',
            borderRadius: 7,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.18)',
            color: T.textMid,
            fontFamily: FONT_MONO, fontSize: 9, fontWeight: 500,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Update status →
        </button>
      )}
    </div>
  )
}

// ── Section divider ────────────────────────────────────────────────────────────
function SectionDivider({ label, color }: { label: string; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      margin: '4px 0 2px',
    }}>
      <span style={{
        fontFamily: FONT_MONO, fontSize: 8.5, fontWeight: 700,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color,
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: `${color}33` }} />
    </div>
  )
}

// ── Main sheet ────────────────────────────────────────────────────────────────
export default function DeadlinesSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [rows, setRows] = useState<DeadlineRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [modalRow, setModalRow] = useState<DeadlineRow | null>(null)

  useEffect(() => {
    if (open && !loaded) load()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    setLoadError(false)
    try {
      const today = todayCST()
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() + 45)
      const cutoffStr = cutoff.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

      // NEW predicate: three separate groups (no status='satisfied' in any group)
      // 1. past-due pending/extended
      // 2. forward pending/extended (45-day window)
      // 3. missed (always shown, sorted below)
      const [pastDueRes, forwardRes, missedRes] = await Promise.all([
        supabase
          .from('contract_deadlines')
          .select('id, label, deadline_date, deadline_type, status, notes, deal_id')
          .in('status', ['pending', 'extended'])
          .lt('deadline_date', today)
          .order('deadline_date', { ascending: true })   // oldest first
          .limit(60),
        supabase
          .from('contract_deadlines')
          .select('id, label, deadline_date, deadline_type, status, notes, deal_id')
          .in('status', ['pending', 'extended'])
          .gte('deadline_date', today)
          .lte('deadline_date', cutoffStr)
          .order('deadline_date', { ascending: true })
          .limit(60),
        supabase
          .from('contract_deadlines')
          .select('id, label, deadline_date, deadline_type, status, notes, deal_id')
          .eq('status', 'missed')
          .order('deadline_date', { ascending: false })  // most recent first
          .limit(30),
      ])

      if (pastDueRes.error || forwardRes.error || missedRes.error) {
        console.error('[DeadlinesSheet] load error', pastDueRes.error, forwardRes.error, missedRes.error)
        setLoadError(true)
        setLoading(false)
        return
      }

      const allRaw = [
        ...((pastDueRes.data || []) as any[]).map(d => ({ ...d, group: 'pastdue' as const })),
        ...((forwardRes.data || []) as any[]).map(d => ({ ...d, group: 'forward' as const })),
        ...((missedRes.data || []) as any[]).map(d => ({ ...d, group: 'missed' as const })),
      ]

      // Resolve deal labels
      const dealIds = Array.from(new Set(allRaw.map(d => d.deal_id).filter(Boolean)))
      let dealMap: Record<string, string> = {}
      if (dealIds.length > 0) {
        const { data: dealData } = await supabase
          .from('deals')
          .select('id, name, address, addr_display, addr_street_name, addr_number, addr_city')
          .in('id', dealIds)
        if (dealData) {
          (dealData as any[]).forEach((d: any) => {
            dealMap[d.id] = formatAddress(d) || d.name || ''
          })
        }
      }

      setRows(allRaw.map(d => ({
        id: d.id,
        label: d.label,
        deadline_date: d.deadline_date,
        deadline_type: d.deadline_type,
        status: d.status,
        notes: d.notes,
        deal_id: d.deal_id,
        dealLabel: d.deal_id ? (dealMap[d.deal_id] || '') : '',
        days: daysUntil(d.deadline_date),
        group: d.group,
      })))
      setLoaded(true)
    } catch (e) {
      console.error('[DeadlinesSheet] unexpected error:', e)
      setLoadError(true)
    }
    setLoading(false)
  }

  // Part 4: local status change (TEST_MODE — no Supabase write)
  const handleStatusChange = useCallback((id: string, newStatus: string, meta?: { note?: string; newDate?: string }) => {
    setRows(prev => {
      if (newStatus === 'satisfied') {
        // Remove row entirely
        return prev.filter(r => r.id !== id)
      }
      if (newStatus === 'extended') {
        // Mark original as extended; insert synthetic forward row with new date
        const original = prev.find(r => r.id === id)
        const updatedOriginal = prev.map(r => r.id === id ? { ...r, status: 'extended', group: 'forward' as const, days: daysUntil(r.deadline_date) } : r)
        if (original && meta?.newDate) {
          const newRow: DeadlineRow = {
            ...original,
            id: `${original.id}-extended-${meta.newDate}`,
            deadline_date: meta.newDate,
            status: 'pending',
            notes: `Extended from ${original.deadline_date}`,
            days: daysUntil(meta.newDate),
            group: daysUntil(meta.newDate) < 0 ? 'pastdue' : 'forward',
          }
          return [...updatedOriginal, newRow].sort((a, b) => {
            if (a.group === b.group) return a.deadline_date.localeCompare(b.deadline_date)
            const order = { pastdue: 0, forward: 1, missed: 2 }
            return order[a.group] - order[b.group]
          })
        }
        return updatedOriginal
      }
      if (newStatus === 'missed') {
        return prev.map(r => r.id === id
          ? { ...r, status: 'missed', group: 'missed' as const, notes: meta?.note || r.notes }
          : r
        ).sort((a, b) => {
          const order = { pastdue: 0, forward: 1, missed: 2 }
          if (a.group !== b.group) return order[a.group] - order[b.group]
          if (a.group === 'missed') return b.deadline_date.localeCompare(a.deadline_date)
          return a.deadline_date.localeCompare(b.deadline_date)
        })
      }
      return prev
    })
  }, [])

  const pastDue = rows.filter(r => r.group === 'pastdue')
  const forward = rows.filter(r => r.group === 'forward')
  const missed  = rows.filter(r => r.group === 'missed')

  // Total count shown in tile: past-due + forward (missed not counted — acknowledged)
  const displayCount = (pastDue.length + forward.length) > 0 ? (pastDue.length + forward.length) : undefined

  return (
    <>
      <BottomSheet open={open} onClose={onClose} label="Deadlines" count={displayCount}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 18px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                height: 80, borderRadius: 12,
                background: 'rgba(255,255,255,0.03)',
                backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.6s ease-in-out infinite',
              }} />
            ))}
          </div>
        ) : loadError ? (
          <div
            onClick={() => { setLoadError(false); setLoaded(false) }}
            style={{ textAlign: 'center', padding: '32px 18px', color: '#FF4D4D', fontFamily: FONT_DISPLAY, fontSize: 13, cursor: 'pointer' }}
          >
            Could not load — tap to retry
          </div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 18px', color: T.textLow, fontFamily: FONT_DISPLAY, fontSize: 13 }}>
            No deadlines in window
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 18px' }}>

            {/* ── PAST DUE section — pinned at top, red (Part 1 + 2 + 3) ── */}
            {pastDue.length > 0 && (
              <>
                <SectionDivider label={`Past Due — ${pastDue.length}`} color={T.late} />
                {pastDue.map(row => (
                  <DeadlineRowCard key={row.id} row={row} onStatusAction={setModalRow} />
                ))}
              </>
            )}

            {/* ── FORWARD section ── */}
            {forward.length > 0 && (
              <>
                {pastDue.length > 0 && (
                  <SectionDivider label="Upcoming — 45 days" color={T.brand} />
                )}
                {forward.map(row => (
                  <DeadlineRowCard key={row.id} row={row} onStatusAction={setModalRow} />
                ))}
              </>
            )}

            {/* ── MISSED section — gray, strikethrough, sorted below (Part 4) ── */}
            {missed.length > 0 && (
              <>
                <SectionDivider label="Missed" color={T.missed} />
                {missed.map(row => (
                  <DeadlineRowCard key={row.id} row={row} onStatusAction={setModalRow} />
                ))}
              </>
            )}

          </div>
        )}

        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      </BottomSheet>

      {/* Part 4: Status modal */}
      {modalRow && (
        <StatusModal
          row={modalRow}
          onClose={() => setModalRow(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </>
  )
}

'use client'

// Deadlines bottom sheet — §12 step 7
// Data: contract_deadlines — exact SchedulePanel predicate:
//   deadline_date >= today, deadline_date <= today+45, status != 'satisfied',
//   ordered deadline_date ASC.

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import BottomSheet from '@/components/warroom3/BottomSheet'
import { formatAddress } from '@/lib/formatAddress'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  bgRaise:   '#16161F',
  textHi:    '#EFEEF4',
  textMid:   '#8B8A9B',
  textLow:   '#5C5B6B',
  late:      '#FF4D4D',
  hot:       '#FFA23A',
  brand:     '#8B5CF6',
  brandLift: '#A78BFA',
} as const

const styleT1: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: T.textMid,
  lineHeight: 1,
}

const styleT2: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9.5,
  fontWeight: 500,
  letterSpacing: '0.19em',
  textTransform: 'uppercase',
  lineHeight: 1,
}

const styleT3: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 14.5,
  fontWeight: 500,
  color: T.textHi,
  lineHeight: 1.25,
}

const styleT4: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 11.5,
  fontWeight: 400,
  color: T.textMid,
  lineHeight: 1.5,
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
    month: 'short', day: 'numeric',
  })
}

// Deadline type labels matching SchedulePanel TYPE_COLORS
const DEADLINE_LABELS: Record<string, string> = {
  inspection: 'Inspection',
  financing: 'Financing',
  appraisal: 'Appraisal',
  title: 'Title',
  survey: 'Survey',
  closing: 'Closing',
  custom: 'Custom',
  contingency: 'Contingency',
  psa_review: 'PSA Review',
  lease_review: 'Lease Review',
  psa_draft: 'PSA Draft',
  lease_draft: 'Lease Draft',
  lease_execution: 'Lease Execution',
  lease_deliverables: 'Lease Deliverables',
}

interface DeadlineRow {
  id: string
  label: string | null
  deadline_date: string
  deadline_type: string
  status: string
  deal_id: string | null
  dealLabel: string
}

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

      const { data, error } = await supabase
        .from('contract_deadlines')
        .select('id, label, deadline_date, deadline_type, status, deal_id')
        .gte('deadline_date', today)
        .lte('deadline_date', cutoffStr)
        .neq('status', 'satisfied')
        .order('deadline_date', { ascending: true })
        .limit(60)

      if (error) {
        console.error('[DeadlinesSheet] load error:', error)
        setLoadError(true)
        setLoading(false)
        return
      }
      if (!data) { setLoading(false); return }

      // Get deal names for context (same as SchedulePanel)
      const dealIds = Array.from(new Set((data as any[]).map((d: any) => d.deal_id).filter(Boolean)))
      let dealMap: Record<string, string> = {}
      if (dealIds.length > 0) {
        const { data: dealData } = await supabase
          .from('deals')
          .select('id, name, address')
          .in('id', dealIds)
        if (dealData) {
          (dealData as any[]).forEach((d: any) => {
            dealMap[d.id] = formatAddress(d.address) || d.name || ''
          })
        }
      }

      setRows((data as any[]).map((d: any) => ({
        id: d.id,
        label: d.label,
        deadline_date: d.deadline_date,
        deadline_type: d.deadline_type,
        status: d.status,
        deal_id: d.deal_id,
        dealLabel: d.deal_id ? (dealMap[d.deal_id] || '') : '',
      })))
      setLoaded(true)
    } catch (e) {
      console.error('[DeadlinesSheet] unexpected error:', e)
      setLoadError(true)
    }
    setLoading(false)
  }

  const overdueCount = rows.filter(r => daysUntil(r.deadline_date) < 0).length
  const hotCount = rows.filter(r => { const d = daysUntil(r.deadline_date); return d >= 0 && d <= 7 }).length
  const displayCount = rows.length > 0 ? rows.length : undefined

  return (
    <BottomSheet open={open} onClose={onClose} label="Deadlines" count={displayCount}>
      {/* Header is rendered by BottomSheet */}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 18px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              height: 64,
              borderRadius: 12,
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
          No upcoming deadlines (45-day window)
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 18px' }}>
          {rows.map(row => {
            const days = daysUntil(row.deadline_date)
            const isOverdue = days < 0
            const isHot = !isOverdue && days <= 7
            const accentColor = isOverdue ? T.late : isHot ? T.hot : T.brand
            const typeLabel = DEADLINE_LABELS[row.deadline_type] ?? row.deadline_type?.replace(/_/g, ' ') ?? 'Deadline'
            const daysLabel = isOverdue
              ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
              : days === 0
              ? 'Today'
              : `${days} day${days === 1 ? '' : 's'}`

            return (
              <div
                key={row.id}
                style={{
                  position: 'relative',
                  padding: '12px 14px 12px 17px',
                  borderRadius: 12,
                  background: isOverdue ? 'rgba(255,77,77,0.04)' : isHot ? 'rgba(255,162,58,0.04)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderLeft: '3px solid ' + accentColor,
                }}
              >
                {/* Row 1: type label + days remaining */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                  <span style={{ ...styleT2, fontSize: 9, color: accentColor }}>{typeLabel}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 600, color: accentColor, letterSpacing: '0.04em' }}>
                    {daysLabel}
                  </span>
                </div>
                {/* Row 2: deadline label + date */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ ...styleT3, fontSize: 13 }}>{row.label || typeLabel}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.textLow, flexShrink: 0, marginTop: 2 }}>
                    {formatDateShort(row.deadline_date)}
                  </span>
                </div>
                {/* Row 3: deal label */}
                {row.dealLabel ? (
                  <div style={{ ...styleT4, fontSize: 11, marginTop: 3 }}>{row.dealLabel}</div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </BottomSheet>
  )
}

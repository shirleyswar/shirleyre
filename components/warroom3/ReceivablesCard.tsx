'use client'

// Receivables — Item 59 re-cut (mobile refresh)
// LEAD FIGURE: billed-not-received in money-in (#34D399)
// Caption on SAME LINE beside it
// Split bar 4px: brand-lift for COLLECTED segment, money-in for OUTSTANDING segment
// FOOTER: collected in brand-lift + deal count mono at far end
// Old layout was reversed (led with collected) — this is the fix.
// Query: ar_items + ar_payments tables (read-only, @/lib/supabase)

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  bgPanel:     '#12111B',
  textHi:      '#EFEEF4',
  textMid:     '#B8B6C6',
  textLow:     '#8E8CA0',
  brand:       '#8B5CF6',
  brandLift:   '#A78BFA',
  moneyIn:     '#34D399',
} as const

// T2 — section header eyebrow
const styleT2: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color: T.textLow,
  lineHeight: 1,
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString('en-US')}`
}

interface ARData {
  collected:   number
  outstanding: number
  dealCount:   number
}

// Verbatim query — reported to Matthew per Class A requirement.
// SELECT ar_items + ar_payments:
//   collected   = sum(ar_payments.amount) per item — paid_to_date intentionally ignored (may be stale)
//   outstanding = sum(max(0, sr_portion_amount - payments_sum)) across ALL items — not filtered by status
async function loadARData(): Promise<ARData> {
  const [itemsRes, paymentsRes] = await Promise.all([
    supabase
      .from('ar_items')
      .select('id, sr_portion_amount, paid_to_date, status')
      .limit(100),
    supabase
      .from('ar_payments')
      .select('ar_item_id, amount')
      .limit(200),
  ])

  if (itemsRes.error)    throw new Error(`ar_items: ${itemsRes.error.message}`)
  if (paymentsRes.error) throw new Error(`ar_payments: ${paymentsRes.error.message}`)

  const items    = (itemsRes.data    ?? []) as any[]
  const payments = (paymentsRes.data ?? []) as any[]

  const paymentsByItem: Record<string, number> = {}
  for (const p of payments) {
    paymentsByItem[p.ar_item_id] = (paymentsByItem[p.ar_item_id] || 0) + (p.amount || 0)
  }

  const collected = items.reduce((sum: number, i: any) =>
    sum + (paymentsByItem[i.id] ?? 0), 0)

  const outstanding = items.reduce((sum: number, i: any) => {
    const ms   = i.sr_portion_amount ?? 0
    const paid = paymentsByItem[i.id] ?? 0
    return sum + Math.max(0, ms - paid)
  }, 0)

  return { collected, outstanding, dealCount: items.length }
}

export default function ReceivablesCard() {
  const [data, setData]       = useState<ARData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  function load() {
    setLoading(true)
    setLoadError(false)
    loadARData()
      .then(d => { setData(d); setLoading(false) })
      .catch((e: unknown) => {
        console.error('[ReceivablesCard] load error:', e)
        setLoadError(true)
        setLoading(false)
      })
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const collected   = data?.collected   ?? 0
  const outstanding = data?.outstanding ?? 0
  const dealCount   = data?.dealCount   ?? 0
  const total       = collected + outstanding
  const pctCollected  = total > 0 ? collected  / total : 0
  const pctOutstanding = total > 0 ? outstanding / total : 0

  return (
    <div>
      {/* Section header — no card wrapper */}
      <div style={{ ...styleT2, marginBottom: 10 }}>Receivables</div>

      {/* LEAD FIGURE: outstanding in money-in, caption on SAME LINE */}
      {loading ? (
        <div style={{
          height: 36, width: '55%', borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.6s ease-in-out infinite',
          marginBottom: 10,
        }} />
      ) : loadError ? (
        <div
          onClick={load}
          style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: '#FF4D4D', marginBottom: 10, cursor: 'pointer' }}
        >
          Could not load — tap to retry
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          marginBottom: 10,
        }}>
          {/* Lead figure: outstanding, money-in */}
          <span style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: T.moneyIn,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>{formatCurrency(outstanding)}</span>
          {/* Caption on same line */}
          <span style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 12,
            fontWeight: 400,
            color: T.textLow,
            lineHeight: 1,
          }}>billed - not received</span>
        </div>
      )}

      {/* Split bar, 4px: brand-lift for COLLECTED, money-in for OUTSTANDING */}
      {!loadError && (
        <div style={{
          display: 'flex',
          height: 4,
          borderRadius: 2,
          overflow: 'hidden',
          marginBottom: 10,
          background: 'rgba(255,255,255,0.08)',
        }}>
          <div style={{
            flex: loading ? 0.5 : pctCollected,
            background: T.brandLift,
            borderRadius: '2px 0 0 2px',
            transition: 'flex 0.6s ease',
          }} />
          <div style={{
            flex: loading ? 0.5 : pctOutstanding,
            background: T.moneyIn,
            borderRadius: '0 2px 2px 0',
            transition: 'flex 0.6s ease',
          }} />
        </div>
      )}

      {/* Footer: collected in brand-lift + deal count mono at far end */}
      {!loadError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 14,
              fontWeight: 600,
              color: T.brandLift,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.01em',
            }}>
              {loading ? '—' : formatCurrency(collected)}
            </span>
            <span style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 11,
              fontWeight: 400,
              color: T.textLow,
              lineHeight: 1,
            }}>collected</span>
          </div>

          <span style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            fontWeight: 500,
            color: T.textLow,
            letterSpacing: '0.08em',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}>
            {loading ? '—' : `${dealCount} ${dealCount === 1 ? 'deal' : 'deals'}`}
          </span>
        </div>
      )}

      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  )
}

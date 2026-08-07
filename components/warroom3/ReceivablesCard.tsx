'use client'

// Receivables card — §6 item 7 + §12 step 6
// §6 item 7: T1 header → D1 figure in money-in (collected, the glowing element)
//            → T4 caption → split progress bar (§5.9) → footer row
// §4.3 one-glow rule: D1 carries the one text glow on this screen (collected figure).
// §5.9 progress bar: 4px height, radius 2px, two flex children: money-in + brand. No track.

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  bgPanel:   '#101017',
  textHi:    '#EFEEF4',
  textMid:   '#8B8A9B',
  textLow:   '#5C5B6B',
  brand:     '#8B5CF6',
  brandLift: '#A78BFA',
  moneyIn:   '#34D399',
} as const

// T1 §3.2
const styleT1: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: T.textMid,
  lineHeight: 1,
}

// D1 §3.2 — 36px / 700 / -0.035em / accent or text-hi — THE figure, carries the glow
const styleD1: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 36,
  fontWeight: 700,
  letterSpacing: '-0.035em',
  color: T.moneyIn,
  lineHeight: 1,
  fontVariantNumeric: 'tabular-nums',
  // §4.3 glow: text-shadow 0 0 22px <money-in at 0.35-0.45 alpha>
  textShadow: '0 0 22px rgba(52,211,153,0.40)',
}

// T4 §3.2
const styleT4: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 11.5,
  fontWeight: 400,
  color: T.textMid,
  lineHeight: 1.5,
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString('en-US')}`
}

interface ARData {
  collected: number     // total payments received (D1, money-in)
  outstanding: number   // remaining owed (brand-lift)
  dealCount: number     // number of ar_items
}

async function loadARData(): Promise<ARData> {
  // Mirrors AccountsReceivablePanel.tsx exactly.
  // sr_portion_amount = MS Portion — the column the panel tracks.
  // payments_total per item = sum of ar_payments rows for that item.
  // Collected = sum(payments_total ?? paid_to_date ?? 0) across ALL items.
  // Outstanding = sum of msBal for receivable items only,
  //   where msBal = max(0, sr_portion_amount - payments_total).
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

  const items    = (itemsRes.data    ?? []) as any[]
  const payments = (paymentsRes.data ?? []) as any[]

  // Build payments_total per item (mirrors panel enrichment)
  const paymentsByItem: Record<string, number> = {}
  for (const p of payments) {
    paymentsByItem[p.ar_item_id] = (paymentsByItem[p.ar_item_id] || 0) + (p.amount || 0)
  }

  // Collected = sum(payments_total ?? paid_to_date ?? 0) across ALL items
  const collected = items.reduce((sum: number, i: any) => {
    return sum + (paymentsByItem[i.id] ?? (i.paid_to_date || 0))
  }, 0)

  // Outstanding = sum of msBal(receivable items)
  const outstanding = items
    .filter((i: any) => i.status === 'receivable')
    .reduce((sum: number, i: any) => {
      const ms = i.sr_portion_amount ?? 0
      const paid = paymentsByItem[i.id] ?? (i.paid_to_date || 0)
      return sum + Math.max(0, ms - paid)
    }, 0)

  return { collected, outstanding, dealCount: items.length }
}

export default function ReceivablesCard() {
  const [data, setData] = useState<ARData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    loadARData()
      .then(setData)
      .catch((e: unknown) => {
        console.error('[ReceivablesCard] load error:', e)
        setLoadError(true)
      })
      .finally(() => setLoading(false))
  }, [])

  const collected   = data?.collected   ?? 0
  const outstanding = data?.outstanding ?? 0
  const dealCount   = data?.dealCount   ?? 0
  const total       = collected + outstanding
  const pctCollected = total > 0 ? collected / total : 0

  return (
    <div style={{
      background: T.bgPanel,
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: '16px 16px 18px',
    }}>
      {/* §5.1 header: T1 label · hairline · (no count — not a list) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
      }}>
        <span style={styleT1}>Receivables</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
      </div>

      {/* D1 figure — collected, money-in colour, carries the screen glow (§4.3) */}
      {loading ? (
        <div style={{
          height: 44, width: '60%', borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.6s ease-in-out infinite',
          marginBottom: 8,
        }} />
      ) : loadError ? (
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: '#FF4D4D', marginBottom: 6 }}>
          Could not load — tap to retry
        </div>
      ) : (
        <div style={{ ...styleD1, marginBottom: 6 }}>
          {formatCurrency(collected)}
        </div>
      )}

      {/* T4 caption */}
      <div style={{ ...styleT4, marginBottom: 14 }}>
        {loading ? '—' : loadError ? '' : 'collected'}
      </div>

      {/* §5.9 split progress bar: 4px, radius 2px, money-in + brand, no track */}
      <div style={{
        display: 'flex',
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 14,
      }}>
        {/* Collected portion — money-in */}
        <div style={{
          flex: loading ? 0.5 : pctCollected,
          background: T.moneyIn,
          borderRadius: '2px 0 0 2px',
          transition: 'flex 0.6s ease',
        }} />
        {/* Remaining portion — brand */}
        <div style={{
          flex: loading ? 0.5 : 1 - pctCollected,
          background: T.brand,
          borderRadius: '0 2px 2px 0',
          transition: 'flex 0.6s ease',
        }} />
      </div>

      {/* Footer row: outstanding in brand-lift · deal count in mono */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        {/* Outstanding — brand-lift per spec §6 item 7 */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 14,
            fontWeight: 600,
            color: T.brandLift,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
          }}>
            {loading ? '—' : formatCurrency(outstanding)}
          </span>
          <span style={{ ...styleT4, fontSize: 10.5 }}>outstanding</span>
        </div>

        {/* Deal count — mono */}
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

      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  )
}

'use client'

// ReceivablesCard — Item 95 recut (HOME 72a)
// Section header RECEIVABLES + flex:1 rule
// Figure: outstanding 30px Space Grotesk #34D399, text-shadow glow, NO subline
// Bar: violet (collected) FIRST, then green (outstanding)
// Footer: $52K ytd · {N} CLOSED

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  textMid:   '#B8B6C6',
  textLow:   '#8E8CA0',
  brandLift: '#A78BFA',
  moneyIn:   '#34D399',
} as const

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

// Keep original Supabase query logic verbatim
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
  const [data, setData]         = useState<ARData | null>(null)
  const [loading, setLoading]   = useState(true)
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
  // violet = collected portion, green = outstanding portion
  const pctCollected  = total > 0 ? collected  / total : 0.63
  const pctOutstanding = total > 0 ? outstanding / total : 0.37

  return (
    <div>
      {/* 1. Section header — marginTop:18, RECEIVABLES + flex:1 rule */}
      <div style={{
        marginTop: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase' as const,
          color: T.textMid,
          lineHeight: 1,
        }}>RECEIVABLES</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.10)' }} />
      </div>

      {/* 2. Figure line — marginTop:14, outstanding in #34D399 with glow, NO subline */}
      <div style={{
        marginTop: 14,
        display: 'flex',
        alignItems: 'baseline',
      }}>
        {loading ? (
          <div style={{
            height: 36,
            width: '45%',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.6s ease-in-out infinite',
          }} />
        ) : loadError ? (
          <span
            onClick={load}
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 13,
              color: '#FF4D4D',
              cursor: 'pointer',
            }}
          >
            Could not load — tap to retry
          </span>
        ) : (
          <span style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '-0.035em',
            color: '#34D399',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            textShadow: '0 0 24px rgba(52,211,153,.38)',
          }}>{formatCurrency(outstanding)}</span>
        )}
      </div>

      {/* 3. Bar — marginTop:6, violet (collected) FIRST, then green (outstanding) */}
      {!loadError && (
        <div style={{
          marginTop: 6,
          height: 4,
          borderRadius: 2,
          overflow: 'hidden',
          display: 'flex',
        }}>
          {/* Violet = collected */}
          <div style={{
            flex: loading ? 0.63 : pctCollected,
            background: '#A78BFA',
            transition: 'flex 0.6s ease',
          }} />
          {/* Green = outstanding */}
          <div style={{
            flex: loading ? 0.37 : pctOutstanding,
            background: '#34D399',
            transition: 'flex 0.6s ease',
          }} />
        </div>
      )}

      {/* 4. Footer — marginTop:11, collected ytd · N CLOSED */}
      {!loadError && (
        <div style={{
          marginTop: 11,
          display: 'flex',
          alignItems: 'baseline',
        }}>
          {/* Collected figure in violet */}
          <span style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#A78BFA',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: FONT_DISPLAY,
            lineHeight: 1,
          }}>{loading ? '—' : formatCurrency(collected)}</span>

          {/* ytd label */}
          <span style={{
            fontSize: 12.5,
            fontFamily: 'system-ui,sans-serif',
            fontWeight: 400,
            color: T.textLow,
            marginLeft: 7,
            lineHeight: 1,
          }}>ytd</span>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* N CLOSED */}
          <span style={{
            fontSize: 11.5,
            fontFamily: FONT_MONO,
            letterSpacing: '0.06em',
            color: T.textLow,
            lineHeight: 1,
          }}>{loading ? '—' : `${dealCount} CLOSED`}</span>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}

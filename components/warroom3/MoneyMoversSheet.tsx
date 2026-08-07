'use client'

// Money Movers bottom sheet — §12 step 7
// Data: deals with status='hot' — exact HotPanel.tsx predicate.
// Read-only. No action buttons (§13 is not yet in play for this sheet).

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import BottomSheet from '@/components/warroom3/BottomSheet'
import { formatAddress } from '@/lib/formatAddress'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  bgPanel:   '#101017',
  bgRaise:   '#16161F',
  textHi:    '#EFEEF4',
  textMid:   '#8B8A9B',
  textLow:   '#5C5B6B',
  hot:       '#FFA23A',
  brand:     '#8B5CF6',
  brandLift: '#A78BFA',
  hairline:  'rgba(255,255,255,0.05)',
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

interface HotDeal {
  id: string
  name: string | null
  address: string | null
  notes: string | null
  updated_at: string | null
  // actual deals table columns for price
  value: number | null
  commission_estimated: number | null
  type: string | null
}

function formatCurrency(n: number | null | undefined): string {
  if (!n) return '—'
  return '$' + Math.round(n).toLocaleString('en-US')
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diffMs / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return '1 day ago'
  if (d < 7) return `${d} days ago`
  const w = Math.floor(d / 7)
  return `${w}w ago`
}

export default function MoneyMoversSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [deals, setDeals] = useState<HotDeal[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (open && !loaded) load()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('id, name, address, notes, updated_at, value, commission_estimated, type')
        .eq('status', 'hot')
        .order('updated_at', { ascending: false })
        .limit(100)
      if (error) {
        console.error('[MoneyMoversSheet] load error:', error)
        setLoadError(true)
        setLoading(false)
        return
      }
      setDeals((data ?? []) as HotDeal[])
      setLoaded(true)
    } catch (e) {
      console.error('[MoneyMoversSheet] unexpected error:', e)
      setLoadError(true)
    }
    setLoading(false)
  }

  const count = deals.length

  return (
    <BottomSheet open={open} onClose={onClose} label="Money Movers" count={count > 0 ? count : undefined}>
      {/* Content — header is rendered by BottomSheet */}

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 18px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              height: 72,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.6s ease-in-out infinite',
            }} />
          ))}
        </div>
      ) : loadError ? (
        <div style={{ textAlign: 'center', padding: '32px 18px', color: '#FF4D4D', fontFamily: FONT_DISPLAY, fontSize: 13 }}>
          Could not load — tap to retry
        </div>
      ) : deals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 18px', color: T.textLow, fontFamily: FONT_DISPLAY, fontSize: 13 }}>
          No hot deals right now
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 18px' }}>
          {deals.map((deal, idx) => {
            const addr = formatAddress(deal.address) || deal.name || '—'
            const name = (deal.name ?? '').replace(/^📁\s*/, '')
            const priceLabel = deal.value ? formatCurrency(deal.value) : null
            const commLabel = deal.commission_estimated ? formatCurrency(deal.commission_estimated) : null

            return (
              <div
                key={deal.id}
                style={{
                  position: 'relative',
                  padding: '14px 14px 14px 17px',
                  borderRadius: 12,
                  background: 'rgba(255,162,58,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderLeft: '3px solid ' + T.hot,
                  marginBottom: idx < deals.length - 1 ? 8 : 0,
                }}
              >
                {/* Row 1: address + commission (money-in) or value */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <span style={{ ...styleT3, fontSize: 14 }}>{addr}</span>
                  {(commLabel || priceLabel) && (
                    <span style={{
                      fontFamily: FONT_MONO,
                      fontSize: 11,
                      fontWeight: 600,
                      color: T.hot,
                      letterSpacing: '-0.01em',
                      flexShrink: 0,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {commLabel ?? priceLabel}
                    </span>
                  )}
                </div>
                {/* Row 2: deal name + time */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  {name ? (
                    <span style={{ ...styleT4, fontSize: 11 }}>{name}</span>
                  ) : (
                    <span />
                  )}
                  <span style={{ ...styleT2, fontSize: 9, color: T.textLow }}>
                    {timeAgo(deal.updated_at)}
                  </span>
                </div>
                {/* Notes if present */}
                {deal.notes ? (
                  <div style={{
                    marginTop: 8,
                    padding: '8px 10px',
                    background: T.bgRaise,
                    borderRadius: 8,
                    fontFamily: FONT_DISPLAY,
                    fontSize: 11.5,
                    color: T.textMid,
                    lineHeight: 1.5,
                  }}>
                    {deal.notes}
                  </div>
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

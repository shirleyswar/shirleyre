'use client'

// Money Movers bottom sheet — Item 146
// Fetches from money_movers table (not deals/hot).
// Each row: title (left) + commission (right, moneyIn) + trash delete button.
// Props: open, onClose, refreshKey (increments to trigger re-fetch), onOpenAdd.

import React, { useState, useEffect } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import BottomSheet from '@/components/warroom3/BottomSheet'
import { FAB_APERTURE_GRADIENT, FAB_APERTURE_SHADOW } from '@/lib/fabGradient'
import { calcCommission, fmtMoney } from '@/lib/dealMath'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  textHi:    '#EFEEF4',
  textMid:   '#B8B6C6',
  textLow:   '#8E8CA0',
  textInvert:'#0A0A0F',
  moneyIn:   '#34D399',
  late:      '#FF4D4D',
} as const

interface MoneyMover {
  id: string
  title: string
  deal_id: string | null
  commission: number | null
  _commission: number | null
}

interface MoneyMoversSheetProps {
  open: boolean
  onClose: () => void
  refreshKey?: number
  onOpenAdd?: () => void
}

function formatCommission(val: number | null): string {
  if (val == null) return '—'
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function MoneyMoversSheet({ open, onClose, refreshKey, onOpenAdd }: MoneyMoversSheetProps) {
  const [movers, setMovers]       = useState<MoneyMover[]>([])
  const [loading, setLoading]     = useState(false)
  const [loaded, setLoaded]       = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)

  // Fetch on open or refreshKey change
  useEffect(() => {
    if (open) {
      setLoaded(false)
    }
  }, [open, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && !loaded) load()
  }, [open, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    setLoadError(false)
    setDeleteError(null)
    try {
      // Try full column set first (commission + note columns added post-migration).
      // If columns don't exist yet, fall back to base columns — same pattern as web (app/warroom/page.tsx).
      let rawData: any[] | null = null
      const { data: fullData, error: fullErr } = await supabase
        .from('money_movers')
        .select('id, title, deal_id, commission, note, note_typed_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (!fullErr) {
        rawData = fullData
      } else {
        // Columns not yet migrated — fall back to base columns only
        const { data: baseData, error: baseErr } = await supabase
          .from('money_movers')
          .select('id, title, deal_id, commission')
          .order('created_at', { ascending: false })
          .limit(50)
        if (baseErr) { setLoadError(true); setLoading(false); return }
        rawData = baseData
      }

      // Fetch deal_economics for any linked records so we can compute commission
      // the same way web does (calcCommission from lib/dealMath.ts)
      const dealIds = (rawData ?? []).map((m: any) => m.deal_id).filter(Boolean)
      let econMap: Record<string, any> = {}
      if (dealIds.length > 0) {
        const { data: econData } = await supabase
          .from('deal_economics')
          .select('deal_id, transaction_type, asking_price, sale_commission_pct, sqft, lease_rate_psf, lease_term_years, lease_commission_pct')
          .in('deal_id', dealIds)
        ;(econData ?? []).forEach((e: any) => { econMap[e.deal_id] = e })
      }

      // Compute effective commission: calcCommission for linked records, raw commission otherwise
      const enriched = (rawData ?? []).map((m: any) => {
        const econ = m.deal_id ? econMap[m.deal_id] : null
        const _commission = econ ? calcCommission(econ) : (m.commission as number | null)
        return { ...m, _commission }
      })

      setMovers(enriched as MoneyMover[])
      setLoaded(true)
    } catch {
      setLoadError(true)
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this money mover?')) return
    setDeletingId(id)
    setDeleteError(null)
    const { error } = await supabase
      .from('money_movers')
      .delete()
      .eq('id', id)
    setDeletingId(null)
    if (error) {
      setDeleteError(error.message || 'Delete failed — try again')
    } else {
      // Re-fetch after successful delete
      setLoaded(false)
    }
  }

  const stakeTotal = movers.reduce((s, m) => s + (m._commission ?? 0), 0)
  const stakeLabel = !loading && !loadError && movers.length > 0
    ? `${movers.length} ITEMS · ${fmtMoney(stakeTotal)} AT STAKE`
    : undefined

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="Money Movers"
      count={!loading && !loadError && movers.length > 0 ? movers.length : undefined}
    >
      {/* Stake total sub-header */}
      {stakeLabel && (
        <div style={{
          padding: '0 18px 10px',
          fontFamily: FONT_MONO,
          fontSize: 11,
          fontWeight: 500,
          color: T.textMid,
          letterSpacing: '0.06em',
        }}>
          {stakeLabel}
        </div>
      )}
      {/* Add button inside sheet header area */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 18px 12px' }}>
        <button
          onClick={onOpenAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: FAB_APERTURE_GRADIENT,
            boxShadow: FAB_APERTURE_SHADOW,
            border: 'none',
            borderRadius: 20,
            color: T.textInvert,
            fontFamily: FONT_DISPLAY,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          } as React.CSSProperties}
        >
          <Plus size={13} strokeWidth={2.5} />
          Add
        </button>
      </div>

      {/* Delete error banner */}
      {deleteError && (
        <div style={{
          margin: '0 18px 12px',
          padding: '10px 14px',
          borderRadius: 9,
          background: 'rgba(255,77,77,0.10)',
          border: '1px solid rgba(255,77,77,0.22)',
          fontFamily: FONT_DISPLAY,
          fontSize: 12,
          color: T.late,
        }}>
          {deleteError}
        </div>
      )}

      {loading ? (
        <SkeletonRows />
      ) : loadError ? (
        <div
          onClick={() => { setLoadError(false); setLoaded(false) }}
          style={{
            textAlign: 'center',
            padding: '32px 18px',
            color: T.late,
            fontFamily: FONT_DISPLAY,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Could not load — tap to retry
        </div>
      ) : movers.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '32px 18px',
          color: T.textLow,
          fontFamily: FONT_DISPLAY,
          fontSize: 13,
        }}>
          No money movers yet
        </div>
      ) : (
        <div>
          {movers.map((mover, idx) => (
            <div
              key={mover.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '13px 18px',
                borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.07)',
                gap: 12,
              }}
            >
              {/* Title */}
              <div style={{
                flex: 1,
                minWidth: 0,
                fontFamily: FONT_DISPLAY,
                fontSize: 15,
                fontWeight: 500,
                color: T.textHi,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {mover.title}
              </div>

              {/* Commission — computed via calcCommission for linked deals, raw otherwise */}
              <div style={{
                fontFamily: FONT_MONO,
                fontSize: 13,
                fontWeight: 500,
                color: mover._commission != null ? T.moneyIn : T.textLow,
                flexShrink: 0,
                letterSpacing: '0.02em',
              }}>
                {fmtMoney(mover._commission)}
              </div>

              {/* Trash button */}
              <button
                onClick={() => handleDelete(mover.id)}
                disabled={deletingId === mover.id}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 2px',
                  cursor: deletingId === mover.id ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  WebkitTapHighlightColor: 'transparent',
                  opacity: deletingId === mover.id ? 0.4 : 1,
                } as React.CSSProperties}
                aria-label="Delete money mover"
              >
                <Trash2 size={15} color={T.textLow} strokeWidth={1.7} />
              </button>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </BottomSheet>
  )
}

function SkeletonRows() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: 0 }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          height: 48,
          background: 'rgba(255,255,255,0.03)',
          backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.6s ease-in-out infinite',
        }} />
      ))}
    </div>
  )
}

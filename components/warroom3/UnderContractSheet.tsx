'use client'

// Under Contract bottom sheet — §12 step 7
// Data: deals with status='under_contract' — exact UnderContractPanel predicate,
// with uc_details and next unsatisfied deadline per deal.
// Read-only.

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
  moneyIn:   '#34D399',
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

function daysDiff(iso: string | null): number {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
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

function formatCurrency(n: number | null | undefined): string {
  if (!n) return '—'
  return '$' + Math.round(n).toLocaleString('en-US')
}

interface UCDeal {
  id: string
  name: string | null
  address: string | null
  updated_at: string | null
  // from uc_details
  contract_price?: number | null
  commission_amount?: number | null
  lease_rate?: number | null
  // computed
  daysSinceContract: number
  nextDeadline?: { label: string | null; date: string; days: number } | null
}

export default function UnderContractSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [deals, setDeals] = useState<UCDeal[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (open && !loaded) load()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('deals')
        .select('id, name, address, updated_at')
        .eq('status', 'under_contract')
        .order('updated_at', { ascending: false })

      if (!data || (data as any[]).length === 0) {
        setLoaded(true)
        setLoading(false)
        return
      }

      const dealList = (data as any[])

      const ids = dealList.map((d: any) => d.id)

      // Fetch uc_details for price/commission
      const [ucRes, dlRes] = await Promise.all([
        supabase
          .from('uc_details')
          .select('deal_id, contract_price, commission_amount, lease_rate')
          .in('deal_id', ids),
        supabase
          .from('contract_deadlines')
          .select('deal_id, label, deadline_date, status')
          .in('deal_id', ids)
          .neq('status', 'satisfied')
          .order('deadline_date', { ascending: true }),
      ])

      const ucMap: Record<string, any> = {}
      for (const row of ((ucRes.data ?? []) as any[])) {
        ucMap[row.deal_id] = row
      }

      // Next deadline per deal — earliest unsatisfied
      const dlMap: Record<string, any> = {}
      for (const dl of ((dlRes.data ?? []) as any[])) {
        if (!dlMap[dl.deal_id]) {
          dlMap[dl.deal_id] = dl
        }
      }

      setDeals(dealList.map((d: any) => {
        const uc = ucMap[d.id]
        const dl = dlMap[d.id]
        return {
          id: d.id,
          name: d.name,
          address: d.address,
          updated_at: d.updated_at,
          contract_price: uc?.contract_price ?? null,
          commission_amount: uc?.commission_amount ?? null,
          lease_rate: uc?.lease_rate ?? null,
          daysSinceContract: daysDiff(d.updated_at),
          nextDeadline: dl ? {
            label: dl.label,
            date: dl.deadline_date,
            days: daysUntil(dl.deadline_date),
          } : null,
        }
      }))
      setLoaded(true)
    } catch {}
    setLoading(false)
  }

  const count = deals.length

  return (
    <BottomSheet open={open} onClose={onClose} label="Under Contract" count={count > 0 ? count : undefined}>
      {/* Header rendered by BottomSheet */}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 18px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              height: 80,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.6s ease-in-out infinite',
            }} />
          ))}
        </div>
      ) : deals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 18px', color: T.textLow, fontFamily: FONT_DISPLAY, fontSize: 13 }}>
          No deals under contract
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 18px' }}>
          {deals.map(deal => {
            const addr = formatAddress(deal.address) || deal.name || '—'
            const name = (deal.name ?? '').replace(/^📁\s*/, '')
            const priceLabel = deal.contract_price
              ? formatCurrency(deal.contract_price)
              : deal.lease_rate
              ? formatCurrency(deal.lease_rate) + '/mo'
              : null
            const commissionLabel = deal.commission_amount ? formatCurrency(deal.commission_amount) : null
            const nextDL = deal.nextDeadline
            const dlDays = nextDL?.days ?? 0
            const dlColor = dlDays < 0 ? T.late : dlDays <= 7 ? T.hot : T.brand

            return (
              <div
                key={deal.id}
                style={{
                  padding: '14px 14px 14px 17px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderLeft: '3px solid ' + T.brand,
                }}
              >
                {/* Row 1: address + price */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <span style={{ ...styleT3, fontSize: 14 }}>{addr}</span>
                  {priceLabel && (
                    <span style={{
                      fontFamily: FONT_MONO,
                      fontSize: 11,
                      fontWeight: 600,
                      color: T.moneyIn,
                      letterSpacing: '-0.01em',
                      flexShrink: 0,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {priceLabel}
                    </span>
                  )}
                </div>
                {/* Row 2: deal name + days since contract */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: nextDL ? 8 : 0 }}>
                  {name ? (
                    <span style={{ ...styleT4, fontSize: 11 }}>{name}</span>
                  ) : <span />}
                  <span style={{ ...styleT2, fontSize: 9, color: T.textLow }}>
                    Day {deal.daysSinceContract}
                  </span>
                </div>
                {/* Next deadline */}
                {nextDL && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '7px 10px',
                    background: T.bgRaise,
                    borderRadius: 8,
                    borderLeft: '2px solid ' + dlColor,
                  }}>
                    <span style={{ fontFamily: FONT_DISPLAY, fontSize: 11.5, color: T.textMid }}>
                      {nextDL.label || 'Deadline'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: dlColor, fontWeight: 600 }}>
                        {dlDays < 0 ? `${Math.abs(dlDays)}d late` : dlDays === 0 ? 'Today' : `${dlDays}d`}
                      </span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: T.textLow }}>
                        {formatDateShort(nextDL.date)}
                      </span>
                    </div>
                  </div>
                )}
                {/* Commission if no price shown */}
                {!priceLabel && commissionLabel && (
                  <div style={{ ...styleT4, fontSize: 11, color: T.moneyIn, marginTop: 4 }}>
                    Commission: {commissionLabel}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </BottomSheet>
  )
}

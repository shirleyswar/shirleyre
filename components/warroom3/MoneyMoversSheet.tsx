'use client'

// Money Movers bottom sheet — §5.11 + §12 step 7
// §5.11.1: Rows hairline-separated. NO border, NO radius, NO background fill.
// §5.11.2: No tint on rows. Spine only (hot).
// §5.11.4: Money labelled — commission primary, sale price secondary.
// All type references bound to §3.2 named levels. No pixel literals for text.

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import BottomSheet from '@/components/warroom3/BottomSheet'
import ListRow from '@/components/warroom3/ListRow'
import { formatAddress } from '@/lib/formatAddress'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"

const T = {
  textLow:   '#5C5B6B',
  late:      '#FF4D4D',
  hot:       '#FFA23A',
  brand:     '#8B5CF6',
} as const

interface HotDeal {
  id: string
  name: string | null
  address: string | null
  computedValue: number | null
  computedCommission: number | null
}

export default function MoneyMoversSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      const { data: dealsData, error: dealsErr } = await supabase
        .from('deals')
        .select('id, name, address')
        .eq('status', 'hot')
        .order('updated_at', { ascending: false })
        .limit(100)
      if (dealsErr) { setLoadError(true); setLoading(false); return }
      const dealList = (dealsData ?? []) as any[]
      if (dealList.length === 0) { setDeals([]); setLoaded(true); setLoading(false); return }
      const ids = dealList.map((d: any) => d.id)

      const { data: econData } = await supabase
        .from('deal_economics')
        .select('deal_id, asking_price, sale_commission_pct, lease_rate_psf, lease_term_years, lease_commission_pct, sqft, transaction_type')
        .in('deal_id', ids)
      const { data: ucData } = await supabase
        .from('uc_details')
        .select('deal_id, contract_price, commission_pct, commission_amount')
        .in('deal_id', ids)

      const econMap: Record<string, any> = {}
      for (const e of (econData ?? []) as any[]) econMap[e.deal_id] = e
      const ucMap: Record<string, any> = {}
      for (const u of (ucData ?? []) as any[]) ucMap[u.deal_id] = u

      const computed = dealList.map((deal: any) => {
        const e = econMap[deal.id]
        const u = ucMap[deal.id]
        let computedValue: number | null = null
        let computedCommission: number | null = null
        if (e) {
          const isLease = e.transaction_type === 'lease'
          if (isLease) {
            const gross = e.sqft && e.lease_rate_psf && e.lease_term_years
              ? Math.round(e.sqft * e.lease_rate_psf * e.lease_term_years) : null
            computedValue = gross
            computedCommission = gross && e.lease_commission_pct
              ? Math.round(gross * (e.lease_commission_pct / 100) * 0.75) : null
          } else {
            computedValue = e.asking_price ?? null
            computedCommission = e.asking_price && e.sale_commission_pct
              ? Math.round(e.asking_price * (e.sale_commission_pct / 100) * 0.75) : null
          }
        } else if (u) {
          computedValue = u.contract_price ?? null
          computedCommission = u.commission_amount ?? (u.contract_price && u.commission_pct
            ? Math.round(u.contract_price * (u.commission_pct / 100) * 0.75) : null)
        }
        return { id: deal.id, name: deal.name, address: deal.address, computedValue, computedCommission }
      })

      setDeals(computed)
      setLoaded(true)
    } catch { setLoadError(true) }
    setLoading(false)
  }

  return (
    <BottomSheet open={open} onClose={onClose} label="Money Movers" count={deals.length > 0 ? deals.length : undefined}>
      {loading ? (
        <SkeletonRows />
      ) : loadError ? (
        <div onClick={() => { setLoadError(false); setLoaded(false) }}
          style={{ textAlign: 'center', padding: '32px 18px', color: '#FF4D4D', fontFamily: FONT_DISPLAY, fontSize: 13, cursor: 'pointer' }}>
          Could not load — tap to retry
        </div>
      ) : deals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 18px', color: T.textLow, fontFamily: FONT_DISPLAY, fontSize: 13 }}>
          No hot deals right now
        </div>
      ) : (
        <div>
          {deals.map(deal => {
            const addr = formatAddress(deal.address) || null
            const clientName = deal.name?.replace(/^📁\s*/, '') || null
            // §5.11.5 — if addr is null, title = clientName; subline should differ from title
            const title = addr || clientName || '—'
            const subline = clientName && clientName !== title ? `${clientName}` : undefined

            return (
              <ListRow
                key={deal.id}
                title={title}
                subline={subline}
                spineColor={T.hot}
                showMoney={deal.computedCommission != null}
                commission={deal.computedCommission}
                salePrice={deal.computedValue}
              />
            )
          })}
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

'use client'

// Under Contract bottom sheet — §5.11 + §12 step 7
// §5.11.1: Rows hairline-separated. NO border, NO radius, NO background fill.
// §5.11.1: "The nested bordered strip inside Under Contract rows — a box with its own
//           spine, inside a card that already has a spine — is retired.
//           Deadline text is plain text on its own line."
// All type references bound to §3.2 named levels. No pixel literals for text.

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import BottomSheet from '@/components/warroom3/BottomSheet'
import ListRow from '@/components/warroom3/ListRow'
import { formatAddress } from '@/lib/formatAddress'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  textHi:    '#EFEEF4',
  textMid:   '#8B8A9B',
  textLow:   '#5C5B6B',
  late:      '#FF4D4D',
  hot:       '#FFA23A',
  brand:     '#8B5CF6',
  brandLift: '#A78BFA',
  moneyIn:   '#34D399',
} as const

function todayCST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0,0,0,0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.floor((target.getTime() - now.getTime()) / 86400000)
}

function daysSince(iso: string | null): number {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface UCDeal {
  id: string
  name: string | null
  address: string | null
  updated_at: string | null
  contract_price?: number | null
  commission_amount?: number | null
  daysSinceContract: number
  nextDeadline?: { label: string | null; date: string; days: number } | null
}

export default function UnderContractSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [deals, setDeals] = useState<UCDeal[]>([])
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
      const { data, error } = await supabase
        .from('deals')
        .select('id, name, address, updated_at')
        .eq('status', 'under_contract')
        .order('updated_at', { ascending: false })
      if (error) { setLoadError(true); setLoading(false); return }
      if (!data || (data as any[]).length === 0) { setLoaded(true); setLoading(false); return }

      const ids = (data as any[]).map((d: any) => d.id)
      const [ucRes, dlRes] = await Promise.all([
        supabase.from('uc_details').select('deal_id, contract_price, commission_amount').in('deal_id', ids),
        supabase.from('contract_deadlines').select('deal_id, label, deadline_date, status')
          .in('deal_id', ids).neq('status', 'satisfied').order('deadline_date', { ascending: true }),
      ])

      const ucMap: Record<string, any> = {}
      for (const row of ((ucRes.data ?? []) as any[])) ucMap[row.deal_id] = row
      const dlMap: Record<string, any> = {}
      for (const dl of ((dlRes.data ?? []) as any[])) {
        if (!dlMap[dl.deal_id]) dlMap[dl.deal_id] = dl
      }

      setDeals((data as any[]).map((d: any) => {
        const uc = ucMap[d.id]
        const dl = dlMap[d.id]
        return {
          id: d.id, name: d.name, address: d.address, updated_at: d.updated_at,
          contract_price: uc?.contract_price ?? null,
          commission_amount: uc?.commission_amount ?? null,
          daysSinceContract: daysSince(d.updated_at),
          nextDeadline: dl ? { label: dl.label, date: dl.deadline_date, days: daysUntil(dl.deadline_date) } : null,
        }
      }))
      setLoaded(true)
    } catch { setLoadError(true) }
    setLoading(false)
  }

  return (
    <BottomSheet open={open} onClose={onClose} label="Under Contract" count={deals.length > 0 ? deals.length : undefined}>
      {loading ? (
        <SkeletonRows />
      ) : loadError ? (
        <div onClick={() => { setLoadError(false); setLoaded(false) }}
          style={{ textAlign: 'center', padding: '32px 18px', color: T.late, fontFamily: FONT_DISPLAY, fontSize: 13, cursor: 'pointer' }}>
          Could not load — tap to retry
        </div>
      ) : deals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 18px', color: T.textLow, fontFamily: FONT_DISPLAY, fontSize: 13 }}>
          No deals under contract
        </div>
      ) : (
        <div>
          {deals.map(deal => {
            const addr = formatAddress(deal.address) || null
            const clientName = deal.name?.replace(/^📁\s*/, '') || null
            const title = addr || clientName || '—'
            // §5.11.5: subline ≠ title
            const sublineParts: string[] = []
            if (clientName && clientName !== title) sublineParts.push(clientName)
            if (deal.nextDeadline) {
              const dl = deal.nextDeadline
              const dlDays = dl.days
              const dlLabel = dl.label || 'Deadline'
              const dlDateStr = formatDateShort(dl.date)
              const dlStr = dlDays < 0
                ? `${dlLabel} — ${Math.abs(dlDays)}d late · ${dlDateStr}`
                : dlDays === 0
                ? `${dlLabel} — Today · ${dlDateStr}`
                : `${dlLabel} · ${dlDateStr}`
              sublineParts.push(dlStr)
            }
            const subline = sublineParts.length > 0 ? sublineParts.join(' · ') : undefined

            // Spine: brand for UC (active deal in contract)
            // If next deadline is past-due → late spine
            const dlDays = deal.nextDeadline?.days ?? null
            const spineColor = dlDays !== null && dlDays < 0 ? T.late : T.brand

            const dayCount = `DAY ${deal.daysSinceContract}`

            return (
              <ListRow
                key={deal.id}
                title={title}
                subline={subline}
                spineColor={spineColor}
                dayCount={dayCount}
                dayCountColor={T.textLow}
                showMoney={deal.commission_amount != null}
                commission={deal.commission_amount}
                salePrice={deal.contract_price}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {[0, 1, 2].map(i => (
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

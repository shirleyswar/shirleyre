'use client'

// §15 Mobile deal page — locked design 33b (13 Aug). Round 1: read state only.
// "The phone reads the deal, the desktop works it" — no Edit on mobile.
// Route: /warroom3/deal?id=<uuid>

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatAddress } from '@/lib/formatAddress'
import Launch from '@/components/warroom3/Launch'

// ── Tokens §2 ────────────────────────────────────────────────────────────────
const T = {
  bgBase:    '#08080C',
  bgPanel:   '#101017',
  bgRaise:   '#16161F',
  textHi:    '#EFEEF4',
  textMid:   '#8B8A9B',
  textLow:   '#5C5B6B',
  brand:     '#8B5CF6',
  brandLift: '#A78BFA',  // Est. Commission glow — the one glow on the page
  moneyIn:   '#34D399',
  late:      '#FF4D4D',
  hot:       '#FFA23A',
} as const

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

// §3.2 type scale (44a)
// M0 — JetBrains Mono 22px / 500 / -0.01em — deal-page snapshot lead figures
const STYLE_M0: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 22,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.1,
}
// M1 — 17px
const STYLE_M1: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 17,
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.1,
}
// T3 — 18px row title
const STYLE_T3: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 18,
  fontWeight: 500,
  color: T.textHi,
  lineHeight: 1.25,
}
// T4 — 14px text-mid
const STYLE_T4: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 14,
  fontWeight: 400,
  color: T.textMid,
  lineHeight: 1.4,
}
// T1 — 12px mono upper
const STYLE_T1: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: T.textLow,
  lineHeight: 1,
}
// T5 — 10px mono upper (labels under figures)
const STYLE_T5: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
  lineHeight: 1,
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${Math.round(n).toLocaleString('en-US')}`
  return `$${n}`
}

function fmtSF(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${Math.round(n).toLocaleString('en-US')} SF`
}

function fmtAcres(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${n} AC`
}

function fmtPSF(price: number | null, sf: number | null): string {
  if (!price || !sf) return '—'
  return `$${(price / sf).toFixed(2)}/SF`
}

// ── Snapshot cell ─────────────────────────────────────────────────────────────
function SnapCell({
  label,
  value,
  valueStyle,
}: {
  label: string
  value: string
  valueStyle?: React.CSSProperties
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '14px 0',
    }}>
      <span style={{ ...STYLE_T5, color: T.textLow }}>{label}</span>
      <span style={{ ...STYLE_M1, ...valueStyle }}>{value}</span>
    </div>
  )
}

// ── Section row (§5.11) ───────────────────────────────────────────────────────
function SectionRow({ label, meta, onPress }: { label: string; meta?: string; onPress?: () => void }) {
  return (
    <div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
      <button
        onClick={onPress ?? (() => console.log(`[deal page] ${label} tapped`))}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          padding: '18px 20px 18px 20px',
          gap: 10,
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          textAlign: 'left',
          minHeight: 60,
        } as React.CSSProperties}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...STYLE_T3 }}>{label}</div>
          {meta && (
            <div style={{ ...STYLE_T4, marginTop: 6 }}>{meta}</div>
          )}
        </div>
        {/* Right chevron */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textLow} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
  )
}

// ── Deal data type ────────────────────────────────────────────────────────────
interface DealData {
  id: string
  name: string | null
  address: string | null
  status: string
  property_type: string | null
  portfolio_id: string | null
  transaction_type?: string | null
  lacdb_url?: string | null
  photo_url?: string | null
  // economics
  asking_price?: number | null
  sqft?: number | null
  land_size?: number | null
  deal_value?: number | null
  commission_pct?: number | null
  est_commission?: number | null
  // lease
  lease_rate_psf?: number | null
  lease_term_years?: number | null
  nnn_psf?: number | null
}

// ── Main page ─────────────────────────────────────────────────────────────────
function DealPageContent() {
  const router = useRouter()
  // useSearchParams() returns empty in static export (searchParams:{} baked in at build time).
  // Read directly from window.location.search on the client instead.
  const [dealId, setDealId] = useState<string | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setDealId(params.get('id'))
  }, [])

  const [deal, setDeal] = useState<DealData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [launched, setLaunched] = useState(false)

  useEffect(() => {
    if (!dealId) { return }
    ;(async () => {
      try {
        // Fetch core deal
        const { data: dealData, error: dealErr } = await supabase
          .from('deals')
          .select('id, name, address, status, property_type, portfolio_id, lacdb_url, photo_url')
          .eq('id', dealId)
          .single()
        if (dealErr || !dealData) { setError(true); setLoading(false); return }

        // Fetch economics
        const { data: econData } = await supabase
          .from('deal_economics')
          .select('asking_price, sqft, land_sqft, sale_commission_pct, lease_rate_psf, lease_term_years, nnn_psf, transaction_type')
          .eq('deal_id', dealId)
          .maybeSingle()

        const d: DealData = {
          ...(dealData as any),
          transaction_type: econData?.transaction_type ?? null,
          asking_price: econData?.asking_price ?? null,
          sqft: econData?.sqft ?? null,
          land_size: econData?.land_sqft ?? null,
          deal_value: null,
          commission_pct: econData?.sale_commission_pct ?? null,
          lease_rate_psf: econData?.lease_rate_psf ?? null,
          lease_term_years: econData?.lease_term_years ?? null,
          nnn_psf: econData?.nnn_psf ?? null,
        }

        // Est. commission
        const isLease = d.transaction_type === 'lease'
        if (isLease && d.sqft && d.lease_rate_psf && d.lease_term_years) {
          const gross = d.sqft * d.lease_rate_psf * d.lease_term_years
          d.est_commission = Math.round(gross * 0.03 * 0.75)
        } else if (!isLease && d.asking_price && d.commission_pct) {
          d.est_commission = Math.round(d.asking_price * (d.commission_pct / 100) * 0.75)
        }

        setDeal(d)
      } catch { setError(true) }
      setLoading(false)
    })()
  }, [dealId])

  if (loading) {
    return (
      <div style={{ background: T.bgBase, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...STYLE_T1, color: T.textLow }}>Loading…</div>
      </div>
    )
  }

  if (error || !deal) {
    return (
      <div style={{ background: T.bgBase, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...STYLE_T3, textAlign: 'center' }}>Deal not found</div>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: T.brandLift, fontFamily: FONT_DISPLAY, fontSize: 14, cursor: 'pointer' }}>← Go back</button>
      </div>
    )
  }

  const isLease = deal.transaction_type === 'lease'
  const addr = formatAddress(deal.address) || deal.name || '—'
  const clientName = deal.name && deal.name !== deal.address ? deal.name : null
  const isHot = deal.status === 'hot'

  return (
    <div style={{ background: T.bgBase, minHeight: '100dvh', paddingBottom: 40 }}>

      {/* §15.1.1 — Header row: back chevron + address/client + status pill */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 20px 12px',
      }}>
        {/* Back chevron */}
        <button
          onClick={() => router.back()}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            flexShrink: 0,
            color: T.textMid,
            WebkitTapHighlightColor: 'transparent',
          } as React.CSSProperties}
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        {/* Address + client */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...STYLE_T3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addr}</div>
          {clientName && (
            <div style={{ ...STYLE_T4, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clientName}</div>
          )}
        </div>

        {/* HOT pill — filled amber only; else omit (§15.1.1) */}
        {isHot && (
          <span style={{
            ...STYLE_T5,
            fontWeight: 700,
            background: T.hot,
            color: '#0A0A0F',
            padding: '5px 8px',
            borderRadius: 4,
            flexShrink: 0,
          }}>HOT</span>
        )}
      </div>

      {/* §15.1.2 — Photo: 16:9, full-bleed within gutters, radius matches card.
          Placeholder when absent. LACDB ↗ pill in bottom-right corner. */}
      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        <div style={{
          position: 'relative',
          width: '100%',
          paddingTop: '56.25%', // 16:9
          borderRadius: 12,
          overflow: 'hidden',
          background: deal.photo_url ? 'transparent' : 'rgba(255,255,255,0.04)',
        }}>
          {deal.photo_url && (
            <img
              src={deal.photo_url}
              alt={addr}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
          {/* LACDB ↗ pill — photo bottom-right corner (§15.1.2) */}
          {deal.lacdb_url && (
            <a
              href={deal.lacdb_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                position: 'absolute',
                bottom: 10,
                right: 10,
                background: 'rgba(8,8,12,0.72)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6,
                padding: '4px 8px',
                fontFamily: FONT_MONO,
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.08em',
                color: T.textHi,
                textDecoration: 'none',
                backdropFilter: 'blur(4px)',
              } as React.CSSProperties}
            >
              LACDB ↗
            </a>
          )}
        </div>
      </div>

      {/* §15.1.3 — Six-slot snapshot grid: 2 col × 3 rows.
          M0 (22px) for Asking Price + Est. Commission.
          M1 (17px) for remaining four.
          Est. Commission in brand-lift — the one glow. */}
      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0 20px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          overflow: 'hidden',
          background: T.bgPanel,
        }}>
          {/* Row 1 — lead figures: Asking Price, Est. Commission */}
          {[
            {
              label: isLease ? 'Lease Rate/SF' : 'Asking Price',
              value: isLease ? (deal.lease_rate_psf ? `$${deal.lease_rate_psf}/SF` : '—') : fmt(deal.asking_price),
              style: { ...STYLE_M0, color: T.textHi } as React.CSSProperties,
            },
            {
              label: 'Est. Commission',
              value: fmt(deal.est_commission),
              style: { ...STYLE_M0, color: T.brandLift } as React.CSSProperties,
            },
          ].map((cell, i) => (
            <div key={i} style={{
              padding: '14px 14px 12px',
              borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ ...STYLE_T5, color: T.textLow, marginBottom: 6 }}>{cell.label}</div>
              <div style={cell.style}>{cell.value}</div>
            </div>
          ))}

          {/* Row 2 — Building SF, Price/SF */}
          {[
            {
              label: isLease ? 'Building SF' : 'Building SF',
              value: fmtSF(deal.sqft),
              style: { ...STYLE_M1, color: T.textHi } as React.CSSProperties,
            },
            {
              label: isLease ? 'NNN/SF' : 'Price/SF',
              value: isLease ? (deal.nnn_psf ? `$${deal.nnn_psf}/SF` : '—') : fmtPSF(deal.asking_price ?? null, deal.sqft ?? null),
              style: { ...STYLE_M1, color: T.textHi } as React.CSSProperties,
            },
          ].map((cell, i) => (
            <div key={i} style={{
              padding: '14px 14px 12px',
              borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ ...STYLE_T5, color: T.textLow, marginBottom: 6 }}>{cell.label}</div>
              <div style={cell.style}>{cell.value}</div>
            </div>
          ))}

          {/* Row 3 — Land Size, Deal Value */}
          {[
            {
              label: 'Land Size',
              value: fmtAcres(deal.land_size),
              style: { ...STYLE_M1, color: T.textHi } as React.CSSProperties,
            },
            {
              label: 'Deal Value',
              value: fmt(deal.deal_value ?? deal.asking_price),
              style: { ...STYLE_M1, color: T.textHi } as React.CSSProperties,
            },
          ].map((cell, i) => (
            <div key={i} style={{
              padding: '14px 14px 12px',
              borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
            }}>
              <div style={{ ...STYLE_T5, color: T.textLow, marginBottom: 6 }}>{cell.label}</div>
              <div style={cell.style}>{cell.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* §15.1.4 — LAUNCH DEAL — full-width, assets/launch/launch.css asset */}
      <div style={{ padding: '0 20px', marginBottom: 24 }}>
        <Launch
          launched={launched}
          onClick={() => setLaunched(v => !v)}
          label="LAUNCH DEAL"
        />
      </div>

      {/* §15.1.5 — §5.11 section rows. Stub: tap logs to console.
          Chain · Money · Showings & Prospects · Documents · Notes · Contacts · Activity */}
      <div style={{ padding: '0 0', marginBottom: 40 }}>
        <SectionRow
          label="Chain"
          meta={undefined}
          onPress={() => console.log('[deal page] Chain tapped')}
        />
        <SectionRow
          label="Money"
          onPress={() => console.log('[deal page] Money tapped')}
        />
        <SectionRow
          label="Showings & Prospects"
          onPress={() => console.log('[deal page] Showings tapped')}
        />
        <SectionRow
          label="Documents"
          onPress={() => console.log('[deal page] Documents tapped')}
        />
        <SectionRow
          label="Notes"
          onPress={() => console.log('[deal page] Notes tapped')}
        />
        <SectionRow
          label="Contacts"
          onPress={() => console.log('[deal page] Contacts tapped')}
        />
        <SectionRow
          label="Activity"
          onPress={() => console.log('[deal page] Activity tapped')}
        />
        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
      </div>
    </div>
  )
}

export default function DealPage() {
  return (
    <Suspense fallback={
      <div style={{ background: '#08080C', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#5C5B6B', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Loading…</span>
      </div>
    }>
      <DealPageContent />
    </Suspense>
  )
}

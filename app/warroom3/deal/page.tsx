'use client'

// /warroom3/deal — mobile deal page, items 67-77
// Items built:
//   67: header (no back control, address 19px, client 12.5px, type plates right, no HOT/pill/menu/edit)
//   68: type plates up to two — transaction (sale/lease) + property type, 22px tall, inert
//   69: economics flowing two-col grid, facts that exist, no dashes for missing
//   70: LACDB link centered, lacdb-link-h168.png at h56, no border/fill/radius/glow, LACDB pill struck
//   71: photo 16:9 radius 14, placeholder
//   72: section rows CHAIN+type, CONTACTS, DOCUMENTS, NOTES — no navigation arrows
//   73: commission reveal — hidden by default, 56px band, press reveals figure + derivation
//   74: no receivable, no Launch Deal
//   75: pad rule — NOT this round (requires runtime measurement, deferring partial implementation)
//   76: three tap-reactive objects: LACDB link, phone number, commission reveal
//   77: rightward drag to go back — page translates right, springs back if < 1/3

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatAddress } from '@/lib/formatAddress'
import { calcSaleCommission, calcLeaseCommission, HOUSE_SPLIT } from '@/lib/dealMath'

// ── Tokens ────────────────────────────────────────────────────────────────────
const T = {
  bgBase:    '#08080C',
  bgPanel:   '#12111B',
  bgRaise:   '#1E1D26',
  textHi:    '#EFEEF4',
  textMid:   '#B8B6C6',
  textLow:   '#8E8CA0',
  brand:     '#8B5CF6',
  brandLift: '#A78BFA',
  moneyIn:   '#34D399',
  late:      '#FF4D4D',
  hot:       '#FFA23A',
} as const

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const STYLE_T1: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: T.textLow,
  lineHeight: 1,
}

// ── Type plate map ─────────────────────────────────────────────────────────────
// Transaction plates: sale → plate-sale-h66.png, lease → plate-lease-h66.png
// Property plates: OFFICE, RETAIL, INDUSTRIAL, MULTI, LAND
// plate-indst-h66.png maps to INDUSTRIAL. Never alter any DB value.
// HOT does NOT render — HOT is a status, not a type.
const TRANSACTION_PLATES: Record<string, string> = {
  sale:  '/assets/plates/mobile/plate-sale-h66.png',
  lease: '/assets/plates/mobile/plate-lease-h66.png',
}
const PROPERTY_PLATES: Record<string, string> = {
  OFFICE:     '/assets/plates/mobile/plate-office-h66.png',
  RETAIL:     '/assets/plates/mobile/plate-retail-h66.png',
  INDUSTRIAL: '/assets/plates/mobile/plate-indst-h66.png',
  MULTI:      '/assets/plates/mobile/plate-multi-h66.png',
  LAND:       '/assets/plates/mobile/plate-land-h66.png',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null) return ''
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${Math.round(n).toLocaleString('en-US')}`
  return `$${n}`
}

function fmtSF(n: number | null | undefined): string {
  if (n == null) return ''
  return `${Math.round(n).toLocaleString('en-US')} SF`
}

function fmtAcres(n: number | null | undefined): string {
  if (n == null) return ''
  return `${n} AC`
}

function fmtPSF(price: number | null, sf: number | null): string {
  if (!price || !sf) return ''
  return `$${(price / sf).toFixed(2)}/SF`
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return ''
  return `${n}%`
}

// ── Deal data type ────────────────────────────────────────────────────────────
interface DealData {
  id: string
  name: string | null
  address: string | null
  addr_display?: string | null
  addr_street_name?: string | null
  addr_street_type?: string | null
  addr_direction?: string | null
  addr_number?: string | null
  addr_city?: string | null
  status: string
  property_type: string | null
  portfolio_id: string | null
  dropbox_link?: string | null
  acreage?: number | null
  transaction_type?: string | null
  asking_price?: number | null
  sqft?: number | null
  land_size?: number | null
  commission_pct?: number | null
  est_commission?: number | null
  lease_rate_psf?: number | null
  lease_term_years?: number | null
  nnn_psf?: number | null
  // contacts
  contacts?: ContactData[]
  // chain
  chain_done?: number
  chain_total?: number
  // documents count
  doc_count?: number
  // notes count
  note_count?: number
}

interface ContactData {
  id: string
  name: string | null
  phone?: string | null
  role?: string | null
}

// ── ITEM 77/88 — RIGHTWARD DRAG TO GO BACK ─────────────────────────────────────
// Wraps page content. Rightward drag translates X, releases > 1/3 → navigate back.
// Shadow at leading edge so surfaces read as stacked.
// RIGHT-EDGE EXCLUSION: 0px — no exclusion zone exists in this build.
// The gesture is full-width: startX is recorded wherever the finger touches (no guard).
// Preserved unchanged per item 88 directive. Report: measured exclusion width = 0px.
function SwipeBackWrapper({
  children,
  onBack,
}: {
  children: React.ReactNode
  onBack: () => void
}) {
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef<number | null>(null)
  const startYRef = useRef<number | null>(null)
  const lockedRef = useRef<'horiz' | 'vert' | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  function onTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0].clientX
    startYRef.current = e.touches[0].clientY
    lockedRef.current = null
    setIsDragging(false)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startXRef.current === null || startYRef.current === null) return
    const dx = e.touches[0].clientX - startXRef.current
    const dy = e.touches[0].clientY - startYRef.current

    // Lock direction on first meaningful movement
    if (!lockedRef.current) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
      lockedRef.current = Math.abs(dx) > Math.abs(dy) ? 'horiz' : 'vert'
    }
    if (lockedRef.current !== 'horiz') return
    if (dx < 0) return  // only rightward

    setIsDragging(true)
    setDragX(Math.min(dx, window.innerWidth))
  }

  function onTouchEnd() {
    if (!isDragging) { setDragX(0); return }
    const threshold = window.innerWidth / 3
    if (dragX > threshold) {
      // Complete navigation
      setDragX(window.innerWidth)
      setTimeout(() => onBack(), 150)
    } else {
      // Spring back
      setDragX(0)
      setIsDragging(false)
    }
    startXRef.current = null
    startYRef.current = null
    lockedRef.current = null
  }

  const progress = dragX / window.innerWidth

  return (
    <div
      style={{ position: 'relative', height: '100dvh', overflow: 'hidden' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Shadow at leading edge — so surfaces read as stacked, not cross-faded */}
      {dragX > 0 && (
        <div style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: 40,
          background: 'linear-gradient(to right, rgba(0,0,0,0.5), transparent)',
          transform: `translateX(${dragX}px)`,
          zIndex: 10,
          pointerEvents: 'none',
        }} />
      )}
      <div
        ref={wrapperRef}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? 'none' : 'transform 250ms cubic-bezier(0.25,0.46,0.45,0.94)',
          height: '100%',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ── ITEM 73 — Commission Reveal Band ─────────────────────────────────────────
// 56px band. Default: "EST. COMMISSION" label in mono, NO figure, NO glow.
// Press: reveals figure + derivation. Press again: hides.
// Re-hides on page exit — no persistence. (handled by local state, never written to storage)
function CommissionReveal({ deal }: { deal: DealData }) {
  const [revealed, setRevealed] = useState(false)

  // ITEM 76: this IS one of the three tap-reactive objects
  const commission = deal.est_commission  // already 75% (HOUSE_SPLIT applied in load)
  const hasData = commission != null

  const isLease = deal.transaction_type === 'lease'
  let derivation = ''
  if (hasData && commission != null) {
    if (isLease && deal.sqft && deal.lease_rate_psf && deal.lease_term_years && deal.commission_pct) {
      const gross = deal.sqft * deal.lease_rate_psf * deal.lease_term_years * (deal.commission_pct / 100)
      derivation = `${fmtSF(deal.sqft)} × $${deal.lease_rate_psf}/SF × ${deal.lease_term_years}yr × ${fmtPct(deal.commission_pct)} × 75% house`
    } else if (!isLease && deal.asking_price && deal.commission_pct) {
      derivation = `${fmt(deal.asking_price)} × ${fmtPct(deal.commission_pct)} × 75% house`
    }
  }

  return (
    <button
      onClick={() => setRevealed(v => !v)}
      style={{
        width: '100%',
        height: 56,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderTop: '1px solid rgba(255,255,255,0.10)',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        padding: '0 20px',
        boxSizing: 'border-box',
        gap: 4,
      } as React.CSSProperties}
    >
      {!revealed ? (
        // Hidden state: label only, NO figure, NO glow
        <span style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: T.textLow,
          lineHeight: 1,
        }}>EST. COMMISSION</span>
      ) : (
        // Revealed: figure + derivation
        <>
          {hasData ? (
            <span style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: T.brandLift,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}>{fmt(commission)}</span>
          ) : (
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: T.textLow, lineHeight: 1 }}>
              No data
            </span>
          )}
          {derivation ? (
            <span style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              fontWeight: 400,
              color: T.textLow,
              letterSpacing: '0.05em',
              lineHeight: 1,
              textAlign: 'center',
            }}>{derivation}</span>
          ) : null}
        </>
      )}
    </button>
  )
}

// ── Section row — ITEM 72 ─────────────────────────────────────────────────────
// Rows DO NOT navigate. Arrow glyphs on CONTACTS and DOCUMENTS struck.
function SectionRow({ label, meta }: { label: string; meta?: string }) {
  return (
    <div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.10)' }} />
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '18px 20px',
        minHeight: 56,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 18,
            fontWeight: 500,
            color: T.textHi,
            lineHeight: 1.25,
          }}>{label}</div>
          {meta && (
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 13,
              fontWeight: 400,
              color: T.textMid,
              lineHeight: 1.4,
              marginTop: 4,
            }}>{meta}</div>
          )}
        </div>
        {/* NO arrow glyph — item 72: rows DO NOT navigate */}
      </div>
    </div>
  )
}

// ── Economics grid cell ───────────────────────────────────────────────────────
function EconCell({ label, value, fullWidth }: { label: string; value: string; fullWidth?: boolean }) {
  return (
    <div style={{
      gridColumn: fullWidth ? '1 / -1' : undefined,
      padding: '12px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{
        fontFamily: FONT_MONO,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: '0.11em',
        textTransform: 'uppercase',
        color: T.textLow,
        lineHeight: 1,
        marginBottom: 5,
      }}>{label}</div>
      <div style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 16,
        fontWeight: 500,
        color: T.textHi,
        lineHeight: 1.2,
      }}>{value}</div>
    </div>
  )
}

// ── Main page content ─────────────────────────────────────────────────────────
function DealPageContent() {
  const router = useRouter()
  const [dealId, setDealId] = useState<string | null>(null)
  const [deal, setDeal] = useState<DealData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const commissionRef = useRef<HTMLDivElement>(null)
  const [padBottom, setPadBottom] = useState(104)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setDealId(params.get('id'))
  }, [])

  useEffect(() => {
    if (!commissionRef.current) return
    const el = commissionRef.current
    const observer = new ResizeObserver(() => {
      const vh = window.innerHeight
      const rect = el.getBoundingClientRect()
      const scrollEl = document.querySelector('[data-scroll-deal]') as HTMLElement | null
      if (!scrollEl) return
      const containerTop = scrollEl.getBoundingClientRect().top
      const rowH = el.offsetHeight
      const needed = vh - containerTop - rowH
      setPadBottom(Math.max(104, needed))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [deal])

  useEffect(() => {
    if (!dealId) return
    ;(async () => {
      try {
        // Core deal
        const { data: dealData, error: dealErr } = await supabase
          .from('deals')
          .select('id, name, address, addr_display, addr_street_name, addr_street_type, addr_direction, addr_number, addr_city, status, property_type, portfolio_id, dropbox_link, acreage')
          .eq('id', dealId)
          .single()
        if (dealErr || !dealData) { setError(true); setLoading(false); return }

        // Economics
        const { data: econData } = await supabase
          .from('deal_economics')
          .select('asking_price, sqft, land_sqft, sale_commission_pct, lease_rate_psf, lease_term_years, nnn_psf, transaction_type')
          .eq('deal_id', dealId)
          .maybeSingle()

        // Contacts
        const { data: contactData } = await supabase
          .from('contacts')
          .select('id, name, phone, role')
          .eq('deal_id', dealId)
          .limit(20)

        // Chain steps
        const { data: chainData } = await supabase
          .from('chain_steps')
          .select('id, status')
          .eq('deal_id', dealId)
          .limit(100)

        const isLease = econData?.transaction_type === 'lease'
        let est_commission: number | null = null
        if (isLease) {
          est_commission = calcLeaseCommission(
            econData?.sqft ?? null,
            econData?.lease_rate_psf ?? null,
            econData?.lease_term_years ?? null,
            econData?.sale_commission_pct ?? null,
          )
        } else {
          est_commission = calcSaleCommission(
            econData?.asking_price ?? null,
            econData?.sale_commission_pct ?? null,
          )
        }

        const chainSteps  = (chainData ?? []) as any[]
        const chainDone   = chainSteps.filter((s: any) => s.status === 'done' || s.status === 'complete').length
        const chainTotal  = chainSteps.length

        const d: DealData = {
          ...(dealData as any),
          transaction_type: econData?.transaction_type ?? null,
          asking_price:     econData?.asking_price ?? null,
          sqft:             econData?.sqft ?? null,
          land_size:        econData?.land_sqft ?? null,
          commission_pct:   econData?.sale_commission_pct ?? null,
          est_commission,
          lease_rate_psf:   econData?.lease_rate_psf ?? null,
          lease_term_years: econData?.lease_term_years ?? null,
          nnn_psf:          econData?.nnn_psf ?? null,
          contacts:         (contactData ?? []) as ContactData[],
          chain_done:       chainDone,
          chain_total:      chainTotal,
        }

        setDeal(d)
      } catch { setError(true) }
      setLoading(false)
    })()
  }, [dealId])

  function goBack() {
    router.back()
  }

  if (loading) {
    return (
      <div style={{ background: T.bgBase, height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ ...STYLE_T1, color: T.textLow }}>Loading…</span>
      </div>
    )
  }

  if (error || !deal) {
    return (
      <div style={{ background: T.bgBase, height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 500, color: T.textHi }}>Deal not found</div>
        <button onClick={goBack} style={{ background: 'none', border: 'none', color: T.brandLift, fontFamily: FONT_DISPLAY, fontSize: 14, cursor: 'pointer' }}>
          Swipe right to go back
        </button>
      </div>
    )
  }

  const isLease = deal.transaction_type === 'lease'
  const addr = formatAddress(deal) || deal.name || '—'
  const clientName = deal.name && deal.name !== deal.address ? deal.name : null

  // ── ITEM 68 — Type plates (up to two) ─────────────────────────────────────
  // Transaction plate: sale or lease (from deal_economics.transaction_type)
  // Property plate: from deals.property_type
  // HOT does NOT render.
  const txPlate  = deal.transaction_type ? TRANSACTION_PLATES[deal.transaction_type.toLowerCase()] ?? null : null
  const propType = deal.property_type?.toUpperCase() ?? null
  const propPlate = propType ? (PROPERTY_PLATES[propType] ?? null) : null
  // Up to two plates max
  const plates: string[] = []
  if (txPlate)   plates.push(txPlate)
  if (propPlate) plates.push(propPlate)

  // ── ITEM 69 — Economics cells (flowing, facts that exist only) ─────────────
  const econCells: { label: string; value: string }[] = []
  if (isLease) {
    if (deal.lease_rate_psf != null)   econCells.push({ label: 'Lease Rate/SF',  value: `$${deal.lease_rate_psf}/SF` })
    if (deal.lease_term_years != null) econCells.push({ label: 'Lease Term',      value: `${deal.lease_term_years} yr` })
    if (deal.sqft != null)             econCells.push({ label: 'Building SF',     value: fmtSF(deal.sqft) })
    if (deal.nnn_psf != null)          econCells.push({ label: 'NNN/SF',          value: `$${deal.nnn_psf}/SF` })
    if (deal.land_size != null)        econCells.push({ label: 'Land Size',       value: fmtAcres(deal.land_size) })
    if (deal.acreage != null)          econCells.push({ label: 'Acreage',         value: fmtAcres(deal.acreage) })
    if (deal.commission_pct != null)   econCells.push({ label: 'Commission %',    value: fmtPct(deal.commission_pct) })
  } else {
    if (deal.asking_price != null)     econCells.push({ label: 'Asking Price',    value: fmt(deal.asking_price) })
    if (deal.sqft != null)             econCells.push({ label: 'Building SF',     value: fmtSF(deal.sqft) })
    if (deal.asking_price != null && deal.sqft != null) econCells.push({ label: 'Price/SF', value: fmtPSF(deal.asking_price, deal.sqft) })
    if (deal.land_size != null)        econCells.push({ label: 'Land Size',       value: fmtAcres(deal.land_size) })
    if (deal.acreage != null)          econCells.push({ label: 'Acreage',         value: fmtAcres(deal.acreage) })
    if (deal.commission_pct != null)   econCells.push({ label: 'Commission %',    value: fmtPct(deal.commission_pct) })
  }
  // Odd count: last gets full width
  const isOdd = econCells.length % 2 !== 0

  // ── ITEM 72 — Section rows ─────────────────────────────────────────────────
  const chainMeta = deal.chain_total
    ? `${deal.chain_done ?? 0} / ${deal.chain_total} done`
    : undefined
  const chainLabel = `Chain${deal.transaction_type ? ' · ' + deal.transaction_type.charAt(0).toUpperCase() + deal.transaction_type.slice(1) : ''}`

  return (
    <SwipeBackWrapper onBack={goBack}>
      <div data-scroll-deal style={{
        background: T.bgBase,
        minHeight: '100dvh',
        paddingBottom: 0,
        overflowY: 'auto',
      }}>

        {/* ── ITEM 67 — HEADER ──────────────────────────────────────────────────
            NO back control, NO three-dot, NO edit, NO status pill.
            Address 19px, client 12.5px below.
            Type plates at right end. HOT does NOT render.
        */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '20px 18px 16px',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)',
        }}>
          {/* Address + client */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 19,
              fontWeight: 500,
              color: T.textHi,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>{addr}</div>
            {clientName && (
              <div style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 12.5,
                fontWeight: 400,
                color: T.textMid,
                lineHeight: 1.3,
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>{clientName}</div>
            )}
          </div>

          {/* ── ITEM 68 — TYPE PLATES (right-aligned, up to two) ─────────────
              One transaction plate over one property plate, 6px apart.
              Mount 22px tall. HEIGHT ONLY, never width.
              Plates are INERT. No CSS border/fill/radius/glow.
          */}
          {plates.length > 0 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              flexShrink: 0,
              alignItems: 'flex-end',
            }}>
              {plates.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  style={{ height: 22, width: 'auto', display: 'block' }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── ITEM 71 — PHOTO ───────────────────────────────────────────────────
            16:9 within gutters, radius 14, placeholder when absent.
        */}
        <div style={{ padding: '0 18px', marginBottom: 16 }}>
          <div style={{
            width: '100%',
            paddingTop: '56.25%',
            borderRadius: 14,
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.04)',
            position: 'relative',
          }}>
            {/* No photo column exists in deals table (confirmed 2026-08-31) — placeholder is the correct state */}
          </div>
        </div>

        {/* ── ITEM 69 — ECONOMICS ───────────────────────────────────────────────
            Flowing two-column grid. Only renders facts that exist.
            No dashes in empty fields. Odd count: last gets full width.
            First row: 2px above header client line (via padding), 13px below.
        */}
        {econCells.length > 0 && (
          <div style={{ padding: '0 18px', marginBottom: 16 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              background: T.bgPanel,
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              {econCells.map((cell, i) => {
                const isLast = i === econCells.length - 1
                const lastFull = isLast && isOdd
                return (
                  <EconCell
                    key={i}
                    label={cell.label}
                    value={cell.value}
                    fullWidth={lastFull}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* ── ITEM 70 — LACDB LINK ─────────────────────────────────────────────
            56px tall. Centered. lacdb-link-h168.png at h56, NO width typed.
            No CSS border/fill/radius/glow. No URL text. No arrow.
            LACDB pill in photo corner: STRUCK (removed above).
            This is tap-reactive object #1 (item 76).
        */}
        <div style={{ padding: '0 18px', marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
          {deal.dropbox_link ? (
            <a
              href={deal.dropbox_link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                height: 56,
                WebkitTapHighlightColor: 'transparent',
                // NO border, fill, radius, glow
              } as React.CSSProperties}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/lacdb/lacdb-link-h168.png"
                alt="LACDB"
                style={{ height: 56, width: 'auto', display: 'block' }}
              />
            </a>
          ) : (
            // No link: still render the image centered but inert
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/assets/lacdb/lacdb-link-h168.png"
              alt="LACDB"
              style={{ height: 56, width: 'auto', display: 'block', opacity: 0.3 }}
            />
          )}
        </div>

        {/* ── ITEM 72 — SECTION ROWS ────────────────────────────────────────────
            CHAIN + type, CONTACTS, DOCUMENTS, NOTES.
            These rows DO NOT navigate. Arrow glyphs struck.
            CONTACTS: phone numbers are tap-reactive (item 76, object #2).
        */}
        <div style={{ marginBottom: 0 }}>
          {/* Chain + type */}
          <SectionRow label={chainLabel} meta={chainMeta} />

          {/* CONTACTS — phone tap is reactive object #2 */}
          {(deal.contacts && deal.contacts.length > 0) ? (
            <>
              <div>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.10)' }} />
                <div style={{ padding: '14px 20px 2px' }}>
                  <div style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 18,
                    fontWeight: 500,
                    color: T.textHi,
                    lineHeight: 1.25,
                    marginBottom: 10,
                  }}>Contacts</div>
                  {deal.contacts.map(c => (
                    <div key={c.id} style={{ marginBottom: 10 }}>
                      {c.name && (
                        <div style={{
                          fontFamily: FONT_DISPLAY,
                          fontSize: 14,
                          fontWeight: 500,
                          color: T.textHi,
                          lineHeight: 1.3,
                        }}>{c.name}</div>
                      )}
                      {c.role && (
                        <div style={{
                          fontFamily: FONT_DISPLAY,
                          fontSize: 12,
                          color: T.textLow,
                          lineHeight: 1.3,
                        }}>{c.role}</div>
                      )}
                      {/* Phone — ITEM 76/88A: tap-reactive object #2. tel: link wrapping only the number. */}
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          style={{
                            fontFamily: FONT_MONO,
                            fontSize: 14,
                            fontWeight: 500,
                            color: T.brandLift,
                            lineHeight: 1.4,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            minWidth: 44,
                            minHeight: 44,
                            WebkitTapHighlightColor: 'transparent',
                          } as React.CSSProperties}
                        >
                          {c.phone}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <SectionRow label="Contacts" />
          )}

          <SectionRow label="Documents" />
          <SectionRow label="Notes" />
        </div>

        {/* ── ITEM 73 — COMMISSION REVEAL ─────────────────────────────────────
            56px band above 104px tail. Hairline on top.
            Default: label in mono, NO figure, NO glow.
            Press: reveals figure + derivation line.
            Press again: hides. No persistence.
            Tap-reactive object #3 (item 76).
        */}
        <div ref={commissionRef}>
          <CommissionReveal deal={deal} />
        </div>

        {/* ── 104px tail (item 73 spec: 104px tail below commission band) ─── */}
        <div style={{ height: padBottom }} />
      </div>
    </SwipeBackWrapper>
  )
}

export default function DealPage() {
  return (
    <Suspense fallback={
      <div style={{ background: '#08080C', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#8E8CA0', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Loading…</span>
      </div>
    }>
      <DealPageContent />
    </Suspense>
  )
}

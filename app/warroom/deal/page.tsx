'use client'

// §D5.1 Desktop deal page — locked design 33a (13 Aug 2026). Round 1: read state only.
// "The phone reads the deal, the desktop works it." — desktop two-column layout.
// Route: /warroom/deal?id=<uuid>

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatAddress } from '@/lib/formatAddress'
import Launch from '@/components/warroom3/Launch'

// ── Tokens §2 ────────────────────────────────────────────────────────────────
const T = {
  bgBase:      '#08080C',
  bgPanel:     '#101017',
  bgRaise:     '#16161F',
  textHi:      '#EFEEF4',
  textMid:     '#8B8A9B',
  textLow:     '#5C5B6B',
  brand:       '#8B5CF6',
  brandLift:   '#A78BFA',
  brandStrong: '#7C3AED',
  moneyIn:     '#34D399',
  late:        '#FF4D4D',
  hot:         '#FFA23A',
} as const

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

// ── Type scale ────────────────────────────────────────────────────────────────
// M0 — 22px / 500 / -0.01em tabular — snapshot lead figures
const STYLE_M0: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 22,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.1,
}
// M1 — 17px mono tabular — numbers in read rows
const STYLE_M1: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 17,
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.1,
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

// ── ReadRow ───────────────────────────────────────────────────────────────────
function ReadRow({ label, value, numeric }: { label: string; value: string; numeric?: boolean }) {
  const isNumber = numeric ?? /^[\$\d]/.test(value)
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '10px 0',
    }}>
      <span style={{
        fontFamily: FONT_MONO,
        fontSize: 9.5,
        fontWeight: 500,
        letterSpacing: '0.19em',
        textTransform: 'uppercase',
        color: T.textLow,
        lineHeight: 1,
      }}>
        {label}
      </span>
      <span style={
        isNumber
          ? { ...STYLE_M1, color: T.textHi }
          : { fontFamily: FONT_DISPLAY, fontSize: 14.5, fontWeight: 400, color: T.textHi, lineHeight: 1.3 }
      }>
        {value}
      </span>
    </div>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: T.bgRaise,
      borderRadius: 14,
      overflow: 'hidden',
      borderTop: `3px solid rgba(139,92,246,0.4)`,
      ...style,
    }}>
      {children}
    </div>
  )
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: FONT_MONO,
      fontSize: 9.5,
      fontWeight: 500,
      letterSpacing: '0.19em',
      textTransform: 'uppercase' as const,
      color: T.textLow,
      padding: '16px 18px 0',
      lineHeight: 1,
    }}>
      {children}
    </div>
  )
}

// ── Pill ──────────────────────────────────────────────────────────────────────
function Pill({ children, filled, color }: { children: React.ReactNode; filled?: boolean; color?: string }) {
  const c = color ?? T.brand
  return (
    <span style={{
      fontFamily: FONT_MONO,
      fontSize: 9.5,
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
      padding: '4px 9px',
      borderRadius: 5,
      background: filled ? c : 'transparent',
      border: filled ? 'none' : `1px solid rgba(255,255,255,0.18)`,
      color: filled ? '#0A0A0F' : T.textMid,
      lineHeight: 1,
    }}>
      {children}
    </span>
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
  lacdb_url?: string | null
  photo_url?: string | null
  transaction_type?: string | null
  asking_price?: number | null
  sqft?: number | null
  land_size?: number | null
  deal_value?: number | null
  commission_pct?: number | null
  est_commission?: number | null
  lease_rate_psf?: number | null
  lease_term_years?: number | null
  nnn_psf?: number | null
}

interface ContactRow {
  contact_id: string
  contacts: {
    id: string
    name: string | null
    role: string | null
    email: string | null
    phone: string | null
  } | null
}

// ── Main page content ─────────────────────────────────────────────────────────
function DealPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dealId = searchParams.get('id')

  const [pinValid, setPinValid] = useState<boolean | null>(null)
  const [deal, setDeal] = useState<DealData | null>(null)
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [launched, setLaunched] = useState(false)

  // PIN gate check — accept either session key (desktop uses wr_session_exp_v2, mobile uses wr3_session_exp)
  useEffect(() => {
    const exp1 = parseInt(localStorage.getItem('wr_session_exp_v2') || '0')
    const exp2 = parseInt(localStorage.getItem('wr3_session_exp') || '0')
    setPinValid(Date.now() < exp1 || Date.now() < exp2)
  }, [])

  // Data fetch
  useEffect(() => {
    if (!dealId) { setError(true); setLoading(false); return }
    ;(async () => {
      try {
        const { data: dealData, error: dealErr } = await supabase
          .from('deals')
          .select('id,name,address,status,property_type,portfolio_id,lacdb_url,photo_url')
          .eq('id', dealId)
          .single()
        if (dealErr || !dealData) { setError(true); setLoading(false); return }

        const { data: econData } = await supabase
          .from('deal_economics')
          .select('asking_price,sqft,land_size,deal_value,sale_commission_pct,lease_rate_psf,lease_term_years,nnn_psf,transaction_type')
          .eq('deal_id', dealId)
          .maybeSingle()

        const { data: contactData } = await supabase
          .from('deal_contacts')
          .select('contact_id, contacts(id,name,role,email,phone)')
          .eq('deal_id', dealId)
          .limit(3)

        const d: DealData = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(dealData as any) as DealData,
          transaction_type: econData?.transaction_type ?? null,
          asking_price:     econData?.asking_price ?? null,
          sqft:             econData?.sqft ?? null,
          land_size:        econData?.land_size ?? null,
          deal_value:       econData?.deal_value ?? null,
          commission_pct:   econData?.sale_commission_pct ?? null,
          lease_rate_psf:   econData?.lease_rate_psf ?? null,
          lease_term_years: econData?.lease_term_years ?? null,
          nnn_psf:          econData?.nnn_psf ?? null,
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
        setContacts((contactData as ContactRow[] | null) ?? [])
      } catch { setError(true) }
      setLoading(false)
    })()
  }, [dealId])

  // ── Loading ──
  if (pinValid === null || loading) {
    return (
      <div style={{ background: T.bgBase, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textLow }}>
          Loading…
        </span>
      </div>
    )
  }

  // ── PIN gate ──
  if (!pinValid) {
    return (
      <div style={{
        background: T.bgBase,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={T.textLow} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.19em', textTransform: 'uppercase', color: T.textLow }}>
          Session expired
        </div>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: `1px solid rgba(255,255,255,0.13)`,
            borderRadius: 6,
            padding: '7px 14px',
            fontFamily: FONT_MONO,
            fontSize: 9.5,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: T.textMid,
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
      </div>
    )
  }

  // ── Error ──
  if (error || !deal) {
    return (
      <div style={{ background: T.bgBase, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 500, color: T.textHi }}>Deal not found</div>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: T.brandLift, fontFamily: FONT_DISPLAY, fontSize: 14, cursor: 'pointer' }}>
          ← Go back
        </button>
      </div>
    )
  }

  const isLease = deal.transaction_type === 'lease'
  const addr = formatAddress(deal.address) || deal.name || '—'
  const addrParts = (deal.address || '').split(',')
  const street = addrParts[0]?.trim() || addr
  const cityState = addrParts.slice(1).join(',').trim() || ''
  const isHot = deal.status === 'hot'
  const txType = deal.transaction_type ? deal.transaction_type.replace(/_/g, ' ') : null
  const propType = deal.property_type ? deal.property_type.replace(/_/g, ' ') : null

  // ── Glance strip fields ──
  const glanceCells = isLease
    ? [
        { label: 'Lease Rate/SF',  value: deal.lease_rate_psf ? `$${deal.lease_rate_psf}/SF` : '—' },
        { label: 'Building SF',    value: fmtSF(deal.sqft) },
        { label: 'NNN/SF',         value: deal.nnn_psf ? `$${deal.nnn_psf}/SF` : '—' },
        { label: 'Lease Term',     value: deal.lease_term_years ? `${deal.lease_term_years} YR` : '—' },
        { label: 'Deal Value',     value: fmt(deal.deal_value ?? deal.asking_price) },
        { label: 'Est. Commission', value: fmt(deal.est_commission), glow: true },
      ]
    : [
        { label: 'Asking Price',   value: fmt(deal.asking_price) },
        { label: 'Price/SF',       value: fmtPSF(deal.asking_price ?? null, deal.sqft ?? null) },
        { label: 'Building SF',    value: fmtSF(deal.sqft) },
        { label: 'Land Size',      value: fmtAcres(deal.land_size) },
        { label: 'Deal Value',     value: fmt(deal.deal_value ?? deal.asking_price) },
        { label: 'Est. Commission', value: fmt(deal.est_commission), glow: true },
      ]

  return (
    <div style={{ background: T.bgBase, minHeight: '100vh' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '18px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        {/* Back link */}
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: FONT_MONO,
            fontSize: 9.5,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: T.textLow,
            whiteSpace: 'nowrap',
          }}
        >
          ← Deals
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* Address block */}
        <div style={{ flexShrink: 0 }}>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 23,
            fontWeight: 500,
            color: T.textHi,
            lineHeight: 1.15,
          }}>
            {street}
          </div>
          {cityState && (
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 14,
              color: T.textLow,
              lineHeight: 1.3,
              marginTop: 2,
            }}>
              {cityState}
            </div>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Status pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isHot && <Pill filled color={T.hot}>HOT</Pill>}
          {txType && <Pill>{txType}</Pill>}
          {propType && <Pill>{propType}</Pill>}
        </div>

        {/* Edit button — read-only round 1 */}
        <button
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.13)',
            borderRadius: 6,
            padding: '6px 12px',
            fontFamily: FONT_MONO,
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: T.textMid,
            cursor: 'default',
            flexShrink: 0,
          }}
        >
          Edit
        </button>
      </div>

      {/* ── Six-slot glance strip ───────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 32px',
      }}>
        {glanceCells.map((cell, i) => (
          <div
            key={i}
            style={{
              padding: '14px 0',
              borderRight: i < 5 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              paddingLeft: i === 0 ? 0 : 16,
              paddingRight: i === 5 ? 0 : 16,
            }}
          >
            <div style={{
              fontFamily: FONT_MONO,
              fontSize: 9.5,
              fontWeight: 500,
              letterSpacing: '0.19em',
              textTransform: 'uppercase',
              color: T.textLow,
              lineHeight: 1,
              marginBottom: 6,
            }}>
              {cell.label}
            </div>
            <div style={{
              ...STYLE_M0,
              color: cell.glow ? T.brandLift : T.textHi,
              textShadow: cell.glow ? '0 0 22px rgba(167,139,250,0.35)' : undefined,
            }}>
              {cell.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Two-column grid ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: 22,
        maxWidth: 1440,
        margin: '0 auto',
        padding: '22px 32px',
        minHeight: 'calc(100vh - 140px)',
      }}>

        {/* ── LEFT: Main column ─────────────────────────────────────────────── */}
        <div style={{
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>

          {/* 1 — LACDB card */}
          <Card>
            <CardLabel>LACDB</CardLabel>
            <div style={{ padding: '12px 18px 18px' }}>
              {deal.lacdb_url ? (
                <>
                  {deal.photo_url && (
                    <div style={{ float: 'left', width: '58%', marginRight: 16, marginBottom: 8, borderRadius: 8, overflow: 'hidden' }}>
                      <img
                        src={deal.photo_url}
                        alt={street}
                        style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: 180 }}
                      />
                    </div>
                  )}
                  <a
                    href={deal.lacdb_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: T.brandLift,
                      textDecoration: 'none',
                      display: 'inline-block',
                      marginBottom: 12,
                    }}
                  >
                    Open on LACDB ↗
                  </a>
                  <div style={{ clear: 'both' }} />
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0 24px',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    paddingTop: 8,
                  }}>
                    <ReadRow label="Listing Status" value="—" numeric={false} />
                    <ReadRow label="Days on Market" value="—" />
                    <ReadRow label="List Date" value="—" numeric={false} />
                    <ReadRow label="Last Synced" value="—" numeric={false} />
                  </div>
                </>
              ) : (
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow, padding: '4px 0 6px' }}>
                  No LACDB listing linked.
                </div>
              )}
            </div>
          </Card>

          {/* 2 — DEAL ECONOMICS card */}
          <Card>
            <CardLabel>Deal Economics</CardLabel>
            <div style={{ padding: '12px 18px 18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0 24px' }}>
                <ReadRow label="Asking Price" value={fmt(deal.asking_price)} />
                <ReadRow label="Deal Value" value={fmt(deal.deal_value ?? deal.asking_price)} />
                <ReadRow label="Building SF" value={fmtSF(deal.sqft)} />
                <ReadRow label="Land Size" value={fmtAcres(deal.land_size)} />
                {isLease ? (
                  <>
                    <ReadRow label="Lease Rate/SF" value={deal.lease_rate_psf ? `$${deal.lease_rate_psf}/SF` : '—'} />
                    <ReadRow label="NNN/SF" value={deal.nnn_psf ? `$${deal.nnn_psf}/SF` : '—'} />
                    <ReadRow label="Lease Term" value={deal.lease_term_years ? `${deal.lease_term_years} YR` : '—'} numeric={false} />
                    <ReadRow label="Est. Commission" value={fmt(deal.est_commission)} />
                  </>
                ) : (
                  <>
                    <ReadRow label="Price/SF" value={fmtPSF(deal.asking_price ?? null, deal.sqft ?? null)} />
                    <ReadRow label="Commission %" value={deal.commission_pct ? `${deal.commission_pct}%` : '—'} numeric={false} />
                    <ReadRow label="Est. Commission" value={fmt(deal.est_commission)} />
                    <ReadRow label="Transaction Type" value={txType || '—'} numeric={false} />
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* 3 — SHOWINGS & PROSPECTS card */}
          <Card>
            <CardLabel>Showings &amp; Prospects</CardLabel>
            <div style={{ padding: '10px 18px 18px' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textLow, marginBottom: 10 }}>
                0 Showings
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
                No showings recorded.
              </div>
            </div>
          </Card>

          {/* 4 — DOCUMENTS card */}
          <Card>
            <CardLabel>Documents</CardLabel>
            <div style={{ padding: '10px 18px 18px' }}>
              <a
                href="#"
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: T.brandLift,
                  textDecoration: 'none',
                  display: 'inline-block',
                  marginBottom: 10,
                }}
              >
                Dropbox folder ↗
              </a>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
                No files.
              </div>
            </div>
          </Card>

          {/* 5 — NOTES card */}
          <Card>
            <CardLabel>Notes</CardLabel>
            <div style={{ padding: '10px 18px 18px' }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>
                No notes.
              </div>
            </div>
          </Card>

          {/* 6 — ACTIVITY card */}
          <Card>
            <CardLabel>Activity</CardLabel>
            <div style={{ padding: '10px 18px 18px' }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>
                No activity.
              </div>
            </div>
          </Card>

        </div>

        {/* ── RIGHT rail ────────────────────────────────────────────────────── */}
        <div style={{
          position: 'sticky',
          top: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignSelf: 'start',
        }}>

          {/* 1 — LAUNCH DEAL */}
          <Launch
            launched={launched}
            onClick={() => setLaunched((v: boolean) => !v)}
            label="LAUNCH DEAL"
          />

          {/* 2 — Money card */}
          <Card>
            <CardLabel>Money</CardLabel>
            <div style={{ padding: '12px 18px 18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ReadRow label="Collected" value="—" />
                <ReadRow label="Outstanding" value="—" />
              </div>
              {/* Split progress bar */}
              <div style={{
                marginTop: 14,
                height: 4,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.07)',
                overflow: 'hidden',
                display: 'flex',
              }}>
                <div style={{ width: '0%', background: T.moneyIn, height: '100%' }} />
                <div style={{ flex: 1, background: T.brand, height: '100%', opacity: 0.25 }} />
              </div>
            </div>
          </Card>

          {/* 3 — Contacts card */}
          <Card>
            <CardLabel>Contacts</CardLabel>
            <div style={{ padding: '12px 18px 18px' }}>
              {contacts.length === 0 ? (
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>
                  No contacts.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {contacts.map((row) => {
                    const c = row.contacts
                    if (!c) return null
                    return (
                      <div key={row.contact_id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingBottom: 10,
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                      }}>
                        <div>
                          <div style={{
                            fontFamily: FONT_DISPLAY,
                            fontSize: 13,
                            fontWeight: 500,
                            color: T.textHi,
                            lineHeight: 1.3,
                          }}>
                            {c.name || '—'}
                          </div>
                          <div style={{
                            fontFamily: FONT_MONO,
                            fontSize: 9.5,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: T.textLow,
                            marginTop: 2,
                          }}>
                            {c.role || 'Contact'}
                          </div>
                        </div>
                        <span style={{
                          fontFamily: FONT_MONO,
                          fontSize: 11,
                          color: T.textLow,
                          cursor: 'default',
                        }}>
                          ↗
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* 4 — Chain card */}
          <Card>
            <CardLabel>Chain</CardLabel>
            <div style={{ padding: '10px 18px 18px' }}>
              <div style={{
                fontFamily: FONT_MONO,
                fontSize: 9.5,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: T.textLow,
                marginBottom: 8,
              }}>
                {txType || 'Sale'}
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
                No open steps.
              </div>
            </div>
          </Card>

        </div>
      </div>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function DealPage() {
  return (
    <Suspense fallback={
      <div style={{ background: '#08080C', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#5C5B6B', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Loading…
        </span>
      </div>
    }>
      <DealPageContent />
    </Suspense>
  )
}

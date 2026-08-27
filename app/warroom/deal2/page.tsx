'use client'
/**
 * /warroom/deal2?id=<uuid> — Parallel desktop deal page. Stage 1.
 * Items 34-50. DESKTOP-ONLY (1024px+). Not responsive.
 *
 * RULES:
 * - Production route /warroom/deal and file app/warroom/deal/page.tsx: NOT TOUCHED.
 * - Shared files (lib/dealMath.ts, lib/formatAddress.ts, lib/supabase.ts,
 *   components/warroom3/Launch.jsx, assets/launch/launch.css, assets/fab/fab.css): READ ONLY.
 * - Classification: deals.property_type (OFFICE/LAND/RETAIL/INDUSTRIAL/MULTIFAMILY).
 *   NOT deal_economics.property_type (free-text vocabulary).
 * - Commission: sale_commission_pct or lease_commission_pct from deal_economics.
 *   HOUSE_SPLIT from lib/dealMath.ts. No final dollar figure rendered.
 * - developer role: commission block absent entirely.
 * - Money rail: placeholder only. No figures.
 * - ACCEPTED NUMBER SLOT: does not render pre-offer.
 * - Launch: desktop-local component. No blend mode on video.
 */

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatAddress } from '@/lib/formatAddress'
import { HOUSE_SPLIT } from '@/lib/dealMath'
import LaunchControl from './LaunchControl'

// ── Design tokens (spec §2) ──────────────────────────────────────────────────
const T = {
  bgBase:       '#08080C',
  bgPanel:      '#12111B',
  bgRaise:      '#1E1D26',
  textHi:       '#EFEEF4',
  textMid:      '#B8B6C6',
  textLow:      '#8E8CA0',
  brand:        '#8B5CF6',
  brandLift:    '#A78BFA',
  brandStrong:  '#7C3AED',
  moneyIn:      '#34D399',
  late:         '#FF4D4D',
  hot:          '#FFA23A',
  border:       'rgba(255,255,255,0.14)',
  borderPanel:  'rgba(255,255,255,0.11)',
  borderHair:   'rgba(255,255,255,0.10)',
} as const

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

// ── Type scale ───────────────────────────────────────────────────────────────
// M0 — 22px Space Grotesk 500 — glance strip lead figures (spec: Space Grotesk not mono)
const STYLE_M0: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 22,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.1,
}

// LABEL_UPPER — 9.5px mono uppercase
const STYLE_LABEL: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9.5,
  fontWeight: 500,
  letterSpacing: '0.19em',
  textTransform: 'uppercase',
  color: T.textLow,
  lineHeight: 1,
}

// ── Plate map (item 38) ───────────────────────────────────────────────────────
// Uses deals.property_type (uppercase vocabulary: OFFICE, LAND, RETAIL, INDUSTRIAL, MULTIFAMILY)
const PROPERTY_PLATE_MAP: Record<string, string> = {
  OFFICE:      '/assets/plates/plate-office-v7.png',
  RETAIL:      '/assets/plates/plate-retail-v7.png',
  LAND:        '/assets/plates/plate-land-v7.png',
  INDUSTRIAL:  '/assets/plates/plate-indst-v7.png',
  MULTIFAMILY: '/assets/plates/plate-multi-v7.png',
}

// Transaction plates
const TX_PLATE_MAP: Record<string, string> = {
  sale:  '/assets/plates/plate-sale-v7.png',
  lease: '/assets/plates/plate-lease-v7.png',
}

// ── Panel / card primitives ──────────────────────────────────────────────────
function Panel({
  label,
  children,
  style,
}: {
  label: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      background: T.bgRaise,
      borderRadius: 12,
      border: `1px solid ${T.borderPanel}`,
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{
        ...STYLE_LABEL,
        padding: '14px 18px 0',
        marginBottom: 10,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      fontFamily: FONT_DISPLAY,
      fontSize: 13,
      color: T.textLow,
      padding: '0 18px 16px',
      lineHeight: 1.5,
    }}>
      {text}
    </div>
  )
}

// ── Data types ───────────────────────────────────────────────────────────────
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
  addr_zip?: string | null
  status: string
  property_type: string | null       // from deals table — uppercase vocabulary
  dropbox_link?: string | null
  representation_role?: string | null
}

interface DealEcon {
  transaction_type: string | null
  asking_price: number | null
  sqft: number | null
  land_sqft: number | null
  sale_commission_pct: number | null
  lease_commission_pct: number | null
  lease_rate_psf: number | null
  lease_term_years: number | null
  nnn_psf: number | null
  lease_commission_pct2?: number | null
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

interface NoteRow {
  id: string
  body: string | null
  created_at: string
}

interface ActivityRow {
  id: string
  action_type: string
  description: string | null
  created_at: string
}

// ── Formatters ───────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
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

function fmtPSF(price: number | null | undefined, sf: number | null | undefined): string {
  if (!price || !sf) return '—'
  return `$${(price / sf).toFixed(2)}/SF`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ── Main page content ────────────────────────────────────────────────────────
function Deal2PageContent() {
  const router = useRouter()

  // Static export: read id from window.location.search client-side
  const [dealId, setDealId] = useState<string | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setDealId(params.get('id'))
  }, [])

  const [deal, setDeal] = useState<DealData | null>(null)
  const [econ, setEcon] = useState<DealEcon | null>(null)
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // PIN gate — accept either session key
  const [pinValid, setPinValid] = useState<boolean | null>(null)
  useEffect(() => {
    const exp1 = parseInt(localStorage.getItem('wr_session_exp_v2') || '0')
    const exp2 = parseInt(localStorage.getItem('wr3_session_exp') || '0')
    setPinValid(Date.now() < exp1 || Date.now() < exp2)
  }, [])

  useEffect(() => {
    if (!dealId) return
    ;(async () => {
      try {
        // Core deal — include representation_role for commission block logic
        const { data: dealData, error: dealErr } = await supabase
          .from('deals')
          .select('id,name,address,addr_display,addr_street_name,addr_street_type,addr_direction,addr_number,addr_city,status,property_type,dropbox_link,representation_role')
          .eq('id', dealId)
          .single()
        if (dealErr || !dealData) { setError(true); setLoading(false); return }

        // Economics
        const { data: econData } = await supabase
          .from('deal_economics')
          .select('transaction_type,asking_price,sqft,land_sqft,sale_commission_pct,lease_commission_pct,lease_rate_psf,lease_term_years,nnn_psf')
          .eq('deal_id', dealId)
          .maybeSingle()

        // Contacts (up to 3)
        const { data: contactData } = await supabase
          .from('deal_contacts')
          .select('contact_id, contacts(id,name,role,email,phone)')
          .eq('deal_id', dealId)
          .limit(3)

        // Notes — newest first
        const { data: notesData } = await supabase
          .from('notes')
          .select('id,body,created_at')
          .eq('deal_id', dealId)
          .order('created_at', { ascending: false })

        // Activity — newest first
        const { data: activityData } = await supabase
          .from('activity_log')
          .select('id,action_type,description,created_at')
          .eq('deal_id', dealId)
          .order('created_at', { ascending: false })

        setDeal(dealData as DealData)
        setEcon(econData as DealEcon ?? null)
        setContacts((contactData as ContactRow[] | null) ?? [])
        setNotes((notesData as NoteRow[] | null) ?? [])
        setActivity((activityData as ActivityRow[] | null) ?? [])
      } catch {
        setError(true)
      }
      setLoading(false)
    })()
  }, [dealId])

  // ── Loading ──
  if (pinValid === null || loading) {
    return (
      <div style={{ background: T.bgBase, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ ...STYLE_LABEL, color: T.textLow }}>Loading…</span>
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
        <div style={{ ...STYLE_LABEL }}>Session expired</div>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: `1px solid ${T.borderPanel}`,
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
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: T.brandLift, fontFamily: FONT_DISPLAY, fontSize: 14, cursor: 'pointer' }}
        >
          ← Go back
        </button>
      </div>
    )
  }

  // ── Derived state ──
  const isHot = deal.status === 'hot'
  const txType = econ?.transaction_type ?? null      // 'sale' | 'lease' | 'both' | null
  const isLease = txType === 'lease'
  const isDevRole = deal.representation_role === 'developer'

  // Property plate — from deals.property_type (uppercase vocabulary)
  const propType = deal.property_type?.toUpperCase() ?? null
  const propPlateSrc = propType ? (PROPERTY_PLATE_MAP[propType] ?? null) : null

  // Transaction plate
  const txPlateSrc = txType && txType in TX_PLATE_MAP ? TX_PLATE_MAP[txType] : null

  // Address formatting
  const shortAddr = formatAddress(deal)
  // City line — always present
  const cityLine = (() => {
    const city = deal.addr_city ?? 'Baton Rouge'
    // Reconstruct from address field if structured cols missing
    const parts = [city, 'LA']
    // We don't have zip in selected cols — would need addr_zip. Omit if absent.
    return parts.join(', ')
  })()

  // Client name — from contacts[0]
  const clientName = contacts[0]?.contacts?.name ?? null

  // Commission block inputs
  const commissionRate = isLease
    ? (econ?.lease_commission_pct ?? null)
    : (econ?.sale_commission_pct ?? null)

  // Glance strip — item 44
  // Sale pre-offer: 5 slots (no accepted-number slot)
  // Lease: 6 slots
  // A slot with no value does not render
  type GlanceCell = { label: string; value: string; glow?: boolean }

  const glanceSale: GlanceCell[] = [
    { label: 'Asking Price',   value: fmt(econ?.asking_price) },
    { label: 'Price/SF',       value: fmtPSF(econ?.asking_price, econ?.sqft) },
    { label: 'Building SF',    value: fmtSF(econ?.sqft) },
    { label: 'Land Size',      value: fmtAcres(econ?.land_sqft) },
    { label: 'Est. Commission', value: '—', glow: true }, // brand-lift glow; no dollar figure (gated Item 32)
  ]

  const glanceLease: GlanceCell[] = [
    { label: 'Asking Price',   value: fmt(econ?.asking_price) },
    { label: 'Lease Rate PSF', value: econ?.lease_rate_psf ? `$${econ.lease_rate_psf}/SF` : '—' },
    { label: 'Building SF',    value: fmtSF(econ?.sqft) },
    { label: 'Land Size',      value: fmtAcres(econ?.land_sqft) },
    { label: 'Deal Value',     value: '—' }, // not rendered pre-offer (no accepted-price field)
    { label: 'Est. Commission', value: '—', glow: true },
  ]

  const glanceCells = isLease ? glanceLease : glanceSale
  // Filter: only render cells that have a non-'—' value, except glow cell which always shows
  const visibleCells = glanceCells.filter(c => c.value !== '—' || c.glow)

  return (
    <div style={{ background: T.bgBase, minHeight: '100vh', fontFamily: FONT_DISPLAY }}>

      {/* ── HEADER BAND ────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: `1px solid ${T.borderHair}` }}>
        <div style={{
          maxWidth: 1440,
          margin: '0 auto',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'nowrap',
        }}>
          {/* Back link */}
          <a
            href="/warroom/deals"
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9.5,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: T.textLow,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            ← Deals
          </a>

          {/* Divider */}
          <div style={{ width: 1, height: 22, background: T.borderHair, flexShrink: 0 }} />

          {/* Address block */}
          <div style={{ flexShrink: 0, minWidth: 0 }}>
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 22,
              fontWeight: 500,
              color: T.textHi,
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {shortAddr || '—'}
            </div>
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 13,
              color: T.textLow,
              lineHeight: 1.3,
              marginTop: 2,
            }}>
              {cityLine}
              {clientName && (
                <span style={{ color: T.textMid, marginLeft: 10 }}>· {clientName}</span>
              )}
            </div>
          </div>

          {/* Flex spacer */}
          <div style={{ flex: 1 }} />

          {/* Status pill */}
          {isHot && (
            <span style={{
              fontFamily: FONT_MONO,
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '4px 9px',
              borderRadius: 5,
              background: T.hot,
              color: '#0A0A0F',
              flexShrink: 0,
            }}>
              HOT
            </span>
          )}
          {!isHot && deal.status && (
            <span style={{
              fontFamily: FONT_MONO,
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '4px 9px',
              borderRadius: 5,
              background: 'transparent',
              border: `1px solid ${T.border}`,
              color: T.textMid,
              flexShrink: 0,
            }}>
              {deal.status.replace(/_/g, ' ')}
            </span>
          )}

          {/* Transaction plate — SALE or LEASE at 44px height */}
          {txPlateSrc && (
            <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {/* SALE/LEASE plates have internal padding — scale to pill height, let width auto */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={txPlateSrc}
                alt={txType ?? ''}
                style={{ height: 44, width: 'auto', display: 'block' }}
                draggable={false}
              />
            </div>
          )}

          {/* Property plate — cut to pill, mount at height 44px */}
          {propPlateSrc && (
            <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={propPlateSrc}
                alt={propType ?? ''}
                style={{ height: 44, width: 'auto', display: 'block' }}
                draggable={false}
              />
            </div>
          )}

          {/* EDIT control — 44×115px, mix-blend-mode: screen (item 39) */}
          {/* No alpha: source has black surround; screen compositing makes it additive */}
          <div
            style={{
              height: 44,
              width: 115,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/buttons/edit-pill-v8.png"
              alt="Edit"
              style={{
                height: 44,
                width: 115,
                display: 'block',
                mixBlendMode: 'screen',  // additive — EDIT ONLY, not Launch
              }}
              draggable={false}
            />
          </div>
        </div>
      </div>

      {/* ── GLANCE STRIP ───────────────────────────────────────────────────── */}
      {visibleCells.length > 0 && (
        <div style={{ borderBottom: `1px solid ${T.borderHair}` }}>
          <div style={{
            display: 'flex',
            maxWidth: 1440,
            margin: '0 auto',
            padding: '0 32px',
          }}>
            {visibleCells.map((cell, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  borderRight: i < visibleCells.length - 1 ? `1px solid ${T.borderHair}` : 'none',
                  paddingLeft: i === 0 ? 0 : 16,
                  paddingRight: i === visibleCells.length - 1 ? 0 : 16,
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  ...STYLE_LABEL,
                  marginBottom: 6,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {cell.label}
                </div>
                <div style={{
                  ...STYLE_M0,
                  color: cell.glow ? T.brandLift : T.textHi,
                  textShadow: cell.glow ? '0 0 22px rgba(167,139,250,0.35)' : undefined,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {cell.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TWO-COLUMN GRID ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 400px',
        gap: 22,
        maxWidth: 1440,
        margin: '0 auto',
        padding: '22px 32px',
        minHeight: 'calc(100vh - 160px)',
        alignItems: 'start',
      }}>

        {/* ── LEFT COLUMN (scrollable) ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* PHOTO placeholder */}
          <Panel label="PHOTO">
            <div style={{
              margin: '0 18px 18px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 8,
              height: 180,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ ...STYLE_LABEL, letterSpacing: '0.12em' }}>
                PHOTO — No image uploaded.
              </span>
            </div>
          </Panel>

          {/* PROPERTY PANEL — shell + empty state */}
          <Panel label="PROPERTY">
            <EmptyState text="Property details not yet wired." />
          </Panel>

          {/* SHOWINGS & PROSPECTS — shell + empty state */}
          <Panel label="SHOWINGS & PROSPECTS">
            <div style={{
              padding: '0 18px',
              marginBottom: 4,
            }}>
              <span style={{
                ...STYLE_LABEL,
                fontSize: 9,
                color: T.textLow,
              }}>
                0 Showings
              </span>
            </div>
            <EmptyState text="No showings recorded. Showings will appear here when contacts are linked as prospects." />
          </Panel>

          {/* DOCUMENTS — wired to deals.dropbox_link */}
          <Panel label="DOCUMENTS">
            <div style={{ padding: '0 18px 16px' }}>
              {deal.dropbox_link ? (
                <a
                  href={deal.dropbox_link}
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
                  }}
                >
                  Dropbox folder ↗
                </a>
              ) : (
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>
                  No folder linked.
                </span>
              )}
            </div>
          </Panel>

          {/* NOTES — from notes table, filter by deal_id, newest first */}
          <Panel label="NOTES">
            <div style={{ padding: '0 18px 16px' }}>
              {notes.length === 0 ? (
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>
                  No notes.
                </span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {notes.map((note, i) => (
                    <div
                      key={note.id}
                      style={{
                        paddingBottom: 12,
                        borderBottom: i < notes.length - 1 ? `1px solid ${T.borderHair}` : 'none',
                      }}
                    >
                      <div style={{
                        fontFamily: FONT_MONO,
                        fontSize: 9.5,
                        color: T.textLow,
                        letterSpacing: '0.10em',
                        marginBottom: 4,
                      }}>
                        {fmtDate(note.created_at)}
                      </div>
                      <div style={{
                        fontFamily: FONT_DISPLAY,
                        fontSize: 13,
                        color: T.textMid,
                        lineHeight: 1.55,
                        whiteSpace: 'pre-wrap',
                      }}>
                        {note.body ?? ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          {/* ACTIVITY — from activity_log table, filter by deal_id, newest first */}
          <Panel label="ACTIVITY">
            <div style={{ padding: '0 18px 16px' }}>
              {activity.length === 0 ? (
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>
                  No activity recorded.
                </span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activity.map((row, i) => (
                    <div
                      key={row.id}
                      style={{
                        paddingBottom: 10,
                        borderBottom: i < activity.length - 1 ? `1px solid ${T.borderHair}` : 'none',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'baseline',
                      }}
                    >
                      <span style={{
                        fontFamily: FONT_MONO,
                        fontSize: 9.5,
                        color: T.textLow,
                        letterSpacing: '0.10em',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}>
                        {fmtDateTime(row.created_at)}
                      </span>
                      <span style={{
                        fontFamily: FONT_MONO,
                        fontSize: 9.5,
                        color: T.textMid,
                        letterSpacing: '0.10em',
                        textTransform: 'uppercase',
                        flexShrink: 0,
                      }}>
                        {row.action_type}
                      </span>
                      {row.description && (
                        <span style={{
                          fontFamily: FONT_DISPLAY,
                          fontSize: 13,
                          color: T.textMid,
                          lineHeight: 1.4,
                        }}>
                          {row.description}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>

        </div>

        {/* ── RIGHT RAIL (sticky) ──────────────────────────────────────────── */}
        <div style={{
          position: 'sticky',
          top: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignSelf: 'start',
        }}>

          {/* LAUNCH CONTROL — desktop-local, item 50 */}
          <LaunchControl onClick={() => console.log('[deal2] Launch clicked — stub')} />

          {/* COMMISSION BLOCK — item 49 */}
          {/* If representation_role === 'developer': block is entirely absent (no dash, not zero) */}
          {!isDevRole && (
            <Panel label="COMMISSION">
              <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Rate — only if stored; null = slot does not render */}
                {commissionRate != null && (
                  <div>
                    <div style={{ ...STYLE_LABEL, marginBottom: 4 }}>Commission Rate</div>
                    <div style={{
                      fontFamily: FONT_MONO,
                      fontSize: 16,
                      fontWeight: 500,
                      color: T.textHi,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {commissionRate}%
                    </div>
                  </div>
                )}
                {/* HOUSE SHARE — proved fixed rule: HOUSE_SPLIT constant from lib/dealMath.ts */}
                <div>
                  <div style={{ ...STYLE_LABEL, marginBottom: 4 }}>House Share</div>
                  <div style={{
                    fontFamily: FONT_MONO,
                    fontSize: 16,
                    fontWeight: 500,
                    color: T.textHi,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {Math.round(HOUSE_SPLIT * 100)}%
                  </div>
                </div>
                {/* NOTE: Final derived commission in dollars NOT rendered (gated Item 32) */}
              </div>
            </Panel>
          )}

          {/* MONEY RAIL — placeholder only, no figures (item spec) */}
          <Panel label="MONEY">
            <EmptyState text="Commission collection data not yet wired." />
          </Panel>

          {/* CONTACTS — wired, up to 3 rows */}
          <Panel label="CONTACTS">
            <div style={{ padding: '0 18px 16px' }}>
              {contacts.length === 0 ? (
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>
                  No contacts.
                </span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {contacts.map((row) => {
                    const c = row.contacts
                    if (!c) return null
                    return (
                      <div key={row.contact_id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingBottom: 10,
                        borderBottom: `1px solid ${T.borderHair}`,
                      }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontFamily: FONT_DISPLAY,
                            fontSize: 14,
                            fontWeight: 500,
                            color: T.textHi,
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {c.name ?? '—'}
                          </div>
                          {c.role && (
                            <div style={{
                              fontFamily: FONT_MONO,
                              fontSize: 9.5,
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                              color: T.textLow,
                              marginTop: 2,
                            }}>
                              {c.role}
                            </div>
                          )}
                        </div>
                        <span style={{
                          fontFamily: FONT_MONO,
                          fontSize: 11,
                          color: T.textLow,
                          cursor: 'default',
                          flexShrink: 0,
                          marginLeft: 8,
                        }}>
                          ↗
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Panel>

          {/* CHAIN — shell, never collapses */}
          <Panel label="CHAIN" style={{ minHeight: 120 }}>
            <EmptyState text="No chain steps." />
          </Panel>

        </div>
      </div>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function Deal2Page() {
  return (
    <Suspense fallback={
      <div style={{
        background: '#08080C',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: '#8E8CA0',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}>
          Loading…
        </span>
      </div>
    }>
      <Deal2PageContent />
    </Suspense>
  )
}

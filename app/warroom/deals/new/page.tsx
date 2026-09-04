'use client'
/**
 * /warroom/deals/new — Create deal page. Item 141: frame only (§D5.5.2).
 * Fixed chrome: rail 96 · identity 112 · header 78. Body scrolls.
 * At 1920: content 1824 · gutter 32 · form 1356 · gap 22 · right rail 380.
 * Left-aligned — no centred measure, no dead band.
 * Full field groups + LAUNCH = later items (§D5.5.3–10, §D5.6).
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PinGate from '@/components/warroom/PinGate'
import {
  DT1, DT2, DT3,
} from '@/components/warroom/desktopTypes'

// ── Auth ──────────────────────────────────────────────────────────────────────
const PIN_HASH    = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'
const SESSION_KEY = 'wr_session_exp_v2'
const SESSION_HOURS = 8

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  bgBase:      '#050509',
  bgPanel:     '#12111B',
  bgRail:      '#0C0B14',
  textHi:      '#EFEEF4',
  textMid:     '#B8B6C6',
  textLow:     '#8E8CA0',
  brand:       '#8B5CF6',
  brandLift:   '#A78BFA',
  brandStrong: '#7C3AED',
  moneyIn:     '#34D399',
  border:      'rgba(255,255,255,0.14)',
  borderPanel: 'rgba(255,255,255,0.11)',
  borderHair:  'rgba(255,255,255,0.10)',
} as const

const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISP = "'Space Grotesk', system-ui, sans-serif"

// ── Clock ─────────────────────────────────────────────────────────────────────
function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])
  const dateStr = now.toLocaleDateString('en-US', {
    timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('en-US', {
    timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true,
  })
  return { dateStr, timeStr }
}

// ── IdentityBand — 112px (same as deals index) ────────────────────────────────
function IdentityBand() {
  const { dateStr, timeStr } = useClock()
  return (
    <div style={{
      height: 112, flexShrink: 0, display: 'flex', alignItems: 'center',
      padding: '0 30px', gap: 26,
      borderBottom: `1px solid ${C.border}`, background: C.bgBase,
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/mark-256.png" alt="" width={64} height={64}
        style={{ display: 'block', flexShrink: 0 }} />
      <div style={{ flexShrink: 0, marginTop: -10, marginLeft: -3.5, display: 'flex', alignItems: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/wordmark/shirleycre-h176.png" alt="SHIRLEYCRE" height={88}
          style={{ height: 88, width: 'auto', display: 'block' }} />
      </div>
      <div style={{ width: 1, height: 40, background: C.border, flexShrink: 0 }} />
      <span style={{ ...DT1, letterSpacing: '0.19em', color: C.textMid, marginTop: 4, flexShrink: 0 }}>
        WAR ROOM
      </span>
      <div style={{ flex: 1 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/links/lacdb-h104.png" alt="LACDB"
        style={{ height: 52, width: 158, display: 'block', flexShrink: 0, cursor: 'pointer' }}
        onClick={() => window.open('https://www.lacdb.com', '_blank', 'noopener,noreferrer')} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/links/crexi-h104.png" alt="CREXI"
        style={{ height: 52, width: 158, display: 'block', flexShrink: 0, cursor: 'pointer' }}
        onClick={() => window.open('https://www.crexi.com', '_blank', 'noopener,noreferrer')} />
      <span style={{ ...DT2, color: C.brandLift, flexShrink: 0 }}>{dateStr} · {timeStr}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.moneyIn }} />
        <span style={{ ...DT3, color: C.moneyIn }}>LIVE</span>
      </div>
    </div>
  )
}

// ── LeftRail — 96px ───────────────────────────────────────────────────────────
type RailSlot = 'HOME' | 'DEALS' | 'PEOPLE'

const G_HOME = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const G_DEALS = (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="4" width="17" height="10" rx="1.5"/>
    <path d="M12 14v7M7 7.8h6M7 10.8h9"/>
  </svg>
)
const G_PEOPLE = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

function LeftRail({ active }: { active: RailSlot }) {
  const router = useRouter()
  const slots: { id: RailSlot; label: string; href: string; glyph: React.ReactNode }[] = [
    { id: 'HOME',   label: 'HOME',   href: '/warroom',          glyph: G_HOME   },
    { id: 'DEALS',  label: 'DEALS',  href: '/warroom/deals',    glyph: G_DEALS  },
    { id: 'PEOPLE', label: 'PEOPLE', href: '/warroom/contacts', glyph: G_PEOPLE },
  ]
  return (
    <div style={{
      width: 96, flexShrink: 0,
      background: C.bgRail,
      borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 16, gap: 4,
    }}>
      {slots.map(s => {
        const isActive = s.id === active
        return (
          <button key={s.id} onClick={() => router.push(s.href)} style={{
            width: 72, padding: '10px 0',
            background: isActive ? 'rgba(139,92,246,0.14)' : 'transparent',
            border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            borderRadius: 8,
            color: isActive ? C.brandLift : C.textLow,
          }}>
            {s.glyph}
            <span style={{
              fontFamily: FONT_MONO, fontSize: 9, fontWeight: 600,
              letterSpacing: '0.12em',
              color: isActive ? C.brandLift : C.textLow,
            }}>{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Page header — 78px ────────────────────────────────────────────────────────
function PageHeader({ onBack }: { onBack: () => void }) {
  return (
    <div style={{
      height: 78, flexShrink: 0,
      display: 'flex', alignItems: 'center',
      /* aligns to form column — same 32px gutter as content */
      padding: '0 32px',
      borderBottom: `1px solid ${C.border}`,
      gap: 16,
      background: C.bgBase,
    }}>
      <button onClick={onBack} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8, padding: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={C.textLow} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.14em', color: C.textLow,
        }}>DEALS</span>
      </button>
      <div style={{ width: 1, height: 20, background: C.border }} />
      <span style={{
        fontFamily: FONT_MONO, fontSize: 15, fontWeight: 700,
        letterSpacing: '0.12em', color: C.textHi,
      }}>NEW DEAL</span>
    </div>
  )
}

// ── Inner page — frame only ───────────────────────────────────────────────────
function NewDealPage() {
  const router = useRouter()

  return (
    <div style={{
      display: 'flex',
      height: '100dvh',
      background: C.bgBase,
      fontFamily: FONT_DISP,
      color: C.textHi,
      overflow: 'hidden',
    }}>
      {/* Rail — 96px, own plane */}
      <LeftRail active="DEALS" />

      {/* Main column — flex col, fills remaining width */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Identity band — 112px fixed */}
        <IdentityBand />

        {/* Page header — 78px fixed */}
        <PageHeader onBack={() => router.push('/warroom/deals')} />

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {/*
            At 1920: content box = 1824 (viewport 1920 − rail 96).
            Layout inside content box:
              gutter 32 | form 1356 | gap 22 | right-rail 380 | gutter 32
              32 + 1356 + 22 + 380 + 32 = 1822 (inside 1px border each side) → 1824 rendered.
            Left-aligned — no centred measure, no dead band.
          */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            padding: '32px 32px 64px 32px',
            gap: 22,
            boxSizing: 'border-box',
          }}>
            {/* Form column — 1356px */}
            <div style={{
              width: 1356,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
            }}>
              {/* Placeholder — field groups ship in later items */}
              <div style={{
                background: C.bgPanel,
                border: `1px solid ${C.borderPanel}`,
                borderRadius: 10,
                padding: '28px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <span style={{
                  fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500,
                  letterSpacing: '0.18em', color: C.textLow, textTransform: 'uppercase',
                }}>FORM — FIELD GROUPS IN LATER ITEMS</span>
                <p style={{ margin: 0, fontSize: 14, color: C.textLow, lineHeight: 1.6 }}>
                  §D5.5.3–10 · address lookup · SALE / LEASE · economics · CREATE DEAL
                </p>
              </div>
            </div>

            {/* Right rail — 380px */}
            <div style={{
              width: 380,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}>
              {/* Requirements rail shell */}
              <div style={{
                background: C.bgPanel,
                border: `1px solid ${C.borderPanel}`,
                borderRadius: 10,
                padding: '22px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <span style={{
                  fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500,
                  letterSpacing: '0.18em', color: C.textLow, textTransform: 'uppercase',
                }}>REQUIREMENTS</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{
                    fontFamily: FONT_MONO, fontSize: 22, fontWeight: 500, color: C.textLow,
                    letterSpacing: '-0.01em',
                  }}>—</span>
                  <span style={{
                    fontFamily: FONT_MONO, fontSize: 11, color: C.textLow, letterSpacing: '0.10em',
                  }}>OF —</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: C.textLow, lineHeight: 1.5 }}>
                  Required fields will appear here as form ships.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Root export — PIN gate ────────────────────────────────────────────────────
export default function NewDealRoute() {
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    const expiry = localStorage.getItem(SESSION_KEY)
    if (expiry && Date.now() < parseInt(expiry)) setUnlocked(true)
  }, [])

  const handlePinSuccess = useCallback(() => {
    const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000
    localStorage.setItem(SESSION_KEY, expiry.toString())
    setUnlocked(true)
  }, [])

  if (!unlocked) {
    return <PinGate pinHash={PIN_HASH} sha256={sha256} onSuccess={handlePinSuccess} />
  }

  return <NewDealPage />
}

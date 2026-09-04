'use client'
/**
 * /warroom/deals/new — Create deal stub. Item 140.
 * Full §D5.5 create form is a later item. This route exists so the FAB does not 404.
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
  const dateStr = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true })
  return { dateStr, timeStr }
}

// ── IdentityBand (inlined — same as deals index) ──────────────────────────────
function IdentityBand() {
  const { dateStr, timeStr } = useClock()
  return (
    <div style={{
      height: 112, flexShrink: 0, display: 'flex', alignItems: 'center',
      padding: '0 30px', gap: 26, borderBottom: `1px solid ${C.border}`, background: C.bgBase,
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/mark-256.png" alt="" width={64} height={64} style={{ display: 'block', flexShrink: 0 }} />
      <div style={{ flexShrink: 0, marginTop: -10, marginLeft: -3.5, display: 'flex', alignItems: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/wordmark/shirleycre-h176.png" alt="SHIRLEYCRE" height={88} style={{ height: 88, width: 'auto', display: 'block' }} />
      </div>
      <div style={{ width: 1, height: 40, background: C.border, flexShrink: 0 }} />
      <span style={{ ...DT1, letterSpacing: '0.19em', color: C.textMid, marginTop: 4, flexShrink: 0 }}>WAR ROOM</span>
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

// ── Rail ──────────────────────────────────────────────────────────────────────
type RailSlot = 'HOME' | 'DEALS' | 'PEOPLE'

function LeftRail({ active }: { active: RailSlot }) {
  const router = useRouter()
  const G_HOME = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
  const G_DEALS = (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="4" width="17" height="10" rx="1.5"/>
      <path d="M12 14v7M7 7.8h6M7 10.8h9"/>
    </svg>
  )
  const G_PEOPLE = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
  const slots: { id: RailSlot; label: string; href: string; glyph: React.ReactNode }[] = [
    { id: 'HOME',   label: 'HOME',   href: '/warroom',          glyph: G_HOME   },
    { id: 'DEALS',  label: 'DEALS',  href: '/warroom/deals',    glyph: G_DEALS  },
    { id: 'PEOPLE', label: 'PEOPLE', href: '/warroom/contacts', glyph: G_PEOPLE },
  ]
  return (
    <div style={{
      width: 96, flexShrink: 0, background: C.bgRail,
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
            borderRadius: 8, color: isActive ? C.brandLift : C.textLow,
          }}>
            {s.glyph}
            <span style={{
              fontFamily: FONT_MONO, fontSize: 9, fontWeight: 600,
              letterSpacing: '0.12em', color: isActive ? C.brandLift : C.textLow,
            }}>{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Inner page ────────────────────────────────────────────────────────────────
function NewDealPage() {
  const router = useRouter()
  return (
    <div style={{
      display: 'flex', height: '100dvh', background: C.bgBase,
      fontFamily: FONT_DISP, color: C.textHi, overflow: 'hidden',
    }}>
      <LeftRail active="DEALS" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <IdentityBand />

        {/* Page header */}
        <div style={{
          height: 62, flexShrink: 0, display: 'flex', alignItems: 'center',
          padding: '0 24px', borderBottom: `1px solid ${C.border}`, gap: 16,
        }}>
          <button onClick={() => router.push('/warroom/deals')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, padding: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={C.textLow} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600,
              letterSpacing: '0.14em', color: C.textLow }}>DEALS</span>
          </button>
          <div style={{ width: 1, height: 18, background: C.border }} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700,
            letterSpacing: '0.12em', color: C.textHi }}>NEW DEAL</span>
        </div>

        {/* Stub body */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'flex-start', justifyContent: 'flex-start',
          padding: '48px 44px',
        }}>
          <span style={{
            fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500,
            letterSpacing: '0.18em', color: C.textLow, textTransform: 'uppercase',
          }}>
            CREATE DEAL — COMING SOON
          </span>
          <p style={{ marginTop: 12, fontSize: 14, color: C.textLow, lineHeight: 1.6, maxWidth: 420 }}>
            Full create form in a later build. Route is live.
          </p>
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

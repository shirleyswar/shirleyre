'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PinGate from '@/components/warroom/PinGate'
import LeadsIndex from '@/components/warroom/LeadsIndex'

const PIN_HASH = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'
const SESSION_KEY = 'wr_session_exp_v2'
const SESSION_HOURS = 8

const C = {
  bgBase: '#050509',
  bgRail: '#0C0B14',
  textHi: '#EFEEF4',
  textMid: '#B8B6C6',
  textLow: '#8E8CA0',
  brandLift: '#A78BFA',
  moneyIn: '#34D399',
  border: 'rgba(255,255,255,0.14)',
}

const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISP = "'Space Grotesk', system-ui, sans-serif"

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const h = now.getHours()
  const h12 = h % 12 || 12
  return {
    dateStr: `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`,
    timeStr: `${h12}:${String(now.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`,
  }
}

const RAIL: { id: string; label: string; href: string | null; svg: string }[] = [
  { id: 'HOME', label: 'HOME', href: '/warroom', svg: '<rect x="3" y="3" width="7.5" height="18"/><rect x="13.5" y="3" width="7.5" height="8"/><rect x="13.5" y="14" width="7.5" height="7"/>' },
  { id: 'DEALS', label: 'DEALS', href: '/warroom/deals', svg: '<rect x="3.5" y="4" width="17" height="10" rx="1.5"/><path d="M12 14v7M7 7.8h6M7 10.8h9"/>' },
  { id: 'LEADS', label: 'LEADS', href: '/warroom/leads', svg: '<rect x="3.2" y="3.4" width="17.6" height="17.2" rx="2"/><circle cx="8.6" cy="10.2" r="2.1"/><path d="M5.2 16.8c.35-2.05 1.65-3.2 3.4-3.2s3.05 1.15 3.4 3.2"/><path d="M13.8 8.4h4.6M13.8 11.6h4.6"/>' },
  { id: 'SCHED', label: 'SCHED', href: null, svg: '<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17"/><rect x="7" y="12.6" width="4" height="4" fill="currentColor" stroke="none"/>' },
  { id: 'DEADLINES', label: 'DEADLINES', href: null, svg: '<path d="M6 20.8V3.6"/><path d="M6 4.4h10.4l-1.7 4.1 1.7 4.1H6"/>' },
  { id: 'MONEY', label: 'MONEY', href: null, svg: '<rect x="2.6" y="6.4" width="18.8" height="11.2" rx="2.2"/><circle cx="12" cy="12" r="3"/>' },
  { id: 'PORTF', label: 'PORTF', href: null, svg: '<path d="M12 2.8 21 7.4l-9 4.6-9-4.6z"/><path d="M3 12.2 12 16.8l9-4.6"/><path d="M3 16.8 12 21.4l9-4.6"/>' },
  { id: 'ENTITY', label: 'ENTITY', href: null, svg: '<rect x="3.6" y="3.2" width="10.2" height="17.6" rx="1.6"/><path d="M13.8 11.2h6.6v9.6h-6.6"/><path d="M6.6 7v1.8M11 7v1.8M6.6 11.1v1.8M11 11.1v1.8M6.6 15.2v1.8M11 15.2v1.8"/>' },
  { id: 'PEOPLE', label: 'PEOPLE', href: '/warroom/contacts', svg: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.4 2.7-5.6 6-5.6s6 2.2 6 5.6"/><path d="M16 5.4a3.2 3.2 0 0 1 0 6M17.5 14.9c2.1.6 3.5 2.4 3.5 5.1"/>' },
]
const BOTTOM = [
  { id: 'LOGS', label: 'LOGS', href: '/warroom/logs', svg: '<rect x="5.4" y="4" width="13.2" height="16"/><path d="M8.6 8.4h7M8.6 12h7M8.6 15.6h4.2"/>' },
  { id: 'SET', label: 'SET', href: null, svg: '<path d="M3.4 8.6h4M13 8.6h7.6M3.4 15.4h7.1M16.1 15.4h4.5"/><circle cx="10.1" cy="8.6" r="2.6"/><circle cx="13.3" cy="15.4" r="2.6"/>' },
]

function RailButton({ slot, active }: { slot: { id: string; label: string; href: string | null; svg: string }; active: boolean }) {
  const router = useRouter()
  const color = active ? C.brandLift : C.textLow
  const inert = !slot.href
  return (
    <button
      type="button"
      onClick={!inert && slot.href ? () => router.push(slot.href!) : undefined}
      aria-disabled={inert ? 'true' : undefined}
      style={{
        width: 76,
        padding: '10px 0',
        borderRadius: 10,
        border: 'none',
        background: active ? 'rgba(139,92,246,0.14)' : 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        cursor: inert ? 'default' : 'pointer',
        color,
        flexShrink: 0,
      }}
    >
      <span
        style={{ color, display: 'flex' }}
        dangerouslySetInnerHTML={{ __html: `<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${slot.svg}</svg>` }}
      />
      <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', lineHeight: '15px', color }}>{slot.label}</span>
    </button>
  )
}

function LeadsPage() {
  const [unlocked, setUnlocked] = useState(false)
  const { dateStr, timeStr } = useClock()

  useEffect(() => {
    const expiry = localStorage.getItem(SESSION_KEY)
    if (expiry && Date.now() < parseInt(expiry, 10)) setUnlocked(true)
  }, [])

  const handlePinSuccess = useCallback(() => {
    localStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_HOURS * 60 * 60 * 1000))
    setUnlocked(true)
  }, [])

  if (!unlocked) {
    return <PinGate pinHash={PIN_HASH} sha256={sha256} onSuccess={handlePinSuccess} />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bgBase, color: C.textHi, fontFamily: FONT_DISP, overflow: 'hidden' }}>
      <nav style={{
        width: 96,
        flexShrink: 0,
        height: '100%',
        background: C.bgRail,
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12,
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}>
        {RAIL.map(slot => <RailButton key={slot.id} slot={slot} active={slot.id === 'LEADS'} />)}
        <div style={{ flex: 1 }} />
        {BOTTOM.map(slot => <RailButton key={slot.id} slot={slot} active={false} />)}
        <div style={{ height: 8 }} />
      </nav>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          height: 112,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 30px',
          gap: 26,
          borderBottom: `1px solid ${C.border}`,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/mark-256.png" alt="" width={64} height={64} style={{ display: 'block' }} />
          <div style={{ marginTop: -10, marginLeft: -3.5 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/wordmark/shirleycre-h176.png" alt="SHIRLEYCRE" height={88} style={{ height: 88, width: 'auto', display: 'block' }} />
          </div>
          <div style={{ width: 1, height: 40, background: C.border }} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 15, fontWeight: 500, letterSpacing: '0.19em', color: C.textMid }}>WAR ROOM</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 14, letterSpacing: '0.14em', color: C.brandLift }}>{dateStr} · {timeStr}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.moneyIn }} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 13, letterSpacing: '0.08em', color: C.moneyIn }}>LIVE</span>
          </div>
        </div>
        <div style={{ padding: '18px 8px 0 0' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: '0.16em', color: C.textLow, padding: '0 28px 12px' }}>LEADS</div>
        </div>
        <LeadsIndex variant="desktop" />
      </div>
    </div>
  )
}

export default function LeadsRoute() {
  return <LeadsPage />
}

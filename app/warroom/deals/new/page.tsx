'use client'
/**
 * /warroom/deals/new — Item 144: Complete create form rewrite.
 * Layout: rail 96 · identity 112 · header 78 · body scrolls.
 * Body: padding 26 32 40 32. Form 1356px + gap 22 + rail 380px.
 * Left-aligned — no centred measure, no dead band.
 */

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PinGate from '@/components/warroom/PinGate'
import { supabase } from '@/lib/supabase'

// ── Auth ──────────────────────────────────────────────────────────────────────
const PIN_HASH    = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'
const SESSION_KEY = 'wr_session_exp_v2'
const SESSION_HOURS = 8

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Design tokens ─────────────────────────────────────────────────────────────
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
  hot:         '#FFA23A',
  border:      'rgba(255,255,255,0.14)',
  borderPanel: 'rgba(255,255,255,0.11)',
  borderHair:  'rgba(255,255,255,0.10)',
} as const

const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISP = "'Space Grotesk', system-ui, sans-serif"

// ── Types ─────────────────────────────────────────────────────────────────────
type Engagement = 'LISTING' | 'TENANT' | 'BUYER' | 'TARGET'
type WhyReason  = '' | 'LOCATION' | 'CLIENT' | 'SIZE' | 'PRICE' | 'OPPORTUNITY'
type PropType   = '' | 'OFFICE' | 'RETAIL' | 'LAND' | 'INDUSTRIAL' | 'MULTIFAMILY'

interface ContactRow { id: string; name: string; company: string | null }

// ── Clock ─────────────────────────────────────────────────────────────────────
function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])
  const DAYS   = ['SUN','MON','TUE','WED','THU','FRI','SAT']
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const d = now
  const h = d.getHours(); const min = d.getMinutes()
  const h12 = h % 12 || 12; const ampm = h >= 12 ? 'PM' : 'AM'
  // Format: "MON 31 AUG · 05:18 PM" — day before month, no comma
  const clockStr = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} · ${String(h12).padStart(2,'0')}:${String(min).padStart(2,'0')} ${ampm}`
  return clockStr
}

// ── IdentityBand ──────────────────────────────────────────────────────────────
function IdentityBand() {
  const clockStr = useClock()
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
      {/* Search field 380w */}
      <div style={{ width: 380, flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search deals, contacts, addresses…"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${C.borderHair}`,
            borderRadius: 8, padding: '0 14px',
            height: 40,
            fontFamily: FONT_MONO, fontSize: 12, color: C.textMid,
            outline: 'none',
          }}
        />
      </div>
      <div style={{ flex: 1 }} />
      {/* LACDB — 158×52 bare (no rim) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/links/lacdb-h104.png" alt="LACDB"
        style={{ height: 52, width: 158, display: 'block', flexShrink: 0, cursor: 'pointer' }}
        onClick={() => window.open('https://www.lacdb.com', '_blank', 'noopener,noreferrer')} />
      {/* CREXI — 158×52 bare (no rim) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/links/crexi-h104.png" alt="CREXI"
        style={{ height: 52, width: 158, display: 'block', flexShrink: 0, cursor: 'pointer' }}
        onClick={() => window.open('https://www.crexi.com', '_blank', 'noopener,noreferrer')} />
      {/* Clock */}
      <span style={{
        fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500, letterSpacing: '0.06em',
        color: C.brandLift, flexShrink: 0,
      }}>{clockStr}</span>
      {/* LIVE dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.moneyIn }} />
        <span style={{
          fontFamily: FONT_MONO, fontSize: 9, fontWeight: 600,
          letterSpacing: '0.18em', color: C.moneyIn,
        }}>LIVE</span>
      </div>
    </div>
  )
}

// ── LeftRail — 9 slots ────────────────────────────────────────────────────────
const RAIL_SLOTS = [
  { id: 'HOME',      label: 'HOME',      href: '/warroom',          glyph: (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )},
  { id: 'DEALS',     label: 'DEALS',     href: '/warroom/deals',    glyph: (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="4" width="17" height="10" rx="1.5"/>
      <path d="M12 14v7M7 7.8h6M7 10.8h9"/>
    </svg>
  )},
  { id: 'SCHED',     label: 'SCHED',     href: '/warroom',          glyph: (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  )},
  { id: 'DEADLINES', label: 'DEADLINES', href: '/warroom',          glyph: (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
    </svg>
  )},
  { id: 'MONEY',     label: 'MONEY',     href: '/warroom',          glyph: (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )},
  { id: 'PORTF',     label: 'PORTF',     href: '/warroom',          glyph: (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z"/><path d="M3 12.5 12 17l9-4.5"/><path d="M3 17 12 21.5l9-4.5"/>
    </svg>
  )},
  { id: 'ENTITY',    label: 'ENTITY',    href: '/warroom',          glyph: (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/>
    </svg>
  )},
  { id: 'PEOPLE',    label: 'PEOPLE',    href: '/warroom/contacts', glyph: (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.4 2.7-5.6 6-5.6s6 2.2 6 5.6"/>
      <path d="M16 5.4a3.2 3.2 0 0 1 0 6M17.5 14.9c2.1.6 3.5 2.4 3.5 5.1"/>
    </svg>
  )},
  { id: 'SET',       label: 'SET',       href: '/warroom',          glyph: (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
    </svg>
  )},
] as const

function LeftRail({ active }: { active: string }) {
  const router = useRouter()
  return (
    <div style={{
      width: 96, flexShrink: 0, background: C.bgRail,
      borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '13px 0', gap: 7,
    }}>
      {RAIL_SLOTS.map(s => {
        const isActive = s.id === active
        return (
          <button key={s.id} onClick={() => router.push(s.href)} style={{
            width: 76, padding: '13px 0',
            background: isActive ? 'rgba(139,92,246,0.14)' : 'transparent',
            border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
            borderRadius: 10, color: isActive ? C.brandLift : C.textLow,
          }}>
            {s.glyph}
            <span style={{
              fontFamily: FONT_MONO, fontSize: 10, fontWeight: 500,
              letterSpacing: '0.08em', color: 'inherit', textTransform: 'uppercase',
            }}>{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── PageHeader ────────────────────────────────────────────────────────────────
function PageHeader({
  onBack, allMet, saving, onSave,
}: {
  onBack: () => void
  allMet: boolean
  saving: boolean
  onSave: () => void
}) {
  return (
    <div style={{
      height: 78, flexShrink: 0, display: 'flex', alignItems: 'center',
      padding: '0 32px', borderBottom: `1px solid ${C.borderHair}`,
      background: C.bgBase, gap: 16,
    }}>
      {/* Back: ← DEALS */}
      <button onClick={onBack} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6, padding: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={C.brandLift} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 12, fontWeight: 600,
          letterSpacing: '0.13em', color: C.brandLift,
        }}>DEALS</span>
      </button>

      {/* Hairline divider */}
      <div style={{ width: 1, height: 22, background: C.borderHair, flexShrink: 0 }} />

      {/* "New deal" — 23px/500 Space Grotesk sentence case */}
      <span style={{
        fontFamily: FONT_DISP, fontSize: 23, fontWeight: 500, color: C.textHi,
      }}>New deal</span>

      <div style={{ flex: 1 }} />

      {/* CANCEL button */}
      <button onClick={onBack} style={{
        height: 44, padding: '0 24px', borderRadius: 10,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${C.borderHair}`,
        fontFamily: FONT_MONO, fontSize: 12, fontWeight: 600,
        letterSpacing: '0.12em', color: C.textMid, cursor: 'pointer',
      }}>CANCEL</button>

      {/* CREATE DEAL button — inert until allMet */}
      <button
        onClick={allMet && !saving ? onSave : undefined}
        style={{
          height: 44, padding: '0 24px', borderRadius: 10,
          background: allMet
            ? 'linear-gradient(135deg, #8B5CF6, #7C3AED)'
            : 'rgba(255,255,255,0.03)',
          border: allMet
            ? 'none'
            : `1px solid rgba(255,255,255,0.14)`,
          boxShadow: allMet
            ? '0 0 18px rgba(139,92,246,0.55), 0 0 36px rgba(139,92,246,0.28)'
            : 'none',
          fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700,
          letterSpacing: '0.16em',
          color: allMet ? '#FFF' : C.textLow,
          cursor: allMet ? 'pointer' : 'default',
          transition: 'box-shadow 0.2s, background 0.2s',
        }}
      >{saving ? 'SAVING…' : 'CREATE DEAL'}</button>
    </div>
  )
}

// ── Field primitives ──────────────────────────────────────────────────────────
const FIELD_STYLE: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  minWidth: 0, maxWidth: '100%',
  height: 52,
  background: 'rgba(255,255,255,0.05)',
  border: `1px solid rgba(255,255,255,0.14)`,
  borderRadius: 10, padding: '0 16px',
  fontFamily: FONT_MONO, fontSize: 17, fontWeight: 500,
  color: C.textHi, outline: 'none',
  overflow: 'hidden', textOverflow: 'ellipsis',
}

const PLACEHOLDER_STYLE = `
  ::placeholder { font-family: 'Space Grotesk', system-ui, sans-serif; font-size: 17px; font-weight: 400; color: #8E8CA0; }
`

function FieldLabel({ text }: { text: string }) {
  return (
    <span style={{
      fontFamily: FONT_MONO, fontSize: 10, fontWeight: 500,
      letterSpacing: '0.18em', textTransform: 'uppercase',
      color: C.textLow,
    }}>{text}</span>
  )
}

function GroupDivider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.10)', margin: '4px 0' }} />
}

// ── Engagement segment ────────────────────────────────────────────────────────
const ENGAGEMENT_OPTS: Engagement[] = ['LISTING', 'TENANT', 'BUYER', 'TARGET']

function EngagementSegment({ value, onChange }: { value: Engagement; onChange: (v: Engagement) => void }) {
  return (
    <div style={{
      display: 'flex', border: `1px solid ${C.borderHair}`, borderRadius: 0, overflow: 'hidden',
    }}>
      {ENGAGEMENT_OPTS.map((opt, i) => {
        const active = value === opt
        return (
          <button key={opt} onClick={() => onChange(opt)} style={{
            flex: 1, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: active ? 'rgba(139,92,246,0.16)' : 'transparent',
            border: 'none',
            borderRight: i < 3 ? `1px solid ${C.borderHair}` : 'none',
            boxShadow: active ? 'inset 0 -2px 0 #8B5CF6' : 'none',
            cursor: 'pointer',
            fontFamily: FONT_MONO, fontSize: 13,
            fontWeight: active ? 700 : 500,
            letterSpacing: '0.08em',
            color: active ? C.textHi : C.textLow,
          }}>{opt}</button>
        )
      })}
    </div>
  )
}

// ── Address ───────────────────────────────────────────────────────────────────
const DIRECTIONS = ['NE','NW','SE','SW','N','S','E','W']

interface AddrState {
  raw: string; confirmed: boolean
  addrDisplay: string; addrStreetName: string
  addrDirection: string; addrNumber: string; addrCity: string
  addrState?: string; addrZip?: string
}

function parseAddr(raw: string) {
  const tokens = raw.trim().split(/\s+/)
  let addrNumber = ''; let addrDirection = ''
  const street: string[] = []
  for (const tok of tokens) {
    const up = tok.toUpperCase()
    if (!addrNumber && /^\d+$/.test(tok)) { addrNumber = tok }
    else if (!addrDirection && DIRECTIONS.includes(up)) { addrDirection = up }
    else { street.push(tok) }
  }
  return { addrNumber, addrDirection, addrStreetName: street.join(' '), addrCity: 'Baton Rouge', addrDisplay: raw.trim() }
}

// ── Google Maps Places script loader ─────────────────────────────────────────
let _mapsLoaded = false
let _mapsLoading = false
let _mapsCallbacks: Array<() => void> = []

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    if (_mapsLoaded) { resolve(); return }
    _mapsCallbacks.push(resolve)
    if (_mapsLoading) return
    _mapsLoading = true
    const callbackName = '__gmaps_cb_' + Date.now()
    ;(window as any)[callbackName] = () => {
      _mapsLoaded = true
      _mapsLoading = false
      _mapsCallbacks.forEach(fn => fn())
      _mapsCallbacks = []
      delete (window as any)[callbackName]
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`
    script.async = true
    script.onerror = () => {
      _mapsLoading = false
      _mapsCallbacks.forEach(fn => fn())
      _mapsCallbacks = []
    }
    document.head.appendChild(script)
  })
}

function getACComponent(place: google.maps.places.PlaceResult, type: string): string {
  const comp = place.address_components?.find(c => c.types.includes(type))
  return comp?.long_name ?? ''
}
function getACComponentShort(place: google.maps.places.PlaceResult, type: string): string {
  const comp = place.address_components?.find(c => c.types.includes(type))
  return comp?.short_name ?? ''
}

function AddressBlock({ addr, onChange, optional }: {
  addr: AddrState; onChange: (a: AddrState) => void; optional?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const acRef = useRef<google.maps.places.Autocomplete | null>(null)
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''

  // Load Google Maps and attach autocomplete
  useEffect(() => {
    if (!mapsKey || addr.confirmed) return
    loadGoogleMaps(mapsKey).then(() => {
      if (!inputRef.current || acRef.current) return
      if (typeof google === 'undefined' || !google?.maps?.places) return
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
        fields: ['address_components', 'formatted_address'],
      })
      acRef.current = ac
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        if (!place?.address_components) return
        const streetNum = getACComponent(place, 'street_number')
        const route = getACComponent(place, 'route')
        const city = getACComponent(place, 'locality') || 'Baton Rouge'
        const state = getACComponentShort(place, 'administrative_area_level_1')
        const zip = getACComponent(place, 'postal_code')
        // Extract cardinal direction from route
        const routeTokens = route.split(/\s+/)
        let addrDirection = ''
        const streetParts: string[] = []
        for (const tok of routeTokens) {
          const up = tok.toUpperCase()
          if (!addrDirection && DIRECTIONS.includes(up)) { addrDirection = up }
          else { streetParts.push(tok) }
        }
        onChange({
          raw: place.formatted_address ?? route,
          confirmed: true,
          addrDisplay: place.formatted_address ?? '',
          addrStreetName: streetParts.join(' ') || route,
          addrDirection,
          addrNumber: streetNum,
          addrCity: city,
          addrState: state,
          addrZip: zip,
        })
      })
    })
    return () => {
      if (acRef.current) {
        google?.maps?.event?.clearInstanceListeners(acRef.current)
        acRef.current = null
      }
    }
  }, [mapsKey, addr.confirmed]) // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = () => {
    if (!addr.raw.trim()) return
    const parsed = parseAddr(addr.raw)
    onChange({ ...addr, confirmed: true, ...parsed })
  }
  const reopen = () => {
    onChange({ ...addr, confirmed: false })
    // Detach autocomplete so it re-attaches on next render
    if (acRef.current) {
      google?.maps?.event?.clearInstanceListeners(acRef.current)
      acRef.current = null
    }
  }

  if (addr.confirmed) {
    const shortForm = [addr.addrStreetName, addr.addrNumber].filter(Boolean).join(' ')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FieldLabel text={optional ? 'ADDRESS (OPTIONAL)' : 'ADDRESS'} />
        <div style={{
          background: 'rgba(52,211,153,0.06)',
          border: `1px solid rgba(52,211,153,0.35)`,
          borderRadius: 10, padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          overflow: 'hidden',
        }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 15, fontWeight: 600, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '0 1 auto' }}>
            {shortForm || addr.addrDisplay}
          </span>
          <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textLow, letterSpacing: '0.18em' }}>STREET</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textMid }}>{addr.addrStreetName || '—'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textLow, letterSpacing: '0.18em' }}>CARDINAL</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textMid }}>{addr.addrDirection || '—'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textLow, letterSpacing: '0.18em' }}>NUMBER</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textMid }}>{addr.addrNumber || '—'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textLow, letterSpacing: '0.18em' }}>HELD-NOT-SHOWN</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textMid }}>{addr.addrCity}</span>
            </div>
          </div>
          <button onClick={reopen} style={{
            background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
            padding: '4px 12px', cursor: 'pointer', flexShrink: 0,
            fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', color: C.textLow,
          }}>CHANGE</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <FieldLabel text={optional ? 'ADDRESS (OPTIONAL)' : 'ADDRESS'} />
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          ref={inputRef}
          type="text" value={addr.raw}
          onChange={e => onChange({ ...addr, raw: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') confirm() }}
          placeholder="Street address"
          style={{ ...FIELD_STYLE, flex: 1 }}
        />
        <button onClick={confirm} disabled={!addr.raw.trim()} style={{
          height: 52, padding: '0 20px', borderRadius: 10,
          background: addr.raw.trim() ? C.brand : 'rgba(139,92,246,0.12)',
          border: 'none', cursor: addr.raw.trim() ? 'pointer' : 'default',
          fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.14em', color: addr.raw.trim() ? '#fff' : C.textLow,
          flexShrink: 0,
        }}>CONFIRM</button>
      </div>
    </div>
  )
}

// ── Property type selector ────────────────────────────────────────────────────
const PROP_ORDER: Array<{ key: PropType; img: string }> = [
  { key: 'OFFICE',      img: '/assets/plates/plate-office-v7.png' },
  { key: 'RETAIL',      img: '/assets/plates/plate-retail-v7.png' },
  { key: 'INDUSTRIAL',  img: '/assets/plates/plate-indst-v7.png'  },
  { key: 'MULTIFAMILY', img: '/assets/plates/plate-multi-v7.png'  },
  { key: 'LAND',        img: '/assets/plates/plate-land-v7.png'   },
]

function PropTypeSelector({ value, onChange }: { value: PropType; onChange: (v: PropType) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <FieldLabel text="PROPERTY TYPE" />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {PROP_ORDER.map(({ key, img }) => {
          const active = value === key
          return (
            <button key={key} onClick={() => onChange(active ? '' : key)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              opacity: active ? 1 : 0.30,
              transition: 'opacity 0.12s',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={key} style={{ height: 32, width: 'auto', display: 'block' }} draggable={false} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Sale/Lease marks ──────────────────────────────────────────────────────────
function SaleLeaseMarks({ saleOn, leaseOn, onSale, onLease }: {
  saleOn: boolean; leaseOn: boolean; onSale: () => void; onLease: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <FieldLabel text="TRANSACTION" />
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <button onClick={onSale} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          opacity: saleOn ? 1 : 0.30, transition: 'opacity 0.12s',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/plates/plate-sale-v7.png" alt="SALE"
            style={{ height: 32, width: 'auto', display: 'block' }} draggable={false} />
        </button>
        <button onClick={onLease} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          opacity: leaseOn ? 1 : 0.30, transition: 'opacity 0.12s',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/plates/plate-lease-v7.png" alt="LEASE"
            style={{ height: 32, width: 'auto', display: 'block' }} draggable={false} />
        </button>
        {!saleOn && !leaseOn && (
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: '#FFA23A' }}>
            At least one required.
          </span>
        )}
      </div>
    </div>
  )
}

// ── Contact picker (custom field) ─────────────────────────────────────────────
type ClientMode = 'search' | 'selected' | 'new'

interface ContactPickerProps {
  contacts: ContactRow[]
  value: string
  onChange: (id: string) => void
  // new-client fields
  clientMode: ClientMode
  onClientModeChange: (m: ClientMode) => void
  newClientName: string
  onNewClientNameChange: (v: string) => void
  newClientEmail: string
  onNewClientEmailChange: (v: string) => void
  newClientPhone: string
  onNewClientPhoneChange: (v: string) => void
}

function ContactPicker({
  contacts, value, onChange,
  clientMode, onClientModeChange,
  newClientName, onNewClientNameChange,
  newClientEmail, onNewClientEmailChange,
  newClientPhone, onNewClientPhoneChange,
}: ContactPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = contacts.find(c => c.id === value)

  // Sync clientMode → search when a contact is selected
  useEffect(() => {
    if (value && clientMode !== 'selected') onClientModeChange('selected')
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = contacts.filter(c =>
    !query || c.name.toLowerCase().includes(query.toLowerCase()) || (c.company ?? '').toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8)

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const handleFocus = () => {
    setOpen(true)
    setLoading(true)
    setTimeout(() => setLoading(false), 100)
  }

  const clearSelection = () => {
    onChange('')
    setQuery('')
    onClientModeChange('search')
  }

  // ── SELECTED mode ──────────────────────────────────────────────────────────
  if (clientMode === 'selected' && selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FieldLabel text="CLIENT" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            flex: 1, height: 52, background: 'rgba(52,211,153,0.06)',
            border: `1px solid rgba(52,211,153,0.35)`, borderRadius: 10,
            padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0,
          }}>
            <span style={{ fontFamily: FONT_DISP, fontSize: 16, fontWeight: 500, color: C.textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {selected.name}
            </span>
            {selected.company && <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textLow, flexShrink: 0 }}>{selected.company}</span>}
          </div>
          <button onClick={clearSelection} style={{
            height: 52, padding: '0 16px', borderRadius: 10, flexShrink: 0,
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.borderHair}`,
            fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
            color: C.textMid, cursor: 'pointer',
          }}>✕ CLEAR</button>
        </div>
      </div>
    )
  }

  // ── NEW CLIENT mode ────────────────────────────────────────────────────────
  if (clientMode === 'new') {
    const newClientReady = newClientEmail.trim().length > 0 || newClientPhone.trim().length > 0
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FieldLabel text="CLIENT — NEW CONTACT" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10,
          background: 'rgba(139,92,246,0.06)', border: `1px solid rgba(139,92,246,0.25)`,
          borderRadius: 10, padding: '16px',
        }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textLow, letterSpacing: '0.18em' }}>NAME</span>
              <input type="text" value={newClientName} onChange={e => onNewClientNameChange(e.target.value)}
                placeholder="Full name" style={{ ...FIELD_STYLE }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textLow, letterSpacing: '0.18em' }}>EMAIL</span>
              <input type="email" value={newClientEmail} onChange={e => onNewClientEmailChange(e.target.value)}
                placeholder="Email address" style={{ ...FIELD_STYLE }} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textLow, letterSpacing: '0.18em' }}>CELL</span>
              <input type="tel" value={newClientPhone} onChange={e => onNewClientPhoneChange(e.target.value)}
                placeholder="Cell number" style={{ ...FIELD_STYLE }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: newClientReady ? C.moneyIn : C.hot }}>
              {newClientReady ? '✓ Ready to save' : 'Need email or cell to save a new client'}
            </span>
            <button onClick={() => { onClientModeChange('search'); onNewClientNameChange(''); onNewClientEmailChange(''); onNewClientPhoneChange('') }} style={{
              background: 'none', border: `1px solid ${C.borderHair}`, borderRadius: 6,
              padding: '4px 12px', cursor: 'pointer',
              fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: C.textLow,
            }}>CANCEL</button>
          </div>
        </div>
      </div>
    )
  }

  // ── SEARCH mode ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <FieldLabel text="CLIENT" />
      <div style={{ display: 'flex', gap: 10 }}>
        <div ref={ref} style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              fontFamily: FONT_MONO, fontSize: 16, color: C.textLow, pointerEvents: 'none',
            }}>⌕</span>
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); if (value) onChange('') }}
              onFocus={handleFocus}
              placeholder="Find a contact…"
              style={{ ...FIELD_STYLE, paddingLeft: 40 }}
            />
          </div>
          {open && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 200,
              background: '#1A1929', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden',
            }}>
              {loading ? (
                <div style={{ padding: '12px 16px', fontFamily: FONT_MONO, fontSize: 11, color: C.textLow }}>Loading…</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '12px 16px', fontFamily: FONT_MONO, fontSize: 11, color: C.textLow }}>No contacts found.</div>
              ) : filtered.map(c => (
                <button key={c.id} onClick={() => { onChange(c.id); setQuery(''); setOpen(false); onClientModeChange('selected') }} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '11px 16px', border: 'none', cursor: 'pointer',
                  background: c.id === value ? 'rgba(139,92,246,0.16)' : 'transparent',
                  fontFamily: FONT_DISP, fontSize: 14, color: c.id === value ? C.textHi : C.textMid,
                }}>
                  {c.name}
                  {c.company && <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textLow, marginLeft: 10 }}>{c.company}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* NEW CLIENT button */}
        <button onClick={() => { onClientModeChange('new'); setOpen(false); onNewClientNameChange(query) }} style={{
          height: 52, padding: '0 18px', borderRadius: 10, flexShrink: 0,
          background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.borderHair}`,
          fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
          color: C.textMid, cursor: 'pointer',
        }}>+ NEW CLIENT</button>
      </div>
    </div>
  )
}

// ── WHY/WHEN/TOUCHED (TARGET) ─────────────────────────────────────────────────
const WHY_OPTS: WhyReason[] = ['LOCATION', 'CLIENT', 'SIZE', 'PRICE', 'OPPORTUNITY']

function TargetWhyBlock({ why, when, onChange }: {
  why: WhyReason; when: string
  onChange: (why: WhyReason, when: string) => void
}) {
  const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <>
      {/* WHY 5-segment */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FieldLabel text="WHY" />
        <div style={{ display: 'flex', border: `1px solid ${C.borderHair}`, borderRadius: 0, overflow: 'hidden' }}>
          {WHY_OPTS.map((opt, i) => {
            const active = why === opt
            return (
              <button key={opt} onClick={() => onChange(active ? '' : opt, when)} style={{
                flex: 1, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: active ? 'rgba(139,92,246,0.16)' : 'transparent',
                border: 'none',
                borderRight: i < 4 ? `1px solid ${C.borderHair}` : 'none',
                boxShadow: active ? 'inset 0 -2px 0 #8B5CF6' : 'none',
                cursor: 'pointer',
                fontFamily: FONT_MONO, fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? C.textHi : C.textLow,
              }}>{opt}</button>
            )
          })}
        </div>
      </div>

      {/* WHEN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FieldLabel text="WHEN" />
        <input
          type="text" value={when}
          onChange={e => onChange(why, e.target.value)}
          placeholder="Year or WATCHING"
          style={{ ...FIELD_STYLE, width: 280 }}
        />
      </div>

      {/* TOUCHED — read state */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <FieldLabel text="TOUCHED" />
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, height: 52,
          background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.borderHair}`,
          borderRadius: 10, padding: '0 16px',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.moneyIn }} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: C.textLow }}>{todayStr}</span>
        </div>
      </div>
    </>
  )
}

// ── Derived field ─────────────────────────────────────────────────────────────
function DerivedField({ label, arithmetic, value }: { label: string; arithmetic: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <FieldLabel text={label} />
      <div style={{
        height: 52, boxSizing: 'border-box',
        background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.borderHair}`,
        borderRadius: 10, padding: '0 16px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2,
      }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textLow, letterSpacing: '0.10em' }}>{arithmetic}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 600, color: value ? C.moneyIn : C.textLow }}>{value}</span>
      </div>
    </div>
  )
}

// ── Economics SALE ────────────────────────────────────────────────────────────
interface SaleEcon { askingPrice: string; buildingSf: string; landSize: string; yearBuilt: string }

function EconomicsSale({ econ, onChange }: { econ: SaleEcon; onChange: (e: SaleEcon) => void }) {
  const asking = parseFloat(econ.askingPrice.replace(/[^0-9.]/g,'')) || null
  const sf = parseFloat(econ.buildingSf.replace(/[^0-9.]/g,'')) || null
  const pricePsf = (asking && sf && sf > 0) ? asking / sf : null
  const fmtPsf = (n: number | null) => n == null ? '' : '$' + n.toFixed(2) + '/SF'

  const cell = (label: string, field: keyof SaleEcon, placeholder?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, overflow: 'hidden' }}>
      <FieldLabel text={label} />
      <input type="text" value={econ[field]}
        onChange={e => onChange({ ...econ, [field]: e.target.value })}
        placeholder={placeholder}
        style={FIELD_STYLE} />
    </div>
  )

  return (
    <>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', color: C.textLow }}>
        ECONOMICS — SALE
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
        {cell('ASKING PRICE', 'askingPrice')}
        {cell('BUILDING SF', 'buildingSf')}
        {cell('LAND SIZE', 'landSize')}
        {cell('YEAR BUILT', 'yearBuilt')}
        <DerivedField label="PRICE PSF" arithmetic="asking ÷ sf" value={fmtPsf(pricePsf)} />
        <div /><div /><div />
      </div>
    </>
  )
}

// ── Economics LEASE ───────────────────────────────────────────────────────────
interface LeaseEcon {
  availSf: string; ratePsf: string; nnnPsf: string
  leaseTermMonths: string; commencement: string; annualEscalation: string; freeRent: string
}

function EconomicsLease({ econ, onChange }: { econ: LeaseEcon; onChange: (e: LeaseEcon) => void }) {
  const sf = parseFloat(econ.availSf.replace(/[^0-9.]/g,'')) || null
  const rate = parseFloat(econ.ratePsf.replace(/[^0-9.]/g,'')) || null
  const nnn = parseFloat(econ.nnnPsf.replace(/[^0-9.]/g,'')) || null

  const grossRate = (rate != null && nnn != null) ? rate + nnn : null
  const monthlyBase = (sf && rate) ? (sf * rate) / 12 : null
  const monthlyNNN = (sf && nnn) ? (sf * nnn) / 12 : null
  const monthlyGross = (monthlyBase != null && monthlyNNN != null) ? monthlyBase + monthlyNNN : null

  const fmtD = (n: number | null) => n == null ? '' : '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  const fmtPsf = (n: number | null) => n == null ? '' : '$' + n.toFixed(2) + '/SF'

  const cell = (label: string, field: keyof LeaseEcon, placeholder?: string, type = 'text') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, overflow: 'hidden' }}>
      <FieldLabel text={label} />
      <input type={type} value={econ[field]}
        onChange={e => onChange({ ...econ, [field]: e.target.value })}
        placeholder={placeholder}
        style={FIELD_STYLE} />
    </div>
  )

  return (
    <>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', color: C.textLow }}>
        ECONOMICS — LEASE
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
        {cell('AVAILABLE SF', 'availSf')}
        {cell('RATE PSF', 'ratePsf')}
        {cell('NNN PSF', 'nnnPsf')}
        <DerivedField label="GROSS RATE PSF" arithmetic="rate + nnn" value={fmtPsf(grossRate)} />

        <DerivedField label="MONTHLY BASE" arithmetic="(sf × rate) ÷ 12" value={fmtD(monthlyBase)} />
        <DerivedField label="MONTHLY NNN" arithmetic="(sf × nnn) ÷ 12" value={fmtD(monthlyNNN)} />
        <DerivedField label="MONTHLY GROSS RENT" arithmetic="base + NNN" value={fmtD(monthlyGross)} />
        <div />

        {cell('LEASE TERM', 'leaseTermMonths', 'Months, if any')}
        {cell('COMMENCEMENT', 'commencement', 'Pick a date', 'date')}
        {cell('ANNUAL ESCALATION', 'annualEscalation', 'Percent per year')}
        {cell('FREE RENT', 'freeRent', 'Months, if any')}
      </div>
    </>
  )
}

// ── Commission block ──────────────────────────────────────────────────────────
interface CommState { listingRate: string; coBrokerSplit: string }

function CommissionBlock({ comm, onChange, saleOn, leaseOn, askingPrice, monthlyBase, leaseTermMonths, engagement }: {
  comm: CommState; onChange: (c: CommState) => void
  saleOn: boolean; leaseOn: boolean
  askingPrice: number | null; monthlyBase: number | null; leaseTermMonths: number | null
  engagement: Engagement
}) {
  const rate = parseFloat(comm.listingRate) || null
  const coBroker = parseFloat(comm.coBrokerSplit) || null
  const isListing = engagement === 'LISTING'
  const fmtD = (n: number | null) => n == null ? '' : '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })

  const calcSold = (rate && coBroker && askingPrice)
    ? askingPrice * (rate / 100) * (coBroker / 100) * 0.75 : null
  const calcLeased = (rate && coBroker && monthlyBase && leaseTermMonths)
    ? monthlyBase * leaseTermMonths * (rate / 100) * (coBroker / 100) * 0.75 : null

  return (
    <>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', color: C.textLow }}>
        COMMISSION
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, overflow: 'hidden' }}>
          <FieldLabel text="LISTING RATE (%)" />
          <input type="text" value={comm.listingRate} onChange={e => onChange({ ...comm, listingRate: e.target.value })} style={FIELD_STYLE} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, overflow: 'hidden' }}>
          <FieldLabel text="CO-BROKER SPLIT (%)" />
          <input type="text" value={comm.coBrokerSplit} onChange={e => onChange({ ...comm, coBrokerSplit: e.target.value })} style={FIELD_STYLE} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, overflow: 'hidden' }}>
          <FieldLabel text="HOUSE SPLIT" />
          <div style={{
            height: 52, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.borderHair}`,
            borderRadius: 10, padding: '0 16px', display: 'flex', alignItems: 'center',
            fontFamily: FONT_MONO, fontSize: 17, fontWeight: 500, color: C.textLow,
          }}>75%</div>
        </div>
        <div />
      </div>

      {/* Estimates — LISTING only */}
      {isListing && (saleOn || leaseOn) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {saleOn && (
            <div style={{ display: 'flex', gap: 20, alignItems: 'center',
              background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '11px 16px',
              border: `1px solid ${C.borderHair}` }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.textLow, letterSpacing: '0.14em', flex: 1 }}>
                EST. COMMISSION IF SOLD
              </span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700, color: calcSold ? C.moneyIn : C.textLow }}>
                {fmtD(calcSold)}
              </span>
              {calcSold && <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textLow }}>asking × rate × co-broker × 0.75</span>}
            </div>
          )}
          {leaseOn && (
            <div style={{ display: 'flex', gap: 20, alignItems: 'center',
              background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '11px 16px',
              border: `1px solid ${C.borderHair}` }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.textLow, letterSpacing: '0.14em', flex: 1 }}>
                EST. COMMISSION IF LEASED
              </span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700, color: calcLeased ? C.moneyIn : C.textLow }}>
                {fmtD(calcLeased)}
              </span>
              {calcLeased && <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textLow }}>monthly base × term mo × rate × co-broker × 0.75</span>}
            </div>
          )}
        </div>
      )}

      {/* TENANT/BUYER — row visible, figures blank */}
      {!isListing && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'center',
          background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '11px 16px',
          border: `1px solid ${C.borderHair}` }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.textLow, letterSpacing: '0.14em', flex: 1 }}>
            {engagement === 'BUYER' ? 'EST. COMMISSION IF SOLD' : 'EST. COMMISSION IF LEASED'}
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700, color: C.textLow }} />
        </div>
      )}
    </>
  )
}

// ── Requirements panel (right rail) ──────────────────────────────────────────
interface Req { label: string; met: boolean; value?: string }

function RequirementPanel({ reqs, engagement }: { reqs: Req[]; engagement: Engagement }) {
  const metCount = reqs.filter(r => r.met).length
  const total = reqs.length
  const allMet = total > 0 && metCount === total

  return (
    <div style={{
      background: C.bgPanel, border: `1px solid ${C.borderPanel}`,
      borderRadius: 14, overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 22px 0', fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.15em', color: C.textLow }}>
        BEFORE IT CAN SAVE
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {reqs.map((r, i) => (
          <div key={i} style={{
            height: 44, display: 'flex', alignItems: 'center',
            padding: '0 22px', gap: 12,
            borderBottom: i < reqs.length - 1 ? `1px solid ${C.borderHair}` : 'none',
          }}>
            {r.met ? (
              <span style={{ fontFamily: FONT_MONO, fontSize: 14, color: C.moneyIn, flexShrink: 0 }}>✓</span>
            ) : (
              <div style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                border: '1.5px solid #5C5B6B',
                background: 'transparent',
              }} />
            )}
            <span style={{
              fontFamily: FONT_DISP, fontSize: 15,
              color: r.met ? C.textHi : '#B8B6C6',
              flex: 1,
            }}>{r.label}</span>
            {r.met && r.value && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: C.textLow }}>{r.value}</span>
            )}
          </div>
        ))}
      </div>
      <div style={{
        padding: '10px 22px 14px',
        fontFamily: FONT_MONO, fontSize: 11, color: C.textLow,
        borderTop: `1px solid ${C.borderHair}`,
      }}>
        <span style={{ color: allMet ? C.moneyIn : C.textLow }}>{metCount}</span>
        {' OF '}
        <span style={{ color: C.textLow }}>{total}</span>
      </div>
    </div>
  )
}

// ── Book preview (right rail) ─────────────────────────────────────────────────
function BookPreview({ engagement, addr, title, propType }: {
  engagement: Engagement
  addr: AddrState
  title: string
  propType: PropType
}) {
  const displayName = (engagement === 'TENANT' || engagement === 'BUYER')
    ? (title || '—')
    : (addr.confirmed ? (addr.addrStreetName + (addr.addrNumber ? ' ' + addr.addrNumber : '')) : '—')

  const propPlate = propType ? PROP_ORDER.find(p => p.key === propType) : null

  const captionParts = []
  if (addr.confirmed && addr.addrCity) captionParts.push(addr.addrCity + ', LA')
  else if (engagement === 'TENANT' || engagement === 'BUYER') captionParts.push(engagement)
  const caption = captionParts.join(' · ') || '—'

  return (
    <div style={{
      background: C.bgPanel, border: `1px solid ${C.borderPanel}`,
      borderRadius: 14, padding: '16px 22px',
    }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.15em', color: C.textLow, marginBottom: 14 }}>
        IT WILL LAND IN THE BOOK AS
      </div>
      <div style={{
        height: 60, display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: `1px solid ${C.borderHair}`, paddingBottom: 12,
      }}>
        <span style={{ fontFamily: FONT_DISP, fontSize: 18, fontWeight: 500, color: C.textHi, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </span>
        {propPlate && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={propPlate.img} alt={propType} style={{ height: 22, width: 'auto', display: 'block', flexShrink: 0 }} draggable={false} />
        )}
      </div>
      <div style={{ paddingTop: 8, fontFamily: FONT_MONO, fontSize: 12, color: C.textLow }}>
        {caption}
      </div>
    </div>
  )
}

// ── Tab → Engagement map ──────────────────────────────────────────────────────
const TAB_MAP: Record<string, Engagement> = {
  listings: 'LISTING', tenants: 'TENANT', buyers: 'BUYER', targets: 'TARGET',
}

// ── Main form ─────────────────────────────────────────────────────────────────
function NewDealForm() {
  const router = useRouter()
  const params = useSearchParams()

  const [engagement, setEngagement] = useState<Engagement>(() => {
    const tab = params.get('tab')
    return (tab && TAB_MAP[tab]) ? TAB_MAP[tab] : 'LISTING'
  })
  const [title, setTitle] = useState('')
  const [addr, setAddr] = useState<AddrState>({
    raw: '', confirmed: false,
    addrDisplay: '', addrStreetName: '', addrDirection: '', addrNumber: '', addrCity: 'Baton Rouge',
  })
  const [propType, setPropType] = useState<PropType>('')
  const [saleOn, setSaleOn] = useState(false)
  const [leaseOn, setLeaseOn] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientMode, setClientMode] = useState<ClientMode>('search')
  const [newClientName, setNewClientName] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [why, setWhy] = useState<WhyReason>('')
  const [when, setWhen] = useState('')
  const [saleEcon, setSaleEcon] = useState<SaleEcon>({ askingPrice: '', buildingSf: '', landSize: '', yearBuilt: '' })
  const [leaseEcon, setLeaseEcon] = useState<LeaseEcon>({
    availSf: '', ratePsf: '', nnnPsf: '', leaseTermMonths: '',
    commencement: '', annualEscalation: '', freeRent: '',
  })
  const [comm, setComm] = useState<CommState>({ listingRate: '6.00', coBrokerSplit: '50' })
  const [mainImageFile, setMainImageFile] = useState<File | null>(null)
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null)
  const [lacdbUrl, setLacdbUrl] = useState('')
  const [dropboxLink, setDropboxLink] = useState('')
  const [deadlineWhat, setDeadlineWhat] = useState('')
  const [deadlineWhen, setDeadlineWhen] = useState('')
  const [saving, setSaving] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('contacts').select('id, name, company').order('name').then(({ data }) => {
      if (data) setContacts(data as ContactRow[])
    })
  }, [])

  // ── Requirements ──────────────────────────────────────────────────────────
  const newClientReady2 = newClientEmail.trim().length > 0 || newClientPhone.trim().length > 0
  const clientMet2 = clientMode === 'new' ? newClientReady2 : !!clientId
  const clientValue2 = clientMode === 'new' ? newClientName || undefined : contacts.find(c => c.id === clientId)?.name

  const reqs: Req[] = (() => {
    switch (engagement) {
      case 'LISTING': return [
        { label: 'Engagement', met: true, value: 'LISTING' },
        { label: 'Address', met: addr.confirmed, value: addr.addrStreetName || undefined },
        { label: 'Property type', met: !!propType, value: propType || undefined },
        { label: 'Sale or lease', met: saleOn || leaseOn, value: saleOn && leaseOn ? 'BOTH' : saleOn ? 'SALE' : leaseOn ? 'LEASE' : undefined },
        { label: 'Client', met: clientMet2, value: clientValue2 },
      ]
      case 'TARGET': return [
        { label: 'Engagement', met: true, value: 'TARGET' },
        { label: 'Address', met: addr.confirmed, value: addr.addrStreetName || undefined },
        { label: 'Property type', met: !!propType, value: propType || undefined },
        { label: 'Why', met: !!why, value: why || undefined },
      ]
      case 'TENANT': return [
        { label: 'Engagement', met: true, value: 'TENANT' },
        { label: 'Title', met: title.trim().length > 0, value: title || undefined },
        { label: 'Client', met: clientMet2, value: clientValue2 },
      ]
      case 'BUYER': return [
        { label: 'Engagement', met: true, value: 'BUYER' },
        { label: 'Title', met: title.trim().length > 0, value: title || undefined },
        { label: 'Client', met: clientMet2, value: clientValue2 },
      ]
    }
  })()

  const allMet = reqs.length > 0 && reqs.every(r => r.met)

  // ── Derived commission inputs ─────────────────────────────────────────────
  const asking = parseFloat(saleEcon.askingPrice.replace(/[^0-9.]/g,'')) || null
  const availSf = parseFloat(leaseEcon.availSf.replace(/[^0-9.]/g,'')) || null
  const ratePsf = parseFloat(leaseEcon.ratePsf.replace(/[^0-9.]/g,'')) || null
  const nnnPsf  = parseFloat(leaseEcon.nnnPsf.replace(/[^0-9.]/g,'')) || null
  const leaseTermMo = parseFloat(leaseEcon.leaseTermMonths.replace(/[^0-9.]/g,'')) || null
  const monthlyBase = (availSf && ratePsf) ? (availSf * ratePsf) / 12 : null

  // ── Image handlers ────────────────────────────────────────────────────────
  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setMainImageFile(file)
      setMainImagePreview(URL.createObjectURL(file))
    }
  }
  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) { setMainImageFile(file); setMainImagePreview(URL.createObjectURL(file)) }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (saving || !allMet) return
    setSaving(true)
    try {
      const dealName = (engagement === 'TENANT' || engagement === 'BUYER')
        ? title.trim()
        : (addr.addrDisplay || addr.raw.trim())
      const roleMap: Record<Engagement, string | null> = {
        LISTING: 'landlord', TENANT: 'tenant', BUYER: 'buyer', TARGET: null,
      }
      const { data: dealData, error: dealError } = await supabase.from('deals').insert({
        name: dealName,
        address: addr.addrDisplay || null,
        addr_street_name: addr.addrStreetName || null,
        addr_direction: addr.addrDirection || null,
        addr_number: addr.addrNumber || null,
        addr_city: addr.addrCity || 'Baton Rouge',
        addr_display: addr.addrDisplay || null,
        property_type: propType || null,
        status: 'active',
        representation_role: roleMap[engagement],
        lacdb_url: lacdbUrl || null,
        dropbox_link: dropboxLink || null,
        type: engagement.toLowerCase(),
      }).select('id').single()
      if (dealError || !dealData) throw dealError ?? new Error('No deal returned')
      const newId = dealData.id

      // Economics
      const hasSaleData = saleOn && (saleEcon.askingPrice || saleEcon.buildingSf)
      const hasLeaseData = leaseOn && (leaseEcon.availSf || leaseEcon.ratePsf)
      if (hasSaleData || hasLeaseData) {
        const txType = (saleOn && leaseOn) ? 'both' : saleOn ? 'sale' : 'lease'
        const listRate = parseFloat(comm.listingRate) || 0
        const coBrokerFrac = (parseFloat(comm.coBrokerSplit) || 0) / 100
        const commPct = listRate * coBrokerFrac
        await supabase.from('deal_economics').insert({
          deal_id: newId,
          transaction_type: txType,
          asking_price: parseFloat(saleEcon.askingPrice.replace(/[^0-9.]/g,'')) || null,
          sqft: parseFloat((saleOn ? saleEcon.buildingSf : leaseEcon.availSf).replace(/[^0-9.]/g,'')) || null,
          land_sqft: parseFloat(saleEcon.landSize.replace(/[^0-9.]/g,'')) || null,
          sale_commission_pct: saleOn ? commPct : null,
          lease_rate_psf: parseFloat(leaseEcon.ratePsf.replace(/[^0-9.]/g,'')) || null,
          nnn_psf: parseFloat(leaseEcon.nnnPsf.replace(/[^0-9.]/g,'')) || null,
          lease_term_years: leaseTermMo ? leaseTermMo / 12 : null,
          lease_commission_pct: leaseOn ? commPct : null,
        })
      }

      // Contact
      if (clientId) {
        await supabase.from('deal_contacts').insert({ deal_id: newId, contact_id: clientId, relationship: 'client' })
      }

      // Deadline
      if (deadlineWhat && deadlineWhen) {
        await supabase.from('contract_deadlines').insert({
          deal_id: newId, label: deadlineWhat,
          deadline_date: deadlineWhen, deadline_type: 'custom', status: 'pending',
        })
      }

      router.push('/warroom/deal/' + newId)
    } catch (err) {
      console.error('Save error:', err)
      setSaving(false)
    }
  }, [saving, allMet, engagement, title, addr, propType, saleOn, leaseOn, clientId,
    saleEcon, leaseEcon, comm, lacdbUrl, dropboxLink, deadlineWhat, deadlineWhen, leaseTermMo, router])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isListing = engagement === 'LISTING'
  const isTarget  = engagement === 'TARGET'
  const isTenantBuyer = engagement === 'TENANT' || engagement === 'BUYER'
  const showEconomics = isListing && (saleOn || leaseOn)
  const showCommission = !isTarget

  // ── One-panel form with group dividers ───────────────────────────────────
  return (
    <>
      <style>{PLACEHOLDER_STYLE}</style>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start',
          padding: '26px 32px 40px 32px', gap: 22, boxSizing: 'border-box',
        }}>
          {/* ── FORM COLUMN — 1356px ── */}
          <div style={{ width: 1356, flexShrink: 0 }}>
            <div style={{
              background: C.bgPanel, border: `1px solid ${C.borderPanel}`,
              borderRadius: 14,
            }}>

              {/* GROUP: ENGAGEMENT */}
              <div style={{ padding: '22px 26px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <FieldLabel text="ENGAGEMENT" />
                  <EngagementSegment value={engagement} onChange={setEngagement} />
                </div>
              </div>

              {/* GROUP: TITLE (TENANT/BUYER) */}
              {isTenantBuyer && (
                <>
                  <GroupDivider />
                  <div style={{ padding: '22px 26px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <FieldLabel text="TITLE" />
                      <input
                        type="text" value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Name it"
                        style={FIELD_STYLE}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* GROUP: ADDRESS */}
              <GroupDivider />
              <div style={{ padding: '22px 26px' }}>
                {(isListing || isTarget) ? (
                  <AddressBlock addr={addr} onChange={setAddr} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <FieldLabel text="ADDRESS (OPTIONAL)" />
                    <input
                      type="text" value={addr.raw}
                      onChange={e => setAddr({ ...addr, raw: e.target.value, addrDisplay: e.target.value })}
                      placeholder="Street address"
                      style={FIELD_STYLE}
                    />
                  </div>
                )}
              </div>

              {/* GROUP: PROPERTY TYPE */}
              <GroupDivider />
              <div style={{ padding: '22px 26px' }}>
                <PropTypeSelector value={propType} onChange={setPropType} />
              </div>

              {/* GROUP: SALE/LEASE */}
              {!isTarget && (
                <>
                  <GroupDivider />
                  <div style={{ padding: '22px 26px' }}>
                    {isListing ? (
                      <SaleLeaseMarks saleOn={saleOn} leaseOn={leaseOn}
                        onSale={() => setSaleOn(!saleOn)} onLease={() => setLeaseOn(!leaseOn)} />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <FieldLabel text="TRANSACTION" />
                        <div style={{
                          height: 52, display: 'inline-flex', alignItems: 'center', paddingLeft: 16,
                          background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.borderHair}`,
                          borderRadius: 10,
                          fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500, color: C.textLow,
                        }}>
                          {engagement === 'BUYER' ? 'Sale (implied)' : 'Lease (implied)'}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* GROUP: CLIENT */}
              {!isTarget && (
                <>
                  <GroupDivider />
                  <div style={{ padding: '22px 26px' }}>
                    <ContactPicker
                      contacts={contacts} value={clientId} onChange={setClientId}
                      clientMode={clientMode} onClientModeChange={setClientMode}
                      newClientName={newClientName} onNewClientNameChange={setNewClientName}
                      newClientEmail={newClientEmail} onNewClientEmailChange={setNewClientEmail}
                      newClientPhone={newClientPhone} onNewClientPhoneChange={setNewClientPhone}
                    />
                  </div>
                </>
              )}

              {/* GROUP: WHY/WHEN/TOUCHED (TARGET) */}
              {isTarget && (
                <>
                  <GroupDivider />
                  <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 22 }}>
                    <TargetWhyBlock why={why} when={when} onChange={(w, wh) => { setWhy(w); setWhen(wh) }} />
                  </div>
                </>
              )}

              {/* GROUP: ECONOMICS — SALE */}
              {showEconomics && saleOn && (
                <>
                  <GroupDivider />
                  <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <EconomicsSale econ={saleEcon} onChange={setSaleEcon} />
                  </div>
                </>
              )}

              {/* GROUP: ECONOMICS — LEASE */}
              {showEconomics && leaseOn && (
                <>
                  <GroupDivider />
                  <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <EconomicsLease econ={leaseEcon} onChange={setLeaseEcon} />
                  </div>
                </>
              )}

              {/* GROUP: COMMISSION */}
              {showCommission && (
                <>
                  <GroupDivider />
                  <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <CommissionBlock
                      comm={comm} onChange={setComm}
                      saleOn={saleOn} leaseOn={leaseOn}
                      askingPrice={asking}
                      monthlyBase={monthlyBase}
                      leaseTermMonths={leaseTermMo}
                      engagement={engagement}
                    />
                  </div>
                </>
              )}

              {/* GROUP: ATTACHMENTS */}
              <GroupDivider />
              <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', color: C.textLow }}>
                  ATTACHMENTS
                </div>

                {/* MAIN IMAGE 640×360 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <FieldLabel text="MAIN IMAGE" />
                  <div
                    onClick={() => imageInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleImageDrop}
                    style={{
                      width: 640, height: 360, boxSizing: 'border-box',
                      border: `2px dashed ${C.border}`, borderRadius: 10,
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', cursor: 'pointer', overflow: 'hidden',
                      background: mainImagePreview ? 'transparent' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    {mainImagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mainImagePreview} alt="Main" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                          stroke={C.textLow} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.textLow, marginTop: 10, letterSpacing: '0.12em' }}>
                          DROP IMAGE OR CLICK — 640 × 360 · 16:9
                        </span>
                      </>
                    )}
                  </div>
                  <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImagePick} style={{ display: 'none' }} />
                </div>

                {/* LACDB */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assets/links/lacdb-h104.png" alt="LACDB"
                    style={{ height: 52, width: 158, display: 'block', flexShrink: 0 }} />
                  <input type="text" value={lacdbUrl} onChange={e => setLacdbUrl(e.target.value)}
                    placeholder="Paste the listing URL"
                    style={{ ...FIELD_STYLE, flex: 1 }} />
                </div>

                {/* Dropbox */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assets/links/crexi-h104.png" alt="Dropbox"
                    style={{ height: 52, width: 158, display: 'block', flexShrink: 0 }} />
                  <input type="text" value={dropboxLink} onChange={e => setDropboxLink(e.target.value)}
                    placeholder="Paste folder link"
                    style={{ ...FIELD_STYLE, flex: 1 }} />
                </div>

                {/* FIRST DEADLINE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <FieldLabel text="FIRST DEADLINE" />
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textLow, letterSpacing: '0.18em' }}>WHAT</span>
                      <input type="text" value={deadlineWhat} onChange={e => setDeadlineWhat(e.target.value)}
                        placeholder="Name it" style={FIELD_STYLE} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textLow, letterSpacing: '0.18em' }}>WHEN</span>
                      <input type="date" value={deadlineWhen} onChange={e => setDeadlineWhen(e.target.value)}
                        style={FIELD_STYLE} />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ── RIGHT RAIL — 380px ── */}
          <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <RequirementPanel reqs={reqs} engagement={engagement} />
            <BookPreview engagement={engagement} addr={addr} title={title} propType={propType} />
          </div>
        </div>
      </div>
    </>
  )
}

// ── Suspense wrapper ──────────────────────────────────────────────────────────
function NewDealFormShell({ onBack, allMetRef, savingRef, onSave }: {
  onBack: () => void
  allMetRef: React.MutableRefObject<boolean>
  savingRef: React.MutableRefObject<boolean>
  onSave: () => void
}) {
  return (
    <Suspense fallback={
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textLow, letterSpacing: '0.18em' }}>LOADING…</span>
      </div>
    }>
      <NewDealForm />
    </Suspense>
  )
}

// ── Inner page — needs allMet/saving state lifted for header ──────────────────
function NewDealPageInner() {
  const router = useRouter()
  // We lift allMet/saving up to share with header via state hoisting
  // The form manages its own state; header buttons mirror via callbacks
  const [allMet, setAllMet] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveCallbackRef = useRef<(() => void) | null>(null)

  return (
    <div style={{
      display: 'flex', height: '100dvh', background: C.bgBase,
      fontFamily: FONT_DISP, color: C.textHi, overflow: 'hidden',
      maxWidth: '100vw',
    }}>
      <LeftRail active="DEALS" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <IdentityBand />
        <PageHeader
          onBack={() => router.push('/warroom/deals')}
          allMet={allMet}
          saving={saving}
          onSave={() => saveCallbackRef.current?.()}
        />
        <Suspense fallback={
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textLow, letterSpacing: '0.18em' }}>LOADING…</span>
          </div>
        }>
          <NewDealFormWithHeader
            onAllMetChange={setAllMet}
            onSavingChange={setSaving}
            saveCallbackRef={saveCallbackRef}
          />
        </Suspense>
      </div>
    </div>
  )
}

// ── Form that exposes allMet/saving/save to parent ────────────────────────────
function NewDealFormWithHeader({ onAllMetChange, onSavingChange, saveCallbackRef }: {
  onAllMetChange: (v: boolean) => void
  onSavingChange: (v: boolean) => void
  saveCallbackRef: React.MutableRefObject<(() => void) | null>
}) {
  const router = useRouter()
  const params = useSearchParams()

  const [engagement, setEngagement] = useState<Engagement>(() => {
    const tab = params.get('tab')
    return (tab && TAB_MAP[tab]) ? TAB_MAP[tab] : 'LISTING'
  })
  const [title, setTitle] = useState('')
  const [addr, setAddr] = useState<AddrState>({
    raw: '', confirmed: false,
    addrDisplay: '', addrStreetName: '', addrDirection: '', addrNumber: '', addrCity: 'Baton Rouge',
  })
  const [propType, setPropType] = useState<PropType>('')
  const [saleOn, setSaleOn] = useState(false)
  const [leaseOn, setLeaseOn] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientMode, setClientMode] = useState<ClientMode>('search')
  const [newClientName, setNewClientName] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [why, setWhy] = useState<WhyReason>('')
  const [when, setWhen] = useState('')
  const [saleEcon, setSaleEcon] = useState<SaleEcon>({ askingPrice: '', buildingSf: '', landSize: '', yearBuilt: '' })
  const [leaseEcon, setLeaseEcon] = useState<LeaseEcon>({
    availSf: '', ratePsf: '', nnnPsf: '', leaseTermMonths: '',
    commencement: '', annualEscalation: '', freeRent: '',
  })
  const [comm, setComm] = useState<CommState>({ listingRate: '6.00', coBrokerSplit: '50' })
  const [mainImageFile, setMainImageFile] = useState<File | null>(null)
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null)
  const [lacdbUrl, setLacdbUrl] = useState('')
  const [dropboxLink, setDropboxLink] = useState('')
  const [deadlineWhat, setDeadlineWhat] = useState('')
  const [deadlineWhen, setDeadlineWhen] = useState('')
  const [saving, setSaving] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('contacts').select('id, name, company').order('name').then(({ data }) => {
      if (data) setContacts(data as ContactRow[])
    })
  }, [])

  // ── Requirements ──────────────────────────────────────────────────────────
  const newClientReady = newClientEmail.trim().length > 0 || newClientPhone.trim().length > 0
  const clientMet = clientMode === 'new' ? newClientReady : !!clientId
  const clientValue = clientMode === 'new' ? newClientName || undefined : contacts.find(c => c.id === clientId)?.name

  const reqs: Req[] = (() => {
    switch (engagement) {
      case 'LISTING': return [
        { label: 'Engagement', met: true, value: 'LISTING' },
        { label: 'Address', met: addr.confirmed, value: addr.addrStreetName || undefined },
        { label: 'Property type', met: !!propType, value: propType || undefined },
        { label: 'Sale or lease', met: saleOn || leaseOn, value: saleOn && leaseOn ? 'BOTH' : saleOn ? 'SALE' : leaseOn ? 'LEASE' : undefined },
        { label: 'Client', met: clientMet, value: clientValue },
      ]
      case 'TARGET': return [
        { label: 'Engagement', met: true, value: 'TARGET' },
        { label: 'Address', met: addr.confirmed, value: addr.addrStreetName || undefined },
        { label: 'Property type', met: !!propType, value: propType || undefined },
        { label: 'Why', met: !!why, value: why || undefined },
      ]
      case 'TENANT': return [
        { label: 'Engagement', met: true, value: 'TENANT' },
        { label: 'Title', met: title.trim().length > 0, value: title || undefined },
        { label: 'Client', met: clientMet, value: clientValue },
      ]
      case 'BUYER': return [
        { label: 'Engagement', met: true, value: 'BUYER' },
        { label: 'Title', met: title.trim().length > 0, value: title || undefined },
        { label: 'Client', met: clientMet, value: clientValue },
      ]
    }
  })()

  const allMet = reqs.length > 0 && reqs.every(r => r.met)

  useEffect(() => { onAllMetChange(allMet) }, [allMet, onAllMetChange])
  useEffect(() => { onSavingChange(saving) }, [saving, onSavingChange])

  // ── Derived ───────────────────────────────────────────────────────────────
  const asking = parseFloat(saleEcon.askingPrice.replace(/[^0-9.]/g,'')) || null
  const availSf = parseFloat(leaseEcon.availSf.replace(/[^0-9.]/g,'')) || null
  const ratePsf = parseFloat(leaseEcon.ratePsf.replace(/[^0-9.]/g,'')) || null
  const leaseTermMo = parseFloat(leaseEcon.leaseTermMonths.replace(/[^0-9.]/g,'')) || null
  const monthlyBase = (availSf && ratePsf) ? (availSf * ratePsf) / 12 : null

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) { setMainImageFile(file); setMainImagePreview(URL.createObjectURL(file)) }
  }
  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) { setMainImageFile(file); setMainImagePreview(URL.createObjectURL(file)) }
  }

  const handleSave = useCallback(async () => {
    if (saving || !allMet) return
    setSaving(true)
    try {
      // Resolve contact id — may need to create a new contact first
      let resolvedClientId = clientId
      if (clientMode === 'new' && newClientReady) {
        const { data: newContact, error: contactErr } = await supabase.from('contacts').insert({
          name: newClientName.trim(),
          email: newClientEmail.trim() || null,
          phone: newClientPhone.trim() || null,
        }).select('id').single()
        if (contactErr || !newContact) throw contactErr ?? new Error('Failed to create contact')
        resolvedClientId = newContact.id
      }

      const dealName = (engagement === 'TENANT' || engagement === 'BUYER')
        ? title.trim()
        : (addr.addrDisplay || addr.raw.trim())
      const roleMap: Record<Engagement, string | null> = {
        LISTING: 'landlord', TENANT: 'tenant', BUYER: 'buyer', TARGET: null,
      }
      const { data: dealData, error: dealError } = await supabase.from('deals').insert({
        name: dealName,
        address: addr.addrDisplay || null,
        addr_street_name: addr.addrStreetName || null,
        addr_direction: addr.addrDirection || null,
        addr_number: addr.addrNumber || null,
        addr_city: addr.addrCity || 'Baton Rouge',
        addr_display: addr.addrDisplay || null,
        property_type: propType || null,
        status: 'active',
        representation_role: roleMap[engagement],
        lacdb_url: lacdbUrl || null,
        dropbox_link: dropboxLink || null,
        type: engagement.toLowerCase(),
      }).select('id').single()
      if (dealError || !dealData) throw dealError ?? new Error('No deal returned')
      const newId = dealData.id

      const hasSaleData = saleOn && (saleEcon.askingPrice || saleEcon.buildingSf)
      const hasLeaseData = leaseOn && (leaseEcon.availSf || leaseEcon.ratePsf)
      if (hasSaleData || hasLeaseData) {
        const txType = (saleOn && leaseOn) ? 'both' : saleOn ? 'sale' : 'lease'
        const listRate = parseFloat(comm.listingRate) || 0
        const coBrokerFrac = (parseFloat(comm.coBrokerSplit) || 0) / 100
        const commPct = listRate * coBrokerFrac
        await supabase.from('deal_economics').insert({
          deal_id: newId, transaction_type: txType,
          asking_price: parseFloat(saleEcon.askingPrice.replace(/[^0-9.]/g,'')) || null,
          sqft: parseFloat((saleOn ? saleEcon.buildingSf : leaseEcon.availSf).replace(/[^0-9.]/g,'')) || null,
          land_sqft: parseFloat(saleEcon.landSize.replace(/[^0-9.]/g,'')) || null,
          sale_commission_pct: saleOn ? commPct : null,
          lease_rate_psf: parseFloat(leaseEcon.ratePsf.replace(/[^0-9.]/g,'')) || null,
          nnn_psf: parseFloat(leaseEcon.nnnPsf.replace(/[^0-9.]/g,'')) || null,
          lease_term_years: leaseTermMo ? leaseTermMo / 12 : null,
          lease_commission_pct: leaseOn ? commPct : null,
        })
      }
      if (resolvedClientId) {
        await supabase.from('deal_contacts').insert({ deal_id: newId, contact_id: resolvedClientId, relationship: 'client' })
      }
      if (deadlineWhat && deadlineWhen) {
        await supabase.from('contract_deadlines').insert({
          deal_id: newId, label: deadlineWhat,
          deadline_date: deadlineWhen, deadline_type: 'custom', status: 'pending',
        })
      }
      router.push('/warroom/deal/' + newId)
    } catch (err) {
      console.error('Save error:', err)
      setSaving(false)
    }
  }, [saving, allMet, engagement, title, addr, propType, saleOn, leaseOn, clientId,
    clientMode, newClientName, newClientEmail, newClientPhone, newClientReady,
    saleEcon, leaseEcon, comm, lacdbUrl, dropboxLink, deadlineWhat, deadlineWhen, leaseTermMo, router])

  useEffect(() => { saveCallbackRef.current = handleSave }, [handleSave, saveCallbackRef])

  const isListing = engagement === 'LISTING'
  const isTarget  = engagement === 'TARGET'
  const isTenantBuyer = engagement === 'TENANT' || engagement === 'BUYER'
  const showEconomics = isListing && (saleOn || leaseOn)
  const showCommission = !isTarget

  return (
    <>
      <style>{PLACEHOLDER_STYLE}</style>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start',
          padding: '26px 32px 40px 32px', gap: 22, boxSizing: 'border-box',
        }}>
          {/* FORM COLUMN */}
          <div style={{ width: 1356, flexShrink: 0, minWidth: 0 }}>
            <div style={{
              background: C.bgPanel, border: `1px solid ${C.borderPanel}`, borderRadius: 14,
              overflow: 'hidden',
            }}>
              {/* ENGAGEMENT */}
              <div style={{ padding: '22px 26px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <FieldLabel text="ENGAGEMENT" />
                  <EngagementSegment value={engagement} onChange={setEngagement} />
                </div>
              </div>

              {/* TITLE (TENANT/BUYER) */}
              {isTenantBuyer && (<>
                <GroupDivider />
                <div style={{ padding: '22px 26px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <FieldLabel text="TITLE" />
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                      placeholder="Name it" style={FIELD_STYLE} />
                  </div>
                </div>
              </>)}

              {/* ADDRESS */}
              <GroupDivider />
              <div style={{ padding: '22px 26px' }}>
                {(isListing || isTarget) ? (
                  <AddressBlock addr={addr} onChange={setAddr} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <FieldLabel text="ADDRESS (OPTIONAL)" />
                    <input type="text" value={addr.raw}
                      onChange={e => setAddr({ ...addr, raw: e.target.value, addrDisplay: e.target.value })}
                      placeholder="Street address" style={FIELD_STYLE} />
                  </div>
                )}
              </div>

              {/* PROPERTY TYPE */}
              <GroupDivider />
              <div style={{ padding: '22px 26px' }}>
                <PropTypeSelector value={propType} onChange={setPropType} />
              </div>

              {/* SALE/LEASE */}
              {!isTarget && (<>
                <GroupDivider />
                <div style={{ padding: '22px 26px' }}>
                  {isListing ? (
                    <SaleLeaseMarks saleOn={saleOn} leaseOn={leaseOn}
                      onSale={() => setSaleOn(!saleOn)} onLease={() => setLeaseOn(!leaseOn)} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <FieldLabel text="TRANSACTION" />
                      <div style={{
                        height: 52, display: 'inline-flex', alignItems: 'center', paddingLeft: 16,
                        background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.borderHair}`,
                        borderRadius: 10, fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500, color: C.textLow,
                      }}>
                        {engagement === 'BUYER' ? 'Sale (implied)' : 'Lease (implied)'}
                      </div>
                    </div>
                  )}
                </div>
              </>)}

              {/* CLIENT */}
              {!isTarget && (<>
                <GroupDivider />
                <div style={{ padding: '22px 26px' }}>
                  <ContactPicker
                    contacts={contacts} value={clientId} onChange={setClientId}
                    clientMode={clientMode} onClientModeChange={setClientMode}
                    newClientName={newClientName} onNewClientNameChange={setNewClientName}
                    newClientEmail={newClientEmail} onNewClientEmailChange={setNewClientEmail}
                    newClientPhone={newClientPhone} onNewClientPhoneChange={setNewClientPhone}
                  />
                </div>
              </>)}

              {/* WHY/WHEN/TOUCHED (TARGET) */}
              {isTarget && (<>
                <GroupDivider />
                <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 22 }}>
                  <TargetWhyBlock why={why} when={when} onChange={(w, wh) => { setWhy(w); setWhen(wh) }} />
                </div>
              </>)}

              {/* ECONOMICS — SALE */}
              {showEconomics && saleOn && (<>
                <GroupDivider />
                <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <EconomicsSale econ={saleEcon} onChange={setSaleEcon} />
                </div>
              </>)}

              {/* ECONOMICS — LEASE */}
              {showEconomics && leaseOn && (<>
                <GroupDivider />
                <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <EconomicsLease econ={leaseEcon} onChange={setLeaseEcon} />
                </div>
              </>)}

              {/* COMMISSION */}
              {showCommission && (<>
                <GroupDivider />
                <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <CommissionBlock
                    comm={comm} onChange={setComm}
                    saleOn={saleOn} leaseOn={leaseOn}
                    askingPrice={asking} monthlyBase={monthlyBase}
                    leaseTermMonths={leaseTermMo} engagement={engagement}
                  />
                </div>
              </>)}

              {/* ATTACHMENTS */}
              <GroupDivider />
              <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', color: C.textLow }}>
                  ATTACHMENTS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <FieldLabel text="MAIN IMAGE" />
                  <div
                    onClick={() => imageInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleImageDrop}
                    style={{
                      width: 640, height: 360, boxSizing: 'border-box',
                      border: `2px dashed ${C.border}`, borderRadius: 10,
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', cursor: 'pointer', overflow: 'hidden',
                      background: mainImagePreview ? 'transparent' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    {mainImagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mainImagePreview} alt="Main" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                          stroke={C.textLow} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.textLow, marginTop: 10, letterSpacing: '0.12em' }}>
                          DROP IMAGE OR CLICK — 640 × 360 · 16:9
                        </span>
                      </>
                    )}
                  </div>
                  <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImagePick} style={{ display: 'none' }} />
                </div>

                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assets/links/lacdb-h104.png" alt="LACDB"
                    style={{ height: 52, width: 158, display: 'block', flexShrink: 0 }} />
                  <input type="text" value={lacdbUrl} onChange={e => setLacdbUrl(e.target.value)}
                    placeholder="Paste the listing URL" style={{ ...FIELD_STYLE, flex: 1 }} />
                </div>

                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{
                    width: 158, height: 52, flexShrink: 0,
                    background: 'rgba(0,122,204,0.15)', border: `1px solid rgba(0,122,204,0.30)`,
                    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, color: '#0070cc', letterSpacing: '0.12em' }}>DROPBOX</span>
                  </div>
                  <input type="text" value={dropboxLink} onChange={e => setDropboxLink(e.target.value)}
                    placeholder="Paste folder link" style={{ ...FIELD_STYLE, flex: 1 }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <FieldLabel text="FIRST DEADLINE" />
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textLow, letterSpacing: '0.18em' }}>WHAT</span>
                      <input type="text" value={deadlineWhat} onChange={e => setDeadlineWhat(e.target.value)}
                        placeholder="Name it" style={FIELD_STYLE} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textLow, letterSpacing: '0.18em' }}>WHEN</span>
                      <input type="date" value={deadlineWhen} onChange={e => setDeadlineWhen(e.target.value)}
                        style={FIELD_STYLE} />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* RIGHT RAIL */}
          <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <RequirementPanel reqs={reqs} engagement={engagement} />
            <BookPreview engagement={engagement} addr={addr} title={title} propType={propType} />
          </div>
        </div>
      </div>
    </>
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

  return <NewDealPageInner />
}

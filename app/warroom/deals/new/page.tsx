'use client'
/**
 * /warroom/deals/new — Item 142: Full create form.
 * Layout: rail 96 · identity 112 · header 78 · body scrolls.
 * At 1920: content 1824 · gutter 32 · form 1356 · gap 22 · right rail 380.
 * Left-aligned — no centred measure, no dead band.
 */

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PinGate from '@/components/warroom/PinGate'
import { DT1, DT2, DT3, DT5, DT7, DT8, DS3, DS5, DM1 } from '@/components/warroom/desktopTypes'
import { supabase } from '@/lib/supabase'
import { formatAddress } from '@/lib/formatAddress'

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
  border:      'rgba(255,255,255,0.14)',
  borderPanel: 'rgba(255,255,255,0.11)',
  borderHair:  'rgba(255,255,255,0.10)',
} as const

const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISP = "'Space Grotesk', system-ui, sans-serif"
const HOUSE_SPLIT_PCT = 75

// ── Types ─────────────────────────────────────────────────────────────────────
type Engagement = '' | 'LISTING' | 'TENANT' | 'BUYER' | 'TARGET'
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
  const dateStr = now.toLocaleDateString('en-US', {
    timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('en-US', {
    timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true,
  })
  return { dateStr, timeStr }
}

// ── IdentityBand ──────────────────────────────────────────────────────────────
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

// ── LeftRail ──────────────────────────────────────────────────────────────────
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

// ── PageHeader ────────────────────────────────────────────────────────────────
function PageHeader({ onBack }: { onBack: () => void }) {
  return (
    <div style={{
      height: 78, flexShrink: 0, display: 'flex', alignItems: 'center',
      padding: '0 32px', borderBottom: `1px solid ${C.border}`, gap: 16, background: C.bgBase,
    }}>
      <button onClick={onBack} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8, padding: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={C.textLow} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.14em', color: C.textLow }}>DEALS</span>
      </button>
      <div style={{ width: 1, height: 20, background: C.border }} />
      <span style={{ fontFamily: FONT_MONO, fontSize: 15, fontWeight: 700,
        letterSpacing: '0.12em', color: C.textHi }}>NEW DEAL</span>
    </div>
  )
}

// ── Shared UI primitives ──────────────────────────────────────────────────────
function FieldLabel({ text }: { text: string }) {
  return (
    <span style={{ ...DT8, color: C.textLow, letterSpacing: '0.18em' }}>{text}</span>
  )
}

function StyledInput({
  value, onChange, placeholder, type = 'text', readOnly = false, style = {},
}: {
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  type?: string
  readOnly?: boolean
  style?: React.CSSProperties
}) {
  return (
    <input
      type={type}
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={e => onChange?.(e.target.value)}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: readOnly ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${readOnly ? C.borderHair : C.border}`,
        borderRadius: 6, padding: '9px 12px',
        fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500,
        color: readOnly ? C.textLow : C.textHi,
        outline: 'none', letterSpacing: '0.02em',
        cursor: readOnly ? 'default' : 'text',
        ...style,
      }}
    />
  )
}

function SectionPanel({ children, style = {} }: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      background: C.bgPanel, border: `1px solid ${C.borderPanel}`,
      borderRadius: 10, padding: '26px 28px',
      display: 'flex', flexDirection: 'column', gap: 22,
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ text }: { text: string }) {
  return (
    <span style={{ ...DT5, color: C.textLow, letterSpacing: '0.2em' }}>{text}</span>
  )
}

function GroupDivider() {
  return <div style={{ height: 1, background: C.borderHair, margin: '2px 0' }} />
}

// ── Segmented control ─────────────────────────────────────────────────────────
function Segmented<T extends string>({
  options, value, onChange, label,
}: {
  options: T[]
  value: T | ''
  onChange: (v: T) => void
  label?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label && <FieldLabel text={label} />}
      <div style={{
        display: 'inline-flex', gap: 4,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${C.borderHair}`,
        borderRadius: 7, padding: 4,
      }}>
        {options.map(opt => {
          const active = value === opt
          return (
            <button key={opt} onClick={() => onChange(opt)} style={{
              padding: '7px 16px',
              background: active ? C.brand : 'transparent',
              border: 'none', cursor: 'pointer', borderRadius: 5,
              fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 600,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: active ? '#fff' : C.textLow,
              transition: 'background 0.12s, color 0.12s',
            }}>{opt}</button>
          )
        })}
      </div>
    </div>
  )
}

// ── Address lookup + confirm ──────────────────────────────────────────────────
type AddrState = {
  raw: string
  confirmed: boolean
  addrDisplay: string
  addrStreetName: string
  addrDirection: string
  addrNumber: string
  addrCity: string
}

const DIRECTIONS = ['NE','NW','SE','SW','N','S','E','W']

function parseAddrTokens(raw: string) {
  const tokens = raw.trim().split(/\s+/)
  let addrNumber = ''
  let addrDirection = ''
  const streetParts: string[] = []

  for (const tok of tokens) {
    const up = tok.toUpperCase()
    if (!addrNumber && /^\d+$/.test(tok)) {
      addrNumber = tok
    } else if (!addrDirection && DIRECTIONS.includes(up)) {
      addrDirection = up
    } else {
      streetParts.push(tok)
    }
  }

  return {
    addrNumber,
    addrDirection,
    addrStreetName: streetParts.join(' '),
    addrCity: 'Baton Rouge',
    addrDisplay: raw.trim(),
  }
}

function AddressBlock({
  addr, onChange, optional = false,
}: {
  addr: AddrState
  onChange: (a: AddrState) => void
  optional?: boolean
}) {
  const confirm = () => {
    if (!addr.raw.trim()) return
    const parsed = parseAddrTokens(addr.raw)
    onChange({
      ...addr,
      confirmed: true,
      addrDisplay: parsed.addrDisplay,
      addrStreetName: parsed.addrStreetName,
      addrDirection: parsed.addrDirection,
      addrNumber: parsed.addrNumber,
      addrCity: parsed.addrCity,
    })
  }

  const reopen = () => {
    onChange({ ...addr, confirmed: false })
  }

  if (addr.confirmed) {
    const shortForm = [addr.addrStreetName, addr.addrDirection, addr.addrNumber]
      .filter(Boolean).join(' ')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FieldLabel text={optional ? 'ADDRESS (OPTIONAL)' : 'ADDRESS'} />
        <div style={{
          background: 'rgba(139,92,246,0.06)', border: `1px solid ${C.brand}40`,
          borderRadius: 8, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 600, color: C.textHi }}>
            {shortForm || addr.addrDisplay}
          </span>
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ ...DT8, color: C.textLow, letterSpacing: '0.18em' }}>STREET</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.textMid }}>{addr.addrStreetName || '—'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ ...DT8, color: C.textLow, letterSpacing: '0.18em' }}>CARDINAL</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.textMid }}>{addr.addrDirection || '—'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ ...DT8, color: C.textLow, letterSpacing: '0.18em' }}>NUMBER</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.textMid }}>{addr.addrNumber || '—'}</span>
            </div>
          </div>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textLow }}>
            {addr.addrCity} · LA · 70808
          </span>
        </div>
        <button onClick={reopen} style={{
          alignSelf: 'flex-start', background: 'none',
          border: `1px solid ${C.border}`, borderRadius: 5, cursor: 'pointer',
          fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.16em', color: C.textLow,
          padding: '5px 12px',
        }}>CHANGE</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <FieldLabel text={optional ? 'ADDRESS (OPTIONAL)' : 'ADDRESS'} />
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={addr.raw}
          onChange={e => onChange({ ...addr, raw: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') confirm() }}
          placeholder="Street address"
          style={{
            flex: 1, boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`,
            borderRadius: 6, padding: '9px 12px',
            fontFamily: FONT_MONO, fontSize: 13, color: C.textHi, outline: 'none',
          }}
        />
        <button onClick={confirm} disabled={!addr.raw.trim()} style={{
          padding: '0 18px', background: addr.raw.trim() ? C.brand : 'rgba(139,92,246,0.15)',
          border: 'none', borderRadius: 6, cursor: addr.raw.trim() ? 'pointer' : 'not-allowed',
          fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em',
          color: addr.raw.trim() ? '#fff' : C.textLow, whiteSpace: 'nowrap',
        }}>CONFIRM</button>
      </div>
    </div>
  )
}

// ── Property type selector ────────────────────────────────────────────────────
const PROP_TYPES: PropType[] = ['OFFICE', 'RETAIL', 'LAND', 'INDUSTRIAL', 'MULTIFAMILY']

function PropTypeSelector({ value, onChange }: { value: PropType; onChange: (v: PropType) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <FieldLabel text="PROPERTY TYPE" />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {PROP_TYPES.map(pt => {
          const active = value === pt
          return (
            <button key={pt} onClick={() => onChange(active ? '' : pt)} style={{
              padding: '6px 14px',
              background: active ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${active ? C.brand : C.borderHair}`,
              borderRadius: 5, cursor: 'pointer',
              fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: active ? C.brandLift : C.textLow,
            }}>{pt}</button>
          )
        })}
      </div>
    </div>
  )
}

// ── Contact picker ────────────────────────────────────────────────────────────
function ContactPicker({
  contacts, value, onChange,
}: {
  contacts: ContactRow[]
  value: string
  onChange: (id: string) => void
}) {
  const selected = contacts.find(c => c.id === value)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <FieldLabel text="CLIENT" />
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`,
            borderRadius: 6, padding: '9px 12px',
            fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500,
            color: value ? C.textHi : C.textLow, outline: 'none',
            cursor: 'pointer', appearance: 'none',
          }}
        >
          <option value="" style={{ background: '#12111B', color: '#8E8CA0' }}>Select contact...</option>
          {contacts.map(c => (
            <option key={c.id} value={c.id} style={{ background: '#12111B', color: '#EFEEF4' }}>
              {c.name}{c.company ? ` — ${c.company}` : ''}
            </option>
          ))}
        </select>
        <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textLow} strokeWidth="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {selected && (
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textLow }}>
          {selected.company || ''}
        </span>
      )}
    </div>
  )
}

// ── Derived field display ─────────────────────────────────────────────────────
function DerivedField({ label, arithmetic, value }: { label: string; arithmetic: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <FieldLabel text={label} />
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.borderHair}`,
        borderRadius: 6, padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: 3,
      }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: C.textLow, letterSpacing: '0.1em' }}>
          {arithmetic}
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 600, color: value ? C.moneyIn : C.textLow }}>
          {value || ''}
        </span>
      </div>
    </div>
  )
}

// ── Economics SALE ────────────────────────────────────────────────────────────
interface SaleEcon {
  askingPrice: string
  buildingSf: string
  landSize: string
  yearBuilt: string
}

function EconomicsSale({ econ, onChange }: { econ: SaleEcon; onChange: (e: SaleEcon) => void }) {
  const asking = parseFloat(econ.askingPrice.replace(/[^0-9.]/g, '')) || null
  const sf = parseFloat(econ.buildingSf.replace(/[^0-9.]/g, '')) || null
  const pricePsf = (asking && sf && sf > 0) ? asking / sf : null

  const fmtDollar = (n: number | null) => n == null ? '' : '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  const fmtPsf = (n: number | null) => n == null ? '' : '$' + n.toFixed(2) + '/sf'

  const cell = (label: string, field: keyof SaleEcon, placeholder?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <FieldLabel text={label} />
      <StyledInput
        value={econ[field]}
        onChange={v => onChange({ ...econ, [field]: v })}
        placeholder={placeholder}
      />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionTitle text="ECONOMICS — SALE" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
        {cell('ASKING PRICE', 'askingPrice')}
        {cell('BUILDING SF', 'buildingSf')}
        {cell('LAND SIZE', 'landSize')}
        {cell('YEAR BUILT', 'yearBuilt')}
        <DerivedField
          label="PRICE PSF"
          arithmetic="asking ÷ sf"
          value={fmtPsf(pricePsf)}
        />
        <div /><div /><div />
      </div>
    </div>
  )
}

// ── Economics LEASE ───────────────────────────────────────────────────────────
interface LeaseEcon {
  availSf: string
  ratePsf: string
  nnnPsf: string
  leaseTermMonths: string
  commencement: string
  annualEscalation: string
  freeRent: string
}

function EconomicsLease({ econ, onChange }: { econ: LeaseEcon; onChange: (e: LeaseEcon) => void }) {
  const sf = parseFloat(econ.availSf.replace(/[^0-9.]/g, '')) || null
  const rate = parseFloat(econ.ratePsf.replace(/[^0-9.]/g, '')) || null
  const nnn = parseFloat(econ.nnnPsf.replace(/[^0-9.]/g, '')) || null
  const months = parseFloat(econ.leaseTermMonths.replace(/[^0-9.]/g, '')) || null

  const grossRate = (rate != null && nnn != null) ? rate + nnn : null
  const monthlyBase = (sf && rate) ? (sf * rate) / 12 : null
  const monthlyNNN = (sf && nnn) ? (sf * nnn) / 12 : null
  const monthlyGross = (monthlyBase != null && monthlyNNN != null) ? monthlyBase + monthlyNNN : null

  const fmtDollar = (n: number | null) => n == null ? '' : '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  const fmtPsf = (n: number | null) => n == null ? '' : '$' + n.toFixed(2) + '/sf'

  const cell = (label: string, field: keyof LeaseEcon, placeholder?: string, type = 'text') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <FieldLabel text={label} />
      <StyledInput
        value={econ[field]}
        onChange={v => onChange({ ...econ, [field]: v })}
        placeholder={placeholder}
        type={type}
      />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionTitle text="ECONOMICS — LEASE" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
        {/* Row 1: 3 typed + 1 derived */}
        {cell('AVAILABLE SF', 'availSf')}
        {cell('RATE PSF', 'ratePsf')}
        {cell('NNN PSF', 'nnnPsf')}
        <DerivedField label="GROSS RATE PSF" arithmetic="rate + nnn" value={fmtPsf(grossRate)} />

        {/* Row 2: 3 derived + 1 empty */}
        <DerivedField label="MONTHLY BASE" arithmetic="(sf × rate) ÷ 12" value={fmtDollar(monthlyBase)} />
        <DerivedField label="MONTHLY NNN" arithmetic="(sf × nnn) ÷ 12" value={fmtDollar(monthlyNNN)} />
        <DerivedField label="MONTHLY GROSS RENT" arithmetic="base + NNN" value={fmtDollar(monthlyGross)} />
        <div />

        {/* Row 3: typed */}
        {cell('LEASE TERM (MO)', 'leaseTermMonths')}
        {cell('COMMENCEMENT', 'commencement', 'Pick a date', 'date')}
        {cell('ANNUAL ESCALATION', 'annualEscalation', 'Percent per year')}
        {cell('FREE RENT', 'freeRent', 'Months, if any')}
      </div>
    </div>
  )
}

// ── Commission block ──────────────────────────────────────────────────────────
interface CommissionState {
  listingRate: string  // e.g. "6.00"
  coBrokerSplit: string // e.g. "50"
}

function CommissionBlock({
  comm, onChange, saleOn, leaseOn,
  askingPrice, monthlyBase, leaseTermMonths, engagement,
}: {
  comm: CommissionState
  onChange: (c: CommissionState) => void
  saleOn: boolean
  leaseOn: boolean
  askingPrice: number | null
  monthlyBase: number | null
  leaseTermMonths: number | null
  engagement: Engagement
}) {
  const rate = parseFloat(comm.listingRate) || null
  const coBroker = parseFloat(comm.coBrokerSplit) || null
  const isTenantBuyer = engagement === 'TENANT' || engagement === 'BUYER'

  const calcSold = (rate && coBroker && askingPrice)
    ? askingPrice * (rate / 100) * (coBroker / 100) * 0.75
    : null
  const calcLeased = (rate && coBroker && monthlyBase && leaseTermMonths)
    ? monthlyBase * leaseTermMonths * (rate / 100) * (coBroker / 100) * 0.75
    : null

  const fmtDollar = (n: number | null) => n == null ? '' : '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })

  const showBoth = saleOn && leaseOn
  const showSold = (saleOn && !leaseOn) || showBoth
  const showLeased = (leaseOn && !saleOn) || showBoth

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionTitle text="COMMISSION" />
      {/* Rate chain */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <FieldLabel text="LISTING RATE (%)" />
          <StyledInput value={comm.listingRate} onChange={v => onChange({ ...comm, listingRate: v })} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <FieldLabel text="CO-BROKER SPLIT (%)" />
          <StyledInput value={comm.coBrokerSplit} onChange={v => onChange({ ...comm, coBrokerSplit: v })} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <FieldLabel text="HOUSE SPLIT (%)" />
          <StyledInput value="75.00" readOnly />
        </div>
        <div />
      </div>

      {/* Estimates — shown for LISTING only; TENANT/BUYER: chain visible, figures blank */}
      {!isTenantBuyer && (showSold || showLeased) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {showSold && (
            <div style={{ display: 'flex', gap: 20, alignItems: 'center',
              background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '10px 14px',
              border: `1px solid ${C.borderHair}` }}>
              <span style={{ ...DT8, color: C.textLow, letterSpacing: '0.14em', flex: 1 }}>
                EST. COMMISSION IF SOLD
              </span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700,
                color: calcSold ? C.moneyIn : C.textLow }}>
                {fmtDollar(calcSold)}
              </span>
              {calcSold && (
                <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: C.textLow }}>
                  asking × rate × co-broker × 0.75
                </span>
              )}
            </div>
          )}
          {showLeased && (
            <div style={{ display: 'flex', gap: 20, alignItems: 'center',
              background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '10px 14px',
              border: `1px solid ${C.borderHair}` }}>
              <span style={{ ...DT8, color: C.textLow, letterSpacing: '0.14em', flex: 1 }}>
                EST. COMMISSION IF LEASED
              </span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700,
                color: calcLeased ? C.moneyIn : C.textLow }}>
                {fmtDollar(calcLeased)}
              </span>
              {calcLeased && (
                <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: C.textLow }}>
                  monthly base × term mo × rate × co-broker × 0.75
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* TENANT/BUYER — rate chain visible, estimate rows blank (not dash) */}
      {isTenantBuyer && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center',
            background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '10px 14px',
            border: `1px solid ${C.borderHair}` }}>
            <span style={{ ...DT8, color: C.textLow, letterSpacing: '0.14em', flex: 1 }}>
              {engagement === 'BUYER' ? 'EST. COMMISSION IF SOLD' : 'EST. COMMISSION IF LEASED'}
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700, color: C.textLow }}>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Requirements rail ─────────────────────────────────────────────────────────
interface Requirement { label: string; met: boolean }

function RequirementsRail({
  requirements, engagement, onSave, saving,
}: {
  requirements: Requirement[]
  engagement: Engagement
  onSave: () => void
  saving: boolean
}) {
  const metCount = requirements.filter(r => r.met).length
  const total = requirements.length
  const allMet = total > 0 && metCount === total

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Requirements panel */}
      <div style={{
        background: C.bgPanel, border: `1px solid ${C.borderPanel}`,
        borderRadius: 10, padding: '22px 22px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <SectionTitle text="REQUIREMENTS" />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 26, fontWeight: 700,
            color: allMet ? C.moneyIn : C.textMid, letterSpacing: '-0.02em' }}>
            {total > 0 ? metCount : '—'}
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textLow, letterSpacing: '0.10em' }}>
            {total > 0 ? `OF ${total}` : 'OF —'}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requirements.length === 0 ? (
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textLow }}>
              Select engagement to see requirements.
            </span>
          ) : (
            requirements.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  background: r.met ? C.moneyIn : 'transparent',
                  border: `1.5px solid ${r.met ? C.moneyIn : C.borderPanel}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {r.met && (
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                      <polyline points="2,6 5,9 10,3" stroke="#050509" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 500,
                  letterSpacing: '0.12em', color: r.met ? C.textHi : C.textLow }}>
                  {r.label}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CREATE DEAL button */}
      <button
        onClick={allMet && !saving ? onSave : undefined}
        disabled={!allMet || saving}
        style={{
          width: '100%', padding: '14px 0', borderRadius: 8, cursor: allMet && !saving ? 'pointer' : 'not-allowed',
          fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.18em',
          color: allMet ? '#fff' : C.textLow,
          border: 'none', outline: 'none',
          background: allMet
            ? `linear-gradient(135deg, ${C.brandStrong}, ${C.brand})`
            : 'rgba(139,92,246,0.08)',
          boxShadow: allMet
            ? `0 0 24px ${C.brand}60, 0 0 48px ${C.brand}30`
            : 'none',
          transition: 'box-shadow 0.2s, background 0.2s',
        }}
      >
        {saving ? 'SAVING...' : 'CREATE DEAL'}
      </button>
    </div>
  )
}

// ── Main form (uses useSearchParams — must be inside Suspense) ─────────────────
const TAB_MAP: Record<string, Engagement> = {
  listings: 'LISTING',
  tenants:  'TENANT',
  buyers:   'BUYER',
  targets:  'TARGET',
}

function NewDealForm() {
  const router = useRouter()
  const params = useSearchParams()

  // ── State ────────────────────────────────────────────────────────────────────
  const [engagement, setEngagement] = useState<Engagement>(() => {
    const tab = params.get('tab')
    return tab ? (TAB_MAP[tab] ?? '') : ''
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
  const [contacts, setContacts] = useState<ContactRow[]>([])

  // TARGET fields
  const [why, setWhy] = useState<WhyReason>('')
  const [when, setWhen] = useState('')

  // SALE economics
  const [saleEcon, setSaleEcon] = useState<SaleEcon>({
    askingPrice: '', buildingSf: '', landSize: '', yearBuilt: '',
  })

  // LEASE economics
  const [leaseEcon, setLeaseEcon] = useState<LeaseEcon>({
    availSf: '', ratePsf: '', nnnPsf: '', leaseTermMonths: '',
    commencement: '', annualEscalation: '', freeRent: '',
  })

  // Commission
  const [comm, setComm] = useState<CommissionState>({ listingRate: '6.00', coBrokerSplit: '50' })

  // Attachments
  const [mainImageFile, setMainImageFile] = useState<File | null>(null)
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null)
  const [lacdbUrl, setLacdbUrl] = useState('')
  const [dropboxLink, setDropboxLink] = useState('')
  const [deadlineWhat, setDeadlineWhat] = useState('')
  const [deadlineWhen, setDeadlineWhen] = useState('')

  const [saving, setSaving] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // ── Load contacts ─────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('contacts').select('id, name, company').order('name').then(({ data }) => {
      if (data) setContacts(data as ContactRow[])
    })
  }, [])

  // ── Requirements computation ──────────────────────────────────────────────
  const requirements: Requirement[] = (() => {
    switch (engagement) {
      case 'LISTING':
        return [
          { label: 'ENGAGEMENT',    met: true },
          { label: 'ADDRESS',       met: addr.confirmed },
          { label: 'PROPERTY TYPE', met: !!propType },
          { label: 'SALE OR LEASE', met: saleOn || leaseOn },
          { label: 'CLIENT',        met: !!clientId },
        ]
      case 'TARGET':
        return [
          { label: 'ENGAGEMENT',    met: true },
          { label: 'ADDRESS',       met: addr.confirmed },
          { label: 'PROPERTY TYPE', met: !!propType },
          { label: 'WHY',           met: !!why },
        ]
      case 'TENANT':
      case 'BUYER':
        return [
          { label: 'ENGAGEMENT', met: true },
          { label: 'TITLE',      met: title.trim().length > 0 },
          { label: 'CLIENT',     met: !!clientId },
        ]
      default:
        return []
    }
  })()

  // ── Derived figures for commission ────────────────────────────────────────
  const asking = parseFloat(saleEcon.askingPrice.replace(/[^0-9.]/g, '')) || null
  const availSf = parseFloat(leaseEcon.availSf.replace(/[^0-9.]/g, '')) || null
  const ratePsf = parseFloat(leaseEcon.ratePsf.replace(/[^0-9.]/g, '')) || null
  const nnnPsf  = parseFloat(leaseEcon.nnnPsf.replace(/[^0-9.]/g, '')) || null
  const leaseTermMo = parseFloat(leaseEcon.leaseTermMonths.replace(/[^0-9.]/g, '')) || null
  const monthlyBase = (availSf && ratePsf) ? (availSf * ratePsf) / 12 : null

  // ── Image handler ─────────────────────────────────────────────────────────
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
    if (file) {
      setMainImageFile(file)
      setMainImagePreview(URL.createObjectURL(file))
    }
  }

  // ── Operator save ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      // 1. Determine name
      const dealName = (engagement === 'TENANT' || engagement === 'BUYER')
        ? title.trim()
        : (addr.addrDisplay || addr.raw.trim())

      // Representation role
      const roleMap: Record<Engagement, string | null> = {
        LISTING: 'landlord', TENANT: 'tenant', BUYER: 'buyer', TARGET: null, '': null,
      }

      // Insert deal
      const { data: dealData, error: dealError } = await supabase
        .from('deals')
        .insert({
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
        })
        .select('id')
        .single()

      if (dealError || !dealData) throw dealError ?? new Error('No deal returned')
      const newId = dealData.id

      // 2. Economics
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
          asking_price: parseFloat(saleEcon.askingPrice.replace(/[^0-9.]/g, '')) || null,
          sqft: parseFloat((saleOn ? saleEcon.buildingSf : leaseEcon.availSf).replace(/[^0-9.]/g, '')) || null,
          land_sqft: parseFloat(saleEcon.landSize.replace(/[^0-9.]/g, '')) || null,
          sale_commission_pct: saleOn ? commPct : null,
          lease_rate_psf: parseFloat(leaseEcon.ratePsf.replace(/[^0-9.]/g, '')) || null,
          nnn_psf: parseFloat(leaseEcon.nnnPsf.replace(/[^0-9.]/g, '')) || null,
          lease_term_years: leaseTermMo ? leaseTermMo / 12 : null,
          lease_commission_pct: leaseOn ? commPct : null,
        })
      }

      // 3. Contact
      if (clientId) {
        await supabase.from('deal_contacts').insert({
          deal_id: newId,
          contact_id: clientId,
          relationship: 'client',
        })
      }

      // 4. First deadline
      if (deadlineWhat && deadlineWhen) {
        await supabase.from('contract_deadlines').insert({
          deal_id: newId,
          label: deadlineWhat,
          deadline_date: deadlineWhen,
          deadline_type: 'custom',
          status: 'pending',
        })
      }

      // 5. Navigate
      router.push('/warroom/deal2?id=' + newId)
    } catch (err) {
      console.error('Save error:', err)
      setSaving(false)
    }
  }, [
    saving, engagement, title, addr, propType, saleOn, leaseOn, clientId,
    saleEcon, leaseEcon, comm, lacdbUrl, dropboxLink, deadlineWhat, deadlineWhen,
    leaseTermMo, router,
  ])

  // ── Render ────────────────────────────────────────────────────────────────
  const isListing = engagement === 'LISTING'
  const isTarget  = engagement === 'TARGET'
  const isTenantBuyer = engagement === 'TENANT' || engagement === 'BUYER'
  const showEconomics = isListing && (saleOn || leaseOn)
  const showCommission = !isTarget && engagement !== ''
  const impliedType = engagement === 'TENANT' ? 'LEASE' : engagement === 'BUYER' ? 'SALE' : null

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        padding: '32px 32px 64px 32px', gap: 22, boxSizing: 'border-box',
      }}>

        {/* ── Form column — 1356px ── */}
        <div style={{ width: 1356, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ═══ REQUIREMENTS SECTION ═══ */}
          <SectionPanel>
            <SectionTitle text="REQUIREMENTS" />

            {/* ENGAGEMENT — always first */}
            <Segmented<Engagement>
              options={['LISTING', 'TENANT', 'BUYER', 'TARGET']}
              value={engagement}
              onChange={setEngagement}
              label="ENGAGEMENT"
            />

            {engagement !== '' && <GroupDivider />}

            {/* TENANT / BUYER — title block first */}
            {isTenantBuyer && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <FieldLabel text="TITLE" />
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Name it"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`,
                      borderRadius: 6, padding: '9px 12px',
                      fontFamily: FONT_MONO, fontSize: 15, fontWeight: 600,
                      color: C.textHi, outline: 'none', letterSpacing: '0.02em',
                    }}
                  />
                  <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.textLow }}>
                    This is the deal name and counts as the primary requirement.
                  </span>
                </div>
                <GroupDivider />

                <PropTypeSelector value={propType} onChange={setPropType} />
                <GroupDivider />

                <ContactPicker contacts={contacts} value={clientId} onChange={setClientId} />
                <GroupDivider />

                {/* Address — optional for TENANT/BUYER */}
                <AddressBlock addr={addr} onChange={setAddr} optional />
                <GroupDivider />

                {/* Transaction type — READ STATE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <FieldLabel text="TRANSACTION TYPE" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      padding: '6px 14px',
                      background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.borderHair}`,
                      borderRadius: 5, fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 600,
                      letterSpacing: '0.14em', color: C.textLow,
                    }}>{impliedType}</div>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.textLow }}>
                      Implied by {engagement} engagement — read state only
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* LISTING fields */}
            {isListing && (
              <>
                <AddressBlock addr={addr} onChange={setAddr} />
                <GroupDivider />
                <PropTypeSelector value={propType} onChange={setPropType} />
                <GroupDivider />

                {/* SALE / LEASE — independent marks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <FieldLabel text="TRANSACTION — SELECT ONE OR BOTH" />
                  <div style={{ display: 'flex', gap: 12 }}>
                    {[{ label: 'SALE', val: saleOn, set: setSaleOn }, { label: 'LEASE', val: leaseOn, set: setLeaseOn }].map(({ label, val, set }) => (
                      <button key={label} onClick={() => set(!val)} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 18px',
                        background: val ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1.5px solid ${val ? C.brand : C.borderHair}`,
                        borderRadius: 7, cursor: 'pointer',
                        fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700,
                        letterSpacing: '0.16em', color: val ? C.brandLift : C.textLow,
                      }}>
                        <div style={{
                          width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                          background: val ? C.brand : 'transparent',
                          border: `1.5px solid ${val ? C.brand : C.textLow}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {val && (
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                              <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#fff" strokeWidth="1.8"
                                strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        {label}
                      </button>
                    ))}
                  </div>
                  {isListing && !saleOn && !leaseOn && (
                    <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: '#FFA23A' }}>
                      At least one required for LISTING.
                    </span>
                  )}
                </div>
                <GroupDivider />

                <ContactPicker contacts={contacts} value={clientId} onChange={setClientId} />
              </>
            )}

            {/* TARGET fields */}
            {isTarget && (
              <>
                <AddressBlock addr={addr} onChange={setAddr} />
                <GroupDivider />
                <PropTypeSelector value={propType} onChange={setPropType} />
                <GroupDivider />

                {/* WHY */}
                <Segmented<WhyReason>
                  options={['LOCATION', 'CLIENT', 'SIZE', 'PRICE', 'OPPORTUNITY']}
                  value={why}
                  onChange={setWhy}
                  label="WHY"
                />
                <GroupDivider />

                {/* WHEN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <FieldLabel text="WHEN" />
                  <input
                    type="text"
                    value={when}
                    onChange={e => setWhen(e.target.value)}
                    placeholder="Year or WATCHING"
                    style={{
                      width: 240, boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`,
                      borderRadius: 6, padding: '9px 12px',
                      fontFamily: FONT_MONO, fontSize: 13, color: C.textHi, outline: 'none',
                    }}
                  />
                </div>
                <GroupDivider />

                {/* TOUCHED */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <FieldLabel text="TOUCHED" />
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.borderHair}`,
                    borderRadius: 6, padding: '8px 12px',
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.moneyIn }} />
                    <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textLow }}>Set on create</span>
                  </div>
                </div>
              </>
            )}
          </SectionPanel>

          {/* ═══ ECONOMICS SECTION ═══ */}
          {showEconomics && (
            <SectionPanel>
              <SectionTitle text="ECONOMICS" />
              {saleOn && (
                <EconomicsSale econ={saleEcon} onChange={setSaleEcon} />
              )}
              {saleOn && leaseOn && <GroupDivider />}
              {leaseOn && (
                <EconomicsLease econ={leaseEcon} onChange={setLeaseEcon} />
              )}
            </SectionPanel>
          )}

          {/* ═══ COMMISSION BLOCK ═══ */}
          {showCommission && (
            <SectionPanel>
              <CommissionBlock
                comm={comm} onChange={setComm}
                saleOn={saleOn} leaseOn={leaseOn}
                askingPrice={asking}
                monthlyBase={monthlyBase}
                leaseTermMonths={leaseTermMo}
                engagement={engagement}
              />
            </SectionPanel>
          )}

          {/* ═══ ATTACHMENTS SECTION ═══ */}
          {engagement !== '' && (
            <SectionPanel>
              <SectionTitle text="ATTACHMENTS" />

              {/* MAIN IMAGE — 640×360 16:9 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <FieldLabel text="MAIN IMAGE" />
                <div
                  onClick={() => imageInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleImageDrop}
                  style={{
                    width: 640, height: 360, boxSizing: 'border-box',
                    border: `2px dashed ${C.border}`, borderRadius: 8,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer', overflow: 'hidden',
                    background: mainImagePreview ? 'transparent' : 'rgba(255,255,255,0.02)',
                    position: 'relative',
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
                      <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.textLow,
                        marginTop: 10, letterSpacing: '0.12em' }}>
                        DROP IMAGE OR CLICK — 640 × 360 · 16:9
                      </span>
                    </>
                  )}
                </div>
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImagePick}
                  style={{ display: 'none' }} />
              </div>

              {/* LINKS — only for non-TARGET */}
              {!isTarget && (
                <>
                  <GroupDivider />
                  {/* LACDB */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <FieldLabel text="LACDB LISTING" />
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/assets/links/lacdb-h104.png" alt="LACDB"
                        style={{ height: 52, width: 158, display: 'block', flexShrink: 0 }} />
                      <StyledInput
                        value={lacdbUrl}
                        onChange={setLacdbUrl}
                        placeholder="Paste the listing URL"
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>

                  {/* Dropbox */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <FieldLabel text="DROPBOX FOLDER" />
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{
                        width: 158, height: 52, flexShrink: 0,
                        background: 'rgba(0,122,204,0.15)', border: `1px solid rgba(0,122,204,0.3)`,
                        borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700,
                          color: '#0070cc', letterSpacing: '0.12em' }}>DROPBOX</span>
                      </div>
                      <StyledInput
                        value={dropboxLink}
                        onChange={setDropboxLink}
                        placeholder="Paste the listing URL"
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                </>
              )}

              <GroupDivider />

              {/* FIRST DEADLINE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <FieldLabel text="FIRST DEADLINE" />
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ ...DT8, color: C.textLow, fontSize: 9.5 }}>WHAT</span>
                    <StyledInput value={deadlineWhat} onChange={setDeadlineWhat} placeholder="Name it" />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ ...DT8, color: C.textLow, fontSize: 9.5 }}>WHEN</span>
                    <StyledInput value={deadlineWhen} onChange={setDeadlineWhen} placeholder="Pick a date" type="date" />
                  </div>
                </div>
              </div>
            </SectionPanel>
          )}
        </div>

        {/* ── Right rail — 380px ── */}
        <div style={{ width: 380, flexShrink: 0 }}>
          <RequirementsRail
            requirements={requirements}
            engagement={engagement}
            onSave={handleSave}
            saving={saving}
          />
        </div>
      </div>
    </div>
  )
}

// ── Suspense shell ────────────────────────────────────────────────────────────
function NewDealFormShell() {
  return (
    <Suspense fallback={
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textLow, letterSpacing: '0.18em' }}>
          LOADING...
        </span>
      </div>
    }>
      <NewDealForm />
    </Suspense>
  )
}

// ── Inner page shell ──────────────────────────────────────────────────────────
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
        <PageHeader onBack={() => router.push('/warroom/deals')} />
        <NewDealFormShell />
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

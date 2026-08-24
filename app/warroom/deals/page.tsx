'use client'

/**
 * /warroom/deals — Deals Index (LISTINGS only)
 * Item 6 — build(48k)
 * Four tabs: ACTIVE, PIPELINE, IN REVIEW, IN SERVICE
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PinGate from '@/components/warroom/PinGate'

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
  bgBase:     '#050509',
  bgPanel:    '#12111B',
  bgRail:     '#0C0B14',
  bgRaise:    '#1E1D26',
  textHi:     '#EFEEF4',
  textMid:    '#B8B6C6',
  textLow:    '#8E8CA0',
  brand:      '#8B5CF6',
  brandLift:  '#A78BFA',
  border:     'rgba(255,255,255,0.14)',
  borderPanel:'rgba(255,255,255,0.11)',
} as const

const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISP = "'Space Grotesk', system-ui, sans-serif"

// ── Types ─────────────────────────────────────────────────────────────────────
type TabStatus = 'active' | 'pipeline' | 'in_review' | 'in_service'

interface DealRow {
  id: string
  addr_display: string | null
  name: string | null
  property_type: string | null
  status: string | null
}

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS: { id: TabStatus; label: string }[] = [
  { id: 'active',     label: 'ACTIVE' },
  { id: 'pipeline',   label: 'PIPELINE' },
  { id: 'in_review',  label: 'IN REVIEW' },
  { id: 'in_service', label: 'IN SERVICE' },
]

// ── Deal type chip ────────────────────────────────────────────────────────────
function TypeChip({ type }: { type: string | null }) {
  if (!type) return null
  const label = type.replace(/_/g, ' ').toUpperCase()
  return (
    <span style={{
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      fontFamily: FONT_MONO,
      padding: '2px 7px',
      borderRadius: 4,
      background: 'rgba(139,92,246,0.12)',
      color: C.brandLift,
      border: '1px solid rgba(139,92,246,0.3)',
      flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  const label = status.replace(/_/g, ' ').toUpperCase()
  const colorMap: Record<string, string> = {
    active:     '#34D399',
    pipeline:   '#A78BFA',
    in_review:  '#FFA23A',
    in_service: '#4F8EF7',
  }
  const color = colorMap[status] ?? C.textLow
  return (
    <span style={{
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      fontFamily: FONT_MONO,
      padding: '2px 7px',
      borderRadius: 4,
      background: `${color}18`,
      color,
      border: `1px solid ${color}44`,
      flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

// ── Left Rail ─────────────────────────────────────────────────────────────────
function LeftRail() {
  const router = useRouter()

  const slots = [
    {
      id: 'HOME',
      label: 'HOME',
      href: '/warroom',
      glyph: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      id: 'PEOPLE',
      label: 'PEOPLE',
      href: '/warroom/contacts',
      glyph: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      id: 'DEALS',
      label: 'DEALS',
      href: '/warroom/deals',
      glyph: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
    },
  ]

  return (
    <div style={{
      width: 96,
      flexShrink: 0,
      height: '100%',
      background: C.bgRail,
      borderRight: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 16,
      gap: 4,
    }}>
      {slots.map(s => {
        const isActive = s.id === 'DEALS'
        return (
          <button
            key={s.id}
            onClick={() => router.push(s.href)}
            style={{
              width: 76,
              padding: '13px 0',
              borderRadius: 10,
              border: 'none',
              background: isActive ? 'rgba(139,92,246,0.14)' : 'transparent',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 7,
              cursor: 'pointer',
              color: isActive ? C.brandLift : C.textLow,
            }}
          >
            {s.glyph}
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'inherit' }}>{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Identity Band ─────────────────────────────────────────────────────────────
function IdentityBand() {
  return (
    <div style={{
      height: 56,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      borderBottom: `1px solid ${C.borderPanel}`,
      gap: 12,
    }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.brandLift }}>
        ShirleyCRE
      </span>
      <div style={{ width: 1, height: 16, background: C.borderPanel }} />
      <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.textLow }}>
        WAR ROOM
      </span>
      <div style={{ flex: 1 }} />
      <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.textLow }}>
        DEALS
      </span>
    </div>
  )
}

// ── Deal Row ──────────────────────────────────────────────────────────────────
function DealRow({ deal, onClick }: { deal: DealRow; onClick: () => void }) {
  const display = deal.addr_display ?? deal.name ?? '—'
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px',
        cursor: 'pointer',
        borderBottom: `1px solid ${C.borderPanel}`,
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: FONT_DISP,
          fontSize: 14,
          fontWeight: 500,
          color: C.textHi,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {display}
        </div>
      </div>
      <TypeChip type={deal.property_type} />
      <StatusBadge status={deal.status} />
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textLow} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  )
}

// ── Main inner component ───────────────────────────────────────────────────────
function DealsPageInner() {
  const router = useRouter()
  const [pinValid, setPinValid] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<TabStatus>('active')
  const [deals, setDeals] = useState<DealRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const expiry = localStorage.getItem(SESSION_KEY)
    if (expiry && Date.now() < parseInt(expiry)) setPinValid(true)
    else setPinValid(false)
  }, [])

  const handlePinSuccess = useCallback(() => {
    const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000
    localStorage.setItem(SESSION_KEY, expiry.toString())
    setPinValid(true)
  }, [])

  useEffect(() => {
    if (!pinValid) return
    setLoading(true)
    supabase
      .from('deals')
      .select('id, addr_display, name, property_type, status')
      .eq('status', activeTab)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setDeals((data ?? []) as DealRow[])
        setLoading(false)
      })
  }, [pinValid, activeTab])

  if (pinValid === null) {
    return (
      <div style={{ background: C.bgBase, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.textLow }}>
          Loading…
        </span>
      </div>
    )
  }

  if (!pinValid) {
    return (
      <PinGate
        pinHash={PIN_HASH}
        sha256={sha256}
        onSuccess={handlePinSuccess}
      />
    )
  }

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      background: C.bgBase,
      color: C.textHi,
      fontFamily: FONT_DISP,
    }}>
      {/* Left rail */}
      <LeftRail />

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Identity band */}
        <IdentityBand />

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: 0,
          borderBottom: `1px solid ${C.borderPanel}`,
          flexShrink: 0,
          padding: '0 24px',
        }}>
          {TABS.map(tab => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? `2px solid ${C.brandLift}` : '2px solid transparent',
                  padding: '13px 18px 11px',
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: isActive ? C.brandLift : C.textLow,
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Deal list */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: '24px', fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.12em', color: C.textLow }}>
              Loading…
            </div>
          ) : deals.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.textLow }}>
              No {activeTab.replace(/_/g, ' ')} deals
            </div>
          ) : (
            deals.map(deal => (
              <DealRow
                key={deal.id}
                deal={deal}
                onClick={() => router.push(`/warroom/deal?id=${deal.id}`)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default function DealsPage() {
  return <DealsPageInner />
}

'use client'

import React from 'react'
import { useState, useEffect, useCallback } from 'react'
import type { JSX } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PinGate from '@/components/warroom/PinGate'
import Sidebar from '@/components/warroom/Sidebar'
import StatsRibbon from '@/components/warroom/StatsRibbon'
import BattlePlanPanel from '@/components/warroom/BattlePlanPanel'
import SchedulePanel from '@/components/warroom/SchedulePanel'
import HotPanel from '@/components/warroom/HotPanel'
import UnderContractPanel from '@/components/warroom/UnderContractPanel'
import MoneyMoversPanel from '@/components/warroom/MoneyMoversPanel'
import DealPipelinePanel from '@/components/warroom/DealPipelinePanel'
import AccountsReceivablePanel from '@/components/warroom/AccountsReceivablePanel'
import ShirleyCREAgentCard from '@/components/warroom/ShirleyCREAgentCard'
import LifePanel from '@/components/warroom/LifePanel'
import EntitiesPanel from '@/components/warroom/EntitiesPanel'
import PortfolioPanel from '@/components/warroom/PortfolioPanel'

const SESSION_KEY = 'wr_session_exp_v2'
const SESSION_HOURS = 8

// SHA-256 hash of "1887"
const DEFAULT_PIN_HASH = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

type NavSection = 'life' | 'entities' | 'portfolio'

// ─── NAV SECTION CONFIG ─────────────────────────────────────────────────────
const NAV_SECTIONS: {
  id: NavSection
  label: string
  icon: () => JSX.Element
}[] = [
  { id: 'life',      label: 'Life',      icon: HeartIcon     },
  { id: 'entities',  label: 'Entities',  icon: BuildingIcon  },
  { id: 'portfolio', label: 'Portfolio', icon: ChartIcon     },
]

export default function WarRoomPage() {
  const [unlocked, setUnlocked] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activePanel, setActivePanel] = useState('overview')
  const [activeSection, setActiveSection] = useState<NavSection | 'operations'>('operations')

  useEffect(() => {
    const expiry = localStorage.getItem(SESSION_KEY)
    if (expiry && Date.now() < parseInt(expiry)) {
      setUnlocked(true)
    }
  }, [])

  const handlePinSuccess = useCallback(() => {
    const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000
    localStorage.setItem(SESSION_KEY, expiry.toString())
    setShowFlash(true)
    setTimeout(() => {
      setShowFlash(false)
      setUnlocked(true)
    }, 800)
  }, [])

  if (!unlocked) {
    return (
      <>
        <PinGate
          pinHash={DEFAULT_PIN_HASH}
          sha256={sha256}
          onSuccess={handlePinSuccess}
        />
        <AnimatePresence>
          {showFlash && (
            <motion.div
              className="gold-flash-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            />
          )}
        </AnimatePresence>
      </>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: 'var(--bg-page)',
        overflow: 'hidden',
        // CSS variable overrides — cascade to all child components
        ['--bg-base' as string]: 'var(--bg-page)',
        ['--bg-card' as string]: '#1A1E25',
        ['--bg-elevated' as string]: '#22272F',
        ['--accent-gold' as string]: '#E8B84B',
        ['--accent-gold-light' as string]: '#F5CE7A',
        ['--text-primary' as string]: '#F0F2FF',
        ['--text-muted' as string]: '#6B7280',
        ['--success' as string]: '#22C55E',
        ['--danger' as string]: '#EF4444',
        ['--border-subtle' as string]: 'rgba(255,255,255,0.06)',
      }}
    >
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        activePanel={activePanel}
        onPanelSelect={setActivePanel}
      />

      {/* Main content */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>

        {/* ── WAR ROOM HEADER ── */}
        <WarRoomHeader onMenuToggle={() => setSidebarOpen(o => !o)} />

        {/* ── NAV RIBBON ── */}
        <NavRibbon
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />

        {/* StatsRibbon now lives inline in header */}

        {/* ── DASHBOARD BODY ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 28px' }}>
          <AnimatePresence mode="wait">
            {activeSection === 'operations' && (
              <OperationsView key="ops" activePanel={activePanel} />
            )}
            {activeSection === 'life' && (
              <SectionView key="life" title="Life" onBack={() => setActiveSection('operations')}>
                <LifePanel />
              </SectionView>
            )}
            {activeSection === 'entities' && (
              <SectionView key="entities" title="Entities" onBack={() => setActiveSection('operations')}>
                <EntitiesPanel />
              </SectionView>
            )}
            {activeSection === 'portfolio' && (
              <SectionView key="portfolio" title="Portfolio" onBack={() => setActiveSection('operations')}>
                <PortfolioPanel />
              </SectionView>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

// ─── WAR ROOM HEADER ────────────────────────────────────────────────────────

function useDateLabel() {
  const [label, setLabel] = useState('')
  useEffect(() => {
    function update() {
      const now = new Date()
      const day = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long' }).toUpperCase()
      const date = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
      setLabel(`${day}, ${date}`)
    }
    update()
    const t = setInterval(update, 60000)
    return () => clearInterval(t)
  }, [])
  return label
}

function WarRoomHeader({ onMenuToggle }: { onMenuToggle: () => void }) {
  const dateLabel = useDateLabel()
  return (
    <header
      style={{
        height: 52,
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 12,
        paddingRight: 12,
        gap: 0,
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      {/* Title */}
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          width: 34,
          height: 34,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
          flexShrink: 0,
          marginRight: 10,
          padding: 0,
        }}
        title="Menu"
      >
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 14, height: 1.5, background: 'rgba(255,255,255,0.7)', borderRadius: 2 }} />
        ))}
      </button>

      {/* ShirleyCRE wordmark — stays in top bar */}
      <span style={{
        fontSize: 17, fontWeight: 800,
        color: '#E8B84B',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-body)',
        flexShrink: 0,
        textShadow: '0 0 14px rgba(232,184,75,0.55)',
        marginLeft: 4,
      }}>
        ShirleyCRE
      </span>

      {/* Date — absolute center */}
      {dateLabel && (
        <span style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
          color: '#22c55e', fontFamily: 'var(--font-body)',
          textShadow: '0 0 10px rgba(34,197,94,0.4)',
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>{dateLabel}</span>
      )}

      <div style={{ flex: 1 }} />
      <LiveStatusDot />
    </header>
  )
}

// ─── NAV RIBBON ─────────────────────────────────────────────────────────────

function NavRibbon({
  activeSection,
  onSectionChange,
}: {
  activeSection: NavSection | 'operations'
  onSectionChange: (s: NavSection | 'operations') => void
}) {
  const insideSection = activeSection !== 'operations'
  const activeNav = NAV_SECTIONS.find(s => s.id === activeSection)

  // When inside a section, show a slim single-row bar instead of full cards
  if (insideSection && activeNav) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px',
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid rgba(167,139,250,0.12)',
        flexShrink: 0,
      }}>
        {/* Gold home pill */}
        <motion.button
          onClick={() => onSectionChange('operations')}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 14px',
            background: 'linear-gradient(135deg, #C9933A 0%, #E8B84B 100%)',
            border: '1px solid rgba(232,184,75,0.6)',
            borderRadius: 999, cursor: 'pointer', color: '#000',
            fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
            textTransform: 'uppercase', flexShrink: 0,
            boxShadow: '0 0 14px rgba(201,147,58,0.4)',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Home
        </motion.button>

        {/* Active section indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{
            width: 1, height: 20,
            background: 'rgba(167,139,250,0.2)',
            flexShrink: 0,
          }} />
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px',
            background: 'linear-gradient(135deg, #1A1040 0%, #1E1545 100%)',
            border: '1px solid rgba(140,100,220,0.45)',
            borderRadius: 10,
            color: '#C4B5FD',
          }}>
            <span style={{ color: '#A78BFA', display: 'flex' }}><activeNav.icon /></span>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              {activeNav.label}
            </span>
            <span style={{ fontSize: 8, color: 'rgba(167,139,250,0.6)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>● Active</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="wr-nav-ribbon"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 8,
        padding: '6px 12px',
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid rgba(167,139,250,0.08)',
        flexShrink: 0,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
        scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'],
      }}
    >
      {/* WAR ROOM wordmark — left of nav cards */}
      <div className="hidden sm:flex" style={{
        display: undefined,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        height: 'clamp(80px, 14vw, 96px)',
        gap: 0,
        padding: '0 12px',
        cursor: 'default',
        userSelect: 'none',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(22px, 4vw, 36px)',
          fontWeight: 900,
          color: '#F0F2FF',
          letterSpacing: '-0.04em',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          textShadow: '0 0 28px rgba(79,142,247,0.45)',
        }}>
          WAR ROOM
        </div>
      </div>

      {/* Divider between wordmark and cards */}
      <div className="hidden sm:block" style={{ width: 1, height: 60, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

      {NAV_SECTIONS.map(sec => {
        const isActive = activeSection === sec.id
        return (
          <motion.button
            key={sec.id}
            className="wr-nav-card"
            onClick={() => onSectionChange(isActive ? 'operations' : sec.id)}
            whileHover={{ scale: 1.10, y: -6 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 320, damping: 14 }}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              flex: '1 1 0',
              width: '100%',
              maxWidth: 160,
              height: 'clamp(80px, 14vw, 96px)',
              background: isActive
                ? 'linear-gradient(135deg, #2A1F50 0%, #221845 40%, #1E1540 100%)'
                : 'linear-gradient(135deg, #1E1832 0%, #1A1428 50%, #191228 100%)',
              border: `1px solid ${isActive ? 'rgba(140,100,220,0.65)' : 'rgba(90,70,140,0.35)'}`,
              borderRadius: 16,
              cursor: 'pointer',
              overflow: 'hidden',
              boxShadow: isActive
                ? '0 0 0 1px rgba(140,100,220,0.2), 0 8px 32px rgba(0,0,0,0.6), 0 0 32px rgba(100,60,180,0.25), inset 0 1px 0 rgba(167,139,250,0.15)'
                : '0 4px 20px rgba(0,0,0,0.6), 0 0 12px rgba(80,50,140,0.15), inset 0 1px 0 rgba(140,100,220,0.06)',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            {/* Atmospheric glow orb — top right */}
            <div style={{
              position: 'absolute', top: -30, right: -30,
              width: 100, height: 100,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(100,60,180,0.20) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            {/* Active top edge line */}
            {isActive && (
              <div style={{
                position: 'absolute', top: 0, left: '15%', right: '15%', height: 1,
                background: 'linear-gradient(to right, transparent, #A78BFA, transparent)',
                pointerEvents: 'none',
              }} />
            )}

            {/* Active inner glow */}
            {isActive && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.09) 0%, transparent 65%)',
                pointerEvents: 'none',
              }} />
            )}

            {/* Orbit icon */}
            <div style={{ position: 'relative', width: 'clamp(40px, 8vw, 54px)', height: 'clamp(40px, 8vw, 54px)', flexShrink: 0 }}>
              {/* Outer orbit ring */}
              <motion.div
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: '1px solid rgba(130,90,200,0.35)',
                }}
                animate={{ scale: [1, 1.45, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              />
              {/* Inner orbit ring */}
              <motion.div
                style={{
                  position: 'absolute', inset: 8, borderRadius: '50%',
                  border: '1px solid rgba(130,90,200,0.55)',
                }}
                animate={{ scale: [1, 1.25, 1], opacity: [0.65, 0.08, 0.65] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.55 }}
              />
              {/* Core glow circle */}
              <motion.div
                animate={{
                  boxShadow: isActive
                    ? ['0 0 14px rgba(167,139,250,0.4)', '0 0 28px rgba(167,139,250,0.7)', '0 0 14px rgba(167,139,250,0.4)']
                    : ['0 0 8px rgba(120,80,200,0.2)', '0 0 18px rgba(120,80,200,0.45)', '0 0 8px rgba(120,80,200,0.2)'],
                }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  position: 'absolute', inset: 16, borderRadius: '50%',
                  background: isActive ? 'rgba(75,50,130,0.8)' : 'rgba(40,30,65,0.95)',
                  border: `1px solid ${isActive ? 'rgba(140,100,220,0.8)' : 'rgba(130,90,200,0.55)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isActive ? '#C4B5FD' : '#8B6CC1',
                }}
              >
                <sec.icon />
              </motion.div>
            </div>

            {/* Label */}
            <div style={{
              fontSize: 'clamp(10px, 2.2vw, 13px)', fontWeight: 800,
              color: isActive ? '#EEEAF4' : '#9080B0',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-body)',
              textAlign: 'center',
            }}>
              {sec.label}
            </div>
          </motion.button>
        )
      })}

      {/* Spacer — pushes link orbits to the right, hidden on mobile */}
      <div className="hidden sm:block" style={{ flex: 1, minWidth: 24 }} />

      {/* Stats card — lives between orbit nav and LACDB/CREXI */}
      <StatsNavCard />

      {/* Teal link orbits — LACDB & CREXI — hidden on mobile */}
      {[
        { label: 'LACDB', url: 'https://roam.clareityiam.net/idp/login/lacdb' },
        { label: 'CREXI', url: 'https://www.crexi.com/' },
      ].map(link => (
        <div key={link.label} className="hidden sm:block">
        <motion.a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.10, y: -6 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 320, damping: 14 }}
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            flex: '0 0 auto',
            width: 'clamp(90px, 20vw, 160px)',
            maxWidth: 160,
            height: 'clamp(80px, 14vw, 96px)',
            background: 'linear-gradient(135deg, #0a1e1e 0%, #0d2222 50%, #091a1a 100%)',
            border: '1px solid rgba(14,165,160,0.22)',
            borderRadius: 16,
            cursor: 'pointer',
            overflow: 'hidden',
            textDecoration: 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 12px rgba(14,165,160,0.08), inset 0 1px 0 rgba(14,165,160,0.06)',
            userSelect: 'none',
          }}
        >
          {/* Atmospheric glow orb */}
          <div style={{
            position: 'absolute', top: -30, right: -30,
            width: 100, height: 100, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(14,165,160,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Orbit icon zone */}
          <div style={{ position: 'relative', width: 'clamp(40px, 8vw, 54px)', height: 'clamp(40px, 8vw, 54px)', flexShrink: 0 }}>
            {/* Outer ring */}
            <motion.div
              style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(14,165,160,0.22)' }}
              animate={{ scale: [1, 1.45, 1], opacity: [0.45, 0, 0.45] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Inner ring */}
            <motion.div
              style={{ position: 'absolute', inset: 7, borderRadius: '50%', border: '1px solid rgba(14,165,160,0.4)' }}
              animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.08, 0.6] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.55 }}
            />
            {/* Core */}
            <motion.div
              animate={{ boxShadow: ['0 0 6px rgba(14,165,160,0.2)', '0 0 16px rgba(14,165,160,0.5)', '0 0 6px rgba(14,165,160,0.2)'] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute', inset: 10, borderRadius: '50%',
                background: 'rgba(14,165,160,0.15)',
                border: '1px solid rgba(14,165,160,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#0ea5a0',
              }}
            >
              {/* External link icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </motion.div>
          </div>

          {/* Label */}
          <div style={{
            fontSize: 'clamp(10px, 2.2vw, 13px)', fontWeight: 800,
            color: 'rgba(14,165,160,0.85)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-body)',
            textAlign: 'center',
          }}>
            {link.label}
          </div>
        </motion.a>
        </div>
      ))}
    </div>
  )
}


// ─── STATS NAV CARD ──────────────────────────────────────────────────────────
// Compact card that sits in the nav ribbon between Portfolio orbit and LACDB/CREXI

function StatsNavCard() {
  const [stats, setStats] = React.useState({ pipeline: 0, openDeals: 0, ar: 0 })
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data } = await supabase.from('deals').select('status,commission_estimated,commission_collected')
        if (data) {
          const active = data.filter((d: any) => !['closed','dead','expired','dormant','terminated'].includes(d.status))
          const pipeline = active.reduce((s: number, d: any) => s + (d.commission_estimated || 0), 0)
          const ar = active.filter((d: any) => d.status === 'pending_payment')
            .reduce((s: number, d: any) => s + ((d.commission_estimated || 0) - (d.commission_collected || 0)), 0)
          setStats({ pipeline, openDeals: active.length, ar })
        }
      } catch {}
      setLoading(false)
    }
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])

  function fmt(n: number) {
    if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`
    if (n >= 1_000) return `$${(n/1_000).toFixed(0)}K`
    return `$${n.toFixed(0)}`
  }

  const items = [
    { label: 'Pipeline', value: loading ? '—' : fmt(stats.pipeline), color: '#E8B84B' },
    { label: 'Open', value: loading ? '—' : String(stats.openDeals), color: '#22C55E' },
    { label: 'A/R', value: loading ? '—' : fmt(stats.ar), color: '#60A5FA' },
  ]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 auto',
      height: 'clamp(80px, 14vw, 96px)',
      padding: '0 16px',
      background: 'linear-gradient(135deg, #0D1218 0%, #111720 100%)',
      border: '1px solid rgba(232,184,75,0.18)',
      borderRadius: 16,
      gap: 6,
      minWidth: 'clamp(120px, 20vw, 180px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 12px rgba(232,184,75,0.06), inset 0 1px 0 rgba(232,184,75,0.06)',
    }}>
      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.4)', fontFamily: 'var(--font-body)' }}>
        PIPELINE
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {items.map(item => (
          <div key={item.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ fontSize: 'clamp(13px, 2.5vw, 16px)', fontWeight: 800, color: item.color, fontFamily: 'var(--font-body)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {item.value}
            </div>
            <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Pulsing live status indicator — top right
function LiveStatusDot() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <motion.div
        style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#22C55E',
          boxShadow: '0 0 0 0 rgba(34,197,94,0.6)',
        }}
        animate={{
          boxShadow: [
            '0 0 0 0 rgba(34,197,94,0.6)',
            '0 0 0 5px rgba(34,197,94,0)',
          ],
        }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
      />
      <span style={{
        fontSize: 10, fontWeight: 600,
        color: 'rgba(34,197,94,0.6)',
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-body)',
      }}>
        Live
      </span>
    </div>
  )
}

// ─── SECTION VIEWS ───────────────────────────────────────────────────────────

function SectionView({ children, onBack, title }: { children: React.ReactNode; onBack?: () => void; title?: string }) {
  const dateLabel = useDateLabel()
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      style={{
        maxWidth: 960,
        margin: '0 auto',
        width: '100%',
        ['--accent-gold' as string]: '#A78BFA',
        ['--accent-gold-light' as string]: '#C4B5FD',
      } as React.CSSProperties}
    >
      {/* Green date — centered above panel content */}
      {dateLabel && (
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            color: '#22c55e', fontFamily: 'var(--font-body)',
            textShadow: '0 0 10px rgba(34,197,94,0.4)',
          }}>{dateLabel}</span>
        </div>
      )}
      {children}
    </motion.div>
  )
}

function OperationsView({ activePanel }: { activePanel: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 max-w-[1640px] mx-auto">

        {/* Row 1: Battle Plan (2-col) + Schedule (1-col) */}
        <div className="lg:col-span-2 card-reveal card-reveal-1" style={{ position: 'relative', zIndex: 50 }}>
          <BattlePlanPanel />
        </div>
        <div className="card-reveal card-reveal-2" style={{ position: 'relative', zIndex: 50 }}>
          <SchedulePanel />
        </div>

        {/* Row 2: Hot Panel (full width) */}
        <div className="lg:col-span-3 card-reveal card-reveal-3" style={{ position: 'relative', zIndex: 40 }}>
          <HotPanel />
        </div>

        {/* Row 3: Under Contract (2-col) + Money Movers (1-col) */}
        <div className="lg:col-span-2 card-reveal card-reveal-3" style={{ position: 'relative', zIndex: 30 }}>
          <UnderContractPanel />
        </div>
        <div className="card-reveal card-reveal-4" style={{ position: 'relative', zIndex: 30 }}>
          <MoneyMoversPanel />
        </div>

        {/* Row 3: Deal Pipeline (full width) */}
        <div className="lg:col-span-3 card-reveal card-reveal-5" style={{ position: 'relative', zIndex: 20 }}>
          <DealPipelinePanel />
        </div>

        {/* Row 4: AR + ShirleyCRE Agent Card */}
        <div className="card-reveal card-reveal-6" style={{ position: 'relative', zIndex: 10 }}>
          <AccountsReceivablePanel />
        </div>
        <div className="card-reveal card-reveal-7" style={{ position: 'relative', zIndex: 10 }}>
          <ShirleyCREAgentCard />
        </div>
      </div>
    </motion.div>
  )
}

// ─── SECTION NAV ICONS ────────────────────────────────────────────────────────

function HeartIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M2 3h8v18H2zM14 8h8v13h-8zM2 20h20v2H2z"/>
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}

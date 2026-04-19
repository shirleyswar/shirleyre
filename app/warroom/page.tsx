'use client'

import React from 'react'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { JSX } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PinGate from '@/components/warroom/PinGate'
import Sidebar from '@/components/warroom/Sidebar'
import StatsRibbon from '@/components/warroom/StatsRibbon'
import BattlePlanPanel from '@/components/warroom/BattlePlanPanel'
import SchedulePanel from '@/components/warroom/SchedulePanel'
import HotPanel from '@/components/warroom/HotPanel'
import UnderContractPanel from '@/components/warroom/UnderContractPanel'

import DealPipelinePanel from '@/components/warroom/DealPipelinePanel'
import AccountsReceivablePanel from '@/components/warroom/AccountsReceivablePanel'
import ClientsPanel from '@/components/warroom/ClientsPanel'
import ShirleyCREAgentCard from '@/components/warroom/ShirleyCREAgentCard'
import WinLogPanel from '@/components/warroom/WinLogPanel'
import LifePanel from '@/components/warroom/LifePanel'
import EntitiesPanel from '@/components/warroom/EntitiesPanel'
import PortfolioPanel from '@/components/warroom/PortfolioPanel'
import { useRouter } from 'next/navigation'

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
  const [refreshKey, setRefreshKey] = useState(0)
  const mainScrollRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const expiry = localStorage.getItem(SESSION_KEY)
    if (expiry && Date.now() < parseInt(expiry)) {
      setUnlocked(true)
    }
  }, [])

  const { pullY, refreshing } = usePullToRefresh(mainScrollRef, useCallback(() => setRefreshKey(k => k + 1), []))

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
        width: '100vw',
        maxWidth: '100vw',
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
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0, maxWidth: '100%' }}>

        {/* ── WAR ROOM HEADER ── */}
        <WarRoomHeader onMenuToggle={() => setSidebarOpen(o => !o)} />

        {/* ── NAV RIBBON ── */}
        <NavRibbon
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />

        {/* StatsRibbon now lives inline in header */}

        {/* ── DASHBOARD BODY ── */}
        <main ref={mainScrollRef as React.RefObject<HTMLElement>} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '18px 24px 28px 20px', position: 'relative', scrollbarGutter: 'stable', minWidth: 0, maxWidth: '100%' }}>

          {/* Pull-to-refresh indicator — mobile only */}
          {(pullY > 4 || refreshing) && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: refreshing ? 72 : Math.min(pullY, 72),
              overflow: 'hidden',
              transition: refreshing ? 'height 0.2s ease' : 'none',
              pointerEvents: 'none',
            }}>
              {refreshing ? (
                /* Spinning gold orb */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 35%, #F5CE7A, #C9933A)',
                    boxShadow: '0 0 20px rgba(232,184,75,0.7), 0 0 40px rgba(201,147,58,0.4)',
                    animation: 'ptr-spin 0.8s linear infinite',
                  }} />
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: 'rgba(232,184,75,0.8)', fontFamily: 'var(--font-body)',
                  }}>Refreshing</span>
                </div>
              ) : (
                /* Pull progress — arc fills as you pull */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    border: `3px solid rgba(201,147,58,0.15)`,
                    borderTopColor: pullY >= 64 ? '#E8B84B' : `rgba(201,147,58,${Math.min(pullY / 64, 1) * 0.8})`,
                    transition: 'border-top-color 0.15s',
                    transform: `rotate(${pullY * 2.8}deg)`,
                  }} />
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: pullY >= 64 ? 'rgba(232,184,75,0.9)' : 'rgba(232,184,75,0.4)',
                    fontFamily: 'var(--font-body)', transition: 'color 0.15s',
                  }}>
                    {pullY >= 64 ? 'Release' : 'Pull to refresh'}
                  </span>
                </div>
              )}
            </div>
          )}

          <style>{`
            @keyframes ptr-spin {
              0%   { transform: rotate(0deg) scale(1); }
              25%  { transform: rotate(90deg) scale(1.08); }
              50%  { transform: rotate(180deg) scale(1); }
              75%  { transform: rotate(270deg) scale(1.08); }
              100% { transform: rotate(360deg) scale(1); }
            }
          `}</style>
          <AnimatePresence mode="wait">
            {activeSection === 'operations' && (
              <OperationsView key={`ops-${refreshKey}`} activePanel={activePanel} />
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

// ─── Pull-to-refresh ─────────────────────────────────────────────────────────
function usePullToRefresh(scrollRef: React.RefObject<HTMLElement | null>, onRefresh: () => void) {
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const pulling = useRef(false)
  const pullYRef = useRef(0)  // ref copy to avoid stale closure
  const refreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh
  const THRESHOLD = 64

  useEffect(() => {
    // Attach to document so iOS Safari overscroll is captured reliably
    function onTouchStart(e: TouchEvent) {
      const el = scrollRef.current
      // Allow pull when the scroll container is at top (or close to it)
      if (el && el.scrollTop <= 2) {
        startY.current = e.touches[0].clientY
        pulling.current = true
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (!pulling.current || refreshingRef.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy > 0) {
        const clamped = Math.min(dy * 0.5, 80)
        pullYRef.current = clamped
        setPullY(clamped)
      } else {
        // scrolling down — cancel pull
        pulling.current = false
        pullYRef.current = 0
        setPullY(0)
      }
    }

    async function onTouchEnd() {
      if (!pulling.current) return
      pulling.current = false
      const captured = pullYRef.current
      if (captured >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true
        setRefreshing(true)
        setPullY(THRESHOLD)
        await new Promise(r => setTimeout(r, 400))
        onRefreshRef.current()
        await new Promise(r => setTimeout(r, 900))
        refreshingRef.current = false
        setRefreshing(false)
      }
      pullYRef.current = 0
      setPullY(0)
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd)
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [scrollRef]) // stable — no stale closures

  return { pullY, refreshing }
}

// Detects vertical monitor: width ≤ 1080 AND height ≥ 1200
// Keeps mobile (short height) and normal desktop (wide) unaffected
function useVerticalMonitor() {
  const [isVertical, setIsVertical] = useState(false)
  useEffect(() => {
    function check() {
      setIsVertical(window.innerWidth <= 1080 && window.innerHeight >= 1200)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isVertical
}

function useDateLabel() {
  const [label, setLabel] = useState('')
  useEffect(() => {
    function update() {
      const now = new Date()
      const day = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long' }).toUpperCase()
      const date = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
      // Store both formats: full (desktop) and date-only (mobile)
      setLabel(`${day}||${date}`)
    }
    update()
    const t = setInterval(update, 60000)
    return () => clearInterval(t)
  }, [])
  return label
}

function useLiveTime() {
  // Initialize with current time immediately (avoids blank on first render)
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true })
  )
  useEffect(() => {
    function update() {
      setTime(new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true }))
    }
    const t = setInterval(update, 60000)
    return () => clearInterval(t)
  }, [])
  return time
}

function WarRoomHeader({ onMenuToggle }: { onMenuToggle: () => void }) {
  const dateLabel = useDateLabel()
  const liveTime  = useLiveTime()
  return (
    <header
      style={{
        height: 42,
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

      {/* Mobile: date hidden from header — keeps it as a thin single-line strip */}

      <div style={{ flex: 1 }} />

      {/* Desktop: day + date centered, live time, LIVE dot */}
      {dateLabel && (() => {
        const [day, date] = dateLabel.split('||')
        return (
          <span className="hidden sm:inline" style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            color: '#22c55e', fontFamily: 'var(--font-body)',
            textShadow: '0 0 10px rgba(34,197,94,0.4)',
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }}>{day}, {date}</span>
        )
      })()}

      {/* Live time — desktop only */}
      {liveTime && (
        <span className="hidden sm:inline" style={{
          fontSize: 12, fontWeight: 700, color: 'rgba(232,184,75,0.75)',
          fontFamily: 'var(--font-body)', letterSpacing: '0.04em',
          marginRight: 10, flexShrink: 0, fontVariantNumeric: 'tabular-nums',
        }}>{liveTime}</span>
      )}

      {/* LIVE dot — desktop only */}
      <span className="hidden sm:flex"><LiveStatusDot /></span>
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
  const router = useRouter()
  const isVertical = useVerticalMonitor()
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
        height: 'clamp(50px, 9vw, 60px)',
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
              height: 'clamp(50px, 9vw, 60px)',
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
            <div style={{ position: 'relative', width: 'clamp(26px, 5.5vw, 36px)', height: 'clamp(26px, 5.5vw, 36px)', flexShrink: 0 }}>
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
                  position: 'absolute', inset: '15%', borderRadius: '50%',
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
                  position: 'absolute', inset: '22%', borderRadius: '50%',
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
              fontSize: 'clamp(10px, 2.6vw, 13px)', fontWeight: 800,
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

      {/* CONTACTS orbit card — blue, between Portfolio and spacer — hidden on mobile */}
      <motion.button
        className="wr-nav-card hidden sm:flex"
        onClick={() => router.push('/warroom/contacts')}
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
          height: 'clamp(50px, 9vw, 60px)',
          background: 'linear-gradient(135deg, #0d1a2e 0%, #0f2040 50%, #0a1830 100%)',
          border: '1px solid rgba(79,142,247,0.35)',
          borderRadius: 16,
          cursor: 'pointer',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.6), 0 0 12px rgba(79,142,247,0.1), inset 0 1px 0 rgba(79,142,247,0.08)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {/* Atmospheric glow */}
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 100, height: 100, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,142,247,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Orbit icon zone */}
        <div style={{ position: 'relative', width: 'clamp(26px, 5.5vw, 36px)', height: 'clamp(26px, 5.5vw, 36px)', flexShrink: 0 }}>
          <motion.div
            style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(79,142,247,0.28)' }}
            animate={{ scale: [1, 1.45, 1], opacity: [0.45, 0, 0.45] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            style={{ position: 'absolute', inset: '15%', borderRadius: '50%', border: '1px solid rgba(79,142,247,0.45)' }}
            animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.08, 0.6] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.55 }}
          />
          <motion.div
            animate={{ boxShadow: ['0 0 8px rgba(79,142,247,0.25)', '0 0 20px rgba(79,142,247,0.55)', '0 0 8px rgba(79,142,247,0.25)'] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute', inset: '22%', borderRadius: '50%',
              background: 'rgba(20,45,90,0.9)',
              border: '1px solid rgba(79,142,247,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#4F8EF7',
            }}
          >
            <svg width="55%" height="55%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </motion.div>
        </div>

        {/* Label */}
        <div style={{
          fontSize: 'clamp(10px, 2.6vw, 13px)', fontWeight: 800,
          color: '#6BA3F7',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-body)',
          textAlign: 'center',
        }}>
          Contacts
        </div>
      </motion.button>

      {/* Spacer — pushes link orbits to the right, hidden on mobile */}
      <div className="hidden sm:block" style={{ flex: 1, minWidth: 24 }} />

      {/* Stats card — hidden on mobile and vertical monitor */}
      {!isVertical && (
        <div className="hidden sm:block">
          <StatsNavCard />
        </div>
      )}

      {/* Teal link orbits — LACDB & CREXI — hidden on mobile and vertical monitor */}
      {[
        { label: 'LACDB', url: 'https://roam.clareityiam.net/idp/login/lacdb' },
        { label: 'CREXI', url: 'https://www.crexi.com/' },
      ].map(link => (
        <div key={link.label} className="hidden sm:block" style={{ display: isVertical ? 'none' : undefined }}>
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
            height: 'clamp(50px, 9vw, 60px)',
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
          <div style={{ position: 'relative', width: 'clamp(26px, 5.5vw, 36px)', height: 'clamp(26px, 5.5vw, 36px)', flexShrink: 0 }}>
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
                position: 'absolute', inset: '22%', borderRadius: '50%',
                background: 'rgba(14,165,160,0.15)',
                border: '1px solid rgba(14,165,160,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#0ea5a0',
              }}
            >
              {/* External link icon */}
              <svg width="50%" height="50%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </motion.div>
          </div>

          {/* Label */}
          <div style={{
            fontSize: 'clamp(10px, 2.6vw, 13px)', fontWeight: 800,
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
          const ucDeals = data.filter((d: any) => d.status === 'under_contract')
          const pipeline = ucDeals.reduce((s: number, d: any) => s + (d.commission_estimated || 0), 0)
          const ucCount = ucDeals.length
          const active = data.filter((d: any) => !['closed','dead','expired','dormant','terminated'].includes(d.status))
          const ar = active.filter((d: any) => d.status === 'pending_payment')
            .reduce((s: number, d: any) => s + ((d.commission_estimated || 0) - (d.commission_collected || 0)), 0)
          setStats({ pipeline, openDeals: ucCount, ar })
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
    { label: 'UC', value: loading ? '—' : String(stats.openDeals), color: '#22C55E' },
    { label: 'A/R', value: loading ? '—' : fmt(stats.ar), color: '#60A5FA' },
  ]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 auto',
      height: 'clamp(50px, 9vw, 60px)',
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
  const isVertical = useVerticalMonitor()

  // ── Single-panel focused views ──
  if (activePanel === 'battleplan') {
    return (
      <motion.div key="battleplan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <BattlePlanPanel />
      </motion.div>
    )
  }
  if (activePanel === 'pipeline') {
    return (
      <motion.div key="pipeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <DealPipelinePanel />
      </motion.div>
    )
  }
  if (activePanel === 'contracts') {
    return (
      <motion.div key="contracts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <HotPanel />
          <UnderContractPanel />
        </div>
      </motion.div>
    )
  }
  if (activePanel === 'schedule') {
    return (
      <motion.div key="schedule" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <SchedulePanel />
      </motion.div>
    )
  }
  if (activePanel === 'ar') {
    return (
      <motion.div key="ar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <AccountsReceivablePanel />
      </motion.div>
    )
  }

  if (activePanel === 'winlog') {
    return (
      <motion.div key="winlog" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <WinLogPanel />
      </motion.div>
    )
  }

  // ── Overview (default) — all panels ──
  if (isVertical) {
    return (
      <motion.div key="overview-v" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1080 }}>
          <BattlePlanPanel />
          <SchedulePanel />
          <HotPanel />
          <UnderContractPanel />
          <DealPipelinePanel />
          <ClientsPanel />
          <AccountsReceivablePanel />
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
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

        {/* Row 3: Under Contract (full width) */}
        <div className="lg:col-span-3 card-reveal card-reveal-3" style={{ position: 'relative', zIndex: 30 }}>
          <UnderContractPanel />
        </div>

        {/* Row 4: Deal Pipeline (full width) */}
        <div className="lg:col-span-3 card-reveal card-reveal-5" style={{ position: 'relative', zIndex: 20 }}>
          <DealPipelinePanel />
        </div>

        {/* Row 5: Clients (full width) */}
        <div className="lg:col-span-3 card-reveal card-reveal-5" style={{ position: 'relative', zIndex: 15 }}>
          <ClientsPanel />
        </div>

        {/* Row 6: AR — full width */}
        <div className="lg:col-span-3 card-reveal card-reveal-6" style={{ position: 'relative', zIndex: 10 }}>
          <AccountsReceivablePanel />
        </div>

        {/* Row 7: ShirleyCRE Agent Card — full width below */}
        <div className="lg:col-span-3 card-reveal card-reveal-7" style={{ position: 'relative', zIndex: 10 }}>
          <ShirleyCREAgentCard />
        </div>
      </div>
    </motion.div>
  )
}

// ─── SECTION NAV ICONS ────────────────────────────────────────────────────────

// Nav tile icons — use percentage sizing so they scale correctly at all viewport widths
// The orbit core circle uses inset:'22%' of a clamp(26px,5.5vw,36px) container,
// so the core is ~14–20px. Icons must fit within that — use 55% of core.
function HeartIcon() {
  return (
    <svg width="55%" height="55%" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="55%" height="55%" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M2 3h8v18H2zM14 8h8v13h-8zM2 20h20v2H2z"/>
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="55%" height="55%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}

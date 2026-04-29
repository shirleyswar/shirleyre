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
import Next48Panel from '@/components/warroom/Next48Panel'
import EntitiesPanel from '@/components/warroom/EntitiesPanel'
import PortfolioPanel from '@/components/warroom/PortfolioPanel'
import NavTile from '@/components/warroom/NavTile'
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

  // Cursor glow — desktop only, via CSS media query
  useEffect(() => {
    const el = document.getElementById('cursor-glow')
    if (!el) return
    function onMove(e: MouseEvent) {
      el!.style.left = e.clientX + 'px'
      el!.style.top  = e.clientY + 'px'
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
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
    <>
    {/* Cursor glow — desktop only (CSS hides on touch devices) */}
    <div id="cursor-glow" aria-hidden="true" />

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
        <WarRoomHeader
          onMenuToggle={() => setSidebarOpen(o => !o)}
          onHome={activeSection !== 'operations' ? () => setActiveSection('operations') : undefined}
        />

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
                    background: 'radial-gradient(circle at 35% 35%, #C084FC, #7C3AED)',
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
                    borderTopColor: pullY >= 64 ? '#A855F7' : `rgba(168,85,247,${Math.min(pullY / 64, 1) * 0.8})`,
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
    </>
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
  // Ticks every second — live operations feed, not a snapshot
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
  )
  useEffect(() => {
    function update() {
      setTime(new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }))
    }
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [])
  return time
}

// ── Count-up animation hook ────────────────────────────────────────────────
// Animates a number from 0 to `target` over `duration`ms on first mount
// When `target` changes, animates from current to new value
function useCountUp(target: number, duration = 600): number {
  const [display, setDisplay] = useState(0)
  const animRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const startRef = useRef<number>(0)
  const startValRef = useRef<number>(0)

  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    startRef.current = performance.now()
    startValRef.current = display

    function step(now: number) {
      const elapsed = now - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(startValRef.current + (target - startValRef.current) * eased))
      if (progress < 1) animRef.current = requestAnimationFrame(step)
    }
    animRef.current = requestAnimationFrame(step)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps

  return display
}

function WarRoomHeader({ onMenuToggle, onHome }: { onMenuToggle: () => void; onHome?: () => void }) {
  const dateLabel = useDateLabel()
  const liveTime  = useLiveTime()
  return (
    <header
      style={{
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        gap: 0,
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
        minHeight: 42,
      }}
    >
      {/* Left spacer — matches the right side live-time width so wordmark stays centered */}
      <div className="hidden sm:block" style={{ flex: '0 0 auto', minWidth: 100 }} />
      <div className="sm:hidden" style={{ flex: 1 }} />

      {/* ShirleyCRE wordmark + star — centered on all widths */}
      {/* Tappable to go home when inside a section */}
      <button
        onClick={onHome ?? (() => {})}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          cursor: onHome ? 'pointer' : 'default',
          padding: '4px 8px',
          borderRadius: 8,
          flexShrink: 0,
          margin: '0 auto',
        }}
      >
        {/* Star mark */}
        <StarMark size={22} />

        {/* Wordmark */}
        <span style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
        }}>
          <span style={{
            position: 'absolute',
            inset: '-12px -20px',
            background: 'radial-gradient(ellipse at center, rgba(192,132,252,0.18) 0%, rgba(232,184,75,0.08) 50%, transparent 75%)',
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 0,
            filter: 'blur(6px)',
          }} />
          <span style={{
            position: 'relative', zIndex: 1,
            fontSize: 17, fontWeight: 800,
            color: '#C084FC',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-body)',
            textShadow: '0 0 28px rgba(232,184,75,0.28), 0 0 48px rgba(232,184,75,0.14), 0 0 14px rgba(192,132,252,0.35)',
          }}>
            ShirleyCRE
          </span>
        </span>
      </button>

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
// ── Heroicons outline paths — 24×24 viewBox, strokeWidth 2, identical family ──
// ── Lucide icon paths — 24×24 viewBox, strokeWidth driven by NavTile SVG wrapper ──
// Lucide icons: clean geometric construction, consistent optical weight at large sizes.
// These are the canonical Lucide paths for Heart, Building2, TrendingUp, Users.

const ICON_LIFE = (
  // Lucide: Heart
  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
)
const ICON_ENTITIES = (
  // Lucide: Building2
  <>
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    <path d="M10 6h4" />
    <path d="M10 10h4" />
    <path d="M10 14h4" />
    <path d="M10 18h4" />
  </>
)
const ICON_PORTFOLIO = (
  // Lucide: TrendingUp
  <>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </>
)
const ICON_CONTACTS = (
  // Lucide: Users
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>
)

// ── Accent colors per tile ─────────────────────────────────────────────────────
const TILE_ACCENTS: Record<string, string> = {
  life:      '#F472B6',   // pink
  entities:  '#60A5FA',   // blue
  portfolio: '#34D399',   // emerald
  contacts:  '#A78BFA',   // violet
}

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

  // When inside a section, show a slim breadcrumb bar.
  // No HOME button — the ShirleyCRE wordmark in the top bar handles back navigation.
  if (insideSection && activeNav) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 16px',
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid rgba(167,139,250,0.10)',
        flexShrink: 0,
      }}>
        {/* Section breadcrumb chip */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 12px',
          background: 'rgba(139,92,246,0.08)',
          border: '1px solid rgba(140,100,220,0.30)',
          borderRadius: 8,
          color: '#C4B5FD',
        }}>
          <span style={{ color: '#A78BFA', display: 'flex' }}><activeNav.icon /></span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C4B5FD' }}>
            {activeNav.label}
          </span>
        </div>
        <div style={{ flex: 1 }} />
        {/* Tap wordmark above to go home — hint text on mobile */}
        <span className="sm:hidden" style={{ fontSize: 9, color: 'rgba(167,139,250,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          tap name to go home
        </span>
      </div>
    )
  }

  return (
    <div
      className="wr-nav-ribbon"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isVertical ? 'space-evenly' : 'flex-start',
        gap: isVertical ? 8 : 10,
        padding: '10px 12px',
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid rgba(167,139,250,0.08)',
        flexShrink: 0,
        overflowX: isVertical ? 'visible' : 'auto',
        WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
        scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'],
      }}
    >
      {/* WAR ROOM wordmark — hidden on portrait monitor to give nav tiles full room */}
      {!isVertical && (
        <div className="hidden sm:flex" style={{
          display: undefined,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          height: 140,
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
      )}

      {/* Divider between wordmark and cards — hidden on portrait */}
      {!isVertical && (
        <div className="hidden sm:block" style={{ width: 1, height: 120, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
      )}

      {/* ── NavTile grid: 4 equal columns desktop, 2×2 mobile ─────────────── */}
      {/* CSS grid: equal-column, no flex drift, 140px fixed height tiles */}
      <div
        className="nav-tile-grid"
        style={{
          display: 'grid',
          // Desktop: 4 columns. Mobile (<640px): 2×2 via CSS class below.
          gridTemplateColumns: isVertical ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: isVertical ? 6 : 10,
          flex: isVertical ? undefined : '0 0 auto',
          width: isVertical ? '100%' : 'clamp(440px, 42vw, 620px)',
          minWidth: 0,
        }}
      >
        {/* Life */}
        <NavTile
          iconPaths={ICON_LIFE}
          label="Life"
          isActive={activeSection === 'life'}
          accent={TILE_ACCENTS.life}
          onClick={() => onSectionChange(activeSection === 'life' ? 'operations' : 'life')}
        />
        {/* Entities */}
        <NavTile
          iconPaths={ICON_ENTITIES}
          label="Entities"
          isActive={activeSection === 'entities'}
          accent={TILE_ACCENTS.entities}
          onClick={() => onSectionChange(activeSection === 'entities' ? 'operations' : 'entities')}
        />
        {/* Portfolio */}
        <NavTile
          iconPaths={ICON_PORTFOLIO}
          label="Portfolio"
          isActive={activeSection === 'portfolio'}
          accent={TILE_ACCENTS.portfolio}
          onClick={() => onSectionChange(activeSection === 'portfolio' ? 'operations' : 'portfolio')}
        />
        {/* Contacts — hidden on mobile (4th slot, always) */}
        <NavTile
          className="hidden sm:block"
          iconPaths={ICON_CONTACTS}
          label="Contacts"
          isActive={false}
          accent={TILE_ACCENTS.contacts}
          onClick={() => router.push('/warroom/contacts')}
        />
      </div>

      {/* Spacer — pushes link orbits right; hidden on mobile and portrait */}
      {!isVertical && <div className="hidden sm:block" style={{ flex: 1, minWidth: 24 }} />}

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
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10,
              width: 92, height: 92,
              paddingTop: 20, paddingBottom: 16, paddingLeft: 16, paddingRight: 16,
              background: 'linear-gradient(160deg, #0a1e1e 0%, #091a1a 100%)',
              border: '1px solid rgba(14,165,160,0.28)',
              borderRadius: 12,
              textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              userSelect: 'none',
            }}
          >
            <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2DD4BF' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(45,212,191,0.8)', fontFamily: 'var(--font-body)' }}>
              {link.label}
            </span>
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
    { label: 'Pipeline', value: loading ? '—' : fmt(stats.pipeline), color: '#A855F7' },
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
      height: 140,
      padding: '0 16px',
      background: 'linear-gradient(135deg, #0D1218 0%, #111720 100%)',
      border: '1px solid rgba(232,184,75,0.18)',
      borderRadius: 12,
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
  const [arRefreshKey, setArRefreshKey] = useState(0)
  const handleLanded = useCallback(() => setArRefreshKey(k => k + 1), [])

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
          <UnderContractPanel onLanded={handleLanded} />
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
        <AccountsReceivablePanel refreshKey={arRefreshKey} />
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
          <Next48Panel />
          <HotPanel />
          <BattlePlanPanel />
          <SchedulePanel />
          <UnderContractPanel onLanded={handleLanded} />
          <DealPipelinePanel />
          <ClientsPanel />
          <AccountsReceivablePanel refreshKey={arRefreshKey} />
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 max-w-[1640px] mx-auto">

        {/* Row 1: Next 48 — full width, hero */}
        <div className="lg:col-span-3 card-reveal card-reveal-1" style={{ position: 'relative', zIndex: 60 }}>
          <Next48Panel />
        </div>

        {/* Row 2: Money Movers — full width */}
        <div className="lg:col-span-3 card-reveal card-reveal-2" style={{ position: 'relative', zIndex: 55 }}>
          <HotPanel />
        </div>

        {/* Row 3: Battle Plan (2-col) + Schedule (1-col) */}
        <div className="lg:col-span-2 card-reveal card-reveal-3" style={{ position: 'relative', zIndex: 50 }}>
          <BattlePlanPanel />
        </div>
        <div className="card-reveal card-reveal-4" style={{ position: 'relative', zIndex: 50 }}>
          <SchedulePanel />
        </div>

        {/* Row 4: Under Contract (full width) */}
        <div className="lg:col-span-3 card-reveal card-reveal-5" style={{ position: 'relative', zIndex: 30 }}>
          <UnderContractPanel onLanded={handleLanded} />
        </div>

        {/* Row 6: Deal Pipeline (full width) */}
        <div className="lg:col-span-3 card-reveal card-reveal-5" style={{ position: 'relative', zIndex: 20 }}>
          <DealPipelinePanel />
        </div>

        {/* Row 7: Clients (full width) */}
        <div className="lg:col-span-3 card-reveal card-reveal-6" style={{ position: 'relative', zIndex: 15 }}>
          <ClientsPanel />
        </div>

        {/* Row 8: AR — full width */}
        <div className="lg:col-span-3 card-reveal card-reveal-7" style={{ position: 'relative', zIndex: 10 }}>
          <AccountsReceivablePanel refreshKey={arRefreshKey} />
        </div>

        {/* Row 9: ShirleyCRE Agent Card */}
        <div className="lg:col-span-3 card-reveal card-reveal-7" style={{ position: 'relative', zIndex: 10 }}>
          <ShirleyCREAgentCard />
        </div>
      </div>
    </motion.div>
  )
}

// ─── STAR MARK — brand co-equal with wordmark ──────────────────────────────────
// 8-pointed violet star with atmospheric particle haze
// Drawn as pure SVG so it scales cleanly and stays sharp at all sizes
function StarMark({ size = 20 }: { size?: number }) {
  // Real brand mark — PNG image, black background transparent via mix-blend-mode
  return (
    <img
      src="/shirleycre-star.jpg"
      alt="ShirleyCRE star mark"
      width={size}
      height={size}
      className="star-pulse"
      style={{
        flexShrink: 0,
        // Black background of the JPG blends away; star glows remain
        mixBlendMode: 'lighten',
        borderRadius: '50%',         // soft mask keeps it from being a hard square
        objectFit: 'cover',
        filter: 'drop-shadow(0 0 8px rgba(232,184,75,0.35))',
      }}
      aria-hidden="true"
    />
  )
}

// ─── SECTION NAV ICONS ────────────────────────────────────────────────────────

// Nav tile icons — use percentage sizing so they scale correctly at all viewport widths
// The orbit core circle uses inset:'22%' of a clamp(26px,5.5vw,36px) container,
// so the core is ~14–20px. Icons must fit within that — use 55% of core.
function HeartIcon() {
  return (
    <svg width="65%" height="65%" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="65%" height="65%" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M2 3h8v18H2zM14 8h8v13h-8zM2 20h20v2H2z"/>
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="65%" height="65%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}

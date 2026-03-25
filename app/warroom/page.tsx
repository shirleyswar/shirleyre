'use client'

import { useState, useEffect, useCallback } from 'react'
import type { JSX } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PinGate from '@/components/warroom/PinGate'
import Sidebar from '@/components/warroom/Sidebar'
import StatsRibbon from '@/components/warroom/StatsRibbon'
import BattlePlanPanel from '@/components/warroom/BattlePlanPanel'
import SchedulePanel from '@/components/warroom/SchedulePanel'
import UnderContractPanel from '@/components/warroom/UnderContractPanel'
import MoneyMoversPanel from '@/components/warroom/MoneyMoversPanel'
import DealPipelinePanel from '@/components/warroom/DealPipelinePanel'
import AccountsReceivablePanel from '@/components/warroom/AccountsReceivablePanel'
import ShirleyCREAgentCard from '@/components/warroom/ShirleyCREAgentCard'
import LifePanel from '@/components/warroom/LifePanel'
import EntitiesPanel from '@/components/warroom/EntitiesPanel'
import PortfolioPanel from '@/components/warroom/PortfolioPanel'

const SESSION_KEY = 'wr_session_exp'
const SESSION_HOURS = 8

// SHA-256 hash of "1234"
const DEFAULT_PIN_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'

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

function WarRoomHeader({ onMenuToggle }: { onMenuToggle: () => void }) {
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
        fontSize: 13, fontWeight: 800,
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

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.07)', marginLeft: 14, marginRight: 14, flexShrink: 0 }} />

      {/* Stats inline */}
      <StatsRibbon inline />

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
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '6px 8px',
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid rgba(167,139,250,0.08)',
        flexShrink: 0,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
        scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'],
      }}
    >
      {/* WAR ROOM wordmark — left of nav cards */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: 'clamp(80px, 14vw, 120px)',
        height: 'clamp(100px, 18vw, 120px)',
        gap: 4,
        padding: '0 8px',
        cursor: 'default',
        userSelect: 'none',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(16px, 3.5vw, 26px)',
          fontWeight: 900,
          color: '#F0F2FF',
          letterSpacing: '-0.04em',
          lineHeight: 1,
          textShadow: '0 0 28px rgba(79,142,247,0.35)',
        }}>
          WAR
        </div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(16px, 3.5vw, 26px)',
          fontWeight: 900,
          color: '#F0F2FF',
          letterSpacing: '-0.04em',
          lineHeight: 1,
          textShadow: '0 0 28px rgba(79,142,247,0.35)',
        }}>
          ROOM
        </div>
        <div style={{
          width: '60%',
          height: 1,
          background: 'linear-gradient(to right, transparent, rgba(79,142,247,0.4), transparent)',
          marginTop: 2,
        }} />
      </div>

      {/* Divider between wordmark and cards */}
      <div style={{ width: 1, height: 60, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

      {NAV_SECTIONS.map(sec => {
        const isActive = activeSection === sec.id
        return (
          <motion.button
            key={sec.id}
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
              gap: 6,
              flex: '1 0 auto',
              width: 'clamp(100px, 26vw, 220px)',
              maxWidth: 220,
              height: 'clamp(100px, 18vw, 120px)',
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
            <div style={{ position: 'relative', width: 'clamp(44px, 10vw, 64px)', height: 'clamp(44px, 10vw, 64px)', flexShrink: 0 }}>
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
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 'clamp(8px, 2vw, 10px)', fontWeight: 800,
                color: isActive ? '#EEEAF4' : '#9080B0',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-body)',
                marginBottom: 1,
              }}>
                {sec.label}
              </div>
              <div style={{
                fontSize: 'clamp(7px, 1.6vw, 8px)', fontWeight: 600,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                color: isActive ? '#C8B8E8' : 'rgba(130,90,200,0.55)',
                fontFamily: 'var(--font-body)',
              }}>
                {isActive ? '● Active' : 'View'}
              </div>
            </div>
          </motion.button>
        )
      })}
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
        // Override accent color to purple for all child panels
        ['--accent-gold' as string]: '#A78BFA',
        ['--accent-gold-light' as string]: '#C4B5FD',
      } as React.CSSProperties}
    >
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
        <div className="lg:col-span-2 card-reveal card-reveal-1">
          <BattlePlanPanel />
        </div>
        <div className="card-reveal card-reveal-2">
          <SchedulePanel />
        </div>

        {/* Row 2: Under Contract (2-col) + Money Movers (1-col) */}
        <div className="lg:col-span-2 card-reveal card-reveal-3">
          <UnderContractPanel />
        </div>
        <div className="card-reveal card-reveal-4">
          <MoneyMoversPanel />
        </div>

        {/* Row 3: Deal Pipeline (full width) */}
        <div className="lg:col-span-3 card-reveal card-reveal-5">
          <DealPipelinePanel />
        </div>

        {/* Row 4: AR + ShirleyCRE Agent Card */}
        <div className="card-reveal card-reveal-6">
          <AccountsReceivablePanel />
        </div>
        <div className="card-reveal card-reveal-7">
          <ShirleyCREAgentCard />
        </div>
      </div>
    </motion.div>
  )
}

// ─── SECTION NAV ICONS ────────────────────────────────────────────────────────

function HeartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M2 3h8v18H2zM14 8h8v13h-8zM2 20h20v2H2z"/>
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}

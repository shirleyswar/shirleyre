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
        <WarRoomHeader
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />

        {/* ── TICKER STRIP ── */}
        <StatsRibbon />

        {/* ── DASHBOARD BODY ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 28px' }}>
          <AnimatePresence mode="wait">
            {activeSection === 'operations' && (
              <OperationsView key="ops" activePanel={activePanel} />
            )}
            {activeSection === 'life' && (
              <SectionView key="life">
                <LifePanel />
              </SectionView>
            )}
            {activeSection === 'entities' && (
              <SectionView key="entities">
                <EntitiesPanel />
              </SectionView>
            )}
            {activeSection === 'portfolio' && (
              <SectionView key="portfolio">
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

function WarRoomHeader({
  activeSection,
  onSectionChange,
}: {
  activeSection: NavSection | 'operations'
  onSectionChange: (s: NavSection | 'operations') => void
}) {
  return (
    <header
      style={{
        height: 96,
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 20,
        paddingRight: 20,
        gap: 16,
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle top highlight line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0.04) 70%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Title — clickable to return to operations */}
      <button
        onClick={() => onSectionChange('operations')}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(22px, 2.8vw, 34px)',
            fontWeight: 800,
            color: '#F0F2FF',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            margin: 0,
            // Subtle blue-white glow
            textShadow: '0 0 32px rgba(79,142,247,0.28)',
          }}
        >
          WAR ROOM
        </h1>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'rgba(79,142,247,0.6)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-body)',
            alignSelf: 'center',
            marginBottom: 1,
          }}
        >
          ShirleyCRE
        </span>
      </button>

      {/* Vertical divider */}
      <div style={{
        width: 1, height: 28,
        background: 'rgba(255,255,255,0.07)',
        flexShrink: 0,
      }} />

      {/* Nav section cards */}
      <div style={{ display: 'flex', gap: 0, alignItems: 'center', flex: 1, justifyContent: 'space-evenly' }}>
        {NAV_SECTIONS.map(sec => {
          const isActive = activeSection === sec.id
          return (
            <motion.button
              key={sec.id}
              onClick={() => onSectionChange(isActive ? 'operations' : sec.id)}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: 220,
                height: 88,
                background: isActive
                  ? 'linear-gradient(135deg, #1A1040 0%, #1E1545 40%, #180F38 100%)'
                  : 'linear-gradient(135deg, #13112A 0%, #160E2C 40%, #110C24 100%)',
                border: `1px solid ${isActive ? 'rgba(167,139,250,0.5)' : 'rgba(167,139,250,0.18)'}`,
                borderRadius: 16,
                cursor: 'pointer',
                overflow: 'hidden',
                boxShadow: isActive
                  ? '0 0 0 1px rgba(167,139,250,0.15), 0 8px 32px rgba(0,0,0,0.6), 0 0 24px rgba(139,92,246,0.2), inset 0 1px 0 rgba(167,139,250,0.12)'
                  : '0 0 0 1px rgba(167,139,250,0.06), 0 4px 20px rgba(0,0,0,0.5)',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
            >
              {/* Atmospheric glow orb */}
              <div style={{
                position: 'absolute',
                top: -20, right: -20,
                width: 80, height: 80,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />

              {/* Active top edge line */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: '15%', right: '15%',
                  height: 1,
                  background: 'linear-gradient(to right, transparent, #A78BFA, transparent)',
                  pointerEvents: 'none',
                }} />
              )}

              {/* Active inner glow */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.1) 0%, transparent 65%)',
                  pointerEvents: 'none',
                }} />
              )}

              {/* Orbit icon */}
              <div style={{ position: 'relative', width: 38, height: 38, flexShrink: 0 }}>
                {/* Outer orbit ring */}
                <motion.div
                  style={{
                    position: 'absolute', inset: 0,
                    borderRadius: '50%',
                    border: '1px solid rgba(167,139,250,0.22)',
                  }}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                />
                {/* Inner orbit ring */}
                <motion.div
                  style={{
                    position: 'absolute', inset: 6,
                    borderRadius: '50%',
                    border: '1px solid rgba(167,139,250,0.35)',
                  }}
                  animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0.1, 0.7] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                />
                {/* Core circle */}
                <motion.div
                  animate={isActive
                    ? { boxShadow: ['0 0 8px rgba(167,139,250,0.3)', '0 0 18px rgba(167,139,250,0.6)', '0 0 8px rgba(167,139,250,0.3)'] }
                    : { boxShadow: ['0 0 4px rgba(167,139,250,0.1)', '0 0 10px rgba(167,139,250,0.25)', '0 0 4px rgba(167,139,250,0.1)'] }
                  }
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute', inset: 12,
                    borderRadius: '50%',
                    background: isActive ? 'rgba(167,139,250,0.18)' : 'rgba(167,139,250,0.08)',
                    border: `1px solid ${isActive ? 'rgba(167,139,250,0.5)' : 'rgba(167,139,250,0.25)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: isActive ? '#A78BFA' : 'rgba(167,139,250,0.55)',
                  }}
                >
                  <sec.icon />
                </motion.div>
              </div>

              {/* Label */}
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: isActive ? '#C4B5FD' : 'rgba(167,139,250,0.45)',
                fontFamily: 'var(--font-body)',
                transition: 'color 0.15s',
              }}>
                {sec.label}
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* Live status indicator */}
      <LiveStatusDot />
    </header>
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

function SectionView({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="8" height="18"/>
      <rect x="14" y="8" width="8" height="13"/>
      <line x1="2" y1="21" x2="22" y2="21"/>
      <line x1="6" y1="7" x2="6" y2="7"/>
      <line x1="6" y1="11" x2="6" y2="11"/>
      <line x1="6" y1="15" x2="6" y2="15"/>
      <line x1="18" y1="12" x2="18" y2="12"/>
      <line x1="18" y1="16" x2="18" y2="16"/>
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}

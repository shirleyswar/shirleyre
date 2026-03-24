'use client'

import { useState, useEffect, useCallback } from 'react'
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

// Top-level nav sections
type NavSection = 'operations' | 'life' | 'entities' | 'portfolio'

const NAV_ITEMS: { id: NavSection; label: string; emoji: string; desc: string }[] = [
  { id: 'operations', label: 'Operations', emoji: '⚡', desc: 'Deals, pipeline, tasks' },
  { id: 'life',       label: 'Life',       emoji: '❤️', desc: 'Personal tasks & admin' },
  { id: 'entities',   label: 'Entities',   emoji: '🏢', desc: 'LLCs, trusts, registry' },
  { id: 'portfolio',  label: 'Portfolio',  emoji: '📈', desc: 'Financial intelligence' },
]

export default function WarRoomPage() {
  const [unlocked, setUnlocked] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activePanel, setActivePanel] = useState('overview')
  const [activeSection, setActiveSection] = useState<NavSection>('operations')

  // Check existing session on mount
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
    <div className="flex h-screen bg-bg-base overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        activePanel={activePanel}
        onPanelSelect={setActivePanel}
      />

      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* War Room Title Header */}
        <WarRoomHeader activeSection={activeSection} onSectionChange={setActiveSection} />

        {/* Stats ribbon */}
        <StatsRibbon />

        {/* Dashboard content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
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

// ─── WAR ROOM HEADER + NAV ─────────────────────────────────────────────────

function WarRoomHeader({
  activeSection,
  onSectionChange,
}: {
  activeSection: NavSection
  onSectionChange: (s: NavSection) => void
}) {
  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(10,16,20,1) 0%, rgba(8,13,17,0.95) 100%)',
        borderBottom: '1px solid rgba(201,147,58,0.15)',
        padding: '16px 20px 0',
        flexShrink: 0,
      }}
    >
      {/* Title */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 14,
      }}>
        <h1 style={{
          fontSize: 'clamp(28px, 4vw, 42px)',
          fontWeight: 900,
          color: 'var(--accent-gold)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          margin: 0,
          textShadow: '0 0 40px rgba(201,147,58,0.3)',
        }}>
          WAR ROOM
        </h1>
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-muted)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          padding: '3px 8px',
          border: '1px solid rgba(201,147,58,0.2)',
          borderRadius: 4,
          alignSelf: 'center',
        }}>
          ShirleyCRE v2
        </div>
      </div>

      {/* Nav bar */}
      <div style={{
        display: 'flex',
        gap: 4,
        overflowX: 'auto',
        paddingBottom: 0,
      }}>
        {NAV_ITEMS.map(item => (
          <NavButton
            key={item.id}
            item={item}
            active={activeSection === item.id}
            onClick={() => onSectionChange(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: { id: NavSection; label: string; emoji: string; desc: string }
  active: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 18px',
        background: active
          ? 'rgba(201,147,58,0.12)'
          : hovered
          ? 'rgba(201,147,58,0.06)'
          : 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent-gold)' : '2px solid transparent',
        borderRadius: '6px 6px 0 0',
        cursor: 'pointer',
        transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered && !active ? 'translateY(-1px)' : 'none',
        outline: 'none',
        flexShrink: 0,
        // Glow on active
        boxShadow: active ? '0 -2px 20px rgba(201,147,58,0.15) inset' : 'none',
      }}
    >
      {/* Shimmer on hover */}
      {hovered && !active && (
        <span style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(201,147,58,0.08) 50%, transparent 100%)',
          borderRadius: 'inherit',
          animation: 'navShimmer 0.6s ease-in-out',
          pointerEvents: 'none',
        }} />
      )}

      <span style={{
        fontSize: 15,
        lineHeight: 1,
        filter: active ? 'none' : hovered ? 'none' : 'grayscale(60%)',
        transition: 'filter 0.18s',
      }}>
        {item.emoji}
      </span>
      <span style={{
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        color: active ? 'var(--accent-gold)' : hovered ? 'var(--text-primary)' : 'var(--text-muted)',
        transition: 'color 0.18s',
        letterSpacing: active ? '0.02em' : 0,
      }}>
        {item.label}
      </span>

      {/* Active indicator dot */}
      {active && (
        <span style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: 'var(--accent-gold)',
          boxShadow: '0 0 6px rgba(201,147,58,0.8)',
          flexShrink: 0,
        }} />
      )}
    </button>
  )
}

// ─── SECTION VIEWS ─────────────────────────────────────────────────────────

function SectionView({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}
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
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 max-w-[1600px] mx-auto"
        initial="hidden"
        animate="visible"
      >
        {/* Row 1: Battle Plan (large) + Schedule (medium) */}
        <div className="lg:col-span-2 card-reveal card-reveal-1">
          <BattlePlanPanel />
        </div>
        <div className="card-reveal card-reveal-2">
          <SchedulePanel />
        </div>

        {/* Row 2: Under Contract (large) + Money Movers (medium) */}
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
      </motion.div>
    </motion.div>
  )
}

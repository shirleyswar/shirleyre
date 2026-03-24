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

// ─── DESIGN TOKENS — Session 3 Blue Theme ─────────────────────────────────
const T = {
  bgBase:        '#0A0A0F',
  bgCard:        'rgba(26, 27, 33, 0.92)',
  bgCardInner:   '#13141A',
  accentBlue:    '#3B82F6',
  accentBlueLt:  '#60A5FA',
  accentGold:    '#D4A030',
  textPrimary:   '#FFFFFF',
  textSecondary: '#8B8D98',
  textMuted:     '#5C5E6A',
  success:       '#22C55E',
  danger:        '#EF4444',
  border:        'rgba(255,255,255,0.06)',
} as const

// Card style object — reusable
const cardStyle: React.CSSProperties = {
  background: T.bgCard,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: `1px solid ${T.border}`,
  borderRadius: 18,
  boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
}

// Top-level nav sections
type NavSection = 'life' | 'entities' | 'portfolio'

// Floating button configs
const FLOAT_BUTTONS: {
  id: NavSection
  label: string
  icon: string
  gradFrom: string
  gradTo: string
  glowColor: string
}[] = [
  {
    id: 'life',
    label: 'Life',
    icon: '❤️',
    gradFrom: '#FF6B6B',
    gradTo: '#FF4500',
    glowColor: 'rgba(255,107,107,0.5)',
  },
  {
    id: 'entities',
    label: 'Entities',
    icon: '🏢',
    gradFrom: '#00D2FF',
    gradTo: '#0094B3',
    glowColor: 'rgba(0,210,255,0.5)',
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    icon: '📈',
    gradFrom: '#D4A030',
    gradTo: '#F5C842',
    glowColor: 'rgba(212,160,48,0.5)',
  },
]

export default function WarRoomPage() {
  const [unlocked, setUnlocked] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activePanel, setActivePanel] = useState('overview')
  const [activeSection, setActiveSection] = useState<NavSection | 'operations'>('operations')

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
    // wr-blue-theme overrides CSS variables for all child components
    <div
      className="wr-blue-theme"
      style={{
        display: 'flex',
        height: '100vh',
        background: T.bgBase,
        overflow: 'hidden',
        // CSS variable overrides — cascade to all child components
        ['--bg-base' as string]: T.bgBase,
        ['--bg-card' as string]: '#1A1B21',
        ['--bg-elevated' as string]: T.bgCardInner,
        ['--accent-gold' as string]: T.accentBlue,
        ['--accent-gold-light' as string]: T.accentBlueLt,
        ['--text-primary' as string]: T.textPrimary,
        ['--text-muted' as string]: T.textSecondary,
        ['--success' as string]: T.success,
        ['--danger' as string]: T.danger,
        ['--border-subtle' as string]: T.border,
      }}
    >
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        activePanel={activePanel}
        onPanelSelect={setActivePanel}
      />

      {/* Main content area */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* War Room Header */}
        <WarRoomHeader
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />

        {/* Stats ribbon */}
        <StatsRibbon />

        {/* Dashboard content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
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

// ─── WAR ROOM HEADER ───────────────────────────────────────────────────────

function WarRoomHeader({
  activeSection,
  onSectionChange,
}: {
  activeSection: NavSection | 'operations'
  onSectionChange: (s: NavSection | 'operations') => void
}) {
  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${T.bgBase} 0%, rgba(10,10,15,0.97) 100%)`,
        borderBottom: `1px solid rgba(59,130,246,0.12)`,
        padding: '16px 20px 14px',
        flexShrink: 0,
      }}
    >
      {/* Header row: title left, floating buttons right */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* Left: Title + badge */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
          onClick={() => onSectionChange('operations')}
        >
          <h1
            style={{
              fontSize: 'clamp(28px, 4vw, 46px)',
              fontWeight: 900,
              color: T.textPrimary,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              margin: 0,
              textShadow: `0 0 40px rgba(59,130,246,0.4), 0 0 80px rgba(59,130,246,0.15)`,
              transition: 'text-shadow 0.3s',
            }}
          >
            WAR ROOM
          </h1>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: T.accentBlue,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '3px 9px',
              border: `1px solid rgba(59,130,246,0.3)`,
              borderRadius: 5,
              alignSelf: 'center',
              background: 'rgba(59,130,246,0.08)',
            }}
          >
            ShirleyCRE v2
          </div>
        </div>

        {/* Right: Floating buttons */}
        <FloatingNavButtons activeSection={activeSection} onSectionChange={onSectionChange} />
      </div>
    </div>
  )
}

// ─── FLOATING NAV BUTTONS ──────────────────────────────────────────────────

function FloatingNavButtons({
  activeSection,
  onSectionChange,
}: {
  activeSection: NavSection | 'operations'
  onSectionChange: (s: NavSection | 'operations') => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      {FLOAT_BUTTONS.map((btn, i) => (
        <FloatingButton
          key={btn.id}
          btn={btn}
          active={activeSection === btn.id}
          entranceDelay={i * 0.08}
          onClick={() =>
            onSectionChange(activeSection === btn.id ? 'operations' : btn.id)
          }
        />
      ))}
    </div>
  )
}

function FloatingButton({
  btn,
  active,
  entranceDelay,
  onClick,
}: {
  btn: typeof FLOAT_BUTTONS[0]
  active: boolean
  entranceDelay: number
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  const bgColor = active
    ? `rgba(${hexToRgb(btn.gradFrom)}, 0.18)`
    : hovered
    ? `rgba(${hexToRgb(btn.gradFrom)}, 0.12)`
    : `rgba(${hexToRgb(btn.gradFrom)}, 0.06)`

  const borderColor = active
    ? btn.gradFrom
    : hovered
    ? `rgba(${hexToRgb(btn.gradFrom)}, 0.7)`
    : `rgba(${hexToRgb(btn.gradFrom)}, 0.35)`

  const glow = active
    ? `0 0 24px ${btn.glowColor}, 0 0 48px rgba(${hexToRgb(btn.gradFrom)}, 0.2), 0 4px 16px rgba(0,0,0,0.4)`
    : hovered
    ? `0 0 16px ${btn.glowColor}, 0 4px 12px rgba(0,0,0,0.3)`
    : `0 2px 8px rgba(0,0,0,0.3)`

  const scale = pressed ? 0.97 : active ? 1.02 : hovered ? 1.06 : 1.0
  const translateY = active ? -2 : hovered ? -1 : 0
  const opacity = !active && !hovered && activeSection_isOther() ? 0.7 : 1.0

  function activeSection_isOther() {
    // dims when another section is active
    return false // handled by parent opacity prop
  }

  return (
    <motion.button
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => { setHovered(false); setPressed(false) }}
      onTapStart={() => setPressed(true)}
      onTap={() => setPressed(false)}
      onTapCancel={() => setPressed(false)}
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { delay: entranceDelay, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] },
      }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '13px 26px',
        background: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: 50,
        cursor: 'pointer',
        outline: 'none',
        boxShadow: glow,
        transform: `scale(${scale}) translateY(${translateY}px)`,
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        overflow: 'hidden',
      }}
      whileHover={{ scale: 1.06, y: -1 }}
      whileTap={{ scale: 0.97 }}
    >
      {/* Breathing pulse for idle/active */}
      <motion.span
        animate={
          active
            ? {
                boxShadow: [
                  `0 0 0 0 rgba(${hexToRgb(btn.gradFrom)}, 0.4)`,
                  `0 0 0 8px rgba(${hexToRgb(btn.gradFrom)}, 0)`,
                  `0 0 0 0 rgba(${hexToRgb(btn.gradFrom)}, 0)`,
                ],
              }
            : {
                scale: [1.0, 1.02, 1.0],
              }
        }
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 50,
          pointerEvents: 'none',
        }}
      />

      {/* Gradient shimmer overlay on hover */}
      {hovered && (
        <motion.span
          initial={{ x: '-100%', opacity: 0 }}
          animate={{ x: '200%', opacity: [0, 0.4, 0] }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)`,
            pointerEvents: 'none',
            borderRadius: 50,
          }}
        />
      )}

      {/* Icon */}
      <span style={{ fontSize: 16, lineHeight: 1 }}>{btn.icon}</span>

      {/* Label */}
      <span
        style={{
          fontSize: 13,
          fontWeight: active ? 700 : 600,
          color: active
            ? T.textPrimary
            : hovered
            ? T.textPrimary
            : `rgba(${hexToRgb(btn.gradFrom)}, 0.9)`,
          letterSpacing: '0.02em',
          transition: 'color 0.2s ease',
        }}
      >
        {btn.label}
      </span>

      {/* Active indicator dot */}
      {active && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: btn.gradFrom,
            boxShadow: `0 0 8px ${btn.gradFrom}`,
            flexShrink: 0,
          }}
        />
      )}
    </motion.button>
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

// ─── UTILITY ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `${r},${g},${b}`
}

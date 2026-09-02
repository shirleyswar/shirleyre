'use client'

import React from 'react'
import Fab from '@/components/warroom3/Fab'
import { NAV_HEIGHT } from '@/lib/layout'

export type TabId = 'home' | 'deals' | 'money' | 'more'

const DORMANT = '#8E8CA0'
const ACTIVE  = '#DCD5FF'
const GLOW    = 'drop-shadow(0 0 6px rgba(167,139,250,.9))'

interface Props {
  active: TabId
  onTab: (id: TabId) => void
  onFab?: () => void
  fabOpen?: boolean
}

function SvgSlot({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        minHeight: 44,
        WebkitTapHighlightColor: 'transparent',
        color: active ? ACTIVE : DORMANT,
        filter: active ? GLOW : 'none',
      } as React.CSSProperties}
    >
      {children}
    </button>
  )
}

// HOME — roof wedge over a bar
function HomeGlyph() {
  return (
    <svg width="27" height="27" viewBox="0 0 32 32" fill="none">
      <polygon points="16,6 28,20 4,20" fill="currentColor"/>
      <rect x="4" y="22" width="24" height="3" rx="1.5" fill="currentColor"/>
    </svg>
  )
}

// DEALS — three stacked plates
function DealsGlyph() {
  return (
    <svg width="27" height="27" viewBox="0 0 32 32" fill="none">
      <rect x="4" y="7" width="24" height="4" rx="2" fill="currentColor"/>
      <rect x="4" y="14" width="24" height="4" rx="2" fill="currentColor"/>
      <rect x="4" y="21" width="24" height="4" rx="2" fill="currentColor"/>
    </svg>
  )
}

// MONEY — arrow over floor (provisional)
function MoneyGlyph() {
  return (
    <svg width="27" height="27" viewBox="0 0 32 32" fill="none">
      <polygon points="16,6 26,18 6,18" fill="currentColor"/>
      <rect x="4" y="22" width="24" height="3" rx="1.5" fill="currentColor"/>
    </svg>
  )
}

// MORE — three horizontal facets
function MoreGlyph() {
  return (
    <svg width="27" height="27" viewBox="0 0 32 32" fill="none">
      <rect x="5" y="9"  width="22" height="3" rx="1.5" fill="currentColor"/>
      <rect x="5" y="15" width="22" height="3" rx="1.5" fill="currentColor"/>
      <rect x="5" y="21" width="22" height="3" rx="1.5" fill="currentColor"/>
    </svg>
  )
}

export default function BottomTabBar({ active, onTab, onFab, fabOpen = false }: Props) {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: NAV_HEIGHT,
        boxSizing: 'border-box',
        paddingBottom: 'env(safe-area-inset-bottom,0px)',
        background: 'rgba(8,8,12,0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.14)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 1000,
      } as React.CSSProperties}
    >
      <SvgSlot active={active === 'home'} onClick={() => onTab('home')}>
        <HomeGlyph />
      </SvgSlot>

      <SvgSlot active={active === 'deals'} onClick={() => onTab('deals')}>
        <DealsGlyph />
      </SvgSlot>

      {/* FAB centre slot */}
      <div style={{
        width: 70,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <Fab open={fabOpen} onClick={onFab} />
      </div>

      <SvgSlot active={active === 'money'} onClick={() => onTab('money')}>
        <MoneyGlyph />
      </SvgSlot>

      <SvgSlot active={active === 'more'} onClick={() => onTab('more')}>
        <MoreGlyph />
      </SvgSlot>
    </nav>
  )
}

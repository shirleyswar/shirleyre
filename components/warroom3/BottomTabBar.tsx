'use client'

// §5.7 Bottom tab bar — ShirleyCRE mobile spec v1
// Fixed, 94px total height incl. safe-area-inset-bottom.
// Five slots: HOME · DEALS · FAB · MONEY · MORE
// Active tab: text-hi (#EFEEF4). Inactive: text-low (#5C5B6B). No purple on tabs.
// FAB: "Deep aperture" 14b — 58×58px, radius 19, lift margin-top:-20px.
//   Authorized spec deviation (Matthew directive): 58×58 / radius 19 supersedes §5.7 56×56/radius-16.
//   README rules binding: no outer drop-shadow/box-shadow, face stays near-black, glyph pure white.
// Tab change: instant (§7 — no transition).

import React from 'react'
import Fab from '@/components/warroom3/Fab'

export type TabId = 'home' | 'deals' | 'money' | 'more'

interface BottomTabBarProps {
  active: TabId
  onTab: (id: TabId) => void
  onFab?: () => void
  /** FAB open state — any sheet open → true → plus rotates to ×, tap closes sheet */
  fabOpen?: boolean
}

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? '#EFEEF4' : '#5C5B6B'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function DealsIcon({ active }: { active: boolean }) {
  const c = active ? '#EFEEF4' : '#5C5B6B'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  )
}

function MoneyIcon({ active }: { active: boolean }) {
  const c = active ? '#EFEEF4' : '#5C5B6B'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  )
}

function MoreIcon({ active }: { active: boolean }) {
  const c = active ? '#EFEEF4' : '#5C5B6B'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="5" cy="12" r="1.5" fill={c}/>
      <circle cx="12" cy="12" r="1.5" fill={c}/>
      <circle cx="19" cy="12" r="1.5" fill={c}/>
    </svg>
  )
}

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
  lineHeight: 1,
  marginTop: 4,
}

interface TabSlotProps {
  id: TabId
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}

function TabSlot({ label, icon, active, onClick }: TabSlotProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '10px 0 0 0',
        WebkitTapHighlightColor: 'transparent',
        minWidth: 0,
        minHeight: 44,
      } as React.CSSProperties}
    >
      {icon}
      <span style={{ ...LABEL_STYLE, color: active ? '#EFEEF4' : '#5C5B6B' }}>
        {label}
      </span>
    </button>
  )
}

export default function BottomTabBar({ active, onTab, onFab, fabOpen = false }: BottomTabBarProps) {
  return (
    <nav
      aria-label="Bottom navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(94px + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'rgba(8,8,12,0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 1000,
      } as React.CSSProperties}
    >
      <TabSlot id="home"  label="HOME"  icon={<HomeIcon  active={active==='home'}  />} active={active==='home'}  onClick={() => onTab('home')}  />
      <TabSlot id="deals" label="DEALS" icon={<DealsIcon active={active==='deals'} />} active={active==='deals'} onClick={() => onTab('deals')} />

      {/* FAB centre slot — "Deep aperture" 14b */}
      {/* Slot width keeps the 58px FAB centred; margin-top:-20px lifts it above the bar */}
      <div style={{
        width: 64,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: 10,
      }}>
        <Fab open={fabOpen} onClick={onFab} label="Add" />
      </div>

      <TabSlot id="money" label="MONEY" icon={<MoneyIcon active={active==='money'} />} active={active==='money'} onClick={() => onTab('money')} />
      <TabSlot id="more"  label="MORE"  icon={<MoreIcon  active={active==='more'}  />} active={active==='more'}  onClick={() => onTab('more')}  />
    </nav>
  )
}

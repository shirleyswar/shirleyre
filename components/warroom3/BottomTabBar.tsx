'use client'

// §5.7 Bottom tab bar — ShirleyCRE mobile spec v1, round3 update (items 83+84)
// FOUR slots: HOME · DEALS · MONEY · MORE. NEW slot struck (item 83).
// FAB: 31px local FAB, NO RIM, mounted 16px above bar top (item 84).
// Tab change: instant (§7 — no transition).
// Active tab: text-hi. Inactive: text-low. Active is NOT purple.

import React from 'react'
import { NAV_HEIGHT } from '@/lib/layout'

export type TabId = 'home' | 'deals' | 'money' | 'more'

interface BottomTabBarProps {
  active: TabId
  onTab: (id: TabId) => void
  onFab?: () => void
  /** FAB open state — any sheet open → true → plus rotates to × */
  fabOpen?: boolean
}

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? '#EFEEF4' : '#8E8CA0'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function DealsIcon({ active }: { active: boolean }) {
  const c = active ? '#EFEEF4' : '#8E8CA0'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  )
}

function MoneyIcon({ active }: { active: boolean }) {
  const c = active ? '#EFEEF4' : '#8E8CA0'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  )
}

function MoreIcon({ active }: { active: boolean }) {
  const c = active ? '#EFEEF4' : '#8E8CA0'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="5" cy="12" r="1.5" fill={c}/>
      <circle cx="12" cy="12" r="1.5" fill={c}/>
      <circle cx="19" cy="12" r="1.5" fill={c}/>
    </svg>
  )
}

// T5 §3.2 — 9px / 500 / 0.11em / UPPER — tab labels
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
        justifyContent: 'flex-end',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '0 0 12px',
        WebkitTapHighlightColor: 'transparent',
        minWidth: 0,
        minHeight: 44,
      } as React.CSSProperties}
    >
      {icon}
      <span style={{ ...LABEL_STYLE, color: active ? '#EFEEF4' : '#8E8CA0' }}>
        {label}
      </span>
    </button>
  )
}

// ── Local 31px FAB — item 84 ──────────────────────────────────────────────────
// NOT the shared Fab component. Implements 31px geometry directly.
// 31px × 31px box, border-radius 10px, near-black #0D0C15.
// Plus bars: 12px × 1.9px (h) and 1.9px × 12px (v), white, centred.
// Halo: box-shadow 0 0 0 12px rgba(139,92,246,0.22) — glow ring, NOT a rim.
// NO border on the box itself (no rim).
// Breathe animation: scale 1.00→1.13→1.00, 7s period — ONLY scale transform.
// Hit target: 44×44 transparent button, z-index 20 (above slot buttons).
// Mount: position absolute in nav (nav is position:fixed = containing block).
//   Hit target top: -22px (= -16 - (44-31)/2 = -22.5 → -22px rounded).
//   Visual box top edge: -16px from bar top → centred in 44px hit area ✓.
// Rotation: bars only, only when aria-expanded="true" (sheet open).
function LocalFab({ open, onClick }: { open: boolean; onClick?: () => void }) {
  return (
    <>
      <style>{`
        @keyframes localFabBreathe {
          0%, 100% { transform: scale(1.00); }
          50%       { transform: scale(1.13); }
        }
        .lfab-box {
          animation: localFabBreathe 7s ease-in-out infinite;
        }
        .lfab-bar-h {
          position: absolute;
          width: 12px;
          height: 1.9px;
          background: #FFFFFF;
          border-radius: 1px;
          transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        .lfab-bar-v {
          position: absolute;
          width: 1.9px;
          height: 12px;
          background: #FFFFFF;
          border-radius: 1px;
          transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        .lfab-open .lfab-bar-h { transform: rotate(45deg); }
        .lfab-open .lfab-bar-v { transform: rotate(45deg); }
      `}</style>
      {/* Hit target: 44×44, top -22px from bar top, z-index 20 */}
      <button
        type="button"
        aria-label="Create"
        aria-expanded={open}
        onClick={onClick}
        className={open ? 'lfab-open' : ''}
        style={{
          position: 'absolute',
          width: 44,
          height: 44,
          top: -22,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          zIndex: 20,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        } as React.CSSProperties}
      >
        {/* Visual box: 31×31, radius 10, near-black, halo via box-shadow, NO border/rim */}
        <div
          className="lfab-box"
          style={{
            width: 31,
            height: 31,
            borderRadius: 10,
            background: '#0D0C15',
            // Halo — glow ring 12px outside box. This is NOT a rim.
            boxShadow: '0 0 0 12px rgba(139,92,246,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <span className="lfab-bar-h" />
          <span className="lfab-bar-v" />
        </div>
      </button>
    </>
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
        // §5.7: NAV_HEIGHT total, box-sizing: border-box.
        height: NAV_HEIGHT,
        boxSizing: 'border-box',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'rgba(8,8,12,0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.14)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 1000,
        // position:fixed is a containing block for LocalFab's position:absolute children.
      } as React.CSSProperties}
    >
      {/* LocalFab — absolutely positioned above bar centre, z-index 20 (item 84) */}
      <LocalFab open={fabOpen} onClick={onFab} />

      {/* Four equal slots: HOME · DEALS · MONEY · MORE (item 83 — NEW slot struck) */}
      <TabSlot id="home"  label="HOME"  icon={<HomeIcon  active={active==='home'}  />} active={active==='home'}  onClick={() => onTab('home')}  />
      <TabSlot id="deals" label="DEALS" icon={<DealsIcon active={active==='deals'} />} active={active==='deals'} onClick={() => onTab('deals')} />
      <TabSlot id="money" label="MONEY" icon={<MoneyIcon active={active==='money'} />} active={active==='money'} onClick={() => onTab('money')} />
      <TabSlot id="more"  label="MORE"  icon={<MoreIcon  active={active==='more'}  />} active={active==='more'}  onClick={() => onTab('more')}  />
    </nav>
  )
}

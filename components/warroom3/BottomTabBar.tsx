'use client'

// §5.7 + Item 96 — BottomTabBar — raster glyphs, NO labels, NO text under any glyph
// No SVG icons. No label text. Not even "NEW" under the FAB.
// Eight raster files delivered: home/deals/money/more, dormant + active.
// Glyph size: 40px files mounted at 27px.

import React from 'react'
import Fab from '@/components/warroom3/Fab'
import { NAV_HEIGHT } from '@/lib/layout'

export type TabId = 'home' | 'deals' | 'money' | 'more'

interface Props {
  active: TabId
  onTab: (id: TabId) => void
  onFab?: () => void
  fabOpen?: boolean
}

function TabSlot({ src, onClick, active }: { src: string; onClick: () => void; active: boolean }) {
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
      } as React.CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} width={27} height={27} alt="" />
    </button>
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
      <TabSlot
        src={active === 'home' ? '/assets/tabbar/home-40.png' : '/assets/tabbar/home-40.png'}
        onClick={() => onTab('home')}
        active={active === 'home'}
      />
      <TabSlot
        src={active === 'deals' ? '/assets/tabbar/deals-active-40.png' : '/assets/tabbar/deals-40.png'}
        onClick={() => onTab('deals')}
        active={active === 'deals'}
      />

      {/* FAB centre slot — 70px, no label */}
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

      <TabSlot
        src={active === 'money' ? '/assets/tabbar/money-active-40.png' : '/assets/tabbar/money-40.png'}
        onClick={() => onTab('money')}
        active={active === 'money'}
      />
      <TabSlot
        src={active === 'more' ? '/assets/tabbar/more-40.png' : '/assets/tabbar/more-40.png'}
        onClick={() => onTab('more')}
        active={active === 'more'}
      />
    </nav>
  )
}

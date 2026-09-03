'use client'

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

function TabSlot({ dormant, active, isActive, onClick }: { dormant: string; active: string; isActive: boolean; onClick: () => void }) {
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
      <img src={isActive ? active : dormant} width={27} height={27} alt="" style={{ display: 'block' }} />
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
        dormant="/assets/tabbar/home-128.png"
        active="/assets/tabbar/home-active-128.png"
        isActive={active === 'home'}
        onClick={() => onTab('home')}
      />
      <TabSlot
        dormant="/assets/tabbar/deals-128.png"
        active="/assets/tabbar/deals-active-128.png"
        isActive={active === 'deals'}
        onClick={() => onTab('deals')}
      />

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

      <TabSlot
        dormant="/assets/tabbar/money-128.png"
        active="/assets/tabbar/money-active-128.png"
        isActive={active === 'money'}
        onClick={() => onTab('money')}
      />
      <TabSlot
        dormant="/assets/tabbar/more-128.png"
        active="/assets/tabbar/more-active-128.png"
        isActive={active === 'more'}
        onClick={() => onTab('more')}
      />
    </nav>
  )
}

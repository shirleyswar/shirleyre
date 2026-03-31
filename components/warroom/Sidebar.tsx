'use client'

import { useEffect, useState } from 'react'
import React from 'react'
import type { JSX } from 'react'
import { supabase } from '@/lib/supabase'

const NAV_MAIN = [
  { id: 'overview',   icon: GridIcon,   label: 'Overview'       },
  { id: 'battleplan', icon: SwordIcon,  label: 'Battle Plan'    },
  { id: 'pipeline',   icon: PipeIcon,   label: 'Pipeline'       },
  { id: 'contracts',  icon: DocIcon,    label: 'Under Contract' },
  { id: 'schedule',   icon: CalIcon,    label: 'Schedule'       },
  { id: 'ar',         icon: DollarIcon, label: 'Receivables'    },
]

const NAV_SECONDARY = [
  { id: 'people',  icon: PeopleIcon, label: 'People'  },
  { id: 'winlog',  icon: TrophyIcon, label: 'Win Log' },
]

interface SidebarProps {
  open: boolean
  onToggle: () => void
  activePanel: string
  onPanelSelect: (id: string) => void
}

export default function Sidebar({ open, onToggle, activePanel, onPanelSelect }: SidebarProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [isVertical, setIsVertical] = useState(false)

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 640)
      setIsVertical(window.innerWidth <= 1080 && window.innerHeight >= 1200)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // On mobile: hidden by default, slides in when open
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {open && (
          <div
            onClick={onToggle}
            style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.5)' }}
          />
        )}

        {/* Slide-in sidebar */}
        <nav
          style={{
            position: 'fixed',
            top: 0, left: 0, bottom: 0,
            width: 52,
            background: 'var(--bg-sidebar)',
            borderRight: '1px solid rgba(255,255,255,0.04)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 160,
            transform: open ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.22s ease',
            overflow: 'hidden',
          }}
        >
          <SidebarContent activePanel={activePanel} onPanelSelect={(id) => { onPanelSelect(id); onToggle() }} isVertical={isVertical} />
        </nav>
      </>
    )
  }

  return (
    <nav
      style={{
        width: 52,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <SidebarContent activePanel={activePanel} onPanelSelect={onPanelSelect} isVertical={isVertical} />
    </nav>
  )
}

function SidebarContent({ activePanel, onPanelSelect, isVertical }: { activePanel: string; onPanelSelect: (id: string) => void; isVertical: boolean }) {
  return (
    <>
      {/* Logo mark */}
      <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(14,165,160,0.10)', border: '1px solid rgba(14,165,160,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(14,165,160,0.9)" strokeWidth="2.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
      </div>

      {/* MENU section */}
      <div style={{ paddingTop: 4 }}>
        <div className="wr-sidebar-section-label">MENU</div>
        {NAV_MAIN.map(item => (
          <NavBtn key={item.id} item={item} isActive={activePanel === item.id} onClick={() => onPanelSelect(item.id)} />
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* MORE section */}
      <div style={{ paddingBottom: 4 }}>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 10px 2px' }} />
        <div className="wr-sidebar-section-label">MORE</div>
        {NAV_SECONDARY.map(item => (
          <NavBtn key={item.id} item={item} isActive={activePanel === item.id} onClick={() => onPanelSelect(item.id)} />
        ))}

        {/* Vertical monitor extras — pipeline stats + LACDB/CREXI */}
        {isVertical && (
          <>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 10px 4px' }} />
            <SidebarPipelineStats />
            <SidebarLinkBtn label="LACDB" url="https://roam.clareityiam.net/idp/login/lacdb" />
            <SidebarLinkBtn label="CREXI" url="https://www.crexi.com/" />
          </>
        )}

        <div style={{ marginTop: 4, paddingBottom: 12 }}>
          <button title="Settings" className="wr-sidebar-btn"><SettingsIcon /></button>
        </div>
      </div>
    </>
  )
}

// ─── Pipeline stats — compact vertical stack for sidebar ─────────────────────
function SidebarPipelineStats() {
  const [stats, setStats] = React.useState({ pipeline: 0, openDeals: 0, ar: 0 })
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.from('deals').select('status,commission_estimated,commission_collected')
        if (data) {
          const active = (data as { status: string; commission_estimated: number | null; commission_collected: number | null }[])
            .filter(d => !['closed','dead','expired','dormant','terminated'].includes(d.status))
          const pipeline = active.reduce((s, d) => s + (d.commission_estimated || 0), 0)
          const ar = active.filter(d => d.status === 'pending_payment')
            .reduce((s, d) => s + ((d.commission_estimated || 0) - (d.commission_collected || 0)), 0)
          setStats({ pipeline, openDeals: active.length, ar })
        }
      } catch {}
      setLoading(false)
    }
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])

  function fmt(n: number) {
    if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${(n/1_000).toFixed(0)}K`
    return `$${n.toFixed(0)}`
  }

  const items = [
    { label: 'PIPE', value: loading ? '—' : fmt(stats.pipeline), color: '#E8B84B' },
    { label: 'OPEN', value: loading ? '—' : String(stats.openDeals), color: '#22C55E' },
    { label: 'A/R',  value: loading ? '—' : fmt(stats.ar),          color: '#60A5FA' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '8px 0 4px' }}>
      {items.map(item => (
        <div key={item.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: item.color, fontFamily: 'var(--font-body)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {item.value}
          </div>
          <div style={{ fontSize: 7, fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Teal link button — LACDB / CREXI ────────────────────────────────────────
function SidebarLinkBtn({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 2, width: '100%', padding: '6px 0', textDecoration: 'none', cursor: 'pointer',
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: 'rgba(14,165,160,0.12)', border: '1px solid rgba(14,165,160,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(14,165,160,0.85)',
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </div>
      <span style={{ fontSize: 7, fontWeight: 700, color: 'rgba(14,165,160,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </a>
  )
}

/* ─── NAV BUTTON with teal pill active state ─────────────────── */
function NavBtn({
  item,
  isActive,
  onClick,
}: {
  item: { id: string; icon: () => JSX.Element; label: string }
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      title={item.label}
      onClick={onClick}
      className={`wr-sidebar-btn${isActive ? ' active' : ''}`}
      style={{ position: 'relative' }}
    >
      {/* Teal pill background for active */}
      {isActive && (
        <span
          style={{
            position: 'absolute',
            inset: '7px 8px',
            background: 'rgba(14,165,160,0.14)',
            border: '1px solid rgba(14,165,160,0.28)',
            borderRadius: 8,
            zIndex: 0,
            boxShadow: 'inset 0 1px 0 rgba(14,165,160,0.12)',
          }}
        />
      )}
      <span style={{ position: 'relative', zIndex: 1, color: isActive ? 'rgba(14,165,160,1)' : 'inherit' }}>
        <item.icon />
      </span>
    </button>
  )
}

/* ─── ICONS ──────────────────────────────────────────────────── */
function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  )
}
function SwordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5"/>
      <path d="M13 19l6-6"/>
      <path d="M2 2l5.5 5.5"/>
      <path d="M17 17l2 2"/>
    </svg>
  )
}
function PipeIcon() {
  return (
    <span style={{ fontSize: 15, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-body, system-ui, sans-serif)' }}>D</span>
  )
}
function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )
}
function PeopleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/>
      <path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}
function CalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}
function DollarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  )
}
function TrophyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="8 21 12 17 16 21"/>
      <line x1="12" y1="17" x2="12" y2="11"/>
      <path d="M6 3H4v5a6 6 0 006 6 6 6 0 006-6V3h-2"/>
      <line x1="6" y1="3" x2="18" y2="3"/>
    </svg>
  )
}
function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )
}

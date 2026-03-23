'use client'

import { motion, AnimatePresence } from 'framer-motion'

const NAV_ITEMS = [
  { id: 'overview',   icon: GridIcon,    label: 'Overview'       },
  { id: 'battleplan', icon: SwordIcon,   label: 'Battle Plan'    },
  { id: 'pipeline',   icon: PipeIcon,    label: 'Pipeline'       },
  { id: 'contracts',  icon: DocIcon,     label: 'Under Contract' },
  { id: 'people',     icon: PeopleIcon,  label: 'People'         },
  { id: 'schedule',   icon: CalIcon,     label: 'Schedule'       },
  { id: 'ar',         icon: DollarIcon,  label: 'Receivables'    },
  { id: 'winlog',     icon: TrophyIcon,  label: 'Win Log'        },
]

interface SidebarProps {
  open: boolean
  onToggle: () => void
  activePanel: string
  onPanelSelect: (id: string) => void
}

export default function Sidebar({ open, onToggle, activePanel, onPanelSelect }: SidebarProps) {
  return (
    <motion.nav
      animate={{ width: open ? 200 : 56 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      style={{
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'flex-end' : 'center',
          padding: open ? '0 16px' : 0,
          color: 'var(--text-muted)',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          borderBottom: '1px solid var(--border-subtle)',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRightIcon />
        </motion.div>
      </button>

      {/* Nav items */}
      <div style={{ flex: 1, paddingTop: 8, paddingBottom: 8 }}>
        {NAV_ITEMS.map(item => {
          const isActive = activePanel === item.id
          return (
            <button
              key={item.id}
              onClick={() => onPanelSelect(item.id)}
              style={{
                width: '100%',
                height: 44,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                paddingLeft: 16,
                paddingRight: 16,
                border: 'none',
                background: isActive ? 'rgba(201,147,58,0.08)' : 'none',
                cursor: 'pointer',
                color: isActive ? 'var(--accent-gold)' : 'var(--text-muted)',
                borderLeft: isActive ? '2px solid var(--accent-gold)' : '2px solid transparent',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'
              }}
            >
              <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                <item.icon />
              </span>
              <AnimatePresence>
                {open && (
                  <motion.span
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -4 }}
                    transition={{ duration: 0.15 }}
                    style={{ fontSize: 13, fontWeight: 500 }}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          )
        })}
      </div>

      {/* Bottom: ShirleyCRE label */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          overflow: 'hidden',
        }}
      >
        <AnimatePresence>
          {open ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.5, letterSpacing: '0.08em' }}
            >
              SHIRLEYCRE
            </motion.div>
          ) : (
            <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(201,147,58,0.4)' }} />
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  )
}

// Icons (minimal inline SVGs)
function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}
function SwordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5"/>
      <path d="M13 19l6-6"/>
      <path d="M2 2l5.5 5.5"/>
      <path d="M17 17l2 2"/>
    </svg>
  )
}
function PipeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 12h18M3 6h18M3 18h12"/>
    </svg>
  )
}
function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}
function PeopleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/>
      <path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}
function CalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}
function DollarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  )
}
function TrophyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="8 21 12 17 16 21"/>
      <line x1="12" y1="17" x2="12" y2="11"/>
      <path d="M6 3H4v5a6 6 0 006 6 6 6 0 006-6V3h-2"/>
      <line x1="6" y1="3" x2="18" y2="3"/>
    </svg>
  )
}
function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}

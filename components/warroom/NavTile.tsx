'use client'

/**
 * NavTile — single shared nav tile component for the War Room nav ribbon.
 *
 * Props:
 *   icon      — SVG path data (24×24 viewBox, Heroicons outline style)
 *   label     — tile label, rendered uppercase
 *   isActive  — active/selected state
 *   accent    — hex or CSS color for active border/icon/label glow
 *   onClick   — click handler
 *
 * Spec (locked):
 *   - Fixed tile dimensions: width 100% within grid column, height 92px
 *   - Padding: 20px top, 16px bottom, 16px left/right
 *   - Icon: 32px box, strokeWidth 2, centered horizontally in upper portion
 *   - Label: 12px, uppercase, letter-spacing 0.08em, weight 600, centered
 *   - Gap between icon and label: 10px
 *   - Icon + label pair optically centered vertically as a unit
 *   - Hover: 2px translateY lift + border glow in accent color
 *   - Active: 2px border in accent color, accent icon, accent label
 */

import { motion } from 'framer-motion'

interface NavTileProps {
  /** SVG path(s) for the icon — rendered in a 24×24 viewBox with stroke */
  iconPaths: React.ReactNode
  label: string
  isActive?: boolean
  accent?: string
  onClick?: () => void
  className?: string
}

const DEFAULT_ACCENT = '#A78BFA'

export default function NavTile({
  iconPaths,
  label,
  isActive = false,
  accent = DEFAULT_ACCENT,
  onClick,
  className = '',
}: NavTileProps) {
  // Derive a dim version for inactive state
  const dimAccent = `${accent}66`  // 40% opacity

  return (
    <motion.button
      className={className}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      style={{
        // ── Tile shell ──────────────────────────────────────────────────────
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        // Fixed dimensions — identical across all tiles
        width: '100%',
        height: 92,
        // Padding spec: 20px top, 16px bottom, 16px LR
        paddingTop: 20,
        paddingBottom: 16,
        paddingLeft: 16,
        paddingRight: 16,
        // Background
        background: isActive
          ? 'linear-gradient(160deg, #1E1640 0%, #19123A 60%, #160F30 100%)'
          : 'linear-gradient(160deg, #13112A 0%, #110E25 60%, #0E0B1E 100%)',
        // Border: 2px solid in accent when active, 1px subtle when not
        border: isActive
          ? `2px solid ${accent}`
          : '1px solid rgba(120,90,180,0.28)',
        borderRadius: 12,
        cursor: 'pointer',
        overflow: 'hidden',
        position: 'relative',
        // Box shadow
        boxShadow: isActive
          ? `0 0 0 1px ${accent}22, 0 8px 28px rgba(0,0,0,0.6), 0 0 24px ${accent}22`
          : '0 4px 16px rgba(0,0,0,0.5)',
        userSelect: 'none',
        WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'],
      } as React.CSSProperties}
    >
      {/* Active top-edge accent line */}
      {isActive && (
        <div style={{
          position: 'absolute', top: 0, left: '20%', right: '20%', height: 2,
          background: `linear-gradient(to right, transparent, ${accent}, transparent)`,
          pointerEvents: 'none',
          borderRadius: '0 0 2px 2px',
        }} />
      )}

      {/* Active inner glow */}
      {isActive && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at 50% -10%, ${accent}18 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
      )}

      {/* ── Icon: 32×32 box, stroke 2, Heroicons outline ─────────────────── */}
      <div style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: isActive ? accent : dimAccent,
        filter: isActive
          ? `drop-shadow(0 0 8px ${accent}BB)`
          : 'none',
        transition: 'color 0.15s, filter 0.15s',
      }}>
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {iconPaths}
        </svg>
      </div>

      {/* ── Label: 12px, 600, uppercase, 0.08em ─────────────────────────── */}
      <span style={{
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-body)',
        color: isActive ? accent : 'rgba(160,140,200,0.75)',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        transition: 'color 0.15s',
      }}>
        {label}
      </span>
    </motion.button>
  )
}

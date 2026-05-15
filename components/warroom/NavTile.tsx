'use client'

/**
 * NavTile — Obsidian-style tab bar nav tile.
 *
 * Design: quiet when inactive, confident when active.
 * Horizontal row, shorter height (~56px), icon top + label below.
 * Inactive: muted gray. Hover: faint bg. Active: semantic color tint + border.
 */

import React, { useState } from 'react'

interface NavTileProps {
  iconPaths: React.ReactNode
  label: string
  isActive?: boolean
  accent: string
  onClick?: () => void
  className?: string
}

export default function NavTile({
  iconPaths,
  label,
  isActive = false,
  accent,
  onClick,
  className = '',
}: NavTileProps) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  // Derive hex → rgba components for low-opacity backgrounds
  // accent is always a 7-char hex like #E85D9B
  const accentRgb = hexToRgb(accent)

  const bgColor = isActive
    ? `rgba(${accentRgb}, 0.05)`
    : hovered
    ? `rgba(255,255,255,0.03)`
    : 'transparent'

  const borderColor = isActive
    ? `rgba(${accentRgb}, 0.18)`
    : 'transparent'

  const iconColor = isActive
    ? accent
    : hovered
    ? 'rgba(255,255,255,0.55)'
    : 'rgba(255,255,255,0.28)'

  const labelColor = isActive
    ? accent
    : hovered
    ? 'rgba(255,255,255,0.55)'
    : 'rgba(255,255,255,0.28)'

  const scale = pressed ? 0.97 : 1

  return (
    <button
      className={`nav-tile-btn${className ? ' ' + className : ''}`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        height: 58,
        gap: 5,
        paddingTop: 8,
        paddingBottom: 8,
        paddingLeft: 4,
        paddingRight: 4,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'],
        WebkitTapHighlightColor: 'transparent',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 11,
        boxShadow: isActive ? `0 0 14px rgba(${accentRgb}, 0.10)` : 'none',
        transform: `scale(${scale})`,
        transition: 'background 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 100ms ease',
      } as React.CSSProperties}
    >
      {/* Active top-edge accent line */}
      {isActive && (
        <div style={{
          position: 'absolute', top: 0, left: '25%', right: '25%', height: 1,
          background: `linear-gradient(to right, transparent, ${accent}BB, transparent)`,
          pointerEvents: 'none',
        }} />
      )}

      {/* Icon — 20px */}
      <div style={{
        width: 20,
        height: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: iconColor,
        filter: isActive ? `drop-shadow(0 0 6px rgba(${accentRgb}, 0.5))` : 'none',
        transition: 'color 150ms ease, filter 150ms ease',
      }}>
        <svg
          width="20"
          height="20"
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

      {/* Label — 10px / 600 / uppercase / 0.1em */}
      <span style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-body)',
        color: labelColor,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        transition: 'color 150ms ease',
      }}>
        {label}
      </span>
    </button>
  )
}

/** Convert #RRGGBB to "R,G,B" string for rgba() usage */
function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '139,123,247'
  return `${r},${g},${b}`
}

'use client'

/**
 * NavTile — hero-grade primary navigation tile for the War Room.
 *
 * Design language: Linear / Vercel / Arc — premium, dense, depth-driven.
 * Single implementation. Four instances. Props in, consistent output.
 *
 * Spec (locked — do not adjust per-tile):
 *   Height: 140px fixed
 *   Padding: 28px top, 24px bottom, 20px LR
 *   Icon: 48px box, strokeWidth 2.5, Lucide family, centered upper half
 *   Label: 16px / 700 / uppercase / 0.1em letter-spacing / white 95%
 *   Background: #0F1729 with top-lighter / bottom-darker depth gradient
 *   Border: 1px solid rgba(255,255,255,0.08), radius 16px
 *   Shadow: outer depth + inner top highlight at rgba(255,255,255,0.10)
 *   Accent: applied to icon only — NOT border, NOT background, NOT label
 *   Hover: translateY -3px, border rgba(255,255,255,0.20), accent glow 24px
 *   Active/pressed: translateY 0, glow 12px (tactile)
 *   Transition: 200ms cubic-bezier(0.16, 1, 0.3, 1)
 */

import React, { useState } from 'react'

interface NavTileProps {
  /**
   * Lucide-compatible SVG path content — rendered inside a 24×24 viewBox
   * with strokeWidth 2.5, strokeLinecap round, strokeLinejoin round.
   * Pass only the inner path/circle/line elements, not the <svg> wrapper.
   */
  iconPaths: React.ReactNode
  label: string
  isActive?: boolean
  /** Accent color for icon. Applies ONLY to icon — not background or border. */
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

  const glowBlur = pressed ? 12 : hovered ? 24 : 0
  const translateY = pressed ? 0 : hovered ? -3 : 0

  return (
    <button
      className={className}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => { setPressed(false) }}
      style={{
        // ── Shell ────────────────────────────────────────────────────────────
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        width: '100%',
        height: 140,
        paddingTop: 28,
        paddingBottom: 24,
        paddingLeft: 20,
        paddingRight: 20,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'],
        WebkitTapHighlightColor: 'transparent',

        // ── Background: dark navy with depth gradient ────────────────────────
        // Top edge slightly lighter (#141E35), bottom slightly darker (#0A1020)
        // Gives a raised, tactile appearance without screaming at you
        background: isActive
          ? `linear-gradient(180deg, #162040 0%, #0F1729 40%, #090E1C 100%)`
          : `linear-gradient(180deg, #141E35 0%, #0F1729 45%, #0A1020 100%)`,

        // ── Border ──────────────────────────────────────────────────────────
        border: `1px solid ${hovered
          ? 'rgba(255,255,255,0.20)'
          : isActive
          ? `${accent}55`
          : 'rgba(255,255,255,0.08)'
        }`,
        borderRadius: 16,

        // ── Shadow: outer depth + inner top highlight ────────────────────────
        // The inner top highlight (inset) mimics a physical raised edge
        boxShadow: [
          // Outer: soft depth
          '0 4px 24px rgba(0,0,0,0.55)',
          '0 1px 4px rgba(0,0,0,0.35)',
          // Inner: top-edge highlight — tactile raised feel
          'inset 0 1px 0 rgba(255,255,255,0.10)',
          // Accent glow on hover/active
          ...(glowBlur > 0 ? [`0 0 ${glowBlur}px ${accent}4D`] : []),
          // Active state: stronger glow
          ...(isActive ? [`0 0 20px ${accent}33`] : []),
        ].join(', '),

        // ── Transition ───────────────────────────────────────────────────────
        transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms cubic-bezier(0.16, 1, 0.3, 1), background 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        transform: `translateY(${translateY}px)`,
      } as React.CSSProperties}
    >
      {/* Active: top-edge accent line — hairline, 60% tile width, fades to transparent */}
      {isActive && (
        <div style={{
          position: 'absolute', top: 0, left: '20%', right: '20%', height: 1,
          background: `linear-gradient(to right, transparent, ${accent}CC, transparent)`,
          pointerEvents: 'none',
        }} />
      )}

      {/* Hover: inner ambient glow from center-top */}
      {(hovered || isActive) && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% -10%, ${accent}12 0%, transparent 70%)`,
          pointerEvents: 'none',
          transition: 'opacity 200ms',
        }} />
      )}

      {/* ── Icon: 48px, Lucide stroke 2.5, accent-colored ──────────────────── */}
      <div style={{
        width: 48,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginBottom: 14,
        // Accent ONLY on the icon — not label, not border, not bg
        color: accent,
        // Glow around icon on hover/active
        filter: (hovered || isActive)
          ? `drop-shadow(0 0 10px ${accent}99) drop-shadow(0 0 20px ${accent}44)`
          : `drop-shadow(0 0 6px ${accent}44)`,
        transition: 'filter 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {iconPaths}
        </svg>
      </div>

      {/* ── Label: 16px / 700 / uppercase / 0.1em / white 95% ───────────────── */}
      <span style={{
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-body)',
        // Label is always white 95% — accent is icon-only
        color: 'rgba(255,255,255,0.95)',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        // Subtle text glow on hover — very restrained
        textShadow: hovered ? '0 0 12px rgba(255,255,255,0.25)' : 'none',
        transition: 'text-shadow 200ms',
      }}>
        {label}
      </span>
    </button>
  )
}

'use client'

/**
 * SectionHeader — canonical War Room section header. Single source of truth.
 *
 * Layout:  [Icon]  [Section Name]  ─────────────────  [stat]  [action button]
 *
 * Design rules (locked):
 * - Left-aligned flush to the section's content left edge (paddingLeft matches row content)
 * - Icon: 28px box, flexShrink:0 so it never collapses
 * - Title: 22px / weight 900 — dominant, not blended
 * - Divider line sits 14px below the text row (paddingBottom: 14)
 * - Color treatment per section — passed via `color` prop, never overridden here
 * - Action buttons right-aligned, min-height 34px so they scale with the larger header
 * - marginBottom: 4 keeps divider close to first content row
 *
 * Every section header in the War Room uses this. No other implementations.
 */

import React from 'react'

interface SectionHeaderProps {
  /** SVG icon element — rendered at 28×28 in the section color */
  icon?: React.ReactNode
  /** Section label e.g. "Next 48", "Money Movers" */
  label: string
  /** Accent color for icon glow, title, divider line, and stat */
  color?: string
  /** Optional count / stat shown right of the divider */
  stat?: React.ReactNode
  /** Optional action button(s) — right-aligned on the header row */
  action?: React.ReactNode
  /** Title glow / textShadow override if needed */
  titleGlow?: string
  /** Additional style overrides on the outer wrapper (use sparingly) */
  style?: React.CSSProperties
}

export default function SectionHeader({
  icon,
  label,
  color = 'rgba(255,255,255,0.85)',
  stat,
  action,
  titleGlow,
  style,
}: SectionHeaderProps) {
  const lineColor = colorToRgba(color, 0.35)
  const glowColor = colorToRgba(color, 0.45)

  return (
    <div
      style={{
        // ── Outer wrapper ───────────────────────────────────────────────────
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        // Canonical padding — explicit longhand, never shorthand.
        // paddingBottom = breathing room between text row and ::after divider.
        paddingTop: 18,
        paddingRight: 20,
        paddingBottom: 14,
        paddingLeft: 20,
        marginBottom: 4,
        position: 'relative',
        // ::after divider line
        ...style,
      }}
    >
      {/* Divider pseudo-element via real element (avoids JSX ::after limitation) */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 1,
        background: `linear-gradient(to right, ${lineColor}, transparent 80%)`,
        pointerEvents: 'none',
      }} />

      {/* 1 — Icon: 28px box, color-tinted, glow */}
      {icon && (
        <div style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color,
          filter: `drop-shadow(0 0 8px ${glowColor})`,
        }}>
          {icon}
        </div>
      )}

      {/* 2 — Section label: 22px / 900 weight — dominant */}
      <span style={{
        fontSize: 22,
        fontWeight: 900,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-body)',
        color,
        textShadow: titleGlow ?? `0 0 18px ${glowColor}`,
        whiteSpace: 'nowrap',
        lineHeight: 1,
        flexShrink: 0,
      }}>
        {label}
      </span>

      {/* 3 — Expanding divider line (fills remaining space) */}
      <div style={{
        flex: 1,
        height: 2,
        background: `linear-gradient(to right, ${lineColor}, transparent)`,
        minWidth: 16,
      }} />

      {/* 4 — Stat (count) */}
      {stat !== undefined && stat !== '' && (
        <span style={{
          fontSize: 20,
          fontWeight: 800,
          color,
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          flexShrink: 0,
        }}>
          {stat}
        </span>
      )}

      {/* 5 — Action button(s) — right-aligned, scaled for larger header */}
      {action && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {action}
        </div>
      )}
    </div>
  )
}

// ─── Helper ──────────────────────────────────────────────────────────────────
// Converts CSS color strings to rgba with given alpha for glow/line use.
// Handles: hex (#fff, #aabbcc), rgb(), rgba(), named CSS vars → fallback only.
function colorToRgba(color: string, alpha: number): string {
  if (!color || color.startsWith('var(')) return `rgba(255,255,255,${alpha})`

  // Already rgba — swap alpha
  const rgbaMatch = color.match(/^rgba\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbaMatch) return `rgba(${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]},${alpha})`

  // rgb()
  const rgbMatch = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (rgbMatch) return `rgba(${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]},${alpha})`

  // 6-char hex
  const hex6 = color.match(/^#([0-9a-f]{6})$/i)
  if (hex6) {
    const n = parseInt(hex6[1], 16)
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
  }
  // 3-char hex
  const hex3 = color.match(/^#([0-9a-f]{3})$/i)
  if (hex3) {
    const r = parseInt(hex3[1][0]! + hex3[1][0]!, 16)
    const g = parseInt(hex3[1][1]! + hex3[1][1]!, 16)
    const b = parseInt(hex3[1][2]! + hex3[1][2]!, 16)
    return `rgba(${r},${g},${b},${alpha})`
  }
  return `rgba(255,255,255,${alpha})`
}

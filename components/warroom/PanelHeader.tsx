'use client'

/**
 * PanelHeader — canonical War Room section header.
 *
 * Spacing source-of-truth: padding '16px 20px 14px' (top | sides | bottom).
 * The 14px padding-bottom is what creates the breathing room between the
 * header text row and the wr-card-header::after divider line. DO NOT set
 * padding-bottom to 0 — that is the bug this component exists to prevent.
 *
 * marginBottom: 4 keeps the divider close to content (matches Money Movers).
 *
 * Usage:
 *   <PanelHeader icon={<SomeIcon />} title="Section Name" stat={count} statColor="#4F8EF7" lineColor="rgba(79,142,247,0.35)">
 *     <button>optional right-side actions</button>
 *   </PanelHeader>
 */

import React from 'react'

interface PanelHeaderProps {
  icon?: React.ReactNode
  title: string
  titleColor?: string
  titleStyle?: React.CSSProperties
  stat?: React.ReactNode          // number or string shown on far right
  statColor?: string
  lineColor?: string              // gradient color of the divider line
  children?: React.ReactNode      // optional right-side controls (buttons etc.)
  style?: React.CSSProperties     // extra overrides if truly needed
}

export default function PanelHeader({
  icon,
  title,
  titleColor,
  titleStyle,
  stat,
  statColor,
  lineColor,
  children,
  style,
}: PanelHeaderProps) {
  return (
    <div
      className="wr-card-header"
      style={{
        // Canonical spacing — do not change.
        // Explicit properties (not shorthand) so nothing in the cascade can
        // accidentally zero out padding-bottom and collapse the divider gap.
        paddingTop: 16,
        paddingRight: 20,
        paddingBottom: 14,   // <-- this is the gap between text and ::after line
        paddingLeft: 20,
        marginBottom: 4,
        ...style,
      }}
    >
      {icon && (
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {icon}
        </span>
      )}

      <span
        className="wr-rank1"
        style={{
          color: titleColor ?? 'rgba(255,255,255,0.85)',
          ...(titleStyle ?? {}),
        }}
      >
        {title}
      </span>

      <div
        className="wr-panel-line"
        style={lineColor ? { background: `linear-gradient(to right, ${lineColor}, transparent)` } : undefined}
      />

      {stat !== undefined && stat !== '' && (
        <span
          className="wr-panel-stat"
          style={{ fontSize: 18, fontWeight: 800, color: statColor ?? 'rgba(255,255,255,0.7)' }}
        >
          {stat}
        </span>
      )}

      {children}
    </div>
  )
}

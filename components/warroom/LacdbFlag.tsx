'use client'

import type { CSSProperties } from 'react'
import { LACDB_ACTIVE } from '@/lib/lacdbCatalog'
import { lacdbFlagFor, type LacdbDealLink } from '@/lib/lacdbFlag'

const MONO = "'JetBrains Mono', ui-monospace, monospace"

function rowStyle(active: boolean): CSSProperties {
  return {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: active ? 700 : 600,
    letterSpacing: '0.10em',
    lineHeight: 1,
    color: active ? '#F5F3FF' : '#8E8CA0',
    background: 'transparent',
    border: active ? '1px solid rgba(196,181,253,0.85)' : '1px solid rgba(255,255,255,0.20)',
    borderRadius: 4,
    padding: '3px 7px',
    flexShrink: 0,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    textShadow: active ? '0 0 6px rgba(167,139,250,0.95)' : 'none',
    boxShadow: active ? '0 0 8px rgba(139,92,246,0.45)' : 'none',
    cursor: active ? 'pointer' : 'default',
  }
}

function headerStyle(active: boolean): CSSProperties {
  return {
    boxSizing: 'border-box',
    height: 39,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 15px',
    borderRadius: 999,
    background: 'transparent',
    fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
    fontWeight: 500,
    fontSize: 24,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    flexShrink: 0,
    border: active ? '1.5px solid rgba(196,181,253,0.92)' : '1.5px solid rgba(255,255,255,0.22)',
    color: active ? '#F5F3FF' : '#8E8CA0',
    textShadow: active ? '0 0 8px rgba(196,181,253,0.95), 0 0 16px rgba(139,92,246,0.65)' : 'none',
    boxShadow: active ? '0 0 8px rgba(139,92,246,0.55), 0 0 18px rgba(139,92,246,0.28)' : 'none',
    cursor: active ? 'pointer' : 'default',
  }
}

export default function LacdbFlag({
  deal,
  size,
}: {
  deal: LacdbDealLink
  size: 'row' | 'header'
}) {
  const mark = lacdbFlagFor(deal, LACDB_ACTIVE)
  if (!mark) return null
  const active = mark.kind === 'active'
  const label = active ? 'LACDB' : 'OFF LACDB'
  const style = size === 'header' ? headerStyle(active) : rowStyle(active)
  const text = size === 'header'
    ? <span style={{ transform: 'translateY(1px)', marginRight: '-0.04em' }}>{label}</span>
    : label

  const face = active && mark.href ? (
    <a
      href={mark.href}
      target="_blank"
      rel="noopener noreferrer"
      data-lacdb="active"
      aria-label="Open LACDB listing"
      onClick={event => event.stopPropagation()}
      style={style}
    >
      {text}
    </a>
  ) : (
    <span data-lacdb={active ? 'active' : 'off'} style={style}>
      {text}
    </span>
  )

  if (size === 'header') return <span className="wr-deal-chip">{face}</span>
  return face
}

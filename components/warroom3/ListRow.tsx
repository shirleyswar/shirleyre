'use client'

// §5.11 Panel sheet rows — ONE component, used across all five sheets.
// §5.11.1: Rows are hairline-separated. NO border, NO radius, NO background fill.
// §5.11.2: No red/accent tint on overdue rows. Spine only.
// §5.11.5: If subline === title, render one line only.
// §5.11.7: Portfolio rows with mark plate, chevron, expanded children.

import React, { useState } from 'react'
import { Layers, ChevronRight, ChevronDown } from 'lucide-react'

// ── Type tokens §3.2 ─────────────────────────────────────────────────────────
const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

// T3 §3.2 — 14.5px / 500 / 0 / sentence / text-hi
const styleT3: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 14.5,
  fontWeight: 500,
  color: '#EFEEF4',
  lineHeight: 1.25,
}

// T4 §3.2 — 11.5px / 400 / 0 / sentence / text-mid
const styleT4: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 11.5,
  fontWeight: 400,
  color: '#8B8A9B',
  lineHeight: 1.5,
}

// T5 §3.2 — 9px / 500 (700 filled) / 0.11em / UPPER
const styleT5: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
  lineHeight: 1,
}

// ── TYPE_TUNE_INPUTS — no matching §3.2 level; report these in ship-gate ────
const MONO_COMMISSION_SIZE = 15     // §5.11.4 commission figure
const MONO_PRICE_SIZE = 11.5        // §5.11.4 sale price — T4 size but mono family
const GLYPH_LINKOUT_SIZE = 14       // §5.11.6 ↗ glyph
const PORTFOLIO_MARK_SIZE = 15      // §5.11.7 stacked-layers glyph inside mark plate
const PORTFOLIO_CHILD_ADDR = 13.5   // §5.11.7 "13.5px address" for child rows
const PORTFOLIO_CHILD_CITY = 11     // §5.11.7 "11px city" for child rows
const PORTFOLIO_CHEVRON_SIZE = 15   // §5.11.7 chevron
const PORTFOLIO_SITE_COUNT = 11.5   // §5.11.7 "4 SITES" — T4 size but mono family

// ── Colour tokens §2 ─────────────────────────────────────────────────────────
const T = {
  textHi:    '#EFEEF4',
  textMid:   '#8B8A9B',
  textLow:   '#5C5B6B',
  textInvert:'#0A0A0F',
  late:      '#FF4D4D',
  hot:       '#FFA23A',
  moneyIn:   '#34D399',
  brand:     '#8B5CF6',
  brandLift: '#A78BFA',
} as const

// ── Status pill helper §5.3 ───────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const isHot = status.toLowerCase() === 'hot'
  const label = status.toUpperCase()

  if (isHot) {
    // Filled — HOT only
    return (
      <span style={{
        ...styleT5,
        fontWeight: 700,
        background: T.hot,
        color: T.textInvert,
        padding: '5px 8px',
        borderRadius: 4,
        flexShrink: 0,
      }}>{label}</span>
    )
  }

  // Outlined for all others
  return (
    <span style={{
      ...styleT5,
      border: '1px solid rgba(255,255,255,0.14)',
      color: T.textMid,
      padding: '5px 8px',
      borderRadius: 4,
      flexShrink: 0,
    }}>{label}</span>
  )
}

// ── Money block §5.11.4 ───────────────────────────────────────────────────────
function MoneyBlock({ commission, salePrice }: { commission: number; salePrice?: number | null }) {
  function fmt(n: number) {
    return '$' + Math.round(n).toLocaleString('en-US')
  }
  return (
    <div style={{ flexShrink: 0, textAlign: 'right' }}>
      {/* Commission: MONO_COMMISSION_SIZE px JetBrains Mono in money-in */}
      <div style={{
        fontFamily: FONT_MONO,
        fontSize: MONO_COMMISSION_SIZE,
        fontWeight: 500,
        color: T.moneyIn,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>{fmt(commission)}</div>
      {/* T5 COMMISSION label beneath at text-low */}
      <div style={{
        ...styleT5,
        color: T.textLow,
        marginTop: 2,
      }}>COMMISSION</div>
      {/* Sale price: MONO_PRICE_SIZE px JetBrains Mono at text-low */}
      {salePrice != null && (
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: MONO_PRICE_SIZE,
          fontWeight: 400,
          color: T.textLow,
          lineHeight: 1,
          marginTop: 3,
          fontVariantNumeric: 'tabular-nums',
        }}>{fmt(salePrice)}</div>
      )}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface ListRowProps {
  title: string
  subline?: string
  status?: string
  showPill?: boolean
  spineColor?: string | null
  dayCount?: string | null
  dayCountColor?: string | null
  commission?: number | null
  salePrice?: number | null
  showMoney?: boolean
  isPortfolio?: boolean
  portfolioSiteCount?: number
  isPortfolioOpen?: boolean
  lacdbUrl?: string | null
  onPress?: () => void
  onLinkOut?: () => void
  onChevronPress?: () => void
  children?: React.ReactNode
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ListRow({
  title,
  subline,
  status,
  showPill = false,
  spineColor = null,
  dayCount = null,
  dayCountColor = null,
  commission = null,
  salePrice = null,
  showMoney = false,
  isPortfolio = false,
  portfolioSiteCount = 0,
  isPortfolioOpen = false,
  lacdbUrl = null,
  onPress,
  onLinkOut,
  onChevronPress,
  children,
}: ListRowProps) {
  // §5.11.5 — if subline would equal title, render one line only
  const showSubline = subline && subline !== title

  const paddingLeft = spineColor ? 21 : 18

  // ── Portfolio row §5.11.7 ─────────────────────────────────────────────────
  if (isPortfolio) {
    return (
      <div>
        {/* Hairline separator §5.11.1 */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

        <div
          role="button"
          tabIndex={0}
          onClick={onPress}
          onKeyDown={e => e.key === 'Enter' && onPress?.()}
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: 'transparent', // §5.11.1 — never a fill
            padding: `14px 18px`,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {/* No spine on portfolio rows — they have a brand plate mark instead */}

          {/* 28px brand plate §5.11.7 */}
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'rgba(139,92,246,0.13)',
            border: '1px solid rgba(139,92,246,0.28)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Layers size={PORTFOLIO_MARK_SIZE} color={T.brandLift} strokeWidth={1.5} />
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* T3 portfolio name */}
            <div style={{ ...styleT3 }}>{title}</div>
            {/* "4 SITES" — T4 size but mono family in brand-lift §5.11.7 */}
            <div style={{
              fontFamily: FONT_MONO,
              fontSize: PORTFOLIO_SITE_COUNT,
              fontWeight: 500,
              color: T.brandLift,
              letterSpacing: '0.11em',
              textTransform: 'uppercase',
              lineHeight: 1,
              marginTop: 3,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {portfolioSiteCount} {portfolioSiteCount === 1 ? 'SITE' : 'SITES'}
            </div>
          </div>

          {/* Disclosure chevron — right slot, PORTFOLIO_CHEVRON_SIZE px §5.11.7 */}
          <button
            onClick={e => { e.stopPropagation(); onChevronPress?.() }}
            aria-label={isPortfolioOpen ? 'Collapse' : 'Expand'}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              flexShrink: 0,
              WebkitTapHighlightColor: 'transparent',
              color: isPortfolioOpen ? T.brandLift : T.textLow,
            }}
          >
            {isPortfolioOpen
              ? <ChevronDown size={PORTFOLIO_CHEVRON_SIZE} />
              : <ChevronRight size={PORTFOLIO_CHEVRON_SIZE} />
            }
          </button>
        </div>

        {/* Expanded children — indent + 2px rail §5.11.7 */}
        {isPortfolioOpen && children && (
          <div style={{
            marginLeft: 47,
            borderLeft: '2px solid rgba(139,92,246,0.3)',
          }}>
            {children}
          </div>
        )}
      </div>
    )
  }

  // ── Standard row §5.11.1 ─────────────────────────────────────────────────
  return (
    <div>
      {/* Hairline separator */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      <div
        role="button"
        tabIndex={0}
        onClick={onPress}
        onKeyDown={e => e.key === 'Enter' && onPress?.()}
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'transparent',      // §5.11.1 — NEVER a fill
          padding: `14px 18px 14px ${paddingLeft}px`,
          minHeight: 44,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          cursor: onPress ? 'pointer' : 'default',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* §5.2 spine — 3px, position absolute, full height */}
        {spineColor && (
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: spineColor,
          }} />
        )}

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* T3 title */}
          <div style={{ ...styleT3 }}>{title}</div>

          {/* T4 subline — only if different from title §5.11.5 */}
          {showSubline && (
            <div style={{ ...styleT4, marginTop: 2 }}>{subline}</div>
          )}

          {/* Day count label — accent colour matches spine, never the background */}
          {dayCount && (
            <div style={{
              ...styleT5,
              color: dayCountColor || T.textLow,
              marginTop: 3,
            }}>{dayCount}</div>
          )}
        </div>

        {/* Right-hand slot: status pill, link-out, money, or chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Status pill §5.3 */}
          {showPill && status && <StatusPill status={status} />}

          {/* Money block §5.11.4 */}
          {showMoney && commission != null && (
            <MoneyBlock commission={commission} salePrice={salePrice} />
          )}

          {/* Link-out §5.11.6 — bare ↗ at GLYPH_LINKOUT_SIZE px text-low in 26px container */}
          {lacdbUrl && (
            <button
              onClick={e => { e.stopPropagation(); onLinkOut?.() }}
              aria-label="Open in LACDB"
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                width: 26,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
                flexShrink: 0,
              }}
            >
              <span style={{
                fontFamily: FONT_DISPLAY,
                fontSize: GLYPH_LINKOUT_SIZE,
                color: T.textLow,
                lineHeight: 1,
              }}>↗</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Portfolio child row §5.11.7 ───────────────────────────────────────────────
// 13.5px address / 11px city, own status pill, own ↗
// No spine on child — child's state is carried by its pill (§5.11.2)
export function PortfolioChildRow({
  address,
  cityClient,
  status,
  lacdbUrl,
  onPress,
  onLinkOut,
}: {
  address: string
  cityClient?: string
  status?: string
  lacdbUrl?: string | null
  onPress?: () => void
  onLinkOut?: () => void
}) {
  return (
    <div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
      <div
        role="button"
        tabIndex={0}
        onClick={onPress}
        onKeyDown={e => e.key === 'Enter' && onPress?.()}
        style={{
          background: 'transparent',
          padding: '12px 18px 12px 12px',
          minHeight: 44,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          cursor: onPress ? 'pointer' : 'default',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* §5.11.7 — 13.5px address */}
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontSize: PORTFOLIO_CHILD_ADDR,
            fontWeight: 500,
            color: T.textHi,
            lineHeight: 1.25,
          }}>{address}</div>
          {/* §5.11.7 — 11px city */}
          {cityClient && (
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontSize: PORTFOLIO_CHILD_CITY,
              fontWeight: 400,
              color: T.textMid,
              lineHeight: 1.5,
              marginTop: 2,
            }}>{cityClient}</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {status && <StatusPill status={status} />}
          {lacdbUrl && (
            <button
              onClick={e => { e.stopPropagation(); onLinkOut?.() }}
              aria-label="Open in LACDB"
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                width: 26,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{
                fontFamily: FONT_DISPLAY,
                fontSize: GLYPH_LINKOUT_SIZE,
                color: T.textLow,
                lineHeight: 1,
              }}>↗</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

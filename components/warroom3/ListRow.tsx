'use client'

// §5.11 Panel sheet rows — ONE component, used across all five sheets.
// §5.11.1: Rows are hairline-separated. NO border, NO radius, NO background fill.
//          ONE construction, TWO heights: 68px with meta line, 49px without.
//          No third height — if something wraps, it is a data defect.
// §5.11.2: No red/accent tint on overdue rows. Spine only.
// §5.11.5: Meta line carries one thing decided by data:
//   - Task on a deal    → deal address (or name)  | right slot: day count
//   - Task on entity/Life → badge T5 mono         | right slot: day count
//   - Deal row          → city · client           | right slot: figure/status
//   Badge and day count NEVER contend — an entity/life task has no deal by definition.
//   Day count is ALWAYS in the right slot. Never a third line below the content.
// §5.11.7: Portfolio rows with mark plate, chevron, expanded children.
//
// CODE — day count moved to right slot (was: third line below content). Defect fix.
// CODE — badge on meta line left, not its own line and not the right slot.
// CODE — task.entity_id nullable FK added in migration; meta line renders entity name.

import React from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'

// §5.11.7 stacked-layers glyph — three diamond/chevron paths from reference render 32a.
// Not Lucide Layers (filled document icon). This is the correct mark from the spec.
function StackedLayersIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.8 21 7.4l-9 4.6-9-4.6z"/>
      <path d="M3 12.2 12 16.8l9-4.6"/>
      <path d="M3 16.8 12 21.4l9-4.6"/>
    </svg>
  )
}

// ── Type tokens §3.2 ─────────────────────────────────────────────────────────
const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

// T3 §3.2 — 14.5px / 500 / sentence / text-hi — row title
// Rendered line height: 14.5 * 1.25 = 18.125 → browser renders 19px
const styleT3: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 14.5,
  fontWeight: 500,
  color: '#EFEEF4',
  lineHeight: 1.25,
}

// Meta line §5.11.1 — Space Grotesk 11.5/400, text-low
// Rendered line height: 11.5 * 1.3 ≈ 15px → spec says 15px meta line
const styleMetaLine: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 11.5,
  fontWeight: 400,
  color: '#5C5B6B',
  lineHeight: 1.3,
}

// T5 §3.2 — 9px / 500 (700 when filled) / 0.11em / UPPER — pills, badges
const styleT5: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
  lineHeight: 1,
}

// Day count — T5 variant, accent colour, always in right slot (never below content)
// CODE: moved from third-line-below to right slot per §5.11.5 / locked design 20a
const styleDayCount: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
  lineHeight: 1,
  flexShrink: 0,
}

// ── TYPE_TUNE_INPUTS — no matching §3.2 level ────────────────────────────────
const MONO_COMMISSION_SIZE = 15     // §5.11.4 commission figure
const MONO_PRICE_SIZE = 11.5        // §5.11.4 sale price — T4 size but mono family
const GLYPH_LINKOUT_SIZE = 14       // §5.11.6 ↗ glyph
const PORTFOLIO_MARK_SIZE = 15      // §5.11.7 stacked-layers glyph
const PORTFOLIO_CHILD_ADDR = 13.5   // §5.11.7 child address
const PORTFOLIO_CHILD_CITY = 11     // §5.11.7 child city
const PORTFOLIO_CHEVRON_SIZE = 15   // §5.11.7 chevron
const PORTFOLIO_SITE_COUNT = 11.5   // §5.11.7 SITES — T4 size, mono family

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

// ── Status pill §5.3 ─────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status.toUpperCase()
  if (status === 'hot') {
    return (
      <span style={{ ...styleT5, fontWeight: 700, background: T.hot, color: T.textInvert, padding: '5px 8px', borderRadius: 4, flexShrink: 0 }}>
        {label}
      </span>
    )
  }
  return (
    <span style={{ ...styleT5, border: '1px solid rgba(255,255,255,0.14)', color: T.textMid, padding: '5px 8px', borderRadius: 4, flexShrink: 0 }}>
      {label}
    </span>
  )
}

const STATUS_LABELS: Record<string, string> = {
  hot: 'HOT', under_contract: 'UC', active: 'ACTIVE', pipeline: 'PIPELINE',
  in_review: 'REVIEW', pending_payment: 'PENDING', closed: 'CLOSED',
  in_service: 'SERVICE', expired: 'EXPIRED', dormant: 'DORMANT', terminated: 'TERM',
}

// ── Money block §5.11.4 ──────────────────────────────────────────────────────
// EYES-AUTO: fits in the meta area only when shown inline with row — separate right slot
// Matthew flagged: commission 15px + T5 label + price 11.5px ≈ 35.5px into 39px content area.
// Rendered here as right-slot column; row height extends to content if money block is taller.
// Report actual render in ship-gate — if it exceeds 68px it must be reported.
function MoneyBlock({ commission, salePrice }: { commission: number; salePrice?: number | null }) {
  function fmt(n: number) { return '$' + Math.round(n).toLocaleString('en-US') }
  // §5.11.4: 15+1+9+1+11.5 = 38.5px fits 39px content area. Gaps 1px per directive option 1.
  return (
    <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: MONO_COMMISSION_SIZE, fontWeight: 500, color: T.moneyIn, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {fmt(commission)}
      </div>
      <div style={{ ...styleT5, color: T.textLow }}>COMMISSION</div>
      {salePrice != null && (
        <div style={{ fontFamily: FONT_MONO, fontSize: MONO_PRICE_SIZE, fontWeight: 400, color: T.textLow, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {fmt(salePrice)}
        </div>
      )}
    </div>
  )
}

// ── Props ────────────────────────────────────────────────────────────────────
export interface ListRowProps {
  title: string
  // Meta line — exactly one of these, decided by data (§5.11.5):
  metaDeal?: string | null        // deal address / name  (task on a deal)
  metaBadge?: string | null       // entity/life tag      (task on entity/life)
  metaCityClient?: string | null  // city · client        (deal rows)
  // Right slot
  status?: string
  showPill?: boolean
  dayCount?: string | null        // always right slot — never below content (CODE)
  dayCountColor?: string | null
  commission?: number | null
  salePrice?: number | null
  showMoney?: boolean
  // Portfolio variant
  isPortfolio?: boolean
  portfolioSiteCount?: number
  isPortfolioOpen?: boolean
  // Spine
  spineColor?: string | null
  // Link-out
  lacdbUrl?: string | null
  onPress?: () => void
  onLinkOut?: () => void
  onChevronPress?: () => void
  children?: React.ReactNode
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ListRow({
  title,
  metaDeal,
  metaBadge,
  metaCityClient,
  status,
  showPill = false,
  dayCount = null,
  dayCountColor = null,
  commission = null,
  salePrice = null,
  showMoney = false,
  isPortfolio = false,
  portfolioSiteCount = 0,
  isPortfolioOpen = false,
  spineColor = null,
  lacdbUrl = null,
  onPress,
  onLinkOut,
  onChevronPress,
  children,
}: ListRowProps) {
  // Compute the single meta line value (§5.11.5 — one thing, decided by data)
  const metaValue = metaDeal || metaCityClient || null
  // Badge goes on meta line left (not right slot, not own line) — CODE
  const hasBadge = !!metaBadge
  const hasMetaLine = !!(metaValue || hasBadge)

  // §5.11.5: never print same string twice
  const showMetaLine = hasMetaLine && (metaValue !== title)

  const paddingLeft = spineColor ? 21 : 18

  // ── Portfolio row §5.11.7 ────────────────────────────────────────────────
  if (isPortfolio) {
    return (
      <div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
        <div
          role="button" tabIndex={0}
          onClick={onPress}
          onKeyDown={e => e.key === 'Enter' && onPress?.()}
          style={{ position: 'relative', overflow: 'hidden', background: 'transparent', padding: '14px 18px', minHeight: 44, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
        >
          {/* 28px brand plate */}
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(139,92,246,0.13)', border: '1px solid rgba(139,92,246,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <StackedLayersIcon size={PORTFOLIO_MARK_SIZE} color={T.brandLift} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...styleT3 }}>{title}</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: PORTFOLIO_SITE_COUNT, fontWeight: 500, color: T.brandLift, letterSpacing: '0.11em', textTransform: 'uppercase', lineHeight: 1, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
              {portfolioSiteCount} {portfolioSiteCount === 1 ? 'SITE' : 'SITES'}
            </div>
          </div>
          {/* Chevron right slot */}
          <button onClick={e => { e.stopPropagation(); onChevronPress?.() }} aria-label={isPortfolioOpen ? 'Collapse' : 'Expand'}
            style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, color: isPortfolioOpen ? T.brandLift : T.textLow, WebkitTapHighlightColor: 'transparent' }}>
            {isPortfolioOpen ? <ChevronDown size={PORTFOLIO_CHEVRON_SIZE} /> : <ChevronRight size={PORTFOLIO_CHEVRON_SIZE} />}
          </button>
        </div>
        {/* Expanded children behind 2px brand rail */}
        {isPortfolioOpen && children && (
          <div style={{ marginLeft: 47, borderLeft: '2px solid rgba(139,92,246,0.3)' }}>
            {children}
          </div>
        )}
      </div>
    )
  }

  // ── Standard row — one construction, two heights ──────────────────────────
  // 68px: 14 + 19(title) + 5(gap) + 15(meta) + 14 + 1(hairline)
  // 49px: 14 + 19(title) + 14 + 1(hairline)   [spec says 49; will measure and report]
  // Day count is ALWAYS in the right slot — never adds height.
  return (
    <div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
      <div
        role="button" tabIndex={0}
        onClick={onPress}
        onKeyDown={e => e.key === 'Enter' && onPress?.()}
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'transparent',
          padding: `14px 18px 14px ${paddingLeft}px`,
          // minHeight 44px — satisfied by 14+14 padding alone on a title-only row (48px > 44)
          display: 'flex',
          alignItems: showMetaLine ? 'flex-start' : 'center',
          gap: 10,
          cursor: onPress ? 'pointer' : 'default',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* Spine */}
        {spineColor && (
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: spineColor }} />
        )}

        {/* Content block — flex:1 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title — T3 */}
          <div style={{ ...styleT3 }}>{title}</div>

          {/* Meta line — 5px gap above, only when present (§5.11.5) */}
          {showMetaLine && (
            <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Badge on meta line LEFT — entity/life tag (CODE: was its own line or right slot) */}
              {hasBadge && (
                <span style={{ ...styleT5, color: T.textLow, border: '1px solid rgba(255,255,255,0.10)', borderRadius: 4, padding: '2px 5px', flexShrink: 0 }}>
                  {metaBadge}
                </span>
              )}
              {/* Meta text */}
              {metaValue && (
                <span style={{ ...styleMetaLine }}>{metaValue}</span>
              )}
            </div>
          )}
        </div>

        {/* Right slot — day count | status pill | money | link-out
            Day count is ALWAYS here, never below content (CODE) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, alignSelf: 'center' }}>
          {/* Day count — right slot, accent colour */}
          {dayCount && (
            <span style={{ ...styleDayCount, color: dayCountColor || T.textLow }}>
              {dayCount}
            </span>
          )}

          {/* Status pill */}
          {showPill && status && <StatusPill status={status} />}

          {/* Money block */}
          {showMoney && commission != null && (
            <MoneyBlock commission={commission} salePrice={salePrice} />
          )}

          {/* Link-out §5.11.6 — bare glyph at GLYPH_LINKOUT_SIZE, text-low, 26px container */}
          {lacdbUrl && (
            <button
              onClick={e => { e.stopPropagation(); onLinkOut?.() }}
              aria-label="Open in LACDB"
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent', flexShrink: 0 }}
            >
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: GLYPH_LINKOUT_SIZE, color: T.textLow, lineHeight: 1 }}>↗</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Portfolio child row §5.11.7 ──────────────────────────────────────────────
export function PortfolioChildRow({
  address, cityClient, status, lacdbUrl, onPress, onLinkOut,
}: {
  address: string; cityClient?: string; status?: string
  lacdbUrl?: string | null; onPress?: () => void; onLinkOut?: () => void
}) {
  return (
    <div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
      <div
        role="button" tabIndex={0} onClick={onPress}
        onKeyDown={e => e.key === 'Enter' && onPress?.()}
        style={{ background: 'transparent', padding: '12px 18px 12px 12px', minHeight: 44, display: 'flex', alignItems: 'flex-start', gap: 8, cursor: onPress ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: PORTFOLIO_CHILD_ADDR, fontWeight: 500, color: T.textHi, lineHeight: 1.25 }}>{address}</div>
          {cityClient && <div style={{ fontFamily: FONT_DISPLAY, fontSize: PORTFOLIO_CHILD_CITY, fontWeight: 400, color: T.textMid, lineHeight: 1.5, marginTop: 2 }}>{cityClient}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {status && <StatusPill status={status} />}
          {lacdbUrl && (
            <button onClick={e => { e.stopPropagation(); onLinkOut?.() }} aria-label="Open in LACDB"
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: GLYPH_LINKOUT_SIZE, color: T.textLow, lineHeight: 1 }}>↗</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

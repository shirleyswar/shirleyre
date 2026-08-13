'use client'

// Deals sheet + Deal Pipeline band — §6 item 6 + §6.1 + §12 step 5
// Sheet: lookup, not scanning. Search pinned, filter chips, alpha groups, ↗ per row.
// Band: T1 header + count, search field, 3 recent rows, "Browse all N" button.

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import BottomSheet from '@/components/warroom3/BottomSheet'
import { formatAddress } from '@/lib/formatAddress'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  bgBase:      '#08080C',
  bgPanel:     '#101017',
  bgRaise:     '#16161F',
  textHi:      '#EFEEF4',
  textMid:     '#8B8A9B',
  textLow:     '#5C5B6B',
  brand:       '#8B5CF6',
  brandStrong: '#7C3AED',
  brandLift:   '#A78BFA',
  moneyIn:     '#34D399',
  late:        '#FF4D4D',
  hot:         '#FFA23A',
} as const

// T1 §3.2
const styleT1: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: T.textMid,
  lineHeight: 1,
}

// T3 §3.2
const styleT3: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 14.5,
  fontWeight: 500,
  color: T.textHi,
  lineHeight: 1.25,
}

// T4 §3.2
const styleT4: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 11.5,
  fontWeight: 400,
  color: T.textMid,
  lineHeight: 1.5,
}

// T5 §3.2 — pills, chips
const styleT5: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
  lineHeight: 1,
}

interface Deal {
  id: string
  status: string
  name: string | null
  address: string | null
  updated_at: string
  portfolio_id: string | null  // §5.11.7 — portfolios group separately
}

type FilterStatus = 'all' | 'hot' | 'under_contract' | 'active' | 'pipeline' | 'closed'

// Status display labels for pills — kept short per §10 rule 7
const STATUS_LABELS: Record<string, string> = {
  hot:              'HOT',
  under_contract:   'UC',
  active:           'ACTIVE',
  pipeline:         'PIPELINE',
  in_review:        'REVIEW',
  pending_payment:  'PENDING',
  closed:           'CLOSED',
  in_service:       'SERVICE',
  expired:          'EXPIRED',
  dormant:          'DORMANT',
  terminated:       'TERM',
}

function statusPillStyle(status: string): React.CSSProperties {
  // Filled only for HOT (§5.3 — filled = needs a decision)
  // All others: outlined
  if (status === 'hot') {
    return {
      background: T.hot,
      color: '#0A0A0F',
      fontWeight: 700,
      border: 'none',
    }
  }
  return {
    background: 'transparent',
    color: T.textMid,
    border: '1px solid rgba(255,255,255,0.14)',
  }
}

function getRowSpine(status: string): string | null {
  if (status === 'hot') return T.hot
  if (status === 'under_contract') return T.brand
  if (status === 'pending_payment') return T.moneyIn
  return null
}

// §5.11.9 short-form address — street name · cardinal · number only via formatAddress().
// Raw Google address "10993 N Harrells Ferry Rd, Baton Rouge, LA 70816, USA"
// → formatAddress() → "Harrells Ferry Rd. N. 10993"
// City/state/zip/country appear on deal detail only, never in the list row.
function dealTitle(deal: Deal): string {
  const formatted = formatAddress(deal.address)
  // formatAddress returns '—' when address is null/empty — fall back to name
  if (formatted && formatted !== '—') return formatted
  return deal.name || '—'
}

// Sub-line: client name if distinct from the formatted address
function dealSubline(deal: Deal): string {
  if (deal.name && deal.name !== deal.address) return deal.name
  return ''
}

// Keep dealAddress for band rows and grouping (uses raw address for alpha sort key)
function dealAddress(deal: Deal): string {
  return deal.address || deal.name || '—'
}

// ── Deals Sheet §6.1 ─────────────────────────────────────────────────────────
// ── 31a/32a type values ──────────────────────────────────────────────────────
// §20.1 five-value enum. Alphabetical per check 15.
const PROPERTY_TYPES = ['INDUSTRIAL', 'LAND', 'OFFICE', 'OTHER', 'RETAIL'] as const
type PropertyType = typeof PROPERTY_TYPES[number]

// T0 §3.2 (31a) — JetBrains Mono 13px / 500 / 0.14em / text-hi — Deals sheet title only
// Named level T0 — no pixel literal in component per check 3.
const STYLE_T0: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#EFEEF4',   // text-hi
  lineHeight: 1,
}

// M2 — JetBrains Mono 12px / 500 / tabular-nums / text-low — count in header (31a)
const STYLE_M2: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.04em',
  color: '#5C5B6B',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
}

interface DealsSheetProps {
  open: boolean
  onClose: () => void
  initialSearch?: string
  onOpenPortfolioCreate?: () => void  // retained for external callers — not shown in header (check 6)
  onOpenNewDeal?: () => void
}

// Extended Deal type with property_type
interface DealFull extends Deal {
  property_type: PropertyType | null
  portfolio_id: string | null
}

export function DealsSheet({ open, onClose, initialSearch = '' }: DealsSheetProps) {
  const [deals, setDeals] = useState<DealFull[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState(initialSearch)
  // 32a: active filter — 'all' | 'hot' | 'uc' | type string
  const [activeFilter, setActiveFilter] = useState<'all' | 'hot' | 'uc' | PropertyType>('all')
  // 32a: TYPE menu open state
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setSearch(initialSearch)
    setActiveFilter('all')
    setTypeMenuOpen(false)
    setLoading(true)
    setLoadError(false)
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('deals')
          .select('id, status, name, address, updated_at, property_type, portfolio_id')
          .order('address', { ascending: true })
          .limit(200)
        if (error) { setLoadError(true); setLoading(false); return }
        setDeals((data ?? []) as DealFull[])
        setLoading(false)
      } catch { setLoadError(true); setLoading(false) }
    })()
  }, [open, initialSearch])

  // 32a counts — live from data
  const hotCount = deals.filter(d => d.status === 'hot').length
  const ucCount = deals.filter(d => d.status === 'under_contract').length
  const typeCounts: Record<PropertyType, number> = { INDUSTRIAL: 0, LAND: 0, OFFICE: 0, OTHER: 0, RETAIL: 0 }
  for (const d of deals) {
    const pt = (d.property_type || 'OTHER') as PropertyType
    typeCounts[pt] = (typeCounts[pt] || 0) + 1
  }

  // Filter + search — mutually exclusive (check 12)
  const isTypeFilter = PROPERTY_TYPES.includes(activeFilter as PropertyType)
  const visible = deals.filter(d => {
    if (activeFilter === 'hot' && d.status !== 'hot') return false
    if (activeFilter === 'uc' && d.status !== 'under_contract') return false
    if (isTypeFilter && (d.property_type || 'OTHER') !== activeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (d.address || '').toLowerCase().includes(q) || (d.name || '').toLowerCase().includes(q)
    }
    return true
  })

  function handleChipFilter(f: typeof activeFilter) {
    setActiveFilter(f)
    setTypeMenuOpen(false)
  }

  // §5.11.7: Portfolios group first, then DEALS A–Z alpha groups.
  // Portfolio deals (portfolio_id non-null) are grouped under PORTFOLIOS n.
  // Remaining deals alpha-grouped as DEALS A–Z.
  const portfolioDeals = visible.filter(d => (d as any).portfolio_id)
  const nonPortfolioDeals = visible.filter(d => !(d as any).portfolio_id)

  const alphaGrouped: { letter: string; deals: DealFull[] }[] = []
  for (const deal of nonPortfolioDeals) {
    const addr = dealAddress(deal)
    const first = addr[0]
    // §5.11.3: numeric addresses group as '1 — 9', never '#'
    const letter = /[A-Z]/i.test(first) ? first.toUpperCase() : '1'
    const existing = alphaGrouped.find(g => g.letter === letter)
    if (existing) existing.deals.push(deal)
    else alphaGrouped.push({ letter, deals: [deal] })
  }
  alphaGrouped.sort((a, b) => a.letter.localeCompare(b.letter))

  // 32a: chip label for TYPE when a type is selected (check 17)
  const selectedType = isTypeFilter ? (activeFilter as PropertyType) : null
  const typeChipLabel = selectedType
    ? `${selectedType} ${typeCounts[selectedType]}`
    : 'TYPE ▾'

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      // 31a check 3: T0 label at text-hi (override via labelStyle)
      label="DEAL PIPELINE"
      labelStyle={STYLE_T0}
      // 31a check 2: header 44px (set via headerHeight)
      headerHeight={44}
      // 31a check 1: grab handle 48×5px r3 rgba(255,255,255,.22)
      handleW={48}
      handleH={5}
      handleRadius={3}
      handleOpacity="rgba(255,255,255,0.22)"
      // 31a check 5: count M2 at text-low
      count={deals.length}
      countStyle={STYLE_M2}
      size="list"
    >
      {/* Filter band — 34b §6.1. Bare 44px flex row. No pill, no fill, no radius. */}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            height: 44,
          }}
        >
          {([
            { id: 'all' as const,  labelText: 'ALL', count: deals.length },
            { id: 'hot' as const,  labelText: 'HOT', count: hotCount },
            { id: 'uc' as const,   labelText: 'UC',  count: ucCount },
          ] as const).map(seg => {
            const active = activeFilter === seg.id
            return (
              <button
                key={seg.id}
                onClick={() => handleChipFilter(seg.id)}
                style={{
                  flex: 1,
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  boxShadow: active ? `inset 0 -2px 0 ${T.brandStrong}` : 'none',
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                } as React.CSSProperties}
              >
                <span style={{
                  fontFamily: FONT_MONO,
                  fontSize: 16,
                  fontWeight: active ? 700 : 600,
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase' as const,
                  color: active ? T.textHi : T.textMid,
                  lineHeight: 1,
                }}>
                  {seg.labelText}
                </span>
                <span style={{
                  fontFamily: FONT_MONO,
                  fontSize: 16,
                  fontWeight: 400,
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase' as const,
                  color: active ? T.textHi : T.textMid,
                  lineHeight: 1,
                  marginLeft: 6,
                }}>
                  {seg.count}
                </span>
              </button>
            )
          })}
          {/* TYPE segment — fourth, same F1 style */}
          <button
            onClick={() => setTypeMenuOpen(v => !v)}
            style={{
              flex: 1,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              boxShadow: selectedType ? `inset 0 -2px 0 ${T.brandStrong}` : 'none',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties}
          >
            <span style={{
              fontFamily: FONT_MONO,
              fontSize: 16,
              fontWeight: selectedType ? 700 : 600,
              letterSpacing: '0.03em',
              textTransform: 'uppercase' as const,
              color: selectedType ? T.textHi : T.textMid,
              lineHeight: 1,
            }}>
              {selectedType ? selectedType : 'TYPE ▾'}
            </span>
            {selectedType && (
              <span style={{
                fontFamily: FONT_MONO,
                fontSize: 16,
                fontWeight: 400,
                letterSpacing: '0.03em',
                textTransform: 'uppercase' as const,
                color: T.textHi,
                lineHeight: 1,
                marginLeft: 6,
              }}>
                {typeCounts[selectedType]}
              </span>
            )}
          </button>
        </div>

        {/* 32a TYPE menu — checks 13–18. Anchored under chip row. */}
        {typeMenuOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 18,
              right: 18,
              background: T.bgRaise,
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.11)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              zIndex: 20,
              overflow: 'hidden',
            }}
          >
            {/* Five rows, alphabetical (check 15). 44px each (check 14). Four hairlines not five. */}
            {PROPERTY_TYPES.map((pt, idx) => {
              const isSelected = activeFilter === pt  // check 16
              return (
                <React.Fragment key={pt}>
                  {idx > 0 && (
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 18px' }} />
                  )}
                  <button
                    onClick={() => {
                      setActiveFilter(pt)
                      setTypeMenuOpen(false)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      height: 44,               // check 14
                      padding: '0 18px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                      minHeight: 44,
                    } as React.CSSProperties}
                  >
                    {/* Left: check glyph (when selected) + label in T1 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.brandLift} strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                      {!isSelected && <div style={{ width: 12 }} />}
                      <span style={{
                        fontFamily: FONT_MONO,
                        fontSize: 10.5,
                        fontWeight: 500,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase' as const,
                        color: isSelected ? T.brandLift : T.textHi,  // check 16
                        lineHeight: 1,
                      }}>
                        {pt}
                      </span>
                    </div>
                    {/* Right: count in M2 at text-low (brand-lift when selected — check 16) */}
                    <span style={{
                      ...STYLE_M2,
                      color: isSelected ? T.brandLift : T.textLow,  // check 16
                    }}>
                      {typeCounts[pt]}
                    </span>
                  </button>
                </React.Fragment>
              )
            })}
          </div>
        )}
      </div>

      {/* Search field */}
      <div style={{ padding: '0 18px 12px', position: 'sticky', top: 0, background: T.bgPanel, zIndex: 10 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: T.bgRaise, border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '11px 14px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLow} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 400,
              color: T.textMid, lineHeight: 1.25,
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textLow, padding: 2, display: 'flex' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Deal rows */}
      {loading ? (
        <SkeletonList />
      ) : loadError ? (
        <div onClick={() => { setLoadError(false); setDeals([]); setLoading(true);
          ;(async () => {
            try {
              const { data, error } = await supabase.from('deals').select('id, status, name, address, updated_at, property_type, portfolio_id').order('address', { ascending: true }).limit(200)
              if (error) { setLoadError(true); setLoading(false); return }
              setDeals((data ?? []) as DealFull[]); setLoading(false)
            } catch { setLoadError(true); setLoading(false) }
          })()
        }}
          style={{ padding: '24px 18px', textAlign: 'center', cursor: 'pointer' }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: '#FF4D4D' }}>Could not load — tap to retry</span>
        </div>
      ) : visible.length === 0 ? (
        <div style={{ padding: '24px 18px', textAlign: 'center' }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>No deals match.</span>
        </div>
      ) : (
        <div style={{ padding: '0 18px' }}>
          {/* §5.11.7: PORTFOLIOS section header — "PORTFOLIOS n", same T2 style as alpha headers */}
          {portfolioDeals.length > 0 && (
            <div>
              <div style={{
                fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500,
                letterSpacing: '0.19em', textTransform: 'uppercase', color: T.textLow,
                marginTop: 20, marginBottom: 8,
              }}>
                PORTFOLIOS {portfolioDeals.length}
              </div>
              {portfolioDeals.map(deal => <DealRow key={deal.id} deal={deal} />)}
            </div>
          )}

          {/* §5.11.3: DEALS A–Z alpha groups */}
          {alphaGrouped.map(group => (
            <div key={group.letter}>
              <div style={{
                fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500,
                letterSpacing: '0.19em', textTransform: 'uppercase', color: T.textLow,
                marginTop: 20, marginBottom: 8,
              }}>
                DEALS {group.letter}
              </div>
              {group.deals.map(deal => <DealRow key={deal.id} deal={deal} />)}
            </div>
          ))}
          <div style={{ height: 8 }} />
        </div>
      )}
    </BottomSheet>
  )
}

// §5.11 DealRow — uses ListRow. NO border, NO radius, NO fill. Quiet ↗ glyph §5.11.6.
// §10 item 13: The brand-tinted 30px ↗ button is RETIRED. Bare glyph only.
import ListRow from '@/components/warroom3/ListRow'

function DealRow({ deal }: { deal: Deal }) {
  // §5.11.9: short-form address via formatAddress() — "Harrells Ferry Rd. N. 10993"
  const title  = dealTitle(deal)
  const sub    = dealSubline(deal)
  const spine  = getRowSpine(deal.status)
  const lacdbUrl = `/warroom/deal?id=${deal.id}`

  return (
    <ListRow
      title={title}
      metaCityClient={sub || null}
      status={deal.status}
      showPill={true}
      spineColor={spine}
      lacdbUrl={lacdbUrl}
      onLinkOut={() => window.open(lacdbUrl, '_blank', 'noopener,noreferrer')}
    />
  )
}

// ── Deal Pipeline Band (home screen §6 item 6) ────────────────────────────────
interface DealPipelineBandProps {
  onOpenSheet: (search?: string) => void
}

export function DealPipelineBand({ onOpenSheet }: DealPipelineBandProps) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    // 3 most-recently-touched deals (any status)
    Promise.all([
      supabase
        .from('deals')
        .select('id, status, name, address, updated_at')
        .order('updated_at', { ascending: false })
        .limit(3),
      supabase
        .from('deals')
        .select('id', { count: 'exact', head: true }),
    ]).then(([recent, count]) => {
      if (recent.error || count.error) {
        console.error('[DealPipelineBand] load error:', recent.error ?? count.error)
        setLoadError(true)
        setLoading(false)
        return
      }
      setDeals((recent.data ?? []) as Deal[])
      setTotalCount(count.count ?? 0)
      setLoading(false)
    }).catch((e: unknown) => {
      console.error('[DealPipelineBand] unexpected error:', e)
      setLoadError(true)
      setLoading(false)
    })
  }, [])

  return (
    <div style={{
      background: T.bgPanel,
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      {/* §5.1 header: T1 label · hairline · count */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '16px 16px 12px',
      }}>
        <span style={styleT1}>Deal Pipeline</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
        <span style={{
          fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500,
          color: T.textLow, fontVariantNumeric: 'tabular-nums',
        }}>{loading ? '—' : loadError ? '' : totalCount}</span>
      </div>

      {/* Search field — §5.5, tapping opens sheet with pre-populated query */}
      <div style={{ padding: '0 16px 10px' }}>
        <div
          onClick={() => onOpenSheet()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: T.bgRaise,
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '11px 14px',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          } as React.CSSProperties}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLow} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 13,
            fontWeight: 400,
            color: T.textLow,
            lineHeight: 1.25,
            flex: 1,
          }}>
            Search
          </span>
        </div>
      </div>

      {/* 3 most-recently-touched deal rows */}
      {!loading && loadError && (
        <div
          onClick={() => {
            setLoadError(false); setLoading(true)
            Promise.all([
              supabase.from('deals').select('id, status, name, address, updated_at').order('updated_at', { ascending: false }).limit(3),
              supabase.from('deals').select('id', { count: 'exact', head: true }),
            ]).then(([recent, count]) => {
              if (recent.error || count.error) { setLoadError(true); setLoading(false); return }
              setDeals((recent.data ?? []) as Deal[]); setTotalCount(count.count ?? 0); setLoading(false)
            }).catch(() => { setLoadError(true); setLoading(false) })
          }}
          style={{ padding: '8px 16px 12px', textAlign: 'center', cursor: 'pointer' }}
        >
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: '#FF4D4D' }}>Could not load — tap to retry</span>
        </div>
      )}
      {!loading && !loadError && deals.length > 0 && (
        <div style={{ padding: '0 16px' }}>
          {deals.map(deal => {
            // §5.11.9: short-form address via formatAddress() — same as DealRow in the full sheet
            const formatted = formatAddress(deal.address)
            const addr = (formatted && formatted !== '—') ? formatted : (deal.name || '—')
            const pill = STATUS_LABELS[deal.status] ?? deal.status.toUpperCase()
            const pillStyle = statusPillStyle(deal.status)
            return (
              <div
                key={deal.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  minHeight: 44,
                }}
              >
                {/* T3 address — §5.11.9 short-form: street · cardinal · number only */}
                <div style={{
                  ...styleT3, fontSize: 14, flex: 1, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{addr}</div>

                {/* Status pill */}
                <span style={{
                  ...styleT5,
                  ...pillStyle,
                  padding: '5px 8px',
                  borderRadius: 4,
                  flexShrink: 0,
                }}>{pill}</span>

                {/* ↗ link-out — §5.11.6 44px touch target */}
                <a
                  href={`/warroom/deal?id=${deal.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{
                    color: T.textLow,
                    textDecoration: 'none',
                    fontSize: 13,
                    flexShrink: 0,
                    padding: 7,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 44,
                    minHeight: 44,
                    WebkitTapHighlightColor: 'transparent',
                  } as React.CSSProperties}
                >
                  ↗
                </a>
              </div>
            )
          })}
        </div>
      )}

      {/* Full-width secondary button "Browse all N" §5.4 */}
      <div style={{ padding: '12px 16px 16px' }}>
        <button
          onClick={() => onOpenSheet()}
          style={{
            width: '100%',
            background: 'transparent',
            color: T.textMid,
            border: '1px solid rgba(255,255,255,0.13)',
            borderRadius: 9,
            padding: '12px 0',
            fontFamily: FONT_DISPLAY,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            minHeight: 44,
            WebkitTapHighlightColor: 'transparent',
          } as React.CSSProperties}
        >
          Browse all {loading ? '…' : loadError ? '…' : totalCount}
        </button>
      </div>
    </div>
  )
}

function SkeletonList() {
  return (
    <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{
          height: 52, borderRadius: 10,
          background: 'rgba(255,255,255,0.04)',
          backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.6s ease-in-out infinite',
        }} />
      ))}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  )
}

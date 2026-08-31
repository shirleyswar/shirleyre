'use client'

// Deals sheet — mobile refresh items 61-66
// Changes from prior version:
//   61: removed search field, letter group headers, title row
//   62: deal row fixed 62px height, no pill, no arrow, no spine, city off title
//   63: portfolios as rows at top (ALL filter only), 34px violet stack plate, chevron
//   64: filter row pinned — ALL|HOT|UC|TYPE, 2px spine active indicator only
//   65: 104px scroll tail
//   66: FAB × while sheet open (handled by root via openSheet state)

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomSheet from '@/components/warroom3/BottomSheet'
import { formatAddress } from '@/lib/formatAddress'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  bgBase:      '#08080C',
  bgPanel:     '#12111B',
  bgRaise:     '#1E1D26',
  textHi:      '#EFEEF4',
  textMid:     '#B8B6C6',
  textLow:     '#8E8CA0',
  brand:       '#8B5CF6',
  brandStrong: '#7C3AED',
  brandLift:   '#A78BFA',
  moneyIn:     '#34D399',
  late:        '#FF4D4D',
  hot:         '#FFA23A',
} as const

// 32a: active filter — 'all' | 'hot' | 'uc' | type string
const PROPERTY_TYPES = ['INDUSTRIAL', 'LAND', 'MULTI', 'OFFICE', 'RETAIL'] as const
type PropertyType = typeof PROPERTY_TYPES[number]

// STYLE_T0 — Deals sheet label
const STYLE_T0: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#EFEEF4',
  lineHeight: 1,
}

const STYLE_M2: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 13.5,
  fontWeight: 500,
  letterSpacing: '0.04em',
  color: '#8E8CA0',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
}

interface Deal {
  id: string
  status: string
  name: string | null
  address: string | null
  addr_display?: string | null
  addr_street_name?: string | null
  addr_number?: string | null
  addr_city?: string | null
  updated_at: string
  portfolio_id: string | null
  property_type: PropertyType | null
}

interface Portfolio {
  id: string
  name: string
}

// Short address: city stripped (item 62 — city was causing wrap)
function dealShortAddress(deal: Deal): string {
  const formatted = formatAddress(deal)
  if (formatted && formatted !== '—') return formatted
  return deal.name || '—'
}

interface DealsSheetProps {
  open: boolean
  onClose: () => void
  initialSearch?: string
  onOpenPortfolioCreate?: () => void
  onOpenNewDeal?: () => void
}

export function DealsSheet({ open, onClose }: DealsSheetProps) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [expandedPortfolios, setExpandedPortfolios] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'hot' | 'uc' | PropertyType>('all')
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
  const router = useRouter()

  const togglePortfolio = useCallback((id: string) => {
    setExpandedPortfolios(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  useEffect(() => {
    if (!open) return
    setActiveFilter('all')
    setTypeMenuOpen(false)
    setExpandedPortfolios(new Set())
    setLoading(true)
    setLoadError(false)
    ;(async () => {
      try {
        const [dealsRes, portfoliosRes] = await Promise.all([
          supabase
            .from('deals')
            .select('id, status, name, address, addr_display, addr_street_name, addr_number, addr_city, updated_at, property_type, portfolio_id')
            .limit(300),
          supabase
            .from('portfolio')
            .select('id, name')
            .limit(50),
        ])
        if (dealsRes.error) { setLoadError(true); setLoading(false); return }
        // Sort client-side: by addr_display/addr_street_name, then addr_number
        const sorted = ((dealsRes.data ?? []) as Deal[]).sort((a, b) => {
          const aKey = (a.addr_display || a.addr_street_name || a.name || '').toLowerCase()
          const bKey = (b.addr_display || b.addr_street_name || b.name || '').toLowerCase()
          if (aKey !== bKey) return aKey.localeCompare(bKey)
          const aNum = parseInt(a.addr_number || '0', 10)
          const bNum = parseInt(b.addr_number || '0', 10)
          return aNum - bNum
        })
        setDeals(sorted)
        setPortfolios((portfoliosRes.data ?? []) as Portfolio[])
        setLoading(false)
      } catch { setLoadError(true); setLoading(false) }
    })()
  }, [open])

  // Counts for filter segments
  const hotCount = deals.filter(d => d.status === 'hot').length
  const ucCount  = deals.filter(d => d.status === 'under_contract').length
  const typeCounts: Record<string, number> = {}
  for (const d of deals) {
    const pt = d.property_type || 'OTHER'
    typeCounts[pt] = (typeCounts[pt] || 0) + 1
  }

  const isTypeFilter = PROPERTY_TYPES.includes(activeFilter as PropertyType)
  const selectedType = isTypeFilter ? (activeFilter as PropertyType) : null

  // Filter visible deals
  const visible = deals.filter(d => {
    if (activeFilter === 'hot' && d.status !== 'hot') return false
    if (activeFilter === 'uc' && d.status !== 'under_contract') return false
    if (isTypeFilter && (d.property_type || 'OTHER') !== activeFilter) return false
    return true
  })

  // ITEM 63: Portfolios shown under ALL only
  const showPortfolios = activeFilter === 'all'

  // Build portfolio → deals map from visible deals
  const portfolioDealsMap = new Map<string, Deal[]>()
  for (const deal of visible) {
    if (deal.portfolio_id) {
      if (!portfolioDealsMap.has(deal.portfolio_id)) portfolioDealsMap.set(deal.portfolio_id, [])
      portfolioDealsMap.get(deal.portfolio_id)!.push(deal)
    }
  }

  // Non-portfolio deals (standalone)
  const standalonDeals = visible.filter(d => !d.portfolio_id)

  // Portfolios with visible deals
  const visiblePortfolios = showPortfolios
    ? portfolios.filter(p => (portfolioDealsMap.get(p.id)?.length ?? 0) > 0)
    : []

  // Counts for ALL header
  const portfolioCount = visiblePortfolios.length
  const dealCountDisplay = visible.length

  function navigateDeal(id: string) {
    router.push(`/warroom3/deal?id=${id}`)
    onClose()
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="DEAL PIPELINE"
      labelStyle={STYLE_T0}
      headerHeight={44}
      count={deals.length}
      countStyle={STYLE_M2}
      size="list"
    >
      {/* ── ITEM 64 — FILTER ROW PINNED ─────────────────────────────────────
          Four equal segments: ALL | HOT | UC | TYPE
          Active: 2px bottom spine (brand-strong) + heavier weight
          NO pill, no fill, no track — spine only.
          All four labels on ONE baseline, none moves on switch.
      */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: T.bgPanel,
      }}>
        <div style={{ display: 'flex', height: 44, position: 'relative' }}>
          {/* ALL */}
          <FilterSeg
            label="ALL"
            count={deals.length}
            active={activeFilter === 'all'}
            onPress={() => { setActiveFilter('all'); setTypeMenuOpen(false) }}
          />
          {/* HOT */}
          <FilterSeg
            label="HOT"
            count={hotCount}
            active={activeFilter === 'hot'}
            onPress={() => { setActiveFilter('hot'); setTypeMenuOpen(false) }}
          />
          {/* UC */}
          <FilterSeg
            label="UC"
            count={ucCount}
            active={activeFilter === 'uc'}
            onPress={() => { setActiveFilter('uc'); setTypeMenuOpen(false) }}
          />
          {/* TYPE — preserve existing interaction exactly */}
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
              gap: 4,
            } as React.CSSProperties}
          >
            <span style={{
              fontFamily: FONT_MONO,
              fontSize: 12,
              fontWeight: selectedType ? 700 : 500,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: selectedType ? T.textHi : T.textMid,
              lineHeight: 1,
            }}>
              {selectedType ?? 'TYPE'} {selectedType ? (typeCounts[selectedType] ?? 0) : '▾'}
            </span>
          </button>
        </div>

        {/* TYPE dropdown menu */}
        {typeMenuOpen && (
          <div style={{
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
          }}>
            {PROPERTY_TYPES.map((pt, idx) => {
              const isSelected = activeFilter === pt
              return (
                <React.Fragment key={pt}>
                  {idx > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,0.11)', margin: '0 18px' }} />}
                  <button
                    onClick={() => { setActiveFilter(pt); setTypeMenuOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', height: 44, padding: '0 18px',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent', minHeight: 44,
                    } as React.CSSProperties}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isSelected ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.brandLift} strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : <div style={{ width: 12 }} />}
                      <span style={{
                        fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500,
                        letterSpacing: '0.14em', textTransform: 'uppercase',
                        color: isSelected ? T.brandLift : T.textHi, lineHeight: 1,
                      }}>{pt}</span>
                    </div>
                    <span style={{ ...STYLE_M2, color: isSelected ? T.brandLift : T.textLow }}>
                      {typeCounts[pt] ?? 0}
                    </span>
                  </button>
                </React.Fragment>
              )
            })}
          </div>
        )}
      </div>

      {/* ── LIST BODY ─────────────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonList />
      ) : loadError ? (
        <div style={{ padding: '24px 18px', textAlign: 'center', cursor: 'pointer' }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.late }}>Could not load — tap to retry</span>
        </div>
      ) : visible.length === 0 && visiblePortfolios.length === 0 ? (
        <div style={{ padding: '24px 18px', textAlign: 'center' }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>No deals match.</span>
        </div>
      ) : (
        <div>
          {/* ── ITEM 63 — PORTFOLIOS AS ROWS AT TOP (ALL only) ─── */}
          {showPortfolios && visiblePortfolios.length > 0 && (
            <>
              {visiblePortfolios.map(portfolio => {
                const children = portfolioDealsMap.get(portfolio.id) ?? []
                const isExpanded = expandedPortfolios.has(portfolio.id)
                return (
                  <React.Fragment key={portfolio.id}>
                    {/* Portfolio row — 62px, 34px violet stack plate, name, count, chevron */}
                    <button
                      onClick={() => togglePortfolio(portfolio.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        width: '100%',
                        height: 62,
                        padding: '0 18px',
                        boxSizing: 'border-box',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.10)',
                        cursor: 'pointer',
                        WebkitTapHighlightColor: 'transparent',
                        textAlign: 'left',
                      } as React.CSSProperties}
                    >
                      {/* 34px violet stack plate */}
                      <div style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        background: T.brand,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                          <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                        </svg>
                      </div>
                      {/* Name */}
                      <div style={{
                        flex: 1,
                        fontFamily: FONT_DISPLAY,
                        fontSize: 18,
                        fontWeight: 500,
                        color: T.textHi,
                        lineHeight: 1.2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                      }}>{portfolio.name}</div>
                      {/* Site count in brand-lift mono */}
                      <span style={{
                        fontFamily: FONT_MONO,
                        fontSize: 12,
                        fontWeight: 500,
                        color: T.brandLift,
                        letterSpacing: '0.08em',
                        flexShrink: 0,
                      }}>{children.length}</span>
                      {/* Chevron */}
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke={T.textLow} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        style={{
                          flexShrink: 0,
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                          transition: 'transform 150ms ease',
                        }}
                      >
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </button>

                    {/* Expanded deal rows under portfolio */}
                    {isExpanded && children.map(deal => (
                      <DealRow key={deal.id} deal={deal} onPress={() => navigateDeal(deal.id)} indented />
                    ))}
                  </React.Fragment>
                )
              })}
            </>
          )}

          {/* Standalone deals */}
          {standalonDeals.map(deal => (
            <DealRow key={deal.id} deal={deal} onPress={() => navigateDeal(deal.id)} />
          ))}


        </div>
      )}
    </BottomSheet>
  )
}

// ── Filter segment component ──────────────────────────────────────────────────
function FilterSeg({
  label,
  count,
  active,
  onPress,
}: {
  label: string
  count: number
  active: boolean
  onPress: () => void
}) {
  return (
    <button
      onClick={onPress}
      style={{
        flex: 1,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        background: 'transparent',
        border: 'none',
        // 2px bottom spine (brand-strong) when active. No pill, no fill.
        boxShadow: active ? `inset 0 -2px 0 #7C3AED` : 'none',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        padding: 0,
      } as React.CSSProperties}
    >
      <span style={{
        fontFamily: FONT_MONO,
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: active ? '#EFEEF4' : '#B8B6C6',
        lineHeight: 1,
      }}>{label}</span>
      <span style={{
        fontFamily: FONT_MONO,
        fontSize: 12,
        fontWeight: 400,
        letterSpacing: '0.04em',
        color: active ? '#EFEEF4' : '#8E8CA0',
        lineHeight: 1,
      }}>{count}</span>
    </button>
  )
}

// ── ITEM 62 — Deal Row ────────────────────────────────────────────────────────
// Short address at 18px. FIXED HEIGHT 62px. Hairline separated.
// NO status pill, NO arrow, NO right-margin count, NO spine.
// WHOLE ROW is the tap → opens deal page. City off title.
function DealRow({
  deal,
  onPress,
  indented = false,
}: {
  deal: Deal
  onPress: () => void
  indented?: boolean
}) {
  const [pressed, setPressed] = React.useState(false)
  const title = dealShortAddress(deal)

  return (
    <button
      onClick={onPress}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => { setTimeout(() => setPressed(false), 80) }}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        height: 62,
        padding: `0 18px 0 ${indented ? 64 : 18}px`,
        boxSizing: 'border-box',
        background: pressed ? 'rgba(255,255,255,0.03)' : 'transparent',
        border: 'none',
        borderBottom: '1px solid rgba(255,255,255,0.10)',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        textAlign: 'left',
        transition: 'background 80ms ease',
        flexShrink: 0,
      } as React.CSSProperties}
    >
      <span style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 18,
        fontWeight: 500,
        color: T.textHi,
        lineHeight: 1.2,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 1,
        minWidth: 0,
      }}>{title}</span>
    </button>
  )
}

// ── Skeleton list ─────────────────────────────────────────────────────────────
function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {[1,2,3,4,5,6,7].map(i => (
        <div key={i} style={{
          height: 62,
          padding: '0 18px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
        }}>
          <div style={{
            height: 18, width: `${55 + (i % 3) * 12}%`, borderRadius: 4,
            background: 'rgba(255,255,255,0.04)',
            backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.6s ease-in-out infinite',
          }} />
        </div>
      ))}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  )
}

'use client'

// Deals sheet + Deal Pipeline band — §6 item 6 + §6.1 + §12 step 5
// Sheet: lookup, not scanning. Search pinned, filter chips, alpha groups, ↗ per row.
// Band: T1 header + count, search field, 3 recent rows, "Browse all N" button.

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import BottomSheet from '@/components/warroom3/BottomSheet'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  bgBase:    '#08080C',
  bgPanel:   '#101017',
  bgRaise:   '#16161F',
  textHi:    '#EFEEF4',
  textMid:   '#8B8A9B',
  textLow:   '#5C5B6B',
  brand:     '#8B5CF6',
  brandLift: '#A78BFA',
  moneyIn:   '#34D399',
  late:      '#FF4D4D',
  hot:       '#FFA23A',
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

// Primary display text for a deal row
function dealAddress(deal: Deal): string {
  return deal.address || deal.name || '—'
}

// Sub-line: name if address is primary, else nothing
function dealSubline(deal: Deal): string {
  if (deal.address && deal.name && deal.name !== deal.address) {
    return deal.name
  }
  return ''
}

// ── Deals Sheet §6.1 ─────────────────────────────────────────────────────────
interface DealsSheetProps {
  open: boolean
  onClose: () => void
  initialSearch?: string
}

export function DealsSheet({ open, onClose, initialSearch = '' }: DealsSheetProps) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState(initialSearch)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setSearch(initialSearch)
    setLoading(true)
    setLoadError(false)
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('deals')
          .select('id, status, name, address, updated_at')
          .order('address', { ascending: true })
          .limit(200)
        if (error) {
          console.error('[DealsSheet] load error:', error)
          setLoadError(true)
          setLoading(false)
          return
        }
        setDeals((data ?? []) as Deal[])
        setLoading(false)
      } catch (e: unknown) {
        console.error('[DealsSheet] unexpected error:', e)
        setLoadError(true)
        setLoading(false)
      }
    })()
  }, [open, initialSearch])

  // Filter chips: ALL · HOT · UC · ACTIVE · PIPELINE · CLOSED
  const FILTER_CHIPS: { id: FilterStatus; label: string }[] = [
    { id: 'all',            label: `ALL ${deals.length}` },
    { id: 'hot',            label: `HOT ${deals.filter(d=>d.status==='hot').length}` },
    { id: 'under_contract', label: `UC ${deals.filter(d=>d.status==='under_contract').length}` },
    { id: 'active',         label: `ACTIVE ${deals.filter(d=>d.status==='active').length}` },
    { id: 'pipeline',       label: `PIPELINE ${deals.filter(d=>d.status==='pipeline').length}` },
    { id: 'closed',         label: `CLOSED ${deals.filter(d=>d.status==='closed').length}` },
  ]

  // Filter + search
  const visible = deals.filter(d => {
    if (filter !== 'all' && d.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (d.address || '').toLowerCase().includes(q) || (d.name || '').toLowerCase().includes(q)
    }
    return true
  })

  // Alpha groups — by first char of address/name
  const grouped: { letter: string; deals: Deal[] }[] = []
  for (const deal of visible) {
    const addr = dealAddress(deal)
    const letter = /[A-Z]/i.test(addr[0]) ? addr[0].toUpperCase() : '#'
    const existing = grouped.find(g => g.letter === letter)
    if (existing) existing.deals.push(deal)
    else grouped.push({ letter, deals: [deal] })
  }
  // Compress consecutive letters into ranges for headers: A–B, C, D–F
  // Simple: just show single letter per group
  grouped.sort((a, b) => a.letter.localeCompare(b.letter))

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="Deal Pipeline"
      count={deals.length}
      size="list"
    >
      {/* Search field — pinned under header, always visible */}
      <div style={{ padding: '0 18px 12px', position: 'sticky', top: 0, background: T.bgPanel, zIndex: 10 }}>
        {/* §5.5 search field */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: T.bgRaise,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: '11px 14px',
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
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontFamily: FONT_DISPLAY,
              fontSize: 13,
              fontWeight: 400,
              color: T.textMid,
              lineHeight: 1.25,
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textLow, padding: 2, display: 'flex' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        {/* Filter chips — horizontal scroll, T5 §5.3 outlined, brand fill on active */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingTop: 10, scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'] }}>
          {FILTER_CHIPS.map(chip => (
            <button
              key={chip.id}
              onClick={() => setFilter(chip.id)}
              style={{
                flexShrink: 0,
                padding: '7px 13px',
                borderRadius: 100,
                ...styleT5,
                background: filter === chip.id ? T.brand : 'transparent',
                color: filter === chip.id ? '#0A0A0F' : T.textMid,
                fontWeight: filter === chip.id ? 700 : 500,
                border: filter === chip.id ? 'none' : '1px solid rgba(255,255,255,0.12)',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                whiteSpace: 'nowrap',
                // §11.2: 44px tap target. Visual chip stays compact; tap area extended
                // via margin/padding offset so chips don't visually expand.
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
              } as React.CSSProperties}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Deal rows — alpha grouped */}
      {loading ? (
        <SkeletonList />
      ) : loadError ? (
        <div
          onClick={() => { setLoadError(false); setDeals([]); setLoading(true);
            ;(async () => {
              try {
                const { data, error } = await supabase.from('deals').select('id, status, name, address, updated_at').order('address', { ascending: true }).limit(200)
                if (error) { setLoadError(true); setLoading(false); return }
                setDeals((data ?? []) as Deal[]); setLoading(false)
              } catch { setLoadError(true); setLoading(false) }
            })()
          }}
          style={{ padding: '24px 18px', textAlign: 'center', cursor: 'pointer' }}
        >
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: '#FF4D4D' }}>Could not load — tap to retry</span>
        </div>
      ) : visible.length === 0 ? (
        <div style={{ padding: '24px 18px', textAlign: 'center' }}>
          <span style={{ ...styleT4, fontStyle: 'italic', opacity: 0.5 }}>No deals match.</span>
        </div>
      ) : (
        <div style={{ padding: '0 18px' }}>
          {grouped.map(group => (
            <div key={group.letter}>
              {/* T2 alpha group header */}
              <div style={{
                fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500,
                letterSpacing: '0.19em', textTransform: 'uppercase', color: T.textLow,
                marginTop: 20, marginBottom: 8,
              }}>
                {group.letter}
              </div>
              {group.deals.map(deal => <DealRow key={deal.id} deal={deal} />)}
            </div>
          ))}
          {/* Bottom padding for tab bar */}
          <div style={{ height: 8 }} />
        </div>
      )}
    </BottomSheet>
  )
}

function DealRow({ deal }: { deal: Deal }) {
  const spine = getRowSpine(deal.status)
  const spineBg = deal.status === 'hot'
    ? 'rgba(255,162,58,0.05)'
    : deal.status === 'under_contract'
    ? 'rgba(139,92,246,0.05)'
    : 'transparent'

  const addr = dealAddress(deal)
  const sub  = dealSubline(deal)
  const pill = STATUS_LABELS[deal.status] ?? deal.status.toUpperCase()
  const pillStyle = statusPillStyle(deal.status)

  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: spine ? '12px 12px 12px 15px' : '12px 12px',
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.05)',
      background: spine ? spineBg : 'rgba(255,255,255,0.02)',
      marginBottom: 6,
      minHeight: 44,
    }}>
      {spine && (
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: spine }} />
      )}

      {/* Address + sub-line */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          ...styleT3, fontSize: 14,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{addr}</div>
        {sub && (
          <div style={{
            ...styleT4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginTop: 2,
          }}>{sub}</div>
        )}
      </div>

      {/* Status pill §5.3 */}
      <span style={{
        ...styleT5,
        ...pillStyle,
        padding: '5px 8px',
        borderRadius: 4,
        flexShrink: 0,
        fontWeight: deal.status === 'hot' ? 700 : 500,
      }}>
        {pill}
      </span>

      {/* ↗ link-out — brand tinted, 30px, radius 9 per §6.1 */}
      <a
        href={`/warroom/deal?id=${deal.id}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        aria-label="Open deal"
        style={{
          flexShrink: 0,
          width: 30,
          height: 30,
          borderRadius: 9,
          background: 'rgba(139,92,246,0.12)',
          border: '1px solid rgba(139,92,246,0.25)',
          color: T.brandLift,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          fontSize: 14,
          lineHeight: 1,
          // Extend tap target
          margin: -7,
          padding: 7,
          WebkitTapHighlightColor: 'transparent',
        } as React.CSSProperties}
      >
        ↗
      </a>
    </div>
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
            const addr = dealAddress(deal)
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
                {/* T3 address */}
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

                {/* ↗ link-out — text-low per §6 band spec */}
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
                    margin: -7,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 30,
                    minHeight: 30,
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

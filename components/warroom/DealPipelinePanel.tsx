'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase, Deal, DealStatus, DealTier } from '@/lib/supabase'

// ─── Address Parser ───────────────────────────────────────────────────────────
const STREET_TYPES: Record<string, string> = {
  avenue:'Ave.', ave:'Ave.', boulevard:'Blvd.', blvd:'Blvd.',
  street:'St.', st:'St.', road:'Rd.', rd:'Rd.', drive:'Dr.', dr:'Dr.',
  lane:'Ln.', ln:'Ln.', court:'Ct.', ct:'Ct.', place:'Pl.', pl:'Pl.',
  circle:'Cir.', cir:'Cir.', highway:'Hwy.', hwy:'Hwy.',
  parkway:'Pkwy.', pkwy:'Pkwy.', trail:'Trl.', trl:'Trl.',
  way:'Way', terrace:'Ter.', ter:'Ter.', loop:'Loop', plaza:'Plz.',
}
const DIRECTIONS_MAP: Record<string, string> = {
  north:'N', south:'S', east:'E', west:'W',
  northeast:'NE', northwest:'NW', southeast:'SE', southwest:'SW',
  n:'N', s:'S', e:'E', w:'W', ne:'NE', nw:'NW', se:'SE', sw:'SW',
}

function parseAddress(raw: string | null): {
  addr_number: string | null
  addr_street_name: string | null
  addr_street_type: string | null
  addr_direction: string | null
  addr_city: string | null
  addr_display: string | null
} {
  const empty = { addr_number:null, addr_street_name:null, addr_street_type:null, addr_direction:null, addr_city:null, addr_display:null }
  if (!raw || raw.startsWith('📁')) return empty

  let addrPart = raw.trim()
  let city: string | null = null

  // Google format: "5525 Reitz Ave, Baton Rouge, LA 70809, USA"
  if (addrPart.includes(',')) {
    const parts = addrPart.split(',').map(s => s.trim())
    addrPart = parts[0]
    if (parts.length >= 3 && !/^[A-Z]{2}$/.test(parts[1])) city = parts[1]
  } else {
    // "City - Street..." prefix
    const m = addrPart.match(/^([A-Za-z][A-Za-z\s]+?)\s*[-–]\s*(.+)$/)
    if (m) { city = m[1].trim(); addrPart = m[2].trim() }
  }

  // Normalize extra periods
  addrPart = addrPart.replace(/\.(?!\s)/g, '. ').trim()
  const tokens = addrPart.split(/\s+/).filter(Boolean)
  if (!tokens.length) return { ...empty, addr_city: city }

  let number: string | null = null
  let direction: string | null = null
  const streetNameParts: string[] = []
  let streetType: string | null = null
  let i = 0

  // Number at start
  if (/^\d+[A-Za-z]?$/.test(tokens[0])) { number = tokens[0]; i = 1 }
  // Number at end (FILING convention)
  else if (/^\d+[A-Za-z]?$/.test(tokens[tokens.length - 1])) {
    number = tokens[tokens.length - 1]
    tokens.splice(tokens.length - 1, 1)
  }

  // Direction after number
  if (i < tokens.length && DIRECTIONS_MAP[tokens[i].toLowerCase().replace(/\.$/, '')]) {
    direction = DIRECTIONS_MAP[tokens[i].toLowerCase().replace(/\.$/, '')]
    i++
  }

  const remaining = tokens.slice(i)
  let foundType = false
  for (let j = 0; j < remaining.length; j++) {
    const clean = remaining[j].toLowerCase().replace(/\.$/, '')
    if (STREET_TYPES[clean]) {
      streetType = STREET_TYPES[clean]
      streetNameParts.push(...remaining.slice(0, j))
      foundType = true
      break
    }
  }
  if (!foundType) streetNameParts.push(...remaining)

  const dispParts: string[] = []
  if (direction) dispParts.push(direction)
  if (streetNameParts.length) dispParts.push(streetNameParts.join(' '))
  if (streetType) dispParts.push(streetType)
  if (number) dispParts.push(number)

  return {
    addr_number: number,
    addr_street_name: streetNameParts.join(' ') || null,
    addr_street_type: streetType,
    addr_direction: direction,
    addr_city: city,
    addr_display: dispParts.join(' ') || addrPart,
  }
}



/* eslint-disable @typescript-eslint/no-explicit-any */

const DEAL_TYPES: { value: string; label: string }[] = [
  { value: 'potential_listing',   label: 'Potential Listing' },
  { value: 'active_listing',      label: 'Active Listing' },
  { value: 'listing',             label: 'Listing' },
  { value: 'landlord',            label: 'Landlord' },
  { value: 'seller',              label: 'Seller' },
  { value: 'tenant',              label: 'Tenant' },
  { value: 'buyer',               label: 'Buyer' },
  { value: 'buyer_rep',           label: 'Buyer Rep' },
  { value: 'tenant_rep',          label: 'Tenant Rep' },
  { value: 'landlord_rep',        label: 'Landlord Rep' },
  { value: 'referral',            label: 'Referral' },
  { value: 'consulting',          label: 'Consulting' },
  { value: 'x_develop_serv',      label: 'X - Develop Serv' },
  { value: 'x_consulting',        label: 'X - Consulting' },
  { value: 'other',               label: 'Other' },
]

const STATUS_LABELS: Record<DealStatus, string> = {
  active: 'Active',
  in_review: 'In Review',
  pipeline: 'Pipeline',
  in_service: 'In Service',
  hot: 'Hot',
  under_contract: 'Under Contract',
  pending_payment: 'Pending Pmt',
  closed: 'Closed',
  expired: 'Expired',
  dormant: 'Dormant',
  terminated: 'Terminated',
}

const STATUS_CLASS: Record<DealStatus, string> = {
  active: 'badge-active',
  in_review: 'badge-pending',
  pipeline: 'badge-pipeline',
  in_service: 'badge-contract',
  hot: 'badge-hot',
  under_contract: 'badge-contract',
  pending_payment: 'badge-pending',
  closed: 'badge-closed',
  expired: 'badge-dead',
  dormant: 'badge-dead',
  terminated: 'badge-dead',
}

// The 4 primary statuses shown in UI
const PRIMARY_STATUSES: DealStatus[] = ['active', 'in_review', 'pipeline', 'in_service']

function formatCurrency(n: number | null) {
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

// ─── Mobile Filter Pill ───────────────────────────────────────────────────────

const STATUS_OPTS = [
  { value: 'all',            label: 'All Status' },
  { value: 'active',         label: 'Active' },
  { value: 'hot',            label: 'Hot' },
  { value: 'under_contract', label: 'Under Contract' },
  { value: 'pipeline',       label: 'Pipeline' },
  { value: 'in_review',      label: 'In Review' },
  { value: 'closed',         label: 'Closed' },
]

const TIER_OPTS = [
  { value: 'all',     label: 'All Tiers' },
  { value: 'filed',   label: 'Filed' },
  { value: 'tracked', label: 'Tracked' },
]

function MobileFilterPill({
  filter, tierFilter, onFilterChange, onTierChange,
}: {
  filter: string
  tierFilter: string
  onFilterChange: (v: any) => void
  onTierChange: (v: any) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const isFiltered = filter !== 'all' || tierFilter !== 'all'
  const pillLabel = isFiltered
    ? [
        filter !== 'all' ? STATUS_OPTS.find(o => o.value === filter)?.label : null,
        tierFilter !== 'all' ? TIER_OPTS.find(o => o.value === tierFilter)?.label : null,
      ].filter(Boolean).join(' · ')
    : 'ALL'

  return (
    <div ref={ref} className="deal-mobile-filter sm:hidden" style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
          background: isFiltered ? 'rgba(14,165,160,0.15)' : 'transparent',
          border: `1px solid ${isFiltered ? 'rgba(14,165,160,0.5)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: 8,
          color: isFiltered ? '#2dd4bf' : 'var(--text-muted)',
          cursor: 'pointer', fontFamily: 'var(--font-body)',
        }}
      >
        {pillLabel}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 9999,
          background: '#1A1E25', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: 12, minWidth: 200,
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {/* Status */}
          <div>
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#4b5563', marginBottom: 6 }}>Status</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {STATUS_OPTS.map(opt => (
                <button key={opt.value} onClick={() => { onFilterChange(opt.value); if (opt.value === 'all' && tierFilter === 'all') setOpen(false) }}
                  style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, background: filter === opt.value ? 'rgba(14,165,160,0.2)' : 'transparent', border: `1px solid ${filter === opt.value ? 'rgba(14,165,160,0.6)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, color: filter === opt.value ? '#2dd4bf' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                >{opt.label}</button>
              ))}
            </div>
          </div>
          {/* Tier */}
          <div>
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#4b5563', marginBottom: 6 }}>Tier</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {TIER_OPTS.map(opt => (
                <button key={opt.value} onClick={() => { onTierChange(opt.value) }}
                  style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, background: tierFilter === opt.value ? 'rgba(96,165,250,0.15)' : 'transparent', border: `1px solid ${tierFilter === opt.value ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, color: tierFilter === opt.value ? '#60A5FA' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                >{opt.label}</button>
              ))}
            </div>
          </div>
          {/* Reset + Done */}
          <div style={{ display: 'flex', gap: 6, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={() => { onFilterChange('all'); onTierChange('all') }}
              style={{ flex: 1, padding: '6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
            >Reset</button>
            <button onClick={() => setOpen(false)}
              style={{ flex: 1, padding: '6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, background: 'rgba(14,165,160,0.12)', border: '1px solid rgba(14,165,160,0.4)', borderRadius: 8, color: '#2dd4bf', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
            >Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DealPipelinePanel() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<DealStatus | 'all'>('all')
  const [tierFilter, setTierFilter] = useState<DealTier | 'all'>('all')
  type SortField = 'address' | 'name' | 'type' | 'status' | 'tier' | 'rating' | 'created_at'
  const [sortBy, setSortBy] = useState<SortField | null>(null)  // null = default portfolio-first
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [expandedPortfolios, setExpandedPortfolios] = useState<Set<string>>(new Set())
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    fetchDeals()
  }, [filter, tierFilter])

  async function fetchDeals() {
    try {
      let query = supabase.from('deals').select('*')
      if (filter !== 'all') query = query.eq('status', filter)
      if (tierFilter !== 'all') query = query.eq('tier', tierFilter)
      // Always fetch all, sort client-side for portfolio-first logic
      const { data } = await query.limit(200)
      if (data) setDeals(data as Deal[])
    } catch {
      setDeals(PLACEHOLDER_DEALS)
    } finally {
      setLoading(false)
    }
  }

  // Sort handler — toggle asc/desc when same column, reset dir when changing
  // For rating: default → desc (most stars) → asc (fewest) → default (null)
  function handleSort(field: SortField) {
    if (sortBy === field) {
      if (field === 'rating') {
        // cycle: desc → asc → null
        if (sortDir === 'desc') setSortDir('asc')
        else { setSortBy(null); setSortDir('asc') }
      } else {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc')
      }
    } else {
      setSortBy(field)
      setSortDir(field === 'rating' ? 'desc' : 'asc')  // rating starts desc (most stars first)
    }
  }

  // Sort deals: default = portfolio first (alphabetical), then single addresses alphabetical
  // User sort overrides default
  function sortedDeals(list: Deal[]): Deal[] {
    const topLevel = list.filter(d => !d.parent_deal_id)
    if (sortBy === null) {
      // Default: portfolios first (alphabetical by name), then singles alphabetical by address
      const portfolios = topLevel.filter(d => d.address?.startsWith('📁')).sort((a,b) => (a.address||'').localeCompare(b.address||''))
      const singles = topLevel.filter(d => !d.address?.startsWith('📁')).sort((a,b) => (a.address||a.name||'').localeCompare(b.address||b.name||''))
      return [...portfolios, ...singles]
    }
    return [...topLevel].sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''
      if (sortBy === 'rating') { aVal = (a as any).rating ?? 0; bVal = (b as any).rating ?? 0 }
      else if (sortBy === 'address') { aVal = a.address || a.name || ''; bVal = b.address || b.name || '' }
      else if (sortBy === 'name') { aVal = a.name || ''; bVal = b.name || '' }
      else if (sortBy === 'type') { aVal = a.type || ''; bVal = b.type || '' }
      else if (sortBy === 'status') { aVal = a.status || ''; bVal = b.status || '' }
      else if (sortBy === 'tier') { aVal = a.tier || ''; bVal = b.tier || '' }
      else if (sortBy === 'created_at') { aVal = a.created_at || ''; bVal = b.created_at || '' }
      if (typeof aVal === 'number') return sortDir === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal
      return sortDir === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal)
    })
  }

  const filteredCount = deals.length
  const totalComm = deals.reduce((s, d) => s + (d.commission_estimated || 0), 0)

  return (
    <div className="wr-card">
      {/* Force-hide on mobile regardless of scroll container context */}
      <style>{`
        @media (max-width: 639px) {
          .deal-rating-col { display: none !important; }
          .deal-desktop-filters { display: none !important; }
        }
        @media (min-width: 640px) {
          .deal-mobile-filter { display: none !important; }
        }
      `}</style>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        {/* Top row: +Deal left | ShirleyCRE center | filters right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 0 }}>

          {/* + Deal — compact, left */}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              padding: '7px 16px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(109,40,217,0.42) 100%)',
              border: '1px solid rgba(167,139,250,0.5)',
              borderRadius: 8,
              color: '#c4b5fd',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              flexShrink: 0,
            }}
          >
            + Deal
          </button>

          {/* ShirleyCRE — bold section header, centered */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <span style={{
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#E8B84B',
              fontFamily: 'var(--font-display, var(--font-body))',
              textShadow: '0 0 28px rgba(232,184,75,0.5), 0 2px 0 rgba(0,0,0,0.4)',
              userSelect: 'none',
              lineHeight: 1,
            }}>
              SHIRLEYCRE
            </span>
          </div>

          {/* ── Desktop filters (sm+): full pills ── */}
          <div className="deal-desktop-filters hidden sm:flex" style={{ gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'hot', label: 'Hot' },
                { value: 'under_contract', label: 'UC' },
                { value: 'pipeline', label: 'Pipe' },
              ].map(opt => (
                <button key={opt.value} onClick={() => setFilter(opt.value as DealStatus | 'all')}
                  style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, background: filter === opt.value ? 'rgba(14,165,160,0.2)' : 'transparent', border: `1px solid ${filter === opt.value ? 'rgba(14,165,160,0.6)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, color: filter === opt.value ? '#2dd4bf' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}
                >{opt.label}</button>
              ))}
            </div>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { value: 'all', label: 'All' },
                { value: 'filed', label: 'Filed' },
                { value: 'tracked', label: 'Tracked' },
              ].map(opt => (
                <button key={opt.value} onClick={() => setTierFilter(opt.value as DealTier | 'all')}
                  style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, background: tierFilter === opt.value ? 'rgba(96,165,250,0.15)' : 'transparent', border: `1px solid ${tierFilter === opt.value ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, color: tierFilter === opt.value ? '#60A5FA' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}
                >{opt.label}</button>
              ))}
            </div>
            <button onClick={() => { setSortBy(null); setSortDir('asc') }} title="Reset sort"
              style={{ padding: '3px 7px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}
            >↺</button>
          </div>

          {/* ── Mobile filters: single ALL pill → tap opens status + tier dropdowns ── */}
          <MobileFilterPill
            filter={filter}
            tierFilter={tierFilter}
            onFilterChange={setFilter}
            onTierChange={setTierFilter}
          />
        </div>
      </div>

      {/* Add deal form */}
      {showAddForm && <AddDealForm onAdd={(d) => { setDeals(prev => [d, ...prev]); setShowAddForm(false) }} />}

      {/* Table */}
      {loading ? (
        <SkeletonTable />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid rgba(139,92,246,0.35)',
                background: 'rgba(139,92,246,0.06)',
                boxShadow: 'inset 0 -1px 0 rgba(139,92,246,0.3)',
              }}>
                {([
                  { label: 'FILES', cls: 'hidden sm:table-cell', align: 'center', width: 58  },
                  { label: 'MORE',  cls: '',                      align: 'center', width: 38  },
                  { label: 'Address',     cls: '',                      align: 'center', width: undefined },
                  { label: 'ID / Client', cls: 'hidden sm:table-cell',  align: 'center', width: undefined },
                  { label: 'Type',        cls: 'hidden sm:table-cell',  align: 'center', width: undefined },
                  { label: 'Status',      cls: '',                      align: 'center', width: undefined },
                  { label: 'Tier',        cls: 'hidden sm:table-cell',  align: 'center', width: undefined },
                  { label: 'Priority',    cls: 'deal-rating-col hidden sm:table-cell',  align: 'center', width: undefined },
                  { label: 'Actions',     cls: 'hidden sm:table-cell',  align: 'center', width: undefined },
                ] as { label: string; cls: string; align: string; width: number | undefined }[]).map(h => (
                  <th key={h.label} className={h.cls} style={{
                    textAlign: h.align as React.CSSProperties['textAlign'],
                    width: h.width,
                    minWidth: h.width,
                    maxWidth: h.width,
                    padding: '8px 4px',
                    fontSize: 9,
                    fontWeight: 800,
                    color: 'rgba(167,139,250,0.8)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    whiteSpace: 'nowrap',
                    borderRight: h.label === 'FILES' ? '1px solid rgba(139,92,246,0.15)' : undefined,
                  }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    No deals match this filter. Add one above ↑
                  </td>
                </tr>
              ) : (
                sortedDeals(deals).map((deal, i, arr) => {
                  const isPortfolio = deal.address?.startsWith('📁')
                  const subDeals = deals.filter(d => d.parent_deal_id === deal.id).sort((a,b) => (a.address||'').localeCompare(b.address||''))
                  const isExpanded = expandedPortfolios.has(deal.id)
                  return (
                    <>
                      <DealRow
                        key={deal.id}
                        deal={deal}
                        isLast={i === arr.length - 1 && (!isExpanded || subDeals.length === 0)}
                        isPortfolio={isPortfolio}
                        isExpanded={isExpanded}
                        onToggleExpand={isPortfolio ? () => setExpandedPortfolios(prev => {
                          const next = new Set(prev)
                          next.has(deal.id) ? next.delete(deal.id) : next.add(deal.id)
                          return next
                        }) : undefined}
                        onUpdate={(updated) => setDeals(prev => prev.map(d => d.id === updated.id ? updated : d))}
                        onDelete={(id) => setDeals(prev => prev.filter(d => d.id !== id))}
                        onAddSubDeal={(subDeal) => setDeals(prev => [...prev, subDeal])}
                      />
                      {isPortfolio && isExpanded && subDeals.map((sub, si) => (
                        <DealRow
                          key={sub.id}
                          deal={sub}
                          isLast={si === subDeals.length - 1}
                          isSubDeal
                          onUpdate={(updated) => setDeals(prev => prev.map(d => d.id === updated.id ? updated : d))}
                          onDelete={(id) => setDeals(prev => prev.filter(d => d.id !== id))}
                        />
                      ))}
                      {isPortfolio && isExpanded && (
                        <AddSubDealRow
                          key={`add-sub-${deal.id}`}
                          parentId={deal.id}
                          onAdd={(sub) => setDeals(prev => [...prev, sub])}
                        />
                      )}
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Kill action helpers ─────────────────────────────────────────────────────
type KillAction = { status: 'expired' | 'dormant' | 'terminated'; label: string; folderPath: string }

const KILLABLE_STATUSES: DealStatus[] = ['active', 'hot', 'in_review', 'in_service', 'pipeline']

function getKillOptions(deal: Deal): KillAction[] {
  // Only show kill options for active/live statuses — not after revert or already killed
  if (!KILLABLE_STATUSES.includes(deal.status as DealStatus)) return []
  const options: KillAction[] = []
  if (deal.tier === 'filed' && (deal.type === 'active_listing' || deal.type === 'listing')) {
    options.push({ status: 'expired', label: 'Expire → X - Expired Listings', folderPath: 'X - Expired Listings' })
  }
  if (deal.tier === 'filed' && deal.type !== 'active_listing' && deal.type !== 'listing') {
    options.push({ status: 'dormant', label: 'Dormant → X - Dormant Projects', folderPath: 'X - Dormant Projects' })
  }
  if (deal.tier === 'filed' && deal.dropbox_link) {
    options.push({ status: 'terminated', label: 'Terminate → X - Terminated', folderPath: 'X - Terminated' })
  }
  return options
}

// ─── Editable Deal Row ───────────────────────────────────────────────────────
const DELETE_PIN_HASH = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e' // SHA-256 of "1887"

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function DealRow({ deal, isLast, onUpdate, onDelete, isPortfolio, isExpanded, onToggleExpand, isSubDeal, onAddSubDeal }: {
  deal: Deal; isLast: boolean; onUpdate: (d: Deal) => void; onDelete: (id: string) => void
  isPortfolio?: boolean; isExpanded?: boolean; onToggleExpand?: () => void; isSubDeal?: boolean; onAddSubDeal?: (d: Deal) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(deal)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletePin, setDeletePin] = useState('')
  const [deleteError, setDeleteError] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Kill action state
  const killOptions = getKillOptions(deal)
  const [confirmKill, setConfirmKill] = useState(false)
  const [selectedKill, setSelectedKill] = useState<KillAction | null>(null)
  const [killPin, setKillPin] = useState('')
  const [killError, setKillError] = useState(false)
  const [killing, setKilling] = useState(false)

  // Under Contract action state
  const [confirmUC, setConfirmUC] = useState(false)
  const [ucPin, setUcPin] = useState('')
  const [ucError, setUcError] = useState(false)
  const [ucLoading, setUcLoading] = useState(false)

  function openKillModal() {
    const options = getKillOptions(deal)
    setSelectedKill(options.length === 1 ? options[0] : null)
    setKillPin('')
    setKillError(false)
    setConfirmKill(true)
  }

  async function handleKill() {
    if (!selectedKill) return
    setKilling(true)
    setKillError(false)
    const hash = await sha256(killPin)
    if (hash !== DELETE_PIN_HASH) {
      setKillError(true)
      setKilling(false)
      return
    }
    try {
      await supabase.from('deals').update({ status: selectedKill.status }).eq('id', deal.id)
      await supabase.from('folder_queue').insert({
        deal_id: deal.id,
        action: 'move',
        folder_name: deal.address || deal.name,
        folder_path: selectedKill.folderPath,
        subfolder_template: null,
        status: 'pending',
      })
      onUpdate({ ...deal, status: selectedKill.status })
    } catch {}
    setKilling(false)
    setConfirmKill(false)
  }

  async function handleUC() {
    setUcLoading(true)
    setUcError(false)
    const hash = await sha256(ucPin)
    if (hash !== DELETE_PIN_HASH) {
      setUcError(true)
      setUcLoading(false)
      return
    }
    try {
      await supabase.from('deals').update({ status: 'under_contract' }).eq('id', deal.id)
      onUpdate({ ...deal, status: 'under_contract' })
    } catch {}
    setUcLoading(false)
    setConfirmUC(false)
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(false)
    const hash = await sha256(deletePin)
    if (hash !== DELETE_PIN_HASH) {
      setDeleteError(true)
      setDeleting(false)
      return
    }
    try {
      await supabase.from('deals').delete().eq('id', deal.id)
      onDelete(deal.id)
    } catch {}
    setDeleting(false)
    setConfirmDelete(false)
  }

  async function save() {
    setSaving(true)
    try {
      const parsedFields = draft.address ? parseAddress(draft.address) : {}
      await supabase.from('deals').update({
        name: draft.name,
        address: draft.address,
        type: draft.type,
        status: draft.status,
        tier: draft.tier,
        value: draft.value,
        commission_estimated: draft.commission_estimated,
        deal_source: draft.deal_source,
        dropbox_link: draft.dropbox_link,
        ...parsedFields,
      }).eq('id', deal.id)
      onUpdate(draft)
    } catch {}
    setSaving(false)
    setEditing(false)
  }

  const inp = (field: keyof Deal, placeholder?: string) => (
    <input
      value={(draft[field] as string) ?? ''}
      onChange={e => setDraft(prev => ({ ...prev, [field]: e.target.value }))}
      onKeyDown={e => { if (e.key === 'Enter') save() }}
      placeholder={placeholder}
      style={{ width: '100%', fontSize: 11, padding: '3px 6px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: 'var(--text-primary)', outline: 'none' }}
    />
  )

  const rowStyle: React.CSSProperties = {
    borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
    background: editing ? 'rgba(167,139,250,0.04)' : undefined,
    transition: 'background 0.1s',
  }

  if (editing) {
    return (
      <tr style={rowStyle}>
        {/* Col 1: Dropbox — hidden on mobile */}
        <td className="hidden sm:table-cell" style={{ padding: '6px 8px' }}>
          <input value={draft.dropbox_link ?? ''} onChange={e => setDraft(p => ({ ...p, dropbox_link: e.target.value || null }))} onKeyDown={e => { if (e.key === 'Enter') save() }} placeholder="Dropbox URL" style={{ width: 100, fontSize: 11, padding: '3px 6px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: 'var(--text-primary)', outline: 'none' }} />
        </td>
        <td style={{ padding: '6px 8px' }}>{/* MORE — no edit needed */}</td>
        <td style={{ padding: '6px 8px' }}>{inp('address', 'Address')}</td>
        {/* Col 4: ID/Client — hidden on mobile */}
        <td className="hidden sm:table-cell" style={{ padding: '6px 8px' }}>{inp('name', 'ID / Client')}</td>
        {/* Col 5: Type — hidden on mobile */}
        <td className="hidden sm:table-cell" style={{ padding: '6px 8px' }}>
          <select value={draft.type} onChange={e => setDraft(p => ({ ...p, type: e.target.value as Deal['type'] }))} style={{ fontSize: 11, padding: '3px 4px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: 'var(--text-primary)' }}>
            {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </td>
        <td style={{ padding: '6px 8px' }}>
          <select value={draft.status} onChange={e => setDraft(p => ({ ...p, status: e.target.value as Deal['status'] }))} style={{ fontSize: 11, padding: '3px 4px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: 'var(--text-primary)' }}>
            {(Object.entries(STATUS_LABELS) as [DealStatus, string][]).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </td>
        {/* Col 7: Tier — hidden on mobile */}
        <td className="hidden sm:table-cell" style={{ padding: '6px 8px' }}>
          <select value={draft.tier} onChange={e => setDraft(p => ({ ...p, tier: e.target.value as Deal['tier'] }))} style={{ fontSize: 11, padding: '3px 4px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: 'var(--text-primary)' }}>
            {['tracked','filed'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </td>
        <td className="deal-rating-col hidden sm:table-cell" style={{ padding: '6px 8px' }}>
          <StarRating dealId={deal.id} value={draft.rating ?? null} onSave={(v) => setDraft(p => ({ ...p, rating: v }))} />
        </td>
        {/* Col 9: Save/Cancel — hidden on mobile */}
        <td className="hidden sm:table-cell" style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
          <button onClick={save} disabled={saving} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 5, color: '#A78BFA', cursor: 'pointer', marginRight: 4 }}>
            {saving ? '…' : '✓ Save'}
          </button>
          <button onClick={() => { setDraft(deal); setEditing(false) }} style={{ padding: '4px 8px', fontSize: 11, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
        </td>
      </tr>
    )
  }

  return (
    <tr style={rowStyle}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      onMouseLeave={e => (e.currentTarget.style.background = editing ? 'rgba(167,139,250,0.04)' : '')}
    >
      {/* Col 1: Files — hidden on mobile */}
      <td className="hidden sm:table-cell" style={{ width: 58, minWidth: 58, maxWidth: 58, padding: '6px 4px', textAlign: 'center', borderRight: '1px solid rgba(139,92,246,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <DropboxCell dealId={deal.id} url={deal.dropbox_link} onSaved={(id, url) => onUpdate({ ...deal, dropbox_link: url })} />
        </div>
      </td>
      {/* Col 2: Deal page button — MORE */}
      <td style={{ width: 38, minWidth: 38, maxWidth: 38, padding: '6px 4px', textAlign: 'center' }}>
        <a
          href={`/warroom/deal?id=${deal.id}`}
          title="Open Deal Dashboard"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 6,
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.35)',
            color: '#A78BFA',
            textDecoration: 'none', fontSize: 14, lineHeight: 1,
            transition: 'all 0.15s',
          }}
        >↗</a>
      </td>
      {/* Col 3: Address */}
      <td style={{ padding: '10px 10px', fontWeight: 500, whiteSpace: 'nowrap', fontSize: 13, textAlign: 'left' }}>
        {isSubDeal && <span style={{ marginRight: 8, color: 'var(--text-dim)', fontSize: 11 }}>↳</span>}
        {isPortfolio && onToggleExpand ? (
          <button onClick={onToggleExpand} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent-gold)', fontWeight: 700 }}>
            <span style={{ fontSize: 13, transition: 'transform 0.15s', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            {(deal as any).addr_display || deal.address?.replace(/^📁\s*/, '')}
          </button>
        ) : deal.address?.startsWith('📁') ? (
          <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>{deal.address?.replace(/^📁\s*/, '')}</span>
        ) : (
          <span style={{ color: isSubDeal ? 'var(--text-muted)' : 'var(--text-primary)' }}>
            {(deal as any).addr_display || deal.address || '—'}
          </span>
        )}
      </td>
      {/* Col 4: ID/Client — hidden on mobile */}
      <td className="hidden sm:table-cell" style={{ padding: '10px 10px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'left' }}>{deal.name}</td>
      {/* Col 5: Type — hidden on mobile */}
      <td className="hidden sm:table-cell" style={{ padding: '10px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 13, textAlign: 'center' }}>{DEAL_TYPES.find(t => t.value === deal.type)?.label ?? deal.type.replace(/_/g, ' ')}</td>
      <td style={{ padding: '10px 10px', textAlign: 'center' }}>
        <span className={`badge ${STATUS_CLASS[deal.status as DealStatus]}`}>{STATUS_LABELS[deal.status as DealStatus]}</span>
      </td>
      {/* Col 7: Tier — hidden on mobile */}
      <td className="hidden sm:table-cell" style={{ padding: '10px 10px', textAlign: 'center' }}>
        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: deal.tier === 'filed' ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.05)', color: deal.tier === 'filed' ? '#60A5FA' : 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {deal.tier ? deal.tier.charAt(0).toUpperCase() + deal.tier.slice(1) : '—'}
        </span>
      </td>
      <td className="deal-rating-col hidden sm:table-cell" style={{ padding: '6px 10px', textAlign: 'center' }}>
        <StarRating dealId={deal.id} value={deal.rating ?? null} onSave={(v) => onUpdate({ ...deal, rating: v })} />
      </td>
      {/* Col 9: Actions — hidden on mobile */}
      <td className="hidden sm:table-cell" style={{ padding: '10px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>
        <button onClick={() => setEditing(true)} title="Edit row" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 5, background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12, marginRight: 4 }}>✎</button>
        {deal.status === 'active' && deal.tier === 'filed' && (
          <button onClick={() => { setConfirmUC(true); setUcPin(''); setUcError(false) }} title="Move to Under Contract" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 24, padding: '0 7px', borderRadius: 5, background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.4)', color: '#2DD4BF', cursor: 'pointer', fontSize: 10, fontWeight: 700, marginRight: 4, whiteSpace: 'nowrap', gap: 3 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            → UC
          </button>
        )}
        {killOptions.length > 0 && (
          <button onClick={openKillModal} title="End deal" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 5, background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.4)', color: '#FB923C', cursor: 'pointer', fontSize: 13, marginRight: 4 }}>☠</button>
        )}
        <button onClick={() => { setConfirmDelete(true); setDeletePin(''); setDeleteError(false) }} title="Delete deal" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 5, background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.5)', cursor: 'pointer', fontSize: 12 }}>✕</button>
      </td>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <td colSpan={9} style={{ padding: 0 }}>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setConfirmDelete(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#13112A', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 14, padding: 28, minWidth: 300, maxWidth: 380 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0', marginBottom: 6 }}>Delete Deal?</div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
                <strong style={{ color: '#ccc' }}>{deal.address || deal.name}</strong> will be permanently deleted. Enter your PIN to confirm.
              </div>
              <input
                autoFocus
                type="tel"
                inputMode="numeric"
                maxLength={4}
                value={deletePin}
                onChange={e => { const v = e.target.value.replace(/\D/g,'').slice(0,4); setDeletePin(v); setDeleteError(false); if (v.length === 4) handleDelete() }}
                onKeyDown={e => e.key === 'Enter' && deletePin.length === 4 && handleDelete()}
                placeholder="Enter PIN"
                style={{ width: '100%', fontSize: 20, textAlign: 'center', letterSpacing: '0.3em', padding: '10px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${deleteError ? '#ef4444' : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, color: '#f0f0f0', outline: 'none', marginBottom: 6, boxSizing: 'border-box' as const }}
              />
              {deleteError && <div style={{ color: '#ef4444', fontSize: 11, marginBottom: 10, textAlign: 'center' }}>Incorrect PIN</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, color: '#888', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button onClick={handleDelete} disabled={deletePin.length !== 4 || deleting} style={{ flex: 1, padding: '8px', background: deletePin.length === 4 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${deletePin.length === 4 ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 7, color: deletePin.length === 4 ? '#ef4444' : '#555', cursor: deletePin.length === 4 ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </td>
      )}

      {/* Under Contract confirmation modal */}
      {confirmUC && (
        <td colSpan={9} style={{ padding: 0 }}>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setConfirmUC(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#13112A', border: '1px solid rgba(20,184,166,0.4)', borderRadius: 14, padding: 28, minWidth: 320, maxWidth: 400 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#2DD4BF', marginBottom: 12 }}>Move to Under Contract?</div>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16, lineHeight: 1.6 }}>
                <div><span style={{ color: '#ccc', fontWeight: 600 }}>{deal.address || '—'}</span></div>
                <div style={{ color: '#888' }}>{deal.name} · {DEAL_TYPES.find(t => t.value === deal.type)?.label ?? deal.type}</div>
              </div>
              <div style={{ fontSize: 12, color: '#2DD4BF', marginBottom: 16, padding: '8px 12px', background: 'rgba(20,184,166,0.08)', borderRadius: 6, border: '1px solid rgba(20,184,166,0.2)' }}>
                This will move the deal to Under Contract status and add it to the UC tracking panel.
              </div>
              <input
                autoFocus
                type="tel"
                inputMode="numeric"
                maxLength={4}
                value={ucPin}
                onChange={e => { const v = e.target.value.replace(/\D/g,'').slice(0,4); setUcPin(v); setUcError(false); if (v.length === 4) handleUC() }}
                onKeyDown={e => e.key === 'Enter' && ucPin.length === 4 && handleUC()}
                placeholder="Enter PIN"
                style={{ width: '100%', fontSize: 20, textAlign: 'center', letterSpacing: '0.3em', padding: '10px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${ucError ? '#2DD4BF' : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, color: '#f0f0f0', outline: 'none', marginBottom: 6, boxSizing: 'border-box' as const }}
              />
              {ucError && <div style={{ color: '#2DD4BF', fontSize: 11, marginBottom: 10, textAlign: 'center' }}>Incorrect PIN</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => setConfirmUC(false)} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, color: '#888', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button
                  onClick={handleUC}
                  disabled={ucPin.length !== 4 || ucLoading}
                  style={{
                    flex: 1, padding: '8px',
                    background: ucPin.length === 4 ? 'rgba(20,184,166,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${ucPin.length === 4 ? 'rgba(20,184,166,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 7,
                    color: ucPin.length === 4 ? '#2DD4BF' : '#555',
                    cursor: ucPin.length === 4 ? 'pointer' : 'not-allowed',
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  {ucLoading ? 'Moving…' : 'Move to Under Contract'}
                </button>
              </div>
            </div>
          </div>
        </td>
      )}

      {/* Kill confirmation modal */}
      {confirmKill && (
        <td colSpan={9} style={{ padding: 0 }}>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setConfirmKill(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#13112A', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 14, padding: 28, minWidth: 320, maxWidth: 400 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#F59E0B', marginBottom: 12 }}>End Deal?</div>
              {/* Deal summary */}
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16, lineHeight: 1.6 }}>
                <div><span style={{ color: '#ccc', fontWeight: 600 }}>{deal.address || '—'}</span></div>
                <div style={{ color: '#888' }}>{deal.name} · {DEAL_TYPES.find(t => t.value === deal.type)?.label ?? deal.type} · <span style={{ textTransform: 'capitalize' }}>{deal.tier ? deal.tier.charAt(0).toUpperCase() + deal.tier.slice(1) : '—'}</span></div>
              </div>
              {/* Kill type selector — only show if multiple options */}
              {killOptions.length > 1 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Action</div>
                  {killOptions.map(opt => (
                    <label key={opt.status} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 13, color: selectedKill?.status === opt.status ? '#F59E0B' : '#aaa' }}>
                      <input
                        type="radio"
                        name="killAction"
                        checked={selectedKill?.status === opt.status}
                        onChange={() => setSelectedKill(opt)}
                        style={{ accentColor: '#F59E0B' }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}
              {killOptions.length === 1 && (
                <div style={{ fontSize: 12, color: '#F59E0B', marginBottom: 16, padding: '8px 12px', background: 'rgba(245,158,11,0.08)', borderRadius: 6, border: '1px solid rgba(245,158,11,0.2)' }}>
                  {killOptions[0].label}
                </div>
              )}
              <input
                autoFocus
                type="tel"
                inputMode="numeric"
                maxLength={4}
                value={killPin}
                onChange={e => { const v = e.target.value.replace(/\D/g,'').slice(0,4); setKillPin(v); setKillError(false); if (v.length === 4 && selectedKill) handleKill() }}
                onKeyDown={e => e.key === 'Enter' && killPin.length === 4 && selectedKill && handleKill()}
                placeholder="Enter PIN"
                style={{ width: '100%', fontSize: 20, textAlign: 'center', letterSpacing: '0.3em', padding: '10px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${killError ? '#F59E0B' : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, color: '#f0f0f0', outline: 'none', marginBottom: 6, boxSizing: 'border-box' as const }}
              />
              {killError && <div style={{ color: '#F59E0B', fontSize: 11, marginBottom: 10, textAlign: 'center' }}>Incorrect PIN</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => setConfirmKill(false)} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, color: '#888', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button
                  onClick={handleKill}
                  disabled={killPin.length !== 4 || !selectedKill || killing}
                  style={{
                    flex: 1, padding: '8px',
                    background: (killPin.length === 4 && selectedKill) ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${(killPin.length === 4 && selectedKill) ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 7,
                    color: (killPin.length === 4 && selectedKill) ? '#F59E0B' : '#555',
                    cursor: (killPin.length === 4 && selectedKill) ? 'pointer' : 'not-allowed',
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  {killing ? 'Processing…' : 'End Deal'}
                </button>
              </div>
            </div>
          </div>
        </td>
      )}
    </tr>
  )
}

// ─── Google Maps loader ──────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google: any
    _gmapsLoaded: boolean
    _gmapsCallbacks: (() => void)[]
  }
}

function loadGooglePlaces(cb: () => void) {
  if (typeof window === 'undefined') return
  if (window.google?.maps?.places) { cb(); return }
  if (!window._gmapsCallbacks) window._gmapsCallbacks = []
  window._gmapsCallbacks.push(cb)
  if (window._gmapsLoaded) return
  window._gmapsLoaded = true
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) return
  const s = document.createElement('script')
  s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
  s.async = true
  s.defer = true
  s.onerror = () => { window._gmapsLoaded = false }
  s.onload = () => {
    const cbs = window._gmapsCallbacks || []
    window._gmapsCallbacks = []
    cbs.forEach(fn => fn())
  }
  document.head.appendChild(s)
}

// Quick add form — Google Places autocomplete with plain-text fallback
function AddDealForm({ onAdd }: { onAdd: (d: Deal) => void }) {
  const [form, setForm] = useState({ name: '', address: '', type: 'potential_listing', status: 'pipeline', tier: 'tracked', deal_source: '', isPortfolio: false })
  const [saving, setSaving] = useState(false)
  const [autocompleteReady, setAutocompleteReady] = useState(false)
  const addressInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)

  const attachAutocomplete = useCallback(() => {
    if (!addressInputRef.current || form.isPortfolio || autocompleteRef.current) return
    try {
      const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
      })
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        if (place?.formatted_address) {
          setForm(prev => ({ ...prev, address: place.formatted_address }))
        }
      })
      autocompleteRef.current = ac
      setAutocompleteReady(true)
    } catch {}
  }, [form.isPortfolio])

  useEffect(() => {
    if (form.isPortfolio) return
    loadGooglePlaces(attachAutocomplete)
    return () => { autocompleteRef.current = null }
  }, [form.isPortfolio, attachAutocomplete])

  async function submit() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const rawAddr = form.isPortfolio ? `📁 ${form.name.trim()}` : (form.address.trim() || null)
      const parsed = rawAddr ? parseAddress(rawAddr) : {}
      const { data } = await supabase.from('deals').insert({
        name: form.name.trim(),
        address: rawAddr,
        type: form.type,
        status: form.status,
        tier: form.tier,
        deal_source: form.deal_source || null,
        dropbox_link: null,
        ...parsed,
      }).select().single()
      if (data) {
        onAdd(data as Deal)
        setForm({ name: '', address: '', type: 'potential_listing', status: 'pipeline', tier: 'tracked', deal_source: '', isPortfolio: false })
        autocompleteRef.current = null
        setAutocompleteReady(false)
      }
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const labelStyle: React.CSSProperties = { fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, textAlign: 'center' }

  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(201,147,58,0.2)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
        {/* Address */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 200px' }}>
          <label style={labelStyle}>Address</label>
          {form.isPortfolio ? (
            <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-gold)', fontWeight: 700, fontSize: 12 }}>
              📁 {form.name.trim() || 'Portfolio — fill in ID / Client →'}
            </div>
          ) : (
            <input
              ref={addressInputRef}
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              placeholder="Start typing an address…"
              style={{ ...inputStyle }}
              autoComplete="off"
            />
          )}
        </div>
        {/* ID / Client */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 160px' }}>
          <label style={labelStyle}>ID / Client</label>
          <input placeholder="ID / Client *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} onKeyDown={e => e.key === 'Enter' && submit()} style={{...inputStyle}} />
        </div>
        {/* Portfolio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 72, flexShrink: 0 }}>
          <label style={labelStyle}>Portfolio</label>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32 }}>
            <input type="checkbox" checked={form.isPortfolio} onChange={e => setForm({...form, isPortfolio: e.target.checked, address: ''})}
              style={{ width: 14, height: 14, accentColor: 'var(--accent-gold)', cursor: 'pointer' }} />
          </div>
        </div>
        {/* Type */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 148, flexShrink: 0 }}>
          <label style={labelStyle}>Type</label>
          <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} style={{...selectStyle, width: '100%'}}>
            {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {/* Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 96, flexShrink: 0 }}>
          <label style={labelStyle}>Status</label>
          <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} style={{...selectStyle, width: '100%'}}>
            {PRIMARY_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        {/* Tier */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 72, flexShrink: 0 }}>
          <label style={labelStyle}>Tier</label>
          <select value={form.tier} onChange={e => setForm({...form, tier: e.target.value})} style={{...selectStyle, width: '100%'}}>
            <option value="tracked">Tracked</option>
            <option value="filed">Filed</option>
          </select>
        </div>
        {/* Source */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 140px' }}>
          <label style={labelStyle}>Source</label>
          <input placeholder="Referral, cold call..." value={form.deal_source} onChange={e => setForm({...form, deal_source: e.target.value})} style={{...inputStyle}} />
        </div>
        {/* Create button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
          <label style={{ ...labelStyle, visibility: 'hidden' }}>Create</label>
          <button onClick={submit} disabled={saving || !form.name.trim()} style={{ padding: '7px 16px', background: 'var(--accent-gold)', color: '#0D0F14', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (!form.name.trim() || saving) ? 0.5 : 1 }}>
            {saving ? 'Saving...' : 'Create Deal'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ─── Add Sub-Deal Row (inside portfolio) ─────────────────────────────────────
function AddSubDealRow({ parentId, onAdd }: { parentId: string; onAdd: (d: Deal) => void }) {
  const [open, setOpen] = useState(false)
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('active_listing')
  const [status, setStatus] = useState<DealStatus>('pipeline')
  const [tier, setTier] = useState('tracked')
  const [saving, setSaving] = useState(false)

  const subInputStyle: React.CSSProperties = { fontSize: 12, padding: '4px 8px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 5, color: 'var(--text-primary)', outline: 'none' }

  async function save() {
    if (!address.trim()) return
    setSaving(true)
    try {
      const { data } = await supabase.from('deals').insert({
        name: name.trim() || address.trim(),
        address: address.trim(),
        type,
        status,
        tier,
        parent_deal_id: parentId,
      }).select().single()
      if (data) { onAdd(data as Deal); setAddress(''); setName(''); setType('active_listing'); setStatus('pipeline'); setTier('tracked'); setOpen(false) }
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  return (
    <tr style={{ background: 'rgba(232,184,75,0.03)', borderBottom: '1px solid var(--border-subtle)' }}>
      <td colSpan={9} style={{ padding: '6px 20px' }}>
        {open ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 11, flexShrink: 0 }}>↳</span>
            <input autoFocus value={address} onChange={e => setAddress(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="Address *" style={{ ...subInputStyle, width: 200 }} />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="ID / Client (optional)" style={{ ...subInputStyle, width: 160 }} />
            <select value={type} onChange={e => setType(e.target.value)} style={{ ...subInputStyle, cursor: 'pointer' }}>
              {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={status} onChange={e => setStatus(e.target.value as DealStatus)} style={{ ...subInputStyle, cursor: 'pointer' }}>
              {PRIMARY_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <select value={tier} onChange={e => setTier(e.target.value)} style={{ ...subInputStyle, cursor: 'pointer' }}>
              <option value="tracked">Tracked</option>
              <option value="filed">Filed</option>
            </select>
            <button onClick={save} disabled={saving || !address.trim()} style={{ padding: '4px 12px', background: 'rgba(232,184,75,0.2)', border: '1px solid rgba(232,184,75,0.4)', borderRadius: 5, color: '#E8B84B', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{saving ? '…' : '+ Add'}</button>
            <button onClick={() => setOpen(false)} style={{ padding: '4px 8px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-gold)', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, opacity: 0.7 }}>
            <span>↳</span> + Add property to portfolio
          </button>
        )}
      </td>
    </tr>
  )
}

function SkeletonTable() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
    </div>
  )
}

const PLACEHOLDER_DEALS: Deal[] = [
  {
    id: 'p1', name: 'Edinburgh Ave. N. 1873', address: 'Edinburgh Ave. N. 1873, Baton Rouge',
    type: 'active_listing', status: 'under_contract', tier: 'filed',
    value: 1200000, commission_rate: 0.06, commission_estimated: 72000, commission_collected: 0,
    deal_source: 'Referral', notes: null, dropbox_link: null, parent_deal_id: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'p2', name: 'French Truck Coffee — BR', address: null,
    type: 'tenant', status: 'active', tier: 'tracked',
    value: 800000, commission_rate: 0.04, commission_estimated: 32000, commission_collected: 0,
    deal_source: 'Cold Call', notes: null, dropbox_link: null, parent_deal_id: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
]

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 5,
  padding: '5px 8px',
  fontSize: 12,
  color: 'var(--text-primary)',
  outline: 'none',
  cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 5,
  padding: '6px 10px',
  fontSize: 12,
  color: 'var(--text-primary)',
  outline: 'none',
}

function PipeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 12h18M3 6h18M3 18h12"/>
    </svg>
  )
}


// ─── Star Rating ─────────────────────────────────────────────────────────────
function StarRating({ dealId, value, onSave }: { dealId: string; value: number | null; onSave: (v: number | null) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  async function setRating(v: number) {
    setSaving(true)
    const newVal = value === v ? null : v  // click same star = clear rating
    try {
      await supabase.from('deals').update({ rating: newVal, updated_at: new Date().toISOString() } as any).eq('id', dealId)
      onSave(newVal)
    } catch {}
    setSaving(false)
  }

  const display = hover ?? value ?? 0
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center', opacity: saving ? 0.5 : 1 }}>
      {[1,2,3,4,5].map(i => (
        <span
          key={i}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          onClick={() => setRating(i)}
          style={{
            fontSize: 16,
            cursor: 'pointer',
            color: i <= display ? '#E8B84B' : 'rgba(255,255,255,0.15)',
            lineHeight: 1,
            transition: 'color 0.1s',
            userSelect: 'none',
          }}
        >★</span>
      ))}
    </div>
  )
}

const DROPBOX_FALLBACK = 'https://www.dropbox.com/scl/fo/r9dq6fwfmp81tv1ec02gb/ANqIOI6hM94j-v4jv9czcpo?rlkey=0bd4kas03bfl3vakbcln602tp&st=dc2a5sqy&dl=0'

function DropboxCell({ dealId, url, onSaved }: { dealId: string; url: string | null | undefined; onSaved: (id: string, url: string | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(url || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const val = draft.trim() || null
    try {
      await supabase.from('deals').update({ dropbox_link: val }).eq('id', dealId)
      onSaved(dealId, val)
    } catch {}
    setSaving(false)
    setEditing(false)
  }

  const modal = editing && typeof document !== 'undefined' ? createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { e.stopPropagation(); setEditing(false) }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#1A1E25', border: '1px solid rgba(79,142,247,0.4)', borderRadius: 12, padding: '20px 24px', width: '90%', maxWidth: 480, boxShadow: '0 16px 48px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(79,142,247,0.6)', fontFamily: 'monospace' }}>
          Dropbox Folder Link
        </div>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          placeholder="https://www.dropbox.com/sh/..."
          style={{ width: '100%', fontSize: 13, padding: '9px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(79,142,247,0.35)', borderRadius: 7, color: '#F0F2FF', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setEditing(false)} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#6b7280', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: '8px', background: 'rgba(79,142,247,0.15)', border: '1px solid rgba(79,142,247,0.4)', borderRadius: 7, color: '#4F8EF7', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : 'Save Link'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
      {modal}

      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open deal folder"
          onClick={e => e.stopPropagation()}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 6,
            background: 'rgba(0,97,255,0.12)',
            border: '1px solid rgba(0,97,255,0.3)',
            color: '#4F8EF7',
            textDecoration: 'none', transition: 'all 0.15s',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L6 6.5L12 11L18 6.5L12 2ZM6 6.5L0 11L6 15.5L12 11L6 6.5ZM18 6.5L12 11L18 15.5L24 11L18 6.5ZM6 15.5L12 20L18 15.5L12 11L6 15.5Z"/>
          </svg>
        </a>
      ) : (
        <div
          title="No folder link — click ✎ to add"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 6,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.15)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L6 6.5L12 11L18 6.5L12 2ZM6 6.5L0 11L6 15.5L12 11L6 6.5ZM18 6.5L12 11L18 15.5L24 11L18 6.5ZM6 15.5L12 20L18 15.5L12 11L6 15.5Z"/>
          </svg>
        </div>
      )}
      <button
        onClick={() => { setDraft(url || ''); setEditing(true) }}
        title="Edit Dropbox link"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 5,
          background: 'transparent', border: '1px solid rgba(255,255,255,0.07)',
          color: 'var(--text-dim)', cursor: 'pointer', fontSize: 10, transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text-dim)' }}
      >
        ✎
      </button>
    </div>
  )
}


'use client'

// Phone DEAL PIPELINE. Stage model matches the desktop deals list:
// All, Pipeline, Review, Active, HOT, Under Contract, Closed,
// then In Service and Archived on their own. TYPE stays.
// Archived is an activity_log record on a closed deal (see lib/dealArchive).
// No deal row is deleted or rewritten by this sheet.

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomSheet from '@/components/warroom3/BottomSheet'
import { formatDealTitle } from '@/lib/formatAddress'
import { HOUSE_SPLIT, calcCommission, calcLeaseValue, fmtMoney } from '@/lib/dealMath'
import { LACDB_ACTIVE } from '@/lib/lacdbCatalog'
import { lacdbFlagFor } from '@/lib/lacdbFlag'
import { asArchiveKind, type ArchiveKind } from '@/lib/dealArchive'

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

const PROPERTY_TYPES = ['INDUSTRIAL', 'LAND', 'MULTI', 'OFFICE', 'RETAIL'] as const
type PropertyType = typeof PROPERTY_TYPES[number]

type StageKey = 'all' | 'pipeline' | 'review' | 'active' | 'hot' | 'under_contract' | 'closed' | 'in_service' | 'archived'
type SortKey = 'name' | 'deadline' | 'value' | 'comm' | 'rank'

type EngageKey = 'listings' | 'tenants' | 'buyers' | 'targets'

const ENGAGE_TABS: { key: EngageKey; label: string }[] = [
  { key: 'buyers', label: 'Buyers' },
  { key: 'listings', label: 'Listings' },
  { key: 'targets', label: 'Targets' },
  { key: 'tenants', label: 'Tenants' },
]

const STAGE_TABS: { key: StageKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'archived', label: 'Archived' },
  { key: 'closed', label: 'Closed' },
  { key: 'hot', label: 'HOT' },
  { key: 'in_service', label: 'In Service' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'review', label: 'Review' },
  { key: 'under_contract', label: 'Under Contract' },
]

const TAB_GRAY = '#8E8CA0'
const COUNT_MUTED = '#6F6D80'
const HEADER_FACE: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  letterSpacing: 0,
  textTransform: 'none',
  lineHeight: 1,
}
const SHEET_EDGE = 16

interface RawDeal {
  id: string
  status: string | null
  name: string | null
  address: string | null
  addr_display: string | null
  addr_street_name: string | null
  addr_street_type: string | null
  addr_direction: string | null
  addr_number: string | null
  addr_city: string | null
  type: string | null
  property_type: string | null
  rating: number | null
  lacdb_url: string | null
  deal_source: string | null
  photo_url: string | null
  portfolio_id: string | null
}

interface Econ {
  deal_id: string
  transaction_type: string | null
  asking_price?: number | null
  sale_commission_pct?: number | null
  sqft?: number | null
  lease_rate_psf?: number | null
  lease_term_years?: number | null
  lease_commission_pct?: number | null
  offer_price?: number | null
}

interface DeadlineRow {
  deal_id: string
  deadline_date: string
  deadline_type: string | null
  label: string | null
}

interface Portfolio {
  id: string
  name: string
}

interface EnrichedDeal extends RawDeal {
  title: string
  deadlineDays: number | null
  deadlineDate: string | null
  deadlineLabel: string
  value: number | null
  commission: number | null
  archiveKind: ArchiveKind | null
}

function todayCST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function daysBetween(today: string, dateStr: string): number {
  const [ty, tm, td] = today.split('-').map(Number)
  const [y, m, d] = dateStr.split('-').map(Number)
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(ty, tm - 1, td).getTime()) / 86400000)
}

function fmtDeadlineWhen(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const mon = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return `${mon} ${d}`
}

function stageOf(status: string | null): StageKey | 'other' {
  switch ((status ?? '').toLowerCase()) {
    case 'pipeline': return 'pipeline'
    case 'review':
    case 'in_review': return 'review'
    case 'active':
    case 'active_listing': return 'active'
    case 'hot': return 'hot'
    case 'under_contract': return 'under_contract'
    case 'closed': return 'closed'
    case 'in_service': return 'in_service'
    default: return 'other'
  }
}

function bucketOf(deal: { status: string | null; archiveKind: ArchiveKind | null }): StageKey | 'other' {
  if ((deal.status ?? '').toLowerCase() === 'closed' && deal.archiveKind) return 'archived'
  return stageOf(deal.status)
}

function stageLabel(status: string | null, archiveKind: ArchiveKind | null): string {
  if ((status ?? '').toLowerCase() === 'closed' && archiveKind) return 'ARCHIVED'
  switch (stageOf(status)) {
    case 'pipeline': return 'PIPELINE'
    case 'review': return 'REVIEW'
    case 'active': return 'ACTIVE'
    case 'hot': return 'HOT'
    case 'under_contract': return 'UNDER CONTRACT'
    case 'closed': return 'CLOSED'
    case 'in_service': return 'IN SERVICE'
    default: {
      if (!status) return ''
      if (status.toLowerCase() === 'pending_payment') return 'PENDING'
      return status.replace(/_/g, ' ').toUpperCase()
    }
  }
}

function stageTone(status: string | null, archiveKind: ArchiveKind | null): { color: string; background: string; border: string } {
  if ((status ?? '').toLowerCase() === 'closed' && archiveKind) {
    return { color: '#94A3B8', background: 'transparent', border: '1px solid rgba(148,163,184,0.45)' }
  }
  switch (stageOf(status)) {
    case 'pipeline':
      return { color: '#93C5FD', background: 'transparent', border: '1px solid rgba(147,197,253,0.72)' }
    case 'review':
      return { color: '#FBBF24', background: 'transparent', border: '1px solid rgba(251,191,36,0.78)' }
    case 'active':
      return { color: '#C4B5FD', background: 'transparent', border: '1px solid rgba(196,181,253,0.85)' }
    case 'hot':
      return { color: '#0A0A0F', background: T.hot, border: '1px solid transparent' }
    case 'under_contract':
      return { color: '#5EEAD4', background: 'transparent', border: '1px solid rgba(94,234,212,0.8)' }
    case 'closed':
      return { color: T.textLow, background: 'transparent', border: '1px solid rgba(255,255,255,0.18)' }
    case 'in_service':
      return { color: '#6F6D80', background: 'transparent', border: '1px solid rgba(255,255,255,0.14)' }
    default:
      return { color: T.textMid, background: 'transparent', border: '1px solid rgba(255,255,255,0.20)' }
  }
}

function stageAccent(key: StageKey): string {
  switch (key) {
    case 'pipeline': return '#93C5FD'
    case 'review': return '#FBBF24'
    case 'active': return '#C4B5FD'
    case 'hot': return T.hot
    case 'under_contract': return '#5EEAD4'
    case 'closed': return '#D9D7E2'
    case 'in_service': return '#A78BFA'
    case 'archived': return '#CBD5E1'
    default: return '#EFEEF4'
  }
}

function matchesEngage(deal: { type: string | null }, engage: EngageKey): boolean {
  const type = deal.type?.toLowerCase()
  if (engage === 'tenants') return type === 'tenant_rep'
  if (engage === 'buyers') return type === 'buyer'
  if (engage === 'targets') return type === 'potential_listing' || type === 'target'
  return true
}

function typeTitle(value: string): string {
  if (value === 'INDUSTRIAL') return 'Industrial'
  if (value === 'MULTIFAMILY' || value === 'MULTI') return 'Multifamily'
  const lower = value.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function shortDeadlineLabel(type: string | null, label: string | null): string {
  const kind = (type ?? '').toLowerCase()
  if (kind === 'closing') return 'CLOSING'
  if (kind === 'inspection') return 'INSPECTION'
  if (kind === 'due_diligence' || kind === 'diligence') return 'DILIGENCE'
  const raw = (label ?? '').replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim()
  const low = raw.toLowerCase()
  if (!raw) return kind && kind !== 'custom' ? kind.replace(/_/g, ' ').toUpperCase() : ''
  if (low.includes('clos')) return 'CLOSING'
  if (low.includes('counter')) return 'COUNTER'
  if (low.includes('feasib')) return 'FEASIBILITY'
  if (low.includes('inspect')) return 'INSPECTION'
  if (low.includes('lease')) return 'LEASE'
  const words = raw.split(' ').slice(0, 2).join(' ')
  return (words.length > 16 ? words.slice(0, 14).trim() : words).toUpperCase()
}

function deadlineInk(days: number | null): string {
  if (days == null) return T.textLow
  if (days < 0) return T.late
  if (days <= 14) return T.hot
  return T.textLow
}

function figuresFor(deal: RawDeal, econ: Econ | null): { value: number | null; commission: number | null } {
  if (!econ) return { value: null, commission: null }
  if ((deal.type ?? '').toLowerCase() === 'buyer') {
    const value = econ.offer_price ?? null
    const pct = econ.sale_commission_pct
    const commission = value != null && pct != null
      ? Math.round(value * (pct / 100) * HOUSE_SPLIT)
      : null
    return { value, commission }
  }
  if ((econ.transaction_type === 'sale' || econ.transaction_type === 'both') && econ.asking_price != null) {
    return { value: econ.asking_price, commission: calcCommission(econ) }
  }
  if (econ.transaction_type === 'lease') {
    return {
      value: calcLeaseValue(econ.sqft ?? null, econ.lease_rate_psf ?? null, econ.lease_term_years ?? null),
      commission: calcCommission(econ),
    }
  }
  return { value: null, commission: null }
}

function cmpNullLast(av: number | null, bv: number | null, dir: 'asc' | 'desc'): number {
  if (av == null && bv == null) return 0
  if (av == null) return 1
  if (bv == null) return -1
  return dir === 'asc' ? av - bv : bv - av
}

interface DealsSheetProps {
  open: boolean
  onClose: () => void
  initialSearch?: string
  onOpenPortfolioCreate?: () => void
  onOpenNewDeal?: () => void
}

export function DealsSheet({ open, onClose }: DealsSheetProps) {
  const [deals, setDeals] = useState<EnrichedDeal[]>([])
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [engage, setEngage] = useState<EngageKey>('listings')
  const [stage, setStage] = useState<StageKey>('all')
  const [typeFilter, setTypeFilter] = useState<PropertyType | null>(null)
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const router = useRouter()

  const togglePortfolio = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  useEffect(() => {
    if (!open) return
    setEngage('listings')
    setStage('all')
    setTypeFilter(null)
    setTypeMenuOpen(false)
    setSortKey('name')
    setSortDir('asc')
    setExpanded(new Set())
    setLoading(true)
    setLoadError(false)
    ;(async () => {
      try {
        const [dealsRes, portfoliosRes, econRes, deadlinesRes, archiveRes] = await Promise.all([
          supabase
            .from('deals')
            .select('id, status, name, address, addr_display, addr_street_name, addr_street_type, addr_direction, addr_number, addr_city, type, property_type, rating, lacdb_url, deal_source, photo_url, portfolio_id')
            .limit(300),
          supabase.from('portfolio').select('id, name').limit(50),
          supabase.from('deal_economics').select(
            'deal_id, transaction_type, asking_price, sale_commission_pct, sqft, lease_rate_psf, lease_term_years, lease_commission_pct, offer_price'
          ),
          supabase.from('contract_deadlines')
            .select('deal_id, deadline_date, deadline_type, label')
            .in('status', ['pending', 'extended'])
            .order('deadline_date'),
          supabase.from('activity_log')
            .select('deal_id, description, created_at')
            .eq('action_type', 'archived'),
        ])
        if (dealsRes.error) { setLoadError(true); setLoading(false); return }

        const today = todayCST()
        const econMap: Record<string, Econ> = {}
        for (const e of (econRes.data ?? []) as Econ[]) econMap[e.deal_id] = e

        const buckets: Record<string, DeadlineRow[]> = {}
        for (const dl of (deadlinesRes.data ?? []) as DeadlineRow[]) {
          if (!dl.deadline_date) continue
          if (!buckets[dl.deal_id]) buckets[dl.deal_id] = []
          buckets[dl.deal_id].push(dl)
        }
        const deadlineMap: Record<string, DeadlineRow> = {}
        for (const [dealId, rows] of Object.entries(buckets)) {
          const upcoming = rows.filter(r => r.deadline_date >= today).sort((a, b) => a.deadline_date.localeCompare(b.deadline_date))
          const overdue = rows.filter(r => r.deadline_date < today).sort((a, b) => b.deadline_date.localeCompare(a.deadline_date))
          deadlineMap[dealId] = upcoming[0] ?? overdue[0]
        }

        const archiveKind: Record<string, ArchiveKind> = {}
        const archiveAt: Record<string, string> = {}
        for (const row of (archiveRes.data ?? []) as { deal_id: string | null; description: string | null; created_at: string | null }[]) {
          const kind = asArchiveKind(row.description)
          if (!row.deal_id || !kind) continue
          const at = row.created_at ?? ''
          if (archiveAt[row.deal_id] == null || at >= archiveAt[row.deal_id]) {
            archiveAt[row.deal_id] = at
            archiveKind[row.deal_id] = kind
          }
        }

        const enriched: EnrichedDeal[] = ((dealsRes.data ?? []) as RawDeal[]).map(deal => {
          const figures = figuresFor(deal, econMap[deal.id] ?? null)
          const dl = deadlineMap[deal.id] ?? null
          return {
            ...deal,
            title: formatDealTitle(deal),
            deadlineDays: dl?.deadline_date ? daysBetween(today, dl.deadline_date) : null,
            deadlineDate: dl?.deadline_date ?? null,
            deadlineLabel: dl ? shortDeadlineLabel(dl.deadline_type, dl.label) : '',
            value: figures.value,
            commission: figures.commission,
            archiveKind: archiveKind[deal.id] ?? null,
          }
        })

        setDeals(enriched)
        setPortfolios((portfoliosRes.data ?? []) as Portfolio[])
        setLoading(false)
      } catch {
        setLoadError(true)
        setLoading(false)
      }
    })()
  }, [open, reloadKey])

  function matchesType(d: EnrichedDeal): boolean {
    if (!typeFilter) return true
    return (d.property_type || 'OTHER').toUpperCase() === typeFilter
  }

  function matchesStage(d: EnrichedDeal): boolean {
    if (!matchesEngage(d, engage)) return false
    if (!matchesType(d)) return false
    if (engage !== 'listings') return true
    const bucket = bucketOf(d)
    if (stage === 'all') return bucket !== 'archived'
    return bucket === stage
  }

  const typed = deals.filter(d => matchesEngage(d, 'listings') && matchesType(d))
  const engageCounts: Record<EngageKey, number> = {
    listings: deals.length,
    tenants: deals.filter(d => matchesEngage(d, 'tenants')).length,
    buyers: deals.filter(d => matchesEngage(d, 'buyers')).length,
    targets: deals.filter(d => matchesEngage(d, 'targets')).length,
  }
  const stageCounts: Record<StageKey, number> = {
    all: 0, pipeline: 0, review: 0, active: 0, hot: 0, under_contract: 0, closed: 0, in_service: 0, archived: 0,
  }
  for (const d of typed) {
    const key = bucketOf(d)
    if (key !== 'archived') stageCounts.all += 1
    if (key !== 'other') stageCounts[key] += 1
  }

  const matched = deals.filter(matchesStage)
  const totalValue = matched.reduce<number | null>((acc, d) => d.value != null ? (acc ?? 0) + d.value : acc, null)
  const totalComm = matched.reduce<number | null>((acc, d) => d.commission != null ? (acc ?? 0) + d.commission : acc, null)

  function sortDeals(rows: EnrichedDeal[]): EnrichedDeal[] {
    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case 'name': return sortDir === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)
        case 'deadline': return cmpNullLast(a.deadlineDays, b.deadlineDays, sortDir)
        case 'value': return cmpNullLast(a.value, b.value, sortDir)
        case 'comm': return cmpNullLast(a.commission, b.commission, sortDir)
        case 'rank': return cmpNullLast(a.rating && a.rating > 0 ? a.rating : null, b.rating && b.rating > 0 ? b.rating : null, sortDir)
        default: return a.title.localeCompare(b.title)
      }
    })
  }

  const portfolioName = new Map(portfolios.map(p => [p.id, p.name]))
  const byPortfolio = new Map<string, EnrichedDeal[]>()
  for (const deal of matched) {
    if (!deal.portfolio_id) continue
    if (!byPortfolio.has(deal.portfolio_id)) byPortfolio.set(deal.portfolio_id, [])
    byPortfolio.get(deal.portfolio_id)!.push(deal)
  }
  const visiblePortfolios = portfolios
    .filter(p => (byPortfolio.get(p.id)?.length ?? 0) > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
  const standalone = sortDeals(matched.filter(d => !d.portfolio_id))

  const typeCounts: Record<string, number> = {}
  for (const d of deals) {
    const pt = (d.property_type || 'OTHER').toUpperCase()
    typeCounts[pt] = (typeCounts[pt] || 0) + 1
  }

  function navigateDeal(id: string) {
    router.push(`/warroom3/deal?id=${id}`)
    onClose()
  }

  function pickSort(next: SortKey) {
    if (next === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(next); setSortDir('asc') }
  }

  function stageTab(key: StageKey, label: string) {
    const on = stage === key
    const accent = stageAccent(key)
    return (
      <button
        key={key}
        type="button"
        data-stage-tab={key}
        onClick={() => { setStage(key); setTypeMenuOpen(false) }}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 40,
          padding: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          flexShrink: 0,
          WebkitTapHighlightColor: 'transparent',
        } as React.CSSProperties}
      >
        <span style={{
          ...HEADER_FACE,
          fontSize: 14,
          fontWeight: on ? 600 : 500,
          color: on ? accent : TAB_GRAY,
          whiteSpace: 'nowrap',
        }}>{label}</span>
        <span style={{ ...HEADER_FACE, fontSize: 12, fontWeight: 500, color: COUNT_MUTED }}>{stageCounts[key]}</span>
        {on && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: accent }} />}
      </button>
    )
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label=""
      headerHeight={0}
      noHairline
      size="list"
    >
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: T.bgPanel }}>
        <div className="wr-phone-stage-scroll" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          height: 48,
          padding: `0 ${SHEET_EDGE}px`,
          overflowX: 'auto',
          borderBottom: '1px solid rgba(255,255,255,0.11)',
        } as React.CSSProperties}>
          {ENGAGE_TABS.map(tab => {
            const on = engage === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setEngage(tab.key); setStage('all'); setTypeMenuOpen(false) }}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  height: '100%',
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0,
                  WebkitTapHighlightColor: 'transparent',
                } as React.CSSProperties}
              >
                <span style={{ ...HEADER_FACE, fontSize: 18, fontWeight: on ? 600 : 500, color: on ? T.textHi : TAB_GRAY }}>{tab.label}</span>
                <span style={{ ...HEADER_FACE, fontSize: 14, color: COUNT_MUTED }}>{engageCounts[tab.key]}</span>
                {on && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: T.brandStrong }} />}
              </button>
            )
          })}
        </div>
        {engage === 'listings' && (
        <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid rgba(255,255,255,0.11)' }}>
          <div className="wr-phone-stage-scroll" style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            overflowX: 'auto',
            padding: `0 ${SHEET_EDGE}px`,
            WebkitOverflowScrolling: 'touch',
          } as React.CSSProperties}>
            {STAGE_TABS.map(tab => stageTab(tab.key, tab.label))}
          </div>
          <button
            type="button"
            data-type-filter={typeFilter ?? 'all'}
            onClick={() => setTypeMenuOpen(v => !v)}
            style={{
              position: 'relative',
              flexShrink: 0,
              height: 40,
              padding: '0 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              borderLeft: '1px solid rgba(255,255,255,0.11)',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties}
          >
            <span style={{
              ...HEADER_FACE,
              fontSize: 14,
              fontWeight: typeFilter ? 600 : 500,
              color: typeFilter ? T.textHi : TAB_GRAY,
            }}>{typeFilter ? typeTitle(typeFilter) : 'Type'}</span>
            <span style={{ ...HEADER_FACE, fontSize: 12, color: COUNT_MUTED }}>▾</span>
            {typeFilter && <div style={{ position: 'absolute', left: 14, right: 14, bottom: 0, height: 2, background: T.brandStrong }} />}
          </button>
        </div>
        )}

        {typeMenuOpen && (
          <div style={{
            position: 'absolute',
            top: 88,
            right: 8,
            width: 220,
            background: T.bgRaise,
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.11)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 20,
            overflow: 'hidden',
          }}>
            <TypeRow
              label="All types"
              count={deals.length}
              selected={!typeFilter}
              onPress={() => { setTypeFilter(null); setTypeMenuOpen(false) }}
            />
            {PROPERTY_TYPES.map(pt => (
              <TypeRow
                key={pt}
                label={typeTitle(pt)}
                count={typeCounts[pt] ?? 0}
                selected={typeFilter === pt}
                onPress={() => { setTypeFilter(pt); setTypeMenuOpen(false) }}
              />
            ))}
          </div>
        )}

        <div
          data-totals="deals"
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 30,
            padding: `0 ${SHEET_EDGE}px`,
            borderBottom: '1px solid rgba(255,255,255,0.10)',
            ...HEADER_FACE,
            fontSize: 12,
            color: T.textMid,
          }}
        >
          {matched.length} deals · {totalValue != null ? fmtMoney(totalValue) : '—'} value · {totalComm != null ? fmtMoney(totalComm) : '—'} commission
        </div>

        <div className="wr-phone-stage-scroll" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          height: 32,
          padding: `0 ${SHEET_EDGE}px`,
          overflowX: 'auto',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
        } as React.CSSProperties}>
          {([
            ['name', 'Address'],
            ['deadline', 'Deadline'],
            ['value', 'Value'],
            ['comm', 'Comm'],
            ['rank', 'Rank'],
          ] as [SortKey, string][]).map(([key, label]) => {
            const on = sortKey === key
            return (
              <button
                key={key}
                type="button"
                data-sort={key}
                data-sort-on={on ? '1' : '0'}
                onClick={() => pickSort(key)}
                style={{
                  position: 'relative',
                  height: '100%',
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  color: on ? T.textHi : T.textLow,
                  ...HEADER_FACE,
                  fontSize: 13,
                  fontWeight: on ? 600 : 500,
                  cursor: 'pointer',
                  flexShrink: 0,
                  WebkitTapHighlightColor: 'transparent',
                } as React.CSSProperties}
              >
                {label}{on ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
            )
          })}
        </div>
        <style>{`
          .wr-phone-stage-scroll { scrollbar-width: none; }
          .wr-phone-stage-scroll::-webkit-scrollbar { display: none; }
        `}</style>
      </div>

      {loading ? (
        <SkeletonList />
      ) : loadError ? (
        <button
          type="button"
          onClick={() => setReloadKey(k => k + 1)}
          style={{ padding: '24px 18px', textAlign: 'center', background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}
        >
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.late }}>Could not load — tap to retry</span>
        </button>
      ) : matched.length === 0 ? (
        <div style={{ padding: '24px 18px', textAlign: 'center' }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>No deals match.</span>
        </div>
      ) : (
        <div>
          {visiblePortfolios.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, height: 30,
              padding: `0 ${SHEET_EDGE}px`, borderBottom: '1px solid rgba(255,255,255,0.11)',
            }}>
              <span style={{ ...HEADER_FACE, fontSize: 13, color: T.textLow }}>Portfolios</span>
              <span style={{ ...HEADER_FACE, fontSize: 13, color: COUNT_MUTED }}>{visiblePortfolios.length}</span>
            </div>
          )}
          {visiblePortfolios.map(portfolio => {
            const children = sortDeals(byPortfolio.get(portfolio.id) ?? [])
            const isOpen = expanded.has(portfolio.id)
            return (
              <React.Fragment key={portfolio.id}>
                <button
                  type="button"
                  data-portfolio={portfolio.id}
                  onClick={() => togglePortfolio(portfolio.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    minHeight: 62,
                    padding: '0 16px',
                    boxSizing: 'border-box',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.10)',
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                    textAlign: 'left',
                  } as React.CSSProperties}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, background: T.brand,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                    </svg>
                  </div>
                  <div style={{
                    flex: 1, fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 500, color: T.textHi,
                    lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
                  }}>{portfolioName.get(portfolio.id) || portfolio.name}</div>
                  <span style={{
                    fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500, color: T.brandLift,
                    letterSpacing: '0.08em', flexShrink: 0,
                  }}>{children.length}</span>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={T.textLow} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'none' }}
                  >
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
                {isOpen && children.map(deal => (
                  <DealRow key={deal.id} deal={deal} onPress={() => navigateDeal(deal.id)} indented />
                ))}
              </React.Fragment>
            )
          })}
          {standalone.map(deal => (
            <DealRow key={deal.id} deal={deal} onPress={() => navigateDeal(deal.id)} />
          ))}
        </div>
      )}
    </BottomSheet>
  )
}

function TypeRow({
  label, count, selected, onPress,
}: { label: string; count: number; selected: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', height: 40, padding: '0 14px',
        background: 'transparent', border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)',
        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
      } as React.CSSProperties}
    >
      <span style={{
        ...HEADER_FACE, fontSize: 14, fontWeight: 500,
        color: selected ? T.brandLift : T.textHi,
      }}>{label}</span>
      <span style={{ ...HEADER_FACE, fontSize: 13, color: selected ? T.brandLift : COUNT_MUTED }}>{count}</span>
    </button>
  )
}

function StagePill({ status, archiveKind }: { status: string | null; archiveKind: ArchiveKind | null }) {
  const label = stageLabel(status, archiveKind)
  if (!label) return null
  const tone = stageTone(status, archiveKind)
  const wide = label === 'UNDER CONTRACT'
  return (
    <span data-stage={bucketOf({ status, archiveKind })} style={{
      fontFamily: FONT_MONO,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: wide ? '0.03em' : '0.06em',
      lineHeight: 1,
      color: tone.color,
      background: tone.background,
      border: tone.border,
      borderRadius: 4,
      padding: tone.background === 'transparent' ? '3px 5px' : '4px 6px',
      flexShrink: 0,
      whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

function DealRow({
  deal,
  onPress,
  indented = false,
}: {
  deal: EnrichedDeal
  onPress: () => void
  indented?: boolean
}) {
  const [pressed, setPressed] = React.useState(false)
  const [photoOk, setPhotoOk] = React.useState(Boolean(deal.photo_url))
  const mark = lacdbFlagFor(deal, LACDB_ACTIVE)
  const lacdb = mark?.kind === 'active' && mark.href ? mark.href : null
  const deadlineText = deal.deadlineDate
    ? [fmtDeadlineWhen(deal.deadlineDate), deal.deadlineLabel].filter(Boolean).join(' · ')
    : ''

  return (
    <div
      role="link"
      data-deal-row={deal.id}
      data-deal-name={deal.title}
      onClick={onPress}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => { setTimeout(() => setPressed(false), 80) }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        minHeight: 68,
        padding: `10px 16px 10px ${indented ? 28 : 16}px`,
        boxSizing: 'border-box',
        background: pressed ? 'rgba(255,255,255,0.03)' : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.10)',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      } as React.CSSProperties}
    >
      {photoOk && deal.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={deal.photo_url}
          alt=""
          data-deal-photo={deal.id}
          onError={() => setPhotoOk(false)}
          style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: 'rgba(255,255,255,0.04)' }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 16,
              fontWeight: 500,
              color: T.textHi,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>{deal.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, minHeight: 16 }}>
              <StagePill status={deal.status} archiveKind={deal.archiveKind} />
              {deal.archiveKind && (
                <span style={{
                  fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                  color: deal.archiveKind === 'lease' ? '#5EEAD4' : T.moneyIn,
                  border: `1px solid ${deal.archiveKind === 'lease' ? 'rgba(94,234,212,0.55)' : 'rgba(52,211,153,0.55)'}`,
                  borderRadius: 4, padding: '3px 5px', lineHeight: 1,
                }}>{deal.archiveKind.toUpperCase()}</span>
              )}
              {lacdb && (
                <a
                  href={lacdb}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-lacdb="active"
                  aria-label="Open LACDB listing"
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: 'rgba(139,92,246,0.16)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, textDecoration: 'none',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.brandLift} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 16 16 8M10 8h6v6"/>
                  </svg>
                </a>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 52 }}>
            {deal.value != null && (
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500, color: T.textHi, lineHeight: 1.2 }}>
                {fmtMoney(deal.value)}
              </div>
            )}
            {deal.commission != null && (
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500, color: T.moneyIn, lineHeight: 1.3, marginTop: 2 }}>
                {fmtMoney(deal.commission)}
              </div>
            )}
          </div>
        </div>
        {deadlineText && (
          <div style={{
            marginTop: 4,
            fontFamily: FONT_MONO,
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.04em',
            color: deadlineInk(deal.deadlineDays),
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>{deadlineText}</div>
        )}
      </div>
    </div>
  )
}

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {[1, 2, 3, 4, 5, 6, 7].map(i => (
        <div key={i} style={{
          height: 68, padding: '0 16px', display: 'flex', alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
        }}>
          <div style={{
            height: 16, width: `${55 + (i % 3) * 12}%`, borderRadius: 4,
            background: 'rgba(255,255,255,0.06)',
          }} />
        </div>
      ))}
    </div>
  )
}

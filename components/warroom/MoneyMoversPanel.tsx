'use client'

import { useState, useEffect } from 'react'
import { supabase, Deal } from '@/lib/supabase'

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

const STATUS_COLORS: Record<string, string> = {
  pipeline: 'badge-pipeline',
  active: 'badge-active',
  under_contract: 'badge-contract',
  pending_payment: 'badge-pending',
}

// Generates deterministic atmospheric sparkline points from a seed number
function generateSparkline(seed: number, count = 12): number[] {
  const pts: number[] = []
  let val = 40 + (seed % 30)
  for (let i = 0; i < count; i++) {
    val += ((seed * (i + 1) * 7919) % 21) - 9
    val = Math.max(10, Math.min(90, val))
    pts.push(val)
  }
  return pts
}

// Converts a value array to SVG path string (area + line)
function buildSparkPaths(values: number[], w: number, h: number) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: h - ((v - min) / range) * (h * 0.85) - h * 0.05,
  }))
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`
  return { linePath, areaPath, pts }
}

export default function MoneyMoversPanel() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDeals() {
      try {
        const { data } = await supabase
          .from('deals')
          .select('*')
          .not('status', 'in', '("closed","dead")')
          .not('commission_estimated', 'is', null)
          .order('commission_estimated', { ascending: false })
          .limit(5)
        if (data) setDeals(data as Deal[])
      } catch {
        setDeals(PLACEHOLDER_DEALS)
      } finally {
        setLoading(false)
      }
    }
    fetchDeals()
  }, [])

  const total = deals.reduce((s, d) => s + (d.commission_estimated || 0), 0)

  return (
    <div className="wr-card h-full min-h-[240px]">
      {/* Chapter-heading panel header */}
      <div className="wr-card-header">
        <span style={{ color: 'var(--accent-gold)', display: 'flex' }}>
          <RocketIcon />
        </span>
        <span className="wr-card-title">Money Movers</span>
        <span className="wr-panel-line" />
        <span className="wr-panel-stat wr-panel-stat-gold" style={{ fontSize: 16 }}>
          {formatCurrency(total)}
        </span>
      </div>

      {loading ? (
        <SkeletonList />
      ) : deals.length === 0 ? (
        <div className="wr-empty">
          <div className="wr-empty-text">Pipeline clear.</div>
          <div className="wr-empty-line" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {deals.map((deal, i) => (
            <DealRow key={deal.id} deal={deal} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function DealRow({ deal, rank }: { deal: Deal; rank: number }) {
  // Generate a sparkline seeded from deal id
  const seed = deal.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + (deal.commission_estimated || 1)
  const sparkValues = generateSparkline(seed)
  const sparkId = `spark-mm-${deal.id}`
  const W = 64, H = 28
  const { linePath, areaPath } = buildSparkPaths(sparkValues, W, H)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: 'var(--bg-nested)',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.05)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.3)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Rank */}
      <span style={{
        width: 20, height: 20,
        borderRadius: '50%',
        background: rank === 1 ? 'rgba(232,184,75,0.18)' : 'rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700,
        color: rank === 1 ? 'var(--accent-gold)' : 'var(--text-muted)',
        flexShrink: 0,
        border: rank === 1 ? '1px solid rgba(232,184,75,0.25)' : 'none',
      }}>
        {rank}
      </span>

      {/* Deal name + type */}
      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {deal.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, textTransform: 'capitalize' }}>
          {deal.type.replace(/_/g, ' ')}
        </div>
      </div>

      {/* Sparkline — atmospheric area chart */}
      <svg
        width={W} height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ flexShrink: 0, overflow: 'visible' }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4F8EF7" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#4F8EF7" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${sparkId})`} />
        <path d={linePath} fill="none" stroke="#4F8EF7" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Commission */}
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 60 }}>
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: 'var(--accent-gold)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.01em',
        }}>
          {deal.commission_estimated ? formatCurrency(deal.commission_estimated) : '—'}
        </div>
        <span className={`badge ${STATUS_COLORS[deal.status] || 'badge-pipeline'}`}>
          {deal.status.replace(/_/g, ' ')}
        </span>
      </div>
    </div>
  )
}

const PLACEHOLDER_DEALS: Deal[] = [
  {
    id: 'p1', name: 'Edinburgh Ave. N. 1873', address: null,
    type: 'listing', status: 'under_contract', tier: 'filed',
    value: 1200000, commission_rate: 0.06, commission_estimated: 72000, commission_collected: 0,
    deal_source: null, notes: null, dropbox_link: null, parent_deal_id: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'p2', name: 'French Truck Coffee — BR', address: null,
    type: 'tenant_rep', status: 'active', tier: 'tracked',
    value: 800000, commission_rate: 0.04, commission_estimated: 32000, commission_collected: 0,
    deal_source: null, notes: null, dropbox_link: null, parent_deal_id: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
]

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
    </div>
  )
}

function RocketIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/>
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/>
    </svg>
  )
}

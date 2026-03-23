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
      <div className="wr-card-header">
        <span style={{ color: 'var(--accent-gold)', display: 'flex' }}>
          <RocketIcon />
        </span>
        <span className="wr-card-title">Money Movers</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(total)}
        </span>
      </div>

      {loading ? (
        <SkeletonList />
      ) : deals.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
          No active deals ranked yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {deals.map((deal, i) => (
            <DealRow key={deal.id} deal={deal} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function DealRow({ deal, rank }: { deal: Deal; rank: number }) {
  const pct = deal.commission_estimated && deal.value
    ? Math.round((deal.commission_estimated / deal.value) * 100)
    : null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 10px',
      background: 'var(--bg-elevated)',
      borderRadius: 6,
      border: '1px solid var(--border-subtle)',
    }}>
      {/* Rank */}
      <span style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: rank === 1 ? 'rgba(201,147,58,0.2)' : 'rgba(255,255,255,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
        color: rank === 1 ? 'var(--accent-gold)' : 'var(--text-muted)',
        flexShrink: 0,
      }}>
        {rank}
      </span>

      {/* Deal name */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {deal.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
          {deal.type.replace('_', ' ')}
        </div>
      </div>

      {/* Commission */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', fontVariantNumeric: 'tabular-nums' }}>
          {deal.commission_estimated ? formatCurrency(deal.commission_estimated) : '—'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          <span className={`badge ${STATUS_COLORS[deal.status] || 'badge-pipeline'}`}>
            {deal.status.replace('_', ' ')}
          </span>
        </div>
      </div>
    </div>
  )
}

const PLACEHOLDER_DEALS: Deal[] = [
  {
    id: 'p1', name: 'Edinburgh Ave. N. 1873', address: null,
    type: 'listing', status: 'under_contract', tier: 'filed',
    value: 1200000, commission_rate: 0.06, commission_estimated: 72000, commission_collected: 0,
    deal_source: null, notes: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'p2', name: 'French Truck Coffee — BR', address: null,
    type: 'tenant_rep', status: 'active', tier: 'tracked',
    value: 800000, commission_rate: 0.04, commission_estimated: 32000, commission_collected: 0,
    deal_source: null, notes: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
]

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
    </div>
  )
}

function RocketIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/>
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/>
    </svg>
  )
}

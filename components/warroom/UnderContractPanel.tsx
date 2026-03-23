'use client'

import { useState, useEffect } from 'react'
import { supabase, Deal } from '@/lib/supabase'

interface ContractDeal extends Deal {
  days_since_contract?: number
}

function daysDiff(from: string) {
  return Math.floor((Date.now() - new Date(from).getTime()) / 86400000)
}

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export default function UnderContractPanel() {
  const [deals, setDeals] = useState<ContractDeal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDeals() {
      try {
        const { data } = await supabase
          .from('deals')
          .select('*')
          .eq('status', 'under_contract')
          .order('updated_at', { ascending: false })
        if (data) {
          setDeals((data as Deal[]).map(d => ({
            ...d,
            days_since_contract: daysDiff(d.updated_at),
          })))
        }
      } catch {
        // DB not yet migrated — show placeholder
        setDeals(PLACEHOLDER_DEALS)
      } finally {
        setLoading(false)
      }
    }
    fetchDeals()
  }, [])

  return (
    <div className="wr-card h-full min-h-[280px]">
      <div className="wr-card-header">
        <span style={{ color: '#60A5FA', display: 'flex' }}>
          <DocIcon />
        </span>
        <span className="wr-card-title">Under Contract</span>
        <span style={{ marginLeft: 'auto' }}>
          <span className="badge badge-contract">{deals.length} Active</span>
        </span>
      </div>

      {loading ? (
        <SkeletonTable />
      ) : deals.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Deal', 'Type', 'Value', 'Commission', 'Day #', 'Status'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left',
                    padding: '6px 10px',
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map((deal, i) => (
                <tr
                  key={deal.id}
                  style={{
                    borderBottom: i < deals.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <td style={{ padding: '10px 10px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    <div>{deal.name}</div>
                    {deal.address && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{deal.address}</div>}
                  </td>
                  <td style={{ padding: '10px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {deal.type.replace('_', ' ')}
                  </td>
                  <td style={{ padding: '10px 10px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {deal.value ? formatCurrency(deal.value) : '—'}
                  </td>
                  <td style={{ padding: '10px 10px', color: 'var(--accent-gold)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {deal.commission_estimated ? formatCurrency(deal.commission_estimated) : '—'}
                  </td>
                  <td style={{ padding: '10px 10px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {deal.days_since_contract ?? '—'}
                  </td>
                  <td style={{ padding: '10px 10px' }}>
                    <span className="badge badge-contract">UC</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Placeholder data for display before DB migration
const PLACEHOLDER_DEALS: ContractDeal[] = [
  {
    id: 'p1', name: 'Edinburgh Ave. N. 1873', address: 'Edinburgh Ave. N. 1873, BR',
    type: 'listing', status: 'under_contract', tier: 'filed',
    value: 1200000, commission_rate: 0.06, commission_estimated: 72000, commission_collected: 0,
    deal_source: null, notes: null,
    created_at: new Date().toISOString(), updated_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    days_since_contract: 12,
  },
]

function SkeletonTable() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1,2,3].map(i => (
        <div key={i} className="skeleton" style={{ height: 44 }} />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
      No deals under contract. Good reason to have none is a bad reason.
    </div>
  )
}

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}

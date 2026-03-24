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

// Sparkline helpers
function generateSparkline(seed: number, count = 14): number[] {
  const pts: number[] = []
  let val = 35 + (seed % 40)
  for (let i = 0; i < count; i++) {
    val += ((seed * (i + 3) * 6257) % 19) - 8
    val = Math.max(8, Math.min(92, val))
    pts.push(val)
  }
  return pts
}

function buildSparkPaths(values: number[], w: number, h: number) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: h - ((v - min) / range) * (h * 0.82) - h * 0.05,
  }))
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`
  return { linePath, areaPath }
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
        setDeals(PLACEHOLDER_DEALS)
      } finally {
        setLoading(false)
      }
    }
    fetchDeals()
  }, [])

  return (
    <div className="wr-card h-full min-h-[280px]">
      {/* Chapter-heading panel header */}
      <div className="wr-card-header">
        <span style={{ color: 'var(--accent-blue)', display: 'flex' }}>
          <DocIcon />
        </span>
        <span className="wr-card-title">Under Contract</span>
        <span className="wr-panel-line" />
        <span className="wr-panel-stat">
          {loading ? '—' : deals.length}
        </span>
      </div>

      {loading ? (
        <SkeletonTable />
      ) : deals.length === 0 ? (
        <div className="wr-empty">
          <div className="wr-empty-text">No active contracts.</div>
          <div className="wr-empty-line" />
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Deal', 'Type', 'Value', 'Commission', 'Day', ''].map((h, i) => (
                  <th key={i} style={{
                    textAlign: i >= 4 ? 'center' : 'left',
                    padding: '5px 10px',
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.10em',
                    whiteSpace: 'nowrap',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map((deal, i) => {
                const seed = deal.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + (deal.value || 0)
                const sparkId = `spark-uc-${deal.id}`
                const W = 56, H = 24
                const { linePath, areaPath } = buildSparkPaths(generateSparkline(seed), W, H)

                return (
                  <tr
                    key={deal.id}
                    style={{ borderBottom: i < deals.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    {/* Deal name */}
                    <td style={{ padding: '10px 10px', color: 'var(--text-primary)', fontWeight: 500, maxWidth: 200 }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>{deal.name}</div>
                      {deal.address && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {deal.address}
                        </div>
                      )}
                    </td>

                    {/* Type */}
                    <td style={{ padding: '10px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 11, textTransform: 'capitalize' }}>
                      {deal.type.replace(/_/g, ' ')}
                    </td>

                    {/* Value */}
                    <td style={{ padding: '10px 10px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {deal.value ? formatCurrency(deal.value) : '—'}
                    </td>

                    {/* Commission */}
                    <td style={{ padding: '10px 10px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>
                        {deal.commission_estimated ? formatCurrency(deal.commission_estimated) : '—'}
                      </span>
                    </td>

                    {/* Day counter */}
                    <td style={{ padding: '10px 10px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', textAlign: 'center', fontSize: 12 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {deal.days_since_contract ?? '—'}
                      </span>
                    </td>

                    {/* Sparkline */}
                    <td style={{ padding: '6px 10px 6px 4px', width: 64 }}>
                      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
                        <defs>
                          <linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4F8EF7" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#4F8EF7" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d={areaPath} fill={`url(#${sparkId})`} />
                        <path d={linePath} fill="none" stroke="#4F8EF7" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const PLACEHOLDER_DEALS: ContractDeal[] = [
  {
    id: 'p1', name: 'Edinburgh Ave. N. 1873', address: 'Edinburgh Ave. N., BR',
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
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
    </div>
  )
}

function DocIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )
}

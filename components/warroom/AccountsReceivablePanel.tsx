'use client'

import { useState, useEffect } from 'react'
import { supabase, Deal } from '@/lib/supabase'

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export default function AccountsReceivablePanel() {
  const [arDeals, setArDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAR() {
      try {
        const { data } = await supabase
          .from('deals')
          .select('*')
          .eq('status', 'pending_payment')
          .order('commission_estimated', { ascending: false })
        if (data) setArDeals(data as Deal[])
      } catch {
        setArDeals(PLACEHOLDER_AR)
      } finally {
        setLoading(false)
      }
    }
    fetchAR()
  }, [])

  const total = arDeals.reduce((s, d) => {
    const outstanding = (d.commission_estimated || 0) - (d.commission_collected || 0)
    return s + Math.max(0, outstanding)
  }, 0)

  return (
    <div className="wr-card h-full min-h-[200px]">
      <div className="wr-card-header">
        <span style={{ color: 'var(--accent-violet)', display: 'flex' }}>
          <DollarIcon />
        </span>
        <span className="wr-card-title">Receivable</span>
        <span className="wr-panel-line" />
        <span className="wr-panel-stat" style={{ color: total > 0 ? 'var(--accent-violet)' : 'var(--success)', fontSize: 16 }}>
          {loading ? '—' : formatCurrency(total)}
        </span>
      </div>

      {/* Big number */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          Outstanding
        </div>
        <div className="wr-big-number" style={{ color: total > 0 ? '#C084FC' : 'var(--success)' }}>
          {loading ? '—' : formatCurrency(total)}
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 60 }} />
      ) : arDeals.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--success)', textAlign: 'center', padding: '12px 0' }}>
          ✓ All commissions collected
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {arDeals.map(deal => {
            const outstanding = (deal.commission_estimated || 0) - (deal.commission_collected || 0)
            return (
              <div key={deal.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '7px 10px',
                background: 'var(--bg-elevated)',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{deal.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                    Earned: {formatCurrency(deal.commission_estimated || 0)} · Collected: {formatCurrency(deal.commission_collected || 0)}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#C084FC', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(outstanding)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const PLACEHOLDER_AR: Deal[] = [
  {
    id: 'ar1', name: 'Government St. 4950', address: 'Government St. 4950, BR',
    type: 'listing', status: 'pending_payment', tier: 'filed',
    value: 750000, commission_rate: 0.06, commission_estimated: 45000, commission_collected: 0,
    deal_source: null, notes: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
]

function DollarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  )
}

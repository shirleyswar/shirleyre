'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface CollectedItem {
  id: string
  deal_id: string
  commission_amount: number | null   // SR Portion
  sr_portion_amount: number | null   // MS Portion
  collected_date: string | null
  created_at: string
  deals: { id: string; name: string; address: string | null } | null
  payments_total?: number
  payments?: { id: string; amount: number; paid_date: string; note: string | null }[]
}

function fmt(n: number | null | undefined): string {
  if (n == null || n === 0) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })
}

export default function WinLogPanel() {
  const [items, setItems] = useState<CollectedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('ar_items')
        .select('id, deal_id, commission_amount, sr_portion_amount, collected_date, created_at, deals(id, name, address)')
        .eq('status', 'collected')
        .order('collected_date', { ascending: false })

      if (error || !data) { setLoading(false); return }

      const rows = data as unknown as CollectedItem[]
      const ids = rows.map(i => i.id)
      let payMap: Record<string, CollectedItem['payments']> = {}
      if (ids.length > 0) {
        const { data: pData } = await supabase
          .from('ar_payments')
          .select('id, ar_item_id, amount, paid_date, note')
          .in('ar_item_id', ids)
          .order('paid_date', { ascending: true })
        if (pData) {
          for (const p of pData as any[]) {
            if (!payMap[p.ar_item_id]) payMap[p.ar_item_id] = []
            payMap[p.ar_item_id]!.push(p)
          }
        }
      }

      const enriched = rows.map(item => ({
        ...item,
        payments: payMap[item.id] ?? [],
        payments_total: (payMap[item.id] ?? []).reduce((s, p) => s + p.amount, 0),
      }))

      setItems(enriched)
    } catch {}
    setLoading(false)
  }

  const totalCollected = items.reduce((s, i) => s + (i.sr_portion_amount ?? 0), 0)

  return (
    <div className="wr-card">
      {/* Header */}
      <div className="wr-card-header">
        <span style={{ color: '#E8B84B', display: 'flex', alignItems: 'center', filter: 'drop-shadow(0 0 8px rgba(232,184,75,0.7))' }}><TrophyIcon /></span>
        <span className="wr-rank1" style={{ color: '#E8B84B', textShadow: '0 0 16px rgba(232,184,75,0.5)' }}>Win Log</span>
        <div className="wr-panel-line" style={{ background: 'linear-gradient(to right, rgba(232,184,75,0.35), transparent)' }} />
        <span className="wr-panel-stat" style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>
          {loading ? '—' : fmt(totalCollected)}
        </span>
      </div>

      {/* Total collected */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          Total MS Portion Collected
        </div>
        <div className="wr-big-number" style={{ color: '#22c55e', textShadow: '0 0 32px rgba(34,197,94,0.3)' }}>
          {loading ? '—' : fmt(totalCollected)}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(34,197,94,0.5)', marginTop: 4 }}>
          {items.length} deal{items.length !== 1 ? 's' : ''} closed
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[80, 65, 72].map((w, i) => <div key={i} className="skeleton" style={{ height: 52, width: `${w}%`, borderRadius: 8 }} />)}
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          No wins yet — go close something.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 130px 130px 120px', gap: '0 8px', padding: '6px 8px', borderBottom: '1px solid rgba(34,197,94,0.15)', marginBottom: 4 }}>
            {['', 'DEAL', 'MS PORTION', 'COLLECTED', 'DATE'].map((h, i) => (
              <div key={i} style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(34,197,94,0.4)', fontFamily: 'monospace', textAlign: i <= 1 ? 'left' : 'right' }}>
                {h}
              </div>
            ))}
          </div>

          {items.map((item, idx) => {
            const isExpanded = expandedId === item.id
            const msTotal = item.sr_portion_amount ?? 0
            const collected = item.payments_total ?? msTotal

            return (
              <div key={item.id}>
                {/* Main row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr 130px 130px 120px',
                    gap: '0 8px',
                    padding: '12px 8px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    alignItems: 'center',
                    borderLeft: '2px solid rgba(34,197,94,0.45)',
                    borderRadius: '0 4px 4px 0',
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  {/* Arrow link */}
                  <div onClick={e => e.stopPropagation()}>
                    <a href={`/warroom/deal?id=${item.deal_id}`} style={{ color: '#22c55e', textDecoration: 'none', fontSize: 14, fontWeight: 700 }} title="Open deal">↗</a>
                  </div>

                  {/* Deal name */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{isExpanded ? '▾' : '▸'}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#F0F2FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                        {item.deals?.name ?? '—'}
                      </span>
                    </div>
                    {item.deals?.address && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2, marginLeft: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.deals.address}
                      </div>
                    )}
                  </div>

                  {/* MS Portion */}
                  <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#F0F2FF', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
                    {fmt(msTotal)}
                  </div>

                  {/* Collected */}
                  <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 800, color: '#22c55e', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', textShadow: '0 0 16px rgba(34,197,94,0.3)' }}>
                    {fmt(collected)}
                  </div>

                  {/* Date */}
                  <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'rgba(34,197,94,0.6)', fontFamily: 'monospace' }}>
                    {fmtDate(item.collected_date)}
                  </div>
                </div>

                {/* Expanded payment breakdown */}
                {isExpanded && (item.payments ?? []).length > 0 && (
                  <div style={{ padding: '8px 8px 12px 44px', background: 'rgba(34,197,94,0.03)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '130px 110px 1fr', gap: '0 12px', marginBottom: 5 }}>
                        {['Date', 'Amount', 'Note'].map(h => (
                          <div key={h} style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(34,197,94,0.3)', fontFamily: 'monospace' }}>{h}</div>
                        ))}
                      </div>
                      {(item.payments ?? []).map(p => (
                        <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '130px 110px 1fr', gap: '0 12px', padding: '4px 0', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                          <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>
                            {fmtDate(p.paid_date)}
                          </div>
                          <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {fmt(p.amount)}
                          </div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>{p.note ?? '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TrophyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  )
}

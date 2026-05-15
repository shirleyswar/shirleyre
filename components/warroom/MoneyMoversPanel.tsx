'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, Deal } from '@/lib/supabase'

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function autoSuggestAction(status: string): string {
  switch (status) {
    case 'pipeline': return 'Initial outreach pending'
    case 'active': return 'Agreement in place — schedule follow-up'
    case 'in_review': return 'Review in progress'
    case 'hot': return 'High priority — needs immediate attention'
    case 'under_contract': return 'Under contract — track deadlines'
    case 'pending_payment': return 'Commission collection pending'
    default: return 'Follow up needed'
  }
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
          .eq('is_money_mover', true)
          .not('status', 'in', '("closed","dead","expired","dormant","terminated")')
          .order('commission_estimated', { ascending: false })
          .limit(10)
        setDeals((data ?? []) as Deal[])
      } catch {
        setDeals([])
      } finally {
        setLoading(false)
      }
    }
    fetchDeals()
  }, [])

  return (
    <div className="wr-card h-full min-h-[200px]">
      {/* T1 Header */}
      <div className="wr-card-header" style={{ padding: '16px 20px 0', marginBottom: 12 }}>
        <span style={{ color: '#E8B84B', display: 'flex', alignItems: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"/>
            <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
          </svg>
        </span>
        <span className="wr-rank1" style={{ color: '#E8B84B' }}>Money Movers</span>
        <div className="wr-panel-line" />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(232,184,75,0.6)', fontVariantNumeric: 'tabular-nums' }}>
          {loading ? '—' : deals.length}
        </span>
      </div>

      {loading ? (
        <SkeletonList />
      ) : deals.length === 0 ? (
        <div className="wr-empty">
          <div className="wr-empty-text">No flagged money movers.</div>
          <div className="wr-empty-line" />
        </div>
      ) : (
        <>
          {/* Desktop table — hidden on mobile */}
          <div className="hidden sm:block" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(232,184,75,0.15)' }}>
                  {['Address', 'Value', 'Commission'].map(col => (
                    <th key={col} style={{
                      padding: '6px 12px', fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.12em', textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.3)', textAlign: col === 'Address' ? 'left' : 'right',
                      whiteSpace: 'nowrap',
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deals.map(deal => (
                  <DesktopDealRow key={deal.id} deal={deal} onUpdate={updated => setDeals(prev => prev.map(d => d.id === updated.id ? updated : d))} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list — hidden on desktop */}
          <div className="sm:hidden" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {deals.map(deal => (
              <MobileDealRow key={deal.id} deal={deal} onUpdate={updated => setDeals(prev => prev.map(d => d.id === updated.id ? updated : d))} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function DesktopDealRow({ deal, onUpdate }: { deal: Deal; onUpdate: (d: Deal) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const displayAction = (deal as any).next_action || autoSuggestAction(deal.status)
  const isCustom = !!(deal as any).next_action
  const addr = (deal as any).addr_display || deal.address || deal.name || '—'

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setDraft((deal as any).next_action || '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function saveAction() {
    const val = draft.trim() || null
    try {
      await supabase.from('deals').update({ next_action: val } as Record<string, unknown>).eq('id', deal.id)
      onUpdate({ ...deal, next_action: val } as Deal)
    } catch {}
    setEditing(false)
  }

  return (
    <>
      <tr
        style={{ borderBottom: expanded ? 'none' : '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
        onClick={() => setExpanded(p => !p)}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
        onMouseLeave={e => (e.currentTarget.style.background = '')}
      >
        {/* Address + subtitle */}
        <td style={{ padding: '11px 12px', maxWidth: 240 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addr}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {deal.status.replace(/_/g, ' ')}
          </div>
        </td>
        {/* Value */}
        <td style={{ padding: '11px 12px', textAlign: 'right', fontSize: 14, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
          {deal.value ? formatCurrency(deal.value) : '—'}
        </td>
        {/* Commission */}
        <td style={{ padding: '11px 12px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#E8B84B', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {deal.commission_estimated ? formatCurrency(deal.commission_estimated) : '—'}
        </td>
      </tr>

      {/* Action dropdown row */}
      {expanded && (
        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <td colSpan={3} style={{ padding: '0 12px 10px 20px' }}>
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={saveAction}
                onKeyDown={e => { if (e.key === 'Enter') saveAction(); if (e.key === 'Escape') setEditing(false) }}
                style={{ width: '100%', maxWidth: 400, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(232,184,75,0.4)', borderRadius: 6, padding: '5px 10px', fontSize: 13, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)' }}
              />
            ) : (
              <span
                onClick={startEdit}
                title="Click to edit action"
                style={{ fontSize: 13, color: '#E8B84B', fontStyle: isCustom ? 'normal' : 'italic', cursor: 'text' }}
              >
                {displayAction}
              </span>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function MobileDealRow({ deal, onUpdate }: { deal: Deal; onUpdate: (d: Deal) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const displayAction = (deal as any).next_action || autoSuggestAction(deal.status)
  const isCustom = !!(deal as any).next_action
  const addr = (deal as any).addr_display || deal.address || deal.name || '—'

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setDraft((deal as any).next_action || '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function saveAction() {
    const val = draft.trim() || null
    try {
      await supabase.from('deals').update({ next_action: val } as Record<string, unknown>).eq('id', deal.id)
      onUpdate({ ...deal, next_action: val } as Deal)
    } catch {}
    setEditing(false)
  }

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      {/* Main row — tap anywhere to expand/collapse */}
      <div
        onClick={() => setExpanded(p => !p)}
        style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addr}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, textTransform: 'capitalize' }}>
            {deal.status.replace(/_/g, ' ')}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#E8B84B', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {deal.commission_estimated ? formatCurrency(deal.commission_estimated) : '—'}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
            {deal.value ? formatCurrency(deal.value) : '—'}
          </div>
        </div>
      </div>

      {/* Action dropdown — shows on tap */}
      {expanded && (
        <div style={{ padding: '0 20px 12px' }} onClick={e => e.stopPropagation()}>
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={saveAction}
              onKeyDown={e => { if (e.key === 'Enter') saveAction(); if (e.key === 'Escape') setEditing(false) }}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(232,184,75,0.4)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: '#F2EDE4', outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' } as React.CSSProperties}
            />
          ) : (
            <span
              onClick={startEdit}
              title="Tap to edit"
              style={{ fontSize: 13, color: '#E8B84B', fontStyle: isCustom ? 'normal' : 'italic', cursor: 'text' }}
            >
              {displayAction}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px 16px' }}>
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
    </div>
  )
}

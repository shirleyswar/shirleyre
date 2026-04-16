'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase, Deal } from '@/lib/supabase'
import { formatAddress } from '@/lib/formatAddress'

function formatCurrency(n: number | null | undefined): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

const PIN_HASH = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

const fInput: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 13,
  color: '#F0F2FF',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

// ─── Action Modal ─────────────────────────────────────────────────────────────
function ActionModal({
  deal,
  onClose,
  onSaved,
}: {
  deal: Deal
  onClose: () => void
  onSaved: (dealId: string, action: string) => void
}) {
  const [text, setText] = useState((deal as any).next_action ?? deal.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await supabase
        .from('deals')
        .update({ notes: text.trim(), updated_at: new Date().toISOString() })
        .eq('id', deal.id)
      onSaved(deal.id, text.trim())
    } catch {}
    setSaving(false)
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#13112A', border: '1px solid rgba(232,184,75,0.4)', borderRadius: 14, padding: 28, width: '90vw', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.6)', fontFamily: 'monospace', marginBottom: 4 }}>Next Action</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F2FF' }}>
              {formatAddress(deal.address) || (deal.name ?? '—')}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="What's the next action needed on this deal?"
          rows={4}
          style={{ ...fInput, resize: 'vertical', lineHeight: 1.5 }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#6b7280', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            style={{ flex: 2, padding: '10px', background: 'rgba(232,184,75,0.2)', border: '1px solid rgba(251,146,60,0.5)', borderRadius: 8, color: '#E8B84B', cursor: 'pointer', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', opacity: saving ? 0.5 : 1 }}
          >
            {saving ? 'Saving…' : 'Save Action'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── HotPanel ─────────────────────────────────────────────────────────────────
export default function HotPanel() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [commissionData, setCommissionData] = useState<Record<string, { value: number | null; commission: number | null }>>({})
  const [loading, setLoading] = useState(true)
  const [actionModal, setActionModal] = useState<Deal | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('status', 'hot')
      .order('updated_at', { ascending: false })
    const list = (data ?? []) as Deal[]
    setDeals(list)

    if (list.length > 0) {
      const ids = list.map(d => d.id)
      const map: Record<string, { value: number | null; commission: number | null }> = {}

      // Primary: deal_economics (asking_price + sale_commission_pct) — same source as CommissionPanel
      const { data: econData } = await supabase
        .from('deal_economics')
        .select('deal_id, asking_price, sale_commission_pct, lease_rate_psf, lease_term_years, transaction_type')
        .in('deal_id', ids)
      if (econData) {
        for (const e of econData as any[]) {
          const isLease = e.transaction_type === 'lease'
          const price = e.asking_price ?? null
          const pct = isLease ? null : (e.sale_commission_pct ?? null)
          const commission = price && pct ? Math.round(price * (pct / 100) * 0.75) : null
          map[e.deal_id] = { value: price, commission }
        }
      }

      // Fallback: uc_details for any deals without economics data
      const { data: ucData } = await supabase
        .from('uc_details')
        .select('deal_id, contract_price, commission_pct, commission_amount')
        .in('deal_id', ids)
      if (ucData) {
        for (const u of ucData as any[]) {
          if (!map[u.deal_id]?.value) {
            const price = u.contract_price ?? null
            const pct = u.commission_pct ?? null
            const commission = u.commission_amount ?? (price && pct ? Math.round(price * (pct / 100) * 0.75) : null)
            map[u.deal_id] = { value: price, commission }
          }
        }
      }

      setCommissionData(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  function handleActionSaved(dealId: string, action: string) {
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, notes: action } : d))
    setActionModal(null)
  }

  if (loading) return null

  const header = (
    <div className="wr-card-header" style={{ marginBottom: 4 }}>
      <span style={{ color: 'var(--accent-gold)', display: 'flex' }}>
        <RocketIcon />
      </span>
      <span className="wr-card-title" style={{ fontSize: 16, fontWeight: 900, color: 'var(--accent-gold)', letterSpacing: '0.06em', textShadow: '0 0 16px rgba(232,184,75,0.4)' }}>
        Money Movers
      </span>
      <span className="wr-panel-line" />
      <span className="wr-panel-stat wr-panel-stat-gold" style={{ fontSize: 18, fontWeight: 800 }}>{deals.length}</span>
    </div>
  )

  if (deals.length === 0) return (
    <div className="wr-card">
      {header}
      <div className="wr-empty">
        <div className="wr-empty-text">No active offer negotiations.</div>
        <div className="wr-empty-line" />
      </div>
    </div>
  )

  return (
    <div className="wr-card">
      {/* Action modal */}
      {actionModal && typeof document !== 'undefined' && (
        <ActionModal deal={actionModal} onClose={() => setActionModal(null)} onSaved={handleActionSaved} />
      )}

      {header}

      {/* Table — matches Under Contract layout */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              {[
                { label: '↗',          align: 'center' },
                { label: 'Address',    align: 'left'   },
                { label: 'Action',     align: 'left'   },
                { label: 'Value',      align: 'right'  },
                { label: 'Commission', align: 'right'  },
              ].map((h, i) => (
                <th key={i} style={{
                  textAlign: h.align as React.CSSProperties['textAlign'],
                  padding: '7px 8px',
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'rgba(232,184,75,0.6)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  whiteSpace: 'nowrap',
                  borderBottom: '1px solid rgba(232,184,75,0.15)',
                }}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deals.map(deal => {
              const cd = commissionData[deal.id]
              const value = cd?.value ?? deal.value ?? null
              const commission = cd?.commission ?? deal.commission_estimated ?? null
              const action = deal.notes ?? ''

              return (
                <tr
                  key={deal.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.1s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(232,184,75,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  {/* ↗ link */}
                  <td style={{ width: 38, minWidth: 38, maxWidth: 38, padding: '6px 4px', textAlign: 'center' }}>
                    <a
                      href={`/warroom/deal?id=${deal.id}`}
                      title="Open deal"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 28, height: 28, borderRadius: 6,
                        background: 'rgba(232,184,75,0.12)', border: '1px solid rgba(232,184,75,0.35)',
                        color: '#E8B84B', textDecoration: 'none', fontSize: 14, lineHeight: 1,
                      }}>
                      ↗
                    </a>
                  </td>

                  {/* Address */}
                  <td style={{ padding: '13px 8px', maxWidth: 220 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 14, fontWeight: 700, color: '#F0F2FF', fontFamily: 'var(--font-body)' }}>
                      {formatAddress(deal.address) || formatAddress(deal.name)}
                    </div>
                    {deal.name && (
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 400, marginTop: 1 }}>
                        {deal.name.replace(/^📁\s*/, '')}
                      </div>
                    )}
                  </td>

                  {/* Action */}
                  <td style={{ padding: '13px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {action ? (
                        <span
                          onClick={() => setActionModal(deal)}
                          style={{ fontSize: 13, color: '#E8B84B', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, maxWidth: 240, fontFamily: 'var(--font-body)' }}
                          title={action}
                        >
                          {action}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic', flex: 1 }}>—</span>
                      )}
                      <button
                        onClick={() => setActionModal(deal)}
                        style={{
                          padding: '3px 10px', fontSize: 11, fontWeight: 700,
                          background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.3)',
                          borderRadius: 5, color: '#E8B84B', cursor: 'pointer',
                          whiteSpace: 'nowrap', fontFamily: 'inherit', letterSpacing: '0.04em',
                          flexShrink: 0,
                        }}
                      >
                        {action ? '✎' : '+ Action'}
                      </button>
                    </div>
                  </td>

                  {/* Value */}
                  <td style={{ padding: '13px 8px', whiteSpace: 'nowrap', textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#F0F2FF', fontFamily: 'var(--font-body)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(value)}
                  </td>

                  {/* Commission */}
                  <td style={{ padding: '13px 8px', whiteSpace: 'nowrap', textAlign: 'right', fontSize: 14, fontFamily: 'var(--font-body)', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: '#22c55e', fontWeight: 700 }}>
                      {formatCurrency(commission)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RocketIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C12 2 7 6 7 13l5 3 5-3c0-7-5-11-5-11z"/>
      <path d="M7 13c-2 1-3 3-3 5l3-1"/>
      <path d="M17 13c2 1 3 3 3 5l-3-1"/>
      <circle cx="12" cy="11" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}

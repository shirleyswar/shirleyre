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
  const [ucDetails, setUcDetails] = useState<Record<string, { contract_price: number | null; commission_amount: number | null }>>({})
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

    // Pull value + commission from uc_details where available
    if (list.length > 0) {
      const ids = list.map(d => d.id)
      const { data: ucData } = await supabase
        .from('uc_details')
        .select('deal_id, contract_price, commission_amount')
        .in('deal_id', ids)
      if (ucData) {
        const map: Record<string, { contract_price: number | null; commission_amount: number | null }> = {}
        for (const row of ucData as any[]) map[row.deal_id] = row
        setUcDetails(map)
      }
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

  if (deals.length === 0) return (
    <div style={{ background: 'var(--bg-card, #1A1E25)', border: '1px solid rgba(232,184,75,0.15)', borderRadius: 16, padding: '18px 20px' }}>
      <div className="wr-card-header">
        <span style={{ color: 'var(--accent-gold)', display: 'flex' }}>💰</span>
        <span className="wr-card-title" style={{ color: 'var(--accent-gold)' }}>Money Movers</span>
        <span className="wr-panel-line" />
        <span className="wr-panel-stat wr-panel-stat-gold">0</span>
      </div>
      <div style={{ fontSize: 12, color: '#4b5563', padding: '8px 0' }}>No active offer negotiations.</div>
    </div>
  )

  return (
    <div style={{
      background: 'var(--bg-card, #1A1E25)',
      border: '1px solid rgba(232,184,75,0.35)',
      borderRadius: 16,
      padding: '22px 24px',
      boxShadow: '0 0 0 1px rgba(232,184,75,0.08) inset, 0 4px 32px rgba(232,184,75,0.08)',
    }}>
      {/* Action modal */}
      {actionModal && typeof document !== 'undefined' && (
        <ActionModal deal={actionModal} onClose={() => setActionModal(null)} onSaved={handleActionSaved} />
      )}

      {/* Header */}
      <div className="wr-card-header" style={{ marginBottom: 20 }}>
        <span style={{ color: 'var(--accent-gold)', display: 'flex' }}>💰</span>
        <span className="wr-card-title" style={{ fontSize: 16, fontWeight: 900, color: 'var(--accent-gold)', letterSpacing: '0.06em', textShadow: '0 0 16px rgba(232,184,75,0.4)' }}>
          Money Movers
        </span>
        <span className="wr-panel-line" />
        <span className="wr-panel-stat wr-panel-stat-gold" style={{ fontSize: 18, fontWeight: 800 }}>{deals.length}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Active Offer Negotiations</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(232,184,75,0.2)' }}>
              {['Deal', 'Value', 'Commission', 'Action'].map((h, i) => (
                <th key={h} style={{
                  textAlign: i >= 1 && i <= 2 ? 'right' : 'left',
                  padding: '8px 12px',
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: 'rgba(232,184,75,0.6)',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deals.map(deal => {
              const uc = ucDetails[deal.id]
              const value = uc?.contract_price ?? deal.value ?? null
              const commission = uc?.commission_amount ?? deal.commission_estimated ?? null
              const action = deal.notes ?? ''

              return (
                <tr
                  key={deal.id}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(232,184,75,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Deal — address + name */}
                  <td style={{ padding: '14px 12px', maxWidth: 260 }}>
                    <a
                      href={`/warroom/deal?id=${deal.id}`}
                      style={{ color: '#F0F2FF', textDecoration: 'none', fontWeight: 700, fontSize: 15, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {formatAddress(deal.address) || formatAddress(deal.name)}
                    </a>
                    {deal.name && (
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {deal.name.replace(/^📁\s*/, '')}
                      </div>
                    )}
                  </td>

                  {/* Value */}
                  <td style={{ padding: '14px 12px', textAlign: 'right', color: '#E8B84B', fontFamily: 'monospace', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>
                    {formatCurrency(value)}
                  </td>

                  {/* Commission */}
                  <td style={{ padding: '14px 12px', textAlign: 'right', color: '#22c55e', fontFamily: 'monospace', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>
                    {formatCurrency(commission)}
                  </td>

                  {/* Action */}
                  <td style={{ padding: '14px 12px', minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {action ? (
                        <span
                          onClick={() => setActionModal(deal)}
                          style={{ fontSize: 12, color: '#E8B84B', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, maxWidth: 200 }}
                          title={action}
                        >
                          {action}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#374151', fontStyle: 'italic', flex: 1 }}>No action set</span>
                      )}
                      <button
                        onClick={() => setActionModal(deal)}
                        style={{
                          padding: '5px 12px', fontSize: 11, fontWeight: 800,
                          background: 'rgba(232,184,75,0.12)',
                          border: '1px solid rgba(232,184,75,0.4)',
                          borderRadius: 6, color: '#E8B84B', cursor: 'pointer',
                          whiteSpace: 'nowrap', fontFamily: 'inherit', letterSpacing: '0.04em',
                          flexShrink: 0,
                        }}
                      >
                        {action ? '✎ Edit' : '+ Action'}
                      </button>
                    </div>
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

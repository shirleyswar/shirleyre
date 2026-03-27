'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, Deal } from '@/lib/supabase'

function daysDiff(from: string) {
  return Math.floor((Date.now() - new Date(from).getTime()) / 86400000)
}

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

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  padding: '7px 10px',
  fontSize: 13,
  color: '#F0F2FF',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const btnStyle = (color: string, bg: string, border: string): React.CSSProperties => ({
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.06em',
  background: bg,
  border: `1px solid ${border}`,
  borderRadius: 8,
  color,
  cursor: 'pointer',
  transition: 'opacity 0.15s',
  fontFamily: 'inherit',
})

// ─── PIN Modal ───────────────────────────────────────────────────────────────
function PinModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  const [checking, setChecking] = useState(false)

  async function check() {
    setChecking(true)
    const hash = await sha256(pin)
    if (hash === PIN_HASH) {
      onConfirm()
    } else {
      setErr(true)
      setPin('')
    }
    setChecking(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1A1E25',
        border: '1px solid rgba(232,184,75,0.3)',
        borderRadius: 14,
        padding: '28px 32px',
        width: 300,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#E8B84B', marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Authorization Required
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>Enter PIN to continue</div>
        <input
          type="password"
          value={pin}
          onChange={e => { setPin(e.target.value); setErr(false) }}
          onKeyDown={e => e.key === 'Enter' && check()}
          placeholder="PIN"
          autoFocus
          style={{ ...inputStyle, textAlign: 'center', fontSize: 20, letterSpacing: '0.3em', marginBottom: 12 }}
        />
        {err && <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 10 }}>Incorrect PIN</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onCancel} style={btnStyle('#9ca3af', 'transparent', 'rgba(156,163,175,0.3)')}>
            Cancel
          </button>
          <button onClick={check} disabled={checking || pin.length === 0} style={btnStyle('#000', '#E8B84B', '#E8B84B')}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── HotPanel ────────────────────────────────────────────────────────────────
export default function HotPanel() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('status', 'hot')
      .order('updated_at', { ascending: false })
    setDeals((data ?? []) as Deal[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function moveToUC(deal: Deal) {
    const { data, error } = await supabase
      .from('deals')
      .update({ status: 'under_contract', updated_at: new Date().toISOString() })
      .eq('id', deal.id)
      .select()
      .single()
    if (!error && data) {
      setDeals(d => d.filter(x => x.id !== deal.id))
    }
  }

  function pinGate(action: () => void) {
    setPendingAction(() => action)
  }

  if (loading) return null
  if (deals.length === 0) return (
    <div style={{
      background: 'var(--bg-card, #1A1E25)',
      border: '1px solid rgba(251,146,60,0.15)',
      borderRadius: 16,
      padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fb923c', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Hot
        </span>
        <span style={{
          padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
          background: 'rgba(251,146,60,0.12)', color: '#fb923c',
          border: '1px solid rgba(251,146,60,0.3)',
        }}>0</span>
      </div>
      <div style={{ fontSize: 12, color: '#4b5563', textAlign: 'center', padding: '24px 0' }}>
        No active offer negotiations.
      </div>
    </div>
  )

  return (
    <div style={{
      background: 'var(--bg-card, #1A1E25)',
      border: '1px solid rgba(251,146,60,0.2)',
      borderRadius: 16,
      padding: '18px 20px',
    }}>
      {pendingAction && (
        <PinModal
          onConfirm={() => { pendingAction!(); setPendingAction(null) }}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fb923c', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Hot
        </span>
        <span style={{
          padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
          background: 'rgba(251,146,60,0.12)', color: '#fb923c',
          border: '1px solid rgba(251,146,60,0.3)',
        }}>{deals.length}</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Deal', 'Type', 'Value', 'Commission', 'Days Hot', 'Files', 'Actions'].map(h => (
                <th key={h} style={{
                  textAlign: 'left', padding: '6px 10px',
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: '#4b5563',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deals.map(deal => {
              const daysHot = daysDiff(deal.updated_at)
              const daysColor = daysHot > 14 ? '#ef4444' : daysHot > 7 ? '#fb923c' : '#22c55e'
              return (
                <tr key={deal.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {/* Deal */}
                  <td style={{ padding: '10px 10px' }}>
                    <a
                      href={`/warroom/deal?id=${deal.id}`}
                      style={{ color: '#F0F2FF', textDecoration: 'none', fontWeight: 600, fontSize: 12 }}
                    >
                      {deal.address || deal.name}
                    </a>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{deal.name}</div>
                  </td>
                  {/* Type */}
                  <td style={{ padding: '10px 10px', color: '#9ca3af', fontSize: 11 }}>
                    {deal.type.replace(/_/g, ' ')}
                  </td>
                  {/* Value */}
                  <td style={{ padding: '10px 10px', color: '#E8B84B', fontFamily: 'monospace', fontWeight: 600 }}>
                    {formatCurrency(deal.value)}
                  </td>
                  {/* Commission */}
                  <td style={{ padding: '10px 10px', color: '#9ca3af', fontFamily: 'monospace' }}>
                    {formatCurrency(deal.commission_estimated)}
                  </td>
                  {/* Days Hot */}
                  <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontWeight: 700, color: daysColor }}>
                    {daysHot}d
                  </td>
                  {/* Files */}
                  <td style={{ padding: '10px 10px' }}>
                    {deal.dropbox_link ? (
                      <a
                        href={deal.dropbox_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                          background: 'rgba(45,212,191,0.08)', color: '#2dd4bf',
                          border: '1px solid rgba(45,212,191,0.25)', textDecoration: 'none',
                        }}
                      >
                        Dropbox ↗
                      </a>
                    ) : (
                      <span style={{ color: '#4b5563', fontSize: 10 }}>—</span>
                    )}
                  </td>
                  {/* Actions */}
                  <td style={{ padding: '10px 10px' }}>
                    <button
                      onClick={() => pinGate(() => moveToUC(deal))}
                      style={{
                        padding: '4px 10px', fontSize: 11, fontWeight: 700,
                        background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.4)',
                        borderRadius: 7, color: '#2dd4bf', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      → UC
                    </button>
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

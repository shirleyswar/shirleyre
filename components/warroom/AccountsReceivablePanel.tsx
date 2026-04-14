'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArItem {
  id: string
  deal_id: string
  invoice_number: string | null
  deal_type: string | null
  commission_percent: number | null
  commission_amount: number | null
  sr_portion_percent: number | null
  sr_portion_amount: number | null
  payment_terms: string | null
  payment_terms_note: string | null
  co_broker: boolean | null
  co_broker_name: string | null
  co_broker_percent: number | null
  co_broker_amount: number | null
  co_broker_separate_invoice: boolean | null
  reimbursable_description: string | null
  reimbursable_amount: number | null
  deposit_retainage: number | null
  paid_to_date: number | null
  total_due: number | null
  status: 'receivable' | 'collected'
  collected_date: string | null
  created_at: string
  updated_at: string
  deals: {
    id: string
    name: string
    address: string | null
  } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PIN_HASH = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function formatMoney(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function calcTotalDue(item: ArItem): number {
  const comm = item.commission_amount ?? 0
  const ret  = item.deposit_retainage ?? 0
  const paid = item.paid_to_date ?? 0
  const reimb = item.reimbursable_amount ?? 0
  return comm - ret - paid + reimb
}

const DEAL_TYPE_LABELS: Record<string, string> = {
  full_service_lease: 'Full Service Lease',
  nnn_lease: 'NNN Lease',
  sale: 'Sale',
}

function dealTypeLabel(t: string | null): string {
  if (!t) return '—'
  return DEAL_TYPE_LABELS[t] ?? t
}

// ─── PIN Modal ────────────────────────────────────────────────────────────────

function PinModal({
  onCollect,
  onCancel,
}: {
  onCollect: (itemId: string) => Promise<void>
  onCancel: () => void
  itemId: string
}) {
  // not used — inlined below
  return null
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function AccountsReceivablePanel() {
  const [items, setItems] = useState<ArItem[]>([])
  const [legacyDeals, setLegacyDeals] = useState<{id:string;name:string;commission_estimated:number|null;commission_collected:number|null}[]>([])
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)

  // PIN modal state
  const [confirm, setConfirm] = useState<string | null>(null) // itemId
  const [pin, setPin] = useState('')
  const [pinErr, setPinErr] = useState(false)
  const [collecting, setCollecting] = useState(false)

  useEffect(() => {
    async function fetchItems() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('ar_items')
          .select('*, deals(id, name, address)')
          .order('created_at', { ascending: false })

        if (error) {
          // Table doesn't exist
          const code = (error as any).code
          if (code === '42P01' || code === 'PGRST205' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
            setTableError(true)
          } else {
            console.error('AR fetch error:', error)
          }
          setLoading(false)
          return
        }

        if (data) {
          setItems(data as ArItem[])
          // If ar_items is empty, pull pending_payment deals as a fallback display
          if (data.length === 0) {
            const { data: deals } = await supabase
              .from('deals')
              .select('id, name, commission_estimated, commission_collected')
              .eq('status', 'pending_payment')
            if (deals) setLegacyDeals(deals as typeof legacyDeals)
          }
        }
      } catch (e) {
        setTableError(true)
      }
      setLoading(false)
    }
    fetchItems()
  }, [])

  async function handleCollect(itemId: string, pinValue: string) {
    const hash = await sha256(pinValue)
    if (hash !== PIN_HASH) {
      setPinErr(true)
      setPin('')
      return
    }

    setCollecting(true)
    try {
      const { error } = await supabase
        .from('ar_items')
        .update({ status: 'collected', collected_date: new Date().toISOString() })
        .eq('id', itemId)

      if (!error) {
        setItems(prev => prev.map(it =>
          it.id === itemId
            ? { ...it, status: 'collected', collected_date: new Date().toISOString() }
            : it
        ))
        setConfirm(null)
        setPin('')
        setPinErr(false)
      }
    } finally {
      setCollecting(false)
    }
  }

  // Sort: receivable first (by created_at desc), then collected
  const receivable = items.filter(i => i.status === 'receivable')
  const collected  = items.filter(i => i.status === 'collected')
  const sorted = [...receivable, ...collected]

  const totalOutstanding = receivable.reduce((s, item) => s + calcTotalDue(item), 0)

  return (
    <div className="wr-card h-full min-h-[200px]">
      {/* Header */}
      <div className="wr-card-header">
        <span style={{ color: 'var(--accent-violet)', display: 'flex' }}>
          <DollarIcon />
        </span>
        <span className="wr-card-title">Receivable</span>
        <span className="wr-panel-line" />
        <span className="wr-panel-stat" style={{
          color: totalOutstanding > 0 ? 'var(--accent-violet)' : 'var(--success)',
          fontSize: 16,
        }}>
          {loading ? '—' : formatMoney(totalOutstanding)}
        </span>
      </div>

      {/* Outstanding big number */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          Outstanding
        </div>
        <div className="wr-big-number" style={{ color: totalOutstanding > 0 ? '#C084FC' : 'var(--success)' }}>
          {loading ? '—' : formatMoney(totalOutstanding)}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="skeleton" style={{ height: 60 }} />
      ) : tableError ? (
        <div style={{ padding: 16, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700, marginBottom: 8 }}>Database Setup Required</div>
          <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
            Run the AR setup SQL in Supabase SQL editor to enable this panel.
          </div>
        </div>
      ) : sorted.length === 0 ? (
        legacyDeals.length > 0 ? (
          // Legacy fallback: show pending_payment deals until AR items are created via Earned toggle
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontStyle: 'italic' }}>
              Pending payment deals — use the Earned toggle on each deal page to create a full AR item.
            </div>
            {legacyDeals.map(d => {
              const outstanding = Math.max(0, (d.commission_estimated || 0) - (d.commission_collected || 0))
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 7, border: '1px solid var(--border-subtle)' }}>
                  <a href={`/warroom/deal?id=${d.id}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.35)', color: '#A78BFA', textDecoration: 'none', fontSize: 13, flexShrink: 0 }}>↗</a>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Pending Payment</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#C084FC', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {outstanding > 0 ? `$${outstanding.toLocaleString('en-US', { minimumFractionDigits: 0 })}` : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--success)', textAlign: 'center', padding: '12px 0' }}>
            ✓ All commissions collected
          </div>
        )
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['', 'Deal', 'SR Portion', 'MS Portion', 'Total Due', 'Status', ''].map((col, i) => (
                  <th key={i} style={{
                    padding: '4px 8px',
                    textAlign: 'left',
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#4b5563',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(item => {
                const isCollected = item.status === 'collected'
                const totalDue = calcTotalDue(item)
                const rowStyle: React.CSSProperties = {
                  opacity: isCollected ? 0.55 : 1,
                  transition: 'opacity 0.2s',
                }
                return (
                  <tr key={item.id} style={rowStyle}>
                    {/* Arrow */}
                    <td style={{ padding: '7px 8px', verticalAlign: 'middle' }}>
                      <a
                        href={`/warroom/deal?id=${item.deal_id}`}
                        style={{
                          color: '#a78bfa',
                          textDecoration: 'none',
                          fontSize: 14,
                          fontWeight: 700,
                          lineHeight: 1,
                        }}
                        title="Open deal"
                      >
                        ↗
                      </a>
                    </td>
                    {/* Deal */}
                    <td style={{ padding: '7px 8px', color: '#F0F2FF', fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.deals?.name ?? '—'}
                    </td>
                    {/* SR Portion (was Commission) */}
                    <td style={{ padding: '7px 8px', color: '#F0F2FF', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {formatMoney(item.commission_amount)}
                    </td>
                    {/* MS Portion (was SR Portion) */}
                    <td style={{ padding: '7px 8px', color: '#F0F2FF', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {formatMoney(item.sr_portion_amount)}
                    </td>
                    {/* Total Due */}
                    <td style={{ padding: '7px 8px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: isCollected ? '#6b7280' : '#C084FC', whiteSpace: 'nowrap' }}>
                      {formatMoney(totalDue)}
                    </td>
                    {/* Status badge */}
                    <td style={{ padding: '7px 8px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 20,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        background: isCollected ? 'rgba(107,114,128,0.15)' : 'rgba(34,197,94,0.12)',
                        color: isCollected ? '#6b7280' : '#22c55e',
                      }}>
                        {isCollected ? 'Collected' : 'Receivable'}
                      </span>
                    </td>
                    {/* Collected button */}
                    <td style={{ padding: '7px 8px' }}>
                      {!isCollected && (
                        <button
                          onClick={() => { setConfirm(item.id); setPin(''); setPinErr(false) }}
                          style={{
                            padding: '3px 10px',
                            fontSize: 10,
                            fontWeight: 700,
                            background: 'rgba(34,197,94,0.08)',
                            border: '1px solid rgba(34,197,94,0.25)',
                            borderRadius: 6,
                            color: '#22c55e',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            fontFamily: 'inherit',
                          }}
                        >
                          Collected ✓
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PIN Modal via portal */}
      {confirm !== null && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setConfirm(null); setPin(''); setPinErr(false) }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#13112A', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 14, padding: 28, width: '90vw', maxWidth: 400 }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F2FF', marginBottom: 16 }}>Mark as Collected?</div>
            <input
              autoFocus
              type="tel"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                setPin(v)
                setPinErr(false)
                if (v.length === 4) handleCollect(confirm, v)
              }}
              placeholder="· · · ·"
              style={{
                width: '100%',
                fontSize: 28,
                textAlign: 'center',
                letterSpacing: '0.4em',
                padding: '12px',
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${pinErr ? '#ef4444' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 8,
                color: '#f0f0f0',
                outline: 'none',
                marginBottom: 6,
                boxSizing: 'border-box',
              }}
            />
            {pinErr && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 6, textAlign: 'center' }}>Incorrect PIN</div>}
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button
                onClick={() => { setConfirm(null); setPin(''); setPinErr(false) }}
                style={{ padding: '8px 24px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, color: '#888', cursor: 'pointer', fontSize: 13 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Icon ─────────────────────────────────────────────────────────────────────

function DollarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  )
}

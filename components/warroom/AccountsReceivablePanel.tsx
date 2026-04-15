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
  commission_amount: number | null      // SR Portion (total)
  sr_portion_amount: number | null      // MS Portion
  paid_to_date: number | null
  deposit_retainage: number | null
  reimbursable_amount: number | null
  status: 'receivable' | 'collected'
  collected_date: string | null
  created_at: string
  deals: { id: string; name: string; address: string | null } | null
  // computed after load
  payments_total?: number
}

interface ArPayment {
  id: string
  ar_item_id: string
  amount: number
  paid_date: string
  note: string | null
  created_at: string
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

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// MS Portion balance = sr_portion_amount - payments logged
function msBal(item: ArItem): number {
  const ms = item.sr_portion_amount ?? 0
  const paid = item.payments_total ?? item.paid_to_date ?? 0
  return Math.max(0, ms - paid)
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function AccountsReceivablePanel() {
  const [items, setItems] = useState<ArItem[]>([])
  const [payments, setPayments] = useState<Record<string, ArPayment[]>>({}) // keyed by ar_item_id
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)

  // Expanded row state
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Log payment modal
  const [payModal, setPayModal] = useState<ArItem | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }))
  const [payNote, setPayNote] = useState('')
  const [payPin, setPayPin] = useState('')
  const [payPinErr, setPayPinErr] = useState(false)
  const [payPinStep, setPayPinStep] = useState(false) // false = enter amount, true = enter PIN
  const [saving, setSaving] = useState(false)

  // Full-collect PIN modal
  const [collectModal, setCollectModal] = useState<string | null>(null)
  const [collectPin, setCollectPin] = useState('')
  const [collectPinErr, setCollectPinErr] = useState(false)
  const [collecting, setCollecting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('ar_items')
        .select('id, deal_id, invoice_number, deal_type, commission_amount, sr_portion_amount, paid_to_date, deposit_retainage, reimbursable_amount, status, collected_date, created_at, deals(id, name, address)')
        .order('created_at', { ascending: false })

      if (error) {
        const code = (error as any).code
        if (code === '42P01' || code === 'PGRST205' || error.message?.includes('does not exist')) {
          setTableError(true)
        }
        setLoading(false)
        return
      }

      if (data) {
        // Load payments for all items
        const arRows = data as unknown as ArItem[]
        const ids = arRows.map((i) => i.id)
        let payMap: Record<string, ArPayment[]> = {}
        if (ids.length > 0) {
          const { data: pData } = await supabase
            .from('ar_payments')
            .select('*')
            .in('ar_item_id', ids)
            .order('paid_date', { ascending: false })
          if (pData) {
            for (const p of pData as ArPayment[]) {
              if (!payMap[p.ar_item_id]) payMap[p.ar_item_id] = []
              payMap[p.ar_item_id].push(p)
            }
          }
        }

        const enriched = arRows.map(item => ({
          ...item,
          payments_total: (payMap[item.id] ?? []).reduce((s, p) => s + p.amount, 0),
        }))

        setItems(enriched)
        setPayments(payMap)
      }
    } catch { setTableError(true) }
    setLoading(false)
  }

  // ── Log partial payment ────────────────────────────────────────────────────
  function openPayModal(item: ArItem) {
    setPayModal(item)
    setPayAmount('')
    setPayDate(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }))
    setPayNote('')
    setPayPin('')
    setPayPinErr(false)
    setPayPinStep(false)
  }

  async function submitPayment() {
    if (!payModal) return
    const hash = await sha256(payPin)
    if (hash !== PIN_HASH) { setPayPinErr(true); setPayPin(''); return }

    setSaving(true)
    const amt = parseFloat(payAmount.replace(/[^0-9.]/g, ''))
    if (isNaN(amt) || amt <= 0) { setSaving(false); return }

    try {
      const { data: newPay, error } = await supabase
        .from('ar_payments')
        .insert({ ar_item_id: payModal.id, amount: amt, paid_date: payDate, note: payNote.trim() || null })
        .select().single()

      if (!error && newPay) {
        const p = newPay as ArPayment
        setPayments(prev => ({
          ...prev,
          [payModal.id]: [p, ...(prev[payModal.id] ?? [])],
        }))
        setItems(prev => prev.map(item => {
          if (item.id !== payModal.id) return item
          const newTotal = (item.payments_total ?? 0) + amt
          const ms = item.sr_portion_amount ?? 0
          const remaining = Math.max(0, ms - newTotal)
          return {
            ...item,
            payments_total: newTotal,
            status: remaining <= 0 ? 'collected' : 'receivable',
            collected_date: remaining <= 0 ? new Date().toISOString() : item.collected_date,
          }
        }))
        // Auto-mark collected if fully paid
        const ms = payModal.sr_portion_amount ?? 0
        const prev_total = payModal.payments_total ?? 0
        if (prev_total + amt >= ms && ms > 0) {
          await supabase.from('ar_items')
            .update({ status: 'collected', collected_date: new Date().toISOString() })
            .eq('id', payModal.id)
        }
        setPayModal(null)
      }
    } catch {}
    setSaving(false)
  }

  // ── Full collect ───────────────────────────────────────────────────────────
  async function handleFullCollect(itemId: string, pinValue: string) {
    const hash = await sha256(pinValue)
    if (hash !== PIN_HASH) { setCollectPinErr(true); setCollectPin(''); return }

    setCollecting(true)
    const item = items.find(i => i.id === itemId)
    if (item) {
      const ms = item.sr_portion_amount ?? 0
      const alreadyPaid = item.payments_total ?? 0
      const remainder = Math.max(0, ms - alreadyPaid)

      // Log a payment for the remaining balance
      if (remainder > 0) {
        const { data: newPay } = await supabase
          .from('ar_payments')
          .insert({ ar_item_id: itemId, amount: remainder, paid_date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }), note: 'Full collection' })
          .select().single()
        if (newPay) {
          setPayments(prev => ({
            ...prev,
            [itemId]: [newPay as ArPayment, ...(prev[itemId] ?? [])],
          }))
        }
      }

      await supabase.from('ar_items')
        .update({ status: 'collected', collected_date: new Date().toISOString() })
        .eq('id', itemId)

      setItems(prev => prev.map(i => i.id === itemId
        ? { ...i, status: 'collected', collected_date: new Date().toISOString(), payments_total: ms }
        : i
      ))
    }
    setCollectModal(null)
    setCollectPin('')
    setCollecting(false)
  }

  const receivable = items.filter(i => i.status === 'receivable')
  const collected  = items.filter(i => i.status === 'collected')
  const sorted = [...receivable, ...collected]

  const totalMsOutstanding = receivable.reduce((s, item) => s + msBal(item), 0)

  const totalMsPortionGross = items.reduce((s, i) => s + (i.sr_portion_amount ?? 0), 0)
  const totalMsCollected   = items.reduce((s, i) => s + (i.payments_total ?? i.paid_to_date ?? 0), 0)
  const pctCollected = totalMsPortionGross > 0 ? Math.min(100, (totalMsCollected / totalMsPortionGross) * 100) : 0

  return (
    <div>

      {/* ── HERO — matches Sale Commission card style ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #091520 100%)',
        border: '1.5px solid rgba(167,139,250,0.3)',
        borderRadius: 16,
        padding: '22px 28px',
        boxShadow: '0 0 0 1px rgba(167,139,250,0.06), 0 8px 40px rgba(0,0,0,0.5)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle glow */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, background: 'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 6, height: 28, borderRadius: 3, background: 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.7)', fontFamily: 'var(--font-body)', marginBottom: 2 }}>
                Receivables
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em' }}>
                {receivable.length} active · {collected.length} collected
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: '#a78bfa', background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(167,139,250,0.4)', borderRadius: 6, padding: '4px 10px',
          }}>
            {receivable.length > 0 ? 'Pending' : '✓ Clear'}
          </div>
        </div>

        {/* Stats strip — label-over-value columns with dividers, hero stat last */}
        <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', flexWrap: 'wrap' }}>
          {[
            { label: 'Active Deals',   value: loading ? '—' : String(receivable.length), dim: true },
            { label: 'MS Gross',       value: loading ? '—' : fmt(totalMsPortionGross) },
            { label: 'Collected',      value: loading ? '—' : fmt(totalMsCollected) },
          ].map((s, i) => (
            <div key={s.label} style={{
              flex: '1 1 110px',
              padding: '14px 20px',
              borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: s.dim ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.3)', minHeight: 28, display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: s.dim ? 600 : 700, color: s.dim ? 'rgba(255,255,255,0.45)' : '#F0F2FF', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
                {s.value}
              </div>
            </div>
          ))}

          {/* Hero stat — MS Outstanding, green accent like "My Commission" */}
          <div style={{
            flex: '1 1 180px',
            padding: '14px 20px',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            background: totalMsOutstanding > 0 ? 'rgba(192,132,252,0.05)' : 'rgba(34,197,94,0.04)',
            borderRadius: 10,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: totalMsOutstanding > 0 ? 'rgba(192,132,252,0.6)' : 'rgba(34,197,94,0.6)', minHeight: 28, display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
              MS Outstanding
            </div>
            <div style={{
              fontSize: 28, fontWeight: 800,
              color: totalMsOutstanding > 0 ? '#C084FC' : '#22c55e',
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.1,
              textShadow: totalMsOutstanding > 0 ? '0 0 24px rgba(192,132,252,0.3)' : '0 0 24px rgba(34,197,94,0.3)',
            }}>
              {loading ? '—' : fmt(totalMsOutstanding)}
            </div>
            {totalMsPortionGross > 0 && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-body)', letterSpacing: '0.02em', marginTop: 2 }}>
                {pctCollected.toFixed(0)}% collected
              </div>
            )}
          </div>
        </div>
        {/* ── Deal rows — inside the hero card ── */}
        {(loading || tableError || sorted.length > 0) && (
          <div style={{ marginTop: 20, borderTop: '1px solid rgba(167,139,250,0.12)', paddingTop: 16 }}>
            {loading ? (
              <div className="skeleton" style={{ height: 52, borderRadius: 8 }} />
            ) : tableError ? (
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Run the AR setup SQL in Supabase to enable rows.</div>
            ) : sorted.length === 0 ? (
              <div style={{ fontSize: 13, color: '#22c55e', textAlign: 'center', padding: '8px 0' }}>✓ Nothing outstanding</div>
            ) : (
              <div style={{ width: '100%' }}>
                {/* Column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 100px 100px', gap: '0 8px', padding: '4px 6px', marginBottom: 4 }}>
                  {['', 'DEAL', 'MS PORTION', 'BALANCE'].map((h, i) => (
                    <div key={i} style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.35)', fontFamily: 'monospace', textAlign: i <= 1 ? 'left' : 'right' }}>
                      {h}
                    </div>
                  ))}
                </div>

          {sorted.map(item => {
                const isCollected = item.status === 'collected'
                const msPaid = item.payments_total ?? item.paid_to_date ?? 0
                const msBalance = msBal(item)
                const msTotal = item.sr_portion_amount ?? 0
                const pctPaid = msTotal > 0 ? Math.min(100, (msPaid / msTotal) * 100) : 0
                const itemPayments = payments[item.id] ?? []
                const isExpanded = expandedId === item.id

                return (
                  <div key={item.id}>
                    {/* Main row — 4 cols: arrow | deal | ms portion | balance+actions */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '24px 1fr 100px 100px',
                        gap: '0 8px',
                        padding: '11px 6px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        opacity: isCollected ? 0.55 : 1,
                        cursor: 'pointer',
                        alignItems: 'center',
                        borderLeft: isCollected ? '2px solid rgba(107,114,128,0.25)' : '2px solid rgba(167,139,250,0.5)',
                        borderRadius: '0 4px 4px 0',
                      }}
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      {/* Arrow */}
                      <div onClick={e => e.stopPropagation()}>
                        <a href={`/warroom/deal?id=${item.deal_id}`} style={{ color: '#a78bfa', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>↗</a>
                      </div>

                      {/* Deal name + progress bar */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>{isExpanded ? '▾' : '▸'}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#F0F2FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                            {item.deals?.name ?? '—'}
                          </span>
                        </div>
                        {!isCollected && msTotal > 0 && (
                          <div style={{ marginTop: 4, height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                            <div style={{ height: 2, width: `${pctPaid}%`, background: pctPaid >= 100 ? '#22c55e' : '#a78bfa', borderRadius: 1, transition: 'width 0.3s' }} />
                          </div>
                        )}
                      </div>

                      {/* MS Portion */}
                      <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(msTotal)}
                      </div>

                      {/* Balance + collect buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: isCollected ? '#22c55e' : '#C084FC', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', textShadow: isCollected ? 'none' : '0 0 14px rgba(192,132,252,0.3)' }}>
                          {isCollected ? '✓' : fmt(msBalance)}
                        </div>
                        {!isCollected && (
                          <div style={{ display: 'flex', gap: 3 }}>
                            <button onClick={() => openPayModal(item)}
                              style={{ padding: '3px 7px', fontSize: 9, fontWeight: 800, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: 4, color: '#a78bfa', cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'uppercase', fontFamily: 'inherit' }}>
                              + Pay
                            </button>
                            <button onClick={() => { setCollectModal(item.id); setCollectPin(''); setCollectPinErr(false) }}
                              style={{ padding: '3px 7px', fontSize: 9, fontWeight: 800, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 4, color: '#22c55e', cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'uppercase', fontFamily: 'inherit' }}>
                              Full ✓
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Payment history — expanded */}
                    {isExpanded && (
                      <div style={{ padding: '8px 6px 10px 32px', background: 'rgba(139,92,246,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        {itemPayments.length === 0 ? (
                          <div style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>No payments logged yet.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '100px 90px 1fr', gap: '0 10px', marginBottom: 4 }}>
                              {['Date', 'Amount', 'Note'].map(h => (
                                <div key={h} style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>{h}</div>
                              ))}
                            </div>
                            {itemPayments.map(p => (
                              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '100px 90px 1fr', gap: '0 10px', padding: '3px 0', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                                <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>
                                  {new Date(p.paid_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                                <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(p.amount)}</div>
                                <div style={{ fontSize: 11, color: '#6b7280' }}>{p.note ?? '—'}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Log Payment Modal ── */}
      {payModal !== null && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setPayModal(null)}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#13112A', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 14, padding: 28, width: '90vw', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.6)', fontFamily: 'monospace' }}>Log Payment</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2FF' }}>{payModal.deals?.name ?? '—'}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              MS Balance: <span style={{ color: '#C084FC', fontWeight: 700 }}>{fmt(msBal(payModal))}</span>
            </div>

            {!payPinStep ? (
              <>
                <div>
                  <div style={lbl}>Amount Received</div>
                  <input
                    autoFocus
                    type="text"
                    inputMode="decimal"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    placeholder="$0.00"
                    style={inp}
                  />
                </div>
                <div>
                  <div style={lbl}>Date</div>
                  <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={{ ...inp, colorScheme: 'dark' as any }} />
                </div>
                <div>
                  <div style={lbl}>Note (optional)</div>
                  <input type="text" value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Check #, wire ref..." style={inp} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setPayModal(null)} style={cancelBtn}>Cancel</button>
                  <button
                    onClick={() => { if (payAmount) setPayPinStep(true) }}
                    disabled={!payAmount.trim()}
                    style={{ ...confirmBtn, opacity: payAmount.trim() ? 1 : 0.4 }}
                  >
                    Next →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#9ca3af' }}>Enter PIN to confirm <span style={{ color: '#22c55e', fontWeight: 700 }}>{fmt(parseFloat(payAmount.replace(/[^0-9.]/g, '')) || 0)}</span> payment</div>
                <input
                  autoFocus
                  type="tel"
                  inputMode="numeric"
                  maxLength={4}
                  value={payPin}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                    setPayPin(v)
                    setPayPinErr(false)
                    if (v.length === 4) submitPayment()
                  }}
                  placeholder="· · · ·"
                  style={{ width: '100%', fontSize: 28, textAlign: 'center', letterSpacing: '0.4em', padding: '12px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${payPinErr ? '#ef4444' : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, color: '#f0f0f0', outline: 'none', boxSizing: 'border-box' }}
                />
                {payPinErr && <div style={{ color: '#ef4444', fontSize: 11, textAlign: 'center' }}>Incorrect PIN</div>}
                <button onClick={() => setPayPinStep(false)} style={cancelBtn}>← Back</button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── Full Collect PIN Modal ── */}
      {collectModal !== null && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setCollectModal(null); setCollectPin(''); setCollectPinErr(false) }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#13112A', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 14, padding: 28, width: '90vw', maxWidth: 400 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F2FF', marginBottom: 6 }}>Mark Fully Collected?</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 16 }}>Logs the remaining balance as a final payment.</div>
            <input
              autoFocus type="tel" inputMode="numeric" maxLength={4} value={collectPin}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                setCollectPin(v)
                setCollectPinErr(false)
                if (v.length === 4) handleFullCollect(collectModal, v)
              }}
              placeholder="· · · ·"
              style={{ width: '100%', fontSize: 28, textAlign: 'center', letterSpacing: '0.4em', padding: '12px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${collectPinErr ? '#ef4444' : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, color: '#f0f0f0', outline: 'none', marginBottom: 6, boxSizing: 'border-box' }}
            />
            {collectPinErr && <div style={{ color: '#ef4444', fontSize: 11, textAlign: 'center', marginBottom: 8 }}>Incorrect PIN</div>}
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={() => { setCollectModal(null); setCollectPin(''); setCollectPinErr(false) }} style={{ padding: '8px 24px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, color: '#888', cursor: 'pointer', fontSize: 13 }}>
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

// ─── Shared input styles ──────────────────────────────────────────────────────
const lbl: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'rgba(167,139,250,0.6)',
  marginBottom: 5, fontFamily: 'monospace',
}
const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
  padding: '9px 12px', fontSize: 14, color: '#F2EDE4',
  outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box',
}
const cancelBtn: React.CSSProperties = {
  flex: 1, padding: '10px', background: 'transparent',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
  color: '#6B7280', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
}
const confirmBtn: React.CSSProperties = {
  flex: 2, padding: '10px', background: 'rgba(167,139,250,0.15)',
  border: '1px solid rgba(167,139,250,0.4)', borderRadius: 8,
  color: '#a78bfa', fontSize: 14, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'var(--font-body)',
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

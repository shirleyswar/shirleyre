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

  return (
    <div className="wr-card h-full min-h-[200px]">
      {/* Header */}
      <div className="wr-card-header">
        <span style={{ color: 'var(--accent-violet)', display: 'flex' }}><DollarIcon /></span>
        <span className="wr-card-title">RECEIVABLES</span>
        <span className="wr-panel-line" />
        <span className="wr-panel-stat" style={{
          color: totalMsOutstanding > 0 ? 'var(--accent-violet)' : 'var(--success)',
          fontSize: 16,
        }}>
          {loading ? '—' : fmt(totalMsOutstanding)}
        </span>
      </div>

      {/* MS Outstanding big number */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          MS Portion Outstanding
        </div>
        <div className="wr-big-number" style={{ color: totalMsOutstanding > 0 ? '#C084FC' : 'var(--success)' }}>
          {loading ? '—' : fmt(totalMsOutstanding)}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="skeleton" style={{ height: 60 }} />
      ) : tableError ? (
        <div style={{ padding: 16, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700, marginBottom: 8 }}>Database Setup Required</div>
          <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>Run the AR setup SQL in Supabase to enable this panel.</div>
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--success)', textAlign: 'center', padding: '12px 0' }}>
          ✓ Nothing outstanding
        </div>
      ) : (
        <div style={{ width: '100%' }}>
          {/* Column headers — commission card style */}
          <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 110px 110px 110px', gap: '0 8px', padding: '6px 8px', borderBottom: '1px solid rgba(167,139,250,0.15)', marginBottom: 4 }}>
            {['', 'DEAL', 'MS PORTION', 'COLLECTED', 'BALANCE'].map((h, i) => (
              <div key={i} style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.45)', fontFamily: 'monospace', textAlign: i <= 1 ? 'left' : 'right' }}>
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
                    {/* Main row */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '28px 1fr 110px 110px 110px',
                        gap: '0 8px',
                        padding: '10px 8px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        opacity: isCollected ? 0.6 : 1,
                        cursor: 'pointer',
                        alignItems: 'center',
                        borderLeft: isCollected ? '2px solid rgba(107,114,128,0.3)' : '2px solid rgba(167,139,250,0.5)',
                        borderRadius: '0 4px 4px 0',
                        transition: 'background 0.1s',
                      }}
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      {/* Arrow link */}
                      <div onClick={e => e.stopPropagation()}>
                        <a href={`/warroom/deal?id=${item.deal_id}`} style={{ color: '#a78bfa', textDecoration: 'none', fontSize: 14, fontWeight: 700 }} title="Open deal">↗</a>
                      </div>

                      {/* Deal name + progress bar */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{isExpanded ? '▾' : '▸'}</span>
                          <span style={{
                            fontSize: 13, fontWeight: 700, color: '#F0F2FF',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            letterSpacing: '-0.01em',
                          }}>
                            {item.deals?.name ?? '—'}
                          </span>
                        </div>
                        {!isCollected && msTotal > 0 && (
                          <div style={{ marginTop: 5, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }}>
                            <div style={{ height: 2, width: `${pctPaid}%`, background: pctPaid >= 100 ? '#22c55e' : '#a78bfa', borderRadius: 1, transition: 'width 0.3s' }} />
                          </div>
                        )}
                      </div>

                      {/* MS Portion */}
                      <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#F0F2FF', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
                        {fmt(msTotal)}
                      </div>

                      {/* MS Collected */}
                      <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: msPaid > 0 ? '#22c55e' : 'rgba(255,255,255,0.2)', fontVariantNumeric: 'tabular-nums' }}>
                        {msPaid > 0 ? fmt(msPaid) : '—'}
                      </div>

                      {/* MS Balance + actions stacked */}
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: isCollected ? '#22c55e' : '#C084FC', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', textShadow: isCollected ? 'none' : '0 0 16px rgba(192,132,252,0.3)' }}>
                          {isCollected ? '✓ Done' : fmt(msBalance)}
                        </div>
                        {!isCollected && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              onClick={() => openPayModal(item)}
                              style={{ padding: '3px 8px', fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: 4, color: '#a78bfa', cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'uppercase', fontFamily: 'inherit' }}
                            >
                              + Pay
                            </button>
                            <button
                              onClick={() => { setCollectModal(item.id); setCollectPin(''); setCollectPinErr(false) }}
                              style={{ padding: '3px 8px', fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 4, color: '#22c55e', cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'uppercase', fontFamily: 'inherit' }}
                            >
                              Full ✓
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Expanded payment history ── */}
                    {isExpanded && (
                      <div style={{ padding: '8px 8px 12px 44px', background: 'rgba(139,92,246,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        {itemPayments.length === 0 ? (
                          <div style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>No payments logged yet.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '120px 100px 1fr', gap: '0 12px', marginBottom: 4 }}>
                              {['Date', 'Amount', 'Note'].map(h => (
                                <div key={h} style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>{h}</div>
                              ))}
                            </div>
                            {itemPayments.map(p => (
                              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '120px 100px 1fr', gap: '0 12px', padding: '4px 0', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                                <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>
                                  {new Date(p.paid_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                                <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                  {fmt(p.amount)}
                                </div>
                                <div style={{ fontSize: 12, color: '#6b7280' }}>{p.note ?? '—'}</div>
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

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, Deal, ContractDeadline, DeadlineType, DeadlineStatus } from '@/lib/supabase'

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

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.floor((target.getTime() - now.getTime()) / 86400000)
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

// Deadline type badge colors
const TYPE_COLORS: Record<DeadlineType, { bg: string; text: string; label: string }> = {
  inspection: { bg: 'rgba(251,146,60,0.15)', text: '#fb923c', label: 'Inspection' },
  financing:  { bg: 'rgba(79,142,247,0.15)', text: '#4F8EF7', label: 'Financing' },
  appraisal:  { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa', label: 'Appraisal' },
  title:      { bg: 'rgba(45,212,191,0.15)', text: '#2dd4bf', label: 'Title' },
  survey:     { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af', label: 'Survey' },
  closing:    { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', label: 'Closing' },
  custom:     { bg: 'rgba(107,114,128,0.12)', text: '#6b7280', label: 'Custom' },
}

const STATUS_STYLES: Record<DeadlineStatus, { bg: string; text: string; label: string }> = {
  pending:   { bg: 'rgba(79,142,247,0.15)', text: '#4F8EF7', label: 'Pending' },
  satisfied: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', label: 'Satisfied' },
  extended:  { bg: 'rgba(251,146,60,0.15)', text: '#fb923c', label: 'Extended' },
  missed:    { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', label: 'Missed' },
}

function getDaysColor(days: number, status: DeadlineStatus): string {
  if (status === 'satisfied') return 'var(--text-dim)'
  if (days <= 1) return '#ef4444'
  if (days <= 7) return '#fb923c'
  return '#22c55e'
}

// ─── Deadline Row ────────────────────────────────────────────────────────────

interface DeadlineRowProps {
  deadline: ContractDeadline
  onSatisfy: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (deadline: ContractDeadline) => void
}

function DeadlineRow({ deadline, onSatisfy, onDelete, onEdit }: DeadlineRowProps) {
  const days = daysUntil(deadline.deadline_date)
  const satisfied = deadline.status === 'satisfied'
  const typeInfo = TYPE_COLORS[deadline.deadline_type]
  const statusInfo = STATUS_STYLES[deadline.status]

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '7px 12px',
      borderRadius: 6,
      background: 'rgba(255,255,255,0.02)',
      marginBottom: 4,
      opacity: satisfied ? 0.6 : 1,
    }}>
      {/* Label */}
      <div style={{ flex: '0 0 160px', minWidth: 0 }}>
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          textDecoration: satisfied ? 'line-through' : 'none',
          color: satisfied ? 'var(--text-dim)' : 'var(--text-primary)',
        } as React.CSSProperties}>
          {deadline.label}
        </span>
      </div>

      {/* Type badge */}
      <div style={{ flex: '0 0 80px' }}>
        <span style={{
          display: 'inline-block',
          padding: '1px 7px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          background: typeInfo.bg,
          color: typeInfo.text,
        }}>
          {typeInfo.label}
        </span>
      </div>

      {/* Date */}
      <div style={{ flex: '0 0 60px', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
        {formatDate(deadline.deadline_date)}
      </div>

      {/* Days remaining */}
      <div style={{ flex: '0 0 70px', textAlign: 'right' }}>
        {satisfied ? (
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>—</span>
        ) : (
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: getDaysColor(days, deadline.status),
          }}>
            {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'Today' : `${days}d`}
          </span>
        )}
      </div>

      {/* Status badge */}
      <div style={{ flex: '0 0 70px' }}>
        <span style={{
          display: 'inline-block',
          padding: '1px 7px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          background: statusInfo.bg,
          color: statusInfo.text,
        }}>
          {statusInfo.label}
        </span>
      </div>

      {/* Notes */}
      {deadline.notes && (
        <div style={{ flex: 1, fontSize: 10, color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {deadline.notes}
        </div>
      )}
      {!deadline.notes && <div style={{ flex: 1 }} />}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {!satisfied && (
          <button
            onClick={() => onSatisfy(deadline.id)}
            title="Mark Satisfied"
            style={{
              padding: '3px 8px', fontSize: 11, fontWeight: 700,
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 5, color: '#22c55e', cursor: 'pointer',
            }}>
            ✓
          </button>
        )}
        <button
          onClick={() => onEdit(deadline)}
          title="Edit"
          style={{
            padding: '3px 7px', fontSize: 11,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 5, color: 'var(--text-dim)', cursor: 'pointer',
          }}>
          ✎
        </button>
        <button
          onClick={() => onDelete(deadline.id)}
          title="Delete"
          style={{
            padding: '3px 7px', fontSize: 11,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 5, color: 'var(--text-dim)', cursor: 'pointer',
          }}>
          ✕
        </button>
      </div>
    </div>
  )
}

// ─── Add / Edit Deadline Form ─────────────────────────────────────────────────

interface DeadlineFormProps {
  dealId: string
  editing?: ContractDeadline | null
  onSaved: (deadline: ContractDeadline) => void
  onCancel: () => void
}

function DeadlineForm({ dealId, editing, onSaved, onCancel }: DeadlineFormProps) {
  const [label, setLabel] = useState(editing?.label ?? '')
  const [type, setType] = useState<DeadlineType>(editing?.deadline_type ?? 'inspection')
  const [date, setDate] = useState(editing?.deadline_date ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!label.trim() || !date) { setErr('Label and date are required'); return }
    setSaving(true)
    setErr('')

    const payload = {
      deal_id: dealId,
      label: label.trim(),
      deadline_type: type,
      deadline_date: date,
      notes: notes.trim() || null,
      status: (editing?.status ?? 'pending') as DeadlineStatus,
    }

    try {
      if (editing) {
        const { data, error } = await supabase
          .from('contract_deadlines')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editing.id)
          .select()
          .single()
        if (error) throw error
        onSaved(data as ContractDeadline)
      } else {
        const { data, error } = await supabase
          .from('contract_deadlines')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        onSaved(data as ContractDeadline)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      setErr(msg)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    flex: 1, fontSize: 11, padding: '5px 8px',
    background: 'var(--bg-elevated)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 5, color: 'var(--text-primary)', outline: 'none',
  }

  return (
    <div style={{
      padding: '10px 12px',
      background: 'rgba(45,212,191,0.04)',
      border: '1px solid rgba(45,212,191,0.15)',
      borderRadius: 8,
      marginTop: 8,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-teal)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
        {editing ? 'Edit Deadline' : 'Add Deadline'}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Label (e.g. Inspection Period)"
          style={{ ...inputStyle, minWidth: 180 }}
        />

        <select
          value={type}
          onChange={e => setType(e.target.value as DeadlineType)}
          style={{ ...inputStyle, flex: '0 0 120px', minWidth: 120 }}
        >
          <option value="inspection">Inspection</option>
          <option value="financing">Financing</option>
          <option value="appraisal">Appraisal</option>
          <option value="title">Title</option>
          <option value="survey">Survey</option>
          <option value="closing">Closing</option>
          <option value="custom">Custom</option>
        </select>

        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{ ...inputStyle, flex: '0 0 140px', minWidth: 130 }}
        />

        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          style={{ ...inputStyle, minWidth: 140 }}
        />

        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '5px 14px', fontSize: 13, fontWeight: 700,
            background: saving ? 'rgba(45,212,191,0.08)' : 'rgba(45,212,191,0.18)',
            border: '1px solid rgba(45,212,191,0.4)',
            borderRadius: 6, color: '#2dd4bf', cursor: saving ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
          }}>
          {saving ? '…' : (editing ? 'Update' : 'Save')}
        </button>

        <button
          onClick={onCancel}
          style={{
            padding: '5px 10px', fontSize: 13,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, color: 'var(--text-dim)', cursor: 'pointer',
          }}>
          Cancel
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#ef4444' }}>{err}</div>
      )}
    </div>
  )
}

// ─── Expanded Deal Subpanel ───────────────────────────────────────────────────

interface DealSubpanelProps {
  deal: ContractDeal
  onDeadlinesChange: (dealId: string, deadlines: ContractDeadline[]) => void
}

function DealSubpanel({ deal, onDeadlinesChange }: DealSubpanelProps) {
  const [deadlines, setDeadlines] = useState<ContractDeadline[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingDeadline, setEditingDeadline] = useState<ContractDeadline | null>(null)

  const fetchDeadlines = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('contract_deadlines')
        .select('*')
        .eq('deal_id', deal.id)
        .order('deadline_date')
      const list = (data as ContractDeadline[]) || []
      setDeadlines(list)
      onDeadlinesChange(deal.id, list)
    } catch {
      setDeadlines([])
    } finally {
      setLoading(false)
    }
  }, [deal.id, onDeadlinesChange])

  useEffect(() => {
    fetchDeadlines()
  }, [fetchDeadlines])

  async function handleSatisfy(id: string) {
    try {
      await supabase
        .from('contract_deadlines')
        .update({ status: 'satisfied', updated_at: new Date().toISOString() })
        .eq('id', id)
      setDeadlines(prev => prev.map(d => d.id === id ? { ...d, status: 'satisfied' as DeadlineStatus } : d))
      onDeadlinesChange(deal.id, deadlines.map(d => d.id === id ? { ...d, status: 'satisfied' as DeadlineStatus } : d))
    } catch {}
  }

  async function handleDelete(id: string) {
    try {
      await supabase.from('contract_deadlines').delete().eq('id', id)
      const updated = deadlines.filter(d => d.id !== id)
      setDeadlines(updated)
      onDeadlinesChange(deal.id, updated)
    } catch {}
  }

  function handleEdit(deadline: ContractDeadline) {
    setEditingDeadline(deadline)
    setShowAddForm(false)
  }

  function handleSaved(saved: ContractDeadline) {
    if (editingDeadline) {
      const updated = deadlines.map(d => d.id === saved.id ? saved : d)
      setDeadlines(updated)
      onDeadlinesChange(deal.id, updated)
      setEditingDeadline(null)
    } else {
      const updated = [...deadlines, saved].sort((a, b) => a.deadline_date.localeCompare(b.deadline_date))
      setDeadlines(updated)
      onDeadlinesChange(deal.id, updated)
      setShowAddForm(false)
    }
  }

  return (
    <div style={{
      padding: '12px 16px 14px',
      background: 'rgba(255,255,255,0.02)',
      borderLeft: '2px solid rgba(45,212,191,0.3)',
      marginLeft: 8,
      borderRadius: '0 0 6px 6px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#2dd4bf', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Contingency Tracker
        </div>
        {!showAddForm && !editingDeadline && (
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              fontSize: 11, padding: '3px 10px', fontWeight: 600,
              background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.25)',
              borderRadius: 5, color: '#2dd4bf', cursor: 'pointer',
            }}>
            + Add Deadline
          </button>
        )}
      </div>

      {/* Column headers */}
      {!loading && deadlines.length > 0 && (
        <div style={{ display: 'flex', gap: 10, padding: '0 12px 4px', marginBottom: 2 }}>
          <div style={{ flex: '0 0 160px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Label</div>
          <div style={{ flex: '0 0 80px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Type</div>
          <div style={{ flex: '0 0 60px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Date</div>
          <div style={{ flex: '0 0 70px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Days</div>
          <div style={{ flex: '0 0 70px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</div>
          <div style={{ flex: 1 }} />
          <div style={{ flex: '0 0 90px' }} />
        </div>
      )}

      {/* Deadline list */}
      {loading ? (
        <div style={{ padding: '8px 0', fontSize: 11, color: 'var(--text-dim)' }}>Loading…</div>
      ) : deadlines.length === 0 && !showAddForm ? (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '6px 0' }}>
          No deadlines tracked yet.{' '}
          <button
            onClick={() => setShowAddForm(true)}
            style={{ background: 'none', border: 'none', color: '#2dd4bf', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: 0 }}>
            + Add one
          </button>
        </div>
      ) : (
        <div>
          {deadlines.map(d => (
            editingDeadline?.id === d.id ? (
              <div key={d.id}>
                <DeadlineForm
                  dealId={deal.id}
                  editing={editingDeadline}
                  onSaved={handleSaved}
                  onCancel={() => setEditingDeadline(null)}
                />
              </div>
            ) : (
              <DeadlineRow
                key={d.id}
                deadline={d}
                onSatisfy={handleSatisfy}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            )
          ))}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <DeadlineForm
          dealId={deal.id}
          editing={null}
          onSaved={handleSaved}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </div>
  )
}

// ─── Deadlines Summary Cell ───────────────────────────────────────────────────

interface DeadlinesSummaryProps {
  deadlines: ContractDeadline[]
  onExpand: () => void
  isExpanded: boolean
}

function DeadlinesSummary({ deadlines, onExpand, isExpanded }: DeadlinesSummaryProps) {
  const pending = deadlines.filter(d => d.status === 'pending')
  
  if (deadlines.length === 0) {
    return (
      <button
        onClick={onExpand}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, color: '#2dd4bf', padding: '2px 4px', fontWeight: 600,
        }}>
        + Add
      </button>
    )
  }

  const nearest = pending
    .map(d => ({ d, days: daysUntil(d.deadline_date) }))
    .sort((a, b) => a.days - b.days)[0]

  const urgentColor = nearest && nearest.days <= 7
    ? (nearest.days <= 1 ? '#ef4444' : '#fb923c')
    : 'var(--text-muted)'

  return (
    <button
      onClick={onExpand}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '2px 4px', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
      }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: pending.length > 0 ? '#4F8EF7' : 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
        {pending.length}
      </span>
      {nearest && nearest.days <= 7 && (
        <span style={{ fontSize: 11, color: urgentColor, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {nearest.days <= 0 ? 'PAST' : `${nearest.days}d`} {isExpanded ? '▲' : '▼'}
        </span>
      )}
      {!(nearest && nearest.days <= 7) && (
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {isExpanded ? '▲' : '▼'}
        </span>
      )}
    </button>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function UnderContractPanel() {
  const [deals, setDeals] = useState<ContractDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null)
  const [dealDeadlines, setDealDeadlines] = useState<Record<string, ContractDeadline[]>>({})

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
    // Poll every 30s so newly-UC'd deals appear without manual refresh
    const interval = setInterval(fetchDeals, 30000)
    return () => clearInterval(interval)
  }, [])

  function handleToggleExpand(dealId: string) {
    setExpandedDeal(prev => prev === dealId ? null : dealId)
  }

  const handleDeadlinesChange = useCallback((dealId: string, deadlines: ContractDeadline[]) => {
    setDealDeadlines(prev => ({ ...prev, [dealId]: deadlines }))
  }, [])

  return (
    <div className="wr-card">
      {/* Panel header */}
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['', 'Deal', 'Type', 'Value', 'Commission', 'Day', '', 'Deadlines', 'Files'].map((h, i) => (
                  <th key={i} style={{
                    textAlign: i === 0 ? 'center' : i >= 5 ? 'center' : 'left',
                    padding: '5px 8px',
                    fontSize: 11,
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
                const isExpanded = expandedDeal === deal.id
                const deadlines = dealDeadlines[deal.id] || []

                return (
                  <>
                    <tr
                      key={deal.id}
                      style={{
                        borderBottom: isExpanded
                          ? 'none'
                          : i < deals.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        transition: 'background 0.1s',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleToggleExpand(deal.id)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {/* Expand chevron */}
                      <td style={{ padding: '10px 6px 10px 10px', width: 20, textAlign: 'center' }}>
                        <span style={{
                          fontSize: 10,
                          color: isExpanded ? '#2dd4bf' : 'var(--text-dim)',
                          transition: 'transform 0.2s',
                          display: 'inline-block',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        }}>
                          ▶
                        </span>
                      </td>

                      {/* Deal name */}
                      <td style={{ padding: '10px 8px', color: 'var(--text-primary)', fontWeight: 500, maxWidth: 200 }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13 }}>{deal.name}</div>
                        {deal.address && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {deal.address}
                          </div>
                        )}
                      </td>

                      {/* Type */}
                      <td style={{ padding: '10px 8px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 11, textTransform: 'capitalize' }}>
                        {deal.type.replace(/_/g, ' ')}
                      </td>

                      {/* Value */}
                      <td style={{ padding: '10px 8px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                        {deal.value ? formatCurrency(deal.value) : '—'}
                      </td>

                      {/* Commission */}
                      <td style={{ padding: '10px 8px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                        <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>
                          {deal.commission_estimated ? formatCurrency(deal.commission_estimated) : '—'}
                        </span>
                      </td>

                      {/* Day counter */}
                      <td style={{ padding: '10px 8px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', textAlign: 'center', fontSize: 13 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {deal.days_since_contract ?? '—'}
                        </span>
                      </td>

                      {/* Sparkline */}
                      <td style={{ padding: '6px 8px 6px 4px', width: 64 }} onClick={e => e.stopPropagation()}>
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

                      {/* Deadlines summary */}
                      <td style={{ padding: '6px 8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <DeadlinesSummary
                          deadlines={deadlines}
                          onExpand={() => handleToggleExpand(deal.id)}
                          isExpanded={isExpanded}
                        />
                      </td>

                      {/* Dropbox */}
                      <td style={{ padding: '6px 8px' }} onClick={e => e.stopPropagation()}>
                        <DropboxCell
                          dealId={deal.id}
                          url={deal.dropbox_link}
                          onSaved={(id, url) => setDeals(prev => prev.map(d => d.id === id ? { ...d, dropbox_link: url } : d))}
                        />
                      </td>
                    </tr>

                    {/* Expanded subpanel */}
                    {isExpanded && (
                      <tr key={`${deal.id}-expand`} style={{ borderBottom: i < deals.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <td colSpan={9} style={{ padding: '0 10px 10px' }}>
                          <DealSubpanel
                            deal={deal}
                            onDeadlinesChange={handleDeadlinesChange}
                          />
                        </td>
                      </tr>
                    )}
                  </>
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
    deal_source: null, notes: null, dropbox_link: null, parent_deal_id: null,
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

const DROPBOX_FALLBACK = 'https://www.dropbox.com/scl/fo/r9dq6fwfmp81tv1ec02gb/ANqIOI6hM94j-v4jv9czcpo?rlkey=0bd4kas03bfl3vakbcln602tp&st=dc2a5sqy&dl=0'

function DropboxCell({ dealId, url, onSaved }: { dealId: string; url: string | null | undefined; onSaved: (id: string, url: string | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(url || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const val = draft.trim() || null
    try {
      await supabase.from('deals').update({ dropbox_link: val }).eq('id', dealId)
      onSaved(dealId, val)
    } catch {}
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 200 }} onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          placeholder="Paste Dropbox link..."
          style={{ flex: 1, fontSize: 11, padding: '4px 8px', background: 'var(--bg-elevated)', border: '1px solid rgba(0,97,255,0.4)', borderRadius: 5, color: 'var(--text-primary)', outline: 'none', minWidth: 0 }}
        />
        <button onClick={save} disabled={saving} style={{ padding: '4px 8px', fontSize: 11, fontWeight: 700, background: 'rgba(0,97,255,0.2)', border: '1px solid rgba(0,97,255,0.4)', borderRadius: 5, color: '#4F8EF7', cursor: 'pointer' }}>
          {saving ? '…' : '✓'}
        </button>
        <button onClick={() => setEditing(false)} style={{ padding: '4px 6px', fontSize: 11, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
      <a href={url || DROPBOX_FALLBACK} target="_blank" rel="noopener noreferrer"
        title={url ? 'Open deal folder' : 'Open Active Listings folder'}
        onClick={e => e.stopPropagation()}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: url ? 'rgba(0,97,255,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${url ? 'rgba(0,97,255,0.3)' : 'rgba(255,255,255,0.08)'}`, color: url ? '#4F8EF7' : 'var(--text-dim)', textDecoration: 'none' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L6 6.5L12 11L18 6.5L12 2ZM6 6.5L0 11L6 15.5L12 11L6 6.5ZM18 6.5L12 11L18 15.5L24 11L18 6.5ZM6 15.5L12 20L18 15.5L12 11L6 15.5Z"/></svg>
      </a>
      <button onClick={() => { setDraft(url || ''); setEditing(true) }}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 5, background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 10 }}>
        ✎
      </button>
    </div>
  )
}

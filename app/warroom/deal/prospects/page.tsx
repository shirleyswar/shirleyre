'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Suspense } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Prospect {
  id: string
  deal_id: string
  name: string
  phone: string | null
  email: string | null
  rating: number
  notes: string | null
  created_at: string
  updated_at: string
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  padding: '8px 11px',
  fontSize: 13,
  color: '#F0F2FF',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  colorScheme: 'dark',
}

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#6b7280',
  marginBottom: 4,
  display: 'block',
}

function btnStyle(color: string, bg: string, border: string): React.CSSProperties {
  return {
    padding: '7px 16px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.06em',
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 8,
    color,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
}

// ─── Star Rating ─────────────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  size = 18,
  readonly = false,
}: {
  value: number
  onChange?: (v: number) => void
  size?: number
  readonly?: boolean
}) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          onClick={() => !readonly && onChange?.(i === value ? 0 : i)}
          onMouseEnter={() => !readonly && setHover(i)}
          onMouseLeave={() => !readonly && setHover(0)}
          style={{
            fontSize: size,
            cursor: readonly ? 'default' : 'pointer',
            color: i <= (hover || value) ? '#E8B84B' : 'rgba(255,255,255,0.15)',
            transition: 'color 0.1s',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          ★
        </span>
      ))}
    </div>
  )
}

// ─── Add/Edit Prospect Form ───────────────────────────────────────────────────

function ProspectForm({
  dealId,
  existing,
  onSaved,
  onCancel,
}: {
  dealId: string
  existing?: Prospect
  onSaved: (p: Prospect) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!name.trim()) { setErr('Name is required'); return }
    setSaving(true)
    setErr('')
    const payload = {
      deal_id: dealId,
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      rating,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    }
    let data: Prospect | null = null
    let error: unknown = null
    if (existing) {
      const res = await supabase.from('deal_prospects').update(payload).eq('id', existing.id).select().single()
      data = res.data as Prospect
      error = res.error
    } else {
      const res = await supabase.from('deal_prospects').insert(payload).select().single()
      data = res.data as Prospect
      error = res.error
    }
    setSaving(false)
    if (error || !data) { setErr('Save failed — try again'); return }
    onSaved(data)
  }

  return (
    <div style={{
      background: '#1A1E25',
      border: '1px solid rgba(232,184,75,0.25)',
      borderRadius: 12,
      padding: '20px 22px',
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#E8B84B', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
        {existing ? 'Edit Prospect' : 'Add Prospect'}
      </div>

      {/* Name */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Name *</label>
        <input
          autoFocus
          style={inputStyle}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Full name"
          onKeyDown={e => e.key === 'Enter' && save()}
        />
      </div>

      {/* Phone + Email row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Phone</label>
          <input
            style={inputStyle}
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="225-555-1234"
            type="tel"
          />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input
            style={inputStyle}
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@email.com"
            type="email"
          />
        </div>
      </div>

      {/* Rating */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Rating</label>
        <StarRating value={rating} onChange={setRating} />
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Notes</label>
        <textarea
          style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Interest level, budget, timeline, anything relevant…"
        />
      </div>

      {err && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10, fontWeight: 600 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={btnStyle('#9ca3af', 'transparent', 'rgba(156,163,175,0.3)')}>
          Cancel
        </button>
        <button onClick={save} disabled={saving} style={btnStyle('#000', '#E8B84B', '#E8B84B')}>
          {saving ? 'Saving…' : existing ? 'Save Changes' : 'Add Prospect'}
        </button>
      </div>
    </div>
  )
}

// ─── Prospect Card ────────────────────────────────────────────────────────────

function ProspectCard({
  prospect,
  onEdit,
  onDelete,
}: {
  prospect: Prospect
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const dateStr = new Date(prospect.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div style={{
      background: '#1A1E25',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Main row */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Left: info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + date */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#F0F2FF' }}>{prospect.name}</span>
            <span style={{ fontSize: 10, color: '#6b7280', letterSpacing: '0.04em' }}>{dateStr}</span>
          </div>

          {/* Stars */}
          {prospect.rating > 0 && (
            <div style={{ marginBottom: 6 }}>
              <StarRating value={prospect.rating} readonly size={14} />
            </div>
          )}

          {/* Phone + Email */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {prospect.phone && (
              <a href={`tel:${prospect.phone}`} style={{ fontSize: 13, color: '#9ca3af', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                {prospect.phone}
              </a>
            )}
            {prospect.email && (
              <a href={`mailto:${prospect.email}`} style={{ fontSize: 13, color: '#9ca3af', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,12 2,6"/>
                </svg>
                {prospect.email}
              </a>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <button
            onClick={onEdit}
            style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 700,
              background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.3)',
              borderRadius: 6, color: '#E8B84B', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 700,
              background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 6, color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Notes — toggle */}
      {prospect.notes && (
        <>
          <div
            onClick={() => setExpanded(e => !e)}
            style={{
              padding: '8px 16px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              fontSize: 11, fontWeight: 700, color: '#4b5563',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              userSelect: 'none',
            }}
          >
            <span>Notes</span>
            <span style={{ fontSize: 10, opacity: 0.6 }}>{expanded ? '▲' : '▼'}</span>
          </div>
          {expanded && (
            <div style={{
              padding: '10px 16px 14px',
              fontSize: 13, color: '#9ca3af', lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              borderTop: '1px solid rgba(255,255,255,0.04)',
            }}>
              {prospect.notes}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Inner Page ───────────────────────────────────────────────────────────────

function ProspectsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dealId = searchParams.get('id')

  const [dealAddress, setDealAddress] = useState<string>('')
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Prospect | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'date' | 'rating' | 'name'>('date')

  const load = useCallback(async () => {
    if (!dealId) { setLoading(false); return }

    // Load deal name + prospects in parallel
    const [dealRes, prospectsRes] = await Promise.all([
      supabase.from('deals').select('address, name').eq('id', dealId).single(),
      supabase.from('deal_prospects').select('*').eq('deal_id', dealId).order('created_at', { ascending: false }),
    ])

    if (dealRes.data) {
      setDealAddress(dealRes.data.address || dealRes.data.name || 'Deal')
    }
    if (prospectsRes.data) {
      setProspects(prospectsRes.data as Prospect[])
    }
    setLoading(false)
  }, [dealId])

  useEffect(() => { load() }, [load])

  function sortedProspects(): Prospect[] {
    return [...prospects].sort((a, b) => {
      if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }

  function handleSaved(p: Prospect) {
    setProspects(prev => {
      const exists = prev.find(x => x.id === p.id)
      return exists ? prev.map(x => x.id === p.id ? p : x) : [p, ...prev]
    })
    setShowForm(false)
    setEditing(null)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await supabase.from('deal_prospects').delete().eq('id', id)
    setProspects(prev => prev.filter(p => p.id !== id))
    setDeleting(null)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0D0F14', color: '#F0F2FF', padding: 32 }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <div style={{ width: '50%', height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.07)', animation: 'pulse 1.6s ease-in-out infinite' }} />
    </div>
  )

  if (!dealId) return (
    <div style={{ minHeight: '100vh', background: '#0D0F14', color: '#F0F2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 14, color: '#6b7280' }}>No deal specified</div>
    </div>
  )

  const sorted = sortedProspects()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0D0F14',
      color: '#F0F2FF',
      fontFamily: 'var(--font-body, system-ui, sans-serif)',
    }}>
      {/* ── Header ── */}
      <header style={{
        background: '#13171D',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        {/* Back to deal */}
        <button
          onClick={() => router.push(`/warroom/deal?id=${dealId}`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '6px 14px',
            color: '#9ca3af',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.06em',
            flexShrink: 0,
            fontFamily: 'inherit',
          }}
        >
          ← Deal
        </button>

        {/* Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'clamp(15px, 2.5vw, 20px)', fontWeight: 800, color: '#E8B84B', lineHeight: 1.2 }}>
            {dealAddress}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Prospects
          </div>
        </div>

        {/* Add button */}
        <button
          onClick={() => { setShowForm(true); setEditing(null) }}
          style={{
            padding: '8px 20px',
            fontSize: 12, fontWeight: 800,
            letterSpacing: '0.08em',
            background: 'rgba(232,184,75,0.12)',
            border: '1px solid rgba(232,184,75,0.4)',
            borderRadius: 10,
            color: '#E8B84B',
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          + Add Prospect
        </button>
      </header>

      {/* ── Body ── */}
      <div style={{ padding: '20px 24px', maxWidth: 760, margin: '0 auto' }}>

        {/* Add form */}
        {showForm && !editing && (
          <ProspectForm
            dealId={dealId}
            onSaved={handleSaved}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Sort controls */}
        {prospects.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4b5563' }}>Sort:</span>
            {(['date', 'rating', 'name'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                style={{
                  padding: '4px 12px', fontSize: 11, fontWeight: 700,
                  background: sortBy === s ? 'rgba(232,184,75,0.12)' : 'transparent',
                  border: `1px solid ${sortBy === s ? 'rgba(232,184,75,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 6,
                  color: sortBy === s ? '#E8B84B' : '#6b7280',
                  cursor: 'pointer', fontFamily: 'inherit',
                  textTransform: 'capitalize',
                }}
              >
                {s === 'date' ? 'Newest' : s === 'rating' ? '★ Rating' : 'A–Z'}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#4b5563' }}>
              {prospects.length} prospect{prospects.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Empty state */}
        {prospects.length === 0 && !showForm && (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 12,
          }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.25 }}>👤</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 6 }}>No prospects yet</div>
            <div style={{ fontSize: 12, color: '#374151', marginBottom: 20 }}>Track potential buyers, tenants, or parties of interest</div>
            <button
              onClick={() => setShowForm(true)}
              style={{
                padding: '9px 22px', fontSize: 13, fontWeight: 700,
                background: 'rgba(232,184,75,0.1)', border: '1px solid rgba(232,184,75,0.35)',
                borderRadius: 10, color: '#E8B84B', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              + Add First Prospect
            </button>
          </div>
        )}

        {/* Prospect list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(p => (
            editing?.id === p.id ? (
              <ProspectForm
                key={p.id}
                dealId={dealId}
                existing={p}
                onSaved={handleSaved}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <ProspectCard
                key={p.id}
                prospect={p}
                onEdit={() => { setEditing(p); setShowForm(false) }}
                onDelete={() => handleDelete(p.id)}
              />
            )
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function ProspectsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0D0F14', color: '#F0F2FF', padding: 32 }}>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        <div style={{ width: '50%', height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.07)', animation: 'pulse 1.6s ease-in-out infinite' }} />
      </div>
    }>
      <ProspectsPageInner />
    </Suspense>
  )
}

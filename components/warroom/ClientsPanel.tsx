'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export interface Client {
  id: string
  name: string
  phone: string | null
  email: string | null
  company: string | null
  client_type: 'buyer' | 'tenant' | 'investor' | 'other'
  property_type: string | null
  size_min: number | null
  size_max: number | null
  budget_min: number | null
  budget_max: number | null
  location_pref: string | null
  notes: string | null
  status: 'active' | 'inactive' | 'closed'
  priority: 'hot' | 'standard' | 'inactive'
  source: string | null
  linked_deal_id: string | null
  created_at: string
  updated_at: string
}

const TYPE_COLORS: Record<string, { bg: string; border: string; color: string; label: string }> = {
  buyer:    { bg: 'rgba(79,142,247,0.12)',  border: 'rgba(79,142,247,0.4)',  color: '#4F8EF7', label: 'Buyer' },
  tenant:   { bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.4)',   color: '#22c55e', label: 'Tenant' },
  investor: { bg: 'rgba(232,184,75,0.12)',  border: 'rgba(232,184,75,0.4)',  color: '#E8B84B', label: 'Investor' },
  other:    { bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.3)', color: '#9ca3af', label: 'Other' },
}

function fmt(n: number | null, prefix = '$') {
  if (!n) return '—'
  if (n >= 1_000_000) return `${prefix}${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${prefix}${(n/1_000).toFixed(0)}K`
  return `${prefix}${n}`
}

export default function ClientsPanel() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  // New client form state
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'buyer' | 'tenant' | 'investor' | 'other'>('buyer')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPropType, setNewPropType] = useState('')
  const [newLocationPref, setNewLocationPref] = useState('')
  const [newBudgetMin, setNewBudgetMin] = useState('')
  const [newBudgetMax, setNewBudgetMax] = useState('')
  const [newPriority, setNewPriority] = useState<'hot' | 'standard' | 'inactive'>('standard')
  const [newNotes, setNewNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchClients() }, [])

  async function fetchClients() {
    try {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'active')
        .order('priority', { ascending: true }) // hot first
        .order('created_at', { ascending: false })
        .limit(100)
      if (data) setClients(data as Client[])
    } catch {}
    setLoading(false)
  }

  function resetForm() {
    setNewName(''); setNewType('buyer'); setNewPhone(''); setNewEmail('')
    setNewPropType(''); setNewLocationPref(''); setNewBudgetMin('')
    setNewBudgetMax(''); setNewPriority('standard'); setNewNotes('')
  }

  async function addClient() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const { data, error } = await supabase.from('clients').insert({
        name: newName.trim(),
        client_type: newType,
        phone: newPhone.trim() || null,
        email: newEmail.trim() || null,
        property_type: newPropType.trim() || null,
        location_pref: newLocationPref.trim() || null,
        budget_min: newBudgetMin ? parseFloat(newBudgetMin.replace(/[^0-9.]/g,'')) : null,
        budget_max: newBudgetMax ? parseFloat(newBudgetMax.replace(/[^0-9.]/g,'')) : null,
        priority: newPriority,
        notes: newNotes.trim() || null,
        status: 'active',
      }).select().single()
      if (data && !error) {
        setClients(prev => [data as Client, ...prev])
        // Auto-add to Contacts table
        try {
          await supabase.from('contacts').insert({
            name: newName.trim(),
            phone: newPhone.trim() || null,
            email: newEmail.trim() || null,
            role: newType, // buyer / tenant / investor / other
            notes: [
              newPropType ? `Property: ${newPropType}` : null,
              newLocationPref ? `Location: ${newLocationPref}` : null,
              newNotes.trim() || null,
            ].filter(Boolean).join(' · ') || null,
            priority: newPriority === 'hot' ? 'hvp' : 'standard',
          })
        } catch {} // non-blocking — client saved regardless
        resetForm()
        setShowAdd(false)
      }
    } catch {}
    setSaving(false)
  }

  const hotClients = clients.filter(c => c.priority === 'hot')
  const standardClients = clients.filter(c => c.priority !== 'hot')

  return (
    <div className="wr-card">
      {/* Header */}
      <div className="wr-card-header">
        <span style={{ color: '#2DD4BF', display: 'flex', alignItems: 'center', filter: 'drop-shadow(0 0 8px rgba(45,212,191,0.7))' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </span>
        <span className="wr-rank1" style={{ color: '#2DD4BF', textShadow: '0 0 16px rgba(45,212,191,0.5)' }}>Clients</span>
        <div className="wr-panel-line" style={{ background: 'linear-gradient(to right, rgba(45,212,191,0.35), transparent)' }} />
        <span className="wr-panel-stat" style={{ fontSize: 18, fontWeight: 800, color: '#2DD4BF' }}>
          {clients.length > 0 ? clients.length : '—'}
        </span>
      </div>

      {/* Add button */}
      <div style={{ marginBottom: 14 }}>
        <button onClick={() => setShowAdd(true)} className="wr-btn-orbit" style={{ fontSize: 12, borderColor: 'rgba(79,142,247,0.4)', color: '#4F8EF7' }}>
          + Add Client
        </button>
      </div>

      {/* Add Client Modal — rendered via portal to escape Framer transform context */}
      {showAdd && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px 24px' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowAdd(false); resetForm() } }}
        >
          <div style={{ background: '#13112A', border: '1px solid rgba(79,142,247,0.35)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(79,142,247,0.6)', fontFamily: 'monospace' }}>
              New Client Lead
            </div>

            {/* Name */}
            <input autoFocus type="text" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) addClient(); if (e.key === 'Escape') { setShowAdd(false); resetForm() } }}
              placeholder="Client name *"
              style={inputStyle} />

            {/* Type */}
            <div>
              <div style={labelStyle}>Type</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['buyer','tenant','investor','other'] as const).map(t => (
                  <button key={t} onClick={() => setNewType(t)}
                    style={{ flex: 1, padding: '7px 4px', borderRadius: 7, border: `1px solid ${newType === t ? TYPE_COLORS[t].border : 'rgba(255,255,255,0.1)'}`, background: newType === t ? TYPE_COLORS[t].bg : 'transparent', color: newType === t ? TYPE_COLORS[t].color : '#6B7280', fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                    {TYPE_COLORS[t].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Phone + Email */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Phone</div>
                <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="(555) 000-0000" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Email</div>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@..." style={inputStyle} />
              </div>
            </div>

            {/* Property Type + Location */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Property Type</div>
                <input type="text" value={newPropType} onChange={e => setNewPropType(e.target.value)} placeholder="Office, Retail, Industrial..." style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Location Pref.</div>
                <input type="text" value={newLocationPref} onChange={e => setNewLocationPref(e.target.value)} placeholder="BR, Gonzales, South..." style={inputStyle} />
              </div>
            </div>

            {/* Budget */}
            <div>
              <div style={labelStyle}>Budget Range</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="text" value={newBudgetMin} onChange={e => setNewBudgetMin(e.target.value)} placeholder="Min" style={{ ...inputStyle, flex: 1 }} />
                <span style={{ color: '#6B7280', fontSize: 12 }}>–</span>
                <input type="text" value={newBudgetMax} onChange={e => setNewBudgetMax(e.target.value)} placeholder="Max" style={{ ...inputStyle, flex: 1 }} />
              </div>
            </div>

            {/* Priority */}
            <div>
              <div style={labelStyle}>Priority</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {([['hot','🔥 Hot','#ef4444'],['standard','Standard','#9ca3af'],['inactive','Inactive','#4b5563']] as const).map(([v,label,color]) => (
                  <button key={v} onClick={() => setNewPriority(v)}
                    style={{ flex: 1, padding: '7px 4px', borderRadius: 7, border: `1px solid ${newPriority === v ? color : 'rgba(255,255,255,0.1)'}`, background: newPriority === v ? `${color}20` : 'transparent', color: newPriority === v ? color : '#6B7280', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <div style={labelStyle}>Notes / Needs</div>
              <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Property requirements, timeline, deal context..."
                rows={3} style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'var(--font-body)' }} />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowAdd(false); resetForm() }}
                style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#6B7280', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Cancel
              </button>
              <button onClick={addClient} disabled={saving || !newName.trim()}
                style={{ flex: 2, padding: '11px', background: saving || !newName.trim() ? 'rgba(79,142,247,0.1)' : 'rgba(79,142,247,0.2)', border: '1px solid rgba(79,142,247,0.5)', borderRadius: 8, color: '#4F8EF7', fontSize: 14, fontWeight: 700, cursor: saving || !newName.trim() ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', opacity: saving || !newName.trim() ? 0.5 : 1 }}>
                {saving ? 'Saving...' : 'Save Client'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Client List */}
      {loading ? (
        <SkeletonList />
      ) : clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          No active client leads — add one above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {hotClients.length > 0 && (
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#ef4444', marginBottom: 6, fontFamily: 'monospace', paddingLeft: 2 }}>
              🔥 Hot
            </div>
          )}
          {[...hotClients, ...standardClients].map((client, i) => (
            <ClientRow
              key={client.id}
              client={client}
              isEven={i % 2 === 0}
              onClick={() => router.push(`/warroom/client?id=${client.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Client Row ────────────────────────────────────────────────────────────────

function ClientRow({ client, isEven, onClick }: { client: Client; isEven: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const tc = TYPE_COLORS[client.client_type] ?? TYPE_COLORS.other
  const isHot = client.priority === 'hot'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 10px',
        borderRadius: 8,
        background: isHot
          ? (hovered ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.06)')
          : hovered ? 'rgba(79,142,247,0.07)' : isEven ? 'rgba(255,255,255,0.015)' : 'transparent',
        borderLeft: isHot ? '2px solid rgba(239,68,68,0.5)' : hovered ? '2px solid rgba(79,142,247,0.5)' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.1s',
      }}
      onClick={onClick}
    >
      {/* Type badge */}
      <span style={{
        padding: '2px 8px', borderRadius: 4,
        background: tc.bg, border: `1px solid ${tc.border}`,
        fontSize: 9, fontWeight: 800, color: tc.color,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        fontFamily: 'monospace', flexShrink: 0, whiteSpace: 'nowrap',
      }}>
        {tc.label}
      </span>

      {/* Name + context */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {isHot && <span style={{ fontSize: 11 }}>🔥</span>}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {client.property_type && <span>{client.property_type}</span>}
          {client.location_pref && <span>· {client.location_pref}</span>}
          {(client.budget_min || client.budget_max) && (
            <span>· {fmt(client.budget_min)}–{fmt(client.budget_max)}</span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <span style={{ color: 'rgba(79,142,247,0.5)', fontSize: 14, flexShrink: 0, transition: 'color 0.1s', ...(hovered ? { color: '#4F8EF7' } : {}) }}>›</span>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
  color: '#F2EDE4',
  outline: 'none',
  fontFamily: 'var(--font-body)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'rgba(79,142,247,0.6)',
  marginBottom: 5, fontFamily: 'monospace',
}

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[70, 85, 60].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: 44, width: `${w}%`, borderRadius: 8 }} />
      ))}
    </div>
  )
}

function ClientIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      <path d="M19 8l2 2-2 2"/>
      <path d="M15 10h6"/>
    </svg>
  )
}

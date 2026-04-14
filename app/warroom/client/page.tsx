'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Client } from '@/components/warroom/ClientsPanel'

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

function ClientDetailInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit state
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<'buyer'|'tenant'|'investor'|'other'>('buyer')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editCompany, setEditCompany] = useState('')
  const [editPropType, setEditPropType] = useState('')
  const [editSizeMin, setEditSizeMin] = useState('')
  const [editSizeMax, setEditSizeMax] = useState('')
  const [editBudgetMin, setEditBudgetMin] = useState('')
  const [editBudgetMax, setEditBudgetMax] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editPriority, setEditPriority] = useState<'hot'|'standard'|'inactive'>('standard')
  const [editSource, setEditSource] = useState('')
  const [editStatus, setEditStatus] = useState<'active'|'inactive'|'closed'>('active')

  useEffect(() => {
    if (id) fetchClient()
    else setLoading(false)
  }, [id])

  async function fetchClient() {
    try {
      const { data } = await supabase.from('clients').select('*').eq('id', id).single()
      if (data) {
        setClient(data as Client)
        populateEdit(data as Client)
      }
    } catch {}
    setLoading(false)
  }

  function populateEdit(c: Client) {
    setEditName(c.name); setEditType(c.client_type)
    setEditPhone(c.phone || ''); setEditEmail(c.email || '')
    setEditCompany(c.company || ''); setEditPropType(c.property_type || '')
    setEditSizeMin(c.size_min?.toString() || ''); setEditSizeMax(c.size_max?.toString() || '')
    setEditBudgetMin(c.budget_min?.toString() || ''); setEditBudgetMax(c.budget_max?.toString() || '')
    setEditLocation(c.location_pref || ''); setEditNotes(c.notes || '')
    setEditPriority(c.priority); setEditSource(c.source || ''); setEditStatus(c.status)
  }

  async function saveEdit() {
    if (!editName.trim() || !client) return
    setSaving(true)
    try {
      const updates = {
        name: editName.trim(), client_type: editType,
        phone: editPhone.trim() || null, email: editEmail.trim() || null,
        company: editCompany.trim() || null, property_type: editPropType.trim() || null,
        size_min: editSizeMin ? parseInt(editSizeMin) : null,
        size_max: editSizeMax ? parseInt(editSizeMax) : null,
        budget_min: editBudgetMin ? parseFloat(editBudgetMin.replace(/[^0-9.]/g,'')) : null,
        budget_max: editBudgetMax ? parseFloat(editBudgetMax.replace(/[^0-9.]/g,'')) : null,
        location_pref: editLocation.trim() || null, notes: editNotes.trim() || null,
        priority: editPriority, source: editSource.trim() || null, status: editStatus,
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase.from('clients').update(updates).eq('id', client.id).select().single()
      if (data && !error) { setClient(data as Client); setEditing(false) }
    } catch {}
    setSaving(false)
  }

  async function closeClient() {
    if (!client || !confirm('Mark this client as closed?')) return
    await supabase.from('clients').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', client.id)
    router.push('/warroom')
  }

  if (loading) return <LoadingState />
  if (!client) return <NotFound onBack={() => router.push('/warroom')} />

  const tc = TYPE_COLORS[client.client_type] ?? TYPE_COLORS.other

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page, #0D0F14)', color: '#F0F2FF', fontFamily: 'var(--font-body, system-ui)' }}>
      {/* Top bar */}
      <div style={{ height: 52, background: '#111520', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
        <button onClick={() => router.push('/warroom')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.3)', borderRadius: 8, color: '#4F8EF7', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          ← War Room
        </button>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>CLIENTS ›</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#F0F2FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</span>
        <div style={{ flex: 1 }} />
        {client.priority === 'hot' && <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 800 }}>🔥 HOT</span>}
        <span style={{ padding: '3px 10px', borderRadius: 4, background: tc.bg, border: `1px solid ${tc.border}`, fontSize: 10, fontWeight: 800, color: tc.color, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'monospace' }}>
          {tc.label}
        </span>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#F0F2FF', margin: 0, letterSpacing: '-0.02em' }}>{client.name}</h1>
          {client.company && <div style={{ fontSize: 13, color: 'rgba(232,184,75,0.7)', marginTop: 4 }}>{client.company}</div>}
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
            Added {new Date(client.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        {!editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Section title="Contact">
              <Row label="Phone" value={client.phone ? <a href={`tel:${client.phone}`} style={{ color: '#4F8EF7' }}>{client.phone}</a> : null} />
              <Row label="Email" value={client.email ? <a href={`mailto:${client.email}`} style={{ color: '#4F8EF7' }}>{client.email}</a> : null} />
              <Row label="Company" value={client.company} />
              <Row label="Source" value={client.source} />
            </Section>

            <Section title="Property Needs">
              <Row label="Type" value={client.property_type} />
              <Row label="Location" value={client.location_pref} />
              <Row label="Size" value={(client.size_min || client.size_max) ? `${client.size_min?.toLocaleString() || '—'} – ${client.size_max?.toLocaleString() || '—'} SF` : null} />
              <Row label="Budget" value={(client.budget_min || client.budget_max) ? `${fmt(client.budget_min)} – ${fmt(client.budget_max)}` : null} />
            </Section>

            {client.notes && (
              <Section title="Notes / Needs">
                <div style={{ fontSize: 13, color: '#c9d0e0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{client.notes}</div>
              </Section>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => { populateEdit(client); setEditing(true) }}
                style={{ padding: '11px 20px', background: 'rgba(79,142,247,0.15)', border: '1px solid rgba(79,142,247,0.4)', borderRadius: 8, color: '#4F8EF7', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Edit Client
              </button>
              <button onClick={closeClient}
                style={{ padding: '11px 20px', background: 'rgba(156,163,175,0.08)', border: '1px solid rgba(156,163,175,0.2)', borderRadius: 8, color: '#6B7280', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Close Client
              </button>
            </div>
          </div>

        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(79,142,247,0.6)', fontFamily: 'monospace' }}>Editing Client</div>

            <FieldRow label="Name *"><input value={editName} onChange={e => setEditName(e.target.value)} style={inputSt} /></FieldRow>

            <FieldRow label="Type">
              <div style={{ display: 'flex', gap: 8 }}>
                {(['buyer','tenant','investor','other'] as const).map(t => (
                  <button key={t} onClick={() => setEditType(t)}
                    style={{ flex: 1, padding: '7px 4px', borderRadius: 7, border: `1px solid ${editType === t ? TYPE_COLORS[t].border : 'rgba(255,255,255,0.1)'}`, background: editType === t ? TYPE_COLORS[t].bg : 'transparent', color: editType === t ? TYPE_COLORS[t].color : '#6B7280', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {TYPE_COLORS[t].label}
                  </button>
                ))}
              </div>
            </FieldRow>

            <FieldRow label="Phone"><input value={editPhone} onChange={e => setEditPhone(e.target.value)} style={inputSt} /></FieldRow>
            <FieldRow label="Email"><input value={editEmail} onChange={e => setEditEmail(e.target.value)} style={inputSt} /></FieldRow>
            <FieldRow label="Company"><input value={editCompany} onChange={e => setEditCompany(e.target.value)} style={inputSt} /></FieldRow>
            <FieldRow label="Property Type"><input value={editPropType} onChange={e => setEditPropType(e.target.value)} placeholder="Office, Retail, Industrial..." style={inputSt} /></FieldRow>
            <FieldRow label="Location Pref."><input value={editLocation} onChange={e => setEditLocation(e.target.value)} style={inputSt} /></FieldRow>

            <FieldRow label="Size Range (SF)">
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={editSizeMin} onChange={e => setEditSizeMin(e.target.value)} placeholder="Min SF" style={{ ...inputSt, flex: 1 }} />
                <input value={editSizeMax} onChange={e => setEditSizeMax(e.target.value)} placeholder="Max SF" style={{ ...inputSt, flex: 1 }} />
              </div>
            </FieldRow>

            <FieldRow label="Budget Range">
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={editBudgetMin} onChange={e => setEditBudgetMin(e.target.value)} placeholder="Min $" style={{ ...inputSt, flex: 1 }} />
                <input value={editBudgetMax} onChange={e => setEditBudgetMax(e.target.value)} placeholder="Max $" style={{ ...inputSt, flex: 1 }} />
              </div>
            </FieldRow>

            <FieldRow label="Source"><input value={editSource} onChange={e => setEditSource(e.target.value)} placeholder="Referral, Cold call..." style={inputSt} /></FieldRow>

            <FieldRow label="Priority">
              <div style={{ display: 'flex', gap: 8 }}>
                {([['hot','🔥 Hot','#ef4444'],['standard','Standard','#9ca3af'],['inactive','Inactive','#4b5563']] as const).map(([v,label,color]) => (
                  <button key={v} onClick={() => setEditPriority(v)}
                    style={{ flex: 1, padding: '7px 4px', borderRadius: 7, border: `1px solid ${editPriority === v ? color : 'rgba(255,255,255,0.1)'}`, background: editPriority === v ? `${color}20` : 'transparent', color: editPriority === v ? color : '#6B7280', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
            </FieldRow>

            <FieldRow label="Status">
              <div style={{ display: 'flex', gap: 8 }}>
                {(['active','inactive','closed'] as const).map(s => (
                  <button key={s} onClick={() => setEditStatus(s)}
                    style={{ flex: 1, padding: '7px 4px', borderRadius: 7, border: `1px solid ${editStatus === s ? 'rgba(79,142,247,0.5)' : 'rgba(255,255,255,0.1)'}`, background: editStatus === s ? 'rgba(79,142,247,0.15)' : 'transparent', color: editStatus === s ? '#4F8EF7' : '#6B7280', fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                    {s}
                  </button>
                ))}
              </div>
            </FieldRow>

            <FieldRow label="Notes / Needs">
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={5} style={{ ...inputSt, resize: 'vertical', fontFamily: 'var(--font-body)' }} />
            </FieldRow>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditing(false)}
                style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#6B7280', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving || !editName.trim()}
                style={{ flex: 2, padding: '11px', background: 'rgba(79,142,247,0.2)', border: '1px solid rgba(79,142,247,0.5)', borderRadius: 8, color: '#4F8EF7', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ClientDetailPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ClientDetailInner />
    </Suspense>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(79,142,247,0.6)', fontFamily: 'monospace', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, width: 80 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#c9d0e0' }}>{value}</span>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(79,142,247,0.5)', marginBottom: 5, fontFamily: 'monospace' }}>{label}</div>
      {children}
    </div>
  )
}

function LoadingState() {
  return <div style={{ minHeight: '100vh', background: '#0D0F14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 14 }}>Loading...</div>
}

function NotFound({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0D0F14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 14, color: '#6B7280' }}>Client not found.</div>
      <button onClick={onBack} style={{ padding: '10px 20px', background: 'rgba(79,142,247,0.15)', border: '1px solid rgba(79,142,247,0.4)', borderRadius: 8, color: '#4F8EF7', fontSize: 13, cursor: 'pointer' }}>← Back</button>
    </div>
  )
}

const inputSt: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#F2EDE4', outline: 'none', boxSizing: 'border-box',
}

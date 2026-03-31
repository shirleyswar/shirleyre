'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Suspense } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UnifiedContact {
  id: string
  source: 'contact' | 'prospect'
  name: string
  phone: string | null
  email: string | null
  company: string | null       // contacts only
  relationship: string | null  // deal_contacts link
  rating: number               // prospects only (0 = none)
  notes: string | null
  deal_id: string | null
  deal_address: string | null
  created_at: string
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  padding: '9px 13px',
  fontSize: 13,
  color: '#F0F2FF',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  colorScheme: 'dark',
}

// ─── Star Rating (readonly) ───────────────────────────────────────────────────

function Stars({ value }: { value: number }) {
  if (!value) return null
  return (
    <span style={{ fontSize: 12, letterSpacing: 1 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= value ? '#E8B84B' : 'rgba(255,255,255,0.12)' }}>★</span>
      ))}
    </span>
  )
}

// ─── Source Badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: 'contact' | 'prospect' }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
      textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 20,
      background: source === 'prospect'
        ? 'rgba(79,142,247,0.12)' : 'rgba(45,212,191,0.10)',
      color: source === 'prospect' ? '#4F8EF7' : '#2dd4bf',
      border: `1px solid ${source === 'prospect' ? 'rgba(79,142,247,0.3)' : 'rgba(45,212,191,0.25)'}`,
    }}>
      {source === 'prospect' ? 'Prospect' : 'Contact'}
    </span>
  )
}

// ─── Contact Row ─────────────────────────────────────────────────────────────

function ContactRow({ c, onDealClick }: { c: UnifiedContact; onDealClick: (dealId: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      background: '#1A1E25',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Main row */}
      <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Avatar circle */}
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: c.source === 'prospect'
            ? 'linear-gradient(135deg, rgba(79,142,247,0.2), rgba(59,130,246,0.35))'
            : 'linear-gradient(135deg, rgba(45,212,191,0.15), rgba(20,184,166,0.3))',
          border: `1px solid ${c.source === 'prospect' ? 'rgba(79,142,247,0.3)' : 'rgba(45,212,191,0.25)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800,
          color: c.source === 'prospect' ? '#4F8EF7' : '#2dd4bf',
        }}>
          {c.name.charAt(0).toUpperCase()}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#F0F2FF' }}>{c.name}</span>
            <SourceBadge source={c.source} />
            {c.rating > 0 && <Stars value={c.rating} />}
          </div>

          {/* Company / Relationship */}
          {(c.company || c.relationship) && (
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
              {[c.company, c.relationship].filter(Boolean).join(' · ')}
            </div>
          )}

          {/* Phone + Email */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {c.phone && (
              <a href={`tel:${c.phone}`} style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                {c.phone}
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,12 2,6"/>
                </svg>
                {c.email}
              </a>
            )}
          </div>

          {/* Deal link */}
          {c.deal_id && c.deal_address && (
            <button
              onClick={() => onDealClick(c.deal_id!)}
              style={{
                marginTop: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                background: 'rgba(232,184,75,0.06)', border: '1px solid rgba(232,184,75,0.2)',
                borderRadius: 5, padding: '2px 9px', color: '#E8B84B',
                cursor: 'pointer', fontFamily: 'inherit',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '100%', display: 'inline-block',
              }}
            >
              📍 {c.deal_address}
            </button>
          )}
        </div>

        {/* Date */}
        <div style={{ fontSize: 10, color: '#374151', flexShrink: 0, paddingTop: 2, textAlign: 'right' }}>
          {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
        </div>
      </div>

      {/* Notes toggle */}
      {c.notes && (
        <>
          <div
            onClick={() => setExpanded(e => !e)}
            style={{
              padding: '7px 16px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              fontSize: 10, fontWeight: 700, color: '#4b5563',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              userSelect: 'none',
            }}
          >
            <span>Notes</span>
            <span style={{ fontSize: 9, opacity: 0.6 }}>{expanded ? '▲' : '▼'}</span>
          </div>
          {expanded && (
            <div style={{
              padding: '10px 16px 14px',
              fontSize: 12, color: '#9ca3af', lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              borderTop: '1px solid rgba(255,255,255,0.04)',
            }}>
              {c.notes}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ContactsPageInner() {
  const router = useRouter()
  const [contacts, setContacts] = useState<UnifiedContact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'contact' | 'prospect'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'rating'>('name')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', phone: '', email: '', company: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [addErr, setAddErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)

    // Fetch deal_contacts (linked contacts) with deal info
    const [dealContactsRes, prospectsRes] = await Promise.all([
      supabase
        .from('deal_contacts')
        .select('id, relationship, deal_id, contact:contacts(id, name, phone, email, company, created_at), deal:deals(address, name)')
        .limit(500),
      supabase
        .from('deal_prospects')
        .select('id, name, phone, email, rating, notes, deal_id, created_at, deal:deals(address, name)')
        .limit(500),
    ])

    const unified: UnifiedContact[] = []

    // Process deal_contacts
    const dcData = (dealContactsRes.data ?? []) as any[]
    for (const dc of dcData) {
      const c = dc.contact
      if (!c) continue
      unified.push({
        id: `contact-${dc.id}`,
        source: 'contact',
        name: c.name ?? '(no name)',
        phone: c.phone ?? null,
        email: c.email ?? null,
        company: c.company ?? null,
        relationship: dc.relationship ?? null,
        rating: 0,
        notes: null,
        deal_id: dc.deal_id ?? null,
        deal_address: dc.deal?.address || dc.deal?.name || null,
        created_at: c.created_at ?? new Date().toISOString(),
      })
    }

    // Also pull contacts NOT linked to a deal (standalone contacts)
    const { data: allContacts } = await supabase
      .from('contacts')
      .select('id, name, phone, email, company, created_at')
      .limit(500)

    const linkedContactIds = new Set(dcData.map((dc: any) => dc.contact?.id).filter(Boolean))
    for (const c of (allContacts ?? []) as any[]) {
      if (linkedContactIds.has(c.id)) continue // already added above
      unified.push({
        id: `contact-standalone-${c.id}`,
        source: 'contact',
        name: c.name ?? '(no name)',
        phone: c.phone ?? null,
        email: c.email ?? null,
        company: c.company ?? null,
        relationship: null,
        rating: 0,
        notes: null,
        deal_id: null,
        deal_address: null,
        created_at: c.created_at ?? new Date().toISOString(),
      })
    }

    // Process prospects
    for (const p of ((prospectsRes.data ?? []) as any[])) {
      unified.push({
        id: `prospect-${p.id}`,
        source: 'prospect',
        name: p.name ?? '(no name)',
        phone: p.phone ?? null,
        email: p.email ?? null,
        company: null,
        relationship: null,
        rating: p.rating ?? 0,
        notes: p.notes ?? null,
        deal_id: p.deal_id ?? null,
        deal_address: p.deal?.address || p.deal?.name || null,
        created_at: p.created_at ?? new Date().toISOString(),
      })
    }

    // Deduplicate by name+phone (a prospect may also be in contacts)
    // Keep both — user can manage separately
    setContacts(unified)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function filtered(): UnifiedContact[] {
    let list = contacts

    // Source filter
    if (sourceFilter !== 'all') list = list.filter(c => c.source === sourceFilter)

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.deal_address?.toLowerCase().includes(q)
      )
    }

    // Sort
    return [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }

  async function saveNewContact() {
    if (!addForm.name.trim()) { setAddErr('Name is required'); return }
    setAddSaving(true); setAddErr('')
    const { data, error } = await supabase.from('contacts').insert({
      name: addForm.name.trim(),
      phone: addForm.phone.trim() || null,
      email: addForm.email.trim() || null,
      company: addForm.company.trim() || null,
      priority: 'standard',
    }).select().single()
    if (error || !data) { setAddErr('Save failed — try again'); setAddSaving(false); return }
    // Add to unified list immediately
    const newC: UnifiedContact = {
      id: `contact-standalone-${data.id}`,
      source: 'contact',
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      company: data.company ?? null,
      relationship: null,
      rating: 0,
      notes: null,
      deal_id: null,
      deal_address: null,
      created_at: data.created_at ?? new Date().toISOString(),
    }
    setContacts(prev => [newC, ...prev])
    setAddForm({ name: '', phone: '', email: '', company: '' })
    setShowAddForm(false)
    setAddSaving(false)
  }

  const list = filtered()
  const totalProspects = contacts.filter(c => c.source === 'prospect').length
  const totalContacts = contacts.filter(c => c.source === 'contact').length

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
        <button
          onClick={() => router.push('/warroom')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '6px 14px',
            color: '#9ca3af', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', letterSpacing: '0.06em',
            flexShrink: 0, fontFamily: 'inherit',
          }}
        >
          ← War Room
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#4F8EF7', letterSpacing: '-0.01em' }}>
            All Contacts
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
            {totalContacts} contact{totalContacts !== 1 ? 's' : ''} · {totalProspects} prospect{totalProspects !== 1 ? 's' : ''}
          </div>
        </div>

        {/* + Contact — prominent */}
        <button
          onClick={() => { setShowAddForm(s => !s); setAddErr('') }}
          style={{
            padding: '11px 24px',
            fontSize: 14, fontWeight: 900,
            letterSpacing: '0.08em',
            background: showAddForm
              ? 'rgba(79,142,247,0.08)'
              : 'linear-gradient(135deg, rgba(79,142,247,0.25) 0%, rgba(59,130,246,0.38) 100%)',
            border: '1px solid rgba(79,142,247,0.6)',
            borderRadius: 12,
            color: '#4F8EF7',
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: showAddForm ? 'none' : '0 0 20px rgba(79,142,247,0.2)',
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>+</span>
          Contact
        </button>
      </header>

      {/* ── Add Contact Form ── */}
      {showAddForm && (
        <div style={{ padding: '0 24px', maxWidth: 860, margin: '0 auto' }}>
          <div style={{
            background: '#1A1E25',
            border: '1px solid rgba(79,142,247,0.35)',
            borderRadius: 14,
            padding: '20px 22px',
            marginTop: 16,
            boxShadow: '0 0 24px rgba(79,142,247,0.1)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#4F8EF7', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
              New Contact
            </div>

            {/* Name */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4, display: 'block' }}>Name *</label>
              <input
                autoFocus
                style={inputStyle}
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
                onKeyDown={e => e.key === 'Enter' && saveNewContact()}
              />
            </div>

            {/* Phone + Email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4, display: 'block' }}>Phone</label>
                <input style={inputStyle} value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="225-555-1234" type="tel" />
              </div>
              <div>
                <label style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4, display: 'block' }}>Email</label>
                <input style={inputStyle} value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="name@email.com" type="email" />
              </div>
            </div>

            {/* Company */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4, display: 'block' }}>Company / Firm</label>
              <input style={inputStyle} value={addForm.company} onChange={e => setAddForm(f => ({ ...f, company: e.target.value }))} placeholder="Brokerage, firm, or company name" />
            </div>

            {addErr && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10, fontWeight: 600 }}>{addErr}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowAddForm(false); setAddErr('') }}
                style={{ padding: '9px 20px', fontSize: 12, fontWeight: 700, background: 'transparent', border: '1px solid rgba(156,163,175,0.3)', borderRadius: 8, color: '#9ca3af', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={saveNewContact} disabled={addSaving}
                style={{ flex: 1, padding: '9px 20px', fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', background: 'rgba(79,142,247,0.15)', border: '1px solid rgba(79,142,247,0.5)', borderRadius: 8, color: '#4F8EF7', cursor: 'pointer', fontFamily: 'inherit' }}>
                {addSaving ? 'Saving…' : 'Save Contact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={{ padding: '16px 24px 0', maxWidth: 860, margin: '0 auto' }}>
        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            style={{ ...inputStyle, paddingLeft: 34 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, email, property…"
          />
        </div>

        {/* Filter + sort row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {/* Source filter */}
          {(['all', 'contact', 'prospect'] as const).map(f => (
            <button
              key={f}
              onClick={() => setSourceFilter(f)}
              style={{
                padding: '5px 13px', fontSize: 11, fontWeight: 700,
                background: sourceFilter === f ? 'rgba(79,142,247,0.15)' : 'transparent',
                border: `1px solid ${sourceFilter === f ? 'rgba(79,142,247,0.45)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 20, color: sourceFilter === f ? '#4F8EF7' : '#6b7280',
                cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
              }}
            >
              {f === 'all' ? 'All' : f === 'contact' ? 'Contacts' : 'Prospects'}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* Sort */}
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4b5563' }}>Sort:</span>
          {(['name', 'date', 'rating'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              style={{
                padding: '4px 11px', fontSize: 11, fontWeight: 700,
                background: sortBy === s ? 'rgba(232,184,75,0.1)' : 'transparent',
                border: `1px solid ${sortBy === s ? 'rgba(232,184,75,0.35)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 6, color: sortBy === s ? '#E8B84B' : '#6b7280',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {s === 'name' ? 'A–Z' : s === 'date' ? 'Newest' : '★'}
            </button>
          ))}
        </div>
      </div>

      {/* ── List ── */}
      <div style={{ padding: '0 24px 40px', maxWidth: 860, margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{
                height: 72, borderRadius: 12, background: 'rgba(255,255,255,0.04)',
                animation: 'pulse 1.6s ease-in-out infinite',
              }} />
            ))}
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
          </div>
        ) : list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.2 }}>👤</div>
            <div style={{ fontSize: 14 }}>
              {search ? 'No results for that search' : 'No contacts yet'}
            </div>
            <div style={{ fontSize: 12, color: '#374151', marginTop: 6 }}>
              Add contacts from individual deal pages
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map(c => (
              <ContactRow
                key={c.id}
                c={c}
                onDealClick={(dealId) => router.push(`/warroom/deal?id=${dealId}`)}
              />
            ))}
            <div style={{ fontSize: 11, color: '#374151', textAlign: 'center', padding: '12px 0' }}>
              {list.length} result{list.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ContactsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0D0F14', padding: 32 }}>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        <div style={{ width: '40%', height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.07)', animation: 'pulse 1.6s ease-in-out infinite' }} />
      </div>
    }>
      <ContactsPageInner />
    </Suspense>
  )
}

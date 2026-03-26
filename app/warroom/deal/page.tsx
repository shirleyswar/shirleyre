'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, Deal, DealStatus, DealTier, DealType, ContractDeadline, DeadlineType, DeadlineStatus, Contact, DealContact, LacdbListing } from '@/lib/supabase'
import { Suspense } from 'react'

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<DealStatus, string> = {
  active: 'Active',
  in_review: 'In Review',
  pipeline: 'Pipeline',
  in_service: 'In Service',
  hot: 'Hot 🔥',
  under_contract: 'Under Contract',
  pending_payment: 'Pending Pmt',
  closed: 'Closed',
  expired: 'Expired',
  dormant: 'Dormant',
  terminated: 'Terminated',
}

const STATUS_COLORS: Record<DealStatus, { bg: string; text: string; border: string }> = {
  active:           { bg: 'rgba(34,197,94,0.15)',    text: '#22c55e',  border: 'rgba(34,197,94,0.4)' },
  in_review:        { bg: 'rgba(251,191,36,0.15)',   text: '#fbbf24',  border: 'rgba(251,191,36,0.4)' },
  pipeline:         { bg: 'rgba(79,142,247,0.15)',   text: '#4F8EF7',  border: 'rgba(79,142,247,0.4)' },
  in_service:       { bg: 'rgba(45,212,191,0.15)',   text: '#2dd4bf',  border: 'rgba(45,212,191,0.4)' },
  hot:              { bg: 'rgba(251,146,60,0.15)',   text: '#fb923c',  border: 'rgba(251,146,60,0.4)' },
  under_contract:   { bg: 'rgba(45,212,191,0.15)',   text: '#2dd4bf',  border: 'rgba(45,212,191,0.4)' },
  pending_payment:  { bg: 'rgba(251,191,36,0.15)',   text: '#fbbf24',  border: 'rgba(251,191,36,0.4)' },
  closed:           { bg: 'rgba(107,114,128,0.15)',  text: '#9ca3af',  border: 'rgba(107,114,128,0.4)' },
  expired:          { bg: 'rgba(239,68,68,0.12)',    text: '#ef4444',  border: 'rgba(239,68,68,0.3)' },
  dormant:          { bg: 'rgba(107,114,128,0.12)',  text: '#6b7280',  border: 'rgba(107,114,128,0.3)' },
  terminated:       { bg: 'rgba(239,68,68,0.12)',    text: '#ef4444',  border: 'rgba(239,68,68,0.3)' },
}

const DEAL_TYPES: { value: string; label: string }[] = [
  { value: 'potential_listing',  label: 'Potential Listing' },
  { value: 'active_listing',     label: 'Active Listing' },
  { value: 'landlord',           label: 'Landlord' },
  { value: 'seller',             label: 'Seller' },
  { value: 'tenant',             label: 'Tenant' },
  { value: 'buyer',              label: 'Buyer' },
  { value: 'referral',           label: 'Referral' },
  { value: 'x_develop_serv',     label: 'X - Develop Serv' },
  { value: 'x_consulting',       label: 'X - Consulting' },
  { value: 'lease',              label: 'Lease' },
  { value: 'listing',            label: 'Listing' },
  { value: 'buyer_rep',          label: 'Buyer Rep' },
  { value: 'tenant_rep',         label: 'Tenant Rep' },
  { value: 'landlord_rep',       label: 'Landlord Rep' },
  { value: 'consulting',         label: 'Consulting' },
  { value: 'other',              label: 'Other' },
]

const DEADLINE_TYPE_COLORS: Record<DeadlineType, { bg: string; text: string; label: string }> = {
  inspection: { bg: 'rgba(251,146,60,0.15)',  text: '#fb923c', label: 'Inspection' },
  financing:  { bg: 'rgba(79,142,247,0.15)',  text: '#4F8EF7', label: 'Financing' },
  appraisal:  { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa', label: 'Appraisal' },
  title:      { bg: 'rgba(45,212,191,0.15)',  text: '#2dd4bf', label: 'Title' },
  survey:     { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af', label: 'Survey' },
  closing:    { bg: 'rgba(251,191,36,0.15)',  text: '#fbbf24', label: 'Closing' },
  custom:     { bg: 'rgba(107,114,128,0.12)', text: '#6b7280', label: 'Custom' },
}

const DEADLINE_STATUS_STYLES: Record<DeadlineStatus, { bg: string; text: string; label: string }> = {
  pending:   { bg: 'rgba(79,142,247,0.15)',  text: '#4F8EF7', label: 'Pending' },
  satisfied: { bg: 'rgba(34,197,94,0.15)',   text: '#22c55e', label: 'Satisfied' },
  extended:  { bg: 'rgba(251,146,60,0.15)',  text: '#fb923c', label: 'Extended' },
  missed:    { bg: 'rgba(239,68,68,0.15)',   text: '#ef4444', label: 'Missed' },
}

const PIN_HASH = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function formatCurrency(n: number | null | undefined): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.floor((target.getTime() - now.getTime()) / 86400000)
}

function getDaysColor(days: number, status: DeadlineStatus): string {
  if (status === 'satisfied') return '#6b7280'
  if (days <= 1) return '#ef4444'
  if (days <= 7) return '#fb923c'
  return '#22c55e'
}

function typeLabel(type: string): string {
  return DEAL_TYPES.find(t => t.value === type)?.label ?? type
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: '#1A1E25',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  padding: '18px 20px',
  marginBottom: 16,
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#6b7280',
  marginBottom: 4,
}

const valueStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#F0F2FF',
  fontWeight: 500,
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
  padding: '7px 16px',
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

const sectionHeadStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#E8B84B',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

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

// ─── LACDB Card ───────────────────────────────────────────────────────────────

function LacdbCard({ deal, onLacdbIdSave }: { deal: Deal; onLacdbIdSave: (id: string) => void }) {
  const [listing, setListing] = useState<LacdbListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(true)
  const [manualId, setManualId] = useState(deal.notes?.match(/lacdb_id:(\S+)/)?.[1] ?? '')
  const [savingManual, setSavingManual] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      let found: LacdbListing | null = null

      // Try by lacdb_id field first (stored in deal_source as a hack, or we check notes)
      // We check if deal has a lacdb_id stored in deal_source field with prefix "lacdb:"
      const lacdbId = deal.deal_source?.startsWith('lacdb:')
        ? deal.deal_source.slice(6)
        : null

      if (lacdbId) {
        const { data } = await supabase
          .from('lacdb_listings')
          .select('*')
          .eq('lacdb_id', lacdbId)
          .single()
        found = data as LacdbListing | null
      }

      if (!found && deal.address) {
        const { data } = await supabase
          .from('lacdb_listings')
          .select('*')
          .ilike('address', `%${deal.address.split(',')[0]}%`)
          .limit(1)
        if (data && data.length > 0) found = data[0] as LacdbListing
      }

      setListing(found)
      setLoading(false)
    }
    load()
  }, [deal.address, deal.deal_source])

  if (loading) return (
    <div style={cardStyle}>
      <div style={{ ...sectionHeadStyle, marginBottom: 12 }}>LACDB Listing</div>
      <div style={{ fontSize: 12, color: '#4b5563' }}>Checking for LACDB match…</div>
    </div>
  )

  if (!listing) return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={sectionHeadStyle}>LACDB Listing</span>
      </div>
      <div style={{
        padding: '16px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 8,
        border: '1px dashed rgba(255,255,255,0.08)',
        textAlign: 'center',
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 20, marginBottom: 6, opacity: 0.3 }}>🔗</div>
        <div style={{ fontSize: 12, color: '#4b5563' }}>No LACDB listing linked</div>
        <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>Link manually below</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          value={manualId}
          onChange={e => setManualId(e.target.value)}
          placeholder="LACDB ID or slug"
        />
        <button
          onClick={async () => {
            setSavingManual(true)
            onLacdbIdSave(manualId)
            setSavingManual(false)
          }}
          disabled={savingManual || !manualId}
          style={btnStyle('#000', '#E8B84B', '#E8B84B')}
        >
          Link
        </button>
      </div>
    </div>
  )

  const photo = listing.images?.[0]
  const priceDisplay = listing.price_label || listing.rate_label
  const sizeDisplay = listing.sqft
    ? `${listing.sqft.toLocaleString()} SF`
    : listing.acres
    ? `${listing.acres} ac`
    : null

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={sectionHeadStyle}>LACDB Listing</span>
        <span style={{ fontSize: 10, color: '#4b5563' }}>Synced {timeAgo(listing.synced_at)}</span>
      </div>

      {photo && (
        <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 12, maxHeight: 200 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={listing.name ?? ''}
            style={{ width: '100%', height: 200, objectFit: 'cover' }}
          />
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        {listing.name && (
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F2FF', marginBottom: 2 }}>{listing.name}</div>
        )}
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          {[listing.address, listing.city, listing.state].filter(Boolean).join(', ')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        {priceDisplay && (
          <div>
            <div style={labelStyle}>Price / Rate</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#E8B84B' }}>{priceDisplay}</div>
          </div>
        )}
        {sizeDisplay && (
          <div>
            <div style={labelStyle}>Size</div>
            <div style={{ fontSize: 14, color: '#F0F2FF' }}>{sizeDisplay}</div>
          </div>
        )}
      </div>

      {listing.description && (
        <div style={{ marginBottom: 10 }}>
          <div style={labelStyle}>Description</div>
          <div style={{
            fontSize: 12, color: '#9ca3af', lineHeight: 1.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: collapsed ? 3 : undefined,
            WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
          } as React.CSSProperties}>
            {listing.description}
          </div>
          {listing.description.length > 200 && (
            <button
              onClick={() => setCollapsed(c => !c)}
              style={{ fontSize: 11, color: '#4F8EF7', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', marginTop: 4 }}
            >
              {collapsed ? 'Show more ↓' : 'Show less ↑'}
            </button>
          )}
        </div>
      )}

      {listing.lacdb_url && (
        <a
          href={listing.lacdb_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px',
            background: 'rgba(79,142,247,0.1)',
            border: '1px solid rgba(79,142,247,0.35)',
            borderRadius: 8,
            color: '#4F8EF7',
            fontSize: 12,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          View on LACDB ↗
        </a>
      )}
    </div>
  )
}

// ─── Documents Card ───────────────────────────────────────────────────────────

interface StorageFile {
  name: string
  metadata: { size: number; mimetype: string; lastModified: string } | null
  created_at: string | null
  updated_at: string | null
  id: string | null
}

function DocumentsCard({ deal }: { deal: Deal }) {
  const [files, setFiles] = useState<StorageFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const storagePrefix = `deals/${deal.id}`

  const loadFiles = useCallback(async () => {
    const { data } = await supabase.storage.from('deal-documents').list(storagePrefix)
    setFiles((data ?? []) as StorageFile[])
    setLoadingFiles(false)
  }, [storagePrefix])

  useEffect(() => { loadFiles() }, [loadFiles])

  async function uploadFile(file: File) {
    setUploading(true)
    const path = `${storagePrefix}/${file.name}`
    await supabase.storage.from('deal-documents').upload(path, file, { upsert: true })
    await loadFiles()
    setUploading(false)
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    for (const file of Array.from(fileList)) {
      await uploadFile(file)
    }
  }

  async function deleteFile(name: string) {
    await supabase.storage.from('deal-documents').remove([`${storagePrefix}/${name}`])
    setFiles(f => f.filter(x => x.name !== name))
  }

  async function getDownloadUrl(name: string) {
    const { data } = await supabase.storage
      .from('deal-documents')
      .createSignedUrl(`${storagePrefix}/${name}`, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={sectionHeadStyle}>Documents</span>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#E8B84B' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 8,
          padding: '20px',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: 14,
          background: dragging ? 'rgba(232,184,75,0.04)' : 'rgba(255,255,255,0.02)',
          transition: 'all 0.15s',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div style={{ fontSize: 12, color: '#E8B84B' }}>Uploading…</div>
        ) : (
          <>
            <div style={{ fontSize: 20, marginBottom: 4, opacity: 0.4 }}>📎</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Drop files here or click to upload</div>
            <div style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>PDF, Excel, Word, Images</div>
          </>
        )}
      </div>

      {/* File list */}
      {loadingFiles ? (
        <div style={{ fontSize: 12, color: '#4b5563' }}>Loading files…</div>
      ) : files.length === 0 ? (
        <div style={{ fontSize: 12, color: '#4b5563', textAlign: 'center', padding: '8px 0' }}>No files uploaded</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map(f => (
            <div key={f.name} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 7,
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#F0F2FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </div>
                {f.metadata && (
                  <div style={{ fontSize: 10, color: '#4b5563', marginTop: 1 }}>
                    {formatFileSize(f.metadata.size)}
                    {f.updated_at && ` · ${new Date(f.updated_at).toLocaleDateString()}`}
                  </div>
                )}
              </div>
              <button
                onClick={() => getDownloadUrl(f.name)}
                style={{ ...btnStyle('#4F8EF7', 'rgba(79,142,247,0.08)', 'rgba(79,142,247,0.25)'), padding: '3px 8px', fontSize: 10 }}
              >
                ↓
              </button>
              <button
                onClick={() => deleteFile(f.name)}
                style={{ ...btnStyle('#ef4444', 'rgba(239,68,68,0.08)', 'rgba(239,68,68,0.25)'), padding: '3px 8px', fontSize: 10 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Links section */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {deal.dropbox_link && (
          <a
            href={deal.dropbox_link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 10px', borderRadius: 7, marginBottom: 6,
              background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.2)',
              color: '#2dd4bf', textDecoration: 'none', fontSize: 12, fontWeight: 600,
            }}
          >
            📁 Dropbox Folder ↗
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Contacts Card ────────────────────────────────────────────────────────────

interface DealContactFull extends DealContact {
  contact: Contact
}

function ContactsCard({ deal }: { deal: Deal }) {
  const [contacts, setContacts] = useState<DealContactFull[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Contact[]>([])
  const [searching, setSearching] = useState(false)
  const [newContact, setNewContact] = useState({ name: '', company: '', phone: '', email: '', relationship: '' })
  const [addMode, setAddMode] = useState<'search' | 'new'>('search')

  const loadContacts = useCallback(async () => {
    const { data } = await supabase
      .from('deal_contacts')
      .select('*, contact:contacts(*)')
      .eq('deal_id', deal.id)
    setContacts((data ?? []) as DealContactFull[])
    setLoading(false)
  }, [deal.id])

  useEffect(() => { loadContacts() }, [loadContacts])

  async function searchContacts(q: string) {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .ilike('name', `%${q}%`)
      .limit(10)
    setSearchResults((data ?? []) as Contact[])
    setSearching(false)
  }

  async function linkContact(contactId: string, relationship: string) {
    await supabase.from('deal_contacts').insert({
      deal_id: deal.id,
      contact_id: contactId,
      relationship: relationship || null,
    })
    await loadContacts()
    setShowAdd(false)
    setSearchQuery('')
    setSearchResults([])
  }

  async function addNewContact() {
    if (!newContact.name) return
    const { data: c } = await supabase.from('contacts').insert({
      name: newContact.name,
      company: newContact.company || null,
      phone: newContact.phone || null,
      email: newContact.email || null,
      priority: 'standard',
    }).select().single()
    if (c) {
      await linkContact(c.id, newContact.relationship)
    }
    setNewContact({ name: '', company: '', phone: '', email: '', relationship: '' })
  }

  async function removeContact(dealContactId: string) {
    await supabase.from('deal_contacts').delete().eq('id', dealContactId)
    setContacts(c => c.filter(x => x.id !== dealContactId))
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={sectionHeadStyle}>Contacts</span>
        <button onClick={() => setShowAdd(s => !s)} style={btnStyle('#2dd4bf', 'rgba(45,212,191,0.08)', 'rgba(45,212,191,0.35)')}>
          + Add
        </button>
      </div>

      {showAdd && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
        }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['search', 'new'] as const).map(m => (
              <button
                key={m}
                onClick={() => setAddMode(m)}
                style={{
                  ...btnStyle(addMode === m ? '#000' : '#9ca3af', addMode === m ? '#E8B84B' : 'transparent', addMode === m ? '#E8B84B' : 'rgba(156,163,175,0.3)'),
                  padding: '5px 12px',
                  fontSize: 11,
                }}
              >
                {m === 'search' ? 'Search Existing' : 'Add New'}
              </button>
            ))}
          </div>

          {addMode === 'search' ? (
            <div>
              <input
                style={{ ...inputStyle, marginBottom: 8 }}
                value={searchQuery}
                onChange={e => searchContacts(e.target.value)}
                placeholder="Search contacts by name…"
              />
              {searching && <div style={{ fontSize: 11, color: '#6b7280' }}>Searching…</div>}
              {searchResults.map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 8px', borderRadius: 6, marginBottom: 4,
                  background: 'rgba(255,255,255,0.03)',
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#F0F2FF', fontWeight: 600 }}>{c.name}</div>
                    {c.company && <div style={{ fontSize: 10, color: '#6b7280' }}>{c.company}</div>}
                  </div>
                  <button
                    onClick={() => linkContact(c.id, '')}
                    style={btnStyle('#22c55e', 'rgba(34,197,94,0.08)', 'rgba(34,197,94,0.3)')}
                  >
                    Link
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input style={inputStyle} value={newContact.name} onChange={e => setNewContact(n => ({ ...n, name: e.target.value }))} placeholder="Name*" />
              <input style={inputStyle} value={newContact.company} onChange={e => setNewContact(n => ({ ...n, company: e.target.value }))} placeholder="Company" />
              <input style={inputStyle} value={newContact.phone} onChange={e => setNewContact(n => ({ ...n, phone: e.target.value }))} placeholder="Phone" />
              <input style={inputStyle} value={newContact.email} onChange={e => setNewContact(n => ({ ...n, email: e.target.value }))} placeholder="Email" />
              <input style={inputStyle} value={newContact.relationship} onChange={e => setNewContact(n => ({ ...n, relationship: e.target.value }))} placeholder="Role / Relationship" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowAdd(false)} style={btnStyle('#9ca3af', 'transparent', 'rgba(156,163,175,0.3)')}>Cancel</button>
                <button onClick={addNewContact} disabled={!newContact.name} style={btnStyle('#000', '#E8B84B', '#E8B84B')}>Add Contact</button>
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 12, color: '#4b5563' }}>Loading contacts…</div>
      ) : contacts.length === 0 ? (
        <div style={{ fontSize: 12, color: '#4b5563', textAlign: 'center', padding: '16px 0' }}>No contacts linked</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {contacts.map(dc => (
            <div key={dc.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2FF' }}>{dc.contact.name}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                  {dc.contact.company && <span style={{ fontSize: 10, color: '#6b7280' }}>{dc.contact.company}</span>}
                  {dc.relationship && <span style={{ fontSize: 10, color: '#4F8EF7' }}>{dc.relationship}</span>}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                  {dc.contact.phone && <span style={{ fontSize: 11, color: '#9ca3af' }}>{dc.contact.phone}</span>}
                  {dc.contact.email && <span style={{ fontSize: 11, color: '#9ca3af' }}>{dc.contact.email}</span>}
                </div>
              </div>
              <button
                onClick={() => removeContact(dc.id)}
                style={{ ...btnStyle('#ef4444', 'rgba(239,68,68,0.08)', 'rgba(239,68,68,0.25)'), padding: '3px 8px', fontSize: 10, flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Inner component ──────────────────────────────────────────────────────────

function DealDashboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dealId = searchParams.get('id')

  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Deal>>({})
  const [saving, setSaving] = useState(false)

  // Deadlines
  const [deadlines, setDeadlines] = useState<ContractDeadline[]>([])
  const [showAddDeadline, setShowAddDeadline] = useState(false)
  const [newDeadline, setNewDeadline] = useState({
    label: '', deadline_date: '', deadline_type: 'inspection' as DeadlineType, notes: '',
  })
  const [addingDeadline, setAddingDeadline] = useState(false)

  // Notes
  const [notesText, setNotesText] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // PIN modal
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null)

  // Copied ID state
  const [copiedId, setCopiedId] = useState(false)

  const loadDeal = useCallback(async () => {
    if (!dealId) { setNotFound(true); setLoading(false); return }
    const { data, error } = await supabase.from('deals').select('*').eq('id', dealId).single()
    if (error || !data) {
      setNotFound(true)
    } else {
      setDeal(data as Deal)
      setNotesText((data as Deal).notes ?? '')
    }
    setLoading(false)
  }, [dealId])

  const loadDeadlines = useCallback(async () => {
    if (!dealId) return
    const { data } = await supabase
      .from('contract_deadlines')
      .select('*')
      .eq('deal_id', dealId)
      .order('deadline_date', { ascending: true })
    if (data) setDeadlines(data as ContractDeadline[])
  }, [dealId])

  useEffect(() => { loadDeal() }, [loadDeal])
  useEffect(() => { if (deal?.status === 'under_contract') loadDeadlines() }, [deal, loadDeadlines])

  // ── Edit handlers ──

  function startEdit() {
    if (!deal) return
    setEditForm({
      address: deal.address ?? '',
      name: deal.name ?? '',
      type: deal.type,
      status: deal.status,
      tier: deal.tier,
      value: deal.value,
      commission_estimated: deal.commission_estimated,
      commission_collected: deal.commission_collected,
      deal_source: deal.deal_source ?? '',
      notes: deal.notes ?? '',
      dropbox_link: deal.dropbox_link ?? '',
    })
    setEditing(true)
  }

  async function saveEdit() {
    if (!deal) return
    setSaving(true)
    const { data, error } = await supabase
      .from('deals')
      .update({ ...editForm, updated_at: new Date().toISOString() })
      .eq('id', deal.id)
      .select()
      .single()
    if (!error && data) {
      setDeal(data as Deal)
      setNotesText((data as Deal).notes ?? '')
      setEditing(false)
    }
    setSaving(false)
  }

  async function saveNotes() {
    if (!deal) return
    setSavingNotes(true)
    const { data, error } = await supabase
      .from('deals')
      .update({ notes: notesText, updated_at: new Date().toISOString() })
      .eq('id', deal.id)
      .select()
      .single()
    if (!error && data) setDeal(data as Deal)
    setSavingNotes(false)
  }

  // ── Deadline handlers ──

  async function addDeadline() {
    if (!newDeadline.label || !newDeadline.deadline_date || !dealId) return
    setAddingDeadline(true)
    const { data } = await supabase.from('contract_deadlines').insert({
      deal_id: dealId,
      label: newDeadline.label,
      deadline_date: newDeadline.deadline_date,
      deadline_type: newDeadline.deadline_type,
      notes: newDeadline.notes || null,
      status: 'pending',
    }).select().single()
    if (data) setDeadlines(d => [...d, data as ContractDeadline])
    setNewDeadline({ label: '', deadline_date: '', deadline_type: 'inspection', notes: '' })
    setShowAddDeadline(false)
    setAddingDeadline(false)
  }

  async function satisfyDeadline(id: string) {
    await supabase.from('contract_deadlines').update({ status: 'satisfied', updated_at: new Date().toISOString() }).eq('id', id)
    setDeadlines(d => d.map(x => x.id === id ? { ...x, status: 'satisfied' as DeadlineStatus } : x))
  }

  async function deleteDeadline(id: string) {
    await supabase.from('contract_deadlines').delete().eq('id', id)
    setDeadlines(d => d.filter(x => x.id !== id))
  }

  // ── Status/Tier actions ──

  async function doStatusChange(newStatus: DealStatus) {
    if (!deal) return
    const { data, error } = await supabase
      .from('deals')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', deal.id)
      .select()
      .single()
    if (!error && data) setDeal(data as Deal)
  }

  async function doLaunch() {
    if (!deal) return
    const updates: Partial<Deal> & { updated_at: string } = {
      tier: 'filed',
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('deals')
      .update(updates)
      .eq('id', deal.id)
      .select()
      .single()
    if (!error && data) {
      setDeal(data as Deal)
      if (!deal.dropbox_link) {
        await supabase.from('folder_queue').insert({
          deal_id: deal.id,
          action: 'create',
          folder_name: deal.address || deal.name,
          folder_path: deal.address || deal.name,
          status: 'pending',
        })
      }
    }
  }

  async function doKillAction(newStatus: DealStatus, destination: string) {
    if (!deal) return
    const { data, error } = await supabase
      .from('deals')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', deal.id)
      .select()
      .single()
    if (!error && data) {
      setDeal(data as Deal)
      await supabase.from('folder_queue').insert({
        deal_id: deal.id,
        action: 'move',
        folder_name: deal.address || deal.name,
        folder_path: destination,
        status: 'pending',
      })
    }
  }

  function pinGate(action: () => void) {
    setPendingAction(() => action)
  }

  function copyId() {
    if (!deal) return
    navigator.clipboard.writeText(deal.id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 1800)
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0D0F14', color: '#F0F2FF' }}>
      <div style={{ padding: 32 }}>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        <div style={{ width: '60%', height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.07)', marginBottom: 10, animation: 'pulse 1.6s ease-in-out infinite' }} />
        <div style={{ width: '35%', height: 18, borderRadius: 6, background: 'rgba(255,255,255,0.07)', animation: 'pulse 1.6s ease-in-out infinite' }} />
      </div>
    </div>
  )

  if (notFound) return (
    <div style={{
      minHeight: '100vh', background: '#0D0F14', color: '#F0F2FF',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <div style={{ fontSize: 48, opacity: 0.3 }}>404</div>
      <div style={{ fontSize: 16, color: '#6b7280' }}>Deal not found</div>
      <button onClick={() => router.push('/warroom')} style={btnStyle('#E8B84B', 'rgba(232,184,75,0.1)', 'rgba(232,184,75,0.4)')}>
        ← Back to Pipeline
      </button>
    </div>
  )

  if (!deal) return null

  const sc = STATUS_COLORS[deal.status]

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0D0F14',
      color: '#F0F2FF',
      fontFamily: 'var(--font-body, system-ui, sans-serif)',
    }}>
      {/* PIN modal */}
      {pendingAction && (
        <PinModal
          onConfirm={() => { pendingAction!(); setPendingAction(null) }}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {/* ── Header ── */}
      <header style={{
        background: '#13171D',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        {/* Back */}
        <button
          onClick={() => router.push('/warroom')}
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
          ← Pipeline
        </button>

        {/* Address / Name */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{
            fontSize: 'clamp(16px, 2.5vw, 22px)',
            fontWeight: 800,
            color: '#E8B84B',
            lineHeight: 1.2,
          }}>
            {deal.address || deal.name}
          </div>
          {deal.name && deal.address && (
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{deal.name}</div>
          )}
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
          }}>
            {STATUS_LABELS[deal.status]}
          </span>
          <span style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            background: deal.tier === 'filed' ? 'rgba(232,184,75,0.12)' : 'rgba(107,114,128,0.12)',
            color: deal.tier === 'filed' ? '#E8B84B' : '#9ca3af',
            border: `1px solid ${deal.tier === 'filed' ? 'rgba(232,184,75,0.35)' : 'rgba(107,114,128,0.3)'}`,
          }}>
            {deal.tier === 'filed' ? '★ Filed' : 'Tracked'}
          </span>
          <span style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            color: '#9ca3af', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {typeLabel(deal.type)}
          </span>

          {/* Edit toggle */}
          {!editing ? (
            <button onClick={startEdit} style={btnStyle('#E8B84B', 'rgba(232,184,75,0.1)', 'rgba(232,184,75,0.35)')}>
              Edit
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(false)} style={btnStyle('#9ca3af', 'transparent', 'rgba(156,163,175,0.3)')}>
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving} style={btnStyle('#000', '#E8B84B', '#E8B84B')}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{
        display: 'flex',
        gap: 20,
        padding: '24px',
        maxWidth: 1400,
        margin: '0 auto',
        alignItems: 'flex-start',
      }}>

        {/* ── LEFT COLUMN (65%) ── */}
        <div style={{ flex: '0 0 65%', minWidth: 0 }}>

          {/* LACDB Card */}
          <LacdbCard
            deal={deal}
            onLacdbIdSave={async (lacdbId) => {
              const { data, error } = await supabase
                .from('deals')
                .update({ deal_source: `lacdb:${lacdbId}`, updated_at: new Date().toISOString() })
                .eq('id', deal.id)
                .select()
                .single()
              if (!error && data) setDeal(data as Deal)
            }}
          />

          {/* Deal Info Card */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={sectionHeadStyle}>Deal Info</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
              {/* Address */}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={labelStyle}>Address</div>
                {editing ? (
                  <input style={inputStyle} value={(editForm.address as string) ?? ''} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
                ) : (
                  <div style={valueStyle}>{deal.address || '—'}</div>
                )}
              </div>

              {/* Client */}
              <div>
                <div style={labelStyle}>Client</div>
                {editing ? (
                  <input style={inputStyle} value={(editForm.name as string) ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                ) : (
                  <div style={valueStyle}>{deal.name || '—'}</div>
                )}
              </div>

              {/* Type */}
              <div>
                <div style={labelStyle}>Type</div>
                {editing ? (
                  <select style={inputStyle} value={(editForm.type as string) ?? deal.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value as DealType }))}>
                    {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                ) : (
                  <div style={valueStyle}>{typeLabel(deal.type)}</div>
                )}
              </div>

              {/* Status */}
              <div>
                <div style={labelStyle}>Status</div>
                {editing ? (
                  <select style={inputStyle} value={(editForm.status as string) ?? deal.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as DealStatus }))}>
                    {(Object.keys(STATUS_LABELS) as DealStatus[]).map(s => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                ) : (
                  <div style={valueStyle}>{STATUS_LABELS[deal.status]}</div>
                )}
              </div>

              {/* Tier */}
              <div>
                <div style={labelStyle}>Tier</div>
                {editing ? (
                  <select style={inputStyle} value={(editForm.tier as string) ?? deal.tier} onChange={e => setEditForm(f => ({ ...f, tier: e.target.value as DealTier }))}>
                    <option value="tracked">Tracked</option>
                    <option value="filed">Filed</option>
                  </select>
                ) : (
                  <div style={valueStyle}>{deal.tier === 'filed' ? '★ Filed' : 'Tracked'}</div>
                )}
              </div>

              {/* Value */}
              <div>
                <div style={labelStyle}>Deal Value</div>
                {editing ? (
                  <input type="number" style={inputStyle} value={editForm.value ?? ''} onChange={e => setEditForm(f => ({ ...f, value: e.target.value ? Number(e.target.value) : null }))} placeholder="0" />
                ) : (
                  <div style={{ ...valueStyle, color: '#E8B84B', fontFamily: 'monospace' }}>{formatCurrency(deal.value)}</div>
                )}
              </div>

              {/* Commission Estimated */}
              <div>
                <div style={labelStyle}>Est. Commission</div>
                {editing ? (
                  <input type="number" style={inputStyle} value={editForm.commission_estimated ?? ''} onChange={e => setEditForm(f => ({ ...f, commission_estimated: e.target.value ? Number(e.target.value) : null }))} placeholder="0" />
                ) : (
                  <div style={{ ...valueStyle, fontFamily: 'monospace' }}>{formatCurrency(deal.commission_estimated)}</div>
                )}
              </div>

              {/* Commission Collected */}
              <div>
                <div style={labelStyle}>Collected</div>
                {editing ? (
                  <input type="number" style={inputStyle} value={editForm.commission_collected ?? ''} onChange={e => setEditForm(f => ({ ...f, commission_collected: e.target.value ? Number(e.target.value) : null }))} placeholder="0" />
                ) : (
                  <div style={{ ...valueStyle, color: '#22c55e', fontFamily: 'monospace' }}>{formatCurrency(deal.commission_collected)}</div>
                )}
              </div>

              {/* Deal Source */}
              <div>
                <div style={labelStyle}>Source</div>
                {editing ? (
                  <input style={inputStyle} value={(editForm.deal_source as string) ?? ''} onChange={e => setEditForm(f => ({ ...f, deal_source: e.target.value }))} placeholder="Referral, cold call, etc." />
                ) : (
                  <div style={valueStyle}>{deal.deal_source?.startsWith('lacdb:') ? `LACDB: ${deal.deal_source.slice(6)}` : deal.deal_source || '—'}</div>
                )}
              </div>

              {/* Dropbox Link */}
              <div>
                <div style={labelStyle}>Dropbox Link</div>
                {editing ? (
                  <input style={inputStyle} value={(editForm.dropbox_link as string) ?? ''} onChange={e => setEditForm(f => ({ ...f, dropbox_link: e.target.value }))} placeholder="https://www.dropbox.com/…" />
                ) : deal.dropbox_link ? (
                  <a href={deal.dropbox_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#2dd4bf' }}>Open ↗</a>
                ) : (
                  <div style={{ ...valueStyle, color: '#4b5563' }}>—</div>
                )}
              </div>

              {/* Notes */}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={labelStyle}>Notes</div>
                {editing ? (
                  <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={(editForm.notes as string) ?? ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Deal notes…" />
                ) : (
                  <div style={{ ...valueStyle, whiteSpace: 'pre-wrap', color: deal.notes ? '#F0F2FF' : '#6b7280' }}>
                    {deal.notes || 'No notes'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Documents Card */}
          <DocumentsCard deal={deal} />

          {/* Notes / Activity Log */}
          <div style={cardStyle}>
            <div style={{ ...sectionHeadStyle, marginBottom: 14 }}>Notes</div>
            <textarea
              style={{ ...inputStyle, minHeight: 100, resize: 'vertical', marginBottom: 10 }}
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="Add notes here…"
            />
            <button
              onClick={saveNotes}
              disabled={savingNotes || notesText === (deal.notes ?? '')}
              style={btnStyle('#000', '#E8B84B', '#E8B84B')}
            >
              {savingNotes ? 'Saving…' : 'Save Notes'}
            </button>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ ...sectionHeadStyle, marginBottom: 12 }}>Activity Log</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: 8 }}>
                <div style={{ fontSize: 24, opacity: 0.2 }}>📋</div>
                <div style={{ fontSize: 12, color: '#4b5563' }}>Activity log coming soon</div>
                <div style={{ fontSize: 11, color: '#374151' }}>All deal activity will be tracked here</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (35%) ── */}
        <div style={{ flex: '0 0 35%', minWidth: 0 }}>

          {/* Deal Actions Card */}
          <div style={cardStyle}>
            <div style={{ ...sectionHeadStyle, marginBottom: 16 }}>Deal Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Launch */}
              {deal.tier === 'tracked' && (
                <button
                  onClick={() => pinGate(() => doLaunch())}
                  style={{
                    ...btnStyle('#000', '#E8B84B', '#E8B84B'),
                    width: '100%', padding: '13px 16px', fontSize: 14,
                    textAlign: 'center', borderRadius: 10,
                    boxShadow: '0 0 18px rgba(232,184,75,0.25)',
                  }}
                >
                  Launch 🚀
                </button>
              )}

              {/* → Hot */}
              {deal.tier === 'filed' && deal.status === 'active' && (
                <button
                  onClick={() => pinGate(() => doStatusChange('hot'))}
                  style={{
                    ...btnStyle('#fb923c', 'rgba(251,146,60,0.12)', 'rgba(251,146,60,0.45)'),
                    width: '100%', padding: '11px 16px', fontSize: 13, textAlign: 'center',
                  }}
                >
                  → Hot 🔥
                </button>
              )}

              {/* → UC */}
              {deal.tier === 'filed' && (deal.status === 'active' || deal.status === 'hot') && (
                <button
                  onClick={() => pinGate(() => doStatusChange('under_contract'))}
                  style={{
                    ...btnStyle('#2dd4bf', 'rgba(45,212,191,0.1)', 'rgba(45,212,191,0.4)'),
                    width: '100%', padding: '11px 16px', fontSize: 13, textAlign: 'center',
                  }}
                >
                  → Under Contract
                </button>
              )}

              {/* Kill section */}
              {deal.tier === 'filed' && (
                <div style={{ marginTop: 6, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4b5563', marginBottom: 8 }}>
                    Kill
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {deal.type === 'active_listing' && (
                      <button
                        onClick={() => pinGate(() => doKillAction('expired', 'X - Expired Listings'))}
                        style={{
                          ...btnStyle('#fb923c', 'rgba(251,146,60,0.07)', 'rgba(251,146,60,0.3)'),
                          width: '100%', padding: '9px 16px', fontSize: 12, textAlign: 'center',
                        }}
                      >
                        Expire
                      </button>
                    )}
                    {deal.type !== 'active_listing' && (
                      <button
                        onClick={() => pinGate(() => doKillAction('dormant', 'X - Dormant Projects'))}
                        style={{
                          ...btnStyle('#fb923c', 'rgba(251,146,60,0.07)', 'rgba(251,146,60,0.3)'),
                          width: '100%', padding: '9px 16px', fontSize: 12, textAlign: 'center',
                        }}
                      >
                        Dormant
                      </button>
                    )}
                    {deal.dropbox_link && (
                      <button
                        onClick={() => pinGate(() => doKillAction('terminated', 'X - Terminated'))}
                        style={{
                          ...btnStyle('#ef4444', 'rgba(239,68,68,0.07)', 'rgba(239,68,68,0.3)'),
                          width: '100%', padding: '9px 16px', fontSize: 12, textAlign: 'center',
                        }}
                      >
                        Terminate
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* No actions placeholder */}
              {deal.tier !== 'tracked' && deal.tier !== 'filed' && (
                <div style={{ fontSize: 12, color: '#4b5563', textAlign: 'center', padding: '16px 0' }}>
                  No actions available
                </div>
              )}
              {deal.tier === 'filed' && !['active', 'hot', 'under_contract'].includes(deal.status) && deal.type === 'active_listing' && deal.status === 'expired' && (
                <div style={{ fontSize: 12, color: '#4b5563', textAlign: 'center', padding: '8px 0' }}>
                  Deal is {deal.status}
                </div>
              )}
            </div>
          </div>

          {/* Contacts */}
          <ContactsCard deal={deal} />

          {/* Deadlines (only UC) */}
          {deal.status === 'under_contract' && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={sectionHeadStyle}>Contract Deadlines</span>
                <button onClick={() => setShowAddDeadline(s => !s)} style={btnStyle('#2dd4bf', 'rgba(45,212,191,0.08)', 'rgba(45,212,191,0.35)')}>
                  + Add
                </button>
              </div>

              {showAddDeadline && (
                <div style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, padding: 14, marginBottom: 14,
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <input style={inputStyle} value={newDeadline.label} onChange={e => setNewDeadline(d => ({ ...d, label: e.target.value }))} placeholder="Label (e.g. Inspection)" />
                  <input type="date" style={inputStyle} value={newDeadline.deadline_date} onChange={e => setNewDeadline(d => ({ ...d, deadline_date: e.target.value }))} />
                  <select style={inputStyle} value={newDeadline.deadline_type} onChange={e => setNewDeadline(d => ({ ...d, deadline_type: e.target.value as DeadlineType }))}>
                    {(Object.keys(DEADLINE_TYPE_COLORS) as DeadlineType[]).map(t => (
                      <option key={t} value={t}>{DEADLINE_TYPE_COLORS[t].label}</option>
                    ))}
                  </select>
                  <input style={inputStyle} value={newDeadline.notes} onChange={e => setNewDeadline(d => ({ ...d, notes: e.target.value }))} placeholder="Notes (optional)" />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowAddDeadline(false)} style={btnStyle('#9ca3af', 'transparent', 'rgba(156,163,175,0.3)')}>Cancel</button>
                    <button onClick={addDeadline} disabled={addingDeadline || !newDeadline.label || !newDeadline.deadline_date} style={btnStyle('#000', '#2dd4bf', '#2dd4bf')}>
                      {addingDeadline ? 'Adding…' : 'Add Deadline'}
                    </button>
                  </div>
                </div>
              )}

              {deadlines.length === 0 ? (
                <div style={{ fontSize: 12, color: '#4b5563', textAlign: 'center', padding: '16px 0' }}>No deadlines yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {deadlines.map(dl => {
                    const days = daysUntil(dl.deadline_date)
                    const satisfied = dl.status === 'satisfied'
                    const typeInfo = DEADLINE_TYPE_COLORS[dl.deadline_type]
                    const statusInfo = DEADLINE_STATUS_STYLES[dl.status]
                    return (
                      <div key={dl.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: 7,
                        opacity: satisfied ? 0.6 : 1,
                      }}>
                        <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: satisfied ? '#6b7280' : '#F0F2FF', textDecoration: satisfied ? 'line-through' : 'none', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dl.label}
                        </div>
                        <span style={{ padding: '1px 6px', borderRadius: 20, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', background: typeInfo.bg, color: typeInfo.text, flexShrink: 0 }}>
                          {typeInfo.label}
                        </span>
                        <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', flexShrink: 0 }}>
                          {formatDate(dl.deadline_date)}
                        </span>
                        {!satisfied && (
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: getDaysColor(days, dl.status), flexShrink: 0 }}>
                            {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'Today' : `${days}d`}
                          </span>
                        )}
                        <span style={{ padding: '1px 6px', borderRadius: 20, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', background: statusInfo.bg, color: statusInfo.text, flexShrink: 0 }}>
                          {statusInfo.label}
                        </span>
                        {!satisfied && (
                          <button onClick={() => satisfyDeadline(dl.id)} title="Satisfy" style={{ padding: '2px 7px', fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 5, color: '#22c55e', cursor: 'pointer' }}>✓</button>
                        )}
                        <button onClick={() => deleteDeadline(dl.id)} title="Delete" style={{ padding: '2px 7px', fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 5, color: '#ef4444', cursor: 'pointer' }}>✕</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Metadata */}
          <div style={{ ...cardStyle, background: 'transparent', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4b5563', marginBottom: 10 }}>
              Metadata
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                <span style={{ color: '#6b7280' }}>Deal ID</span>
                <button
                  onClick={copyId}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: copiedId ? '#22c55e' : '#4b5563',
                    fontFamily: 'monospace', fontSize: 10,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                  title="Copy ID"
                >
                  {deal.id.slice(0, 8)}…
                  <span style={{ fontSize: 9 }}>{copiedId ? '✓' : '⎘'}</span>
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: '#6b7280' }}>Created</span>
                <span style={{ color: '#9ca3af' }}>{new Date(deal.created_at).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: '#6b7280' }}>Updated</span>
                <span style={{ color: '#9ca3af' }}>{new Date(deal.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function DealDashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0D0F14', color: '#F0F2FF' }}>
        <div style={{ padding: 32 }}>
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
          <div style={{ width: '60%', height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.07)', marginBottom: 10, animation: 'pulse 1.6s ease-in-out infinite' }} />
        </div>
      </div>
    }>
      <DealDashboardInner />
    </Suspense>
  )
}

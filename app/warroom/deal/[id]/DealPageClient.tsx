'use client'
/**
 * Desktop deal page. 157: DP-1 rate chain, DP-4 one plate, DP-5 matte glows,
 * DP-7 edit-pill-master, DP-8 header address, DP-9 chain pre-launch, DP-10 empty states.
 * Canonical route: /warroom/deal/?id=<uuid>
 */

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDealTitle, editNamePrefill, parseListingFilingName, formatListingFilingName } from '@/lib/formatAddress'
import { dealPhotoPublicUrl, uploadDealPhoto } from '@/lib/dealPhoto'
import { HOUSE_SPLIT } from '@/lib/dealMath'
import LaunchControl from './LaunchControl'
import LaunchModal from './LaunchModal'

// ── Auth ─────────────────────────────────────────────────────────────────────
const PIN_HASH = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bgBase:       '#08080C',
  bgPanel:      '#12111B',
  bgRaise:      '#1E1D26',
  textHi:       '#EFEEF4',
  textMid:      '#B8B6C6',
  textLow:      '#8E8CA0',
  brand:        '#8B5CF6',
  brandLift:    '#A78BFA',
  brandStrong:  '#7C3AED',
  moneyIn:      '#34D399',
  late:         '#FF4D4D',
  hot:          '#FFA23A',
  border:       'rgba(255,255,255,0.14)',
  borderPanel:  'rgba(255,255,255,0.11)',
  borderHair:   'rgba(255,255,255,0.10)',
} as const

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const STYLE_M0: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 22,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.1,
}

const STYLE_LABEL: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9.5,
  fontWeight: 500,
  letterSpacing: '0.19em',
  textTransform: 'uppercase',
  color: T.textLow,
  lineHeight: 1,
}

// ── Plate map ─────────────────────────────────────────────────────────────────
const PROPERTY_PLATE_MAP: Record<string, string> = {
  OFFICE:      '/assets/plates/plate-office-v7.png',
  RETAIL:      '/assets/plates/plate-retail-v7.png',
  LAND:        '/assets/plates/plate-land-v7.png',
  INDUSTRIAL:  '/assets/plates/plate-indst-v7.png',
  MULTIFAMILY: '/assets/plates/plate-multi-v7.png',
}

// 154: painted plates for SALE + LEASE marks (44px header pills — not h180)
const SALE_PLATE  = '/assets/plates/sale-pill-154.png'
const LEASE_PLATE = '/assets/plates/lease-pill-154.png'

// ── Panel ────────────────────────────────────────────────────────────────────
function Panel({
  label,
  children,
  style,
}: {
  label: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      background: T.bgRaise,
      borderRadius: 12,
      border: `1px solid ${T.borderPanel}`,
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{ ...STYLE_LABEL, padding: '14px 18px 0', marginBottom: 10 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      fontFamily: FONT_MONO,
      fontSize: 9.5,
      fontWeight: 600,
      letterSpacing: '0.14em',
      color: T.textLow,
      padding: '0 18px 16px',
    }}>
      {text}
    </div>
  )
}

// ── Data types ───────────────────────────────────────────────────────────────
interface DealData {
  id: string
  name: string | null
  address: string | null
  addr_display?: string | null
  addr_street_name?: string | null
  addr_street_type?: string | null
  addr_direction?: string | null
  addr_number?: string | null
  addr_city?: string | null
  addr_zip?: string | null
  status: string
  property_type: string | null
  dropbox_link?: string | null
  representation_role?: string | null
}

interface DealEcon {
  transaction_type: string | null
  asking_price: number | null
  sqft: number | null
  land_sqft: number | null
  sale_commission_pct: number | null
  lease_commission_pct: number | null
  lease_rate_psf: number | null
  lease_term_years: number | null
  nnn_psf: number | null
  // 157: new fields
  listing_rate?: number | null
  co_broker_split?: number | null
}

interface ContactRow {
  contact_id: string
  contacts: {
    id: string
    name: string | null
    role: string | null
    email: string | null
    phone: string | null
  } | null
}

interface NoteRow {
  id: string
  body: string | null
  created_at: string
}

interface ActivityRow {
  id: string
  action_type: string
  description: string | null
  created_at: string
}

// ── Formatters ───────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null) return ''
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n).toLocaleString('en-US')}`
  return `$${n}`
}

function fmtSF(n: number | null | undefined): string {
  if (n == null) return ''
  return `${Math.round(n).toLocaleString('en-US')} SF`
}

function fmtAcres(n: number | null | undefined): string {
  if (n == null) return ''
  return `${n} AC`
}

function fmtPSF(price: number | null | undefined, sf: number | null | undefined): string {
  if (!price || !sf) return ''
  return `$${(price / sf).toFixed(2)}/SF`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  } catch { return iso }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  } catch { return iso }
}

// ── DP-1: Commission math helpers ────────────────────────────────────────────
function calcCommissionChain(econ: DealEcon | null) {
  // listing_rate and co_broker_split may come from deal_economics or use defaults
  const listRate = econ?.listing_rate ?? (econ?.sale_commission_pct ? econ.sale_commission_pct * 2 : 6.0)
  const coBroker = econ?.co_broker_split ?? 0.5
  const askPrice = econ?.asking_price ?? null
  const estComm  = askPrice ? Math.round(askPrice * (listRate / 100) * coBroker * 0.75) : null
  const derivation = askPrice
    ? `$${askPrice.toLocaleString()} × ${listRate.toFixed(2)}% × ${Math.round(coBroker * 100)}% × 75%`
    : null
  return { listRate, coBroker, estComm, derivation }
}

// ── Main page ─────────────────────────────────────────────────────────────────
function DealPageClientInner({ id }: { id: string }) {
  const router  = useRouter()
  const dealId  = id

  const [deal,     setDeal]     = useState<DealData | null>(null)
  const [econ,     setEcon]     = useState<DealEcon | null>(null)
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [notes,    setNotes]    = useState<NoteRow[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)

  // Edit mode
  const [editMode,         setEditMode]         = useState(false)
  const [editName,         setEditName]         = useState('')
  const [editStatus,       setEditStatus]       = useState('')
  const [editDropbox,      setEditDropbox]      = useState('')
  const [saving,           setSaving]           = useState(false)
  const [editPhotoFile,    setEditPhotoFile]    = useState<File | null>(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null)
  const [photoVisible,     setPhotoVisible]     = useState(false)
  const [photoCacheBust,   setPhotoCacheBust]   = useState(0)
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPhotoVisible(false)
    setPhotoCacheBust(0)
    setEditPhotoFile(null)
    setEditPhotoPreview(null)
  }, [dealId])

  // Delete mode
  const [deleteMode,  setDeleteMode]  = useState(false)
  const [deletePin,   setDeletePin]   = useState<string[]>([])
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const [deleting,    setDeleting]    = useState(false)

  // Launch gate
  const [pinValid,    setPinValid]    = useState<boolean | null>(null)
  const [launchOpen,  setLaunchOpen]  = useState(false)
  const [launched,    setLaunched]    = useState(false)

  useEffect(() => {
    const exp1 = parseInt(localStorage.getItem('wr_session_exp_v2') || '0')
    const exp2 = parseInt(localStorage.getItem('wr3_session_exp') || '0')
    setPinValid(Date.now() < exp1 || Date.now() < exp2)
  }, [])

  // Delete gate keyboard
  useEffect(() => {
    if (!deleteMode) return
    const handleKey = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDeleteMode(false); setDeletePin([]); setDeleteArmed(false); setDeleteError(false)
        return
      }
      if (deleteArmed) {
        if (e.key === 'Enter') handleDeleteConfirm()
        return
      }
      if (e.key === 'Backspace') { setDeletePin(p => p.slice(0, -1)); return }
      if (/^\d$/.test(e.key) && deletePin.length < 4) {
        const newPin = [...deletePin, e.key]
        setDeletePin(newPin)
        if (newPin.length === 4) {
          const hash = await sha256(newPin.join(''))
          if (hash === PIN_HASH) {
            setDeleteArmed(true)
          } else {
            setDeleteError(true)
            setTimeout(() => { setDeleteError(false); setDeletePin([]) }, 650)
          }
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [deleteMode, deletePin, deleteArmed, deleteError])

  useEffect(() => {
    if (!dealId) return
    ;(async () => {
      try {
        const { data: dealData, error: dealErr } = await supabase
          .from('deals')
          .select('id,name,address,addr_display,addr_street_name,addr_street_type,addr_direction,addr_number,addr_city,status,property_type,dropbox_link,representation_role')
          .eq('id', dealId)
          .single()
        if (dealErr || !dealData) { setError(true); setLoading(false); return }

        const { data: econData } = await supabase
          .from('deal_economics')
          .select('transaction_type,asking_price,sqft,land_sqft,sale_commission_pct,lease_commission_pct,lease_rate_psf,lease_term_years,nnn_psf,listing_rate,co_broker_split')
          .eq('deal_id', dealId)
          .maybeSingle()

        const { data: contactData } = await supabase
          .from('deal_contacts')
          .select('contact_id, contacts(id,name,role,email,phone)')
          .eq('deal_id', dealId)
          .limit(3)

        const { data: notesData } = await supabase
          .from('notes')
          .select('id,body,created_at')
          .eq('deal_id', dealId)
          .order('created_at', { ascending: false })

        const { data: activityData } = await supabase
          .from('activity_log')
          .select('id,action_type,description,created_at')
          .eq('deal_id', dealId)
          .order('created_at', { ascending: false })

        setDeal(dealData as DealData)
        setEcon(econData as DealEcon ?? null)
        setContacts((contactData as ContactRow[] | null) ?? [])
        setNotes((notesData as NoteRow[] | null) ?? [])
        setActivity((activityData as ActivityRow[] | null) ?? [])
      } catch {
        setError(true)
      }
      setLoading(false)
    })()
  }, [dealId])

  if (pinValid === null || loading) {
    return (
      <div style={{ background: T.bgBase, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ ...STYLE_LABEL, color: T.textLow }}>Loading…</span>
      </div>
    )
  }

  if (!pinValid) {
    return (
      <div style={{ background: T.bgBase, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={T.textLow} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <div style={{ ...STYLE_LABEL }}>Session expired</div>
        <button onClick={() => router.back()} style={{ background: 'none', border: `1px solid ${T.borderPanel}`, borderRadius: 6, padding: '7px 14px', fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textMid, cursor: 'pointer' }}>
          ← Back
        </button>
      </div>
    )
  }

  if (error || !deal) {
    return (
      <div style={{ background: T.bgBase, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 500, color: T.textHi }}>Deal not found</div>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: T.brandLift, fontFamily: FONT_DISPLAY, fontSize: 14, cursor: 'pointer' }}>← Go back</button>
      </div>
    )
  }

  async function handleEditSave() {
    if (!deal || saving) return
    setSaving(true)
    const updates: Record<string, string | null> = {}
    const trimmed = editName.trim()
    const parsed = parseListingFilingName(trimmed)
    if (parsed) {
      const filing = formatListingFilingName(parsed.street, parsed.cardinal, parsed.number)
      updates.name = filing
      updates.addr_street_name = parsed.street || null
      updates.addr_direction = parsed.cardinal || null
      updates.addr_number = parsed.number || null
      updates.addr_display = filing
    } else if (trimmed) {
      updates.name = trimmed
    }
    if (editStatus) updates.status = editStatus
    if (editDropbox.trim() !== (deal.dropbox_link ?? '')) updates.dropbox_link = editDropbox.trim()
    if (Object.keys(updates).length > 0) {
      await supabase.from('deals').update(updates).eq('id', dealId)
    }
    if (editPhotoFile) {
      try {
        await uploadDealPhoto(dealId, editPhotoFile)
        setPhotoCacheBust(Date.now())
        setPhotoVisible(true)
      } catch (err) { console.error('Deal photo upload failed:', err) }
    }
    setDeal({ ...deal, ...updates } as DealData)
    setEditPhotoFile(null)
    setEditPhotoPreview(null)
    setSaving(false)
    setEditMode(false)
  }

  function pickEditPhoto(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return
    setEditPhotoFile(file)
    setEditPhotoPreview(URL.createObjectURL(file))
    setPhotoVisible(true)
  }

  async function handleDeleteConfirm() {
    if (deleting) return
    setDeleting(true)
    await supabase.from('deals').delete().eq('id', dealId)
    router.push('/warroom/deals')
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const isHot    = deal.status === 'hot'
  const txType   = econ?.transaction_type ?? null    // 'sale' | 'lease' | 'both' | null
  const isLease  = txType === 'lease'
  const isDevRole = deal.representation_role === 'developer'

  const propType    = deal.property_type?.toUpperCase() ?? null
  const propPlateSrc = propType ? (PROPERTY_PLATE_MAP[propType] ?? null) : null

  // DP-4: exactly one transaction plate — SALE wins when 'both'
  const showSalePlate  = txType === 'sale' || txType === 'both'
  const showLeasePlate = txType === 'lease'  // never show both at once

  // DP-8: header address — no city in address line; city below as City, ST ZIP
  const shortAddr = formatDealTitle(deal)
  const cityLine = (() => {
    const city = deal.addr_city ?? 'Baton Rouge'
    return `${city}, LA`
  })()

  const clientName = contacts[0]?.contacts?.name ?? null

  // DP-1: Commission rate chain
  const { listRate, coBroker, estComm, derivation } = calcCommissionChain(econ)

  // Glance strip
  type GlanceCell = { label: string; value: string; glow?: boolean }

  const glanceSale: GlanceCell[] = [
    { label: 'Asking Price', value: fmt(econ?.asking_price) },
    { label: 'Price/SF',     value: fmtPSF(econ?.asking_price, econ?.sqft) },
    { label: 'Building SF',  value: fmtSF(econ?.sqft) },
    { label: 'Land Size',    value: fmtAcres(econ?.land_sqft) },
  ]

  const glanceLease: GlanceCell[] = [
    { label: 'Asking Price',   value: fmt(econ?.asking_price) },
    { label: 'Lease Rate PSF', value: econ?.lease_rate_psf ? `$${econ.lease_rate_psf}/SF` : '' },
    { label: 'Building SF',    value: fmtSF(econ?.sqft) },
    { label: 'Land Size',      value: fmtAcres(econ?.land_sqft) },
  ]

  const glanceCells = isLease ? glanceLease : glanceSale
  const visibleCells = glanceCells.filter(c => c.value !== '')

  return (
    <div style={{ background: T.bgBase, minHeight: '100vh', fontFamily: FONT_DISPLAY }}>

      {/* ── HEADER BAND ───────────────────────────────────────────────────── */}
      <div style={{ borderBottom: `1px solid ${T.borderHair}` }}>
        <div style={{
          maxWidth: 1440,
          margin: '0 auto',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'nowrap',
        }}>
          {/* Back */}
          <a href="/warroom/deals" style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textLow, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
            ← Deals
          </a>

          <div style={{ width: 1, height: 22, background: T.borderHair, flexShrink: 0 }} />

          {/* DP-8: address line (no city inline), city below */}
          <div style={{ flexShrink: 0, minWidth: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 500, color: T.textHi, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {shortAddr || '—'}
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow, lineHeight: 1.3, marginTop: 2 }}>
              {/* City, ST ZIP — no city inline in address line above */}
              {cityLine}
              {clientName && <span style={{ color: T.textMid, marginLeft: 10 }}>· {clientName}</span>}
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* HOT pill */}
          {isHot && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: 5, background: T.hot, color: '#0A0A0F', flexShrink: 0 }}>
              HOT
            </span>
          )}
          {!isHot && deal.status && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: 5, background: 'transparent', border: `1px solid ${T.border}`, color: T.textMid, flexShrink: 0 }}>
              {deal.status.replace(/_/g, ' ')}
            </span>
          )}

          {/* DP-4: one transaction plate — SALE wins for 'both' */}
          {/* DP-5: matte — no boxShadow/glow on header plates */}
          {showSalePlate && (
            <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SALE_PLATE} alt="SALE" style={{ height: 44, width: 'auto', display: 'block' }} draggable={false} />
            </div>
          )}
          {showLeasePlate && (
            <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LEASE_PLATE} alt="LEASE" style={{ height: 44, width: 'auto', display: 'block' }} draggable={false} />
            </div>
          )}

          {/* Property plate — matte (DP-5) */}
          {propPlateSrc && (
            <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={propPlateSrc} alt={propType ?? ''} style={{ height: 44, width: 'auto', display: 'block' }} draggable={false} />
            </div>
          )}

          {/* DELETE — matte (DP-5) */}
          <button onClick={() => setDeleteMode(true)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }} aria-label="Delete deal">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/delete/delete-pill-candidate.png" alt="DELETE" style={{ height: 44, width: 'auto', display: 'block' }} draggable={false} />
          </button>

          {/* DP-7: EDIT pill — edit-pill-master.png 44×115, mix-blend-mode: screen */}
          {editMode ? (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
              <button onClick={handleEditSave} disabled={saving} style={{ background: T.brand, border: 'none', borderRadius: 6, padding: '6px 14px', fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#fff', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'SAVING…' : 'SAVE'}
              </button>
              <button onClick={() => { setEditMode(false); setEditPhotoFile(null); setEditPhotoPreview(null) }} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 14px', fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textMid, cursor: 'pointer' }}>
                CANCEL
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push(`/warroom/deals/new?edit=${dealId}`)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', mixBlendMode: 'screen' as React.CSSProperties['mixBlendMode'] }}
              aria-label="Edit deal"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/buttons/edit-pill-master.png"
                alt="Edit"
                style={{ height: 44, width: 115, display: 'block' }}
                draggable={false}
              />
            </button>
          )}
        </div>
      </div>

      {/* ── DELETE GATE ──────────────────────────────────────────────────── */}
      {deleteMode && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(5,5,9,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setDeleteMode(false); setDeletePin([]); setDeleteArmed(false); setDeleteError(false) } }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/star-glow-512.png" alt="" width={148} height={148} style={{ display: 'block', flexShrink: 0 }} />
          <div style={{ height: 24 }} />
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.42em', paddingLeft: '0.42em', color: '#FF4D4D' }}>DELETE DEAL</div>
          <div style={{ height: 36 }} />
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 500, color: T.textHi, textAlign: 'center', maxWidth: 700 }}>
            {deal?.addr_display || deal?.name || '—'}
          </div>
          <div style={{ height: 10 }} />
          <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 500, letterSpacing: '0.14em', color: T.textLow }}>
            {[deal?.property_type, deal?.status?.replace(/_/g,' ').toUpperCase()].filter(Boolean).join(' · ')}
          </div>
          <div style={{ height: 44 }} />
          <div style={{ display: 'flex', gap: 12, animation: deleteError ? 'dg-shake 0.26s ease-in-out' : 'none' }}>
            {[0,1,2,3].map(i => {
              const filled = i < deletePin.length
              const isActive = !deleteArmed && i === deletePin.length && !deleteError
              return (
                <div key={i} style={{ width: 56, height: 66, borderRadius: 12, boxSizing: 'border-box', background: filled ? '#EFEEF4' : 'rgba(255,77,77,0.06)', border: deleteError ? '1px solid #FF4D4D' : isActive ? '1px solid #FF4D4D' : filled ? 'none' : '1px solid rgba(255,255,255,0.14)', boxShadow: isActive ? '0 0 20px rgba(255,77,77,0.35)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {filled && <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#0A0A0F' }} />}
                  {isActive && <div style={{ width: 1.5, height: 26, background: '#FF4D4D', animation: 'dg-caret 1.06s steps(1,end) infinite' }} />}
                </div>
              )
            })}
          </div>
          <div style={{ height: 44 }} />
          <div style={{ height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {deleteArmed && (
              <button onClick={handleDeleteConfirm} disabled={deleting} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/delete/delete-pill-candidate.png" alt="DELETE" style={{ height: 82, width: 'auto', display: 'block', opacity: deleting ? 0.5 : 1 }} draggable={false} />
              </button>
            )}
          </div>
          <div style={{ position: 'absolute', bottom: 34, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 500, letterSpacing: '0.24em', color: '#3F3E4C' }}>SHIRLEYCRE · PERMANENT DELETION</div>
          <style>{`
            @keyframes dg-caret { 0%,49%{opacity:1} 50%,100%{opacity:0} }
            @keyframes dg-shake { 0%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(4px)} 100%{transform:translateX(0)} }
          `}</style>
        </div>
      )}

      {/* ── GLANCE STRIP ─────────────────────────────────────────────────── */}
      {visibleCells.length > 0 && (
        <div style={{ borderBottom: `1px solid ${T.borderHair}` }}>
          <div style={{ display: 'flex', maxWidth: 1440, margin: '0 auto', padding: '0 32px' }}>
            {visibleCells.map((cell, i) => (
              <div key={i} style={{ flex: 1, padding: '14px 0', borderRight: i < visibleCells.length - 1 ? `1px solid ${T.borderHair}` : 'none', paddingLeft: i === 0 ? 0 : 16, paddingRight: i === visibleCells.length - 1 ? 0 : 16, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ ...STYLE_LABEL, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cell.label}</div>
                <div style={{ ...STYLE_M0, color: cell.glow ? T.moneyIn : T.textHi, textShadow: cell.glow ? '0 0 22px rgba(52,211,153,0.35)' : undefined, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cell.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TWO-COLUMN GRID ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 22, maxWidth: 1440, margin: '0 auto', padding: '22px 32px', minHeight: 'calc(100vh - 160px)', alignItems: 'start' }}>

        {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* PHOTO */}
          <Panel label="PHOTO">
            <div
              onClick={editMode ? () => photoInputRef.current?.click() : undefined}
              onDragOver={editMode ? e => e.preventDefault() : undefined}
              onDrop={editMode ? e => { e.preventDefault(); pickEditPhoto(e.dataTransfer.files?.[0]) } : undefined}
              style={{ margin: '0 18px 18px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, minHeight: 120, maxHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: editMode ? 'pointer' : 'default', border: editMode ? `2px dashed ${T.border}` : 'none', position: 'relative' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={editPhotoPreview || dealPhotoPublicUrl(dealId, photoCacheBust)}
                alt=""
                onLoad={() => setPhotoVisible(true)}
                onError={() => { if (!editPhotoPreview) setPhotoVisible(false) }}
                style={{ width: '100%', height: 'auto', maxHeight: 420, objectFit: 'contain', display: photoVisible || editPhotoPreview ? 'block' : 'none' }}
              />
              {!photoVisible && !editPhotoPreview && (
                <span style={{ ...STYLE_LABEL, letterSpacing: '0.12em', position: 'absolute' }}>
                  {editMode ? 'DROP IMAGE OR CLICK TO UPLOAD' : 'PHOTO — No image uploaded.'}
                </span>
              )}
              {editMode && photoVisible && !editPhotoFile && (
                <span style={{ ...STYLE_LABEL, letterSpacing: '0.12em', position: 'absolute', bottom: 10, background: 'rgba(8,8,12,0.72)', padding: '6px 10px', borderRadius: 6 }}>
                  CLICK OR DROP TO REPLACE
                </span>
              )}
            </div>
            {editMode && <input ref={photoInputRef} type="file" accept="image/*" onChange={e => pickEditPhoto(e.target.files?.[0])} style={{ display: 'none' }} />}
          </Panel>

          {/* SHOWINGS — DP-10 */}
          <Panel label="SHOWINGS & PROSPECTS">
            <div style={{ padding: '0 18px', marginBottom: 4 }}>
              <span style={{ ...STYLE_LABEL, fontSize: 9, color: T.textLow }}>0 Showings</span>
            </div>
            <EmptyState text="NO SHOWINGS LOGGED" />
          </Panel>

          {/* DOCUMENTS */}
          <Panel label="DOCUMENTS">
            <div style={{ padding: '0 18px 16px' }}>
              {deal.dropbox_link ? (
                <a href={deal.dropbox_link} target="_blank" rel="noopener noreferrer" style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.brandLift, textDecoration: 'none', display: 'inline-block' }}>
                  Dropbox folder ↗
                </a>
              ) : (
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>No folder linked.</span>
              )}
            </div>
          </Panel>

          {/* NOTES — DP-10 */}
          <Panel label="NOTES">
            <div style={{ padding: '0 18px 16px' }}>
              {notes.length === 0 ? (
                <EmptyState text="NO NOTES" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {notes.map((note, i) => (
                    <div key={note.id} style={{ paddingBottom: 12, borderBottom: i < notes.length - 1 ? `1px solid ${T.borderHair}` : 'none' }}>
                      <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: T.textLow, letterSpacing: '0.10em', marginBottom: 4 }}>{fmtDate(note.created_at)}</div>
                      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textMid, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{note.body ?? ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          {/* ACTIVITY — DP-10 */}
          <Panel label="ACTIVITY">
            <div style={{ padding: '0 18px 16px' }}>
              {activity.length === 0 ? (
                <EmptyState text="NO ACTIVITY YET" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activity.map((row, i) => (
                    <div key={row.id} style={{ paddingBottom: 10, borderBottom: i < activity.length - 1 ? `1px solid ${T.borderHair}` : 'none', display: 'flex', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: T.textLow, letterSpacing: '0.10em', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDateTime(row.created_at)}</span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: T.textMid, letterSpacing: '0.10em', textTransform: 'uppercase', flexShrink: 0 }}>{row.action_type}</span>
                      {row.description && <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textMid, lineHeight: 1.4 }}>{row.description}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>

        </div>

        {/* ── RIGHT RAIL ───────────────────────────────────────────────── */}
        <div style={{ position: 'sticky', top: 22, display: 'flex', flexDirection: 'column', gap: 16, alignSelf: 'start' }}>

          {/* LAUNCH CONTROL — DP-2: launch.css control + rest-master-v2.png, no chevrons */}
          <LaunchControl onClick={() => setLaunchOpen(true)} launched={launched} />
          {launchOpen && txType && (
            <LaunchModal
              dealId={dealId}
              txType={txType}
              address={shortAddr}
              estComm={estComm}
              onClose={() => setLaunchOpen(false)}
              onLaunched={() => { setLaunched(true); setLaunchOpen(false) }}
            />
          )}

          {/* COMMISSION BLOCK — DP-1: full rate chain */}
          {!isDevRole && (
            <Panel label="COMMISSION">
              <div style={{ padding: '0 18px 18px' }}>

                {/* Sale rate chain */}
                {(txType === 'sale' || txType === 'both' || !isLease) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                    {/* LISTING RATE */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ ...STYLE_LABEL, fontSize: 9 }}>LISTING RATE</span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 500, color: T.textHi, fontVariantNumeric: 'tabular-nums' }}>
                        {listRate.toFixed(2)}%
                      </span>
                    </div>

                    {/* CO-BROKER SPLIT */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ ...STYLE_LABEL, fontSize: 9 }}>CO-BROKER SPLIT</span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 500, color: T.textHi, fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round(coBroker * 100)}%
                      </span>
                    </div>

                    {/* HOUSE SPLIT */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ ...STYLE_LABEL, fontSize: 9 }}>HOUSE SPLIT</span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 500, color: T.textHi, fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round(HOUSE_SPLIT * 100)}%
                      </span>
                    </div>

                    {/* Hairline */}
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.14)', margin: '4px 0' }} />

                    {/* EST. COMMISSION */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ ...STYLE_LABEL, fontSize: 9 }}>EST. COMMISSION</span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, color: T.moneyIn, fontVariantNumeric: 'tabular-nums' }}>
                        {estComm != null ? `$${estComm.toLocaleString()}` : '—'}
                      </span>
                    </div>

                    {/* Derivation line */}
                    {derivation && (
                      <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: T.textLow, letterSpacing: '0.06em', lineHeight: 1.4 }}>
                        {derivation}
                      </div>
                    )}
                  </div>
                )}

                {/* Lease rate chain */}
                {isLease && econ?.lease_commission_pct != null && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 0 }}>
                    <div style={{ ...STYLE_LABEL, fontSize: 9, marginBottom: 4 }}>LEASE COMMISSION</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ ...STYLE_LABEL, fontSize: 9 }}>LEASE RATE</span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 500, color: T.textHi, fontVariantNumeric: 'tabular-nums' }}>
                        {econ.lease_commission_pct}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ ...STYLE_LABEL, fontSize: 9 }}>HOUSE SPLIT</span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 500, color: T.textHi, fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round(HOUSE_SPLIT * 100)}%
                      </span>
                    </div>
                  </div>
                )}

              </div>
            </Panel>
          )}

          {/* CONTACTS — DP-10 */}
          <Panel label="CONTACTS">
            <div style={{ padding: '0 18px 16px' }}>
              {contacts.length === 0 ? (
                <EmptyState text="NO CONTACTS" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {contacts.map((row) => {
                    const c = row.contacts
                    if (!c) return null
                    return (
                      <div key={row.contact_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: `1px solid ${T.borderHair}` }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 500, color: T.textHi, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name ?? '—'}</div>
                          {c.role && <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textLow, marginTop: 2 }}>{c.role}</div>}
                        </div>
                        <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.textLow, cursor: 'default', flexShrink: 0, marginLeft: 8 }}>↗</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Panel>

          {/* CHAIN — DP-9: only render when under_contract / pending_payment / closed */}
          {(deal.status === 'under_contract' || deal.status === 'pending_payment' || deal.status === 'closed') && (
            <Panel label="CHAIN" style={{ minHeight: 160 }}>
              <div style={{ padding: '0 18px 18px' }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow, lineHeight: 1.6 }}>
                  No open steps.
                </div>
              </div>
            </Panel>
          )}

        </div>
      </div>
    </div>
  )
}

export default function DealPageClient({ id }: { id: string }) {
  return (
    <Suspense fallback={
      <div style={{ background: '#08080C', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#8E8CA0', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Loading…
        </span>
      </div>
    }>
      <DealPageClientInner id={id} />
    </Suspense>
  )
}

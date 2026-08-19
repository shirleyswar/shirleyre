'use client'

// §20 New-deal intake — five required fields.
// §20.4 check 7: creates exactly ONE open step. Template is not instantiated.
// CODE — §20.4 check 7 verified: one tasks insert after deal insert, no loop.

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { GitBranch } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import BottomSheet from '@/components/warroom3/BottomSheet'
import { FAB_APERTURE_GRADIENT, FAB_APERTURE_SHADOW } from '@/lib/fabGradient'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  bgRaise:   '#1E1D26',
  textHi:    '#EFEEF4',
  textMid:   '#B8B6C6',
  textLow:   '#8E8CA0',
  textInvert:'#0A0A0F',
  brand:     '#8B5CF6',
  brandLift: '#A78BFA',
  late:      '#FF4D4D',
} as const

const styleT2: React.CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500,
  letterSpacing: '0.19em', textTransform: 'uppercase', lineHeight: 1,
}
const styleT4: React.CSSProperties = {
  fontFamily: FONT_DISPLAY, fontSize: 11.5, fontWeight: 400, color: T.textMid, lineHeight: 1.5,
}
const styleB1: React.CSSProperties = {
  fontFamily: FONT_DISPLAY, fontSize: 12, fontWeight: 500, lineHeight: 1,
}

// ── Segmented control — reusable ─────────────────────────────────────────────
// §20.1: bg rgba(255,255,255,0.05), radius 11px, padding 4px.
// Selected: white fill, radius 8px, text-invert. T5 labels, letterSpacing 0.08em.
// Floor: 10px — shorten label before shrinking font.
function SegmentedControl({
  options, value, onChange,
}: {
  options: { label: string; value: string }[]
  value: string
  onChange: (v: string) => void
}) {
  // fontSize: clamp to 10px floor per §20.1
  const labelLen = Math.max(...options.map(o => o.label.length))
  const fs = labelLen > 7 ? 10 : 10.5  // TYPE_TUNE_INPUT: segment label size, floor 10px

  return (
    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 11, padding: 4, gap: 2 }}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              background: active ? '#EFEEF4' : 'transparent',
              color: active ? T.textInvert : T.textMid,
              border: 'none',
              borderRadius: 8,
              padding: '8px 4px',
              fontFamily: FONT_MONO,
              fontSize: fs,
              fontWeight: active ? 700 : 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              minHeight: 44,
              transition: 'background 100ms',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Template selection matrix §14.6.1 ────────────────────────────────────────
function selectTemplate(role: string, txType: string, status: string): string | null {
  if (status === 'pipeline') {
    if (role === 'seller' || role === 'landlord') return 'Prospecting — Owner'
    if (role === 'buyer' || role === 'tenant') return 'Prospecting — Buyer / Tenant'
  }
  if (status === 'active') {
    if (role === 'seller' && txType === 'sale') return 'Listing — Sale'
    if (role === 'landlord' && txType === 'lease') return 'Listing — Lease'
    if (role === 'buyer' && txType === 'sale') return 'Buyer Rep — Acquisition'
    if (role === 'tenant' && txType === 'lease') return 'Tenant Rep — Lease'
  }
  return null
}

// First step of each template — §14.7
// CODE: one of these titles is inserted as the single open step (check 7)
const TEMPLATE_FIRST_STEPS: Record<string, string> = {
  'Prospecting — Owner': 'Qualify target — ownership, decision-maker, property facts, prior activity, trigger',
  'Prospecting — Buyer / Tenant': 'Qualify company / investor — decision-maker, requirement trigger, timing, current location / portfolio, lease expiration or acquisition thesis',
  'Listing — Sale': 'Open deal file; verify executed agreement, pricing, commission, term, contacts, special instructions',
  'Listing — Lease': 'Open deal file; verify executed agreement, availability, asking economics, commission, term, landlord objectives',
  'Buyer Rep — Acquisition': 'Confirm acquisition criteria, capital structure, decision process, timing, representation terms',
  'Tenant Rep — Lease': 'Confirm requirement — use, geography, size, economics, timing, parking, signage, special facility needs, decision process',
}

function todayCST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

// ── Template preview meta line ────────────────────────────────────────────────
function chainPreviewLabel(template: string | null, status: string, role: string, txType: string): string {
  if (!template) return 'No template — chain starts empty'
  // e.g. "SALE LISTING · STARTS TODAY"
  const typeLabel = txType === 'lease' ? 'LEASE' : 'SALE'
  const roleLabel = role === 'seller' ? 'LISTING' : role === 'landlord' ? 'LISTING' : role === 'buyer' ? 'BUYER REP' : 'TENANT REP'
  return `${typeLabel} ${roleLabel} · STARTS TODAY`
}

interface NewDealSheetProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

export default function NewDealSheet({ open, onClose, onCreated }: NewDealSheetProps) {
  const [address, setAddress] = useState('')
  const [txType, setTxType] = useState<'sale' | 'lease'>('sale')
  const [role, setRole] = useState<'seller' | 'landlord' | 'buyer' | 'tenant'>('seller')
  const [status, setStatus] = useState<'pipeline' | 'active'>('pipeline')
  const [clientQ, setClientQ] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const addressRef = useRef<HTMLInputElement>(null)

  // Autofocus address on open §20.1
  useEffect(() => {
    if (open) {
      setAddress(''); setTxType('sale'); setRole('seller'); setStatus('pipeline'); setClientQ(''); setError(null)
      setTimeout(() => addressRef.current?.focus(), 80)
    }
  }, [open])

  const template = selectTemplate(role, txType, status)
  const previewLabel = chainPreviewLabel(template, status, role, txType)

  // All five fields required — Create disabled until set §20.1
  const allSet = address.trim() !== '' && txType && role && status && clientQ.trim() !== ''

  const handleCreate = useCallback(async (empty = false) => {
    if (!allSet && !empty) return
    setSaving(true)
    setError(null)
    try {
      // 1. Insert deal
      const { data: deal, error: dealErr } = await supabase
        .from('deals')
        .insert({
          address: address.trim() || null,
          name: clientQ.trim(),
          transaction_type: txType,
          representation_role: role,
          status: status,
          reporting_cadence_days: 7,
        })
        .select('id')
        .single()

      if (dealErr || !deal) {
        setError('Could not create deal. Try again.')
        setSaving(false)
        return
      }

      // 2. Insert EXACTLY ONE open step — CODE: check 7
      // The template defines a sequence; the chain instantiates ONE step and morphs.
      // Never loop. Never insert more than one row here.
      if (!empty && template) {
        const firstStep = TEMPLATE_FIRST_STEPS[template] || template
        await supabase.from('tasks').insert({
          title: firstStep,
          deal_id: (deal as any).id,
          status: 'open',
          due_date: todayCST(),
        })
        // That is the only insert. One row. Done.
      }

      onCreated?.()
      onClose()
    } catch {
      setError('Unexpected error. Try again.')
    }
    setSaving(false)
  }, [address, txType, role, status, clientQ, allSet, template, onClose, onCreated])

  return (
    <BottomSheet open={open} onClose={onClose} label="New Deal" size="list">
      <div style={{ padding: '0 18px 104px' }}>
        {/* 1. Address — D3-on-underline, autofocused §20.1 */}
        <div style={{ marginBottom: 20 }}>
          <input
            ref={addressRef}
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Address or requirement name"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.18)',
              outline: 'none',
              fontFamily: FONT_DISPLAY,
              fontSize: 23,    // D3
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: T.textHi,
              padding: '8px 0 10px',
            } as React.CSSProperties}
          />
        </div>

        {/* 2. Transaction type — segmented 2 §20.1 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...styleT2, color: T.textLow, marginBottom: 8 }}>TRANSACTION TYPE</div>
          <SegmentedControl
            options={[{ label: 'SALE', value: 'sale' }, { label: 'LEASE', value: 'lease' }]}
            value={txType}
            onChange={v => setTxType(v as any)}
          />
        </div>

        {/* 3. Representation role — segmented 4, directly under transaction_type §20.1 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...styleT2, color: T.textLow, marginBottom: 8 }}>REPRESENTATION ROLE</div>
          <SegmentedControl
            options={[
              { label: 'SELLER', value: 'seller' },
              { label: 'LANDLORD', value: 'landlord' },
              { label: 'BUYER', value: 'buyer' },
              { label: 'TENANT', value: 'tenant' },
            ]}
            value={role}
            onChange={v => setRole(v as any)}
          />
        </div>

        {/* 4. Status — segmented 2, pipeline and active only §20.1 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...styleT2, color: T.textLow, marginBottom: 8 }}>STATUS</div>
          <SegmentedControl
            options={[{ label: 'PIPELINE', value: 'pipeline' }, { label: 'ACTIVE', value: 'active' }]}
            value={status}
            onChange={v => setStatus(v as any)}
          />
        </div>

        {/* 5. Client — search field §20.1 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...styleT2, color: T.textLow, marginBottom: 8 }}>CLIENT</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgRaise, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 9, padding: '11px 14px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLow} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={clientQ}
              onChange={e => setClientQ(e.target.value)}
              placeholder="Person or company"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: FONT_DISPLAY, fontSize: 16, color: T.textMid }}
            />
          </div>
        </div>

        {/* Chain preview — §20.2: names template, never shows step count */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.10)', paddingTop: 14, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GitBranch size={15} color={T.brandLift} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 500, color: template ? T.textHi : T.textLow }}>
                {template ?? 'No template — chain starts empty'}
              </div>
              {template && (
                <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textLow, marginTop: 3 }}>
                  {previewLabel}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.late, marginBottom: 12 }}>{error}</div>
        )}

        {/* Footer — Create deal (dominant) + EMPTY (secondary) §20.3 */}
        <div style={{ display: 'flex', gap: 9 }}>
          <button
            onClick={() => handleCreate(false)}
            disabled={!allSet || saving}
            style={{
              flex: 1,
              background: allSet && !saving ? FAB_APERTURE_GRADIENT : 'rgba(139,92,246,0.3)',
              boxShadow: allSet && !saving ? FAB_APERTURE_SHADOW : 'none',
              color: T.textInvert, border: 'none',
              borderRadius: 9, padding: '12px 0', ...styleB1,
              opacity: !allSet || saving ? 0.5 : 1,
              cursor: !allSet || saving ? 'default' : 'pointer',
              minHeight: 44,
            } as React.CSSProperties}
          >
            {saving ? 'Creating…' : 'Create deal'}
          </button>
          {/* EMPTY — secondary, never visually dominant §20.3 */}
          <button
            onClick={() => handleCreate(true)}
            disabled={saving}
            style={{
              background: 'transparent', color: T.textMid,
              border: '1px solid rgba(255,255,255,0.20)',
              borderRadius: 9, padding: '12px 14px', ...styleB1,
              cursor: saving ? 'default' : 'pointer',
              minHeight: 44,
            } as React.CSSProperties}
          >
            EMPTY
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

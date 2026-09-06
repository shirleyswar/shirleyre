'use client'

// MoneyMoverAddSheet — Item 146
// Patterned on TaskSheet. Inserts to money_movers table.
// Fields: title (required, autofocus) + commission (optional numeric).

import React, { useState, useEffect, useRef } from 'react'
import BottomSheet from '@/components/warroom3/BottomSheet'
import { supabase } from '@/lib/supabase'
import { FAB_APERTURE_GRADIENT, FAB_APERTURE_SHADOW } from '@/lib/fabGradient'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"

const T = {
  textHi:     '#EFEEF4',
  textMid:    '#B8B6C6',
  textLow:    '#8E8CA0',
  textInvert: '#0A0A0F',
} as const

interface MoneyMoverAddSheetProps {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

export default function MoneyMoverAddSheet({ open, onClose, onSaved }: MoneyMoverAddSheetProps) {
  const [title, setTitle]           = useState('')
  const [commission, setCommission] = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [offline, setOffline]       = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  // Autofocus title on open
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => titleRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setTitle('')
      setCommission('')
      setSaving(false)
      setError(null)
      setOffline(false)
    }
  }, [open])

  const canSave = title.trim().length > 0

  const handleSave = async () => {
    if (!canSave || saving) return

    if (!navigator.onLine) {
      setOffline(true)
      return
    }

    setSaving(true)
    setError(null)
    setOffline(false)

    // Strip non-numeric chars from commission (handles $1,234.56 → 1234.56)
    const rawCommission = commission.replace(/[^0-9.]/g, '')
    const parsedCommission = rawCommission.length > 0 ? parseFloat(rawCommission) : null

    const { error: insertError } = await supabase
      .from('money_movers')
      .insert({
        title: title.trim(),
        commission: parsedCommission || null,
      })

    setSaving(false)

    if (insertError) {
      setError(insertError.message || 'Save failed — try again')
    } else {
      onClose()
      onSaved?.()
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="New Money Mover"
      size="list"
    >
      <div style={{ padding: '0 18px 24px' }}>

        {/* Title field */}
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={e => { setTitle(e.target.value); setError(null) }}
          placeholder="Money mover title"
          style={{
            display: 'block',
            width: '100%',
            fontFamily: FONT_DISPLAY,
            fontSize: 22,
            fontWeight: 500,
            color: T.textHi,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 0,
            outline: 'none',
            padding: '8px 0 10px',
            marginBottom: 24,
            caretColor: '#8B5CF6',
            boxSizing: 'border-box',
          } as React.CSSProperties}
        />

        {/* Commission field */}
        <input
          type="text"
          inputMode="decimal"
          value={commission}
          onChange={e => setCommission(e.target.value)}
          placeholder="Commission (optional)"
          style={{
            display: 'block',
            width: '100%',
            fontFamily: FONT_DISPLAY,
            fontSize: 16,
            fontWeight: 400,
            color: T.textHi,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 0,
            outline: 'none',
            padding: '8px 0 10px',
            marginBottom: 28,
            caretColor: '#8B5CF6',
            boxSizing: 'border-box',
          } as React.CSSProperties}
        />

        {/* Offline banner */}
        {offline && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 9,
            background: 'rgba(255,162,58,0.10)',
            border: '1px solid rgba(255,162,58,0.22)',
            fontFamily: FONT_DISPLAY,
            fontSize: 12,
            color: '#FFA23A',
          }}>
            You&apos;re offline — check your connection
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 9,
            background: 'rgba(255,77,77,0.10)',
            border: '1px solid rgba(255,77,77,0.22)',
            fontFamily: FONT_DISPLAY,
            fontSize: 12,
            color: '#FF4D4D',
          }}>
            {error}
          </div>
        )}

        {/* Footer: Cancel + Save money mover */}
        <div style={{ display: 'flex', gap: 9, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              height: 46,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.20)',
              borderRadius: 11,
              color: T.textMid,
              fontFamily: FONT_DISPLAY,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{
              flex: 1,
              height: 46,
              background: canSave && !saving ? FAB_APERTURE_GRADIENT : 'rgba(139,92,246,0.3)',
              boxShadow: canSave && !saving ? FAB_APERTURE_SHADOW : 'none',
              border: 'none',
              borderRadius: 11,
              color: canSave && !saving ? T.textInvert : T.textLow,
              fontFamily: FONT_DISPLAY,
              fontSize: 13,
              fontWeight: 600,
              cursor: canSave && !saving ? 'pointer' : 'default',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties}
          >
            {saving ? 'Saving…' : 'Save money mover'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

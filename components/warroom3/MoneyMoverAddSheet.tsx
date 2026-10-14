'use client'

// MoneyMoverAddSheet — Item 146
// Patterned on TaskSheet. Inserts to money_movers table.
// Fields: title (required, autofocus) + commission (optional numeric).

import React, { useState, useEffect, useRef } from 'react'
import BottomSheet from '@/components/warroom3/BottomSheet'
import { supabase } from '@/lib/supabase'
import { FAB_APERTURE_GRADIENT, FAB_APERTURE_SHADOW } from '@/lib/fabGradient'
import chrome from '@/components/warroom/taskItemChrome.module.css'
import MoneyAmountField from '@/components/warroom/MoneyAmountField'
import { commitMoney } from '@/lib/moneyInput'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"

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
    const committed = commitMoney(commission)
    setCommission(committed.text)

    const { error: insertError } = await supabase
      .from('money_movers')
      .insert({
        title: title.trim(),
        commission: committed.amount && committed.amount > 0 ? committed.amount : null,
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
      label="Add Money Mover"
      size="list"
    >
      <div style={{ padding: '0 18px 24px' }}>

        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={e => { setTitle(e.target.value); setError(null) }}
          placeholder="What is this for?"
          aria-label="Title"
          className={chrome.titleField}
          style={{ marginBottom: 22 }}
        />

        <div style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: T.textLow,
          marginBottom: 8,
        }}>Value</div>
        <MoneyAmountField
          value={commission}
          onChange={setCommission}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 34,
            fontWeight: 500,
            marginBottom: 8,
          }}
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

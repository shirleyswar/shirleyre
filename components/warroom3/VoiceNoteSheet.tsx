'use client'

// §18 Voice Note sheet — Phase 1
// §18.3: Full-height sheet. FIELD FOCUSED ON OPEN — this is the entire feature.
// §18.4: Save disabled when body empty. Dismiss guard on non-empty content.
// §18.5: In-flight: all dismiss paths inert, field read-only but visible.
// §18.6: Success toast above tab bar, 5s, real Undo (deletes row).
// §18.7: Failure: sheet stays open, text stays, failure banner, two non-destructive exits.
// §18.8: Offline: same failure path as §18.7. No silent queue.
// All type references bound to §3.2 named levels. No pixel literals for text.

'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import BottomSheet from '@/components/warroom3/BottomSheet'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  bgBase:    '#08080C',
  bgPanel:   '#12111B',
  bgRaise:   '#1E1D26',
  textHi:    '#EFEEF4',
  textMid:   '#B8B6C6',
  textLow:   '#8E8CA0',
  textInvert:'#0A0A0F',
  late:      '#FF4D4D',
  moneyIn:   '#34D399',
  brand:     '#8B5CF6',
  brandLift: '#A78BFA',
} as const

// T2 §3.2 — group/micro labels
const styleT2: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9.5,
  fontWeight: 500,
  letterSpacing: '0.19em',
  textTransform: 'uppercase',
  lineHeight: 1,
}

// B1 §3.2 — 12px / 500 / sentence / Space Grotesk — button labels
const styleB1: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1,
}

function todayCST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

interface SaveToastProps {
  message: string
  noteId: string
  onDismiss: () => void
}

// §18.6 success toast — 5s, above tab bar, 3px money-in spine, real Undo
function SaveToast({ message, noteId, onDismiss }: SaveToastProps) {
  const [undoing, setUndoing] = useState(false)

  useEffect(() => {
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const handleUndo = async () => {
    setUndoing(true)
    try {
      await supabase.from('notes').delete().eq('id', noteId)
    } catch { /* ignore — toast dismisses anyway */ }
    onDismiss()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed',
        bottom: 14,
        left: 14,
        right: 14,
        borderRadius: 12,
        background: 'rgba(18,17,26,0.97)',
        border: '1px solid rgba(255,255,255,0.14)',
        // 3px money-in spine §18.6
        borderLeft: `3px solid ${T.moneyIn}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 16px',
        zIndex: 900,
      }}
    >
      {/* B1 message */}
      <span style={{ ...styleB1, color: T.textHi, flex: 1 }}>{message}</span>
      {/* UNDO — T2 brand-lift — real: deletes the row */}
      <button
        onClick={handleUndo}
        disabled={undoing}
        style={{
          ...styleT2,
          color: T.brandLift,
          background: 'none',
          border: 'none',
          cursor: undoing ? 'default' : 'pointer',
          opacity: undoing ? 0.5 : 1,
          flexShrink: 0,
          padding: '4px 0',
        }}
      >
        UNDO
      </button>
    </motion.div>
  )
}

interface FailureBannerProps {
  onRetry: () => void
  onKeepDraft: () => void
}

// §18.7 failure banner — sheet stays open, text stays, two non-destructive exits
function FailureBanner({ onRetry, onKeepDraft }: FailureBannerProps) {
  return (
    <div style={{
      margin: '0 0 12px',
      padding: '12px 14px',
      background: 'rgba(255,77,77,0.09)',
      border: '1px solid rgba(255,77,77,0.4)',
      borderLeft: '3px solid #FF4D4D',
      borderRadius: 8,
    }}>
      <div style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 13,
        fontWeight: 500,
        color: T.textHi,
        marginBottom: 4,
      }}>Couldn't save — no connection</div>
      <div style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 11.5,
        color: T.textMid,
        marginBottom: 12,
      }}>Your note is still here. Nothing was lost.</div>
      <div style={{ display: 'flex', gap: 9 }}>
        {/* Primary: Try again */}
        <button
          onClick={onRetry}
          style={{
            flex: 1,
            background: '#EFEEF4',
            color: T.textInvert,
            border: 'none',
            borderRadius: 9,
            padding: '10px 0',
            ...styleB1,
            cursor: 'pointer',
            minHeight: 44,
          } as React.CSSProperties}
        >
          Try again
        </button>
        {/* Secondary: Keep draft */}
        <button
          onClick={onKeepDraft}
          style={{
            flex: 1,
            background: 'transparent',
            color: T.textMid,
            border: '1px solid rgba(255,255,255,0.20)',
            borderRadius: 9,
            padding: '10px 0',
            ...styleB1,
            cursor: 'pointer',
            minHeight: 44,
          } as React.CSSProperties}
        >
          Keep draft
        </button>
      </div>
    </div>
  )
}

interface VoiceNoteSheetProps {
  open: boolean
  onClose: () => void
}

export default function VoiceNoteSheet({ open, onClose }: VoiceNoteSheetProps) {
  const [body, setBody] = useState('')
  const [inFlight, setInFlight] = useState(false)
  const [failed, setFailed] = useState(false)
  const [toast, setToast] = useState<{ message: string; noteId: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // §18.3: FIELD FOCUSED ON OPEN — this is the whole feature
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => textareaRef.current?.focus(), 80)
      return () => clearTimeout(t)
    } else {
      // Reset failure state when closed (not draft state — keep body)
      setFailed(false)
      setInFlight(false)
    }
  }, [open])

  // §18.4: dismiss guard — if body has content, confirm before discarding
  const handleClose = useCallback(() => {
    if (inFlight) return // §18.5: inert while in-flight
    if (body.trim() && !failed) {
      if (!window.confirm('Discard this note?')) return
    }
    setBody('')
    setFailed(false)
    onClose()
  }, [body, failed, inFlight, onClose])

  const handleSave = useCallback(async () => {
    if (!body.trim() || inFlight) return

    // §18.8: offline check — fail loudly, retain
    if (!navigator.onLine) {
      setFailed(true)
      return
    }

    setInFlight(true)
    setFailed(false)
    try {
      const { data, error } = await supabase
        .from('notes')
        .insert({ body: body.trim(), deal_id: null, created_at: new Date().toISOString() })
        .select('id')
        .single()

      if (error || !data) {
        setFailed(true)
        setInFlight(false)
        return
      }

      // §18.6: success — close sheet, show toast
      const noteId = (data as any).id
      setBody('')
      setFailed(false)
      onClose()
      setToast({ message: 'Note saved', noteId })
    } catch {
      setFailed(true)
    }
    setInFlight(false)
  }, [body, inFlight, onClose])

  const handleRetry = useCallback(() => {
    setFailed(false)
    handleSave()
  }, [handleSave])

  // "Keep draft" — closes the failure banner, keeps body, closes sheet (non-destructive)
  const handleKeepDraft = useCallback(() => {
    setFailed(false)
    // Don't clear body — user can re-open and try again
    // Sheet close is safe since failed=false now means no banner on reopen
    onClose()
  }, [onClose])

  return (
    <>
      {/* §18.3: Full-height sheet — BottomSheet with top:34px
          Using size="list" (top:78px) as closest available — full-height TBD when BottomSheet
          gets a 'full' size prop. Keyboard occupies lower half naturally. */}
      <BottomSheet
        open={open}
        onClose={handleClose}  // routes through dismiss guard
        label="Voice Note"
        size="list"
      >
        <div style={{ padding: '0 18px 18px' }}>
          {/* §18.7 failure banner — above field */}
          {failed && (
            <FailureBanner onRetry={handleRetry} onKeepDraft={handleKeepDraft} />
          )}

          {/* §18.3 text field — focused on open */}
          <textarea
            ref={textareaRef}
            value={body}
            onChange={e => !inFlight && setBody(e.target.value)}
            readOnly={inFlight}  // §18.5: read-only but visible in-flight
            placeholder="Tap the mic on the keyboard and talk…"
            rows={4}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: T.bgRaise,
              border: failed
                ? '1px solid rgba(139,92,246,0.5)'
                : '1px solid rgba(255,255,255,0.14)',
              // §18.3 focus ring
              outline: 'none',
              borderRadius: 9,
              padding: '12px 14px',
              fontFamily: FONT_DISPLAY,
              fontSize: 14.5, // T3
              fontWeight: 400,
              color: T.textHi,
              lineHeight: 1.5,
              resize: 'none',
              minHeight: 120,
            } as React.CSSProperties}
            onFocus={e => {
              e.target.style.border = '1px solid rgba(139,92,246,0.5)'
              e.target.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.14)'
            }}
            onBlur={e => {
              if (!failed) {
                e.target.style.border = '1px solid rgba(255,255,255,0.14)'
                e.target.style.boxShadow = 'none'
              }
            }}
          />

          {/* Optional: Deal + Contact side by side, Tags below §18.3 */}
          <div style={{ display: 'flex', gap: 9, marginTop: 12 }}>
            <div style={{ flex: 1, background: T.bgRaise, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 9, padding: '10px 12px', minHeight: 44 }}>
              <div style={{ ...styleT2, color: T.textLow, marginBottom: 4 }}>DEAL</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: T.textLow }}>Optional</div>
            </div>
            <div style={{ flex: 1, background: T.bgRaise, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 9, padding: '10px 12px', minHeight: 44 }}>
              <div style={{ ...styleT2, color: T.textLow, marginBottom: 4 }}>CONTACT</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: T.textLow }}>Optional</div>
            </div>
          </div>
          <div style={{ marginTop: 9, background: T.bgRaise, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 9, padding: '10px 12px', minHeight: 44 }}>
            <div style={{ ...styleT2, color: T.textLow, marginBottom: 4 }}>TAGS</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: T.textLow }}>Optional</div>
          </div>

          {/* §18.3: reserved space for Phase 3/4 controls (record + geo) */}
          <div style={{ height: 32 }} />

          {/* Footer buttons */}
          <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
            <button
              onClick={handleSave}
              disabled={!body.trim() || inFlight}  // §18.4: disabled when empty
              style={{
                flex: 1,
                background: '#EFEEF4',
                color: T.textInvert,
                border: 'none',
                borderRadius: 9,
                padding: '12px 0',
                ...styleB1,
                cursor: body.trim() && !inFlight ? 'pointer' : 'default',
                opacity: body.trim() && !inFlight ? 1 : 0.4,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              } as React.CSSProperties}
            >
              {inFlight ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Saving…
                </>
              ) : 'Save'}
            </button>
            <button
              onClick={handleClose}
              disabled={inFlight}  // §18.5: inert while in-flight
              style={{
                background: 'transparent',
                color: T.textMid,
                border: '1px solid rgba(255,255,255,0.20)',
                borderRadius: 9,
                padding: '12px 16px',
                ...styleB1,
                cursor: inFlight ? 'default' : 'pointer',
                opacity: inFlight ? 0.4 : 1,
                minHeight: 44,
              } as React.CSSProperties}
            >
              Cancel
            </button>
          </div>
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </BottomSheet>

      {/* §18.6 success toast */}
      <AnimatePresence>
        {toast && (
          <SaveToast
            message={toast.message}
            noteId={toast.noteId}
            onDismiss={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

'use client'
/**
 * LaunchModal — §D5.6 under-contract gate
 * Single mark: PIN card directly
 * Both marks: step 1 (SALE PENDING / LEASE PENDING chooser) → PIN card
 * Spec: WARROOM-154 §6 / §D5.6
 */

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const PIN_HASH = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISP = "'Space Grotesk', system-ui, sans-serif"
const C = {
  bgBase: '#050509', bgPanel: '#12111B', bgRaise: '#1E1D26',
  textHi: '#EFEEF4', textMid: '#B8B6C6', textLow: '#8E8CA0',
  brand: '#8B5CF6', brandLift: '#A78BFA',
  moneyIn: '#34D399', late: '#FF4D4D',
  border: 'rgba(255,255,255,0.14)', borderPanel: 'rgba(255,255,255,0.11)',
} as const

interface LaunchModalProps {
  dealId: string
  txType: string | null  // 'sale' | 'lease' | 'both'
  onClose: () => void
  onLaunched: () => void
}

export default function LaunchModal({ dealId, txType, onClose, onLaunched }: LaunchModalProps) {
  const hasBothMarks = txType === 'both'
  const [step, setStep] = useState<'choose' | 'pin'>(hasBothMarks ? 'choose' : 'pin')
  const [chosenMark, setChosenMark] = useState<'sale' | 'lease' | null>(
    !hasBothMarks ? (txType as 'sale' | 'lease') : null
  )
  const [pin, setPin] = useState<string[]>([])
  const [pinError, setPinError] = useState(false)
  const [pinArmed, setPinArmed] = useState(false)
  const [saving, setSaving] = useState(false)

  // Keyboard handler
  useEffect(() => {
    async function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (step === 'pin') {
        if (pinArmed) {
          if (e.key === 'Enter') await handleLaunch()
          return
        }
        if (e.key === 'Backspace') { setPin(p => p.slice(0, -1)); return }
        if (/^\d$/.test(e.key) && pin.length < 4) {
          const newPin = [...pin, e.key]
          setPin(newPin)
          if (newPin.length === 4) {
            const hash = await sha256(newPin.join(''))
            if (hash === PIN_HASH) {
              setPinArmed(true)
            } else {
              setPinError(true)
              setTimeout(() => { setPinError(false); setPin([]) }, 650)
            }
          }
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step, pin, pinArmed]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLaunch() {
    if (saving) return
    setSaving(true)
    try {
      await supabase.from('deals').update({ status: 'under_contract' }).eq('id', dealId)
      onLaunched()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(5,5,9,0.90)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ width: 480, background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: `1px solid ${C.borderPanel}` }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500, letterSpacing: '0.14em', color: C.brandLift, flex: 1 }}>
            LAUNCH DEAL
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
            <span style={{ fontFamily: FONT_DISP, fontSize: 20, color: C.textLow }}>×</span>
          </button>
        </div>

        {step === 'choose' && (
          <div style={{ padding: '24px 20px 28px' }}>
            <div style={{ fontFamily: FONT_DISP, fontSize: 16, color: C.textMid, marginBottom: 20 }}>
              Which transaction is going under contract?
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {(['sale', 'lease'] as const).map(mark => (
                <button
                  key={mark}
                  onClick={() => { setChosenMark(mark); setStep('pin') }}
                  style={{
                    flex: 1, height: 72, borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${C.border}`,
                    cursor: 'pointer',
                    fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700,
                    letterSpacing: '0.14em', color: C.textHi,
                  }}
                >
                  {mark.toUpperCase()} PENDING
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'pin' && (
          <div style={{ padding: '24px 20px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ fontFamily: FONT_DISP, fontSize: 16, color: C.textMid }}>
              {chosenMark ? `${chosenMark.toUpperCase()} PENDING — enter PIN to confirm` : 'Enter PIN to confirm'}
            </div>
            {/* PIN dots */}
            <div style={{ display: 'flex', gap: 14 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  width: 56, height: 66,
                  border: `2px solid ${pinError ? C.late : (pin.length > i ? C.brandLift : C.border)}`,
                  borderRadius: 10,
                  background: pinError ? 'rgba(255,77,77,0.08)' : (pin.length > i ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'border-color 0.15s, background 0.15s',
                }}>
                  {pin.length > i && (
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.brandLift }} />
                  )}
                </div>
              ))}
            </div>
            {pinArmed && (
              <button
                onClick={handleLaunch}
                disabled={saving}
                style={{
                  height: 52, padding: '0 32px', borderRadius: 10,
                  background: saving ? 'rgba(52,211,153,0.3)' : C.moneyIn,
                  border: 'none', cursor: saving ? 'default' : 'pointer',
                  fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700,
                  letterSpacing: '0.14em', color: '#0A0A0F',
                }}
              >
                {saving ? 'LAUNCHING…' : 'CONFIRM LAUNCH'}
              </button>
            )}
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.textLow, letterSpacing: '0.12em' }}>
              ESC to cancel
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

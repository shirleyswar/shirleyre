'use client'
/**
 * LaunchModal — 9.9.26 2300 spec (157 replacement)
 * LG-1…LG-12 — Full launch gate
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

interface LaunchModalProps {
  dealId: string
  txType: string           // 'sale' | 'lease' | 'both'
  address: string          // §5.11.9 short form
  estComm: number | null   // post-house-split EST. COMMISSION
  onClose: () => void
  onLaunched: () => void
}

export default function LaunchModal({
  dealId,
  txType,
  address,
  estComm,
  onClose,
  onLaunched,
}: LaunchModalProps) {
  const hasBothMarks = txType === 'both'

  // step: 'choose' | 'pin' | 'launched'
  const [step, setStep] = useState<'choose' | 'pin' | 'launched'>(hasBothMarks ? 'choose' : 'pin')
  const [chosenMark, setChosenMark] = useState<'sale' | 'lease' | null>(
    !hasBothMarks ? (txType as 'sale' | 'lease') : null
  )
  const [pin, setPin] = useState<string[]>([])
  const [pinError, setPinError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [redBorders, setRedBorders] = useState(false)

  // card width animates between steps
  const cardWidth = step === 'pin' || step === 'launched' ? 420 : 800

  // keyboard handler
  useEffect(() => {
    async function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (step === 'launched') { onLaunched(); return }
        onClose()
        return
      }
      if (step !== 'pin') return
      if (e.key === 'Backspace') {
        setPin(p => p.slice(0, -1))
        return
      }
      if (/^\d$/.test(e.key) && pin.length < 4) {
        const newPin = [...pin, e.key]
        setPin(newPin)
        if (newPin.length === 4) {
          const hash = await sha256(newPin.join(''))
          if (hash === PIN_HASH) {
            await handleCorrectPin(newPin)
          } else {
            // Wrong PIN: shake + red borders
            setShaking(true)
            setRedBorders(true)
            setTimeout(() => setShaking(false), 260)
            setTimeout(() => { setRedBorders(false); setPin([]) }, 600)
          }
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pin])

  async function handleCorrectPin(pinArr: string[]) {
    if (saving) return
    setSaving(true)
    try {
      // LG-12: update deal status
      await supabase.from('deals').update({ status: 'under_contract' }).eq('id', dealId)

      // Instantiate chain based on chosen mark
      const markType = chosenMark ?? (txType as 'sale' | 'lease')
      const today = new Date()
      const addDays = (d: Date, n: number) => {
        const r = new Date(d)
        r.setDate(r.getDate() + n)
        return r.toISOString().slice(0, 10)
      }

      if (markType === 'sale') {
        // Insert contract deadlines: inspection, financing, closing
        await supabase.from('contract_deadlines').insert([
          { deal_id: dealId, deadline_type: 'inspection',  deadline_date: addDays(today, 10), status: 'pending' },
          { deal_id: dealId, deadline_type: 'financing',   deadline_date: addDays(today, 21), status: 'pending' },
          { deal_id: dealId, deadline_type: 'closing',     deadline_date: addDays(today, 45), status: 'pending' },
        ])
      } else {
        // Lease pending: one deadline
        await supabase.from('contract_deadlines').insert([
          { deal_id: dealId, deadline_type: 'lease out for signature', deadline_date: addDays(today, 7), status: 'pending' },
        ])
      }

      setStep('launched')
    } catch {
      // ignore
    }
    setSaving(false)
  }

  function handleClose() {
    if (step === 'launched') { onLaunched(); return }
    onClose()
  }

  // ── Overlay click to close
  function handleOverlayClick() {
    handleClose()
  }

  // ── Card rim: 7-stop conic (STATIC, no sweep animation)
  // Implemented as 1px padding wrapper with conic gradient background
  const conicRim = `conic-gradient(from 0deg,
    transparent 0deg,
    rgba(214,196,255,.90) 38deg,
    rgba(124,58,237,.90) 80deg,
    transparent 134deg,
    transparent 272deg,
    rgba(139,92,246,.72) 320deg,
    transparent 352deg)`

  // Orb video ref
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (step === 'pin' && videoRef.current) {
      videoRef.current.play().catch(() => {/* no autoplay — static orb shows */})
    }
  }, [step])

  return (
    <>
      <style>{`
        @keyframes pin-shake {
          0%,100% { transform: translateX(0) }
          20%,60% { transform: translateX(-6px) }
          40%,80% { transform: translateX(6px) }
        }
        @keyframes pin-caret {
          0%,49%  { opacity: 1 }
          50%,100% { opacity: 0 }
        }
        @keyframes lm-launched-glow {
          0%,100% { opacity: .7 }
          50%     { opacity: 1 }
        }
      `}</style>

      {/* ── Overlay */}
      <div
        onClick={handleOverlayClick}
        style={{
          position: 'fixed', inset: 0, zIndex: 400,
          background: 'rgba(5,5,9,0.90)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* ── Card rim wrapper (conic, STATIC) */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: cardWidth + 2,
            background: conicRim,
            borderRadius: 23,
            padding: 1,
            transition: 'width 0.22s cubic-bezier(.4,0,.2,1)',
          }}
        >
          {/* ── Card body */}
          <div style={{
            width: '100%',
            borderRadius: 22,
            background: 'radial-gradient(ellipse 55% 130% at 50% 45%, #2A1D52 0%, #171130 38%, #0C0A16 72%, #06050A 100%)',
            boxShadow: 'inset 0 1px 0 rgba(196,181,253,.24), inset 0 0 15px 5px rgba(0,0,0,.5)',
            padding: '40px 48px',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}>

            {/* ── Header row (LG-3) */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36,
            }}>
              {/* LAUNCH wordmark */}
              <span style={{
                fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700,
                letterSpacing: '0.19em', color: '#A78BFA', whiteSpace: 'nowrap',
              }}>LAUNCH</span>

              {/* Hairline */}
              <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,.20)', flexShrink: 0 }} />

              {/* Address */}
              <span style={{
                fontFamily: FONT_DISP, fontSize: 15, fontWeight: 400,
                color: '#B8B6C6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              }}>
                {address}
              </span>

              {/* Step counter — only when hasBothMarks and in pin step */}
              {hasBothMarks && step === 'pin' && (
                <span style={{
                  fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500,
                  letterSpacing: '0.13em', color: '#8E8CA0', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  STEP 2 OF 2
                </span>
              )}
              {hasBothMarks && step === 'choose' && (
                <span style={{
                  fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500,
                  letterSpacing: '0.13em', color: '#8E8CA0', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  STEP 1 OF 2
                </span>
              )}

              {/* × close */}
              <button
                onClick={handleClose}
                style={{
                  background: 'none', border: 'none', padding: '4px 8px',
                  cursor: 'pointer', color: '#8E8CA0', fontFamily: FONT_DISP,
                  fontSize: 20, lineHeight: 1, flexShrink: 0, marginLeft: 4,
                }}
              >×</button>
            </div>

            {/* ── STEP 1: Choose (LG-2) — 800px card */}
            {step === 'choose' && (
              <div style={{ display: 'flex', gap: 20 }}>

                {/* SALE PENDING */}
                <button
                  onClick={() => { setChosenMark('sale'); setStep('pin') }}
                  style={{
                    flex: 1, padding: '28px 26px', borderRadius: 16, cursor: 'pointer',
                    background: 'rgba(139,92,246,.10)',
                    border: '1px solid rgba(167,139,250,.44)',
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12,
                    textAlign: 'left',
                  }}
                >
                  {/* Plate */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/plates/sale-h180.png"
                    alt="SALE"
                    style={{ height: 40, width: 114, objectFit: 'contain', display: 'block' }}
                    draggable={false}
                  />
                  {/* Title */}
                  <div style={{
                    fontFamily: FONT_DISP, fontSize: 16, fontWeight: 500,
                    color: '#EFEEF4', lineHeight: 1.2,
                  }}>
                    SALE PENDING
                  </div>
                  {/* Consequence */}
                  <div style={{
                    fontFamily: FONT_DISP, fontSize: 14, fontWeight: 400,
                    color: '#B8B6C6', lineHeight: 1.6,
                    textWrap: 'pretty' as React.CSSProperties['textWrap'],
                  }}>
                    A purchase agreement is executed. The terms are set, and the chain starts now.
                  </div>
                </button>

                {/* LEASE PENDING */}
                <button
                  onClick={() => { setChosenMark('lease'); setStep('pin') }}
                  style={{
                    flex: 1, padding: '28px 26px', borderRadius: 16, cursor: 'pointer',
                    background: 'rgba(255,255,255,.02)',
                    border: '1px solid rgba(255,255,255,.14)',
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12,
                    textAlign: 'left',
                  }}
                >
                  {/* Plate */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/plates/lease-h180.png"
                    alt="LEASE"
                    style={{ height: 40, width: 114, objectFit: 'contain', display: 'block' }}
                    draggable={false}
                  />
                  {/* Title */}
                  <div style={{
                    fontFamily: FONT_DISP, fontSize: 16, fontWeight: 500,
                    color: '#EFEEF4', lineHeight: 1.2,
                  }}>
                    LEASE PENDING
                  </div>
                  {/* Consequence */}
                  <div style={{
                    fontFamily: FONT_DISP, fontSize: 14, fontWeight: 400,
                    color: '#B8B6C6', lineHeight: 1.6,
                    textWrap: 'pretty' as React.CSSProperties['textWrap'],
                  }}>
                    Terms are agreed and still moving. Nothing is locked until the lease is executed.
                  </div>
                </button>
              </div>
            )}

            {/* ── STEP 2: PIN (LG-4, LG-6) — 420px card */}
            {step === 'pin' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                {/* Orb (LG-4) — 120px, circular mask */}
                <div style={{
                  width: 120, height: 120,
                  borderRadius: '50%', overflow: 'hidden',
                  position: 'relative', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {/* Static poster */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/launch/orb-185.png"
                    alt=""
                    style={{
                      position: 'absolute', inset: 0,
                      width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                    }}
                    draggable={false}
                  />
                  {/* Animated video (optional, autoplay) */}
                  {/* Video: 1070.27×214.05 at offset -49.3/-46.7, scale 0.64865 */}
                  <video
                    ref={videoRef}
                    src="/assets/launch/hover-full.mp4"
                    muted
                    loop
                    playsInline
                    style={{
                      position: 'absolute',
                      width: `${1070.27 * 0.64865}px`,
                      height: `${214.05 * 0.64865}px`,
                      left: `${-49.3}px`,
                      top: `${-46.7}px`,
                      pointerEvents: 'none',
                    }}
                  />
                </div>

                {/* 36px gap */}
                <div style={{ height: 36 }} />

                {/* PIN cells (LG-6) */}
                <div style={{
                  display: 'flex', gap: 12,
                  animation: shaking ? 'pin-shake 0.26s ease-in-out' : 'none',
                }}>
                  {[0, 1, 2, 3].map(i => {
                    const filled = i < pin.length
                    const isActive = !filled && i === pin.length && !pinError
                    const borderColor = redBorders ? '#FF4D4D'
                      : isActive ? '#8B5CF6'
                      : filled ? 'transparent'
                      : 'rgba(255,255,255,.14)'
                    const bg = filled ? '#EFEEF4' : 'rgba(255,255,255,.05)'
                    const shadow = isActive ? '0 0 20px rgba(139,92,246,.35)' : 'none'

                    return (
                      <div key={i} style={{
                        width: 56, height: 66, borderRadius: 12, boxSizing: 'border-box',
                        background: bg,
                        border: `1px solid ${borderColor}`,
                        boxShadow: shadow,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative',
                      }}>
                        {/* Filled: solid slab + 12px dot */}
                        {filled && (
                          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#0A0A0F' }} />
                        )}
                        {/* Active: caret */}
                        {isActive && (
                          <div style={{
                            width: 1.5, height: 26, background: '#C4B5FD',
                            animation: 'pin-caret 1.06s steps(1,end) infinite',
                          }} />
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Saving indicator */}
                {saving && (
                  <>
                    <div style={{ height: 20 }} />
                    <span style={{
                      fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.14em',
                      color: '#34D399',
                    }}>LAUNCHING…</span>
                  </>
                )}
              </div>
            )}

            {/* ── LAUNCHED state (LG-11) */}
            {step === 'launched' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

                {/* Rest plate + video */}
                <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ position: 'relative', width: 324, height: 64.9 }}>
                    {/* Video (scales to container) */}
                    <video
                      src="/assets/launch/hover-full.mp4"
                      autoPlay muted loop playsInline
                      poster="/assets/launch/rest-master-1650.png"
                      style={{
                        position: 'absolute', inset: 0, width: '100%', height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                </div>

                {/* 20px gap */}
                <div style={{ height: 20 }} />

                {/* NOW IN PLAY figure */}
                {estComm != null && (
                  <div style={{
                    fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700,
                    letterSpacing: '0.14em', color: '#34D399',
                    textAlign: 'center',
                  }}>
                    NOW IN PLAY ${estComm.toLocaleString()}
                  </div>
                )}

                {/* 20px */}
                <div style={{ height: 20 }} />

                {/* Address */}
                <div style={{
                  fontFamily: FONT_DISP, fontSize: 20, fontWeight: 500,
                  color: '#EFEEF4', textAlign: 'center',
                }}>
                  {address}
                </div>

                {/* 20px */}
                <div style={{ height: 20 }} />

                {/* Close */}
                <button
                  onClick={() => { onLaunched() }}
                  style={{
                    background: 'rgba(139,92,246,.14)',
                    border: '1px solid rgba(167,139,250,.44)',
                    borderRadius: 10, padding: '10px 28px',
                    fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.14em', color: '#A78BFA',
                    cursor: 'pointer',
                  }}
                >
                  DONE
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}

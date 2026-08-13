'use client'

// §D6 PIN gate — mobile spec, scale-up 29a (12 Aug 2026).
// 29a changes (mobile only, desktop untouched):
//   star: 128 → 168px
//   WAR ROOM label: 11 → 13px (still instrument label, not D4)
//   slots: 38×46 r9 → 44×54 r10, gap 14px, 40px below mark
//   keypad: 64×52 r14 → 108×64 r16, gap 13px, 44px below slots
//   digits: 21 → 26px Space Grotesk 500; ⌫ 24px at text-mid
//   footer: 10.5 → 11.5px, 34px above bottom edge
// Background: 420px radial rgba(139,92,246,0.13) → transparent 68%.
// Error: shake 6px×2 over 260ms, all four slot borders go late for 600ms. No error text.
// Custom keypad — system keyboard never appears (no <input> elements).

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'

const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"

interface PinGateProps {
  pinHash: string
  sha256: (text: string) => Promise<string>
  onSuccess: () => void
}

const KEYS = ['1','2','3','4','5','6','7','8','9','C','0','⌫'] as const

export default function PinGate({ pinHash, sha256, onSuccess }: PinGateProps) {
  const [digits, setDigits] = useState<string[]>([])
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const handleKey = useCallback(async (key: string) => {
    if (error) return
    if (key === 'C') { setDigits([]); return }
    if (key === '⌫') {
      setDigits(d => d.slice(0, -1))
      return
    }
    if (digits.length >= 4) return

    const next = [...digits, key]
    setDigits(next)

    if (next.length === 4) {
      const pin = next.join('')
      const hash = await sha256(pin)
      if (hash === pinHash) {
        onSuccess()
      } else {
        setShake(true)
        setError(true)
        setTimeout(() => {
          setShake(false)
          setError(false)
          setDigits([])
        }, 650)
      }
    }
  }, [digits, error, pinHash, sha256, onSuccess])

  // §D6 — desktop hardware keyboard listener (additive, does not hide on-screen keypad)
  // CODE: useEffect attaches keydown on window; handleKey in dep array (it's a useCallback).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKey(e.key)
      } else if (e.key === 'Backspace') {
        handleKey('⌫')
      } else if (e.key === 'Escape') {
        handleKey('C')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKey])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#08080C',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      // §D6 29a: column metered to 844px viewport — footer 34px above bottom
      paddingBottom: 34,
    }}>
      {/* §D6 background radial */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 420px 420px at 50% 46%, rgba(139,92,246,0.13) 0%, transparent 68%)',
      }} />

      {/* Main column — centred vertically in remaining space */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100%' }}>

        {/* §D6 + §17.1 + 29a: glow star at 168px mobile (was 128px). star-glow-512.png. No CSS glow. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/star-glow-512.png" alt="" width={168} height={168} style={{ display: 'block' }} />

        {/* §D6 + 29a: WAR ROOM — 13px mobile (was 11px). 0.42em tracking. text-mid. NOT D4. */}
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '0.42em',
          textTransform: 'uppercase',
          color: '#8B8A9B',
          marginTop: 24,
          paddingLeft: '0.42em',
        }}>
          WAR ROOM
        </div>

        {/* §D6 + 29a: slots 44×54px, radius 10, gap 14px, 40px below mark */}
        <motion.div
          animate={shake ? { x: [-6, 6, -6, 6, -4, 4, 0] } : {}}
          transition={{ duration: 0.26 }}
          style={{ display: 'flex', gap: 14, marginTop: 40 }}
        >
          {[0,1,2,3].map(i => {
            const filled = i < digits.length
            const isActive = i === digits.length && !error
            return (
              <div key={i} style={{
                width: 44,
                height: 54,
                borderRadius: 10,
                background: filled ? '#EFEEF4' : 'rgba(255,255,255,0.05)',
                border: error
                  ? '1px solid #FF4D4D'
                  : isActive
                  ? '1px solid #8B5CF6'
                  : '1px solid rgba(255,255,255,0.08)',
                boxShadow: isActive ? '0 0 20px rgba(139,92,246,0.35)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}>
                {filled && (
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#0A0A0F' }} />
                )}
              </div>
            )
          })}
        </motion.div>

        {/* §D6 + 29a: keypad 108×64px, radius 16, gap 13px, 44px below slots.
            digits 26px Space Grotesk 500. ⌫ 24px at text-mid. */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 108px)',
          gap: 13,
          marginTop: 44,
        }}>
          {KEYS.map((key) => {
            const isFn = key === '⌫' || key === 'C'
            return (
              <button
                key={key}
                onClick={() => handleKey(key)}
                style={{
                  width: 108,
                  height: 64,
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  fontFamily: key === '⌫' ? FONT_MONO : FONT_DISPLAY,
                  fontSize: key === '⌫' ? 24 : 26,
                  fontWeight: 500,
                  color: isFn ? '#8B8A9B' : '#EFEEF4',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  WebkitTapHighlightColor: 'transparent',
                  userSelect: 'none',
                } as React.CSSProperties}
                onMouseDown={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
                onMouseUp={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onTouchStart={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
                onTouchEnd={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              >
                {key}
              </button>
            )
          })}
        </div>
      </div>

      {/* §D6 + 29a: footer 11.5px mobile (was 10.5px). 34px above bottom — handled by paddingBottom:34 on container. */}
      <div style={{
        fontFamily: FONT_MONO,
        fontSize: 11.5,
        fontWeight: 500,
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
        color: '#3F3E4C',
        paddingLeft: '0.24em',
        position: 'relative',
        zIndex: 1,
      }}>
        SHIRLEYCRE · RESTRICTED ACCESS
      </div>
    </div>
  )
}

'use client'

// §D6 PIN gate — directive items 5 + 6.
// Custom keypad (system keyboard never appears).
// Violet caret on active slot (not iOS blue).
// Star: star-glow-512.png at 128px mobile. No CSS glow.
// WAR ROOM: 11px / 500 / 0.42em, text-mid, 24px below mark.
// Footer: SHIRLEYCRE · RESTRICTED ACCESS in JetBrains Mono 10.5px / 0.24em / #3F3E4C.
// Slot: 38×46px radius 9. Empty: rgba(255,255,255,0.05) + border-default.
//        Filled: solid #EFEEF4 slab with 12px #0A0A0F dot.
// Error: shake 6px × 2 over 260ms, all four borders go `late` for 600ms. No error text.
// Background: 420px radial rgba(139,92,246,0.13) → transparent 68%.

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"

interface PinGateProps {
  pinHash: string
  sha256: (text: string) => Promise<string>
  onSuccess: () => void
}

// 3×3 grid + 0 and backspace — §D6 custom keypad
const KEYS: (string | null)[] = [
  '1','2','3',
  '4','5','6',
  '7','8','9',
  null,'0','⌫',
]

export default function PinGate({ pinHash, sha256, onSuccess }: PinGateProps) {
  const [digits, setDigits] = useState<string[]>([])
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const handleKey = useCallback(async (key: string) => {
    if (error) return
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

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#08080C',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      // §D6: suppress system keyboard entirely — no <input> elements
    }}>
      {/* §D6 background radial — 420px, rgba(139,92,246,0.13) → transparent 68% */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 420px 420px at 50% 46%, rgba(139,92,246,0.13) 0%, transparent 68%)',
      }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, position: 'relative' }}>

        {/* §D6 + §17: glow star at 128px mobile. star-glow-512.png. No radius, no plate, no CSS glow. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/star-glow-512.png" alt="" width={128} height={128} style={{ display: 'block' }} />

        {/* §D6 WAR ROOM label — 11px / 500 / 0.42em, text-mid. padding-left: 0.42em so tracking stays centred.
            Deliberately NOT D4 and must not be "corrected" to match the identity row. */}
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.42em',
          textTransform: 'uppercase',
          color: '#8B8A9B',
          marginTop: 24,
          paddingLeft: '0.42em',  // offset final-letter tracking so word stays optically centred
        }}>
          WAR ROOM
        </div>

        {/* §D6 Slot row — 38×46px each, gap:12, radius:9 */}
        <motion.div
          animate={shake ? { x: [-6, 6, -6, 6, -4, 4, 0] } : {}}
          transition={{ duration: 0.26 }}
          style={{ display: 'flex', gap: 12, marginTop: 32 }}
        >
          {[0,1,2,3].map(i => {
            const filled = i < digits.length
            const isActive = i === digits.length && !error
            return (
              <div key={i} style={{
                width: 38,
                height: 46,
                borderRadius: 9,
                background: filled ? '#EFEEF4' : 'rgba(255,255,255,0.05)',
                border: error
                  ? '1px solid #FF4D4D'
                  : isActive
                  ? `1px solid #8B5CF6`
                  : '1px solid rgba(255,255,255,0.08)',
                boxShadow: isActive
                  ? '0 0 20px rgba(139,92,246,0.35)'   // §D6 one glow — active slot
                  : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                // §D6 active slot: 1.5px blinking caret in brand — simulated via ::after not possible
                // Using a subtle pulse on the border instead
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}>
                {filled && (
                  <div style={{
                    width: 12, height: 12,
                    borderRadius: '50%',
                    background: '#0A0A0F',
                  }} />
                )}
              </div>
            )
          })}
        </motion.div>

        {/* §D6 Custom keypad — 3×3 grid + 0 + ⌫. Keys 64×52px, radius 14, bg rgba(255,255,255,0.05).
            Digits 21px Space Grotesk. System keyboard never appears. */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 64px)',
          gap: 10,
          marginTop: 28,
        }}>
          {KEYS.map((key, idx) => {
            if (key === null) return <div key={idx} />
            return (
              <button
                key={key}
                onClick={() => handleKey(key)}
                style={{
                  width: 64,
                  height: 52,
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  fontFamily: key === '⌫' ? FONT_MONO : FONT_DISPLAY,
                  fontSize: key === '⌫' ? 18 : 21,
                  fontWeight: 500,
                  color: '#EFEEF4',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'background 80ms',
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

        {/* §D6 footer — JetBrains Mono 10.5px / 0.24em / #3F3E4C / UPPERCASE.
            Sentence-case version is named in D6's retired list. */}
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: 10.5,
          fontWeight: 500,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: '#3F3E4C',
          marginTop: 36,
          paddingLeft: '0.24em',
        }}>
          SHIRLEYCRE · RESTRICTED ACCESS
        </div>
      </div>
    </div>
  )
}

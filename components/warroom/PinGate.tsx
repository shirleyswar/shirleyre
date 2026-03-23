'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { motion } from 'framer-motion'

interface PinGateProps {
  pinHash: string
  sha256: (text: string) => Promise<string>
  onSuccess: () => void
}

export default function PinGate({ pinHash, sha256, onSuccess }: PinGateProps) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRefs = useRef<Array<HTMLInputElement | null>>([null, null, null, null])

  useEffect(() => {
    // Focus first digit on mount
    inputRefs.current[0]?.focus()
  }, [])

  const handleInput = async (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return

    const newDigits = [...digits]
    newDigits[index] = value
    setDigits(newDigits)
    setError(false)

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    // Check if all 4 digits filled
    if (value && index === 3) {
      const pin = [...newDigits.slice(0, 3), value].join('')
      const hash = await sha256(pin)
      if (hash === pinHash) {
        onSuccess()
      } else {
        setShake(true)
        setError(true)
        setTimeout(() => {
          setShake(false)
          setDigits(['', '', '', ''])
          inputRefs.current[0]?.focus()
        }, 600)
      }
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  return (
    <div className="fixed inset-0 bg-bg-base flex items-center justify-center">
      {/* Subtle radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(201,147,58,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex flex-col items-center gap-8 relative"
      >
        {/* Logo / wordmark */}
        <div className="flex flex-col items-center gap-2">
          <div
            style={{
              width: 48,
              height: 48,
              background: 'rgba(201,147,58,0.12)',
              border: '1px solid rgba(201,147,58,0.3)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#c9933a" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5" stroke="#c9933a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5" stroke="#c9933a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500 }}>
            War Room
          </span>
        </div>

        {/* PIN input */}
        <motion.div
          animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : {}}
          transition={{ duration: 0.5 }}
          className="flex gap-3"
        >
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleInput(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className="pin-digit"
              style={{
                borderColor: error ? 'var(--danger)' : digit ? 'var(--accent-gold)' : undefined,
              }}
            />
          ))}
        </motion.div>

        {/* Error message */}
        <AnimatePresenceLocal show={error}>
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ fontSize: 13, color: 'var(--danger)', marginTop: -16 }}
          >
            Incorrect PIN
          </motion.p>
        </AnimatePresenceLocal>

        {/* Footer hint */}
        <p style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.5 }}>
          ShirleyCRE · Restricted Access
        </p>
      </motion.div>
    </div>
  )
}

// Small helper for conditional AnimatePresence
function AnimatePresenceLocal({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null
  return <>{children}</>
}

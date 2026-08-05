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
          background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(139,92,246,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex flex-col items-center gap-8 relative"
      >
        {/* Official mark — mark-256.png above WAR ROOM.
            74px desktop / 52px mobile per WHERE-TO-USE-WHAT §4.
            No CSS glow or box-shadow — glow is in the pixels (README §notes). */}
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/mark-256.png"
            alt=""
            className="hidden sm:block"
            width={74}
            height={74}
            style={{ display: 'block' }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/mark-256.png"
            alt=""
            className="sm:hidden"
            width={52}
            height={52}
            style={{ display: 'block' }}
          />
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

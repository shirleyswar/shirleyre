'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PinGate from '@/components/warroom/PinGate'
import LeadsIndex from '@/components/warroom/LeadsIndex'

const PIN_HASH = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'
const SESSION_KEY = 'wr3_session_exp'
const SESSION_HOURS = 8

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function PhoneLeadsPage() {
  const router = useRouter()
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    const expiry = localStorage.getItem(SESSION_KEY)
    if (expiry && Date.now() < parseInt(expiry, 10)) setUnlocked(true)
  }, [])

  const handlePinSuccess = useCallback(() => {
    localStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_HOURS * 60 * 60 * 1000))
    setUnlocked(true)
  }, [])

  if (!unlocked) {
    return <PinGate pinHash={PIN_HASH} sha256={sha256} onSuccess={handlePinSuccess} />
  }

  return (
    <div style={{
      height: '100dvh',
      background: '#08080C',
      color: '#EFEEF4',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: FONT_DISPLAY,
    }}>
      <div style={{
        padding: 'max(env(safe-area-inset-top, 0px), 18px) 16px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={() => router.push('/warroom3')}
          style={{
            background: 'none',
            border: 'none',
            color: '#A78BFA',
            fontFamily: FONT_MONO,
            fontSize: 12,
            letterSpacing: '0.12em',
            cursor: 'pointer',
            padding: '8px 0',
          }}
        >
          HOME
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: FONT_MONO, fontSize: 13, letterSpacing: '0.16em', color: '#B8B6C6' }}>
          LEADS
        </div>
        <div style={{ width: 48 }} />
      </div>
      <LeadsIndex variant="phone" />
    </div>
  )
}

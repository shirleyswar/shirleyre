'use client'

// /warroom3 — ShirleyCRE mobile spec v1, Step 2
// Bottom tab bar + route shell. No mobile header (deleted per §12 step 2).
// /warroom is untouched. No chains, no portfolio, no Battle Plan detail, no deal page.

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PinGate from '@/components/warroom/PinGate'
import BottomTabBar, { TabId } from '@/components/warroom3/BottomTabBar'

const PIN_HASH    = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'
const SESSION_KEY = 'wr3_session_exp'
const SESSION_HOURS = 8

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// §2 spec tokens
const T = {
  bgBase:    '#08080C',
  bgPanel:   '#101017',
  textHi:    '#EFEEF4',
  textMid:   '#8B8A9B',
  textLow:   '#5C5B6B',
  brand:     '#8B5CF6',
  brandLift: '#A78BFA',
  moneyIn:   '#34D399',
  late:      '#FF4D4D',
  hot:       '#FFA23A',
} as const

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

// T1 §3.2 — UPPERCASE / JetBrains Mono
const T1: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: T.textMid,
  lineHeight: 1,
}

// ── Placeholder screens ───────────────────────────────────────────────────────
function PlaceholderScreen({ label }: { label: string }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingBottom: 104,  // §5.7 — every scroll container
      color: T.textLow,
    }}>
      <span style={T1}>{label}</span>
      <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>
        Coming in next step
      </span>
    </div>
  )
}

function HomeScreen() {
  const dateStr = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short', month: 'short', day: 'numeric',
  }).toUpperCase()

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '18px 18px 104px',  // §4.1 gutter 18px + §5.7 bottom pad
      background: T.bgBase,
    }}>
      {/* Identity row — §6 item 2 placeholder */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
      }}>
        <div>
          <div style={{ ...T1, marginBottom: 4 }}>{dateStr}</div>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 15,
            fontWeight: 500,
            color: T.textHi,
            letterSpacing: '-0.01em',
          }}>
            War Room
          </div>
        </div>
        {/* App mark — 34px, radius 9, brand fill + fab glow */}
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: T.brand,
          boxShadow: '0 0 22px rgba(139,92,246,0.40)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
            <path
              d="M20 2C20 2,22 14,20 20C18 14,20 2,20 2ZM20 38C20 38,22 26,20 20C18 26,20 38,20 38ZM2 20C2 20,14 22,20 20C14 18,2 20,2 20ZM38 20C38 20,26 22,20 20C26 18,38 20,38 20Z"
              fill="white"
              opacity="0.9"
            />
          </svg>
        </div>
      </div>

      {/* Hero card — §5.10 placeholder, late spine */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '20px 20px 20px 33px',
        marginBottom: 26,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, background: T.late,
        }}/>
        <div style={{ ...T1, color: T.textLow, marginBottom: 12 }}>FIRST THING</div>
        <div style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 23,
          fontWeight: 500,
          color: T.textHi,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          marginBottom: 9,
          textWrap: 'pretty',
        } as React.CSSProperties}>
          Home screen in Step 3
        </div>
        <div style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 11.5,
          color: T.textMid,
          lineHeight: 1.5,
        }}>
          Hero card, tile grid, pipeline band and receivables card coming next.
        </div>
      </div>

      {/* 2×2 tile grid — §6 items 4–5 placeholder */}
      <div style={{ ...T1, marginBottom: 12 }}>PANELS</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 11,
      }}>
        {['Battle Plan', 'Money Movers', 'Deadlines', 'Under Contract'].map(label => (
          <div key={label} style={{
            background: T.bgPanel,
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: '16px 15px',
            minHeight: 90,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}>
            <div style={T1}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScrollScreen({ label }: { label: string }) {
  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '18px 18px 104px',
      background: T.bgBase,
    }}>
      <PlaceholderScreen label={label} />
    </div>
  )
}

function UnlockFlash() {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.25) 0%, transparent 70%)',
        pointerEvents: 'none',
      }}
    />
  )
}

export default function WarRoom3Page() {
  const [unlocked, setUnlocked] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('home')

  useEffect(() => {
    const expiry = localStorage.getItem(SESSION_KEY)
    if (expiry && Date.now() < parseInt(expiry)) setUnlocked(true)
  }, [])

  const handlePinSuccess = useCallback(() => {
    const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000
    localStorage.setItem(SESSION_KEY, expiry.toString())
    setShowFlash(true)
    setTimeout(() => { setShowFlash(false); setUnlocked(true) }, 800)
  }, [])

  if (!unlocked) {
    return (
      <>
        <PinGate pinHash={PIN_HASH} sha256={sha256} onSuccess={handlePinSuccess} />
        <AnimatePresence>{showFlash && <UnlockFlash />}</AnimatePresence>
      </>
    )
  }

  function renderScreen() {
    switch (activeTab) {
      case 'home':    return <HomeScreen />
      case 'deals':   return <ScrollScreen label="DEALS" />
      case 'money':   return <ScrollScreen label="MONEY" />
      case 'more':    return <ScrollScreen label="MORE" />
    }
  }

  return (
    // No mobile header — deleted on /warroom3 per §12 step 2
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      width: '100vw',
      maxWidth: '100vw',
      background: T.bgBase,
      overflow: 'hidden',
      position: 'fixed',
      inset: 0,
    }}>
      {/* §6 item 1 — 52px status area, iOS chrome only */}
      <div style={{
        height: 52,
        flexShrink: 0,
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}/>

      {/* Screen content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>

      {/* §5.7 Bottom tab bar */}
      <BottomTabBar
        active={activeTab}
        onTab={setActiveTab}
        onFab={() => { /* Step 4+: FAB opens new item sheet */ }}
      />
    </div>
  )
}

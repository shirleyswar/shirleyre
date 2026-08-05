'use client'

// §5.8 Bottom sheet — ShirleyCRE mobile spec v1
// - Scrim bg-scrim (rgba(0,0,0,0.60)) over full screen
// - Sheet: top 78px (list panels); border-radius 26px 26px 0 0; bg-panel; border-top border-default
// - 38×4px grab handle, rgba(255,255,255,0.18), radius 2, centred, 10px from top
// - Header row: T1 label · hairline · count · 28px round close button
// - Internal scroll container: padding-bottom 104px
// - Motion §7: y 100%→0, spring stiffness 320 damping 34; scrim 180ms linear
// - prefers-reduced-motion: opacity-only fallback

import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion, type Transition } from 'framer-motion'

const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"

// T1 §3.2
const styleT1: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#8B8A9B',
  lineHeight: 1,
}

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  label: string           // T1 header label — UPPERCASE
  count?: number          // optional count after hairline
  children: React.ReactNode
  // 'list' = top:78px (default), 'short' = top:112px
  size?: 'list' | 'short'
}

export default function BottomSheet({
  open,
  onClose,
  label,
  count,
  children,
  size = 'list',
}: BottomSheetProps) {
  const prefersReduced = useReducedMotion()
  const sheetTop = size === 'short' ? 112 : 78
  const scrollRef = useRef<HTMLDivElement>(null)

  // Lock body scroll while sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // §7 motion specs — inline props to satisfy Framer Motion strict types
  const sheetInitial = prefersReduced ? { opacity: 0 } : { y: '100%' }
  const sheetAnimate = prefersReduced ? { opacity: 1 } : { y: 0 }
  const sheetExit    = prefersReduced ? { opacity: 0 } : { y: '100%' }
  const sheetTransition: Transition = prefersReduced
    ? { duration: 0.18 }
    : { type: 'spring', stiffness: 320, damping: 34 }
  const sheetExitTransition: Transition = prefersReduced
    ? { duration: 0.18 }
    : { duration: 0.2, ease: [0.4, 0, 1, 1] }  // easeIn cubic

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Scrim — bg-scrim rgba(0,0,0,0.60), 180ms linear */}
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.60)',
              zIndex: 500,
            }}
          />

          {/* Sheet — spring stiffness 320 damping 34, exit 200ms */}
          <motion.div
            key="sheet"
            initial={sheetInitial}
            animate={sheetAnimate}
            exit={sheetExit}
            transition={sheetTransition}
            style={{
              position: 'fixed',
              top: sheetTop,
              left: 0,
              right: 0,
              bottom: 0,
              background: '#101017',           // bg-panel
              borderRadius: '26px 26px 0 0',   // §5.8
              borderTop: '1px solid rgba(255,255,255,0.08)',  // border-default
              zIndex: 501,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Grab handle — 38×4px, rgba(255,255,255,0.18), radius 2, centred, 10px from top */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              paddingTop: 10,
              paddingBottom: 14,
              flexShrink: 0,
            }}>
              <div style={{
                width: 38,
                height: 4,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.18)',
              }} />
            </div>

            {/* Header row: T1 label · hairline · count · 28px close button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingLeft: 18,
              paddingRight: 18,
              paddingBottom: 14,
              flexShrink: 0,
            }}>
              <span style={styleT1}>{label}</span>
              {/* Hairline */}
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
              {/* Count */}
              {count !== undefined && (
                <span style={{
                  fontFamily: FONT_MONO,
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#5C5B6B',
                  letterSpacing: '0.04em',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {count}
                </span>
              )}
              {/* 28px round close button — min 44px tap area via padding */}
              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  // Extend tap area to meet 44px minimum
                  padding: 8,
                  margin: -8,
                  WebkitTapHighlightColor: 'transparent',
                  color: '#8B8A9B',
                } as React.CSSProperties}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Internal scroll container — padding-bottom 104px §5.7/§5.8 */}
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                paddingBottom: 104,
              }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

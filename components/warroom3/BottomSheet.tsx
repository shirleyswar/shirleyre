'use client'

// §5.8 Bottom sheet — ShirleyCRE mobile spec v1
// - Scrim bg-scrim (rgba(0,0,0,0.60)) over full screen
// - Sheet: top 78px (list panels); border-radius 26px 26px 0 0; bg-panel; border-top border-default
// - 38×4px grab handle, rgba(255,255,255,0.18), radius 2, centred, 10px from top
// - Header row: T1 label · hairline · count · 28px round close button
// - Internal scroll container: padding-bottom 104px
// - Motion §7: y 100%→0, spring stiffness 320 damping 34; scrim 180ms linear
// - prefers-reduced-motion: opacity-only fallback

import React, { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion, type Transition } from 'framer-motion'

const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"

// T1 §3.2 — 12px (44a type scale)
const styleT1: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#B8B6C6',
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
  // §5.8 authorized deviation: Deals sheet replaces count with + PORTFOLIO pill
  headerAction?: React.ReactNode
  // 31a: override header label style (T0 for Deals sheet vs T1 elsewhere)
  labelStyle?: React.CSSProperties
  // 31a: override grab handle dimensions
  handleW?: number
  handleH?: number
  handleRadius?: number
  handleOpacity?: string
  // 31a: override header row height
  headerHeight?: number
  // 31a: count style override (M2 for Deals)
  countStyle?: React.CSSProperties
  // 31a check 7: suppress the × close button — FAB-× handles close for Deals sheet
  noCloseButton?: boolean
}

export default function BottomSheet({
  open,
  onClose,
  label,
  count,
  children,
  size = 'list',
  headerAction,
  labelStyle,
  handleW = 38,
  handleH = 4,
  handleRadius = 2,
  handleOpacity = 'rgba(255,255,255,0.18)',
  headerHeight,
  countStyle,
  noCloseButton = true,
}: BottomSheetProps) {
  const prefersReduced = useReducedMotion()
  const sheetTop = size === 'short' ? 112 : 78
  const scrollRef = useRef<HTMLDivElement>(null)

  // §18.9 — wire the grab handle to drag-to-dismiss.
  // Routes through onClose (which the caller guards via discard logic before passing).
  const dragStartY = useRef<number | null>(null)
  const handleGrabTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY
  }, [])
  const handleGrabTouchEnd = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return
    const delta = e.changedTouches[0].clientY - dragStartY.current
    dragStartY.current = null
    if (delta > 60) onClose()
  }, [onClose])

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
              background: '#12111B',           // bg-panel
              borderRadius: '26px 26px 0 0',   // §5.8
              borderTop: '1px solid rgba(255,255,255,0.14)',  // border-default
              zIndex: 501,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Grab handle — default 38×4px r2 rgba(255,255,255,0.18); overrideable via props.
                31a: Deals sheet uses 48×5px r3 rgba(255,255,255,.22).
                §18.9: wired to drag-to-dismiss. */}
            <div
              onTouchStart={handleGrabTouchStart}
              onTouchEnd={handleGrabTouchEnd}
              style={{
                display: 'flex',
                justifyContent: 'center',
                paddingTop: 10,
                paddingBottom: 14,
                flexShrink: 0,
                cursor: 'grab',
              }}
            >
              <div style={{
                width: handleW,
                height: handleH,
                borderRadius: handleRadius,
                background: handleOpacity,
              }} />
            </div>

            {/* Header row: label · hairline · count. Height overrideable (31a: 44px).
                Check 6: exactly three children — title, hairline, count. No extra elements. */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingLeft: 18,
              paddingRight: 18,
              paddingBottom: 14,
              flexShrink: 0,
              ...(headerHeight ? { height: headerHeight, paddingBottom: 0 } : {}),
            }}>
              <span style={{ ...styleT1, ...labelStyle }}>{label}</span>
              {/* Hairline */}
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.11)' }} />
              {/* Count — style overrideable (31a: M2 at text-low) */}
              {headerAction ?? (count !== undefined && (
                <span style={{
                  fontFamily: FONT_MONO,
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: '#8E8CA0',
                  letterSpacing: '0.04em',
                  fontVariantNumeric: 'tabular-nums',
                  ...countStyle,
                }}>
                  {count}
                </span>
              ))}
              {/* 28px round close button — suppressed when noCloseButton=true (check 7: FAB-× handles close) */}
              {!noCloseButton && <button
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
                  color: '#B8B6C6',
                } as React.CSSProperties}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>}
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

'use client'

// §5.8 Bottom sheet — ShirleyCRE mobile spec v1
// - Scrim bg-scrim (rgba(0,0,0,0.60)) over full screen
// - Sheet: top 78px (list panels); border-radius 26px 26px 0 0; bg-panel; border-top border-default
// - Header row: T1 label · hairline · count · 28px round close button
// - Internal scroll container: padding-bottom 104px
// - Motion §7: y 100%→0, spring stiffness 320 damping 34; scrim 180ms linear
// - prefers-reduced-motion: opacity-only fallback
// §18.9: grab handle removed — drag-to-dismiss wired to the sheet body div (threshold 60px).

import React, { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion, type Transition } from 'framer-motion'
import { SHEET_BOTTOM_CLEARANCE } from '@/lib/layout'

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
  // 'list' = top:78px (default), 'short' = top:112px, 'full' = top:34px
  size?: 'list' | 'short' | 'full'
  // §5.8 authorized deviation: custom right-side header content
  headerAction?: React.ReactNode
  // 31a: override header label style (T0 for Deals sheet vs T1 elsewhere)
  labelStyle?: React.CSSProperties
  // 31a: override header row height
  headerHeight?: number
  // 31a: count style override (M2 for Deals)
  countStyle?: React.CSSProperties
  // 31a check 7: suppress the × close button — FAB-× handles close for Deals sheet
  noCloseButton?: boolean
  // §18.9: noHandle — handle is universally removed; prop kept for API clarity
  noHandle?: boolean
  // Override scroll container padding-bottom (default 104)
  scrollPaddingBottom?: number
  // Footer content rendered flex:none after the scroll body — fixes iOS position:fixed mispositioning
  // (D11.3 ruling: header flex:none, body flex:1 overflow-y:auto, footer flex:none — no position:fixed)
  footer?: React.ReactNode
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
  headerHeight,
  countStyle,
  noCloseButton = true,
  noHandle,
  scrollPaddingBottom = 104,
  footer,
}: BottomSheetProps) {
  const prefersReduced = useReducedMotion()
  const sheetTop = size === 'full' ? 34 : size === 'short' ? 112 : 78
  const scrollRef = useRef<HTMLDivElement>(null)

  // §18.9 — drag-to-dismiss wired to the sheet body div.
  // Routes through onClose (which the caller guards via §18.4 discard logic before passing).
  const dragStartY = useRef<number | null>(null)
  const handleSheetTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY
  }, [])
  const handleSheetTouchEnd = useCallback((e: React.TouchEvent) => {
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
            onTouchStart={handleSheetTouchStart}
            onTouchEnd={handleSheetTouchEnd}
            style={{
              position: 'fixed',
              top: sheetTop,
              left: 0,
              right: 0,
              // SHEET_BOTTOM_CLEARANCE = NAV_HEIGHT (94px) — clears the tab bar's full outer box.
              // The nav (zIndex 1000) is position:fixed, bottom:0, height:94px (border-box, includes
              // env(safe-area-inset-bottom)). Sheet was bottom:0 at zIndex 501 — footer landed inside
              // the nav's 94px dead zone. Fixed: lift the sheet floor to 94px so the flex:none footer
              // is always above the nav. Do NOT add env(safe-area-inset-bottom) — the nav's 94px
              // already contains it. Both files read from lib/layout.ts; nav height changes propagate.
              bottom: SHEET_BOTTOM_CLEARANCE,
              background: '#12111B',           // bg-panel
              borderRadius: '26px 26px 0 0',   // §5.8
              borderTop: '1px solid rgba(255,255,255,0.14)',  // border-default
              zIndex: 501,
              display: 'flex',
              flexDirection: 'column',
              // overflow:hidden retained for border-radius clipping.
              // The scroll body uses height:0 (iOS Safari flex fix — see below) to prevent
              // the body from expanding past its flex:1 allocation and pushing the footer
              // outside the clip region.
              overflow: 'hidden',
            }}
          >
            {/* Header row: label · hairline · headerAction|count.
                Check 6: exactly three children — title, hairline, count/action. No extra elements. */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingLeft: 18,
              paddingRight: 18,
              paddingTop: 16,
              paddingBottom: 14,
              flexShrink: 0,
              ...(headerHeight ? { height: headerHeight, paddingTop: 0, paddingBottom: 0 } : {}),
            }}>
              <span style={{ ...styleT1, ...labelStyle }}>{label}</span>
              {/* Hairline */}
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.11)' }} />
              {/* Right side: headerAction takes priority; else count; else close button */}
              {headerAction ?? (count !== undefined ? (
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
              ) : null)}
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

            {/* Internal scroll container — padding-bottom configurable (default 104px §5.7/§5.8) */}
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                minHeight: 0,
                // height:0 forces iOS Safari to honour the flex:1 constraint.
                // Without it, iOS ignores min-height:0 on flex children and the scroll
                // body expands to content height, pushing the footer outside overflow:hidden.
                height: 0,
                paddingBottom: footer ? 0 : scrollPaddingBottom,
              }}
            >
              {children}
            </div>

            {/* Footer — flex:none, rendered below scroll body. Fixes iOS keyboard position:fixed mispositioning.
                When a footer is present the sheet is a full flex column: header/body/footer. */}
            {footer && (
              <div style={{ flexShrink: 0 }}>
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

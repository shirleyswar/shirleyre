'use client'

import React, { useEffect, useRef, useState } from 'react'
import styles from './MarkCompleteButton.module.css'

const DRAW_MS = 250

export interface MarkCompleteButtonProps {
  onClick: () => void | Promise<void | boolean>
  disabled?: boolean
  /** Outer hit target in px. The circle stays 32. At least 44. */
  hitSize?: number
  style?: React.CSSProperties
}

/**
 * Inline complete mark. Rest: 32px money-in ring and check, transparent.
 * Click: circle fills, the check draws in white, then onClick runs.
 * Return false from onClick to restore the rest mark (the action did not finish).
 */
export default function MarkCompleteButton({
  onClick,
  disabled = false,
  hitSize = 44,
  style,
}: MarkCompleteButtonProps) {
  const [drawing, setDrawing] = useState(false)
  const lock = useRef(false)
  const alive = useRef(true)
  const checkRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  async function handleClick() {
    if (disabled || lock.current) return
    lock.current = true
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const drawn = reduce ? Promise.resolve() : waitForDraw(checkRef.current)
    setDrawing(true)
    if (!reduce) await drawn
    let failed = false
    try {
      const result = await onClick()
      failed = result === false
    } catch {
      failed = true
    }
    if (failed) {
      lock.current = false
      if (alive.current) setDrawing(false)
    }
  }

  const box = Math.max(44, hitSize)

  return (
    <button
      type="button"
      className={drawing ? `${styles.button} ${styles.drawing}` : styles.button}
      aria-label="Mark complete"
      aria-disabled={disabled || undefined}
      disabled={disabled || drawing}
      onClick={handleClick}
      style={{ ...style, width: box, height: box }}
    >
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <circle className={styles.ring} cx="16" cy="16" r="15.25" />
        {/* Stroke mass of the previous path sat ~1px below the circle. Lifted so the check reads centered. */}
        <path
          ref={checkRef}
          className={styles.check}
          pathLength={1}
          d="M9.5 14.8 L14.2 19.6 L22.8 9.8"
        />
      </svg>
    </button>
  )
}

function waitForDraw(el: SVGPathElement | null): Promise<void> {
  if (!el) return wait(DRAW_MS)
  return new Promise(resolve => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      el.removeEventListener('animationend', finish)
      resolve()
    }
    el.addEventListener('animationend', finish)
    window.setTimeout(finish, DRAW_MS + 80)
  })
}

function wait(ms: number) {
  return new Promise<void>(resolve => window.setTimeout(resolve, ms))
}

/** Resting complete mark from the ring button. Replaces the check-h280 tile. */
export function CompleteRing({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle className={styles.ring} cx="16" cy="16" r="15.25" />
      <path className={styles.check} d="M9.5 14.8 L14.2 19.6 L22.8 9.8" />
    </svg>
  )
}

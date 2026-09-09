'use client'
/**
 * LaunchControl — 154 edition
 * Demo look: energy orb LEFT · LAUNCH DEAL label · >>> chevrons RIGHT
 * Primary: composited CSS control (orb PNG + label + animated chevrons)
 * Fallback: launch-deal-pill.png poster
 * Spec: WARROOM-154 §6 E1, evidence/demo.mp4
 */

import React, { useState, useEffect } from 'react'
import './launch-desktop.css'

interface LaunchControlProps {
  onClick?: () => void
  launched?: boolean
}

export default function LaunchControl({ onClick, launched = false }: LaunchControlProps) {
  const [prefersReduced, setPrefersReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <button
      type="button"
      className={`ld2-launch ld2-launch--154${launched ? ' ld2-launch--launched' : ''}`}
      onClick={onClick}
      aria-label="Launch Deal"
      data-state={launched ? 'launched' : undefined}
    >
      {/* Energy orb — LEFT */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/launch/energy-orb.png"
        alt=""
        className="ld2-launch__orb"
        draggable={false}
        aria-hidden="true"
      />

      {/* Label */}
      <span className="ld2-launch__label154">LAUNCH DEAL</span>

      {/* Chevrons >>> — RIGHT */}
      <span className={`ld2-launch__chevrons${prefersReduced ? ' ld2-launch__chevrons--still' : ''}`} aria-hidden="true">
        <span className="ld2-launch__chev ld2-launch__chev--1">&gt;</span>
        <span className="ld2-launch__chev ld2-launch__chev--2">&gt;</span>
        <span className="ld2-launch__chev ld2-launch__chev--3">&gt;</span>
      </span>
    </button>
  )
}

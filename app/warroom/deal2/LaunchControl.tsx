'use client'
/**
 * LaunchControl — Desktop-local Launch component for /warroom/deal2.
 * DESKTOP-LOCAL: does NOT import or modify components/warroom3/Launch.jsx.
 *
 * Pill mount: 550×97.3px clipping box (overflow: hidden).
 * File rendered at 563.3×112.7px, offset −7.2px left, −7.9px top.
 * Hover: looped video, autoplay, muted, playsInline — crossfade on enter/leave.
 * NO blend mode on video. NO third state. NO business behaviour / writes.
 * Reduced-motion: video never plays, rest image stays.
 */

import React, { useRef, useEffect } from 'react'
import './launch-desktop.css'

interface LaunchControlProps {
  onClick?: () => void
}

export default function LaunchControl({ onClick }: LaunchControlProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Respect reduced-motion: never load/play video when user prefers it
  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  function handleMouseEnter() {
    if (prefersReducedMotion) return
    const v = videoRef.current
    if (v) {
      v.currentTime = 0
      v.play().catch(() => {/* ignore autoplay block */})
    }
  }

  function handleMouseLeave() {
    // video fades out via CSS; pause after transition to save resources
    const v = videoRef.current
    if (v) {
      setTimeout(() => {
        if (v && !v.paused) v.pause()
      }, 250) // match CSS transition duration
    }
  }

  return (
    <button
      type="button"
      className="ld2-launch"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label="Launch Deal"
    >
      {/* REST — static image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/launch/launch-rest-v8.png"
        alt=""
        className="ld2-launch__rest"
        draggable={false}
      />

      {/* HOVER — looped video, NO blend mode */}
      {!prefersReducedMotion && (
        <video
          ref={videoRef}
          src="/assets/launch/launch-hover-v8.mp4"
          className="ld2-launch__hover"
          loop
          muted
          playsInline
          preload="none"
          aria-hidden="true"
        />
      )}
    </button>
  )
}

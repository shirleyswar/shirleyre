'use client'
/**
 * LaunchControl — 162 Item 4 DP-2
 * Threshold aperture at full 550px width. No maxWidth cap.
 * launch.css imported globally in warroom/layout.tsx.
 * The .wr-launch button IS the full Threshold object: 64px tall pill,
 * dark-field with the orbit-break glyph on the left and LAUNCH DEAL label.
 */

import React from 'react'

interface LaunchControlProps {
  onClick?: () => void
  launched?: boolean
}

export default function LaunchControl({ onClick, launched = false }: LaunchControlProps) {
  return (
    <div style={{ width: 550, display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}>
      <button
        type="button"
        className="wr-launch"
        onClick={onClick}
        aria-label="Launch Deal"
        data-state={launched ? 'launched' : ''}
      >
        <span className="wr-launch__mark">
          <span className="wr-launch__halo"></span>
          <span className="wr-launch__body"></span>
          <span className="wr-launch__rim"></span>
          <span className="wr-launch__face"><span className="wr-launch__core"></span></span>
          <span className="wr-launch__ring"></span>
          <span className="wr-launch__orbit"><span className="wr-launch__dot"></span></span>
        </span>
        <span className="wr-launch__label">LAUNCH DEAL</span>
      </button>
    </div>
  )
}

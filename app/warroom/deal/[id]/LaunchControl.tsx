'use client'
/**
 * LaunchControl — 158C.3 (DP-2)
 * ONE delivered control: launch.css Threshold aperture (wr-launch).
 * rest-master-v2.png dropped — stacking both produced two icons (evidence 02).
 * launch.css is imported globally in warroom/layout.tsx.
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
        style={{ maxWidth: 380, margin: '0 auto' }}
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

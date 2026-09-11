'use client'
/**
 * LaunchControl — 157 edition (DP-2)
 * Threshold control from launch.css + rest-master-v2.png (550×162)
 * No chevrons (>>>). No crop-offset math — v2 is native 3.395:1.
 */

import React from 'react'

interface LaunchControlProps {
  onClick?: () => void
  launched?: boolean
}

export default function LaunchControl({ onClick, launched = false }: LaunchControlProps) {
  return (
    <div style={{ position: 'relative', width: 550, userSelect: 'none' }}>
      {/* Rest art — 550×162 behind the control */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/launch/rest-master-v2.png"
        alt=""
        width={550}
        height={162}
        style={{
          display: 'block',
          width: 550,
          height: 162,
          pointerEvents: 'none',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
        }}
        draggable={false}
      />

      {/* launch.css control — mounted on top of rest art */}
      <div style={{ position: 'relative', zIndex: 1, padding: '49px 0' }}>
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
    </div>
  )
}

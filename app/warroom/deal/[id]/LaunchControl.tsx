'use client'
/**
 * LaunchControl — 162D Matthew override 9.15.26
 * REST = painted rest-master-1650.png (1650×330, display ~550×110)
 * HOVER = hover-full.mp4 (plasma/sparks, chevrons L→R, glow outside pill)
 * NOT CSS wr-launch Orbit Break at rest — that is the FAIL this corrects.
 */

import React, { useState } from 'react'

interface LaunchControlProps {
  onClick?: () => void
  launched?: boolean
}

export default function LaunchControl({ onClick, launched = false }: LaunchControlProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        width: 550,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        // padding beyond pill bounds so hover glow/particles are not clipped
        padding: '16px 0',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 550,
          height: 110,
          cursor: 'pointer',
          borderRadius: 34,
          overflow: 'visible',
        }}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        role="button"
        aria-label="Launch Deal"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick?.() }}
      >
        {/* REST state — painted PNG */}
        {!hovered && !launched && (
          <img
            src="/assets/launch/rest-master-1650.png"
            alt="LAUNCH DEAL"
            style={{
              width: 550,
              height: 110,
              display: 'block',
              objectFit: 'contain',
              borderRadius: 34,
              userSelect: 'none',
              pointerEvents: 'none',
            }}
            draggable={false}
          />
        )}

        {/* HOVER state — video */}
        {(hovered || launched) && (
          <video
            src="/assets/launch/hover-full.mp4"
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: 550,
              height: 110,
              display: 'block',
              objectFit: 'contain',
              borderRadius: 34,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  )
}

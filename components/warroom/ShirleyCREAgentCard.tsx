'use client'

import { motion } from 'framer-motion'

export default function ShirleyCREAgentCard() {
  return (
    <div
      className="wr-card wr-agent-card-bg h-full min-h-[200px]"
      style={{ overflow: 'hidden', position: 'relative' }}
    >
      {/* Atmospheric glow orbs */}
      <div style={{
        position: 'absolute',
        top: -40, right: -40,
        width: 180, height: 180,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: -30, left: -20,
        width: 140, height: 140,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79,142,247,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div className="wr-card-header" style={{ borderBottomColor: 'rgba(167,139,250,0.12)' }}>
        <span style={{ color: '#A78BFA', display: 'flex', alignItems: 'center', filter: 'drop-shadow(0 0 8px rgba(167,139,250,0.7))' }}>
          <AgentIcon />
        </span>
        <span className="wr-rank1" style={{ color: '#A78BFA', textShadow: '0 0 16px rgba(167,139,250,0.5)' }}>ShirleyCRE Agent</span>
        <div className="wr-panel-line" style={{ background: 'linear-gradient(to right, rgba(167,139,250,0.35), transparent)' }} />
      </div>

      {/* Content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 0',
        gap: 12,
        position: 'relative',
      }}>
        {/* Animated orbit rings */}
        <div style={{ position: 'relative', width: 60, height: 60 }}>
          <motion.div
            style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              border: '1px solid rgba(167,139,250,0.25)',
            }}
            animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            style={{
              position: 'absolute', inset: 8,
              borderRadius: '50%',
              border: '1px solid rgba(167,139,250,0.4)',
            }}
            animate={{ scale: [1, 1.22, 1], opacity: [0.7, 0.1, 0.7] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />
          {/* Core */}
          <div style={{
            position: 'absolute', inset: 16,
            borderRadius: '50%',
            background: 'rgba(167,139,250,0.10)',
            border: '1px solid rgba(167,139,250,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AgentIcon />
          </div>
        </div>

        <div style={{ textAlign: 'center', position: 'relative' }}>
          <div style={{
            fontSize: 14, fontWeight: 700,
            color: 'rgba(240,242,255,0.9)',
            marginBottom: 3,
            letterSpacing: '-0.01em',
          }}>
            ShirleyCRE
          </div>
          <div style={{
            fontSize: 11,
            color: 'rgba(167,139,250,0.5)',
            letterSpacing: '0.04em',
          }}>
            Autonomous CRE Agent
          </div>
        </div>

        {/* Status pill */}
        <div style={{
          padding: '3px 12px',
          borderRadius: 4,
          background: 'rgba(167,139,250,0.08)',
          border: '1px solid rgba(167,139,250,0.18)',
          fontSize: 10,
          color: 'rgba(167,139,250,0.7)',
          fontWeight: 700,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
        }}>
          Phase 3 — Coming Soon
        </div>

        {/* Phase description */}
        <div style={{
          padding: '8px 14px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: 8,
          border: '1px solid rgba(167,139,250,0.08)',
          fontSize: 11,
          color: 'rgba(240,242,255,0.35)',
          lineHeight: 1.6,
          maxWidth: 210,
          textAlign: 'center',
          letterSpacing: '0.01em',
        }}>
          Dedicated hardware · Deal intake<br/>
          Agent-to-agent operations
        </div>
      </div>
    </div>
  )
}

function AgentIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(167,139,250,0.8)" strokeWidth="1.8">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
  )
}

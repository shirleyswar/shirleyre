'use client'

import { motion } from 'framer-motion'

export default function ShirleyCREAgentCard() {
  return (
    <div className="wr-card h-full min-h-[200px]" style={{
      background: 'linear-gradient(135deg, rgba(26,29,39,0.8) 0%, rgba(34,38,50,0.5) 100%)',
      border: '1px solid rgba(201,147,58,0.15)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background pulse glow */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 200,
        height: 200,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(201,147,58,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="wr-card-header">
        <span style={{ color: 'var(--accent-gold)', display: 'flex' }}>
          <AgentIcon />
        </span>
        <span className="wr-card-title">ShirleyCRE Agent</span>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 0',
        gap: 12,
        position: 'relative',
      }}>
        {/* Animated rings */}
        <div style={{ position: 'relative', width: 64, height: 64 }}>
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '1.5px solid rgba(201,147,58,0.3)',
            }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            style={{
              position: 'absolute',
              inset: 8,
              borderRadius: '50%',
              border: '1.5px solid rgba(201,147,58,0.5)',
            }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0.1, 0.8] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          />
          <div style={{
            position: 'absolute',
            inset: 16,
            borderRadius: '50%',
            background: 'rgba(201,147,58,0.12)',
            border: '1px solid rgba(201,147,58,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <AgentIcon />
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            ShirleyCRE
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Autonomous CRE Agent
          </div>
        </div>

        {/* Status pill */}
        <div style={{
          padding: '4px 14px',
          borderRadius: 9999,
          background: 'rgba(201,147,58,0.08)',
          border: '1px solid rgba(201,147,58,0.2)',
          fontSize: 11,
          color: 'var(--accent-gold)',
          fontWeight: 500,
          letterSpacing: '0.06em',
        }}>
          COMING SOON
        </div>

        {/* Phase indicator */}
        <div style={{
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
          fontSize: 11,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
          maxWidth: 220,
          textAlign: 'center',
        }}>
          Dedicated hardware · Phase 3<br/>
          Deal intake · Agent-to-agent ops
        </div>
      </div>
    </div>
  )
}

function AgentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--accent-gold)' }}>
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
  )
}

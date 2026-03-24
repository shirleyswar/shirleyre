'use client'

export default function PortfolioPanel() {
  return (
    <div className="wr-card" style={{ minHeight: 400, position: 'relative', overflow: 'hidden' }}>
      {/* Pulse animation overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 50%, rgba(139,92,246,0.04) 0%, transparent 70%)',
          animation: 'portfolioPulse 4s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Lock icon top-right */}
      <div style={{
        position: 'absolute',
        top: 16,
        right: 16,
        opacity: 0.25,
      }}>
        <LockIcon />
      </div>

      {/* Content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 360,
        textAlign: 'center',
        padding: '40px 32px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Icon */}
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          border: '2px solid rgba(139,92,246,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          background: 'rgba(139,92,246,0.08)',
          animation: 'portfolioIconPulse 3s ease-in-out infinite',
        }}>
          <ChartIcon />
        </div>

        {/* Title */}
        <div style={{
          fontSize: 22,
          fontWeight: 800,
          color: 'var(--text-primary)',
          marginBottom: 8,
          letterSpacing: '-0.02em',
        }}>
          Portfolio Intelligence
        </div>

        {/* Coming soon badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 20,
          background: 'rgba(139,92,246,0.12)',
          border: '1px solid rgba(139,92,246,0.3)',
          marginBottom: 20,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-gold)', animation: 'portfolioDot 2s ease-in-out infinite' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-gold)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Coming Soon
          </span>
        </div>

        {/* Subtitle */}
        <p style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          maxWidth: 440,
          marginBottom: 24,
        }}>
          The financial portfolio analysis agent will feed data directly into this panel.
          Real-time position updates, thesis alerts, and reallocation recommendations surface here.
        </p>

        {/* Divider */}
        <div style={{ width: 40, height: 1, background: 'rgba(139,92,246,0.3)', marginBottom: 24 }} />

        {/* Architecture note */}
        <div style={{
          padding: '14px 20px',
          background: 'rgba(139,92,246,0.06)',
          border: '1px solid rgba(139,92,246,0.15)',
          borderRadius: 8,
          maxWidth: 440,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            ShirleyCRE Integration Point
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
            This panel is a primary ShirleyCRE integration point — architected for live agent data push from day one.
            When the portfolio subagent comes online, it plugs directly into this surface.
          </p>
        </div>

        {/* Data modules coming */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 24 }}>
          {['Position Tracker', 'Thesis Alerts', 'Reallocation Engine', 'Senator Disclosures', 'P&L Dashboard'].map(label => (
            <div key={label} style={{
              fontSize: 10,
              padding: '3px 10px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text-muted)',
              fontWeight: 500,
            }}>
              {label}
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes portfolioPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes portfolioIconPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.15); }
          50% { box-shadow: 0 0 0 12px rgba(139,92,246,0); }
        }
        @keyframes portfolioDot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}

function LockIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="1.5">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}

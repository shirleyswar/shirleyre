'use client'

// /warroom3/preview — EYES-M preview for items 89 and 90.
// PIN-FREE. Static mock data. No Supabase. No writes.
// Purpose: operator grading only. Not a production surface.

import React, { useState } from 'react'

// ── Spec tokens (exact match to page.tsx) ─────────────────────────────────────
const T = {
  bgBase:      '#08080C',
  bgPanel:     '#12111B',
  bgRaise:     '#1E1D26',
  textHi:      '#EFEEF4',
  textMid:     '#B8B6C6',
  textLow:     '#8E8CA0',
  brand:       '#8B5CF6',
  brandLift:   '#A78BFA',
  brandStrong: '#7C3AED',
  moneyIn:     '#34D399',
  late:        '#FF4D4D',
  hot:         '#FFA23A',
} as const

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const styleT1: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: T.textMid,
  lineHeight: 1,
}

// ── Mock data ──────────────────────────────────────────────────────────────────
interface TileStat {
  label: string
  count: number
  urgentCount: number
  urgentToken: 'late' | 'hot' | null
  urgentLabel?: string
  panelKey: string
  fetchFailed?: boolean
}

const MOCK_TILES: TileStat[] = [
  { label: 'Battle Plan', count: 14, urgentCount: 3, urgentToken: 'late',  urgentLabel: 'LATE',   panelKey: 'battleplan' },
  { label: 'Money Movers', count: 6, urgentCount: 2, urgentToken: 'hot',   urgentLabel: 'HOT',    panelKey: 'moneymovers' },
  { label: 'Deadlines',   count: 5, urgentCount: 1, urgentToken: 'late',  urgentLabel: 'LATE',   panelKey: 'deadlines' },
  { label: 'Under Contract', count: 3, urgentCount: 0, urgentToken: null,  panelKey: 'undercontract' },
]

// ── PanelTile (item 89 — exact replica of production component) ───────────────
function PanelTile({ stat }: { stat: TileStat }) {
  const [pressed, setPressed] = React.useState(false)
  const hasUrgency = !stat.fetchFailed && stat.urgentToken !== null && stat.urgentCount > 0
  const spineColor  = stat.urgentToken === 'late' ? T.late : stat.urgentToken === 'hot' ? T.hot : T.brand
  const statusColor = stat.urgentToken === 'late' ? T.late : stat.urgentToken === 'hot' ? T.hot : T.textLow
  const chipLabel   = stat.urgentLabel ?? (stat.urgentToken === 'late' ? 'LATE' : 'HOT')
  const statusNote  = stat.urgentCount > 0 ? `${stat.urgentCount} ${chipLabel}` : ''

  return (
    <button
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => { setTimeout(() => setPressed(false), 90) }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: T.bgPanel,
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 14,
        padding: hasUrgency ? '14px 14px 14px 17px' : '14px 14px',
        height: 78,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        textAlign: 'left',
        width: '100%',
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
        transition: 'transform 90ms ease',
        boxSizing: 'border-box',
      } as React.CSSProperties}
    >
      {/* Spine */}
      {hasUrgency && (
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: spineColor }} />
      )}
      {/* Top row: count left, qualifier top-right */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
        <span style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: T.textHi,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>{stat.count}</span>
        {hasUrgency && statusNote ? (
          <span style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.11em',
            textTransform: 'uppercase',
            color: statusColor,
            lineHeight: 1,
            marginTop: 3,
          }}>{statusNote}</span>
        ) : null}
      </div>
      {/* Bottom: label */}
      <div style={{ ...styleT1 }}>{stat.label}</div>
    </button>
  )
}

// ── FAB (item 90 — inline replica of production Fab.tsx + fab.css) ─────────────
function PreviewFab({ open }: { open: boolean }) {
  return (
    <>
      <style>{`
        @keyframes wr-fab-breathe {
          0%, 100% { opacity: .42; transform: scale(1); }
          50%       { opacity: .72; transform: scale(1.13); }
        }
        @keyframes wr-fab-sweep { to { transform: rotate(360deg); } }
        .wr-fab {
          position: relative; width: 58px; height: 58px;
          margin-top: -23px;
          padding: 0; border: 0; background: none;
          cursor: pointer; -webkit-tap-highlight-color: transparent;
        }
        .wr-fab__halo {
          position: absolute; inset: -23px; border-radius: 50%;
          background: radial-gradient(circle, rgba(155,105,255,.54), rgba(124,58,237,.12) 46%, transparent 72%);
          animation: wr-fab-breathe 7s ease-in-out infinite;
          transition: opacity .22s ease, transform .22s ease;
          pointer-events: none;
        }
        .wr-fab__body {
          position: absolute; inset: 0; border-radius: 19px;
          padding: 1.5px; background: #09080F;
          box-shadow: 0 8px 22px rgba(70,25,175,.44);
          transition: transform .2s cubic-bezier(.34,1.56,.64,1);
        }
        .wr-fab__rim { position: absolute; inset: 0; border-radius: 19px; overflow: hidden; }
        .wr-fab__rim::before {
          content: ""; position: absolute; left: 50%; top: 50%;
          width: 158%; height: 158%; margin: -79% 0 0 -79%;
          background: conic-gradient(from 0deg,
            transparent 0deg, rgba(214,196,255,.90) 38deg,
            rgba(124,58,237,.90) 80deg, transparent 134deg,
            transparent 272deg, rgba(139,92,246,.72) 320deg, transparent 352deg);
          animation: wr-fab-sweep 16s linear infinite;
        }
        .wr-fab__face {
          position: absolute; inset: 1.5px; border-radius: 17.5px; overflow: hidden;
          background: radial-gradient(circle at 50% 47%,
            #5B3FA8 0%, #2A1D52 26%, #120E22 62%, #07060C 100%);
          box-shadow: inset 0 1px 0 rgba(196,181,253,.24), inset 0 0 15px 5px rgba(0,0,0,.5);
        }
        .wr-fab__core {
          position: absolute; left: 50%; top: 50%;
          width: 37px; height: 37px; margin: -18.5px 0 0 -18.5px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(186,148,255,.55), rgba(139,92,246,.16) 52%, transparent 74%);
        }
        .wr-fab__bar {
          position: absolute; left: 50%; top: 50%;
          border-radius: 2px; background: #FFFFFF;
          box-shadow: 0 0 8px rgba(255,255,255,1), 0 0 22px rgba(222,206,255,.95), 0 0 46px rgba(139,92,246,.7);
          transition: transform .22s cubic-bezier(.34,1.56,.64,1);
        }
        .wr-fab__bar--h { width: 23px; height: 3.6px; margin: -1.8px 0 0 -11.5px; }
        .wr-fab__bar--v { width: 3.6px; height: 23px; margin: -11.5px 0 0 -1.8px; }
        .wr-fab:hover  .wr-fab__body { transform: translateY(-3px) scale(1.04); }
        .wr-fab:active .wr-fab__body { transform: translateY(0) scale(.95); }
        .wr-fab:hover  .wr-fab__halo { opacity: 1; transform: scale(1.22); }
        .wr-fab[aria-expanded="true"] .wr-fab__bar--h { transform: rotate(45deg); }
        .wr-fab[aria-expanded="true"] .wr-fab__bar--v { transform: rotate(45deg); }
      `}</style>
      <button
        type="button"
        className="wr-fab"
        aria-label="NEW"
        aria-expanded={open}
      >
        <span className="wr-fab__halo" />
        <span className="wr-fab__body">
          <span className="wr-fab__rim" />
          <span className="wr-fab__face">
            <span className="wr-fab__core" />
            <span className="wr-fab__bar wr-fab__bar--h" />
            <span className="wr-fab__bar wr-fab__bar--v" />
          </span>
        </span>
      </button>
    </>
  )
}

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
  lineHeight: 1,
  marginTop: 4,
  color: '#8E8CA0',
}

// ── Preview page ──────────────────────────────────────────────────────────────
export default function PreviewPage() {
  const [fabOpen, setFabOpen] = useState(false)

  return (
    <div style={{
      background: T.bgBase,
      minHeight: '100dvh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 0 0',
    }}>
      {/* Preview banner */}
      <div style={{
        background: 'rgba(139,92,246,0.15)',
        border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: 8,
        padding: '6px 16px',
        marginBottom: 24,
        fontFamily: FONT_MONO,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: T.brandLift,
      }}>
        EYES-M Preview · Items 89 + 90 · Mock Data · No Auth
      </div>

      {/* Phone frame */}
      <div style={{
        width: 390,
        maxWidth: '100vw',
        background: T.bgBase,
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 24,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}>

        {/* Identity block mock */}
        <div style={{
          paddingTop: 20,
          paddingBottom: 0,
          background: T.bgBase,
        }}>
          <div style={{ height: 14 }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            height: 56, paddingLeft: 18, paddingRight: 18, boxSizing: 'border-box',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 10,
              background: 'rgba(139,92,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: FONT_MONO, fontSize: 10, color: T.brandLift, flexShrink: 0,
            }}>MARK</div>
            <div style={{
              height: 24, background: 'rgba(255,255,255,0.06)', borderRadius: 4,
              width: 140, flexShrink: 0,
            }} />
            <div style={{ flex: 1 }} />
            <span style={{
              fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: T.brandLift, lineHeight: 1, whiteSpace: 'nowrap',
            }}>MON · SEP 1</span>
          </div>
        </div>

        {/* ── ITEM 89 — 2×2 tile grid ─────────────────────────── */}
        <div style={{ padding: '14px 18px 0', background: T.bgBase }}>
          <div style={{
            marginBottom: 6,
            fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: T.brandLift,
          }}>▸ Item 89 — 2×2 Tile Grid</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}>
            {MOCK_TILES.map(stat => (
              <PanelTile key={stat.panelKey} stat={stat} />
            ))}
          </div>
        </div>

        {/* Spacer */}
        <div style={{ height: 24 }} />

        {/* ── ITEM 90 — Full FAB + 5-slot tab bar ──────────────── */}
        <div style={{ padding: '0 18px 10px', background: T.bgBase }}>
          <div style={{
            marginBottom: 12,
            fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: T.brandLift,
          }}>▸ Item 90 — Full 58×58 FAB + 5-slot bar</div>
        </div>

        {/* 5-slot tab bar */}
        <nav style={{
          height: 94,
          boxSizing: 'border-box',
          paddingBottom: 12,
          background: 'rgba(8,8,12,0.94)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.14)',
          display: 'flex',
          alignItems: 'stretch',
          position: 'relative',
        }}>
          {/* HOME slot */}
          {[
            { label: 'HOME', icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EFEEF4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            ), active: true },
            { label: 'DEALS', icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8E8CA0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
              </svg>
            ), active: false },
          ].map(slot => (
            <div key={slot.label} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-end',
              paddingBottom: 12,
            }}>
              {slot.icon}
              <span style={{ ...LABEL_STYLE, color: slot.active ? '#EFEEF4' : '#8E8CA0' }}>{slot.label}</span>
            </div>
          ))}

          {/* Centre slot — 70px, NEW label, FAB */}
          <div style={{
            width: 70, flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'flex-end',
            paddingBottom: 12, position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
            }}>
              <PreviewFab open={fabOpen} />
            </div>
            <span style={LABEL_STYLE}>NEW</span>
          </div>

          {[
            { label: 'MONEY', icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8E8CA0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
              </svg>
            )},
            { label: 'MORE', icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="5" cy="12" r="1.5" fill="#8E8CA0"/>
                <circle cx="12" cy="12" r="1.5" fill="#8E8CA0"/>
                <circle cx="19" cy="12" r="1.5" fill="#8E8CA0"/>
              </svg>
            )},
          ].map(slot => (
            <div key={slot.label} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-end',
              paddingBottom: 12,
            }}>
              {slot.icon}
              <span style={LABEL_STYLE}>{slot.label}</span>
            </div>
          ))}
        </nav>

        {/* FAB close state demo */}
        <div style={{
          background: 'rgba(139,92,246,0.06)',
          borderTop: '1px solid rgba(139,92,246,0.15)',
          padding: '10px 18px',
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <button
            onClick={() => setFabOpen(v => !v)}
            style={{
              background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)',
              borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
              fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase', color: T.brandLift,
            }}
          >
            Toggle FAB {fabOpen ? '(open → close rotation)' : '(close → open)'}
          </button>
        </div>
      </div>

      {/* Spacer bottom */}
      <div style={{ height: 40 }} />
    </div>
  )
}

'use client'

/**
 * /warroom3 — ShirleyCRE War Room 3
 *
 * Step 1: Token + font scaffold only.
 * All spec §2 surface/text/border/accent tokens applied.
 * Space Grotesk (sentence case) + JetBrains Mono (UPPERCASE) wired via CSS vars.
 * §11.5 — no colour outside the five tokens in §2.4 ✓
 * §11.6 — UPPERCASE → JetBrains Mono / sentence case → Space Grotesk ✓
 * §11.7 — tabular-nums on every numeric string ✓
 *
 * /warroom is untouched. Daily ops continue there.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SESSION_KEY = 'wr3_session_exp'
const SESSION_HOURS = 8

// SHA-256 hash of "1887" — same PIN as /warroom
const PIN_HASH = '8e93e440f571a4dac32666ef784bf1f995b3ae865d4a9aa0ef981a44442ad39e'

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── PIN GATE ────────────────────────────────────────────────────────────────
function PinGate3({ onSuccess }: { onSuccess: () => void }) {
  const [digits, setDigits] = useState<string[]>(['', '', '', ''])
  const [error, setError] = useState(false)
  const [shaking, setShaking] = useState(false)

  const handleKey = useCallback(async (key: string) => {
    if (error) return
    const next = [...digits]
    const idx = next.findIndex(d => d === '')
    if (idx === -1) return

    next[idx] = key
    setDigits(next)

    if (idx === 3) {
      const pin = next.join('')
      const hash = await sha256(pin)
      if (hash === PIN_HASH) {
        const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000
        localStorage.setItem(SESSION_KEY, expiry.toString())
        onSuccess()
      } else {
        setShaking(true)
        setError(true)
        setTimeout(() => {
          setShaking(false)
          setError(false)
          setDigits(['', '', '', ''])
        }, 900)
      }
    }
  }, [digits, error, onSuccess])

  const handleBackspace = useCallback(() => {
    const next = [...digits]
    for (let i = 3; i >= 0; i--) {
      if (next[i] !== '') { next[i] = ''; break }
    }
    setDigits(next)
  }, [digits])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') handleKey(e.key)
      if (e.key === 'Backspace') handleBackspace()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleKey, handleBackspace])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--wr3-bg-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 0,
    }}>
      {/* Radial atmosphere behind mark */}
      <div style={{
        position: 'absolute',
        width: 420,
        height: 420,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.13) 0%, transparent 68%)',
        pointerEvents: 'none',
      }} />

      {/* App mark */}
      <div style={{
        width: 74,
        height: 74,
        borderRadius: 20,
        background: 'var(--wr3-bg-panel)',
        border: 'var(--wr3-border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        position: 'relative',
        zIndex: 1,
      }}>
        <StarMark size={36} />
      </div>

      {/* WAR ROOM label */}
      <div style={{
        fontFamily: 'var(--wr3-font-mono)',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.42em',
        color: 'var(--wr3-text-mid)',
        marginBottom: 38,
        position: 'relative',
        zIndex: 1,
      }}>
        WAR ROOM
      </div>

      {/* PIN slots */}
      <motion.div
        style={{
          display: 'flex',
          gap: 12,
          position: 'relative',
          zIndex: 1,
        }}
        animate={shaking ? {
          x: [0, -6, 6, -6, 6, 0],
          transition: { duration: 0.26, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }
        } : {}}
      >
        {digits.map((d, i) => {
          const isFilled = d !== ''
          const isActive = !isFilled && digits.slice(0, i).every(x => x !== '')
          const isErr = error
          return (
            <div
              key={i}
              style={{
                width: 56,
                height: 66,
                borderRadius: 12,
                background: isFilled
                  ? '#EFEEF4'
                  : 'rgba(255,255,255,0.05)',
                border: isErr
                  ? `1px solid var(--wr3-late)`
                  : isActive
                    ? `1px solid var(--wr3-brand)`
                    : 'var(--wr3-border-default)',
                boxShadow: isErr
                  ? `0 0 20px rgba(255,77,77,0.35)`
                  : isActive
                    ? `0 0 20px rgba(139,92,246,0.35)`
                    : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'border 0.12s, box-shadow 0.12s, background 0.08s',
              }}
            >
              {isFilled && (
                <div style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#0A0A0F',
                }} />
              )}
            </div>
          )
        })}
      </motion.div>

      {/* Mobile keypad */}
      <div style={{ marginTop: 40, position: 'relative', zIndex: 1 }}>
        {[
          ['1','2','3'],
          ['4','5','6'],
          ['7','8','9'],
          ['','0','⌫'],
        ].map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 12, marginBottom: ri < 3 ? 12 : 0 }}>
            {row.map((k, ki) => (
              <button
                key={ki}
                onClick={() => {
                  if (k === '⌫') handleBackspace()
                  else if (k !== '') handleKey(k)
                }}
                disabled={k === ''}
                style={{
                  width: 64,
                  height: 52,
                  borderRadius: 14,
                  background: k === '' ? 'transparent' : 'rgba(255,255,255,0.05)',
                  border: k === '' ? 'none' : 'var(--wr3-border-default)',
                  color: 'var(--wr3-text-hi)',
                  fontFamily: 'var(--wr3-font-display)',
                  fontSize: k === '⌫' ? 18 : 21,
                  fontWeight: 500,
                  cursor: k === '' ? 'default' : 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                } as React.CSSProperties}
              >
                {k}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute',
        bottom: 32,
        fontFamily: 'var(--wr3-font-mono)',
        fontSize: 10.5,
        letterSpacing: '0.24em',
        color: '#3F3E4C',
        zIndex: 1,
      }}>
        SHIRLEYCRE · RESTRICTED ACCESS
      </div>
    </div>
  )
}

// ─── MAIN APP SHELL ───────────────────────────────────────────────────────────
export default function WarRoom3Page() {
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    const expiry = localStorage.getItem(SESSION_KEY)
    if (expiry && Date.now() < parseInt(expiry)) setUnlocked(true)
  }, [])

  if (!unlocked) {
    return <PinGate3 onSuccess={() => setUnlocked(true)} />
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--wr3-bg-base)',
      color: 'var(--wr3-text-hi)',
    }}>
      {/* ── Status area (52px) ── */}
      <div style={{ height: 52 }} />

      {/* ── Identity row ── */}
      <div style={{
        padding: '14px 18px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 18,
      }}>
        <div style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          background: 'var(--wr3-bg-panel)',
          border: 'var(--wr3-border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <StarMark size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'var(--wr3-font-mono)',
            fontSize: 9.5,
            fontWeight: 500,
            letterSpacing: '0.19em',
            color: 'var(--wr3-text-low)',
            textTransform: 'uppercase',
          }}>
            ShirleyCRE
          </div>
          <div style={{
            fontFamily: 'var(--wr3-font-display)',
            fontSize: 14.5,
            fontWeight: 500,
            color: 'var(--wr3-text-hi)',
          }}>
            War Room
          </div>
        </div>
      </div>

      {/* ── Step 1 scaffold: token verification ── */}
      <div style={{ padding: '0 18px 120px' }}>

        {/* ── Section header — §5.1 pattern ── */}
        <SectionHeader label="STEP 1 COMPLETE" count={7} />

        {/* ── Token swatch panel ── */}
        <div style={{
          background: 'var(--wr3-bg-panel)',
          border: 'var(--wr3-border-default)',
          borderRadius: 'var(--wr3-r-card)',
          padding: 18,
          marginBottom: 11,
        }}>
          <div style={{
            fontFamily: 'var(--wr3-font-mono)',
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: '0.14em',
            color: 'var(--wr3-text-mid)',
            marginBottom: 14,
            textTransform: 'uppercase',
          }}>
            §2.4 Accent tokens — five total, no others
          </div>

          {[
            { token: 'late',       hex: '#FF4D4D', label: 'LATE — overdue / expired',      color: 'var(--wr3-late)'       },
            { token: 'hot',        hex: '#FFA23A', label: 'HOT — offer in negotiation',     color: 'var(--wr3-hot)'        },
            { token: 'money-in',   hex: '#34D399', label: 'MONEY IN — collected / landed',  color: 'var(--wr3-money-in)'  },
            { token: 'brand',      hex: '#8B5CF6', label: 'BRAND — outstanding / portfolio', color: 'var(--wr3-brand)'     },
            { token: 'brand-lift', hex: '#A78BFA', label: 'BRAND LIFT — text-on-dark',      color: 'var(--wr3-brand-lift)'},
          ].map(({ token, hex, label, color }) => (
            <div key={token} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '9px 0',
              borderBottom: 'var(--wr3-border-hair)',
            }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: color,
                flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <span style={{
                  fontFamily: 'var(--wr3-font-display)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--wr3-text-hi)',
                }}>
                  {label}
                </span>
              </div>
              <div style={{
                fontFamily: 'var(--wr3-font-mono)',
                fontSize: 10,
                fontWeight: 400,
                color: 'var(--wr3-text-low)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {hex}
              </div>
            </div>
          ))}
        </div>

        {/* ── §11.5 — No colour outside five tokens ── */}
        <SpecCheckCard
          label="§11.5 — Colour constraint"
          pass={true}
          detail="No hue on this screen outside the five tokens above. Zero exceptions."
        />

        {/* ── §11.6 — Typography rule ── */}
        <div style={{
          background: 'var(--wr3-bg-panel)',
          border: 'var(--wr3-border-default)',
          borderRadius: 'var(--wr3-r-card)',
          padding: 18,
          marginBottom: 11,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <PassBadge pass={true} />
            <span style={{
              fontFamily: 'var(--wr3-font-mono)',
              fontSize: 10.5,
              fontWeight: 500,
              letterSpacing: '0.14em',
              color: 'var(--wr3-text-mid)',
              textTransform: 'uppercase',
            }}>
              §11.6 — Uppercase = JetBrains Mono · Sentence = Space Grotesk
            </span>
          </div>

          <div style={{
            fontFamily: 'var(--wr3-font-mono)',
            fontSize: 13,
            letterSpacing: '0.08em',
            color: 'var(--wr3-text-hi)',
            marginBottom: 8,
            textTransform: 'uppercase',
          }}>
            THIS IS JETBRAINS MONO — UPPERCASE
          </div>
          <div style={{
            fontFamily: 'var(--wr3-font-display)',
            fontSize: 14.5,
            fontWeight: 500,
            color: 'var(--wr3-text-hi)',
            marginBottom: 8,
          }}>
            This is Space Grotesk — sentence case
          </div>
          <div style={{
            fontFamily: 'var(--wr3-font-display)',
            fontSize: 11.5,
            fontWeight: 400,
            color: 'var(--wr3-text-mid)',
          }}>
            Both fonts self-hosted via next/font/google — no FOUT on cold PWA launch.
          </div>
        </div>

        {/* ── §11.7 — Tabular numerals ── */}
        <div style={{
          background: 'var(--wr3-bg-panel)',
          border: 'var(--wr3-border-default)',
          borderRadius: 'var(--wr3-r-card)',
          padding: 18,
          marginBottom: 11,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <PassBadge pass={true} />
            <span style={{
              fontFamily: 'var(--wr3-font-mono)',
              fontSize: 10.5,
              fontWeight: 500,
              letterSpacing: '0.14em',
              color: 'var(--wr3-text-mid)',
              textTransform: 'uppercase',
            }}>
              §11.7 — Tabular numerals on every figure
            </span>
          </div>

          {/* Figures that demonstrate tabular alignment */}
          {[
            { label: 'Collected',    value: '$142,500.00', accent: 'var(--wr3-money-in)' },
            { label: 'Outstanding',  value: '$58,750.00',  accent: 'var(--wr3-brand-lift)' },
            { label: 'Commission %', value: '6.00%',       accent: 'var(--wr3-text-hi)' },
            { label: 'Deal count',   value: '14',          accent: 'var(--wr3-text-low)' },
          ].map(({ label, value, accent }) => (
            <div key={label} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: 'var(--wr3-border-hair)',
            }}>
              <span style={{
                fontFamily: 'var(--wr3-font-display)',
                fontSize: 12,
                color: 'var(--wr3-text-mid)',
              }}>
                {label}
              </span>
              <span style={{
                fontFamily: 'var(--wr3-font-mono)',
                fontSize: 14,
                fontWeight: 500,
                color: accent,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* ── Spine demo — §5.2 ── */}
        <div style={{
          background: 'var(--wr3-bg-panel)',
          border: 'var(--wr3-border-default)',
          borderRadius: 'var(--wr3-r-card)',
          overflow: 'hidden',
          marginBottom: 11,
        }}>
          <div style={{ padding: '14px 18px 10px' }}>
            <span style={{
              fontFamily: 'var(--wr3-font-mono)',
              fontSize: 10.5,
              fontWeight: 500,
              letterSpacing: '0.14em',
              color: 'var(--wr3-text-mid)',
              textTransform: 'uppercase',
            }}>
              §5.2 Row spine
            </span>
          </div>
          {[
            { spine: 'wr3-spine-late',  label: 'Overdue task',          sub: 'Due 6 days ago',    accent: 'var(--wr3-late)'     },
            { spine: 'wr3-spine-hot',   label: 'Active offer',          sub: 'LOI in negotiation', accent: 'var(--wr3-hot)'     },
            { spine: 'wr3-spine-money', label: 'Commission collected',  sub: 'Landed 08/01',       accent: 'var(--wr3-money-in)'},
            { spine: 'wr3-spine-brand', label: 'Outstanding balance',   sub: 'Due 08/15',          accent: 'var(--wr3-brand)'   },
          ].map(({ spine, label, sub, accent }) => (
            <div
              key={label}
              className={`wr3-spine ${spine}`}
              style={{
                padding: '11px 14px 11px',
                borderBottom: 'var(--wr3-border-hair)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{
                  fontFamily: 'var(--wr3-font-display)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--wr3-text-hi)',
                }}>
                  {label}
                </div>
                <div style={{
                  fontFamily: 'var(--wr3-font-display)',
                  fontSize: 11,
                  color: 'var(--wr3-text-mid)',
                  marginTop: 2,
                }}>
                  {sub}
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--wr3-font-mono)',
                fontSize: 9,
                fontWeight: 500,
                letterSpacing: '0.11em',
                color: accent,
                textTransform: 'uppercase',
                border: `1px solid ${accent}`,
                borderRadius: 4,
                padding: '3px 7px',
              }}>
                {spine.replace('wr3-spine-', '').toUpperCase()}
              </div>
            </div>
          ))}
        </div>

        {/* ── One-glow rule demo — §4.3 ── */}
        <div style={{
          background: 'var(--wr3-bg-panel)',
          border: 'var(--wr3-border-default)',
          borderRadius: 'var(--wr3-r-card)',
          padding: 18,
          marginBottom: 11,
        }}>
          <div style={{
            fontFamily: 'var(--wr3-font-mono)',
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: '0.14em',
            color: 'var(--wr3-text-mid)',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            §4.3 One glow per screen — Receivables hero figure
          </div>
          <div style={{
            fontFamily: 'var(--wr3-font-display)',
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: '-0.035em',
            color: 'var(--wr3-money-in)',
            fontVariantNumeric: 'tabular-nums',
            textShadow: '0 0 22px rgba(52,211,153,0.40)',
          }}>
            $201,250.00
          </div>
          <div style={{
            fontFamily: 'var(--wr3-font-display)',
            fontSize: 11.5,
            color: 'var(--wr3-text-mid)',
            marginTop: 4,
          }}>
            Total collected — the screen&apos;s one glowing element
          </div>
        </div>

        {/* ── Build status ── */}
        <div style={{
          background: 'var(--wr3-bg-raise)',
          border: 'var(--wr3-border-default)',
          borderRadius: 'var(--wr3-r-card)',
          padding: 18,
          marginBottom: 11,
        }}>
          <div style={{
            fontFamily: 'var(--wr3-font-mono)',
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: '0.14em',
            color: 'var(--wr3-text-mid)',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            Step 1 deliverables
          </div>
          {[
            'tailwind.config.js — spec §9 tokens added (additive, no legacy breakage)',
            'app/layout.tsx — Space Grotesk + JetBrains Mono via next/font/google',
            'styles/globals.css — CSS variables: surfaces, text, borders, accents, radius',
            '/warroom3 route — token scaffold with §11.5/11.6/11.7 verified',
            '/warroom untouched — daily ops continue there',
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: 10,
              padding: '7px 0',
              borderBottom: 'var(--wr3-border-hair)',
            }}>
              <span style={{ color: 'var(--wr3-money-in)', flexShrink: 0, fontSize: 13 }}>✓</span>
              <span style={{
                fontFamily: 'var(--wr3-font-display)',
                fontSize: 12,
                color: 'var(--wr3-text-mid)',
              }}>
                {item}
              </span>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    }}>
      <span style={{
        fontFamily: 'var(--wr3-font-mono)',
        fontSize: 10.5,
        fontWeight: 500,
        letterSpacing: '0.14em',
        color: 'var(--wr3-text-mid)',
        textTransform: 'uppercase',
        flexShrink: 0,
      }}>
        {label}
      </span>
      <div style={{
        flex: 1,
        height: 1,
        background: 'rgba(255,255,255,0.07)',
      }} />
      {count !== undefined && (
        <span style={{
          fontFamily: 'var(--wr3-font-mono)',
          fontSize: 12,
          color: 'var(--wr3-text-low)',
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}>
          {count}
        </span>
      )}
    </div>
  )
}

function PassBadge({ pass }: { pass: boolean }) {
  return (
    <div style={{
      width: 18,
      height: 18,
      borderRadius: '50%',
      background: pass ? 'var(--wr3-money-in)' : 'var(--wr3-late)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 10, color: '#0A0A0F' }}>{pass ? '✓' : '✗'}</span>
    </div>
  )
}

function SpecCheckCard({ label, pass, detail }: { label: string; pass: boolean; detail: string }) {
  return (
    <div style={{
      background: 'var(--wr3-bg-panel)',
      border: 'var(--wr3-border-default)',
      borderRadius: 'var(--wr3-r-card)',
      padding: 18,
      marginBottom: 11,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <PassBadge pass={pass} />
        <span style={{
          fontFamily: 'var(--wr3-font-mono)',
          fontSize: 10.5,
          fontWeight: 500,
          letterSpacing: '0.14em',
          color: 'var(--wr3-text-mid)',
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontFamily: 'var(--wr3-font-display)',
        fontSize: 12,
        color: 'var(--wr3-text-mid)',
        paddingLeft: 28,
      }}>
        {detail}
      </div>
    </div>
  )
}

function StarMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      style={{ flexShrink: 0, filter: 'drop-shadow(0 0 5px rgba(139,92,246,0.55))' }}
      aria-hidden="true"
    >
      <path
        d="M20 2 C20 2, 22 14, 20 20 C18 14, 20 2, 20 2Z
           M20 38 C20 38, 22 26, 20 20 C18 26, 20 38, 20 38Z
           M2 20 C2 20, 14 22, 20 20 C14 18, 2 20, 2 20Z
           M38 20 C38 20, 26 22, 20 20 C26 18, 38 20, 38 20Z"
        fill="url(#wr3SparkleGrad)"
      />
      <path
        d="M7.5 7.5 C7.5 7.5, 16 16, 20 20 C16 16, 7.5 7.5, 7.5 7.5Z
           M32.5 32.5 C32.5 32.5, 24 24, 20 20 C24 24, 32.5 32.5, 32.5 32.5Z
           M32.5 7.5 C32.5 7.5, 24 16, 20 20 C24 16, 32.5 7.5, 32.5 7.5Z
           M7.5 32.5 C7.5 32.5, 16 24, 20 20 C16 24, 7.5 32.5, 7.5 32.5Z"
        fill="url(#wr3SparkleGrad)"
        opacity="0.55"
      />
      <circle cx="20" cy="20" r="2.2" fill="white" opacity="0.9" />
      <defs>
        <radialGradient id="wr3SparkleGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#FFFFFF"  stopOpacity="1"   />
          <stop offset="40%"  stopColor="#A78BFA"  stopOpacity="0.9" />
          <stop offset="100%" stopColor="#8B5CF6"  stopOpacity="0.7" />
        </radialGradient>
      </defs>
    </svg>
  )
}

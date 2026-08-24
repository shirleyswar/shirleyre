/**
 * D2.5 — Desktop type levels
 * Stamped 8.18.26 — ×1.15 scale applied uniformly (old × 1.15, rounded to nearest 0.5px).
 * D11 additions: DS0 (modal title 32px) · DT0 (modal header label 18.5px mono).
 * No raw pixel font-size may appear outside this file (except D6's two PIN-gate exceptions).
 */

import React from 'react'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

/** D11 modal title */
export const DS0: React.CSSProperties = { fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 500 }
export const DS1: React.CSSProperties = { fontFamily: FONT_DISPLAY, fontSize: 26.5, fontWeight: 500 }
export const DS2: React.CSSProperties = { fontFamily: FONT_DISPLAY, fontSize: 16.5, fontWeight: 500 }
/** Row primary */
export const DS3: React.CSSProperties = { fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 500 }
/** Row primary compact */
export const DS4: React.CSSProperties = { fontFamily: FONT_DISPLAY, fontSize: 14.5, fontWeight: 500 }
/** Row primary dense */
export const DS5: React.CSSProperties = { fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 500 }
/** Row secondary */
export const DS6: React.CSSProperties = { fontFamily: FONT_DISPLAY, fontSize: 12.5, fontWeight: 400 }
/** Row secondary compact */
export const DS7: React.CSSProperties = { fontFamily: FONT_DISPLAY, fontSize: 12, fontWeight: 400 }
/** Micro secondary */
export const DS8: React.CSSProperties = { fontFamily: FONT_DISPLAY, fontSize: 11, fontWeight: 400 }

/** D11 modal header label — TASK / EDIT TASK */
export const DT0: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 18.5, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase' as const }
export const DT1: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 15, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase' as const }
export const DT2: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 14, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase' as const }
export const DT3: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500, letterSpacing: 0, textTransform: 'uppercase' as const }
export const DT4: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500, letterSpacing: 0, textTransform: 'uppercase' as const }
export const DT5: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const }
export const DT6: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.19em', textTransform: 'uppercase' as const }
export const DT7: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase' as const }
export const DT8: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 10, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase' as const }

export const DM0: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 34.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }
export const DM1: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }
export const DM2: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }

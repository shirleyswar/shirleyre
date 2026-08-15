/**
 * D2.5 — Desktop type levels
 * Stamped 8.15.26 1101. These are the ONLY pixel values for text on the desktop surface.
 * No raw pixel font-size may appear outside this file (except D6's two PIN-gate exceptions).
 *
 * Space Grotesk — DS1–DS8
 * JetBrains Mono labels — DT1–DT8
 * JetBrains Mono figures — DM0–DM2 (all tabular-nums)
 */

import React from 'react'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

// ── Space Grotesk levels ─────────────────────────────────────────────────────

export const DS1: React.CSSProperties = {
  fontFamily: FONT_DISPLAY, fontSize: 23, fontWeight: 500,
}
export const DS2: React.CSSProperties = {
  fontFamily: FONT_DISPLAY, fontSize: 14.5, fontWeight: 500,
}
/** Row primary — Battle Plan title, Money Movers address, Deadlines title */
export const DS3: React.CSSProperties = {
  fontFamily: FONT_DISPLAY, fontSize: 13.5, fontWeight: 500,
}
/** Row primary compact — Schedule title; panel action button */
export const DS4: React.CSSProperties = {
  fontFamily: FONT_DISPLAY, fontSize: 12.5, fontWeight: 500,
}
/** Row primary dense — NEXT 48 item title */
export const DS5: React.CSSProperties = {
  fontFamily: FONT_DISPLAY, fontSize: 11.5, fontWeight: 500,
}
/** Row secondary — Battle Plan client/deal */
export const DS6: React.CSSProperties = {
  fontFamily: FONT_DISPLAY, fontSize: 11, fontWeight: 400,
}
/** Row secondary compact — Money Movers meta, Schedule location, Deadlines property */
export const DS7: React.CSSProperties = {
  fontFamily: FONT_DISPLAY, fontSize: 10.5, fontWeight: 400,
}
/** Micro secondary — NEXT 48 context line */
export const DS8: React.CSSProperties = {
  fontFamily: FONT_DISPLAY, fontSize: 9.5, fontWeight: 400,
}

// ── JetBrains Mono label levels ──────────────────────────────────────────────

/** Panel header label; identity band WAR ROOM at 0.19em */
export const DT1: React.CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500, letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
}
/** Identity band date and clock */
export const DT2: React.CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500, letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
}
/** LIVE */
export const DT3: React.CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 500, letterSpacing: 0,
  textTransform: 'uppercase' as const,
}
/** ⌘K chip; NEXT 48 empty state; PIN footer at 0.24em */
export const DT4: React.CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 500, letterSpacing: 0,
  textTransform: 'uppercase' as const,
}
/** Rail label; panel status and total counts; Battle Plan day count */
export const DT5: React.CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 10, fontWeight: 500, letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
}
/** Read-row label */
export const DT6: React.CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500, letterSpacing: '0.19em',
  textTransform: 'uppercase' as const,
}
/** Group labels, NEXT 48 column headers, Schedule AM/PM, Deadlines meta */
export const DT7: React.CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 9, fontWeight: 500, letterSpacing: '0.16em',
  textTransform: 'uppercase' as const,
}
/** NEXT 48 time gutter; Money Movers column header row */
export const DT8: React.CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 8.5, fontWeight: 500, letterSpacing: '0.16em',
  textTransform: 'uppercase' as const,
}

// ── JetBrains Mono figure levels — all tabular-nums ─────────────────────────

/** Receivables collected total — the one hero figure on the dashboard */
export const DM0: React.CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 30, fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
}
/** Panel figures — Money Movers value and commission; read-row numeric value */
export const DM1: React.CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
}
/** Schedule time gutter */
export const DM2: React.CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
}

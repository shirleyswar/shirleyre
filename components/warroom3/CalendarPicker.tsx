'use client'

// §18.3b / §18.3c — Drawn calendar picker.
// Never a native <input type="date"> — system chrome is outside the token system.
// Card: #12111A, borderRadius 22, padding 22.
// Month header: two 34px nav targets, month+year label centred.
// 7-column grid: weekday initials (Su Mo Tu We Th Fr Sa) at text-low, date cells 42px tall.
// Selected day: FAB_APERTURE_GRADIENT background, color textInvert.
// Footer: Cancel (outlined, 46px) + Done (FAB_APERTURE_GRADIENT, 46px), flex:1 each, gap 9.

import React, { useState } from 'react'
import { FAB_APERTURE_GRADIENT, FAB_APERTURE_SHADOW } from '@/lib/fabGradient'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"

const T = {
  textHi:     '#EFEEF4',
  textMid:    '#8B8A9B',
  textLow:    '#5C5B6B',
  textInvert: '#0A0A0F',
} as const

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

interface CalendarPickerProps {
  value: Date | null
  onCancel: () => void
  onDone: (date: Date) => void
}

export default function CalendarPicker({ value, onCancel, onDone }: CalendarPickerProps) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(value ? value.getFullYear() : today.getFullYear())
  const [viewMonth, setViewMonth] = useState(value ? value.getMonth() : today.getMonth())
  const [selected, setSelected] = useState<Date | null>(value)

  const totalDays = daysInMonth(viewYear, viewMonth)
  const firstDay = firstDayOfMonth(viewYear, viewMonth)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const isSelected = (day: number) =>
    selected &&
    selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth &&
    selected.getDate() === day

  // Build grid cells: nulls for leading blanks, then day numbers
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  // Pad to complete final row
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div style={{
      background: '#12111A',
      borderRadius: 22,
      padding: 22,
      marginTop: 12,
    }}>
      {/* Month header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <button
          onClick={prevMonth}
          style={{
            width: 34, height: 34,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 9,
            color: T.textMid,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
            flexShrink: 0,
          } as React.CSSProperties}
          aria-label="Previous month"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <div style={{
          flex: 1,
          textAlign: 'center',
          fontFamily: FONT_DISPLAY,
          fontSize: 14,
          fontWeight: 600,
          color: T.textHi,
        }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </div>

        <button
          onClick={nextMonth}
          style={{
            width: 34, height: 34,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 9,
            color: T.textMid,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
            flexShrink: 0,
          } as React.CSSProperties}
          aria-label="Next month"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Weekday initials */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        marginBottom: 6,
      }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{
            textAlign: 'center',
            fontFamily: FONT_DISPLAY,
            fontSize: 10,
            fontWeight: 500,
            color: T.textLow,
            padding: '4px 0',
          }}>{d}</div>
        ))}
      </div>

      {/* Date grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 2,
      }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} style={{ height: 42 }} />
          const sel = isSelected(day)
          return (
            <button
              key={day}
              onClick={() => setSelected(new Date(viewYear, viewMonth, day))}
              style={{
                height: 42,
                border: 'none',
                borderRadius: 9,
                background: sel ? FAB_APERTURE_GRADIENT : 'transparent',
                boxShadow: sel ? FAB_APERTURE_SHADOW : 'none',
                color: sel ? T.textInvert : T.textHi,
                fontFamily: FONT_DISPLAY,
                fontSize: 13,
                fontWeight: sel ? 600 : 400,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              } as React.CSSProperties}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, height: 46,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.13)',
            borderRadius: 11,
            color: T.textMid,
            fontFamily: FONT_DISPLAY,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          } as React.CSSProperties}
        >
          Cancel
        </button>
        <button
          onClick={() => { if (selected) onDone(selected) }}
          disabled={!selected}
          style={{
            flex: 1, height: 46,
            background: selected ? FAB_APERTURE_GRADIENT : 'rgba(139,92,246,0.3)',
            boxShadow: selected ? FAB_APERTURE_SHADOW : 'none',
            border: 'none',
            borderRadius: 11,
            color: selected ? T.textInvert : T.textLow,
            fontFamily: FONT_DISPLAY,
            fontSize: 13,
            fontWeight: 600,
            cursor: selected ? 'pointer' : 'default',
            WebkitTapHighlightColor: 'transparent',
          } as React.CSSProperties}
        >
          Done
        </button>
      </div>
    </div>
  )
}

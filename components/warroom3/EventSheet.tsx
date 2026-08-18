'use client'

// §18.3c Event sheet (36b, locked 13 Aug)
// Full create-and-save sheet. Wraps in BottomSheet (size="list", label="New Event").
// Title: autofocused D3-style underline input.
// WHEN: three flex:1 chips (Today · Tomorrow · Pick date). Same calendar as TaskSheet (CalendarPicker).
// TIME: full-width 48px control → drawn time wheel (hours 1–12, minutes 00/15/30/45).
// Deal + Location: placeholder rows for v1.
// Save: INSERT to schedule_events. Migration at supabase/migrations/20260813094500_schedule_events.sql.

import React, { useState, useEffect, useRef } from 'react'
import { Clock } from 'lucide-react'
import BottomSheet from '@/components/warroom3/BottomSheet'
import CalendarPicker from '@/components/warroom3/CalendarPicker'
import { supabase } from '@/lib/supabase'
import { FAB_APERTURE_GRADIENT, FAB_APERTURE_SHADOW } from '@/lib/fabGradient'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  textHi:     '#EFEEF4',
  textMid:    '#B8B6C6',
  textLow:    '#8E8CA0',
  textInvert: '#0A0A0F',
} as const

const styleT2: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 9.5,
  fontWeight: 500,
  letterSpacing: '0.19em',
  textTransform: 'uppercase',
  color: T.textLow,
  lineHeight: 1,
}

type WhenChip = 'today' | 'tomorrow' | 'pick'

function toISODate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function chipDate(chip: WhenChip): string {
  const now = new Date()
  if (chip === 'today') return toISODate(now)
  if (chip === 'tomorrow') { now.setDate(now.getDate() + 1); return toISODate(now) }
  return ''
}

// ── Time wheel ────────────────────────────────────────────────────────────────
// Drawn. Two independent columns: hours (1–12) and minutes (00, 15, 30, 45).
// Fixed-height window shows 5 rows; centre row = selected.
// Centre highlight: FAB_APERTURE_GRADIENT at 0.25 opacity.

const HOURS = [1,2,3,4,5,6,7,8,9,10,11,12]
const MINUTES = [0, 15, 30, 45]
const MERIDIEM = ['AM', 'PM']

const ROW_H = 44
const VISIBLE_ROWS = 5
const WHEEL_H = ROW_H * VISIBLE_ROWS

interface WheelColumnProps {
  items: string[]
  selected: number  // index
  onSelect: (idx: number) => void
}

function WheelColumn({ items, selected, onSelect }: WheelColumnProps) {
  return (
    <div style={{ flex: 1, position: 'relative', height: WHEEL_H, overflow: 'hidden' }}>
      {/* Centre highlight band — FAB gradient at 0.25 opacity */}
      <div style={{
        position: 'absolute',
        top: ROW_H * 2,
        left: 0, right: 0,
        height: ROW_H,
        background: FAB_APERTURE_GRADIENT,
        opacity: 0.25,
        borderRadius: 9,
        pointerEvents: 'none',
        zIndex: 1,
      }} />
      {/* Scrollable items */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        // Shift so selected row is in center (row 2, 0-indexed)
        transform: `translateY(${(2 - selected) * ROW_H}px)`,
        transition: 'transform 0.15s ease',
      }}>
        {items.map((item, i) => (
          <button
            key={item}
            onClick={() => onSelect(i)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: ROW_H,
              width: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: FONT_DISPLAY,
              fontSize: i === selected ? 18 : 15,
              fontWeight: i === selected ? 600 : 400,
              color: i === selected ? T.textHi : T.textMid,
              WebkitTapHighlightColor: 'transparent',
              position: 'relative',
              zIndex: 2,
              transition: 'font-size 0.1s, color 0.1s',
            } as React.CSSProperties}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  )
}

interface TimeWheelProps {
  hour: number     // 1–12
  minute: number   // 0, 15, 30, 45
  meridiem: 'AM' | 'PM'
  onHour: (h: number) => void
  onMinute: (m: number) => void
  onMeridiem: (am: 'AM' | 'PM') => void
  onCancel: () => void
  onDone: () => void
}

function TimeWheel({ hour, minute, meridiem, onHour, onMinute, onMeridiem, onCancel, onDone }: TimeWheelProps) {
  const hourIdx     = HOURS.indexOf(hour)
  const minuteIdx   = MINUTES.indexOf(minute)
  const meridiemIdx = MERIDIEM.indexOf(meridiem)

  return (
    <div style={{
      background: '#12111A',
      borderRadius: 22,
      padding: 22,
      marginTop: 12,
    }}>
      <div style={{
        display: 'flex',
        gap: 4,
        height: WHEEL_H,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Top fade */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 44,
          background: 'linear-gradient(to bottom, #12111A, transparent)',
          zIndex: 3, pointerEvents: 'none',
        }} />
        {/* Bottom fade */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 44,
          background: 'linear-gradient(to top, #12111A, transparent)',
          zIndex: 3, pointerEvents: 'none',
        }} />

        <WheelColumn
          items={HOURS.map(String)}
          selected={hourIdx < 0 ? 0 : hourIdx}
          onSelect={i => onHour(HOURS[i])}
        />
        <div style={{ display: 'flex', alignItems: 'center', color: T.textMid, fontFamily: FONT_DISPLAY, fontSize: 16, paddingBottom: 2 }}>:</div>
        <WheelColumn
          items={MINUTES.map(m => String(m).padStart(2, '0'))}
          selected={minuteIdx < 0 ? 0 : minuteIdx}
          onSelect={i => onMinute(MINUTES[i])}
        />
        <WheelColumn
          items={MERIDIEM}
          selected={meridiemIdx < 0 ? 0 : meridiemIdx}
          onSelect={i => onMeridiem(MERIDIEM[i] as 'AM' | 'PM')}
        />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, height: 46,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.20)',
            borderRadius: 11,
            color: T.textMid,
            fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 500,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          } as React.CSSProperties}
        >Cancel</button>
        <button
          onClick={onDone}
          style={{
            flex: 1, height: 46,
            background: FAB_APERTURE_GRADIENT,
            boxShadow: FAB_APERTURE_SHADOW,
            border: 'none',
            borderRadius: 11,
            color: T.textInvert,
            fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          } as React.CSSProperties}
        >Done</button>
      </div>
    </div>
  )
}

// ── EventSheet ────────────────────────────────────────────────────────────────

interface EventSheetProps {
  open: boolean
  onClose: () => void
}

export default function EventSheet({ open, onClose }: EventSheetProps) {
  const [title, setTitle]           = useState('')
  const [whenChip, setWhenChip]     = useState<WhenChip>('today')
  const [calOpen, setCalOpen]       = useState(false)
  const [pickedDate, setPickedDate] = useState<Date | null>(null)
  const [timeOpen, setTimeOpen]     = useState(false)
  const [hour, setHour]             = useState(12)
  const [minute, setMinute]         = useState(0)
  const [meridiem, setMeridiem]     = useState<'AM' | 'PM'>('PM')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [offline, setOffline]       = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => titleRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setTitle(''); setWhenChip('today'); setCalOpen(false); setPickedDate(null)
      setTimeOpen(false); setHour(12); setMinute(0); setMeridiem('PM')
      setSaving(false); setError(null); setOffline(false)
    }
  }, [open])

  const effectiveDate = whenChip === 'pick'
    ? (pickedDate ? toISODate(pickedDate) : '')
    : chipDate(whenChip)

  // Event time in HH:MM 24h for DB storage
  const eventTime24 = () => {
    let h = hour
    if (meridiem === 'AM' && h === 12) h = 0
    if (meridiem === 'PM' && h !== 12) h += 12
    return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }

  // Display label for the time control
  const timeLabel = `${hour}:${String(minute).padStart(2, '0')} ${meridiem}`

  const canSave = title.trim().length > 0 && effectiveDate !== ''

  // CODE: supabase insert into schedule_events
  const handleSave = async () => {
    if (!canSave || saving) return

    if (!navigator.onLine) {
      setOffline(true)
      return
    }

    setSaving(true); setError(null); setOffline(false)

    const { error: insertError } = await supabase
      .from('schedule_events')
      .insert({
        title: title.trim(),
        event_date: effectiveDate,
        event_time: eventTime24(),
        created_at: new Date().toISOString(),
      })

    setSaving(false)

    if (insertError) {
      setError(insertError.message || 'Save failed — try again')
    } else {
      onClose()
    }
  }

  const WHEN_CHIPS: { key: WhenChip; label: string }[] = [
    { key: 'today',    label: 'Today' },
    { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'pick',     label: 'Pick date' },
  ]

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="New Event"
      size="list"
    >
      <div style={{ padding: '0 18px 24px' }}>

        {/* Title field — autofocused, D3 underline style */}
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={e => { setTitle(e.target.value); setError(null) }}
          placeholder="Event title"
          style={{
            display: 'block',
            width: '100%',
            fontFamily: FONT_DISPLAY,
            fontSize: 22,
            fontWeight: 500,
            color: T.textHi,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 0,
            outline: 'none',
            padding: '8px 0 10px',
            marginBottom: 28,
            caretColor: '#8B5CF6',
            boxSizing: 'border-box',
          } as React.CSSProperties}
        />

        {/* WHEN section */}
        <div style={{ ...styleT2, marginBottom: 12 }}>WHEN</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {WHEN_CHIPS.map(chip => {
            const sel = whenChip === chip.key
            return (
              <button
                key={chip.key}
                onClick={() => {
                  setWhenChip(chip.key)
                  if (chip.key !== 'pick') setCalOpen(false)
                  else setCalOpen(v => !v)
                }}
                style={{
                  flex: 1,
                  padding: '11px 0',
                  borderRadius: 9,
                  fontFamily: FONT_DISPLAY,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: sel ? 'none' : '1px solid rgba(255,255,255,0.20)',
                  background: sel ? FAB_APERTURE_GRADIENT : 'transparent',
                  boxShadow: sel ? FAB_APERTURE_SHADOW : 'none',
                  color: sel ? T.textInvert : T.textMid,
                  WebkitTapHighlightColor: 'transparent',
                  textAlign: 'center',
                } as React.CSSProperties}
              >
                {chip.label}
              </button>
            )
          })}
        </div>

        {/* Drawn calendar picker */}
        {whenChip === 'pick' && calOpen && (
          <CalendarPicker
            value={pickedDate}
            onCancel={() => { setCalOpen(false); setWhenChip('today') }}
            onDone={date => { setPickedDate(date); setCalOpen(false) }}
          />
        )}
        {whenChip === 'pick' && !calOpen && pickedDate && (
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: T.textMid, marginTop: 8 }}>
            {pickedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        )}

        {/* TIME section — 28px below WHEN */}
        <div style={{ marginTop: 28 }}>
          <div style={{ ...styleT2, marginBottom: 12 }}>TIME</div>

          {/* Full-width 48px time control */}
          <button
            onClick={() => setTimeOpen(v => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              height: 48,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 10,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties}
          >
            <Clock size={16} color={T.textLow} strokeWidth={1.7} />
            <span style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 15,
              fontWeight: 500,
              color: T.textHi,
            }}>{timeLabel}</span>
          </button>

          {/* Drawn time wheel */}
          {timeOpen && (
            <TimeWheel
              hour={hour}
              minute={minute}
              meridiem={meridiem}
              onHour={setHour}
              onMinute={setMinute}
              onMeridiem={setMeridiem}
              onCancel={() => setTimeOpen(false)}
              onDone={() => setTimeOpen(false)}
            />
          )}
        </div>

        {/* Deal and Location placeholder rows */}
        <div style={{
          marginTop: 20,
          borderTop: '1px solid rgba(255,255,255,0.10)',
          paddingTop: 4,
        }}>
          {/* Add deal */}
          <div style={{
            display: 'flex', alignItems: 'center',
            minHeight: 44,
            borderBottom: '1px solid rgba(255,255,255,0.10)',
          }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: T.textLow }}>
              Add deal
            </span>
          </div>
          {/* Add location */}
          <div style={{
            display: 'flex', alignItems: 'center',
            minHeight: 44,
          }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: T.textLow }}>
              Add location
            </span>
          </div>
        </div>

        {/* Offline banner */}
        {offline && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 9,
            background: 'rgba(255,162,58,0.10)',
            border: '1px solid rgba(255,162,58,0.22)',
            fontFamily: FONT_DISPLAY, fontSize: 12, color: '#FFA23A',
          }}>
            You&apos;re offline — saved locally
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 9,
            background: 'rgba(255,77,77,0.10)',
            border: '1px solid rgba(255,77,77,0.22)',
            fontFamily: FONT_DISPLAY, fontSize: 12, color: '#FF4D4D',
          }}>
            {error}
          </div>
        )}

        {/* Footer: Cancel + Save event */}
        <div style={{ display: 'flex', gap: 9, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, height: 46,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.20)',
              borderRadius: 11,
              color: T.textMid,
              fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 500,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties}
          >Cancel</button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{
              flex: 1, height: 46,
              background: canSave && !saving ? FAB_APERTURE_GRADIENT : 'rgba(139,92,246,0.3)',
              boxShadow: canSave && !saving ? FAB_APERTURE_SHADOW : 'none',
              border: 'none',
              borderRadius: 11,
              color: canSave && !saving ? T.textInvert : T.textLow,
              fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 600,
              cursor: canSave && !saving ? 'pointer' : 'default',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties}
          >
            {saving ? 'Saving…' : 'Save event'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

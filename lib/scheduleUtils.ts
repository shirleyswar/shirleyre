/**
 * scheduleUtils.ts — Shared schedule utilities
 *
 * Single source of truth for time parsing, formatting, and sorting.
 * Both Next48Panel and SchedulePanel import from here.
 * Do NOT duplicate these functions in either panel.
 */

/**
 * Converts any stored time value to "HH:MM" 24-hour format.
 *
 * Handles:
 *   "9:00 AM" / "2:30 PM"  — 12-hour with AM/PM
 *   "09:00" / "14:30"       — 24-hour
 *   "2026-04-23T09:00:00"   — ISO datetime (strips date prefix)
 *   null / ""               — returns "23:59" (sorts to end, never dropped)
 *
 * On parse failure, returns "23:59" so the row sorts last rather than
 * being silently discarded. Logs bad values to console.
 */
export function rawTo24h(t: string | null | undefined): string {
  if (!t) return '23:59'
  let s = t.trim()

  // Strip ISO date prefix e.g. "2026-04-23T09:00:00" → "09:00:00"
  if (s.includes('T')) s = s.split('T')[1] ?? s

  // 12-hour AM/PM format: "9:00 AM", "12:30 PM", "11:30 AM"
  const ampmMatch = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i)
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10)
    const min = ampmMatch[2]!
    const ap = ampmMatch[3]!.toUpperCase()
    if (ap === 'PM' && h !== 12) h += 12
    if (ap === 'AM' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${min}`
  }

  // 24-hour format: "09:00" or "09:00:45"
  const parts = s.split(':')
  const h = parseInt(parts[0] ?? '0', 10)
  const m = parseInt(parts[1] ?? '0', 10)
  if (isNaN(h) || isNaN(m)) {
    console.warn('[scheduleUtils] Unparseable time value — sorting to end:', t)
    return '23:59'
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Formats a stored time value for display: "9:00 AM", "2:30 PM", "".
 *
 * Returns "" for null/empty — callers skip the time badge entirely.
 * Never returns "NaN:NaN AM". Falls back to "" on bad data.
 */
export function formatEventTime(t: string | null | undefined): string {
  if (!t) return ''
  const trimmed = t.trim()

  // Already in display format — return as-is
  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(trimmed)) return trimmed

  const h24 = rawTo24h(t)

  // rawTo24h fell back to 23:59 on bad data that didn't actually say 23:5x
  if (h24 === '23:59' && !/^23:5[0-9]/.test(trimmed) && !trimmed.startsWith('23:5')) {
    // Real 11:59 PM is fine; anything else that triggered the fallback is bad data
    if (!/^(23:5[0-9]|11:5[0-9]\s*PM)/i.test(trimmed)) {
      console.warn('[scheduleUtils] formatEventTime fallback for bad data:', t)
      return ''
    }
  }

  const parts = h24.split(':')
  const h = parseInt(parts[0] ?? '0', 10)
  const m = parts[1] ?? '00'
  if (isNaN(h)) return ''
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${m} ${period}`
}

/** Minutes-since-midnight from a "HH:MM" 24h string. */
function toMinutes(h24: string): number {
  const parts = h24.split(':')
  const h = parseInt(parts[0] ?? '0', 10)
  const m = parseInt(parts[1] ?? '0', 10)
  return isNaN(h) || isNaN(m) ? 9999 : h * 60 + m
}

/**
 * Sorts schedule events by time, ascending.
 *
 * - Handles all time formats via rawTo24h — no duplicate sort logic.
 * - Events with no time sort to the end.
 * - Does not mutate the input array.
 */
export function sortEventsByTime<T extends { time?: string | null }>(events: T[]): T[] {
  return [...events].sort((a, b) => {
    const ta = a.time ?? null
    const tb = b.time ?? null
    if (!ta && !tb) return 0
    if (!ta) return 1
    if (!tb) return -1
    return toMinutes(rawTo24h(ta)) - toMinutes(rawTo24h(tb))
  })
}

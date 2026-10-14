'use client'

import { useEffect, useRef, useState } from 'react'
import { TASK_ARRIVE_MS, type ArrivingRow } from '@/lib/taskTags'

/**
 * Show the optimistic row until it has been on screen for one flash.
 * The clock starts on the render where the saved row exists and this list
 * is mounted, so a phone sheet that opens later still plays the line once.
 */
export function useArrivingRows<T extends ArrivingRow>(
  saved: T[],
  pending: T[],
  onConsume?: (ids: string[]) => void,
  /** False while the list is off screen. The flash clock waits for the first paint. */
  active = true,
): T[] {
  const seenUntil = useRef(new Map<string, number>())
  const [tick, setTick] = useState(0)
  const now = Date.now()

  const holding = pending.filter(p => {
    const onServer = saved.some(t => t.id === p.id)
    if (!onServer || !active) return true
    const key = p.clientKey ?? p.id
    let until = seenUntil.current.get(key)
    if (until == null) {
      until = now + TASK_ARRIVE_MS
      seenUntil.current.set(key, until)
    }
    return now < until
  })

  useEffect(() => {
    const waits = Array.from(seenUntil.current.values())
      .map(until => until - Date.now())
      .filter(wait => wait > 0)
    if (!waits.length) return
    const timer = window.setTimeout(() => setTick(n => n + 1), Math.min(...waits) + 40)
    return () => window.clearTimeout(timer)
  }, [pending, saved, tick])

  useEffect(() => {
    const now2 = Date.now()
    const done = pending.filter(p => {
      const onServer = saved.some(t => t.id === p.id)
      if (!onServer) return false
      const until = seenUntil.current.get(p.clientKey ?? p.id)
      return until != null && now2 >= until
    }).map(p => p.id)
    if (done.length && active) onConsume?.(done)
  }, [pending, saved, tick, onConsume, active])

  const holdIds = new Set(holding.map(p => p.id))
  return [...holding, ...saved.filter(t => !holdIds.has(t.id))]
}

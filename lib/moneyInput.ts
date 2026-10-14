/** Live dollar entry. Display is "$2,900,000". The stored value is a plain number. */

export const MONEY_ROUND_STEP = 5000

export function parseMoney(text: string): number | null {
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

export function formatMoney(amount: number): string {
  return '$' + Math.round(amount).toLocaleString('en-US')
}

/** Nearest $5,000. Halves round away from zero (2,500 → 5,000). */
export function roundToNearest5000(amount: number): number {
  return Math.round(amount / MONEY_ROUND_STEP) * MONEY_ROUND_STEP
}

export function commitMoney(text: string): { text: string; amount: number | null } {
  const n = parseMoney(text)
  if (n == null) return { text: '', amount: null }
  const rounded = roundToNearest5000(n)
  return { text: formatMoney(rounded), amount: rounded }
}

/**
 * Reformat an in-progress edit and put the caret back on the same digit.
 * `caret` is the selection start in `raw` (the value the browser just produced).
 */
export function applyMoneyEdit(raw: string, caret: number): { value: string; caret: number } {
  const slice = Math.max(0, Math.min(caret, raw.length))
  const digitsBefore = raw.slice(0, slice).replace(/\D/g, '').replace(/^0+(?=\d)/, '').length
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (!digits) return { value: '', caret: 0 }
  const value = formatMoney(Number(digits))
  if (digitsBefore <= 0) return { value, caret: value.startsWith('$') ? 1 : 0 }
  let seen = 0
  for (let i = 0; i < value.length; i++) {
    if (/\d/.test(value[i])) {
      seen++
      if (seen === digitsBefore) return { value, caret: i + 1 }
    }
  }
  return { value, caret: value.length }
}

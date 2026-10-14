'use client'

import React, { useLayoutEffect, useRef } from 'react'
import { applyMoneyEdit, commitMoney } from '@/lib/moneyInput'
import chrome from '@/components/warroom/taskItemChrome.module.css'

export default function MoneyAmountField({
  value,
  onChange,
  onBlurValue,
  style,
  autoFocus = false,
}: {
  value: string
  onChange: (value: string) => void
  /** Rounded display string after blur. */
  onBlurValue?: (value: string) => void
  style?: React.CSSProperties
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (caret.current == null || !ref.current) return
    const pos = caret.current
    ref.current.setSelectionRange(pos, pos)
    caret.current = null
  }, [value])

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      autoFocus={autoFocus}
      aria-label="Value"
      placeholder="$0"
      value={value}
      className={chrome.moneyHero}
      style={style}
      onChange={e => {
        const next = applyMoneyEdit(e.target.value, e.target.selectionStart ?? e.target.value.length)
        caret.current = next.caret
        onChange(next.value)
      }}
      onBlur={() => {
        const committed = commitMoney(value)
        onChange(committed.text)
        onBlurValue?.(committed.text)
      }}
    />
  )
}

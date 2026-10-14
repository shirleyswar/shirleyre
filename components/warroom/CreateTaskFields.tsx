'use client'

import React, { useLayoutEffect } from 'react'
import { TASK_ENTITIES, TASK_TAG_OPTIONS, type TaskTag } from '@/lib/taskTags'
import chrome from '@/components/warroom/taskItemChrome.module.css'

function prettyEntity(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b([a-z])/g, letter => letter.toUpperCase())
    .replace(/\bLlc\b/g, 'LLC')
}

export function createTagChipLabel(tag: TaskTag | null, entityName: string | null): string {
  if (tag === 'life') return 'Life'
  if (tag === 'sr') return 'SR'
  if (tag === 'entity') return entityName ? `Entity · ${prettyEntity(entityName)}` : 'Entity'
  return 'Tag'
}

export default function CreateTaskFields({
  title,
  onTitle,
  titleRef,
  dueLabel,
  dueOpen,
  onToggleDue,
  dueOptions,
  activeDue,
  onDue,
  picker,
  tag,
  entityName,
  tagOpen,
  onToggleTag,
  onTag,
  onEntity,
}: {
  title: string
  onTitle: (value: string) => void
  titleRef: React.RefObject<HTMLTextAreaElement | null>
  dueLabel: string
  dueOpen: boolean
  onToggleDue: () => void
  dueOptions: { label: string; value: string | 'pick' }[]
  activeDue: string | 'pick' | null
  onDue: (value: string | 'pick') => void
  picker?: React.ReactNode
  tag: TaskTag | null
  entityName: string | null
  tagOpen: boolean
  onToggleTag: () => void
  onTag: (tag: TaskTag) => void
  onEntity: (name: string) => void
}) {
  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [title, titleRef])

  const dueSet = dueLabel !== 'No due date'
  const optionStyle: React.CSSProperties = {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize: 13,
    fontWeight: 500,
  }
  const tagLabel = createTagChipLabel(tag, entityName)

  return (
    <div className={chrome.createFields}>
      <textarea
        ref={titleRef}
        value={title}
        onChange={e => onTitle(e.target.value)}
        placeholder="What needs to get done?"
        aria-label="Task title"
        rows={1}
        className={chrome.heroTitle}
      />

      <div className={chrome.metaRow}>
        <button
          type="button"
          className={`${chrome.metaChip}${dueOpen ? ` ${chrome.metaChipOn}` : ''}${dueSet ? ` ${chrome.metaChipSet}` : ''}`}
          aria-expanded={dueOpen}
          onClick={onToggleDue}
        >
          {!dueSet && <span aria-hidden="true">◷</span>}
          <span>{dueLabel}</span>
          <span className={chrome.metaCaret} aria-hidden="true">▾</span>
        </button>
        <button
          type="button"
          className={`${chrome.metaChip}${tagOpen ? ` ${chrome.metaChipOn}` : ''}${tag ? ` ${chrome.metaChipSet}` : ''}`}
          aria-expanded={tagOpen}
          onClick={onToggleTag}
        >
          {!tag && <span aria-hidden="true">#</span>}
          <span>{tagLabel}</span>
          <span className={chrome.metaCaret} aria-hidden="true">▾</span>
        </button>
      </div>

      {dueOpen && (
        <div className={chrome.inlineOptions} role="group" aria-label="Due">
          {dueOptions.map(option => {
            const on = activeDue === option.value
            return (
              <button
                key={option.label}
                type="button"
                className={on ? `${chrome.chip} ${chrome.chipOn}` : chrome.chip}
                style={optionStyle}
                aria-pressed={on}
                onClick={() => onDue(option.value)}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )}
      {dueOpen && picker}

      {tagOpen && (
        <div className={chrome.inlineOptions} role="group" aria-label="Tag">
          {TASK_TAG_OPTIONS.map(option => {
            const on = tag === option.key
            return (
              <button
                key={option.key}
                type="button"
                className={on ? `${chrome.chip} ${chrome.chipOn}` : chrome.chip}
                style={optionStyle}
                aria-pressed={on}
                onClick={() => onTag(option.key)}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )}
      {tagOpen && tag === 'entity' && (
        <div className={chrome.inlineOptions} role="group" aria-label="Entity">
          {TASK_ENTITIES.map(name => {
            const on = entityName === name
            return (
              <button
                key={name}
                type="button"
                className={on ? `${chrome.chip} ${chrome.chipOn}` : chrome.chip}
                style={optionStyle}
                aria-pressed={on}
                onClick={() => onEntity(name)}
              >
                {name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

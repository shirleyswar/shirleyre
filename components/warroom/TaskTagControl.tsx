'use client'

import React from 'react'
import { TASK_ENTITIES, TASK_TAG_OPTIONS, TaskTag } from '@/lib/taskTags'
import chrome from '@/components/warroom/taskItemChrome.module.css'

const FONT = "'Space Grotesk', system-ui, sans-serif"

export default function TaskTagControl({
  tag,
  entityName,
  onTag,
  onEntity,
  fill = false,
}: {
  tag: TaskTag | null
  entityName: string | null
  onTag: (tag: TaskTag) => void
  onEntity: (name: string) => void
  /** Stretch the three choices across the row. Create stays content-sized. */
  fill?: boolean
}) {
  return (
    <div>
      <div style={{
        display: 'flex',
        background: '#1E1D26',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.14)',
        padding: 4,
        gap: 4,
        width: fill ? '100%' : 'fit-content',
      }}>
        {TASK_TAG_OPTIONS.map(option => {
          const on = tag === option.key
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onTag(option.key)}
              aria-pressed={on}
              style={{
                flex: fill ? 1 : undefined,
                height: 36,
                padding: '0 16px',
                borderRadius: 8,
                border: 'none',
                background: on ? 'rgba(124,58,237,0.22)' : 'transparent',
                boxShadow: on ? 'inset 0 0 0 1px #8B5CF6' : 'none',
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 500,
                color: on ? '#EFEEF4' : '#B8B6C6',
                cursor: 'pointer',
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {tag === 'entity' && (
        <div
          role="group"
          aria-label="Entity"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}
        >
          {TASK_ENTITIES.map(name => {
            const on = entityName === name
            return (
              <button
                key={name}
                type="button"
                onClick={() => onEntity(name)}
                aria-pressed={on}
                className={on ? `${chrome.chip} ${chrome.chipOn}` : chrome.chip}
                style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500 }}
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

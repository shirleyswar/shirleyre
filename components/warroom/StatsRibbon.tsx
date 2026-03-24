'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Stats {
  totalPipeline: number
  activeDeals: number
  arOutstanding: number
  nextClosing: string | null
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export default function StatsRibbon({ inline = false }: { inline?: boolean }) {
  const [stats, setStats] = useState<Stats>({
    totalPipeline: 0,
    activeDeals: 0,
    arOutstanding: 0,
    nextClosing: null,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data: deals } = await supabase
          .from('deals')
          .select('status, value, commission_estimated, commission_collected')

        if (deals) {
          const active = deals.filter(d => !['closed', 'dead'].includes(d.status))
          const totalPipeline = active.reduce((sum, d) => sum + (d.commission_estimated || 0), 0)
          const activeDeals = active.length
          const arOutstanding = active
            .filter(d => d.status === 'pending_payment')
            .reduce((sum, d) => sum + ((d.commission_estimated || 0) - (d.commission_collected || 0)), 0)

          setStats({ totalPipeline, activeDeals, arOutstanding, nextClosing: null })
        }
      } catch {
        // DB not yet migrated — show zeroes
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 60_000)
    return () => clearInterval(interval)
  }, [])

  const items: { label: string; value: string; accentColor: string }[] = [
    {
      label: 'Total Pipeline',
      value: loading ? '—' : formatCurrency(stats.totalPipeline),
      accentColor: 'var(--accent-gold)',
    },
    {
      label: 'Open Deals',
      value: loading ? '—' : String(stats.activeDeals),
      accentColor: 'var(--success)',
    },
    {
      label: 'AR Outstanding',
      value: loading ? '—' : formatCurrency(stats.arOutstanding),
      accentColor: 'var(--accent-blue)',
    },
    {
      label: 'Next Closing',
      value: loading ? '—' : (stats.nextClosing || '—'),
      accentColor: 'var(--accent-violet)',
    },
  ]

  if (inline) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        flex: 1,
        minWidth: 0,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      } as React.CSSProperties}>
        {items.map((item, i) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 1,
              paddingLeft: i === 0 ? 0 : 14,
              paddingRight: 14,
              borderLeft: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--text-dim)', lineHeight: 1, whiteSpace: 'nowrap' }}>
              {item.label}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: item.accentColor, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="wr-ticker-strip">
      {items.map((item, i) => (
        <div
          key={item.label}
          className="wr-ticker-item"
          style={{ borderLeftColor: i === 0 ? 'transparent' : undefined }}
        >
          <div className="wr-ticker-label">{item.label}</div>
          <div
            className="wr-ticker-value"
            style={{ color: item.accentColor }}
          >
            {item.value}
          </div>
        </div>
      ))}

      {/* Right: live clock */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingRight: 20,
          paddingLeft: 20,
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          flexShrink: 0,
        }}
      >
        <LiveClock />
      </div>
    </div>
  )
}

function LiveClock() {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    function update() {
      const now = new Date()
      const t = now.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      const d = now.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
      setTime(t + ' CST')
      setDate(d)
    }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
        {date}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
        {time}
      </div>
    </div>
  )
}

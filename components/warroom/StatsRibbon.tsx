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

export default function StatsRibbon() {
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

          setStats({
            totalPipeline,
            activeDeals,
            arOutstanding,
            nextClosing: null, // TODO: pull from tasks table
          })
        }
      } catch (e) {
        // DB not yet migrated — show zeroes, no crash
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 60_000)
    return () => clearInterval(interval)
  }, [])

  const statItems = [
    {
      label: 'Total Pipeline',
      value: loading ? '—' : formatCurrency(stats.totalPipeline),
      color: 'var(--accent-gold)',
    },
    {
      label: 'Active Deals',
      value: loading ? '—' : String(stats.activeDeals),
      color: 'var(--success)',
    },
    {
      label: 'AR Outstanding',
      value: loading ? '—' : formatCurrency(stats.arOutstanding),
      color: '#60A5FA',
    },
    {
      label: 'Next Closing',
      value: loading ? '—' : (stats.nextClosing || '—'),
      color: 'var(--text-primary)',
    },
  ]

  return (
    <header
      style={{
        height: 56,
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 0,
        flexShrink: 0,
      }}
    >
      {/* War Room label */}
      <div style={{ marginRight: 24, flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          War Room
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', marginRight: 24 }} />

      {/* Stats */}
      <div style={{ display: 'flex', gap: 0, flex: 1, overflowX: 'auto' }}>
        {statItems.map((stat, i) => (
          <div
            key={stat.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              paddingRight: 24,
              flexShrink: 0,
            }}
          >
            {i > 0 && (
              <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', marginRight: 0 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: i > 0 ? 24 : 0 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1 }}>
                {stat.label}
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: stat.color, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
                {stat.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Right: timestamp */}
      <LiveClock />
    </header>
  )
}

function LiveClock() {
  const [time, setTime] = useState('')

  useEffect(() => {
    function update() {
      const now = new Date()
      const cst = now.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      setTime(cst + ' CST')
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
      {time}
    </div>
  )
}

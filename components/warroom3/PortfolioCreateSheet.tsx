'use client'

// §19 Portfolio creation — two-step flow.
// Step 1: deal select mode on the Deals list.
// Step 2: name sheet (short, pre-filled, focused).
// §19.4 acceptance checks: all eight.
// Nothing anywhere suggests creating a portfolio (§19.1 — creation is deliberate).
// This component is opened only by the explicit + PORTFOLIO pill in the Deals sheet header.

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { formatAddress } from '@/lib/formatAddress'
import BottomSheet from '@/components/warroom3/BottomSheet'
import { FAB_APERTURE_GRADIENT, FAB_APERTURE_SHADOW } from '@/lib/fabGradient'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  bgBase:    '#08080C',
  bgPanel:   '#12111B',
  bgRaise:   '#1E1D26',
  textHi:    '#EFEEF4',
  textMid:   '#B8B6C6',
  textLow:   '#8E8CA0',
  textInvert:'#0A0A0F',
  brand:     '#8B5CF6',
  brandLift: '#A78BFA',
  late:      '#FF4D4D',
  moneyIn:   '#34D399',
} as const

const styleT1: React.CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 500,
  letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textMid, lineHeight: 1,
}
const styleT2: React.CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500,
  letterSpacing: '0.19em', textTransform: 'uppercase', lineHeight: 1,
}
const styleT3: React.CSSProperties = {
  fontFamily: FONT_DISPLAY, fontSize: 14.5, fontWeight: 500, color: T.textHi, lineHeight: 1.25,
}
const styleT4: React.CSSProperties = {
  fontFamily: FONT_DISPLAY, fontSize: 11.5, fontWeight: 400, color: T.textMid, lineHeight: 1.5,
}
const styleB1: React.CSSProperties = {
  fontFamily: FONT_DISPLAY, fontSize: 12, fontWeight: 500, lineHeight: 1,
}

interface Deal {
  id: string
  name: string | null
  address: string | null
  status: string
  portfolio_id: string | null
  portfolio?: { name: string } | null
}

interface PortfolioCreateSheetProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

export default function PortfolioCreateSheet({ open, onClose, onCreated }: PortfolioCreateSheetProps) {
  const [step, setStep] = useState<'select' | 'name'>('select')
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [portfolioName, setPortfolioName] = useState('')
  const [saving, setSaving] = useState(false)
  const [multiClientError, setMultiClientError] = useState<string | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setStep('select')
      setSelected(new Set())
      setPortfolioName('')
      setMultiClientError(null)
      setSearchQ('')
      load()
    }
  }, [open])

  // Focus name field when step 2 opens
  useEffect(() => {
    if (step === 'name') {
      setTimeout(() => {
        if (nameRef.current) {
          nameRef.current.focus()
          // Cursor at end, nothing selected
          const len = nameRef.current.value.length
          nameRef.current.setSelectionRange(len, len)
        }
      }, 80)
    }
  }, [step])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('deals')
      .select('id, name, address, addr_display, addr_street_name, addr_number, addr_city, status, portfolio_id, portfolio:portfolio_id(name)')
      .order('address', { ascending: true })
      .limit(200)
    setDeals((data ?? []) as unknown as Deal[])
    setLoading(false)
  }

  const toggleSelect = useCallback((id: string, deal: Deal) => {
    if (deal.portfolio_id) return // already in a portfolio — inert
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const selectedDeals = deals.filter(d => selected.has(d.id))

  // Derive client from selected deals — use deal.name as proxy for client
  function deriveClient(): string {
    const names = Array.from(new Set(selectedDeals.map(d => d.name?.replace(/^📁\s*/, '') || '').filter(Boolean)))
    return names[0] || ''
  }

  function clientGroups(): string[] {
    return Array.from(new Set(selectedDeals.map(d => d.name?.replace(/^📁\s*/, '') || '').filter(Boolean)))
  }

  const visibleDeals = deals.filter(d => {
    if (!searchQ) return true
    const q = searchQ.toLowerCase()
    return (d.address || '').toLowerCase().includes(q) || (d.name || '').toLowerCase().includes(q)
  })

  function handleNext() {
    const groups = clientGroups()
    if (groups.length > 1) {
      setMultiClientError(`Selections span two clients: ${groups[0]} and ${groups[1]}. A portfolio belongs to one client.`)
      return
    }
    setMultiClientError(null)
    const client = deriveClient()
    setPortfolioName(client)
    setStep('name')
  }

  async function handleCreate() {
    if (!portfolioName.trim() || selected.size < 2) return
    setSaving(true)
    try {
      // Insert portfolio
      const { data: portfolio, error: pErr } = await supabase
        .from('portfolio')
        .insert({ name: portfolioName.trim() })
        .select('id')
        .single()
      if (pErr || !portfolio) { setSaving(false); return }

      // Update member deals
      await supabase
        .from('deals')
        .update({ portfolio_id: portfolio.id })
        .in('id', Array.from(selected))

      onCreated?.()
      onClose()
    } catch { /* silent */ }
    setSaving(false)
  }

  function removeMember(id: string) {
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  if (step === 'name') {
    const groups = clientGroups()
    const blocked = groups.length > 1
    return (
      <BottomSheet open={open} onClose={onClose} label="New Portfolio" size="short">
        <div style={{ padding: '0 18px 18px' }}>
          {/* Multi-client block banner */}
          {blocked && (
            <div style={{ background: 'rgba(255,77,77,0.09)', border: '1px solid rgba(255,77,77,0.4)', borderLeft: '3px solid #FF4D4D', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, fontFamily: FONT_DISPLAY, color: T.textMid }}>
              Selections span two clients: <strong style={{ color: T.textHi }}>{groups[0]}</strong> and <strong style={{ color: T.textHi }}>{groups[1]}</strong>. Remove one side to continue.
            </div>
          )}

          {/* Name field — pre-filled, focused, cursor at end §19.1 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...styleT2, color: T.textLow, marginBottom: 6 }}>PORTFOLIO NAME</div>
            <input
              ref={nameRef}
              value={portfolioName}
              onChange={e => setPortfolioName(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: T.bgRaise, border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 9, padding: '11px 14px',
                fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 500, color: T.textHi,
                outline: 'none',
              } as React.CSSProperties}
              onFocus={e => { e.target.style.border = '1px solid rgba(139,92,246,0.5)' }}
              onBlur={e => { e.target.style.border = '1px solid rgba(255,255,255,0.14)' }}
            />
            <div style={{ ...styleT4, color: T.textLow, marginTop: 4, fontSize: 11 }}>
              Defaults to the client's name. Change it if the group has its own.
            </div>
          </div>

          {/* CLIENT — derived, read-only */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...styleT2, color: T.textLow, marginBottom: 6 }}>CLIENT</div>
            <div style={{ background: T.bgRaise, borderRadius: 9, padding: '10px 14px', fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textMid }}>
              {deriveClient() || '—'}
              <div style={{ fontSize: 11, color: T.textLow, marginTop: 2 }}>From the deals you picked</div>
            </div>
          </div>

          {/* MEMBERS list */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ ...styleT2, color: T.textLow, marginBottom: 6 }}>MEMBERS {selected.size}</div>
            <div style={{ border: '1px solid rgba(255,255,255,0.14)', borderRadius: 9, overflow: 'hidden' }}>
              {selectedDeals.map((deal, idx) => {
                const addr = formatAddress(deal as any) || deal.name || '—'
                return (
                  <div key={deal.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: idx < selectedDeals.length - 1 ? '1px solid rgba(255,255,255,0.10)' : 'none' }}>
                    <span style={{ ...styleT4, color: T.textHi, fontSize: 13 }}>{addr}</span>
                    <button onClick={() => removeMember(deal.id)} style={{ background: 'none', border: 'none', color: T.textLow, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px' }}>×</button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', gap: 9 }}>
            <button
              onClick={handleCreate}
              disabled={!portfolioName.trim() || selected.size < 2 || blocked || saving}
              style={{
                flex: 1,
                background: portfolioName.trim() && selected.size >= 2 && !blocked && !saving ? FAB_APERTURE_GRADIENT : 'rgba(139,92,246,0.3)',
                boxShadow: portfolioName.trim() && selected.size >= 2 && !blocked && !saving ? FAB_APERTURE_SHADOW : 'none',
                color: T.textInvert, border: 'none',
                borderRadius: 9, padding: '12px 0', ...styleB1,
                opacity: !portfolioName.trim() || selected.size < 2 || blocked || saving ? 0.5 : 1,
                cursor: !portfolioName.trim() || selected.size < 2 || blocked || saving ? 'default' : 'pointer',
                minHeight: 44,
              } as React.CSSProperties}
            >
              {saving ? 'Creating…' : 'Create portfolio'}
            </button>
            <button
              onClick={() => setStep('select')}
              style={{ background: 'transparent', color: T.textMid, border: '1px solid rgba(255,255,255,0.20)', borderRadius: 9, padding: '12px 16px', ...styleB1, cursor: 'pointer', minHeight: 44 } as React.CSSProperties}
            >
              Back
            </button>
          </div>
        </div>
      </BottomSheet>
    )
  }

  // Step 1 — select
  return (
    <BottomSheet open={open} onClose={onClose} label="New Portfolio" size="list">
      <div style={{ padding: '0 0 104px' }}>
        {/* Instruction */}
        <div style={{ padding: '0 18px 10px', fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textLow }}>
          Pick the deals that belong to one client.
        </div>

        {/* Search */}
        <div style={{ padding: '0 18px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgRaise, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, padding: '10px 14px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLow} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textMid }} />
          </div>
        </div>

        {/* Multi-client warning */}
        {multiClientError && (
          <div style={{ margin: '0 18px 10px', background: 'rgba(255,77,77,0.09)', border: '1px solid rgba(255,77,77,0.4)', borderLeft: '3px solid #FF4D4D', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: FONT_DISPLAY, color: T.textMid }}>
            {multiClientError}
          </div>
        )}

        {/* Deal list in select mode */}
        {loading ? (
          <div style={{ padding: '24px 18px', textAlign: 'center', color: T.textLow, fontFamily: FONT_DISPLAY, fontSize: 13 }}>Loading…</div>
        ) : (
          <div>
            {visibleDeals.map(deal => {
              const isSelected = selected.has(deal.id)
              const inPortfolio = !!deal.portfolio_id
              const addr = formatAddress(deal as any) || deal.name || '—'
              const portfolioName2 = (deal.portfolio as any)?.name || null

              return (
                <div
                  key={deal.id}
                  onClick={() => toggleSelect(deal.id, deal)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 18px',
                    opacity: inPortfolio ? 0.4 : 1,
                    cursor: inPortfolio ? 'default' : 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.10)',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {/* Check circle — §19.1: filled brand when selected, empty outline otherwise */}
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: isSelected ? FAB_APERTURE_GRADIENT : 'transparent',
                    border: isSelected ? 'none' : '1.5px solid rgba(255,255,255,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title goes white when selected */}
                    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14.5, fontWeight: 500, color: isSelected ? '#FFFFFF' : T.textHi, lineHeight: 1.25 }}>{addr}</div>
                    {/* Portfolio name on meta line if already grouped */}
                    {portfolioName2 && <div style={{ fontFamily: FONT_DISPLAY, fontSize: 11.5, color: T.textLow, marginTop: 3 }}>In {portfolioName2}</div>}
                  </div>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: T.textLow, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{deal.status}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div style={{ position: 'fixed', bottom: 94, left: 0, right: 0, padding: '12px 18px', background: T.bgPanel, borderTop: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textMid }}>
          {selected.size > 0 ? `${selected.size} selected` : 'Select deals'}
        </span>
        {/* Next disabled below 2 selections §19.1 */}
        <button
          onClick={handleNext}
          disabled={selected.size < 2}
          style={{
            background: selected.size >= 2 ? FAB_APERTURE_GRADIENT : 'rgba(139,92,246,0.3)',
            boxShadow: selected.size >= 2 ? FAB_APERTURE_SHADOW : 'none',
            color: T.textInvert, border: 'none',
            borderRadius: 9, padding: '10px 20px', ...styleB1,
            opacity: selected.size < 2 ? 0.5 : 1,
            cursor: selected.size < 2 ? 'default' : 'pointer',
            minHeight: 44,
          } as React.CSSProperties}
        >
          Next
        </button>
      </div>
    </BottomSheet>
  )
}

'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  compareLeadRows,
  formatLeadDate,
  seriousLabel,
  type LeadSortDir,
  type LeadSortKey,
} from '@/lib/dealLeads'
import { formatDealTitle, type AddrFields } from '@/lib/formatAddress'

function propertyLabel(deal: AddrFields | null | undefined): string {
  if (!deal) return ''
  const title = formatDealTitle(deal)
  return title === '—' ? '' : title
}
import { loadAllLeads, type MasterLead } from '@/lib/dealLeadsApi'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  textHi: '#EFEEF4',
  textMid: '#B8B6C6',
  textLow: '#8E8CA0',
  brandLift: '#A78BFA',
  moneyIn: '#34D399',
  hot: '#FFA23A',
  late: '#FF4D4D',
  borderHair: 'rgba(255,255,255,0.10)',
}

function levelColor(level: string): string {
  if (level === 'offer_likely') return T.moneyIn
  if (level === 'hot') return T.hot
  return T.textMid
}

const HEADERS: { key: LeadSortKey | 'lead' | 'note'; label: string; sortable: boolean }[] = [
  { key: 'property', label: 'Property', sortable: true },
  { key: 'lead', label: 'Lead', sortable: false },
  { key: 'serious', label: 'Serious level', sortable: true },
  { key: 'date', label: 'Date', sortable: true },
  { key: 'note', label: 'Note', sortable: false },
]

export default function LeadsIndex({ variant }: { variant: 'desktop' | 'phone' }) {
  const [leads, setLeads] = useState<MasterLead[]>([])
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<LeadSortKey>('date')
  const [sortDir, setSortDir] = useState<LeadSortDir>('desc')

  useEffect(() => {
    let cancelled = false
    loadAllLeads().then(result => {
      if (cancelled) return
      setLeads(result.leads)
      setMissing(result.missing)
      setError(result.error)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const rows = useMemo(() => {
    const mapped = leads.map(lead => ({
      lead,
      property: propertyLabel(lead.deal),
    }))
    mapped.sort((a, b) => compareLeadRows(
      { property: a.property, serious_level: a.lead.serious_level, lead_date: a.lead.lead_date, created_at: a.lead.created_at },
      { property: b.property, serious_level: b.lead.serious_level, lead_date: b.lead.lead_date, created_at: b.lead.created_at },
      sortKey,
      sortDir,
    ))
    return mapped
  }, [leads, sortKey, sortDir])

  function onHeader(key: LeadSortKey) {
    if (sortKey === key) setSortDir(dir => dir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDir(key === 'property' ? 'asc' : 'desc')
    }
  }

  const dealBase = variant === 'phone' ? '/warroom3/deal/' : '/warroom/deal/'

  return (
    <div data-leads-index={variant} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{
        display: 'flex',
        gap: variant === 'phone' ? 14 : 0,
        padding: variant === 'phone' ? '8px 16px 0' : '0 28px',
        borderBottom: `1px solid ${T.borderHair}`,
        overflowX: 'auto',
      }}>
        {(variant === 'phone' ? HEADERS.filter(header => header.sortable) : HEADERS).map(header => {
          const active = header.sortable && sortKey === header.key
          const style: React.CSSProperties = {
            flex: variant === 'phone' ? '0 0 auto' : headerFlex(header.key),
            textAlign: 'left',
            background: 'none',
            border: 'none',
            borderBottom: active ? '2px solid #A78BFA' : '2px solid transparent',
            color: active ? T.textHi : T.textLow,
            fontFamily: FONT_MONO,
            fontSize: variant === 'phone' ? 12 : 11,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            padding: variant === 'phone' ? '12px 0' : '14px 12px',
            cursor: header.sortable ? 'pointer' : 'default',
            whiteSpace: 'nowrap',
          }
          if (!header.sortable) {
            return <div key={header.key} style={style}>{header.label}</div>
          }
          return (
            <button
              key={header.key}
              type="button"
              onClick={() => onHeader(header.key as LeadSortKey)}
              aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              style={style}
            >
              {header.label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: variant === 'phone' ? '0 16px 32px' : '0 28px 28px' }}>
        {loading ? <Status>Loading leads…</Status> : null}
        {!loading && missing ? <Status data-leads-setup="">Leads not set up yet.</Status> : null}
        {!loading && !missing && error ? <Status style={{ color: T.late }}>{error}</Status> : null}
        {!loading && !missing && !error && rows.length === 0 ? <Status data-leads-empty="">No leads yet.</Status> : null}
        {!loading && !missing && !error && rows.map(({ lead, property }) => (
          variant === 'phone' ? (
            <PhoneRow key={lead.id} lead={lead} property={property} href={`${dealBase}?id=${lead.deal_id}`} />
          ) : (
            <DesktopRow key={lead.id} lead={lead} property={property} href={`${dealBase}?id=${lead.deal_id}`} />
          )
        ))}
      </div>
    </div>
  )
}

function headerFlex(key: string): string {
  if (key === 'property') return '1.3 1 180px'
  if (key === 'lead') return '1.1 1 160px'
  if (key === 'note') return '1.6 1 200px'
  if (key === 'serious') return '0.8 1 120px'
  return '0.7 1 110px'
}

function Status({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} style={{ padding: '28px 4px', fontFamily: FONT_MONO, fontSize: 13, letterSpacing: '0.04em', color: T.textLow, ...(rest.style || {}) }}>
      {children}
    </div>
  )
}

function DesktopRow({ lead, property, href }: { lead: MasterLead; property: string; href: string }) {
  return (
    <div data-lead-row={lead.id} style={{
      display: 'flex',
      alignItems: 'start',
      borderBottom: `1px solid ${T.borderHair}`,
      padding: '12px 0',
      gap: 0,
    }}>
      <Cell flex={headerFlex('property')}>
        <a href={href} style={linkStyle}>{property}</a>
      </Cell>
      <Cell flex={headerFlex('lead')}>
        <div style={{ color: T.textHi }}>{lead.name}</div>
        {lead.company ? <div style={{ color: T.textLow, fontSize: 13, marginTop: 2 }}>{lead.company}</div> : null}
        {[lead.phone, lead.email].filter(Boolean).length > 0 ? (
          <div style={{ color: T.textLow, fontSize: 13, marginTop: 2 }}>{[lead.phone, lead.email].filter(Boolean).join(' · ')}</div>
        ) : null}
      </Cell>
      <Cell flex={headerFlex('serious')}>
        <span style={{ color: levelColor(lead.serious_level), fontFamily: FONT_MONO, fontSize: 12, letterSpacing: '0.04em' }}>
          {seriousLabel(lead.serious_level)}
        </span>
      </Cell>
      <Cell flex={headerFlex('date')}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.textMid }}>{formatLeadDate(lead.lead_date)}</span>
      </Cell>
      <Cell flex={headerFlex('note')}>
        <span style={{ color: T.textMid, whiteSpace: 'pre-wrap' }}>{lead.note ?? ''}</span>
      </Cell>
    </div>
  )
}

function Cell({ flex, children }: { flex: string; children: React.ReactNode }) {
  return (
    <div style={{ flex, minWidth: 0, padding: '0 12px', fontFamily: FONT_DISPLAY, fontSize: 15, lineHeight: 1.35, color: T.textHi }}>
      {children}
    </div>
  )
}

function PhoneRow({ lead, property, href }: { lead: MasterLead; property: string; href: string }) {
  const contact = [lead.company, lead.phone, lead.email].filter(Boolean).join(' · ')
  return (
    <div data-lead-row={lead.id} style={{ padding: '14px 0', borderBottom: `1px solid ${T.borderHair}` }}>
      <a href={href} style={{ ...linkStyle, fontSize: 16 }}>{property}</a>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 500, color: T.textHi, marginTop: 4 }}>{lead.name}</div>
      {contact ? <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textMid, marginTop: 2 }}>{contact}</div> : null}
      <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'baseline' }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: levelColor(lead.serious_level) }}>{seriousLabel(lead.serious_level)}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.textLow }}>{formatLeadDate(lead.lead_date)}</span>
      </div>
      {lead.note ? (
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: T.textMid, lineHeight: 1.4, marginTop: 6, whiteSpace: 'pre-wrap' }}>{lead.note}</div>
      ) : null}
    </div>
  )
}

const linkStyle: React.CSSProperties = {
  color: T.brandLift,
  textDecoration: 'none',
  fontFamily: FONT_DISPLAY,
  fontSize: 15,
  fontWeight: 500,
}

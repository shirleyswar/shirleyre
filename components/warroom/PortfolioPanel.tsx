'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Position {
  id: string
  upload_batch?: string
  sold_at?: string | null
  name: string | null
  symbol: string | null
  acquired: string | null
  period: string | null
  qty: number | null
  market_value: number | null
  total_cost: number | null
  unrealized_gl_pct: number | null
  unrealized_gl_dollar: number | null
  years_held: number | null
  annualized_return_pct: number | null
  ytd_pct: number | null
  rolling_12mo_pct: number | null
  rolling_36mo_pct: number | null
  last_price: number | null
  price_updated_at: string | null
  created_at: string
}

// Consolidated row for multi-lot tickers (portfolio tab only)
interface ConsolidatedRow {
  symbol: string
  name: string
  lots: Position[]
  qty: number
  market_value: number
  total_cost: number
  unrealized_gl_dollar: number
  unrealized_gl_pct: number
  annualized_return_pct: number | null
  period: string
}

type SortField = keyof Position | 'symbol_display'
type SortDir = 'asc' | 'desc'
type Tab = 'portfolio' | 'sleeve' | 'sold'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt$(n: number | null): string {
  if (n === null || n === undefined) return '—'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}
function fmtPct(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}
function fmtNum(n: number | null, dec = 2): string {
  if (n === null || n === undefined) return '—'
  return n.toFixed(dec)
}
function pctColor(n: number | null): string {
  if (n === null) return '#9ca3af'
  return n >= 0 ? '#22c55e' : '#ef4444'
}
function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const P = {
  purple:      '#a78bfa',
  purpleDim:   'rgba(139,92,246,0.5)',
  purpleFaint: 'rgba(139,92,246,0.08)',
  purpleBorder:'rgba(139,92,246,0.25)',
  text:        '#F0F2FF',
  muted:       '#6b7280',
  green:       '#22c55e',
  red:         '#ef4444',
  bgCard:      'rgba(15,13,30,0.85)',
  border:      'rgba(139,92,246,0.15)',
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────
function KpiCards({ positions, glLabel = 'Unrealized G/L' }: { positions: Position[]; glLabel?: string }) {
  const totalMV   = positions.reduce((s, p) => s + (p.market_value ?? 0), 0)
  const totalCost = positions.reduce((s, p) => s + (p.total_cost ?? 0), 0)
  const totalGL   = positions.reduce((s, p) => s + (p.unrealized_gl_dollar ?? 0), 0)
  const totalGLPct = totalCost > 0 ? (totalGL / totalCost) * 100 : 0
  const wtdAnn    = totalMV > 0
    ? positions.reduce((s, p) => s + ((p.annualized_return_pct ?? 0) * (p.market_value ?? 0)), 0) / totalMV
    : 0
  const uniqueSymbols = new Set(positions.map(p => p.symbol)).size
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
      {[
        { label: 'Market Value',  value: fmt$(totalMV),         sub: null,              color: P.purple },
        { label: 'Cost Basis',    value: fmt$(totalCost),        sub: null,              color: P.muted  },
        { label: glLabel,         value: fmt$(totalGL),          sub: fmtPct(totalGLPct),color: pctColor(totalGL) },
        { label: 'Ann. Return',   value: fmtPct(wtdAnn),         sub: 'weighted avg',    color: pctColor(wtdAnn) },
        { label: 'Positions',     value: String(uniqueSymbols),  sub: `${positions.length} lots`, color: P.purple },
      ].map(kpi => (
        <div key={kpi.label} style={{ background: P.bgCard, border: `1px solid ${P.border}`, borderRadius: 10, padding: '14px 16px', boxShadow: `0 0 0 1px ${P.purpleBorder} inset` }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: P.muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{kpi.label}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: kpi.color, letterSpacing: '-0.02em', fontFamily: 'monospace' }}>{kpi.value}</div>
          {kpi.sub && <div style={{ fontSize: 10, color: P.muted, marginTop: 2 }}>{kpi.sub}</div>}
        </div>
      ))}
    </div>
  )
}

// ─── Flat position table (Sleeve + Sold) ──────────────────────────────────────
function PositionTable({ positions, showSoldAt = false }: { positions: Position[]; showSoldAt?: boolean }) {
  const [sortField, setSortField] = useState<SortField>('market_value')
  const [sortDir, setSortDir]     = useState<SortDir>('desc')
  const [periodFilter, setPeriodFilter] = useState<'All' | 'Long' | 'Short'>('All')

  function handleSort(f: SortField) {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('desc') }
  }
  function arrow(f: SortField) {
    if (sortField !== f) return <span style={{ color: P.muted, fontSize: 9 }}>⇅</span>
    return <span style={{ color: P.purple, fontSize: 9 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  const filtered = positions.filter(p => periodFilter === 'All' || p.period === periodFilter)

  const sorted = [...filtered].sort((a, b) => {
    const f = sortField as string
    let av: number | string = 0, bv: number | string = 0
    if      (f === 'symbol')               { av = a.symbol ?? ''; bv = b.symbol ?? '' }
    else if (f === 'name')                 { av = a.name ?? ''; bv = b.name ?? '' }
    else if (f === 'market_value')         { av = a.market_value ?? -999; bv = b.market_value ?? -999 }
    else if (f === 'total_cost')           { av = a.total_cost ?? -999; bv = b.total_cost ?? -999 }
    else if (f === 'unrealized_gl_dollar') { av = a.unrealized_gl_dollar ?? -999; bv = b.unrealized_gl_dollar ?? -999 }
    else if (f === 'unrealized_gl_pct')    { av = a.unrealized_gl_pct ?? -999; bv = b.unrealized_gl_pct ?? -999 }
    else if (f === 'annualized_return_pct'){ av = a.annualized_return_pct ?? -999; bv = b.annualized_return_pct ?? -999 }
    else if (f === 'years_held')           { av = a.years_held ?? -999; bv = b.years_held ?? -999 }
    else if (f === 'period')               { av = a.period ?? ''; bv = b.period ?? '' }
    else if (f === 'ytd_pct')              { av = a.ytd_pct ?? -999; bv = b.ytd_pct ?? -999 }
    else if (f === 'rolling_12mo_pct')     { av = a.rolling_12mo_pct ?? -999; bv = b.rolling_12mo_pct ?? -999 }
    else if (f === 'rolling_36mo_pct')     { av = a.rolling_36mo_pct ?? -999; bv = b.rolling_36mo_pct ?? -999 }
    else if (f === 'acquired')             { av = a.acquired ?? ''; bv = b.acquired ?? '' }
    else if (f === 'sold_at')              { av = a.sold_at ?? ''; bv = b.sold_at ?? '' }
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  const cols: { label: string; field: SortField; cls?: string }[] = [
    { label: 'Symbol',   field: 'symbol' },
    { label: 'Acquired', field: 'acquired',             cls: 'hidden sm:table-cell' },
    { label: 'Yrs Held', field: 'years_held',           cls: 'hidden sm:table-cell' },
    { label: 'Period',   field: 'period',               cls: 'hidden sm:table-cell' },
    { label: 'Ann. Ret', field: 'annualized_return_pct' },
    { label: 'Mkt Value',field: 'market_value' },
    { label: 'G/L $',   field: 'unrealized_gl_dollar' },
    { label: 'G/L %',   field: 'unrealized_gl_pct' },
    { label: 'YTD',     field: 'ytd_pct',               cls: 'hidden sm:table-cell' },
    { label: '12mo',    field: 'rolling_12mo_pct',      cls: 'hidden sm:table-cell' },
    { label: '36mo',    field: 'rolling_36mo_pct',      cls: 'hidden sm:table-cell' },
    ...(showSoldAt ? [{ label: 'Date Sold', field: 'sold_at' as SortField }] : []),
  ]

  return (
    <>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {(['All', 'Long', 'Short'] as const).map(p => (
          <button key={p} onClick={() => setPeriodFilter(p)} style={{
            padding: '4px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            background: periodFilter === p ? P.purpleFaint : 'transparent',
            border: `1px solid ${periodFilter === p ? P.purpleDim : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 8, color: periodFilter === p ? P.purple : P.muted, cursor: 'pointer', fontFamily: 'inherit',
          }}>{p}</button>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${P.purpleBorder}`, background: P.purpleFaint }}>
              {cols.map(col => (
                <th key={col.label} className={col.cls ?? ''} onClick={() => handleSort(col.field)}
                  style={{ padding: '8px 8px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: 'rgba(167,139,250,0.8)', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                  {col.label} {arrow(col.field)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={cols.length} style={{ textAlign: 'center', padding: '32px 0', color: P.muted, fontSize: 13 }}>No positions.</td></tr>
            ) : sorted.map(p => (
              <tr key={p.id}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}>
                <td style={{ padding: '11px 8px', textAlign: 'center', fontWeight: 700, color: P.text, whiteSpace: 'nowrap' }}>{p.symbol}</td>
                <td className="hidden sm:table-cell" style={{ padding: '11px 8px', textAlign: 'center', color: P.muted, fontSize: 12 }}>{fmtDate(p.acquired)}</td>
                <td className="hidden sm:table-cell" style={{ padding: '11px 8px', textAlign: 'center', color: P.muted, fontFamily: 'monospace', fontSize: 12 }}>{fmtNum(p.years_held, 1)}</td>
                <td className="hidden sm:table-cell" style={{ padding: '11px 8px', textAlign: 'center' }}>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: p.period === 'Long' ? P.purpleFaint : 'rgba(251,191,36,0.1)', border: `1px solid ${p.period === 'Long' ? P.purpleBorder : 'rgba(251,191,36,0.3)'}`, color: p.period === 'Long' ? P.purple : '#fbbf24', fontWeight: 600 }}>{p.period}</span>
                </td>
                <td style={{ padding: '11px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(p.annualized_return_pct), fontWeight: 700 }}>{fmtPct(p.annualized_return_pct)}</td>
                <td style={{ padding: '11px 8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: P.text }}>{fmt$(p.market_value)}</td>
                <td style={{ padding: '11px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(p.unrealized_gl_dollar), fontWeight: 600 }}>{fmt$(p.unrealized_gl_dollar)}</td>
                <td style={{ padding: '11px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(p.unrealized_gl_pct), fontWeight: 600 }}>{fmtPct(p.unrealized_gl_pct)}</td>
                <td className="hidden sm:table-cell" style={{ padding: '11px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(p.ytd_pct) }}>{fmtPct(p.ytd_pct)}</td>
                <td className="hidden sm:table-cell" style={{ padding: '11px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(p.rolling_12mo_pct) }}>{fmtPct(p.rolling_12mo_pct)}</td>
                <td className="hidden sm:table-cell" style={{ padding: '11px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(p.rolling_36mo_pct) }}>{fmtPct(p.rolling_36mo_pct)}</td>
                {showSoldAt && <td style={{ padding: '11px 8px', textAlign: 'center', color: P.muted, fontSize: 12 }}>{fmtDate(p.sold_at ?? null)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── Upload helper ────────────────────────────────────────────────────────────
async function parseXlsx(file: File, colMap: Record<string, string>): Promise<Record<string, unknown>[] | string> {
  try {
    const XLSX = await import('xlsx')
    const buf  = await file.arrayBuffer()
    const wb   = XLSX.read(buf, { type: 'array', cellDates: true })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: null })

    const parseNum = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '') return null
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,%]/g, ''))
      return isNaN(n) ? null : n
    }
    const parseDate = (v: unknown): string | null => {
      if (!v) return null
      if (v instanceof Date) return v.toISOString().split('T')[0]
      if (typeof v === 'string') return v.split('T')[0]
      if (typeof v === 'number') {
        const d = (XLSX.SSF as unknown as { parse_date_code: (n: number) => { y: number; m: number; d: number } | null }).parse_date_code(v)
        if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
      }
      return null
    }

    const symKey = colMap['symbol']
    const rows = raw.filter(r => {
      const sym = r[symKey]
      if (!sym) return false
      if (typeof sym === 'number' && isNaN(sym)) return false
      if (typeof sym === 'string' && sym.trim() === '') return false
      return true
    })

    if (rows.length === 0) return 'No valid rows found — check Symbol/SYM column exists.'

    const pct = (v: unknown) => { const n = parseNum(v); return n !== null ? n * 100 : null }

    return rows.map(r => ({
      name:                  String(r[colMap['name']] ?? ''),
      symbol:                String(r[colMap['symbol']] ?? '').trim().toUpperCase(),
      acquired:              parseDate(r[colMap['acquired']]),
      period:                String(r[colMap['period']] ?? ''),
      qty:                   parseNum(r[colMap['qty']]),
      market_value:          parseNum(r[colMap['market_value']]),
      total_cost:            parseNum(r[colMap['total_cost']]),
      unrealized_gl_pct:     pct(r[colMap['unrealized_gl_pct']]),
      unrealized_gl_dollar:  parseNum(r[colMap['unrealized_gl_dollar']]),
      years_held:            parseNum(r[colMap['years_held']]),
      annualized_return_pct: pct(r[colMap['annualized_return_pct']]),
      ytd_pct:               null,
      rolling_12mo_pct:      null,
      rolling_36mo_pct:      null,
      last_price:            null,
      price_updated_at:      null,
    }))
  } catch (e: unknown) {
    return 'Parse error: ' + (e instanceof Error ? e.message : String(e))
  }
}

const PORTFOLIO_COL_MAP: Record<string, string> = {
  name: 'Name', symbol: 'Symbol', acquired: 'Acquired', period: 'Period',
  qty: 'Qty', market_value: 'Market Value', total_cost: 'Total Cost',
  unrealized_gl_pct: 'Unrealized G/L %', unrealized_gl_dollar: 'Unrealized G/L $',
  years_held: 'Years Held', annualized_return_pct: 'Annualized Return %',
}
const SLEEVE_COL_MAP: Record<string, string> = {
  name: 'NAME', symbol: 'SYM', acquired: 'ACQUIRED', period: 'PERIOD',
  qty: 'QTY', market_value: 'MKT VALUE', total_cost: 'COST BASIS',
  unrealized_gl_pct: 'UNRL G/L %', unrealized_gl_dollar: 'UNRL G/L $',
  years_held: 'YRS HELD', annualized_return_pct: 'ANN. RETURN',
}

// ─── Sleeve Table v2 (Symbol, Name, Qty, Mkt Value, Cost Basis, G/L $, G/L %, Ann. Return) ──
function SleeveTable({ positions }: { positions: Position[] }) {
  type SF = 'symbol' | 'name' | 'qty' | 'market_value' | 'total_cost' | 'unrealized_gl_dollar' | 'unrealized_gl_pct' | 'annualized_return_pct'
  const [sortField, setSortField] = useState<SF>('market_value')
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc')

  function handleSort(f: SF) {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('desc') }
  }
  function arrow(f: SF) {
    if (sortField !== f) return <span style={{ color: P.muted, fontSize: 9 }}>⇅</span>
    return <span style={{ color: P.purple, fontSize: 9 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  const sorted = [...positions].sort((a, b) => {
    let av: number | string = 0, bv: number | string = 0
    if      (sortField === 'symbol')                { av = a.symbol ?? ''; bv = b.symbol ?? '' }
    else if (sortField === 'name')                  { av = a.name ?? ''; bv = b.name ?? '' }
    else if (sortField === 'qty')                   { av = a.qty ?? -999; bv = b.qty ?? -999 }
    else if (sortField === 'market_value')          { av = a.market_value ?? -999; bv = b.market_value ?? -999 }
    else if (sortField === 'total_cost')            { av = a.total_cost ?? -999; bv = b.total_cost ?? -999 }
    else if (sortField === 'unrealized_gl_dollar')  { av = a.unrealized_gl_dollar ?? -999; bv = b.unrealized_gl_dollar ?? -999 }
    else if (sortField === 'unrealized_gl_pct')     { av = a.unrealized_gl_pct ?? -999; bv = b.unrealized_gl_pct ?? -999 }
    else if (sortField === 'annualized_return_pct') { av = a.annualized_return_pct ?? -999; bv = b.annualized_return_pct ?? -999 }
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  const cols: { label: string; field: SF }[] = [
    { label: 'Symbol',      field: 'symbol'                },
    { label: 'Name',        field: 'name'                  },
    { label: 'Qty',         field: 'qty'                   },
    { label: 'Mkt Value',   field: 'market_value'          },
    { label: 'Cost Basis',  field: 'total_cost'            },
    { label: 'G/L $',       field: 'unrealized_gl_dollar'  },
    { label: 'G/L %',       field: 'unrealized_gl_pct'     },
    { label: 'Ann. Return', field: 'annualized_return_pct' },
  ]

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${P.purpleBorder}`, background: P.purpleFaint }}>
            {cols.map(col => (
              <th key={col.field} onClick={() => handleSort(col.field)}
                style={{ padding: '8px 10px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: 'rgba(167,139,250,0.8)', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                {col.label} {arrow(col.field)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px 0', color: P.muted, fontSize: 13 }}>No positions.</td></tr>
          ) : sorted.map(p => (
            <tr key={p.id}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}>
              <td style={{ padding: '11px 10px', textAlign: 'center', fontWeight: 700, color: P.text, whiteSpace: 'nowrap' }}>{p.symbol}</td>
              <td style={{ padding: '11px 10px', textAlign: 'left', color: P.muted, fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || '—'}</td>
              <td style={{ padding: '11px 10px', textAlign: 'center', fontFamily: 'monospace', color: P.muted, fontSize: 12 }}>{fmtNum(p.qty, 0)}</td>
              <td style={{ padding: '11px 10px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: P.text }}>{fmt$(p.market_value)}</td>
              <td style={{ padding: '11px 10px', textAlign: 'center', fontFamily: 'monospace', color: P.muted }}>{fmt$(p.total_cost)}</td>
              <td style={{ padding: '11px 10px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(p.unrealized_gl_dollar), fontWeight: 600 }}>{fmt$(p.unrealized_gl_dollar)}</td>
              <td style={{ padding: '11px 10px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(p.unrealized_gl_pct), fontWeight: 600 }}>{fmtPct(p.unrealized_gl_pct)}</td>
              <td style={{ padding: '11px 10px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(p.annualized_return_pct), fontWeight: 700 }}>{fmtPct(p.annualized_return_pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Sleeve Tab ───────────────────────────────────────────────────────────────
function SleeveTab() {
  const [positions, setPositions]     = useState<Position[]>([])
  const [loading, setLoading]         = useState(true)
  const [uploading, setUploading]     = useState(false)
  const [uploadMsg, setUploadMsg]     = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver]       = useState(false)
  const [refreshing, setRefreshing]   = useState(false)
  const [refreshMsg, setRefreshMsg]   = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchSleeve() }, [])
  useEffect(() => {
    const dates = positions.map(p => p.price_updated_at).filter(Boolean) as string[]
    if (dates.length > 0) setLastRefreshed(dates.sort().reverse()[0])
  }, [positions])

  async function fetchSleeve() {
    try {
      const { data, error } = await supabase.from('sleeve_positions').select('*').order('market_value', { ascending: false }).limit(200)
      if (error?.code === '42P01') { setLoading(false); return }
      if (data) setPositions(data as Position[])
    } catch {}
    finally { setLoading(false) }
  }

  function cacheAge(): { fresh: boolean; label: string } {
    if (!lastRefreshed) return { fresh: false, label: '' }
    const hrs = (Date.now() - new Date(lastRefreshed).getTime()) / (1000 * 60 * 60)
    if (hrs < 24) return { fresh: true, label: `Updated ${hrs < 1 ? 'recently' : Math.floor(hrs) + 'h ago'} — next in ${Math.ceil(24 - hrs)}h` }
    return { fresh: false, label: '' }
  }

  async function refreshPrices() {
    setRefreshing(true); setRefreshMsg(null)
    try {
      const SUPABASE_URL = 'https://mtkyyaorvensylrfbhxv.supabase.co'
      const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a3l5YW9ydmVuc3lscmZiaHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTU0OTUsImV4cCI6MjA4ODc3MTQ5NX0.YqyuBjymYf26cA6JF534NVmsTmdMv7ohB1LBCmdsaJA'
      const res  = await fetch(`${SUPABASE_URL}/functions/v1/refresh-portfolio-prices`, { method: 'POST', headers: { 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }) })
      const text = await res.text()
      let json: Record<string, unknown> = {}
      try { json = JSON.parse(text) } catch { setRefreshMsg(`Error: ${res.status} — ${text.slice(0,200)}`); setRefreshing(false); return }
      if (!res.ok) { setRefreshMsg(`Error ${res.status}: ${json.error || json.message || text.slice(0,200)}`) }
      else if (json.cached) { setRefreshMsg(`Prices current as of ${json.lastUpdated}.${json.nextRefreshIn ? ` Next in ${json.nextRefreshIn}.` : ''}`) }
      else { const errs = Array.isArray(json.errors) ? json.errors : []; setRefreshMsg(`✓ Updated ${json.updated} tickers${errs.length ? ` (${errs.length} skipped)` : ''}`); await fetchSleeve() }
    } catch (e: unknown) { setRefreshMsg('Error: ' + (e instanceof Error ? e.message : String(e))) }
    setRefreshing(false)
  }

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) { setUploadError('Please upload an .xlsx file.'); return }
    setUploading(true); setUploadMsg(null); setUploadError(null)

    const rows = await parseXlsx(file, SLEEVE_COL_MAP)
    if (typeof rows === 'string') { setUploadError(rows); setUploading(false); return }

    const batch = new Date().toISOString()
    const typedRows = rows as Record<string, unknown>[]
    const newSymbols  = Array.from(new Set(typedRows.map(r => String(r['symbol']))))
    const prevSymbols = Array.from(new Set(positions.map(p => p.symbol ?? '').filter(Boolean)))
    const newSet  = new Set(newSymbols)
    const prevSet = new Set(prevSymbols)

    const toAdd    = newSymbols.filter(s => !prevSet.has(s))
    const toUpdate = newSymbols.filter(s => prevSet.has(s))
    const toRemove = prevSymbols.filter(s => !newSet.has(s) && s !== '')

    // Move removed symbols to sold_positions
    if (toRemove.length > 0) {
      const soldRows = positions.filter(p => toRemove.includes(p.symbol ?? ''))
      const soldInserts = soldRows.map(({ id: _id, upload_batch: _ub, price_updated_at: _pa, ...rest }) => ({
        ...rest,
        sold_at: new Date().toISOString(),
      }))
      if (soldInserts.length > 0) await supabase.from('sold_positions').insert(soldInserts)
      // Remove from sleeve
      await supabase.from('sleeve_positions').delete().in('symbol', toRemove)
      // Remove from portfolio_positions
      await supabase.from('portfolio_positions').delete().in('symbol', toRemove)
    }

    // Upsert sleeve rows
    const allRows: Record<string, unknown>[] = typedRows.map(r => ({ ...r, upload_batch: batch }))

    // Delete all current sleeve rows then re-insert (simplest upsert)
    await supabase.from('sleeve_positions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    for (let i = 0; i < allRows.length; i += 50) {
      const { error } = await supabase.from('sleeve_positions').insert(allRows.slice(i, i + 50))
      if (error) { setUploadError('Insert failed: ' + error.message); setUploading(false); return }
    }

    // NEW symbols: also write to portfolio_positions
    if (toAdd.length > 0) {
      const newRows = allRows.filter(r => toAdd.includes(String(r['symbol']))).map(r => ({ ...r, upload_batch: batch }))
      for (let i = 0; i < newRows.length; i += 50) {
        await supabase.from('portfolio_positions').insert(newRows.slice(i, i + 50))
      }
    }

    // EXISTING symbols: update portfolio_positions
    if (toUpdate.length > 0) {
      for (const sym of toUpdate) {
        const row = allRows.find(r => r['symbol'] === sym)
        if (row) {
          const { upload_batch: _ub, ...updateData } = row as Record<string, unknown> & { upload_batch: string }
          await supabase.from('portfolio_positions').update(updateData).eq('symbol', sym)
        }
      }
    }

    setUploadMsg(`✓ ${allRows.length} positions loaded${toAdd.length ? ` (${toAdd.length} new → also added to Portfolio)` : ''}${toRemove.length ? ` · ${toRemove.length} removed → moved to Sold` : ''}`)
    await fetchSleeve()
    setUploading(false)
  }, [positions])

  if (loading) return <SkeletonTable />

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: P.purple, letterSpacing: '0.08em', textTransform: 'uppercase', textShadow: `0 0 20px rgba(139,92,246,0.4)` }}>SLEEVE</span>
        <span style={{ fontSize: 11, color: P.muted }}>Matthew&apos;s directed buys</span>
        <div style={{ flex: 1 }} />
        {positions.length > 0 && (
          <button onClick={refreshPrices} disabled={refreshing} title={cacheAge().label || 'Refresh prices from Yahoo'}
            style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 8, color: P.green, cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.5 : 1, whiteSpace: 'nowrap' }}>
            {refreshing ? '⟳ Refreshing…' : `⟳ Refresh Prices${cacheAge().fresh ? ` (${cacheAge().label})` : ''}`}
          </button>
        )}
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, background: P.purpleFaint, border: `1px solid ${P.purpleBorder}`, borderRadius: 8, color: P.purple, cursor: 'pointer', opacity: uploading ? 0.5 : 1 }}>
          {uploading ? 'Loading…' : '↑ Upload Sleeve .xlsx'}
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} style={{ display: 'none' }} />
      </div>

      {refreshMsg  && <div style={{ marginBottom: 12, fontSize: 12, color: refreshMsg.startsWith('Error') ? P.red : P.green, fontFamily: 'monospace' }}>{refreshMsg}</div>}
      {uploadMsg   && <div style={{ marginBottom: 12, fontSize: 12, color: P.green, fontFamily: 'monospace' }}>{uploadMsg}</div>}
      {uploadError && <div style={{ marginBottom: 12, fontSize: 12, color: P.red,   fontFamily: 'monospace' }}>{uploadError}</div>}

      {positions.length === 0 ? (
        <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onClick={() => fileInputRef.current?.click()}
          style={{ border: `2px dashed ${dragOver ? P.purple : P.purpleBorder}`, borderRadius: 12, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', background: dragOver ? P.purpleFaint : 'transparent', transition: 'all 0.15s', marginBottom: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>📊</div>
          <div style={{ fontSize: 13, color: P.text, fontWeight: 600, marginBottom: 6 }}>Drop your Sleeve .xlsx here</div>
          <div style={{ fontSize: 12, color: P.muted }}>Expected columns: NAME, SYM, ACQUIRED, PERIOD, QTY, MKT VALUE, COST BASIS, UNRL G/L %, UNRL G/L $, YRS HELD, ANN. RETURN</div>
        </div>
      ) : (
        <>
          <KpiCards positions={positions} />
          <SleeveTable positions={positions} />
        </>
      )}
    </div>
  )
}

// ─── Sold Tab ─────────────────────────────────────────────────────────────────
// Accepts Morgan Stanley activity export (wipe-and-replace seed upload)
// Expected headers (Row 3): Activity Date, Transaction Date, Activity,
//   Description, Symbol, Cusip, Memo, Tags, Quantity, Price($), Amount($)
// Rows above row 3 are title/blank. Rows with no Symbol are footer boilerplate.

async function parseSoldXlsx(file: File): Promise<Record<string, unknown>[] | string> {
  try {
    const XLSX = await import('xlsx')
    const buf  = await file.arrayBuffer()
    const wb   = XLSX.read(buf, { type: 'array', cellDates: true })
    const ws   = wb.Sheets[wb.SheetNames[0]]

    // Find the header row — search first 10 rows for 'Symbol'
    const raw: Record<string, unknown>[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as Record<string, unknown>[][]
    let headerRowIdx = -1
    for (let i = 0; i < Math.min(raw.length, 10); i++) {
      const row = raw[i] as unknown[]
      if (row.some(cell => typeof cell === 'string' && cell.trim() === 'Symbol')) {
        headerRowIdx = i
        break
      }
    }
    if (headerRowIdx === -1) return 'Could not find header row with "Symbol" column.'

    const headers = (raw[headerRowIdx] as unknown as unknown[]).map(h => String(h ?? '').trim())
    const colIdx = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase())

    const iActivity  = colIdx('Activity Date')
    const iSymbol    = colIdx('Symbol')
    const iDesc      = colIdx('Description')
    const iQty       = colIdx('Quantity')
    const iPrice     = colIdx('Price($)')
    const iAmount    = colIdx('Amount($)')
    const iActivity2 = colIdx('Activity') // to filter for "Sold" rows only

    if (iSymbol === -1) return 'Symbol column not found in header row.'
    if (iAmount === -1) return 'Amount($) column not found.'

    const parseNum = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '') return null
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,%]/g, ''))
      return isNaN(n) ? null : n
    }

    const parseDate = (v: unknown): string | null => {
      if (!v) return null
      if (v instanceof Date) return v.toISOString().split('T')[0]
      if (typeof v === 'string') {
        // Handle MM/DD/YYYY format
        const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
        if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`
        return v.split('T')[0]
      }
      return null
    }

    const rows: Record<string, unknown>[] = []
    for (let i = headerRowIdx + 1; i < raw.length; i++) {
      const row = raw[i] as unknown[]
      const sym = row[iSymbol]
      if (!sym || typeof sym !== 'string' || sym.trim() === '') continue // skip footer/blank rows

      // Only include "Sold" activity rows if Activity column exists
      if (iActivity2 !== -1) {
        const act = String(row[iActivity2] ?? '').trim().toLowerCase()
        if (act && act !== 'sold') continue
      }

      // Extract clean name from Description (first line only)
      const rawDesc = String(row[iDesc] ?? '')
      const name = rawDesc.split('\n')[0].trim() || sym.trim().toUpperCase()

      const soldDate = iActivity !== -1 ? parseDate(row[iActivity]) : null
      const qty      = iQty !== -1     ? parseNum(row[iQty])     : null
      const price    = iPrice !== -1   ? parseNum(row[iPrice])   : null
      const amount   = parseNum(row[iAmount])

      rows.push({
        upload_batch:         new Date().toISOString(),
        symbol:               sym.trim().toUpperCase(),
        name,
        qty,
        market_value:         amount,       // proceeds at sale
        total_cost:           null,         // not in this export
        last_price:           price,        // sale price per share
        unrealized_gl_dollar: null,
        unrealized_gl_pct:    null,
        annualized_return_pct:null,
        ytd_pct:              null,
        rolling_12mo_pct:     null,
        rolling_36mo_pct:     null,
        acquired:             null,
        period:               null,
        years_held:           null,
        price_updated_at:     null,
        sold_at:              soldDate ? new Date(soldDate + 'T00:00:00').toISOString() : new Date().toISOString(),
      })
    }

    if (rows.length === 0) return 'No valid sold rows found. Check that the file contains "Sold" activity rows with a Symbol.'
    return rows
  } catch (e: unknown) {
    return 'Parse error: ' + (e instanceof Error ? e.message : String(e))
  }
}

// ─── Sold KPI Cards ──────────────────────────────────────────────────────────
function SoldKpiCards({ positions }: { positions: Position[] }) {
  const totalProceeds = positions.reduce((s, p) => s + (p.market_value ?? 0), 0)
  const totalCost     = positions.reduce((s, p) => s + (p.total_cost ?? 0), 0)
  const totalGL       = positions.reduce((s, p) => {
    const gl = (p.market_value ?? 0) - (p.total_cost ?? 0)
    return s + (p.total_cost != null ? gl : 0)
  }, 0)
  const totalGLPct    = totalCost > 0 ? (totalGL / totalCost) * 100 : 0
  const positionsWithCost = positions.filter(p => p.total_cost != null)
  const winners       = positionsWithCost.filter(p => (p.market_value ?? 0) > (p.total_cost ?? 0))
  const winRate       = positionsWithCost.length > 0 ? (winners.length / positionsWithCost.length) * 100 : null
  const mvForAnn      = positionsWithCost.reduce((s, p) => s + (p.market_value ?? 0), 0)
  const wtdAnn        = mvForAnn > 0
    ? positionsWithCost.reduce((s, p) => s + ((p.annualized_return_pct ?? 0) * (p.market_value ?? 0)), 0) / mvForAnn
    : null

  const kpis = [
    {
      label: 'Win Rate',
      value: winRate != null ? `${winRate.toFixed(0)}%` : '—',
      sub: `${winners.length}/${positionsWithCost.length} trades`,
      color: winRate != null ? (winRate >= 50 ? P.green : P.red) : P.muted,
      big: true,
    },
    { label: 'Realized G/L',  value: fmt$(totalGL),            sub: fmtPct(totalGLPct), color: pctColor(totalGL) },
    { label: 'Total Proceeds', value: fmt$(totalProceeds),      sub: null, color: P.purple },
    { label: 'Total Cost',     value: totalCost > 0 ? fmt$(totalCost) : '—', sub: null, color: P.muted },
    { label: 'Avg Ann. Return', value: wtdAnn != null ? fmtPct(wtdAnn) : '—', sub: 'weighted', color: pctColor(wtdAnn) },
    { label: 'Positions',      value: String(positions.length), sub: `${positionsWithCost.length} w/ cost basis`, color: P.purple },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
      {kpis.map(k => (
        <div key={k.label} style={{
          background: P.bgCard, border: `1px solid ${P.border}`, borderRadius: 10,
          padding: '14px 16px',
          boxShadow: k.big ? `0 0 0 1px ${P.purpleBorder} inset, 0 0 20px rgba(34,197,94,0.05)` : `0 0 0 1px ${P.purpleBorder} inset`,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: P.muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
          <div style={{ fontSize: k.big ? 28 : 20, fontWeight: 800, color: k.color, letterSpacing: '-0.02em', fontFamily: 'monospace', lineHeight: 1 }}>{k.value}</div>
          {k.sub && <div style={{ fontSize: 10, color: P.muted, marginTop: 3 }}>{k.sub}</div>}
        </div>
      ))}
    </div>
  )
}

// ─── Sold Table ───────────────────────────────────────────────────────────────
function SoldTable({ positions, onCostUpdate }: { positions: Position[]; onCostUpdate: (id: string, cost: number) => void }) {
  type SF = 'symbol' | 'name' | 'acquired' | 'sold_at' | 'qty' | 'market_value' | 'total_cost' | 'gl_dollar' | 'gl_pct' | 'years_held' | 'annualized_return_pct'
  const [sortField, setSortField] = useState<SF>('sold_at')
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc')
  const [editingCost, setEditingCost] = useState<string | null>(null)
  const [costDraft, setCostDraft]     = useState('')

  function handleSort(f: SF) {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('desc') }
  }
  function arrow(f: SF) {
    if (sortField !== f) return <span style={{ color: P.muted, fontSize: 9 }}>⇅</span>
    return <span style={{ color: P.purple, fontSize: 9 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  function glDollar(p: Position): number | null {
    if (p.market_value == null || p.total_cost == null) return null
    return p.market_value - p.total_cost
  }
  function glPct(p: Position): number | null {
    if (p.market_value == null || p.total_cost == null || p.total_cost === 0) return null
    return ((p.market_value - p.total_cost) / p.total_cost) * 100
  }

  const sorted = [...positions].sort((a, b) => {
    let av: number | string = 0, bv: number | string = 0
    if      (sortField === 'symbol')               { av = a.symbol ?? ''; bv = b.symbol ?? '' }
    else if (sortField === 'name')                 { av = a.name ?? ''; bv = b.name ?? '' }
    else if (sortField === 'acquired')             { av = a.acquired ?? ''; bv = b.acquired ?? '' }
    else if (sortField === 'sold_at')              { av = a.sold_at ?? ''; bv = b.sold_at ?? '' }
    else if (sortField === 'qty')                  { av = a.qty ?? -999; bv = b.qty ?? -999 }
    else if (sortField === 'market_value')         { av = a.market_value ?? -999; bv = b.market_value ?? -999 }
    else if (sortField === 'total_cost')           { av = a.total_cost ?? -999; bv = b.total_cost ?? -999 }
    else if (sortField === 'gl_dollar')            { av = glDollar(a) ?? -999; bv = glDollar(b) ?? -999 }
    else if (sortField === 'gl_pct')               { av = glPct(a) ?? -999; bv = glPct(b) ?? -999 }
    else if (sortField === 'years_held')           { av = a.years_held ?? -999; bv = b.years_held ?? -999 }
    else if (sortField === 'annualized_return_pct'){ av = a.annualized_return_pct ?? -999; bv = b.annualized_return_pct ?? -999 }
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  function fmtDate(s: string | null | undefined) {
    if (!s) return '—'
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  }

  const cols: { label: string; field: SF; tip?: string }[] = [
    { label: 'Symbol',       field: 'symbol' },
    { label: 'Name',         field: 'name' },
    { label: 'Acquired',     field: 'acquired' },
    { label: 'Sold',         field: 'sold_at' },
    { label: 'Qty',          field: 'qty' },
    { label: 'Cost Basis',   field: 'total_cost', tip: 'Click — to enter cost basis' },
    { label: 'Proceeds',     field: 'market_value' },
    { label: 'G/L $',        field: 'gl_dollar' },
    { label: 'G/L %',        field: 'gl_pct' },
    { label: 'Yrs Held',     field: 'years_held' },
    { label: 'Ann. Return',  field: 'annualized_return_pct' },
  ]

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ fontSize: 11, color: P.muted, marginBottom: 8, fontStyle: 'italic' }}>
        Cost Basis missing? Click the — in that column to enter it manually.
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${P.purpleBorder}`, background: P.purpleFaint }}>
            {cols.map(col => (
              <th key={col.field} onClick={() => handleSort(col.field)} title={col.tip}
                style={{ padding: '8px 8px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: 'rgba(167,139,250,0.8)', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                {col.label} {arrow(col.field)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={11} style={{ textAlign: 'center', padding: '32px 0', color: P.muted }}>No sold positions.</td></tr>
          ) : sorted.map(p => {
            const gl$  = glDollar(p)
            const gl_p = glPct(p)
            const isEditing = editingCost === p.id
            return (
              <tr key={p.id}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: P.text, whiteSpace: 'nowrap' }}>{p.symbol}</td>
                <td style={{ padding: '10px 8px', textAlign: 'left', color: P.muted, fontSize: 11, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || '—'}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', color: P.muted, fontSize: 11, fontFamily: 'monospace' }}>{fmtDate(p.acquired)}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', color: P.muted, fontSize: 11, fontFamily: 'monospace' }}>{fmtDate(p.sold_at)}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', color: P.muted, fontFamily: 'monospace' }}>{fmtNum(p.qty, 0)}</td>
                {/* Cost Basis — editable */}
                <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
                      <input
                        autoFocus
                        type="number"
                        value={costDraft}
                        onChange={e => setCostDraft(e.target.value)}
                        onKeyDown={async e => {
                          if (e.key === 'Enter') {
                            const v = parseFloat(costDraft)
                            if (!isNaN(v) && v > 0) { onCostUpdate(p.id, v) }
                            setEditingCost(null)
                          }
                          if (e.key === 'Escape') setEditingCost(null)
                        }}
                        style={{ width: 80, fontSize: 11, padding: '2px 5px', background: P.purpleFaint, border: `1px solid ${P.purpleBorder}`, borderRadius: 4, color: P.text, outline: 'none', textAlign: 'center' }}
                      />
                      <button onClick={() => setEditingCost(null)} style={{ background: 'none', border: 'none', color: P.muted, cursor: 'pointer', fontSize: 11 }}>✕</button>
                    </div>
                  ) : (
                    <span
                      onClick={() => { setEditingCost(p.id); setCostDraft(p.total_cost != null ? String(p.total_cost) : '') }}
                      title="Click to edit cost basis"
                      style={{ color: p.total_cost != null ? P.muted : 'rgba(167,139,250,0.4)', cursor: 'pointer', textDecoration: p.total_cost != null ? 'none' : 'underline dotted' }}>
                      {p.total_cost != null ? fmt$(p.total_cost) : '—'}
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: P.text }}>{fmt$(p.market_value)}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(gl$), fontWeight: 600 }}>{gl$ != null ? fmt$(gl$) : '—'}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(gl_p), fontWeight: 600 }}>{gl_p != null ? fmtPct(gl_p) : '—'}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', color: P.muted, fontFamily: 'monospace', fontSize: 11 }}>{p.years_held != null ? fmtNum(p.years_held, 1) : '—'}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(p.annualized_return_pct), fontWeight: 600 }}>{p.annualized_return_pct != null ? fmtPct(p.annualized_return_pct) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SoldTab() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver]   = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchSold() }, [])

  async function fetchSold() {
    try {
      const { data, error } = await supabase.from('sold_positions').select('*').order('sold_at', { ascending: false }).limit(500)
      if (error?.code === '42P01') { setLoading(false); return }
      if (data) setPositions(data as Position[])
    } catch {}
    finally { setLoading(false) }
  }

  async function handleFile(file: File) {
    if (!file.name.match(/\.xlsx?$/i)) { setUploadError('Please upload an .xlsx file.'); return }
    setUploading(true); setUploadMsg(null); setUploadError(null)

    const rows = await parseSoldXlsx(file)
    if (typeof rows === 'string') { setUploadError(rows); setUploading(false); return }

    // When re-uploading: try to preserve existing cost basis entries
    const { data: existing } = await supabase.from('sold_positions').select('symbol,total_cost,acquired,years_held,annualized_return_pct')
    const existingMap = new Map<string, { total_cost: number | null; acquired: string | null; years_held: number | null; annualized_return_pct: number | null }>(
      (existing ?? []).map((e: Record<string,unknown>) => [e.symbol as string, {
        total_cost: e.total_cost as number | null,
        acquired: e.acquired as string | null,
        years_held: e.years_held as number | null,
        annualized_return_pct: e.annualized_return_pct as number | null,
      }])
    )

    const { error: delErr } = await supabase.from('sold_positions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (delErr) { setUploadError('Clear failed: ' + delErr.message); setUploading(false); return }

    const inserts = (rows as Record<string, unknown>[]).map(r => {
      const sym = String(r.symbol ?? '')
      const prev = existingMap.get(sym)
      const cost  = prev?.total_cost ?? r.total_cost ?? null
      const acq   = prev?.acquired ?? r.acquired ?? null
      // Recalculate holding period and annualized return if we have cost+acquired+sold
      let yrs: number | null = prev?.years_held ?? null
      let ann: number | null = prev?.annualized_return_pct ?? null
      if (acq && r.sold_at) {
        const acqMs   = new Date(String(acq)).getTime()
        const soldMs  = new Date(String(r.sold_at)).getTime()
        yrs = (soldMs - acqMs) / (365.25 * 86400000)
        if (yrs > 0 && cost && (r.market_value as number) > 0) {
          ann = (Math.pow((r.market_value as number) / (cost as number), 1 / (yrs as number)) - 1) * 100
        }
      }
      return { ...r, total_cost: cost, acquired: acq, years_held: yrs, annualized_return_pct: ann }
    })

    for (let i = 0; i < inserts.length; i += 50) {
      const { error } = await supabase.from('sold_positions').insert(inserts.slice(i, i + 50))
      if (error) { setUploadError('Insert failed: ' + error.message); setUploading(false); return }
    }

    setUploadMsg(`✓ ${inserts.length} positions loaded`)
    await fetchSold()
    setUploading(false)
  }

  async function handleCostUpdate(id: string, cost: number) {
    // When user enters cost basis: save + recalculate holding period and annualized return
    const pos = positions.find(p => p.id === id)
    if (!pos) return
    let yrs: number | null = pos.years_held
    let ann: number | null = pos.annualized_return_pct
    if (pos.acquired && pos.sold_at) {
      const acqMs  = new Date(pos.acquired).getTime()
      const soldMs = new Date(pos.sold_at).getTime()
      yrs = (soldMs - acqMs) / (365.25 * 86400000)
      if (yrs > 0 && pos.market_value) {
        ann = (Math.pow(pos.market_value / cost, 1 / yrs) - 1) * 100
      }
    }
    await supabase.from('sold_positions').update({ total_cost: cost, years_held: yrs, annualized_return_pct: ann }).eq('id', id)
    setPositions(prev => prev.map(p => p.id === id ? { ...p, total_cost: cost, years_held: yrs, annualized_return_pct: ann } : p))
  }

  if (loading) return <SkeletonTable />

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase' }}>SOLD</span>
        <span style={{ fontSize: 11, color: P.muted }}>Directed buy scorecard</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, background: 'rgba(156,163,175,0.1)', border: '1px solid rgba(156,163,175,0.3)', borderRadius: 8, color: '#9ca3af', cursor: 'pointer', opacity: uploading ? 0.5 : 1 }}>
          {uploading ? 'Loading…' : '↑ Upload Sold .xlsx'}
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
          style={{ display: 'none' }} />
      </div>

      {uploadMsg   && <div style={{ marginBottom: 12, fontSize: 12, color: P.green, fontFamily: 'monospace' }}>{uploadMsg}</div>}
      {uploadError && <div style={{ marginBottom: 12, fontSize: 12, color: P.red,   fontFamily: 'monospace' }}>{uploadError}</div>}

      {positions.length === 0 ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onClick={() => fileInputRef.current?.click()}
          style={{ border: `2px dashed ${dragOver ? P.purple : 'rgba(156,163,175,0.25)'}`, borderRadius: 12, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', background: dragOver ? P.purpleFaint : 'transparent', transition: 'all 0.15s', marginBottom: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>📊</div>
          <div style={{ fontSize: 13, color: P.text, fontWeight: 600, marginBottom: 6 }}>Drop your Morgan Stanley activity export here</div>
          <div style={{ fontSize: 12, color: P.muted }}>Expected: Activity Date · Symbol · Description · Quantity · Price($) · Amount($)</div>
        </div>
      ) : (
        <>
          <SoldKpiCards positions={positions} />
          <SoldTable positions={positions} onCostUpdate={handleCostUpdate} />
        </>
      )}
    </div>
  )
}

// ─── Portfolio Tab (existing logic) ───────────────────────────────────────────
function PortfolioTab() {
  const [positions, setPositions]     = useState<Position[]>([])
  const [loading, setLoading]         = useState(true)
  const [uploading, setUploading]     = useState(false)
  const [uploadMsg, setUploadMsg]     = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [tableExists, setTableExists] = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [refreshMsg, setRefreshMsg]   = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null)
  const [periodFilter, setPeriodFilter]   = useState<'All' | 'Long' | 'Short'>('All')
  const [sortField, setSortField]         = useState<SortField>('market_value')
  const [sortDir, setSortDir]             = useState<SortDir>('desc')
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver]       = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchPositions() }, [])
  useEffect(() => {
    const dates = positions.map(p => p.price_updated_at).filter(Boolean) as string[]
    if (dates.length > 0) setLastRefreshed(dates.sort().reverse()[0])
  }, [positions])

  async function fetchPositions() {
    try {
      const { data, error } = await supabase.from('portfolio_positions').select('*').order('market_value', { ascending: false }).limit(200)
      if (error?.code === '42P01') { setTableExists(false); setLoading(false); return }
      if (data) setPositions(data as Position[])
    } catch { setTableExists(false) }
    finally { setLoading(false) }
  }

  async function refreshPrices() {
    setRefreshing(true); setRefreshMsg(null)
    try {
      const SUPABASE_URL = 'https://mtkyyaorvensylrfbhxv.supabase.co'
      const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a3l5YW9ydmVuc3lscmZiaHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTU0OTUsImV4cCI6MjA4ODc3MTQ5NX0.YqyuBjymYf26cA6JF534NVmsTmdMv7ohB1LBCmdsaJA'
      const res  = await fetch(`${SUPABASE_URL}/functions/v1/refresh-portfolio-prices`, { method: 'POST', headers: { 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }) })
      const text = await res.text()
      let json: Record<string, unknown> = {}
      try { json = JSON.parse(text) } catch { setRefreshMsg(`Error: ${res.status} — ${text.slice(0,200)}`); setRefreshing(false); return }
      if (!res.ok) { setRefreshMsg(`Error ${res.status}: ${json.error || json.message || text.slice(0,200)}`) }
      else if (json.cached) { setRefreshMsg(`Prices current as of ${json.lastUpdated}.${json.nextRefreshIn ? ` Next in ${json.nextRefreshIn}.` : ''}`) }
      else { const errs = Array.isArray(json.errors) ? json.errors : []; setRefreshMsg(`✓ Updated ${json.updated} tickers${errs.length ? ` (${errs.length} skipped)` : ''}`); await fetchPositions() }
    } catch (e: unknown) { setRefreshMsg('Error: ' + (e instanceof Error ? e.message : String(e))) }
    setRefreshing(false)
  }

  function cacheAge(): { fresh: boolean; label: string } {
    if (!lastRefreshed) return { fresh: false, label: '' }
    const hrs = (Date.now() - new Date(lastRefreshed).getTime()) / (1000 * 60 * 60)
    if (hrs < 24) return { fresh: true, label: `Updated ${hrs < 1 ? 'recently' : Math.floor(hrs) + 'h ago'} — next in ${Math.ceil(24 - hrs)}h` }
    return { fresh: false, label: '' }
  }

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) { setUploadError('Please upload an .xlsx file.'); return }
    setUploading(true); setUploadMsg(null); setUploadError(null)
    const rows = await parseXlsx(file, PORTFOLIO_COL_MAP)
    if (typeof rows === 'string') { setUploadError(rows); setUploading(false); return }
    const batch = new Date().toISOString()
    const { error: delError } = await supabase.from('portfolio_positions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (delError) { setUploadError('Failed to clear: ' + delError.message); setUploading(false); return }
    const inserts = (rows as Record<string, unknown>[]).map(r => ({ ...r, upload_batch: batch }))
    for (let i = 0; i < inserts.length; i += 50) {
      const { error } = await supabase.from('portfolio_positions').insert(inserts.slice(i, i + 50))
      if (error) { setUploadError('Insert failed: ' + error.message); setUploading(false); return }
    }
    setUploadMsg(`✓ ${inserts.length} positions loaded`)
    await fetchPositions()
    setUploading(false)
  }, [])

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }
  function sortArrow(field: SortField) {
    if (sortField !== field) return <span style={{ color: P.muted, fontSize: 9 }}>⇅</span>
    return <span style={{ color: P.purple, fontSize: 9 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  function consolidate(pos: Position[]): ConsolidatedRow[] {
    const map = new Map<string, Position[]>()
    for (const p of pos) { const s = p.symbol ?? '??'; if (!map.has(s)) map.set(s, []); map.get(s)!.push(p) }
    const rows: ConsolidatedRow[] = []
    for (const [symbol, lots] of Array.from(map.entries())) {
      const mv = lots.reduce((s, l) => s + (l.market_value ?? 0), 0)
      const tc = lots.reduce((s, l) => s + (l.total_cost ?? 0), 0)
      const gl = lots.reduce((s, l) => s + (l.unrealized_gl_dollar ?? 0), 0)
      const annRet = mv > 0 ? lots.reduce((s, l) => s + ((l.annualized_return_pct ?? 0) * (l.market_value ?? 0)), 0) / mv : null
      rows.push({ symbol, name: lots[0].name ?? symbol, lots, qty: lots.reduce((s, l) => s + (l.qty ?? 0), 0), market_value: mv, total_cost: tc, unrealized_gl_dollar: gl, unrealized_gl_pct: tc > 0 ? (gl / tc) * 100 : 0, annualized_return_pct: annRet, period: lots[0].period ?? '' })
    }
    return rows
  }

  function sortedRows(): ConsolidatedRow[] {
    const filtered = positions.filter(p => periodFilter === 'All' || p.period === periodFilter)
    const rows = consolidate(filtered)
    return rows.sort((a, b) => {
      const f = sortField as string
      let av: number | string = 0, bv: number | string = 0
      if      (f === 'market_value')          { av = a.market_value; bv = b.market_value }
      else if (f === 'unrealized_gl_dollar')  { av = a.unrealized_gl_dollar; bv = b.unrealized_gl_dollar }
      else if (f === 'unrealized_gl_pct')     { av = a.unrealized_gl_pct; bv = b.unrealized_gl_pct }
      else if (f === 'annualized_return_pct') { av = a.annualized_return_pct ?? -999; bv = b.annualized_return_pct ?? -999 }
      else if (f === 'total_cost')            { av = a.total_cost; bv = b.total_cost }
      else if (f === 'qty')                   { av = a.qty; bv = b.qty }
      else if (f === 'symbol')                { av = a.symbol; bv = b.symbol }
      else if (f === 'name')                  { av = a.name; bv = b.name }
      else if (f === 'period')                { av = a.period ?? ''; bv = b.period ?? '' }
      else if (f === 'years_held')            { av = a.lots[0]?.years_held ?? -999; bv = b.lots[0]?.years_held ?? -999 }
      else if (f === 'ytd_pct')               { av = a.lots[0]?.ytd_pct ?? -999; bv = b.lots[0]?.ytd_pct ?? -999 }
      else if (f === 'rolling_12mo_pct')      { av = a.lots[0]?.rolling_12mo_pct ?? -999; bv = b.lots[0]?.rolling_12mo_pct ?? -999 }
      else if (f === 'rolling_36mo_pct')      { av = a.lots[0]?.rolling_36mo_pct ?? -999; bv = b.lots[0]?.rolling_36mo_pct ?? -999 }
      else if (f === 'acquired')              { av = a.lots[0]?.acquired ?? ''; bv = b.lots[0]?.acquired ?? '' }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
  }

  if (!tableExists) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 }}>
      <div style={{ fontSize: 32, opacity: 0.3 }}>⚠</div>
      <div style={{ fontFamily: 'monospace', fontSize: 11, color: P.purple, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Database Setup Required</div>
      <div style={{ fontSize: 12, color: P.muted, textAlign: 'center', maxWidth: 420, lineHeight: 1.6 }}>Check your email for the SQL migration, run it in Supabase, then refresh.</div>
      <a href="https://supabase.com/dashboard/project/mtkyyaorvensylrfbhxv/sql/new" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: P.purple, textDecoration: 'none', borderBottom: '1px solid rgba(139,92,246,0.4)' }}>Open Supabase SQL Editor →</a>
    </div>
  )

  const rows = sortedRows()
  const cache = cacheAge()

  return (
    <>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['All', 'Long', 'Short'] as const).map(p => (
            <button key={p} onClick={() => setPeriodFilter(p)} style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: periodFilter === p ? P.purpleFaint : 'transparent', border: `1px solid ${periodFilter === p ? P.purpleDim : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, color: periodFilter === p ? P.purple : P.muted, cursor: 'pointer', fontFamily: 'inherit' }}>{p}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {positions.length > 0 && (
          <button onClick={refreshPrices} disabled={refreshing} title={cache.label || 'Refresh prices from Yahoo'}
            style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 8, color: P.green, cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.5 : 1, whiteSpace: 'nowrap' }}>
            {refreshing ? '⟳ Refreshing…' : `⟳ Refresh Prices${cache.fresh ? ` (${cache.label})` : ''}`}
          </button>
        )}
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, background: P.purpleFaint, border: `1px solid ${P.purpleBorder}`, borderRadius: 8, color: P.purple, cursor: 'pointer', opacity: uploading ? 0.5 : 1 }}>
          {uploading ? 'Loading…' : '↑ Upload .xlsx'}
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} style={{ display: 'none' }} />
      </div>

      {refreshMsg  && <div style={{ marginBottom: 10, fontSize: 12, color: refreshMsg.startsWith('Error') ? P.red : P.green, fontFamily: 'monospace' }}>{refreshMsg}</div>}
      {uploadMsg   && <div style={{ marginBottom: 10, fontSize: 12, color: P.green, fontFamily: 'monospace' }}>{uploadMsg}</div>}
      {uploadError && <div style={{ marginBottom: 10, fontSize: 12, color: P.red, fontFamily: 'monospace' }}>{uploadError}</div>}

      {/* Drop zone */}
      {!loading && positions.length === 0 && (
        <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onClick={() => fileInputRef.current?.click()}
          style={{ border: `2px dashed ${dragOver ? P.purple : P.purpleBorder}`, borderRadius: 12, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', background: dragOver ? P.purpleFaint : 'transparent', transition: 'all 0.15s', marginBottom: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>📊</div>
          <div style={{ fontSize: 13, color: P.text, fontWeight: 600, marginBottom: 6 }}>Drop your .xlsx here</div>
          <div style={{ fontSize: 12, color: P.muted }}>Full portfolio export</div>
        </div>
      )}

      {loading ? <SkeletonTable /> : positions.length > 0 ? (
        <>
          <KpiCards positions={positions} />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${P.purpleBorder}`, background: P.purpleFaint }}>
                  {([
                    { label: '',          field: 'symbol'               },
                    { label: 'Symbol',    field: 'symbol'               },
                    { label: 'Ann. Ret',  field: 'annualized_return_pct'},
                    { label: 'Mkt Value', field: 'market_value'         },
                    { label: 'Period',    field: 'period',               cls: 'hidden sm:table-cell' },
                    { label: 'Yrs Held',  field: 'years_held',           cls: 'hidden sm:table-cell' },
                    { label: 'YTD',       field: 'ytd_pct'              },
                    { label: '12mo',      field: 'rolling_12mo_pct'     },
                    { label: '36mo',      field: 'rolling_36mo_pct'     },
                  ] as { label: string; field: SortField; cls?: string }[]).map((col, i) => (
                    <th key={i} className={col.cls ?? ''} onClick={() => col.label && handleSort(col.field)}
                      style={{ padding: '8px 8px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: 'rgba(167,139,250,0.8)', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: col.label ? 'pointer' : 'default', whiteSpace: 'nowrap', userSelect: 'none' }}>
                      {col.label} {col.label && sortArrow(col.field)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const isMultiLot = row.lots.length > 1
                  const expanded = expandedSymbols.has(row.symbol)
                  return (
                    <>
                      <tr key={row.symbol}
                        onClick={() => isMultiLot ? setExpandedSymbols(prev => { const n = new Set(prev); n.has(row.symbol) ? n.delete(row.symbol) : n.add(row.symbol); return n }) : undefined}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.06)'}
                        onMouseLeave={e => e.currentTarget.style.background = isMultiLot && expanded ? P.purpleFaint : ''}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isMultiLot && expanded ? P.purpleFaint : '', cursor: isMultiLot ? 'pointer' : 'default', transition: 'background 0.1s' }}>
                        <td style={{ width: 38, padding: '9px 4px', textAlign: 'center' }}>
                          <a href={`/warroom/portfolio?symbol=${encodeURIComponent(row.symbol)}`} title="Open position detail"
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.35)', color: P.purple, textDecoration: 'none', fontSize: 14 }}>↗</a>
                        </td>
                        <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 700, color: P.text, whiteSpace: 'nowrap' }}>
                          {isMultiLot && <span style={{ fontSize: 9, color: P.purpleDim, marginRight: 4 }}>{expanded ? '▼' : '▶'}</span>}
                          {row.symbol}
                          {isMultiLot && <span style={{ marginLeft: 5, fontSize: 9, padding: '1px 5px', background: P.purpleFaint, border: `1px solid ${P.purpleBorder}`, borderRadius: 3, color: P.purpleDim }}>{row.lots.length}</span>}
                        </td>
                        <td style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(row.annualized_return_pct), fontWeight: 600 }}>{fmtPct(row.annualized_return_pct)}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600, color: P.text }}>{fmt$(row.market_value)}</td>
                        <td className="hidden sm:table-cell" style={{ padding: '9px 8px', textAlign: 'center' }}>
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: row.period === 'Long' ? P.purpleFaint : 'rgba(251,191,36,0.1)', border: `1px solid ${row.period === 'Long' ? P.purpleBorder : 'rgba(251,191,36,0.3)'}`, color: row.period === 'Long' ? P.purple : '#fbbf24', fontWeight: 600 }}>{row.period}</span>
                        </td>
                        <td className="hidden sm:table-cell" style={{ padding: '9px 8px', textAlign: 'center', color: P.muted, fontFamily: 'monospace', fontSize: 12 }}>
                          {row.lots.length === 1 ? fmtNum(row.lots[0].years_held, 1) : <span style={{ color: P.purpleDim, fontSize: 10 }}>{row.lots.length} lots</span>}
                        </td>
                        <td style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(row.lots[0]?.ytd_pct ?? null), fontWeight: 600 }}>{fmtPct(row.lots[0]?.ytd_pct ?? null)}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(row.lots[0]?.rolling_12mo_pct ?? null), fontWeight: 600 }}>{fmtPct(row.lots[0]?.rolling_12mo_pct ?? null)}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(row.lots[0]?.rolling_36mo_pct ?? null), fontWeight: 600 }}>{fmtPct(row.lots[0]?.rolling_36mo_pct ?? null)}</td>
                      </tr>
                      {isMultiLot && expanded && row.lots.map((lot, li) => (
                        <tr key={lot.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.025)', background: 'rgba(139,92,246,0.03)' }}>
                          <td style={{ padding: '7px 4px', textAlign: 'center' }}><span style={{ fontSize: 9, color: P.purpleDim }}>Lot {li + 1}</span></td>
                          <td style={{ padding: '7px 8px', textAlign: 'center', color: P.muted, fontSize: 11, fontFamily: 'monospace' }}>{lot.acquired ? new Date(lot.acquired).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: pctColor(lot.annualized_return_pct) }}>{fmtPct(lot.annualized_return_pct)}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: P.muted }}>{fmt$(lot.market_value)}</td>
                          <td className="hidden sm:table-cell" style={{ padding: '7px 8px', textAlign: 'center' }}><span style={{ fontSize: 9, color: P.muted }}>{lot.period}</span></td>
                          <td className="hidden sm:table-cell" style={{ padding: '7px 8px', textAlign: 'center', color: P.muted, fontFamily: 'monospace', fontSize: 11 }}>{fmtNum(lot.years_held, 1)}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: pctColor(lot.ytd_pct) }}>{fmtPct(lot.ytd_pct)}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: pctColor(lot.rolling_12mo_pct) }}>{fmtPct(lot.rolling_12mo_pct)}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: pctColor(lot.rolling_36mo_pct) }}>{fmtPct(lot.rolling_36mo_pct)}</td>
                        </tr>
                      ))}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  )
}

// ─── Root PortfolioPanel ──────────────────────────────────────────────────────
export default function PortfolioPanel() {
  const [tab, setTab] = useState<Tab>('portfolio')

  const tabs: { id: Tab; label: string; color: string }[] = [
    { id: 'portfolio', label: 'Portfolio', color: P.purple },
    { id: 'sleeve',    label: 'Sleeve',    color: '#a78bfa' },
    { id: 'sold',      label: 'Sold',      color: '#9ca3af' },
  ]

  return (
    <div className="wr-card">
      {/* Tab strip */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: `1px solid ${P.purpleBorder}`, paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 18px', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
            background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            color: tab === t.id ? t.color : P.muted,
            borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'portfolio' && <PortfolioTab />}
      {tab === 'sleeve'    && <SleeveTab />}
      {tab === 'sold'      && <SoldTab />}
    </div>
  )
}

function SkeletonTable() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 40 }} />)}
    </div>
  )
}

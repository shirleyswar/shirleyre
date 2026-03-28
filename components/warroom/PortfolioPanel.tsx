'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
interface PortfolioPosition {
  id: string
  upload_batch: string
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

// Consolidated row for multi-lot tickers
interface ConsolidatedRow {
  symbol: string
  name: string
  lots: PortfolioPosition[]
  qty: number
  market_value: number
  total_cost: number
  unrealized_gl_dollar: number
  unrealized_gl_pct: number
  annualized_return_pct: number | null
  period: string
  expanded: boolean
}

type SortField = keyof PortfolioPosition | 'symbol_display'
type SortDir = 'asc' | 'desc'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt$(n: number | null, decimals = 0): string {
  if (n === null || n === undefined) return '—'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(decimals)}`
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

// ─── Design tokens ────────────────────────────────────────────────────────────
const P = {
  purple:     '#a78bfa',
  purpleDim:  'rgba(139,92,246,0.5)',
  purpleFaint:'rgba(139,92,246,0.08)',
  purpleBorder:'rgba(139,92,246,0.25)',
  bg:         '#0D0F14',
  bgCard:     'rgba(15,13,30,0.85)',
  bgRow:      'rgba(255,255,255,0.018)',
  border:     'rgba(139,92,246,0.15)',
  text:       '#F0F2FF',
  muted:      '#6b7280',
  green:      '#22c55e',
  red:        '#ef4444',
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function PortfolioPanel() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [tableExists, setTableExists] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null)
  const [periodFilter, setPeriodFilter] = useState<'All' | 'Long' | 'Short'>('All')
  const [sortField, setSortField] = useState<SortField>('market_value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchPositions()
  }, [])

  // ─── Derive last refresh time from loaded positions ────────────────────────
  useEffect(() => {
    const dates = positions.map(p => p.price_updated_at).filter(Boolean) as string[]
    if (dates.length > 0) {
      const latest = dates.sort().reverse()[0]
      setLastRefreshed(latest)
    }
  }, [positions])

  // ─── Refresh prices via Supabase Edge Function ─────────────────────────────
  async function refreshPrices() {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      const SUPABASE_URL = 'https://mtkyyaorvensylrfbhxv.supabase.co'
      const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a3l5YW9ydmVuc3lscmZiaHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTU0OTUsImV4cCI6MjA4ODc3MTQ5NX0.YqyuBjymYf26cA6JF534NVmsTmdMv7ohB1LBCmdsaJA'
      const res = await fetch(`${SUPABASE_URL}/functions/v1/refresh-portfolio-prices`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      })
      const text = await res.text()
      let json: Record<string, unknown> = {}
      try { json = JSON.parse(text) } catch { setRefreshMsg(`Error: ${res.status} — ${text.slice(0, 200)}`); setRefreshing(false); return }
      if (!res.ok) {
        setRefreshMsg(`Error ${res.status}: ${json.error || json.message || text.slice(0, 200)}`)
      } else if (json.cached) {
        const next = json.nextRefreshIn ? ` Next refresh in ${json.nextRefreshIn}.` : ''
        setRefreshMsg(`Prices current as of ${json.lastUpdated}.${next}`)
      } else {
        setRefreshMsg(`✓ Updated ${json.updated} tickers${json.errors?.length ? ` (${json.errors.length} skipped)` : ''}`)
        await fetchPositions()
      }
    } catch (e: unknown) {
      setRefreshMsg('Error: ' + (e instanceof Error ? e.message : String(e)))
    }
    setRefreshing(false)
  }

  function refreshCacheAge(): { fresh: boolean; label: string } {
    if (!lastRefreshed) return { fresh: false, label: '' }
    const ms = Date.now() - new Date(lastRefreshed).getTime()
    const hrs = ms / (1000 * 60 * 60)
    if (hrs < 24) {
      const remaining = Math.ceil(24 - hrs)
      return { fresh: true, label: `Prices updated ${hrs < 1 ? 'recently' : Math.floor(hrs) + 'h ago'} — next refresh in ${remaining}h` }
    }
    return { fresh: false, label: '' }
  }

  async function fetchPositions() {
    try {
      const { data, error } = await supabase
        .from('portfolio_positions')
        .select('*')
        .order('market_value', { ascending: false })
        .limit(200)
      if (error?.code === '42P01') { setTableExists(false); setLoading(false); return }
      if (data) setPositions(data as PortfolioPosition[])
    } catch { setTableExists(false) }
    finally { setLoading(false) }
  }

  // ─── Upload handler ────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setUploadError('Please upload an .xlsx file.')
      return
    }
    setUploading(true)
    setUploadMsg(null)
    setUploadError(null)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: null })

      // Strip totals row (Symbol is null / NaN / empty)
      const rows = raw.filter(r => {
        const sym = r['Symbol']
        if (!sym) return false
        if (typeof sym === 'number' && isNaN(sym)) return false
        if (typeof sym === 'string' && sym.trim() === '') return false
        return true
      })

      if (rows.length === 0) {
        setUploadError('No valid rows found. Check that the file has a Symbol column.')
        setUploading(false)
        return
      }

      // Check expected columns
      const firstRow = rows[0]
      const required = ['Name', 'Symbol', 'Acquired', 'Period', 'Qty', 'Market Value', 'Total Cost']
      const missing = required.filter(col => !(col in firstRow))
      if (missing.length > 0) {
        setUploadError(`Missing columns: ${missing.join(', ')}`)
        setUploading(false)
        return
      }

      const batch = new Date().toISOString()

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

      const parseNum = (v: unknown): number | null => {
        if (v === null || v === undefined || v === '') return null
        const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,%]/g, ''))
        return isNaN(n) ? null : n
      }

      // Excel stores percentages as decimals (e.g. 0.4042 = 40.42%) — multiply by 100
      const pct = (v: unknown) => { const n = parseNum(v); return n !== null ? n * 100 : null }

      const inserts = rows.map(r => ({
        upload_batch: batch,
        name: String(r['Name'] ?? ''),
        symbol: String(r['Symbol'] ?? '').trim().toUpperCase(),
        acquired: parseDate(r['Acquired']),
        period: String(r['Period'] ?? ''),
        qty: parseNum(r['Qty']),
        market_value: parseNum(r['Market Value']),
        total_cost: parseNum(r['Total Cost']),
        unrealized_gl_pct: pct(r['Unrealized G/L %']),
        unrealized_gl_dollar: parseNum(r['Unrealized G/L $']),
        years_held: parseNum(r['Years Held']),
        annualized_return_pct: pct(r['Annualized Return %']),
        ytd_pct: null,
        rolling_12mo_pct: null,
        rolling_36mo_pct: null,
        last_price: null,
        price_updated_at: null,
      }))

      // Wipe and replace
      const { error: delError } = await supabase.from('portfolio_positions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (delError) { setUploadError('Failed to clear existing data: ' + delError.message); setUploading(false); return }

      // Insert in chunks of 50
      for (let i = 0; i < inserts.length; i += 50) {
        const chunk = inserts.slice(i, i + 50)
        const { error: insError } = await supabase.from('portfolio_positions').insert(chunk)
        if (insError) { setUploadError('Insert failed: ' + insError.message); setUploading(false); return }
      }

      setUploadMsg(`✓ ${inserts.length} positions loaded`)
      await fetchPositions()
    } catch (e: unknown) {
      setUploadError('Parse error: ' + (e instanceof Error ? e.message : String(e)))
    }
    setUploading(false)
  }, [])

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ''
  }

  // ─── Sort handler ──────────────────────────────────────────────────────────
  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  function sortArrow(field: SortField) {
    if (sortField !== field) return <span style={{ color: P.muted, fontSize: 9 }}>⇅</span>
    return <span style={{ color: P.purple, fontSize: 9 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  // ─── Consolidate multi-lot positions ──────────────────────────────────────
  function consolidate(pos: PortfolioPosition[]): ConsolidatedRow[] {
    const map = new Map<string, PortfolioPosition[]>()
    for (const p of pos) {
      const sym = p.symbol ?? '??'
      if (!map.has(sym)) map.set(sym, [])
      map.get(sym)!.push(p)
    }

    const rows: ConsolidatedRow[] = []
    for (const [symbol, lots] of Array.from(map.entries())) {
      const mv = lots.reduce((s, l) => s + (l.market_value ?? 0), 0)
      const tc = lots.reduce((s, l) => s + (l.total_cost ?? 0), 0)
      const gl = lots.reduce((s, l) => s + (l.unrealized_gl_dollar ?? 0), 0)
      const glPct = tc > 0 ? ((gl / tc) * 100) : 0
      const qty = lots.reduce((s, l) => s + (l.qty ?? 0), 0)
      // Weighted avg annualized return by market value
      const annRet = mv > 0
        ? lots.reduce((s, l) => s + ((l.annualized_return_pct ?? 0) * (l.market_value ?? 0)), 0) / mv
        : null
      rows.push({
        symbol,
        name: lots[0].name ?? symbol,
        lots,
        qty,
        market_value: mv,
        total_cost: tc,
        unrealized_gl_dollar: gl,
        unrealized_gl_pct: glPct,
        annualized_return_pct: annRet,
        period: lots[0].period ?? '',
        expanded: expandedSymbols.has(symbol),
      })
    }
    return rows
  }

  // ─── Filter + sort consolidated rows ──────────────────────────────────────
  function sortedRows(): ConsolidatedRow[] {
    const filtered = positions.filter(p => periodFilter === 'All' || p.period === periodFilter)
    const rows = consolidate(filtered)

    return rows.sort((a, b) => {
      let av: number | string = 0
      let bv: number | string = 0
      const f = sortField as string
      if (f === 'market_value')          { av = a.market_value; bv = b.market_value }
      else if (f === 'unrealized_gl_dollar') { av = a.unrealized_gl_dollar; bv = b.unrealized_gl_dollar }
      else if (f === 'unrealized_gl_pct')    { av = a.unrealized_gl_pct; bv = b.unrealized_gl_pct }
      else if (f === 'annualized_return_pct') { av = a.annualized_return_pct ?? -999; bv = b.annualized_return_pct ?? -999 }
      else if (f === 'total_cost')       { av = a.total_cost; bv = b.total_cost }
      else if (f === 'qty')              { av = a.qty; bv = b.qty }
      else if (f === 'symbol')           { av = a.symbol; bv = b.symbol }
      else if (f === 'name')             { av = a.name; bv = b.name }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
  }

  // ─── KPIs ─────────────────────────────────────────────────────────────────
  const totalMV    = positions.reduce((s, p) => s + (p.market_value ?? 0), 0)
  const totalCost  = positions.reduce((s, p) => s + (p.total_cost ?? 0), 0)
  const totalGL    = positions.reduce((s, p) => s + (p.unrealized_gl_dollar ?? 0), 0)
  const totalGLPct = totalCost > 0 ? (totalGL / totalCost) * 100 : 0
  const wtdAnnRet  = totalMV > 0
    ? positions.reduce((s, p) => s + ((p.annualized_return_pct ?? 0) * (p.market_value ?? 0)), 0) / totalMV
    : 0

  // ─── Setup state (table not yet created) ──────────────────────────────────
  if (!tableExists) {
    return (
      <div className="wr-card" style={{ minHeight: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>⚠</div>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: P.purple, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Database Setup Required</div>
        <div style={{ fontSize: 12, color: P.muted, textAlign: 'center', maxWidth: 420, lineHeight: 1.6 }}>
          The <code style={{ color: P.text }}>portfolio_positions</code> table hasn&apos;t been created yet.
          Check your email for the SQL migration — run it in Supabase, then refresh.
        </div>
        <a href="https://supabase.com/dashboard/project/mtkyyaorvensylrfbhxv/sql/new" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, color: P.purple, textDecoration: 'none', borderBottom: '1px solid rgba(139,92,246,0.4)' }}>
          Open Supabase SQL Editor →
        </a>
      </div>
    )
  }

  const rows = sortedRows()

  return (
    <div className="wr-card">
      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: P.purple, fontFamily: 'var(--font-display, var(--font-body))', textShadow: `0 0 24px rgba(139,92,246,0.4)` }}>
            PORTFOLIO
          </span>
          <span style={{ flex: 1 }} />
          {/* Period filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['All', 'Long', 'Short'] as const).map(p => (
              <button key={p} onClick={() => setPeriodFilter(p)} style={{
                padding: '4px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                background: periodFilter === p ? P.purpleFaint : 'transparent',
                border: `1px solid ${periodFilter === p ? P.purpleDim : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 8, color: periodFilter === p ? P.purple : P.muted, cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}>{p}</button>
            ))}
          </div>
          {/* Refresh Prices button */}
          {positions.length > 0 && (() => {
            const cache = refreshCacheAge()
            return (
              <button onClick={refreshPrices} disabled={refreshing || cache.fresh}
                title={cache.fresh ? cache.label : 'Fetch latest prices from Yahoo Finance'}
                style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', background: 'rgba(34,197,94,0.08)', border: `1px solid ${cache.fresh ? 'rgba(255,255,255,0.08)' : 'rgba(34,197,94,0.35)'}`, borderRadius: 8, color: cache.fresh ? P.muted : P.green, cursor: cache.fresh ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', opacity: refreshing ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                {refreshing ? '⟳ Refreshing…' : cache.fresh ? '✓ Prices Current' : '⟳ Refresh Prices'}
              </button>
            )
          })()}
          {/* Upload button */}
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', background: P.purpleFaint, border: `1px solid ${P.purpleBorder}`, borderRadius: 8, color: P.purple, cursor: 'pointer', fontFamily: 'var(--font-body)', opacity: uploading ? 0.5 : 1 }}>
            {uploading ? 'Loading…' : '↑ Upload .xlsx'}
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={onFileInput} style={{ display: 'none' }} />
        </div>

        {/* Status messages */}
        {refreshMsg && <div style={{ marginTop: 8, fontSize: 12, color: refreshMsg.startsWith('Error') ? P.red : P.green, fontFamily: 'monospace' }}>{refreshMsg}</div>}
        {uploadMsg && <div style={{ marginTop: 8, fontSize: 12, color: P.green, fontFamily: 'monospace' }}>{uploadMsg}</div>}
        {uploadError && <div style={{ marginTop: 8, fontSize: 12, color: P.red, fontFamily: 'monospace' }}>{uploadError}</div>}
      </div>

      {/* ── Drop zone (visible when empty) ── */}
      {!loading && positions.length === 0 && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? P.purple : P.purpleBorder}`,
            borderRadius: 12, padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
            background: dragOver ? P.purpleFaint : 'transparent', transition: 'all 0.15s', marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>📊</div>
          <div style={{ fontSize: 13, color: P.text, fontWeight: 600, marginBottom: 6 }}>Drop your .xlsx here</div>
          <div style={{ fontSize: 12, color: P.muted }}>Or click to select — exports from Schwab, Fidelity, or the ShirleyCRE format</div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      {positions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Market Value', value: fmt$(totalMV), sub: null, color: P.purple },
            { label: 'Cost Basis', value: fmt$(totalCost), sub: null, color: P.muted },
            { label: 'Unrealized G/L', value: fmt$(totalGL), sub: fmtPct(totalGLPct), color: pctColor(totalGL) },
            { label: 'Ann. Return', value: fmtPct(wtdAnnRet), sub: 'weighted avg', color: pctColor(wtdAnnRet) },
            { label: 'Positions', value: String(rows.length), sub: `${positions.length} lots`, color: P.purple },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: P.bgCard, border: `1px solid ${P.border}`,
              borderRadius: 10, padding: '14px 16px',
              boxShadow: `0 0 0 1px ${P.purpleBorder} inset`,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: P.muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: kpi.color, letterSpacing: '-0.02em', fontFamily: 'monospace' }}>{kpi.value}</div>
              {kpi.sub && <div style={{ fontSize: 10, color: P.muted, marginTop: 2 }}>{kpi.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <SkeletonTable />
      ) : positions.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${P.purpleBorder}`, background: P.purpleFaint }}>
                {([
                  { label: 'Symbol',    field: 'symbol' },
                  { label: 'Name',      field: 'name',    cls: 'hidden sm:table-cell' },
                  { label: 'Acquired',  field: 'acquired', cls: 'hidden sm:table-cell' },
                  { label: 'Yrs Held',  field: 'years_held', cls: 'hidden sm:table-cell' },
                  { label: 'Period',    field: 'period',  cls: 'hidden sm:table-cell' },
                  { label: 'Qty',       field: 'qty',     cls: 'hidden sm:table-cell' },
                  { label: 'Mkt Value', field: 'market_value' },
                  { label: 'Cost',      field: 'total_cost', cls: 'hidden sm:table-cell' },
                  { label: 'G/L $',     field: 'unrealized_gl_dollar' },
                  { label: 'G/L %',     field: 'unrealized_gl_pct' },
                  { label: 'Ann. Ret',  field: 'annualized_return_pct', cls: 'hidden sm:table-cell' },
                  { label: 'YTD',       field: 'ytd_pct',               cls: 'hidden sm:table-cell' },
                  { label: '12mo',      field: 'rolling_12mo_pct',      cls: 'hidden sm:table-cell' },
                  { label: '36mo',      field: 'rolling_36mo_pct',      cls: 'hidden sm:table-cell' },
                ] as { label: string; field: SortField; cls?: string }[]).map(col => (
                  <th key={col.label} className={col.cls ?? ''} onClick={() => handleSort(col.field)}
                    style={{ padding: '8px 8px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: 'rgba(167,139,250,0.8)', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                    {col.label} {sortArrow(col.field)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isMultiLot = row.lots.length > 1
                const expanded = expandedSymbols.has(row.symbol)
                return (
                  <>
                    {/* Summary row */}
                    <tr key={row.symbol}
                      onClick={() => isMultiLot ? setExpandedSymbols(prev => {
                        const n = new Set(prev)
                        n.has(row.symbol) ? n.delete(row.symbol) : n.add(row.symbol)
                        return n
                      }) : undefined}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = isMultiLot && expanded ? P.purpleFaint : ''}
                      style={{
                        borderBottom: `1px solid rgba(255,255,255,0.04)`,
                        background: isMultiLot && expanded ? P.purpleFaint : '',
                        cursor: isMultiLot ? 'pointer' : 'default',
                        transition: 'background 0.1s',
                      }}>
                      <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 700, color: P.text, whiteSpace: 'nowrap' }}>
                        {isMultiLot && <span style={{ fontSize: 9, color: P.purpleDim, marginRight: 4 }}>{expanded ? '▼' : '▶'}</span>}
                        {row.symbol}
                        {isMultiLot && <span style={{ marginLeft: 5, fontSize: 9, padding: '1px 5px', background: P.purpleFaint, border: `1px solid ${P.purpleBorder}`, borderRadius: 3, color: P.purpleDim }}>{row.lots.length}</span>}
                      </td>
                      <td className="hidden sm:table-cell" style={{ padding: '9px 8px', color: P.muted, fontSize: 12, textAlign: 'center', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</td>
                      <td className="hidden sm:table-cell" style={{ padding: '9px 8px', textAlign: 'center', color: P.muted, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {row.lots.length === 1 && row.lots[0].acquired
                          ? new Date(row.lots[0].acquired).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : row.lots.length > 1 ? <span style={{ color: P.purpleDim, fontSize: 10 }}>{row.lots.length} lots</span> : '—'}
                      </td>
                      <td className="hidden sm:table-cell" style={{ padding: '9px 8px', textAlign: 'center', color: P.muted, fontFamily: 'monospace', fontSize: 12 }}>
                        {row.lots.length === 1 ? fmtNum(row.lots[0].years_held, 1) : '—'}
                      </td>
                      <td className="hidden sm:table-cell" style={{ padding: '9px 8px', textAlign: 'center' }}>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: row.period === 'Long' ? 'rgba(139,92,246,0.12)' : 'rgba(251,191,36,0.1)', border: `1px solid ${row.period === 'Long' ? P.purpleBorder : 'rgba(251,191,36,0.3)'}`, color: row.period === 'Long' ? P.purple : '#fbbf24', fontWeight: 600 }}>
                          {row.period}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell" style={{ padding: '9px 8px', textAlign: 'center', color: P.muted, fontFamily: 'monospace', fontSize: 12 }}>{fmtNum(row.qty)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600, color: P.text }}>{fmt$(row.market_value)}</td>
                      <td className="hidden sm:table-cell" style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'monospace', color: P.muted }}>{fmt$(row.total_cost)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(row.unrealized_gl_dollar), fontWeight: 600 }}>{fmt$(row.unrealized_gl_dollar)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(row.unrealized_gl_pct), fontWeight: 600 }}>{fmtPct(row.unrealized_gl_pct)}</td>
                      <td className="hidden sm:table-cell" style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(row.annualized_return_pct) }}>{fmtPct(row.annualized_return_pct)}</td>
                      <td className="hidden sm:table-cell" style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(row.lots[0]?.ytd_pct ?? null) }}>{fmtPct(row.lots[0]?.ytd_pct ?? null)}</td>
                      <td className="hidden sm:table-cell" style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(row.lots[0]?.rolling_12mo_pct ?? null) }}>{fmtPct(row.lots[0]?.rolling_12mo_pct ?? null)}</td>
                      <td className="hidden sm:table-cell" style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'monospace', color: pctColor(row.lots[0]?.rolling_36mo_pct ?? null) }}>{fmtPct(row.lots[0]?.rolling_36mo_pct ?? null)}</td>
                    </tr>
                    {/* Individual lots when expanded */}
                    {isMultiLot && expanded && row.lots.map((lot, li) => (
                      <tr key={lot.id}
                        style={{ borderBottom: `1px solid rgba(255,255,255,0.025)`, background: 'rgba(139,92,246,0.03)' }}>
                        <td style={{ padding: '7px 8px', textAlign: 'center', paddingLeft: 24 }}>
                          <span style={{ fontSize: 9, color: P.purpleDim }}>Lot {li + 1}</span>
                        </td>
                        <td className="hidden sm:table-cell" style={{ padding: '7px 8px', color: P.muted, fontSize: 11, textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {lot.acquired ? new Date(lot.acquired).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </td>
                        <td className="hidden sm:table-cell" style={{ padding: '7px 8px', textAlign: 'center', color: P.muted, fontFamily: 'monospace', fontSize: 11 }}>
                          {fmtNum(lot.years_held, 1)}
                        </td>
                        <td className="hidden sm:table-cell" style={{ padding: '7px 8px', textAlign: 'center', color: P.muted, fontFamily: 'monospace', fontSize: 11 }}>{fmtNum(lot.qty)}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: P.muted }}>{fmt$(lot.market_value)}</td>
                        <td className="hidden sm:table-cell" style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: P.muted }}>{fmt$(lot.total_cost)}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: pctColor(lot.unrealized_gl_dollar) }}>{fmt$(lot.unrealized_gl_dollar)}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: pctColor(lot.unrealized_gl_pct) }}>{fmtPct(lot.unrealized_gl_pct)}</td>
                        <td className="hidden sm:table-cell" style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: pctColor(lot.annualized_return_pct) }}>{fmtPct(lot.annualized_return_pct)}</td>
                        <td className="hidden sm:table-cell" style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: pctColor(lot.ytd_pct) }}>{fmtPct(lot.ytd_pct)}</td>
                        <td className="hidden sm:table-cell" style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: pctColor(lot.rolling_12mo_pct) }}>{fmtPct(lot.rolling_12mo_pct)}</td>
                        <td className="hidden sm:table-cell" style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: pctColor(lot.rolling_36mo_pct) }}>{fmtPct(lot.rolling_36mo_pct)}</td>
                      </tr>
                    ))}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Yahoo Finance v8 chart endpoint — no API key needed
const YAHOO_QUOTE = (symbol: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`

const CACHE_MINUTES = 15  // auto-cache: skip if updated within 15 min (prevents rapid-fire)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    // Check if caller is forcing a refresh (manual button click)
    let force = false
    try {
      const body = await req.json()
      force = body?.force === true
    } catch {}

    // ── Check cache: skip only if updated within CACHE_MINUTES AND not forced ──
    if (!force) {
      const { data: newest } = await sb
        .from('portfolio_positions')
        .select('price_updated_at')
        .not('price_updated_at', 'is', null)
        .order('price_updated_at', { ascending: false })
        .limit(1)
        .single()

      if (newest?.price_updated_at) {
        const mins = (Date.now() - new Date(newest.price_updated_at).getTime()) / (1000 * 60)
        if (mins < CACHE_MINUTES) {
          const nextIn = Math.ceil(CACHE_MINUTES - mins)
          return json({ cached: true, lastUpdated: newest.price_updated_at, nextRefreshIn: `${nextIn}m` })
        }
      }
    }

    // ── Pull ALL rows from BOTH tables (need id + qty + total_cost per lot) ──
    const [portRes, sleeveRes] = await Promise.all([
      sb.from('portfolio_positions').select('id, symbol, qty, total_cost').not('symbol', 'is', null),
      sb.from('sleeve_positions').select('id, symbol, qty, total_cost').not('symbol', 'is', null),
    ])

    type PositionRow = { id: string; symbol: string; qty: number | null; total_cost: number | null }

    const portRows: PositionRow[] = (portRes.data ?? []) as PositionRow[]
    const sleeveRows: PositionRow[] = (sleeveRes.data ?? []) as PositionRow[]

    // Deduplicated symbol list for price fetch
    const allSymbols = Array.from(new Set([
      ...portRows.map(r => r.symbol),
      ...sleeveRows.map(r => r.symbol),
    ])).filter(Boolean) as string[]

    if (allSymbols.length === 0) {
      return json({ updated: 0, errors: [], message: 'No symbols found in either table.' })
    }

    // ── Fetch prices from Yahoo ──
    const prices: Record<string, number> = {}
    const errors: string[] = []

    const BATCH = 10  // Yahoo rate limit courtesy
    for (let i = 0; i < allSymbols.length; i += BATCH) {
      const batch = allSymbols.slice(i, i + BATCH)
      await Promise.all(batch.map(async (sym) => {
        try {
          const res = await fetch(YAHOO_QUOTE(sym), {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          })
          if (!res.ok) { errors.push(`${sym}: HTTP ${res.status}`); return }
          const data = await res.json()
          const meta = data?.chart?.result?.[0]?.meta
          const price = meta?.regularMarketPrice ?? meta?.previousClose ?? null
          if (price) prices[sym] = price
          else errors.push(`${sym}: no price`)
        } catch (e) {
          errors.push(`${sym}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }))
      if (i + BATCH < allSymbols.length) await new Promise(r => setTimeout(r, 200))
    }

    const now = new Date().toISOString()
    let updated = 0

    // ── Helper: compute derived fields from fresh price + lot data ──
    function computeUpdate(row: PositionRow, price: number) {
      const qty = row.qty ?? 0
      const cost = row.total_cost ?? 0
      const market_value = price * qty
      const unrealized_gl_dollar = cost > 0 ? market_value - cost : null
      const unrealized_gl_pct = (cost > 0 && unrealized_gl_dollar !== null)
        ? (unrealized_gl_dollar / cost) * 100
        : null
      return {
        last_price: price,
        price_updated_at: now,
        market_value,
        unrealized_gl_dollar,
        unrealized_gl_pct,
      }
    }

    // ── Update portfolio_positions — per lot (by id) ──
    for (const row of portRows) {
      const price = prices[row.symbol]
      if (price == null) continue
      const { error } = await sb
        .from('portfolio_positions')
        .update(computeUpdate(row, price))
        .eq('id', row.id)
      if (!error) updated++
    }

    // ── Update sleeve_positions — per lot (by id) ──
    for (const row of sleeveRows) {
      const price = prices[row.symbol]
      if (price == null) continue
      await sb
        .from('sleeve_positions')
        .update(computeUpdate(row, price))
        .eq('id', row.id)
    }

    return json({
      updated,
      errors,
      symbols: allSymbols.length,
      pricesFound: Object.keys(prices).length,
    })

  } catch (e: unknown) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

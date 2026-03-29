import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Yahoo Finance v8 chart endpoint — no API key needed
const YAHOO_QUOTE = (symbol: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`

const CACHE_HOURS = 23  // skip refresh if prices updated within this window

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    // ── Check cache: if portfolio_positions was updated within CACHE_HOURS, skip ──
    const { data: newest } = await sb
      .from('portfolio_positions')
      .select('price_updated_at')
      .not('price_updated_at', 'is', null)
      .order('price_updated_at', { ascending: false })
      .limit(1)
      .single()

    if (newest?.price_updated_at) {
      const hrs = (Date.now() - new Date(newest.price_updated_at).getTime()) / (1000 * 60 * 60)
      if (hrs < CACHE_HOURS) {
        const nextIn = Math.ceil(CACHE_HOURS - hrs)
        return json({ cached: true, lastUpdated: newest.price_updated_at, nextRefreshIn: `${nextIn}h` })
      }
    }

    // ── Pull distinct symbols from BOTH tables (deduplicated) ──
    const [portRes, sleeveRes] = await Promise.all([
      sb.from('portfolio_positions').select('symbol').not('symbol', 'is', null),
      sb.from('sleeve_positions').select('symbol').not('symbol', 'is', null),
    ])

    const allSymbols = Array.from(new Set([
      ...(portRes.data ?? []).map((r: { symbol: string }) => r.symbol),
      ...(sleeveRes.data ?? []).map((r: { symbol: string }) => r.symbol),
    ])).filter(Boolean) as string[]

    if (allSymbols.length === 0) {
      return json({ updated: 0, errors: [], message: 'No symbols found in either table.' })
    }

    // ── Fetch prices from Yahoo ──
    const prices: Record<string, number> = {}
    const errors: string[] = []

    // Batch in groups of 10 (Yahoo rate limit courtesy)
    const BATCH = 10
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
      // Small delay between batches
      if (i + BATCH < allSymbols.length) await new Promise(r => setTimeout(r, 200))
    }

    const now = new Date().toISOString()
    let updated = 0

    // ── Write prices back to portfolio_positions ──
    for (const [sym, price] of Object.entries(prices)) {
      const { error } = await sb
        .from('portfolio_positions')
        .update({ last_price: price, price_updated_at: now })
        .eq('symbol', sym)
      if (!error) updated++
    }

    // ── Write prices back to sleeve_positions ──
    for (const [sym, price] of Object.entries(prices)) {
      await sb
        .from('sleeve_positions')
        .update({ last_price: price, price_updated_at: now })
        .eq('symbol', sym)
      // Don't double-count updated — already counted above
    }

    return json({ updated, errors, symbols: allSymbols.length, pricesFound: Object.keys(prices).length })

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

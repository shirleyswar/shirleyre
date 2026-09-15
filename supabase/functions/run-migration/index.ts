import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (_req) => {
  // Run each ALTER separately
  const sqls = [
    "ALTER TABLE money_movers ADD COLUMN IF NOT EXISTS logged_at timestamptz",
    "ALTER TABLE money_movers ADD COLUMN IF NOT EXISTS note text",
    "ALTER TABLE money_movers ADD COLUMN IF NOT EXISTS note_typed_at timestamptz",
  ]
  const results = []
  for (const sql of sqls) {
    const { data, error } = await supabase.rpc('exec_ddl', { ddl: sql }).catch(() => ({ data: null, error: { message: 'rpc not found' } }))
    results.push({ sql, data, error: error?.message })
  }
  return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } })
})

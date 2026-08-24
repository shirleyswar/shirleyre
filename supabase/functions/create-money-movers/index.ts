import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (_req) => {
  const { error } = await supabase.from('money_movers').select('id').limit(1)
  if (error && error.code === '42P01') {
    return new Response(JSON.stringify({ exists: false }), { headers: { 'Content-Type': 'application/json' } })
  }
  return new Response(JSON.stringify({ exists: !error, error: error?.message }), { headers: { 'Content-Type': 'application/json' } })
})

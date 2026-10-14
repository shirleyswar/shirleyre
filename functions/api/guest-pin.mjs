// Redeems the one-time guest PIN. The plaintext never lives here.
// Postgres marks the matching row used inside a single UPDATE.

const SUPABASE_URL = 'https://mtkyyaorvensylrfbhxv.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a3l5YW9ydmVuc3lscmZiaHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTU0OTUsImV4cCI6MjA4ODc3MTQ5NX0.YqyuBjymYf26cA6JF534NVmsTmdMv7ohB1LBCmdsaJA'

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

export async function onRequestPost(context) {
  let pin = ''
  try {
    const body = await context.request.json()
    pin = typeof body?.pin === 'string' ? body.pin : ''
  } catch {
    return json({ ok: false }, 401)
  }

  if (!/^[0-9]{6}$/.test(pin)) return json({ ok: false }, 401)

  const ip = context.request.headers.get('cf-connecting-ip') || ''
  let res
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/redeem_guest_pin`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ candidate: pin, client_ip: ip }),
    })
  } catch {
    return json({ ok: false, error: 'unavailable' }, 503)
  }

  if (!res.ok) return json({ ok: false, error: 'unavailable' }, 503)

  let data
  try {
    data = await res.json()
  } catch {
    return json({ ok: false, error: 'unavailable' }, 503)
  }

  if (data === true) return json({ ok: true }, 200)
  return json({ ok: false }, 401)
}

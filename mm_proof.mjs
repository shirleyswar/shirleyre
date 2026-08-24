import { chromium } from 'playwright';

const BASE = 'https://fdb26705.shirleyre.pages.dev';
const SUPABASE_URL = 'https://mtkyyaorvensylrfbhxv.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a3l5YW9ydmVuc3lscmZiaHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTU0OTUsImV4cCI6MjA4ODc3MTQ5NX0.YqyuBjymYf26cA6JF534NVmsTmdMv7ohB1LBCmdsaJA';

// Step 1: Insert a test money mover
const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/money_movers`, {
  method: 'POST',
  headers: { 'apikey': ANON, 'Authorization': `Bearer ${ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
  body: JSON.stringify({ title: 'TEST — Sanka Proof Row', commission: null })
});
const inserted = await insertRes.json();
console.log('INSERT status:', insertRes.status, JSON.stringify(inserted));
const testId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;
console.log('Test ID:', testId);

if (!testId) { console.log('INSERT FAILED'); process.exit(1); }

// Step 2: Load the warroom page and check MM panel
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1909, height: 996 } });
const p = await ctx.newPage();
await p.goto(BASE + '/warroom/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.evaluate(() => localStorage.setItem('wr_session_exp_v2', String(Date.now() + 8*60*60*1000)));
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(4000);

const afterInsert = await p.evaluate(() => {
  const body = document.body.innerText;
  return { hasSanka: body.includes('TEST — Sanka Proof Row'), mmArea: body.slice(body.indexOf('MONEY MOVERS'), body.indexOf('MONEY MOVERS') + 300) };
});
console.log('AFTER INSERT — appears:', afterInsert.hasSanka);
console.log('MM area:', afterInsert.mmArea.slice(0, 200));

// Step 3: Reload and check survives
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(3000);
const afterReload = await p.evaluate(() => document.body.innerText.includes('TEST — Sanka Proof Row'));
console.log('AFTER RELOAD — survives:', afterReload);

await ctx.close();
await browser.close();

// Step 4: Delete and confirm gone
const delRes = await fetch(`${SUPABASE_URL}/rest/v1/money_movers?id=eq.${testId}`, {
  method: 'DELETE',
  headers: { 'apikey': ANON, 'Authorization': `Bearer ${ANON}`, 'Prefer': 'return=minimal' }
});
console.log('DELETE status:', delRes.status);

// Verify count back to 9
const countRes = await fetch(`${SUPABASE_URL}/rest/v1/money_movers?select=count`, {
  headers: { 'apikey': ANON, 'Authorization': `Bearer ${ANON}`, 'Prefer': 'count=exact' }
});
const cr = countRes.headers.get('content-range');
console.log('COUNT after delete:', cr);
console.log('GONE:', cr === '*/9');

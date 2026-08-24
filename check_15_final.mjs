import { chromium } from 'playwright';

const BASE = 'https://b0005dd4.shirleyre.pages.dev';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.goto(BASE + '/warroom3/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.evaluate(() => localStorage.setItem('wr3_session_exp', String(Date.now() + 8*60*60*1000)));
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(4000);

// Tap the MONEY MOVERS tile
const tilePos = await p.evaluate(() => {
  const all = Array.from(document.querySelectorAll('*'));
  const tile = all.find(el => {
    const t = el.textContent?.trim() ?? '';
    const r = el.getBoundingClientRect();
    return t.startsWith('MONEY MOVERS') && r.height > 30 && r.height < 200 && r.width > 50;
  });
  if (!tile) return null;
  const r = tile.getBoundingClientRect();
  return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) };
});

if (tilePos) {
  await p.mouse.click(tilePos.x, tilePos.y);
  await p.waitForTimeout(2000);
}

await p.screenshot({ path: '/Users/sankacoffie/.openclaw/workspace/c48k_mm_mobile.png' });

const result = await p.evaluate(() => {
  const body = document.body.innerText;
  // Find Cabela's or Government St figures
  const all = Array.from(document.querySelectorAll('*'));
  const cabelas = all.find(el => (el.textContent?.includes("Cabela") || el.textContent?.includes("Government St")) && el.children.length < 5);
  const dollars = all.filter(el => /^\$[\d,]+K?M?$/.test(el.textContent?.trim() ?? '') && el.children.length === 0);
  return {
    bodySnippet: body.slice(0, 500),
    cabelasContext: cabelas?.textContent?.trim().slice(0,80),
    dollarFigures: dollars.slice(0,8).map(el => el.textContent?.trim()),
  };
});

console.log(JSON.stringify(result, null, 2));
await ctx.close();
await browser.close();

import { chromium } from 'playwright';

const URL = 'https://29a87133.shirleyre.pages.dev/warroom3/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.evaluate(() => localStorage.setItem('wr3_session_exp', String(Date.now() + 8*60*60*1000)));
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(3000);

// Find and click the MONEY MOVERS tile
const all = await p.evaluate(() => {
  const els = Array.from(document.querySelectorAll('*'));
  const mm = els.find(el => el.textContent?.trim().startsWith('MONEY MOVERS') && el.getBoundingClientRect().height < 200);
  return mm ? { x: Math.round(mm.getBoundingClientRect().x + mm.getBoundingClientRect().width/2), y: Math.round(mm.getBoundingClientRect().y + mm.getBoundingClientRect().height/2) } : null;
});
if (all) {
  await p.mouse.click(all.x, all.y);
  await p.waitForTimeout(2000);
}

await p.screenshot({ path: '/Users/sankacoffie/.openclaw/workspace/check15_mm_sheet.png' });

const R = await p.evaluate(() => {
  const body = document.body.innerText;
  const all = Array.from(document.querySelectorAll('*'));
  // Find Cabela's
  const cabelas = all.find(el => el.textContent?.includes("Cabela") && el.children.length < 5);
  return {
    bodySnippet: body.slice(0, 500),
    cabelasText: cabelas?.textContent?.trim().slice(0,100),
    dollarFigures: all.filter(el => /^\$[\d,]+$/.test(el.textContent?.trim() ?? '') && el.children.length === 0).map(el => el.textContent?.trim()).slice(0,10),
  };
});
console.log(JSON.stringify(R, null, 2));
await ctx.close();
await browser.close();

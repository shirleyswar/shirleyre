import { chromium } from 'playwright';
const URL = 'https://b7b8e20e.shirleyre.pages.dev/warroom/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1909, height: 996 } });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.evaluate(() => localStorage.setItem('wr_session_exp_v2', String(Date.now() + 8*60*60*1000)));
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(4000);

const R = await p.evaluate(() => {
  const all = Array.from(document.querySelectorAll('*'));
  // Find elements containing "ITEMS" AND "WINDOW 48H"
  const candidates = all.filter(el => {
    const t = el.textContent?.trim() ?? '';
    return t.includes('ITEMS') && t.includes('WINDOW 48H') && t.length < 100 && el.children.length < 5;
  });
  // Also find the specific span that should read "N ITEMS · WINDOW 48H"
  const windowSpan = all.find(el => /\d+ ITEMS.*WINDOW 48H/.test(el.textContent?.trim() ?? '') && el.children.length === 0);
  // Find separate "ITEMS" and "WINDOW" spans
  const itemsSpan = all.find(el => /^\d+ ITEMS$/.test(el.textContent?.trim() ?? '') && el.children.length === 0);
  const windowSpan2 = all.find(el => el.textContent?.trim() === 'WINDOW 48H' && el.children.length === 0);
  return {
    combined: windowSpan?.textContent?.trim(),
    itemsOnly: itemsSpan?.textContent?.trim(),
    windowOnly: windowSpan2?.textContent?.trim(),
    candidates: candidates.slice(0,3).map(el => el.textContent?.trim().slice(0,60)),
  };
});
console.log(JSON.stringify(R, null, 2));
await ctx.close();
await browser.close();

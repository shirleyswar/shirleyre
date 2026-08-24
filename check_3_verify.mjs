import { chromium } from 'playwright';
const URL = 'https://29a87133.shirleyre.pages.dev/warroom/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1909, height: 996 } });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.evaluate(() => localStorage.setItem('wr_session_exp_v2', String(Date.now() + 8*60*60*1000)));
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(4000);

const R = await p.evaluate(() => {
  const vBottom = window.innerHeight;
  const clipped = Array.from(document.querySelectorAll('div,span')).filter(el => {
    const r = el.getBoundingClientRect();
    return r.height > 10 && r.width > 100 && r.top < vBottom && r.bottom > vBottom + 2;
  });
  return { clippedCount: clipped.length, clipped: clipped.slice(0,3).map(el => ({ text: el.textContent?.trim().slice(0,40), bottom: Math.round(el.getBoundingClientRect().bottom) })) };
});
console.log(JSON.stringify(R, null, 2));
await ctx.close();
await browser.close();

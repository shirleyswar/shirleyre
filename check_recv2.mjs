import { chromium } from 'playwright';
const URL = 'https://dca8c8c8.shirleyre.pages.dev/warroom/';
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
  // Find all elements with RECEIVABLES text
  const recvEls = all.filter(el => el.textContent?.trim() === 'RECEIVABLES');
  return recvEls.map(el => {
    const s = window.getComputedStyle(el);
    return {
      tag: el.tagName,
      class: el.className,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      fontFamily: s.fontFamily?.slice(0, 30),
      // Check inline style
      inlineFontSize: el.style.fontSize,
      inlineFontWeight: el.style.fontWeight,
    };
  });
});
console.log(JSON.stringify(R, null, 2));
await ctx.close();
await browser.close();

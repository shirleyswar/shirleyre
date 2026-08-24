import { chromium } from 'playwright';

const URL = 'https://29a87133.shirleyre.pages.dev/warroom3/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
// Inject warroom3 session
await p.evaluate(() => {
  localStorage.setItem('wr3_session_exp', String(Date.now() + 8*60*60*1000));
});
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(3000);

await p.screenshot({ path: '/Users/sankacoffie/.openclaw/workspace/check15_mobile2.png' });

const R = await p.evaluate(() => {
  const body = document.body.innerText;
  const all = Array.from(document.querySelectorAll('*'));
  // Find money movers section
  const mmSection = all.find(el => el.textContent?.includes('MONEY MOVERS') && el.children.length < 5);
  // Find dollar figures that look like commissions/values
  const figures = all.filter(el => /\$[\d,]+K?M?/.test(el.textContent?.trim() ?? '') && el.children.length === 0);
  return {
    hasContent: body.length > 100,
    bodySnippet: body.slice(0, 400),
    mmFound: !!mmSection,
    mmText: mmSection?.textContent?.trim().slice(0,100),
    figures: figures.slice(0,5).map(el => el.textContent?.trim()),
  };
});
console.log(JSON.stringify(R, null, 2));
await ctx.close();
await browser.close();

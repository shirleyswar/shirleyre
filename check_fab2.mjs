import { chromium } from 'playwright';

const URL = 'https://shirleyre.pages.dev/warroom';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ 
  viewport: { width: 1920, height: 1080 },
  // Inject session token to bypass PIN gate
  storageState: undefined
});
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// Inject session
await page.evaluate(() => {
  const exp = Date.now() + 8 * 60 * 60 * 1000;
  localStorage.setItem('wr_session_exp_v2', String(exp));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

const bodyText = await page.evaluate(() => document.body.innerText?.slice(0, 200));
console.log('Body text after session inject:', bodyText);

const allText = await page.evaluate(() => document.body.innerHTML?.slice(0, 500));
console.log('Body HTML:', allText);

const fab = await page.evaluate(() => {
  const el = document.querySelector('.wr-fab');
  return el ? { found: true, class: el.className, html: el.outerHTML.slice(0,200) } : { found: false };
});
console.log('FAB:', fab);

const desktopWrap = await page.evaluate(() => {
  const el = document.querySelector('.wr-fab-desktop-wrap');
  return el ? { found: true, html: el.outerHTML.slice(0,300) } : { found: false };
});
console.log('Desktop wrap:', desktopWrap);

await browser.close();

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const URL = 'https://29a87133.shirleyre.pages.dev/warroom/';
const MOBILE_URL = 'https://29a87133.shirleyre.pages.dev/warroom/';

const browser = await chromium.launch({ headless: true });
const R = {};

// Check 51: bottom edge object at 1909x996
{
  const ctx = await browser.newContext({ viewport: { width: 1909, height: 996 } });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.evaluate(() => localStorage.setItem('wr_session_exp_v2', String(Date.now() + 8*60*60*1000)));
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(4000);

  // Screenshot
  await p.screenshot({ path: '/Users/sankacoffie/.openclaw/workspace/check51_1909.png' });

  R.check51 = await p.evaluate(() => {
    const vH = window.innerHeight;
    const vW = window.innerWidth;
    // Look for small element at bottom
    const bottomEls = Array.from(document.querySelectorAll('*')).filter(el => {
      const r = el.getBoundingClientRect();
      return r.bottom > vH - 30 && r.bottom <= vH + 10 && r.width > 20 && r.width < 300 && r.height < 20;
    });
    // Also check horizontal scroll
    return {
      pageScrollsH: document.body.scrollWidth > document.body.clientWidth,
      bodyScrollW: document.body.scrollWidth,
      bodyClientW: document.body.clientWidth,
      bottomElements: bottomEls.slice(0,5).map(el => ({
        tag: el.tagName,
        class: el.className?.slice(0,40),
        text: el.textContent?.trim().slice(0,20),
        bottom: Math.round(el.getBoundingClientRect().bottom),
        w: Math.round(el.getBoundingClientRect().width),
        h: Math.round(el.getBoundingClientRect().height),
      })),
    };
  });
  await ctx.close();
}

// Check 15: mobile — Money Movers renders same figure as desktop
// Mobile = warroom3 or we test on a mobile viewport
// Actually check 15 is about the warroom mobile surface showing same $ as desktop
// warroom3 is the mobile surface. Check if it shows MM data.
{
  // First check what mobile surface renders for MM
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' });
  const p = await ctx.newPage();
  await p.goto('https://29a87133.shirleyre.pages.dev/warroom3/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
  // Check if warroom3 has PIN gate
  const pinInput = await p.$('input[type="password"], input[type="text"]');
  if (pinInput) {
    await pinInput.type('1887');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(2000);
  }
  await p.screenshot({ path: '/Users/sankacoffie/.openclaw/workspace/check15_mobile.png' });
  R.check15_mobile = await p.evaluate(() => {
    const body = document.body.innerText;
    const hasMoneyMovers = body.includes('MONEY MOVERS') || body.includes('Money Movers');
    return {
      hasMoneyMovers,
      bodySnippet: body.slice(0, 300),
      url: window.location.href,
    };
  });
  await ctx.close();
}

writeFileSync('/Users/sankacoffie/.openclaw/workspace/c_51_15.json', JSON.stringify(R, null, 2));
console.log(JSON.stringify(R, null, 2));
await browser.close();

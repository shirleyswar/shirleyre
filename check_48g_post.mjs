import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const URL = 'https://b7b8e20e.shirleyre.pages.dev/warroom/';
const DEPLOY = '28a0b82 — build-48g';
const AUTH = 'localStorage wr_session_exp_v2';

async function getPage(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.evaluate(() => localStorage.setItem('wr_session_exp_v2', String(Date.now() + 8*60*60*1000)));
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(4000);
  return { page: p, ctx };
}

const browser = await chromium.launch({ headless: true });
const R = { deployment: DEPLOY, url: URL, viewport: '1909x996' };
const { page: p, ctx } = await getPage(browser, 1909, 996);

await p.screenshot({ path: '/Users/sankacoffie/.openclaw/workspace/build_48g_1909.png' });

// Check 3: clipped elements
R.check3 = await p.evaluate(() => {
  const vBottom = window.innerHeight;
  const clipped = Array.from(document.querySelectorAll('div,span')).filter(el => {
    const r = el.getBoundingClientRect();
    return r.height > 10 && r.width > 100 && r.top < vBottom && r.bottom > vBottom + 2;
  });
  return { clippedCount: clipped.length, clipped: clipped.slice(0,3).map(el => ({ text: el.textContent?.trim().slice(0,40), bottom: Math.round(el.getBoundingClientRect().bottom) })) };
});

// Check 53: band header text
R.check53 = await p.evaluate(() => {
  const all = Array.from(document.querySelectorAll('*'));
  const itemsWindow = all.find(el => /ITEMS.*WINDOW 48H/.test(el.textContent?.trim() ?? '') && el.children.length < 5);
  return { found: !!itemsWindow, text: itemsWindow?.textContent?.trim().slice(0, 50) };
});

// Check 24: empty day column widths — do empty cols collapse?
R.check24 = await p.evaluate(() => {
  const all = Array.from(document.querySelectorAll('*'));
  // Find TONIGHT label (0 items) and a loaded day
  const tonightLabel = all.find(el => el.textContent?.trim() === 'TONIGHT' && el.children.length === 0);
  const wedLabel = all.find(el => /^WED \d+$/.test(el.textContent?.trim() ?? '') && el.children.length === 0);
  function colWidth(labelEl) {
    let el = labelEl;
    for (let i = 0; i < 6; i++) {
      el = el?.parentElement;
      const r = el?.getBoundingClientRect();
      if (r && r.height > 100) return Math.round(r.width);
    }
    return null;
  }
  return {
    tonightColW: colWidth(tonightLabel),
    wedColW: colWidth(wedLabel),
    pageScrollsH: document.body.scrollWidth > document.body.clientWidth,
  };
});

// Check 52: MM FAB
R.check52 = await p.evaluate(() => {
  const all = Array.from(document.querySelectorAll('*'));
  const mmPanel = Array.from(document.querySelectorAll('div')).find(d =>
    window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('MONEY MOVERS')
  );
  const fab = mmPanel?.querySelector('.wr-fab');
  return { mmFabFound: !!fab, ariaLabel: fab?.getAttribute('aria-label') };
});

// Schedule panel height (check 30 floor)
R.check30 = await p.evaluate(() => {
  const schedPanel = Array.from(document.querySelectorAll('div')).find(d =>
    window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('SCHEDULE') && !d.textContent?.includes('MONEY')
  );
  return schedPanel ? { h: Math.round(schedPanel.getBoundingClientRect().height), bottom: Math.round(schedPanel.getBoundingClientRect().bottom) } : { found: false };
});

writeFileSync('/Users/sankacoffie/.openclaw/workspace/c48g_post.json', JSON.stringify(R, null, 2));
console.log(JSON.stringify(R, null, 2));
await ctx.close();
await browser.close();

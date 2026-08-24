import { chromium } from 'playwright';

const URL = 'https://shirleyre.pages.dev/warroom';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Inject session
await page.evaluate(() => {
  localStorage.setItem('wr_session_exp_v2', String(Date.now() + 8 * 60 * 60 * 1000));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

const R = {};

// CHECK 5: Panel identifiers — what top-level panels exist?
R.check5_panels = await page.evaluate(() => {
  // Look for the main column containers
  const headings = Array.from(document.querySelectorAll('*')).filter(el => {
    const t = el.textContent?.trim() ?? '';
    const cs = window.getComputedStyle(el);
    return ['BATTLE PLAN','MONEY MOVERS','UNDER CONTRACT','LANDED','SCHEDULE','DUE','RECEIVABLES'].some(h => t === h) 
      && el.children.length < 3;
  });
  return headings.map(h => ({ text: h.textContent?.trim(), tag: h.tagName, class: h.className?.slice(0,60) }));
});

// CHECK 5 (restat): Column widths — are the 3 columns rendering at declared widths?
R.check5_columns = await page.evaluate(() => {
  const cols = Array.from(document.querySelectorAll('div')).filter(d => {
    const cs = window.getComputedStyle(d);
    return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && d.getBoundingClientRect().height > 400;
  });
  return cols.map(c => {
    const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), class: c.className?.slice(0,60) };
  }).slice(0,5);
});

// CHECK 21: FAB — full verification
R.check21 = await page.evaluate(() => {
  const fab = document.querySelector('.wr-fab');
  if (!fab) return { found: false };
  const wrap = document.querySelector('.wr-fab-desktop-wrap');
  const r = fab.getBoundingClientRect();
  const cs = window.getComputedStyle(fab);
  return {
    found: true,
    isDeliveredAsset: true, // has .wr-fab class (not hand-built button)
    w: Math.round(r.width),
    h: Math.round(r.height),
    ariaLabel: fab.getAttribute('aria-label'),
    ariaExpanded: fab.getAttribute('aria-expanded'),
    hasHalo: !!fab.querySelector('.wr-fab__halo'),
    hasBody: !!fab.querySelector('.wr-fab__body'),
    hasRim: !!fab.querySelector('.wr-fab__rim'),
    hasFace: !!fab.querySelector('.wr-fab__face'),
    hasBarsH: !!fab.querySelector('.wr-fab__bar--h'),
    hasBarsV: !!fab.querySelector('.wr-fab__bar--v'),
    wrappedInDesktopWrap: !!wrap,
    visible: r.width > 0 && r.height > 0,
  };
});

// CHECK 22: Terminal rows — no destination suffix
R.check22 = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('*'));
  // Find leaf-level elements containing "+ N MORE" 
  const terminals = all.filter(el => {
    const t = el.textContent?.trim() ?? '';
    return /^\+ \d+ MORE$/.test(t); // EXACTLY "+ N MORE" with no suffix
  });
  const withSuffix = all.filter(el => {
    const t = el.textContent?.trim() ?? '';
    return /^\+ \d+ MORE →/.test(t); // old format with suffix
  });
  return {
    cleanTerminals: terminals.map(el => el.textContent?.trim()),
    withArrowSuffix: withSuffix.map(el => el.textContent?.trim()),
    pass: terminals.length > 0 && withSuffix.length === 0,
    note: terminals.length === 0 && withSuffix.length === 0 ? 'No terminal rows at all (no overflow)' : ''
  };
});

// CHECK 24: Next48 overflow
R.check24 = await page.evaluate(() => {
  const bands = Array.from(document.querySelectorAll('div')).filter(d => {
    const r = d.getBoundingClientRect();
    return d.textContent?.includes('WINDOW 48H') && r.width > 100;
  });
  if (!bands.length) return { found: false };
  
  const band = bands.reduce((a,b) => {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return ra.width < rb.width ? a : b; // take the narrowest one (innermost with the label)
  });
  
  const r = band.getBoundingClientRect();
  const vw = window.innerWidth;
  
  return {
    found: true,
    bandW: Math.round(r.width),
    bandLeft: Math.round(r.left),
    bandRight: Math.round(r.right),
    viewportW: vw,
    overflows: r.right > vw + 5,
    note: r.right > vw + 5 ? `OVERFLOW: right=${Math.round(r.right)} > viewport=${vw}` : 'OK — no overflow'
  };
});

// Money movers count verification
R.moneyMoversCount = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('*'));
  const mmHeader = all.find(el => el.textContent?.trim() === 'MONEY MOVERS' && el.children.length < 3);
  if (!mmHeader) return { found: false };
  
  // Count address rows (the rendered data rows)
  const terminals = all.filter(el => /^\+ \d+ MORE/.test(el.textContent?.trim() ?? ''));
  const moreMatch = terminals[0]?.textContent?.match(/\+ (\d+) MORE/);
  const hiddenCount = moreMatch ? parseInt(moreMatch[1]) : 0;
  
  // Count address rows visible (rough: look for $ values in money movers section)
  return {
    terminalText: terminals[0]?.textContent?.trim(),
    hiddenCount,
    note: `Terminal row text: "${terminals[0]?.textContent?.trim() ?? 'none'}"`
  };
});

console.log(JSON.stringify(R, null, 2));
await browser.close();

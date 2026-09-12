import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const MEM = '/Users/sankacoffie/.openclaw/workspace/memory/';

// Measure labels on all 3 surfaces
const PAGES = [
  { name: 'deals-index', url: 'https://shirleyre.pages.dev/warroom/deals/' },
  { name: 'deals-new',   url: 'https://shirleyre.pages.dev/warroom/deals/new/' },
  { name: 'warroom-home', url: 'https://shirleyre.pages.dev/warroom/' },
];

// One browser context, navigate from PIN entry
const context = await browser.newContext();
const page = await context.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

// Enter PIN once
await page.goto('https://shirleyre.pages.dev/warroom/', { waitUntil: 'networkidle', timeout: 30000 });
for (const digit of ['1','8','8','7']) {
  await page.click(`button:has-text("${digit}")`);
  await page.waitForTimeout(200);
}
await page.waitForTimeout(4000);

async function measureRail(url, name) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  const data = await page.evaluate(() => {
    // find the DEALS label span (always present on all surfaces)
    const allSpans = [...document.querySelectorAll('span')];
    const dealsSpan = allSpans.find(el => {
      const t = el.textContent?.trim();
      return t === 'DEALS' && el.children.length === 0;
    });
    if (!dealsSpan) return { found: false };
    
    const cs = window.getComputedStyle(dealsSpan);
    const btn = dealsSpan.closest('button');
    const btnRect = btn?.getBoundingClientRect();
    
    return {
      found: true,
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      inlineStyle: dealsSpan.getAttribute('style'),
      slotHeight: btnRect ? Math.round(btnRect.height) : 'no btn',
    };
  });
  
  await page.screenshot({ path: MEM + `v159-${name}.png`, fullPage: false });
  return { surface: name, url, ...data };
}

const results = [];
for (const p of PAGES) {
  const r = await measureRail(p.url, p.name);
  results.push(r);
}

console.log(JSON.stringify(results, null, 2));
await browser.close();

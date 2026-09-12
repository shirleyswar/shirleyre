import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const MEM = '/Users/sankacoffie/.openclaw/workspace/memory/';

const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

// Enter PIN via warroom root first
await page.goto('https://shirleyre.pages.dev/warroom/', { waitUntil: 'networkidle', timeout: 30000 });
for (const digit of ['1','8','8','7']) {
  await page.click(`button:has-text("${digit}")`);
  await page.waitForTimeout(200);
}
await page.waitForTimeout(4000);

// Go to deals index
await page.goto('https://shirleyre.pages.dev/warroom/deals/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

// Get all rail label computed styles
const railData = await page.evaluate(() => {
  // Find all spans in the left rail area
  const rail = document.querySelector('[class*="rail"], nav, aside') || document.body;
  
  // Find spans with text like HOME, DEALS, SCHED, etc
  const railLabels = ['HOME','DEALS','SCHED','DEADLINES','MONEY','PORTF','ENTITY','PEOPLE','SET'];
  const results = [];
  
  const allSpans = [...document.querySelectorAll('span, button')];
  
  for (const label of railLabels) {
    const el = allSpans.find(el => el.textContent?.trim() === label);
    if (el) {
      const cs = window.getComputedStyle(el);
      const rect = el.closest('button')?.getBoundingClientRect();
      results.push({
        label,
        tag: el.tagName,
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        fontWeight: cs.fontWeight,
        letterSpacing: cs.letterSpacing,
        slotHeight: rect ? Math.round(rect.height) : 'no button parent',
        slotWidth: rect ? Math.round(rect.width) : 'n/a',
      });
    } else {
      results.push({ label, found: false });
    }
  }
  return results;
});

console.log('RAIL COMPUTED STYLES:');
console.log(JSON.stringify(railData, null, 2));

await page.screenshot({ path: MEM + 'v159-rail-pre.png', fullPage: false });
console.log('Screenshot saved');

await browser.close();

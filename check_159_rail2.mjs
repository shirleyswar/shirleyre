import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const MEM = '/Users/sankacoffie/.openclaw/workspace/memory/';

const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

await page.goto('https://shirleyre.pages.dev/warroom/', { waitUntil: 'networkidle', timeout: 30000 });
for (const digit of ['1','8','8','7']) {
  await page.click(`button:has-text("${digit}")`);
  await page.waitForTimeout(200);
}
await page.waitForTimeout(4000);

await page.goto('https://shirleyre.pages.dev/warroom/deals/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const railData = await page.evaluate(() => {
  const railLabels = ['HOME','DEALS','SCHED','DEADLINES','MONEY','PORTF','ENTITY','PEOPLE','SET'];
  const results = [];
  
  // find all spans that are direct children of buttons, with text in railLabels
  const allSpans = [...document.querySelectorAll('button > span, button span')];
  
  for (const label of railLabels) {
    // find the span whose trimmed text matches exactly
    const labelSpan = allSpans.find(el => {
      const t = el.textContent?.trim();
      return t === label && el.children.length === 0; // leaf span only
    });
    
    if (labelSpan) {
      const cs = window.getComputedStyle(labelSpan);
      const btn = labelSpan.closest('button');
      const btnRect = btn?.getBoundingClientRect();
      results.push({
        label,
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        fontWeight: cs.fontWeight,
        letterSpacing: cs.letterSpacing,
        fontFamily: cs.fontFamily.substring(0, 40),
        inlineStyle: labelSpan.getAttribute('style')?.substring(0, 200),
        slotHeight: btnRect ? Math.round(btnRect.height) : 'no btn',
      });
    } else {
      results.push({ label, found: false });
    }
  }
  return results;
});

console.log('RAIL LABEL SPAN COMPUTED:');
console.log(JSON.stringify(railData, null, 2));

await browser.close();

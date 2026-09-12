import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Go to deals index — PIN gate will intercept
await page.goto('https://shirleyre.pages.dev/warroom/deals/', { waitUntil: 'networkidle', timeout: 30000 });

// Enter PIN: 1887
for (const digit of ['1','8','8','7']) {
  await page.click(`button:has-text("${digit}")`);
  await page.waitForTimeout(200);
}

await page.waitForTimeout(3000);
await page.waitForLoadState('networkidle');

// Screenshot to see the deals index
await page.screenshot({ path: '/Users/sankacoffie/.openclaw/workspace/memory/158c-index-authed.png', fullPage: true });

// Also grab all visible text with "Cabela" or address info
const text = await page.evaluate(() => {
  return document.body.innerText;
});

const lines = text.split('\n').filter(l => l.trim() && (l.includes('Cabela') || l.includes('Pkwy') || l.includes('2703') || l.includes('ADDRESS')));
console.log('ADDRESS LINES:', JSON.stringify(lines, null, 2));

await browser.close();

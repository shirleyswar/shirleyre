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

// Crop to just the left rail (first 96px)
await page.screenshot({ path: MEM + 'v159-rail-post.png', fullPage: false, clip: { x: 0, y: 0, width: 110, height: 900 } });
// Full page for context
await page.screenshot({ path: MEM + 'v159-full-post.png', fullPage: false });

console.log('done');
await browser.close();

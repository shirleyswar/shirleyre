import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const DEAL_URL = 'https://shirleyre.pages.dev/warroom/deal/?id=7fda9c4c-a8e7-4cae-8c39-c503aec0c762';
const EDIT_URL = 'https://shirleyre.pages.dev/warroom/deals/new/?edit=7fda9c4c-a8e7-4cae-8c39-c503aec0c762';
const INDEX_URL = 'https://shirleyre.pages.dev/warroom/deals/';

async function withPin(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  const hasPinBtn = await page.$('button:has-text("1")');
  if (hasPinBtn) {
    for (const digit of ['1','8','8','7']) {
      await page.click(`button:has-text("${digit}")`);
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(4000);
    await page.waitForLoadState('networkidle');
  }
}

const MEM = '/Users/sankacoffie/.openclaw/workspace/memory/';

// 1) Index — deals list (158C.1)
const p1 = await browser.newPage();
await p1.setViewportSize({ width: 1440, height: 900 });
await withPin(p1, INDEX_URL);
await p1.screenshot({ path: MEM + 'v158c-index.png', fullPage: false });
console.log('✓ index screenshot');

// 2) Deal hero (158C.1 + 158C.3)
const p2 = await browser.newPage();
await p2.setViewportSize({ width: 1440, height: 900 });
await withPin(p2, DEAL_URL);
await p2.screenshot({ path: MEM + 'v158c-deal.png', fullPage: false });
console.log('✓ deal hero screenshot');

// 3) Edit page top (158C.2 + 158C.4)
const p3 = await browser.newPage();
await p3.setViewportSize({ width: 1440, height: 900 });
await withPin(p3, EDIT_URL);
await p3.waitForTimeout(2000);
await p3.screenshot({ path: MEM + 'v158c-edit-top.png', fullPage: false });
// scroll down to see city/state fields
await p3.evaluate(() => window.scrollTo(0, 600));
await p3.waitForTimeout(500);
await p3.screenshot({ path: MEM + 'v158c-edit-city.png', fullPage: false });
console.log('✓ edit screenshots');

await browser.close();
console.log('DONE');

import { chromium } from 'playwright';

const URL = 'https://29a87133.shirleyre.pages.dev/warroom3/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.evaluate(() => localStorage.setItem('wr3_session_exp', String(Date.now() + 8*60*60*1000)));
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(3000);

// Check what MoneyMoversSheet shows when fetched directly from the DB
// Instead of clicking the tile (which may not work headlessly),
// directly call the same query warroom3 uses for MM and compare with desktop
const mobileMMData = await p.evaluate(async () => {
  // This runs in the browser context — we can't call supabase directly
  // But we can see what the page has loaded
  const all = Array.from(document.querySelectorAll('*'));
  const tiles = all.filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 50 && r.width < 200 && r.height > 30 && r.height < 120 
      && el.textContent?.includes('MONEY MOVERS');
  });
  return {
    tileCount: tiles.length,
    tileText: tiles.map(el => el.textContent?.trim().slice(0,60)),
    tilePositions: tiles.map(el => ({ x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) })),
  };
});
console.log('MM tiles:', JSON.stringify(mobileMMData));

// Try clicking the tile position
if (mobileMMData.tilePositions.length > 0) {
  const tile = mobileMMData.tilePositions[0];
  await p.mouse.click(tile.x + tile.w/2, tile.y + tile.h/2);
  await p.waitForTimeout(2000);
  await p.screenshot({ path: '/Users/sankacoffie/.openclaw/workspace/check15_after_click.png' });
  
  const afterClick = await p.evaluate(() => {
    const body = document.body.innerText;
    return { bodySnippet: body.slice(0,300) };
  });
  console.log('After click:', JSON.stringify(afterClick));
}

await ctx.close();
await browser.close();

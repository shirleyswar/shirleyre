import { chromium } from 'playwright';

const PIN = '1887';
const URL = 'https://shirleyre.pages.dev/warroom';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Check if PIN gate is showing
const pinInput = await page.$('input[type="password"], input[placeholder*="PIN"], input[placeholder*="pin"]');
if (pinInput) {
  console.log('PIN gate found, unlocking...');
  await pinInput.type(PIN);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
} else {
  console.log('No PIN gate visible');
}

// Now check for Fab
const fabResult = await page.evaluate(() => {
  const fab = document.querySelector('.wr-fab');
  if (!fab) {
    // Try to find any button near Battle Plan header
    const buttons = Array.from(document.querySelectorAll('button'));
    const bpButtons = buttons.filter(b => {
      // look for buttons in battle plan area
      const r = b.getBoundingClientRect();
      return r.y < 400 && r.x > 200;
    });
    return { 
      found: false, 
      note: 'No .wr-fab',
      nearbyButtons: bpButtons.map(b => ({
        text: b.textContent?.trim().slice(0,20),
        class: b.className?.slice(0,50),
        ariaLabel: b.getAttribute('aria-label'),
        x: Math.round(b.getBoundingClientRect().x),
        y: Math.round(b.getBoundingClientRect().y),
      }))
    };
  }
  const r = fab.getBoundingClientRect();
  return {
    found: true,
    w: Math.round(r.width),
    h: Math.round(r.height),
    x: Math.round(r.x),
    y: Math.round(r.y),
    className: fab.className,
    ariaLabel: fab.getAttribute('aria-label'),
    hasHalo: !!fab.querySelector('.wr-fab__halo'),
    hasBars: !!fab.querySelector('.wr-fab__bar--h'),
    visible: r.width > 0 && r.height > 0,
  };
});

console.log('FAB result:', JSON.stringify(fabResult, null, 2));

// Check check5 — what are the panels?
const panels = await page.evaluate(() => {
  const panels = Array.from(document.querySelectorAll('[class*="panel"], [class*="Panel"]'));
  return panels.map(p => ({ class: p.className?.slice(0,60), tag: p.tagName })).slice(0,10);
});
console.log('Panels (check5):', JSON.stringify(panels));

// Check check22 — terminal rows without destination suffix
const terminals = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('*')).filter(el => /\+ \d+ MORE/.test(el.textContent?.trim() ?? '') && el.children.length === 0).map(el => el.textContent?.trim()).slice(0,5);
});
console.log('Terminal rows (check22):', JSON.stringify(terminals));

// Check Next48 overflow
const overflow = await page.evaluate(() => {
  const band = Array.from(document.querySelectorAll('div')).find(d => {
    const r = d.getBoundingClientRect();
    return r.height > 150 && r.height < 300 && d.textContent?.includes('WINDOW 48H');
  });
  if (!band) return { found: false };
  const r = band.getBoundingClientRect();
  return { 
    bandW: Math.round(r.width), 
    bandRight: Math.round(r.right),
    bandLeft: Math.round(r.left),
    viewportW: window.innerWidth,
    overflows: r.right > window.innerWidth
  };
});
console.log('Next48 overflow (check24):', JSON.stringify(overflow));

await browser.close();

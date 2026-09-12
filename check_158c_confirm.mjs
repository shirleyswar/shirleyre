import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const EDIT_URL = 'https://shirleyre.pages.dev/warroom/deals/new/?edit=7fda9c4c-a8e7-4cae-8c39-c503aec0c762';
const DEAL_URL = 'https://shirleyre.pages.dev/warroom/deal/?id=7fda9c4c-a8e7-4cae-8c39-c503aec0c762';
const MEM = '/Users/sankacoffie/.openclaw/workspace/memory/';

async function withPin(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  const hasPinBtn = await page.$('button:has-text("1")');
  if (hasPinBtn) {
    for (const digit of ['1','8','8','7']) {
      await page.click(`button:has-text("${digit}")`);
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle');
  }
}

// --- EDIT: click CONFIRM to see mini-slots ---
const p1 = await browser.newPage();
await p1.setViewportSize({ width: 1440, height: 900 });
await withPin(p1, EDIT_URL);
await p1.waitForTimeout(2000);

// Click CONFIRM button
const confirmBtn = await p1.$('button:has-text("CONFIRM")');
if (confirmBtn) {
  await confirmBtn.click();
  await p1.waitForTimeout(2000);
  console.log('Clicked CONFIRM');
} else {
  console.log('No CONFIRM button found');
}

await p1.screenshot({ path: MEM + 'v158c-edit-confirmed.png', fullPage: false });

// Check mini-slot text
const miniSlots = await p1.evaluate(() => {
  const all = [...document.querySelectorAll('span')];
  const labels = ['STREET', 'CARDINAL', 'NUMBER'];
  const result = {};
  for (const label of labels) {
    const labelEl = all.find(el => el.textContent?.trim() === label);
    if (labelEl) {
      const valueEl = labelEl.closest('div')?.querySelector('span:last-child') || labelEl.nextElementSibling;
      result[label] = valueEl?.textContent?.trim() ?? 'NOT FOUND';
    } else {
      result[label] = 'LABEL NOT FOUND';
    }
  }
  return result;
});
console.log('Mini-slots:', JSON.stringify(miniSlots));

// Check for any dash characters visible
const dashes = await p1.evaluate(() => {
  const all = [...document.querySelectorAll('span, div, p')];
  return all.filter(el => el.children.length === 0 && (el.textContent === '—' || el.textContent === '–' || el.textContent === '-'))
    .map(el => ({ text: el.textContent, class: el.className, tag: el.tagName }));
});
console.log('Dash elements visible:', JSON.stringify(dashes));

// --- DEAL PAGE: fresh session for launch control ---
const p2 = await browser.newPage();
await p2.setViewportSize({ width: 1440, height: 900 });
await withPin(p2, DEAL_URL);
await p2.waitForTimeout(3000);
await p2.screenshot({ path: MEM + 'v158c-deal-fresh.png', fullPage: false });

// scroll to bottom where launch might be
await p2.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p2.waitForTimeout(1000);
await p2.screenshot({ path: MEM + 'v158c-deal-bottom.png', fullPage: false });

const launchInfo = await p2.evaluate(() => {
  const launchBtn = document.querySelector('.wr-launch');
  const launchLabel = [...document.querySelectorAll('*')].find(el => el.textContent?.trim() === 'LAUNCH DEAL');
  const imgs = [...document.querySelectorAll('img')].filter(img => img.src?.includes('launch') || img.src?.includes('rest'));
  return {
    hasWrLaunch: !!launchBtn,
    launchLabelEl: launchLabel ? launchLabel.tagName + '.' + launchLabel.className : 'NOT FOUND',
    launchImgs: imgs.map(i => i.src),
    bodyText: document.body.innerText.includes('LAUNCH DEAL') ? 'LAUNCH DEAL TEXT FOUND' : 'NO LAUNCH DEAL TEXT'
  };
});
console.log('Launch info:', JSON.stringify(launchInfo));

await browser.close();
console.log('DONE');

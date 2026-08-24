import { chromium } from 'playwright';

const BASE = 'https://69c2c76d.shirleyre.pages.dev';
const browser = await chromium.launch({ headless: true });

// Check 64: deal page lease value
const ctx1 = await browser.newContext({ viewport: { width: 1909, height: 996 } });
const p1 = await ctx1.newPage();
await p1.goto(BASE + '/warroom/', { waitUntil: 'networkidle' });
await p1.waitForTimeout(1500);
await p1.evaluate(() => localStorage.setItem('wr_session_exp_v2', String(Date.now() + 8*60*60*1000)));
await p1.reload({ waitUntil: 'networkidle' });
await p1.waitForTimeout(3000);

// Click first UC row to open deal page (UC rows now open /warroom/deal?id=...)
const ucRow = await p1.evaluate(() => {
  const ucPanel = Array.from(document.querySelectorAll('div')).find(d =>
    window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('UNDER CONTRACT')
  );
  const rows = ucPanel ? Array.from(ucPanel.querySelectorAll('div')).filter(d =>
    window.getComputedStyle(d).cursor === 'pointer' && d.getBoundingClientRect().height > 30 && d.getBoundingClientRect().height < 120
  ) : [];
  const r = rows[0]?.getBoundingClientRect();
  return r ? { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) } : null;
});

let dealPageResult = null;
if (ucRow) {
  await p1.mouse.click(ucRow.x, ucRow.y);
  await p1.waitForURL('**/warroom/deal**', { timeout: 5000 }).catch(() => {});
  await p1.waitForTimeout(2000);
  dealPageResult = await p1.evaluate(() => {
    const body = document.body.innerText;
    return {
      url: window.location.href,
      hasDealValue: /DEAL VALUE/.test(body),
      bodySnippet: body.slice(0, 300),
    };
  });
}

// Check 59: modal opens with fill for schedule
const schedFab = await p1.evaluate(() => {
  // go back to warroom first
  return window.location.href;
});

await p1.goto(BASE + '/warroom/', { waitUntil: 'networkidle' });
await p1.waitForTimeout(1500);
await p1.evaluate(() => localStorage.setItem('wr_session_exp_v2', String(Date.now() + 8*60*60*1000)));
await p1.reload({ waitUntil: 'networkidle' });
await p1.waitForTimeout(3000);

// Find SCHEDULE FAB and click it
const schedFabPos = await p1.evaluate(() => {
  const all = Array.from(document.querySelectorAll('.wr-fab'));
  // Find the one in/near SCHEDULE panel
  const schedPanel = Array.from(document.querySelectorAll('div')).find(d =>
    window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('SCHEDULE') && !d.textContent?.includes('MONEY')
  );
  const fab = schedPanel?.querySelector('.wr-fab');
  const r = fab?.getBoundingClientRect();
  return r ? { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), found: true } : { found: false };
});

let modalResult = null;
if (schedFabPos.found) {
  await p1.mouse.click(schedFabPos.x, schedFabPos.y);
  await p1.waitForTimeout(1000);
  modalResult = await p1.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]');
    return {
      modalOpen: !!modal,
      modalHeader: modal?.querySelector('span')?.textContent?.trim(),
      hasTimeField: !!modal?.querySelector('input[type="time"]'),
      hasTitleField: !!modal?.querySelector('textarea'),
    };
  });
}

console.log(JSON.stringify({ dealPageResult, schedFabPos, modalResult }, null, 2));
await ctx1.close();
await browser.close();

import { chromium } from 'playwright';

const URL = 'https://dca8c8c8.shirleyre.pages.dev/warroom/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1909, height: 996 } });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.evaluate(() => localStorage.setItem('wr_session_exp_v2', String(Date.now() + 8*60*60*1000)));
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(4000);

const R = await p.evaluate(() => {
  const all = Array.from(document.querySelectorAll('*'));

  // BP task row title — should now be 17px (DS3)
  const bpPanel = Array.from(document.querySelectorAll('div')).find(d =>
    window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('BATTLE PLAN')
  );
  const bpTitleEls = bpPanel ? Array.from(bpPanel.querySelectorAll('*')).filter(el => {
    const r = el.getBoundingClientRect();
    const t = el.textContent?.trim() ?? '';
    return t.length > 5 && t.length < 80 && el.children.length === 0 && r.width > 100 && r.y > 450;
  }) : [];
  const bpTitle = bpTitleEls.find(el => el.textContent?.includes('Finalize') || el.textContent?.includes('Tax') || el.textContent?.includes('SOJI'));

  // MM address row — DS3 — should also be 17px
  const mmAddress = all.find(el => el.textContent?.includes('Government St') && el.children.length === 0);

  // RECEIVABLES header
  const recvHeader = all.find(el => el.textContent?.trim() === 'RECEIVABLES' && el.children.length < 3);

  // No partial rows (check 3 carries over from 48g)
  const vBottom = window.innerHeight;
  const clipped = Array.from(document.querySelectorAll('div,span')).filter(el => {
    const r = el.getBoundingClientRect();
    return r.height > 10 && r.width > 100 && r.top < vBottom && r.bottom > vBottom + 2;
  });

  function cs(el) {
    if (!el) return null;
    const s = window.getComputedStyle(el);
    return { fontSize: s.fontSize, fontWeight: s.fontWeight, text: el.textContent?.trim().slice(0, 35) };
  }

  return {
    bpTaskTitle: cs(bpTitle),
    mmAddressRow: cs(mmAddress),
    recvHeader: cs(recvHeader),
    clippedCount: clipped.length,
  };
});

console.log(JSON.stringify(R, null, 2));
await ctx.close();
await browser.close();

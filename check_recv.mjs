import { chromium } from 'playwright';
const URL = 'https://shirleyre.pages.dev/warroom/';
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
  // Find RECEIVABLES panel
  const recvPanel = Array.from(document.querySelectorAll('div')).find(d =>
    window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('RECEIVABLES') && d.textContent?.includes('COLLECTED')
  );
  const figures = recvPanel ? Array.from(recvPanel.querySelectorAll('*')).filter(el => {
    const t = el.textContent?.trim() ?? '';
    return /^\$[\d,]+$/.test(t) && el.children.length === 0;
  }) : [];
  
  // Also check BattlePlan panel for raw fontSize
  const bpPanel = Array.from(document.querySelectorAll('div')).find(d =>
    window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('BATTLE PLAN')
  );
  const bpTaskTitles = bpPanel ? Array.from(bpPanel.querySelectorAll('*')).filter(el => {
    const r = el.getBoundingClientRect();
    const t = el.textContent?.trim() ?? '';
    return t.length > 5 && t.length < 60 && el.children.length === 0 && r.width > 100;
  }) : [];
  
  // Check for raw fontSize in rendered elements (not from named levels)
  const bpTitleEl = bpTaskTitles.find(el => el.textContent?.includes('Finalize') || el.textContent?.includes('Tax'));
  
  return {
    recvFigures: figures.map(el => {
      const s = window.getComputedStyle(el);
      return { text: el.textContent?.trim(), fontSize: s.fontSize, fontWeight: s.fontWeight };
    }),
    bpTaskTitle: bpTitleEl ? (() => { const s = window.getComputedStyle(bpTitleEl); return { text: bpTitleEl.textContent?.trim().slice(0,40), fontSize: s.fontSize, fontWeight: s.fontWeight }; })() : null,
    // Check mm header commission total (the "$214K" that showed as 11.5px — that might be wrong)
    mmHeaderTotal: (() => {
      const mmHeader = Array.from(document.querySelectorAll('*')).find(el => el.textContent?.trim() === 'MONEY MOVERS' && el.children.length < 3);
      if (!mmHeader) return null;
      const panel = mmHeader.closest('[style*="border-radius: 14px"]') || mmHeader.parentElement?.parentElement;
      const allInHeader = panel ? Array.from(panel.querySelectorAll('*')).filter(el => {
        const r = el.getBoundingClientRect();
        return r.height < 60 && r.y < 500 && el.children.length === 0 && /\$/.test(el.textContent ?? '');
      }) : [];
      return allInHeader.map(el => { const s = window.getComputedStyle(el); return { text: el.textContent?.trim(), fontSize: s.fontSize }; });
    })(),
  };
});
console.log(JSON.stringify(R, null, 2));
await ctx.close();
await browser.close();

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
  
  // Find DEADLINES panel specifically and its terminal
  const deadlinesHeader = all.find(el => el.textContent?.trim() === 'DEADLINES' && el.children.length < 3);
  let deadlinesPanel = deadlinesHeader;
  for (let i = 0; i < 6; i++) {
    deadlinesPanel = deadlinesPanel?.parentElement;
    if (deadlinesPanel && window.getComputedStyle(deadlinesPanel).borderRadius === '14px') break;
  }
  const deadlinesTerminal = deadlinesPanel ? Array.from(deadlinesPanel.querySelectorAll('*')).find(el => /^\+ \d+ MORE/.test(el.textContent?.trim() ?? '') && el.children.length === 0) : null;
  const deadlinesRows = deadlinesPanel ? Array.from(deadlinesPanel.querySelectorAll('*')).filter(el => /^\d+D LATE$/.test(el.textContent?.trim() ?? '') && el.children.length === 0) : [];
  
  // RECEIVABLES scroll
  const recvPanel = Array.from(document.querySelectorAll('div')).find(d => window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('RECEIVABLES') && d.textContent?.includes('COLLECTED'));
  
  // UNDER CONTRACT panel bottom
  const ucPanel = Array.from(document.querySelectorAll('div')).find(d => window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('UNDER CONTRACT'));
  
  // Check 30: does the allocator see actual row counts?
  // Look at SCHEDULE panel height and DUE/DEADLINES panel height
  const schedPanel = Array.from(document.querySelectorAll('div')).find(d => window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('SCHEDULE') && d.textContent?.includes('NOTHING SCHEDULED'));
  const duePanel = Array.from(document.querySelectorAll('div')).find(d => window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('DEADLINES'));
  
  return {
    deadlines: {
      terminalText: deadlinesTerminal?.textContent?.trim(),
      overdueRows: deadlinesRows.map(el => el.textContent?.trim()),
      panelBottom: deadlinesPanel ? Math.round(deadlinesPanel.getBoundingClientRect().bottom) : null,
    },
    receivables: recvPanel ? { scrollH: recvPanel.scrollHeight, clientH: recvPanel.clientHeight } : null,
    underContract: ucPanel ? { bottom: Math.round(ucPanel.getBoundingClientRect().bottom), h: Math.round(ucPanel.getBoundingClientRect().height) } : null,
    schedule: schedPanel ? { h: Math.round(schedPanel.getBoundingClientRect().height), bottom: Math.round(schedPanel.getBoundingClientRect().bottom) } : null,
    deadlinesPanel: duePanel ? { h: Math.round(duePanel.getBoundingClientRect().height), bottom: Math.round(duePanel.getBoundingClientRect().bottom) } : null,
    viewportH: window.innerHeight,
  };
});

console.log(JSON.stringify(R, null, 2));
await ctx.close();
await browser.close();

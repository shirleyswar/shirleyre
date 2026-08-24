import { chromium } from 'playwright';

const URL = 'https://0364e728.shirleyre.pages.dev/warroom/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1909, height: 996 } });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.evaluate(() => localStorage.setItem('wr_session_exp_v2', String(Date.now() + 8*60*60*1000)));
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(4000);

const R = await p.evaluate(() => {
  const vBottom = window.innerHeight;
  
  // Find clipped element
  const clipped = Array.from(document.querySelectorAll('div,span')).filter(el => {
    const r = el.getBoundingClientRect();
    return r.height > 10 && r.width > 100 && r.top < vBottom && r.bottom > vBottom + 2;
  });

  // Band row title: find actual task/event titles in the NEXT 48 band
  // The band is between y=130 and y=400, items have colored spine bars
  const bandPanel = Array.from(document.querySelectorAll('div')).find(d =>
    d.textContent?.includes('WINDOW 48H') && d.textContent?.includes('TONIGHT') && d.getBoundingClientRect().height < 280
  );
  const bandTitles = bandPanel ? Array.from(bandPanel.querySelectorAll('*')).filter(el => {
    const t = el.textContent?.trim() ?? '';
    const r = el.getBoundingClientRect();
    return t.length > 5 && t.length < 80 && el.children.length === 0 && r.width > 80
      && !/(TONIGHT|TUE|WED|THU|FRI|SAT|SUN|JUST BEYOND|WINDOW|ITEMS|ITEMS ·|CLEAR|NEXT 48|\d+D|AM|PM|\+ \d)/.test(t)
      && !/^\d+$/.test(t);
  }) : [];

  // UC panel rows — find cursor:pointer rows
  const ucPanel = Array.from(document.querySelectorAll('div')).find(d =>
    window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('UNDER CONTRACT')
  );
  const ucRows = ucPanel ? Array.from(ucPanel.querySelectorAll('div')).filter(d => {
    return window.getComputedStyle(d).cursor === 'pointer' && d.getBoundingClientRect().height > 30;
  }) : [];

  return {
    clipped: clipped.slice(0,3).map(el => ({ text: el.textContent?.trim().slice(0,40), bottom: Math.round(el.getBoundingClientRect().bottom) })),
    bandTitleSamples: bandTitles.slice(0,3).map(el => ({ text: el.textContent?.trim().slice(0,40), fontSize: window.getComputedStyle(el).fontSize })),
    ucClickableRowCount: ucRows.length,
    ucRowSample: ucRows[0] ? ucRows[0].textContent?.trim().slice(0,60) : null,
  };
});
console.log(JSON.stringify(R, null, 2));
await ctx.close();
await browser.close();

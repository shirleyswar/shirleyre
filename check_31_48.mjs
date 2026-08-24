import { chromium } from 'playwright';

const URL = 'https://29a87133.shirleyre.pages.dev/warroom/';
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

  // Check 32: BP header — late count in accent color, total in text-low
  const bpPanel = Array.from(document.querySelectorAll('div')).find(d =>
    window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('BATTLE PLAN')
  );
  const bpHeaderEls = bpPanel ? Array.from(bpPanel.querySelectorAll('span,div')).filter(el => {
    const r = el.getBoundingClientRect();
    return r.height < 60 && r.y < 500 && el.children.length === 0;
  }).slice(0,10) : [];

  // Check 33: MM header — count left, dollar total right
  const mmPanel = Array.from(document.querySelectorAll('div')).find(d =>
    window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('MONEY MOVERS')
  );
  const mmHeaderArea = mmPanel ? mmPanel.textContent?.trim().slice(0,80) : null;

  // Check 36: UC header — shows next closing
  const ucPanel = Array.from(document.querySelectorAll('div')).find(d =>
    window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('UNDER CONTRACT')
  );
  const ucHeaderText = ucPanel ? Array.from(ucPanel.querySelectorAll('span')).find(el => /CLOSES|SEP|AUG|OCT|NOV|DEC/.test(el.textContent ?? ''))?.textContent?.trim() : null;

  // Check 34: abbreviated money — verify still working
  const hasK = /\$\d+K/.test(document.body.innerText);
  const hasM = /\$[\d.]+M/.test(document.body.innerText);

  // Check 46: DEADLINES still correct
  const deadlinesHeader = all.find(el => el.textContent?.trim() === 'DEADLINES' && el.children.length < 3);

  // Check 49: no em-dash names
  const nameDashes = all.filter(el => (el.textContent?.trim() === '— · hot' || el.textContent?.trim() === '— · under contract') && el.children.length === 0);

  // Check 37: DEADLINES rows — kind right-aligned
  const dlPanel = Array.from(document.querySelectorAll('div')).find(d =>
    window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('DEADLINES')
  );
  const inspectionEl = dlPanel ? Array.from(dlPanel.querySelectorAll('*')).find(el => el.textContent?.trim() === 'INSPECTION' && el.children.length === 0) : null;
  const inspectionStyle = inspectionEl ? (() => { const s = window.getComputedStyle(inspectionEl); return { textAlign: s.textAlign, float: s.float }; })() : null;

  return {
    bpHeaderSample: bpHeaderEls.slice(0,5).map(el => ({ text: el.textContent?.trim(), color: window.getComputedStyle(el).color })),
    mmHeaderArea,
    ucHeaderHasClosing: !!ucHeaderText,
    ucHeaderText,
    hasK,
    hasM,
    deadlinesFound: !!deadlinesHeader,
    nameDashCount: nameDashes.length,
    inspectionStyle,
  };
});

console.log(JSON.stringify(R, null, 2));
await ctx.close();
await browser.close();

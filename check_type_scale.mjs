import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

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
  function measure(selector, description, findFn) {
    let el;
    if (findFn) {
      el = findFn();
    } else {
      el = document.querySelector(selector);
    }
    if (!el) return { description, found: false };
    const cs = window.getComputedStyle(el);
    return {
      description,
      found: true,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontFamily: cs.fontFamily?.slice(0, 40),
      text: el.textContent?.trim().slice(0, 30),
    };
  }

  const all = Array.from(document.querySelectorAll('*'));

  // Panel header labels (DT1 = 15px mono)
  const mmHeader = all.find(el => el.textContent?.trim() === 'MONEY MOVERS' && el.children.length < 3);
  const bpHeader = all.find(el => el.textContent?.trim() === 'BATTLE PLAN' && el.children.length < 3);
  const ucHeader = all.find(el => el.textContent?.trim() === 'UNDER CONTRACT' && el.children.length < 3);
  const dlHeader = all.find(el => el.textContent?.trim() === 'DEADLINES' && el.children.length < 3);
  const schedHeader = all.find(el => el.textContent?.trim() === 'SCHEDULE' && el.children.length < 3);
  const recvHeader = all.find(el => el.textContent?.trim() === 'RECEIVABLES' && el.children.length < 3);

  // MM row address (DS3 = 15.5px display)
  const mmRows = all.filter(el => el.textContent?.includes('Government St') && el.children.length === 0);
  const mmAddress = mmRows[0];

  // MM value/comm figures (DM1 = 15px mono)
  const mmValues = all.filter(el => /^\$\d+/.test(el.textContent?.trim() ?? '') && el.children.length === 0);

  // UC row address (DS3)
  const ucRows = all.filter(el => el.textContent?.includes('Bluebonnet') && el.children.length === 0);

  // DEADLINES row title (DS3)
  const dlRows = all.filter(el => el.textContent?.trim() === 'Lease Draft' && el.children.length === 0);

  // DEADLINES day-count gutter (DT7 = 10.5px mono)
  const dlDayCounts = all.filter(el => /^\d+D LATE$/.test(el.textContent?.trim() ?? '') && el.children.length === 0);

  // DEADLINES kind label (DT7)
  const dlKinds = all.filter(el => el.textContent?.trim() === 'INSPECTION' && el.children.length === 0);

  // Battle Plan row title (should be DS3/DS4 from desktopTypes — or is it BattlePlanPanel's 16px literal?)
  const bpTitles = all.filter(el => {
    const t = el.textContent?.trim() ?? '';
    return t.length > 5 && t.length < 60 && el.children.length === 0 &&
      el.getBoundingClientRect().x > 100 && el.getBoundingClientRect().x < 500 &&
      el.getBoundingClientRect().y > 500;
  });

  // RECEIVABLES figures (DM0 = 34.5px)
  const recvFigures = all.filter(el => /^\$[\d,]+$/.test(el.textContent?.trim() ?? '') && el.children.length === 0 &&
    el.getBoundingClientRect().y > 850);

  // Band row titles (DS5 = 13px)
  const bandTitles = all.filter(el => {
    const r = el.getBoundingClientRect();
    return r.y > 130 && r.y < 400 && r.x > 200 && el.children.length === 0 && el.textContent?.trim().length > 3;
  });

  function cs(el) {
    if (!el) return null;
    const s = window.getComputedStyle(el);
    return { fontSize: s.fontSize, fontWeight: s.fontWeight, text: el.textContent?.trim().slice(0, 35) };
  }

  return {
    panelHeaders: {
      moneyMovers: cs(mmHeader),
      battlePlan: cs(bpHeader),
      underContract: cs(ucHeader),
      deadlines: cs(dlHeader),
      schedule: cs(schedHeader),
      receivables: cs(recvHeader),
    },
    mmAddressRow: cs(mmAddress),
    mmFirstValue: cs(mmValues[0]),
    mmFirstComm: cs(mmValues[1]),
    ucAddressRow: cs(ucRows[0]),
    dlTitle: cs(dlRows[0]),
    dlDayCount: cs(dlDayCounts[0]),
    dlKind: cs(dlKinds[0]),
    bpFirstTitle: cs(bpTitles.find(el => el.textContent?.trim().length > 5)),
    recvFirstFigure: cs(recvFigures[0]),
    bandFirstTitle: cs(bandTitles.find(el => el.textContent?.trim().length > 5 && !/WINDOW|NEXT|ITEMS|CLEAR|TONIGHT|MON|TUE|WED|THU|FRI|SAT|SUN|JUST/.test(el.textContent?.trim() ?? ''))),
  };
});

writeFileSync('/Users/sankacoffie/.openclaw/workspace/c48f_typescale.json', JSON.stringify(R, null, 2));
console.log(JSON.stringify(R, null, 2));
await ctx.close();
await browser.close();

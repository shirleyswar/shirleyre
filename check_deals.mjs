import { chromium } from 'playwright';

const BASE = 'https://fdb26705.shirleyre.pages.dev';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1909, height: 996 } });
const p = await ctx.newPage();
await p.goto(BASE + '/warroom/deals/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.evaluate(() => localStorage.setItem('wr_session_exp_v2', String(Date.now() + 8*60*60*1000)));
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(4000);

await p.screenshot({ path: '/Users/sankacoffie/.openclaw/workspace/deals_index.png' });

const R = await p.evaluate(() => {
  const body = document.body.innerText;
  const all = Array.from(document.querySelectorAll('*'));
  
  // Filter segments
  const filterSegs = ['ALL','HOT','UC'].map(seg => 
    all.find(el => el.textContent?.trim() === seg && el.children.length < 3)
  ).filter(Boolean).map(el => el?.textContent?.trim());
  
  // TYPE dropdown
  const typeEl = all.find(el => /TYPE/.test(el.textContent?.trim() ?? '') && el.children.length < 5);
  
  // Column headers
  const colHeaders = ['ADDRESS','CLIENT','LACDB','VALUE','COMMISSION','DROPBOX'].map(h =>
    all.find(el => el.textContent?.trim() === h && el.children.length < 3)
  ).filter(Boolean).map(el => el?.textContent?.trim());
  
  // Star control
  const starEl = all.find(el => /★|⭐|star/i.test(el.textContent ?? '') && el.getBoundingClientRect().width > 40);
  
  // Group headers
  const portfolios = all.find(el => el.textContent?.trim().startsWith('PORTFOLIOS') && el.children.length < 5);
  const dealsGroup = all.find(el => el.textContent?.trim().startsWith('DEALS ') && el.children.length < 5);
  
  // Deal rows — check if address formatter is working (no "Blue Cross" duplicates)
  const addressCells = all.filter(el => {
    const t = el.textContent?.trim() ?? '';
    return t.length > 5 && t.length < 60 && el.children.length === 0 &&
      !/(ALL|HOT|UC|TYPE|ADDRESS|CLIENT|VALUE|COMMISSION|DROPBOX|DEALS|PORTFOLIOS|★)/.test(t) &&
      el.getBoundingClientRect().x < 600 && el.getBoundingClientRect().y > 200;
  });
  
  return {
    url: window.location.href,
    filterSegments: filterSegs,
    typeFound: !!typeEl,
    columnHeaders: colHeaders,
    starFound: !!starEl,
    portfoliosGroup: portfolios?.textContent?.trim().slice(0,30),
    dealsGroup: dealsGroup?.textContent?.trim().slice(0,30),
    bodySnippet: body.slice(0, 400),
    addressSamples: addressCells.slice(0,5).map(el => el.textContent?.trim()),
    railDealsSlot: all.find(el => el.textContent?.trim() === 'DEALS' && el.getBoundingClientRect().x < 150) ? 'found' : 'not found',
  };
});

console.log(JSON.stringify(R, null, 2));
await ctx.close();
await browser.close();

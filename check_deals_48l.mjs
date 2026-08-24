import { chromium } from 'playwright';

const BASE = 'https://936fd3c1.shirleyre.pages.dev';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1909, height: 996 } });
const p = await ctx.newPage();
await p.goto(BASE + '/warroom/deals/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.evaluate(() => localStorage.setItem('wr_session_exp_v2', String(Date.now() + 8*60*60*1000)));
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(5000);

await p.screenshot({ path: '/Users/sankacoffie/.openclaw/workspace/deals_build_48l_auth.png', fullPage: false });

const R = await p.evaluate(() => {
  const body = document.body.innerText;
  const all = Array.from(document.querySelectorAll('*'));
  
  const tabs = ['LISTINGS','TENANTS','BUYERS','TARGETS'].map(t =>
    all.find(el => el.textContent?.trim().startsWith(t) && el.children.length < 5)?.textContent?.trim().slice(0,20)
  ).filter(Boolean);
  
  const filters = ['ALL','HOT','UC','MONEY'].map(f =>
    all.find(el => el.textContent?.trim().startsWith(f) && el.children.length < 3)?.textContent?.trim()
  ).filter(Boolean);
  
  const colHeaders = ['ADDRESS','CLIENT','DEADLINE','LACDB','TASK','RANK','VALUE','COMM','DBX'].map(h =>
    all.find(el => el.textContent?.trim() === h && el.children.length < 3)
  ).filter(Boolean).map(el => el?.textContent?.trim());
  
  const portfolios = all.find(el => el.textContent?.trim().startsWith('PORTFOLIOS') && el.children.length < 5);
  const dealsGroup = all.find(el => el.textContent?.trim().startsWith('DEALS ') && el.children.length < 5);
  
  // Count checker
  const bookCount = body.match(/(\d+) OF \d+/)?.[1];
  
  // UC terminal on home page - not relevant here but check rail
  const railDeals = all.find(el => el.textContent?.trim() === 'DEALS' && el.getBoundingClientRect().x < 150);
  const railPeople = all.find(el => el.textContent?.trim() === 'PEOPLE' && el.getBoundingClientRect().x < 150);
  
  return {
    tabs,
    filters,
    colHeaders,
    portfoliosText: portfolios?.textContent?.trim().slice(0,30),
    dealsGroupText: dealsGroup?.textContent?.trim().slice(0,30),
    bodySnippet: body.slice(0, 500),
    railDealsFound: !!railDeals,
    railPeopleFound: !!railPeople,
  };
});

console.log(JSON.stringify(R, null, 2));
await ctx.close();
await browser.close();

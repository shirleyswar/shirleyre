import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'https://b0005dd4.shirleyre.pages.dev';
const browser = await chromium.launch({ headless: true });

async function getPage(w, h, url) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    localStorage.setItem('wr_session_exp_v2', String(Date.now() + 8*60*60*1000));
    localStorage.setItem('wr3_session_exp', String(Date.now() + 8*60*60*1000));
  });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(4000);
  return { page: p, ctx };
}

const R = {};

// Main warroom checks at 1909x996
{
  const { page: p, ctx } = await getPage(1909, 996, BASE + '/warroom/');
  await p.screenshot({ path: '/Users/sankacoffie/.openclaw/workspace/c48k_home.png' });

  // Check 3 / clipping
  R.check3 = await p.evaluate(() => {
    const vBottom = window.innerHeight;
    const clipped = Array.from(document.querySelectorAll('div,span')).filter(el => {
      const r = el.getBoundingClientRect();
      return r.height > 10 && r.width > 100 && r.top < vBottom && r.bottom > vBottom + 2;
    });
    return { clippedCount: clipped.length, clipped: clipped.slice(0,3).map(el => ({ text: el.textContent?.trim().slice(0,40), bottom: Math.round(el.getBoundingClientRect().bottom) })) };
  });

  // Band content — does it show contract_deadlines now?
  R.bandContent = await p.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const bandPanel = Array.from(document.querySelectorAll('div')).find(d =>
      d.textContent?.includes('WINDOW 48H') && d.getBoundingClientRect().height < 280
    );
    return {
      bandText: bandPanel?.textContent?.trim().slice(0, 200),
    };
  });

  // Schedule vs Deadlines panel heights
  R.colC = await p.evaluate(() => {
    const schedPanel = Array.from(document.querySelectorAll('div')).find(d =>
      window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('SCHEDULE') && !d.textContent?.includes('MONEY')
    );
    const dlPanel = Array.from(document.querySelectorAll('div')).find(d =>
      window.getComputedStyle(d).borderRadius === '14px' && d.textContent?.includes('DEADLINES')
    );
    return {
      schedH: schedPanel ? Math.round(schedPanel.getBoundingClientRect().height) : null,
      dlH: dlPanel ? Math.round(dlPanel.getBoundingClientRect().height) : null,
    };
  });

  // Rail has DEALS slot
  R.railDeals = await p.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const dealsSlot = all.find(el => el.textContent?.trim() === 'DEALS' && el.children.length < 3);
    return { found: !!dealsSlot };
  });

  // Check 15 mobile — now run on mobile viewport
  await ctx.close();
}

// Mobile check 15
{
  const { page: p, ctx } = await getPage(390, 844, BASE + '/warroom3/');
  await p.screenshot({ path: '/Users/sankacoffie/.openclaw/workspace/c48k_mobile.png' });

  R.check15 = await p.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    // Find dollar amounts in MM context
    const body = document.body.innerText;
    return {
      hasMM: body.includes('MONEY MOVERS') || body.includes('Money Movers'),
      bodySnippet: body.slice(0, 500),
    };
  });

  await ctx.close();
}

// Deals page
{
  const { page: p, ctx } = await getPage(1909, 996, BASE + '/warroom/deals/');
  await p.screenshot({ path: '/Users/sankacoffie/.openclaw/workspace/c48k_deals.png' });

  R.dealsPage = await p.evaluate(() => {
    const body = document.body.innerText;
    const all = Array.from(document.querySelectorAll('*'));
    const tabs = all.filter(el => ['ACTIVE','PIPELINE','IN REVIEW','IN SERVICE'].includes(el.textContent?.trim() ?? '') && el.children.length < 3);
    return {
      url: window.location.href,
      bodySnippet: body.slice(0, 300),
      tabsFound: tabs.map(el => el.textContent?.trim()),
    };
  });

  await ctx.close();
}

writeFileSync('/Users/sankacoffie/.openclaw/workspace/c48k.json', JSON.stringify(R, null, 2));
console.log(JSON.stringify(R, null, 2));
await browser.close();

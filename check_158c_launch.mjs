import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const MEM = '/Users/sankacoffie/.openclaw/workspace/memory/';
const DEAL_URL = 'https://shirleyre.pages.dev/warroom/deal/?id=7fda9c4c-a8e7-4cae-8c39-c503aec0c762';

// Use ONE page — enter PIN on warroom root, then navigate to deal
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

// Step 1: load warroom root to get PIN gate
await page.goto('https://shirleyre.pages.dev/warroom/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1000);

// Enter PIN 1887
for (const digit of ['1','8','8','7']) {
  await page.click(`button:has-text("${digit}")`);
  await page.waitForTimeout(300);
}
await page.waitForTimeout(4000);
await page.waitForLoadState('networkidle');
console.log('PIN entered, current URL:', page.url());

// Step 2: navigate to deal page (same session/context)
await page.goto(DEAL_URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);
console.log('Deal page URL:', page.url());

await page.screenshot({ path: MEM + 'v158c-launch-1.png', fullPage: false });

// scroll to see all content
await page.evaluate(() => window.scrollTo(0, 400));
await page.waitForTimeout(500);
await page.screenshot({ path: MEM + 'v158c-launch-2.png', fullPage: false });

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(500);
await page.screenshot({ path: MEM + 'v158c-launch-3.png', fullPage: false });

// Check for launch control
const launchInfo = await page.evaluate(() => {
  const launchBtn = document.querySelector('.wr-launch');
  const allText = document.body.innerText;
  const hasLaunchText = allText.includes('LAUNCH DEAL') || allText.includes('LAUNCH');
  const imgs = [...document.querySelectorAll('img')].filter(i => i.src.includes('launch') || i.src.includes('rest'));
  const sessionExpired = allText.includes('SESSION EXPIRED');
  return {
    hasWrLaunch: !!launchBtn,
    wrLaunchHTML: launchBtn ? launchBtn.outerHTML.substring(0, 200) : null,
    hasLaunchText,
    launchImgs: imgs.map(i => i.src),
    sessionExpired,
    pageTitle: document.title,
    bodySnippet: allText.substring(0, 500)
  };
});
console.log('Launch info:', JSON.stringify(launchInfo, null, 2));

await browser.close();
console.log('DONE');

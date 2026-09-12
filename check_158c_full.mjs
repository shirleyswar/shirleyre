import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const DEAL_URL = 'https://shirleyre.pages.dev/warroom/deal/?id=7fda9c4c-a8e7-4cae-8c39-c503aec0c762';
const EDIT_URL = 'https://shirleyre.pages.dev/warroom/deals/new/?edit=7fda9c4c-a8e7-4cae-8c39-c503aec0c762';

async function withPin(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  // check if PIN gate is present
  const hasPinBtn = await page.$('button:has-text("1")');
  if (hasPinBtn) {
    for (const digit of ['1','8','8','7']) {
      await page.click(`button:has-text("${digit}")`);
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
  }
}

// --- Check deal page hero ---
const page1 = await browser.newPage();
await withPin(page1, DEAL_URL);
await page1.screenshot({ path: '/Users/sankacoffie/.openclaw/workspace/memory/158c-deal-hero.png', fullPage: false });
const heroText = await page1.evaluate(() => {
  // find hero address / title area
  const all = [...document.querySelectorAll('*')];
  return all.filter(el => el.children.length === 0 && el.innerText && (el.innerText.includes('Cabela') || el.innerText.includes('2703') || el.innerText.includes('Pkwy'))).map(el => el.innerText.trim()).join('\n');
});
console.log('HERO address text:', heroText);

// Check LAUNCH DEAL area
const launchHTML = await page1.evaluate(() => {
  const el = document.querySelector('.wr-launch, [class*="launch"], button[class*="launch"]');
  if (!el) return 'NO .wr-launch FOUND';
  return el.outerHTML.substring(0, 500);
});
console.log('LAUNCH HTML:', launchHTML);

// Count images/icons in launch area
const launchCount = await page1.evaluate(() => {
  // look for any element with "launch" in class or nearby
  const container = document.querySelector('[class*="LaunchControl"], [class*="launch-control"], .launch-area');
  if (!container) {
    // fallback: look for the button or img
    const imgs = [...document.querySelectorAll('img[src*="launch"], img[src*="rest"]')];
    const btns = [...document.querySelectorAll('.wr-launch')];
    return { imgs: imgs.length, btns: btns.length, imgSrcs: imgs.map(i => i.src) };
  }
  const imgs = [...container.querySelectorAll('img')];
  const btns = [...container.querySelectorAll('button, .wr-launch')];
  return { imgs: imgs.length, btns: btns.length };
});
console.log('LAUNCH icon count:', JSON.stringify(launchCount));

// --- Check EDIT page ---
const page2 = await browser.newPage();
await withPin(page2, EDIT_URL);
await page2.waitForTimeout(3000);

// Check CARDINAL field
const cardinalVal = await page2.evaluate(() => {
  // look for CARDINAL input or display
  const inputs = [...document.querySelectorAll('input')];
  const cardinalInput = inputs.find(i => {
    const label = i.closest('*')?.previousSibling?.textContent || '';
    return i.placeholder?.toLowerCase().includes('cardinal') || 
           document.querySelector(`label[for="${i.id}"]`)?.textContent?.includes('CARDINAL') ||
           i.getAttribute('aria-label')?.includes('cardinal');
  });
  if (cardinalInput) return { val: cardinalInput.value, placeholder: cardinalInput.placeholder };
  
  // look for CARDINAL display text
  const allText = [...document.querySelectorAll('*')].filter(el => el.children.length === 0 && el.textContent?.includes('—'));
  return { dashElements: allText.slice(0,5).map(el => ({ tag: el.tagName, text: el.textContent.trim(), class: el.className })) };
});
console.log('CARDINAL field:', JSON.stringify(cardinalVal));

// Check CITY font vs ADDRESS font
const fontCheck = await page2.evaluate(() => {
  const addrInput = document.querySelector('#wr-address-input') || document.querySelector('input[placeholder*="ddress"]') || document.querySelector('input[placeholder*="treet"]');
  const cityInputs = [...document.querySelectorAll('input')].filter(i => i.placeholder?.toLowerCase().includes('city') || i.getAttribute('aria-label')?.toLowerCase().includes('city'));
  
  const getFont = el => el ? window.getComputedStyle(el).fontFamily : 'NOT FOUND';
  return {
    addressFont: getFont(addrInput),
    cityFont: cityInputs.length > 0 ? getFont(cityInputs[0]) : 'NO CITY INPUT FOUND',
    addrInputId: addrInput?.id || addrInput?.placeholder || 'none'
  };
});
console.log('FONT CHECK:', JSON.stringify(fontCheck));

// Check full filing in EDIT (raw values)
const editAddressVals = await page2.evaluate(() => {
  const inputs = [...document.querySelectorAll('input[type="text"], input:not([type])')]
    .filter(i => i.value || i.placeholder);
  return inputs.map(i => ({ placeholder: i.placeholder, value: i.value, id: i.id })).slice(0, 20);
});
console.log('EDIT INPUT VALUES:', JSON.stringify(editAddressVals, null, 2));

await page2.screenshot({ path: '/Users/sankacoffie/.openclaw/workspace/memory/158c-edit.png', fullPage: true });

await browser.close();
console.log('DONE');

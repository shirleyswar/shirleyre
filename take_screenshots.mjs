import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Navigate and enter PIN
  await page.goto('https://shirleyre.pages.dev/warroom/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  // Enter PIN 1887
  for (const digit of ['1','8','8','7']) {
    await page.keyboard.press(digit);
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1500);

  // Screenshot MM-7: FAB on panel header (before opening modal)
  await page.screenshot({ path: '/tmp/mm7-fab.png', fullPage: false });
  console.log('mm7-fab.png taken');

  // Click first MONEY MOVERS row to open modal
  // Try clicking a row using text content
  await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div'));
    // Find money movers panel rows - they have cursor pointer and some text
    const row = divs.find(d => d.style.cursor === 'pointer' && d.textContent && d.textContent.trim().length > 3 && d.offsetHeight > 20 && d.offsetHeight < 80);
    if (row) {
      console.log('Clicking:', row.textContent?.slice(0,50));
      row.click();
    }
  });
  await page.waitForTimeout(1000);

  // Screenshot MM-1: Modal read state with DELETE beside EDIT
  await page.screenshot({ path: '/tmp/mm1-delete-read.png' });
  console.log('mm1-delete-read.png taken');

  // Close-up of modal
  const modal = await page.$('[style*="width: 960"]');
  if (modal) {
    await modal.screenshot({ path: '/tmp/mm-modal-full.png' });
    console.log('mm-modal-full.png taken');
  } else {
    console.log('Modal not found, taking full page screenshot');
    await page.screenshot({ path: '/tmp/mm-modal-full.png', fullPage: false });
  }

  await browser.close();
  console.log('Screenshots done');
})();

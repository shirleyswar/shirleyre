import { chromium } from 'playwright'
// Use production URL, not preview
const BASE = 'https://shirleyre.pages.dev/warroom3'
const PIN  = '1887'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
})
const page = await ctx.newPage()
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/m_prod_home.png' })

// Unlock
for (const d of PIN) {
  await page.evaluate(d => {
    [...document.querySelectorAll('button')].find(b => b.textContent.trim() === d)?.click()
  }, d)
  await page.waitForTimeout(70)
}
await page.waitForTimeout(1000)
await page.screenshot({ path: '/tmp/m_prod_unlocked.png' })

// Open Battle Plan tile
await page.evaluate(() => {
  const all = [...document.querySelectorAll('button, div')]
  all.find(el => el.textContent?.includes('Battle Plan') && (el.tagName === 'BUTTON' || (el.getAttribute('style') || '').includes('cursor')))?.click()
})
await page.waitForTimeout(800)
await page.screenshot({ path: '/tmp/m_prod_bp.png' })

// Click first task row in the sheet
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('div[style*="cursor: pointer"]')]
    .filter(d => !d.getAttribute('data-modal-title') && (d.textContent?.trim().length ?? 0) > 5 && (d.textContent?.trim().length ?? 0) < 150)
  if (rows[0]) rows[0].click()
})
await page.waitForTimeout(1000)
await page.screenshot({ path: '/tmp/m_prod_task_read.png' })

// Measure task detail sheet
const measure = await page.evaluate(() => {
  // Find TaskDetailSheet — size="full" → top:34px
  const sheets = [...document.querySelectorAll('*')].filter(el => {
    const s = el.getAttribute('style') || ''
    return s.includes('position: fixed') && (s.includes('top: 34') || s.includes('top:34'))
  })
  if (!sheets.length) {
    // Check all fixed elements
    const allFixed = [...document.querySelectorAll('*')].filter(el =>
      window.getComputedStyle(el).position === 'fixed'
    ).map(el => {
      const r = el.getBoundingClientRect()
      const s = el.getAttribute('style') || ''
      return { tag: el.tagName, top: Math.round(r.top), h: Math.round(r.height), style: s.slice(0,80) }
    })
    return { noSheet: true, allFixed: allFixed.slice(0,10) }
  }

  const sheet = sheets[0]
  const sr = sheet.getBoundingClientRect()
  const children = [...sheet.children].map(c => {
    const r = c.getBoundingClientRect()
    const cs = window.getComputedStyle(c)
    return { tag: c.tagName, h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), flex: cs.flex, overflowY: cs.overflowY }
  })
  return {
    sheetTop: Math.round(sr.top), sheetH: Math.round(sr.height),
    childCount: children.length, children,
    editBtn: !!document.querySelector('button[style*="140"]'),
    confirmSlot: !!document.querySelector('div[style*="128.55"]'),
  }
})
console.log('Task sheet measure:', JSON.stringify(measure, null, 2))

// Stage a chip and screenshot
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  btns.find(b => b.textContent?.trim() === 'Tomorrow')?.click()
})
await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/m_prod_task_staged.png' })

await ctx.close()
await browser.close()

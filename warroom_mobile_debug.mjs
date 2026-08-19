import { chromium } from 'playwright'
const BASE = 'https://84131db9.shirleyre.pages.dev/warroom3'
const PIN  = '1887'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

// Unlock
for (const d of PIN) {
  await page.evaluate(d => {
    [...document.querySelectorAll('button')].find(b => b.textContent.trim() === d)?.click()
  }, d)
  await page.waitForTimeout(60)
}
await page.waitForTimeout(1000)

// Open Battle Plan tile
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button, div')]
  const bp = btns.find(el => el.textContent?.trim()?.startsWith('Battle Plan'))
  bp?.click()
})
await page.waitForTimeout(800)
await page.screenshot({ path: '/tmp/m_battleplan.png' })

// Click first task
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('div[style*="cursor: pointer"]')]
    .filter(d => !d.getAttribute('data-modal-title') && (d.textContent?.trim().length ?? 0) > 5)
  rows[0]?.click()
})
await page.waitForTimeout(800)
await page.screenshot({ path: '/tmp/m_task_read.png' })

// Check footer
const footerCheck = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  for (const b of btns) {
    const t = b.textContent?.trim()
    if (t === 'EDIT' || t === 'CANCEL') {
      const r = b.getBoundingClientRect()
      return { found: true, label: t, top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), visible: r.height > 0 }
    }
  }
  return { found: false }
})
console.log('EDIT/CANCEL btn:', JSON.stringify(footerCheck))

// Check BottomSheet structure
const sheetStructure = await page.evaluate(() => {
  // Find the task sheet — position:fixed element near top:34px
  const fixed = [...document.querySelectorAll('*')].filter(el => {
    const s = el.getAttribute('style') || ''
    return s.includes('position: fixed') && (s.includes('top: 34') || s.includes('26px 26px 0'))
  })
  if (!fixed.length) return { noSheet: true, fixedCount: document.querySelectorAll('*[style*="position: fixed"]').length }
  const sheet = fixed[0]
  const sr = sheet.getBoundingClientRect()
  const children = [...sheet.children].map(c => {
    const r = c.getBoundingClientRect()
    const s = window.getComputedStyle(c)
    return { tag: c.tagName, h: Math.round(r.height), flex: s.flex, overflowY: s.overflowY, top: Math.round(r.top), bottom: Math.round(r.bottom) }
  })
  return { sheetH: Math.round(sr.height), sheetTop: Math.round(sr.top), sheetBottom: Math.round(sr.bottom), childCount: children.length, children }
})
console.log('sheet structure:', JSON.stringify(sheetStructure, null, 2))

// Also check if BottomSheet footer prop is present — find any div with borderTop after a scroll container
const footerDiv = await page.evaluate(() => {
  const all = [...document.querySelectorAll('div')]
  for (const d of all) {
    const s = d.getAttribute('style') || ''
    // Footer div has padding:'12px 18px' and borderTop
    if (s.includes('12px 18px') && (s.includes('border-top') || s.includes('borderTop'))) {
      const r = d.getBoundingClientRect()
      return { found: true, h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), style: s.slice(0, 200) }
    }
  }
  return { found: false }
})
console.log('footer div:', JSON.stringify(footerDiv))

await ctx.close()
await browser.close()

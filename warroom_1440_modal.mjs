import { chromium } from 'playwright'
const BASE = 'https://42da6ba2.shirleyre.pages.dev/warroom'
const PIN  = '1887'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
for (const d of PIN) {
  await page.evaluate(d => {
    [...document.querySelectorAll('button')].find(b => b.textContent.trim() === d)?.click()
  }, d)
  await page.waitForTimeout(60)
}
await page.waitForTimeout(900)

await page.evaluate(() => {
  const divs = [...document.querySelectorAll('div')].filter(d => {
    const s = d.getAttribute('style') || ''
    return s.includes('cursor') && d.textContent?.trim().length > 3 && d.textContent?.trim().length < 150
  })
  divs[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(700)

// READ state screenshot
await page.screenshot({ path: '/tmp/c12_1440_read.png' })

// Dims
const dims = await page.$eval('[role="dialog"]', el => {
  const r = el.getBoundingClientRect()
  return { w: Math.round(r.width), h: Math.round(r.height), scrollH: el.scrollHeight, clientH: el.clientHeight }
})
console.log('1440 dims:', JSON.stringify(dims))
console.log('1440 slot inert:', await page.evaluate(() => {
  for (const el of document.querySelectorAll('div')) {
    if ((el.getAttribute('style') || '').includes('148.3')) return el.getBoundingClientRect().width
  }
  for (const el of document.querySelectorAll('span')) {
    if (el.textContent?.trim() === 'CONFIRM') return el.parentElement?.getBoundingClientRect().width
  }
  return null
}))

// Stage chip
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('[role="dialog"] button')]
  btns.find(b => b.textContent.trim() === 'Tomorrow')?.click()
})
await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/c12_1440_staged.png' })

// EDIT
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('[role="dialog"] button')]
  btns.find(b => b.textContent.trim() === 'EDIT')?.click()
})
await page.waitForTimeout(400)
const taH = await page.$eval('[role="dialog"] textarea', el => el.getBoundingClientRect().height).catch(() => null)
console.log('1440 edit textarea height:', taH)
await page.screenshot({ path: '/tmp/c12_1440_edit.png' })

await ctx.close()
await browser.close()

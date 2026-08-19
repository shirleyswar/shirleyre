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
await page.waitForTimeout(1000)
await page.screenshot({ path: '/tmp/warroom_1440_unlocked.png' })

// Try clicking with force on any row
const clicked = await page.evaluate(() => {
  // Look for divs with onClick handlers — tasks have onClick via React
  const allDivs = [...document.querySelectorAll('div')]
  const candidates = allDivs.filter(d => {
    const s = d.getAttribute('style') || ''
    return (s.includes('cursor') && d.textContent?.trim().length > 3 && d.textContent?.trim().length < 150)
  })
  if (candidates.length) {
    candidates[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return candidates[0].textContent?.trim().slice(0, 50)
  }
  return null
})
await page.waitForTimeout(700)
await page.screenshot({ path: '/tmp/warroom_1440_afterclick.png' })
console.log('clicked:', clicked, 'modal:', !!await page.$('[role="dialog"]'))

await ctx.close()
await browser.close()

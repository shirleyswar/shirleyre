// CHECK 12 committed state — force the flag via setTimeout override
// Strategy: override window.setTimeout in the page context to slow the 1500ms timer
// so committed state holds long enough to screenshot and measure.
import { chromium } from 'playwright'
const BASE = 'https://84131db9.shirleyre.pages.dev/warroom'
const PIN  = '1887'

async function unlock(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  for (const d of PIN) {
    await page.evaluate(d => {
      [...document.querySelectorAll('button')].find(b => b.textContent.trim() === d)?.click()
    }, d)
    await page.waitForTimeout(60)
  }
  await page.waitForTimeout(1000)
}

async function openTask(page) {
  await page.evaluate(() => {
    const divs = [...document.querySelectorAll('div')].filter(d =>
      (d.getAttribute('style') || '').includes('cursor') &&
      !d.getAttribute('data-modal-title') &&
      (d.textContent?.trim().length ?? 0) > 5
    )
    divs[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(800)
  return !!await page.$('[role="dialog"]')
}

const browser = await chromium.launch({ headless: true })
const results = {}

for (const [vw, vh] of [[1440, 900], [1920, 1080]]) {
  const ctx  = await browser.newContext({ viewport: { width: vw, height: vh } })
  const page = await ctx.newPage()

  // Intercept setTimeout — extend any call with delay ~1500 to 8000ms
  // so the committed state holds long enough to measure
  await page.addInitScript(() => {
    const _orig = window.setTimeout.bind(window)
    window.setTimeout = function(fn, delay, ...args) {
      if (delay >= 1400 && delay <= 1600) {
        // This is the committed-state reset timer — extend it to 8s
        return _orig(fn, 8000, ...args)
      }
      return _orig(fn, delay, ...args)
    }
  })

  await unlock(page)
  const opened = await openTask(page)
  results[`${vw}x${vh}_opened`] = opened
  if (!opened) { await ctx.close(); continue }

  // Stage chip
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[role="dialog"] button')]
    btns.find(b => b.textContent.trim() === 'Tomorrow')?.click()
  })
  await page.waitForTimeout(300)

  // Click CONFIRM — committed state will now hold for 8s
  await page.evaluate(() => {
    document.querySelector('[role="dialog"] img[alt="Confirm"]')?.parentElement?.click()
  })
  await page.waitForTimeout(600)  // let committed state render

  // Measure check-h280 in the slot
  const committed = await page.evaluate(() => {
    for (const img of document.querySelectorAll('[role="dialog"] img')) {
      if (img.src?.includes('check-h280')) {
        const r = img.getBoundingClientRect()
        // Find the 148.3px slot wrapper
        let el = img.parentElement
        while (el && el !== document.body) {
          const s = el.getAttribute('style') || ''
          if (s.includes('148')) {
            return {
              imgSrc: 'check-h280.png',
              imgW: Math.round(r.width * 100) / 100,
              imgH: Math.round(r.height * 100) / 100,
              outerW: Math.round(el.getBoundingClientRect().width * 100) / 100,
              naturalW: img.naturalWidth,
              naturalH: img.naturalHeight,
            }
          }
          el = el.parentElement
        }
        // Slot not found by style — return img alone
        return {
          imgSrc: 'check-h280.png',
          imgW: Math.round(r.width * 100) / 100,
          imgH: Math.round(r.height * 100) / 100,
          outerW: null,
          naturalW: img.naturalWidth,
          naturalH: img.naturalHeight,
        }
      }
    }
    return null
  })
  results[`${vw}x${vh}_committed`] = committed
  await page.screenshot({ path: `/tmp/c12_${vw}_committed_v2.png` })

  await ctx.close()
}

await browser.close()
console.log(JSON.stringify(results, null, 2))

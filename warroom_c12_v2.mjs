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

  // Extend the committed timer to 10s
  await page.addInitScript(() => {
    const _orig = window.setTimeout.bind(window)
    window.setTimeout = function(fn, delay, ...args) {
      if (delay >= 1400 && delay <= 1600) return _orig(fn, 10000, ...args)
      return _orig(fn, delay, ...args)
    }
  })

  await unlock(page)
  const opened = await openTask(page)
  if (!opened) { results[`${vw}x${vh}`] = 'NO_MODAL'; await ctx.close(); continue }

  // Stage chip
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[role="dialog"] button')]
    btns.find(b => b.textContent.trim() === 'Tomorrow')?.click()
  })
  await page.waitForTimeout(300)

  // Confirm plate should be visible
  const plate = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('[role="dialog"] img')]
    return imgs.map(i => ({ alt: i.alt, src: i.src.split('/').slice(-3).join('/') }))
  })
  results[`${vw}x${vh}_imgs_before_confirm`] = plate

  // Click CONFIRM
  await page.evaluate(() => {
    // find by alt=Confirm
    const imgs = [...document.querySelectorAll('[role="dialog"] img')]
    const ci = imgs.find(i => i.alt === 'Confirm')
    if (ci) { ci.parentElement?.click(); return 'clicked-confirm-img' }
    // fallback: find CONFIRM text pill and click parent
    const spans = [...document.querySelectorAll('[role="dialog"] span')]
    const s = spans.find(s => s.textContent.trim() === 'CONFIRM')
    return s ? 'found-pill' : 'not-found'
  })
  await page.waitForTimeout(800)

  // What images exist now?
  const imgsAfter = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('[role="dialog"] img')]
    return imgs.map(i => {
      const r = i.getBoundingClientRect()
      return {
        alt: i.alt,
        src: i.src.split('/').slice(-2).join('/'),
        w: Math.round(r.width),
        h: Math.round(r.height),
        naturalW: i.naturalWidth,
        naturalH: i.naturalHeight,
      }
    })
  })
  results[`${vw}x${vh}_imgs_after_confirm`] = imgsAfter

  // Measure the 148px slot
  const slot = await page.evaluate(() => {
    for (const el of document.querySelectorAll('[role="dialog"] div')) {
      const s = el.getAttribute('style') || ''
      if (s.includes('148')) {
        const r = el.getBoundingClientRect()
        const img = el.querySelector('img')
        return {
          slotW: Math.round(r.width),
          imgAlt: img?.alt,
          imgSrc: img?.src.split('/').slice(-2).join('/'),
          imgW: img ? Math.round(img.getBoundingClientRect().width) : null,
          imgH: img ? Math.round(img.getBoundingClientRect().height) : null,
          imgNatW: img?.naturalWidth,
          imgNatH: img?.naturalHeight,
        }
      }
    }
    return null
  })
  results[`${vw}x${vh}_slot`] = slot
  await page.screenshot({ path: `/tmp/c12_${vw}_committed_v3.png` })
  await ctx.close()
}

await browser.close()
console.log(JSON.stringify(results, null, 2))

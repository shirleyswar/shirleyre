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

const browser = await chromium.launch({ headless: true })
const results = {}

for (const [vw, vh] of [[1440, 900], [1920, 1080]]) {
  const ctx  = await browser.newContext({ viewport: { width: vw, height: vh } })
  const page = await ctx.newPage()

  // Slow down the 1500ms committed timer before any page scripts run
  await page.addInitScript(() => {
    const orig = window.setTimeout
    window.setTimeout = function(fn, ms, ...a) {
      return orig.call(this, fn, ms >= 1400 && ms <= 1600 ? 10000 : ms, ...a)
    }
  })

  await unlock(page)

  // Open task using real click
  const taskRows = await page.$$('div[style*="cursor: pointer"]:not([data-modal-title])')
  let opened = false
  for (const row of taskRows) {
    const txt = (await row.textContent() || '').trim()
    if (txt.length > 5 && txt.length < 150) {
      await row.click({ force: true })
      await page.waitForTimeout(800)
      opened = !!await page.$('[role="dialog"]')
      if (opened) break
    }
  }
  results[`${vw}x${vh}_opened`] = opened
  if (!opened) { await ctx.close(); continue }

  // Click Tomorrow chip using Playwright locator (real click through Playwright)
  const tomorrow = page.locator('[role="dialog"] button', { hasText: 'Tomorrow' }).first()
  await tomorrow.click({ force: true })
  await page.waitForTimeout(400)

  // Check if CONFIRM plate is now visible
  const confirmPlate = page.locator('[role="dialog"] img[alt="Confirm"]')
  const plateVisible = await confirmPlate.count() > 0
  results[`${vw}x${vh}_plate_visible`] = plateVisible

  if (!plateVisible) {
    // Fallback: note text
    const noteTA = page.locator('[role="dialog"] textarea').first()
    await noteTA.click({ force: true })
    await noteTA.fill('autocheck note')
    await page.waitForTimeout(300)
    const plateVisible2 = await page.locator('[role="dialog"] img[alt="Confirm"]').count() > 0
    results[`${vw}x${vh}_plate_via_note`] = plateVisible2
  }

  // Screenshot before CONFIRM (staged state)
  await page.screenshot({ path: `/tmp/debug_${vw}_staged.png` })

  // Click CONFIRM img
  const confirmImg = page.locator('[role="dialog"] img[alt="Confirm"]')
  if (await confirmImg.count() > 0) {
    await confirmImg.click({ force: true })
  } else {
    // Trigger via JS click on CONFIRM button parent
    await page.evaluate(() => {
      const imgs = document.querySelectorAll('[role="dialog"] img')
      for (const i of imgs) { if (i.alt === 'Confirm') { i.parentElement?.click(); break } }
    })
  }
  await page.waitForTimeout(600)

  // Measure everything in committed state
  const committed = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('[role="dialog"] img')]
    const result = { allImgs: [], slot: null }
    for (const img of imgs) {
      const r = img.getBoundingClientRect()
      result.allImgs.push({
        alt: img.alt,
        src: img.src.split('/').slice(-2).join('/'),
        w: Math.round(r.width), h: Math.round(r.height),
        natW: img.naturalWidth, natH: img.naturalHeight,
      })
    }
    // Measure slot
    for (const el of document.querySelectorAll('[role="dialog"] div')) {
      if ((el.getAttribute('style') || '').includes('148')) {
        const sr = el.getBoundingClientRect()
        const img = el.querySelector('img')
        result.slot = {
          w: Math.round(sr.width),
          imgAlt: img?.alt ?? null,
          imgW: img ? Math.round(img.getBoundingClientRect().width) : null,
          imgH: img ? Math.round(img.getBoundingClientRect().height) : null,
          natW: img?.naturalWidth ?? null, natH: img?.naturalHeight ?? null,
        }
        break
      }
    }
    return result
  })
  results[`${vw}x${vh}_committed`] = committed
  await page.screenshot({ path: `/tmp/c12_${vw}_committed_v3.png` })
  await ctx.close()
}

await browser.close()
console.log(JSON.stringify(results, null, 2))

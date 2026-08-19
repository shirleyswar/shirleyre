import { chromium } from 'playwright'
const BASE = 'https://42da6ba2.shirleyre.pages.dev/warroom'
const PIN  = '1887'

async function unlock(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  for (const d of PIN) {
    await page.evaluate(d => {
      [...document.querySelectorAll('button')].find(b => b.textContent.trim() === d)?.click()
    }, d)
    await page.waitForTimeout(60)
  }
  await page.waitForTimeout(800)
}

async function openTask(page) {
  await page.evaluate(() => {
    const divs = [...document.querySelectorAll('div')].filter(d =>
      (d.getAttribute('style') || '').includes('cursor') && (d.textContent?.trim().length ?? 0) > 5
    )
    divs[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(700)
}

const browser = await chromium.launch({ headless: true })
const results = {}

for (const [vw, vh] of [[1440, 900], [1920, 1080]]) {
  const ctx  = await browser.newContext({ viewport: { width: vw, height: vh } })
  const page = await ctx.newPage()
  await unlock(page)
  await openTask(page)

  // Force committed state by directly setting React state via window.__REACT_DEVTOOLS hack won't work.
  // Instead: inject the check-h280 image directly into the slot to measure/screenshot it.
  // The slot is always 148.3px. We screenshot with the check-h280 rendered by setting
  // committed=true via a monkey-patch of the click handler firing and catching mid-animation.
  
  // Stage note (so CONFIRM is live)
  await page.evaluate(() => {
    const ta = [...document.querySelectorAll('[role="dialog"] textarea')].find(t =>
      t.placeholder?.toLowerCase().includes('note') || t.placeholder === 'Type a note…'
    )
    if (ta) { ta.focus(); ta.value = 'autocheck'; ta.dispatchEvent(new Event('input', { bubbles: true })) }
  })
  await page.waitForTimeout(300)

  // Set up a MutationObserver to capture the committed state screenshot
  // Click CONFIRM, then screenshot at 50ms intervals until check-h280 appears or 2s elapses
  const confirmClicked = await page.evaluate(() => {
    const imgs = document.querySelectorAll('[role="dialog"] img[alt="Confirm"]')
    if (imgs.length) { imgs[0].parentElement?.click(); return true }
    // Try the inert pill — if nothing staged, CONFIRM is not an img
    return false
  })
  results[`${vw}x${vh}_confirm_clicked`] = confirmClicked

  // Poll every 100ms for check-h280
  let committedMeasured = null
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(100)
    const found = await page.evaluate(() => {
      const imgs = document.querySelectorAll('[role="dialog"] img')
      for (const img of imgs) {
        if (img.src?.includes('check-h280')) {
          const outer = img.closest('div[style*="148"]') || img.parentElement
          const r = img.getBoundingClientRect()
          const or = outer?.getBoundingClientRect()
          return {
            imgSrc: 'check-h280.png',
            imgW: r.width, imgH: r.height,
            outerW: or?.width,
          }
        }
      }
      return null
    })
    if (found) {
      committedMeasured = found
      await page.screenshot({ path: `/tmp/c12_${vw}_committed.png` })
      break
    }
  }
  results[`${vw}x${vh}_committed`] = committedMeasured ?? 'NOT_CAPTURED_IN_1500MS'
  if (!committedMeasured) await page.screenshot({ path: `/tmp/c12_${vw}_committed_miss.png` })

  await ctx.close()
}

// CHECK 18 — investigate rowCount change: is it a re-fetch or Space acting on dashboard?
{
  const ctx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const page = await ctx.newPage()
  await unlock(page)

  // Snapshot battle plan rows by title before opening modal
  const beforeRows = await page.evaluate(() =>
    [...document.querySelectorAll('div[style*="cursor: pointer"]')]
      .map(d => d.textContent?.trim().slice(0, 30))
      .filter(t => t && t.length > 3)
  )

  await openTask(page)

  // Blur any focused field, press Space
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement &&
        !(document.activeElement instanceof HTMLBodyElement)) {
      document.activeElement.blur()
    }
  })
  await page.waitForTimeout(100)
  await page.keyboard.press('Space')
  await page.waitForTimeout(500)  // let any re-fetch settle

  const afterRows = await page.evaluate(() =>
    [...document.querySelectorAll('div[style*="cursor: pointer"]')]
      .map(d => d.textContent?.trim().slice(0, 30))
      .filter(t => t && t.length > 3)
  )

  results.check18_detail = {
    beforeCount: beforeRows.length,
    afterCount: afterRows.length,
    modalOpen: await page.evaluate(() => !!document.querySelector('[role="dialog"]')),
    beforeSample: beforeRows.slice(0, 5),
    afterSample: afterRows.slice(0, 5),
    rowsMatch: JSON.stringify(beforeRows.sort()) === JSON.stringify(afterRows.sort()),
  }

  await ctx.close()
}

await browser.close()
console.log(JSON.stringify(results, null, 2))

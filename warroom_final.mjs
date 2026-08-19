import { chromium } from 'playwright'
const BASE = 'https://42da6ba2.shirleyre.pages.dev/warroom'
const PIN  = '1887'

async function unlock(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)  // let BP data load
  for (const d of PIN) {
    await page.evaluate(d => {
      [...document.querySelectorAll('button')].find(b => b.textContent.trim() === d)?.click()
    }, d)
    await page.waitForTimeout(60)
  }
  await page.waitForTimeout(1200)
}

async function openTask(page) {
  await page.evaluate(() => {
    const divs = [...document.querySelectorAll('div')].filter(d =>
      (d.getAttribute('style') || '').includes('cursor') && (d.textContent?.trim().length ?? 0) > 5
    )
    divs[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(800)
  return !!await page.$('[role="dialog"]')
}

// Fire React onChange on a textarea via nativeInputValueSetter
async function setReactTextarea(page, selector, value) {
  return page.evaluate(({ selector, value }) => {
    const el = document.querySelector(selector)
    if (!el) return false
    const nativeInput = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')
    nativeInput.set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }, { selector, value })
}

const browser = await chromium.launch({ headless: true })
const results = {}

// ── COMMITTED STATE capture ────────────────────────────────────────────────
for (const [vw, vh] of [[1440, 900], [1920, 1080]]) {
  const ctx  = await browser.newContext({ viewport: { width: vw, height: vh } })
  const page = await ctx.newPage()
  await unlock(page)
  const opened = await openTask(page)
  results[`${vw}x${vh}_opened`] = opened

  if (!opened) { results[`${vw}x${vh}_committed`] = 'MODAL_NOT_OPENED'; await ctx.close(); continue }

  // Stage chip (Tomorrow) — most reliable staging path
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[role="dialog"] button')]
    btns.find(b => b.textContent.trim() === 'Tomorrow')?.click()
  })
  await page.waitForTimeout(400)

  // Verify CONFIRM plate is now visible (isActive = true)
  const confirmVisible = await page.evaluate(() =>
    !!document.querySelector('[role="dialog"] img[alt="Confirm"]')
  )
  results[`${vw}x${vh}_confirm_plate_visible`] = confirmVisible

  if (confirmVisible) {
    // Click CONFIRM
    await page.evaluate(() => {
      document.querySelector('[role="dialog"] img[alt="Confirm"]')?.parentElement?.click()
    })

    // Poll every 80ms for check-h280 (committed state lasts 1500ms)
    let found = null
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(80)
      found = await page.evaluate(() => {
        for (const img of document.querySelectorAll('[role="dialog"] img')) {
          if (img.src?.includes('check-h280')) {
            const outer = [...document.querySelectorAll('[role="dialog"] div')]
              .find(d => (d.getAttribute('style') || '').includes('148'))
            return {
              imgSrc: 'check-h280.png',
              imgW: Math.round(img.getBoundingClientRect().width),
              imgH: Math.round(img.getBoundingClientRect().height),
              outerW: outer ? Math.round(outer.getBoundingClientRect().width) : null,
            }
          }
        }
        return null
      })
      if (found) {
        await page.screenshot({ path: `/tmp/c12_${vw}_committed.png` })
        break
      }
    }
    results[`${vw}x${vh}_committed`] = found ?? 'NOT_CAPTURED'
  }

  await ctx.close()
}

// ── CHECK 18 — Space/Enter/⌘K with dashboard row count verified ───────────
{
  const ctx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const page = await ctx.newPage()
  await unlock(page)

  // Wait for Battle Plan rows to be present
  await page.waitForFunction(() =>
    document.querySelectorAll('div[style*="cursor: pointer"]').length > 0
  , { timeout: 5000 }).catch(() => {})

  const beforeTitles = await page.evaluate(() =>
    [...document.querySelectorAll('div[style*="cursor: pointer"]')]
      .map(d => d.textContent?.trim().slice(0, 40))
      .filter(Boolean)
  )

  const opened = await openTask(page)
  results.check18_modal_opened = opened

  if (opened) {
    // Ensure no field focused in the modal
    await page.evaluate(() => {
      const a = document.activeElement
      if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) a.blur()
    })
    await page.waitForTimeout(150)

    await page.keyboard.press('Space')
    await page.waitForTimeout(400)
    const afterSpace = await page.evaluate(() => ({
      modalOpen: !!document.querySelector('[role="dialog"]'),
      titles: [...document.querySelectorAll('div[style*="cursor: pointer"]')]
        .map(d => d.textContent?.trim().slice(0, 40)).filter(Boolean),
    }))

    // Re-open modal if Space closed it (shouldn't happen — inert dashboard)
    if (!afterSpace.modalOpen) await openTask(page)

    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    const afterEnter = { modalOpen: !!await page.$('[role="dialog"]') }

    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)
    const afterMetaK = { modalOpen: !!await page.$('[role="dialog"]') }

    results.check18 = {
      beforeTitles,
      afterSpaceTitles: afterSpace.titles,
      modalSurvivesSpace: afterSpace.modalOpen,
      modalSurvivesEnter: afterEnter.modalOpen,
      modalSurvivesMetaK: afterMetaK.modalOpen,
      titlesUnchanged: JSON.stringify(beforeTitles.sort()) === JSON.stringify(afterSpace.titles.sort()),
    }
  }

  await ctx.close()
}

await browser.close()
console.log(JSON.stringify(results, null, 2))

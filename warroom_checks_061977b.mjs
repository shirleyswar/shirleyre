import { chromium } from 'playwright'

const BASE = 'https://42da6ba2.shirleyre.pages.dev/warroom'
const PIN  = '1887'

async function measure() {
  const browser = await chromium.launch({ headless: true })
  const results = {}

  // ── 1440×900 pass ──────────────────────────────────────────────────────────
  for (const [w, h] of [[1440, 900], [1920, 1080]]) {
    const ctx  = await browser.newContext({ viewport: { width: w, height: h } })
    const page = await ctx.newPage()

    // Unlock
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    // Enter PIN
    for (const d of PIN.split('')) {
      await page.click(`button:has-text("${d}")`)
      await page.waitForTimeout(60)
    }
    await page.waitForTimeout(600)

    // Open first Battle Plan task
    await page.waitForSelector('[data-panel="battleplan"], .bp-row, [data-testid]', { timeout: 5000 }).catch(() => {})
    // Try clicking the first task row by text
    const taskRows = await page.$$('div[style*="cursor: pointer"]')
    let taskClicked = false
    for (const row of taskRows) {
      const txt = await row.textContent()
      if (txt && txt.trim().length > 5 && txt.length < 200) {
        await row.click()
        taskClicked = true
        break
      }
    }
    if (!taskClicked) {
      results[`${w}x${h}`] = 'NO_TASK_CLICKED'
      await ctx.close()
      continue
    }
    await page.waitForTimeout(800)

    // CHECK 9 — modal dimensions
    const modal = await page.$('[role="dialog"]')
    if (!modal) { results[`${w}x${h}_modal`] = 'NOT_FOUND'; await ctx.close(); continue }
    const modalBox = await modal.boundingBox()

    // CHECK 10 — scrollHeight === clientHeight (modal itself, not scroll region)
    const overflowCheck = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')
      if (!dialog) return null
      return {
        scrollHeight: dialog.scrollHeight,
        clientHeight: dialog.clientHeight,
        overflow: dialog.scrollHeight === dialog.clientHeight
      }
    })

    // CHECK 11 — CONFIRM slot width in all four states
    // State 1: inert (on open, nothing staged)
    const inertSlot = await page.evaluate(() => {
      // The CONFIRM slot is the div wrapping either the plate or the inert pill
      // Find it by looking for width:148.3 in style or the CONFIRM text
      const all = document.querySelectorAll('div')
      for (const el of all) {
        const s = el.getAttribute('style') || ''
        if (s.includes('148.3') || s.includes('148px')) {
          return { width: el.getBoundingClientRect().width, found: 'style' }
        }
        if (el.textContent?.trim() === 'CONFIRM' && el.tagName === 'SPAN') {
          const parent = el.parentElement
          if (parent) return { width: parent.getBoundingClientRect().width, found: 'pill-parent' }
        }
      }
      return null
    })

    // CHECK 21 — glowing elements (one wordmark, no others)
    const glowCheck = await page.evaluate(() => {
      const all = document.querySelectorAll('*')
      const glowEls = []
      for (const el of all) {
        const s = window.getComputedStyle(el)
        const hasShadow = s.textShadow !== 'none' && s.textShadow !== ''
        const hasBoxShadow = s.boxShadow !== 'none' && s.boxShadow !== ''
        const hasFilter = s.filter !== 'none' && s.filter !== ''
        if (hasShadow || hasBoxShadow || hasFilter) {
          glowEls.push({
            tag: el.tagName,
            cls: el.className?.toString().slice(0, 40),
            text: el.textContent?.slice(0, 30),
            textShadow: s.textShadow?.slice(0, 60),
            boxShadow: s.boxShadow?.slice(0, 60),
            filter: s.filter?.slice(0, 60),
          })
        }
      }
      return glowEls.slice(0, 10)
    })

    // Header height
    const headerH = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')
      if (!dialog) return null
      const header = dialog.querySelector('div:first-child')
      return header ? header.getBoundingClientRect().height : null
    })

    // Footer height
    const footerH = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')
      if (!dialog) return null
      const children = dialog.querySelectorAll(':scope > div')
      const last = children[children.length - 1]
      return last ? last.getBoundingClientRect().height : null
    })

    // CHECK 15 — Esc behavior test
    // focus the note textarea, press Esc — should blur. Then Esc again — modal should close
    const noteTA = await page.$('textarea[placeholder*="note"], textarea[placeholder*="Note"]')
    let escTest = 'NO_TEXTAREA'
    if (noteTA) {
      await noteTA.click()
      await page.waitForTimeout(200)
      const beforeFocus = await page.evaluate(() => document.activeElement?.tagName)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
      const afterFirstEsc = await page.evaluate(() => document.activeElement?.tagName)
      const modalStillOpen = await page.$('[role="dialog"]') !== null
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      const modalAfterSecond = await page.$('[role="dialog"]')
      escTest = {
        beforeFocus,
        afterFirstEsc,
        modalAfterFirstEsc: modalStillOpen,
        modalAfterSecondEsc: modalAfterSecond === null ? 'CLOSED' : 'STILL_OPEN'
      }
    }

    // Screenshot CHECK 12
    const shotPath = `/tmp/warroom_check12_${w}x${h}_READ.png`
    await page.screenshot({ path: shotPath, fullPage: false })

    results[`${w}x${h}`] = {
      modal: modalBox,
      overflowCheck,
      inertSlot,
      glowCheck,
      headerH,
      footerH,
      escTest,
      shotSaved: shotPath,
    }
    await ctx.close()
  }

  await browser.close()
  return results
}

const r = await measure()
console.log(JSON.stringify(r, null, 2))

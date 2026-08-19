import { chromium } from 'playwright'

const BASE = 'https://42da6ba2.shirleyre.pages.dev/warroom'
const PIN  = '1887'

async function openModal(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  for (const d of PIN.split('')) {
    await page.click(`button:has-text("${d}")`)
    await page.waitForTimeout(60)
  }
  await page.waitForTimeout(800)
  const rows = await page.$$('div[style*="cursor: pointer"]')
  for (const row of rows) {
    const txt = await row.textContent()
    if (txt && txt.trim().length > 5 && txt.length < 200) {
      await row.click()
      await page.waitForTimeout(800)
      const dialog = await page.$('[role="dialog"]')
      return !!dialog
    }
  }
  return false
}

async function slotWidth(page) {
  return page.evaluate(() => {
    const all = document.querySelectorAll('div, button')
    for (const el of all) {
      const s = el.getAttribute('style') || ''
      if (s.includes('148.3') || s.includes('148px')) {
        return { w: el.getBoundingClientRect().width, src: 'style-148' }
      }
    }
    // fallback: find CONFIRM span parent
    for (const el of document.querySelectorAll('span')) {
      if (el.textContent?.trim() === 'CONFIRM') {
        const p = el.parentElement
        return p ? { w: p.getBoundingClientRect().width, src: 'confirm-pill-parent' } : null
      }
    }
    return null
  })
}

async function railMeasure(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    if (!dialog) return null
    const children = [...dialog.children]  // header, content, footer
    if (children.length < 3) return { count: children.length }
    const content = children[1]
    const cols = [...content.children]
    return {
      leftCol: cols[0]?.getBoundingClientRect().width,
      rule:    cols[1]?.getBoundingClientRect().width,
      rightRail: cols[2]?.getBoundingClientRect().width,
    }
  })
}

const results = {}
const browser = await chromium.launch({ headless: true })

// ── Pass 1: 1440×900, READ state measurements ─────────────────────────────
{
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const ok = await openModal(page)
  results.modal_opened = ok

  if (ok) {
    const box   = await page.$eval('[role="dialog"]', el => {
      const r = el.getBoundingClientRect()
      return { width: r.width, height: r.height, scrollH: el.scrollHeight, clientH: el.clientHeight }
    })
    results.check9_modal = box

    results.check10_overflow = box.scrollHeight === box.clientHeight

    results.check11_inert = await slotWidth(page)
    results.check9_cols   = await railMeasure(page)

    // screenshot READ
    await page.screenshot({ path: '/tmp/c12_1440_read.png' })

    // Scroll into DUE chips and tap Tomorrow
    await page.evaluate(() => {
      document.querySelector('[role="dialog"] div[style*="overflow-y: auto"]')?.scrollTo(0, 200)
    })
    await page.waitForTimeout(300)

    // Stage a chip
    const chips = await page.$$('[role="dialog"] button')
    let staged = false
    for (const btn of chips) {
      const t = await btn.textContent()
      if (t?.trim() === 'Tomorrow') {
        await btn.click()
        await page.waitForTimeout(300)
        staged = true
        break
      }
    }
    results.chip_staged = staged
    results.check11_staged = await slotWidth(page)
    await page.screenshot({ path: '/tmp/c12_1440_staged.png' })

    // Enter EDIT
    const editBtn = await page.$('button:has-text("EDIT")')
    if (editBtn) {
      await editBtn.click()
      await page.waitForTimeout(400)
      const titleEl = await page.$('[role="dialog"] textarea')
      const titleBox = titleEl ? await titleEl.boundingBox() : null
      results.edit_title_box = titleBox
      results.check11_edit = await slotWidth(page)
      await page.screenshot({ path: '/tmp/c12_1440_edit.png' })
    }

    // CHECK 17 — Tab trap
    const firstFocus = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')
      return d?.contains(document.activeElement)
    })
    await page.keyboard.press('Tab')
    await page.waitForTimeout(100)
    const afterTab = await page.evaluate(() => {
      return {
        tag: document.activeElement?.tagName,
        inside: document.querySelector('[role="dialog"]')?.contains(document.activeElement) ?? false,
      }
    })
    results.check17 = { firstFocusInside: firstFocus, afterTab }

    // CHECK 18 — Space on dashboard while modal open
    await page.keyboard.press('Escape')  // cancel edit
    await page.waitForTimeout(200)
    await page.keyboard.press('Space')
    await page.waitForTimeout(100)
    results.check18_modal_survives = !!await page.$('[role="dialog"]')

    // CHECK 15 — Esc two-step
    const noteTA = await page.$('[role="dialog"] textarea[placeholder*="note" i], [role="dialog"] textarea[placeholder*="Note" i]')
    if (noteTA) {
      await noteTA.click()
      await page.waitForTimeout(100)
      const a1 = await page.evaluate(() => document.activeElement?.tagName)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
      const a2 = await page.evaluate(() => document.activeElement?.tagName)
      const m1 = !!await page.$('[role="dialog"]')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      const m2 = !!await page.$('[role="dialog"]')
      results.check15 = { active_before: a1, active_after_blur: a2, modal_after_1: m1, modal_after_2: m2, closed: !m2 }
    }

    // CHECK 19 — "No notes yet"
    results.check19 = await page.evaluate(() => {
      for (const el of document.querySelectorAll('span, div, p')) {
        if (el.textContent?.trim() === 'No notes yet') return 'FOUND'
      }
      return 'NOT_FOUND'
    })

    // CHECK 21 — glow
    results.check21 = await page.evaluate(() => {
      const hits = []
      for (const el of document.querySelectorAll('*')) {
        const s = window.getComputedStyle(el)
        if ((s.filter && s.filter !== 'none') ||
            (s.textShadow && s.textShadow !== 'none') ||
            (s.boxShadow && s.boxShadow !== 'none' && !s.boxShadow.includes('inset'))) {
          hits.push({ tag: el.tagName, class: el.className?.toString?.().slice(0,30), txt: el.textContent?.slice(0,20) })
        }
      }
      return hits
    })

    await page.screenshot({ path: '/tmp/c21_glow.png' })
  }
  await ctx.close()
}

// ── Pass 2: 1920×1080 ─────────────────────────────────────────────────────
{
  const ctx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const page = await ctx.newPage()
  const ok = await openModal(page)
  if (ok) {
    await page.screenshot({ path: '/tmp/c12_1920_read.png' })
    const box = await page.$eval('[role="dialog"]', el => ({ w: el.getBoundingClientRect().width }))
    results.check12_1920_modal_width = box.w
  }
  await ctx.close()
}

await browser.close()
console.log(JSON.stringify(results, null, 2))

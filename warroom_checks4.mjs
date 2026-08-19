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
  await page.waitForTimeout(700)
}

async function openFirstTask(page) {
  // click the first cursor:pointer div inside the Battle Plan area
  const clicked = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('div[style*="cursor: pointer"]')]
    const r = rows.find(el => el.textContent.trim().length > 5 && el.textContent.trim().length < 200)
    if (r) { r.click(); return r.textContent.trim().slice(0,50) }
    return null
  })
  await page.waitForTimeout(700)
  return clicked
}

async function slotWidth(page) {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll('div')) {
      const s = el.getAttribute('style') || ''
      if (s.includes('148.3')) return el.getBoundingClientRect().width
    }
    for (const el of document.querySelectorAll('span')) {
      if (el.textContent?.trim() === 'CONFIRM') {
        return el.parentElement?.getBoundingClientRect().width ?? null
      }
    }
    return null
  })
}

const browser = await chromium.launch({ headless: true })
const results = {}

for (const [vw, vh] of [[1440, 900], [1920, 1080]]) {
  const ctx  = await browser.newContext({ viewport: { width: vw, height: vh } })
  const page = await ctx.newPage()
  await unlock(page)
  const taskTitle = await openFirstTask(page)
  results[`${vw}x${vh}_task`] = taskTitle

  if (!await page.$('[role="dialog"]')) {
    results[`${vw}x${vh}`] = 'NO_MODAL'
    await ctx.close(); continue
  }

  // CHECK 9 — modal dimensions
  const dims = await page.$eval('[role="dialog"]', el => {
    const r = el.getBoundingClientRect()
    const cols = [...el.children]  // header, content, footer
    const content = cols[1]
    const colEls = content ? [...content.children] : []
    return {
      width: Math.round(r.width),
      height: Math.round(r.height),
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      headerH: cols[0]?.getBoundingClientRect().height,
      footerH: cols[cols.length-1]?.getBoundingClientRect().height,
      leftCol:  colEls[0]?.getBoundingClientRect().width,
      rule:     colEls[1]?.getBoundingClientRect().width,
      rightRail: colEls[2]?.getBoundingClientRect().width,
    }
  })
  results[`${vw}x${vh}`] = dims

  // CHECK 10
  results[`${vw}x${vh}_overflow`] = dims.scrollHeight === dims.clientHeight

  // CHECK 11 state 1: inert
  results[`${vw}x${vh}_slot_inert`] = await slotWidth(page)

  // Screenshot READ state
  await page.screenshot({ path: `/tmp/c12_${vw}_read.png` })

  // Stage a chip (Tomorrow) via JS
  const chipped = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[role="dialog"] button')]
    const t = btns.find(b => b.textContent.trim() === 'Tomorrow')
    if (t) { t.click(); return true }
    return false
  })
  await page.waitForTimeout(300)
  results[`${vw}x${vh}_chip_staged`] = chipped
  results[`${vw}x${vh}_slot_staged`] = await slotWidth(page)
  await page.screenshot({ path: `/tmp/c12_${vw}_staged.png` })

  // Enter EDIT via JS
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[role="dialog"] button')]
    btns.find(b => b.textContent.trim() === 'EDIT')?.click()
  })
  await page.waitForTimeout(400)
  const editTA = await page.$('[role="dialog"] textarea')
  const editBox = editTA ? await editTA.boundingBox() : null
  results[`${vw}x${vh}_edit_textarea_h`] = editBox?.height
  results[`${vw}x${vh}_slot_edit`] = await slotWidth(page)
  await page.screenshot({ path: `/tmp/c12_${vw}_edit.png` })

  // CHECK 15 — Esc two-step (from edit textarea)
  if (editTA) {
    await editTA.focus()
    await page.waitForTimeout(100)
    const a1 = await page.evaluate(() => document.activeElement?.tagName)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    const a2 = await page.evaluate(() => document.activeElement?.tagName)
    const m1 = !!await page.$('[role="dialog"]')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    const m2 = !!await page.$('[role="dialog"]')
    results[`${vw}x${vh}_check15`] = { a1, a2, modal_after_1: m1, modal_closed: !m2 }
  }

  // Re-open for remaining checks
  if (!await page.$('[role="dialog"]')) {
    await openFirstTask(page)
    await page.waitForTimeout(600)
  }

  // CHECK 17 — Tab trap
  // Set focus to first focusable in modal explicitly, then Tab
  await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    const f = d?.querySelectorAll('button, input, textarea, [tabindex]')
    f?.[0]?.focus()
  })
  await page.waitForTimeout(100)
  const t1 = await page.evaluate(() => ({
    inside: document.querySelector('[role="dialog"]')?.contains(document.activeElement) ?? false,
    tag: document.activeElement?.tagName,
  }))
  await page.keyboard.press('Tab')
  await page.waitForTimeout(100)
  const t2 = await page.evaluate(() => ({
    inside: document.querySelector('[role="dialog"]')?.contains(document.activeElement) ?? false,
    tag: document.activeElement?.tagName,
  }))
  await page.keyboard.press('Tab')
  await page.waitForTimeout(100)
  const t3 = await page.evaluate(() => ({
    inside: document.querySelector('[role="dialog"]')?.contains(document.activeElement) ?? false,
    tag: document.activeElement?.tagName,
  }))
  results[`${vw}x${vh}_check17`] = { t1, t2, t3 }

  // CHECK 18 — Space with modal open (not in a field) doesn't close/affect dashboard
  await page.keyboard.press('Escape') // blur any field first if needed
  await page.waitForTimeout(100)
  const hasModal = !!await page.$('[role="dialog"]')
  if (hasModal) {
    await page.keyboard.press('Space')
    await page.waitForTimeout(100)
    results[`${vw}x${vh}_check18`] = !!await page.$('[role="dialog"]') ? 'MODAL_SURVIVED' : 'MODAL_CLOSED'
  }

  // Re-open for 19/21
  if (!await page.$('[role="dialog"]')) {
    await openFirstTask(page)
    await page.waitForTimeout(600)
  }

  // CHECK 19 — "No notes yet" or note count
  results[`${vw}x${vh}_check19`] = await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === 'No notes yet') return 'FOUND'
    }
    return 'NOT_FOUND'
  })

  // CHECK 21 — exactly one glow (FAB halo is exempt per R8; CONFIRM/check assets exempt)
  results[`${vw}x${vh}_check21`] = await page.evaluate(() => {
    const hits = []
    for (const el of document.querySelectorAll('*')) {
      const s = window.getComputedStyle(el)
      const boxShadow = s.boxShadow
      const textShadow = s.textShadow
      const filter = s.filter
      const hasGlow =
        (filter && filter !== 'none') ||
        (textShadow && textShadow !== 'none') ||
        (boxShadow && boxShadow !== 'none' && !boxShadow.startsWith('inset'))
      if (hasGlow) {
        hits.push({
          tag: el.tagName,
          cls: (el.className?.toString?.() || '').slice(0,40),
          txt: (el.textContent || '').slice(0,30).trim(),
          filter: (filter !== 'none' ? filter : '').slice(0,50),
          boxShadow: (boxShadow !== 'none' ? boxShadow : '').slice(0,60),
        })
      }
    }
    return hits
  })

  await page.screenshot({ path: `/tmp/c21_${vw}.png` })
  await ctx.close()
}

await browser.close()
console.log(JSON.stringify(results, null, 2))

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
    const divs = [...document.querySelectorAll('div')].filter(d => {
      const s = d.getAttribute('style') || ''
      return s.includes('cursor') && (d.textContent?.trim().length ?? 0) > 5
    })
    divs[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(700)
}

async function slotWidth(page) {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll('div')) {
      if ((el.getAttribute('style') || '').includes('148.3'))
        return el.getBoundingClientRect().width
    }
    for (const el of document.querySelectorAll('span')) {
      if (el.textContent?.trim() === 'CONFIRM')
        return el.parentElement?.getBoundingClientRect().width ?? null
    }
    return null
  })
}

const browser = await chromium.launch({ headless: true })
const results = {}

// ── COMMITTED STATE: checks 11+12 ─────────────────────────────────────────
for (const [vw, vh] of [[1440, 900], [1920, 1080]]) {
  const ctx  = await browser.newContext({ viewport: { width: vw, height: vh } })
  const page = await ctx.newPage()
  await unlock(page)
  await openTask(page)

  // Force committed state: set `committed` flag via React devtools bypass —
  // we can't easily, so instead: stage a note, click CONFIRM, then immediately
  // screenshot during the 1.5s committed window.
  // Stage a chip first
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[role="dialog"] button')]
    btns.find(b => b.textContent.trim() === 'Tomorrow')?.click()
  })
  await page.waitForTimeout(200)

  // Click CONFIRM via JS
  await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('[role="dialog"] img')]
    const confirmImg = imgs.find(i => i.getAttribute('alt') === 'Confirm')
    confirmImg?.parentElement?.click()
  })
  await page.waitForTimeout(400)  // catch within the 1.5s committed window

  // Measure slot width in committed state
  const slotW = await page.evaluate(() => {
    // In committed state, check-h280 is rendered inside the 148.3px wrapper
    const outer = [...document.querySelectorAll('div')].find(el =>
      (el.getAttribute('style') || '').includes('148.3')
    )
    if (!outer) return null
    const r = outer.getBoundingClientRect()
    const img = outer.querySelector('img')
    return {
      outerWidth: r.width,
      imgSrc: img?.src?.split('/').pop(),
      imgHeight: img?.getBoundingClientRect().height,
      imgWidth:  img?.getBoundingClientRect().width,
    }
  })
  results[`${vw}x${vh}_committed_slot`] = slotW

  await page.screenshot({ path: `/tmp/c12_${vw}_committed.png` })
  await ctx.close()
}

// ── CHECK 17 FULL TAB WRAP ─────────────────────────────────────────────────
{
  const ctx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const page = await ctx.newPage()
  await unlock(page)
  await openTask(page)

  // Set focus to the modal container itself first
  await page.evaluate(() => document.querySelector('[role="dialog"]')?.focus())
  await page.waitForTimeout(100)

  const tabTrace = []
  let wrappedAt = null
  const seenElements = new Set()

  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(80)
    const state = await page.evaluate(() => {
      const a = document.activeElement
      const d = document.querySelector('[role="dialog"]')
      return {
        tag: a?.tagName,
        id: a?.id || null,
        text: a?.textContent?.trim().slice(0,20),
        inside: d ? d.contains(a) : false,
        isBody: a === document.body,
      }
    })
    const key = `${state.tag}:${state.text}`
    if (seenElements.has(key) && wrappedAt === null) wrappedAt = i
    seenElements.add(key)
    tabTrace.push({ i, ...state })
    if (!state.inside) break  // escaped — test failed
    if (wrappedAt !== null && i > wrappedAt + 2) break  // confirmed wrap
  }
  results.check17_tab_trace = tabTrace
  results.check17_wrapped_at = wrappedAt
  results.check17_escaped = tabTrace.some(t => !t.inside)

  // Shift+Tab off first
  // Focus first element
  await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    const focusable = d?.querySelectorAll('button,textarea,input,[tabindex]:not([tabindex="-1"])')
    focusable?.[0]?.focus()
  })
  await page.waitForTimeout(100)
  await page.keyboard.press('Shift+Tab')
  await page.waitForTimeout(100)
  const shiftResult = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    inside: document.querySelector('[role="dialog"]')?.contains(document.activeElement) ?? false,
  }))
  results.check17_shift_tab = shiftResult

  await ctx.close()
}

// ── CHECK 18 FULL: Space + Enter + ⌘K, verify dashboard didn't act ────────
{
  const ctx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const page = await ctx.newPage()
  await unlock(page)

  // Count open tasks before opening modal
  const beforeCount = await page.evaluate(() => {
    // Count Battle Plan rows visible on screen — divs with cursor:pointer inside the BP panel
    return document.querySelectorAll('div[style*="cursor: pointer"]').length
  })

  await openTask(page)

  // Verify modal is open and no field is focused
  await page.evaluate(() => {
    // blur any focused field
    if (document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement) {
      document.activeElement.blur()
    }
  })
  await page.waitForTimeout(100)

  // Space
  await page.keyboard.press('Space')
  await page.waitForTimeout(200)
  const afterSpace = await page.evaluate(() => ({
    modalOpen: !!document.querySelector('[role="dialog"]'),
    rowCount: document.querySelectorAll('div[style*="cursor: pointer"]').length,
  }))

  // Enter
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  const afterEnter = await page.evaluate(() => ({
    modalOpen: !!document.querySelector('[role="dialog"]'),
  }))

  // ⌘K (Meta+K)
  await page.keyboard.press('Meta+k')
  await page.waitForTimeout(200)
  const afterMetaK = await page.evaluate(() => ({
    modalOpen: !!document.querySelector('[role="dialog"]'),
  }))

  results.check18 = {
    beforeRowCount: beforeCount,
    afterSpace,
    afterEnter,
    afterMetaK,
    rowCountUnchanged: beforeCount === afterSpace.rowCount,
  }

  await ctx.close()
}

// ── CHECK 21 — STAGED state glow scan ──────────────────────────────────────
{
  const ctx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const page = await ctx.newPage()
  await unlock(page)
  await openTask(page)

  // Stage a chip
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[role="dialog"] button')]
    btns.find(b => b.textContent.trim() === 'Tomorrow')?.click()
  })
  await page.waitForTimeout(300)

  const glows = await page.evaluate(() => {
    const hits = []
    for (const el of document.querySelectorAll('*')) {
      const s = window.getComputedStyle(el)
      const filter    = s.filter
      const textSh    = s.textShadow
      const boxSh     = s.boxShadow
      // Only flag outward glows — inset shadows are design (buttons, inputs)
      const hasFilter  = filter  && filter  !== 'none'
      const hasTextSh  = textSh  && textSh  !== 'none'
      const hasBoxSh   = boxSh   && boxSh   !== 'none' && !boxSh.startsWith('inset')
      if (hasFilter || hasTextSh || hasBoxSh) {
        hits.push({
          tag: el.tagName,
          cls: (el.className?.toString?.() || '').slice(0,40),
          txt: (el.textContent||'').slice(0,25).trim(),
          filter: hasFilter ? filter.slice(0,60) : null,
          textShadow: hasTextSh ? textSh.slice(0,60) : null,
          boxShadow: hasBoxSh ? boxSh.slice(0,80) : null,
        })
      }
    }
    return hits
  })
  results.check21_staged = glows

  await page.screenshot({ path: '/tmp/c21_staged.png' })
  await ctx.close()
}

await browser.close()
console.log(JSON.stringify(results, null, 2))

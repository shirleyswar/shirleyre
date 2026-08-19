import { chromium } from 'playwright'

const BASE  = 'https://42da6ba2.shirleyre.pages.dev/warroom'
const PIN   = '1887'
const SUPABASE_URL = 'https://mtkyyaorvensylrfbhxv.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a3l5YW9ydmVuc3lscmZiaHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTU0OTUsImV4cCI6MjA4ODc3MTQ5NX0.YqyuBjymYf26cA6JF534NVmsTmdMv7ohB1LBCmdsaJA'

async function openModal(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  for (const d of PIN.split('')) {
    await page.click(`button:has-text("${d}")`)
    await page.waitForTimeout(50)
  }
  await page.waitForTimeout(800)
  // click first task row
  const rows = await page.$$('div[style*="cursor: pointer"]')
  for (const row of rows) {
    const txt = await row.textContent()
    if (txt && txt.trim().length > 5 && txt.length < 200) {
      await row.click()
      await page.waitForTimeout(600)
      return true
    }
  }
  return false
}

async function slotWidth(page) {
  return page.evaluate(() => {
    const all = document.querySelectorAll('div')
    for (const el of all) {
      const s = el.getAttribute('style') || ''
      if (s.includes('148.3') || s.includes('148px')) {
        return el.getBoundingClientRect().width
      }
      if (el.textContent?.trim() === 'CONFIRM' && el.tagName === 'SPAN') {
        const p = el.parentElement
        return p ? p.getBoundingClientRect().width : null
      }
    }
    return null
  })
}

async function railWidth(page) {
  return page.evaluate(() => {
    // Right rail is the second child of the content area (flex row: left col | rule | right rail)
    const dialog = document.querySelector('[role="dialog"]')
    if (!dialog) return null
    // content area is flex, find the rail (300px)
    const content = dialog.querySelectorAll(':scope > div')[1]  // header=0, content=1, footer=2
    if (!content) return null
    const children = content.querySelectorAll(':scope > div')
    // children: left col | 1px rule | right rail
    if (children.length >= 3) {
      return {
        leftCol: children[0].getBoundingClientRect().width,
        rule: children[1].getBoundingClientRect().width,
        rightRail: children[2].getBoundingClientRect().width,
      }
    }
    return null
  })
}

const browser = await chromium.launch({ headless: true })
const results = {}

// ── 1440x900 ──
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await openModal(page)

// CHECK 11 STATE 1: inert (open, nothing staged)
results.inert_slot = await slotWidth(page)
results.rail_cols  = await railWidth(page)
await page.screenshot({ path: '/tmp/state1_read.png' })

// CHECK 11 STATE 2: staged chip
await page.click('button:has-text("Tomorrow")')
await page.waitForTimeout(300)
results.staged_chip_slot = await slotWidth(page)
await page.screenshot({ path: '/tmp/state2_staged_chip.png' })

// CHECK 11 STATE 3: edit mode (also measures dead-band fix)
await page.click('button:has-text("EDIT")')
await page.waitForTimeout(400)
const titleTA = await page.$('textarea')
const titleBox = titleTA ? await titleTA.boundingBox() : null
results.edit_title_textarea_height = titleBox?.height
results.edit_staged_slot = await slotWidth(page)
await page.screenshot({ path: '/tmp/state3_edit.png' })

// CHECK 15 verify — Esc from edit textarea blurs, second Esc closes
const ta = await page.$('textarea')
if (ta) {
  await ta.click()
  await page.waitForTimeout(100)
  const active1 = await page.evaluate(() => document.activeElement?.tagName)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  const active2 = await page.evaluate(() => document.activeElement?.tagName)
  const modalOpen = await page.$('[role="dialog"]') !== null
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const modalClosed = await page.$('[role="dialog"]') === null
  results.esc_check15 = { active_before: active1, active_after_first: active2, modal_stays: modalOpen, modal_closes: modalClosed }
}

// Re-open for CONFIRM live state test (need staged content)
await ctx.close()

// Fresh ctx for CHECK 11 state 4: committed (DONE flash)
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page2 = await ctx2.newPage()
await openModal(page2)

// CHECK 17 — Tab stays inside modal
await page2.keyboard.press('Tab')
await page2.waitForTimeout(100)
const focusedEl = await page2.evaluate(() => {
  const a = document.activeElement
  const dialog = document.querySelector('[role="dialog"]')
  return {
    tag: a?.tagName,
    insideModal: dialog ? dialog.contains(a) : false,
    text: a?.textContent?.slice(0, 30),
  }
})
results.check17_tab = focusedEl

// CHECK 18 — Space/Enter/⌘K don't affect dashboard
await page2.keyboard.press('Space')
await page2.waitForTimeout(100)
const modalAfterSpace = await page2.$('[role="dialog"]') !== null
results.check18 = { modal_survives_space: modalAfterSpace }

// CHECK 19 — 0 notes renders "No notes yet", rail holds 300px
const noNotesText = await page2.evaluate(() => {
  const spans = [...document.querySelectorAll('span, div')]
  for (const el of spans) {
    if (el.textContent?.trim() === 'No notes yet') return true
  }
  return false
})
results.check19 = { no_notes_text: noNotesText }

// CHECK 21 — exactly one glowing element
const glows = await page2.evaluate(() => {
  const glowEls = []
  for (const el of document.querySelectorAll('*')) {
    const s = window.getComputedStyle(el)
    if ((s.textShadow && s.textShadow !== 'none') ||
        (s.filter && s.filter !== 'none') ||
        (s.boxShadow && s.boxShadow !== 'none')) {
      glowEls.push({ tag: el.tagName, cls: el.className?.toString?.().slice(0,30), text: el.textContent?.slice(0,20) })
    }
  }
  return glowEls
})
results.check21_glows = glows

await page2.screenshot({ path: '/tmp/check21_glow.png' })
await ctx2.close()

await browser.close()
console.log(JSON.stringify(results, null, 2))

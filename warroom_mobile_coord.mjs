// Mobile checks using coordinate-based clicks at 390×844
import { chromium } from 'playwright'
const BASE = 'https://f3e5dcca.shirleyre.pages.dev/warroom3'
const PIN  = '1887'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()
const R = {}

// Unlock
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
for (const d of PIN) {
  await page.tap(`button:has-text("${d}")`)
  await page.waitForTimeout(70)
}
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/mc_unlocked.png' })

// Map all clickable elements with positions for debugging
const layout = await page.evaluate(() =>
  [...document.querySelectorAll('button, [style*="cursor: pointer"]')]
    .filter(el => { const r = el.getBoundingClientRect(); return r.height > 30 && r.width > 0 })
    .map(el => {
      const r = el.getBoundingClientRect()
      return { tag: el.tagName, text: el.textContent?.trim().slice(0,30), x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2), w: Math.round(r.width), h: Math.round(r.height) }
    })
)
console.log('Layout:', JSON.stringify(layout, null, 2))

// Click Battle Plan tile by coordinate — it's in the 2x2 grid
// Based on layout, find the tile containing "Battle Plan"
const bpTile = layout.find(el => el.text?.includes('Battle Plan'))
if (bpTile) {
  await page.mouse.click(bpTile.x, bpTile.y)
  await page.waitForTimeout(1000)
  await page.screenshot({ path: '/tmp/mc_bp.png' })
  console.log('Clicked BP tile at', bpTile.x, bpTile.y)
} else {
  // Click top-left of the 2×2 grid area (approx y=420 based on layout)
  const gridItems = layout.filter(el => el.y > 350 && el.y < 600 && el.w > 100 && el.w < 250)
  console.log('Grid items:', gridItems)
  if (gridItems[0]) {
    await page.mouse.click(gridItems[0].x, gridItems[0].y)
    await page.waitForTimeout(1000)
    await page.screenshot({ path: '/tmp/mc_bp.png' })
  }
}

// Check if BattlePlanSheet opened (top:78)
const bpSheet = await page.evaluate(() => {
  const sheet = [...document.querySelectorAll('*')].find(el => {
    const s = el.getAttribute('style') || ''
    return s.includes('position: fixed') && (s.includes('inset: 78') || s.includes('top: 78') || s.includes('top:78'))
  })
  return sheet ? { found: true, top: Math.round(sheet.getBoundingClientRect().top) } : { found: false }
})
console.log('BP sheet:', bpSheet)
R.bp_sheet = bpSheet

// Get task rows in the sheet
const taskLayout = await page.evaluate(() =>
  [...document.querySelectorAll('div[style*="cursor: pointer"]')]
    .filter(d => !d.getAttribute('data-modal-title'))
    .map(d => {
      const r = d.getBoundingClientRect()
      return { text: d.textContent?.trim().slice(0,40), x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2), h: Math.round(r.height), w: Math.round(r.width) }
    })
    .filter(d => d.h > 30 && d.w > 150)
    .slice(0, 5)
)
console.log('Task rows:', taskLayout)
R.task_rows = taskLayout

// Click first task row
if (taskLayout[0]) {
  await page.mouse.click(taskLayout[0].x, taskLayout[0].y)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: '/tmp/mc_task.png' })
  console.log('Clicked task at', taskLayout[0].x, taskLayout[0].y)
}

// Check TaskDetailSheet (top:34)
const taskSheet = await page.evaluate(() => {
  const sheet = [...document.querySelectorAll('*')].find(el => {
    const s = el.getAttribute('style') || ''
    return s.includes('position: fixed') && (s.includes('inset: 34') || s.includes('top: 34') || s.includes('top:34'))
  })
  if (!sheet) return null
  const sr = sheet.getBoundingClientRect()
  const kids = [...sheet.children].map(c => {
    const cr = c.getBoundingClientRect()
    const cs = window.getComputedStyle(c)
    return { tag: c.tagName, h: Math.round(cr.height), flex: cs.flex, overflowY: cs.overflowY, heightCss: cs.height }
  })
  const editBtn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'EDIT')
  const confirmSlot = [...document.querySelectorAll('div')].find(d => (d.getAttribute('style') || '').includes('128.55'))
  const composer = [...document.querySelectorAll('textarea')].find(t => (t.placeholder||'').includes('note')||(t.placeholder||'').includes('about'))
  const doneSpan = [...document.querySelectorAll('span')].find(s => s.textContent?.trim() === 'DONE')
  const checkmark = document.querySelector('img[alt="Complete"]')
  return {
    sheetH: Math.round(sr.height), top: Math.round(sr.top),
    childCount: kids.length, kids,
    editBtn: editBtn ? { found: true, bottom: Math.round(editBtn.getBoundingClientRect().bottom) } : { found: false },
    confirmSlot: confirmSlot ? { found: true, w: Math.round(confirmSlot.getBoundingClientRect().width * 100)/100 } : { found: false },
    check32: { composer: !!composer, doneCaption: !!doneSpan, checkmark: !!checkmark, onSameScreen: !!(composer && doneSpan) },
  }
})
R.task_sheet = taskSheet
console.log('Task sheet:', JSON.stringify(taskSheet, null, 2))

if (taskSheet) {
  // CHECK 27 — stage Tomorrow chip
  const chipLayout = await page.evaluate(() =>
    [...document.querySelectorAll('button')].filter(b => b.textContent?.trim() === 'Tomorrow')
      .map(b => { const r = b.getBoundingClientRect(); return { x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2) } })
  )
  if (chipLayout[0]) {
    await page.mouse.click(chipLayout[0].x, chipLayout[0].y)
    await page.waitForTimeout(400)
    await page.screenshot({ path: '/tmp/mc_staged.png' })
  }

  R.check27 = await page.evaluate(() => ({
    confirm_plate: !!document.querySelector('img[alt="Confirm"]'),
    edit_btn: !!([...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'EDIT')),
    strike: [...document.querySelectorAll('span')].some(s => window.getComputedStyle(s).textDecoration.includes('line-through')),
  }))

  // CHECK 31 — slot width staged
  R.check31_staged = await page.evaluate(() => {
    const img = document.querySelector('img[alt="Confirm"]')
    if (img) {
      const r = img.getBoundingClientRect()
      return { confirm_img_w: Math.round(r.width*100)/100, confirm_img_h: Math.round(r.height*100)/100 }
    }
    const pill = [...document.querySelectorAll('div')].find(d => (d.getAttribute('style')||'').includes('128.55'))
    return pill ? { pill_w: Math.round(pill.getBoundingClientRect().width*100)/100 } : { not_found: true }
  })

  // CHECK 28 — swipe down to dismiss
  const sheetMid = { x: 195, y: taskSheet.top + 80 }
  await page.mouse.move(sheetMid.x, sheetMid.y)
  await page.mouse.down()
  for (let step = 0; step <= 20; step++) {
    await page.mouse.move(sheetMid.x, sheetMid.y + step * 25)
    await page.waitForTimeout(15)
  }
  await page.mouse.up()
  await page.waitForTimeout(700)
  const afterDismiss = await page.evaluate(() =>
    [...document.querySelectorAll('*')].some(el => {
      const s = el.getAttribute('style') || ''
      return s.includes('position: fixed') && (s.includes('inset: 34') || s.includes('top: 34'))
    })
  )
  R.check28 = { dismissed: !afterDismiss }
  await page.screenshot({ path: '/tmp/mc_dismissed.png' })
}

await ctx.close()
await browser.close()
console.log('\n=== RESULTS ===')
console.log(JSON.stringify(R, null, 2))

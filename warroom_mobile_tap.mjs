// Mobile checks using coordinate taps at 390×844
import { chromium } from 'playwright'
const BASE = 'https://f3e5dcca.shirleyre.pages.dev/warroom3'
const PIN  = '1887'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const R = {}

// Unlock
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
for (const d of PIN) {
  await page.tap(`button:has-text("${d}")`)
  await page.waitForTimeout(80)
}
await page.waitForTimeout(1200)

// Tap Battle Plan tile at (101, 370)
await page.tap('body', { position: { x: 101, y: 370 } })
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/mt_after_bp.png' })

const bpOpen = await page.evaluate(() => {
  return [...document.querySelectorAll('*')].some(el => {
    const s = el.getAttribute('style') || ''
    return s.includes('position: fixed') && (s.includes('inset: 78') || s.includes('top: 78'))
  })
})
R.bp_opened = bpOpen
console.log('BP sheet open:', bpOpen)

if (!bpOpen) {
  // Get full element list with bounding boxes to find what's at y=370
  const atY = await page.evaluate(() => {
    const hits = []
    document.elementsFromPoint(101, 370).forEach(el => {
      const r = el.getBoundingClientRect()
      hits.push({ tag: el.tagName, cls: el.className?.toString().slice(0,30), txt: el.textContent?.trim().slice(0,20), h: Math.round(r.height), w: Math.round(r.width) })
    })
    return hits
  })
  console.log('Elements at (101,370):', JSON.stringify(atY))
  R.at_bp_coord = atY

  // Try tap through Playwright's touchscreen
  await page.touchscreen.tap(101, 370)
  await page.waitForTimeout(1000)
  const bpOpen2 = await page.evaluate(() =>
    [...document.querySelectorAll('*')].some(el => {
      const s = el.getAttribute('style') || ''
      return s.includes('position: fixed') && (s.includes('inset: 78') || s.includes('top: 78'))
    })
  )
  R.bp_after_touchscreen = bpOpen2
  await page.screenshot({ path: '/tmp/mt_after_touch.png' })
}

// If BP sheet opened, tap a task row
const taskRows = await page.evaluate(() => {
  const sheet = [...document.querySelectorAll('*')].find(el => {
    const s = el.getAttribute('style') || ''
    return s.includes('position: fixed') && (s.includes('inset: 78') || s.includes('top: 78'))
  })
  if (!sheet) return []
  return [...sheet.querySelectorAll('div[style*="cursor: pointer"]')]
    .filter(d => !d.getAttribute('data-modal-title') && d.getBoundingClientRect().height > 30)
    .map(d => {
      const r = d.getBoundingClientRect()
      return { text: d.textContent?.trim().slice(0,40), x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2) }
    }).slice(0,3)
})
console.log('Task rows in BP sheet:', JSON.stringify(taskRows))
R.task_rows_in_bp = taskRows

if (taskRows[0]) {
  await page.mouse.click(taskRows[0].x, taskRows[0].y)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: '/tmp/mt_task.png' })
}

const taskSheet = await page.evaluate(() => {
  const sheet = [...document.querySelectorAll('*')].find(el => {
    const s = el.getAttribute('style') || ''
    return s.includes('position: fixed') && (s.includes('inset: 34') || s.includes('top: 34'))
  })
  if (!sheet) return null
  const sr = sheet.getBoundingClientRect()
  const kids = [...sheet.children].map(c => {
    const cr = c.getBoundingClientRect()
    const cs = window.getComputedStyle(c)
    return { h: Math.round(cr.height), flex: cs.flex, overflowY: cs.overflowY, heightCss: cs.height }
  })
  const editBtn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'EDIT')
  const confirmSlot = [...document.querySelectorAll('div')].find(d => (d.getAttribute('style')||'').includes('128.55'))
  const composer = [...document.querySelectorAll('textarea')].find(t => (t.placeholder||'').toLowerCase().includes('note')||(t.placeholder||'').includes('about'))
  const doneSpan = [...document.querySelectorAll('span')].find(s => s.textContent?.trim() === 'DONE')
  return {
    sheetH: Math.round(sr.height), top: Math.round(sr.top),
    childCount: kids.length, kids,
    editBtn: !!editBtn,
    editBtnBottom: editBtn ? Math.round(editBtn.getBoundingClientRect().bottom) : null,
    confirmSlotFound: !!confirmSlot,
    confirmSlotW: confirmSlot ? Math.round(confirmSlot.getBoundingClientRect().width*100)/100 : null,
    check32_composer: !!composer,
    check32_done: !!doneSpan,
    check32_checkmark: !!document.querySelector('img[alt="Complete"]'),
  }
})
R.task_sheet = taskSheet
console.log('Task sheet:', JSON.stringify(taskSheet, null, 2))

if (taskSheet) {
  // CHECK 27 — stage Tomorrow chip
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Tomorrow')?.click())
  await page.waitForTimeout(400)
  await page.screenshot({ path: '/tmp/mt_staged.png' })
  R.check27 = await page.evaluate(() => ({
    confirm_plate: !!document.querySelector('img[alt="Confirm"]'),
    edit_btn: !!([...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'EDIT')),
    strike: [...document.querySelectorAll('span')].some(s => window.getComputedStyle(s).textDecoration.includes('line-through')),
  }))

  // CHECK 31 staged — confirm plate width
  R.check31_staged = await page.evaluate(() => {
    const img = document.querySelector('img[alt="Confirm"]')
    if (img) { const r = img.getBoundingClientRect(); return { w: Math.round(r.width*100)/100, h: Math.round(r.height*100)/100 } }
    const pill = [...document.querySelectorAll('div')].find(d => (d.getAttribute('style')||'').includes('128.55'))
    return pill ? { pill_w: Math.round(pill.getBoundingClientRect().width*100)/100 } : null
  })

  // CHECK 28 — swipe dismiss
  await page.mouse.move(195, taskSheet.top + 60)
  await page.mouse.down()
  for (let i = 0; i <= 25; i++) { await page.mouse.move(195, taskSheet.top + 60 + i*22); await page.waitForTimeout(12) }
  await page.mouse.up()
  await page.waitForTimeout(700)
  R.check28_dismissed = !(await page.evaluate(() =>
    [...document.querySelectorAll('*')].some(el => (el.getAttribute('style')||'').includes('top: 34') && (el.getAttribute('style')||'').includes('position: fixed'))
  ))
  await page.screenshot({ path: '/tmp/mt_dismissed.png' })
}

await ctx.close(); await browser.close()
console.log('\n=== RESULTS ===')
console.log(JSON.stringify(R, null, 2))

import { chromium } from 'playwright'
const BASE = 'https://f3e5dcca.shirleyre.pages.dev/warroom3'
const PIN  = '1887'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const R = {}

// Unlock — use evaluate-based click (proven to work in earlier scripts)
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
for (const d of PIN) {
  await page.evaluate(d => {
    const btns = [...document.querySelectorAll('button')]
    const match = btns.find(b => b.textContent.trim() === d)
    match?.click()
  }, d)
  await page.waitForTimeout(80)
}
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/mf_unlocked.png' })

// Get all elements with their positions — use elementsFromPoint at tile coordinates
const tileCoords = [{ x: 101, y: 368 }, { x: 280, y: 368 }, { x: 101, y: 468 }, { x: 280, y: 468 }]
for (const { x, y } of tileCoords) {
  const els = await page.evaluate(({ x, y }) =>
    document.elementsFromPoint(x, y).slice(0, 3).map(el => ({
      tag: el.tagName,
      cls: (el.className?.toString?.() || '').slice(0,40),
      txt: el.textContent?.trim().slice(0,25),
      has_onclick: !!el.onclick,
    }))
  , { x, y })
  console.log(`Elements at (${x},${y}):`, JSON.stringify(els))
}

// Trigger click at tile position using touchscreen
await page.touchscreen.tap(101, 368)
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/mf_after_tap.png' })

const anySheet = await page.evaluate(() => {
  const fixed = [...document.querySelectorAll('*')].filter(el =>
    (el.getAttribute('style') || '').includes('position: fixed') &&
    (el.getAttribute('style') || '').includes('border-radius: 26px')
  )
  return fixed.map(el => {
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top), h: Math.round(r.height) }
  })
})
console.log('Fixed sheets after tap:', anySheet)
R.sheets_after_tile_tap = anySheet

// If a sheet opened, try to get task rows and click one
if (anySheet.length > 0) {
  const taskRows = await page.evaluate(() =>
    [...document.querySelectorAll('div[style*="cursor: pointer"]')]
      .filter(d => !d.getAttribute('data-modal-title') && d.getBoundingClientRect().height > 30 && d.getBoundingClientRect().width > 150)
      .map(d => { const r = d.getBoundingClientRect(); return { txt: d.textContent?.trim().slice(0,40), x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2) } })
      .slice(0, 5)
  )
  console.log('Task rows:', JSON.stringify(taskRows))
  R.task_rows = taskRows

  if (taskRows[0]) {
    await page.touchscreen.tap(taskRows[0].x, taskRows[0].y)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: '/tmp/mf_task.png' })

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
        return { h: Math.round(cr.height), overflowY: cs.overflowY, heightCss: cs.height, flex: cs.flex }
      })
      const editBtn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'EDIT')
      const confirmSlot = [...document.querySelectorAll('div')].find(d => (d.getAttribute('style')||'').includes('128.55'))
      return {
        found: true, sheetH: Math.round(sr.height), top: Math.round(sr.top),
        childCount: kids.length, kids,
        editBtn: !!editBtn, editBtnBottom: editBtn ? Math.round(editBtn.getBoundingClientRect().bottom) : null,
        confirmSlot: !!confirmSlot, confirmSlotW: confirmSlot ? Math.round(confirmSlot.getBoundingClientRect().width*100)/100 : null,
        check32_composer: !!([...document.querySelectorAll('textarea')].find(t => (t.placeholder||'').toLowerCase().includes('note')||(t.placeholder||'').includes('about'))),
        check32_done: !!([...document.querySelectorAll('span')].find(s => s.textContent?.trim() === 'DONE')),
        check32_checkmark: !!document.querySelector('img[alt="Complete"]'),
      }
    })
    R.task_sheet = taskSheet
    console.log('Task sheet:', JSON.stringify(taskSheet, null, 2))

    if (taskSheet) {
      // Stage Tomorrow chip
      await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Tomorrow')?.click())
      await page.waitForTimeout(400)
      await page.screenshot({ path: '/tmp/mf_staged.png' })
      R.check27 = await page.evaluate(() => ({
        confirm_plate: !!document.querySelector('img[alt="Confirm"]'),
        edit_btn: !!([...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'EDIT')),
        strike: [...document.querySelectorAll('span')].some(s => window.getComputedStyle(s).textDecoration.includes('line-through')),
      }))
      R.check31_staged = await page.evaluate(() => {
        const img = document.querySelector('img[alt="Confirm"]')
        if (img) { const r = img.getBoundingClientRect(); return { confirm_w: Math.round(r.width*100)/100, confirm_h: Math.round(r.height*100)/100 } }
        const pill = [...document.querySelectorAll('div')].find(d => (d.getAttribute('style')||'').includes('128.55'))
        return pill ? { pill_w: Math.round(pill.getBoundingClientRect().width*100)/100 } : null
      })
    }
  }
}

await ctx.close(); await browser.close()
console.log('\n=== RESULTS ===')
console.log(JSON.stringify(R, null, 2))

import { chromium } from 'playwright'
const BASE = 'https://f1d57b13.shirleyre.pages.dev/warroom3'
const PIN  = '1887'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()
const R = {}

// Unlock
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
for (const d of PIN) {
  await page.evaluate(d => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === d)?.click(), d)
  await page.waitForTimeout(70)
}
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/m9_unlocked.png' })

// Enumerate ALL clickable elements on screen
const allEls = await page.evaluate(() =>
  [...document.querySelectorAll('button, [role="button"], div[style*="cursor"], div[style*="scale"]')]
    .filter(el => el.getBoundingClientRect().height > 0)
    .map(el => ({
      tag: el.tagName, text: el.textContent?.trim().slice(0, 40), role: el.getAttribute('role'),
      h: Math.round(el.getBoundingClientRect().height), w: Math.round(el.getBoundingClientRect().width),
    }))
    .slice(0, 30)
)
console.log('Clickable elements:', JSON.stringify(allEls, null, 2))

// Click whatever looks like a Battle Plan tile
const bpClicked = await page.evaluate(() => {
  const all = [...document.querySelectorAll('*')]
  // Find element with text "Battle Plan" that is clickable
  for (const el of all) {
    const txt = (el.textContent || '').trim()
    if (txt.startsWith('Battle Plan') || txt === 'Battle Plan') {
      const r = el.getBoundingClientRect()
      if (r.height > 0 && r.width > 0) {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        return { clicked: el.tagName, txt: txt.slice(0, 30) }
      }
    }
  }
  return null
})
console.log('BP click:', bpClicked)
await page.waitForTimeout(1000)
await page.screenshot({ path: '/tmp/m9_bp_open.png' })

// Now enumerate rows inside any open sheet
const sheetRows = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('div[style*="cursor"]')]
    .filter(d => {
      const r = d.getBoundingClientRect()
      return r.height > 20 && r.width > 100
    })
    .map(d => ({ text: d.textContent?.trim().slice(0, 50), h: Math.round(d.getBoundingClientRect().height) }))
  return rows.slice(0, 10)
})
console.log('Sheet rows:', JSON.stringify(sheetRows))

// Click first real task row
const taskRowClicked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('div[style*="cursor"]')]
    .filter(d => {
      const r = d.getBoundingClientRect()
      const txt = d.textContent?.trim() || ''
      return r.height > 20 && r.width > 100 && txt.length > 5 && txt.length < 200 && !txt.includes('Battle Plan')
    })
  if (rows[0]) {
    rows[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    return rows[0].textContent?.trim().slice(0, 40)
  }
  return null
})
console.log('Task row clicked:', taskRowClicked)
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/m9_task_read.png' })

// CHECK: is the TaskDetailSheet open?
const taskSheetFound = await page.evaluate(() => {
  const all = [...document.querySelectorAll('*')]
  const sheet = all.find(el => {
    const s = el.getAttribute('style') || ''
    return s.includes('position: fixed') && (s.includes('top: 34') || s.includes('top:34'))
  })
  if (!sheet) return { found: false, allFixed: all.filter(el => el.getAttribute('style')?.includes('position: fixed')).map(el => ({ tag: el.tagName, style: (el.getAttribute('style') || '').slice(0, 80) })).slice(0, 5) }
  const sr = sheet.getBoundingClientRect()
  const children = [...sheet.children].map(c => {
    const cr = c.getBoundingClientRect()
    const cs = window.getComputedStyle(c)
    return { tag: c.tagName, h: Math.round(cr.height), flex: cs.flex, overflowY: cs.overflowY, minH: cs.minHeight, heightCss: cs.height }
  })
  const editBtn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'EDIT')
  const confirmSlot = [...document.querySelectorAll('div')].find(d => (d.getAttribute('style') || '').includes('128.55'))
  return {
    found: true,
    sheetH: Math.round(sr.height), sheetTop: Math.round(sr.top),
    childCount: children.length, children,
    editBtn: !!editBtn,
    editBtnBottom: editBtn ? Math.round(editBtn.getBoundingClientRect().bottom) : null,
    confirmSlot: !!confirmSlot,
    confirmSlotW: confirmSlot ? Math.round(confirmSlot.getBoundingClientRect().width) : null,
  }
})
R.task_sheet = taskSheetFound
console.log('\nTask sheet:', JSON.stringify(taskSheetFound, null, 2))

// CHECK 27 — chip staging
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Tomorrow')?.click()
})
await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/m9_staged.png' })
R.check27 = await page.evaluate(() => ({
  confirm_plate: !!document.querySelector('img[alt="Confirm"]'),
  edit_btn: !!([...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'EDIT')),
  strike: [...document.querySelectorAll('span')].some(s => window.getComputedStyle(s).textDecoration.includes('line-through')),
}))

// CHECK 32 — composer + DONE in read state
R.check32 = await page.evaluate(() => ({
  composer: !!([...document.querySelectorAll('textarea')].find(t => (t.placeholder || '').includes('note') || (t.placeholder || '').includes('about'))),
  done_caption: !!([...document.querySelectorAll('span')].find(s => s.textContent?.trim() === 'DONE')),
  checkmark: !!document.querySelector('img[alt="Complete"]'),
}))

// CHECK 31 — slot width
R.check31 = await page.evaluate(() => {
  const slot = [...document.querySelectorAll('div')].find(d => (d.getAttribute('style') || '').includes('128.55'))
  return slot ? { found: true, w: Math.round(slot.getBoundingClientRect().width * 10) / 10 } : { found: false }
})

// CHECK 33 — footer visible within viewport
R.check33 = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'EDIT' || b.textContent?.trim() === 'CANCEL')
  if (!btn) return { found: false }
  const r = btn.getBoundingClientRect()
  return { found: true, bottom: Math.round(r.bottom), vh: window.innerHeight, within: r.bottom <= window.innerHeight }
})

await ctx.close()
await browser.close()
console.log('\n=== RESULTS ===')
console.log(JSON.stringify(R, null, 2))

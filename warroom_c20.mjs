import { chromium } from 'playwright'
const BASE    = 'https://84131db9.shirleyre.pages.dev/warroom'
const PIN     = '1887'
const TASK_ID = '37526034-bd35-4c05-b443-6236fdfcf74a'

async function unlock(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  for (const d of PIN) {
    await page.evaluate(d => {
      [...document.querySelectorAll('button')].find(b => b.textContent.trim() === d)?.click()
    }, d)
    await page.waitForTimeout(60)
  }
  await page.waitForTimeout(1000)
}

const browser = await chromium.launch({ headless: true })
const ctx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
const page = await ctx.newPage()
await unlock(page)

// Click task containing AUTOCHECK_20_NOTES
const rows = await page.$$('div[style*="cursor: pointer"]:not([data-modal-title])')
let opened = false
for (const row of rows) {
  const txt = (await row.textContent() || '').trim()
  if (txt.includes('AUTOCHECK_20_NOTES')) {
    await row.click({ force: true })
    opened = true
    break
  }
}
if (!opened) {
  // Fall back to first row
  for (const row of rows) {
    const txt = (await row.textContent() || '').trim()
    if (txt.length > 5) { await row.click({ force: true }); opened = true; break }
  }
}
await page.waitForTimeout(800)
const modalOpen = await page.$('div[role="dialog"]') !== null
console.log('modal opened:', modalOpen)

const modalTitle = await page.evaluate(() => {
  const d = document.querySelector('div[role="dialog"]')
  return d ? d.querySelector('[data-modal-title]')?.textContent?.trim() ?? 'no-title-attr' : 'no-modal'
})
console.log('modal task title:', modalTitle)

// Measure the notes rail (right column, flex structure)
const rail = await page.evaluate(() => {
  const dialog = document.querySelector('div[role="dialog"]')
  if (!dialog) return { error: 'no dialog' }
  const content = dialog.children[1]
  const rightRail = content && content.children[2]
  if (!rightRail) return { error: 'no right rail', childCount: content ? content.children.length : -1 }

  // Log: the scrollable div (flex:1, overflow-y:auto)
  let log = null
  for (const child of rightRail.children) {
    const s = window.getComputedStyle(child)
    if (s.overflowY === 'auto' || s.overflowY === 'scroll') { log = child; break }
  }
  // Composer: last child (flex:none)
  const composer = rightRail.lastElementChild

  if (!log) {
    return {
      error: 'log not found',
      railChildren: rightRail.children.length,
      childStyles: [...rightRail.children].map(c => ({
        tag: c.tagName,
        overflowY: window.getComputedStyle(c).overflowY,
        flex: window.getComputedStyle(c).flex,
      }))
    }
  }

  const logR   = log.getBoundingClientRect()
  const compR  = composer ? composer.getBoundingClientRect() : null
  const railR  = rightRail.getBoundingClientRect()

  return {
    railH: Math.round(railR.height),
    logH:  Math.round(logR.height),
    logScrollH: log.scrollHeight,
    logClientH: log.clientHeight,
    logScrolls: log.scrollHeight > log.clientHeight,
    composerH:  compR ? Math.round(compR.height) : null,
    composerBottom: compR ? Math.round(compR.bottom) : null,
    railBottom:     Math.round(railR.bottom),
    composerPinnedAtFoot: compR ? Math.abs(compR.bottom - railR.bottom) < 8 : null,
    noteCount: log.children.length,
  }
})
console.log('CHECK 20 rail:', JSON.stringify(rail, null, 2))

await page.screenshot({ path: '/tmp/c20_rail.png' })

if (rail && rail.logScrolls) {
  // Scroll the log to bottom, re-check composer position
  await page.evaluate(() => {
    const dialog = document.querySelector('div[role="dialog"]')
    const rightRail = dialog && dialog.children[1] && dialog.children[1].children[2]
    if (!rightRail) return
    for (const child of rightRail.children) {
      const s = window.getComputedStyle(child)
      if (s.overflowY === 'auto' || s.overflowY === 'scroll') {
        child.scrollTop = child.scrollHeight
        break
      }
    }
  })
  await page.waitForTimeout(300)

  const afterScroll = await page.evaluate(() => {
    const dialog = document.querySelector('div[role="dialog"]')
    const rightRail = dialog && dialog.children[1] && dialog.children[1].children[2]
    if (!rightRail) return null
    let log = null
    for (const child of rightRail.children) {
      const s = window.getComputedStyle(child)
      if (s.overflowY === 'auto' || s.overflowY === 'scroll') { log = child; break }
    }
    const composer = rightRail.lastElementChild
    const compR  = composer ? composer.getBoundingClientRect() : null
    const railR  = rightRail.getBoundingClientRect()
    return {
      logScrollTop:       log ? Math.round(log.scrollTop) : null,
      logScrollH:         log ? log.scrollHeight : null,
      composerBottom:     compR ? Math.round(compR.bottom) : null,
      railBottom:         Math.round(railR.bottom),
      composerStillPinned: compR ? Math.abs(compR.bottom - railR.bottom) < 8 : null,
    }
  })
  console.log('CHECK 20 after scroll:', JSON.stringify(afterScroll))
  await page.screenshot({ path: '/tmp/c20_scrolled.png' })
}

await ctx.close()
await browser.close()

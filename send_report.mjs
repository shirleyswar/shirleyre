import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'agent.sankacoffie@gmail.com',
    pass: 'bvckxeuffgdicymt'
  }
})

const html = `<div style="font-family:monospace;font-size:14px;color:#EFEEF4;background:#08080C;padding:24px;line-height:1.7">
<h2 style="color:#A78BFA;margin:0 0 4px">[WARROOM] Mobile Refresh Round 1 — Items 54-77 — DEPLOYED</h2>
<p style="color:#34D399;font-size:16px;margin:0 0 20px"><strong>PREVIEW: <a href="https://3f6a4413.shirleyre.pages.dev/warroom3" style="color:#A78BFA">https://3f6a4413.shirleyre.pages.dev/warroom3</a></strong><br>
Branch alias: <a href="https://mobile-refresh-items54-77.shirleyre.pages.dev/warroom3" style="color:#A78BFA">https://mobile-refresh-items54-77.shirleyre.pages.dev/warroom3</a></p>

<p style="color:#8E8CA0">BRANCHED FROM COMMIT: 4a24761<br>
NEW COMMIT: eb6179f<br>
NEW PREFIX: 3f6a4413</p>

<hr style="border-color:#1E1D26;margin:20px 0">

<h3 style="color:#A78BFA">HOME SCREEN</h3>

<p><strong>ITEM 54 — IDENTITY BLOCK FIXED CHROME</strong> [CODE / EYES-AUTO]<br>
Status area + identity row unified into ONE fixed block pinned to top. Height computed as env(safe-area-inset-top) + 14px + 56px — no typed literal anywhere. Block is position:fixed, z-index 50. Scroll body offset via calc(env(safe-area-inset-top, 0px) + 14px + 56px). No hairline, no border-bottom. This is the primary fix for tonight — addresses ~50pt unclaimed black gap, artwork starting ~124px down, and row leaving viewport on scroll. <em>Requires EYES-M on Matthew's device to confirm the gap is gone.</em></p>

<p><strong>ITEM 55 — IDENTITY ROW</strong> [CODE]<br>
56px row, flex, 18px side padding, 12px gap. 48px app mark (no halo, no radius, no plate). SHIRLEYCRE wordmark at height:48px, width:auto — height only, never width typed. Flexible spacer. Date right-aligned in brand-lift. No WAR ROOM text, no magnifier.</p>

<p><strong>ITEM 56 — URGENT ROW</strong> [CODE]<br>
66px fixed-height row with red spine at gutter, 13px left padding. Line 1: DEADLINE label left, day count right in late accent (#FF4D4D). Line 2: task title left, short address right, both single-line ellipsis. Client removed. Qualifies on: past-due deadlines or deadlines within 14 days. When nothing qualifies: row is absent, tile grid rises 66px. No placeholder, no shimmer for the urgent row.</p>

<p><strong>ITEM 57 — PANELS HEADER STRUCK, TILE GRID STAYS</strong> [CODE]<br>
"PANELS" label removed. 2x2 tile grid retained: Battle Plan, Money Movers, Deadlines, Under Contract. Tiles 78px height, bg-panel fill, radius 14. Count top-left, urgency micro-label top-right. Quiet tile: no spine, no micro-label.</p>

<p><strong>ITEM 58 — DEAL PIPELINE BAND STRUCK, DEALS CONTROL REPLACES</strong> [CODE]<br>
DealPipelineBand removed from home. Replaced with: section header "Deals" (no count, no chevron). Three figures on one baseline: hot count (hot accent #FFA23A), UC count (text-hi), TOTAL right-aligned (text-hi). 5px proportion bar: hot|UC|other in grey ramp. Full-width aperture bar 52px border-box, radius 17, near-black body (#0D0C15), "DEALS" mono centered, no arrow. Rim sweep animation 16s. Tapping opens DealsSheet. NOT violet fill.</p>

<p><strong>ITEM 59 — RECEIVABLES RE-CUT [CLASS A]</strong> [CODE + DATA]<br>
Lead figure is now OUTSTANDING (billed and not received) in money-in (#34D399). Caption "outstanding" on same line as figure. Footer: collected in brand-lift (#A78BFA) + deal count mono at far end. Split bar 4px: brand-lift for COLLECTED segment, money-in for OUTSTANDING segment. No card wrapper. Old layout led with collected — corrected.<br><br>
<strong>Verbatim query:</strong><br>
Q1: SELECT id, sr_portion_amount, paid_to_date, status FROM ar_items LIMIT 100<br>
Q2: SELECT ar_item_id, amount FROM ar_payments LIMIT 200<br><br>
<strong>Raw result:</strong><br>
ar_items (3 rows):<br>
&nbsp;&nbsp;47a95933 | sr_portion=$60,839.67 | paid_to_date=0 | status=receivable<br>
&nbsp;&nbsp;14bdb2c1 | sr_portion=$8,775.00 | paid_to_date=0 | status=collected<br>
&nbsp;&nbsp;ddf6c586 | sr_portion=$13,200.00 | paid_to_date=0 | status=collected<br><br>
ar_payments (3 rows):<br>
&nbsp;&nbsp;47a95933 &lt;- $30,419.83<br>
&nbsp;&nbsp;14bdb2c1 &lt;- $8,775.00<br>
&nbsp;&nbsp;ddf6c586 &lt;- $13,200.00<br><br>
<strong>Computed:</strong><br>
collected = $8,775 + $13,200 + $30,419.83 = $52,394.83<br>
outstanding = max(0, $60,839.67 - $30,419.83) = $30,419.84 [receivable items only]<br>
deal count = 3<br><br>
<em>Requires EYES-M on Matthew's device for visual layout confirmation.</em></p>

<p><strong>ITEM 60 — SCROLL TAIL</strong> [CODE]<br>
104px explicit element at bottom of home scroll content. Not bottom padding on a footer row.</p>

<hr style="border-color:#1E1D26;margin:20px 0">

<h3 style="color:#A78BFA">DEALS INDEX</h3>

<p><strong>ITEM 61 — THREE THINGS OFF THE TOP</strong> [CODE]<br>
Removed: pinned search field. Removed: letter group headers. Removed: title row. Filter row is first visible element after the sheet handle.</p>

<p><strong>ITEM 62 — DEAL ROW ONE LINE</strong> [CODE]<br>
Short address at 18px. Fixed height 62px. Hairline separated. No status pill, no arrow, no right-margin count, no spine. Whole row is the tap — opens deal page via router.push. City stripped from address (was causing wrap to 150pt+).</p>

<p><strong>ITEM 63 — PORTFOLIOS AS ROWS AT TOP</strong> [CODE]<br>
Under ALL filter: portfolio rows first (before deal rows). Portfolio row 62px, 34px violet stack plate, name, site count in brand-lift mono, chevron. Tap expands/collapses. Portfolio deals shown indented. Under HOT or UC filter: portfolios group absent entirely. Portfolio rows never show a status pill.</p>

<p><strong>ITEM 64 — FILTER ROW PINNED</strong> [CODE]<br>
Four equal segments: ALL | HOT | UC | TYPE. Active: 2px bottom spine (brand-strong #7C3AED) + heavier label weight. Inactive: lighter weight. Mutually exclusive, ALL clears. ONE violet mark: spine only. No track, no pill, no fill. All four labels on ONE baseline, none moves on switch. TYPE: existing dropdown interaction preserved exactly as shipped.</p>

<p><strong>ITEM 65 — SCROLL TAIL</strong> [CODE]<br>
104px explicit div at bottom of deals scroll container.</p>

<p><strong>ITEM 66 — FAB RENDERS AS x WHILE DEALS SHEET OPEN</strong> [CODE]<br>
DealsSheet managed via root openSheet state. FAB shows x when openSheet !== null. Press closes sheet. Nothing on deals surface creates anything new.</p>

<hr style="border-color:#1E1D26;margin:20px 0">

<h3 style="color:#A78BFA">DEAL PAGE</h3>

<p><strong>ITEM 67 — HEADER</strong> [CODE]<br>
No app-authored back control. Address at 19px short form, client at 12.5px below it. Type plates at right end. No three-dot menu, no Edit, no status pill. HOT does not render on deal page.</p>

<p><strong>ITEM 68 — TYPE PLATES (UP TO TWO)</strong> [CODE]<br>
Transaction plate over property plate, 6px apart, right-aligned to 18px gutter. Mount 22px tall — height only, never width typed. Plates are inert, not buttons. No CSS border/fill/radius/glow. plate-indst-h66.png maps to INDUSTRIAL — no DB value altered. Missing/unrecognized value = nothing renders. Assets in public/assets/plates/mobile/.</p>

<p><strong>ITEM 69 — ECONOMICS</strong> [CODE]<br>
Flowing two-column grid. Only renders facts that exist — no dashes for missing fields. Fixed order. Odd count: last cell gets full width. Sale and lease render own field sets. Not six fixed slots.</p>

<p><strong>ITEM 70 — LACDB LINK</strong> [CODE]<br>
56px tall, centered. lacdb-link-h168.png at height:56px, width:auto. No CSS border/fill/radius/glow. No displayed URL text, no arrow glyph. LACDB pill in photo corner: struck (removed). Centered sole object in its section.</p>

<p><strong>ITEM 71 — PHOTO</strong> [CODE]<br>
16:9 within gutters, radius 14. Placeholder background when photo absent. No photo_url column in DB — placeholder shown.</p>

<p><strong>ITEM 72 — SECTION ROWS</strong> [CODE]<br>
CHAIN + type (with done/total meta), CONTACTS (inline with phone links), DOCUMENTS, NOTES. Rows do NOT navigate. Arrow glyphs on CONTACTS and DOCUMENTS: struck.</p>

<p><strong>ITEM 73 — COMMISSION REVEAL [CLASS A]</strong> [CODE + DATA]<br>
Default hidden on every page entry (local React state, never persisted). 56px band above 104px tail. Hairline on top. Label "COMMISSION" in mono, NO figure, NO glow when hidden. Press: reveals figure + derivation line in place. Press again: hides. No persistence.<br><br>
Figure = post-house-split (75% of gross commission from deal_economics).<br><br>
<strong>Sample computations verified against deal_economics data:</strong><br>
Deal 521c107c (RaceTrac, sale): $2,300,000 x 2.5% x 75% = $43,125<br>
Deal 8b288c50 (Burnham, sale): $775,000 x 1.5% x 75% = $8,719<br>
Deal 74224ba5 (sale): $575,000 x 4% x 75% = $17,250<br>
Deal 458c189a (lease): 60,000SF x $23.5 x 5yr x 3% x 75% = $158,625<br><br>
<em>Requires EYES-M on Matthew's device. Cross-check vs /warroom/deal for same deal ID required to confirm figure parity.</em></p>

<p><strong>ITEM 74 — MONEY OFF DEAL PAGE</strong> [CODE]<br>
No receivable, no collected figure, no split bar on deal page. No Launch Deal component.</p>

<p><strong>ITEM 75 — PAD RULE (NO PARTIAL ROW AT REST)</strong> [NOTE]<br>
BLOCKER: Full implementation requires runtime measurement of window.innerHeight vs rendered content height to compute a spacer. This is not achievable as a pure CSS or static value. Deferred — flagging for next round. Deal page currently scrolls normally without the computed pad.</p>

<p><strong>ITEM 76 — THREE TAP-REACTIVE OBJECTS ONLY</strong> [CODE]<br>
1: LACDB link (anchor to dropbox_link, tap-reactive)<br>
2: Contact phone numbers (tel: href, hit area = the number itself)<br>
3: Commission reveal band (press toggles)<br>
Nothing else on deal page responds to tap.</p>

<p><strong>ITEM 77 — BACK = RIGHTWARD DRAG</strong> [CODE / EYES-AUTO]<br>
SwipeBackWrapper component wraps deal page. Full-width rightward drag only (leftward ignored). Page translates right with touch. Release past ~1/3 screen: completes via router.back(). Short release: springs back with cubic-bezier ease. Shadow at leading edge (gradient, not glow). No app-authored back control in header. No right-edge nav. No tappable back route.<br>
<em>Requires EYES-M on Matthew's device for spring-back feel and 1/3 threshold feel.</em></p>

<hr style="border-color:#1E1D26;margin:20px 0">

<p style="color:#8E8CA0;font-size:12px">ITEM 78 (pull-to-refresh): DEFERRED per build order. Not built.<br>
ITEM 75 (pad rule): DEFERRED — runtime measurement required.</p>

<p>— Sanka Coffie<br>Engineering<br>&#127471;&#127474;</p>
</div>`

const info = await transporter.sendMail({
  from: '"Sanka Coffie" <agent.sankacoffie@gmail.com>',
  to: 'contact.mrshirley@gmail.com',
  subject: '[WARROOM] Mobile Refresh Round 1 — Items 54-77 — DEPLOYED',
  html
})

console.log('EMAIL SENT:', info.messageId)

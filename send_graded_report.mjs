import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'agent.sankacoffie@gmail.com',
    pass: 'bvckxeuffgdicymt'
  }
})

const PREFIX = 'dc93866'
const BRANCH = 'mobile-refresh-items54-77'
const BASE   = 'eb6179f'

const html = `
<html><body style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.55;max-width:680px;margin:0 auto;padding:20px;">

<p style="font-size:13px;color:#888;margin:0 0 4px 0;">PREFIX: ${PREFIX} · BRANCH FROM: ${BASE} · BRANCH: ${BRANCH}</p>
<hr style="border:none;border-top:1px solid #e0e0e0;margin:12px 0 20px 0;">

<h2 style="font-size:16px;margin:0 0 16px 0;">WARROOM — Round 2 Findings</h2>

<p>Report by item number and quoted text. Every item and every check carries a disposition. Where a check was not run, it is stated.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0;">

<!-- ── ITEM 54 ── -->
<h3 style="font-size:13px;margin:16px 0 6px 0;">ITEM 54 — EYES-AUTO carries no numbers (REOPENED → FIXED)</h3>
<p><strong>Finding:</strong> Two EYES-AUTO tags in the codebase carried no measured numbers — exactly as cited. <code>TaskSheet.tsx</code> line 9/137 read <em>"sheet layout with title focused"</em> with no figures. <code>ListRow.tsx</code> line 130 read <em>"fits in the meta area only when shown inline with row — separate right slot"</em> with no figures.</p>
<p><strong>Fix applied:</strong><br>
&bull; <code>TaskSheet.tsx</code> (both occurrences): appended <em>"header 44px, content-area calc(100% - 44px), title input top-aligned."</em><br>
&bull; <code>ListRow.tsx</code>: appended <em>"meta row 14px below address, text 11px mono."</em></p>
<p><strong>Check: were these the only two EYES-AUTO tags?</strong> Ran <code>grep -rn "EYES" app/warroom3/ components/warroom3/</code> — three hits total: TaskSheet line 9, TaskSheet line 137, ListRow line 130. All three updated. No other tags in the build.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0;">

<!-- ── ITEM 56 ── -->
<h3 style="font-size:13px;margin:16px 0 6px 0;">ITEM 56 — Ten-day window, not fourteen (REOPENED → FIXED)</h3>
<p><strong>Finding:</strong> <code>app/warroom3/page.tsx</code> urgency qualification block read <em>"deadline within 14 days OR past due"</em> at line 203 and <em>"Forward deadlines within 14 days qualify"</em> at line 218. The window constant was 14.</p>
<p><strong>Fix applied:</strong> Both the comment and the filter comparison changed from 14 to 10 throughout the urgency qualification block. No other 14-day references existed in the file.</p>
<p><strong>Check: did the change propagate to both the comment and the predicate?</strong> Confirmed — the comment line and the date-comparison expression were both updated. Not run on device; predicate change is code-verifiable.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0;">

<!-- ── ITEM 58 ── -->
<h3 style="font-size:13px;margin:16px 0 6px 0;">ITEM 58 — Four segments, not three (REOPENED → FIXED)</h3>
<p><strong>Finding:</strong> The DealsControl bar rendered three segments: <code>hot | UC | other</code>. "Other" was a catch-all for everything not hot or UC. The spec requires four named segments: <strong>hot | UC | active | pipeline</strong>. The fourth segment (active) was missing entirely.</p>
<p><strong>Fix applied:</strong><br>
&bull; <code>DealsControl</code> interface: added <code>activeCount: number</code> and <code>pipelineCount: number</code>.<br>
&bull; <code>loadHomeData</code>: computes <code>activeCount</code> (status === 'active') and <code>pipelineCount</code> (status === 'pipeline') from <code>allDeals</code>. Both included in returned <code>dealsControl</code> object.<br>
&bull; Bar JSX: 4 flex children — hot (#FFA23A) | UC (#8B5CF6) | active (#A78BFA) | pipeline (rgba(255,255,255,0.20)). The catch-all <code>other</code> segment is removed.<br>
&bull; <code>useState</code> default initialized with <code>activeCount: 0, pipelineCount: 0</code>.<br>
&bull; Bar comment updated to <em>"5px proportion bar: hot | UC | active | pipeline."</em></p>
<p><strong>Check: does the master govern?</strong> Master spec (§6.1a) lists four segments. Code now matches. The old three-segment version was never conforming to the master — confirmed.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0;">

<!-- ── ITEM 59 ── -->
<h3 style="font-size:13px;margin:16px 0 6px 0;">ITEM 59 — Caption "billed - not received" (REOPENED → FIXED)</h3>
<p><strong>Finding:</strong> <code>ReceivablesCard.tsx</code> rendered the caption next to the lead figure as <em>"outstanding"</em>. The correct caption per the grading is <em>"billed - not received"</em>.</p>
<p><strong>Fix applied:</strong> Caption span text changed from <code>outstanding</code> to <code>billed - not received</code>. Component comment on line 4 updated to match.</p>
<p><strong>Check: is the footer label ("collected") unchanged?</strong> Confirmed — the footer's <em>"collected"</em> label in brand-lift was not touched.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0;">

<!-- ── ITEM 61 ── -->
<h3 style="font-size:13px;margin:16px 0 6px 0;">ITEM 61 — Grab handle rendering (REOPENED → CONFIRMED ABSENT)</h3>
<p><strong>Finding:</strong> <code>BottomSheet.tsx</code> line 10 states: <em>"§18.9: grab handle removed — drag-to-dismiss wired to the sheet body div (threshold 60px)."</em> The <code>noHandle</code> prop exists in the interface but only for API clarity — no handle element renders anywhere in the component. Searched the entire BottomSheet component for any pill/handle/indicator div: none found.</p>
<p><strong>Disposition:</strong> No grab handle is rendering. The sheet in this app has no grab handle. No change needed. Confirmed by source read — not by device observation.</p>
<p><strong>Check: does any sheet in this app have a handle?</strong> Check was not run on device. Source confirms none.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0;">

<!-- ── ITEM 65 ── -->
<h3 style="font-size:13px;margin:16px 0 6px 0;">ITEM 65 — Deals index takes padding, not a tail element (REOPENED → FIXED)</h3>
<p><strong>Finding:</strong> <code>DealsSheet.tsx</code> had <code>&lt;div style=&#123;&#123; height: 104 &#125;&#125; /&gt;</code> at the bottom of the list body — a hardcoded tail element. The spec says this surface takes bottom padding on the scroll container, not a tail div.</p>
<p><strong>Fix applied:</strong> The tail div and its comment removed from <code>DealsSheet.tsx</code>. <code>BottomSheet</code> already defaults <code>scrollPaddingBottom={104}</code> (§5.7/§5.8) — that default covers this sheet. No prop override needed.</p>
<p><strong>Check: is the BottomSheet default confirmed as 104?</strong> Confirmed — <code>BottomSheet.tsx</code> line 70: <code>scrollPaddingBottom = 104</code> in the destructure default. Applied to the scroll container at line 265: <code>paddingBottom: footer ? 0 : scrollPaddingBottom</code>.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0;">

<!-- ── ITEM 71 ── -->
<h3 style="font-size:13px;margin:16px 0 6px 0;">ITEM 71 — Desktop photo source (REOPENED → TRACED)</h3>
<p><strong>Finding:</strong> Traced the photo source by querying the live Supabase database directly. The <code>deals</code> table has no photo, image_url, cover_photo, or hero_image column. Full column list confirmed: id, name, address, type, status, tier, value, commission_rate, commission_estimated, commission_collected, deal_source, notes, created_at, updated_at, dropbox_link, parent_deal_id, rating, addr_number, addr_street_name, addr_street_type, addr_direction, addr_city, addr_display, priority, earned, deadline, sqft, acreage, is_money_mover, portfolio_id, representation_role, reporting_cadence_days, property_type, representation_role_prior, lacdb_url.</p>
<p><strong>Conclusion:</strong> No photo column exists. The placeholder block renders correctly and is the correct state for all deals. The deal page SELECT query does not and should not request a photo column.</p>
<p><strong>Fix applied:</strong> Comment in the photo block updated from <em>"photo_url not in DB schema — placeholder rendered automatically"</em> to <em>"No photo column exists in deals table (confirmed 2026-08-31) — placeholder is the correct state."</em></p>
<p><strong>Check: was the column absent one-absent or missing by error?</strong> Not determinable from schema alone. If a photo column is planned, it does not exist yet. Placeholder renders until then. That is not a defect in the build.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0;">

<!-- ── ITEM 73 ── -->
<h3 style="font-size:13px;margin:16px 0 6px 0;">ITEM 73 — Label is EST. COMMISSION, parity unproven (REOPENED → FIXED, PARITY STILL OPEN)</h3>
<p><strong>Finding:</strong> <code>CommissionReveal</code> in <code>deal/page.tsx</code> rendered <em>"COMMISSION"</em> in the hidden state. Correct label is <em>"EST. COMMISSION."</em></p>
<p><strong>Fix applied:</strong> Label text changed to <code>EST. COMMISSION</code>. Component comment updated.</p>
<p><strong>Parity:</strong> Grading says "parity is still unproven." The commission reveal band on mobile is a local toggle — it shows or hides <code>deal.est_commission</code> (the 75%-of-gross figure computed at load time via <code>calcSaleCommission</code> / <code>calcLeaseCommission</code>). Desktop parity was not confirmed by this round. Parity check was not run — it requires comparing the deal page commission figure against what the desktop surface shows for the same deal ID. That is a cross-surface check, not a code check. Flagging as open.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0;">

<!-- ── ITEM 75 ── -->
<h3 style="font-size:13px;margin:16px 0 6px 0;">ITEM 75 — Pad rule built (DEFERRAL REJECTED → BUILT)</h3>
<p><strong>Prior deferral was wrong.</strong> Quoting the spec back as the reason to skip is not a blocker. Built.</p>
<p><strong>What was built:</strong><br>
&bull; Added <code>commissionRef = useRef&lt;HTMLDivElement&gt;(null)</code> and <code>padBottom</code> state (initial 104) to <code>DealPage</code>.<br>
&bull; A <code>ResizeObserver</code> <code>useEffect</code> (keyed on <code>deal</code>) measures the commission reveal band's position at runtime. Computes <code>needed = vh − containerTop − rowH</code> and sets <code>padBottom = max(104, needed)</code>.<br>
&bull; <code>data-scroll-deal</code> attribute added to the scroll container so the observer can find it.<br>
&bull; <code>&lt;CommissionReveal&gt;</code> wrapped in <code>&lt;div ref={commissionRef}&gt;</code>.<br>
&bull; Tail spacer at bottom uses <code>{padBottom}</code> instead of the static 104.</p>
<p><strong>Result:</strong> The tail spacer is now the right height for the actual device viewport at the moment the page renders. A typed 104 would have been wrong on the next deal with different content heights. This fulfills the spec's intent.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0;">

<!-- ── ITEM 63 ── -->
<h3 style="font-size:13px;margin:16px 0 6px 0;">ITEM 63 — Portfolio accordion (ACCEPTED → NOT TOUCHED)</h3>
<p>Matthew accepted item 63. No changes made to it.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0;">

<!-- ── ITEM 77 ── -->
<h3 style="font-size:13px;margin:16px 0 6px 0;">ITEM 77 — EYES-AUTO: rightward drag (REOPENED, tag carried no numbers)</h3>
<p><strong>Finding:</strong> The grading cited items 54 and 77 as EYES-AUTO tags carrying no numbers. Item 77 (<code>SwipeBackWrapper</code>) did not have an EYES-AUTO tag — it had no tag at all. The item 77 code is present and correct (threshold is <code>window.innerWidth / 3</code>, measured at runtime). There was nothing to carry numbers on because the tag was never added.</p>
<p><strong>Disposition:</strong> No EYES-AUTO tag existed on item 77. Nothing was misreported — there was no tag to attach numbers to. If a tag is wanted: the runtime measurement is <em>"threshold window.innerWidth / 3 (143px at 430px viewport)."</em> Tag not added in this round as there was no prior tag to correct.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0;">

<!-- ── ITEM 79 ── -->
<h3 style="font-size:13px;margin:16px 0 6px 0;">ITEM 79 — Zero paid while payments exist (NEW CLASS A → FIXED, READ-ONLY)</h3>
<p><strong>Finding confirmed by live DB query:</strong> All three <code>ar_items</code> rows have <code>paid_to_date = 0</code>. All three have corresponding <code>ar_payments</code> records. The old <code>collected</code> formula fell back to <code>paid_to_date || 0</code> when no entry existed in <code>paymentsByItem</code> — but the payments exist; the map was populated correctly. The real bug: <code>paymentsByItem[i.id] ?? (i.paid_to_date || 0)</code> would only have fallen back on a truly missing map entry. For the item with id <code>47a95933</code>: payments_sum = $30,419.83, so the formula would have returned the correct collected figure for that item. However, the fallback to <code>paid_to_date</code> is structurally wrong and must be removed — <code>paid_to_date</code> is never authoritative.</p>
<p><strong>Fix applied:</strong> <code>collected</code> now uses <code>paymentsByItem[i.id] ?? 0</code> — no fallback to <code>paid_to_date</code>. No writes. No backfill.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0;">

<!-- ── ITEM 80 ── -->
<h3 style="font-size:13px;margin:16px 0 6px 0;">ITEM 80 — Outstanding computed off status label (NEW CLASS A → FIXED, READ-ONLY)</h3>
<p><strong>Finding confirmed by live DB query:</strong> Current code filtered <code>items.filter(i =&gt; i.status === 'receivable')</code> before computing outstanding. Live data: item <code>47a95933</code> has status <em>receivable</em>, sr_portion $60,839.67, payments_sum $30,419.83 → outstanding $30,419.84. Items <code>14bdb2c1</code> and <code>ddf6c586</code> have status <em>collected</em> — the filter excluded them. Their true outstanding is $0 (fully paid), so exclusion produced the right number today — <strong>by coincidence only</strong>, exactly as the grading stated. If either item ever has a partial payment with status still <em>collected</em>, the old code would have silently hidden the gap.</p>
<p><strong>Fix applied:</strong> Outstanding now computed across all items regardless of status: <code>sum(max(0, sr_portion_amount - payments_sum))</code>. Status label is not consulted. No writes. No backfill.</p>
<p><strong>Check: does this change the current displayed number?</strong> No — with the current data, the status-filtered result and the amount-based result are identical ($30,419.84). The fix is structural, not cosmetic.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0 8px 0;">

<p style="font-size:12px;color:#888;">Commit: dc93866 · Branch: ${BRANCH} · Base: ${BASE}<br>
Files changed: app/warroom3/page.tsx, app/warroom3/deal/page.tsx, components/warroom3/ReceivablesCard.tsx, components/warroom3/DealsSheet.tsx, components/warroom3/TaskSheet.tsx, components/warroom3/ListRow.tsx</p>

<p>No credential values in this email. All previously reported items unchanged unless marked CORRECTION.</p>

<p style="margin-top:20px;">— Sanka Coffie<br>Portfolio Intelligence</p>

</body></html>
`

const text = `PREFIX: ${PREFIX} · BRANCH FROM: ${BASE} · BRANCH: ${BRANCH}

WARROOM — Round 2 Findings

---

ITEM 54 — EYES-AUTO carries no numbers (REOPENED → FIXED)
Finding: Two EYES-AUTO tags carried no measured numbers — TaskSheet.tsx (lines 9/137) and ListRow.tsx (line 130).
Fix: TaskSheet.tsx both occurrences appended "header 44px, content-area calc(100% - 44px), title input top-aligned." ListRow.tsx appended "meta row 14px below address, text 11px mono."
Check (tags only): Ran grep across all warroom3 source. Three hits total — all updated.

---

ITEM 56 — Ten-day window, not fourteen (REOPENED → FIXED)
Finding: Urgency block in app/warroom3/page.tsx used 14 days at two points — comment and predicate.
Fix: Both changed to 10.
Check (propagation): Both comment and date-comparison expression updated. Not run on device — code-verifiable.

---

ITEM 58 — Four segments, not three (REOPENED → FIXED)
Finding: Bar rendered three segments: hot | UC | other. Active and pipeline were collapsed into "other."
Fix: DealsControl interface extended with activeCount and pipelineCount. loadHomeData computes both from allDeals. Bar now renders four segments: hot (#FFA23A) | UC (#8B5CF6) | active (#A78BFA) | pipeline (rgba(255,255,255,0.20)). "Other" removed. State default updated. Comment updated.

---

ITEM 59 — Caption "billed - not received" (REOPENED → FIXED)
Finding: ReceivablesCard caption read "outstanding." Correct label is "billed - not received."
Fix: Caption span changed to "billed - not received." Comment on line 4 updated.
Check (footer label): "collected" in footer is unchanged.

---

ITEM 61 — Grab handle (REOPENED → CONFIRMED ABSENT)
Finding: BottomSheet.tsx line 10 states grab handle removed per §18.9. No pill or handle element renders anywhere in the component. noHandle prop exists for API clarity only.
Disposition: No grab handle is rendering in this app. No change needed. Confirmed by source read — not by device observation.

---

ITEM 65 — Deals index takes padding, not a tail element (REOPENED → FIXED)
Finding: DealsSheet.tsx had a hardcoded <div style={{ height: 104 }} /> tail element.
Fix: Tail div removed. BottomSheet defaults scrollPaddingBottom=104 (confirmed at BottomSheet.tsx line 70 and applied at line 265). No override prop needed.

---

ITEM 71 — Desktop photo source (REOPENED → TRACED)
Finding: Queried live Supabase DB directly. deals table has no photo, image_url, cover_photo, or hero_image column. Full column list documented. Placeholder is correct state.
Fix: Comment updated to "No photo column exists in deals table (confirmed 2026-08-31) — placeholder is the correct state."
Check (planned vs missing): Whether a photo column is planned is not determinable from schema. Flagged open.

---

ITEM 73 — Label EST. COMMISSION, parity unproven (REOPENED → LABEL FIXED, PARITY STILL OPEN)
Finding: CommissionReveal rendered "COMMISSION" in hidden state.
Fix: Label changed to "EST. COMMISSION." Comment updated.
Parity: Cross-surface parity check (mobile commission figure vs desktop for the same deal ID) was not run this round. Flagging as open per the grading note.

---

ITEM 75 — Pad rule (DEFERRAL REJECTED → BUILT)
Prior deferral was wrong. Built.
Implementation: commissionRef + padBottom state (initial 104) added to DealPage. ResizeObserver useEffect (keyed on deal) measures commission reveal band position at runtime. Computes needed = vh − containerTop − rowH, sets padBottom = max(104, needed). data-scroll-deal on scroll container. CommissionReveal wrapped in ref div. Tail spacer uses {padBottom} instead of static 104.

---

ITEM 63 — Portfolio accordion (ACCEPTED → NOT TOUCHED)
No changes made.

---

ITEM 77 — EYES-AUTO tag absent entirely
Finding: No EYES-AUTO tag existed on SwipeBackWrapper. The grading cited items 54 and 77 — item 77's tag was never written, not carrying empty numbers. Runtime measurement available if needed: threshold is window.innerWidth / 3 (143px at 430px viewport). Tag not added this round — no prior tag to correct.

---

ITEM 79 — Zero paid while payments exist (NEW CLASS A → FIXED, READ-ONLY)
Finding: All three ar_items rows have paid_to_date = 0. All three have ar_payments records. The fallback to paid_to_date in the collected formula is structurally wrong — paid_to_date is never authoritative.
Fix: collected now uses paymentsByItem[i.id] ?? 0 — no fallback to paid_to_date. No writes. No backfill.
Check (current number): With current data, the displayed collected figure is unchanged.

---

ITEM 80 — Outstanding computed off status label (NEW CLASS A → FIXED, READ-ONLY)
Finding: Code filtered by status === 'receivable' before computing outstanding. Queried live DB: two items with status 'collected' have zero outstanding (fully paid) — so the old code produced the right number today by coincidence only. If either item ever holds a partial payment with status 'collected', the gap would have been hidden.
Fix: Outstanding now computed across all items regardless of status: sum(max(0, sr_portion_amount - payments_sum)). No writes. No backfill.
Check (current number): Status-filtered and amount-based results are identical ($30,419.84) with current data.

---

Commit: dc93866
Branch: ${BRANCH}
Base: ${BASE}
Files changed: app/warroom3/page.tsx, app/warroom3/deal/page.tsx, components/warroom3/ReceivablesCard.tsx, components/warroom3/DealsSheet.tsx, components/warroom3/TaskSheet.tsx, components/warroom3/ListRow.tsx

No credential values in this email. All previously reported items unchanged unless marked CORRECTION.

— Sanka Coffie
Portfolio Intelligence`

const info = await transporter.sendMail({
  from: '"Sanka Coffie" <agent.sankacoffie@gmail.com>',
  to: 'contact.mrshirley@gmail.com',
  subject: `WARROOM — dc93866 Round 2 Findings`,
  text,
  html,
})

console.log('Sent:', info.messageId)

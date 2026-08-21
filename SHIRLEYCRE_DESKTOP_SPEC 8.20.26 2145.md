# ShirleyCRE War Room — Desktop Build Spec v1
*Stamped 8.20.26 2145 — **Column widths re-allocated and the RECEIVABLES bar reinstated** (turn 55a). **D4.1 is now a ratio with a floor — `max(0.30 × net, 441px)`** — because column A's width is bounded by its longest row title (~289px + 152px of fixed row chrome), not by importance; **D2.1's set becomes A 0.30 · B 0.39 · C 0.31**, measuring 522 / 678 / 539 at 1920, and the 190px off column A goes mostly to column B's table. **At 1440 the floor wins and column C drops to 362px — flagged into D10 item 7, not solved.** **D4.3's split bar and percentage are reinstated** — the same-day cut is reversed; the arrangement (figure · caption · 6px bar · outstanding + right-aligned percentage) is what fits it in the 130px cap. **D5.0a now states the click contract: one target per panel, the terminal row; headers are inert; every destination is a page, never a modal.** **Two corrections off 55a's own check, both from the same rule — a published figure is re-measured on the render:** every panel is now **`box-sizing: border-box`** (column A declared 522 and rendered 524, the same +2 that had the old set publishing 714 against a declared 712 — the convention of publishing the inflated number is retired), and **D4.1's longest-title figure is 273.1px measured**, not the ~289px first published from character count; 441px stays the floor and the 16px of slack over it is now deliberate rather than accidental. **Four more, off 55a's acceptance:** **RECEIVABLES gets no terminal row and is not clickable** — `+ N MORE` is a truncation artifact and this panel has no list, so D5.0a's RECEIVABLES row is struck and the MONEY rail slot is its destination (four routing, not five); **row titles truncate to one line with an ellipsis and never wrap** (D4.1 — D4.4 allocates by `rowCount × rowHeight`, so a two-line row makes every demand figure in the column wrong); **MONEY MOVERS and UNDER CONTRACT shed no column at any width** (D4.2 — D5.2's shed rule stays on the deals index); and **D3.3a now states that the band's `N ITEMS` counts the window and excludes JUST BEYOND**, after 55a published 9 over columns holding 6 · 2 · 0 · 2 — corrected on the frame to `8 ITEMS · WINDOW 48H`, with BATTLE PLAN's 24 corrected to 23 against groups that sum. **The band's overdue figure is removed entirely and D8 gains check 14** — `2 OVERDUE` was unverifiable and its replacement `1 OVERDUE` contradicted BATTLE PLAN's `5 LATE` and DUE's `2 PAST DUE` on the same screen; late work has owners, and **no two surfaces publish the same population**.*

*Prior: 8.20.26 2145 — **Turn 52 corrections, folded in same day.** `DUE` is now the one display word on the rail, the terminal arrow, the DUE page header and the D4.3 panel header — `DEADLINES`/`deadlines` survives only as the record-type noun and the route/table name. **AGENT is struck; D4.3 is SCHEDULE + DUE + RECEIVABLES, three panels, no fourth term anywhere in the measured chain.** **RECEIVABLES caps at 130px** (was 169) — the split bar and the "58% of $316,000" caption both restated a ratio the two dollar figures already implied, so both are cut; the freed 39px lets SCHEDULE clear a row threshold (one event of four → two). **DUE's HOME card now leads with its past-due row**, matching D5.4, and its terminal count includes past-due items. **D5.4's `WHEN` gutter widens 84 → 104px** — re-measured: the widest string is 12 characters and collided with the DEADLINE column; the day-count math itself already reconciled against the 20 Aug anchor, no inversion found. **D7.1's modal is corrected to what actually shipped — 960px, two columns, header/footer 72px each — not the 620px single column first printed; the 460px drawer is narrowed to SET and `/warroom/contacts`, not struck.** Redrawn at turn 54 (54a, 54b).*

*Prior: 8.20.26 0730 — **DEADLINES earns a create control, a rail slot and a route.** §D2.4a's mount list becomes **a rule, not a count**; the rail goes to **nine slots** — `DUE` at position 4, **676px** fixed; **§D5.4 `/warroom/deadlines` is new** (turn 52b) and **D5.0a's DEADLINES terminal goes live** — four route, four inert. **§D7.1 is new: the desktop sheet mechanism is the centred modal.** D7's and D4.1's "460px right-side drawer" is **STRUCK** and the word *drawer* is retired from this document except for the D2.2 SET slot's rename; **D9 6a is unblocked and is the modal shell** (turn 52d). **D8 check 3 carries no numeral.** **D4.4's header term is per-panel** — 55px with a control, 41px without, which takes 28px out of column C. **D3.3's all-day gutter stops printing `DUE`.** HOME redrawn at 52a.*

*Prior: 8.19.26 **[TIME PENDING]** — **§D2.4a is now THE CREATE CONTROL: the whole FAB object at 31px, bare and unlabelled** (turn 51). **Turn 50's labelled pill is STRUCK entire**, and `assets/fab/README.md` rules 4 and 5 are amended the same day. D2.4's outlined action button, D4.1's `+ Item`, D4.3's `+ Event` and 49a's `+ New deal` remain STRUCK. **D8 check 3 rewritten from a count to a list.** **D5.3.3's forward-only horizon STRUCK** — rolling 24-month window, past cells live. **D4.1 now publishes the scroll furniture it was already being cited for, and the bottom fade terminates in its own surface's fill, not `bg-base`.** **D9 6a flagged ON HOLD** pending the drawer-or-modal call from the build side. Duplicated D5.3.3–D5.3.5 block removed.*

*Prior: 8.19.26 0745 — D4.4 elastic column allocation; D3.3a weighted NEXT 48 columns; D2.2 eight-slot rail; D5.0a route table; D5.2 deals index; D5.3 schedule; §D4 residual closed. **This stamp was never written to the file on 19 Aug and the header still read 8.17.26 1122 — corrected here.***

*Prior: 8.17.26 1122 — **D4.3’s RECEIVABLES entry fixed: the `text-shadow` line is gone (the 1104 edit did not take) and the 30px/700 literal binds to DM0.** Also carries 1104’s set: D3, D8 check 3, D2.3 item 2, D2.3a, D5.1 corrected to the shipping build; D2.5 added. Supersedes 8.17.26 1104 and 1000. **Desktop values are untouched by mobile’s 46b ruling** — D2.3 keeps the 112px band, 88px wordmark at `h176` @2× and 64px mark. What changed is the phone: it now mounts `shirleycre-h144` at 48px in a 56px row (§6.2a). Prior: D2.6 (mobile parity).*

Companion to `SHIRLEYCRE_MOBILE_SPEC.md`. That document owns the **tokens, type scale, spacing scale, accent rules and component vocabulary** (§1–§5) — this one does not restate them. Everything here inherits from it. Where a rule conflicts, the mobile spec wins.

Locked designs: **7a** PIN gate · **7b** control station · **8b** Next 48 rollup.

Surface: `≥ 1024px`, Chrome, usually full screen. Reference layout is 1440 × 900.

---

## D1. The governing idea

Desktop today is the mobile stack stretched wide: one column of full-width panels, a dead right margin, and everything reached by scrolling.

A control station is the opposite. **The page does not scroll.** The viewport is divided once into fixed regions, and each region scrolls internally. The layout never moves, so your eye learns where things live and goes there directly instead of hunting a scroll position.

Three consequences follow, and they are the whole redesign:

1. Every panel is a fixed-height flex region with its own `overflow-y: auto`.
2. Anything too large to live in a region gets its own route. The Deal Pipeline leaves the dashboard. **No record count appears in this document** — see the note at D5.2.
3. Chrome collapses to the minimum that still identifies where you are — one 52px bar.

---

## D2. Shell

### D2.1 Grid

```
┌────┬──────────────────────────────────────────────┐
│    │  identity band                       112px   │
│rail├──────────────────────────────────────────────┤
│96px│  NEXT 48 band                   236px, fixed │
│    ├───────────┬──────────────┬───────────────────┤
│    │ column A  │  column B    │  column C         │
│    │  0.30     │   0.39       │   0.31            │
│    │ of content width, net of gaps                │
└────┴───────────┴──────────────┴───────────────────┘
```

- Root: `height: 100vh; overflow: hidden; display: flex`.
- Content area padding `18px 24px 20px`, column gap `18px`, vertical gap `18px`.
- **Columns are ratios of the content box net of gaps, not pixel literals: A 0.30 · B 0.39 · C 0.31.** *(Re-allocated 8.20.26, turn 55a. Supersedes 0.41 / 0.31 / 0.28, which was 43a's set and gave column A 190px it could not use — see D4.1's string floor. Which in turn superseded 512 / 436 / flex.)* **The content box at a 1920 viewport is 1775px** — 1920 less the 96px rail, its 1px border and 48px of padding — **and 1739 net of two 18px gaps**, which is what the ratios divide. At 1920 that measures **522 / 678 / 539** — A declared 712px plus its two 1px card edges, C the remainder of the 1774px content box after two 18px gaps. The literals were sized for 1440 and broke silently at 1920; a ratio does not.
- **Every panel is `box-sizing: border-box`, and the declared width is the rendered width** *(8.20.26 — a real defect found on 55a's check: column A declared 522px with a 1px border rendered **524**, which is the same +2 that had D2.1 publishing 714 against a declared 712 in the old set. The ratio arithmetic only closes if the two agree, so the old convention of publishing the inflated number is retired rather than carried.)* **Column C is the `flex: 1` remainder**, so any pixel spent elsewhere in the row lands there — in the design record's frames it measures 538 rather than 539, which is that frame's own 1px border and not a build figure.
- **C is narrower than B on purpose.** It stacks three short panels; B stacks one long table and one list. Widest-to-narrowest is not a ranking of importance, it is a function of what each column holds.
- At 1920 the extra width goes to columns A and C and the Next 48 band — **not** to a fourth column. A control station is about one glance, not filling pixels.
- Every column and panel carries `min-height: 0` so flex children can actually scroll. Without it the panels grow and the page scrolls, which defeats the entire layout.

### D2.2 Left rail — 96px

Vertical, full height. **The rail is its own plane: `background: #0C0B14`, `border-right: 1px solid rgba(255,255,255,0.14)`.** *(44a, locked 8.14.26.)* At `bg-base` behind a `0.07` line it was black on black — the single most reported legibility failure on the screen, and the reason for D2.6.

- **No app mark.** *(44a — retired from the rail.)* The mark lives in the D2.3 identity band, once per screen. The rail opens on `HOME`, `padding-top: 20px`.
- Nav items: 76px wide, `padding: 13px 0`, radius 10, icon over label, `gap: 7px`.
- Label: JetBrains Mono 10px/500, `letter-spacing: 0.08em`. *(8 → 10, D2.6.)*
- Active: `background: rgba(139,92,246,0.14)`, icon and label in `brand-lift`. Inactive `text-low`.
- **Order — nine slots:** HOME · DEALS · **SCHED** · **DUE** · MONEY · PORTF · ENTITY · PEOPLE — then spacer — SET. *(SCHED added 8.19.26 — the schedule runs a year out and the D4.3 panel is a 48-hour window onto it, so it earns a route. Position 3: it sits with DEALS because the two are what the operator opens by intent; MONEY onward are reference.)* *(**DUE added 8.20.26** — deadlines are not all contractual: a tax date, a licence renewal, an insurance lapse and a filing date are typed by hand with no deal behind them, so the panel earns a create control (D2.4a) and the list earns a route (D5.4). Position 4, beside SCHED: both answer *when*, and the operator opens both by intent.)* **No TASKS slot** (D5); the glyph is drawn but unmounted.
- **The label is `DUE`, and `DEADL` is rejected on two measurements.** *(Ruled 8.20.26.)* **One — `DEADL` and `DEALS` are the same width and share their first three glyphs.** At 10px/500 mono with `0.08em` the advance is 6.8px per character, so both strings measure **34.0px**, two slots apart in a vertical stack. A rail is read by shape before it is read by position, and that is the worst case for shape. **Two — there is no clean cut.** `DEADL` breaks mid-syllable, the syllable cut is `DEAD`, and `DEADLN` is six characters of near-`DEALS`. `SCHED` and `PORTF` are truncations because *schedule* and *portfolio* have no short synonym; **deadlines has one, and every row on the panel already reads `N DAYS · MMM D` — what the operator asks is what is due.** **`DATES` was also rejected** — SCHED's glyph is a calendar, so *dates* names that slot. **Consequence, and it is not optional: D3.3's NEXT 48 time gutter stops printing `DUE`** — one word cannot mean *the deadlines route* in the rail and *this task has no clock time* in the band, on one screen. That is the `entity` failure and the reason `STAGE` was refused as a filter segment. See D3.3.
- **Nine slots fit, measured off the built rail.** Item box is `13 + 25 + 7 + 10 + 13 = 68px`. **Seven of the eight items above the spacer carry a 4px bottom margin; the eighth (PEOPLE) carries none** — it sits flush against the flex spacer, which is how 45a–52a are built. SET is 68 + 16 bottom margin = **84px**. Fixed rail content = `20 (top pad) + 7 × 72 + 68 + 84` = **676px**. Spacer absorbs **404px at 1080** and **224px at 900**. Collapse point is a **676px** viewport height, which no station runs. *(Was **604px** at eight slots and **532px** at seven, by the same construction.)*
- **The pitch is deliberately not uniform, and the arithmetic must not be written as though it were.** `20 + 8 × 72 + 84 = 680` is the tidy version and it is **4px wrong** — the same trap that put `608` in this section and in 49c's caption at eight slots on 8.19.26. Either quote `7 × 72 + 68` or give PEOPLE the 4px margin and re-derive; do not carry a rounder number because it reads better.
- **SET is not a route — it opens the settings modal** *(renamed 8.20.26: it was "the D7 drawer", and D7.1 makes the modal the surface's one sheet mechanism; renaming a thing that is not built yet costs nothing, and two words for one mechanism costs forever)*.** It is the one slot below the spacer and the one slot that navigates nowhere, which is why it sits apart. See D5.
- **Every item is labelled.** An unlabelled icon rail is a memory test. The current rail's unlabelled glyphs are retired.

#### D2.2.1 The icon set — locked designs 25a, 25b

Drawn for the app. **`assets/icons/` is shirleyre.com's public-site nav and is not this set** — five of those six are stock Lucide, which is right for a marketing site and wrong beside a mark as specific as ours. Do not import them into the rail.

**Nine slots.** HOME · DEALS · SCHED · DUE · MONEY · PORTF · ENTITY · PEOPLE · SET. **TASKS is drawn but not mounted** — D5 cuts the route; the glyph (check over three rules) is held in 25a/25b in case D4.1's column sizing changes.

**Construction:** 24 grid · **1.6px stroke** · round cap and join · no fills · **rendered at 25px.** *("Rendered at 22px" is STRUCK, 8.19.26 — the spec was wrong, not the build: every glyph in the shipping rail draws at 25 and has since 45a. The 22px figure was never in a build.)* Optical weight is matched by eye at the render size, not made mathematically equal. **No glyph may depend on a detail finer than 1.5px at render size** — the ENTITY windows are the tightest element in the set and sit exactly at that floor.

| Slot | Glyph | Why this and not the obvious one |
| --- | --- | --- |
| HOME | Panel grid — one tall left, two stacked right | This is a control station, not a website. A house glyph says "the page you return to"; the grid says what the screen actually is, and it mirrors D2.1's layout |
| DEALS | Sign board on a post | What a listing physically is. Keeps "property" from colliding with ENTITY |
| SCHED | **Calendar frame — rounded rect, one horizontal rule below the top edge, one filled day cell** | *(New 8.19.26.)* Not a clock and not an hourglass: NEXT 48's panel glyph owns the clock and DEADLINES owns the countdown. This is neither a moment nor a countdown — it is a grid of dates you look ahead across. **The one filled cell is the only fill in the set, and it is what separates it from ENTITY's building** |
| DUE | **Pennant flag on a pole — 49a's DEADLINES panel glyph, at 25px** | *(Mounted 8.20.26.)* **Not a new drawing**: the panel glyph is the drawing, exactly as SCHED is one calendar at 25px and 17px. Checked against DEALS on the render, because both carry a vertical stem: the sign board is **symmetric and hangs from its post**, the pennant is **asymmetric and flies off one side of a full-height pole** — different silhouettes at 25px. No fill, so SCHED's single filled cell stays the only fill in the set |
| MONEY | Note with a centre disc | **Never a `$`.** Symbols are reserved for figures; a currency glyph in the nav competes with every number on the screen |
| PORTF | **§5.11.7's stacked-layers mark, unchanged** | The portfolio already has a mark on mobile. A second one for desktop is the star-FAB mistake again — one object, two symbols |
| ENTITY | Building with window column and a lower annex | Companies, not addresses |
| PEOPLE | Two figures, one behind | Contacts |
| SET | Two sliders with offset knobs | A gear is a machine; these are preferences. **Opens a drawer, not a route** (D5) |

**The app mark is not a nav item, and as of 44a it is not in the rail at all.** It appears once per screen, in the D2.3 identity band — §17's two-tier rule holds: one mark per screen, at one size, meaning one thing. A rail mark plus a band mark is two marks at two sizes, which is the star-FAB mistake in a different place.

**SCHED** *(added 8.19.26)*: **a calendar frame — rounded rect, one horizontal rule below the top edge, one filled day cell.** Not a clock and not an hourglass: NEXT 48's panel glyph owns the clock and DEADLINES owns the countdown, and this is neither a moment nor a countdown — it is a grid of dates you look ahead across.

- **The SCHED rail glyph and the D4.3 SCHEDULE panel glyph are one drawing at two mounts** — 25px in the rail, 17px in the panel header. Do not draw a second.
- **Render size is 25px, not 22px.** The shipping rail draws every glyph at 25 (design record, turns 45a–48a); mounting SCHED at 22 puts a third value in the set and makes one slot in a vertical row of eight visibly lighter than its neighbours.
- **Stroke is the rail set's stroke, not its own.** Eight glyphs stacked in a 96px column read as one object or as a mistake; a per-glyph stroke width is the mistake. If the set's published value and the 1.6px proposed for SCHED differ, the set wins and the proposal is dropped.

**Colour:** inactive `text-low`, active `brand-lift` on `rgba(139,92,246,0.14)`. No glyph carries colour of its own, including PORTF — the violet in 25b's sheet marks the active state, not the icon.

### D2.3 Identity band — 112px

*(Was "top bar — 52px". Grown to carry the wordmark asset, 43a/45a, locked 8.14.26.)* Single row, `padding: 0 30px`, `gap: 26px`, `border-bottom: 1px solid rgba(255,255,255,0.14)` *(0.13 → 0.14, 8.15.26 — the band's bottom edge is a card edge and D2.6 moved those; it was the one edge left behind)*:

1. **Geometric mark**, 64px, from `assets/app-icon/mark-256.png`.
2. **SHIRLEYCRE wordmark**, 88px tall, from **`assets/wordmark/shirleycre-h176.png`** (568×176, the @2× delivery cut). `margin: -10px 0 0 -8px`. **`wordmark-glow.png` is the 1307×405 master and is not mounted by either surface** — it is the source the cuts come from. Mounting the master downscales 405px of source into an 88px box on every paint.
3. 1px × 40px divider, `rgba(255,255,255,0.14)`.
4. `WAR ROOM` — mono 13px/500, `0.19em`, `text-mid`, `margin-top: 4px`.
5. 1px × 40px divider, `rgba(255,255,255,0.14)` — **both dividers carry the same value**; the build had one at `0.09` and one at `0.14` because this list never stated one *(fixed 8.15.26)*.
6. **Search field, 380px fixed.** `bg rgba(255,255,255,0.075)`, radius 10, `padding 12px 14px`, 17px magnifier at `text-low`, then a spacer, then a `⌘K` chip (mono 10.5px, `border 1px rgba(255,255,255,0.18)`, radius 4). **No placeholder string** *(45a — the field is identified by its glyph and its shortcut; "Search deals, contacts…" was the only sentence-case grey string in the band).* **⌘K opens it from anywhere.**
7. Spacer.
8. **External link plates** — D2.3b.
9. Date and clock, mono 12px, `letter-spacing 0.14em`, `text-low`: `FRI 14 AUG · 9:45 AM`.
10. Live dot: 6px `money-in` circle + `LIVE` in mono 11.5px `money-in`.

**Retired:** the standalone search band, the LIFE / ENTITIES / PORTFOLIO / CONTACTS icon row, the stacked Space-Grotesk wordmark-over-date lockup, and the text link chips (D2.3b replaces them). **The wordmark row is no longer retired** — it returns as this band, as a delivered raster rather than set type.

#### D2.3a The identity lockup — measured, not eyeballed

Both files carry their light in the pixels, so **box height tells you nothing**. The wordmark's ink fills **0.716** of its 405px file; the geometric mark's fills **0.984** of its; the glow star's **0.973**. Sizing both boxes alike makes the star read ~38% heavier, which is the "one sticks out more than the other" failure.

| Rule | Value |
| --- | --- |
| **App tier** (< 120px) | **`0.73 × wordmark` is STRUCK** *(16 Aug)* — it was back-derived from the 64px that had already been chosen by eye, then written down as though it were measured. **The mark is 64px at an 88px wordmark, recorded as EYES-M (chosen by eye at 1920).** Do not compute a mark size from a ratio; if the wordmark height ever changes, the mark is re-set by eye and re-recorded. |
| **Print / splash tier** (≥ 120px) | `glow star box = 0.74 × wordmark box`. Star 124px → wordmark 168px. Ink 120.6px vs 120.3px. |
| **Vertical** | Wordmark takes `margin-top: -10px` at 88px. The cap band sits 31.5px low in the 405px file (6.8px at 88px) and an optical centre for a glowing object sits above its geometric one, because the lower bloom is heavier. |
| **`WAR ROOM`** | `margin-top: 4px`, to meet the lifted caps. |
| **Optical gap** | **The delivered cuts carry 3px of transparent left pad, not the master’s 25px** *(engineer measurement, 17 Aug)* — so "declare 18px to see 24px" described `wordmark-glow.png` and does not describe `shirleycre-h176`. **The mount number is engineer-owned and absorbed in the build; do not re-derive it from the 25px figure.** The rule that survives: the gap is set optically against the ink, **never as a bare `gap` value.** |
| **Print / splash tier only** | **0.74 is the one surviving constant** and it governs the glow star at ≥ 120px, where the pairing is set for print rather than by eye on a live row. The app tier has no constant. |

**Never** on a light fill, recoloured, re-tracked, or with a CSS glow layered on top. The light is painted into the pixels. **The wordmark's Chakra Petch 700 lives inside the asset and is not a UI font** — it is never used for section headers or any other app type *(ruled 8.14.26; the app is Space Grotesk + JetBrains Mono per mobile §3.1, and there is no third family)*.

#### D2.3b External link plates — a delivered asset

`assets/links/crexi.png` (2425×800) and `assets/links/lacdb.png` (2424×796). Neon tube signs on transparent ground, cut from the supplied artwork: **`alpha = max(R,G,B)`, RGB untouched, no gamma, no premultiply, no blend modes** — additive light, so the halo falls off correctly on `bg-base` and on `bg-panel` alike. Plate frame and starfield are part of the artwork.

- **Mounted 52px tall · 158px wide, both.** The two files land within 0.5% of the same aspect (3.031 / 3.045), so the pair is one component with two faces. **64px is the ceiling** — above that they compete with the wordmark.
- Set the **height** and let width follow. Never set both.
- At rest: full opacity. Hover: `filter: brightness(1.18)`.
- **Do not re-tint, ramp or filter at runtime.** The artwork is delivered final.
- The `↗` affordance left with the text chips. Carry "opens a new tab" with the hover lift and a `title`, not by drawing an arrow onto the artwork.

### D2.4 Panel

Every dashboard panel is the same object:

- `background: bg-panel; border: border-default; border-radius: 14px; overflow: hidden;`
- `display: flex; flex-direction: column; min-height: 0;`
- `background: #12111B; border: 1px solid rgba(255,255,255,0.14); border-radius: 14px;` *(fill and edge raised by D2.6 — at `#0B0A12` behind a `0.08` edge the card did not separate from the frame.)*
- **Header**, `flex: none`, `padding: 13px 18px 11px`, `border-bottom: 1px solid rgba(255,255,255,0.11)`: **panel glyph** (17px, 1.7 stroke, `brand-lift`) · T1 label (mono 13px, `0.14em`, `text-mid`) · 1px hairline · optional status count in its accent · total count in `text-low` · optional **create control — the D2.4a object, which is neither an outlined button nor a pill** *(8.19.26; the outlined action button and turn 50's pill are both STRUCK)*. **The header therefore has two heights, and D4.4's demand term is per-panel: 55px with a control (`13 + 31 + 11`), 41px without (`13 + 17 + 11`), plus the 1px hairline in both cases** *(written down 8.20.26 — it was true of the outlined button too and never stated, and D8.1 must not publish a single header figure)*.
- **The 01–07 index plates are retired** *(45a, 8.14.26)*. The glyph is the panel's identifier and carries the violet the plate used to; the header is two objects, violet glyph and grey label. Plates were also the only violet chips on the screen, so colour is now confined to glyphs, spines and figures.
- **Panel glyphs** are drawn on the same 24 grid as the D2.2.1 rail set, 1.7px stroke at 17px: NEXT 48 clock · BATTLE PLAN checklist-with-tick · MONEY MOVERS rising arrow · UNDER CONTRACT document-with-tick · SCHEDULE calendar · DEADLINES flag · RECEIVABLES coin stack.
- **Body**, `flex: 1; overflow-y: auto; min-height: 0;` scrollbar hidden.
- No shadow. No glow on the panel itself.

Section headers are grey everywhere. Colour lives in rows and figures.

#### D2.4a The create control — the FAB itself, at a second size

*(New, 8.19.26. Design turn **51**. Replaces D2.4's outlined action button, D4.1's `+ Item`, D4.3's `+ Event` and 49a's `+ New deal`. **Turn 50's labelled pill is STRUCK entire** — see the note at the foot of this section.)*

**It is the whole FAB object at a second size — body, face, core, bars, halo — and it is bare.** Not a variant, not a pill, and **no label**. `+ ITEM` / `+ EVENT` / `+ DEAL` are struck: **the panel header already names the section**, and **D2.2's labelling rule is scoped to the rail**, where seven near-identical glyphs have no other context. A `+` beside a header reading `BATTLE PLAN` has context.

**This is a bigger reuse than §2.4a and is named separately.** §2.4a generalized `.wr-fab__face`'s gradient as a *flat fill* for Save buttons and day chips, and **§2.4a is unchanged**. This mounts the entire object. It is **the create control**.

**One size, one object — and the mount list is a rule, not a count.** *(8.20.26. "Three mounts" is STRUCK for exactly the reason D8 check 3's numeral is: it went stale inside one turn, in this section and in a mockup caption at once, the moment DEADLINES earned a control.)*

**The rule: a surface mounts one create control for each record type it lists that is typed by a person.** DEADLINES qualifies as of 8.20.26 — a tax date, a licence renewal, an insurance lapse and a filing date have no deal behind them and arrive only by being typed. Derived from the rule today, and **this is a derivation, not a list to maintain**: **BATTLE PLAN · SCHEDULE · DEADLINES panel headers** on HOME, and **one in the page chrome of `/warroom/deals`, `/warroom/schedule` and `/warroom/deadlines`**.

**One per surface per record type**, which is why a page gets one even though its HOME panel already has one: the alternative is going back to HOME to type a deadline while looking at a page of deadlines. **The rule predicts the unbuilt surfaces too** — PEOPLE, PORTFOLIOS and ENTITIES earn one; **`/warroom/money` does not, because receivables arrive from Landed rather than from a person.** **A page header has more room than a panel header and still does not get a bigger control.**

**Geometry is derived by multiplying, never by `transform: scale()`** — the asset README is explicit that transform blurs the rim. **Multiplier 0.5345 off the 58px original:**

| | 58 | 31 |
| --- | --- | --- |
| Box · radius | 58 · 19 | **31 · 10** |
| Core | 37 | **20** |
| Glyph bars | 23 × 3.6, radius 2 | **12 × 1.9**, radius 1 |
| Glyph glow shadows | 8 / 22 / 46 | **4 / 12 / 25** |
| Body shadow | `0 8px 22px` | **`0 4px 12px`** |
| Halo | `inset: -23px` | **`inset: -12px`** |

**31px is the outlined button's box to the pixel**, so no panel header changes height and **no D4.4 figure moves**. That is the one thing that survives turn 50, because it was the only part of it that was not about the label.

**Three rulings fall out of the reduction:**

1. **The rim comes off.** `1.5 × 0.5345 = 0.80px` — sub-pixel on a 1× desktop display and under D2.2.1's own **1.5px stroke floor**. The rim exists to show the **16s conic sweep, which is already ruled FAB-only**; no sweep, no rim. **The face fills the body at radius 10.** Glyph bars land at **1.9px** and clear the floor — checked, not assumed.
2. **No 45° rotation, on any mount.** The FAB rotates into a ✕ because it owns the close. **The D7.1 modal owns its own** *(8.20.26 — this read "the desktop drawer," which is struck)*, and **a surface with three controls would show three ✕s for one open sheet**. `aria-expanded` is not wired here; they stay a `+`.
3. **The halo is never clamped. Whether it crosses the hairline is a property of the mount, not of the control** *(scoped 8.19.26 — this ruling was written as a property of the control and is false for one of its own three mounts)*. The FAB earns its bloom room from `margin-top: -20px`, lifting it out of the tab bar; here the room is whatever the header's bottom padding gives, and **the inset is 12px in every mount regardless.** Both measured outcomes are correct:

   | Mount | Header | Below the control | At rest | At the `scale(1.13)` peak |
   | --- | --- | --- | --- | --- |
   | BATTLE PLAN · SCHEDULE panel headers | **56px** (`13 / 31 / 11` + 1px hairline) | **12px** | **flush — 0.00px** | **crosses by 3.57px** |
   | Deals index page chrome | **62px** (`15 / 31 / 15` + 1px hairline) | **16px** | **clears by 4.00px** | **clears by 0.42px** |

   **On the panel headers the reason not to clamp is the motion, not a static overhang** — clamping would leave the control correct at rest and clipped for most of every 7s cycle, which is worse than either. **On the page chrome nothing crosses at all, and that is not a defect to correct**: a page header has more room than a panel header (D2.4a, above), and the extra room is the whole reason it does not also get a bigger control. **Do not tune the chrome's padding to manufacture a crossing** — the crossing is a consequence, not the signature. The signature is the unclamped bloom. A build that clips it in any mount has broken the control, not tidied it.

**Contrast does not bind here.** With no label the only content is the white glyph on the `#5B3FA8` core, carrying its own three glow shadows. *(Turn 50's aperture-anchoring work existed solely to keep a label off the gradient's bright quadrant and dies with the label. Do not carry its `24px 24px at 13px 6px` figure forward — it describes an object that is struck.)*

**Motion: the geometry multiplies, the motion does not.** The halo keeps the FAB's own **7s** beat at **`0.42 → 0.72` opacity, `scale(1) → scale(1.13)`**. A shallower or slower beat would make this a different object breathing at a different rate, which is precisely what the reuse exists to avoid. **The 16s rim sweep does not come across** — construction, not signal. `prefers-reduced-motion` holds the halo at `0.6` with no animation, as the asset already does.

**The period is the synchronizing variable; the amplitude is the object's identity** *(written down 8.20.26, so the trade is never read backwards)*. **7s is the beat shared with the homepage beacon, and two objects at 7s with different depths still breathe together** — synchrony survives a change of depth, so depth is not what buys it. The reason to keep the full `0.42 → 0.72` at `scale(1.13)` is that the swing is what the object *is*. **A later pass looking for something to give back must not read the period as the free variable**; there is no free variable here.

**On a surface with several controls they breathe in unison — one animation, one mount tick, no stagger.** On HOME, SCHEDULE and DEADLINES are stacked in column C, so two of the three pulses sit directly above one another; that is the intended reading, and a staggered or randomized phase would turn three instances of one object into three objects.

**`aria-label` per mount is required, not optional** — there is no visible text. `Add task` (BATTLE PLAN) · `Add event` (SCHEDULE and the schedule page) · `Add deadline` (DEADLINES and the deadlines page) · `Add deal` (deals index). `Fab.jsx` takes the prop and defaults it to `"Add"`; **a surface of buttons all announcing "Add" does not ship.**

**Where it does not go — MONEY MOVERS, UNDER CONTRACT, RECEIVABLES.** Those rows are promoted by flow, not typed by a person: a money mover is a flagged deal, UNDER CONTRACT is a PIN-gated transition, receivables come from Landed. **A panel earns a create control only if its rows are created.**

> **DEADLINES was on that list until 8.20.26 and is now a mount.** The rule did not change; **a fact under it was wrong.** Deadlines were treated as contractual by definition — dates that arrive attached to a deal — and taxes, licence renewals, insurance lapses and filing dates are none of that. They are typed, they have no deal, and on the built panel they are already the rows that carry no property line. Recorded rather than quietly corrected, because the earlier exclusion is cited in D5.0a and in `assets/fab/README.md`.

**Desktop only.** Mobile sheet headers carry no add button (31a) — the FAB is the phone's create path.

**`assets/fab/README.md` is amended the same day.** Its rule 4 ("One FAB per screen") and rule 5 ("Desktop: not used") were both made false by this section, and a delivered asset that contradicts the spec is the failure mode this project already has a rule about.

**Gated by D9 item 6a, which is unblocked as of 8.20.26** — 6a is the **D7.1 modal shell**, and the drawer-or-modal question that held it is answered by the build. No create control renders before its sheet exists; **one shell serves every mount**, which is what lets one build item gate all of them.

> **Turn 50 is STRUCK entire** *(8.19.26, same day)*. It specced a labelled pill — `+ ITEM` / `+ EVENT` / `+ DEAL` — on `.wr-fab__face` as a flat fill. The labels are struck, and every other decision in it solved for a label: the pill aspect, the aperture anchoring, the 2.72 / 4.69 / 5.68 contrast chain, and the pill-versus-circle halo question. **None of it binds on a bare glyph.** Two findings survive and are kept: the **31px box**, and the rule that **a published figure is re-measured on the render, never back-derived** — turn 50 published 5.68:1 against geometry that measured 4.69:1, in two live documents at once.

### D2.5 Desktop type levels live in code

*(Shipped 15 Aug, commit c644046, as `desktopTypes.ts`. This section is a pointer, not a table — the numbering gap D2.4 → D2.6 was the spec omitting a thing that exists.)*

Desktop binds its own three families of named levels — **DS1–DS8** (Space Grotesk), **DT1–DT8** (mono), **DM0–DM2** (money) — in `desktopTypes.ts`. **The file is authoritative for the values; this spec names levels and never pixel sizes for text**, exactly as mobile §3.2 does. Mobile’s scale is not reused: a 1920 station reads at a different distance than a 390px phone.

**Any pixel literal for text remaining in a desktop section is a defect.** One is known and open: D5.1’s read row — see there.

### D2.6 The grey scale has a measured floor

*(New, 44a, locked 8.14.26. App-wide — mobile §2.4 takes the same edit.)*

`#5C5B6B` measured **2.82:1** on `bg-panel`. The floor is **4.5:1**. That one colour was carrying the rail's inactive glyphs and labels, every panel state line, every row subline and every group header, so a third of the screen was below the contrast floor while looking deliberate.

| Token | Was | Now | Ratio on `#12111B` |
| --- | --- | --- | --- |
| `text-mid` | `#8B8A9B` (5.53) | **`#B8B6C6`** | 9.40 |
| `text-low` | `#5C5B6B` (2.82 — **fail**) | **`#8E8CA0`** | 5.71 |
| `text-hi` | `#EFEEF4` | unchanged | 16.23 |
| `brand-lift` | `#A78BFA` | unchanged | 6.88 |
| `money-in` `late` `hot` | — | unchanged | 9.74 · 5.72 · 9.34 |

**`#5C5B6B` is retired as a text colour.** Structure came up with it: panel fill `#0B0A12 → #12111B`, card edges `0.08 → 0.14`, panel hairlines `0.06 → 0.11`, row hairlines `0.05 → 0.10`, row-card fill `0.025 → 0.05`, button and chip edges `0.13 / 0.09 → 0.20 / 0.18`, rail its own plane at `#0C0B14`.

**Ratios are computed against `#12111B`, the worst case on the screen.** `bg-base` at `#050509` is darker and every ratio improves there.

**Mobile took the text half of this on 8.14.26 and the structural half on 8.15.26** (45a, mobile §2.3a). The phone now draws the same panel fill (`#12111B`), the same raised fill (`#1E1D26` — this section's `0.05` white over the panel, resolved), the same card edge (`0.14`), chip edge (`0.20`), panel rule (`0.11`) and row hairline (`0.10`). **`bg-base` stays per-surface** — `#050509` desktop, `#08080C` mobile — because nothing is read against the base and the two screens are viewed at different distances. Every other fill and hairline in the product is now one value on both surfaces.

### D2.7 One glow per screen — amended for third-party marks

§5's rule stands for **our** elements: one glowing object per screen. **Third-party marks are exempt** *(45a, 8.14.26)* — we do not control CREXI's or LACDB's identity, and dimming someone else's sign to protect our budget is the wrong trade.

Consequence, and it is not optional: **the identity band's wordmark is the screen's one glow, so the RECEIVABLES figure loses its `text-shadow`** (D4.3). Light baked into a PNG counts the same as light applied in CSS. Identity outranks a figure that already sits on the only gradient card.

---

## D3. NEXT 48 — the rollup band

Full width, above the three columns, **`flex: none`, `height: 236px` — a fixed literal, not an approximation** *(B2, built and closed 15 Aug, commit c644046; agrees with D2.1 and D8.1)*. It is the first thing read on the screen and therefore gets the top band.

### D3.1 What it is

**A view over the whole system, never a second copy.** It queries everything due or scheduled in the next 48 hours from every source and renders it in one place.

Sources, with the spine colour each contributes:

| Source | Spine | Included when |
| --- | --- | --- |
| Battle Plan steps | `late` | open step, `due_at` within window (or already overdue) |
| Schedule events | `brand` | meeting, call, site walk |
| Closings | `money-in` | from Under Contract |
| Contract deadlines | `hot` | inspection, feasibility, financing |
| Receivable due dates | `brand-lift` | payment expected |
| ~~Agent queue~~ | ~~`brand`~~ | **struck 8.20.26 — the AGENT panel is cut from D4.3; no term for it in column C's budget** |

### D3.2 Rules

1. **It is a view.** Completing an item here completes it at its source. Nothing exists only in Next 48.
2. **Overdue items pin to the front**, not hidden. Late work is still work in the next 48.
3. **One item, one row.** A closing that is both an event and a deadline appears once, as the event. Dedupe on `(deal_id, date, kind)` preferring event over deadline.
4. **Empty means empty.** `CLEAR THROUGH SUNDAY` in mono 10.5px `text-low`. No illustration, no instruction, no "+ Add Event" prompt in the body — the header button already exists.
5. The fourth column shows the next two items *past* the window at `opacity: 0.72`, so the horizon never ends abruptly.
6. On mobile the same query drives the FIRST THING hero card — top item only.

### D3.3 Layout

`display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;` under the panel header.

Columns: **TONIGHT** · **SAT 1 AUG** · **SUN 2 AUG** · **JUST BEYOND**. Day columns are relative and roll forward; the first is always the remainder of today.

Column header: mono **11.5px** `0.16em` `text-hi` (dimmed to `text-low` for JUST BEYOND) · hairline · item count in mono **13px** `text-low`.

**Item row — rewritten to the 47/48 scale, 8.19.26. Rows are not cards.** `padding: 9px 0 9px 13px`, **no radius, no margin, no background fill, no border** — a `border-hair` separator between rows and a 3px source spine per §5.2 of the mobile spec. *(The old `radius: 8px` / `rgba(255,255,255,0.025)` / `border-default` card is deleted. 48 removed it product-wide; it cost roughly 98px per fourteen rows and bought nothing the hairline does not.)*

- Time gutter: **40px fixed, mono 13px.** A timed item shows `9:00` / `14:00` in `text-hi`; **an all-day item shows an em dash `—` in `text-low`** *(8.20.26: the string was `DUE`, and `DUE` is now the rail's label for the deadlines route — one word cannot mean a destination in the rail and "no clock time" in the band on the same screen. The gutter asks **when**, and an all-day item has no when; `ALL DAY` measures 54.6px against a 40px gutter, so the dash is also the only answer that fits.)* **What `DUE` was carrying — that the row is a task rather than an event — is already carried by the spine colour** (D3.1) and its urgency by the `late` spine, so nothing is lost with it. **Fixed width means times align down the column** — and it is a reserved gutter, so a timed and an all-day row have the same title edge.
- Title: Space Grotesk **15px/500** `text-hi`.
- Context line: **13px/400** `text-low` — deal, client, or chain step.

**Nothing in the band renders below 11px.** The band is read from the same 600mm as the panels; it was the densest thing on the screen and the least legible.

Rows never truncate mid-word; they wrap.

### D3.3a Band column allocation — weighted by day load

*(New, 8.19.26. `repeat(4, 1fr)` in D3.3 is STRUCK. It holds four equal columns whatever the load, so three days sit empty at 435px each while the fourth clips.)*

**The band is not a column, and D4.4 does not cover it.** **Its header count is the in-window count and excludes JUST BEYOND** *(written down 8.20.26 — 55a's caption published `9 ITEMS` over columns holding 6 · 2 · 0 · 2, which is 8 in the window and 10 with the lookahead; nine was neither, and the ambiguity is what produced it)*. **`N ITEMS` counts the days inside the 48 hours the caption names. JUST BEYOND is a lookahead column, not a member of the window** — it is dimmed to 0.72 for that reason, and it is why the figure and the visible columns must be checked against each other and not against a total.

**The band publishes no overdue figure** *(8.20.26 — the header string is `N ITEMS · WINDOW 48H` and nothing else)*. Two attempts at that figure failed the same way inside one day: `2 OVERDUE` could only be verified by opening a row hidden behind a terminal row, and `1 OVERDUE` — re-scoped to the band's own visible column — contradicted **BATTLE PLAN's `5 LATE`** and **DUE's `2 PAST DUE`** on the same screen. **The band is a rollup of six sources (D3.1), so a bare `N OVERDUE` reads as a global claim**, and rolling it up honestly gives 7, which is `5 + 2` restated in a third place and free to drift the moment either source moves. **Late work has owners already: BATTLE PLAN's count for tasks, DUE's `N D LATE` rows for deadlines.** A carried-forward overdue item still takes the `late` spine in the band — **that is a per-row mark, not a count** — and since NEXT 48 is a forward window, what is behind you was never its figure to publish. **Scoping alone would not have saved it:** any string that has to name its own population to be true is a figure that should belong to the panel that owns the population. D4.4 divides a vertical budget, where a bigger share means more rows. **The band's height is fixed at 236px, so width buys no rows at all** — widening TONIGHT from 435px to 800px still shows the same four rows. Any rule written here has to solve two separate problems, and conflating them is how `1fr` survived this long:

**(a) Wasted width.** An empty day holds a quarter of the band to say nothing.
**(b) Capacity.** The loaded day clips, and there is no vertical room to give it.

**Width, per column:**

1. **An empty day collapses to its label.** Width = `max(header string, "CLEAR") + 2 × 18px padding`, **computed from the rendered strings, not typed as a literal** — same call D2.3a made on the wordmark gap: a text-derived measurement belongs to the build, not to this document. It keeps its header and reads `SAT 1 AUG · CLEAR`. **It does not disappear** — that a Saturday is clear is the answer to a question the operator is asking, exactly as in D4.4 item 8.
2. **A populated day has a floor of 0.16 of the band's inner width** — **209px at 1440, 286px at 1920** — expressed as a ratio because these are content columns, not chrome (D2.1's distinction). Below the floor the **40px** time gutter plus a title wraps to three lines and the row stops being scannable. *(This line read 34px against D3.3's 40px — corrected 8.20.26; D3.3 is canonical.)*
3. **Surplus goes to demand.** Remaining width is allocated in proportion to `rowCount`, days before JUST BEYOND.
4. **JUST BEYOND is a remainder bucket, not a day.** It takes the floor and nothing more while any real day still has hidden items. It is the lowest-priority claim on width in the band; a day you can act on outranks a list you cannot.

**Capacity — the only mechanism that works here:**

5. **A column allocated `≥ 2 × floor + 16px` splits into two row tracks inside itself**, **filling column-major — the first track completely, then the second.** *(Ruled 8.19.26. Row-major snakes the reading order and destroys chronology: 9:00 would sit beside 14:00 with 11:00 below it. A day column is read top to bottom or it is not a day column.)* One column header spans both tracks. **This is the only way horizontal surplus converts to vertical capacity in a fixed-height band**, and it is what makes rule 1 worth doing. Worked case at 1440 — TONIGHT loaded, SAT and SUN clear, JUST BEYOND at floor: `1260 − 132 − 132 − 209 = 787px` to TONIGHT, against a `434px` split threshold, so TONIGHT renders two tracks and **doubles** its visible rows. Three tracks are not permitted; at that width the rows are narrower than the floor.
6. **Whole rows only**, per D4.4 item 6. No partial row, no scroll — the band has never scrolled and does not start now.

**Overflow — and the band takes no route:**

7. **The terminal row names its day and is inert: `+ N MORE TONIGHT`.** No arrow, no hover, no destination. **NEXT 48 is a view (D3.1) and every row in it already has a home at its source** — a link would either duplicate a destination that exists or invent a "Next 48 detail" page, which is a second copy of the band. This is the one terminal row in the product that is not a link, and the missing arrow is the signal.
8. Same as D4.4 item 7, it **replaces** the last visible row rather than adding one, so the allocation stays exact. In a two-track column it replaces the last row of the **second** track.
9. **Computed once after data resolves** (D4.4 item 10). A band that re-columns while being read reads as broken.

**Check** *(D8 item 13)*: with one day loaded and two clear, the loaded column must render **more rows** than it does with all three loaded. Equal-width output means `1fr` is still in the file.

> **D3.3's item row is rewritten to the 47/48 scale below** *(8.19.26, residual closed)*. The pre-47/48 card styling and the 8.5/9/9.5px levels are gone from the printed spec, not merely deprecated.

### D3.4 Why list and not timeline

A 48-hour timeline axis was designed and rejected. It reads shape beautifully on a quiet day and collides into unreadable overlap on a busy one — the exact day you most need it. The list degrades gracefully. If the timeline returns later it should be a toggle on this band, not a replacement.

---

## D4. Column contents

> ### ✅ RESOLVED — D4 residual closed 8.19.26
>
> **D3.3, D4.1, D4.2 and D4.3 are rewritten to the 47/48 desktop scale below.** §D4 no longer disagrees with itself, and the printed literals are the contract again rather than the residual.
>
> What moved — a level swap in every case, **no construction, no order, no strings**:
>
> - **Row primary 13.5 → 17px** · **secondary 10.5–11 → 13px** · **labels and column headers 8.5/9 → 11.5px** · **counts and day figures 10 → 13px** · **money 13 → 15px**. Sized for a 600mm viewing distance on a 24″ display, not a phone at 14 inches.
> - **Nothing renders below 11px anywhere on the surface.**
> - **Row card styling deleted outright** — `radius: 10px`, `margin-bottom: 6px`, the `rgba(255,255,255,0.025)` resting fill and `border-default` are gone from every panel. Rows are hairline-separated, exactly as mobile §5.11 has required since 20a. **Removing the card is what pays for the larger type** — roughly 98px per fourteen rows.
> - **Every row title shares one left edge.** A reserved spine gutter means a spined row and an unspined row align; the spine occupies reserved space rather than displacing the title.
> - **Date and day-count figures get an 84px nowrap gutter** so `12D · AUG 26` cannot wrap.
>
> **These are the shipping `desktopTypes.ts` values (D2.5, commit c644046), not a third set** — the levels were always the contract; only the printed literals were stale.

### D4.1 Column A — 0.30 of content width, floored at 441px — BATTLE PLAN

Full height, single panel. **It is no longer the widest column, and the reason it was is now the reason it isn't** *(8.20.26, turn 55a)*: it is the panel you *work in*, but the work is short task titles, and width past the longest one buys nothing. **Its width is bounded by a string, not by importance** — the longest real row title, `Prospect list: Airline Hwy corridor`, measures **273.1px** at the 17px/500 row primary *(measured off the render with a Range, 8.20.26 — the first pass published ~289px, which was estimated from character count and is retained only as the conservative figure it was; 273.1 is the measurement)*, and the row's own chrome is fixed: 20px reserved spine gutter + 12px gap + **84px** nowrap date gutter + 36px panel padding = **152px**. **441px is the floor**, carrying the estimate rather than the measurement on purpose — 16px of deliberate slack over `273.1 + 152 = 425.1`, because the title is user-typed and today's longest is not a contract.

**Published as a ratio with a floor, the same shape as D3.3a's column floor:** `A = max(0.30 × net content width, 441px)`, where `net` is 1739 at a 1920 viewport (D2.1). At **1920** the ratio wins — **522px**, 81px of headroom over the floor, which is the slack that absorbs a longer title than today's longest. At **1440** the floor wins — 441px, and **B and C split the remainder in their own 0.39 : 0.31 proportion** (456 / 362). **The 1440 case is flagged, not solved:** column C at 362px is 28px narrower than it is today and is the second half of D10 item 7's open question, which now has two terms in it instead of one.

**What the 190px bought:** column B goes 536 → 678, which is where the real table lives — D5.2's VALUE and COMMISSION columns shed below 1280 and MONEY MOVERS is the in-app gold standard; and column C goes 488 → 539, which does not change any D4.4 height. **No panel gained a row from this** — it is width, and width buys rows nowhere except D3.3a's band.

Header: `BATTLE PLAN` · hairline · `5 LATE` in `late` (mono **13px**) · **the D2.4a create control**, bare — no `+ Item` label *(8.19.26 — both the outlined button and turn 50's labelled pill are STRUCK)*. `aria-label="Add task"`.

Body groups: OVERDUE · TODAY · LATER · NO DUE DATE, each a mono **11.5px** `0.16em` group label + hairline. **Group headers go sticky while the panel scrolls** (opaque `bg-panel`, hairline under) so the bucket you are in is always named. **An empty group collapses to 24px with no hairline** — it keeps its label and count so the structure is stable, but it does not spend a full row on nothing.

**Scroll furniture — canonical here, referenced by D5.2.5** *(written down 8.19.26; D5.2.5 had been citing "D4.1's scroll furniture" against a section that never published it)*: a **28px bottom fade**, shown only while there is more below, and a **6px thumb** that appears during scroll and for 600ms after — no track, no gutter. **The fade terminates in the fill it sits on, never `bg-base`** *(corrected 8.19.26)*. BATTLE PLAN's body sits on `bg-panel` `#12111B` and fades to `#12111B`; the deals index table fades to its own fill. **A fade ending in a colour the surface is not made of reads as a smudge, not as a soft edge.** One rule, every mount. A row cut mid-height with no fade reads as a rendering fault, not as "there is more below."

Row: `padding: 12px 0 12px 20px`, **hairline-separated — no radius, no margin, no resting fill, no border** *(the `radius: 10px` / `margin-bottom: 6px` / `rgba(255,255,255,0.025)` / `border-default` card is deleted, 48)*, with a `late` spine when overdue. **The 20px left padding is a reserved spine gutter**: an overdue row and a normal row have the same title edge, because the spine sits in reserved space instead of pushing the title right.

- **No checkbox circle.** Desktop completes by clicking the row's left edge or pressing `Space` on the focused row. The 20px circles are retired — they were pure decoration at this size.
- **Titles truncate to one line with an ellipsis. They never wrap.** *(Decided 8.20.26.)* `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` on the title, with `min-width: 0` on its flex parent so the ellipsis can actually engage. **The reason is D4.4, not aesthetics:** allocation is `rowCount × rowHeight`, so a row that can grow to two lines makes every demand figure in the column wrong and reintroduces exactly the overflow D4.4 and D8.1 exist to prevent. **Titles are user-typed and unbounded, and 441px is a floor, not a guarantee** — the measured longest title fits today with 16px to spare, which is slack, not a contract. **The full title is on the D7.1 modal**, one click away, which is where an unbounded string belongs.
- Title (**17px/500** `text-hi`) · flexes · client/deal (**13px/400** `text-low`) · day count in an **84px right-aligned nowrap gutter**, mono **13px** `late`. **The gutter is nowrap by contract** — `12D · AUG 26` wrapped to two lines in the shipping build and broke the row grid.
- **A repeated label reads as its actual kind.** Where several rows carried the same word (`DEADLINE`), the row shows what the deadline *is* — inspection, contingency, financing. A column of identical labels is a column of no information.
- **Overdue rows do not take a red background.** Spine plus day count is the whole signal. A permanently overdue list must not read as a permanently red screen.

Hover reveals a right-aligned action cluster: complete · tomorrow · next week · open. Click anywhere else opens the task sheet — **the D7.1 modal, in edit state, at its corrected 960px two-column geometry** *(8.20.26 — the modal shipped at 960px, two columns; the 620px single column first printed in D7.1 was wrong. The 460px right-side drawer is narrowed to SET and `/warroom/contacts`, not struck)*; content and field order still come from mobile spec §13.2/§18.3e.

### D4.2 Column B — 0.39 of content width — MONEY MOVERS + UNDER CONTRACT

**MONEY MOVERS** — **height is elastic per D4.4. The fixed 435px is STRUCK** *(330 → 435 was 45a; a fixed height is the defect D4.4 fixes — it holds 435px of box for one row of data and starves UNDER CONTRACT below it)*. Floor and priority in D4.4. Keeps its real table columns — your brief names this an in-app gold standard and it is right.

- Column header row: mono **11.5px** `0.16em` `text-low` — `ADDRESS` (flex) · `VALUE` (right) · `COMM` (right).
- Row: address **17px/500** `text-hi` over a `client · action` line at **13px** `text-low`; value **15px/500** `text-hi`; commission **15px/500** `money-in`. All figures tabular. **Hairline-separated, no card.**
- `border-hair` between rows, none after the last.

**UNDER CONTRACT** — elastic per D4.4, second in priority in this column. Address over `client · closes MMM D`; commission in `money-in`; a `LANDED` outlined pill in `money-in`. Deadline text carries the urgency, not a coloured row.

**Neither MONEY MOVERS nor UNDER CONTRACT sheds a column, at any width** *(decided 8.20.26)*. **D5.2's shed rule — VALUE first, then COMMISSION below 1280px — belongs to the deals index and does not travel here.** On the index those are two of nine columns and both figures live on the deal page as well; **on this panel VALUE and COMM are the entire content**, and a MONEY MOVERS row without its commission is an address. If column B is ever too narrow for three columns, the ratio moves (D2.1) — the panel does not drop its subject.

### D4.3 Column C — 0.31 of content width — SCHEDULE + DUE + RECEIVABLES

**AGENT is struck** *(8.20.26)* — it never appeared in 52a's render, the measured chain is three panels, and column C has no headroom for it: already down 28px for two create-control headers, and AGENT needs ~70px the column does not have. Bringing it back is a later turn that raises column C's ratio or drops a panel; it is not a squeeze.

**RECEIVABLES carries no `text-shadow` as of 44a/45a — see D2.7.** The identity band holds the screen's one glow.

**SCHEDULE** and **DUE** are separate panels, **both elastic per D4.4 — `flex: 1` is STRUCK on both.** `flex: 1` divides the column evenly regardless of what is in either panel, which is the whole defect D4.4 exists to fix. They are not merged: *Schedule is where you have to be; Due is what will happen to you.* Different stakes, different scan pattern. **The panel's on-screen label is `DUE`, not `DEADLINES`** *(8.20.26, turn 54)* — one word for the rail slot, the terminal arrow, the standalone page's header and this panel header. `deadlines`/`contract_deadlines` remain the record-type noun and the data/route name; nothing printed on screen uses it anymore.

**SCHEDULE** — **the D2.4a create control** in the header, bare — no `+ Event` label *(8.19.26 — both the outlined button and turn 50's labelled pill are STRUCK)*. `aria-label="Add event"`. Body grouped TODAY / TOMORROW. Row: **44px reserved time gutter** (**13px/500** `text-hi` time over a mono **11.5px** AM/PM), then title **17px/500** and location **13px** `text-low`. The next event up carries a `brand` spine; nothing else does. Empty state: `NOTHING SCHEDULED`, mono, `text-low`. **When the day columns are empty they extend to fill the band rather than showing a `+ 3 MORE` link** — there is nothing more to show.

**DUE** — **the D2.4a create control** in the header, bare. `aria-label="Add deadline"` *(added 8.20.26 — D2.4a's rule, and the fact that a tax date has no deal behind it; the header is therefore 55px here too)*. **The 45-day forward-only caption is gone** *(8.20.26, defect fix)* — the window runs backward as well as forward, and the panel now leads with its past-due row (`late` spine, `N D LATE`) before the nearest future one. Row: `N DAYS · MMM D` in mono **13px** in an **84px nowrap gutter** (`late` and `N D LATE` when past, `hot` when ≤ 7 days, else `text-mid`) with the deadline kind right-aligned in mono **11.5px** `text-low`; then title **17px/500** and property **13px** `text-low`, blank where there is no deal. The nearest future deadline takes a `hot` spine and a 5% `hot` tint — the one permitted tint. **Terminal row `+ N MORE → DUE` counts past-due items now, not just the forward window** — see D5.0a and D5.4.

**RECEIVABLES** — `flex: none`, **capped at 130px** *(8.20.26 — down from 169; the only panel in the column whose height is a pure choice, every other one holds a list that grows with the day)*. `background: linear-gradient(155deg, rgba(52,211,153,0.09), rgba(139,92,246,0.05))`. Collected total at **DM0** in `money-in`, **`text-shadow: none`** *(B1, built and closed 15 Aug, commit c644046; DM0 per the build report, replacing the 30px/700 literal)*. **It is not the screen's glow — the identity band's wordmark is, per D2.7 and D8 check 3.**

**The split bar and the percentage stay** *(8.20.26 — this section briefly cut both as "the same fact twice"; reversed the same day on the user's call, and the reversal is right: the bar is the only graphic figure on the dashboard, and it answers *how far along* in one glance where two dollar amounts answer it in two reads)*. **Construction, three rows inside the 130px box** — the arrangement is what makes it fit, not a smaller cap. **One figure row, two figures, both at DM0**: collected in `money-in` left-aligned, **outstanding in `brand-lift` right-aligned** · **6px split bar**, `money-in` for the collected share against `rgba(139,92,246,0.35)` for the remainder, radius 3, on `bg-raise` · then a mono 11.5px `text-low` label row, `58% COLLECTED` left and `OUTSTANDING` right. **Each figure sits directly above the bar segment it describes** *(8.20.26 — the reason the outstanding figure is right-aligned rather than stacked: the bar's violet remainder is on the right, so the number and its segment share an edge and the label row underneath binds them without a legend)*. **No `Collected of $N total` caption and no `Outstanding $N` sentence** *(both cut 8.20.26 on the user's call)* — the panel total is not a figure the operator acts on, and the words were carrying what colour and position now carry. **Two figures, one bar, one percentage.** **No terminal row, and the panel is not clickable** *(8.20.26 — D5.0a: a terminal row is a truncation artifact and nothing here is truncated; `/warroom/money` is reached by the MONEY rail slot)*.

---

### D4.4 Elastic column allocation — panels in a column share one budget

*(New, 8.19.26. The rule D4.2 and D4.3 were both written against and both got wrong.)*

**Panels stacked in one column do not own heights. They own a share of the column's budget, and the share is set by how much data each one has.** One Money Mover and eleven Under Contracts is a tall UNDER CONTRACT and a one-row MONEY MOVERS. Eleven Money Movers and one Under Contract is the reverse. Neither case is a special case — they are the same computation with different inputs.

This is the direct extension of D8.1: the column's budget is measured once, and the content is derived from it. D4.2's fixed 435px and D4.3's `flex: 1` are both the failure D8.1 warns about — a number guessed per panel, then held whether or not there is data to fill it. `flex: 1` looks safer than a literal and is worse: it divides the column evenly *by construction*, so a panel with one row is guaranteed to waste half the column.

**Applies to:** column B (MONEY MOVERS, UNDER CONTRACT) and column C's elastic pair (SCHEDULE, DUE).
**Does not apply to:** column A — BATTLE PLAN is one panel over the full column and is the only panel that scrolls (D4.1). RECEIVABLES stays `flex: none`; it is paid out of the budget before allocation, not allocated from it. **AGENT is struck (8.20.26) and no longer a term here.**

**The computation, in order:**

1. **Budget.** `B = column height − (gaps) − (flex:none panels)`. Column C: subtract RECEIVABLES, AGENT and three gaps before anything else. The measured figures live in D8.1 and are not restated here — one place or it drifts.
2. **Demand, per panel.** `demand = header + (column header, if any) + rowCount × rowHeight`. **The header term is per-panel, not one figure for the column: 55px with a D2.4a create control, 41px without** *(8.20.26 — D2.4 publishes both; D8.1 must not print a single header number)*. `rowCount` is the real number of records, not a capped guess; `rowHeight` comes from the desktop scale (D3.3), not mobile's.
3. **Floor, per panel.** `floor = header + (column header) + 2 rows`. A panel below its floor is not a small panel, it is an unreadable one.
4. **Fits.** If `Σ demand ≤ B`: every panel gets its full demand, and the remainder goes to **the last elastic panel in the column**, which absorbs it as trailing space inside its own box. The column bottom stays flush. Do not distribute the remainder across panels — that reintroduces empty space in the middle of the stack, which is the thing being fixed.
5. **Does not fit.** Allocate `B` in proportion to demand, then raise any panel below its floor to its floor and take the difference from the largest allocation. Repeat until stable — at most one pass per panel.
6. **Whole rows only.** Every allocation is floored to the row grid: `rows = floor((alloc − header) / rowHeight)`. A panel never renders a partial row and never scrolls. Leftover pixels inside a panel are trailing space, not a half row.
7. **Truncation is the terminal row (47/48).** When `rows < rowCount`, the **last visible row is replaced** by `+ N MORE → SECTION`. It replaces a row, never adds one, so the allocation is exact.
8. **Empty is one row, not zero.** A panel with no records collapses to `header + empty state` (one row height) and keeps its header. Zero would delete the section, and the operator would lose the knowledge that it exists and is empty — which on MONEY MOVERS is information, not absence.
9. **Priority is stack order.** Higher panel wins: column B is MONEY MOVERS then UNDER CONTRACT; column C is SCHEDULE then DUE. An odd remainder row goes to the higher panel. If the floors alone exceed `B` — only reachable at 1440 × 900 with RECEIVABLES expanded — the **lowest** panel drops to header + terminal row, no data rows. It does not drop off the screen.
10. **Compute once, after data resolves.** Not per frame, not during scroll, not as records stream in. A panel that resizes while you are reading it reads as a broken build. Recompute on data change and on resize only, with no transition.

**Same rule, both columns, one implementation.** SCHEDULE and DUE are not a second mechanism — a quiet calendar and a heavy deadline list is `Σ demand ≤ B` with different inputs. If the two columns end up with two allocators, the second one is wrong.

**Recompute, 8.20.26 — DUE's create control costs column C 28px.** SCHEDULE and DUE both go from a 41px header to 55px, so **both floors and both demands rise by 14px** while the budget `B` is unchanged. At the desktop row height that is **one row out of the column**, and by item 9 it comes off DUE, the lower panel. Two things follow and neither is a new mechanism: at **1440 × 900** the floors-exceed-budget branch of item 9 is 28px closer, and 48a's standing flag — that column C carrying SCHEDULE + DUE + RECEIVABLES leaves each list panel one row plus a terminal row — gets 28px worse. **The pressure was RECEIVABLES**, and it has now moved: capped to 130px the same day (D4.3), down from 169.

**Second recompute, same day — RECEIVABLES gives 39px back.** The freed pixels return to the elastic pair's shared budget, not to a named panel — **SCHEDULE is the one that clears a whole-row threshold with it and goes from one event of four to two**; DUE keeps its two rows and recovers a little of its trailing space. This is a windfall, not a shortfall, so item 9's stack-order priority (which panel loses on a deficit) doesn't govern it — it lands wherever a whole extra row becomes affordable, which on this render is SCHEDULE. Measured split: RECEIVABLES 130 + SCHEDULE 230 + DUE 278 + two 18px gaps = 674px, matching the column's measured inner height unchanged from 52a.

**Checks** *(added to D8 as items 10–12)*:

- `Σ allocations + gaps + flex:none panels === column height`, per column. No ragged bottom.
- `el.scrollHeight === el.clientHeight` on every elastic panel — already D8.1, and it is what proves no panel is hiding a row instead of showing its terminal row.
- With test data of **1 record** in the first panel of a column, the second panel's rendered row count must **increase** over the balanced case. A build that passes the arithmetic and fails this one has hardcoded the split somewhere.

---

## D5. Routes

The dashboard is one route among several. The rail switches routes; nothing on the dashboard is a link to a "more" version of itself except where stated.

**Audited against the repo, 11 Aug 2026. The table below says what exists.** The previous version of this section listed seven routes at root as though they were built; five were not, and the two that were live under a different path. It was read as a build contract for weeks. Treat any route not marked ✅ as unbuilt, whatever an older document says.

**Path structure: every built route lives under `/warroom/*`.** There is no root-level route in this app. D5 previously wrote all seven at root, which was wrong about the app's shape and not merely its contents.

| D5 name | Real path | State | Notes |
| --- | --- | --- | --- |
| HOME | `/warroom`, `/warroom3` | ✅ **built** | `warroom3` is the current control station; tasks are fetched in `page.tsx` and passed to `BattlePlanPanel` |
| DEALS | `/warroom/deal` | ⚠️ **partial** | This is deal **detail**, not the index. `/warroom/deal/prospects` also exists. **The pipeline index does not exist as a route** — it is a dashboard band today |
| PEOPLE | `/warroom/contacts`, `/warroom/client` | ✅ **built** | List plus single-client view. Lane A's target |
| SCHEDULE | `/warroom/schedule` | ❌ **not built, not designed** | **New 8.19.26.** The D4.3 panel is a 48-hour window; the underlying schedule runs a year out and has no expanded view. Takes rail slot 3. Design turn owed |
| DEADLINES | `/warroom/deadlines` | ❌ **not built** | **New 8.20.26**, specced at D5.4 and drawn at 52b. Takes rail slot 4, labelled `DUE`. **Deadlines are not all contractual** — taxes, renewals and filing dates are typed by hand with no deal behind them, which is what earns both the route and the create control |
| TASKS | — | ❌ **not built, and will not be** | See below |
| MONEY | — | ❌ **not built** | Specced only as the Receivables panel (D4.3) |
| PORTFOLIO | — | ❌ **not built** | Now mobile spec §19, designed 11 Aug. D5 predates it |
| ENTITIES | — | ❌ **not built, not designed** | **A company Matthew owns — not a client.** Ruled 11 Aug. Needs `task.entity_id` (nullable FK beside the existing `life \| entity` flag): today the enum cannot separate Rooster from UPALS, so an entities route would show one undifferentiated pile. Deals never belong to an entity |

**`/tasks` is cut, not deferred.** D4.1 gives column A the widest column precisely because it is *the panel you work in*. A `/tasks` route is then a second copy of the primary work surface, and two places to do the same work is how they drift. **If 512px is not enough to work in, fix D4.1's sizing — do not add a route to compensate.** The closed-chain ruling (mobile §16) independently removes the other half of what the route was for.

**SET has no route, deliberately.** It appears in no D5 row and no D9 item because **it opens the settings modal** *(renamed from "the D7 right-side drawer" on 8.20.26, D7.1)* — PIN change, reporting-cadence default, agent status, sign out. On a single-operator app that is a short list, and a full route would promise a page with four rows on it. The modal is its destination, so the rule is satisfied on substance — but **SET mounts at D9 item 9, when that content is built**, not at item 1. An unbuilt destination is dead whatever its shape. If settings ever outgrows a sheet, it earns a route then.

**The rail therefore has nine slots** *(8.20.26; seven at the 11 Aug audit, eight after SCHED)*. The TASKS glyph stays drawn (25a/25b) against the possibility that D4.1 sizing changes; it is not mounted.

### D5.0a Where terminal rows go

**One click target per panel, and it is the terminal row** *(written down 8.20.26 — asked and answered)*. **The panel header is not a link.** A 55px header already holds a create control, and making the label beside it a second hit target puts "go to the page" and "make a record" in one bar — a mis-click that opens a sheet you then have to dismiss. **The rows are not links either**, except BATTLE PLAN's, which open the D7.1 modal in edit state (D4.1) — that is a record, not a route. So per panel: rows do their own thing, the header is inert, **the terminal row is the route**.

**A terminal row exists only where a list is truncated, and that is what settles RECEIVABLES** *(8.20.26 — asked because the table below listed it as routing to `/warroom/money` while the panel has no terminal row to click)*. **`+ N MORE` is a truncation artifact**: it means *this list continues*, it replaces the row it displaces (D4.4 item 7), and `N` is `rowCount − rows`. **RECEIVABLES has no list.** Its content is two computed figures and a bar — nothing is truncated, `N` has no value, and a terminal row there would have to invent a different string (`ALL RECEIVABLES →`) wearing the terminal row's clothes. **So: no terminal row, and the panel is not clickable.** It also cannot afford one — ~28px inside a 130px box, in a column that sums to 674 exact, means a live data row somewhere else pays for a link to an unbuilt route.

**Its destination is the MONEY rail slot, which it already has** (D2.2 position 5, mounted at D9 item 11). SCHEDULE and DUE carry both a terminal row and a rail slot because they answer two different questions — *show me the rest of this list* and *take me to that surface*. **RECEIVABLES only ever asks the second one, and the rail is where that question is answered.** **The RECEIVABLES row is therefore struck from the table below**, which leaves four routing and NEXT 48's four inert. **The rule predicts the unbuilt summary panels**: any panel whose body is a computed figure rather than rows gets no terminal row and no in-panel destination.

**And every destination in the table below is a page, never a modal.** The modal is for creating and editing one record (D7.1); a panel's `+ N MORE` is asking for the rest of a list, which is a document. MONEY MOVERS and UNDER CONTRACT land on the deals index pre-filtered, SCHEDULE on the schedule page, DUE on the deadlines page. **~~RECEIVABLES → `/warroom/money`~~ is struck** *(8.20.26 — see above: no list, no terminal row, no in-panel target; the MONEY rail slot is its destination)*. **NEXT 48's four columns stay inert** — its terminal rows name a day, not a destination (D3.3a item 7).

*(New 8.19.26. The 47/48 terminal rows created four new entry points and this table is the contract for all of them. A terminal row's string must name the route it opens — a row that says one destination and opens another is worse than no link.)*

| Panel | Terminal row | Opens | State it arrives in |
| --- | --- | --- | --- |
| MONEY MOVERS | `+ N MORE → DEALS` | `/warroom/deals?filter=money` | Sorted by commission at stake, descending |
| UNDER CONTRACT | `+ N MORE → DEALS` | `/warroom/deals?filter=uc` | Filtered to under-contract |
| SCHEDULE | `+ N MORE → SCHED` | `/warroom/schedule` | Opens on today, in the D5.3 agenda view — the panel counts events and its terminal must open events |
| RECEIVABLES | `→ MONEY` | `/warroom/money` | Collection detail |
| DEADLINES | `+ N MORE → DUE` | `/warroom/deadlines` | **Live as of 8.20.26.** Chronological, past-due first, scrolled to the first future deadline (D5.4) |
| NEXT 48, all four columns | `+ N MORE TONIGHT` | *(nothing)* | **Inert** — D3.3a item 7 |
| BATTLE PLAN | *(none)* | — | Scrolls in place (D4.1). The one scrolling panel takes no terminal row |

**Four terminals route, four do not. The arrow is the whole signal, and it appears only on the four that go somewhere.** **The arrow names the rail slot, not the page title** — `→ SCHED` and `→ DUE`, because the rail label is the name the operator has learned for that destination.

**DEADLINES was inert until 8.20.26 and now routes.** The original ruling was sound and was aimed at the wrong thing: **its rows count deadlines, not deals**, so `+ 4 MORE` landing on a deals index means the number you clicked and the number you land on disagree — the same defect as pointing NEXT 48 at a page. **That argues against the destination, not against the row.** Given a route whose unit *is* the deadline, the count survives the trip and the objection is gone. The earlier text even named the fix — "if a deadlines view is ever wanted it is its own route with its own count, not a filter on deals" — and D5.4 is that route.

**`+ 4 MORE → MONEY` on MONEY MOVERS is a defect, corrected here.** MONEY MOVERS rows are deals ranked by commission at stake; `/warroom/money` is receivables — collection against work already done. Two different objects, and the string pointed at the wrong one. **`/money` is RECEIVABLES' destination alone.**

**Two panels and the DEALS rail slot land on `/warroom/deals`, so filter and sort are URL state, not component state** — otherwise the entry points cannot arrive differently, and backing out of a deal returns to the wrong view. **The rail slot is the unfiltered index; `?filter=money` and `?filter=uc` are the only two pre-filtered entry states.** The active filter renders visibly active on arrival so it can be cleared — a filter applied invisibly reads as missing records.

Deal pages open as full routes at `/warroom/deal/:id`, per **§D5.1** below.

---

## D5.1 Deal page

Locked design: **33a** (13 Aug). Round 1 only: the read state. Launch / contract mode is round 2, drawn here only as the LAUNCH control that opens it. Two columns, sticky right rail — three columns shreds the economics grid at 1024px, and a jump-link sidebar spends 220px on navigation for nine section cards.

**Frame:** 1440 CSS px design width — gutter 32 · main column 974 · rail 380 · gap 22. Economics grid holds four columns down to a 1280px window.

**Header row** (18px/32px padding, one hairline below): pipeline back-link · address (23px/500) + city/state/zip (`text-low`) · status pills (`HOT` filled, then transaction/property-type pills, outlined) · `Edit`, text button, top right. Nothing on the page is an input until Edit is pressed.

**Six-slot glance strip** below the header, one row, hairline-divided: Asking Price · Price/SF · Building SF · Land Size · Deal Value · Est. Commission (`brand-lift`, the one glow). **M0** (22px, §3.2 mobile / mirrored here) — the scale had no level between M1 (15px) and D2 (32px); ratified 13 Aug, used by this strip only on both surfaces.

**Main column**, top to bottom, each a card at `bg-raise` with a 3px violet cap + `text-mid` label (not coloured text — §5.1 stays retired everywhere):
1. **LACDB listing** — photo (58% width) beside a link block (`VIEW ON LACDB`, filled tint, url + `↗`) and a 2×2 read-row grid (Listing Status · Days on Market · List Date · Last Synced).
2. **Deal Economics** — 4-column read-row grid, swaps sale↔lease fields on `transaction_type` (§15.2/§15.3's rule, shared). Footer note names the swap explicitly rather than leaving blank cells.
3. **Showings & Prospects** — count + a violet "link to contacts" control (32px, FAB-family glow, Contacts adoption pass wires it); rows are §5.11-equivalent (68px with meta / 48px without), a status pill per row.
4. **Documents** — count + `Dropbox folder ↗`; 2-column file rows, icon + name + date.
5. **Notes** — dated entries, newest first, no card-in-card.
6. **Activity** — plain log rows, `text-mid`, no icon, timestamp right.

**Sticky right rail** (`position: sticky; top: 22px`):
1. **LAUNCH DEAL** — the dedicated asset, §15.4 (mobile spec) covers its construction; identical on both surfaces.
2. **Money** — Collected / Outstanding read-row pair, split progress bar (`money-in` / `brand` tint), one caption line.
3. **Contacts** — up to 3 rows, name + `ROLE · TYPE` in mono `text-low`, quiet `↗`.
4. **Chain · <type>** — `N DONE · N STEPS` caption, next 2–3 open steps as rows, spine only on the overdue one.

**New component, ratified 13 Aug: the read row.** Desktop had no §5.11-equivalent for a read-only label/value pair. The pattern used throughout this page — 9.5px mono `text-mid` label (0.19em tracking) over a value line — is now that component: **M2-styled label, value at M1 (numbers) or — for text — the DS level that replaced the retired 14.5px literal in `desktopTypes.ts`. OPEN: the engineer names that level and it is written in here; until then this is the one text size in the desktop spec still carried as a number, and the number is retired.**. Use it anywhere desktop shows a read-only fact; do not invent a second one.

**Retired, same reasoning as mobile's §15.5:** coloured section headings (gold/teal — the thing that made the previous build unreadable), the Quick Glance strip's uncapped flex row, more than one glowing figure per screen, a stretched-FAB Launch control.

---

---

## D5.2 Deals index — `/warroom/deals`

*(New 8.19.26. Design turn **49a**. D9 item 7. Replaces nothing — the pipeline index has never existed as a route.)*

**Three entry points:** the DEALS rail slot (unfiltered) and two pre-filtered terminal rows (D5.0a). **The page scrolls; its chrome does not** — D8 item 1 is dashboard-only.

> **No record count is written in this section, or anywhere in this document.** *(Ruled 8.19.26 — "47" was carried in D1, D5.2 and D9 for weeks and the live figure is different. A count in a build contract is a fact with a shelf life.)* The count is a live value. **The same rule already governs mockup captions** (CLAUDE.md: a count in a caption is a measurement or it is not written); synthetic data inside a frame is fine, a caption asserting it is not.

### D5.2.1 It is a table, not a list

**A dense sortable data table — not §5.11 list rows, and not two-pane.** §5.11's construction holds absolutely (hairline-separated, **no radius, no fill, no margin, no card**) but its *two-line* row does not: a two-line row spends the vertical axis on wrapping when a pipeline's only real axis at 1776px is horizontal. **MONEY MOVERS is the reference implementation** — same single-line dense row, same tabular figures, one screen up.

**Not two-pane.** A preview pane is a second, worse copy of the deal page, which is drawn, locked and better at the job (D5.1). Clicking a row opens `/warroom/deal/:id`.

### D5.2.2 Nine columns, in this order

`Address · Client · Next deadline · LACDB · Add Task · ★ · Value · Commission · Dropbox`

| Column | Treatment |
| --- | --- |
| **Address** | Flex, takes the remainder. **§5.11.9 short form** — `Reitz Ave. 5525`. **No city, state, zip or country**, on any row, ever. The status pill rides here, inline after the address |
| **Client** | Fixed. §5.11.9's deal subline, promoted to its own column |
| **Next deadline** | From `contract_deadlines`. `N DAYS · MMM D`, **`hot` when ≤ 7 days**, else `text-mid` — D4.3's threshold, unchanged |
| **LACDB** | **Two states.** Link exists → opens it. No link → an add affordance |
| **Add Task** | One glyph. Opens the task modal **pre-filled with the deal** |
| **★** | **An interactive 5-star control, not a figure.** See D5.2.3 |
| **Value** | Right-aligned, tabular |
| **Commission** | Right-aligned, tabular, **`money-in`** per D4.2 |
| **Dropbox** | **Two states**, as LACDB |

**LACDB and Dropbox are four states to draw, not two columns to fill.** A cell that is empty when no link exists teaches nothing; an add affordance is the same pixels doing work.

**There is no Status column.** Status rides the row as the pill, exactly as the mobile Deal Pipeline sheet already does: outlined `PIPELINE` / `REVIEW` / `ACTIVE`, filled amber `HOT`, outlined violet `UC`, with the §5.2 spine on the two that take one. **All 11 CHECK values must be expressible in that pill** — if one is not, the pill vocabulary is wrong, not the column count.

**Below 1280px, Value sheds first, then Commission. Nothing else sheds.** Both live on the deal page and in MONEY MOVERS, so neither is the only place a figure appears. **The three action cells and ★ never shed** — they are the reason the page is a table and not a list.

### D5.2.3 The ★ control

**Five outlines, blank by default — unranked, not zero.** The distinction is the whole design: a zero is a judgement, and most of the book has not been judged.

- **Four states:** empty · hover preview · set · set-with-hover.
- **Hover fills to the cursor.** Click the third star sets 3; **click the third star again clears to unranked.** Re-clicking the current value is the only way back to blank, and it needs no confirm.
- **~78px, positioned clear of the address column** — a control that lives inside a flex column moves as the address wraps, and a moving target defeats it.
- It is the one interactive control in the body of a read table. That is deliberate: it is the only per-deal judgement the operator makes in bulk, which is exactly the work an index is for.

### D5.2.4 Filters — five segments

`ALL · HOT · UC · MONEY · TYPE ▾`

**34b's construction, verbatim: no container, no pill, no fill.** `flex: 1` segments on a band sitting on the header hairline. Active = **2px `brand-strong` bottom spine** + `text-hi`/700; inactive `text-mid`/600. **Counts are live values and are not drawn in the mockup** — the caption rule (a count is a measurement or it is not written) applies to specs as well as pictures.

What is deliberately absent, and why:

- **No DEADLINES segment** — its terminal row is inert (D5.0a), so a filter would be the destination the terminal deliberately does not have.
- **No STAGE** — the word already means contract stage in UNDER CONTRACT. Two meanings for one word in one product is how a query gets written wrong forever, the same failure as `entity` (D5).
- **No CLIENT** — that is a column sort, not a filter.
- **No free-text field.** **⌘K owns search** (D2.3). A second search box on one screen is two answers to one question.

### D5.2.5 Structure and sort

**Mobile's structure, expanded** — reference the Deal Pipeline sheet (30a / §5.11.9, already locked):

1. **Two group headers, always, on every sort: `PORTFOLIOS N` then `DEALS N`.** *(Ruled 8.19.26 — 49a drew the pinning with §5.11.7's plate alone and that was a defect. The plate reads cleanly on an alphabetical sort and ambiguously on a numeric one: two portfolio rows sitting above a larger Value figure looks like a broken sort unless something on screen says they are pinned.)* Mobile already separates them this way, so this is not a new component. **The header states the pinning; the plate states the row kind.** Both are load-bearing and neither replaces the other.

   > **The chrome count and the group counts are different numbers, by definition, and the build must not reconcile them.** *(Written 8.19.26 after 49a shipped a contradiction: a whole-book count beside a group header reading the same figure asserts the portfolio members twice.)* **The page-header count is the whole book — every deal, portfolio members included. A group header counts rows in its own group**, and portfolio members are not top-level rows (they live behind the portfolio, which navigates). So `book total − Σ portfolio site counts = the DEALS group figure`, and the two will normally differ. **If they ever match, one of them is wrong.**
2. Portfolios sort within their group; deals sort within theirs.

**Portfolio rows carry rollups:** name, site count, summed Value, summed Commission. **★, Next deadline, the status pill and all three action cells render empty** — a portfolio has no single deadline and no single rating, and inventing one would be a figure with no source. **They navigate; they do not expand in place** (22b, undesigned).

**Portfolios pin first on every sort**, including VALUE, COMM, RANK and DEADLINE. **On any sort a portfolio cannot express — RANK and DEADLINE, both of which render empty — the portfolio group holds alphabetical.** Sorting a group by a column none of its rows populate is a no-op that looks like a bug.

**Every column sorts. Default is alphabetical on the rendered short address** — the rendered string, not the underlying field, or the visible order will not match the visible text. **Sort state needs a drawn treatment: active column and direction.**

**Filter row and column headers are fixed; the body scrolls.** Note the deliberate divergence: **on mobile the sheet ribbon scrolls away, on desktop the chrome does not.** A long table you sort is unusable if the thing you sorted by leaves the screen.

**This is the product's second scrolling surface, and it takes D4.1's scroll furniture — not a new treatment** *(8.19.26)*: the **28px bottom fade** and the **6px thumb**, exactly as D4.1 publishes them. **The fade terminates in the fill the table sits on, not `bg-base`** *(corrected 8.19.26 — the index table is not on `bg-base` any more than BATTLE PLAN is, and a fade ending in the wrong fill reads as a smudge).* **A row cut mid-height with no fade reads as a rendering fault, not as "there is more below."** Group headers go **sticky** while the body scrolls, for D4.1's reason: the group you are in must always be named.

### D5.2.6 Entry states — three, and each arrives visibly different

| Entry | Filter | Sort | Drawn |
| --- | --- | --- | --- |
| DEALS rail slot | none, `ALL` active | `ADDRESS ▲` | **49a** |
| `?filter=money` — MONEY MOVERS terminal | `MONEY` active | `COMM ▼` | owed |
| `?filter=uc` — UNDER CONTRACT terminal | `UC` active | `ADDRESS ▲` | owed |

**The MONEY entry is the one that changes sort as well as filter**, because commission-at-stake ranking *is* what the MONEY MOVERS panel is; arriving alphabetically would discard the ordering the operator clicked. **UC arrives alphabetically** — under-contract is a set, not a ranking. **Both render their filter segment visibly active on arrival**, and clicking `ALL` returns to the unfiltered index.

### D5.2.7 Empty states

**D3.2 rule 4's pattern, unchanged: mono, `text-low`, no illustration, no instruction, no create-control prompt in the body** — the header already carries the create control.

- Filtered to no results: **`NO DEALS MATCH HOT`** — the string names the filter that emptied it, so the cause is visible without re-reading the filter row.
- No deals at all: **`NO DEALS YET`**.
- **The group headers and column headers stay.** An empty table that loses its structure reads as a failed load rather than an empty set.

---

## D5.3 Schedule page — `/warroom/schedule`

*(New 8.19.26. Design turn **49b**. D9 item 7a. Takes rail slot 3.)*

The D4.3 SCHEDULE panel is a 48-hour window onto a schedule that runs a year out. This is the rest of it.

### D5.3.1 Month grid primary, agenda a toggle

**Month grid is the primary view. Agenda list is a toggle beside it.** They answer two different questions and neither substitutes: **the month grid is the only view that shows density** — where the busy weeks are — which is the entire point of a long horizon; **the agenda is what you work from on a given day.**

Rejected: **quarter timeline** — it collides on exactly the busy periods you opened it to see, which is the reason D3.4 already rejected a 48-hour timeline axis. Same failure at a different scale. **Week columns** — a narrower month grid with a shorter horizon; nothing is gained.

### D5.3.2 Events only

**Events. No deadlines, no task due dates, no closings, no payment dates.**

**NEXT 48 is the rollup and stays the only one.** D3.1 owns that job over six sources; a second rollup over the same six drifts from the first, and then two screens disagree about what is happening on a Tuesday. **The harder constraint is arithmetic: the SCHEDULE panel counts events, so its `+ N MORE` must open events** — a destination holding a different number than the row you clicked is the D5.0a defect.

If a long-horizon rollup is wanted later, **it is a toggle on NEXT 48**, per D3.4's own precedent for the timeline.

### D5.3.3 What it opens on

**This month, today marked.** The entry matches the primary view. **Year-overview-drill-in was rejected: it inserts a navigation level before any content**, so every visit costs a click before the first event is legible.

**Scrolls forward continuously to a year out** — one surface, not paged months. **Fixed header: month nav · view toggle · weekday row.** The weekday row is chrome; if it scrolls, the grid below it stops being a calendar.

**Nav behaviour, ruled 8.19.26:**

- **The title names the month occupying most of the grid viewport, and it retitles as you scroll.** An anchor month that still reads `AUGUST 2026` while September fills the screen is a header that lies. Computed on the majority of visible week rows, **not the topmost row** — topmost flickers at every boundary.
- **`‹` and `›` scroll; they do not jump.** One continuous surface has one scroll position, and a jump that bypasses it puts the scrollbar and the title in disagreement. They animate to the target month's first week row.
**Horizon — a rolling 24-month window centred on today: 12 back, 12 forward** *(8.19.26; **forward-only is STRUCK**)*.

- **Both bounds are computed from today, never fixed.** `‹` disables at the floor, `›` at the ceiling. **The opening state does not change: this month, today marked.**
- **Past cells are live.** They render dimmed but take hover, click and chips, and **an event can be added to a past date** — logging a meeting that already happened is routine. **The only inert cells are those outside the window**, plus the leading and trailing partial-week days at the window's own edges. *(This reverses 49b, where past cells were specced inert.)*
- **`TODAY` is the return-to-centre**, and it is the one thing in the header row that never moves.
- **The window bounds the view, not the record.** Everything stays in the database; ⌘K and the deal page's Activity card reach past it. **This is not a retention rule.**
- Why 12 and 12, written down so it is not re-litigated: a listing agreement runs 6–12 months, so twelve back covers a full term for an expired-listing post-mortem, and covers reconstructing a prior calendar year in the months when that comes up. **Symmetry keeps one constant in the spec instead of two.**
- **49b's dimmed 26–31 July is the opening month's leading partial week, not the window floor.** With a backward horizon those days are reachable by scrolling and render live. Only the partial week at the *window's* edge is inert.

### D5.3.4 AGENDA view

**AGENDA ships with MONTH at D9 item 7a, not after it.** Two things already depend on it: the header toggle, and D5.3.5's overflow cell, which opens a specific day *in AGENDA*. A toggle to an unbuilt view and a cell that opens nothing are the same defect as an unmounted rail slot.

**Design turn owed — undrawn as of 8.19.26.** Settled: a day-grouped list on the same continuous forward surface, chrome and horizon identical to MONTH, **events only**, and it is **what you work from on a given day** where MONTH is what you scan for density. Row construction is §5.11's — not a new component.

### D5.3.5 Cell overflow and empty states

**A day cell that overflows shows `+ N MORE`, and it is live — it opens that day in AGENDA.** This is the one terminal-style row in the product that opens a *view* rather than a route, and it is not the D5.0a defect: this page **is** the destination, so nothing is duplicated and no second copy is invented. The count is events and AGENDA shows events, so **the number survives the trip**.

**Empty states — D3.2 rule 4's pattern:** mono, `text-low`, no illustration, no prompt in the body.

- A month with no events: **`NO EVENTS THIS MONTH`**, centred in the grid area. **The grid still renders** — dates, weekday row and today's marker all stay. An empty calendar is still a calendar; losing the grid would read as a failed load.
- An individual empty day cell shows **nothing at all** — no `CLEAR`, no dash. In a 7×6 grid, thirty cells each saying `CLEAR` is thirty repetitions of no information. **This is deliberately the opposite of D3.3a's collapsed day column**, which does say `CLEAR`: there, four columns are the entire view and a silent one reads as broken; here the grid's shape already answers it.

### D5.4 Deadlines page — `/warroom/deadlines`

*(New 8.20.26. Design turn **52b**, corrected turn **54b**. D9 item 7b. Takes rail slot 4, labelled `DUE` — D2.2.)*

**Display word is `DUE`, singular, everywhere** *(8.20.26, turn 54 — design call)*: the rail slot, the terminal arrow, this page's own header, and the D4.3 panel header on HOME all read `DUE`. `DEADLINES`/`deadlines` survives only as the record-type noun in prose and as the `contract_deadlines` table / `/warroom/deadlines` route — never as anything printed on screen.

**Why it exists, and it is a reversal of a fact, not of a principle.** D5.0a ruled the DEADLINES terminal row inert because its rows count deadlines and not deals; that argument was against the *destination* and is answered by a route whose unit is the deadline. **The second half is the part that was simply wrong: deadlines are not all contractual.** Taxes, licence renewals, insurance lapses and filing dates are typed by hand and have no deal behind them at all — on the built panel they are already the rows with no property line. That is what earns the route, and the same fact is what earns the create control (D2.4a).

**Construction: D5.2's chrome, not a second treatment.** Fixed page chrome, scrolling body, **D4.1's scroll furniture** — 28px bottom fade terminating in the body's own fill, 6px thumb, no track. **It is not a table.** D5.2 is nine columns because a pipeline has nine facts per deal; a deadline has four. **The parts are the D4.3 DEADLINES panel's own — day-count gutter, kind, title, property — laid on one line at page width rather than stacked**, for D5.2.1's reason: a two-line row wastes the only axis a page has. No new row component.

**Order: chronological, past-due first, in one list.** Not two sections — a past-due deadline is the most urgent thing on the page, and a separate block below the fold is how it gets missed. Past-due rows carry the `late` spine and a `N D LATE` count; **the nearest future deadline keeps the panel's `hot` spine and its 5% tint, and that stays the only tint on the page** (D4.3).

**Columns — `WHEN · DEADLINE · DEAL · KIND`.** `N DAYS · MMM D` in a **104px nowrap gutter** *(widened from 84px, 8.20.26 — re-measured on the render: the widest string is 12 characters, a two-digit count plus a two-digit day, e.g. `31D · SEP 20`, and it collided with the DEADLINE column at 84px; the shorter `N D LATE` strings only escaped the defect by being shorter than a date, not because the gutter was wide enough. 104px matches the column header's own printed width one line above. **The day-count math itself was re-checked against the 20 Aug anchor and is internally consistent, ascending, no inversion** — a reported `38D` printing before `31D` does not reproduce on this render)* (`late` and `N D LATE` when past, `hot` when ≤ 7 days, else `text-mid`) · title at the row primary level · **the deal where one exists, and blank where it does not** · kind right-aligned in mono `text-low`. **Blank — not `—` and not `PERSONAL`.** A dash is a value and this is an absence, and the rows with no deal are precisely the ones the page was built for.

**Filters — three segments** in 34b's construction (no container, no fill, 2px `brand-strong` active spine, `text-hi`/700 active): **`ALL · PAST DUE · NO DEAL`**. **No date-range control** — the list is chronological and the scroll *is* the range. **No `TYPE ▾`** until the kinds are a closed set: `contract_deadlines.kind` is free text today and a menu of one-off strings is worse than no menu. **No CLIENT** — a deal has a client, a tax date does not. **No free-text field**: ⌘K owns search (D2.3).

**Entry states.** The rail slot opens the **unfiltered list at the top of scroll**, which by the order above puts past-due first — a position, not a filter, so nothing has to be discovered and cleared. The panel's `+ N MORE → DUE` arrives the same way. **No top fade and no entry scrolled past the late work**: D4.1 publishes a bottom fade only, so a list that opened mid-scroll would cut its first visible row against the chrome with nothing to explain it. `?filter=pastdue` is the one pre-filtered entry state and nothing generates it yet; per D5.2's rule, filter and sort are URL state so the entry points can arrive differently.

**Empty states** per D5.2.7: **`NOTHING DUE`** unfiltered, **`NO DEADLINES MATCH PAST DUE`** filtered — the string names the filter that emptied it. No illustration, no instruction, no create prompt in the body; the chrome already carries the control.

**It scrolls, and D8 item 1 does not apply** — the same scoping as D5.2 and D5.3. A page whose whole purpose is a long chronology is a document.

---

## D6. PIN gate — both surfaces

Full-viewport, centred, `bg-base`.

- Behind the mark: a 420px radial `rgba(139,92,246,0.13) → transparent 68%`. The only background effect in the app.
- **App mark: the glow star at 148px desktop / 168px mobile.** *(Mobile 128 → 168 — scale-up 29a, 12 Aug. Desktop untouched.)* Locked design **19a**. Asset is `star-glow-512.png` (mobile) / `star-glow-512.png` at 148 (desktop). **No radius, no tile, no plate** — it is a transparent glyph, not an icon. The previous 74/52px geometric mark is retired here: it sat under the §17 120px floor, and at 52px it was the smallest element on an otherwise empty screen, which read as a lot of black around a very small logo.
- **The star does not animate on this screen.** No spin, no pulse, and no CSS glow layered on top — the light is painted into the pixels (§17.2).
- `WAR ROOM` — JetBrains Mono **11px desktop / 13px mobile**, 500, `letter-spacing: 0.42em`, `text-mid`, 24px below the mark. *(Mobile 11 → 13 with 29a.)* The extreme tracking reads as an instrument label and gets out of the star's way; at either size it is not D4 and must not be "corrected" to match the splash. Add `padding-left: 0.42em` so the tracking on the final letter doesn't push the word off-centre.
- Four slots, 38px below on desktop / 40px on mobile:
  - Desktop 56 × 66px, radius 12, 12px gap. Mobile **44 × 54px, radius 10, 14px gap** *(was 38 × 46 r9 — 29a)*.
  - **Empty:** `bg rgba(255,255,255,0.05)`, `border-default`.
  - **Active:** `border: 1px solid brand` + `box-shadow: 0 0 20px rgba(139,92,246,0.35)` and a 1.5px blinking caret. This is the screen's one glow.
  - **Filled:** solid `#EFEEF4` slab with a 12px `#0A0A0F` dot. High contrast, unmistakable at a glance.
- Footer: `SHIRLEYCRE · RESTRICTED ACCESS`, mono 10.5px desktop / **11.5px mobile**, `0.24em`, `#3F3E4C`. **On mobile it sits 34px above the bottom edge** — 29a meters the whole column to the 844px viewport; no dead band below the footer.
- **Mobile gets its own keypad** — **twelve keys: a 3 × 3 digit grid, then `C` · `0` · `⌫`** (35a, 13 Aug). **Keys 108 × 64px, radius 16, 13px gap**, `rgba(255,255,255,0.05)`. **Digits 26px Space Grotesk 500 at `text-hi`.** `C` is the same 26px Space Grotesk 500 **at `text-mid`**; ⌫ is a 24px glyph at `text-mid`.
  - **Two classes of key, and they must not look alike: digits are `text-hi`, function keys are `text-mid`.** Same box, same size, same family — the grey is the entire distinction. It is what stops `C` reading as an enterable character.
  - **`⌫` deletes one digit. `C` clears all four.** Different actions, so the spec names both: C empties every slot and returns focus to slot 1, with no confirm and no animation. Neither key is disabled when the row is empty — a dead key on a keypad is a bug report.
  - **The bottom-left cell is not empty.** 29a left it blank, which reads as a keypad missing a key rather than one with two function keys. Filling it changes no other value: the grid, the 13px gap and the metering to the 844px viewport are unchanged from 29a.
  - **Desktop takes no keypad and no C.** It reads the hardware keyboard, where `Esc` clears and `Backspace` deletes. 44px below the slots. *(Was 64 × 52 r14 / 21px digits — 29a.)* The system keyboard never appears.
- **Error:** the slot row shakes 6px twice over 260ms and all four borders go `late` for 600ms. No error text.
- Success: slots fill, 120ms hold, cross-fade to the app.

Retired: the gold rounded-square layers icon, the blue `WAR ROOM` label, the grey "ShirleyCRE · Restricted Access" sentence casing, the 40px slot size — and, with 29a (12 Aug), the 128px mobile star, 38 × 46 slots, 64 × 52 keys and 21px digits.

---

## D7. Interaction

| Input | Behaviour |
| --- | --- |
| `⌘K` | Global search from anywhere. |
| `Space` on focused row | Complete the task. |
| `Enter` on focused row | Open its sheet — the D7.1 modal. |
| Click row | Open the modal. Click left edge | complete. |
| Hover row | Reveal the action cluster; no layout shift — reserve the space. |
| Sheets | **One mechanism: the centred modal, D7.1.** *(8.20.26 — "right-side drawer, 460px" is STRUCK.)* Same content and field order as mobile; not a bottom sheet and not a drawer. |

No page-level scroll anywhere. If a region overflows, it scrolls itself.

### D7.1 The sheet mechanism is a centred modal

*(New 8.20.26. Design turn **52d**. This is D9 item 6a, and it is unblocked.)*

**The desktop task modal is the record-creation sheet mechanism — task, event, deadline, deal. It is not the surface's only one.** *(Corrected 8.20.26 — first printed as "D7's and D4.1's 460px right-side drawer is STRUCK," which overreached: the drawer survives, narrowed to SET and `/warroom/contacts`, the two destinations that never became the modal.)* The modal itself was also printed wrong — 620px, single column — against what actually shipped: **960px, two columns.** "rendered at 22px." The modal has been through twelve build rounds with most checks closed; the drawer has none. **The build is the measurement.**

**Every sheet after this inherits it** — the deal page's edit state, the deadline editor, the portfolio flow, settings. **A later surface that wants drawer behaviour argues for it then, against a built modal, not against a spec line.**

**One shell, four fills.** Add task · Add event · Add deadline · Add deal. **The field sets differ; the chrome, geometry, motion, close behaviour and footer are identical** — which is what lets one build item gate every D2.4a control. **Fields and their order come from mobile §18.3b/§18.3c at desktop scale; this is not a new form.** Add Task invoked from the deals index (D5.2.2) arrives with that row's deal pre-filled.

| | |
| --- | --- |
| Scrim | `rgba(5,5,9,0.72)`, **no blur** — a full-surface blur repaint on a 1920 dashboard buys nothing on panels that are already this dark |
| Box | **960px wide, two columns** — `20px` pad · `600px` fields · `20px` gap · `300px` context rail · `20px` pad — centred both axes, `max-height: calc(100vh - 96px)`, `bg-panel #12111B`, radius **14**, `border: 1px solid rgba(255,255,255,0.14)`, column divider `rgba(255,255,255,0.11)`, `box-shadow: 0 24px 64px rgba(0,0,0,0.60)` *(corrected 8.20.26 — shipped and closed 37 of 37 checks at these figures; not the 620px single column, `border-strong` edge or 78vh cap first printed)* |
| Header | **72px**, left column. Title at T1 in `text-hi` · hairline · an 18px `✕` at `text-low`. **No create-control glyph** — the control that opened it is still on screen behind the scrim. Edit state inserts `delete-h76.png` at `height: 24px` before the hairline filler, ✕ unmoved (§D7.1a) |
| Rail | **300px, right column.** Deal/date context for the record being created — not a field, not scrollable independently of the body |
| Body | Left column, scrolls only if it exceeds `max-height`. Title field first, live-editable with the violet focus underline (mobile §18.3b) |
| Footer | **72px**, `flex: none`, hairline above, spans the full 960px. `Cancel` as plain text at the left; the primary at the right, **filled with §2.4a's aperture gradient as a flat fill**. **Delete is not here** — §D7.1a moves it to the header's right region |
| Motion | Scrim 120ms fade; box `translateY(8px) scale(0.985) → 0 / 1` in **120ms ease-out**, exit 90ms. **No spring.** `prefers-reduced-motion`: instant, scrim still fades |
| Focus | Title autofocused, focus trapped, **and focus returns to the invoking control on close** — with several create controls and an Add Task cell per index row, losing focus means losing your place in a table |
| Dismiss | `Esc` always. **Scrim click closes only while the form is untouched**; once a field has been edited it does nothing. There is no draft state, so an accidental dismissal is unrecoverable |

**960px is what shipped, not what was derived from column A.** The 620px reasoning (narrower than column A's 712px, so the sheet never measures wider than the panel that invoked it) doesn't survive the shape change to two columns — 960px is wider than any dashboard column, and a modal is not required to measure inside the panel it was invoked from.

**The 460px right-side drawer is not struck — it is narrowed to two destinations, unchanged at 460px: SET (D9 item 9) and `/warroom/contacts` (D9 item 10).** Desktop runs two sheet mechanisms on purpose: the wide modal for creating a record (task · event · deadline · deal, each with its own context rail), the narrower drawer for settings and contact management. Only the task/event/deadline/deal sheet inherits from D9 item 6a.

**The scrim settles the glow budget for free.** The wordmark and every D2.4a control sit under it, so **while a sheet is open the modal is the only lit object on the screen.** That is what a modal is for, and D8 check 3 is enumerated against the unobscured surface.

**What does not move:** the **settings** content stays at D9 item 9 with the SET slot, and both it and `/warroom/contacts` (item 10) keep the 460px drawer — the shell that moves is the record-creation modal only.

### D7.1a Edit-state header — Delete joins ✕, drawn (turn 53a, 20 Aug)

Mobile's rule — the header's right region carries the mode's terminal action, read mode `DONE`+✓, edit mode DELETE — meets one thing on desktop that mobile doesn't have: **a permanent ✕ ESC sits in that region in every state.** ✕ is chrome, not the mode's action, so it does not vacate; DELETE takes the next slot in from it, not the terminal one.

**Order:** title → `delete-h76.png` (edit state only) → hairline filler → ✕. **Spacing is the container's own, unchanged** — `gap: 12px` between every child, `flex: 1` on the hairline. Inserting DELETE doesn't add a rule or a margin; the hairline just shrinks to absorb it, the way it already absorbs whatever the title's length leaves behind. **Mount: `height: 24px` → 102.0px (cut aspect 4.2500, the locked desktop figure) — no reserved slot, no touch-target box.** Desktop hit targets are pointer-driven, not thumb-driven; the image's own rendered box is the target, same as ✕'s.

**✕ does not change.** Same 18px Space Grotesk glyph, same `text-low`, same last-flex-child position it holds in read and create state — it never moves, because it's pinned by the header's own right padding, not by anything DELETE does. The separation that keeps it reading as terminal-chrome rather than part of the destructive control is the hairline run between them, which at any realistic title length is the largest open span in the header — the same "distance over rearrangement" argument mobile made for its 365.33px gap, run on the geometry desktop actually has. No divider, no tint change, no size step on ✕: bareness is what marks DELETE as different in kind, and a treatment change on ✕ would be solving a problem the gap already solves.

---

## D8. Acceptance checks

At 1440 × 900 and 1920 × 1080:

1. **On the dashboard**, `document.body.scrollHeight === window.innerHeight`. The dashboard does not scroll. **Scoped to the dashboard, 8.19.26** — it was written unqualified and read as an app-wide law. It is not: the rule exists because the dashboard is an instrument panel, and its value is that NEXT 48 is in the same place every time you look up. **`/warroom/deals`, `/warroom/schedule` and `/warroom/deadlines` are documents, and documents scroll** (D5.2, D5.3, D5.4) — their chrome is fixed and their bodies scroll. Pagination was considered and rejected: it adds a control and a state to solve a problem scrolling does not have. **Engineering owns the check's scoping edit.**
2. Every panel body scrolls independently and its last row is fully reachable.
3. **Glowing elements of ours, complete list: the identity band's wordmark, and every D2.4a create control the surface mounts. Nothing else.** **This is a list, and it carries no number** *(rewritten from "exactly one" on 8.19.26; **the numeral removed 8.20.26** — "three objects on HOME" was written on 19 Aug and was stale on 20 Aug, in this check and a mockup caption at once, the moment DEADLINES earned a control. A count in a build contract has a shelf life; the list does not)*. **Enumerate against the rendered surface — do not check a total.** On HOME the list is the wordmark, BATTLE PLAN's control, SCHEDULE's control and DEADLINES' control; on `/warroom/deals`, `/warroom/schedule` and `/warroom/deadlines` it is the wordmark and that page's one control. The FAB is not on desktop. RECEIVABLES must still compute `text-shadow: none`. **The LACDB and CREXI plates are exempt and do not count** (D2.7 — third-party marks). **While a D7.1 sheet is open the list is enumerated against the unobscured surface** — the scrim covers all of it by design. Three ways to fail: RECEIVABLES glows; a glowing element of ours appears that the list does not name; or a surface carries a create control D2.4a's rule does not give it.
4. No colour outside the five tokens in mobile spec §2.4.
5. Every uppercase string is JetBrains Mono; every sentence-case string is Space Grotesk.
6. Every figure uses tabular numerals and columns align vertically.
7. Every rail item has a visible text label.
8. No overdue row has a coloured background.
9. Next 48 shows no item twice.
14. **No two surfaces publish the same population.** Every count on the dashboard has exactly one owner — late tasks are BATTLE PLAN's, past-due deadlines are DUE's, live deals are MONEY MOVERS'. **A figure that restates another panel's population is struck, not reconciled** *(added 8.20.26 — NEXT 48's overdue figure failed twice in one day, once as bad arithmetic and once as a correct number that contradicted two panels beside it; the second failure is the one this check exists for)*. Sibling of item 9: that check stops the same *item* rendering twice, this one stops the same *fact* being published twice.
10. **Per column: `Σ panel allocations + gaps + flex:none panels === column height`.** No ragged column bottom (D4.4).
11. **No elastic panel renders a partial row**, and no elastic panel scrolls. Truncation shows the D4.4 item 7 terminal row (D4.4 item 6).
12. **With one record in a column's first panel, the second panel renders more rows than it does in the balanced case.** This is the only check that catches a hardcoded split that still adds up (D4.4).
13. **With one day loaded and two clear, the loaded NEXT 48 column renders more rows than with all three loaded** (D3.3a). Four equal columns means `repeat(4, 1fr)` is still in the file.
14. **Every terminal row's string names the route it opens** (D5.0a), **naming it as the rail names it** — `→ SCHED`, `→ DUE` — and NEXT 48's carries no arrow.
15. **Every create control on a surface breathes in unison with the others** — one animation, one mount tick, no stagger (D2.4a). On HOME, SCHEDULE's and DEADLINES' pulses sit directly above one another in column C and must peak together.
16. **A surface renders exactly one create control per person-typed record type it lists** (D2.4a's rule): none on MONEY MOVERS, UNDER CONTRACT or RECEIVABLES, and **not zero** on a page that lists what it creates.

---

### D8.1 Height budget — derive, never guess

*(New, 45a, 8.14.26. Three consecutive review failures came from re-guessing one panel height instead of measuring the budget once.)*

**A panel's content is sized to its box, and the box comes from the ratio — not the reverse.** At 1920 × 1080 the measured budget is: identity band 112 · NEXT 48 wrapper 18 + 236 · flex row **712** · row padding 18 / 20. Inside that: column C holds **478px** for SCHEDULE + DEADLINES once RECEIVABLES (`flex: none`, ~160px) and two 18px gaps are paid; column B leaves UNDER CONTRACT **217px** after MONEY MOVERS' 435; each NEXT 48 day column gets a **170px** box.

**No single panel-header figure belongs in this section** *(8.20.26)*. **The header is 55px with a D2.4a create control and 41px without** (D2.4), so the header term is per-panel and D4.4 owns it. Publishing one number here would put a third figure in the document and silently over- or under-budget every column that mixes the two.

**Heights within a column are allocated by content, not held per panel — see D4.4.** D8.1 measures the budget; D4.4 divides it.

**Check, per panel:** `el.scrollHeight === el.clientHeight` for every panel element — **not `body`**. `body` is the page, and the page is already D8 item 1; running the page check twice tests no panel at all. Any panel where they differ is hiding a row, and a mock that hides a row is not evidence the layout works. **When content exceeds its box, cut the content — do not re-guess the height.**

---

## D9. Build order

**Reconciled against the audited D5, 11 Aug.** Every path below is under `/warroom/*` — there is no root-level route in this app. Items marked **new route** did not exist at audit time; do not assume a path is built because a similar one greps.

1. Shell only — top bar, empty panel grid, `100vh` no-scroll. Verify D8.1. **The rail mounts two slots: HOME and PEOPLE** (→ `/warroom/contacts`, built). Nothing else has a live destination at this step.

   **Not DEALS** — `/warroom/deal` is deal *detail*, not an index, so mounting it here points the slot at the wrong screen and requires a retarget at item 7. **A slot that has to be retargeted was mounted too early**; DEALS mounts at item 7 with its index.

   **Not SET** — the settings sheet it opens is built at item 9. A slot whose destination is eight steps away is a dead slot, sheet or route; the rule does not care which kind of destination is missing. SET mounts at item 9.

   **The rail grows as the app does: two slots here, nine at item 13.**
2. Panel component + section header.
3. Battle Plan into column A. **Ratio-with-floor per D4.1** — `max(0.30 × net, 441px)`. If it proves too narrow to work in, raise the ratio here — do not add a route (D5).
4. Money Movers + Under Contract into column B.
5. Schedule + Due + Receivables into column C. *(AGENT struck 8.20.26 — no term for it in the measured chain, no headroom in the column.)*
6. NEXT 48 rollup query + band, **with D3.3a's weighted columns** — not `repeat(4, 1fr)` with a follow-up pass. The rule exists now; building the equal grid first means building it twice.
6a. **The D7.1 modal shell + task sheet — moved up from item 9** *(8.19.26)*. **It is a dependency of item 7, not a later feature.** D5.2's nine columns include **Add Task**, which opens the modal pre-filled with the deal, and that column is specced never to shed — so the index cannot ship without it. **Every D2.4a create control is a dependent.** **This is the same rule SET is held to:** a control whose destination is two steps away is dead, sheet or route.

   > **UNBLOCKED 8.20.26 — 6a is the modal, corrected the same day to what actually shipped: 960px, two columns (20 pad · 600 fields · 20 gap · 300 context rail · 20 pad), header/footer 72px each, `max-height: calc(100vh - 96px)`.** Closed 37 of 37 checks, measured off the render — not the 620px single column §D7.1 first printed. **The drawer is not struck — it is narrowed to two destinations, SET and `/warroom/contacts`, unchanged at 460px.** Desktop runs two sheet mechanisms on purpose: the wide modal for creating a record, the narrow drawer for settings and contacts. **Only the task/event/deadline/deal sheet inherits from 6a** — a later surface that wants drawer behaviour argues for it against a built drawer, not a struck one.

   **What does not move: the settings content and the SET slot stay at item 9.** The shell and the settings *contents* are different work, and only the shell is a dependency here.
7. **`/warroom/deals` — new route**, the pipeline index, moving the table off the dashboard. **Mount the DEALS slot with it.** **Not `/deals`, and not the existing `/warroom/deal`**, which is deal detail and will collide in routing if the plural is added carelessly.

   **Moved up from position 7-as-optional to a hard dependency of items 4 and 5** *(8.19.26)*: MONEY MOVERS, UNDER CONTRACT and DEADLINES terminal rows all resolve here (D5.0a). Until it exists those three rows are drawn and dead. **Filter and sort are URL state** — four entry points arrive in four different states.
7a. **`/warroom/schedule` — new route.** Year-out expanded view, **MONTH and AGENDA together** (D5.3.4 — the header toggle and the overflow cell both depend on AGENDA, so it is not a follow-up). The D4.3 SCHEDULE terminal row resolves here. **Mount the SCHED slot with it.** AGENDA design turn owed before this can be built.
7b. **`/warroom/deadlines` — new route** *(new 8.20.26)*. Chronological, past-due first, §5.11 rows at page width — D5.4, drawn at 52b. **Mount the DUE slot with it.** The D4.3 DEADLINES terminal row resolves here; **until it lands that row renders as a plain count with no arrow and no hover**, exactly as D5.0a requires.
8. PIN gate, both surfaces.
9. **Settings sheet content**; wire the deal page (`/warroom/deal/:id`, built). **Mount the SET slot with it** — the settings sheet is its destination. *(The D7.1 record-creation modal and the task sheet moved to 6a; SET keeps its own 460px drawer, unchanged — corrected 8.20.26.)*
10. **`/warroom/contacts` adoption — built route.** Shell, §5.11 rows, tokens, the **460px drawer** *(unchanged, 8.20.26 — not the D7.1 modal)*. List and sheet only; no contact detail page.
11. **`/warroom/money` — new route.** Receivables detail, payment logging, commission history. **Mount the MONEY slot with it.**
12. **`/warroom/portfolios` — new route.** Desktop adoption of mobile §19. **Mount the PORTF slot with it.**
13. **`/warroom/entities` — new route.** Per-company view; requires `task.entity_id` (D5 note). **Mount the ENTITY slot with it.**

Items 1–9 are the dashboard. **10–13 are routes nothing serves yet.** Their slots do not exist until they do: **ship the slot and its destination together, or don't mount the slot** — a sheet counts as a destination, an unbuilt sheet does not.

**Rail slot count by step:** 2 at item 1 · 3 at item 7 (DEALS) · 4 at item 7a (SCHED) · **5 at item 7b (DUE)** · 6 at item 9 (SET) · 7 at 11 (MONEY) · 8 at 12 (PORTF) · **9 at 13 (ENTITY)**.

**Create controls and their destinations:** every D2.4a control opens the **D7.1 modal**, which exists from **6a**. **No create control renders before its sheet exists** — that is the SET rule applied to buttons, and it is why 6a is a dependency rather than a convenience. **One shell serves all of them**, so the gate opens once.

---

## D10. Open questions

1. ~~At 1920, extra width to column C or to the Next 48 band?~~ **Answered 8.14.26 (43a):** split across A, C and the band, expressed as D2.1's ratios. No fourth column.
1. ~~**D4 residual reconciliation.**~~ **Closed 8.19.26** — D3.3/D4.1/D4.2/D4.3 rewritten to the 47/48 scale; the card styling is deleted from the printed spec and §D4 no longer disagrees with itself. See the RESOLVED block at the head of §D4.
2. Schedule empty state — `NOTHING SCHEDULED` (recommended) or keep the current sentence?
5. ~~**Sheet mechanism: 460px right-side drawer (D7, D4.1) or the modal now in build?**~~ **Answered 8.20.26 — the record-creation modal, at its corrected 960px two-column geometry.** The drawer is not struckwelve build rounds with most checks closed. **§D7.1 is the mechanism and every later sheet inherits it.** D9 6a is unblocked and drawn (52d).
6. ~~**D2.4a halo shape** — 50a's pill bloom or 50b's glyph-carried circle.~~ **Moot 8.19.26** — turn 50 is struck entire and the create control takes the FAB's own halo unchanged (§D2.4a). ~~**HOME's redraw is still owed.**~~ **Drawn 8.20.26 at 52a**, with four glowing objects and the nine-slot rail.
7. **Column C at 1440 × 900, after DUE's 14px header growth.** D4.4's recompute takes 28px out of the column and the floors-exceed-budget branch is that much closer. **The only movable term is RECEIVABLES** (`flex: none`, paid before allocation). Not moved — a turn if the render fails.
8. **Deadline kinds are free text** (`contract_deadlines.kind`), which is why D5.4 ships no `TYPE ▾` filter. **Closing the set is a data question, not a design one.**
4. ~~**`/warroom/deals` index and `/warroom/schedule` are both undesigned as of 8.19.26.**~~ **Answered 8.19.26 — both specced (D5.2, D5.3) and drawn (49a, 49b).** Remaining sub-item: **★ sort-state treatment and the active-column / direction indicator are called for in D5.2.5 and drawn in 49a; if a different treatment is wanted, that is a turn.**
3. Does the Next 48 band collapse to a single summary row when empty, or hold its height so the layout never shifts? Recommendation: hold its height.

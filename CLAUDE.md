# War Room — project context

*Last updated 13 August 2026, 09:45. Save to the repo root as `CLAUDE.md` — the filename is load-bearing.*

ShirleyCRE. Two surfaces: a mobile PWA ("War Room") and a desktop control station. Plus a public site, shirleyre.com, which is separate work.

**The specs are the source of truth, not the mockups.** Read them before designing anything.

- `SHIRLEYCRE_MOBILE_SPEC.md` — mobile build contract. §1–20. **Current: 8.13.26 0945.**
- `SHIRLEYCRE_DESKTOP_SPEC.md` — desktop build contract. D1–D10. **Current: 8.13.26 0833.**

Both are complete and shippable as they stand. Reissue on any edit, same day.

Mockups live in `War Room Mobile.dc.html` (turns 1–34) and `FAB.dc.html` (turns 1–19), newest turn at the top. They are a design record — where a mockup and a spec disagree, the spec wins.

## Deliverable naming — always

**Every file handed over carries a date and timestamp in its filename: `NAME 8.11.26 1905.ext`.** No exceptions, including spec files, design records, scope docs, and reference HTML. Ask for the time if you don't have it; never guess a rounded hour.

Never hand over a folder or zip — the download takes the project name and forces a rename. Individually named files only.

## Mockups carry their step

**Any mockup depicting a state in a build sequence says which step it is, on the option label.** "25a — the item-13 end state." "26a — item 10."

"The spec wins over the mockup" is true and has failed three times today — D5's route table, `CHAIN · 8 STEPS`, 20a's twelve-row caption. The picture gets read first and the precedence rule never gets reached. A caption removes the disagreement instead of relying on someone remembering which document outranks which.

Same rule for numbers in captions: **a count in a mockup caption is a measurement or it is not written.**

## Working style

The user builds with an AI coding agent ("the claw"). Design's job is to design and to write the spec section; the claw implements from it. Deliverables are spec sections, not screenshots.

New options go in as a new turn at the TOP of the relevant `.dc.html`, ids `{turn}{letter}` (18a, 18b…). When a direction is locked, mark it `LOCKED` on the option label AND write it into the spec the same turn.

**Same-day rule.** When a section or a turn lands, it reaches the package that day — and it goes into the spec, not only into a side handoff. Two live documents that disagree is the failure mode.

The user is direct and wants the same back. Say when something is wrong and why. Don't pad.

## Locked decisions worth knowing

- **Identity row (15c → 29b, §6.2):** `WAR ROOM` in JetBrains Mono **19px**/700/0.13em — spec level **D4**, one use per screen. **48px mark**, T1 date right, bare 22px search glyph at the edge, one line, 48px tall. There must be no dead space above it.
- **Quick Actions — Task and Event sheets (36a/36b, §18.3b/§18.3c, locked 13 Aug).** Neither had a create sheet before — tapping them only described a destination. Both now open a sheet on Voice Note's shell: DUE (task) or WHEN+TIME (event) below the title, optional Deal/Location rows below that. **Calendar and time-wheel are drawn, never native inputs** — a native control renders in system chrome outside our tokens, which was the real cause of "white popups." TIME is its own section below WHEN, not folded into the date chips; WHEN is three equal `flex:1` chips, not four packed ones.
- **FAB aperture gradient, generalized (§2.4a, 13 Aug).** Every filled purple control — Save buttons, the active/selected day, the wheel's centre band — now takes the FAB's static radial gradient (`fab.css`'s `.wr-fab__face`), not a flat `brand` fill. No sweep, no breathe — those stay FAB-only. Flat `brand`/`brand-strong`/`brand-lift` are unchanged for text, spines and figures.
- **The corner × on Quick Actions/Money Movers/Under Contract/Battle Plan screenshots is a build bug, not a design gap (13 Aug).** §18.9 retired it 12 Aug (31a) — the FAB's × is the only close. Report to the claw as-is; no new decision.
- **PIN gate scale-up (29a, D6, locked 8.12.26 0745):** mobile star 168 · wordmark 13/0.42em · slots 44×54 r10 · keys 108×64, digits 26 · footer 11.5, 34px off the bottom. Column metered to the 844px viewport — no dead band. Desktop gate untouched.
- **PIN keypad C key (35a, D6, locked 13 Aug).** Twelve keys: 3×3 digits, then **`C` · `0` · `⌫`** — 29a's empty bottom-left cell is filled. Two rules came out of it: **digits are `text-hi`, function keys are `text-mid`** (same box, same 26px, same family — the grey is the whole distinction, and it's what stops C reading as an enterable character); and **⌫ deletes one digit, C clears all four**, focus back to slot 1, no confirm, no animation. No other 29a value moves. Desktop takes no keypad and no C — hardware keyboard, `Esc` clears.
- **Two tiers, one family (17c, §17):** the glow star renders at **120px or larger only** — splash, PIN gate, marketing, print. Everything below 120px uses the geometric mark. Both are eight-point stars on a long vertical axis, so they read as one mark at two distances.
- **The FAB is a delivered asset (§7.1).** `assets/fab/` — pure CSS, deep aperture, 7s halo matching the homepage beacon, 16s rim sweep. Do not rebuild it as a gradient square with an SVG plus. **The glyph is 14b — the two-bar plus that rotates 45° to ×. Locked. The eight-point star was explored in `FAB.dc.html` turns 15–18 and REJECTED** — see `FAB_FUNCTION_SPEC_v2` §9. The binding reason: the mark already renders at 40px in the identity row, so a star FAB would put the brand mark twice on one screen at two sizes meaning two different things.
- **Row heights are final (§5.11.1).** **68px with a meta line, 48px without. No third height.** The construction is authoritative, not the rounded figure — `14+19+14+1 = 48`, `14+19+5+15+14+1 = 68`. An earlier draft said 49; that was arithmetic done wrong, not a different design. §5.11.8 check 3 is **seven rows**, not twelve — 20a's caption was wrong and the check was corrected to what the row produces at spec padding.
- **Money stack (§5.11.4):** 1px gaps both places. `15+1+9+1+11.5 = 38.5px` inside the 68px row's 39px content area. Anything larger overflows a row that is not negotiable.
- **Tab bar (19b, §5.7):** five labelled slots — HOME · DEALS · NEW · MONEY · MORE. Centre slot is 70px and carries the label `NEW`; it is not an empty gap. FAB lifted `margin-top: -23px` exactly. Halo opacity 0.34.
- **Deals sheet ribbon + filters (31a/32a, §6.1, locked 8.12.26 0815).** 48×5 handle · 44px header: T0 title (new level, 13px mono) · M2 count · nothing else — no `+ PORTFOLIO` (creation is desktop-only, §19.1), no corner × (the FAB-× is the close, §18.9 amended). **Filter row superseded by 34b, 13 Aug — see below.** TYPE menu alphabetical INDUSTRIAL·LAND·OFFICE·OTHER·RETAIL. Needs `deal.property_type` — DATA question out.
- **Deals sheet filter row (34b, §6.1, locked 13 Aug).** **No container, no pill, no fill** — four `flex: 1` segments on a 44px band sitting on the header hairline. `ALL 47 · HOT 3 · UC 5 · TYPE ▾`. Active = **2px `brand-strong` bottom spine** + `text-hi`/700; inactive `text-mid`/600. New type level **F1 — JetBrains Mono 16px, 700/600, 0.03em** (§3.2); the count is F1 at 400, so label and count separate by weight, never by a new grey or an opacity. The row was at **T5 (9px)** — the badge level carrying the sheet's primary control — and was illegible on the phone. Killing the box is what pays for 16px, and it settles a second problem: §5.11 says rows are not cards, and a filled radiused track was the only boxed thing on a sheet of unboxed rows.
- **`brand-strong` `#7C3AED` is now a token (§2.4, 13 Aug).** White on `brand` `#8B5CF6` measures **4.2:1** — under the floor — so every filled violet chip in the app was failing while looking intentional. **`brand-strong` is for any violet fill carrying white text; `brand` keeps the FAB, the mark, figures and spines,** which carry no white text. App-wide token change, not a §6.1 change.
- **§5.8's "authorized deviation" for the Deals sheet header was stale and is deleted (13 Aug).** It still specced the `+ PORTFOLIO` pill that 31a removed, so §5.8 and §6.1 had disagreed since 12 Aug. Every sheet header in the app is now one object.
- **Short address (§5.11.9, 30a, locked 8.12.26 0755).** List-row titles are street name → cardinal (if any) → municipal number — `Reitz Ave. 5525`. No city/state/zip/country on any list row; full address on the deal page only. Deal-row subline is the client alone. Deals sheet: portfolios pinned first, then deals A–Z; portfolio marker is the §5.11.7 plate — the emoji (30b) was rejected. Blocked on Sanka's parse-check DATA answer.
- **Rows are not cards (§5.11).** Every list row across all five sheets — Battle Plan, Money Movers, Under Contract, Deadlines, Deal Pipeline — is one object: hairline-separated, no border, no radius, no background fill. Build the row once. Locked 20a/20b/21a/22a.
- **One accent per row: the spine.** A spined row takes no accent tint. Overdue rows get a spine and a day count, never a red background.
- **Colour:** violet-dominant with amber accents. Gold is retired on the app (the public site keeps its gold beacon). One glow per screen max; the FAB doesn't count.
- **Portfolios (§5.11.7, 22a).** A portfolio is a named grouping of deals that share one client — a person or company engaged on multiple addresses, sometimes adjacent, usually not. Keyed by client; members are deals. Children carry their own status and economics; nothing inherits. Created deliberately, never emergent.
- **Typography freeze is LIFTED** (Matthew, 11 Aug 2026). `FAB_FUNCTION_SPEC_v2` §8 froze font sizes pending a global Type Tune package. That package now runs *before* Battle Plan. Do not re-impose the freeze.
- Never put either mark on a light background, and never add CSS glow on top of them — the light is painted into the pixels.

## Assets

- `assets/app-icon/` — both mark tiers + delivery sizes. `WHERE-TO-USE-WHAT.md` is the manifest; read it before picking a file.
- `assets/fab/` — `fab.css` (the asset), `Fab.jsx`, `fab.html` (demo + 19b tab bar in context), `fab-reference.png`, `README.md`. **Internally consistent as of 8.11.26 2146** — the lift is `-23px` in `fab.css` itself, not an override in the demo page, and the README and §7.1 geometry lines match. `fab-reference.png` is a 3× browser render of the shipping asset: **put a screenshot beside it to check a build on sight.**
- `assets/icons/` — **these are shirleyre.com's public-site nav icons, not the app's.** Five of six are stock Lucide (`building`, `globe`, `brain`, `phone-call`, `book-open`); `about.svg` is custom. The app rail needs its own set drawn against D5's routes — leave these alone.
- `uploads/` — the user's own files. Do not overwrite.

## Built vs specced — D5 was audited and rewritten

**D5's path structure was wrong, not just its contents.** Every built route lives under `/warroom/*`; D5 wrote all seven at root. **Five of seven routes were unbuilt** — `/tasks`, `/money`, `/deals` as an index, `/portfolios`, `/entities`. Built: `/warroom`, `/warroom/deal`, `/warroom/deal/prospects`, `/warroom/contacts`, `/warroom/client`, `/warroom3`.

**Rule that came out of it: ship the slot and the route together, or don't mount the slot.** The rail mounts partially at D9 item 1 (HOME and PEOPLE live, SET opens the D7 drawer) and grows as routes ship. `/tasks` is **dropped, not deferred** — D4.1 gives column A the widest column because it is "the panel you work in," so a `/tasks` route is a second copy of it. If 512px isn't enough, fix D4.1's sizing. The glyph stays drawn.

**`entity` is a reserved word.** It means **a company Matthew owns** (§13.2's Life/Entity split is personal-vs-my-business). It never means a client. §20.1's contact types are **person / company** — an earlier draft said person / entity, which would have produced wrong queries forever. `/entities` needs `task.entity_id` (nullable FK) to separate Rooster from UPALS; the two-value enum can't.

`/tasks` **does not exist.** D5 specs it as "Battle Plan full view, all buckets expanded, plus closed chains," but there is no directory under `app/warroom/tasks/` or `app/warroom3/tasks/`. Tasks data is fetched inside `warroom3/page.tsx` and passed to `BattlePlanPanel`. Built routes: `/warroom`, `/warroom/deal`, `/warroom/deal/prospects`, `/warroom/contacts`, `/warroom/client`, `/warroom3`.

Any spec section that deep-links to `/tasks` is writing against a route that isn't there.

## Type Tune is DONE (§3.2–3.4, 8.11.26 2114)

Ran after the build, not before — bound to named levels, it was a token swap. All ten of Sanka's held literals are now levels: **M1/M2** money mono, **§3.4** glyph sizes. **D3 did not split** into sheet-title and page-title — one level. The two near-misses were drift and were folded into existing levels (13.5→T3's 14.5, 11→T4's 11.5). **No pixel literal for text anywhere in the app.**

## Where things stand, 12 Aug 07:28

**Out to the claw:** `BUILD_DIRECTIVE_HOME_PIN 8.11.26 2130.md` — ten items where **a value exists in the spec and a different value is in the build**, each with its own one-glance check. Six are turns 15–19 decisions absent from the shipped screen: the identity row is Space Grotesk sentence case stacked over the date instead of D4 mono on one line, ~200px of dead space sits above it, the FAB is the gradient-square-plus-SVG the spec names as the thing not to build, the tab bar centre is unlabelled, the PIN gate raises the system keyboard, and its footer is sentence case. **Items 1 and 3 are most of why the screen doesn't read as War Room.**

**Sanka has built** §5.11 and §18 — but against the 1904 spec, before the row-height correction. §19 and §20 both consume ListRow.

**The lesson worth carrying:** the pattern all day was a picture or a table read as a build contract. Hence the two rules above — mockups name their build step, and counts in captions are measurements. Every directive item now carries an observable check instead of prose.

## Open

- Portfolio creation flow — where the control lives, whether a portfolio carries its own name, whether deals can be moved in after the fact. With design.
- 22b (portfolio expand-in-place) — unblocked by the data-model ruling; not yet designed.
- Chain template contents — prospecting and listing step lists drafted, in review.
- **Lane A — desktop Contacts adoption pass (D5 position 7).** Approved, unassigned, no dependencies. **List and drawer only — no contact detail page.** Design work; the claw doesn't touch it until mobile §19 and §20 land.
- **Lane B — `/entities`.** Re-scoped: per-company, needs `task.entity_id`. Deals belong to clients, and Matthew's companies are not his clients — nothing grows the lane.
- App rail icon set — **drawn** against D5's routes; PORTF reuses §5.11.7's stacked-layers mark. TASKS glyph drawn but unmounted.
- Still to design: see mobile spec §16.

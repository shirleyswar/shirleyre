# War Room — project context

*Last updated 11 August 2026, 19:10 CDT. Save to the repo root as `CLAUDE.md` — the filename is load-bearing.*

ShirleyCRE. Two surfaces: a mobile PWA ("War Room") and a desktop control station. Plus a public site, shirleyre.com, which is separate work.

**The specs are the source of truth, not the mockups.** Read them before designing or building anything.

- `SHIRLEYCRE_MOBILE_SPEC.md` — mobile build contract. **§1–20.**
- `SHIRLEYCRE_DESKTOP_SPEC.md` — desktop build contract. D1–D10.

Mockups live in `War Room Mobile.dc.html` (turns 1–24) and `FAB.dc.html` (turns 1–19), newest turn at the top. **Turn numbers are one sequence across both files, not one per file** — turns 12–14 are in `FAB.dc.html`, which is why the mobile record jumps 11c → 15a. They are a design record; where a mockup and a spec disagree, the spec wins.

## Working style

The user builds with an AI coding agent ("the claw" / Sanka). Design's job is to design and to write the spec section; the claw implements from it. Deliverables are spec sections, not screenshots.

New options go in as a new turn at the TOP of the relevant `.dc.html`, ids `{turn}{letter}` (18a, 18b…). When a direction is locked, mark it `LOCKED` on the option label AND write it into the spec the same turn.

**Same-day rule.** When a section or a turn lands, it reaches the package that day — and it goes into the spec, not only into a side handoff. Two live documents that disagree is the failure mode, and it has bitten this project twice.

**File naming: date + 24h timestamp, never a version number.** `NAME 8.11.26 1910.md`. The timestamp is the version.

The user is direct and wants the same back. Say when something is wrong and why. Don't pad.

## Locked decisions worth knowing

### Identity and marks

- **Identity row (15c, §6.2):** `WAR ROOM` in JetBrains Mono 17px/700/0.13em — spec level **D4**, one use per screen. 40px mark, date right, search at the edge, one line. No dead space above it.
- **Two tiers, one family (17c, §17):** the glow star renders at **120px or larger only** — splash, PIN gate, marketing, print. Everything below 120px uses the geometric mark. Never on a light background; never add CSS glow on top of either — the light is painted into the pixels.

### The FAB

- **It is a delivered asset (§7.1).** `assets/fab/` — pure CSS, deep aperture, 7s halo matching the homepage beacon, 16s rim sweep. Do not rebuild it as a gradient square with an SVG plus.
- **The glyph is 14b** — the two-bar plus that rotates 45° to ×. Locked. **The eight-point star was explored in `FAB.dc.html` turns 15–18 and REJECTED** (`FAB_FUNCTION_SPEC_v2` §9): the mark already renders at 40px in the identity row, so a star FAB would put the brand mark twice on one screen at two sizes meaning two different things.
- Two states, one condition — any sheet open? No → `+` opens Quick Actions. Yes → `×` closes that sheet and nothing else.

### Layout and colour

- **Tab bar (19b, §5.7):** 94px, `box-sizing: border-box`. Five labelled slots — HOME · DEALS · NEW · MONEY · MORE. Centre slot is 70px and carries the label `NEW`; it is not an empty gap. FAB lifted `margin-top: -23px` exactly. Halo opacity 0.34.
- **Rows are not cards (§5.11).** Every list row across all five sheets — Battle Plan, Money Movers, Under Contract, Deadlines, Deal Pipeline — is one object: hairline-separated, no border, no radius, no background fill. Build the row once. Locked 20a/20b/21a/22a.
- **One accent per row: the spine.** A spined row takes no accent tint. Overdue rows get a spine and a day count, **never a red background.**
- **Colour:** five tokens, no sixth. Violet-dominant with amber accents; gold is retired on the app (the public site keeps its gold beacon). One glow per screen; the FAB doesn't count.
- **Battle Plan has four buckets:** `OVERDUE · TODAY · LATER · NO DUE DATE`. There is no fifth. *(20a's `DUE SOON` header was drawn to demonstrate row treatment, not bucket structure — read it as `TODAY`.)*

### Chains (§14)

- **Exactly one incomplete step per chain, always.** Seven templates (§14.7) selected automatically by `representation_role` + `transaction_type` + `status`. The template defines a sequence; the chain instantiates **one step** and morphs. Never write the template into the database at creation.
- **`next_step.due_at = prior_step.completed_at + interval`, computed at morph time.** Never pre-calculated.
- **§14.2.1 — the timeout branches.** "Close is the default" applies **only** to a standalone task or a terminal template step. A template step with a defined next step **creates that next step**; the chain stays open. Label: `Closing in 6s` in `text-low` vs `Next step in 6s` in `brand-lift`.
- **Four resolutions:** Morph · Close · Reschedule · **Supersede**. Nurture and Pause are reschedules into `LATER`, not new states. `Close lost` is a Close with `chain.closed_reason`.
- **Closing a chain never changes deal status.** Launch · Hot · UC · Landed · Expire · Dormant · Terminate stay PIN-gated on the deal page. `lost` is not one of the five statuses.
- **`+N BD` skips weekends only.** No holiday calendar. Business-day math applies to generated dates; §13.2's DUE chips stay calendar-literal.
- **Review-step DUE chips are `7 · 14 · 30 · Pick` and there is no `Today` chip.** Picking there rewrites `deal.reporting_cadence_days` — a client reporting commitment. One-off bumps go through swipe-left, which never touches cadence.

### Intake (§20)

- **Five required fields:** address · `transaction_type` · **`representation_role`** · `status` · `client`. The role — `SELLER · LANDLORD · BUYER · TENANT` — sits directly under `transaction_type`; together they select the template.
- **The chain preview row names the template and never shows a step count.** `SALE LISTING · STARTS TODAY`. A count reads as an instruction to write that many rows.
- **§20.4 check 7:** creating a deal writes **exactly one open step.** More than one row in Battle Plan from one new deal means the template was instantiated instead of started.
- Entry status offers `pipeline` / `active` only. `under_contract` is reachable solely by PIN-gated transition.

### Portfolios (§19, §5.11.7)

- **A portfolio is a named grouping of deals that share one client** — a person or company engaged on multiple addresses, sometimes adjacent, usually not. `portfolio` keyed to a client, `deal.portfolio_id` nullable FK. **Not** `parent_deal_id`.
- Children carry their own status and economics; nothing inherits. **A portfolio has no status of its own** — a status pill on a portfolio means something is inheriting state.
- A hot child keeps its **filled** amber pill inside an expanded row.
- Counts and money roll-ups are **derived at read time, never stored.**
- **Created deliberately, never emergent. Nothing anywhere suggests creating a portfolio.**
- Removal blocks at two members, and deletion is intercepted by the same prompt at the other door.

### Typography

- **The freeze is LIFTED** (Matthew, 11 Aug 2026). `FAB_FUNCTION_SPEC_v2` §8 froze font sizes pending a global Type Tune package. That package now runs *before* Battle Plan. **Do not re-impose the freeze.**
- **Build against named levels from §3.2, never pixel literals.** Type Tune will move the scale; bound to tokens it is a token change, bound to literals it is a rebuild of every list in the app. Raw values with no matching level are Type Tune's inputs — hold them behind named constants and report them.
- **Uppercase = JetBrains Mono. Sentence case = Space Grotesk.** No third option.

## Assets

- `assets/app-icon/` — both mark tiers + delivery sizes. `WHERE-TO-USE-WHAT.md` is the manifest; read it before picking a file.
- `assets/fab/` — fab.css, Fab.jsx, fab.html, README.
- `assets/icons/` — **these are shirleyre.com's public-site nav icons, not the app's.** Five of six are stock Lucide (`building`, `globe`, `brain`, `phone-call`, `book-open`); `about.svg` is custom. The app rail needs its own set drawn against D5's routes — leave these alone.
- `uploads/` — the user's own files. Do not overwrite.

## Built vs specced

`/tasks` **does not exist and is not being built.** D5 specs it as "Battle Plan full view, all buckets expanded, plus closed chains," but there is no directory under `app/warroom/tasks/` or `app/warroom3/tasks/`. Tasks data is fetched inside `warroom3/page.tsx` and passed to `BattlePlanPanel`. Built routes: `/warroom`, `/warroom/deal`, `/warroom/deal/prospects`, `/warroom/contacts`, `/warroom/client`, `/warroom3`.

The `View closed` link that pointed at it is **retired** (§16). Matthew reads chain history one deal at a time, on the deal page — §14.5's retained completed steps are that history surface, and "today they vanish" is a defect to fix, not a feature to drop. Do not build the route to justify a link that has been cut.

## Deliberately out of scope

- **Deal checklist** and **activity log** (§14.11). Named so they are not assumed into scope. The chain is a next-action engine, not storage for every transaction detail. §14.5's completed steps are a per-deal log of chain work only; §18's voice notes write to `notes`. Neither is a general activity log.
- **Desktop.** Separate surface, separate cycle, gets no FAB.
- **US federal holidays.**

## Open

- **Type Tune** — inbound from design. Two inputs waiting on it: the global pass, and 23b's 25px/600 page-title candidate.
- **App rail icon set** — not yet drawn. The only item on the board with no owner and no date.
- **§19.3's zero state** — the spec says removal and deletion both block, then specs a `0 SITES` screen. Either name the surviving route or cut the screen. Not blocking the build.
- Still to design: see mobile spec §16.

# War Room FAB — "Deep aperture"

Final. Option **14b**. Standalone asset: pure CSS, no images, no libraries, no build step.

The `+` is not drawn on the button — it is a hole in a dark glass shell with light behind it. That is the whole idea, and it's why the face has to stay near-black at the rim. Brighten the face and the effect dies.

## Files

| File | What it is |
| --- | --- |
| `fab.css` | The asset. Everything lives here. |
| `Fab.jsx` | React component — markup only, imports nothing but the CSS. |
| `fab.html` | Open in a browser: 2× for inspection, real size on a tab bar. Also the copy-paste markup reference. |
| `fab-reference.png` | Static reference render — 3× from `fab.html` in a browser. **Compare a build against this before shipping.** |

## Install

```jsx
import './fab.css';
import Fab from './Fab';

<Fab open={sheetOpen} onClick={() => setSheetOpen(v => !v)} />
```

Or paste the markup from `fab.html` — five nested spans inside a `<button>`. No JS is required for any of the visuals; the only script in the demo toggles `aria-expanded`.

## Geometry

| | |
| --- | --- |
| Size | 58 × 58 |
| Radius | 19px (squircle-ish — **not** a circle) |
| Lift above bar | `margin-top: -23px` — exact (§5.7) |
| Rim thickness | 1.5px (the `padding` on `.wr-fab__body`) |
| Glyph bars | 23 × 3.6, radius 2, pure `#FFFFFF` |
| Tap target | 58px — above the 44px minimum |

Sits in the centre slot of the 94px tab bar. **That slot is 70px wide and carries the label `NEW`** (mobile spec §5.7, locked design 19b) — it is not an empty gap. Lift is `margin-top: -23px` exactly: the FAB's lower edge lands 35px from the bar top and the label's baseline sits at 42px, matching the other four. Less lift and the FAB covers its own label. *(An earlier draft of this line said 56px, which predates 19b.)*

## Anatomy

```
.wr-fab            positioning + states
 ├─ __halo         breathing radial glow, 7s
 └─ __body         glass shell, #09080F, 1.5px padding = the rim
     ├─ __rim      conic gradient sweeping the rim, 16s
     └─ __face     the well: #5B3FA8 core → #07060C at the edge
         ├─ __core soft violet bloom behind the glyph
         └─ __bar  ×2, the emitted plus
```

## Motion

| | |
| --- | --- |
| Halo | opacity .42 → .72, scale 1 → 1.13, **7s** ease-in-out |
| Rim sweep | 360°, **16s** linear |
| Hover | body `translateY(-3px) scale(1.04)`, halo to full — 200ms spring |
| Press | body `scale(.95)` |
| Sheet open | both bars `rotate(45deg)` → reads as ✕. Driven by `aria-expanded="true"` |
| Focus | 3px `rgba(167,139,250,.55)` ring on `:focus-visible` |

7s is deliberate — it's the same beat as the homepage beacon's float, so the two marks breathe together. Keep it if you touch anything else.

`prefers-reduced-motion: reduce` stops both loops, holds the halo at .6 opacity, and collapses transitions. The gradients stay, so nothing looks broken.

## Rules

1. **Never add an outer `filter: drop-shadow` or extra `box-shadow`.** The glow is three layered shadows on the glyph plus the halo element. Adding more makes it muddy — the same rule as the app icon.
2. **Don't lighten `.wr-fab__face`.** The near-black rim is what makes the centre read as an aperture.
3. **Don't recolour the glyph.** It was violet-tinted in an earlier pass and read grey against the glass. Pure white.
4. **One FAB per screen.** It's the only non-text element allowed to glow (mobile spec §4.3).
5. **Desktop:** not used. The desktop control station has no tab bar; `⌘K` and per-panel action buttons do this job.

## Scaling

Everything is px so it can be scaled by wrapping in `transform: scale()` — used in `fab.html` for the 2× view. If you need a permanently larger FAB, multiply every value rather than scaling: `transform` blurs the 1.5px rim.

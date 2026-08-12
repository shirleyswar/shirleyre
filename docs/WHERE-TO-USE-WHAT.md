# WHERE TO USE WHAT

Two tiers of one mark. Find your situation below.

---

## THE ONE-LINE RULE

**120px or larger → glow star (`star-glow-*`). Smaller than 120px → geometric mark.** Then: dark background → `mark-*`; home screen or browser tab → `icon-*` / `apple-touch-icon` / `favicon-*`.

Everything below is that rule, spelled out.

---

## 0. The glow star — big surfaces only

**Files:** `star-glow-512.png` (default), `star-glow-256.png`, `star-glow-transparent-1024.png` (master)

| Where | File | Rendered size |
| --- | --- | --- |
| Splash / login screen | `star-glow-512.png` | 230px |
| PIN gate, above `WAR ROOM` | `star-glow-256.png` | 120–160px |
| Site hero, marketing, print | `star-glow-transparent-1024.png` | 200px+ |

**Never below 120px.** The spikes taper to sub-pixel filaments and there's a ring of loose particles around the star; under 120px they merge into a lavender smudge that reads lighter and blurrier than the geometric mark. Below 120px is what the geometric mark exists for — see §4.

Both marks are eight-point stars on a long vertical axis, so they read as one mark at two distances. Do not treat them as alternatives to pick between.

---

## 1. iPhone home screen (the PWA)

**File:** `apple-touch-icon-180.png`

Put it in your `public/` (or `static/`) folder and add this to the `<head>` of every page:

```html
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180.png">
```

iOS ignores the web manifest for home-screen icons — this tag is the only thing that works. If you skip it, iOS screenshots your page and uses that instead, which is why installed PWAs sometimes show a blurry mess.

**Do not round the corners yourself.** iOS applies its own squircle mask. The 78% inset in this file is sized for that mask.

---

## 2. Android / Chrome install, and the PWA manifest

**Files:** `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`

In `manifest.json`:

```json
"icons": [
  { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
  { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
  { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```

All three. They are not interchangeable:

- `192` — home screen and app switcher.
- `512` — install prompt and splash screen.
- `maskable-512` — Android crops icons to whatever shape the phone's launcher uses (circle, squircle, teardrop). The star sits at 60% here so nothing gets cut. **If you use `icon-512` for the maskable slot, the tips get sliced off.**

---

## 3. Browser tab

**Files:** `favicon-32.png`, `favicon-16.png`

```html
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
```

Both. Chrome takes the 32, older browsers and some bookmark bars take the 16.

These are the only files where I deliberately over-brightened the artwork. At 16px the star's spikes are thinner than one pixel and disappear entirely — so these two were composited two and three times over to survive the downscale. **Don't generate your own favicon by resizing `icon-512`. You'll get a purple smudge.**

---

## 4. Inside the app — PIN gate, rail, headers, anywhere on a dark surface

**Files:** `mark-256.png` (default), `mark-64.png` (small)

These are transparent. Use them anywhere the star sits on one of your own dark surfaces:

| Where | File | Rendered size |
| --- | --- | --- |
| Desktop left rail, top | `mark-64.png` | 30px |
| Mobile identity row | `mark-64.png` | 40px |
| Any in-app mark under 120px | `mark-64.png` / `mark-256.png` | ≤30px / 31–119px |

For the PIN gate and splash, use the **glow star** instead — both render at 120px+. See §0.

```jsx
<img src="/mark-256.png" alt="" width={74} height={74} />
```

Pick the file that is **at or above** your rendered size — never scale a small file up. At 30px use `mark-64`; at 74px use `mark-256`.

**Never put these two on a light background.** The artwork is a glow: its brightness *is* its shape. On white it turns into a pale smear (you saw this in the preview). If you ever need the star on light, ask me for a solid-fill version — it needs redrawing, not recolouring.

---

## 5. Anything bigger, or a new size you need later

**File:** `star-transparent-1024.png`

This is the master. Every other file was generated from it.

If you need a size that isn't here, resize **this** file — never the original `Iphone.png` upload, and never one of the small outputs. The original is stretched, off-centre and has a baked-in black box; all three problems are already fixed in the master.

`icon-1024.png` is the opaque equivalent, for app-store submissions and archiving.

---

## 6. shirleyre.com

**None of these.**

The public site keeps the gold building beacon (`assets/beacon-gold.svg`). The star is the War Room's mark — the private instrument. Two marks, two jobs. Mixing them makes both weaker.

---

## THREE THINGS THAT WILL BREAK IT

1. **Adding a CSS glow.** `filter: drop-shadow(...)` or `box-shadow` on top of these files doubles the glow that's already painted in and goes muddy. The light is in the pixels.
2. **`mix-blend-mode: screen`.** Only the *original* upload needs that, because of its black box. The `mark-*` files are already transparent — blending them again dims them.
3. **Using it on light.** See §4.
4. **Shrinking the glow star.** It is not a scalable logo below 120px. See §0.

---

## QUICK REFERENCE

| File | Background | Goes where |
| --- | --- | --- |
| `apple-touch-icon-180.png` | opaque | iOS home screen — `<link rel="apple-touch-icon">` |
| `icon-192.png` | opaque | manifest — Android home screen |
| `icon-512.png` | opaque | manifest — install prompt, splash |
| `icon-maskable-512.png` | opaque | manifest — `purpose: "maskable"` |
| `icon-1024.png` | opaque | app store, archive |
| `mark-256.png` | transparent | in-app, dark surfaces, 74–256px |
| `mark-64.png` | transparent | in-app, dark surfaces, ≤64px |
| `favicon-32.png` | transparent | browser tab |
| `favicon-16.png` | transparent | browser tab, small |
| `star-glow-transparent-1024.png` | transparent | glow master — regenerate ≥120px sizes from this |
| `star-glow-512.png` | transparent | splash / login, 230px |
| `star-glow-256.png` | transparent | PIN gate, 120–160px |
| `star-transparent-1024.png` | transparent | geometric master — regenerate <120px sizes from this |

Background colour on the opaque files is `#08080C`, matching the app's own surface, so an opaque icon never shows a seam.

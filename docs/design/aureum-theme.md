# The Aureum theme (16 Nov 2026)

Owner, 16 Nov 2026: "more noticeable aesthetic theme, something hella different … simplify the website and put it more
organised". One look for every page of Aureum Desk (the Desk, Macro desk, side pages, ChronosTrade, Academy, gold terminal,
Mosha desk, icons). It replaces the navy / blue dashboard look. Display only: no figure, rule, permission or data changes.

## Character

Black and gold, editorial luxury, calm. Serif titles, warm near-black surfaces, champagne gold only for the brand, the primary
action and the active place in the navigation; generous spacing; rounded cards with gold hairlines and soft depth; numbers in
tabular figures.

## 1. Tokens

Every page defines these custom properties (for each theme it has) and points its older variables at them, so old names keep
working.

| Token | Dark (default) | Light ("ivory and ink") | Midnight |
|---|---|---|---|
| `--au-bg` | `#0B0A08` | `#F6F1E6` | `#070B16` |
| `--au-surface` (cards) | `#14120E` | `#FFFCF5` | `#0E1424` |
| `--au-surface-2` (hover, raised, selected) | `#1C1914` | `#EFE7D6` | `#151C30` |
| `--au-well` (inputs, wells) | `#100E0B` | `#F9F5EC` | `#0B1120` |
| `--au-line` | `rgba(232,200,130,.12)` | `rgba(60,45,20,.12)` | as dark |
| `--au-line-strong` | `rgba(232,200,130,.24)` | `rgba(60,45,20,.22)` | as dark |
| `--au-ink` | `#F4EEE2` | `#1B160E` | `#EEF1F8` |
| `--au-ink-2` | `#BDB3A1` | `#554B3C` | `#AEB7CC` |
| `--au-ink-3` | `#958B7A` | `#6B6050` | `#8C96AD` |
| `--au-gold` (fills) | `#D4A84A` | `#86600F` | as dark |
| `--au-gold-grad` | `linear-gradient(135deg, #F2D589 0%, #D4A84A 48%, #A87A2A 100%)` | `linear-gradient(135deg, #A87A2A 0%, #86600F 100%)` | as dark |
| `--au-on-gold` (text on gold fills) | `#1A1305` | `#FFFFFF` | as dark |
| `--au-gold-ink` (gold as text) | `#E3BE6E` | `#7E5A12` | as dark |
| `--au-gain` | `#3FD69E` | `#0A7350` | as dark |
| `--au-loss` | `#FF7A70` | `#B3261E` | as dark |
| `--au-warn` | `#F2B544` | `#8A5A00` | as dark |
| `--au-info` | `#8FB3FF` | `#1F5BD6` | as dark |

Page background (dark): `radial-gradient(1100px 520px at 0% -10%, rgba(212,168,74,.10), transparent 60%),
radial-gradient(800px 480px at 100% 0%, rgba(168,122,42,.07), transparent 55%), #0B0A08` (light: the same with
`rgba(168,120,31,.08)`; midnight: the same over `#070B16`). Static, never animated.

Contrast, measured: every text token is at least 4.5:1 on `bg`, `surface` and `surface-2` of its theme (lowest: light
`ink-3` on `surface-2`, 5.0; light `gain` on `surface-2`, 4.77). A chip is text in its colour on a 14 % tint of that colour
over the surface (lowest 4.69:1, light gain). Text on gold fills: dark 8.3:1, light 5.7:1. Re-measure any other pairing.

Chart candle colours do not change (the owner chose them; the light theme's grey / black candles are pinned by a test).
Chart grid lines use `--au-line`, chart text `--au-ink-3`, chart backgrounds transparent or `--au-surface`.

## 2. Type

- `--au-font-display`: `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Noto Serif", serif`
  (system fonts, nothing to vendor). Page titles, hero sentences, first-level card titles, the wordmark. Never tables,
  numbers, buttons or small labels.
- `--au-font-ui`: `"Inter", "Figtree", system-ui, sans-serif` (both self-hosted already).
- Numbers: `font-variant-numeric: tabular-nums`; `"JetBrains Mono"` where columns of prices must align.
- Sizes 12 / 13 / 14 / 16 / 20 / 26 / 34 / 44 px; display sizes letter-spacing -0.01em, line-height 1.15; body 1.5.
- Wordmark: the coin mark, then `AUREUM` in the display serif, uppercase, letter-spacing .16em, then `DESK` in the UI font,
  weight 500, letter-spacing .24em, `--au-ink-2`.
- Coin mark: a disc filled with `--au-gold-grad`, a thin inner ring (`#1A1305` at 12 % opacity) and a serif capital "A"
  in `#1A1305`. In CSS (`.ms-coin`) and as `assets/aureum-mark.svg`; the app icons use the same mark on `#0B0A08`.

## 3. Shape, depth, controls

- Radii: 8 px small controls, 14 px cards, 20 px hero cards and dialogs, 999 px pills.
- Cards: `--au-surface`, 1 px `--au-line` border, shadow `inset 0 1px 0 rgba(255,236,190,.04), 0 12px 32px rgba(0,0,0,.35)`
  (light: `0 1px 2px rgba(60,45,20,.06), 0 8px 24px rgba(60,45,20,.08)`).
- Spacing steps 4 / 8 / 12 / 16 / 24 / 32 / 48; card padding 20-24 px on desktop, 16 px on phones; grid gaps 16-24 px.
- Backdrop blur only on a sticky top bar, never on large areas.
- Buttons: primary = `--au-gold-grad` fill, `--au-on-gold` text, weight 600, radius 10-12 px, at most one per view;
  secondary = transparent, 1 px `--au-line-strong` border, `--au-ink` text; quiet = text only in `--au-gold-ink`.
- Focus ring: 2 px solid `#F2D589` (light `#7E5A12`), 2 px offset.
- Navigation: active item `--au-surface-2` background plus a 2-3 px gold-gradient indicator; inactive items `--au-ink-2`.
- Motion: 150-200 ms ease-out on opacity / transform only; none under reduced motion (`transition-duration: 0s`).

## 4. Simple and organised (every page)

- One page-header pattern: a serif title, one plain sentence that says what the page is for or gives the current answer,
  then at most one primary action on the right.
- The answer first; details folded behind "More" or a disclosure. Fewer things visible at once. Where one screen shows the
  same number twice, keep one.
- Related controls grouped; filters at the top left of a card, actions at the top right, consistently.
- Plain labels in sentence case; no unexplained abbreviations in headings.
- Never remove a feature, a figure, data or a permission gate: fold it, move it or relabel it instead.

The accessibility floor of every page still holds: text 12 px or more, 44 px touch targets under `(pointer: coarse)`, AA
contrast in all three themes, no infinite animation, no sideways scroll at 360 / 390 / 430 px, visible focus.

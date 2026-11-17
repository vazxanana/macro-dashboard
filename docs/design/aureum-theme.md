# The Aureum Desk look: graphite (17 Nov 2026)

The owner, 17 Nov 2026, on the black-and-gold look of 16 Nov: "i didnt like the one u juat did, do another one with other
colors like grey". This replaces that spec. It is one look for every page of Aureum Desk (the Desk, Macro desk, side pages,
ChronosTrade, Academy, gold terminal, Mosha desk, icons). It changes how things look only: no figure, rule, permission or data
changes.

## Character

Graphite and silver: neutral greys, quiet and precise, like a good instrument. There are no warm tints and no gold surfaces.
Colour is kept for meaning: green for a gain, red for a loss, amber for a warning, and one cool steel-blue accent for focus, links
and the active place in the navigation. The primary action is a solid neutral button, light on dark and dark on light. Titles use
the same sans-serif as the rest of the page, set heavier and tighter, with no serif anywhere. Cards are flat with 1 px hairlines and
very little shadow, and numbers use tabular figures.

## 1. Tokens

Every page defines these custom properties, for each theme it has, and points its older variables at them so that old names
keep working. The prefix stays `--au-` so that work already done keeps its names.

| Token | Dark (default, "graphite") | Light ("paper grey") | Midnight |
|---|---|---|---|
| `--au-bg` | `#121315` | `#F2F3F5` | `#0B0C0E` |
| `--au-surface` (cards) | `#1A1C1F` | `#FFFFFF` | `#131416` |
| `--au-surface-2` (hover, raised, selected) | `#23262A` | `#E7E9EC` | `#1B1D20` |
| `--au-well` (inputs, wells) | `#16181B` | `#F7F8F9` | `#0F1012` |
| `--au-line` | `rgba(255,255,255,.08)` | `rgba(20,24,30,.10)` | as dark |
| `--au-line-strong` | `rgba(255,255,255,.16)` | `rgba(20,24,30,.20)` | as dark |
| `--au-ink` | `#ECEDEF` | `#17191C` | `#ECEDEF` |
| `--au-ink-2` | `#B4B8BF` | `#474C54` | `#B4B8BF` |
| `--au-ink-3` | `#8E939B` | `#5B616A` | `#8E939B` |
| `--au-accent` (focus, links, active nav) | `#9DB4D3` | `#2F5E9E` | as dark |
| `--au-primary` (primary button fill) | `#E4E6E9` | `#25292E` | as dark |
| `--au-on-primary` | `#121315` | `#FFFFFF` | as dark |
| `--au-gold` / `--au-gold-grad` / `--au-gold-ink` (old names) | point at `--au-primary` / `--au-primary` / `--au-accent` | same | same |
| `--au-on-gold` (old name) | points at `--au-on-primary` | same | same |
| `--au-gain` | `#4CC38A` | `#0A7350` | as dark |
| `--au-loss` | `#F2726A` | `#B3261E` | as dark |
| `--au-warn` | `#E8B04B` | `#8A5A00` | as dark |
| `--au-info` | `#9DB4D3` | `#2F5E9E` | as dark |

The page background is a flat `--au-bg`, with no glow or gradient. Midnight is a deeper graphite, not navy.

Contrast floor: every text token must be at least 4.5:1 on `bg`, `surface` and `surface-2` of its theme. The tightest pairs
are light `ink-3` on `surface-2` and dark `ink-3` on `surface-2`, so measure them when building and darken or lighten by one
step if a pair fails. A chip is text in its colour on a 14 % tint of that colour over the surface. Text on the primary fill is
at least 12:1 in both themes.

Chart candle colours do not change: the owner chose them, and a test pins the light theme's grey / black candles. Chart grid
lines use `--au-line`, chart text uses `--au-ink-3`, and chart backgrounds are transparent or `--au-surface`.

## 2. Type

- One family: `"Inter", "Figtree", system-ui, sans-serif`, both already self-hosted. It is used for titles too:
  - page titles weight 650, letter-spacing -0.02em;
  - card titles weight 600.
- Numbers use `font-variant-numeric: tabular-nums`, and `"JetBrains Mono"` where columns of prices must align.
- Sizes are 12 / 13 / 14 / 16 / 20 / 26 / 32 px; body line-height is 1.5.
- Wordmark: the mark, then `AUREUM` in weight 700 with letter-spacing .14em, then `DESK` in weight 500 with letter-spacing
  .22em in `--au-ink-2`.
- Mark: a rounded square (8 px radius on 28 px) filled `linear-gradient(135deg, #F4F5F7 0%, #B9BEC6 55%, #8A9099 100%)` (brushed
  silver), the same in every theme, with a capital "A" in `#16181B`, weight 700. It exists in CSS (`.ms-coin`) and as
  `assets/aureum-mark.svg`; the app icons use the same mark on `#121315`.

## 3. Shape, depth, controls

- Radii: 8 px for small controls, 12 px for cards, 16 px for the hero card and dialogs, 999 px for pills.
- Cards: `--au-surface` with a 1 px `--au-line` border and shadow `0 1px 2px rgba(0,0,0,.25)` (light: `0 1px 2px
  rgba(20,24,30,.06)`). Nothing heavier.
- Spacing steps are 4 / 8 / 12 / 16 / 24 / 32 / 48. Card padding is 20 px on desktop and 16 px on phones. Grid gaps are 16-20 px.
- Buttons:
  - Primary: `--au-primary` fill, `--au-on-primary` text, weight 600, radius 8 px, at most one per view.
  - Secondary: transparent, with a 1 px `--au-line-strong` border and `--au-ink` text.
  - Quiet: text only, in `--au-accent`.
- Focus ring: 2 px solid `--au-accent` with a 2 px offset.
- Navigation: the active item has a `--au-surface-2` background and a 2 px `--au-accent` indicator; inactive items use
  `--au-ink-2`.
- Motion: 120-180 ms ease-out, on opacity and transform only, and none under reduced motion (`transition-duration: 0s`).

## 4. Simple and organised (every page)

- One page-header pattern: a title, then one plain sentence that says what the page is for or gives the current answer, then at
  most one primary action on the right.
- Put the answer first and fold the details behind "More" or a disclosure, so fewer things are visible at once. Where one screen
  shows the same number twice, keep one.
- Group related controls: filters go at the top left of a card and actions at the top right, on every card.
- Labels are plain and in sentence case. Headings use no abbreviation that is not explained.
- Never remove a feature, a figure, data or a permission gate: fold it, move it or relabel it instead.

The accessibility floor of every page still holds:
- text is 12 px or more;
- touch targets are 44 px under `(pointer: coarse)`;
- contrast is AA in all three themes;
- no animation is infinite;
- nothing scrolls sideways at 360 / 390 / 430 px;
- focus is always visible.

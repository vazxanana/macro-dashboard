# The box-close-out fade, made to pay its costs: three candidates on unread data (result)

**Verdict: FAIL. No candidate clears its costs on both unread sets; the best, E1 (M15 box fade, 8+ round-trip stops, trailing exit), made +0.017R a trade after costs on D (n 3,085, t 0.74) and +0.043R on E (n 4,190, t 1.86).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first, commit eef3f17). Research only:
nothing live changed, nothing was placed. No candidate here is an edge.

## The question

`fade-breaks-holdout` found a real bounce after an M5 box close-out (+0.05R a trade before costs on three data sets) that the
costs eat. What was missing, and can the other strategies complement it so it pays after costs? The discovery step
(`discovery.json`, 6,096 cells, on data the fade was already read on: NOT evidence) gave three answers: trade the box one
timeframe up (M15, H4-H1-M15 chain), exit with a trailing stop, and keep only trades whose stop is at least 8 round trips wide,
adding either "the close-out is still inside the H4 box" (box-in-box) or "H1 is choppy" (efficiency ratio under 0.30, the
market-cycle reading). Three candidates were fixed and asked once, AFTER costs, on two sets no fade study had read:
set D = nzdusd, usdcad, usdchf, eurjpy, xag 2005-2009 and set E = the same markets 2020 to October 2026 (costs ASSUMED, not
measured, on these markets).

## The bar (after costs, month-sum t, Holm over 6 tests)

| Candidate | Set | n | Before costs (t) | After costs | month t | Holm p | At 2 x costs |
|---|---|---:|---:|---:|---:|---:|---:|
| E1: k 1, risk >= 8 round trips, inside the H4 box | D | 3,085 | +0.048 (2.13) | +0.017 | 0.74 | 1 | -0.015 |
| E1 | E | 4,190 | +0.091 (4.01) | +0.043 | 1.86 | 0.20 | -0.006 |
| E2: k 2, risk >= 8 round trips, choppy H1 | D | 9,636 | +0.022 (1.14) | +0.007 | 0.35 | 1 | -0.008 |
| E2 | E | 13,589 | +0.025 (1.71) | +0.002 | 0.13 | 1 | -0.021 |
| E3: k 2, no condition | D | 16,898 | +0.022 (1.29) | -0.005 | -0.32 | 1 | -0.033 |
| E3 | E | 24,727 | +0.020 (1.57) | -0.013 | -1.05 | 1 | -0.045 |

No test passes, so the verdict is FAIL. Cut test: 12 checks on two markets of each set, 0 missing, 0 extra.

## What it means

- **The fixes found in discovery are real in direction, too small in size.** Moving the fade from M5 to M15, trailing the
  exit and requiring a wide stop took it from about -0.05R a trade after costs (fade-breaks-holdout F1) to about +0.02R to
  +0.04R on fresh data (E1). The complements from the other strategies did their part: E1 (inside the H4 box) beat E3 (no
  condition) on both sets, before and after costs. But a positive mean with a month t of 0.74 and 1.86 is not distinguishable
  from zero, and at twice the cost every candidate loses: the margin over the cost is thin.
- **Per market it is mixed** (`result.json` `perMarket`): E1 on set E is positive on all five markets (+0.009R to +0.078R),
  on set D on one of five (usdcad +0.109R; the others -0.04R to 0).
- **The plain timeframe step does not pay alone** (E3 is negative after costs on both sets); the trailing exit and the wide
  stop matter, and the box condition adds a little.

## What would be needed (not done here)

E1 is the only form worth carrying further, and only as a hypothesis: about 600 trades a year across five markets, so a month
t of 2 at +0.04R after costs needs several more years of data, or a forward record. The costs on these markets are assumed: a
measured spread (the tick probe) could move the after-cost figure either way. Any next test needs its own pre-registration on
data not yet used, for example the five read markets with a forward record from today, and must not tune E1's conditions
again on sets D or E. Never call E1 an edge: n and t are above.

Files: `discover.mjs` (rows: every faded box close-out with its features and results), `analyze.mjs` (the discovery grid),
`discovery.json`, `report.mjs` (the bar and the cut test), `result.json`; test `tests/fade-box-edge.test.mjs`. To repeat:
`EDGE_DATA=<cache> node discover.mjs <gate|A|B|C|D|E> <m> <dir>` for each set's markets, `node analyze.mjs <dir>`, then
`node report.mjs cut <set> <m>` (collected into `<dir>/cut.json`) and `node report.mjs <dir>`.

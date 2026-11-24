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

## After the result: a tighter stop or a better entry? (24 Nov 2026, owner's question; exploration, not a test)

`explore-entry.mjs` ran E1's signals (risk at least 8 round trips, close-out inside the H4 box) under tighter stops and other
entries, on every set already read (2010-14, 2015-19, A, B, C, D, E; set F was not run because nothing beat E1). After costs,
trailing exit, R a trade:

| Variant | 2010-14 | 2015-19 | A | B | C | D | E |
|---|---:|---:|---:|---:|---:|---:|---:|
| E1 as tested (market at the next open, stop at the box) | +0.075 | +0.012 | +0.046 | +0.021 | +0.024 | +0.018 | +0.044 |
| Stop at 0.75 x the distance | +0.051 | -0.035 | +0.029 | -0.007 | +0.022 | -0.001 | +0.009 |
| Stop at 0.5 x the distance | +0.017 | -0.066 | +0.005 | -0.043 | -0.045 | -0.013 | -0.035 |
| Limit 0.25 x the distance further out (better price) | +0.016 | -0.074 | +0.001 | -0.079 | -0.026 | -0.032 | -0.062 |
| Limit 0.5 x the distance further out | -0.089 | -0.168 | -0.083 | -0.128 | -0.106 | -0.079 | -0.107 |
| Wait for an M15 close back inside the box | -0.050 | -0.039 | -0.020 | -0.141 | -0.105 | -0.018 | -0.127 |

- **A tighter stop is worse in every window.** The bounce is a fixed amount of price and so is the cost; a smaller stop
  makes the cost a bigger share of each trade (0.5 x the stop roughly doubles it) and stops out more trades in the noise.
- **A better price is worse.** A limit further out fills only when the break keeps going (about 60 % fill at 0.25 x, 40 % at
  0.5 x), and those are the trades where the bounce did not come: before costs E1's +0.092R on set E falls to +0.006R at
  0.25 x and to 0.000R at 0.5 x. Adverse selection, the same lesson as the limit entries of the earlier grids.
- **Waiting for confirmation is worse.** By the time an M15 candle closes back inside the box, the bounce has mostly happened.
- So the entry E1 already uses (market at the first open after the close-out, stop at the box) is the best of these. What
  limits E1 is the size of the bounce relative to the cost, not the stop or the entry.

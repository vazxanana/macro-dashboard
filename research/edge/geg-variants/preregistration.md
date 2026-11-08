# Gold daily engulf: entry-side variants — pre-registration

Written and committed **before** any variant was run on any window. The rules below decide the verdicts; nothing in them changes after the numbers are seen. Anything added later is labelled as a post-hoc diagnostic in `RESULT.md`. Paper research only: no live rule, config, trader, replay or site code is touched.

## Question

Gold daily engulf (`geg`, live in `council/trader.mjs`, `config.goldEG = { k: 3, life: 20, hold: 240, sma: 20, pad: 0.3, maxOpen: 3 }`) is one of three council systems with a positive honest out-of-sample edge: 2006–17 +0.19R a position, t 1.9, n 256, worst drawdown −15.2R (#530, `research/edge/gold-systems-oos`). Its H2 2012–17 is close to zero (+0.06R). Can the **entry side** be improved robustly? The exit side (10R target, trail 1R behind from +2R, 240 h hold, stop 0.3 under the zone) is **not** in scope and stays the live one in every variant.

Already tested, not repeated here: the 20-day-average gate against no gate (in-sample neutral, `gold-systems`); confirmation window k 1–5, zone life, hold and trails on 2023–26 (the approval, "robust to"); the weekend / Friday-close handling (`gold-weekend`: adopt-but-within-noise for `geg`); sells on 2023–26 (the approval: "sells lose everywhere" in sample, never tested out of sample).

## Baseline: the live rule, as live (not the `gold-weekend` intended rule)

The live block, replicated line for line as #530's `replay.mjs` does (its `geg` block is reused; the trend legs and the trendline are dropped):

- Daily candles are OANDA UTC buckets with the Sunday stub, the forming candle dropped. `last` = the latest closed daily candle.
- Filter: `last.close` > the 20-day simple average of closes (the 20 closed candles ending with `last`).
- Base candle: `last` is green, and the nearest **red** candle among the 3 closed candles before it (green and doji candles are skipped, as the live loop does) has `last.close > base.high`. The zone is `[base.low, base.high]`.
- Order: a resting buy at `base.high`, stop `base.low − 0.3`, placed only while the price is above the entry, within 24 h of the day's UTC end, at most 3 engulf orders open or pending, one order per base candle. Valid 20 days; cancelled by a daily close under `base.low`.
- Exit: target entry + 10R, after +2R the stop trails 1R behind the best price, out 240 h after the fill.

Harness (#530's): one run 4 minutes after every M5 close; 719 closed candles a window; a limit fills on the first M5 candle that touches it (fill and target in one candle = missed); management on M5 candles in the live order with `stopFill`, `exitR`, `fillBarAmbiguous`, `spotSkip` from `council/fills.mjs`; a market entry is the close of the M5 candle the run falls in; positions open at the end of the data are marked at the last close (2018–26 only).

**Calibration gate, before any variant number is read:** the baseline must reproduce #530's committed `result.json` for `geg` under #530's cost model ($0.30 flat a round trip): n 256, +0.186R, +47.58R, t 1.89, max DD −15.17 on 2006–17; H1 137 / +0.292; H2 119 / +0.064; 2018–26 195 / +0.277 / +54.0. If it does not, the study stops and reports why.

## Variants (11, each ONE change to the baseline; no combinations)

The grid is a star around the live rule, not a factorial. Nothing is chosen from it: every variant is judged against the same pre-registered bar, and whatever passes is a proposal for the owner.

| # | id | Dimension | Change (everything else as live) |
|---|---|---|---|
| 1 | `ma10` | average length | the filter uses the 10-day average |
| 2 | `ma50` | average length | the filter uses the 50-day average |
| 3 | `ma20rise` | filter type | the filter is "the 20-day average is rising": SMA20 ending at `last` > SMA20 ending at the candle before; no close-above test |
| 4 | `zoneLow` | zone candle | among the red candles in the same 3-candle lookback, the base is the one with the **lowest close** (the deepest pullback candle), not the nearest; the signal still requires `last.close > base.high` |
| 5 | `mkt` | entry | entry at market at the first run after the daily close (the close of the M5 candle that run falls in, as the trend legs enter) instead of a resting buy at the zone top; stop unchanged (`base.low − 0.3`), so R is measured from the market entry; no "price above entry" test, no life, no zone-failed cancel |
| 6 | `half` | entry | the resting buy waits at **50% of the zone**, `(base.high + base.low) / 2`; stop unchanged |
| 7 | `life1` | order life | the resting buy is valid 1 day |
| 8 | `life3` | order life | valid 3 days |
| 9 | `life5` | order life | valid 5 days |
| 10 | `depth1` | minimum pullback depth | the signal also requires (highest high of the 10 closed daily candles ending with the base candle) − `base.low` ≥ 1 × ATR(14) of the daily candles ending with `last` (the trend legs' `atr14`) |
| 11 | `sell` | mirror (separate hypothesis) | the same rule for sells: `last` is red and closes below the **low** of the nearest green candle among the 3 before it while `last.close` is below the 20-day average; resting sell at `base.low`, stop `base.high + 0.3`, placed while the price is below the entry; cancelled by a daily close above `base.high`; target −10R, trail 1R behind from +2R, 240 h hold, 20-day life, at most 3 open or pending, in its own book |

Each variant runs in its own book (its own 3-order cap and ids); variants do not interact with each other or with the baseline.

## Data and windows

- OANDA XAU/USD mid candles through the site's free `/md/bars` proxy (#530's `fetch.mjs`, M5 / H4 / D1 from 2006-03-20 to 2026-11-06), kept out of git.
- **2006–17, untouched for this question**: positions entered (filled) 2006-07-01 to 2017-12-31. Halves fixed as in #530: **H1** 2006-07 to 2011-12, **H2** 2012-01 to 2017-12. No entry-side variant of `geg` has ever been run on these years.
- **2018–26, confirmation**: positions filled 2018-01-01 to 2026-11-06, the period the live rule was built on. It confirms or refutes; it never chooses.

## Costs

The Trader's own paper cost model (`council/fills.mjs` `tradeCost`): one spread of **$0.30** a round trip, plus **half a spread ($0.15) of slippage on every market order** — a market entry, and any exit that is not the 10R target (stop, trailing stop, time exit). A resting-limit entry and a target exit pay no slippage. Charged in R as cost / r0 per position.

- **x1**: as above. **x2**: every component doubled ($0.60 + $0.30 a market order).
- For the baseline x1 is therefore $0.45 on almost every position (limit entry, stop / trail / time exit), a little more than #530's flat $0.30; `mkt` pays $0.60. The calibration gate alone uses #530's flat $0.30 so that the figures can be matched exactly.

## Statistics

For every variant and the baseline, on 2006–17, H1, H2 and 2018–26, at x1, x2 and gross: n, win%, mean net R a position, total net R, t (mean / sd × √n), worst drawdown of the closed-position equity curve (ordered by close), and **return / drawdown = total net R ÷ |worst drawdown|**. Years table 2006–26 at x1. Paired diagnostic: the month-by-month difference in net R (x1, by close month) between the variant and the baseline, with its t and a 10,000-resample month bootstrap, on each window.

A position = one filled order; expired, missed and cancelled orders are not positions. Positions are dated by fill.

## Pass bar (fixed in advance)

A long variant (1–10) **BEATS** the live rule only if **all** of these hold, at **both** x1 and x2:

1. 2006–17: return / drawdown higher than the baseline's.
2. 2006–17: total net R higher than the baseline's (it must make more, not only lose less).
3. H1 2006–11: total net R higher than the baseline's.
4. H2 2012–17: total net R higher than the baseline's.
5. Confirmation, 2018–26: return / drawdown **and** total net R higher than the baseline's.

Tests 1–4 are the untouched-window test; test 5 is read only for variants that pass 1–4 (it confirms, it does not choose). A variant that fails any test is **NOT BETTER**. No variant is combined with another, whatever the result.

The mirror (`sell`) is a separate hypothesis with its own bar, since there is no live sell rule to beat. It **PASSES** only if, at both x1 and x2: 2006–17 mean net R a position > 0 with t ≥ 2.0, both halves' mean > 0, and 2018–26 mean > 0. Otherwise it **FAILS** (mean ≤ 0 on 2006–17) or is **NOT ROBUST** (positive but short of the bar), with the tests it missed named.

**Multiplicity.** Ten long variants are tested against one baseline, so about one spurious 2006–17 pass is to be expected at a 10% false-positive rate. The confirmation window and the paired monthly bootstrap are reported for that reason; a pass whose paired difference has |t| < 1 on both windows is reported as "passes the bar, within noise", exactly as `gold-weekend` did.

## What the verdicts feed

A written proposal for the owner at most. No live rule, config, shadow or site code changes in this study. Deliverables: `preregistration.md` (this file), `run.mjs`, `RESULT.md` (one-line `Verdict:` at the top and the key table), `result.json`.

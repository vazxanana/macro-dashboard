# Does silver rise after a large Nikkei 225 down day? Replication of gold-nikkei-drop on silver. Pre-registration

Written and committed **before** any return below was computed (14 Nov 2026). Only event COUNTS were read before writing
(`node run.mjs count <dir>`, which reads no price change after a signal); the data, the market, the signal, the trade, the
costs, the statistics and the pass bar are fixed here. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only: a stand-alone rule on silver (XAG/USD). It is not a gate, filter, size step, entry or exit for any live
system, and nothing live reads it. No live rule, size, filter, stop, config, cost constant or council member changes, whatever
the outcome.

## Why

`gold-nikkei-drop` (branch, 14 Nov 2026, FAIL 0 of 3) was a near miss on gold: buying gold after a Nikkei 225 day in the
worst 10 % of its past 250 days and holding 5 candles made +0.099R a trade over the same-year any-day buy in 2017-26
(n 179, month t 1.80, Holm p 0.108), +0.079R in 2007-16, still positive at twice the costs, above 40 of 40 placebos, with no
dose response (the worst-5 % test showed nothing). That study could not be confirmed on the same gold years again. This study
asks whether the SAME rule, unchanged, shows on a market it was not found on: silver, the other precious metal with a haven
component (and a larger industrial one, which could make it fall rather than rise on an Asian risk-off day). A replication,
not a search: no threshold, hold, stop or measure is changed.

## Dedupe (read before writing this)

- `gold-nikkei-drop` (the rule replicated here; gold only, no silver trade).
- `silver-rates-shrug`, `silver-vol-breakout`, `gold-drd-silver`, `study-drd-silver` and the `gold-silver-*` branches: silver
  after bond-yield jumps, after volatility breakouts, the daily-rejection long, and gold / silver relative rules. None buys
  silver on a Nikkei down day.
- No study in `research/edge/`, on a remote branch or in the scratch topics list reads a `jp225` down day for a silver trade.

## Data and markets (named before any result)

- council-data `research/daily/xag.json` (traded, OANDA `XAG_USD`) and `jp225.json` (Japan 225 CFD, OANDA `JP225_USD`), OANDA
  mid daily candles, UTC days, read with `git show origin/council-data:…` at commit `ebbe3e26a` (no network; a newer council-data
  commit than the gold study's `d5a081937`, the weekly cache only adds days). Saturday / Sunday candles folded into the next
  weekday with `council/fills.mjs` `foldWeekend`. No other market is read. Silver starts March 2006 on OANDA.
- Candle caches are kept outside git (`node run.mjs fetch <dir>`), deleted after the run.

## The rule (gold-nikkei-drop's, unchanged except the traded market and its cost)

- **Nikkei return** of candle day D: `ln(close_D / close of the previous jp225 candle)`, known at the UTC close of D.
- **Drop day**: D is also a silver candle day and its return is at or below the q-quantile (sorted value at index
  floor(q x 249)) of the 250 jp225 returns BEFORE D (D itself not included).
- **Trade**: buy silver at the open of the first silver candle after D. Stop = entry - 2 x ATR(20), the ATR of the 20 silver
  candles before the entry candle. Every trade has this stop. Exit at the close of the H-th candle (the entry candle is the
  first), or at the stop (a candle opening through the stop exits at its open, else a low at or under the stop exits at the
  stop). No target, no break-even, no trail. One trade at a time: a signal while a trade is open is skipped.
- **Costs**: **$0.03 a round trip in price**, the silver cost `gold-drd-silver` used (the ICT lab's silver round trip; it is
  larger than gold's $0.60 scaled by the price ratio, about $0.0075, so it is the conservative choice). **Financing: none.**
  `council/fills.mjs` has no silver rate (`FIN` holds `xau` only), so silver buys are charged no overnight financing in any
  tested figure. Said plainly: this flatters every net figure by the unmeasured carry. As a reported sensitivity only (not a
  test), each window is also given with gold's measured long rate (`FIN.xau.long`, 0.000148 of price a rollover) charged per
  `nights` on silver. Twice the costs (twice the $0.03, financing still none) is also reported.
  R = (exit - entry - costs) / (entry - stop).
- **Baseline**: the same buy (same stop, hold, costs) after EVERY eligible day, drop days included, each its own trade
  (overlap allowed). Excess of a signal trade = its net R - the baseline's mean net R over the eligible days of the SAME
  calendar year (silver's yearly drift removed).

## Tests (three, Holm over the three)

| Test | q (quantile) | H (candles held) | judged on | events counted before writing (non-overlapping, IS / OOS / pooled) |
|---|---|---|---|---|
| T1 (primary) | 0.10 | 5 | 2017-26 | 156 / 170 / 326 |
| T2 | 0.10 | 5 | 2007-26 pooled | (the T1 rule) 326 |
| T3 | 0.15 | 10 | 2017-26 | 151 / 156 / 306 |

T1 is the gold study's primary rule on silver. T2 is the same rule on the whole 2007-26 window. T3 is the gold study's own
pre-registered variant T3 (worst 15 %, 10 candles), chosen here before any silver return was read; the gold study's T2 (worst 5 %,
3 candles) is not re-tested. Every window has at least 100 events, so every test is run as a test.

## Windows

Signal days: in sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31; pooled 2007-01-01 to 2026-10-31.

## Statistics and pass bar

- t on calendar-month sums of the excess (months by exit stamp, empty months 0). One-sided p, normal approximation, Holm over
  the three tests, each on its judged window.
- **Placebo**: 40 seeded draws (mulberry32, seeds 1-40) of as many random eligible days as there are drop days in the judged
  window, run through the same one-at-a-time simulation; the real month t is ranked against them.
- A test **passes** only if all hold on its judged window: excess month t >= 2 and Holm p <= 0.05; in-sample (2007-16) excess
  > 0; net R a trade > 0; excess still > 0 at twice the costs; above at least 38 of the 40 placebos.
- **Verdict**: PASS if T1 passes; "LEAD" if only T2 or T3 passes; FAIL otherwise. A pass would be a replication of a gold near
  miss on a second market, still a lead for a forward record, never a live rule without the owner.

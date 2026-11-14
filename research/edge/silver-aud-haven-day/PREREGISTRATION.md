# Pre-registration: silver after a "haven day" in Australian-dollar terms (14 Nov 2026)

Written and pushed alone, before any trade result of this rule on silver was computed. Only the number of haven days was
counted (below); no return, R or t of silver after them was looked at. Paper research only, a **stand-alone rule on silver
(XAG/USD)**: not a gate, entry, exit or size of the live gold book, and none of that book's positions is read
(docs/owner-decisions.md item 44). Nothing live changes; no proposal follows from any result without its own owner decision.

## Why this study

`research/edge/gold-aud-haven-day` (14 Nov 2026, FAIL 0 of 3) bought gold after a day gold rose >= 0.5 sd while AUD/USD fell
>= 0.5 sd. Out of sample (2017 to Oct 2026) its primary test made +0.065R a trade net (n 103, month t 0.95), excess −0.019R
over the year's every-day buy; it was not a near miss. This study asks whether the same rule, unchanged, says anything on silver,
the closest market it was not built on (a precious metal that also moves with the commodity / dollar trade). Only the market
whose day is read and traded, and its cost, change. No threshold, window, hold, stop or measure is re-tuned.

## Data (named before any result)

- council-data `research/daily/xag.json` (signal and traded) and `research/daily/audusd.json` (signal only), OANDA mid daily
  candles, UTC days, at council-data commit `001494dd`; weekends folded into Monday with `council/fills.mjs` `foldWeekend`;
  silver and AUD/USD matched on the UTC day. Market set: silver and AUD/USD only; silver is the only market traded. Candles
  copied with `git show` into a directory outside git and deleted after the run.

## Signal (gold-aud-haven-day's, with silver in gold's place)

On each matched day i (closes only, nothing after day i's close):
- rs = ln(silver close i / silver close i-1), ra = ln(AUD/USD close i / AUD/USD close i-1);
- ss, sa = sample sd of the 60 matched daily log returns BEFORE day i (i-60 .. i-1) of silver and AUD/USD;
- **haven day** when rs >= z_s x ss AND ra <= -z_a x sa. A gap of more than 5 calendar days restarts the 60-day history.

## Event counts (counted before writing this; signal days only)

| Haven day | 2007-16 | 2017 to Oct 2026 |
|---|---|---|
| z_s 0.5, z_a 0.5 (T1, T2) | 86 | 103 |
| z_s 1.0, z_a 0.5 (T3) | 37 | 49 |

The desk's minimum is 100 events in each window. **No test reaches it in sample** (T1 / T2 have 86, T3 has 37 and 49). So all
three tests are run and reported as fixed below, but the pass bar adds "at least 100 haven days in each window", which none
meets: **the verdict cannot be PASS or PARTIAL and every figure is descriptive only.** The study is still run, as pre-registered,
because a replication that came out clearly negative (or clearly positive) is information about the gold rule; it can never be
read as an edge.

## Trade (gold-aud-haven-day's, on silver)

- Buy XAG/USD at the open of the first silver candle after the haven day. Long only.
- Stop k x ATR(20) below the entry (ATR of the 20 silver candles before the entry candle) = 1R. A candle opening through the stop
  fills at its open, else a low through the stop fills at the stop. Otherwise out at the close of the hold-th candle (entry
  candle = candle 1). One position at a time per test.
- Costs: **$0.06 a round trip** (silver's cost as `research/edge/silver-rates-shrug` set it: $0.03 spread, scaled from gold by
  `gold-drd-silver`, plus $0.015 slippage on each market order; the same structure as gold's $0.60). Also reported at 2x costs.
- **Financing: none.** `council/fills.mjs` `FIN` holds a gold long rate only; no silver financing rate is measured anywhere in
  the repository, so silver buys are charged no overnight financing. This flatters the 5- and 10-candle holds; said plainly in
  the result.

## Tests (three, Holm over all three)

| Test | Haven day | Hold | Stop |
|---|---|---|---|
| T1 (primary) | z_s 0.5, z_a 0.5 | 5 candles | 2 x ATR(20) |
| T2 | z_s 0.5, z_a 0.5 | 10 candles | 3 x ATR(20) |
| T3 | z_s 1.0, z_a 0.5 | 5 candles | 2 x ATR(20) |

## Baseline, windows, statistics (unchanged from the gold study)

- Baseline: the same buy (same hold, stop, costs) after EVERY matched day of the same calendar year (overlapping); excess = a
  trade's net R minus that year's baseline mean; reported per window with its own month-sum t.
- In sample: signal days 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.
- t on calendar-month sums of net R (month of exit; empty months 0). One-sided normal p of the OOS month t, Holm over T1-T3.
- Placebo: 40 seeded draws (mulberry32, seeds 1-40) of as many random matched OOS days as the test has signal days, traded the
  same way; reported as how many of the 40 the real OOS month t beats.
- Control (reported only; the gold study had none): AUD/USD's daily returns shuffled among the matched days of each calendar
  year (seeds 1001-1040), silver's own returns and both 60-day sds kept real, haven days taken again on OOS days and traded the
  same way. It asks whether the AUD/USD leg adds anything beyond "silver had an up day". Reported as how many of the 40 the real
  OOS month t beats.

## Pass bar (per test; the verdict is about T1)

All of: OOS month t of net R >= 2 and Holm p < 0.05; in-sample net R a trade > 0; OOS net R > 0 at 2x costs; OOS excess over the
year's baseline > 0; the real OOS t beats at least 38 of the 40 placebos; OOS n >= 30; **and at least 100 haven days in each
window** (not met by any test, see the counts). PASS = T1 passes; PARTIAL = only T2 or T3 passes; FAIL = none. No other
threshold, hold, stop or market is tried after the result.

## Files

`run.mjs` (`fetch <dir>`, `count <dir>`, `full <dir>`), `RESULT.md`, `result.json`, `tests/silver-aud-haven-day.test.mjs`.

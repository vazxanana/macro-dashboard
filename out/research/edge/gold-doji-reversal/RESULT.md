# The doji after a stretched move, faded, on spot gold daily: result (2026-11-14)

**Verdict: FAIL, 0 of 3: the gold doji fade made +0.023R a trade net out of sample (n 117, month t +0.22), +0.090R over the every-day trade (t +0.89); in sample −0.072R.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed; sha256 in `result.json`). A new stand-alone
daily rule, not a gate, exit, entry or size of the gold book (docs/owner-decisions.md item 44); nothing of that book was read.
Paper research only: nothing live changed and no proposal is written. This page is written by `run.mjs` from `result.json`.

## Rule (as pre-registered)

- Council-data OANDA mid XAU/USD daily candles (UTC days), weekend candles folded into the next weekday (`foldWeekend`), ATR(20).
- Day i is a doji: |close − open| <= 0.1 x (high − low). Stretch m = (close i − close i−5) / ATR(20) of day i−1; m >= 1 → sell, m <= −1 → buy.
- Entry at the open of day i+1, **stop 1 ATR(20) away on every trade**, out at the close of day i+3; an open beyond the stop exits at
  the open, a range reaching it exits at the stop. One position at a time.
- Costs: $0.60 a round trip (2x = $1.20); financing on buys = nights x FIN.xau.long (0.000148) x entry.
- T2 control: the same-side trade (same stop, hold, costs) entered at the open of EVERY eligible day of the trade's calendar year;
  T3 control: only the days after a same-side stretch that was not a doji. Excess = the trade's net R minus the control mean.
- In sample 2007-01-01 to 2016-12-31, out of sample (decisive) 2017-01-01 to 2026-10-31 by entry date; t on calendar-month sums
  (every month, 0 when nothing closed); Holm over the three out-of-sample one-sided p values; placebo = 40 seeds (T1).

Data: council-data research/daily/xau.json (OANDA mid XAU_USD daily, UTC days, weekend folded), 2006-03-20 to 2026-11-13 (5369 weekdays).

## Results

| Test | Window | n (buys / sells) | Gross R | Measure | Value | At 2x costs | Win % | Stops | Total | Worst DD | Month t | Month t gross | Median risk $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | IS 2007-16 | 137 (61 / 76) | −0.024 | net R | −0.072 | −0.119 | 41.61 | 52 | −9.85 | −20.03 | −0.84 | −0.28 | 18.36 |
| T1 | OOS 2017-26 | 117 (49 / 68) | +0.067 | net R | +0.023 | −0.021 | 41.88 | 43 | +2.70 | −9.38 | +0.22 | +0.65 | 24.03 |
| T2 | IS 2007-16 | 137 (61 / 76) | −0.024 | excess R | −0.015 | −0.015 | 41.61 | 52 | −2.11 | −15.52 | −0.18 | −0.28 | 18.36 |
| T2 | OOS 2017-26 | 117 (49 / 68) | +0.067 | excess R | +0.090 | +0.089 | 41.88 | 43 | +10.50 | −8.92 | +0.89 | +0.65 | 24.03 |
| T3 | IS 2007-16 | 137 (61 / 76) | −0.024 | excess R | +0.009 | +0.010 | 41.61 | 52 | +1.29 | −11.31 | +0.11 | −0.28 | 18.36 |
| T3 | OOS 2017-26 | 117 (49 / 68) | +0.067 | excess R | +0.103 | +0.102 | 41.88 | 43 | +12.00 | −10.26 | +0.98 | +0.65 | 24.03 |

Tests: T1 doji fade, both sides, net R (primary); T2 doji fade minus the same-side trade on every day of its year (primary); T3 doji fade minus the same-side trade after the same stretch without a doji (secondary).

Control means (net R a trade): T2 every day IS −0.056, OOS −0.067; T3 stretch without a doji IS −0.081, OOS −0.080.

## The checks

| Test | OOS value > 0 | OOS t ≥ 2 | Holm p ≤ 0.05 | IS value > 0 | OOS at 2x > 0 | Beats ≥ 38 of 40 placebos | OOS n ≥ 30 | Pass |
|---|---|---|---|---|---|---|---|---|
| T1 | yes | no | no (0.4906) | no | no | no | yes | no |
| T2 | yes | no | no (0.4906) | no | yes | n/a | yes | no |
| T3 | yes | no | no (0.4906) | yes | yes | n/a | yes | no |

## Placebo (out of sample, 40 seeds, T1)

Each OOS trade is replaced by the trade of a random eligible day of the same year (same side, stop, hold, costs).

| Real net R a trade | Seeds beaten | Placebo median | Placebo 95th pct | Placebo min / max |
|---|---|---|---|---|
| +0.023 | 33 of 40 | −0.094 | +0.096 | −0.350 / +0.156 |

## Setups (reported)

Dojis 600; dojis after a stretch 295 (buy 127, sell 168); traded one at a time 260.

## Reading

- T1: in sample −0.072R a trade net (n 137, t −0.84), out of sample +0.023R (n 117, t +0.22), −0.021R at twice the costs; costs +0.029R and financing +0.016R a trade out of sample; placebo beaten 33 of 40.
- T2 (the signal against gold's own drift): −0.015R in sample (t −0.18), +0.090R out of sample (t +0.89).
- T3 (the doji against the same stretch without one): +0.009R in sample (t +0.11), +0.103R out of sample (t +0.98).
- Not an edge: nothing is proposed and nothing live changes. Do not re-fit the body share, stretch, stop or hold on these results.

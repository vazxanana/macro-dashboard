# Elder's ray pullback in the 13-day EMA trend, on spot gold daily: result (2026-11-14)

**Verdict: FAIL, 0 of 3: the gold Elder ray pullback made −0.082R a trade net out of sample (n 330, month t −1.55), −0.059R over the every-day trade (t −1.13); in sample −0.003R.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed; sha256 in `result.json`). A new stand-alone
daily rule, not a gate, exit, entry or size of the gold book (docs/owner-decisions.md item 44); nothing of that book was read.
Paper research only: nothing live changed and no proposal is written. This page is written by `run.mjs` from `result.json`.

## Rule (as pre-registered)

- Council-data OANDA mid XAU/USD daily candles (UTC days), weekend candles folded into the next weekday (`foldWeekend`), ATR(20).
- Buy at the close of day i when EMA13(close) is rising, low − EMA < 0 and higher than the day before; sell when EMA13 is falling,
  high − EMA > 0 and lower than the day before (Elder's bear / bull power).
- Entry at the open of day i+1, **stop 1 ATR(20) away on every trade**, out at the close of day i+3; an open beyond the stop exits at
  the open, a range reaching it exits at the stop. One position at a time.
- Costs: $0.60 a round trip (2x = $1.20); financing on buys = nights x FIN.xau.long (0.000148) x entry.
- T2 control: the same-side trade (same stop, hold, costs) entered at the open of EVERY eligible day of the trade's calendar year;
  T3 control: only the days after a day of the same-side EMA13 slope that was not a setup. Excess = the trade's net R minus the control mean.
- In sample 2007-01-01 to 2016-12-31, out of sample (decisive) 2017-01-01 to 2026-10-31 by entry date; t on calendar-month sums
  (every month, 0 when nothing closed); Holm over the three out-of-sample one-sided p values; placebo = 40 seeds (T1).

Data: council-data research/daily/xau.json (OANDA mid XAU_USD daily, UTC days, weekend folded), 2006-03-20 to 2026-11-13 (5369 weekdays).

## Results

| Test | Window | n (buys / sells) | Gross R | Measure | Value | At 2x costs | Win % | Stops | Total | Worst DD | Month t | Month t gross | Median risk $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | IS 2007-16 | 333 (157 / 176) | +0.044 | net R | −0.003 | −0.050 | 45.95 | 110 | −1.04 | −16.02 | 0.00 | +0.88 | 19.29 |
| T1 | OOS 2017-26 | 330 (160 / 170) | −0.036 | net R | −0.082 | −0.129 | 43.64 | 113 | −27.21 | −35.16 | −1.55 | −0.69 | 24.29 |
| T2 | IS 2007-16 | 333 (157 / 176) | +0.044 | excess R | +0.028 | +0.028 | 45.95 | 110 | +9.18 | −14.14 | +0.59 | +0.88 | 19.29 |
| T2 | OOS 2017-26 | 330 (160 / 170) | −0.036 | excess R | −0.059 | −0.059 | 43.64 | 113 | −19.47 | −28.13 | −1.13 | −0.69 | 24.29 |
| T3 | IS 2007-16 | 333 (157 / 176) | +0.044 | excess R | +0.010 | +0.010 | 45.95 | 110 | +3.18 | −21.93 | +0.23 | +0.88 | 19.29 |
| T3 | OOS 2017-26 | 330 (160 / 170) | −0.036 | excess R | −0.063 | −0.063 | 43.64 | 113 | −20.91 | −27.10 | −1.16 | −0.69 | 24.29 |

Tests: T1 Elder ray pullback, both sides, net R (primary); T2 Elder ray minus the same-side trade on every day of its year (primary); T3 Elder ray minus the same-side trade on any day of the same EMA13 slope (secondary).

Control means (net R a trade): T2 every day IS −0.031, OOS −0.023; T3 same EMA13 slope IS −0.013, OOS −0.019.

## The checks

| Test | OOS value > 0 | OOS t ≥ 2 | Holm p ≤ 0.05 | IS value > 0 | OOS at 2x > 0 | Beats ≥ 38 of 40 placebos | OOS n ≥ 30 | Pass |
|---|---|---|---|---|---|---|---|---|
| T1 | no | no | no (1) | no | no | no | yes | no |
| T2 | no | no | no (1) | yes | no | n/a | yes | no |
| T3 | no | no | no (1) | yes | no | n/a | yes | no |

## Placebo (out of sample, 40 seeds, T1)

Each OOS trade is replaced by the trade of a random eligible day of the same year (same side, stop, hold, costs).

| Real net R a trade | Seeds beaten | Placebo median | Placebo 95th pct | Placebo min / max |
|---|---|---|---|---|
| −0.082 | 5 of 40 | −0.023 | +0.065 | −0.163 / +0.118 |

## Setups (reported)

Setups 1081 (buy 536, sell 545); traded one at a time 683.

## Reading

- T1: in sample −0.003R a trade net (n 333, t 0.00), out of sample −0.082R (n 330, t −1.55), −0.129R at twice the costs; costs +0.027R and financing +0.019R a trade out of sample; placebo beaten 5 of 40.
- T2 (the signal against gold's own drift): +0.028R in sample (t +0.59), −0.059R out of sample (t −1.13).
- T3 (the ray against the same EMA13 slope alone): +0.010R in sample (t +0.23), −0.063R out of sample (t −1.16).
- Not an edge: nothing is proposed and nothing live changes. Do not re-fit the EMA length, the power rule, stop or hold on these results.

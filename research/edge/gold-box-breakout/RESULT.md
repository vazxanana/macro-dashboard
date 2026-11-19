# Gold: the breakout of a multi-day consolidation box (14 Nov 2026)

**Verdict: FAIL, 0 of 3: the five-day box breakout made −0.299R a trade net out of sample (n 80, month t −2.03), −0.096R in sample; 1 of 40 placebos.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A new stand-alone rule on spot gold,
not a gate, exit, entry or size of the live gold book; none of its positions was read (docs/owner-decisions.md item 44).
Paper research only: nothing live changed and no proposal is written. This page is written by `run.mjs` from `result.json`.

## Rule (as pre-registered)

- OANDA mid XAU/USD H1 (125704 candles, 2006-03-19 to 2026-11-13), UTC days, weekend hours folded into Monday (5369 days).
- Signal at a day's close: the last five days' range (box) under 0.6 x the mean five-day range of the 60 windows before it.
- A buy-stop at the box high and a sell-stop at the box low for 5 days, first touch fills (one hour touching both = −1R); stop at
  the other side of the box (every trade has one); T1 target 2R, T2 none, T3 a ten-day box; out at the 20th day's last close.
- Costs: $0.60 a round trip in R of each trade's risk; financing on buys `nights` x `FIN.xau.long` (0.000148 a rollover); 2x doubles both.
- In sample: entries 2007-2016; out of sample: entries 2017 to 2026-10-31. t on calendar-month sums of net R; Holm over 3; placebo
  = 40 seeded draws of random signal days (no height condition), T1's orders and exits.

## Results

| Test | Window | n | Gross R | Net R | Net at 2× | Win % | Total net R | Worst DD R | t net (months) | t gross | Median stop $ | Median cost R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 five-day box, 2R target (primary) | IS 2007-16 | 83 | −0.022 | −0.096 | −0.171 | 33.73 | −8.00 | −13.17 | −0.64 | −0.14 | 25.09 | +0.051 |
| T1 five-day box, 2R target (primary) | OOS 2017-26 | 80 | −0.218 | −0.299 | −0.379 | 26.25 | −23.88 | −32.64 | −2.03 | −1.49 | 32.4 | +0.040 |
| T2 five-day box, no target | IS 2007-16 | 79 | −0.043 | −0.135 | −0.227 | 26.58 | −10.69 | −17.47 | −0.65 | −0.20 | 26.06 | +0.051 |
| T2 five-day box, no target | OOS 2017-26 | 78 | −0.084 | −0.191 | −0.297 | 24.36 | −14.87 | −29.52 | −0.90 | −0.39 | 32.4 | +0.043 |
| T3 ten-day box, 2R target | IS 2007-16 | 39 | +0.130 | +0.065 | −0.001 | 43.59 | +2.52 | −10.08 | +0.31 | +0.63 | 38.91 | +0.040 |
| T3 ten-day box, 2R target | OOS 2017-26 | 49 | −0.040 | −0.119 | −0.198 | 36.73 | −5.81 | −10.55 | −0.68 | −0.22 | 48.34 | +0.058 |

| Test | OOS p | Holm p | Buys OOS (n, net R) | Sells OOS (n, net R) | Exits OOS (target / stop / gap / time / both) |
|---|---|---|---|---|---|
| T1 | 0.042 | 0.127 | 42, −0.125 | 38, −0.490 | 18 / 58 / 0 / 4 / 0 |
| T2 | 0.368 | 0.736 | 41, +0.162 | 37, −0.582 | 0 / 57 / 0 / 21 / 0 |
| T3 | 0.497 | 0.736 | 32, −0.131 | 17, −0.096 | 9 / 27 / 0 / 13 / 0 |

Placebo (T1 out of sample, 40 seeds): median +0.030R a trade, 95th percentile +0.252R; T1 (−0.299R) beats 1 of 40.

## Checks of the pass bar (T1)

- Out-of-sample net month t ≥ 2: no (−2.03).
- Holm p ≤ 0.05: no (0.127).
- In-sample net R a trade > 0: no (−0.096).
- Out of sample positive at 2× costs: no (−0.379).
- Above at least 38 of 40 placebos: no (1).

## Net R a trade by entry year (T1)

| Year | n | Net R |
|---|---|---|
| 2007 | 5 | −0.081 |
| 2008 | 6 | −0.764 |
| 2009 | 7 | −0.209 |
| 2010 | 9 | −0.411 |
| 2011 | 7 | −0.220 |
| 2012 | 11 | +0.036 |
| 2013 | 11 | +0.237 |
| 2014 | 9 | +0.236 |
| 2015 | 9 | −0.735 |
| 2016 | 9 | +0.575 |
| 2017 | 6 | −1.141 |
| 2018 | 7 | −0.679 |
| 2019 | 9 | −0.317 |
| 2020 | 9 | −0.049 |
| 2021 | 12 | −0.854 |
| 2022 | 7 | −0.323 |
| 2023 | 8 | −0.442 |
| 2024 | 10 | +0.131 |
| 2025 | 5 | +0.175 |
| 2026 | 7 | +0.693 |

## Reading

- **The box break does not carry.** T1 lost in both windows (in sample −0.096R a trade net, n 83; out of sample −0.299R, n 80,
  month t −2.03) and was already negative before costs (gross −0.022R / −0.218R). Costs are small next to the stop: the median
  stop is $25 in sample and $32 out of sample, so $0.60 and the financing are about 0.04-0.05R a trade.
- Out of sample 58 of 80 trades were stopped at the other side of the box and 18 reached 2R: in a tight gold box a break tends
  to return through the box rather than run. The sells lost most (−0.490R out of sample, n 38; buys −0.125R, n 42).
- T1 sits below the random-day placebo (beats 1 of 40; median +0.030R): the height condition selected worse days than chance.
  The negative t is not a tested fade: reading it as a rule to sell the upper break would be chosen after the result and would
  need its own pre-registration on other data.
- T2 (no target) and T3 (ten-day box) fail too: T3 was +0.065R in sample (n 39, t 0.31) and −0.119R out of sample (n 49).
- Not an edge, no proposal, nothing live changed. No gate, exit, entry or size of the gold book was tested (item 44).

## To repeat

```sh
node --use-env-proxy research/edge/gold-box-breakout/run.mjs fetch <dir>   # candles, kept out of git
node research/edge/gold-box-breakout/run.mjs full <dir>
```

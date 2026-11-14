# Result: gold's first new 20-day closing extreme after a stall without one (14 Nov 2026)

**Verdict: FAIL, 0 of 2: following the first new 20-day closing extreme after a 7-day stall made +0.003R a trade over the every-day trade 2017-26 (n 109, month t 0.04).**

Pre-registered in `PREREGISTRATION.md` (pushed alone, before any trade was computed). The test ran once; nothing was changed
after the result. Paper research: nothing live changed and no proposal follows. **Item 44**: a new stand-alone daily rule judged
on 2017-26; it is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf) and reads none of its
positions. This page is written by `run.mjs` from `result.json`.

## Data and rule
OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (`git show`, no network), 2006-03-20 to 2026-11-13,
weekend candles folded into the next weekday (`council/fills.mjs` `foldWeekend`): 5,369 trading days. Signal day = a close at a new
20-day closing high or low with at least 7 trading days since the previous new 20-day closing extreme (the stall). Entry at the
next open; T1 follows the new extreme, T2 fades it. Stop 3 x ATR(14) (every trade has one), out at the close of the 10th day.
$0.60 a round trip, and on buys `nights` x `FIN.xau.long` (0.000148 a rollover) x entry; 2x doubles both. Excess = net R less the
same-side every-day trade's mean net R in the window. t on calendar-month sums of excess (every month counts), Holm over 2.

## Results

| Test | Window | n | Gross R | Net R | Every-day net (same side, mean) | Excess R | Excess t (months) | Net t (months) | Excess at 2x | Net at 2x |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 follow (primary) | IS 2007-16 | 103 | +0.131 | +0.097 | −0.030 | +0.127 | 1.78 | 1.35 | — | — |
| | OOS 2017-26 | 109 | +0.033 | −0.010 | −0.013 | +0.003 | 0.04 | −0.14 | +0.001 | −0.052 |
| T2 fade | IS 2007-16 | 100 | −0.098 | −0.130 | −0.032 | −0.098 | −1.55 | −2.03 | — | — |
| | OOS 2017-26 | 108 | −0.044 | −0.073 | −0.053 | −0.020 | −0.32 | −1.15 | −0.019 | −0.102 |

Every-day baselines (net R a trade): buy IS +0.009 (n 2602), OOS +0.069 (n 2552); sell IS −0.071 (n 2602), OOS −0.133 (n 2552).

| Test | OOS excess p | Holm p | Buys OOS (n, net, excess) | Sells OOS (n, net, excess) | Exits OOS (stop / gap / time) | Placebo beaten | Control beaten |
|---|---|---|---|---|---|---|---|
| T1 | 0.483 | 0.966 | 65, +0.036, −0.033 | 44, −0.077, +0.056 | 14 / 0 / 95 | 24 of 40 (median −0.029) | 13 of 40 (median +0.018) |
| T2 | 0.6261 | 0.966 | 43, −0.033, −0.102 | 65, −0.100, +0.033 | 22 / 0 / 86 | 10 of 40 (median −0.048) | 20 of 40 (median −0.071) |

## The pass bar, check by check (T1 decides the verdict)

- **T1**: excess month t >= 2 and Holm p <= 0.0228: no (t 0.04, Holm p 0.966); IS excess > 0: yes (+0.127); net and excess > 0 at 2x costs: no; placebo 38 of 40: no (24); control 38 of 40: no (13). FAIL.
- **T2**: excess month t >= 2 and Holm p <= 0.0228: no (t −0.32, Holm p 0.966); IS excess > 0: no (−0.098); net and excess > 0 at 2x costs: no; placebo 38 of 40: no (10); control 38 of 40: no (20). FAIL.

## By year (T1, net R)

| Year | n | Net R |
|---|---|---|
| 2006 | 8 | -0.38 |
| 2007 | 11 | 2.4 |
| 2008 | 10 | -0.59 |
| 2009 | 11 | 1.68 |
| 2010 | 11 | -0.88 |
| 2011 | 9 | 1.54 |
| 2012 | 8 | -0.96 |
| 2013 | 12 | 4.82 |
| 2014 | 8 | 1.06 |
| 2015 | 14 | 1.11 |
| 2016 | 9 | -0.19 |
| 2017 | 12 | 0.38 |
| 2018 | 10 | -1.17 |
| 2019 | 10 | 0.13 |
| 2020 | 9 | -0.9 |
| 2021 | 12 | 0.89 |
| 2022 | 12 | -2.53 |
| 2023 | 13 | 0.94 |
| 2024 | 12 | -0.4 |
| 2025 | 9 | 1 |
| 2026 | 10 | 0.59 |

## Reading
Not an edge. The count of days without a new 20-day closing extreme does not make the first new extreme after it a better trade than the same-side trade on any day, in either direction. Placebo = the same days with random sides; control = random days of the same year with the test's side mix (drift and volatility kept). Nothing live changed; no follow-up variant is proposed (any would need its own pre-registration on other data).

## Repeat
`node research/edge/gold-stall-drought/run.mjs fetch <dir>` (git show, no network), then `… full <dir>`; delete `<dir>` afterwards.

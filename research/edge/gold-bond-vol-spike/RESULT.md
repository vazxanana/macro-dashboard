# Result: spot gold after a rise in US 10-year Treasury volatility (14 Nov 2026)

**Verdict: FAIL, 0 of 3: a gold buy held 5 days after a 10-year bond volatility jump beat the year's plain buy by +0.049R out of sample (n 112, month t 0.77) and lost -0.010R in sample.**

A stand-alone study: no rule of the live gold book was read, tested or touched (docs/owner-decisions.md item 44), and none of
the book's positions was used. Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure, commit `841a7c9a5`).
Code: `run.mjs`. Every figure: `result.json`. Nothing here is an edge; nothing live changed and no proposal is written.

Data: council-data `research/daily/xau.json` (OANDA mid spot gold, 20 Mar 2006 to 13 Nov 2026) traded; `research/daily/usb10y.json`
(OANDA mid US 10-year Treasury CFD, from 21 Mar 2003) as the signal; UTC days, weekends folded into Monday (`fills.mjs`
`foldWeekend`). Event = the first day the bond's 5-day realised volatility is at least 1.25 x its 60-day one (cooldown 5 bond
days): 117 events in sample (2007-16), 112 out of sample (2017 to Oct 2026), every one with a gold candle. Entry at gold's close
of the event day, stop 2 x ATR(20), costs $0.60 a round trip plus nights x `FIN.xau.long` (0.000148 of price) x entry on buys.
Baseline = the same buy on every gold day of the same calendar year; excess = event net R minus that mean.

## The three tests (R a trade; t on calendar-month sums; one-sided p for excess > 0)

| Test | Window | n | excess R | t excess | net R | t net | gross R | t gross | baseline net R | net at 2x costs | excess at 2x | win % | stops |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 (primary): buy, 5 days | 2017-26 | 112 | +0.049 | 0.77 | +0.093 | 1.41 | +0.146 | 2.20 | +0.044 | +0.041 | +0.051 | 52.68 | 13 |
| T1 | 2007-16 | 117 | -0.010 | -0.16 | -0.010 | -0.16 | +0.038 | 0.57 | 0.000 | -0.058 | -0.009 | 52.14 | 26 |
| T2: buy, 10 days | 2017-26 | 112 | 0.000 | 0.00 | +0.079 | 0.80 | +0.164 | 1.64 | +0.079 | -0.006 | +0.001 | 49.11 | 29 |
| T2 | 2007-16 | 117 | -0.093 | -0.97 | -0.082 | -0.85 | -0.009 | -0.09 | +0.011 | -0.155 | -0.091 | 43.59 | 46 |
| T3: buy, 1 day | 2017-26 | 112 | +0.034 | 1.27 | +0.029 | 1.06 | +0.052 | 1.91 | -0.005 | +0.006 | +0.034 | 54.46 | 2 |
| T3 | 2007-16 | 117 | -0.019 | -0.61 | -0.034 | -1.07 | -0.010 | -0.31 | -0.015 | -0.057 | -0.019 | 42.74 | 1 |

| Test | Holm p (out of sample) | Placebo seeds beaten (38 of 40 needed) | Placebo mean / min / max excess | Pass |
|---|---|---|---|---|
| T1 | 0.4412 | 31 | -0.003 / -0.114 / +0.127 | no |
| T2 | 0.5018 | 20 | +0.012 / -0.111 / +0.180 | no |
| T3 | 0.3105 | 33 | 0.000 / -0.055 / +0.064 | no |

Every test misses its bar. T1's out-of-sample net R (+0.093R, t 1.41) is mostly gold's own 2017-26 rise: the plain buy on any
day of those years made +0.044R, and the excess over it (+0.049R, t 0.77) is not apart from 40 random days of the same months
(31 beaten). In sample the excess is negative for all three holds, so the sign does not repeat.

## The bond-falling / bond-rising split (descriptive, NOT a test)

Split by the bond's 5-day price change at the event (falling = yields rising):

| Test | Window | bond fell: n / excess / t | bond rose: n / excess / t |
|---|---|---|---|
| T1 | 2017-26 | 63 / -0.092 / -1.22 | 49 / +0.231 / 2.17 |
| T1 | 2007-16 | 61 / +0.001 / 0.02 | 56 / -0.023 / -0.23 |
| T2 | 2017-26 | 63 / -0.102 / -0.89 | 49 / +0.130 / 0.84 |
| T3 | 2017-26 | 63 / +0.015 / 0.41 | 49 / +0.059 / 1.42 |

The out-of-sample "bond rose" half of T1 reads t 2.17, but it was not pre-registered as a test, it is one of eight cells, and the
same half lost in sample (-0.023R). Do not trade it or re-test it on these years; a new test would need its own pre-registration
on data this study did not read.

## What this does and does not say

- A rise in Treasury volatility, read from the 10-year CFD's own prices, does not mark a better moment to buy gold than any
  other day of the same year, at 1, 5 or 10 days, in either window.
- It does not test the MOVE index itself (not reachable), the size of the rate move, or a short of gold.
- Caches: the candle files are read with `git show` into memory only; nothing was written outside this folder.

To repeat: `node research/edge/gold-bond-vol-spike/run.mjs` (needs `origin/council-data`). Test: `tests/gold-bond-vol-spike.test.mjs`.

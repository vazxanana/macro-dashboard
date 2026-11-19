# Result: spot gold the day after a US equity drawdown reaches a new depth (14 Nov 2026)

**Verdict: FAIL, 0 of 3: a one-day gold buy after an S&P 500 new drawdown depth beats gold's every-day buy by -0.027R net out of sample 2017-26 (n 135, month t -0.80).**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any gold return after an event was
computed). Paper research only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and
none of the book's 2006-17 positions was read (owner decision 44). No live rule, size, filter, stop, config, cost constant
or council member changed. No proposal is written. Nothing here is an edge.

## The rule (as registered)

Index day D is a new-depth day at X when its close is X or more below the highest close of the 252 index candles ending
at D and below every close since that high (only candles at or before D are read). Long gold at the open of the first
gold candle after D, out at that candle's close, stop 2 x ATR(20) of the gold candles before the entry (= 1R); one
position at a time. Costs: $0.60 a round trip plus `nights()` x `FIN.xau.long` (0.000148 of price a rollover). Baseline:
the same one-day long on every gold candle of the window; excess = net minus the baseline's mean net. OANDA mid daily
candles (council-data `research/daily`: `xau`, `spx500`, `nas100`), weekends folded into Monday. In sample 2007-16, out
of sample 2017 to Oct 2026; t on calendar-month sums of the excess; Holm over the three tests.

## Verdict table

R a trade.

| test | window | n | months | gross | net | baseline net | excess | month t (excess) | month t (net) | net x2 | excess x2 | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 S&P 500, 3 % (primary) | 2007-16 | 166 | 51 | −0.017 | −0.039 | −0.014 | −0.024 | −0.97 | −1.53 | −0.061 | −0.024 | |
| | 2017-26 | 135 | 42 | −0.010 | −0.029 | −0.002 | **−0.027** | **−0.80** | −0.85 | −0.048 | −0.025 | 1.00 |
| T2 Nasdaq 100, 3 % | 2007-16 | 176 | 53 | +0.031 | +0.008 | −0.014 | +0.022 | 0.79 | 0.27 | −0.015 | +0.022 | |
| | 2017-26 | 183 | 58 | +0.000 | −0.019 | −0.002 | −0.018 | −0.59 | −0.64 | −0.039 | −0.017 | 1.00 |
| T3 Nasdaq 100, 5 % | 2007-16 | 113 | 33 | +0.024 | +0.002 | −0.014 | +0.017 | 0.45 | 0.06 | −0.020 | +0.018 | |
| | 2017-26 | 126 | 43 | −0.018 | −0.038 | −0.002 | −0.036 | −1.05 | −1.09 | −0.058 | −0.035 | 1.00 |

No out-of-sample excess is positive, no month t of an excess reaches 1.1 in size, every Holm p is 1.00 (one-sided p 0.79, 0.72, 0.85). The cost of
a one-day hold is about 0.02R (spread 0.01R, one night of financing 0.01R).

## Placebo and control (out of sample)

| test | placebo: real month t beats (of 40, needs 38) | control: real excess beats (of 40, needs 38) | control mean excess |
|---|---|---|---|
| T1 | 12 | 4 | +0.010 |
| T2 | 15 | 9 | +0.000 |
| T3 | 7 | 3 | +0.006 |

The placebo draws the same number of random index days from the whole window; the control replaces each event day with
a random non-event day of the same calendar month (same drift and volatility regime, no day-level information). The
new-depth days did slightly WORSE than ordinary days of the very same months, but within noise.

## Reading

Gold does not get a measurable haven bid on the day after US equities make a new drawdown depth, nor a measurable margin-call
sale: the one-day excess is within ±0.04R a trade in every test and window, and the sign flips between windows for both
Nasdaq tests. Out of sample by year (T1, net R summed): 2018 +0.99, 2019 +1.91, 2020 −2.86, 2021 −1.20, 2022 −0.66,
2023 −1.54, 2024 −0.98, 2025 −0.45, 2026 +0.90: no year carries the result.

Not tested, because they do not reach 100 independent events a window (counted on dates only before the
pre-registration): first crossings of −10 % / −20 %, new 52-week index lows, fresh 20 / 60-day lows, and longer holds after
a new-depth day (95 / 79 / 58 S&P trades out of sample at 2 / 3 / 5 days). The longer-hold bear STATE is
`gold-equity-bear` (FAIL); the one-day shock is `gold-haven-shock` (FAIL).

To repeat: `node research/edge/gold-equity-new-depth/run.mjs fetch <dir>` (git show from `origin/council-data`, no
network), then `… full <dir>`. Every figure: `result.json`. Test: `tests/gold-equity-new-depth.test.mjs`.

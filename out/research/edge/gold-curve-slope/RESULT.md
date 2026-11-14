# Result: does the US yield curve's slope tell spot gold's next weeks? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: gold the 2s30s slope's way for 4 weeks makes +0.083R a trade net out of sample 2017-26 (n 58, month t 0.43), inside its placebo; 2s10s and 1 week lose.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit 26140083f, pushed alone before any number was computed).
Paper research only, a **stand-alone** gold rule: not a gate, entry, exit or size of the live gold book, it does not use that
book's 2006-17 window or positions (owner decision 44), and nothing here was compared with that book. No live rule, size,
filter, stop, config, cost constant or council member changed. No proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC) from council-data `research/daily/xau.json`, `usb02y.json`, `usb10y.json`,
  `usb30y.json` at commit `9fe2c7ac` (gold from 2006-03-20, bonds from 2003), weekends folded into Monday with
  `council/fills.mjs` `foldWeekend`. The bond keys are CFD prices; a yield change is proxied by `-ln(price change) / D` with
  the pre-registered assumed durations 1.9 (2-year), 8.0 (10-year), 17.0 (30-year).
- Signal each week (gold's last candle of the week, both bonds on that day): the 4-week change of (long yield - 2-year yield),
  z against the 156 weekly values before it. z > +1 (steepening): long gold; z < -1 (flattening): short gold.
- Trade: entry at gold's next open, out at the close of the 20th (T1, T2) or 5th (T3) gold candle, stop 2 x ATR(20) of the
  candles before the entry (1R; gaps through it fill at the open), one position at a time. **Every trade has a stop**; the
  median stop is $37.5-42 in sample and $51 out of sample (well above $10).
- Costs: $0.60 a round trip plus, on buys, `nights()` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's long
  swap, today's rate every year) x entry price. t on calendar-month sums of net R (empty months count as 0), Holm over T1-T3.
- **One deviation from the text, not from the rule:** the pre-registration expected the first signal in 2007; with gold's
  history starting March 2006, 4 weeks of change plus 156 earlier weekly values put the first signal at 2009-05-08, so the
  in-sample window is May 2009 to 2016. The rule and its look-back were not changed.

## The three tests

| Test | Window | n (long / short) | Win % | Gross R | Net R | Net long / short | Net 2x costs | Total net R | Month t gross | Month t net | Mean cost R | Cost share |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 2s30s, 20 candles (primary) | IS 2009-16 | 33 (13 / 20) | 51.5 | +0.142 | +0.087 | +0.226 / -0.003 | +0.032 | +2.87 | 0.59 | 0.37 | 0.055 | 39 % |
| | OOS 2017-26 | 58 (30 / 28) | 41.4 | +0.152 | +0.083 | +0.204 / -0.046 | +0.013 | +4.81 | 0.77 | **0.43** | 0.070 | 46 % |
| T2 2s10s, 20 candles | IS 2009-16 | 40 (20 / 20) | 40.0 | +0.029 | -0.031 | -0.060 / -0.003 | -0.092 | -1.25 | 0.14 | -0.15 | 0.061 | 206 % |
| | OOS 2017-26 | 53 (25 / 28) | 39.6 | -0.026 | -0.088 | +0.085 / -0.243 | -0.151 | -4.68 | -0.14 | **-0.48** | 0.063 | (gross < 0) |
| T3 2s30s, 5 candles | IS 2009-16 | 62 (23 / 39) | 59.7 | +0.081 | +0.057 | +0.153 / -0.000 | +0.032 | +3.51 | 0.80 | 0.56 | 0.024 | 30 % |
| | OOS 2017-26 | 124 (62 / 62) | 41.9 | +0.022 | -0.005 | +0.091 / -0.101 | -0.031 | -0.62 | 0.27 | **-0.06** | 0.027 | 123 % |

Cost share = total cost / total gross R. Costs are 0.024-0.070R a trade, mostly the financing of 20-candle longs.

| Test | OOS p (one-sided) | Holm p | OOS t >= 2 and Holm < 0.05 | IS net > 0 | OOS 2x > 0 | OOS n >= 30 | Beats 38 of 40 placebos | Pass |
|---|---|---|---|---|---|---|---|---|
| T1 | 0.334 | 1 | no | yes | yes (+0.013) | yes | no (26) | no |
| T2 | 0.684 | 1 | no | no | no | yes | no (19) | no |
| T3 | 0.524 | 1 | no | yes | no | yes | no (27) | no |

## Placebo (40 seeds: the same number of signals on random eligible OOS weeks, the real long / short mix, identical trade)

| Test | Real OOS month t | Seeds at or above the real t | Median / 5th / 95th percentile |
|---|---|---|---|
| T1 | 0.43 | 14 | 0.11 / -1.50 / 1.44 |
| T2 | -0.48 | 21 | -0.35 / -1.85 / 1.40 |
| T3 | -0.06 | 13 | -0.49 / -1.83 / 0.96 |

## Baseline: the same trade on every eligible week, same side (net R a trade)

| Window | T1 longs (after steepening) | Every week long | T1 shorts (after flattening) | Every week short |
|---|---|---|---|---|
| IS 2009-16 | +0.226 (n 13) | -0.049 (n 112) | -0.003 (n 20) | -0.055 (n 108) |
| OOS 2017-26 | +0.204 (n 30) | +0.179 (n 128) | -0.046 (n 28) | -0.328 (n 145) |

Out of sample the steepening longs earn about what any 4-week gold long earned (+0.204R against +0.179R), and the
flattening shorts lose less than any short (gold rose); the slope adds a few hundredths of an R a trade on 30 trades a side,
which the placebo cannot tell from chance. In sample the longs were better than the baseline (+0.226R against -0.049R) on
13 trades only.

## Informational (no test, not in Holm, not in the verdict)

- Bear steepening only (z > +1 and the 30-year yield rose over the 4 weeks), long, 20 candles: IS n 13, +0.226R net
  (t 0.54); OOS n 22, +0.044R net (month t 0.13), below the every-week long baseline (+0.179R). The term-premium story is not
  visible out of sample.
- T1 net R by exit year: 2009 +1.04, 2010 -1.02, 2011 -1.58, 2012 +3.77, 2013 +1.99, 2014 +0.89, 2015 -1.20, 2016 -1.02,
  2019 +4.24, 2020 +0.41, 2021 -1.40, 2022 +0.56, 2023 -0.12, 2024 -0.32, 2025 +1.32, 2026 +0.15 (no trade closed in 2017-18).

## Reading

- Not an edge, and no proposal. The primary test is positive in both windows before and after costs (and at twice the costs)
  but far from t 2 (OOS month t 0.43 on 58 trades in ten years) and in the middle of its placebo. Its gain comes from the long
  side, which is about gold's rise, not the curve.
- The 2s10s version and the one-week hold lose out of sample. One of the three slopes being positive is what chance gives.
- Limits: the yields are proxied from bond CFD prices with fixed durations (no FRED series was reachable for the whole span);
  the financing is today's rate charged every year.

To repeat: `node research/edge/gold-curve-slope/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-curve-slope/run.mjs full <dir>`. Tests: `tests/gold-curve-slope.test.mjs`.

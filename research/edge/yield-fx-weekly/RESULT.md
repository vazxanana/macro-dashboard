**Verdict:** FAIL, 0 of 3: a weekly 2-year Treasury move does not lead the dollar over the next week; decisive 2016-26 net a trade T1 USD/JPY +0.019R (n 301, t 0.43); T2 USD/CHF -0.015R (n 301, t -0.36); T3 EUR/USD +0.003R (n 301, t 0.07); replication 2004-15 negative on all three; no placebo beaten.

# Do weekly moves in US 2-year yields lead the dollar against low-yielding currencies? (14 Nov 2026)

Paper research only, a stand-alone research rule (owner decision 44: never a gate, exit, entry or size of the live gold
book). Nothing live changed and no proposal was written. The rule, data, costs, windows and pass bar were committed alone
before any price was read (`PREREGISTRATION.md`, commit 756efe1d5).

**Related**: `research/edge/bond-lead-intraday` (branch `bond-lead-intraday`, 14 Nov 2026) tested a sharp 15-minute move of the
US 10-year Treasury CFD leading gold and USD/JPY for one HOUR: a real gross lead (gross t 2.0-2.9 since 2016) smaller than the
round-trip cost (FAIL, 0 of 3). This study asked the same question at a WEEKLY horizon, where one round trip costs about
0.007R of a 2 x ATR(20) daily stop instead of 0.16-0.18R. Costs are no longer the problem here: the gross lead itself is absent.

## Rule and data (as pre-registered)
OANDA mid daily candles from council-data `research/daily/` (`usb02y` 2003-04-01 to 2026-11-06; the three pairs from
2002-05-07), weekend candles folded into Monday (`council/fills.mjs` `foldWeekend`). **Sign convention**: `usb02y` is the
note's PRICE, so a bond return below -0.5 x its trailing 52-week standard deviation of 5-day returns = yields up = buy USD (long
USD/JPY, long USD/CHF, SHORT EUR/USD); above +0.5 sd = yields down = sell USD. Signal at the Friday close, entry at the open of
the folded Monday candle (= the Sunday reopen), stop 2 x ATR(20) of the pair's daily candles (gap fills at the open), exit at
the close of the 5th held candle. Signals: 1,162 Fridays with a threshold (from 30 Jan 2004), 337 yields up, 307 yields
down, 518 flat. Costs: 0.3 pip spread + 22.5 USD a million a side + 0.15 pip slippage a side; financing per rollover night
(Monday-Friday 22:00 UTC, Wednesday three) at the demo broker's swaps (USD/CHF long +0.437 / short -1.314 pips, EUR/USD long
-0.621 / short +0.244) and an ASSUMED USD/JPY swap (long +1.0 / short -2.0 pips: the demo account carries no USD/JPY); today's
swaps are applied to every year.

## Tests (one position at a time per pair; t on calendar-month sums of net R; base costs)

| Test | Window | n | Gross R a trade | Net R a trade | t (net) | t (gross) | Net R | Stopped | Worst drawdown | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | decisive | 301 | +0.036 | +0.019 | 0.43 | 0.82 | +5.6 | 56 | -9.7R | 1.00 (raw 0.33) |
| T1 | replication | 342 | -0.043 | -0.065 | -1.51 | -1.00 | -22.3 | 74 | -25.0R |  |
| T2 | decisive | 301 | +0.009 | -0.015 | -0.36 | 0.20 | -4.6 | 45 | -12.1R | 1.00 (raw 0.64) |
| T2 | replication | 342 | -0.082 | -0.102 | -2.19 | -1.76 | -34.8 | 77 | -39.9R |  |
| T3 | decisive | 301 | +0.016 | +0.003 | 0.07 | 0.39 | +0.9 | 48 | -11.0R | 1.00 (raw 0.47) |
| T3 | replication | 342 | -0.078 | -0.089 | -2.10 | -1.85 | -30.3 | 74 | -33.3R |  |

T1 = USD/JPY, T2 = USD/CHF, T3 = EUR/USD (buy USD = short). Pass bar per test: net R > 0 in both windows (all three fail:
every replication window is negative), decisive t >= 2 (largest 0.43), Holm p < 0.05 (all 1.00), decisive n >= 100 (all pass:
301), placebo (all fail, below).

## Cost sensitivity (R a trade / t on month sums)

| Test | Window | 0 (gross) a trade / t | base a trade / t | 2x a trade / t | trading cost a trade | financing a trade (base) |
|---|---|---|---|---|---|---|
| T1 | decisive | +0.036 / 0.82 | +0.019 / 0.43 | -0.034 / -0.76 | -0.007 | -0.010 |
| T1 | replication | -0.043 / -1.00 | -0.065 / -1.51 | -0.122 / -2.82 | -0.007 | -0.016 |
| T2 | decisive | +0.009 / 0.20 | -0.015 / -0.36 | -0.062 / -1.46 | -0.008 | -0.016 |
| T2 | replication | -0.082 / -1.76 | -0.102 / -2.19 | -0.135 / -2.89 | -0.006 | -0.014 |
| T3 | decisive | +0.016 / 0.39 | +0.003 / 0.07 | -0.021 / -0.51 | -0.008 | -0.006 |
| T3 | replication | -0.078 / -1.85 | -0.089 / -2.10 | -0.106 / -2.51 | -0.006 | -0.005 |

2x = trading cost doubled, every financing charge doubled, every financing credit dropped. The round trip costs under 0.01R a
trade, financing about as much again. Even with no cost at all no test reaches t 1 in 2016-26, and all three are negative before
2016.

## By direction of the yield move (reported only)

| Test | Yields | Window | n | Gross a trade | Net a trade | t |
|---|---|---|---|---|---|---|
| T1 | up (buy USD) | decisive | 168 | +0.060 | +0.085 | 1.52 |
| T1 | up (buy USD) | replication | 169 | -0.003 | +0.026 | 0.40 |
| T1 | down (sell USD) | decisive | 133 | +0.005 | -0.066 | -0.91 |
| T1 | down (sell USD) | replication | 173 | -0.083 | -0.154 | -2.91 |
| T2 | up (buy USD) | decisive | 168 | -0.011 | +0.001 | 0.01 |
| T2 | up (buy USD) | replication | 169 | -0.117 | -0.110 | -2.00 |
| T2 | down (sell USD) | decisive | 133 | +0.034 | -0.036 | -0.58 |
| T2 | down (sell USD) | replication | 173 | -0.048 | -0.094 | -1.25 |
| T3 | up (buy USD) | decisive | 168 | +0.039 | +0.041 | 0.67 |
| T3 | up (buy USD) | replication | 169 | -0.083 | -0.082 | -1.40 |
| T3 | down (sell USD) | decisive | 133 | -0.013 | -0.045 | -0.80 |
| T3 | down (sell USD) | replication | 173 | -0.074 | -0.096 | -1.62 |

The one positive-looking cell, buying USD/JPY after yields rose in 2016-26 (+0.085R, t 1.52), is partly the ASSUMED swap credit
of a long USD/JPY (its gross is +0.060R) and is one of twelve cells looked at after the fact: not a finding.

## Placebo (40 seeds: the same number of random decisive Fridays, random side, same entry / stop / exit / costs)

| Test | Real decisive net a trade | Placebo median | Placebo 95th pct | Placebo range | Seeds at or above real | Passes |
|---|---|---|---|---|---|---|
| T1 | +0.019 | -0.020 | +0.033 | -0.105 to +0.083 | 5 of 40 | no |
| T2 | -0.015 | -0.017 | +0.047 | -0.115 to +0.054 | 18 of 40 | no |
| T3 | +0.003 | -0.002 | +0.037 | -0.059 to +0.084 | 17 of 40 | no |

The real signals sit inside the spread of random weeks with random sides.

## Variant named in the pre-registration, reported only: trade every Friday on the sign of the bond return

| Test | Window | n | Gross a trade | Net a trade | t (net) | t (gross) |
|---|---|---|---|---|---|---|
| T1 | decisive | 554 | +0.028 | +0.008 | 0.26 | 0.88 |
| T1 | replication | 602 | +0.007 | -0.019 | -0.59 | 0.21 |
| T2 | decisive | 554 | +0.050 | +0.024 | 0.77 | 1.60 |
| T2 | replication | 602 | -0.037 | -0.057 | -1.65 | -1.06 |
| T3 | decisive | 554 | +0.045 | +0.031 | 1.02 | 1.51 |
| T3 | replication | 603 | -0.048 | -0.059 | -1.94 | -1.59 |

Same picture: slightly positive since 2016, negative before, never t 2.

## Per year (net R, base costs)

| Year | T1 n / net R | T2 n / net R | T3 n / net R |
|---|---|---|---|
| 2004 | 21 / -3.0 | 21 / -8.8 | 21 / -4.9 |
| 2005 | 31 / -2.9 | 31 / -4.2 | 31 / -3.5 |
| 2006 | 32 / -2.3 | 32 / -6.2 | 32 / -6.2 |
| 2007 | 34 / -2.2 | 34 / +1.8 | 34 / +4.1 |
| 2008 | 31 / -3.3 | 31 / -7.1 | 31 / -6.8 |
| 2009 | 21 / -1.9 | 21 / +2.0 | 21 / +2.8 |
| 2010 | 20 / +2.1 | 20 / -4.9 | 20 / -3.3 |
| 2011 | 27 / +4.3 | 27 / -2.0 | 27 / -1.8 |
| 2012 | 28 / +0.8 | 28 / +0.2 | 28 / +1.3 |
| 2013 | 31 / -3.5 | 31 / -4.4 | 31 / -2.5 |
| 2014 | 31 / -3.4 | 31 / -5.2 | 31 / -4.1 |
| 2015 | 35 / -7.1 | 35 / +4.0 | 35 / -5.5 |
| 2016 | 32 / +5.0 | 32 / -1.4 | 32 / -1.8 |
| 2017 | 24 / -1.3 | 24 / +2.6 | 24 / -1.7 |
| 2018 | 33 / -1.0 | 33 / -3.5 | 33 / -1.9 |
| 2019 | 34 / -3.6 | 34 / -0.4 | 34 / -2.4 |
| 2020 | 10 / -0.7 | 10 / +0.4 | 10 / +2.1 |
| 2021 | 24 / -0.3 | 24 / -1.6 | 24 / +1.2 |
| 2022 | 37 / +3.3 | 37 / -1.2 | 37 / +3.6 |
| 2023 | 27 / +1.4 | 27 / -2.1 | 27 / -4.5 |
| 2024 | 26 / +7.3 | 26 / +2.3 | 26 / +2.7 |
| 2025 | 25 / -1.4 | 25 / +0.6 | 25 / +2.8 |
| 2026 | 29 / -2.9 | 29 / -0.4 | 29 / +0.8 |

2020 has only 10 signals: the March 2020 bond swings widened the trailing 52-week threshold for a year.

## What it means, and what it does not
- At a one-week horizon, a 2-year Treasury move larger than half its usual weekly size is not followed by the dollar moving
  the same way against the yen, the franc or the euro, before or after costs, in either window. In 2004-15 the dollar went
  slightly the OTHER way (gross t -1.00 to -1.85, not significant; said here, never to be traded on: it is a post-hoc look and
  would need its own pre-registration on other data).
- With the hourly study this closes the idea "the bond market leads the dollar" on these instruments at both horizons tested:
  at an hour the lead is real but smaller than costs; at a week there is nothing to pay costs with.
- It does not test: lags of one to three days, the 10-year or real yields, the yield GAP between two countries, other
  thresholds, holds or stops (each would need its own pre-registration on other data), nor the papers the pre-registration
  names (none was opened). The USD/JPY swap is assumed; the USD/CHF and EUR/USD swaps are today's demo rates charged back to
  2004, when rate gaps (and so swaps) were different; the verdict does not depend on them (gross is no better).
- No proposal; nothing live changed. Never call this an edge.

To repeat: `node research/edge/yield-fx-weekly/run.mjs fetch <dir>` (the four daily files from `origin/council-data`, git show,
no network), then `node research/edge/yield-fx-weekly/run.mjs full <dir>` (writes `result.json`). Tests:
`tests/yield-fx-weekly.test.mjs`.

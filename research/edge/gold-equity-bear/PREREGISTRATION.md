# Pre-registration: gold during US equity bear markets (14 Nov 2026)

Written and pushed ALONE before any number of this study was computed. Paper research only: a **stand-alone** gold rule, never
a gate, entry, exit or size of the live gold book, and it does not use that book's 2006-17 window or its positions (owner
decision 44). No live rule, size, filter, stop, config, cost constant or council member changes, whatever the result.

## Why (the economic reason, stated before the data)

A deep US equity drawdown is the condition under which the Federal Reserve and the Treasury ease (rate cuts, asset purchases,
fiscal support): lower expected real rates and a weaker dollar outlook are the textbook reasons to hold a metal that pays no
coupon, and investors who stay in a bear market look for assets that are not claims on corporate earnings. The hypothesis:
**gold bought on a day the S&P 500 is 10 % or more below its 52-week closing high earns more over the next 20 trading days
than the same gold buy on the other days.** The test is measured against that unconditional same-side baseline, so it is not
a bet on gold's rise.

Not a duplicate: `gold-haven-shock` (FAIL) bought gold the day after a single 2-sd equity SHOCK DAY and held 1 or 5 days;
`risk-cross` / `risk-spill-jpy` read risk-off spill-overs into currencies; `regime`, `regime-switch`, `gold-regime-switch`
read gold's OWN trend or volatility. None conditions on the equity market's DRAWDOWN STATE from its 52-week high and none
holds gold for four weeks inside it.

## Data (named before any result)

- council-data `research/daily/xau.json`, `spx500.json`, `nas100.json` (OANDA mid daily candles, UTC days), read with
  `git show origin/council-data:…` (no network), weekends folded into Monday with `council/fills.mjs` `foldWeekend`. No other
  market is read.

## The rule

- Drawdown on index day D: `dd = close_D / max(close of the 252 index candles ending at D) - 1` (needs 252 candles; only
  candles at or before D).
- Bear day: `dd <= -X`. Entry: **long** gold at the open of the first gold candle after D; out at the close of the 20th gold
  candle (entry candle counted) or at the stop. **Every trade has a stop**: 2 x ATR(20) of gold's daily candles before the
  entry (= 1R) below the entry; a gap through the stop fills at that candle's open; a candle touching the stop exits there
  (checked before the close).
- One position at a time: a bear day while a trade is open is skipped.
- Baseline (same side, unconditional): the same long trade from EVERY eligible non-bear index day of the same window, each on
  its own (overlapping allowed). Excess of a bear trade = its net R minus the baseline's mean net R in that window.

## Tests (three, Holm over the three)

| id | index | X | role |
|---|---|---|---|
| T1 | spx500 | 10 % | **primary** |
| T2 | spx500 | 20 % | deeper bear |
| T3 | nas100 | 10 % | replication index |

## Costs

- $0.60 a round trip on every trade, plus financing on every buy: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of the
  entry price a rollover, `council/fills.mjs`, the demo broker's XAUUSD swap of 11 Nov 2026) x entry price, in R. Today's rate
  for every year (an assumption, as earlier studies stated). The cost share (mean cost R / mean gross R) is reported.
- 2x costs: both parts doubled.

## Windows and statistics

- In sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31 (signal day inside the window).
- t on calendar-month sums of the excess (by exit day, every month of the window counted, empty months 0); one-sided p from
  the normal, Holm over T1-T3.
- Placebo: 40 seeded draws (mulberry32, seeds 1-40) of as many random eligible index days of the OOS window as there were
  bear days, run through the same one-at-a-time simulation; the month t of their excess is compared with T1's.

## Pass bar (decided now)

T1 passes only if all hold: OOS month-sum t of the excess >= 2 with Holm p < 0.05; the in-sample excess > 0; the OOS bear
trades' net R a trade > 0 at 2x costs; T1's OOS excess t above at least 38 of the 40 placebos. Otherwise **FAIL**. T2 and T3
are reported with the same bar; they cannot rescue T1. A pass would be a lead to replicate, never an edge on its own; the
median stop in dollars is reported (expected well over $10).

# Pre-registration: gold after a US equity losing streak (14 Nov 2026)

Written and pushed ALONE before any gold return after an event was computed. Only the number of streak days per window was
counted (to check the >= 100 events rule): S&P 500 127 in 2007-16 and 127 in 2017 to Oct 2026; Nasdaq 100 133 and 119.
Paper research only: a **stand-alone** gold rule, never a gate, entry, exit or size of the live gold book, and it does not
read that book's 2006-17 positions (owner decision 44). No live rule, size, filter, stop, config, cost constant or council
member changes, whatever the result.

## Why (the economic reason, stated before the data)

Baur and Lucey (2010, "Is gold a hedge or a safe haven?") and Baur and McDermott (2010) describe gold as a safe haven in
the days of stock-market stress: money leaving equities goes partly to gold, and a run of losses lowers expected policy
rates (the "Fed put"), which lowers the opportunity cost of a metal that pays no coupon. A run of consecutive down closes is
persistent, broad selling pressure rather than one shock day. The hypothesis: **gold bought after the S&P 500 closes lower
three days in a row earns more over the next 5 trading days than the same gold buy on any day of the same year.** It is
measured against that same-side, same-year baseline, so it is not a bet on gold's rise.

Not a duplicate: `gold-haven-shock` (FAIL) used a single 2-sd shock DAY; `gold-equity-new-depth` (FAIL) a new drawdown
depth below a 52-week high, 1 day; `gold-equity-bear` (FAIL) the 10 % / 20 % bear state, 20 days; `gold-smallcap-stress`
the Russell / S&P gap; `gold-spx-vol-regime` realised-volatility crossings; `gold-streak` gold's OWN streaks. None conditions
on the NUMBER OF CONSECUTIVE equity down closes, whatever their size.

## Data (named before any result)

- council-data `research/daily/xau.json`, `spx500.json`, `nas100.json` (OANDA mid daily candles, UTC days), read with
  `git show origin/council-data:…` (no network), weekends folded into Monday with `council/fills.mjs` `foldWeekend`. No other
  market is read.

## The rule

- Streak on index day D: the number of consecutive index candles ending at D whose close is below the previous candle's
  close (only candles at or before D). A **signal day** is a day whose streak is exactly 3 (the first day it reaches 3;
  a streak that goes on to 4, 5, … gives no new signal).
- Entry: **long** gold at the open of the first gold candle after D (gold's UTC candle after the index's UTC close); out at
  the close of the H-th gold candle (entry candle counted) or at the stop. **Every trade has a stop**: 2 x ATR(20) of gold's
  daily candles before the entry (= 1R) below the entry; a gap through the stop fills at that candle's open; a candle that
  touches the stop exits there. One position at a time: a signal while a trade is open is skipped.
- Baseline (same side, unconditional): the same long trade (same H, same stop) from EVERY eligible index day of the window,
  each on its own (overlapping allowed). Excess of a signal trade = its net R minus the baseline's mean net R of trades
  entered in the SAME calendar year.

## Tests (three, Holm over the three)

| id | index | H (gold candles) | role |
|---|---|---|---|
| T1 | spx500 | 5 | **primary** |
| T2 | spx500 | 1 | next day only |
| T3 | nas100 | 5 | replication index |

## Costs

- $0.60 a round trip on every trade, plus financing on every buy: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of the
  entry price a rollover, `council/fills.mjs`, the demo broker's XAUUSD swap of 11 Nov 2026) x entry price, in R. Today's
  rate for every year (an assumption, as earlier studies stated). 2x costs: both parts doubled.

## Windows and statistics

- In sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31 (signal day inside the window).
- t on calendar-month sums of the excess (by exit day, every month of the window counted, empty months 0); one-sided p from
  the normal, Holm over T1-T3. Gross, net and excess are reported per window.
- Placebo: 40 seeded draws (mulberry32, seeds 1-40) of as many random eligible index days of the OOS window as there were
  signal days, run through the same one-at-a-time simulation; the month t of their excess is compared with the test's.
- Control keeping gold's drift and volatility: 40 seeded circular shifts of the signal days inside the OOS window (each
  signal moved by the same offset of 63 to N - 63 eligible days, wrapped), so gold's own path (its drift and volatility in
  every year) and the clustering of the signals are kept and only the timing link to the equity streak is broken. Reported
  as how many of the 40 the real month t beats.

## Pass bar (decided now)

T1 passes only if all hold: OOS month-sum t of the excess >= 2 with Holm p < 0.05; the in-sample excess > 0; the OOS signal
trades' net R a trade > 0 at 2x costs; T1's OOS excess t above at least 38 of the 40 placebos. Otherwise **FAIL**. T2 and
T3 are reported with the same bar; they cannot rescue T1. A pass would be a lead to replicate, never an edge on its own.
No oscillator is used.

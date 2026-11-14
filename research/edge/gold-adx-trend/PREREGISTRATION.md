# Pre-registration: Wilder's ADX / directional-movement trend rule on gold's daily chart (14 Nov 2026)

Committed and pushed ALONE, before any return, trade or statistic of these rules was computed.

**Question.** Does Wilder's directional movement system (+DI, -DI and ADX(14), "New Concepts in Technical Trading
Systems", 1978), the classic "trade only when ADX says the market trends, in the direction of the stronger DI" rule, make
money on spot gold's daily chart after costs?

**Why this topic.** The 14 Nov 2026 untested-backlog list (`research/proposals/2026-11-14-untested-backlog.md`, branch
`untested-backlog`) ranks seven candidates; none is a stand-alone gold rule (FOMC cycle on US indices, announcement days on
indices and bonds, cross-sectional seasonality, non-US holidays, index volume premium, index volume reversal, the index
overnight tug of war). So this is a simple rule of my own choosing, said as such. It is a textbook indicator rule with a
published origin, not chosen after reading any gold table.

**What this is not.** A stand-alone rule, tested on its own. It is **not** a gate, exit, entry, filter or size of the live
gold book (Gold trend + Gold daily engulf) and it reads nothing of it; owner decision 44 is untouched. Paper research only:
nothing live changes, and a pass would only be reported to the owner, never applied.

**Dedupe.** No study tests the ADX / DMI system as a rule on gold. Read: `regime` and `meridian-swing` (D1 ADX(14) used as a
band FILTER on the engine's Swing setups, not as a stand-alone trend rule), `gold-macd` (MACD and 50/200 crosses on gold),
`gold-ichimoku`, `gold-h4-supertrend`, `gold-tsmom`, `trend-breadth` / `trend-breadth-h1` (the live 20-day breakout),
`gold-vol-breakout*`. The branch `claude/swing-adx-shadow` only tags Swing signals with an ADX band. No branch or folder name
holds "dmi" or a gold ADX rule.

## Data (fixed before any result)

- Market: **spot gold only (XAU/USD)**, OANDA mid daily candles, council-data `research/daily/xau.json`, read with
  `git show origin/council-data:research/daily/xau.json` (no network). Rows start 20 March 2006.
- Weekend candles are folded into the next weekday with `council/fills.mjs` `foldWeekend`. Only complete days: a last row
  dated on or after the file's `updated` day + 1 is dropped.
- Warm-up 2006-03 to 2006-12: no signal before 1 January 2007 is traded.

## The indicators (Wilder, N = 14)

- True range TR = max(high - low, |high - previous close|, |low - previous close|).
- Up move = high - previous high; down move = previous low - low. +DM = up move when up move > down move and > 0, else 0;
  -DM = down move when down move > up move and > 0, else 0.
- Wilder smoothing of TR, +DM, -DM: the first value is the sum of the first 14 values; then `S = S - S / 14 + x`.
- +DI = 100 x S(+DM) / S(TR); -DI = 100 x S(-DM) / S(TR); DX = 100 x |+DI - -DI| / (+DI + -DI) (0 when the sum is 0).
- ADX: first value = mean of the first 14 DX values; then `ADX = (ADX_prev x 13 + DX) / 14`.
- ATR(14) for the stop: simple mean of the last 14 true ranges up to and including the signal day.
- Everything is read on the CLOSE of day i; every order fills at the OPEN of day i+1. Nothing of day i+1 or later is read.

## The three tests

**Every trade carries a stop**, 2 x ATR(14) of the signal day from the entry, set at entry and never moved. The stop is
checked from the entry day on (low for a long, high for a short); a day opening beyond the stop fills at the open; a day
holding both an exit open and the stop is settled at the open. After a stop the rule stays flat until its next new entry
signal. A position still open on the last candle is closed at that candle's close and reported as open.

- **T1, ADX trend, long and short (primary).** State on day i: +1 when ADX > 25 and +DI > -DI; -1 when ADX > 25 and
  -DI > +DI; 0 otherwise. When the state changes, a position whose side is not the new state is closed at the next open; a
  change INTO +1 or -1 opens that side at the next open. (A new entry needs a change into the state: being in it at the start
  of 2007 or after a stop is not an entry.)
- **T2, ADX trend, long only.** The same state; only entries into +1 are taken; the long is closed at the next open after
  the state leaves +1.
- **T3, DI cross stop-and-reverse (no ADX filter).** +DI crossing above -DI on the close (`+DI[i-1] <= -DI[i-1]` and
  `+DI[i] > -DI[i]`): buy at the next open, closing a short at the same price; the mirror cross sells.
- 1R = the entry's stop distance (2 x ATR(14)). R of a trade = (exit - entry) x side / stop distance.

## Costs

- **$0.60 an ounce a round trip** on every trade, taken off as 0.60 / stop distance in R.
- **Financing on buys**: `nights(entry time, exit time)` x `FIN.xau.long` (0.000148 of price a rollover, the demo
  broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry price / stop distance; today's rate for every year.
  Shorts are charged and credited nothing (`FIN.xau.short`). An open fill is stamped at the day's 00:00 UTC; a stop inside a
  day at 12:00 UTC.
- **2x costs**: $1.20 a round trip and twice the financing.

## Windows

- **In sample (IS)**: trades whose entry day is 1 January 2007 to 31 December 2016.
- **Out of sample (OOS)**: entry day 1 January 2017 to the last complete candle in the file (early November 2026).
- OOS halves (reported only): 2017-2021 and 2022 to the end.

## Statistics

- Per test and window: n, win rate, R a trade gross and net, net at 2x costs, total R, worst closed-trade drawdown.
- **Month t**: net R summed by the calendar month of each trade's exit, over every calendar month of the window (a month
  with no exit counts 0); t = mean / (sd / sqrt(months)); two-sided p from Student's t (months - 1 df).
- **Holm** over the three tests' OOS p-values.
- **Placebo, 40 seeds** (mulberry32, seeds 1 to 40), per test on the OOS window: as many entries as the rule's OOS trades,
  each on a uniformly random OOS day with room for its holding length, keeping each real trade's side, its holding length
  in days and its 2 x ATR(14) stop (ATR of the day before the random entry); exit at the open after that many days or at
  the stop; same costs. Score = OOS net R a trade.

## Pass bar (per test; the verdict is PASS if any test passes, the primary T1 named first)

1. OOS net R a trade > 0 with OOS month t >= 2 and Holm-adjusted p < 0.05;
2. IS net R a trade > 0 (same sign);
3. OOS net R a trade > 0 at 2x costs;
4. OOS net R a trade above at least 38 of the 40 placebo seeds;
5. OOS n >= 30 (fewer = descriptive only).

Even a pass is a lead, not an edge: hundreds of tests have been run on this data and none survives a family correction.

## Deliverables

`run.mjs` (fetch / full), `RESULT.md` with the verdict reason in the bold verdict line, `result.json`,
`tests/gold-adx-trend.test.mjs` (the indicator on hand-made candles, no look-ahead, the report against result.json),
`out/` rebuilt. Nothing else is touched.

# Round numbers on spot gold ($100 and $50 levels: stall and break): pre-registration

Written and committed on 14 Nov 2026, before any candle of the test was read for this study and before any trade was
computed. Paper research only: no live rule, size, filter, cost model or mirror setting is changed by this study, whatever it
finds. A pass would only be a proposal to the owner for a paper shadow (`research/proposals/`), never a live change.

This is a NEW standalone intraday rule on gold. It is not a gate, exit, entry or size of the live gold book (Gold trend,
Gold daily engulf) and reads none of that book's 2006-17 records (docs/owner-decisions.md item 44); its window starts in 2016.

## Why, and what was tested before

Osler (2003, Journal of Finance, "Currency orders and exchange-rate dynamics: an explanation for the predictive success of
technical analysis") and Osler (2005, Journal of International Money and Finance, "Stop-loss orders and price cascades in
currency markets") report that take-profit orders cluster at round numbers (a move tends to stall or reverse at its first
touch) and stop-loss orders cluster just beyond them (a move that crosses one tends to continue). Two studies in this
repository tested that reading: `fx-round-numbers` (branch `fx-round-numbers`, four forex majors, M15: **FAIL, 0 of 2**;
stall 2016 on −0.120R a trade net, n 5,966, t −8.40; break −0.112R, n 9,341, t −9.75) and `index-round-numbers` (branch
`index-round-numbers`, nas100 / spx500 / us30 / de40, M5: **FAIL, 0 of 2**; stall OOS −0.072R, n 1,055, t −1.94; break OOS
−0.008R, n 2,347, t −0.24). No study has tested round numbers on gold (`gold-round-stop` is a 4 Nov change to where the
replica puts its stop, not a test). This study is the gold counterpart and reuses `index-round-numbers`' design (touch, side,
gap, fill, stop-first and stop-only-in-the-fill-candle conventions; distances scaled by the daily ATR; flat by the end of
the trading day), with the levels the gold desk watches ($100 and $50) and gold's costs.

## Data

- OANDA mid **M5** XAU/USD candles (`xau`) through the council's keyless proxy (`https://meridianx.dev/md/bars?sym=xau&tf=5m
  &from=&to=`, 4,999-candle windows, paced, as `index-round-numbers` pages), from 2015-12-01 to the start of the UTC day the
  run is made. Complete candles only. Fetched by `fetch.mjs`; the file is kept outside git.
- Market: **spot gold, `xau`, only**, named here before any result.
- **In sample (IS): trades entered 2016-01-01 to 2020-12-31. Out of sample (OOS): 2021-01-01 to the end of the file.**
  (These are the windows the study was asked for; they match `index-round-numbers`.)
- All times UTC unless a zone is named. A candle belongs to a time by its open time.

## Trading days and the daily ATR

- **Trading day** = the New York 17:00 to 17:00 day (the gold market's own day; New York daylight-saving rule: second Sunday
  of March to first Sunday of November). A day is named by the New York date on which it ENDS; a candle belongs to the day
  in which it opens. Saturday- and Sunday-named days are dropped (the Sunday 17:00 reopen starts Monday's day). Days with no
  candle have no trade.
- **Daily ATR** `A` for a day = the mean true range (high − low, widened to the previous day's close) of the 14 trading days
  before it, built from the same M5 file. No day is traded before 15 trading days of candles exist.

## The levels

- Grid step `G` = **$100** for every test.
- **$100 levels**: every multiple of $100 (1,200, 1,300, ..., 4,000, 4,100).
- **$50 levels**: the odd multiples of $50, i.e. the $100 grid shifted by half a step (1,250, 1,350, ...). The two sets are
  disjoint, so T1 and T2 never trade the same level.
- **Placebo**: for seed s = 1..40, mulberry32 seeded with s alone gives one shift `u` (draws repeated until `u` lies in
  [0.05, 0.45] or [0.55, 0.95], so a placebo grid is never within $5 of a $100 or a $50 level); placebo levels = `(k + u) x
  $100`. The same 40 grids are used for all three tests: each test's full rule, costs and statistics are run on each grid.
- A candle **touches** level L when `low <= L <= high` (within 1e-9).

## Rule T1: stall at a $100 level (fade the first touch in the trading day)

- Candle c of the day, not the day's first candle (the previous candle p is of the same day).
- **First touch**: no earlier candle of this day touched L.
- **Side**: p.close below L = price comes from below: **sell**; above L: **buy**; equal: no trade.
- **Approach**: from below, `L − (lowest low of the day's candles before c) >= 0.5 x A`; from above, `(highest high of those
  candles) − L >= 0.5 x A`. Otherwise no trade.
- **Entry**: a resting limit at L, filled on c at L; when c opens beyond L (a gap past the level), at its open. No trade when
  c opens at or beyond the stop.
- **Stop** = L + 0.25 x A (sell) / L − 0.25 x A (buy). **Target** = L − 0.5 x A (sell) / L + 0.5 x A (buy).
  `r0 = |fill − stop|` = 1R. Every trade has this stop.
- **In the fill candle only the stop is checked.** From the next candle: an open at or beyond the stop exits at that open,
  at or beyond the target exits at that open; else the stop is checked first, then the target (both in one candle: the stop).
- **Time exit**: at the close of the day's last candle (the candle opening at or before 16:55 New York), before the 17:00
  rollover, so no position is held overnight.
- One T1 trade per level per day. Several levels touched by one candle: each is its own trade.

## Rule T2: stall at a $50 level

T1 exactly, on the $50 levels.

## Rule T3: break of a $100 level (follow the first close beyond)

- Candle c of the day with the previous candle p of the same day. **Break up of L**: `c.close >= L + 0.05 x A`,
  `p.close < L + 0.05 x A`, and `min(c.low, p.low) <= L`; L = the highest $100 level with `c.close >= L + 0.05 x A`.
  **Break down** mirrored (`c.close <= L − 0.05 x A`, `p.close > L − 0.05 x A`, `max(c.high, p.high) >= L`, the lowest such L).
- **Entry**: at market at the next M5 candle's open, which must be of the same day; buy after a break up, sell after a break
  down. **Stop** = L − 0.1 x A (buy) / L + 0.1 x A (sell). No trade when the entry open is at or beyond the stop.
  **Target** = entry + 0.5 x A (buy) / entry − 0.5 x A (sell). `r0 = |entry − stop|`.
- The entry candle is checked for both (stop first); then each candle: an open at or beyond the stop or target exits at the
  open; else stop first, then target. Time exit as T1.
- One T3 trade per level per day (the first break of that level in the day, whichever side).

## Costs (net R)

Charged on every trade in dollars, then divided by `r0`:
- **$0.30 a round trip** (the gold spread of `council/fills.mjs` `spreadOf` for a spot metal, and the round trip the gold
  studies charge);
- **plus half a spread ($0.15) of slippage on every market order** (`council/fills.mjs` `SLIP_SPREADS` 0.5): the T3 entry,
  every stop exit (gap or touch) and every time exit. None on a limit: the T1 / T2 entry and every target exit.
- No financing: every trade is closed before the 17:00 New York rollover.
Gross R is reported beside net R; net R at twice the costs is part of the pass bar.

## Statistics and the pass bar

Three tests: **T1, T2, T3**, all primary. For each:
- t = mean / (sd / sqrt(months)) of net R summed per calendar month of entry (every month of the window counted, a month with
  no trade is 0); one-sided p from the normal approximation; **Holm over the three tests** on the OOS p.

A test **PASSES** only when all of these hold:
1. OOS n >= 100;
2. OOS month-sum t >= 2 and the Holm-adjusted p < 0.05;
3. IS mean net R a trade > 0 (the same sign);
4. OOS mean net R a trade at twice the costs > 0;
5. the OOS mean net R a trade is above at least 38 of the 40 placebo grids' OOS means (same rule and costs).

The study's verdict is PASS if at least one test passes, else FAIL. By side, by year, gross figures and exit counts are
reported and never judged.

## What it would and would not mean

A pass says that this mechanical reading of order clustering at round gold prices made money net of the stated costs on
OANDA mid M5 candles in both windows and beat random grids with the same spacing. It would not say that orders rest at any
level today, nor that it holds with other stops, targets or hours. A fail says these three fixed rules did not, and is not a
test of the order-flow evidence itself.

# Round numbers on four index CFDs (stall and break): pre-registration

Written and committed on 14 Nov 2026, before any candle of the test was read for this study and before any trade was
computed. Paper research only: no live rule, size, filter, cost model or mirror setting is changed by this study, whatever it
finds. A pass would only be a proposal to the owner for a paper shadow (`research/proposals/`), never a live change.

## Why, and what was tested before

Osler (2003, Journal of Finance, "Currency orders and exchange-rate dynamics: an explanation for the predictive success of
technical analysis") and Osler (2005, Journal of International Money and Finance, "Stop-loss orders and price cascades in
currency markets") report, from a bank's order book, that take-profit orders cluster at round numbers, so a move tends to
stall or reverse when it first reaches one, and that stop-loss orders cluster just beyond them, so a move that crosses one
tends to continue. `research/edge/fx-round-numbers` (#931, branch `fx-round-numbers`) tested both on four forex majors:
**FAIL, 0 of 2** (T1 stall 2016 on −0.120R a trade net, n 5,966, t −8.40; T2 break −0.112R, n 9,341, t −9.75). No study in
this repository has tested round numbers on equity indices (`gold-round-stop` is gold only). This study is the index
counterpart: the same two readings (fade the first touch; follow the close beyond), the same touch, side, gap, fill and
stop-first conventions as fx-round-numbers, with distances scaled by each market's daily ATR instead of fixed pips, and
trades closed by the end of the cash session.

## Data

- OANDA mid **M5** candles through the council's keyless proxy (`/md/bars?sym=<key>&tf=5m&from=&to=`, 4,999-candle windows,
  paced, as `research/edge/trend-breadth-h1/fetch.mjs` pages), from 2015-12-01 to the start of the UTC day the run is made.
  Complete candles only. Files kept outside git.
- Markets (OANDA keys of `api/_oanda.js`), named here before any result: **`nas100`, `spx500`, `us30`, `de40`**.
- **In sample (IS): trades entered 2016-01-01 to 2020-12-31. Out of sample (OOS): 2021-01-01 to the end of the file.**
- All times UTC unless a session is named. A candle belongs to a time by its open time.

## Sessions and the daily ATR

- **Session** = the cash session in local time: `nas100`, `spx500`, `us30` 09:30-16:00 New York (US daylight-saving rule:
  second Sunday of March to first Sunday of November); `de40` 09:00-17:30 Frankfurt (EU rule: last Sunday of March to last
  Sunday of October, at 01:00 UTC). A candle is in the session when it opens at or after the session open and before the
  session close. Days with no candle in the session have no trade.
- **Daily ATR** for a session = the mean true range (high − low, widened to the previous day's close) of the **14 UTC
  weekdays before the session's UTC date**, from daily candles built out of the same M5 file (UTC days, Saturday and Sunday
  candles dropped). No session is traded before 15 weekdays of candles exist. Written `A` below.

## The levels

- Grid step `G`: **nas100 500, spx500 100, us30 1000, de40 1000** index points.
- **Real levels ("round")**: every multiple of `G`.
- **Secondary ("half")**: the same grid shifted by half a step (nas100 250, 750, ...). Tested with the same rules and in
  the Holm family; it cannot decide the verdict (see the pass bar).
- **Placebo**: for seed s = 1..40, mulberry32 seeded with s alone gives one shift `u` per market, in the market order above
  (draws repeated until `u` lies in [0.05, 0.45] or [0.55, 0.95], so a placebo grid is never within 5 % of a step of the
  round or half grid); placebo levels = `(k + u) x G`. The full rules, costs and statistics are run on each placebo.
- A candle **touches** level L when `low <= L <= high` (within 1e-9).

## Rule T1: stall (fade the first touch in the session)

- Candle c in the session, not the session's first candle (the previous candle p is also in the session).
- **First touch**: no earlier candle of this session touched L.
- **Side**: p.close below L = price comes from below: **sell**; above L: **buy**; equal: no trade.
- **Approach**: from below, `L − (lowest low of the session's candles before c) >= 0.5 x A`; from above,
  `(highest high of those candles) − L >= 0.5 x A`. Otherwise no trade.
- **Entry**: a resting limit at L, filled on c at L; when c opens beyond L (a gap past the level), at its open. No trade
  when c opens at or beyond the stop.
- **Stop** = L + 0.25 x A (sell) / L − 0.25 x A (buy). **Target** = L − 0.5 x A (sell) / L + 0.5 x A (buy).
  `r0 = |fill − stop|` = 1R.
- **In the fill candle only the stop is checked** (fx-round-numbers' convention). From the next candle: an open at or
  beyond the stop exits at that open, at or beyond the target exits at that open; else the stop is checked first, then the
  target (both in one candle: the stop).
- **Time exit**: at the close of the last candle opening before the session close.
- One T1 trade per level per session. Several levels touched by one candle: each is its own trade.

## Rule T2: break (follow the first close beyond)

- Candle c in the session with the previous candle p in the session. **Break up of L**: `c.close >= L + 0.05 x A`,
  `p.close < L + 0.05 x A`, and `min(c.low, p.low) <= L`; L = the highest level with `c.close >= L + 0.05 x A`. **Break
  down** mirrored (`c.close <= L − 0.05 x A`, `p.close > L − 0.05 x A`, `max(c.high, p.high) >= L`, the lowest such L).
- **Entry**: at market at the next M5 candle's open, which must be in the session; buy after a break up, sell after a break
  down. **Stop** = L − 0.1 x A (buy) / L + 0.1 x A (sell). No trade when the entry open is at or beyond the stop.
  **Target** = entry + 0.5 x A (buy) / entry − 0.5 x A (sell). `r0 = |entry − stop|`.
- The entry candle is checked for both (stop first); then each candle: an open at or beyond the stop or target exits at the
  open; else stop first, then target. Time exit as T1.
- One T2 trade per level per session (the first break of that level in the session, whichever side).

## Costs (net R)

A round trip in index points, charged on every trade and divided by `r0`: **nas100 2.0** (`orb-nas100`,
`pre-fomc-drift`), **spx500 1.0**, **us30 5.5**, **de40 2.0** (`open-run-breadth` `lib.mjs`). No financing: every trade is
closed by the session close, before the 17:00 New York rollover (de40 closes 17:30 Frankfurt, before it too). Gross R is
reported beside net R; net R at twice the costs is part of the pass bar.

## Statistics and the pass bar

Four tests, the four markets pooled: **T1 round, T2 round (primary)**, T1 half, T2 half (secondary). For each:
- t = mean / (sd / sqrt(months)) of net R summed per calendar month of entry (every month of the window counted, a month
  with no trade is 0); one-sided p from the normal approximation; **Holm over the four tests** on the OOS p.

A primary test **PASSES** only when all of these hold:
1. OOS n >= 100;
2. OOS month-sum t >= 2 and the Holm-adjusted p < 0.05;
3. IS mean net R a trade > 0 (the same sign);
4. OOS mean net R a trade at twice the costs > 0;
5. the OOS mean net R a trade is above the 95th percentile (linear interpolation) of the 40 placebo means (OOS, same rule
   and costs).

The study's verdict is PASS if at least one primary test passes, else FAIL. A half-level test that meets the same bar is
reported as such, never as the verdict. Per market, per year, gross figures and exit counts are reported and never judged.

## What it would and would not mean

A pass says that this mechanical reading of order clustering at round index levels made money net of the stated costs on
OANDA mid M5 candles in both windows and beat random grids. It would not say that orders rest at any level today, nor that
it holds with other stops, targets or hours. A fail says these two fixed rules did not, and is not a test of the papers'
order-flow evidence itself.

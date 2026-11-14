# Gold: the opening-range breakout of the COMEX day session (pre-registration)

Written and pushed alone, before any trade of this study was computed. Paper research only.

**A new stand-alone intraday rule, not a gate, exit, entry or size of the live gold book** (Gold trend + Gold daily engulf).
Item 44 of `docs/owner-decisions.md` is respected: nothing here reads, filters or changes the book's trades, no candle before
2016 is read, and no live rule, config, council member or mirror setting changes whatever the result.

## Dedupe: what was already tested, and what is new here

Read before writing (RESULT.md of each, on its branch):
- `orb-nas100`: the 5-minute opening range of the US equity cash open (09:30 New York) on NAS100 / SPX500. FAIL (NAS100 +0.075R
  net, t 1.27; SPX500 −0.053R). Another market, another open.
- `gold-asia-break`: the Asian range (00:00-06:59 London) broken into London. FAIL. Another range, another session.
- `gold-session-drift`: unconditional session holds. FAIL. No range, no break.
- `intraday-momentum` / `metals-intraday-momentum`: the sign of gold's 08:20-08:50 move traded 13:00-13:30. FAIL. It uses the
  same first half hour as a SIGNAL for the last half hour, not a range break traded the same morning.
- `gold-lbma-fix`: the run into and the fade after the London PM auction (15:00 London ≈ 10:00 New York). FAIL.
- `gold-late-ny` (pre-registration only): the 13:30-16:30 afternoon as a signal for the Asian session.
- `ict-silver-bullet-gold`: a sweep + fair value gap entry in a one-hour window (10:00-11:00 New York). FAIL, 0 of 3.

None of them trades **a breakout of the range of the first 30 minutes of the COMEX gold day session (08:20-08:50 New York)**
on the same morning. That is the question here.

## Question

On spot gold, does the first M5 close outside the 08:20-08:50 New York range point the morning, after costs: continuation
(breakout) or reversal (fade)?

## Data (named before any result)

- One market: **XAU/USD spot, OANDA mid M5**, through the site's keyless candle proxy (`https://meridianx.dev/md/bars`,
  `research/edge/gold-comex-orb/fetch.mjs`; the cache stays out of git). Candles from 20 Dec 2015 are read; trading days from
  4 Jan 2016. No candle before 2016 is used for any trade.
- New York wall-clock time and the CME calendar from `ict/calendar.mjs` (read only: `nyParts`, `dayInfo`, `cmeShut`). Days
  traded: Monday-Friday whose CME kind is `open`; **full holidays and early-close days are skipped**.
- A day needs all six range candles (08:20 … 08:45 starts) and at least 30 of the 38 candles 08:50-11:55; else it is skipped
  and counted.

## The rule (common to the tests)

- **Range**: high and low of the six M5 candles starting 08:20 to 08:45 New York. Width = high − low (must be > 0).
- **Break**: the first M5 candle starting 08:50 to 11:25 (it closes by 11:30) whose CLOSE is above the range high (up) or below
  the range low (down). One break a day; no break, no trade.
- **Entry**: at market, the OPEN of the next M5 candle.
- **Exit management** (every trade has a stop): a candle that gaps through the stop fills at its open; a candle that reaches
  both stop and target is a stop (stop first); the entry candle itself can stop or reach the target; otherwise out at the
  close of the 11:55 candle (12:00 New York). One trade a day.
- **Costs**: $0.30 a round trip per ounce (the spot gold spread used by `gold-systems` / `spreadOf`) plus half a spread
  ($0.15) of slippage per market order: the entry always, the exit when it is a stop or the 12:00 time exit (a target is a
  limit, no slippage). So $0.45 for a target exit, $0.60 otherwise. R = price move / risk at entry. Reported also at 2x costs.
  No financing: every trade is flat by 12:00 New York, before the 17:00 rollover.

## The three tests (fixed now)

- **T1 (primary) — breakout**: trade in the break's direction; stop at the OPPOSITE side of the range (a buy's stop = range
  low); target 2R. A trade whose entry open is already at or beyond the stop (risk ≤ 0) is skipped and counted.
- **T2 — breakout on a narrow range**: T1, only on days whose range width is under the median width of the previous 20
  trading days that had a range (strictly earlier days; the first 20 days are warm-up).
- **T3 — fade of the first break**: trade AGAINST the break; stop at the most extreme price from 08:20 through the break
  candle on the break side (a sell after an up break: stop = highest high 08:20 → break candle); target 1R. Risk ≤ 0 skipped.

## Windows and statistics

- In sample 2016-01-01 → 2020-12-31; **out of sample 2021-01-01 → 2026-11-13 (decides)**.
- Net R a trade, gross R a trade, win rate, exits by kind, total R, worst drawdown, by year, by side.
- **t on calendar-month sums** of net R (a month with no trade is not a row). One-sided p from the normal tail.
  **Holm** over the three tests' out-of-sample p.
- **Placebo, 40 seeds**: the T1 rule with the 30-minute range starting at a random 5-minute mark between 03:00 and 13:00 New
  York, drawn once a day per seed (break window the next 160 minutes, exit 190 minutes after the range ends, the same offsets
  as 08:50 → 11:30 → 12:00), out-of-sample days only; one mean net R a trade per seed. Each test is compared with the 95th
  percentile of the 40 seed means.

## Pass bar (per test; all must hold)

1. Out-of-sample net R a trade > 0;
2. out-of-sample month-sum t ≥ 2 and Holm-adjusted p < 0.05;
3. in-sample net R a trade > 0 (same sign);
4. out-of-sample net R a trade still > 0 at 2x costs;
5. out-of-sample net R a trade above the placebo's 95th percentile.

The study passes when T1 passes. T2 and T3 are reported with their own checks; a pass of T2 or T3 alone is named as such and
is a hypothesis, not an edge. Whatever the result: nothing live changes; a pass would at most be written as a proposal for the
owner.

## Not changed after this file

The range times, break window, exit time, stops, targets, costs, windows, placebo and pass bar above. Any later idea is
reported apart as not pre-registered.

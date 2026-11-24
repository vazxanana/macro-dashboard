# Pre-registration: do the Equinox fades do better on range days than on trend days? (24 Nov 2026)

Written and pushed alone, before any number of this study is computed. Research only: nothing live changes, nothing is proposed.

## Why

A fade sells strength and buys weakness; it should pay most when the market is going nowhere and least when it trends. The
Equinox page carries three fades, each a cell of a study that passed before costs and loses after costs:

- **F1 Break fade**: `grid7-wide-fade` cell `m15 none atr 2R all` (confirmation 2015-26: +0.042R before costs, -0.118R after).
- **F2 Big-candle fade**: `big-candle-fade` cell `m15 k1.5 nobreak half` (+0.193R before, -0.246R after).
- **F3 Round-number fade**: `round-number-breaks` cell `fade other 2R` (+0.051R before, -0.307R after).

What is already known, said so this is not a re-test in disguise: `fade-conditions` split F1 by a 20-day efficiency-ratio band
(x with / against the 20-day direction) and found nothing out of sample (best minus worst level, Holm 0.45); its level table shows
range (ER < 0.2) and trend (ER > 0.4) days within 0.01R of each other. `fade-mtf-context` found no higher-timeframe split of F1;
`regime-switch-book` found no H4 regime label that rescues the overnight methods; `metals-fade-clean-trend` and `gold-drd-er` read
ER on daily candles for other rules. Not yet asked: F2 and F3 by any range measure; any fade by how far TODAY has already moved
against its normal daily range; and, for any of them, whether the range-day subset is positive AFTER costs (the only thing that
would matter). F1 x ER is kept as a test because the after-cost subset was never judged; it is expected to fail.

## Rules (imported, never edited)

Each rule's own signal and exit code: `grid7-wide-fade` `signals` / `exits` (with `fade-conditions`' trade loop for F1, which
reproduces the grid's counts), `big-candle-fade` `signals` / `trade`, `round-number-breaks` `events` / `simEvent` (kind fade,
fill outside 07-17 UTC = `sessionOf` 2). Ten markets (`grid7-wide-core` `MARKETS`: xau xag eurusd gbpusd usdjpy audusd nzdusd
usdcad usdchf eurjpy), OANDA mid 5-minute candles from the shared cache, the data-quality exclusions, every trade's stop on the
losing side, a trade the parent could not resolve dropped as the parent drops it. Market entry at the next 5-minute open.

**Gate**: unsplit, each rule's n and mean R before costs in both windows must equal its parent's result.json (n exact, mean within
0.0005R). A failed gate = INCONCLUSIVE, nothing judged.

## The two range measures (fixed now; closed candles only, known at the signal candle's close `ts`)

Days = `edgekit` `dailyNY` (17:00 New York trading days, weekend candles folded into Monday), built from the 5-minute candles.

- **M1 ER20**: the last 21 CLOSED days (end <= ts), closes c0..c20; ER = |c20 - c0| / sum |c(i) - c(i-1)|. **Range day ER < 0.2,
  trend day ER > 0.4** (the bands `fade-conditions` and `gold-drd-er` used); 0.2-0.4 reported, in neither group. Fewer than 21
  closed days: no level.
- **M2 day range so far**: (highest high - lowest low) of the 5-minute candles of the CURRENT trading day that closed by ts (from
  the day's first candle), divided by the daily ATR14 = mean true range of the 14 closed days before it. **Range day < 0.5, trend
  day > 1.0**; 0.5-1.0 reported only. Fewer than 15 closed days, or no candle of the day closed yet: no level.

## Tests (six: 3 rules x 2 measures)

Windows by fill time: **discovery 2005-01 to 2014-12, confirmation 2015-01 to 2026-10** (the parents' windows, so the gate holds).
Costs: the parents' flat round trip per market (`combo-grid-2` `COSTS`: the demo's figures for gold and the four majors; **ASSUMED,
not measured** for xag, nzdusd, usdcad, usdchf, eurjpy), as cost / risk in R. A test passes only if ALL hold:

1. n >= 200 range-day trades in each window;
2. range-day mean R AFTER costs > 0 in discovery AND in confirmation;
3. range-day month-sum t AFTER costs >= 2 in confirmation, and its one-sided p, Holm-adjusted over the six tests, < 0.05;
4. range minus trend, BEFORE costs, > 0 in both windows with t >= 2 in confirmation, where the statistic is hour-stratified: in
   each calendar month, the difference of mean R inside each 4-hour UTC block of the fill where both groups traded, averaged with
   weight min(n range, n trend); t over the months (this removes the time-of-day mix, which M2 carries by construction);
5. **placebo**: the measure's values shuffled among the same rule's trades within each market and calendar year (40 seeds, fixed);
   the real confirmation statistic of (4) must beat at least 38 of the 40.

Verdict: PASS if at least one test passes all five, FAIL otherwise, INCONCLUSIVE if the gate fails or fewer than 8 markets load.

## Reported, not tested

Every level (range / mid / trend) of both measures per rule and window, before and after costs; the same per market; the
measures' hour mix.

## Limits stated now

The flat cost understates the true cost outside London / New York hours (F3 trades only there; `fade-late-hourcost` measured the
broker's hourly spreads and found the late fade negative); a PASS here would still be one cost model and would need the broker's
hourly spreads and its own forward record. A before-cost tilt is not an edge. No other cut points, measures or windows will be run.

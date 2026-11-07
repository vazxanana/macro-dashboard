# Pre-registration: does the live ICT A-setup rule hold on 2008-2017, data it has never seen?

Written on 7 Nov 2026, **before any 2008-2017 signal or trade was generated**. Only the candle download
(`fetch.mjs`) and a coverage probe (candle counts per day, no prices read for any signal) had run when this was committed.
Nothing below may change after the first computation. The test runs once and its result is reported whatever it is.

## Why

The ICT desk (H1 iFVG model, A-setups on NQ, ES, YM, RTY, GC) is positive after costs on 2018-2026
(`research/edge/ict-universe`, `research/edge/ict-smile`: about 1,300 A-setups on HistData cash/spot). The robustness audit
(`research/robustness.md`) still marked it **fragile**:
- NQ: t 1.8 out of sample, deflated Sharpe 0.18, sensitive to the pivot width.
- GC: the gold rule was chosen on 2019-26 spot gold, so no untouched data existed for it.
- The index A-rule was developed on 2023-26 cash indices, so the 2018-26 "out-of-sample" years were partly seen.

2008-2017 was used by none of these. It holds very different regimes: the 2008 crash, the 2009-11 gold bull, the 2013-15
gold bear, the 2010-17 low-volatility equity bull. It is the cleanest test the desk's rule can get.

## Data (fixed now)

- **Source.** OANDA 5-minute mid candles through the site's own keyless proxy `https://meridianx.dev/md/bars`
  (`api/bars.js`), the same source and path as `research/edge/nq-open-oos` (#511) and the desk's paper markets. No monthly cost.
  Downloaded by `fetch.mjs` from 2007-06-01 (warm-up) to 2026-11-01 into a scratch cache that is not committed.
- **Markets and stand-ins.**

  | desk market | stand-in (OANDA) | rule set (unchanged, as the desk runs it) |
  |---|---|---|
  | GC | XAU_USD spot gold | gold aRule: buys, stop 0.3-0.75x daily ATR, size 1, no break-even |
  | NQ | NAS100_USD index CFD | index default: against daily bias, grade ≥ 7, stop 0.3-0.75x ATR (+ tight A+ at half size), DOL sizing, break-even at +1.5R |
  | ES | SPX500_USD index CFD | index default |
  | YM | US30_USD index CFD | index default |
  | RTY | **none** | no free pre-2018 source reachable (see below); RTY is left out |

- **RTY.** The proxy has no Russell 2000 symbol (`us2000` is answered "unknown sym": OANDA's US2000_USD is not in
  `api/_oanda.js`, and adding it would need a site deploy). Dukascopy's datafeed is not reachable from the sandbox ("fetch
  failed"). HistData has no Russell instrument. council-data `research/candles/` holds no RTY. So 4 markets are tested.
- **Candle handling, as the live futures feed.** Every 5m candle in the CME halt hour or a CME weekend/holiday closure is
  dropped (`inHalt(t) || cmeShut(t)`, imported from `ict/tracker.mjs`, the filter the CNBC futures feed applies). H1 = the 5m
  candles aggregated by UTC hour (`agg()` from the tracker). D1 = `dailyNY(H)` from the tracker (17:00 New York rollover,
  DST-aware). 5m is used for exits on UTC days with ≥ 200 5m candles (the replay's rule), H1 otherwise.
- **Known cash/spot vs futures differences** (declared, not corrected): mid quotes with no spread (costs added below);
  OANDA CFDs carry a basis to the futures and have no contract roll; CME's historical session layout differed (for example
  the 16:15-16:30 ET daily equity-futures halt of those years), while only the 17:00 hour is dropped here, as live;
  OANDA's overnight quotes before about 2012 are thinner (fewer 5m candles per day), which makes some Asia-hour H1 candles
  from fewer quotes. Coverage per market and year is reported with the result. No market-year is dropped for coverage.

## Code (the live path, imported, unchanged)

- `signals()`, `isASetup()`, `isAPlus()`, `sizeOf()`, `MIN_GRADE`, `MARKETS`, `inHalt()`, `cmeShut()`, `agg()`, `dailyNY()`
  from `ict/tracker.mjs`, and `simulate()` from `ict/replay.mjs` (post-#413 gap guard). `M = MARKETS[key]` for each market
  (its tick and aRule), and `isASetup(g, key)` / `sizeOf(g, key)` with the desk's own key (gc, nq, es, ym).
- Signals of both sides with `grade.total ≥ MIN_GRADE`, sorted by close. Busy rule as `replay.mjs`: one trade per market;
  an A-setup is blocked only by an open A-setup. A trade the gap guard rejects (`simulate()` returns null) is skipped.
- The NFP-morning exclusion uses the tracker's own fallback (first Friday of the month) because `council/events.mjs` does
  not reach back to 2008; that is what the live code does outside the calendar's range.
- **Sample.** Every closed A-setup whose signal H1 candle closes from **2008-01-01 00:00 UTC to 2017-12-31 23:59 UTC**.

## Costs and R

- One round trip in price units: **GC 0.50**; **NQ, ES 0.0002 x price + 0.25**; **YM 0.0002 x price + 1** (one YM tick).
  These are ict-universe's costs (YM added the same way). Cost in R = cost / the trade's own risk r0.
- **Net R = size x (R per unit − cost in R)**. Primary = costs x1. Costs x2 are reported.

## The test (one primary hypothesis)

Pooled over the four markets, each with its desk rule set, all closed A-setups in the sample, net R at costs x1.

**ROBUST** if all three hold:
1. **P1.** Pooled net expectancy > 0 **and** t ≥ 2.0 (t = mean / (sd / √n) over trades).
2. **P2.** Both calendar halves positive: net expectancy > 0 in 2008-2012 **and** in 2013-2017 (by signal close year).
3. **P3.** At least **3 of the 4** markets have net expectancy > 0.

**REGIME-BOUND** if not robust, but the edge shows up strongly in only part of the sample: one half has net expectancy > 0
with t ≥ 2.0 while the other half's net expectancy is ≤ 0, **or** P1 holds and P2 or P3 fails.

**FAILS** otherwise. This includes "positive but not significant" (pooled > 0, t < 2, neither half t ≥ 2), which is
reported as such, but it is not a pass.

## Reported, not part of the verdict

- By year, by market, by grade tier (A+ vs plain A on the indices; gold has no A+ tier), by side, by half.
- Costs x1 and x2, gross R, win rate, max drawdown (pooled net equity in close order) and the worst losing streak.
- A dependence check: t of the monthly sums of net R (indices trade together, so trades are not independent). If it is
  below 2 while P1's trade t is ≥ 2, the report says so.
- GC drift control, as ict-universe: random H1-close gold buys (about 1 in 25 candles, fixed seed), stop 0.3-0.75x the
  daily ATR, the gold exit, the same costs; GC A-setups minus the control's mean for the same year ("drift-adjusted").
  2008-2017 holds both a gold bull (2008-11) and a bear (2013-15), so this shows whether the gold rule is more than being long.
- **Comparison window.** The same script, unchanged, on the same OANDA data for 2018-01-01 to 2026-10-31, next to the
  HistData figures in ict-universe. This checks that the data source does not change the 2018-26 picture. It is a
  reference, not a second test.

## What will not happen

- No parameter, rule, filter, cost or window is changed after the first computation. No market is dropped for its result.
- No live rule, config, tracker or replay code changes. Paper research only.

# Pre-registration: the unchanged ICT A-setup rule on the nine markets #545 could not test

Written on 8 Nov 2026, **before any signal or trade on the markets below was generated**. Only the candle download
(`research/edge/ict-oos-2008/fetch.mjs`, unchanged, into the #545 cache) and a coverage probe (5m candles per UTC day, timestamps
only, no prices read) had run when this file and `run.mjs` were committed. Nothing below may change after the first computation.
The test runs once and its result is reported whatever it is.

## Why

`research/edge/ict-breadth` (#545) tested the desk's A-setup rule, unchanged, on every market the keyless OANDA proxy served beyond
the desk's own: DAX, silver and nine FX pairs. All failed in both decades. It had to skip uk100, jp225, au200, eu50, hk33, cn50,
us2000, xpt and xpd because `api/_oanda.js` did not map them. Since #553 the proxy serves 75 markets, these nine among them. This is
the **same pre-registered design re-run on those nine markets**: same rule mapping, same windows, same costs model per asset
class, same bar, same harness. The question is unchanged: is there a general ICT edge, or only a 2018+ US-index/gold one?

## Markets (probed 8 Nov 2026 through `https://meridianx.dev/md/bars`)

| key | OANDA | rule | tick / dec | 1d history | 5m history | quoted hours a day (5m candles, median) |
|---|---|---|---|---|---|---|
| uk100 | UK100_GBP | index | 0.1 / 1 | 2003-03 | 2005-03 | 114-156 (2008-14), 168 (2015), 235-240 (2016+) |
| jp225 | JP225_USD | index | 0.1 / 1 | 2003-03 | 2005-03 | 135-150 (2008-11), 219 (2012), 255-276 (2013+) |
| au200 | AU200_AUD | index | 0.1 / 1 | 2004-03 | 2005-03 | 135-176 (2008-12), 18 (2013: half the days have 2 candles), 232-246 (2014+) |
| eu50 | EU50_EUR | index | 0.1 / 1 | 2003-09 | 2005-03 | 67-100 (2008-12), 131-166 (2013-18), 180-237 (2019+) |
| hk33 | HK33_HKD | index | 0.1 / 1 | 2003-02 | 2005-03 | 55-72 (2008-13), 144-153 (2014-17), 168-192 (2018+) |
| cn50 | CN50_USD | index | 0.1 / 1 | **2011-08** | **2011-08** | 69-112 (2011-14), 159-183 (2015-17), 227-231 (2018+) |
| us2000 | US2000_USD | index | 0.01 / 2 | 2003-03 | 2005-03 | 209-276 |
| xpt | XPT_USD | gold | 0.01 / 3 | 2005-01 | 2005-03 | 161-216 (2007-09), 211-276 (2010+) |
| xpd | XPD_USD | gold | 0.01 / 3 | 2005-01 | 2005-03 | 95-191 (2007-11), 227-276 (2012+) |

Nothing is dropped for its coverage: cn50's window A is 2011-08 to 2017 (declared, partial); hk33 and eu50 were quoted 5-8 hours
a day in 2008-13. The tick only sets the stop's 2-tick buffer under the sweep; `dec` is display rounding.

## Rule mapping, costs (fixed now; #545's, unchanged)

Rule sets are the desk's own, unchanged (see #545's preregistration): **indices get the index rule** (the tracker's default for a
market without an aRule: against the daily bias, grade >= 7, stop 0.3-0.75x the daily ATR, tight A+ at half size, DOL sizing,
break-even at +1.5R, NFP-morning exclusion); **metals get the gold rule** (GC's aRule: buys, stop 0.3-0.75x the daily ATR, size 1,
no break-even), as the tracker's own silver shadow market.

Costs are one round trip (spread + slippage) in price units, converted to R with each trade's own risk. Net R = size x (R per unit
- cost/r0). Costs x2 and gross are reported for every cell.

| asset class | round-trip cost | note |
|---|---|---|
| indices (7) | **0.02% of price + 1.0 point** | #545's DAX model, as the task fixes it for the class; e.g. FTSE 8,000: 2.6 pt; Nikkei 40,000: 9 pt; Russell 2,000: 1.4 pt; Hang Seng 20,000: 5 pt |
| platinum | **0.30% of price** | silver's model (0.03 spread + 0.01 slippage = spread x 4/3) scaled to platinum's typical OANDA spread, ~0.22% of price (~$3 at $1,400) |
| palladium | **0.80% of price** | the same, palladium's typical OANDA spread ~0.6% of price (~$6 at $1,000; it is the least liquid of the four metals) |

The metal costs are a share of price, not a fixed amount as silver's 0.04, because platinum ranged $750-2,250 and palladium
$170-3,000 over 2008-26; a fixed amount would be 5% of price in 2008 for palladium. Both are heavy relative to the stop (silver's
0.04 was ~0.19R a trade); that is the reality of these CFDs, and gross is reported next to net.

## Data and harness (fixed now)

- OANDA 5m mid candles from 2007-06-01 (warm-up) to 2026-11-01, fetched with #526's `fetch.mjs` unchanged into the #545 cache.
- Harness = #545's `research/edge/ict-breadth/run.mjs`, **extended, not forked**: its body is now the exported `run(cfg)`; its
  CLI default is the #545 universe unchanged, and `research/edge/ict-breadth-2/run.mjs` only hands it this study's universe,
  sets and sensitivities. Same desk code (`signals`, `isASetup`, `isAPlus`, `sizeOf`, `MIN_GRADE`, `inHalt`, `cmeShut`, `agg`,
  `dailyNY` from `ict/tracker.mjs`; `simulate()` from `ict/replay.mjs`), same candle filter, same busy rule, same statistics.
- **5m exits: complete-day test.** #526 uses 200 candles a UTC day (a 24-hour futures day); #545 gave the 14-hour DAX 150. These
  CFDs were quoted 5-14 hours a day in 2008-13 and 20-23 hours now (table above), so a fixed number is wrong in one decade or the
  other. **Fixed now, for every market here: a UTC day is complete when it has >= min(200, round(0.9 x that calendar year's median
  candles a day))**, computed from timestamps only. Days below it get H1 exits, as #526. Every market is also run with the
  unchanged 200 test as a reported sensitivity (as #545 did for the DAX).
- Two additions to the harness, both reporting only: `m5min: 'adaptive'` (above) and a **two-sided random-entry control** for
  the index-rule markets (random H1-close entries, ~1 in 25 candles, fixed seed, random side, stop 0.3-0.75x the daily ATR14,
  the index exit with its break-even, the same costs). The gold-rule markets keep #526's buys-only control. The drift-adjusted
  figure = A-setups minus the control's mean net R for the same market and year.
- **The desk's reference set (GC/NQ/ES/YM) is re-run in the same pass and read first.** #561 (merged after #545) wired the CME
  holiday / early-close calendar into `cmeShut()`, so today's desk code drops a few more candles than #545's did. The reference
  row is therefore reproduced two ways before any new-market number is read: (1) #545's `run.mjs` at its own commit (ade8489a)
  over the same cache, which must give #545's figures exactly (window A -0.013R, n 2,235; window B +0.093R, n 1,786); (2) the
  extended harness with today's desk code (the figure every new market here is computed with), expected to differ only in the
  last digits. Both are reported. The new markets are read only after (1) reproduces.
- Known differences (declared, not corrected): mid quotes (costs added); CFDs and spot, no roll; short quoted days in 2008-13
  (the 96-candle H1 look-back then spans more calendar days, and the daily bias comes from fewer hours); cn50 from 2011-08; the
  NFP filter uses the tracker's first-Friday fallback before the event calendar's range (live behaviour); the rule's sessions
  are New York sessions for every market, as the tracker computes them (Asian/European cash hours fall into "Asia"/"London").

## Windows (fixed now; #545's)

- **Window A: 2008-01-01 00:00 UTC to 2017-12-31 23:59 UTC** (signal H1 close). Untouched for every market here.
- **Window B: 2018-01-01 to 2026-10-31.** Untouched for every market here too (none of these nine was in ict-universe or
  ict-markets); the rule itself was built on US indices 2023-26 and gold 2019-26.
- Halves, reported: A = 2008-12 / 2013-17; B = 2018-21 / 2022-26.

## The test (#545's bar, unchanged)

For a market set with K markets and each window w in {A, B}, A-setups only, net R at costs x1:
- **P_w:** pooled net expectancy > 0 **and** t >= 2.0 (t = mean / (sd / sqrt n) over trades).
- **M_w:** at least ceil(0.6 K) markets with net expectancy > 0.

Verdict per set: **PASS** = P_A and M_A and P_B and M_B (labelled **PASS (cost-fragile)** if the pooled net at costs x2 is <= 0 in
either window); **2018+-ONLY** = window B passes, A fails; **2008-17-ONLY** = the reverse; **FAIL** otherwise ("positive but not
significant" is noted, not a pass).

**Primary hypothesis = all nine new markets pooled** (K 9, so >= 6 of 9 positive in both windows). Secondary, each with its own
verdict: **H1 = the seven indices** (>= 5 of 7) and **H2 = the two metals** (2 of 2). Reported without a verdict: the desk
reference set, which must reproduce #545 as above.

- Primary PASS -> the ICT A-setup rule has an edge beyond the US indices and gold, in both decades: a general edge.
- Primary 2018+-ONLY -> the edge reaches other markets but only in 2018+: a regime, not a US-index artefact.
- Primary FAIL or 2008-17-ONLY -> no evidence of a general edge; #545's answer stands on 20 markets instead of 11.

## Reported, not part of any verdict

- Per market and per set: n, win rate, expectancy, total R, max drawdown, worst losing streak, t; costs x2; gross; halves;
  buys vs sells; every signal (grade >= 3, no A filter); by year; the monthly-sum t (months without a trade count as 0).
- Drift control for every market (buys for the metals, two-sided for the indices) and the drift-adjusted expectancy; the task
  asks for it on any positive cell, it is computed for all so the negative cells have it too.
- Every market with the fixed 200-candle day test.

## What will not happen

- No rule, parameter, filter, cost, market, mapping or window changes after the first computation. No market is dropped.
- No live rule, config, tracker, replay or site code changes. Paper research only. Anything that passes becomes at most a
  written proposal or a paper shadow stream for the owner to decide.

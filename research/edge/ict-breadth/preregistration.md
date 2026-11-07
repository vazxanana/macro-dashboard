# Pre-registration: does the unchanged ICT A-setup rule work on markets the desk was never tuned on?

Written on 7 Nov 2026, **before any signal or trade on the markets below was generated**. Only the candle download
(`research/edge/ict-oos-2008/fetch.mjs`, unchanged) and a coverage probe (5m candles per UTC day, no prices read for any signal)
had run when this file and `run.mjs` were committed. Nothing below may change after the first computation. The test runs once
and its result is reported whatever it is.

## Why

The desk's A-setup rule is positive on 2018-26 on its own markets but fails on 2008-17 (#526, `research/edge/ict-oos-2008`:
−0.013R a trade, t −0.45). Every live edge found so far is regime-bound. The open question this test answers:
**is there a general ICT edge (other markets, both decades), or only a 2018+ US-index/gold one?**

## Which markets exist (probed 7 Nov 2026)

The free OANDA path is the site's keyless proxy `https://meridianx.dev/md/bars` (`api/_oanda.js`). Probed with
`?sym=<sym>&tf=1d&n=5`:

| asked for | proxy answer | history (1d / 5m) |
|---|---|---|
| de30, uk100, jp225, au200, eu50, xpt, xpd, xcu, hk33, cn50, us2000 | `unknown sym or tf` (not in `api/_oanda.js`) | none |
| **de40** (OANDA DE30_EUR, the DAX CFD) | served | 1d from 2004-01; 5m from 2005 |
| **xag** (XAG_USD spot silver) | served | 1d and 5m from 2007-01 |
| eurusd, gbpusd, audusd, nzdusd, usdcad, usdchf, usdjpy, eurjpy, gbpjpy | served | 1d from 2004; 5m from 2005 or earlier |
| xau, nas100, spx500, us30 | served | the desk's own markets (#526) |

Adding FTSE, Nikkei, ASX, Euro Stoxx or platinum would need a change to `api/_oanda.js` and a site deploy; that is not a
research change, so those markets are left out. **The only index/metal markets the desk has never been tuned on that the free
path serves are the DAX and silver.** Because two markets are thin, the nine FX pairs the proxy serves are added as a separate,
secondary breadth set. Nothing is dropped for its result.

## Market sets, rule sets, costs (fixed now)

Rule sets are the desk's own, unchanged. "index" = the tracker's default for a market without an aRule (as NQ/ES/YM):
against the daily bias, grade ≥ 7, stop 0.3-0.75x the daily ATR, plus the tight A+ (0.15-0.3x, body ≥ 60%, not NY PM) at
half size, DOL sizing (0.5x / 1.5x), break-even at +1.5R, NFP-morning exclusion. "gold" = GC's aRule: buys, stop 0.3-0.75x the
daily ATR, size 1, no break-even. The mapping is the one the desk itself uses: indices get the index rule; metals get the gold
rule (the tracker's own silver shadow market, `SHADOW_MARKETS.xag`, runs the gold rule); FX gets the default (index) rule.

Costs are one round trip (spread + slippage) in price units, in the same form as #526 (indices: a share of price plus a fixed
slippage; metals and FX: fixed), converted to R with each trade's own risk. Net R = size × (R per unit − cost/r0).

| set | market | OANDA | rule | tick / dec | round-trip cost | note |
|---|---|---|---|---|---|---|
| **H1 primary** | DAX | DE30_EUR | index | 0.1 / 1 | **0.02% of price + 1.0 pt** | ≈ 2.2 pt at 6,000, 4 pt at 15,000, 5.8 pt at 24,000 (ict-markets: 1.4 pt spread in Xetra hours, ~4 pt outside, + 0.5-1 pt slip) |
| **H1 primary** | Silver | XAG_USD | gold | 0.001 / 4 (`SHADOW_MARKETS.xag`) | **0.04** (0.03 spread + 0.01 slippage) | between ict-universe (0.03) and ict-markets (≈ 0.05) |
| H2 secondary | EUR/USD, AUD/USD | | index | 0.00001 / 5 | 1.5 pips (0.00015) | as ict-universe |
| H2 secondary | GBP/USD, NZD/USD, USD/CAD, USD/CHF | | index | 0.00001 / 5 | 2 pips (0.0002) | as ict-universe (NZD as GBP/CAD/CHF) |
| H2 secondary | USD/JPY | | index | 0.001 / 3 | 1.5 pips (0.015) | as ict-universe |
| H2 secondary | EUR/JPY | | index | 0.001 / 3 | 2 pips (0.02) | cross: wider |
| H2 secondary | GBP/JPY | | index | 0.001 / 3 | 3 pips (0.03) | cross: wider |
| reference | GC, NQ, ES, YM | XAU, NAS100, SPX500, US30 | as #526 | as #526 | as #526 | re-run in the same pass; must reproduce #526; not part of any verdict |

Costs x2 are reported for every cell. Gross is reported.

## Data and harness (fixed now)

- OANDA 5m mid candles from 2007-06-01 (warm-up) to 2026-11-01, the #526 cache, fetched with #526's `fetch.mjs` unchanged.
- Harness = #526's `run.mjs`, generalised in `research/edge/ict-breadth/run.mjs`: the same imports from `ict/tracker.mjs`
  (`signals`, `isASetup`, `isAPlus`, `sizeOf`, `MIN_GRADE`, `MARKETS`, `SHADOW_MARKETS`, `inHalt`, `cmeShut`, `agg`, `dailyNY`) and
  `simulate()` from `ict/replay.mjs`; the same candle filter (17:00 New York hour and CME closures dropped, as the live feed),
  H1 by UTC hour, D1 by the 17:00 New York rollover, the replay's busy rule (one trade per market; an A-setup is blocked only by
  an open A-setup), signals with grade ≥ `MIN_GRADE`.
- **5m exits.** #526 uses 5m exits on UTC days with ≥ 200 5m candles (a complete 24-hour futures day). OANDA's DAX CFD quoted
  only 14 hours a day until late 2018 (exactly 168 5m candles a day, coverage probe), so under the 200 test every 2008-18 DAX
  exit would fall back to H1. The test is about data completeness, not trading, so **for DAX a complete day is ≥ 150 5m
  candles**; every other market keeps 200. DAX with the unchanged 200 test is run as a reported sensitivity.
- Known differences (declared, not corrected): mid quotes (costs added); CFDs and spot, no roll; DAX quoted 14 h/day to 2018
  and ~20 h/day after (fewer H1 candles a day in 2008-18, so the 96-candle look-back spans more calendar days); the NFP filter
  uses the tracker's first-Friday fallback before the event calendar's range (live behaviour); the rule's sessions are New York
  sessions for every market, as the tracker computes them.

## Windows (fixed now)

- **Window A: 2008-01-01 00:00 UTC to 2017-12-31 23:59 UTC** (signal H1 close). Untouched for every market here.
- **Window B: 2018-01-01 to 2026-10-31.** Partly seen: silver 2018-26 and FX 2018-26 were run in `ict-universe` (silver lost
  2018-23, gained 2025-26; FX failed); DAX Oct 2024-Nov 2026 and silver/EUR/GBP/JPY were run in `ict-markets`; the silver shadow
  market was chosen on 2025-26. No rule was ever tuned on these markets, so window B is a test of the same rule, but not a blind one.
- Halves, reported: A = 2008-12 / 2013-17; B = 2018-21 / 2022-26.

## The test

For a market set with K markets and each window w ∈ {A, B}, A-setups only, net R at costs x1:
- **P_w:** pooled net expectancy > 0 **and** t ≥ 2.0 (t = mean / (sd / √n) over trades).
- **M_w:** at least ⌈0.6 K⌉ markets with net expectancy > 0 (H1: **both** markets; H2: **6 of 9**).

Verdict per set:
- **PASS** = P_A and M_A and P_B and M_B. Labelled **PASS (cost-fragile)** if the pooled net at costs x2 is ≤ 0 in either window.
- **2018+-ONLY** = not PASS, P_B and M_B hold, window A fails.
- **2008-17-ONLY** = not PASS, P_A and M_A hold, window B fails.
- **FAIL** otherwise ("positive but not significant" is noted, and is not a pass).

**Primary hypothesis = set H1 (DAX + silver).** It answers the question asked:
- H1 PASS → the ICT A-setup rule has an edge beyond the US indices and gold, in both decades: a general index/metal edge.
- H1 2018+-ONLY → the edge reaches other markets but only in 2018+: a regime, not a US-index artefact.
- H1 FAIL or 2008-17-ONLY → no evidence of a general edge; what the desk has is at best a 2018+ US-index/gold edge.

**Secondary = set H2 (nine FX pairs)**, same bar, its own verdict. Also reported without a verdict: all 11 new markets pooled,
and the desk reference set (which must reproduce #526: window A pooled −0.013R, n 2,235; window B +0.093R, n 1,786).

## Reported, not part of any verdict

- Per market and per set: n, win rate, expectancy, total R, max drawdown, worst losing streak, t; costs x2; gross; halves;
  buys vs sells; every signal (grade ≥ 3, no A filter); by year.
- Dependence check: t of the monthly sums of net R (months without a trade count as 0).
- Silver drift control (as #526's gold control): random H1-close silver buys (~1 in 25 candles, fixed seed), stop 0.3-0.75x the
  daily ATR, the gold exit, the same costs; silver A-setups minus the control's mean for the same year.
- DAX sensitivity with the 200-candle day test (H1 exits for 2008-18).

## What will not happen

- No rule, parameter, filter, cost, market, mapping or window changes after the first computation. No market is dropped.
- No live rule, config, tracker, replay or site code changes. Paper research only. Anything that passes becomes at most a
  written proposal or a paper shadow stream for the owner to decide.

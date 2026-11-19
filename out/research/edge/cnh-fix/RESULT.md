# The PBoC USD/CNY fix at 01:15 UTC: following or fading USD/CNH's first quarter hour after it (result)

Pre-registered in `PREREGISTRATION.md` (pushed alone on 14 Nov 2026 before any trade was computed); `run.mjs`, `fetch.mjs`,
`result.json`. Method copied from the `ecb-ref-fix` study (branch, not imported). Paper research only: nothing live changed.
**The fix level itself is not read** (no series of the fixings is available): this tests price behaviour around 01:15 UTC only.

**Verdict: FAIL.** No test is positive after costs in either window. In 2018-26 following USD/CNH's 01:15-01:30 UTC move loses
−0.548R a trade (n 1,667, month-sum t −7.65), fading it −0.406R (t −5.54), and the AUD/USD proxy −0.31R (n 1,664, t −4.72).
Before costs all three are slightly positive (+0.107R, +0.248R, +0.069R a trade; gross month-sum t 1.66, 3.78, 1.06), but the
same rule at other quarter hours of the Asian session is positive before costs too (placebo gross medians +0.04R, +0.16R,
+0.10R), so the gross figures are not a fix effect: following and fading are BOTH positive before costs, which a fixed 1R stop
with a 2-hour time exit gives when large moves run past 1R. The assumed USD/CNH round trip (about 9.2 pips) is 0.65R a trade
in 2018-26 and 1.5R in 2013-17, several times anything the clock rule earns. The replication (2013-17, 4.9 years) is not weak.

## What was run

USD/CNH and AUD/USD, OANDA mid **M5** candles through the site's proxy (`fetch.mjs`; files outside git; AUD/USD seeded from
another study's copy of the same proxy). USD/CNH M5 starts on 5 Feb 2011 and is sparse until 2013, so the first trade with a
20-day reference is on 25 Jan 2013. UTC clock (no daylight saving). Move M = close of the 01:25 UTC candle − open of the 01:15
candle; ref = median |M| of the 20 earlier weekdays with a move; event |M| > 0.5 × ref (72 % of days with a reference); a
market order at the open of the 01:30 UTC candle WITH M (T1), AGAINST M (T2), or on AUD/USD long AUD when CNH strengthens
(T3), stop 1 × the traded market's own ref, out at the close of the 03:25 candle. Funnel (all windows): 4,401 weekdays, 764
without a move (mostly 2010-12), 176 without a reference, 958 without an event, 29 (T3: 3) without the entry / exit candles.

## Costs used

- **USD/CNH: assumed, pre-registered**: council-data `ctrader/symbols.json` has no USDCNH (read 14 Nov 2026). Spread 3.0 pips
  a round trip + 3.0 pips slippage (half a spread on each market order) + 45 USD a million commission (`45e-6 × entry`), about
  9.2 pips a round trip at 7.1. In R: 0.654 a trade in 2018-26, 1.504 in 2013-17 (the 15-minute move was much smaller then).
- **AUD/USD: the raw-spread majors model** (0.3 pip spread + 0.3 pip slippage + `45e-6 × entry`): 0.378R a trade in 2018-26,
  0.310R in 2013-17.
- No financing (every position is closed by 03:30 UTC).

## Results

R a trade; t = t of calendar-month sums. Decisive = entries 2018-01-01 to 2026-11-13; replication = 2013-01-25 to 2017-12-29.

| Test | Window | n | Gross R a trade | Gross R total | Cost R a trade | Net R a trade | Net R total | Month t (net) | Month t (gross) | Net at 2x cost |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 USD/CNH follow | 2018-26 | 1,667 | +0.107 | +178.1 | 0.654 | −0.548 | −912.7 | −7.65 | 1.66 | −1.202 |
| T1 USD/CNH follow | 2013-17 | 807 | +0.194 | +156.2 | 1.504 | −1.31 | −1,057.3 | −5.03 | 1.51 | −2.814 |
| T2 USD/CNH fade | 2018-26 | 1,667 | +0.248 | +413.8 | 0.654 | −0.406 | −677.0 | −5.54 | 3.78 | −1.061 |
| T2 USD/CNH fade | 2013-17 | 807 | +0.165 | +133.5 | 1.504 | −1.338 | −1,080.0 | −5.73 | 1.52 | −2.842 |
| T3 AUD/USD proxy | 2018-26 | 1,664 | +0.069 | +114.7 | 0.378 | −0.31 | −515.1 | −4.72 | 1.06 | −0.688 |
| T3 AUD/USD proxy | 2013-17 | 836 | +0.271 | +226.5 | 0.310 | −0.039 | −32.9 | −0.36 | 2.52 | −0.35 |

Win rates 20-23 %; most trades end on their stop (T1 2018-26: 1,265 stops, 401 time exits, 1 gap).

Holm over T1-T3 (one-sided p of the decisive net t): p = 1, 1, 1; Holm-adjusted 1, 1, 1. No test meets condition 1 (net > 0
in both windows) or condition 2; all meet n ≥ 200. No near miss.

**Placebo (40 seeds, the same rule at random other quarter hours 23:00-05:45 UTC), decisive net R a trade**: T1 beats 40 of 40
seeds (seeds' 5th / 50th / 95th percentile −1.445 / −1.336 / −1.211R), T2 40 of 40 (−1.363 / −1.215 / −1.065R), T3 38 of 40
(−0.539 / −0.419 / −0.354R). That only says the 01:15 window is more active than other Asian quarter hours: its 15-minute
reference is larger, so the same pip cost is fewer R. **Added after the first result, reported only, not judged**: the same
seeds before costs, gross R a trade 5th / 50th / 95th: T1 −0.063 / +0.042 / +0.153 (the fix's +0.107 beats 29 of 40), T2
+0.028 / +0.156 / +0.313 (+0.248 beats 30 of 40), T3 −0.020 / +0.095 / +0.162 (+0.069 beats 15 of 40). Before costs the fix
quarter hour is not set apart from the rest of the session.

**Before / after the 11 Aug 2015 fix reform** (replication window, reported only): T1 −2.714R net (n 360, gross −0.209) then
−0.18R (n 447, gross +0.518, gross t 2.85); T2 −2.403R then −0.481R; T3 +0.096R (n 389, t 0.54) then −0.157R. The one
positive gross stretch (T1 after the reform, 2015-17) did not carry into 2018-26 (+0.107R gross, t 1.66).

**Years, net R a trade** (T1 / T2 / T3): no year is positive after costs for T2; T1 only 2020 (+0.103); T3 2013 (+0.004), 2014
(+0.316), 2016 (+0.047), 2020 (+0.008), 2023 (+0.047). Every year is in `result.json`.

## What this does and does not say

A plain clock trade on the quarter hour after 01:15 UTC, either way, on USD/CNH or on AUD/USD as a proxy, does not pay after
costs on OANDA mid prices, and before costs it is no different from the rest of the Asian session. Like the London 16:00 fix
(`wmr-fix-reversal`) and the ECB concertation (`ecb-ref-fix`), the cost is several times anything the moment shows. It says
nothing about the fix's surprise against the market's expectation (which this study could not read), about the first five
minutes after 01:15, or about a broker's real USD/CNH cost (assumed here; measuring it would only matter if the gross effect
were set apart from the placebo, and it is not). No proposal is written; nothing live changed.

To repeat: `node --use-env-proxy research/edge/cnh-fix/fetch.mjs <dir> [seedDir]`, then `node research/edge/cnh-fix/run.mjs run
<dir>`. Tests: `tests/cnh-fix.test.mjs`.

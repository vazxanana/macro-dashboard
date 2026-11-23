# Pre-registration: the Mosha sequence entries with the weekly side and a trending Daily (23 Nov 2026)

Written and committed alone, before any trade of this test is computed. The test runs once; nothing below is changed after a
result is seen. Paper research only: nothing live changes, no council member, mirror, config or desk reads the result.

## Why
A filter the owner's notes report as the best tested one for this kind of entry: take the BO, VR, CF entry only when the
Weekly agrees with the trade and the Daily is not ranging (a profit factor of about 1.35-1.42 is quoted for it, and a
stronger Daily trend better still). The Mosha desk already stamps two tags on every sequence record that change no trade
(`assets/mosha-sop.js` `dayTags`, 21 Nov 2026): `withWeekly` (the last completed week's close against the week before it,
true when the trade's side agrees) and `er20` (the 20-day efficiency ratio of the Daily closes). This study asks whether
the desk's own sequence entries do better with those two conditions than without, net of costs.

## What is tested
The desk's own code, imported and not edited: `assets/mosha-sop.js` `sopTrades` with its default options on the page's own
structure functions (`council/mosha-desk.mjs` `loadFns`: `msAnalyze`, `msMosha`, `msZones`, `msInternal`, six candles a
side, the structure the desk uses for this entry), as `research/edge/desk-rigor` runs it. Both tags are read from the
records exactly as the code sets them (Daily candles closed by the entry only; weekend-dated candles left out).

**Population**: the sequence's EG entry only: records of kind `sop` whose id is `sop-<tf>-…` or `sop-i-<tf>-…` (the BO and
the iBO sequence, entry on the EG after the pullback into the CF zone). Left out: the CF inside the VR (`sop-c2-`, its own
reading), the limit at the CF line (`sop-l-`), the VR retest of a turned chart (`sop-vr-`, `sop-vc-`) and the SOP inside the
SOP (`sop-nv-`, `sop-nc-`). A record whose `withWeekly` or `er20` is null is counted and left out of both sides.

**Groups**
- **F1 (primary)**: `withWeekly === true` AND `er20 >= 0.2`.
- **F2 (secondary)**: `withWeekly === true` AND `er20 >= 0.35`.
- **Rest** of each: the population trades with both tags known that are not in that group.

## Markets and data
Primary, pooled: gold, EUR/USD, GBP/USD. Reported only, never in the verdict: USD/JPY and AUD/USD.
OANDA mid candles from the research cache of `research/edge/_lib/edgekit.mjs` (`DATA_DIR`, kept out of git): M5 from
2019-06-01 (warm-up) to the last candle in the cache; M15, M30, H1 and H4 grouped from M5 on UTC clock buckets; D1 = the
cache's raw UTC daily candles (as the candle proxy serves them to the desk). No one-minute history is on file, so where the
code would read a CF on M1 (an M5 VR) it reads it on M5 and says so in its log, as the code does on the desk when M1 is
missing. Trades are kept by their fill time from 2020-01-01.

## Windows
- Window A: fills 2020-01-01 to 2023-12-31.
- Window B: fills 2024-01-01 to the last candle in the cache.
Said plainly: neither window is untouched for the reading itself. `desk-rigor` (21 Nov 2026) ran the sequence on 2020-2025
(it lost after costs) and the desk's records cover 2026. The split by these two tags has not been computed on these years
before this file.

## Costs (per round trip, taken off every trade in R = cost / the trade's opening risk)
As `desk-rigor`: gold 0.00005 of price; EUR/USD and GBP/USD commission 0.000045 of price plus 0.5 pip. Reported markets:
USD/JPY 0.000045 of price plus 0.5 pip (0.005), AUD/USD as EUR/USD. No financing. 2x costs reported.

## Statistics and the bar
Per group, window and market: n, win %, profit factor, R a trade before and after costs, total, worst drawdown, t on
calendar-month sums of net R. The group against its rest: difference of mean net R a trade with a Welch t (per trade).
For each test, a one-sided p (normal) from the month-sum t of each window; the test's p is the larger of the two; Holm over
the two tests (F1, F2).
- **A test passes only if all hold**, on the pooled primary markets: in each window n >= 100; in each window the group's
  net R a trade > 0 with month-sum t >= 2; in each window the group's mean net R minus its rest's > 0 (Welch t reported, not
  a bar); Holm p < 0.05.
- For F2 also reported: F2 against the trades of F1 that are not in F2 (`0.2 <= er20 < 0.35`).
- Fewer trades than the minimum is "too few to judge" and counts as not passed.
- Also reported, no verdict: each tag alone, by market, by ladder step, 2x costs.

## What a result means
A test that passes is not an edge on its own: it would be proposed to the owner as a mark (or a requirement) on the desk's
paper record of this entry, with its own forward pre-registration; nothing changes without the owner. A test that fails is
not made a filter, and these two conditions are not looked at again on these years.

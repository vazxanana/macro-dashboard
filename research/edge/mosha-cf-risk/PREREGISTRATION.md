# Low-risk CF against high-risk CF in the Mosha sequence (pre-registration)

Written 23 Nov 2026, before any run of this study. The method distinguishes a "low-risk CF" (the CF forms on the SAME
timeframe as the VR) from a "high-risk CF" (the CF forms one timeframe lower), says to prefer the low-risk one, and enters
on the pullback after the CF. The desk's code reads both: `assets/mosha-sop.js` `sopTrades` with `cf: 'same'` reads the CF on
the VR's timeframe (low risk); its default (`CFTF`) reads the CF one timeframe under it (high risk). This study runs that code,
unchanged, on years no Mosha study of the desk has judged a rule on, and asks: does the low-risk CF make money before costs,
and does it beat the high-risk one?

**Data**: OANDA mid 5-minute candles, `research/edge/_lib/edgekit.mjs` cache (`EDGE_DATA`, outside git): xau, eurusd, gbpusd,
usdjpy, audusd; trades 2010-01-01 to 2019-12-31, candles from 2009 for warm-up. H4, H1 and M15 are built from the 5-minute
candles in UTC buckets (`edgekit.resample`). Costs = `research/edge/combo-grid-2/run.mjs` `COSTS` (round trip, price units);
`exclusions(market)` (data-quality) drops any trade whose fill-to-exit span touches an excluded interval.

**Code**: `assets/mosha-sop.js` `sopTrades` with the page's own `msAnalyze` / `msMosha` / `msZones` / `msInternal` lifted from
`market-structure.html` by `council/mosha-desk.mjs` `loadFns` (the tracker's way), not edited. The desk's six-candle structure
(the functions as loaded). Options: `nest: false` (no SOP inside the SOP), `case2: false` (a CF inside the VR, the method's
"likely to fail" case, takes no entry), everything else the desk's defaults (major and internal BOs, the CF only after price
came back to the BO level). The ladder is restricted in-process (the exported `LADDER` array) to two chains:
- **H4>H1**: BO on H4, VR on H1; low-risk CF on H1, high-risk CF on M15 (`CFTF['1h']`).
- **H1>M15**: BO on H1, VR on M15; low-risk CF on M15, high-risk CF on M5 (`CFTF['15m']`). (The desk's own ladder reads
  H1 > M30; this study takes the chains as asked.)

One run per market, year, chain and CF reading, with candles from 1 Jan of the year before to 1 Feb of the year after; only
trades whose entry falls in the year are kept; a trade still open at the end of its slice is dropped and counted.

**Entries**:
- **EG entry** (both readings): the code's own sequence records (ids `sop-…`, `sop-i-…`): price pulls back into the CF zone,
  an EG closes with the BO, market entry at that close, stop past the pullback's extreme, target the VR's extreme, outcome by
  the code's `outcome` on 5-minute candles. The VR retest records (`sop-vr-`, `sop-vc-`) are another reading and are left out.
- **Limit at the CF line**: high risk = the code's own `sop-l-` records. The code has no limit for a same-timeframe CF, so the
  low-risk limit is this study's simulator of the code's rule on the CF zones the low-risk run hands out (`cfOut`, kind 'cf'):
  a limit at the CF line (the zone's top for a buy, its bottom for a sell), known at the CF candle's close; stop past the
  zone's far side by `sizes().buf`; target the VR's extreme; refused unless the risk is inside `sizes()` rmin..rmax and the
  levels are on the right sides; it rests until a 5-minute candle reaches the target first, a CF-timeframe candle closes
  through the far side, or `CF_LIMIT` (24) CF-timeframe candles pass; the fill is the first 5-minute candle that reaches the
  line, which can only stop the trade (`outcome(…, limit = true)`). **Gate**: the same simulator applied to the high-risk
  run's `cfOut` must reproduce at least 80 % of the code's `sop-l-` records (same side, fill time and entry); else T3 is
  INCONCLUSIVE.

**R**: before costs = the code's R (a gap through the stop books worse than -1R). After costs = R - COSTS[market] / risk.

**Placebo** (each trade of T1 and T3, seeded `edgekit.rng(1)` in trade order): the same market, side, stop distance and target
distance, entered k candles of the CF timeframe earlier, k uniform in 5..100: T1 at that candle's close (market entry, outcome
from the next candle); T3 as a limit placed then at the same distance from that candle's close as the real CF line was from
the CF candle's close, resting 24 CF-timeframe candles, fill on 5-minute candles, the fill candle only stops it. No structure.
This tells a pass apart from the drift of the side and from the resting-limit effect (`research/edge/dom-placebo`).

**Tests (judged BEFORE costs; after costs reported beside), pooled five markets and both chains**:
- **T1**: low-risk CF, EG entry: mean R > 0 with calendar-month-sum t >= 2 in 2010-2014 AND in 2015-2019; and pooled mean
  minus its placebo's mean > 0 with Welch t >= 2.
- **T2**: low-risk minus high-risk, EG entry, per-trade R: the difference > 0 in both halves and pooled Welch t >= 2.
- **T3**: low-risk CF, limit at the CF line: as T1 (both halves, placebo).
- **Holm** over the three one-sided p values (T1, T3: the pooled 2010-2019 month-sum t; T2: the pooled Welch t) at 0.05; a
  test passes only with its Holm p <= 0.05 and every condition above.

**Verdict**: PASS when T1 or T3 passes (an entry that makes money before costs and beats its placebo); FAIL when neither
does; INCONCLUSIVE when T1's low-risk EG stream has fewer than 100 trades. T2 is reported as the comparison the method asks for
(it never decides the verdict alone). Reported, not tests: after costs, each chain, each market, each year, the high-risk
streams on their own, the side-flipped T1 trades.

One run. No variant of these rules on these years after the result.

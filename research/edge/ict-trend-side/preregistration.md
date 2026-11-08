# Pre-registration: index A-setups, sells only below the 200-day average (one filter, tested on 2018-26)

Written on 7 Nov 2026, **before any 2018-2026 result for this filter was computed**. Only the 2008-2017 discovery run below had
run when this was committed (`run.mjs ... 2018-01-01`: no signal closing on or after 1 Jan 2018 was simulated). Nothing below
may change after the first 2018-26 computation. The test runs once and its result is reported whatever it is.

## Where the idea comes from (2008-17 only)

The pre-registered 2008-17 out-of-sample test of the live A-setup rule failed (`research/edge/ict-oos-2008`, #526). A descriptive
slice there, not pre-registered, found that the index rule fades the daily trend and that its **sells** lost in the 2009-17 bull
market (index sells −0.110R a trade net, n 1,051, t −2.84) while its **buys** made +0.116R (n 567, t 1.90). Gold behaved like
long-gold beta. This test turns that observation into one rule and tests it on data the observation did not come from.

## The filter (fixed now)

- **Markets: NQ, ES, YM, RTY** (the index A-setups). Buys are unchanged.
- **A sell A-setup is taken only when the index's last closed daily candle closed below the simple average of its last 200 daily
  closes** (that candle's close included).
  - "Last closed daily candle" = the same candle `signals()` already reads for the 50-day bias:
    `D.findLastIndex((d) => d.time + 86400 <= g.close)`, where `g.close` is the signal H1 candle's close. In the research D is
    `dailyNY()` of the H1 candles (17:00 New York rollover); live it would be the tracker's own daily candles.
  - Fewer than 200 closed daily candles: the sell is **not** taken.
  - Code: `gate.mjs` (`belowSma`, `passes`), committed with this file.
- **GC is unchanged.** Its gold rule takes buys only, so a sell filter never touches it. GC is reported for reference only and is
  not part of the test.
- Everything else is the live rule: `isASetup()`, `sizeOf()`, break-even, exits, `MIN_GRADE`, from `ict/tracker.mjs` and
  `simulate()` from `ict/replay.mjs`, unchanged.
- The filtered stream F runs with its own busy rule (one open A-setup per market, as `replay.mjs` and the tracker's shadow
  variants do). So a sell the filter drops no longer blocks later A-setups. Those later trades ("added") are part of F.
- Only this one filter is tested. No other average length, no buy-side filter, no GC rule, no alternative was tried on 2008-17
  or anywhere else.

## Discovery-window behaviour (2008-17, OANDA, index markets, net costs x1; in-sample, NOT evidence)

Run before this file was committed, with `run.mjs oanda <cache> <out> 2018-01-01` and `analyse.mjs <out> 2008-01-01 2018-01-01 2013`.
The unfiltered stream U matches #526 exactly (NQ −0.073 n 541, ES −0.068 n 534, YM +0.047 n 543; buys +0.116, sells −0.110).

| stream | n | exp | R | t |
|---|---|---|---|---|
| U (live A-setups) | 1,618 | −0.031 | −50.0 | −0.93 |
| F (filtered) | 692 | +0.092 | +63.8 | 1.70 |
| dropped | 930 | −0.127 | −118.1 | −3.07 |
| added | 4 | −1.054 | −4.2 | |

- F by half: 2008-12 −0.015 (n 481), 2013-17 +0.336 (n 211). F by market: NQ +0.073, ES +0.053, YM +0.149.
- 121 of 1,051 sells survive the filter (below the 200-day average); they made +0.017R.
- **Even in-sample the filter would fail this pre-registration's halves condition (2008-12 F is negative).** It is in-sample by
  construction: the filter was written to remove the losing slice.

## What is already known about 2018-26 (declared)

#526 published the unfiltered 2018-26 OANDA figures: pooled +0.093R a trade (with GC), NQ +0.103 (n 424), ES +0.040 (n 422),
YM +0.061 (n 407), **all index sells +0.054R a trade (n 866)**, index buys by market NQ +0.203, ES +0.112, YM 0.000. The split of
the 2018-26 sells by the 200-day average has **not** been computed. Indices spent most of 2018-26 above their 200-day average, so
most 2018-26 sells will likely be dropped. Since all 2018-26 sells together made +0.054R, the dropped-trades condition (C2) is
**hard to meet**. This prior works against a pass, not for it. It is declared here and the filter is not changed because of it.

## Data and windows (fixed now)

1. **Primary test: OANDA 5m mid, signals closing 2018-01-01 00:00 UTC to 2026-10-31 23:59 UTC.** The #526 cache (`fetch.mjs` in
   `research/edge/ict-oos-2008`): NAS100_USD for NQ, SPX500_USD for ES, US30_USD for YM. One pass from the 2007-06 warm-up, as
   #526, so U reproduces #526's 2018-26 stream. RTY has no free source and is not in this test (as #526). Halves:
   **2018-2021** and **2022-2026** (by signal close year, the #526 split).
2. **Second check: HistData M1 cash** (council-data `research/candles/`, as `research/edge/ict-universe`): NSXUSD under NQ's
   rule, SPXUSD under ES's rule. HistData starts in Jan 2018, so 2018 is the 200-day warm-up and the window is **2019-01-01 to
   2026-10-31**. Halves 2019-2021 / 2022-2026. No US30 or Russell there.
3. **Live desk replay check:** council-data `ict/replay.json` as of commit `475f6bc3` (built 7 Nov 2026, CNBC futures with the
   Dukascopy cash fill), A-setups of NQ, ES and YM with a signal from **2025-08-01 to 2026-10-30** (the OANDA cache ends on
   30 Oct). The 200-day average is read from the OANDA cash daily closes, because CNBC's futures daily history is not reachable
   from the research sandbox. Cash vs futures can disagree only when the close is within the basis of the average. RTY is left
   out (no daily history reachable). Subtractive: F = U minus the dropped trades; trades F would add are not in the file
   (`replaycheck.mjs`).

**Costs** (the #526 / ict-universe costs, unchanged): one round trip of NQ/ES 0.0002 x price + 0.25, YM 0.0002 x price + 1.
Net R = size x (R per unit − cost / r0). Costs x2 and gross are reported.

## The test (primary data only, index markets, net costs x1)

- U = the live A-setup stream.
- F = the filtered stream.
- dropped = U trades that the filter rejects.

**PASS** if all four hold on OANDA 2018-01-01 to 2026-10-31:

1. **C1 (beats).** F's net expectancy a trade > U's **and** F's total net R ≥ U's total net R.
2. **C2 (dropped).** n dropped ≥ 30 **and** the dropped trades' mean net R ≤ 0.
3. **C3 (halves).** F's net expectancy > 0 in 2018-2021 **and** in 2022-2026.
4. **C4 (markets).** F's net expectancy > 0 on at least 3 index markets. OANDA has 3 index markets (NQ, ES, YM), so this means
   all three.

**FAIL** otherwise. There is no t-statistic requirement; t is reported.

## The checks (reported, they do not change the verdict)

- **HistData.** The same C1-C4 on 2019-26, where C4 means both NAS100 and SPX. "Confirms" if C1 and C2 hold there.
- **Replay.** Dropped n and mean net R, F vs U, by market and half. "Consistent" if the dropped trades' mean ≤ 0 and F beats U a trade.
- If the primary passes and a check does not confirm, the report says **"PASS, not confirmed"**.

## What happens after

- **FAIL:** reported as a failure. Nothing is built. No live rule changes.
- **PASS:** the filter is added **only** as a paper shadow variant in `ict/tracker.mjs` (the `VARIANTS` / `shadowByVariant`
  pattern of 'nofri' / 'h1opp'), on NQ, ES, YM and RTY. The live A-setup stream must stay byte-identical (chained tracker runs old
  vs new). The live rule is never changed; the owner decides.

## What will not happen

- No parameter, average length, candle choice, cost, window, market or pass bar changes after the first 2018-26 computation.
- No second filter is tried on 2018-26.
- No live rule, config or replay code changes.

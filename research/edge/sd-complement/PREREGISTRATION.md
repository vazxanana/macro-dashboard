# Supply / demand, completed: what the plain reading lacked, and the zones as a filter on the passing breakouts (pre-registration, 24 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`grid7-sd-wide` (23 Nov 2026) found that a plain supply / demand zone (base of 1-4 small candles between a leg in and a strong leg
out) does no better on its first touch than a random band of the same height: FAIL, 0 of 56. The owner asked what is missing
and to complement the zones with the other strategies. Two kinds of addition are tested here, each written down before any
run:

- **Part A, the parts of a supply / demand trade the plain reading left out**: where the zone sits in the Daily dealing range
  (premium / discount), the Daily trend, the zone's quality (a short base and a leg out that breaks structure), the classic target
  (the nearest opposite zone) and the classic entry (a resting order at the zone's near line), then all three filters together.
- **Part B, the zones as a complement to the two rules that pass after costs** (`gold-vol-breakout` T1 and the USD/JPY T1 of
  `usdjpy-vol-breakout-early`): does a breakout away from a freshly touched zone do better than one into it?

**The risk of searching, said first.** The ten markets of 2005-2026 were read by `grid7-sd-wide`. A rule picked after looking at
them can fit noise. So every Part A test must also hold on **eight markets no supply / demand study has read** (holdout, below),
and a pass needs a profit **after costs**, not only before.

## Data

- OANDA mid 5-minute candles, the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`, `EDGE_DATA`).
- **Main set (10)**: xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy; windows by the fill time:
  **discovery 2005-01-01 to 2014-12-31**, **confirmation 2015-01-01 to 2026-10-31**.
- **Holdout (8)**: nas100, spx500, de40, gbpjpy, audjpy, cadjpy, eurgbp, euraud (the cache holds them from 2019); loaded from
  2018-01-01, fills **2019-02-01 to 2026-10-31**.
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames`; exclusions: `combo-grid-2`'s `exclusions`.
- Costs (after the fact only): `combo-grid-2`'s `COSTS`, the demo figures for xau, eurusd, gbpusd, usdjpy, audusd; **ASSUMED, not
  measured** for every other market (xag, nzdusd, usdcad, usdchf, eurjpy and all eight holdout markets).

## Part A: the base trade and six tests

**Base** (unchanged from `grid7-sd-wide`, imported): H4 zones of `sdBaseZones` (all four shapes pooled), first touch on M15,
market entry at the next 5-minute open after the touch candle's close, stop past the zone's far side + 0.1 ATR(14) of H4, a 2R
target, out after 3 days. A touch candle closing beyond the far side is no trade; a trade whose risk is under the round trip is no
trade. Every trade has its stop on the losing side of the fill.

Each test changes ONE thing (A6 combines A1-A3):

- **A1 premium / discount**: the Daily dealing range = from the last confirmed Daily swing low to the last confirmed Daily swing
  high (`edgekit.swings(1d, 3)`, each known at the close of its confirming candle), read at the touch candle's close. A demand zone
  is taken only if its top is at or below the range's midpoint, a supply zone only if its bottom is at or above it.
- **A2 Daily trend**: taken only if the Daily structure side (`edgekit.structure(1d, 3).side` of the last Daily candle closed by the
  touch candle's close) equals the zone's side.
- **A3 quality**: taken only if the base is 1 or 2 candles AND an H4 structure break (`edgekit.structure(4h, 3)`) of the zone's side
  happens on a leg-out candle.
- **A4 opposite-zone target**: the target is the near line of the nearest opposite-side zone known before the fill, not yet touched
  and still alive, at least 1R beyond the fill (none: no trade); out after 10 days.
- **A5 resting order at the near line**: instead of the market entry, a limit at the zone's near line moved half a round trip
  INTO the zone (a buy fills only when price trades half the round trip below the near line; the order is placed when the zone is
  known and rests until the zone's end). Fill at the limit, or at the open of a 5-minute candle that opens past it; on the fill
  candle only the stop counts. 2R, out after 3 days.
- **A6 all three filters** (A1 and A2 and A3) on the base trade.

**Control of each test**: the random bands of `grid7-sd-wide` (`bandsOf`, three seeds; same side, height and birth, matched
distance), put through the SAME rule: A1 and A2 are read at the band's own touch; A3 and A6 keep a band only when its source zone
passes A3; A4 takes its target from the real zones; A5 rests its limit at the band's near line.

**The bar (Part A), all must hold for a PASS:**

1. n >= 300 in discovery AND in confirmation, n >= 150 in the holdout;
2. before costs: mean R > 0 and month-sum t >= 2 in discovery, in confirmation AND in the holdout;
3. Holm over the six confirmation tests (one-sided p of the month t): adjusted p < 0.05;
4. it beats its control: Welch t >= 2 in discovery AND in confirmation, and a higher mean than the control in the holdout;
5. after costs: mean R > 0 in confirmation AND in the holdout.

## Part B: the zones as a filter on the two passing breakouts

The breakout trades of gold T1 and USD/JPY T1 (k 0.5, both sides; `gold-vol-breakout` `buildDays`, `daySkip`, `vbTrade`, imported
unchanged; costs as `vb-structure-filter` `costOf`: the larger of the study's and the toolkit's), every trading day 2010-01-01
to now. At the day's 00:00 UTC open, the zones considered are the H4 zones of `sdBaseZones` whose first M15 touch closed in the
48 hours before, with no M15 close beyond the far side since. A trade is **kept** when such a zone exists of its own side and
none of the other side ("a breakout away from a zone just defended"), **against** when only zones of the other side exist, and
**neither** otherwise.

**The bar (Part B), per market, all must hold for a PASS:** windows REP 2010-2019, IS 2020-2023, OOS 2024 to now; kept after
costs: mean > 0 in OOS with month t >= 2, mean > 0 in IS and in REP, n >= 30 in OOS, mean > 0 at twice the cost in OOS; kept minus
against: > 0 in each window and Welch t >= 2 on 2010 to now; Holm over the two markets on the OOS p < 0.05.

## Verdict

PASS if at least one Part A test or one Part B market passes; FAIL if none does. A pass is a candidate for its own forward paper
record and an owner decision, nothing more; it is never called an edge before that record. Nothing live changes.

## Also reported

- Every test with n, mean R and month t before and after costs in each window, its control and the Welch t.
- Part A per market for any pass. Part B: kept / against / neither counts, by year.
- A cut test of the Part A signals on candles cut at several dates (signals known by a cut equal the full run's).
- One run, no variants. Do not re-test variants of these tests on these markets and years.

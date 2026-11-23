# The H1 dominant-zone limit on a second candle feed (pre-registration)

Written 23 Nov 2026, before any run of this rule on these candles. The three combination grids (`research/edge/combo-grid`,
`-2`, `-3`, OANDA mid candles 2020 to now) ended, judged before costs, on one family: an H1 dominant zone (two H1 candles of
one colour, the second closing beyond the first's extreme; zone = the first candle's body), touched on M5, a limit at the
zone's near edge, no trigger, stop past the far side by half the cost plus 0.25 x ATR(14) of H1. About +0.04 to +0.06R a trade
before costs. The question here: is that tilt a property of OANDA's mid candles (an artefact of one feed), or does it show on
an independent feed of the same markets and years?

**Rule (fixed, unchanged from `research/edge/dom-zone-holdout/run.mjs`)**: `research/edge/combo-grid-3/run.mjs`
`frames`, `signalsFor(F, '1h', '5m', 'dom')`, the no-trigger signals (first and second touch), entry a limit at the near edge,
stop = far side -/+ (half the cost + 0.25 x ATR(14) of H1, the ATR of the last H1 candle closed at the touch), order alive 12
five-minute candles, risk at least 2 x the cost, the grid's `multi()` exits, 2-day cap. Primary exit: the 1R trailing stop
from +1R (`trail`); also reported 1R, 2R, 3R, 4R. Closed candles only (the grid engine's own rule). Every trade has its stop on
the losing side (a trade without one is not taken).

**Markets**: gold and the forex majors the council-data branch holds as HistData M1: xau, eurusd, gbpusd, usdjpy, audusd,
usdcad, usdchf. Costs: `combo-grid-2` `COSTS` (round trips; usdcad / usdchf assumed, not measured).

**Feeds**: (H) HistData M1 from `origin/council-data` `research/candles/` (bid prices), labels converted to UTC ONLY with
`council/histdata.mjs` `histStampUtc` (a repeated converted time is dropped), grouped to 5-minute candles `{ t, o, h, l, c, e }`.
(O) OANDA mid 5-minute candles from the `edgekit` cache (filled with `research/edge/_lib/fetch-cache.mjs`). Both loaded from
2018-01-01; trades counted from 2018-02-01 (one month for the H1 ATR and the zones) to the last HistData candle. The data-
quality exclusions of `research/edge/data-quality/quality.json` drop a trade on BOTH feeds.

**Tests (judged BEFORE costs, as the owner asked; after costs reported beside; t = t of calendar-month sums of R)**
- T1: HistData, the seven markets pooled, 2020-01-01 to the end, trailing exit: mean R > 0 and month t >= 2.
- T3: HistData pooled, 2018-02-01 to 2019-12-31 alone, trailing exit: mean R > 0 and month t >= 2.
- Holm over T1 and T3. **PASS** = both pass. **FAIL** = T1 fails. **INCONCLUSIVE** = T1 passes and T3 does not.
- T2 (control, not part of the verdict): the same rule on OANDA for the identical markets and window (2020 on): mean R and
  month t; and HistData minus OANDA as a paired t over calendar months of pooled R sums (2020 on). A paired |t| >= 2 with
  OANDA higher, or T2 meeting T1's bar while T1 fails, is read as "the tilt depends on the feed".
- Reported, not judged: per market and per feed; the share of H1 dominant zones (side and the completing candle's time) found
  on both feeds; after-cost figures for everything.

A pass is a before-cost tilt seen on a second feed, nothing more; after-cost figures say whether it could pay its costs. Never
an edge without n and t; nothing live changes from this study.

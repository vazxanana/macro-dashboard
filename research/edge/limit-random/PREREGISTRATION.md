# Is it the zone, or any resting limit near the market? (pre-registration)

Written 23 Nov 2026, before any run of this study. `dom-zone-holdout` found that a resting limit at the near edge of an H1
dominant zone makes about +0.05R a trade before costs on OANDA mid 5-minute candles (2005-2019), and `dom-placebo` found that
a random recent same-colour H1 body does better (+0.080R). This study asks whether candle bodies matter at all, or whether a
resting LIMIT at any price near the market earns this on mid candles (short-term mean reversion, or the fill rule of `multi()`:
a limit fills at the limit, or at the open when the candle opens through it).

**Data**: OANDA mid 5-minute candles, `edgekit` cache (`EDGE_DATA`): xau, eurusd, gbpusd, usdjpy, audusd, fills 2010-01-01 to
2019-12-31 (candles from mid 2009 for warm-up). Costs = combo-grid-2 `COSTS` (the same as `dom-placebo`); data-quality
exclusions as grid 3. These years were read by `dom-zone-holdout`, `dom-placebo` and `combo-grid-4`: this study is a control,
not a holdout.

**Streams** (each trade: grid 3's `multi()` unchanged, limit order, 12 M5 candles to fill, 2 days time limit, exits 2R and
the 1R trailing stop from +1R; the same cost skips as the DOM trade: planned risk >= 2 x cost, filled risk >= cost; every stop
on the losing side, checked in code):
- **DOM**: `dom-placebo/run.mjs` `tradesOf` on `buildZones('dom')` (the `dom-zone-holdout` trade), imported unchanged.
- **The DOM's own distances** (from its signals, before simulation, per market): for each DOM signal that passes the planned
  risk skip, with A = ATR(14) of the last H1 closed at the limit's start ts and C = that H1 candle's close:
  entry distance u = side x (C - entry) / A (kept when > 0: the limit rests on the right side of the last H1 close; the share
  kept is reported), and stop distance s = side x (entry - stop) / A. S = the median of s (per market).
- **RND (primary)**: at the close of every H1 candle i with i >= 15 (A = ATR(14) of candle i, C its close), selected with a
  seeded generator (`edgekit.rng`, seed from the market name) with probability 1/4; for a selected candle BOTH a buy limit at
  C - U x A and a sell limit at C + U x A, each its own trade, U drawn (same generator) from that market's DOM u values; stop
  = entry -/+ S x A; the order rests from candle i's close (`ts` = its end) for 12 M5 candles.
- **RND-0.25, RND-0.5, RND-1.0** (reported only): the same selected candles with U fixed at 0.25, 0.5 and 1.0.

**Tests (judged BEFORE costs, the owner's basis; after costs reported beside), pooled five markets, trail exit**:
- T1: RND mean R > 0 with calendar-month-sum t >= 2 in BOTH 2010-14 and 2015-19 (by fill time).
- T2: DOM mean R minus RND mean R > 0, Welch t (per trade) >= 2, 2010-2019 (the month-sum t of the per-month difference of
  mean R is reported beside; no pairing by hour).
Holm over the two one-sided p values (T1's p = the larger of its two halves' p); a test passes when its condition holds and its
Holm p < 0.05. Reported: 2R exit, per market, halves, the three fixed-U streams, fill rates, the DOM's u / s distributions.

**Reading, fixed in advance**:
- T1 passes and T2 fails: the tilt is a property of resting limits on mid candles (at about the DOM's distance), not of the
  zone or the body.
- T1 passes and T2 passes: resting limits earn something by themselves, and the DOM earns more.
- T1 fails and T2 passes: the tilt needs the zone (or a body); a random resting limit does not have it.
- Both fail: no conclusion beyond "a random limit is not reliably positive" (T1) and "the DOM is not reliably better" (T2).
Verdict word: PASS when T1 passes (the question asked: does any resting limit earn it), FAIL when it does not.
Nothing live changes whatever the result; a pass is a before-cost property of mid candles, never an edge.

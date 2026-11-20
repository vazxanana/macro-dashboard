# USD/JPY T1 at the demo broker's own ticks (20 Nov 2026)

Paper research only. Method, window and bar fixed in `PREREGISTRATION.md` before any broker tick of these trades was read. Nothing live changed.

**Verdict: PASS: USD/JPY T1 at the demo's own ticks 2023-11-24 → 2026-11-19, +0.1478R a trade after commission (n 564 filled, month t 3.1083; OANDA mid before costs +0.1527R; entry slippage 0.0121R)**

```json
{
 "stats": {
  "n": 564,
  "notFilled": 4,
  "net": 0.1478,
  "monthT": 3.1083,
  "oandaGross": 0.1527,
  "stops": 181,
  "oandaStops": 193
 },
 "slippage": {
  "entryYen": {
   "median": 0.0017,
   "mean": 0.0056,
   "p90": 0.011
  },
  "entryR": 0.0121,
  "stopYen": {
   "median": 0.002,
   "mean": 0.01,
   "p90": 0.012
  }
 },
 "split": {
  "byYear": {
   "2023": {
    "n": 17,
    "net": 0.5057
   },
   "2024": {
    "n": 189,
    "net": 0.2029
   },
   "2025": {
    "n": 202,
    "net": 0.0764
   },
   "2026": {
    "n": 156,
    "net": 0.1381
   }
  },
  "bySide": {
   "sell": {
    "n": 291,
    "net": 0.0283
   },
   "buy": {
    "n": 273,
    "net": 0.2772
   }
  },
  "top10Share": 0.7458
 },
 "skipped": {}
}
```

**Reading.** Real fills cost about 0.01R a trade (entry slippage median 0.0017 yen, stop exits 0.002 yen; 4 of 568 trades never
triggered on the broker): the half-pip allowance of the earlier studies was about right. Two cautions, descriptive and read after
the result: the ten best trades carry 75 % of the total, and buys made +0.277R a trade against +0.028R for sells (the same lean
shows over 2005-26 on OANDA mid: buys +0.148R, n 1,998; sells +0.001R, n 2,170). Part of the edge may be USD/JPY's rise and carry
rather than the breakout itself; a buy-only version would be a new rule needing its own test on data not yet read (the forward
record). These years are in sample for `fx-vol-breakout`: this prices the rule at real fills, it is not new evidence that it works,
and a pass is no reason to trade by itself (owner).

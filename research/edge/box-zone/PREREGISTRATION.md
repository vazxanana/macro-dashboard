# Box zone: a Daily turn box retested, entered on H4 boxes (pre-registration, 22 Nov 2026)

Written before any candle of the test window is read. The rule is the owner's, described in chat on 22 Nov 2026 with marked
EUR/USD charts; the words below are the desk's. It was looked at on 2020-2026 (exploratory, in sample: 716 trades, +0.03R a
trade after costs, t 0.76). That stretch is NOT evidence and is not reused here.

## The rule (one definition, no variants judged)
- **Box** (every timeframe): starts on the candle that closed out of the previous box; its high and low are the highest high
  and lowest low (wicks) of its candles; it follows price while each candle closes inside it; the first close above it
  (broke up) or below it (broke down) ends it, and that candle starts the next box. Boxes of fewer than 3 candles are kept as
  breaks but not as zones or entry boxes.
- **Daily zone**: a Daily box that breaks the other way from the box before it (a turn). If the next Daily box breaks the same
  way and overlaps it, the zone is the two together. Broke down = supply (sells), broke up = demand (buys). Known from the
  close that ended the last box in it. Weekend candles folded into Monday.
- **Visit**: after the zone is known, price leaves it (an H4 candle wholly beyond its near side), then comes back (an H4
  candle trades into it). The zone ends on the first Daily close beyond its far side.
- **Entry** on H4, inside a visit: first an H4 box breaks against the zone (the test), then an H4 box breaks with the zone:
  enter at that H4 close. No trend filter (owner, 22 Nov 2026: "no trend filter").
- **Stop**: the other side of the entry H4 box. **Target**: the other side of the test H4 box (its low for a sell, its high
  for a buy); a trade whose target is not beyond the entry is skipped. Stop first when one candle holds both.
- One trade per visit; one open position per market.

## Data, costs, windows
OANDA mid Daily and H4 candles, 1 Jan 2010 to 31 Dec 2019 (trades entered in this window, exits may run past it), five
markets: EUR/USD, GBP/USD, AUD/USD, USD/JPY, XAU/USD. Round-trip cost taken off each trade: EUR/USD 0.6 pip, GBP/USD 0.8,
AUD/USD 0.6, USD/JPY 0.8, gold $0.25 (the desk's measured demo figures, today's cost charged on old years). Halves 2010-2014
and 2015-2019.

## Pass bar (all must hold)
1. Pooled mean R a trade after costs > 0 with t >= 2 on calendar-month sums of the pool.
2. Pooled mean > 0 in both halves.
3. At least 3 of the 5 markets with a positive mean after costs.
4. Still > 0 at twice the costs.
Anything else is FAIL. Reported, not judged: each market, a minimum target of 1R, results before costs.
Nothing live changes whatever the result; a pass would only lead to a forward paper record proposed to the owner.

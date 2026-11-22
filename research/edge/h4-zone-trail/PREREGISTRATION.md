# H4 engulf zone, stop past the zone, no target, trailed exit: pre-registration (22 Nov 2026)

Written and committed before any candle of the test window was read by this rule. Owner: "check the trades from all edges, and
get the best of each one", then "test it".

## Why
The 31,500 closed 2026 paper records of the five desks (ICT, Mosha, LIT, Engulfing, MSNR; before costs) were split part by
part. What looked best in each part: a higher-timeframe key level (Daily / H4, not M15), a plain limit at the zone with no
lower-timeframe confirmation and no direction filter, a stop past the zone and not a fixed size, no fixed target with a
trailed stop (the ICT desk's exit), and no entries 17:00-24:00 UTC. All of that is in sample, before costs, and picked from
about 200 comparisons: a hypothesis, not a finding. This study tests the one rule those picks give, once, on years none of
those records cover.

## The rule (fixed)
- **Candles**: OANDA mid H1; H4 candles are built from them in UTC 4-hour buckets (00, 04, ... as the desks do); weekend
  candles (Friday 22:00 UTC to Sunday 22:00 UTC) dropped.
- **Zone**: an H4 next-candle engulf, by the desks' own `engulfAt(C, i, 1)` (`council/eg-methods.mjs`, imported): a closed H4
  candle that closes above the high of the red candle right before it (buy zone) or below the low of the green candle right
  before it (sell zone). The zone is that earlier candle, wick to wick. Known from the completing candle's close.
- **Order**: from that close, a limit at the zone's near edge (its high for a buy, its low for a sell). It lives 20 H4
  candles (80 hours of candles). It is cancelled when an H1 candle closes beyond the zone's far edge before a fill. One order a zone.
- **Stop**: the zone's far edge plus 0.01 % of price beyond it. Every trade has it; a zone whose risk is under 0.02 % of
  price is skipped.
- **Fill**: the first H1 candle after the completing close that trades to the limit. No fill in a candle that starts
  17:00-23:59 UTC (the order waits). In the fill candle only the stop can be hit (worst case). A candle that opens beyond
  the stop exits at its open.
- **Exit**: no target. Once a candle after the fill has taken the best price to +2R, the stop trails 1R behind the best
  price (never loosened). Out at the close of the 40th H1 candle after the fill if still open. A candle holding both a new
  best price and the stop: the stop as it stood before that candle is used.
- **One position at a time a market**; a zone whose fill would come while a position is open is dropped.
- **Markets**: gold (XAU/USD), EUR/USD, GBP/USD. Buys and sells.

## Data and windows
OANDA H1, 1 January 2007 to 31 December 2019 (the test window; the desks' records and the desk studies read 2020 on).
Halves 2007-2013 and 2014-2019. Said plainly: on gold, the DAILY engulf rule's studies read 2006-17; this is another rule on
another timeframe, and the pooled result over three markets is the primary test.

## Costs
As `desk-rigor`: gold 0.00005 of price a round trip; EUR/USD and GBP/USD 0.000045 of price plus 0.5 pip. Gold buys also pay
the council's financing (`council/fills.mjs` `nights` x `FIN.xau.long` x entry). R after costs = R - cost / opening risk.
Today's costs are charged on every year.

## Tests and the bar
- **Primary (one test)**: the three markets pooled. PASS needs all of: net R a trade > 0; t >= 2 on calendar-month sums of
  net R; net > 0 in both halves; net > 0 at twice the costs.
- **Per market (three tests, Holm)**: reported; a market counts only with month t >= 2 after Holm and both halves positive.
- Reported, no verdict: before costs; buys and sells apart; the same trades with a fixed 2R target; fills 17:00-24:00 UTC
  included; the any-number-of-candles engulf; trade count, win rate, worst drawdown.
- A FAIL closes the question: no variant of this rule is then picked from the reported rows.

## What a pass would mean
A candidate for a forward paper record with its own pre-registration. Never a live rule without the owner. Paper only.

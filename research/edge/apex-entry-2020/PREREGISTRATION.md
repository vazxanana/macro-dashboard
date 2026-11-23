# Apex and continuation entries, 18 markets, 2020 to now (pre-registration)

Written 23 Nov 2026, before any code or result of this study. Research only: nothing live reads it, nothing is placed.

## Question

The owner's notes describe a level-to-level method built on two-candle key levels, a Daily rejection and an H4 breakout,
with four entries in it: the "apex" (a resting limit at the extreme of the breakout move), its low-risk form (the same,
only after the Daily candle has closed as a rejection), and the continuation entries that follow (each new H4 level of the
latest leg, taken at once, or only after a confirmation candle). Does any of the four, coded as written here, make money
after costs on 18 markets, 2020 to now? Gold is reported alone too.

## Definitions (this study's own words; readings, not tested rules)

Candles: OANDA mid 5-minute candles of the shared research cache (`research/edge/_lib/edgekit.mjs`), H1 and H4 built by UTC
buckets, Daily = 17:00 New York trading days (`dailyNY`). Closed candles only.

- **Key level**: two consecutive closed candles of one timeframe; the level is the close of the FIRST. An **A level** is a
  bullish candle followed by a bearish one (a peak of closes), a **V level** a bearish one followed by a bullish one. A level
  exists from the close of the second candle.
- **Fresh**: walking the candles after the pair (the pair's second candle excluded): a candle whose body spans the level
  makes it fresh; a candle that touches it only with a wick makes it unfresh, and that touch is a **use** if the level was
  fresh. A Daily level may be used at most 4 times (the touch being judged included); levels older than 500 trading days
  are dropped.
- **Daily touch (buy side; a sell mirrors)**: on trading day i a fresh Daily A or V level L with at most 3 uses so far,
  below the day's open, reached by the day's low. Of several, the highest (the first one price reaches). The touch moment =
  the first 5-minute candle of the day with a low at or below L; the touch H4 candle = the H4 candle holding it.
- **Daily rejection (DRD)**: the touch day closes with its whole body above L (open and close above L, low at or below).
- **External H4 breakout**: the last H4 A level (buys; V for sells) whose pair closed before the touch H4 candle opened,
  above L; the first H4 candle from the touch H4 candle on whose close is at or above it, closing no later than the end of
  the trading day after the touch day. No breakout in that window = no setup.
- **Apex**: the lowest H4 V level (buys; the highest A for sells) whose pair starts between six H4 candles before the touch
  H4 candle and the breakout candle and is complete by the breakout candle. It must be fresh on H4 at the signal. None =
  no trade.
- **Storyline** (for the continuation tests): starts at a low-risk signal (test 2), ends at the first of: the next
  low-risk signal of either side in that market, an H4 close beyond the apex on the losing side, price reaching the nearest
  fresh Daily level beyond the breakout close in the trade's direction (the target level), or 20 calendar days.
- **Continuation candidate** (buys): an H4 V level completed after the breakout candle while the storyline runs, above
  the previous candidate of the storyline (the apex for the first one; a higher low, so on the latest leg). Refinement: if a
  fresh H1 V level whose pair starts inside the H4 pair's eight hours lies within 25 pips of it, the order goes on that H1
  level (the highest such one), else on the H4 level.
- **Confirmation candle (DC)**: the first H1 candle after the candidate is known that reaches its level: if it closes back
  above the level with a bearish body, it gives permission and a limit goes on the level for the next touch; any other first
  touch (a bullish rejection, or a close through the level) ends the candidate.

Pips: gold 1 pip = $0.10, so 30 pips = $3.00; every other market takes the same share of price as $3.00 at $4,000
(0.075 % of the entry price for 30 pips; 20 pips = 0.05 %, 25 pips = 0.0625 %, 50 pips = 0.125 %).

## The four tests (management = the owner's notes' own table for each setup)

| | Signal | Order | Stop | Target | Break-even | Order life | Max hold |
|---|---|---|---|---|---|---|---|
| T1 Apex | Daily touch + external H4 breakout, the Daily close NOT waited for; signal at the breakout close | limit at the apex | 30 pips | 120 pips (4R) | stop to entry once price reaches +50 pips | 10 days, or the target level reached, or the next opposite T1 signal | 7 days |
| T2 Low-risk apex | as T1 plus a DRD on the touch day; signal = the later of the Daily close and the breakout close | limit at the apex | 30 pips | 120 pips (4R) | +50 pips | as T1 (T2 signals) | 7 days |
| T3 Continuation, instant | each candidate, from the close of the H4 candle that completes it | limit at the (refined) level | 20 pips | 2R | +1R | storyline end or 3 days | 2 days |
| T4 Continuation, confirmed | each candidate with a DC, from the DC candle's close | limit at the level | 30 pips | 100 pips (3.33R) | +1R | storyline end or 3 days from the DC | 2 days |

Fills on 5-minute candles: a limit fills on a candle starting at or after the order that trades to the level (at the open
when it opens past it); a close past the stop before a fill cancels the order; on the fill candle only the stop counts; a
candle that opens past the stop or target exits at its open; a candle holding both is a stop; break-even acts from the
candle after the one that reached it; time exit at the close of the first candle closing at or after the deadline. One
position at a time per market and test (a later fill while one is open is dropped). Every trade has its stop on the losing
side. R after the round-trip costs of `research/edge/combo-grid-2/run.mjs` `COSTS` (price units, cost / risk taken off R).
Trades whose fill falls in an interval of `research/edge/data-quality/quality.json` are dropped.

Not tested here: the Weekly form of the apex, the H1 refinement of the apex, the consequent-encroachment entry, the M5
confirmations (only the H1 DC is tested for T4), the two-feed check, momentum judgements and the "hold" decisions.

## Data, windows, the bar

18 markets: xau eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy xag gbpjpy eurgbp audjpy cadjpy euraud nas100
spx500 de40 (the last eight from 2019 only, levels warmed up from their first candle). Trades filled 2020-01-01 to the last
candle; discovery 2020-2023, confirmation 2024 to now; all 18 pooled; gold alone reported, not judged.

A test PASSES only if: discovery n >= 100, mean R after costs > 0, t of calendar-month sums >= 2; confirmation n >= 50,
mean R > 0, month-sum t >= 2 and its one-sided p < 0.05 after Holm over the four tests; and the confirmation mean is still
positive at twice the cost. The study PASSES if at least one test passes; it is INCONCLUSIVE if no test reaches the
discovery n; else it FAILS. A cut check is run: signals before a cut date must not change when the candles after it are
removed. No variant, parameter or market choice is changed after the run.

## Honest limits

2020-26 has been read by many studies of this repository on these markets (the combination grids among them): a pass here
would still need years no study read before it is called more than a hypothesis.

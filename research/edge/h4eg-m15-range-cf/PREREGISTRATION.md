# H4 engulf zone, then on M15 a break, a range at the extreme and a confirmation break back (pre-registration, 24 Nov 2026)

Written and committed alone BEFORE any run on real candles. Research only: nothing live reads it, nothing is placed, no rule is
proposed, no desk changes from it.

## Why

The desk reads an H4 engulf (EG) zone as a key level, and at it a three-step sequence one or two timeframes lower: price
breaks into the level, builds a range at the extreme it made there, and then breaks back out of that range with the zone's
side (the desk's BO / VR / CF reading). The trade is a resting limit at the level the confirmation break took, with the stop
past the range's extreme.

**What is already tested, and what is new here.** The big combination grids (`combo-grid-2`, `combo-grid-3`: chain H4 > M15,
zone `eg`, trigger "a break against, then a break with", entry at the trigger zone's edge, stop past the extreme) held this
combination among tens of thousands of cells, on 2020-26 / 2010-19 only, judged before costs, with limits filled on a touch of
mid candles (which `dom-trade-through` showed flatters a limit by about +0.05R a trade); nothing confirmed. `grid5-mosha-cycle`
used an untouched zone as a yes / no tag on the storyline (FAIL), `grid7-wide-fade` and `grid7-wide-core` traded the first M15
break at an H4 engulf zone at market (FAIL after costs). The nearest untested variation, and this study: the sequence alone,
8 cells fixed below, two long windows (2005-14 and 2015-26), judged AFTER costs, a limit that must be traded THROUGH beside the
touch fill, and a split on whether the range was really built at the extreme (after the break) or is the high / low the leg
came from. One run, no variants added after it.

## Data

- OANDA mid 5-minute candles of xau, eurusd, gbpusd, usdjpy, audusd from the shared cache (`research/edge/_lib/edgekit.mjs`,
  `EDGE_DATA`; read only, no fetch), 2004 (warm-up) to 2026-10-31. Gold's history starts in March 2006.
- Timeframes from the 5-minute candles with `combo-grid-3` `frames` (imported): 15m, 4h (UTC buckets).
- Exclusions: `combo-grid-2` `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0. The five markets are pooled.
- Costs: `combo-grid-2` `COSTS` (round trip in price units, the demo account's figures): xau 0.30, eurusd 0.00006,
  gbpusd 0.00008, usdjpy 0.008, audusd 0.00006. The same for every year.

## The rule (closed candles only; a buy is described, a sell mirrors it)

1. **Key level.** `combo-grid-3` `buildZones('eg', H4)` (imported, not edited): an H4 candle that closes above the high of the
   last candle of the other colour, at most three candles back; the zone is that earlier candle, wick to wick, side = buy. It is
   known from the close of the completing candle and ends when an H4 candle closes below its bottom (or at the end of its life,
   as that function gives it).
2. **Visit.** The first M15 candle that starts at or after the zone is known and trades into it (low <= top and high >= bottom).
   A visit ends at the first closed M15 candle wholly outside the zone; the next touch after that is the second visit. Only the
   first two visits of a zone are read.
3. **The sequence**, all inside 64 M15 candles (16 hours) counted from the visit's first candle, and before the zone ends:
   - **Break**: the first M15 structure event DOWN at or after the visit's first candle (`edgekit` `structure(M15, 3)`: a close
     below the last confirmed, unbroken swing low; swings are 3 candles a side and known 3 candles later).
   - **Confirmation break back**: the first M15 structure event UP after the break (a close above the last confirmed, unbroken
     swing high). Its candle is the confirmation candle; **the level** is the swing high it closed above.
   - **The range** runs from **the extreme** = the lowest low of the M15 candles from the break candle to the confirmation candle
     (both included) up to the level. The extreme must be at or below the zone's top (the range's extreme sits in or under the
     zone), and the zone must not have ended by the confirmation candle's close.
   - A second structure event down before the confirmation does not restart anything: the extreme simply follows the lows.
   - One sequence per visit. The same confirmation candle and side reached from two zones is one trade.
4. **Order.** At the confirmation candle's close: a buy limit at the level, stop = the extreme less 0.1 x ATR(14) of M15 at the
   confirmation candle. The order lives 24 M15 candles (6 hours) on the 5-minute candles that start at or after that close.
5. **Fill (two ways, a cell each).**
   - **touch**: the first 5-minute candle whose low is at or below the level; filled at the level (at the open when it opens
     below it).
   - **through**: the first 5-minute candle whose low is at or below the level less half the round-trip cost; filled at the
     level (at the open when it opens below it).
6. **Exit.** Risk = fill less stop. Target 1R or 2R from the fill (a cell each). On the fill candle only the stop can be hit.
   After it: a candle that opens beyond the stop or the target exits at its open; a candle that holds both the stop and the
   target is a stop. Time limit 2 days from the fill: out at the close of the 5-minute candle that reaches it.
7. **No trade** when the fill is at or beyond the stop, or the risk is smaller than the market's round-trip cost. Every trade
   has its stop on the losing side of its fill (the run throws otherwise). Trades may overlap (no one-at-a-time rule).

## The cells (8, fixed here)

Range (2) x fill (2) x target (2), named `<range> <fill> <target>`:

- **Range "any"**: every sequence above. **Range "built"**: only those whose level is a swing high whose own candle is at or
  after the break candle (the range was built at the extreme after the break; otherwise the level is a high from before it).
- any touch 1R; any touch 2R; any through 1R; any through 2R; built touch 1R; built touch 2R; built through 1R; built through 2R.

## The bar (judged AFTER costs, on calendar-month sums of R)

After-cost R of a trade = R less (round-trip cost / risk). A cell passes when ALL hold:
1. n >= 300 trades in each window;
2. mean after-cost R > 0 and after-cost month-sum t >= 2 in discovery;
3. mean after-cost R > 0 and after-cost month-sum t >= 2 in confirmation;
4. Holm-adjusted one-sided p < 0.05 over the 8 confirmation tests (p from the after-cost month-sum t, df = months - 1).

Verdict: **PASS** if one cell or more passes; **INCONCLUSIVE** if no cell passes and no cell has 300 trades in each window (too
few trades to judge); **FAIL** otherwise.

## Also reported (not part of the bar)

- Before-cost R and month-sum t beside every after-cost figure, win rate and the mean cost in R, per cell and window.
- Per market, each cell's n and after-cost R in each window.
- The funnel per market: zones, visits, sequences found, orders filled (touch / through), no-trades by reason.
- **Cut test**: on five dates in two markets, the orders known by a date, computed on candles cut there, equal the full run's.

## What a result means

A pass would be a hypothesis for a holdout on markets and years this run did not read, nothing more; it is not adopted and is
never called an edge. A fail closes this sequence at an H4 engulf zone on these years: no variant of these 8 cells is re-tested
on them.

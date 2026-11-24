# Structure breaks: looking for an improvement, then a holdout on eight unread markets (pre-registration, 24 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`structure-bos-choch-wide` (23 Nov 2026) failed: 0 of 51 cells. Its only before-cost tilt was the FADE at 2R (M15 BOS +0.066R a
trade, t 10.99 in 2015-26), which costs turn into a loss (-0.324R), because a fade's stop past the break candle is small
against the bid / ask (cost 0.39R a trade on M15, 0.23R on H1, 0.13R on H4). The owner asked for more study looking for an
improvement. Searching the same ten markets and years for "something that works" would find something by chance, so this
study has two steps:

1. **Search (in sample, NOT evidence).** A wide, fixed grid of improvements on the same ten markets, 2005 to Oct 2026, judged
   AFTER costs. A fixed rule picks at most five candidates from it.
2. **Holdout (the test).** The picked candidates, unchanged, on eight markets no structure-break study here has read:
   **gbpjpy, eurgbp, audjpy, cadjpy, euraud, nas100, spx500, de40** (OANDA mid 5-minute candles, from where OANDA's history
   starts in 2004-2005 to Oct 2026). `combo-grid-3` read their 2020-26 candles under OTHER rules (engulf / zone chains, not
   structure breaks); that is said, not hidden.

## The signals (unchanged from `structure-bos-choch-wide`, imported)

`structure-bos-choch-wide` `signals(frames(M5))`: every structure break on M15, H1, H4 (edgekit `structure`, 3 a side,
closed candles), with its kind (BOS / ChoCh), BOS count, next-timeframe-up side, and the three entries: **with** (stop past
the opposite swing + 0.1 ATR), **fade** (stop past the break candle's extreme + 0.1 ATR), **retest** (back to the broken
level on the next lower timeframe, then a close back beyond it; stop as with). Market entry at the next 5-minute open; every
trade has its stop on the losing side; a fill at or past the stop, or a risk under the round-trip cost, is no trade.
Exclusions: `combo-grid-2` `exclusions` (none are listed for the eight holdout markets).

## The search grid (324 cells, fixed here)

3 entries (with, fade, retest) x 3 timeframes (m15, h1, h4) x 4 exits x 9 filters.

- **Exits**: **2R**, **3R**, **4R** (stop first when one 5-minute candle holds both; a gap through either fills at the open),
  and **trail** = no target; once a 5-minute candle has traded +1R from the fill, the stop moves to 1R behind the best price
  reached so far (the highest high for a buy, lowest low for a sell), updated at each 5-minute close and in force from the next
  candle; it never moves back. Time limit for all: M15 1 day, H1 2 days, H4 5 days from the fill, out at the close of the
  5-minute candle that reaches it.
- **Filters** (on facts known at the entry):
  - **all**: every trade;
  - **cost10**: the round-trip cost is at most 0.10 of the trade's risk (a stop at least 10 bid / asks wide);
  - **big**: the break candle's range is at least 1.5 x ATR(14) of the trigger timeframe;
  - **small**: the break candle's range is under 1.0 x ATR(14);
  - **bos3**: a BOS that is the 3rd or later of its leg;
  - **choch**: a ChoCh;
  - **htfWith**: the next timeframe up's structure side equals the break's direction;
  - **htfAgainst**: it is the opposite;
  - **day**: the fill's UTC hour is 07:00-16:59 (London and New York).

Cells named `<entry> <tf> <exit> <filter>`.

## Windows and statistics

Discovery 2005-01-01 to 2014-12-31, confirmation 2015-01-01 to 2026-10-31 (fills); t = calendar-month sums of R (every month
of the window, an empty month 0). R after costs = R - round trip / risk (`combo-grid-2` `COSTS`; ASSUMED, not measured, for
xag, nzdusd, usdcad, usdchf, eurjpy and all eight holdout markets).

## The pick (applied to the search grid, mechanically)

A cell is **eligible** when, AFTER costs, it has n >= 300 in each window and mean R > 0 in each window. Eligible cells are
ranked by the SMALLER of their two after-cost month t; the top five are picked (fewer if fewer are eligible). Nothing else is
picked, nothing is tuned after the search.

## The holdout bar (the verdict)

Each picked cell is run unchanged on the eight holdout markets pooled, fills 2005-01-01 to 2026-10-31. It **passes** when, AFTER
costs: n >= 300, mean R > 0, month-sum t >= 2, and the Holm-adjusted one-sided p over the picked cells < 0.05 (p from the
month t, df = months - 1).

Verdict: **PASS** if one picked cell or more passes; **FAIL** if none passes or no cell is eligible in the search;
**INCONCLUSIVE** if fewer than 6 of the 8 holdout markets load.

## Also reported (not part of the bar)

Every search cell before and after costs; the picked cells on the holdout before costs too, per holdout market, and split
2005-14 / 2015-26; a cut test on the holdout markets. Nothing is called an edge without n and t; nothing is adopted.

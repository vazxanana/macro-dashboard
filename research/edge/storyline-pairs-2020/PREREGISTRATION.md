# Storyline pairs on 18 markets, 2020 to now: Daily level + H1 break, Weekly level + H4 break, three setups (pre-registration)

Written 23 Nov 2026, before any code of this study and before any of its trades were looked at. Research only: no live rule,
size, stop, desk or council file changes, whatever the result. The method comes from one school in the owner's notes; this file
describes it in its own words and fixes every reading the notes leave open. Earlier studies here touched parts of it
(`storyline-daily-gold`: a Daily rejection + H4 break with an H1 QM on gold, FAIL; `storyline-qm-sop`: too few trades), but none
tested this school's two working timeframe pairs with its three entry levels across many markets.

## Data
- Candles: the overnight toolkit cache (`research/edge/_lib/edgekit.mjs`), OANDA mid 5-minute candles, read from 2018-01-01 (or
  the market's first candle) to the last candle on file. Daily = `dailyNY` (17:00 New York trading days); Weekly = the Monday to
  Friday weeks of those days (`weekly` of `research/edge/combo-grid-2/run.mjs`); H4, H1, M15 = `resample` of the 5-minute candles.
  No 1-minute candles exist in the cache, so the school's M1 confirmations cannot be tested and are not.
- Markets (18): xau eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy xag gbpjpy eurgbp audjpy cadjpy euraud nas100
  spx500 de40 (the last eight from 2019 only). Pooled; gold alone is reported, never tested.
- Costs: the round trips of `COSTS` in `research/edge/combo-grid-2/run.mjs` (price units, the same every year).
- Data quality: a trade whose fill falls in an interval `exclusions(market)` of that file lists (from
  `research/edge/data-quality/quality.json`) is dropped.
- Windows, by fill time: discovery 2020-01-01 to 2023-12-31; confirmation 2024-01-01 to the last candle. Earlier candles only
  build levels. Trades still open at the last candle are not counted.

## Building blocks (one timeframe X at a time; closed candles only)
- **A / V level on closes**: candle i is an A level when its close is above the closes of the 2 candles before it and at or above
  the closes of the 2 after it (a V mirrors it). Price = that close. Known at the close of candle i + 2.
- **Fresh**: from candle i + 3 on, a level is fresh until a candle's high (A) or low (V) reaches it. Only that first touch counts.

## The storyline (sells written out; buys mirror every step)
Two pairings, each the school's two-timeframes-lower method: **Daily pairing** (level and rejection on D1, break on H1) and
**Weekly pairing** (level and rejection on W1, break on H4). H = the level timeframe, L = the break timeframe.
1. **Rejection**: the first H candle that reaches a fresh H A level closes back below it (close < level). Known at that H close.
   If that first touching candle closes at or above the level, the level gives nothing.
2. **Touch moment**: the start of the first 5-minute candle inside that H candle whose high reaches the level.
3. **External level**: the last L V level whose confirmation close is at or before the touch moment.
4. **External break**: the first L candle that closes after the touch moment (the candle holding the touch included) with a close
   below the external level, no later than the close of the H candle after the rejection candle, and before any L close above
   the rejected level (that ends it with no storyline). Internal breaks are not used.
5. **Start** of the sell storyline = the later of the rejection close and the break close.
6. **End** = the first of: an H close above the rejected level; price reaching (5-minute low at or below) the nearest fresh H V
   level below the break close known at the start (the next "airport"); the start of an opposite storyline of the same pairing;
   10 trading days after the rejection day (Daily pairing) or 8 weeks after the rejection week (Weekly pairing).

## The three setups (levels of the break leg on L)
The leg = the L candles from the one holding the touch moment to the break candle. Head = the leg's highest high (lowest low for
a buy).
- **QM**: the left shoulder = the most recent L A level whose candle is before the head candle, confirmed by the break close,
  priced below the head and above the external level. No such level = no QM setup.
- **RBS** (support becomes resistance for a sell): the external level just broken.
- **Gap**: the last pair of two consecutive bearish L candles (close < open) both inside the leg; level = the close of the first
  of the two; it must be above the break close. None = no Gap setup.
Each setup is taken at most once per storyline: its **first touch** = the first 5-minute candle starting at or after the start
whose high reaches the setup level, before the storyline ends.

## Confirmation and the trade
- **M5 confirmation (the tested one)**: an M5 QM sell (`qms` of edgekit on M5, swing size 2) whose head candle is at or after the
  touch candle, whose head is at or above the setup level, and whose breaking candle closes within 24 M5 candles of the touch
  candle's start (the first such QM; none = no trade). Entry: a **limit sell at the M5 QM's left shoulder** (the swept high of
  the pattern), resting from the QM close for 24 M5 candles; cancelled by an M5 close above the M5 QM head or by the storyline's
  end. **Stop** = the M5 QM head + half the round-trip cost. **Target** = 3R from the planned entry (the school's 1:3 default).
  **Time exit** = 120 hours after the fill (Daily pairing), 240 hours (Weekly pairing). A planned risk under twice the round-trip
  cost = no trade. Every trade has its stop on the losing side.
- Fills with `simulate` of edgekit on the 5-minute candles: a limit fills only on a candle starting after the order that trades to
  the entry, and on that candle only the stop counts; stop first when one candle holds both; a gap through the stop fills at the
  open.
- One position at a time per test and market (a resting order counts); orders taken in time order.

## Tests (6; Holm over these six)
T1 Daily-QM, T2 Daily-RBS, T3 Daily-Gap, T4 Weekly-QM, T5 Weekly-RBS, T6 Weekly-Gap, each with the M5 confirmation, all 18
markets pooled. Statistic: mean R a trade after costs; t of calendar-month sums over each window's fixed month grid (empty months
count 0); one-sided p from that t (df = months - 1).

## Pass bar (per test)
Discovery: n >= 100, mean R after costs > 0, month-sum t >= 2. Confirmation: n >= 50, mean R after costs > 0, month-sum t >= 2
and its Holm-adjusted one-sided p < 0.05. Mean R at twice the cost > 0 in both windows.
- **PASS** if at least one test meets every line (that test is then a hypothesis for its own pre-registered test on data none of
  these studies read, never adopted here).
- **FAIL** if none passes and at least one test reaches both n bars.
- **INCONCLUSIVE** if no test reaches both n bars.

## Reported, never part of the verdict
Gold alone for each test; each market; buys and sells; by year; two descriptive confirmations: the **M15 rejection candle** (the
first M15 candle holding the touch or starting within 2 hours after it whose high reaches the setup level and whose close is back
below it; market at the next 5-minute open; stop = that candle's high + half the cost; 3R) and **no confirmation** (a limit at
the setup level from the start, stop = the leg head + half the cost, 3R); storyline counts.

## Fixed before the run
Swing size 2 on closes, the one-H-candle break window, the storyline lives (10 days / 8 weeks), 24 M5 candles, the 3R target, the
time exits, half the cost as the stop buffer, the twice-the-cost minimum risk. A bug found in code is fixed and said in RESULT.md;
no number is tuned. A no-look-ahead test runs before the windows are read: orders placed before a cut must not change when every
candle after the cut is removed.

# Pre-registration: trade gold only while H1, H4 and D1 all agree (14 Nov 2026)

Written and pushed alone, before any number of this study is computed.

## Why, and what it is not
"Trade only when every timeframe agrees" is one of the most repeated rules in retail trading courses (the top-down alignment
the owner's skills also describe in words). The repository has never tested it as a mechanical rule on gold. None of the seven
candidates of `research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`) is a stand-alone gold rule, so
this topic is chosen by the study's author, said plainly. Nearest tested topics and the difference:
`gold-macd` (daily MACD / 50-200 cross, one timeframe, FAIL), `gold-ichimoku` (daily and H4 Ichimoku, one timeframe each, FAIL),
`gold-h4-supertrend` (H4 ATR band, FAIL), `gold-tsmom` (monthly 12-month sign, FAIL), `gold-intraday-momentum` (the day's first
move, FAIL), `msnr-direction` (structure call as a direction filter, FAIL), `gold-systems(-oos)` (the live gold rules). None
asks that three timeframes agree at once. It is a **stand-alone rule**: never a gate, exit, entry or size of the live gold book
(owner decision 44 untouched), and it reads nothing of it. Nothing live changes; a pass would only be a lead for the owner.
No published paper is relied on; the prior is weak (every single-timeframe gold trend rule tested here failed out of sample).

## Data (fixed before any result)
OANDA mid XAU/USD H1 candles `[t, o, h, l, c]` (unix seconds of the candle start), March 2006 to November 2026, from a local
cache outside git (the site's candle proxy, as the other gold studies). Market set: gold only.

## Candles
- New York trading day = 17:00 New York to 17:00 New York (New York's own daylight saving, `council/histdata.mjs` `nyOffsetH`).
  H1 candles from Friday 17:00 to Sunday 17:00 New York (weekend stubs) are dropped everywhere.
- H4 = six blocks of a trading day starting 17:00 New York; D1 = the trading day. Open = first H1 open, high / low over the
  block, close = last H1 close. A block with missing H1 candles still counts.
- **A candle is read only once it has closed**: an H4 / D1 candle counts as closed at the first hour after its last H1 candle
  whose start falls outside it (the block's own end, or the weekend). At the close of an H1 candle only H4 / D1 candles closed
  at or before that moment are read.

## Indicator and state
EMA(20) of closes on each timeframe separately (first value = simple mean of the first 20 closes, then k = 2 / 21).
At the close of each H1 candle: **up** when the H1 close > its EMA(20), the last closed H4 close > the H4 EMA(20) and the last
closed D1 close > the D1 EMA(20); **down** when all three are below; otherwise **mixed**.

## Trading rule
- **Entry**: the state turns up (from down or mixed) at an H1 close: buy at the next H1 candle's open. Turns down: sell
  (both-sides tests only). One position at a time.
- **Exit (T1, T2)**: at the first H1 close where the state is no longer the position's side, exit at the next H1 open.
  **Exit (T3)**: only when the D1 condition turns against the position (D1 close on the other side of its EMA, read at the
  first H1 close after that D1 candle closed), exit at the next H1 open.
  A new entry needs a new turn of the state after the exit.
- **Protective stop (every trade has one)**: at entry, 2 x ATR(14) of the last closed H4 candle (Wilder; first value the simple
  mean of 14 true ranges) from the entry price, never moved. Checked on every H1 candle from the entry candle on (the entry
  candle's own range counts): touched = filled at the stop, or at the H1 open when it opened beyond it (gap). After a stop the
  rule waits for a new turn.
- 1R = entry to the stop. R = (exit - entry) / 1R for buys, mirror for sells. A trade still open at the data's end is not
  counted.

## Costs
$0.60 a round trip on every trade. Financing on buys only: `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` x entry
/ 1R (the demo broker's measured XAUUSD rate of 11 Nov 2026, charged for every past year); sells pay and receive nothing.
2x costs = both doubled.

## Tests (three, Holm over the three)
- **T1** both sides, exit when the three-timeframe agreement ends (primary).
- **T2** buys only, the same exit.
- **T3** both sides, exit only when D1 turns against the position.

## Windows and statistics
A trade belongs to the window of its entry. In sample (IS): entries 1 Jan 2007 - 31 Dec 2016 (2006 is warm-up). Out of sample
(OOS): entries 1 Jan 2017 - 31 Oct 2026. Net R summed by exit calendar month over every month of the window (zero months
included); t = mean / (sd / sqrt(months)); p two-sided from the normal approximation; Holm over the three OOS tests.

## Pass bar (per test; a test passes only if all hold)
1. OOS net month-sum t >= 2 and Holm-adjusted p < 0.05;
2. IS net total R of the same sign (positive);
3. OOS net total R still positive at 2x costs;
4. **Placebo**: 40 seeded random runs (seeds 1-40) in the OOS window, each with the same number of OOS trades as the test, at
   entry H1 candles drawn uniformly without replacement, the side drawn at random (T2: buys only), the hold length (in H1
   candles) drawn from the test's own OOS holds, the same 2 x ATR(14) H4 stop, costs and financing; one position at a time
   (an entry falling inside an open placebo trade is skipped). The test's OOS net month t must beat the placebo's in at least
   38 of the 40.

## Reported, never judged
Gross / net / 2x-cost tables for both windows; by year; worst drawdown in R; win rate; average hold; stop exits vs rule exits;
the buy and sell legs of T1 and T3 apart; correlation of monthly net R with gold's monthly buy-and-hold change.

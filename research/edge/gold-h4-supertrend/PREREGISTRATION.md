# Pre-registration: the standard Supertrend reversal system on gold's H4 chart (14 Nov 2026)

Written and pushed alone, before any number of this study is computed.

## Why, and what it is not
The Supertrend (an ATR band trailed under or over price that flips with a close through it) is one of the most published
retail trend indicators and is not in the repository's record: the closest studies are `gold-tsmom` (monthly 12-month sign,
FAIL), `gold-macd` (daily MACD and 50/200 crosses, FAIL), `gold-ichimoku` (daily and H4 Ichimoku, FAIL), `trend-breadth-h1`
(the live Gold trend rule on other markets, FAIL), `gold-systems(-oos)` (the live gold rules), `gold-vol-target` and
`crypto-trend-decay`. None tests an ATR-band stop-and-reverse on gold H4. This is a **stand-alone rule**: never a gate, exit,
entry or size of the live gold book (owner decision 44 is untouched), and it reads nothing of it. Nothing live changes; a pass
would only be a proposal to the owner.

## Data (fixed before any result)
OANDA mid XAU/USD H1 candles `[t, o, h, l, c]` (unix seconds of the candle start), March 2006 to November 2026, read from a
local cache outside git (the same proxy as the other gold studies). Market set: gold only.

## H4 candles
Six blocks a New York trading day starting at 17:00 New York (17, 21, 01, 05, 09, 13 h New York local time, so daylight saving
is followed through New York's own offset). An H1 candle belongs to the block holding its start time. H1 candles from Friday
17:00 to Sunday 17:00 New York (weekend stubs) are dropped. An H4 candle = the first H1 open, highest high, lowest low, last H1
close of its block; a block with fewer H1 candles (holiday, halt) still counts. Only closed H4 candles are read: the block that
is still forming at the data's end is dropped. A gap between candles is not filled: the next candle opens where it opens.

## Indicator (standard)
True range on H4, ATR = Wilder's average with period P (first value = simple mean of the first P true ranges).
hl2 = (high + low) / 2; basic upper = hl2 + M x ATR; basic lower = hl2 - M x ATR.
Final lower(i) = basic lower(i) if basic lower(i) > final lower(i-1) or close(i-1) < final lower(i-1), else final lower(i-1);
final upper(i) = basic upper(i) if basic upper(i) < final upper(i-1) or close(i-1) > final upper(i-1), else final upper(i-1).
Trend: starts up on the first candle with an ATR; an up trend turns down when close(i) < final lower(i-1); a down trend turns
up when close(i) > final upper(i-1). The line = final lower in an up trend, final upper in a down trend.

## Trading rule
- **Entry**: on a closed H4 candle whose close flips the trend, any open position is closed and the new side is opened at the
  next H4 candle's open (the first H1 open of the next block). Always in the market (T1, T3); T2 takes only the buys and is flat
  through the down trends.
- **Close-based exit**: the Supertrend line trails with every closed H4 candle; a close through it is the flip above, so the
  position exits at the next H4 open (the same price the reverse position opens at).
- **Protective stop (every trade has one)**: a hard stop placed at entry at the signal candle's line minus 1 x its ATR (buys)
  or plus 1 x its ATR (sells). At each later H4 close it moves to the new line -/+ 1 x the new ATR **only when that is tighter**
  (never looser). It is checked on every H1 candle from the entry candle on: touched = filled at the stop, or at the H1 open
  when the open is already beyond it (gap). After a hard-stop exit the rule is flat until the next flip.
  A signal whose next open is already at or beyond its initial hard stop opens no trade (flat until the next flip).
- **1R** = entry price to the initial hard stop. R of a trade = (exit - entry) / 1R for buys, (entry - exit) / 1R for sells.
- A trade still open at the data's end is not counted.

## Costs
$0.60 a round trip on every trade (in R: 0.60 / 1R). Financing on buys only: `council/fills.mjs` `nights(entry, exit)` x
`FIN.xau.long` x entry / 1R (the demo broker's measured XAUUSD rate of 11 Nov 2026, charged for every past year); sells pay and
receive nothing. 2x costs = both doubled.

## Tests (three, Holm over the three)
- **T1** both sides, ATR 10, multiplier 3 (primary).
- **T2** buys only, ATR 10, multiplier 3.
- **T3** both sides, ATR 10, multiplier 4.

## Windows and statistics
A trade belongs to the window of its entry. In sample (IS): entries 1 Jan 2007 - 31 Dec 2016 (2006 is indicator warm-up).
Out of sample (OOS): entries 1 Jan 2017 - 31 Oct 2026. Net R is summed by exit calendar month over every month of the window
(zero months included); t = mean / (sd / sqrt(months)); p two-sided from the normal approximation; Holm over the three OOS tests.

## Pass bar (per test; a test passes only if all hold)
1. OOS net month-sum t >= 2 and Holm-adjusted p < 0.05;
2. IS net total R of the same sign (positive);
3. OOS net total R still positive at 2x costs;
4. **Placebo**: 40 seeded random runs (seeds 1-40) in the OOS window, each with the same number of flips as the test has in
   that window, at H4 candles drawn uniformly without replacement, sides alternating from a random first side (T2: only the
   buy legs are traded), the same entry, cost and financing machinery, the hard stop at close -/+ (M + 1) x ATR(P) of the
   flip candle trailed the same way (tighter only), exit at the next random flip's open or the hard stop. The test's OOS net
   month t must beat the placebo's in at least 38 of the 40.

## Reported, never judged
Gross / net / 2x-cost tables for both windows; by year; worst drawdown in R (summed net R in exit order); win rate; average
hold; hard-stop exits vs flip exits; correlation of the monthly net R with gold's monthly buy-and-hold return (month-end close
change), so a rule that is only a disguised long is visible; the buy and sell legs of T1 apart.

# Pre-registration: gold back at its rising 50-day average after a run away from it, on H4 (14 Nov 2026)

Written, committed and pushed alone before `run.mjs` existed and before any trade or outcome of this rule was computed. Only
the number of signals per window was counted (below), as the study brief asks, so that the windows hold at least 100 events.
Paper research: nothing here is read by the council, the mirror or the page, and no live rule changes whatever the verdict.
Not an ICT study.

**Item 44 (docs/owner-decisions.md).** A NEW stand-alone rule on spot gold. It is not a gate, an exit, an entry or a size of
the gold book (Gold trend / Gold daily engulf), reads none of that book's positions or trades, and its verdict says nothing
about that book. It is decided on 2017 to October 2026; 2007-16 is the in-sample window.

## The idea, and why it is not a duplicate

The trader's saying: in an uptrend, the first return to the slow moving average after price ran well away from it is support,
so buy the return (the mirror in a downtrend). Measured here as a distance in units of gold's own volatility: d = (close −
average) / ATR. No oscillator is used.

Nearest tested topics, read before writing this:
- `gold-200d-stretch` (fade z beyond ±2 sd of the 200-day average: FAIL), `gold-daily-bollinger`, `gold-premium-discount`,
  `gold-shock-revert`, `gold-capitulation`: they FADE a stretch away from an average or a range. This study trades the
  OPPOSITE moment: the stretch is over, price is back at the average, and it trades WITH the average's slope.
- `sma10-timing`, `crypto-sma200`, `gold-tsmom`, `risk-cross`: the average (or a return sign) as a regime switch, held while
  price is on one side. Here nothing is held "while above"; the event is the return to the average from the far side.
- `gold-h4-pullback-resume` (20-candle H4 closing breakout, 38.2 % retracement, H1 close above the recent high), the Mosha /
  cycle studies (swing structure), `rsi2-pullback` / `metals-rsi2` (an oscillator), `gold-ote-retrace` (Fibonacci), the
  gold momentum pullback system (H1 momentum candle, intraday): no moving average, no ATR distance.
- The daily version of this idea was counted first and was dropped before any outcome was seen: on daily candles it gives
  only 30-70 signals a side per window (short of the 100 the brief requires), so the rule is read on H4 candles.

The prior is weak: support at a moving average is folklore, and every pullback study on gold so far failed. Said here.

## Data (fixed)

- OANDA mid H4 XAU_USD, UTC-aligned candles (00, 04, … 20 UTC) as the site's keyless candle proxy serves them
  (`/md/bars?sym=xau&tf=4h`), 2006-03-19 to 2026-10-30, complete candles only; fetched by `run.mjs fetch <file>`, kept out of
  git and deleted after the run. Market set fixed now: gold (XAU/USD) only.
- A candle is read only once closed (its end = start + 4 h). Nothing at or after the entry candle is read by a signal.

## The rule (everything at the close of H4 candle i)

- SMA = mean of the closes of candles i-299 .. i (300 H4 candles, about 50 trading days). ATR = mean true range of candles
  i-41 .. i (42 H4 candles, one week). d(i) = (close(i) − SMA(i)) / ATR(i).
- **Uptrend** at i: SMA(i) > SMA(i-30) (rising over the last 30 candles, about 5 days). **Downtrend**: SMA(i) < SMA(i-30).
- **Buy signal** (uptrend): d(i-1) > 1 and −1 < d(i) ≤ 1 (the first close back within one ATR of the average, from above,
  not through it), and max d over candles i-120 .. i-1 ≥ 3 (price was at least 3 ATR above the average in the last 20 days).
- **Sell signal** (downtrend): the exact mirror (d(i-1) < −1, −1 ≤ d(i) < 1, min d over i-120 .. i-1 ≤ −3).
- **Each signal is its own trade** (overlapping trades allowed; dependence is handled by the month-sum t). The one-position-
  at-a-time stream is reported beside it, not tested.
- Entry at the open of candle i+1. Stop 3 × ATR(i) from the entry on the losing side (= 1R), checked from the entry candle; a
  later candle that opens past the stop exits at its open, else the stop fills at the stop. Every trade has a stop.
- Exit at the close of the 30th candle held (entry candle included, about 5 trading days) unless stopped. A trade whose 30
  candles run past the data is not taken.

## Tests (Holm over these three)

- **T1 (primary) buy the return to a rising average.**
- **T2 sell the return to a falling average.**
- **T3 both sides as one stream** (T1 and T2 trades together).

## Costs

$0.60 a round trip on every trade, and on buys overnight financing `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a
rollover, the demo broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x the entry price; sells pay and earn nothing.
R = move / (3 × ATR). "2x costs" doubles the spread and the financing. Entry time = the entry candle's start; exit time = the
exit candle's end (a stop: the candle's middle).

## Baseline, excess, windows and statistics

- **Same-side every-candle baseline** per window: the same side (buy for T1, sell for T2, each trade's side for T3) entered at
  the open of EVERY H4 candle of the window, same stop, same 30-candle hold, same costs. Its mean net R a trade is B.
- **Excess** of a rule trade = its net R − B of its side and window. The tested statistic is the mean excess.
- IS = trades entered 2007-01-01 to 2016-12-31; OOS = 2017-01-01 to 2026-10-31 (entry candle start). OOS halves 2017-21 and
  2022-26 reported only.
- t = mean / standard error of calendar-month sums of excess (every month of the window counts, an empty one as 0), one-sided
  p from the normal. Holm over T1-T3 on the OOS p. Net R and its month t are reported beside it.
- **Placebo, 40 seeds** (mulberry32 seeds 1..40): each OOS rule trade is moved to an entry candle drawn uniformly from all OOS
  candles, keeping its side; same stop, hold and costs. The rule's OOS mean excess must beat at least 38 of the 40 placebo means
  (their excess over the same B).
- **Control, 40 seeds** (mulberry32 seeds 101..140), keeping drift and volatility and removing the order of the moves: the H4
  candles of each calendar year are shuffled within that year (each candle kept as its open gap from the previous close and its
  high, low and close relative to its own open, all as ratios), the price path is rebuilt from the first candle, and the whole
  rule (SMA, ATR, signals, trades, baseline B on the rebuilt path) is run again. The rule's OOS mean excess must beat at least
  38 of the 40 control values.

## Pass bar (all needed, per test)

OOS n ≥ 100; OOS mean excess > 0 with month-sum t ≥ 2 and Holm-adjusted p ≤ 0.05; OOS net R a trade > 0; IS mean excess > 0
(same sign); OOS net R a trade > 0 at 2x costs; beats ≥ 38 of 40 placebos and ≥ 38 of 40 controls. **The verdict follows T1
(primary)**: PASS if T1 passes; a T2 or T3 pass alone is reported as a lead, not a pass. Either way a pass is a lead to replicate
(silver, other averages fixed in a new pre-registration), not an edge to trade; no proposal follows.

## Signals counted before this was written (counts only; no outcome computed)

With the rule above, signals in IS 2007-16: 143 buys, 120 sells; OOS 2017 to Oct 2026: 106 buys, 104 sells. (Parameters
counted on the way: 600-candle average, prior stretch 4 or 6 ATR; dropped for fewer signals, not for any result.)

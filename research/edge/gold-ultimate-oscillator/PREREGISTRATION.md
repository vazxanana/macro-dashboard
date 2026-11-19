# Pre-registration: Williams' Ultimate Oscillator extremes on gold's daily chart, against the same-side trade on every day (14 Nov 2026)

Committed and pushed ALONE, before any return, trade or statistic of these rules was computed. Only the number of signal
days per window was counted beforehand (to check the test has enough events): about 120 crossings a window, both sides.

**Question.** When Larry Williams' Ultimate Oscillator (UO 7 / 14 / 28, "The Ultimate Oscillator", Technical Analysis of
Stocks & Commodities, 1985) on spot gold's daily chart enters its oversold or overbought zone, does a mean-reversion trade
taken at the next open do better than the same-side trade taken on any day? The comparison against every day's same-side
trade is the primary test, so gold's upward drift (which flatters any long) cannot pass for a signal.

**Why this topic.** A textbook oscillator with a published origin that no study here has used. Dedupe read: `gold-cci`,
`gold-mfi`, `gold-weekly-stoch`, `gold-rsi-divergence`, `metals-rsi2` / `rsi2-*` (2-day RSI pullback in a trend),
`gold-ibs` (close location of one day), `gold-williams`-type names (none), `gold-daily-bollinger`, `gold-shock-revert`,
`gold-capitulation`; the scratch topic list of 14 Nov and every remote branch name (no "ultimate" or "uo"). The UO differs
from those: it weights buying pressure (close minus the true low) over three horizons at once, 4 : 2 : 1. Chosen by me, not
after reading any gold table.

**What this is not.** A stand-alone rule tested on its own. It is **not** a gate, exit, entry, filter or size of the live
gold book (Gold trend + Gold daily engulf) and reads nothing of it; owner decision 44 is untouched. Paper research only:
nothing live changes, and a pass would only be reported to the owner, never applied.

## Data (fixed before any result)

- Market: **spot gold only (XAU/USD)**, OANDA mid daily candles, council-data `research/daily/xau.json`, read with
  `git show origin/council-data:research/daily/xau.json` (no network, kept outside git). Rows start 20 March 2006.
- Weekend candles folded into the next weekday with `council/fills.mjs` `foldWeekend`; only complete days (a row dated on or
  after the file's `updated` day + 1 is dropped).
- No signal before 1 January 2007 is traded (warm-up).

## The indicator

- Buying pressure BP(i) = close(i) - min(low(i), close(i-1)); true range TR(i) = max(high(i), close(i-1)) - min(low(i),
  close(i-1)).
- Avg_n(i) = sum of BP over the last n days (i included) / sum of TR over the same days, n = 7, 14, 28.
- UO(i) = 100 x (4 x Avg7 + 2 x Avg14 + Avg28) / 7. Defined from the 29th candle on.
- ATR(14) = simple mean of the last 14 true ranges up to and including day i.
- Everything is read on the CLOSE of day i; the order fills at the OPEN of day i+1. Nothing of day i+1 or later is read.

## Signals and trades

- **Long signal** on day i: UO(i) < 35 and UO(i-1) >= 35 (the close that enters the oversold zone).
- **Short signal** on day i: UO(i) > 65 and UO(i-1) <= 65 (the close that enters the overbought zone).
- Thresholds 35 / 65: Williams' 30 / 70 gives about 8 long crossings a window on gold, too few to test; 35 / 65 was fixed
  from the event count alone, before any return was seen.
- **Trade**: enter at the open of day i+1 in the signal's direction. **Every trade has a stop**: 2 x ATR(14) of day i from
  the entry, set at entry and never moved, checked on days i+1 to i+5 (low for a long, high for a short; a day opening
  beyond the stop fills at the open). Otherwise exit at the open of day i+6 (five trading days held). A trade with fewer
  than six candles after its signal is not counted. Every signal is its own trade (they can overlap; each is 1R).
- 1R = the stop distance. Gross R = (exit - entry) x side / stop distance.
- **Baseline**: the same trade (same side, entry at the next open, same 2 x ATR stop, same five-day exit, same costs)
  taken after EVERY day of the window. Per window and side, the baseline mean net R is computed; a signal trade's
  **excess** = its net R minus the baseline mean net R of its side and window (at 2x costs, minus the 2x-cost baseline).

## Costs

- **$0.60 an ounce a round trip** on every trade (0.60 / stop distance in R).
- **Financing on buys**: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's XAUUSD
  swap of 11 Nov 2026, `council/fills.mjs`) x entry price / stop distance, today's rate for every year. Shorts are charged
  and credited nothing. An open fill is stamped at the day's 00:00 UTC; a stop inside a day at 12:00 UTC.
- **2x costs**: $1.20 a round trip and twice the financing.

## Windows

- **In sample (IS)**: signal trades entered 1 January 2007 to 31 December 2016.
- **Out of sample (OOS)**: entered 1 January 2017 to the last complete candle (early November 2026).

## The three tests (Holm over these three)

- **T1 (primary): both sides pooled, excess net R** over the same-side every-day baseline.
- **T2: long side only (oversold), excess net R.**
- **T3: short side only (overbought), excess net R.**

## Statistics

- Per test and window: n, win rate, R a trade gross and net, net at 2x costs, the baseline's R a trade, excess a trade (net
  and 2x), worst drawdown of the cumulative net.
- **Month t**: excess net R summed by the calendar month of each trade's exit, over every calendar month of the window (a
  month without an exit counts 0); t = mean / (sd / sqrt(months)); two-sided p from Student's t; the OOS p's of T1-T3 are
  Holm-adjusted. The same month t on the plain net R is reported beside it.
- **Placebo**: 40 seeded draws (mulberry32, seeds 1-40); each draws the same number of trades per side as the test's OOS
  signals, on random OOS days, with the same mechanics, and records its mean excess net R. Reported as how many of the 40
  the real OOS excess beats.

## Pass bar (per test; the verdict is the primary test T1)

All of: (1) OOS excess net R a trade > 0 with month t >= 2 and Holm-adjusted p < 0.05; (2) IS excess net R a trade > 0
(same sign); (3) OOS excess at 2x costs > 0; (4) OOS plain net R a trade > 0 (the signal must also be a trade, not only
"less bad" than the baseline); (5) the real OOS excess beats at least 38 of the 40 placebo draws; (6) OOS n >= 100.
T2 and T3 can pass or fail on the same bar (n >= 30 there) and are reported, but the verdict is PASS only if T1 passes.

Whatever the result, nothing live changes: a pass would be a candidate for the owner, with its own forward record first.

# Pre-registration: the measured move (ABCD) on gold H4 (14 Nov 2026)

Written and committed alone, before any trade of this study is computed. The candle file's span was checked (first and last
time, no hole over four days); no pattern, trade or statistic was looked at.

## Why
The classic measured move (also called ABCD): a leg A to B, a retracement B to C of 38-79 % of it, then a close beyond B; the
claim is that price then travels to D = C + (B - A), the first leg's length again from C. No study here has tested it on gold
(read before writing this: `mosha-retrace`, `mosha-cycle`, `gold-trend-*` / `gtrend-exits`, `trend-breadth-h1`, `msnr-direction`,
`msnr-entry`, `meridian-swing`, `swing-day3`, the untested backlog of 14 Nov: none uses a measured-move target). The earlier
structure studies on gold all failed after costs, so the expectation is not favourable.

**This is a stand-alone rule.** It is never a gate, exit, entry or size of the live gold book (Gold trend, Gold daily engulf):
item 44 (no further test on that book's 2006-17 window) is not touched. Whatever the verdict, nothing live changes; a pass would
only be a candidate for a separate paper shadow, decided by the owner.

## Data
OANDA mid H1 XAU_USD through the site's candle proxy (`/md/bars`, from March 2006; cache kept out of git; `run.mjs fetch <dir>`
rebuilds it). One market: gold. **H4 candles** are built from the H1 candles in fixed UTC buckets starting at 02, 06, 10, 14, 18
and 22 UTC (an H4 candle = the H1 candles whose start falls in its four hours: open of the first, high / low over all, close of
the last; a bucket with fewer than four H1 candles, such as the Sunday reopen, is still a candle). The last, possibly forming,
bucket is dropped. **Daily candles (T3 only)** are 17:00 New York trading days (`gold-drd-long` `nyDay`, weekend hours dropped).

## The rule (closed candles only)
- **Swings**: 3-a-side pivots on H4: a swing high is a candle whose high is strictly above the highs of the 3 candles before and
  the 3 after it (lows mirror). A pivot at index j is known only once candle j + 3 has closed.
- **Swing list**: confirmed pivots are taken in index order into one alternating list. A new pivot of the same kind as the last
  one in the list replaces it only if it is more extreme (a higher high, a lower low), else it is ignored. A candle that is both
  a swing high and a swing low is entered high first, then low.
- **Long setup**: the list's last three entries, at the moment the newest one is confirmed, are A (low), B (high), C (low) with
  indices a < b < c, C > A (a higher low), AB = B - A >= 2 x ATR(14) on H4 (ATR = simple mean of the true range of the 14 H4
  candles ending with candle b), and BC = (B - C) / (B - A) between 0.382 and 0.786 inclusive. **Short setup**: the mirror
  (A high, B low, C a lower high, same filters).
- **Trigger**: the first H4 candle with index k >= c + 1 that closes beyond B (long: close > B). If that close comes before the
  pivot C is confirmed (k < c + 3), the setup is skipped (it triggered before it could be seen). The setup is cancelled if,
  before the trigger, a candle trades through C (long: low <= C) or 30 H4 candles pass after C's confirmation (k > c + 33). A
  setup replaced in the list (a lower C, a new swing) is evaluated afresh as its own setup at its own confirmation.
- **Entry**: the open of the next H4 candle after the trigger close (k + 1).
- **Stop**: C - $0.30 for a long (C + $0.30 for a short): always on the losing side of the entry, since the entry is beyond B.
- **Targets**: D = C + (B - A) (long; short mirror). T2's target is halfway: B + 0.5 x (D - B). A trade whose entry open is
  already at or beyond its target is skipped.
- **Management**, from the entry candle on (it counts as candle 1): a candle that reaches the stop exits at the stop (at the open
  when it opens through it); a candle that reaches the target exits at the target; a candle that reaches both counts as the stop.
  If neither is hit, out at the close of the 30th H4 candle.
- **One position at a time per test**: a setup whose entry falls while the same test still holds a position is skipped.
- **Costs**: $0.60 a round trip, plus overnight financing on buys by `council/fills.mjs` `nights` x `FIN.xau.long` (0.000148 of
  the entry price a rollover, Wednesday three; the cTrader demo's XAUUSD long swap of 11 Nov 2026, the rate the council charges;
  sells pay and earn nothing). R = (exit - entry) / risk per unit with risk = |entry - stop|; net = R - 0.60 / risk - financing R.
  The 2x run doubles both the $0.60 and the financing.

## Tests (three; Holm over the three, one-sided p from the out-of-sample month t, normal approximation)
- **T1**: target D.
- **T2**: target B + 0.5 x (D - B).
- **T3**: T1, taken only when the last trading day closed at or before the entry time closed on the trade's side of its 50-day
  simple average of daily closes (long: close > average; short: close < average).

Windows by entry date: **in sample 2008-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31** (2006-07 is warm-up only;
trades entered after October 2026 are left out). Month t = mean / (sd / sqrt n) of calendar-month sums of net R, every calendar
month of the window counted (0 for a month with no trade).

**A test passes only if ALL hold**: out-of-sample net R a trade > 0; out-of-sample month t >= 2; Holm-adjusted p < 0.05;
in-sample net R a trade > 0 (same sign in both halves); out-of-sample net R a trade > 0 at 2x costs; the real out-of-sample mean
beats at least 38 of the 40 placebo means; out-of-sample n >= 30. T1 is the primary test; the study's verdict is PASS if any
test passes (each is reported with its own line), FAIL otherwise.

## Placebo (per test, out of sample)
40 seeds (a seeded generator). Each real out-of-sample trade is replayed at the same entry candle with the same stop distance and
the same target distance in dollars, the side drawn at random (one coin per trade), managed by the same rules, with the same
costs and financing for buys. One mean net R per seed; the real mean is compared with the 40.

## Reported, not tested
The share of trades reaching D (T1) against the placebo's share; gross R; by side, by year, by exit (stop / target / time);
setups found, skipped and why; worst drawdown; profit factor.

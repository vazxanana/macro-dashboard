# Pre-registration: gold's daily swing-structure flip, the "1-2-3" (14 Nov 2026)

Written and pushed alone, before any swing of gold is located and before any trade of this study is simulated.

## Question
On spot gold's daily candles, when a higher low (a confirmed swing low above the previous swing low) is followed by the first
daily close above the swing high between them, the swing structure has turned up (a "1-2-3" bottom: low 1, high 2, higher low 3,
then the break of 2). Does gold then keep going up over the next two weeks by more than chance, after costs and financing? And
the mirror: a lower high followed by the first close below the swing low between them, a short. This is a classic chart-structure
reversal rule; the study asks it of gold alone, both sides together.

## Dedupe (each RESULT.md read, or its branch)
- `msnr-direction` (FAIL): a close beyond the last swing level after price tapped a key level one timeframe above, used as a
  direction FILTER (excess return over 1 / 5 / 20 days), no trades, no stop; needs the key-level tap. Not this rule.
- `gold-measured-move` (FAIL): ABCD on H4 with a target at D. Not a daily higher-low break with a time exit.
- `gold-daily-turtle-soup` (FAIL), `gold-key-reversal`, `gold-pdhl-break`, `gold-13w-low`, `gold-record-high`: failed breaks,
  one-candle patterns, levels and multi-week extremes. No swing sequence.
- `gold-regime-switch`, `gold-daily-bollinger`, `gold-box-fade`: range / band rules. `gold-tsmom`, `trend-breadth*`,
  `gold-drd-*`, `gold-streak`, `gold-weekly-momentum`: trend and momentum. Not a structure flip.
- `meridian-swing`, `swing-day3`: the council's swing setups and an index day-3 model. Not this.
- The untested backlog (`research/proposals/2026-11-14-untested-backlog.md`) and the scratchpad topic list do not list it.

## Relation to the gold book (owner decision 44)
A stand-alone daily rule. It reads nothing of the book (Gold trend + Gold daily engulf), its records or `legs.json`, and is not a
gate, exit, entry or size of it. Windows are the common stand-alone windows below; the decision rests on the out-of-sample one.
Said plainly: 2007-16 daily gold has been read by many earlier studies, and gold rose strongly in 2017-26, so the long side earns
the drift; the primary test is both sides together and the placebo removes only the timing.

## Data
OANDA mid XAU_USD daily candles (UTC days), council-data `research/daily/xau.json` at commit `f6288251e` (March 2006 to
6 Nov 2026), read with `git show` (no network). Weekend stubs folded into the next weekday with `council/fills.mjs` `foldWeekend`.
Market set fixed here: spot gold only.

## Swings (fractal, 2 a side)
- Swing high at day i: high(i) is strictly above the highs of days i-2, i-1, i+1, i+2. Swing low: low(i) strictly below the lows
  of those four days. A swing at day i is KNOWN only from the close of day i+2.

## Signal (at the close of day t; reads days up to t only)
**Long (structure flip up)**:
- C = the latest swing low known at t (C.i + 2 <= t); B = the latest swing high with B.i < C.i; A = the latest swing low with
  A.i < B.i. All three must exist.
- C.low > A.low (a higher low);
- close(t) > B.high, and no close above B.high on any day from B.i + 1 to t - 1 (the FIRST close above B);
- no low below C.low on any day from C.i + 1 to t (the higher low still holds).

**Short (flip down)**: the mirror (C = latest known swing high, B = the latest swing low before it, A = the latest swing high before
B; C.high < A.high; close(t) < B.low first time since B; no high above C.high since C).

If a long and a short signal fall on the same day, neither is taken.

## Trades (fixed here)
- Entry: market at the OPEN of day t + 1.
- **Stop** (every trade has one): $0.30 beyond C (long: C.low - 0.30; short: C.high + 0.30). 1R = |entry - stop|.
  A signal whose stop is on the wrong side of the entry, or nearer than 0.5 x ATR(20) at day t (ATR = simple mean of the 20 daily
  true ranges up to t), is not taken (counted in the report).
- Checked on every daily candle held: a candle after the entry candle that OPENS through the stop exits at that open; otherwise a
  low (long) / high (short) reaching the stop exits at the stop (the entry candle included).
- **Time exit**: at the close of the 10th daily candle held (the entry day is the first). No target, no trail.
- **One position at a time per test**: a signal on a day before the open trade's exit day is ignored.
- **Costs**: $0.30 spread + $0.15 slippage on each of entry and exit = $0.60 a trade, over the stop distance.
- **Financing** on longs: `council/fills.mjs` `nights(entry day start, exit time)` x `FIN.xau.long` (0.000148 of price a rollover,
  the demo broker's XAUUSD swap of 11 Nov 2026, charged for every year as earlier studies did) x entry / stop distance; exit time =
  the exit candle's day start for a stop, its 22:00 UTC for a time exit. Shorts pay and are credited nothing.
- **Expected cost share of R** (stated before any swing is located, from gold's known daily range, not from this rule's trades):
  gold's ATR(20) ran about $10-25 in 2007-16 and $15-60 in 2017-26; a C-to-entry distance of one to two ATR puts the median stop at
  about $20-60, so $0.60 is about 1-3 % of R and long financing over two weeks (about 14 rollovers) about 0.05-0.15R. The median
  stop must be at least $10 in each window; if it is not, that is reported as a deviation. The run reports the measured cost share.

## The three tests
- **T1 (primary)**: both sides, one position at a time.
- **T2**: longs only.
- **T3**: shorts only.

## Statistics and windows
- A trade belongs to the calendar month of its exit. Statistic = monthly sums of net R over EVERY calendar month of the window
  (a month without a trade counts 0); t = mean / (sd / sqrt n).
- In sample 2007-01 to 2016-12; out of sample 2017-01 to 2026-10.
- **Holm** over the three tests on the one-sided normal p of the OOS net month t.
- **Placebo**, 40 seeds (mulberry32, seeds 1-40), per test: each real trade's entry day is replaced by a day drawn at random among
  all days whose trade would exit in the same window; the side is the real trade's side, the stop distance is the real trade's
  stop distance in ATR(20) units times the random day's ATR(20), same 10-day hold and costs; overlap allowed. OOS net month t of
  each seed. This keeps side, count, stop size and costs and removes only the structure timing.
- **2x costs**: spread, slippage and financing doubled.

## Pass bar
T1 decides the verdict. PASS only if all of: T1 OOS net month mean > 0 with t >= 2 and Holm p < 0.05; the in-sample net month mean
> 0; the OOS net month mean > 0 at 2x costs; the OOS t above the placebo's 95th percentile (more than 38 of 40 seeds below it).
T2 and T3 get the same checks; one of them passing while T1 fails is reported as a lead for a new pre-registration, not a pass.

## Reported, not judged
Gross results, stops hit, year by year, median stop in dollars, signals skipped for a too-near stop; "long every 10th day" (the
same 10-day hold, a 1.5 x ATR(20) stop and costs, non-overlapping) as the drift comparison. A PASS leads only to a proposal for a
paper shadow, never a live change. Nothing live reads this study.

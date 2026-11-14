# Pre-registration: TRIX signal-line crosses on spot gold, against the same trade on every day (14 Nov 2026)

Written, committed and pushed alone before any outcome of this study was computed. Paper research: nothing here is read by
the council, the mirror or the page, and no live rule changes whatever the verdict. Not an ICT study.

**Item 44 (docs/owner-decisions.md) and what this study is not.** A NEW stand-alone daily rule on gold, traded both ways. It
is not a gate, an exit, an entry or a size of the gold book (Gold trend / Gold daily engulf), reads none of that book's
trades or signals, and its verdict says nothing about that book.

## The idea
TRIX (J. Hutson's triple-smoothed momentum oscillator): the one-day percentage change of a triple exponential moving average
of the close, with an exponential "signal line" of TRIX itself. The textbook trade is to follow a cross of TRIX through its
signal line: a cross up = the smoothed momentum has turned up, buy; a cross down, sell. Question: does the cross select better
days to enter gold than any day, net of costs? **The primary test measures exactly that**: the same market entry, stop and
hold taken after EVERY day (no TRIX condition) is the baseline, so gold's drift is taken out.

## Dedupe (read before writing this)
- topics.txt, `ls research/edge`, `git branch -r`: no "trix" / "triple" study; `git grep -w -i trix -- research docs` finds
  nothing; the 14 Nov untested backlog does not name it.
- Nearest tested families: `gold-rsi-divergence`, `gold-cci`, `gold-weekly-stoch`, `metals-rsi2`, `gold-mfi` (oscillator
  EXTREMES or divergences, traded as reversals); `gold-momentum-acceleration`, `gold-frog-momentum`, `gold-weekly-momentum`
  (raw momentum / its change over fixed look-backs); `gold-psar`, `gold-adx-trend`, `gold-heikin-ashi` (trend-state rules);
  `gold-elder-ray` (EMA-relative bull / bear power). None trades the cross of a triple-smoothed rate of change through its
  own signal line. The live Gold trend (a breakout of the prior 20 / 5 daily highs) is not read.
- Event count checked before writing (crosses only, no outcome): with TRIX(9) and a 5-day signal line there are 109 up and
  108 down crosses in 2007-16 and 108 / 109 in 2017-26. TRIX(15) / 9 gives about 60 a window, too few for the 100 the brief
  prefers, so 9 / 5 is fixed here; no other parameter is run.

## Data and the day
- council-data `research/daily/xau.json` (OANDA mid, UTC days), read with `git show origin/council-data:...` into a cache
  outside git. Weekend candles are folded into the next weekday with `council/fills.mjs` `foldWeekend` (imported, unchanged).
- EMA(n) with alpha 2 / (n + 1), seeded with the first close. E3 = EMA9(EMA9(EMA9(close))); TRIX(i) = 100 x (E3(i) / E3(i-1)
  - 1); SIG = EMA5(TRIX). The first 60 days are warm-up (no setup before day 60). ATR(20) at day i = the simple mean of the
  true ranges of the 20 days ending at day i.

## Setups (on the close of day i, using closes up to and including day i only)
- **Bull cross** (long): TRIX(i) > SIG(i) and TRIX(i-1) <= SIG(i-1).
- **Bear cross** (short): TRIX(i) < SIG(i) and TRIX(i-1) >= SIG(i-1).

## The trade (rule and baseline alike)
- Market entry at the open of day i+1. Stop = fill - 2 x ATR(20)(i) for a long (mirror for a short). 1R = 2 x ATR(20)(i).
- Daily candles cannot order prices inside a day: on the entry day a low (long) at or under the stop is a stop-out at the
  stop. On later days a day opening through the stop fills at its open, else a touch fills at the stop. Otherwise out at the
  close of day i+5 (five days held).
- The rule: one position at a time per test (a setup while a trade is open is skipped).
- **The baseline**: the same trade after every day i >= 60 (no TRIX condition), each its own trade, same side as the test.

## Costs (in price, every trade)
- Spread $0.30 a round trip plus half a spread ($0.15) of slippage per order: **$0.60 a round trip**.
- Financing on longs only: `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo
  broker's XAUUSD swap of 11 Nov 2026) x fill price; entry time = 00:00 UTC of the entry day, exit time = the end of the exit
  day; today's rate for every year. Shorts pay and earn nothing.
- **2x costs**: spread, slippage and financing doubled (baseline too).

## Windows (by entry day)
- In sample 2007-01-01 to 2016-12-31; **out of sample (decisive) 2017-01-01 to 2026-10-31**. 2006 is warm-up only.

## Three tests (fixed now), Holm over the three
- **T1 (primary)**: long after a bull cross; **excess** net R = each trade's net R minus the mean net R of the long baseline
  trades of the same window.
- **T2**: short after a bear cross; excess net R against the short baseline, the same way.
- **T3**: T1's trades, absolute net R (does the trade pay at all, drift included).

## Statistics
- t on calendar-month sums of the tested quantity (every month of the window, 0 where nothing closed; a trade belongs to its
  exit month); one-sided p from the normal distribution; Holm over the three tests.
- Placebo, 40 seeds (fixed seeded generator): each real out-of-sample trade is replaced by the same trade after a random day of
  the same calendar year (no TRIX condition, same side), its excess computed against the same baseline mean. The rule's mean
  excess (T3: mean net) is compared with the 40 seed means.

## Pass bar (per test; all needed)
1. Out of sample n >= 60.
2. Out of sample mean > 0, month-sum t >= 2, Holm-adjusted p < 0.05.
3. In sample mean > 0.
4. Out of sample mean still > 0 at 2x costs (rule and baseline both at 2x).
5. Above at least 38 of the 40 placebo seed means.

**Verdict**: PASS if T1 passes; else FAIL whatever T2 / T3 do (a T2 / T3 that passes alone is named "passes alone, not an edge
until replicated"). Reported besides, deciding nothing: gross R, the baseline's own mean, by year, win rate, stops.

## Deliverables
`run.mjs`, `RESULT.md`, `result.json` in this folder; `tests/gold-trix.test.mjs` (offline, hand-made candles); `out/` rebuilt.

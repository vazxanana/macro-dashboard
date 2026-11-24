# vb-vol-regime: do the gold and USD/JPY breakouts do better in some volatility regimes? (pre-registration, 24 Nov 2026)

Paper research only. Written and pushed alone before any trade was joined to a volatility label. Nothing live changes.

## Question

The gold and USD/JPY intraday volatility breakouts (T1: buy stop at the UTC open + 0.5 x the previous folded day's range, sell
stop at the open - 0.5 x that range, stop back at the open, out at 21:00 UTC) pass on several stretches of history. Earlier
studies split them by k (`gold-vol-breakout-k`, `usdjpy-vb-k`), by an adaptive k from yesterday's range (`vb-adaptive-k`, a
sibling branch), by a narrow range as a signal of its own (`nr7-breakout`) and by the Gold Macro Score (`vb-macro-size`). None
split them by the market's own realised-volatility regime. Does T1 make more (or less) R a trade after costs when volatility
is high than when it is low?

## Regime (fixed here, known before the day opens)

- Daily closes = the folded UTC daily candles the rule itself uses (`buildDays`' grouping: M5 grouped by UTC day, weekend
  candles folded into the next weekday with `council/fills.mjs` `foldWeekend`), close of the last M5 candle of the day.
- RV of day i = sample standard deviation of the 20 daily log returns ending at the PREVIOUS day's close (closes i-21 .. i-1).
- Rank of day i = share of the 252 previous days' RV values (RV of days i-252 .. i-1) that are below RV of day i (ties count
  half). Low tercile: rank < 1/3; high: rank > 2/3; else mid. A day without 252 earlier RV values gets no label and is out.
- Nothing at or after day i's open enters its label.

## Trades and costs

T1 unchanged: `buildDays`, `daySkip`, `vbTrade` imported from `research/edge/index-vol-breakout/original.mjs` (the verbatim copy
of `gold-vol-breakout/run.mjs`), never edited; OANDA mid M5 from the shared cache (`research/edge/_lib/edgekit.mjs`).
- Gold: the measured hourly cost C1 of `gold-vol-breakout-hourcost` (its committed `profile` and `commission`, + 0.05 x M stop
  slippage, M = median M5 range of the 12 candles to the fill) and the rule's own long financing.
- USD/JPY: `fx-vol-breakout` `charge` (commission 0.000045 of price + 0.5 pip a round trip).
- Windows: discovery 2005-01-01 -> 2014-12-31 (gold from its first labelled day, about 2007), confirmation 2015-01-01 -> the
  last complete day in the cache.

## Harness gate (before any label is read)

Unlabelled T1 on all days must reproduce: USD/JPY 2005-01-04 -> 2015-12-31 n 2089, net +0.079R; gold 2007-01-01 -> 2026-11-12
under C1 n 3713, net +0.139R (n within 1 %, net within 0.005R). Outside it, stop; nothing is concluded.

## Tests (two, Holm over two)

H1 gold, H2 USD/JPY: high tercile minus low tercile, net R a trade after costs.
- Welch t on the two sets of trades (reported);
- the monthly difference: for each calendar month with trades in both terciles, mean net R of high trades minus mean net R of
  low trades; t of those monthly differences (the test statistic), two-sided p, Holm over the two tests.

A test passes only if ALL hold:
1. the difference has the same sign in discovery and confirmation;
2. confirmation |month t| >= 2 and Holm p < 0.05 (two-sided; the direction is not assumed);
3. the better tercile's own net R a trade > 0 in both windows;
4. n >= 200 trades in each of the two terciles in each window (a shortfall is "too few", not a pass);
5. placebo: 40 seeds, the tercile labels shuffled at random among the window's labelled days (same shares); the confirmation
   |difference of means| must exceed the placebo's 95th percentile of |difference|.

Every tercile's n, R before costs, net R, net at 2x cost and month t is reported per market and window. Verdict PASS if either
test passes, naming which side is better; otherwise FAIL. A pass would describe a regime in which T1 did better on these years;
it would not adopt a filter or a size: any change to the forward records needs the owner and its own forward test. A
before-cost tilt is not an edge.

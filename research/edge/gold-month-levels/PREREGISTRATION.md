# Pre-registration: gold's previous calendar month high and low (14 Nov 2026)

Written and pushed before any number of this study is computed. Nothing below is changed after the first run.

## Why
ICT and market-maker-model traders treat the previous calendar month's high and low (PMH / PML) as major liquidity: price
is said to raid them and reverse, or break them and run. No study in this repository has tested that level on gold. The
nearest ones read other levels: `gold-week-raid` (the previous WEEK's high / low, FAIL), `mmxm-pdhl-raid-gold` and
`gold-daily-turtle-soup` / `gold-pdhl-break` (the previous DAY's), `gold-record-high` (the all-time high), `high52-*` (the
52-week high), `trend-breadth` / `trend-breadth-h1` (the live Gold trend rule: a 20-day high breakout, a different level),
`gold-turn-of-month` and `gold-tsmom` (calendar and momentum, no level).

**A stand-alone rule.** This is not a gate, exit, entry or size of the live gold book (owner decision 44: no further test on
that book's 2006-17 window is made here, and the result changes nothing live whatever it is). Paper research only.

## Data (fixed before any result)
- council-data `research/daily/xau.json` (OANDA mid XAU/USD, complete UTC daily candles, from March 2006 to the file's last
  day, 6 Nov 2026), read with `git show origin/council-data:research/daily/xau.json`, no network. Market set: gold only.
- Weekend candles folded into the next weekday with `council/fills.mjs` `foldWeekend` (a trading day = a UTC weekday).
- A day belongs to the UTC calendar month of its own (weekday) date.
- PMH / PML = the highest high / lowest low of the previous calendar month's days. A month is used only when the previous
  month has at least 15 days on file.

## Tests (three, Holm over the three)
Signals read only days at or before the signal day; the trade enters at the NEXT trading day's open.

- **T1 raid-reversal.** The first day of the month whose high is above PMH and whose close is below PMH (back inside): sell
  at the next day's open, stop $0.30 above that signal day's high, target PML, else out at the close of the 10th trading day
  (the entry day is day 1). Mirror: the first day whose low is under PML and whose close is above PML: buy, stop $0.30 under
  its low, target PMH. At most one signal per side per month. No trade if the entry is already past the stop or the target.
- **T2 break-continuation.** The first day of the month whose close is above PMH: buy at the next open, stop 1.5 x ATR(14)
  under the entry (ATR = simple mean of the last 14 true ranges of the folded days up to and including the signal day), no
  target, out at the close of the 10th trading day. Mirror: the first close under PML: sell, stop 1.5 x ATR above.
- **T3.** T2's longs only (the long side of a new-month breakout).

Common rules: one position at a time per test (a signal whose entry day comes before the open trade's exit day is
skipped). Each day the stop is checked first: a gap through the stop fills at the open, else at the stop; then the target;
a day that holds both counts the stop. The entry day's own range counts. A signal whose entry day falls in a later month
still trades (the level is frozen at the signal).

## Costs
$0.60 a round trip on every trade, plus financing on buys: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a
rollover, the demo broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry / risk. Entry time = the entry day's
UTC start; exit time = the exit day's UTC end (an intraday stop is charged that night too, conservative). Sells pay and
receive nothing. R = (exit - entry) x side / risk, where risk = |entry - stop|.

## Windows and statistics
- In sample 2008-01-01 to 2016-12-31; out of sample 2017-01-01 to the file's end (by entry date). 2006-07 warm-up only.
- Per test and window: n, R a trade gross and net, PF, worst drawdown, win rate; t on calendar-month sums of net R (booked
  by the exit's UTC month, every month of the window counted, empty months 0); one-sided p from that t; Holm over T1-T3 on
  the out-of-sample p.
- Placebo, 40 seeds: PMH / PML replaced by random levels at the same signed distance from the current month's first open,
  each distance scaled by an independent uniform factor in [0.7, 1.3]; every rule otherwise identical. A test beats a seed
  when its out-of-sample net R a trade is above that seed's.
- 2x costs: $1.20 a round trip and twice the financing.
- Out-of-sample halves: 2017-2021 and 2022 to the end.

## Pass bar (all must hold, per test)
OOS net R a trade > 0; OOS month-sum t >= 2 and Holm p <= 0.05; in-sample net > 0; both OOS halves net > 0; OOS net > 0 at
2x costs; beats at least 38 of 40 placebo seeds; OOS n >= 30. The study PASSES if any test passes; otherwise FAIL. A PASS
would be a proposal to the owner, never a live change.

## Reported, not tested
- **First touch from inside** (the third question): for the first day of each month that trades at or beyond PMH (or PML),
  how often it closes back inside against beyond, and the 10-day close-to-close return from the next open, by window.
  Descriptive only, no pass / fail.
- Year by year, buys against sells, exits by kind, median stop.

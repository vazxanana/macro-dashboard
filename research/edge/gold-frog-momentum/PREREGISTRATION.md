# Pre-registration: gold's 60-day trend when it was made of many small days, not a few jumps (14 Nov 2026)

Written and pushed alone, before any candle of this study was read or any number computed. Paper research only: a
**stand-alone rule on gold**, not a gate, entry, exit or size of the live gold book (Gold trend + Gold daily engulf), and
nothing here is compared with or applied to that book; the book's 2006-17 window and its positions are not used
(docs/owner-decisions.md item 44). Nothing live changes.

## Hypothesis and why
"Frog in the pan" (Da, Gurun and Warachka 2014, Review of Financial Studies; not opened from this sandbox, no figure of it
is relied on): investors under-react more to information that arrives in many small pieces than to a few large jumps, so a
past move built from a steady run of same-way days continues more than a move of the same size built from a few big days.
Their measure, information discreteness, is ID = sign(past return) x (share of days against the move - share of days with
the move); a low (negative) ID is a "continuous" move. The paper measures it across stocks; here it is applied to one
market, gold, through time: trade gold the way its 60-day return points only when that return was continuous.

The rule trades **both sides** and is measured against the **unconditional same-side baseline**: the same 60-day
momentum trades taken without the discreteness condition, and the complement (the discrete moves). So gold's 2001-26 rise
cannot pass it by itself.

Dedupe: not tested before (no folder or branch named for discreteness, frog or the share of up days). Closest studies:
`gold-tsmom` (12-month sign, monthly), `gold-weekly-momentum`, `gold-streak` (consecutive days in a row, a short-run count),
`gold-currency-breadth` (agreement across currencies), `gold-autocorr-switch` and `gold-regime-switch` (switching on the
market's own autocorrelation / efficiency ratio), `gold-realized-skew`. None conditions a trend trade on how the move's
days were distributed.

## Data (named before any result)
council-data `research/daily/xau.json` (OANDA mid XAU/USD, UTC days) at the commit of `origin/council-data` when the study
runs (it starts 20 Mar 2006). Weekend candles folded into the next weekday with `council/fills.mjs` `foldWeekend`. No other
market. The candles are read with `git show`, kept out of git.

## Rule
- Signal days: the last trading day of each ISO week (a day whose next candle falls in a later ISO week). On signal day i
  with at least 60 earlier candles: R60 = close(i) / close(i - 60) - 1; the 60 daily returns r_k = close(k) / close(k - 1) - 1,
  k = i - 59 .. i; pos = share with r_k > 0, neg = share with r_k < 0; ID = sign(R60) x (neg - pos). R60 = 0: no signal.
- **Continuous** (C) when ID <= -0.10 (at least 5 points more of the 60 days went the move's way than against it);
  **discrete** (D) otherwise. Fixed now, never tuned.
- Entry: the open of candle i + 1, in the direction of sign(R60). Each stream (C, D, and the baseline B = every signal)
  runs on its own, one position at a time: a signal while that stream holds a position is ignored; after an exit at the
  close of candle j the stream may enter again at the open of candle j + 1.
- Stop (every trade has one): entry -/+ 2 x ATR(20), ATR = mean true range of candles i - 19 .. i (known at the signal
  close); that distance is 1R. A candle that opens through the stop exits at its open, otherwise a touch exits at the stop;
  the entry candle itself can stop the trade.
- Exit: at the close of the 20th candle of the trade (entry candle = 1) if not stopped. No target.
- Costs: $0.60 a round trip, plus `nights(entry, exit)` x `FIN.xau.long` x entry price on buys (council/fills.mjs; entry at
  the candle's 00:00 UTC start, exit at its end; sells charged and credited nothing). R net = (gross move - costs) / 1R.
  Cost share = (gross - net) / |gross| of the stream, and costs in R a trade, both reported.

## Tests (two, Holm over both)
- **T1 (primary)**: stream C, both sides.
- T2: the frog effect itself: mean net R a trade of C minus D (Welch t on trades).

Windows by entry date: in sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to the last candle on file (trades not
closed by then are dropped). T1's t = mean / standard error of calendar-month sums of R net by exit month (every calendar
month of the window counts, a month with no exit as 0); one-sided p from the normal. T2's t is Welch's on the trades'
net R. Holm over T1 and T2 (out of sample).

T1 passes when all hold: out-of-sample net mean > 0 and month t >= 2 with Holm-adjusted p < 0.05; in-sample net mean > 0;
out-of-sample net mean > 0 at 2x costs ($1.20 and twice the financing); out-of-sample n >= 30; and its out-of-sample net
mean R a trade above at least 38 of 40 placebo draws. Placebo (seeds 1-40, mulberry32): every signal day is labelled
continuous at random with probability equal to the share of C labels among all signal days of the sample, and the C stream
is run again on those labels (same entries, stops, exits, costs). T2 passes when the out-of-sample difference is > 0 with
Welch t >= 2 and Holm p < 0.05, and the in-sample difference is > 0.

Verdict: **PASS** only when T1 passes; the gain is credited to the discreteness condition only when T2 passes too. T2 alone
is PARTIAL and proposes nothing. Whatever the verdict, no live rule changes; a pass is a lead to be replicated elsewhere.

## Reported, not tested
The baseline B (every signal) and stream D with the same mechanics; buys and sells of each; year by year of C; the median
stop in dollars (expected well over $10); the ID threshold at -0.20 and 0.00 as context only. No variant chosen after
seeing results becomes a rule.

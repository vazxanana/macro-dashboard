# Pre-registration: fading clean 60-day trends on silver and platinum (14 Nov 2026)

Committed and pushed ALONE, before any return, trade or statistic of this rule was computed on silver or platinum.

**Question.** `research/edge/gold-trend-r2` (branch `gold-trend-r2`) traded gold IN the direction of a clean 60-day trend
(R squared of the line through the last 60 log closes >= 0.70) and did significantly WORSE than the same month's same-side
every-day trade in both windows: excess -0.126R a trade in 2007-16 (month t -2.66) and -0.094R in 2017-26 (t -2.88), Holm
p 0.014. The reverse reading ("clean trends overshoot, so fade them") was NOT pre-registered there, and both gold windows
have now been seen, so gold cannot confirm it. This study is a REPLICATION of that reverse reading on two markets the gold
study never touched: does trading AGAINST the slope on clean-trend days beat the same month's every-day trade on the same
(fade) side?

**What this is not.** A stand-alone rule tested on its own. Not a gate, exit, entry, filter or size of the live gold book;
it reads nothing of it and uses no gold data (owner decision 44 untouched). Nothing of `ict/`. Paper research only: nothing
live changes, and a pass would only be reported to the owner, never applied.

**Dedupe.** Read before this file was written: `gold-trend-r2` (the source, gold only), `gold-drd-silver` and
`drd-metals-book` (a daily rejection long, not trend quality), `metals-rsi2` (2-day RSI fade), `silver-vol-breakout`,
`gold-silver-ratio`, `gold-platinum-ratio`, `gold-silver-divergence`, `metals-intraday-momentum`, `post-holiday-metals`,
`gold-metals-confirm`, and the 14 Nov untested-backlog list. None measures trend linearity (R squared) on silver or
platinum, in either direction.

## Data (fixed before any result)

- Markets: **silver (XAG/USD, council-data key `xag`) and platinum (XPT/USD, key `xpt`)**, nothing else. OANDA mid daily
  candles, council-data `research/daily/<key>.json`, read with `git show origin/council-data:research/daily/<key>.json`
  (no network; the cache is kept out of git). Silver rows start March 2006, platinum January 2005.
- Weekend candles are folded into the next weekday with `council/fills.mjs` `foldWeekend`, exactly as gold-trend-r2 does.
  Only complete days are used.
- Window: entries from **1 January 2007** to the last complete candle in the files (early November 2026). All of it is
  untouched by the gold study, so the whole 2007-26 span is ONE confirmation window. Halves: 2007-16 and 2017-26.

## The rule (the gold study's code, copied into this folder; its folder is not edited)

On the CLOSE of day i, every order filling at the OPEN of day i+1:
- Line: OLS of ln(close) on 0..59 over the 60 closes up to and including day i; slope b and R squared.
- **Signal day**: R squared >= 0.70.
- **Fade side** s = -sign(b) (sell a clean rise, buy a clean fall; no trade when b = 0).
- **Trade**: side s, entry at the next open, **stop 2 x ATR(14)** of day i from the entry, never moved (a day opening beyond
  the stop fills at its open), otherwise out at the open of day i+11 (10 trading days). No target. 1R = the stop distance.
- **Baseline**: the same fade-side trade (side -sign(b), same stop and hold) taken on EVERY day from 2007, signal or not;
  each day its own overlapping trade.

## Costs

- **Silver $0.03 an ounce a round trip; platinum $2.00 a round trip**, taken off as cost / stop distance in R.
- **Financing on buys**: `council/fills.mjs` has no financing rate for silver or platinum (`FIN` holds `xau` only), so the
  gold rate `FIN.xau.long` (0.000148 of price a rollover, the demo broker's XAUUSD swap of 11 Nov 2026) is applied as a
  fraction of each metal's price: `nights(entry, exit)` x 0.000148 x entry / stop distance. This is an ASSUMPTION, not a
  measured silver or platinum rate; today's rate is used for every year. Shorts are charged and credited nothing (as
  `FIN.xau.short` = 0). An open fill is stamped at 00:00 UTC, a stop inside a day at 12:00 UTC.
- **2x costs**: twice the round trip and twice the financing.

## The three tests (Holm over these three)

Excess of a signal trade = its net R minus the mean net R of all baseline trades of the same market entered in the same
calendar month. Statistic: excess summed by entry month over every calendar month of the window (a month with no signal
counts 0); month t = mean / (sd / sqrt(months)), two-sided Student p.
- **T1 (primary): silver**, 2007 to Nov 2026.
- **T2: platinum**, the same.
- **T3: silver and platinum pooled by month** (each month's silver excess sum plus its platinum excess sum).

## Pass bar (per test; the verdict is the primary T1, T2 and T3 are judged by the same bar and reported)

- Month t >= 2 over 2007-26 with Holm p < 0.05 (Holm over the three two-sided p values), AND
- the excess a trade positive in BOTH halves (2007-16 and 2017-26), AND
- still positive at 2x costs: the excess a trade at 2x costs > 0 over 2007-26 AND the fade's signal trades themselves
  (overlapping, as T1 counts them) net of 2x costs > 0 over 2007-26.

## Reported, not part of the bar

- Per test and window: signal n, R a trade gross / net / net at 2x costs, excess a trade (net and at 2x costs), month t;
  the baseline's own R a trade; signal share of days; median stop; cost share.
- **Placebo, 40 seeds** (mulberry32, seeds 1-40): per market and calendar year, the same number of days as the real signal
  days drawn at random from that year's baseline days; the test's month t recomputed (T3 pooled from the two markets'
  draws of the same seed). Reported as how many of the 40 the real t beats.
- The fade stand-alone, one position at a time per market (a signal day with no position open enters), net R and month t
  on exit months, for reference only.
- Fixed numbers (60 days, 0.70, 10 days, 2 x ATR, the costs) are the gold study's and are not tuned; no other value will
  be reported as a result. A pass would be a finding to report, never an edge until a forward record exists.

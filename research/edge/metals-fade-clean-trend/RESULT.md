# Result: fading clean 60-day trends on silver and platinum (14 Nov 2026)

**Verdict: FAIL, 0 of 3: the selection replicates (silver excess +0.116R, month t 4.55; platinum +0.080R, t 3.43) but the fade trades themselves lose, even before costs (silver -0.054R gross).**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any number was computed). A replication of the reverse
reading of `research/edge/gold-trend-r2` (branch `gold-trend-r2`), on two markets that study never touched. OANDA mid
daily candles, council-data `research/daily/xag.json` and `xpt.json`, weekends folded with `council/fills.mjs`
`foldWeekend`, entries 1 January 2007 to 6 November 2026 (silver 5,365 days, platinum 5,645 after folding). Signal: R
squared of the OLS line through the last 60 log closes >= 0.70; side AGAINST the slope; entry at the next open, stop
2 x ATR(14) never moved, out at the open 10 days later. Every trade has a stop. Costs: silver $0.03, platinum $2.00 a round
trip; financing on buys at the gold rate `FIN.xau.long` (0.000148 of price a rollover) applied to each metal's price, an
ASSUMPTION (`fills.mjs` holds no silver or platinum rate). The line fit, ATR, trade, excess, month t and Holm are the gold
study's code, copied into `run.mjs`; its folder is not edited. Stand-alone research only: nothing live, no gold book, no
`ict/`, no proposal.

## The three tests: fade trades on clean-trend days against the same month's every-day fade

Excess = a signal trade's net R minus the mean net R of all every-day fade trades of the same market entered in the same
calendar month, summed by entry month (every calendar month counts; month t, two-sided).

| Test | Window | Signal trades n | Signal R a trade, gross | Signal R a trade, net | Net at 2x costs | Excess a trade, net | Excess at 2x costs | Month t |
|---|---|---|---|---|---|---|---|---|
| T1 silver | 2007-26 | 1292 | -0.054 | -0.095 | -0.136 | +0.116 | +0.115 | 4.55 |
| T1 silver | 2007-16 | 674 | -0.092 | -0.131 | -0.170 | +0.083 | +0.083 | 2.44 |
| T1 silver | 2017-26 | 618 | -0.012 | -0.056 | -0.100 | +0.151 | +0.150 | 3.99 |
| T2 platinum | 2007-26 | 1249 | -0.036 | -0.089 | -0.142 | +0.080 | +0.081 | 3.43 |
| T2 platinum | 2007-16 | 695 | -0.103 | -0.154 | -0.205 | +0.077 | +0.078 | 2.45 |
| T2 platinum | 2017-26 | 554 | +0.047 | -0.008 | -0.063 | +0.084 | +0.084 | 2.40 |
| T3 pooled | 2007-26 | 2541 | -0.045 | -0.092 | -0.139 | +0.098 | +0.098 | 5.50 |
| T3 pooled | 2007-16 | 1369 | -0.098 | -0.143 | -0.188 | +0.080 | +0.081 | 3.33 |
| T3 pooled | 2017-26 | 1172 | +0.016 | -0.033 | -0.083 | +0.119 | +0.119 | 4.48 |

Holm p over the three 2007-26 p values: T1 0.00002, T2 0.0007, T3 < 0.00001. Checks per test (the pre-registered bar):
month t >= 2 after Holm PASS on all three; excess positive in both halves PASS on all three; still positive at 2x costs
FAIL on all three (the excess at 2x costs is positive, but the fade's own signal trades are -0.136R, -0.142R and -0.139R a
trade at 2x costs, and already negative at 1x). So **0 of 3 pass**.

**Placebo (40 seeds).** The same number of random days per market and calendar year marked as signals: month t from
-1.90 to +2.70 for silver (median -0.18), -2.61 to +2.62 for platinum (median -0.16), -1.82 to +2.11 pooled (median
-0.12). The real t beats 40 of 40 in each test. The selection effect is real, not an artifact of how many days are picked.

## Why a strong excess and a losing trade at the same time

The every-day fade (the baseline) loses on these metals: silver -0.018R a trade net 2007-26 (gross +0.031R; month t
-0.50), platinum -0.040R (gross +0.022R; t -1.18). Clean-trend days fall in the months where fading loses most: the
same-month baseline mean behind a silver signal trade is -0.211R (signal net -0.095R minus excess +0.116R), behind a
platinum one -0.170R. Within those months the fade on the clean-trend days loses LESS than the fade on the other days,
hence the positive excess, but it still loses. In words: when silver or platinum trends cleanly, fading the move is a bad
trade, just a less bad one on the cleanest days than on the rest of that trending month. This is the mirror of the gold
study's finding (trading WITH the clean trend did worse than the month's with-trend baseline), and it replicates on both
metals with the same sign in both halves; it does not turn into a trade that makes money.

## For reference: the fade stand-alone, one position at a time

| Market | Window | n | R a trade, gross | R a trade, net | Net at 2x costs | Total net R | Month t |
|---|---|---|---|---|---|---|---|
| Silver | 2007-26 | 175 | -0.025 | -0.066 | -0.107 | -11.59 | -0.75 |
| Silver | 2007-16 | 93 | -0.120 | -0.159 | -0.198 | -14.79 | -1.25 |
| Silver | 2017-26 | 82 | +0.082 | +0.039 | -0.004 | +3.20 | 0.32 |
| Platinum | 2007-26 | 167 | +0.011 | -0.043 | -0.096 | -7.11 | -0.55 |
| Platinum | 2007-16 | 94 | -0.113 | -0.165 | -0.217 | -15.48 | -1.54 |
| Platinum | 2017-26 | 73 | +0.171 | +0.115 | +0.059 | +8.37 | 1.06 |

Median stop on signal trades: silver $1.27, platinum $55.81. Signal share of days: silver 25 %, platinum 24 %.

## What this means

- The pattern behind the gold study's failure (clean 60-day trends are followed by a worse-than-usual move in the trend's
  direction, measured against the same month) is not gold-only: it shows on silver and platinum, on data untouched by the
  gold study, in both halves, and beats every placebo draw.
- It is a SELECTION effect inside trending months, not a tradable fade: fading those days loses money on both metals before
  costs over 2007-26 and in 2007-16. The positive 2017-26 stand-alone figures (platinum +0.115R, t 1.06; silver +0.039R,
  t 0.32) are small samples far from significance.
- Never call this an edge. Not a filter, gate or size of any council system. If the owner wants the effect used, the only
  honest next step is a new pre-registration that states how it would be traded (for example as a reason NOT to add to a
  trend on its cleanest days), tested on a market set fixed in advance; that is a different question from this one.
- To repeat: `node research/edge/metals-fade-clean-trend/run.mjs fetch <dir>` (no network), then `... full <dir>`.
  Tests: `tests/metals-fade-clean-trend.test.mjs`.

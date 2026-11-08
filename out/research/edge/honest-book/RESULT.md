**Verdict:** On the untouched 2006-17 window, book C (honest-positive + Gold trend fast N5) is best by return/drawdown (3.9), book B (honest-positive) is a hair behind (3.7) and the live book A is far behind (0.6); C against B is within noise (bootstrap P 0.79, halves split), while B and C against A is more than noise (P 0.96 / 0.97, both halves, x2 costs) — a proposal, no live change.

# The honest book: three paper books on data none of the rules saw

Paper research only. No live rule, size, filter, config, tracker, replay or site code was changed. The criteria were
pre-registered and committed before any book number was computed (`preregistration.md`, commit b4a7932b).

**Question.** Four of the eight live systems have a negative honest (out-of-sample) expectancy in coach.json `expect`:
the Gold replica (−0.05R, 2017-22), the Gold momentum pullback (−0.04R, 2018-22), the NQ New York open run (−0.02R, 2004-22)
and the ICT A-setups (−0.01R, 2008-17). Would a book of only the honest-positive systems (Gold trend N20 +0.49R, Gold daily
engulf +0.19R, Mosha BO +0.14R, Gold H4 trendline +0.05R) have been the better book on untouched data? And does adding the
shadow Gold trend fast N5 (+0.37R, but 0.92 correlated with N20) help?

| book | systems, fixed 1R a position |
|---|---|
| **A**, the live book | replica, mosha-bo, gtrend, gtl, geg, gmp, nq-open, ict-a |
| **B**, honest-positive | gtrend, geg, mosha-bo, gtl (replica, gmp, nq-open, ict-a to shadow) |
| **C**, B + the fast trend leg | gtrend, geg, mosha-bo, gtl, gtrend5 |

## Key table: W1 untouched, 2006-07 to 2017-12 (daily equity, fixed 1R a position)

Book A in this window is the **six** live systems that have a record there (mosha-bo, gtrend, gtl, geg, nq-open, ict-a).
The replica's record starts 2018-02 and the momentum pullback's 2018-02, so neither can be tested here (gap stated in the
pre-registration). The ICT record starts 2008-01; the W1-overlap sensitivity below removes 2006-07 .. 2007-12.

| book | cost | positions | total R | R a year | worst DD | **return / DD** | Sharpe-like t | ann. Sharpe | months + | years + | H1 2006-11 ret/DD (t) | H2 2012-17 ret/DD (t) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | x1 | 3,957 | +49.4 | +4.3 | −83.2 | **0.59** | 0.50 | 0.15 | 49% | 6/12 | 0.66 (0.81) | −0.08 (−0.08) |
| A | x2 | 3,957 | **−238.9** | −20.8 | −259.3 | −0.92 | −2.43 | −0.70 | 39% | 3/12 | −0.57 | −0.95 |
| B | x1 | 794 | +107.6 | +9.4 | −29.2 | **3.69** | 2.37 | 0.69 | 46% | 6/12 | 3.47 (2.34) | 0.89 (0.89) |
| B | x2 | 794 | +82.2 | +7.1 | −34.6 | 2.38 | 1.82 | 0.53 | 45% | 6/12 | 2.62 | 0.41 |
| C | x1 | 922 | +149.5 | +13.0 | −38.3 | **3.90** | 2.51 | 0.73 | 44% | 8/12 | 4.10 (2.42) | 0.82 (0.92) |
| C | x2 | 922 | +122.2 | +10.6 | −44.1 | 2.77 | 2.06 | 0.60 | 43% | 8/12 | 3.30 | 0.43 |

"months +" is the share of all calendar months with a net R above 0 (a month without a closed position counts as not
positive); the share among active months is within 2 points of it for every book.

**Noise test** (paired month-block bootstrap, 2,000 draws, the pre-registered rule: P ≥ 0.95 on the return/drawdown
difference, the same sign in both halves, the same sign at x2):

| pair | P(ret/DD diff > 0) | 90 % interval | both halves | x2 | P(t diff > 0) | reading |
|---|---|---|---|---|---|---|
| **C − B** (best vs runner-up, the verdict pair) | 0.785 | −0.73 to +3.15 | no (H2: B 0.89 > C 0.82) | yes | 0.672 | **within noise** |
| B − A | **0.957** | +0.08 to +8.55 | yes | yes | 0.964 | more than noise (same three tests, applied to this pair after the fact) |
| C − A | **0.967** | +0.36 to +10.41 | yes | yes | 0.975 | more than noise (same note) |

- **The pre-registered verdict pair (C vs B) is a draw.** Adding N5 raises total R by 39 % (+107.6 → +149.5) and the
  drawdown by 31 % (−29.2 → −38.3); return/drawdown moves from 3.69 to 3.90, which 21 % of bootstrap draws reverse, and B is
  ahead in the 2012-17 half. N5 and N20 correlate 0.92 day by day (0.96 on 2018-26): C is B with a bigger trend position,
  not a fifth idea.
- **Both honest books beat the live book by more than the pre-registered noise bar,** in both halves and at double costs.
  The verdict pair was fixed as best-vs-runner-up, so this reading is the same three tests applied to a second pair; it is
  reported as such.
- **At x2 costs the live book loses −239R over 11.5 years.** ICT A-setups (2,234 positions, −164R at x2) and the NQ open
  run (929, −157R) have small stops, so a doubled round trip costs 0.06-0.13R a trade; the four gold systems lose 7-10 R
  between them at x2. The live book's untouched record is a cost bet on 4,000 index trades a decade.
- **Per market, W1 x1:** A = gold +128.7, Nasdaq −69.0 (nq-open −28.4, ICT NQ −40.6), S&P −36.1, Dow +25.8. Every
  non-gold leg of the live book lost money on untouched data except the Dow, which #526 found positive on 2008-17 too (+0.047R,
  t 0.8). B and C are gold only.

### What each system contributed in W1 (x1; the source studies' totals reproduce)

| system | positions | total R | R a position | worst DD | ret/DD | t | x2 total | source check |
|---|---|---|---|---|---|---|---|---|
| Gold trend N20 | 74 | +32.3 | +0.436 | −5.4 | 6.0 | 1.58 | +31.0 | #530: 75 / +36.7 by entry date (one Dec-2017 entry closes in 2018) |
| Gold trend fast N5 (C only) | 128 | +41.9 | +0.327 | −10.7 | 3.9 | 1.71 | +40.0 | #530: 129 / +48.0 (same reason) |
| Gold daily engulf | 256 | +47.6 | +0.186 | −15.2 | 3.14 | 1.86 | +38.2 | #530: 256 / +47.6 |
| Gold H4 trendline | 402 | +19.3 | +0.048 | −26.3 | 0.73 | 0.83 | +9.1 | #530: 402 / +19.3 |
| Mosha BO | 62 | +8.5 | +0.137 | −15.1 | 0.56 | 0.57 | +3.9 | mosha-oos: 62 / +8.5 |
| ICT A-setups (A only) | 2,234 | −29.8 | −0.013 | −82.8 | −0.36 | −0.39 | −163.8 | #526: 2,235 / −28.9 |
| NQ NY open run (A only) | 929 | −28.4 | −0.031 | −51.6 | −0.55 | −0.71 | −157.3 | #511: 2004-22 1,560 / −27.6 |

The gold systems' pairwise correlation of daily R in W1: gtrend ~ gtrend5 **0.92**; every other pair between −0.04 and
+0.16 (gtl ~ geg 0.16 is the largest). So B holds three close-to-uncorrelated gold ideas plus the trendline; C holds the
same with the trend idea at double weight.

### How much of each book is long-gold beta (daily OLS on gold's % return)

| window | book | beta (R per 1 % gold day) | beta t | alpha R a day | **alpha t** | R² | beta share of total |
|---|---|---|---|---|---|---|---|
| W1 | A | 0.171 | 6.05 | 0.011 | 0.34 | 0.012 | 0.33 |
| W1 | B | 0.088 | 6.70 | 0.033 | 2.21 | 0.015 | 0.08 |
| W1 | C | 0.067 | 3.88 | 0.048 | 2.41 | 0.005 | 0.04 |
| W2 | A | 0.358 | 6.69 | 0.257 | 4.50 | 0.019 | 0.07 |
| W2 | B | 0.069 | 3.24 | 0.086 | 3.75 | 0.005 | 0.04 |
| W2 | C | 0.016 | 0.46 | 0.134 | 3.73 | 0.000 | 0.01 |
| W3 | A | 0.313 | 4.05 | 0.507 | 5.22 | 0.016 | 0.05 |
| W3 | B | 0.050 | 1.51 | 0.145 | 3.51 | 0.002 | 0.03 |
| W3 | C | −0.013 | −0.25 | 0.218 | 3.23 | 0.000 | −0.01 |

- Every book's daily gold beta is positive and significant on untouched data, but it explains almost nothing (R² ≤ 0.02):
  on W1 a constant long-gold position of book A's beta would have made 33 % of A's total, 8 % of B's and 4 % of C's.
- **Read this with #530's control, not instead of it.** A trend follower's long-gold exposure is convex (in when gold runs,
  flat when it falls), which a linear daily beta barely captures. #530's random-entry control with the same exit put the
  real N20 / N5 entries at the 84th / 82nd percentile of random long entries: most of the trend legs' profit is being long
  gold with a 2 ATR chandelier exit in years gold rose. The "alpha t" of 2.2-2.4 here is the alpha of the exit rule and the
  period as much as of the entries. B and C are still a long-gold trend book; they are just not a *linear* one.

## W2 built-on, 2018-01 to 2026-10, and W3 recent, 2023-01 to 2026-10 (not a test)

These years are the ones the rules were picked on: the gold systems, Mosha BO and ICT on 2018-26, the replica, NQ open run
and momentum pullback on 2023-26. They are reported because the owner will ask; they cannot show an edge.

| window | book | cost | positions | total R | R a year | worst DD | return / DD | t | ann. Sharpe | months + | years + | H1 ret/DD | H2 ret/DD |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| W2 2018-26 | A | x1 | 4,502 | +631.8 | +71.5 | −59.6 | 10.6 | 4.80 | 1.59 | 66% | 8/9 | 2018-22: 1.68 | 2023-26: 17.45 |
| W2 | A | x2 | | +456.6 | +51.7 | −96.9 | 4.71 | 3.47 | 1.15 | 59% | 6/9 | −0.14 | 15.09 |
| W2 | B | x1 | 619 | +204.5 | +23.2 | −20.7 | 9.87 | 3.91 | 1.29 | 57% | 7/9 | 2.72 | 13.46 |
| W2 | B | x2 | | +188.9 | +21.4 | −22.5 | 8.40 | 3.62 | 1.20 | 56% | 7/9 | 1.99 | 13.00 |
| W2 | C | x1 | 718 | +308.5 | +34.9 | −27.8 | 11.1 | 3.75 | 1.24 | 57% | 7/9 | 3.34 | 17.22 |
| W2 | C | x2 | | +291.9 | +33.1 | −29.7 | 9.81 | 3.56 | 1.18 | 55% | 7/9 | 2.71 | 16.75 |
| W3 2023-26 | A | x1 | 1,935 | +531.5 | **+138.7** | −30.5 | **17.45** | 5.46 | 2.74 | 83% | 4/4 | 9.51 | 10.66 |
| W3 | A | x2 | | +470.6 | +122.8 | −31.2 | 15.09 | 4.86 | 2.44 | 80% | 4/4 | 7.17 | 9.65 |
| W3 | B | x1 | 269 | +148.2 | +38.7 | −11.0 | 13.46 | 3.62 | 1.81 | 65% | 4/4 | 7.58 | 7.87 |
| W3 | B | x2 | | +144.2 | +37.6 | −11.1 | 13.00 | 3.52 | 1.77 | 65% | 4/4 | 7.07 | 7.69 |
| W3 | C | x1 | 312 | +215.8 | +56.3 | −12.5 | 17.22 | 3.22 | 1.62 | 65% | 4/4 | 8.07 | 10.46 |
| W3 | C | x2 | | +211.4 | +55.2 | −12.6 | 16.75 | 3.16 | 1.58 | 65% | 4/4 | 7.63 | 10.27 |

- **On the built-on years the live book is best or level:** W2 return/drawdown A 10.6, B 9.9, C 11.1; W3 A 17.5, B 13.5,
  C 17.2, and A's t is the highest everywhere (bootstrap P(B − A > 0) on W3 is 0.19 for return/drawdown and 0.006 for t).
  A makes 3.6 times B's R a year in 2023-26 (+139 vs +39) because the four shadowed systems made +383R of A's +532R there,
  and 2023-26 is exactly where their rules were chosen. This is what in-sample looks like; it is not evidence that they will
  keep doing it.
- **2018-22**, untouched for the replica, NQ open run and momentum pullback (in-sample for the rest): A 1.68 (x2 −0.14), B
  2.72 (1.99), C 3.34 (2.71). In those five years the three later-built systems made −9.6R between them (replica −6.0,
  gmp −27.4, nq-open −4.1) while ICT made +81.4R, so A's 2018-22 is the ICT desk's in-sample years carrying three systems
  that had not yet been fitted.
- The per-system W2 and W3 numbers (replica +124.9R / +130.8R, ICT +166.3 / +84.8, nq-open +95.1 / +99.3, gmp +41.1 /
  +68.4, N20 +83.2 / +50.8, N5 +104.0 / +67.6, geg +54.0 / +30.9, gtl +55.7 / +47.9, Mosha +11.6 / +18.7) reproduce the
  source studies' in-sample figures.

### W1-overlap sensitivity, 2008-01 to 2017-12 (every present system has a record for the whole span)

A 0.23 (x2 −0.95), B 2.64 (1.63), C 2.93 (2.05) return/drawdown; t 0.20 / 1.86 / 2.03. Halves 2008-12 | 2013-17: A 0.17 |
0.09, B 2.57 | 0.60, C 3.33 | 0.47. Bootstrap: C − B P 0.815 (within noise), B − A P 0.917 and C − A P 0.948 (just under
the 0.95 bar on this shorter span). Same ordering, same reading; the H2 (2013-17 gold bear and range) is weak for every
book: B +16.4R in five years, C +16.4R, A +5.3R.

## Implication for the owner (a proposal; nothing was changed)

On the only data none of the rules saw, the book the council runs today made +4R a year with an −83R worst drawdown, and
lost −21R a year with costs doubled; the four systems the honest expectancies flag (replica, momentum pullback, NQ open run,
ICT A-setups) are the reason, and three of them have no record before 2018 at all. The honest-positive book B made +9R a
year with a −29R drawdown (return/drawdown 3.7, t 2.4, positive in both halves and at double costs); its untouched
drawdown is within 1.5× its 2018-26 one (−21R), so its risk is known, while it gives up most of the 2023-26 return (+39R a
year against +139R) because that return is the in-sample years of the systems it drops. Adding Gold trend fast N5 (book C) is a size decision
on the trend idea, not a new idea: more R, more drawdown, the same ratio within noise. If the owner wants the live paper
book to be the one with untouched-data support, the proposal is: live paper risk on gtrend, geg, mosha-bo and gtl (gtl at
the edge: +0.05R a trade, −26R drawdown, loses without 2016 in #530); replica, gmp, nq-open and ict-a as shadows judged on
their forward records against the coach.json bands; gtrend5 stays shadow unless the owner wants double weight on the trend
leg. Two caveats stand: the honest book is a long-gold trend book whose entries are not proven better than random long
entries with the same exits (#530), and 2012-17 was thin for it (+26R in six years, t 0.9), so it should be sized as one
bet on gold trending, about +0.4-0.5R a position on the trend leg and near zero when gold does not rise. The owner decides;
the council changes nothing on this study.

## Method

- **Records.** Only the per-position lists earlier studies committed (nothing re-run): gold systems from
  `research/edge/gold-systems-oos/result.json` `positions` (`c`, `n`, `n2`), Mosha BO from `research/edge/mosha-oos/result.json`
  `positions`, the replica and ICT from `research/edge/sizing/inputs.json` (the #512 and #526 runs with close times and
  live sizing), the momentum pullback from `research/edge/robustness/out/gmp.json` `trades` (HistData rebuild; booked on the
  entry day, no close time recorded; x1 at the claimed 0.15 round trip, x2 at 0.30), the NQ open run from
  `research/edge/nq-open-oos/result.json` `trades` (1 pt / 2 pt). Costs x1 are each study's own; x2 doubles the round trip.
- **Sizing.** Fixed 1R a position as recorded (adds and live sizes inside the position; the sizing study's "fixed" baseline).
  No weighting between systems, so a book's size follows its trade count: that is the live book's own structure.
- **Daily series.** UTC calendar day of the booking (Saturday / Sunday bookings move to Monday), every weekday in the window,
  0R on days without a closed position. Worst drawdown on the cumulative daily R; Sharpe-like t = mean / sd × √days;
  annualised Sharpe = mean / sd × √252; months and years from the daily sums.
- **Beta.** OLS of daily book R on OANDA XAU_USD daily % change (`gold-1d.json`, weekday candles); beta share = beta ×
  Σ gold % ÷ total R.
- **Noise.** Paired month-block bootstrap, the same months drawn for every book, 2,000 draws, seed 1; P(diff > 0) and the
  90 % interval of the difference in return/drawdown and in t.
- **Windows.** W1 2006-07-01 .. 2017-12-31 (halves 2006-07 .. 2011-12 | 2012-17), W1-overlap 2008-01 .. 2017-12, W2
  2018-01-01 .. 2026-10-31 (halves 2018-22 | 2023-26), W3 2023-01-01 .. 2026-10-31 (halves 2023-01 .. 2024-11 | 2024-12 ..
  2026-10). October 2026 is the last full month in every source.
- **Gaps.** No replica or momentum-pullback record before 2018-02 (so neither is in book A on W1); no ICT record before
  2008-01; the replica record ends 2026-04-23 (the #512 replay ran to 2026-11-06 and has no later position); Mosha's last
  position closes 2026-08-19. Crypto trend is a shadow in every book and is not used.

## Files

- `preregistration.md`: books, windows, sources, metrics and the decision rule, committed before the run (b4a7932b).
- `run.mjs`: the study (`node research/edge/honest-book/run.mjs`, 2 s, no network, no candle cache needed).
- `gold-1d.json`: OANDA gold daily closes 2006-03-20 .. 2026-11-06 for the beta regression (copied from the sizing fetch cache).
- `result.json`: every table above, the per-system and per-year figures, the correlations, the bootstrap and the verdict object.

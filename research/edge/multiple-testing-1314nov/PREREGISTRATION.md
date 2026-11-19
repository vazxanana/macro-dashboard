# Pre-registration: multiple testing across the studies of 13-14 Nov 2026 (14 Nov 2026)

Written and pushed alone, before any statistic of this check is collected or computed. Paper research only: no trade, rule,
size, filter, stop or council member is touched. This is not a new trading study: it re-reads the decisive tests of the
studies listed in `research/proposals/2026-11-13-research-day.md` (branch `research-day-13nov`) as ONE family.

## Why
About 80 pre-registered studies ran on 13-14 Nov 2026. Each corrected for its own tests (Holm over its k tests); none was
corrected across studies. With N independent tests at a one-sided 2.5 % level, about N x 0.0228 results of t >= 2 appear by
chance alone. One rule passed and replicated (the gotobi fade, PR #878, test T2 USD/JPY, month t 2.74). This check asks whether
it survives a correction over the whole day's family, and how strong the combined evidence of its replications is.

## Inputs (built once, checked in as `inputs.json`, so `run.mjs` runs offline)
For every row of the summary table: the study's PR, its head branch (from the pull request), its folder, and from
`git show origin/<branch>:research/edge/<topic>/result.json` (RESULT.md where result.json lacks the figure): every
pre-registered primary test of the study in its DECISIVE window (the window the study's pre-registration judged on: the
confirmation / out-of-sample / primary window; never a replication or "reported, not tested" window, never a variant), with
its statistic (t, or z), n, and the stored p and its kind where present.
- **p of a test**: one-sided, in the direction the study pre-registered as the edge (mean > 0 for a trade stream; the
  pre-registered sign for a difference). Computed uniformly as p = 1 - Phi(t) (normal) from the stored decisive t of every
  test, so a negative t gives p > 0.5. Where a test stores no t or z but a one-sided p or a bootstrap probability P (of the
  edge being positive), p = that one-sided p, or 1 - P. Where neither exists the test is listed as not parsed and left out
  of N (with the reason).
- **Rows left out of the family, said so**: pure cost accounting and builds (gotobi-cost #893, yen-spread-log #897; also
  gold-carry, index-futures-cost and the audit fixes, which are not rows of the table); a study that did not run (#827,
  VIX term structure); the summary branch itself (#832).
- **Frozen replications** (a rule fixed by an earlier study, run unchanged on other data: rsi2-replicate #844,
  turnaround-replicate #862, metals-rsi2 #873, gotobi-replicate #889, gotobi-feed #894) are NOT new hypotheses: they are
  kept out of the primary family and reported separately. Sensitivity: the family with them included.
- The live-rule backtest (mcycle-base-study #818) is a test of a positive edge like the others and is in the family.

## Primary family and statistics
N = the number of decisive tests of the original (non-replication) studies.
1. Count of tests with t >= 2, against the expected count under the null, N x (1 - Phi(2)) = N x 0.02275, with a Poisson
   95 % range for that count (an approximation: tests within a study are correlated, follow / fade pairs negatively).
2. Bonferroni threshold 0.05 / N (and the t it needs); Holm over all N at family-wise 0.05; Benjamini-Hochberg q-values
   (step-up adjusted p, monotone) with the tests that have q <= 0.05 and q <= 0.10. BH is valid under positive dependence
   only; the dependence here is mixed, so BH is read as approximate (Benjamini-Yekutieli shown beside it).

## The pre-registered answer
- (a) Does the gotobi T2 decisive test (#878, sell USD/JPY at the 09:55 Tokyo fix, decisive window month t 2.74) have a BH
  q-value <= 0.10 across all N decisive tests? (b) Does it survive Holm across all N at 0.05?
- (c) Combined evidence, Fisher's method, -2 sum ln p, chi-square with 2k degrees of freedom: the original decisive p and the
  two confirmation p's taken as independent: USD/JPY 2005-09 (#889, t 3.80) and the HistData USD/JPY feed (#894, t 2.34), each
  p = 1 - Phi(t). The four-cross pooled replication of #889 (t 2.75) is NOT in the set: the crosses correlate 0.5-0.8 with the
  USD/JPY leg on the same days. Caveat stated with the result: the HistData run covers the same 2018-26 days as the OANDA
  decisive window (per-trade correlation 0.997), so it confirms the feed, not new history; Fisher then overstates the
  evidence. Sensitivity, also reported: Fisher on the original + USD/JPY 2005-09 only (the one confirmation on new days).
- Reading: (a) and (b) are yes / no. Fisher's p is reported as is; it is not a verdict on a live rule (any live use of the
  gotobi fade stays the owner's decision and needs the measured broker cost at that hour: the yen spread log).

## Not done
No study is re-run and no stored figure is changed. Where a result.json cannot be read the row is listed, not guessed.

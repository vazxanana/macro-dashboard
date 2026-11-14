# Pre-registration: multiple testing, update of the 13-14 Nov count with the studies pushed since (14 Nov 2026)

Written and pushed alone, before any statistic of the new studies is collected for this check (only their branch names, PR
numbers and pre-registration titles were read to assign the roles below). Paper research only: no trade, rule, size, filter,
stop or council member is touched, and no study's own files are edited. Not a trading study: it re-reads stored results.

## What it updates
`research/edge/multiple-testing-1314nov` (branch `multiple-testing-1314nov`, PR #904) counted the decisive tests of the 13-14
Nov research day as one family: N = 248, 0 survived Holm or BH at q 0.10, 6 had t >= 2 against 5.6 expected by chance, and the
gotobi fade (#878 T2) with its frozen USD/JPY 2005-09 replication (#889 R2) gave a Fisher p of 3.6e-6. Since then 40 more
pull requests were opened, each on its own branch with `research/edge/<topic>/result.json`: #900-#902 and #905-#941 (all but
#903, an audit fix, and #904 itself). This check adds them.

## Counting rule (the rule of #904, reused unchanged)
- The 248 family tests of #904 are taken exactly as stored in its `inputs.json` (same t / p, same ids); none is re-read.
- For each new study: every pre-registered primary test in its DECISIVE window (the window its own pre-registration judged
  on: confirmation / out-of-sample / decisive; never a replication-only or "reported, not tested" window, never a variant,
  descriptive split or placebo), read from `git show origin/<branch>:research/edge/<topic>/result.json` (RESULT.md or the
  verdict line only where result.json lacks the figure, and then the source is named).
- p of a test: one-sided in the direction the study pre-registered as the edge, p = 1 - Phi(t) (normal) from the stored
  decisive t (or z), so a negative t gives p > 0.5. Where only a one-sided p is stored, that p; where only a bootstrap
  probability P of the edge being positive is stored, p = 1 - P; the t shown is then the normal equivalent of p. A test with
  neither is listed as not parsed, with the reason, and left out of N.
- Changes from #904, and why: none to the rule. One addition: a third role, `robustness` (below), because several of the new
  studies re-run an earlier rule on the SAME days and data (an execution or feed check), which #904 did not have to classify.

## Roles (assigned from the pre-registration titles, before any figure was read)
- **Excluded**: #900 index-futures-cost (cost accounting of existing trades, no rule tested; #904 excluded its kind too).
- **Replication** (a frozen rule of an earlier study run unchanged on data that study did not use): #920 vol-spike-replicate
  (of #860), #924 ibs-replicate (of #895), #928 fx-weekend-gap-replicate and #938 fx-weekend-gap-replicate2 (of #880 rule G).
- **Robustness** (a frozen rule of an earlier study re-checked on the same or overlapping days: timing, feed, execution, or
  the study's own frozen robustness checks): #908 gotobi-timing, #912 gotobi-minute-histdata, #915 gotobi-limit-entry (of
  #878), #937 soybean-short-robust (of #934, the grain seasonality soybean short).
- **Family** (a new hypothesis): every other new study, including #917 tokyo-fix-daily for its tests on days that are NOT
  gotobi days (the fix effect on ordinary days is a new hypothesis); a #917 test restricted to gotobi days is robustness of
  #878. If reading a study shows that a role above is wrong (its own pre-registration calls itself a replication, or it
  re-runs an earlier rule on the same days), the role is corrected and the correction is listed in RESULT.md with the reason.
- Replication and robustness tests are second tests of an existing hypothesis, never new hypotheses: they are kept out of
  the primary family and never counted twice there.

## Outputs
(a) **Holm and Benjamini-Hochberg over ALL tests**: primary family = the 248 of #904 plus the decisive tests of the new family
studies, N_total. Reported: Holm at family-wise 0.05 (the ids that survive), BH q-values with the ids at q <= 0.05 and q <= 0.10
(Benjamini-Yekutieli beside it, since the dependence is mixed), the Bonferroni line 0.05 / N and the t it needs, the count of
tests with t >= 2 against the expected N x (1 - Phi(2)) with a Poisson 95 % range (independence assumed: an approximation),
and the same counts for the new studies alone. Sensitivity, shown not judged: the same over every test including the
replication and robustness tests (#904's six replication tests and the new ones).

(b) **Hypotheses with an independent replication, and their combined evidence.** A hypothesis is listed when at least one
replication test exists for it (#904's and the new ones). Combination: Fisher's method, -2 sum ln p on 2k degrees of freedom,
over the original decisive p and the replication p's whose data do not overlap the original's or each other's in (instrument,
period), as each replication study states it. Overlapping data are never combined: a robustness re-run on the same days (another
feed, another entry minute, a limit entry, the same window under other assumptions) is reported beside the hypothesis as
"held / did not hold" with its own t, never put into Fisher (that would count the same days twice). Where two replications use
different instruments over the same calendar period (other pairs or indices on the same weeks), they are combined only as the
study pooled them (its own pooled test), since instruments on the same days correlate; the caveat is stated with the figure.
Each Fisher p is also compared with the family's Bonferroni line. The list carries, for every hypothesis, the caveats its own
studies recorded (costs, fragility, sample size). Reading: combined evidence for a gross effect is not a net edge, and nothing
here changes a live rule; any use stays the owner's decision (absolute rule 3).

## Not done
No study is re-run, no market data is fetched, no stored figure is changed. A result.json that cannot be read is listed, not
guessed. The collected numbers are committed as `collected.json` so `run.mjs` and the test run offline.

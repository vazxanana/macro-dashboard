# Pre-registration: vb-prior-close (24 Nov 2026)

Written and committed alone before any trade of this split is computed. Paper research only: nothing live reads or changes.

## Question

The two breakout rules that passed (`gold-vol-breakout` T1 and the same T1 on USD/JPY, k 0.5, stop at the UTC open, out at
21:00 UTC) take the first side whose stop order fills. Does where the PREVIOUS day closed in its own range pick better fills on
one side? "With the close" = a buy after the previous day closed in the top third of its range, or a sell after it closed in the
bottom third; "against the close" = a buy after a bottom-third close, or a sell after a top-third close. Middle-third days are
reported, not judged.

Already read, not this question: `gold-ibs` (IBS as a stand-alone daily reversal on gold, FAIL), `ibs-replicate` (indices, does
not replicate), `vb-structure-filter` (the breakouts split by the H4 swing side, FAIL). No study has split the breakouts by the
previous day's close location (no `vb-adaptive-k` study exists in the repository).

## Rules (imported unchanged)

- Gold: `gold-vol-breakout-hourcost` `original.mjs` (byte copy of `gold-vol-breakout/run.mjs`) through its `costs.mjs`
  `daysOf` / `tradesIn` (T1, k 0.5, both sides). Days = `buildDays` (UTC days, weekend folded into Monday via
  `council/fills.mjs` `foldWeekend`).
- USD/JPY: `fx-vol-breakout`'s rule (`index-vol-breakout/original.mjs`, the same byte copy), `vbTrade` with k 0.5 on every
  day `daySkip` allows, every year on file (as `usdjpy-vol-breakout-early` did for 2005-2015).
- Candles: the shared toolkit's OANDA mid M5 cache (`research/edge/_lib/edgekit.mjs` `load`); the last day on file is left out.

## The split

Previous day = the folded UTC daily bar before the trade day, built from the same M5 rows the way `buildDays` builds it
(the bar whose range is `prevRange`). CLV = (close − low) / (high − low) of that bar (known at 00:00 UTC, before any fill).
Top third: CLV ≥ 2/3; bottom third: CLV ≤ 1/3; else middle.

## Costs (after costs is the decision)

- Gold: the measured hourly cost, route C1 of `gold-vol-breakout-hourcost` (its `result.json` profile and commission: half the
  fill hour's median spread share + half the 20:00 hour's + commission, + 0.05 × M slippage, + long financing), through its
  exported `costFrac` / `hourOf`. Today's relative spread is charged on every year (a caveat, not a check).
- USD/JPY: `fx-vol-breakout` `costPx` (0.000045 × entry + 0.5 pip a round trip): measured demo commission + an allowance.
- Gross R reported beside.

## Windows

Discovery 2005-2014 (gold starts 2006-03 in the cache), confirmation 2015-01-01 to the last complete day.

## Tests (three, fixed)

- T1 gold, T2 USD/JPY, T3 pooled (both markets).
- Statistic: with-close net R a trade minus against-close net R a trade. (a) Welch t on trades; (b) paired month t: for every
  calendar month with at least one with-close and one against-close trade, d = mean net R (with) − mean net R (against); t of d
  over those months.
- One-sided p from the confirmation Welch t (normal); Holm over T1-T3.

## Control

Random relabelling of days: within each market and window, the prior-day CLV values are shuffled across that market's trade
days (counts of each third kept), with / against recomputed, the difference recomputed; 1,000 seeded shuffles (the pooled test
shuffles each market separately). Reported: the share of shuffles the real difference beats.

## Pass bar (per test; all needed)

1. Difference > 0 in discovery AND in confirmation.
2. Confirmation Welch t ≥ 2 and Holm p < 0.05.
3. Confirmation paired month t ≥ 2.
4. Confirmation n ≥ 200 in each of the with and against groups.
5. With-close trades net positive after costs in both windows.
6. Confirmation difference above the 95th percentile of the 1,000 relabellings.

Verdict: PASS if T3 passes (T1 / T2 reported with their own items); FAIL otherwise; INCONCLUSIVE if item 4 fails on T3.
Whatever the result, the breakouts' forward records stay the judge; nothing live changes and no filter is adopted from this
study. Picking a different threshold (quartiles, 0.5) after seeing the result is not allowed.

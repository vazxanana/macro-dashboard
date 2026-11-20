# Nowcast against consensus: did the print land on the nowcast's side? (pre-registration, 20 Nov 2026)

Written and committed alone, before `run.mjs` exists and before the nowcast, the consensus and the print were joined for any
release. The Week ahead puts the Cleveland Fed inflation nowcast beside the calendar consensus before each US CPI release
(`council/week-ahead.mjs` `prepFor`: "the nowcast sits above / below the consensus"), and `council/prep-record.mjs` started a
forward record of whether that side is the side the print lands on. At about one CPI release a month that record needs most of
a year to reach 20 judged releases. The same question can be asked now, offline, on the 36 CPI releases of 2022-24 already in
the repository.

**What this is:** a direction-of-surprise test (which side of the consensus a number printed on). It is not a trade: no
position, no price, so no costs apply. Nothing live changes whatever the result (absolute rule 3): no rule, size, filter, call,
probability or trade reads it. It can only change one sentence of wording beside the prep line.

## Data (fixed, all committed, nothing fetched)
- **Nowcast and first print:** `research/macro-veteran/references/cpi-model-benchmark-inputs-2022-2024.json` `records` (the
  veteran batch's CPI first-print ledger bound to its model benchmark): 36 releases, 12 Jan 2022 to 11 Dec 2024, reference months
  December 2021 to November 2024. Per measure (`core`, `headline`): `forecasts.C.numeric` = the Cleveland nowcast of the month's
  m/m change, `actual.numeric` = the BLS first print as published, to one decimal.
- **Consensus:** `council/consensus-history.json` (the Forex Factory "Forecast" via a community dataset), rows `Core CPI m/m`
  and `CPI m/m`, joined on the release's UTC date. Checked before writing this (dates only, no values): every one of the 36
  release dates has both rows with a consensus.
- **Vintage of the nowcast, as the batch states it** (`cpi-model-benchmark-2022-2024.md`, "Source and timing discipline"): each
  value is the last non-empty chart date STRICTLY BEFORE the BLS release date (`model_age_days` is 1 for all 36; release-day
  observations are excluded). So by date it is a pre-release value. But it is read from the producer's currently maintained
  history file: `model_original_delivery_authenticated` is false for all 36, the original publication time of each point is
  unknown, and later revisions of the model file cannot be ruled out. This is said in every report of the result. Had the
  stored value been a release-day or later value, the study would have been declared INCONCLUSIVE; because it is dated the day
  before, the test below is run, with that caveat attached to any PASS.

## Rule (fixed)
For each release and measure:
- `gap` = nowcast − consensus (the nowcast unrounded, the consensus as the calendar shows it, one decimal).
- **Lean** = `in line` when |gap| < 0.05 (the desk's band, `council/week-ahead.mjs` `IN_LINE`, same floating-point guard),
  else `above` when gap > 0, `below` when gap < 0.
- **Print side** = the first print, as published to one decimal, against the consensus: `above`, `below`, or `on` when equal.
- **Judged** = the lean is not `in line` AND the print is not `on` the consensus (as `council/prep-record.mjs`: a model that
  leaned nowhere, or a print with no side, is not judged; counting a print on the consensus as a miss would bias the rate).
- **Hit** = lean equals print side.

## Test
- **Primary: core CPI m/m.** Hits out of judged releases, exact two-sided binomial test against 50 %.
- **Halves:** by release date, the first 18 releases (Jan 2022 to Jun 2023) and the last 18 (Jul 2023 to Dec 2024); hits and
  judged in each.
- **Pass bar (primary only):** judged n ≥ 20 AND p < 0.05 AND the hit rate above 50 % overall AND above 50 % in both halves
  (a half with no judged release fails this check).
- **Verdicts:** INCONCLUSIVE when judged n < 20 (too few to judge, whatever the rate). PASS when the whole bar is met. FAIL
  otherwise.
- **Reported, not tested:** how many of the 36 releases had a lean at all (not `in line`) and how many of those printed on the
  consensus; the same table for headline CPI m/m (secondary: one extra look, no verdict of its own; core and headline of one
  release are not independent, so they are never pooled); hits by the lean's side (above / below); the number of releases where
  the calendar's own "actual" differs from the batch's first print.

## What each verdict will mean for the desk's wording
One sentence is added beside the prep line (the Week ahead's `prep`), with n, hits and p whatever the verdict:
- **PASS:** "in 2022-24 the nowcast's side matched the print on X of Y judged core CPI releases (p …): it pointed the right way
  more often than chance, on a retrospective record of an unauthenticated model history; not a tested trading edge."
- **FAIL:** "… on X of Y (p …): no better than a coin on which side the print lands; read the lean as context only."
- **INCONCLUSIVE:** "… on X of Y: too few judged releases to say."
A PASS never becomes a rule, a call or a size; the forward record (`macro/prep-record.json`) stays the judge of the live reading.

## Limits said in advance
- 36 releases, fewer judged: a small sample from one inflation episode (2022-24).
- The nowcast history is not an authenticated real-time vintage (above).
- A calendar consensus collected by a third party, not a verified survey with a capture time; one decimal, so half the band's
  width is rounding.
- The live prep line reads the nowcast whenever the Week ahead is built (days before the release), not the day before; the
  nowcast for core CPI moves little between releases, the headline one moves with oil.
- CPI only: the batch has no nowcast history for PCE.
- One primary test, one secondary look: no correction is applied, and the headline figure is not evidence on its own.

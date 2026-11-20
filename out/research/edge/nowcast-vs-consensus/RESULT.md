# Nowcast against consensus: did the US CPI print land on the side the Cleveland Fed nowcast leaned to?

**Verdict: INCONCLUSIVE** (pre-registered, 20 Nov 2026). On core CPI the nowcast's side matched the print on 8 of 13 judged
releases (62 %, two-sided binomial p 0.58); the pre-registered bar needs 20 judged releases, so 2022-24 is too few to say.

Pre-registration: `PREREGISTRATION.md` (committed alone before this run). A direction-of-surprise test, not a trade: no
position, no price, no costs. Data: the veteran batch's CPI first-print ledger with the Cleveland nowcast dated the day before
each release (`research/macro-veteran/references/cpi-model-benchmark-inputs-2022-2024.json`, 36 releases, Jan 2022 to Dec 2024)
and the calendar consensus (`council/consensus-history.json`, Forex Factory via a community dataset). Lean = nowcast against
consensus with the desk's 0.05-point in-line band; the print as published to one decimal; a print on the consensus is not
judged.

| | Core CPI m/m (primary) | CPI m/m (secondary, no verdict) |
|---|---|---|
| Releases | 36 | 36 |
| Nowcast leaned (not in line) | 19 of 36 (53 %) | 20 of 36 (56 %) |
| of those, print ON the consensus (not judged) | 6 | 8 |
| **Judged: lean matched the print's side** | **8 of 13 (62 %), p 0.58** | 5 of 12 (42 %), p 0.77 |
| First half (Jan 2022 to Jun 2023) | 5 of 8 | 3 of 8 |
| Second half (Jul 2023 to Dec 2024) | 3 of 5 | 2 of 4 |
| Lean above the consensus | 8 of 11 | 5 of 10 |
| Lean below the consensus | 0 of 2 | 0 of 2 |

Against the bar: judged n 13 is under 20, so the verdict is INCONCLUSIVE whatever the rate. For the record, the other checks:
p 0.58 is not under 0.05; the hit rate is above 50 % overall and in both halves (5 of 8, 3 of 5). At 8 of 13 nothing separates
the nowcast's lean from a coin; 14 or more of 20 would have been needed even with enough releases.

What else the table shows (reported, not tested):
- **The lean is one-sided.** 17 of the 19 core leans, and 16 of the 20 headline leans, were ABOVE the consensus: in 2022-24 the
  nowcast ran higher than the calendar (the batch measured a mean signed error of +0.03 points against the print). So "the
  nowcast sits above the consensus" was the usual state, not a signal of that month; the two core leans below both missed.
- **A lean often led nowhere.** On 6 of the 19 core leans (8 of 20 headline) the print was exactly the consensus.
- Headline CPI (5 of 12) is the wrong side of 50 %, also far inside chance.
- The calendar's own "actual" equals the batch's first print on all 36 releases, for both measures.

What it means for the desk: the Week ahead's prep line keeps saying which side the nowcast sits, and now adds one sentence on
core CPI rows: "In 2022-24 the nowcast's side matched the print on 8 of 13 judged core CPI releases (two-sided binomial p
0.58): too few judged releases to say." The forward record (`macro/prep-record.json`) stays the judge. Nothing live changed: no
rule, call, size, probability or trade reads this.

Limits:
- 36 releases, 13 judged: one inflation episode, and the nowcast leaned the same way almost every time, so the 13 are not 13
  independent tests of "which side".
- **The nowcast is not an authenticated real-time vintage.** Each value is the producer's chart value dated the day before
  the release (`model_age_days` 1 for all 36), read from the currently maintained history file; the batch marks every one
  `model_original_delivery_authenticated: false` and says the original publication time is unknown.
- A calendar consensus collected by a third party, not a verified survey with a capture time; one decimal against a
  0.05-point band.
- The live prep line reads the nowcast whenever the Week ahead is built, days before the release, not the day before.
- CPI only: no nowcast history for PCE is on file.
- Core is the one tested measure; the headline column is a second look with no correction and no verdict.

To repeat: `node research/edge/nowcast-vs-consensus/run.mjs` (committed files only, no network).

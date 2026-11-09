# Independent Treasury outcome recomputation

**All requested frozen-rule comparisons pass**

Computed from official XML before opening root results, using exact Fraction arithmetic derived from source Decimal tokens. The saved calculation fingerprint is `8de3c89eca76c47f13fe14c21532abb8c5b32a980d476ddcf50c312c247991be`. Calculation time: 2026-11-09T00:28:41.611137+00:00; root comparison started: 2026-11-09T00:31:25.051335+00:00. No root engine was imported or inspected.

| Series | Window | Scored / intended | Equal-event mean contrast (bp) |
|---|---|---:|---:|
| real10y | actual | 36 / 36 | 2.055555556 |
| real10y | placebo | 33 / 36 | -1.851010101 |
| nominal2y | actual | 36 / 36 | 5.388888889 |
| nominal2y | placebo | 33 / 36 | -2.702020202 |

The comparison covers all 144 actual/placebo slots across both series. 4683 checks passed with 0 failures. Exact rational results agree with the root JSON numerical display to an absolute tolerance of 1e-12 bp; the largest display difference is 1.3333333333333333333333333333333333333333333E-15.

Controls were regenerated for the same year-month, weekday, fixed preceding-weekday gap, both UTC offsets and UTC interval duration. Exclusion bands use the original 36 CPI dates and strictly adjacent valid source dates. Placebos retain those original bands and exclude their own ending date. Missing required weekdays are never bridged. Control means are computed within each event, followed by equal event weights; control counts are not pooled across months.

All 36 actual events score in each series. The same three placebo slots are unscored in each: original releases March 14, 2023 and March 12, 2024 have no matching control across their DST-transition weekend; original release November 13, 2024 has the required predecessor November 11 absent. Their contrasts remain null. Neither absence nor null is recoded to zero.

Root records intentionally mask all yield-derived fields for ineligible slots. The independent diagnostics retain individually available source components even when an event cannot be scored. This reporting convention is recorded for six slots; the missing reasons, selected dates, null contrasts and all scored estimates agree.

The primary omit-May-15 point agrees at 1.992857143 bp. All three year-specific points, three leave-one-year points and 36 leave-one-event points agree. No controls, exclusion bands or endpoints were rebuilt for the omission.

This bounded audit does not independently validate the bootstrap implementation or confidence intervals, macro-overlap completeness, exceptional quote clocks or original historical availability. Same-producer source-format validation remains distinct from vintage authentication. These are descriptive daily yield-change contrasts; no regression, causal, executable-trade or gold inference is made.

Only independent work files were written. Official sources, frozen protocol, amendment, root result and coverage files remain unchanged.

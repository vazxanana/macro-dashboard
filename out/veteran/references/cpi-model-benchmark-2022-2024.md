# Historical CPI model comparison: mixed core results

The recovered Cleveland history does **not resolve a core CPI squared-error advantage over simple previous-first-print persistence** in the frozen 36-release comparison. Its slightly lower mean squared error comes with higher mean absolute error, an interval spanning zero, and a sign reversal after removing one influential release or all 2022 releases. This is an important limit on treating a public nowcast as a strong release-prediction signal.

The target is each BLS release's printed one-decimal CPI-U monthly SA number. These are current-maintained historical model paths and release archives, not independently authenticated original-time forecast deliveries. The study is retrospective; no historical forecast issuances or prospective track record were created.

## Frozen primary: core Cleveland versus persistence

| Statistic | Cleveland | Persistence |
|---|---:|---:|
| Paired events | 36 | 36 |
| MSE, squared percentage points | 0.017368 | 0.018889 |
| MAE, percentage points | 0.107448 | 0.094444 |
| Mean signed error, forecast minus actual, pp | +0.030028 | +0.005556 |
| Median absolute error, pp | 0.083308 | 0.100000 |

The primary statistic is **MSE(Cleveland)−MSE(persistence)=-0.001521 pp²**; negative favours Cleveland. The approximate 95% 3-month circular-block interval is **[-0.014019,+0.008850]  pp²**. The declared 6-month version is **[-0.014000,+0.006981]  pp²**. Both span zero. They do not resolve a mean-loss advantage at this precision; this is not an equivalence test. Both used 10,000 valid replicates with no redraws.

Squared error was fixed as primary before calculation, consistent with the declared mean-point target. MAE targets a different functional; it remains secondary. The continuous Cleveland point is not established to be the conditional mean of the rounded BLS target. Do not switch the primary loss or target precision after seeing these mixed findings. Cleveland has lower individual squared error on 15 of 36 events.

## Stability is the strongest caution

| Release-year subset | Paired count | Mean squared-loss difference, pp² |
|---|---:|---:|
| 2022 | 12 | -0.010803 |
| 2023 | 12 | +0.005147 |
| 2024 | 12 | +0.001093 |

Excluding 2022 reverses the sign to **+0.003120 pp²**, favouring persistence. The leave-one-event range is [-0.004043,+0.002082] pp². Omitting **10 August 2022** alone reverses the mean to **+0.002082 pp²**. All planned exclusions are reported; this event was not removed from the primary result. No subyear is selected as a preferred evaluation sample.

## Fixed descriptive baselines on the same 36 events

Core monthly, all four methods on the common sample:

| Method | MSE, pp² | MAE, pp | Mean signed error, pp | MedianAE, pp |
|---|---:|---:|---:|---:|
| Cleveland archived nowcast | 0.017368 | 0.107448 | +0.030028 | 0.083308 |
| Previous first-print persistence | 0.018889 | 0.094444 | +0.005556 | 0.100000 |
| Previous 3 first-print mean | 0.019290 | 0.110185 | +0.010185 | 0.083333 |
| Fixed 50/50 Cleveland/persistence | 0.014422 | 0.091079 | +0.017792 | 0.061787 |

The fixed blend was specified before these errors were calculated and follows the already-declared 50/50 rule. It has lower listed core losses in this sample, but no fitted weight, separately confirmed statistical superiority, untouched holdout or future-performance claim. The real prospective pilot is unchanged.

Headline monthly is descriptive secondary, with no separate confirmatory test or CI:

| Method | MSE, pp² | MAE, pp | Mean signed error, pp | MedianAE, pp |
|---|---:|---:|---:|---:|
| Cleveland archived nowcast | 0.028814 | 0.135531 | +0.038515 | 0.110075 |
| Previous first-print persistence | 0.135833 | 0.252778 | +0.013889 | 0.200000 |
| Previous 3 first-print mean | 0.097685 | 0.243519 | +0.028704 | 0.183333 |
| Fixed 50/50 Cleveland/persistence | 0.052467 | 0.170467 | +0.026202 | 0.124886 |

The headline comparison is more favourable to Cleveland in this specified period. Producer documentation explains that headline nowcasts can use oil/gasoline information between releases, whereas core CPI nowcasts rely on past core CPI and change much less frequently. That mechanism is relevant context, not a causal decomposition of the measured error difference. [Producer assessment](https://www.clevelandfed.org/publications/economic-commentary/2023/ec-202306-real-time-assessment-inflation-nowcasting-cleveland-fed), [current model documentation](https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting).

The declared core rounding sensitivity uses exact nearest 0.1 with ties away from zero after predictor construction. It gives paired squared-loss difference **-0.001111 pp²**; Cleveland rounded MAE remains above persistence. This numeric rule is not a claim about BLS rounding internals and does not replace the unrounded primary. All rounded baseline metrics remain in the result file.

## Source and timing discipline

The [protocol](cpi-model-benchmark-protocol-2022-2024.json) was locally adopted 9 November 2026 at 07:32:08 UTC before historical errors were computed. It binds 36 releases during 2022–2024, target months December 2021–November 2024. Inputs/examples and the prior blend rule were already seen; this is not total blindness, external preregistration or an untouched holdout.

The [input/predictor ledger](cpi-model-benchmark-inputs-2022-2024.json) was saved before errors. Each Cleveland value is the last nonempty chart date strictly before the BLS release date; release-day observations are excluded. Original per-point publication time remains unknown. The [producer chart data](https://www.clevelandfed.org/-/media/files/webcharts/inflationnowcasting/nowcast_month.json?sc_lang=en) is a model benchmark, not survey consensus.

Persistence uses the preceding reference month's original printed monthly value; it deliberately does not replace it with later revised history. Rolling 3 requires three consecutive reference months. Three earlier BLS archives, September–November 2021, supply the initial lags; all lag releases precede the selected model date. The independent binding review reparsed 39 releases and 78 monthly fields, matched 72 model tokens, removed 109 non-index chart markers and verified all 216 per-measure lag-date gates. Every primary and all-four common sample contains36 cases.

BLS notice-list metadata labels the November2021 correction notice 21 December, while the linked notice describes a same-day 10 December reissue of an annual-narrative month typo. Those clocks are separately preserved; no selected monthly numeric change or authenticated original bytes is claimed. See `work/cpi-model-baseline-correction-clock-addendum.md`.

The producer's 2023 assessment used different horizons and a later-vintage truth convention. Its findings cannot be imported as proof of this monthly first-print comparison, and this comparison does not reproduce that paper. The retrospective bootstrap also does not account for unknown historical model-file revisions.

## Reproduce and inspect

From the workspace root, Python 3.12+ standard libraries:

```sh
python outputs/scripts/cpi-model-benchmark.py inputs
python outputs/scripts/test_cpi_model_benchmark.py
python outputs/scripts/cpi-model-benchmark.py evaluate
```

Exact rational forecasts, errors, losses and aggregates are retained in the [result JSON](cpi-model-benchmark-results-2022-2024.json). Binary64 conversion occurs only for the declared bootstrap. Twelve Python tests and seven independent JS synthetic fixtures passed. The [validation record](cpi-model-benchmark-validation-2026-11-09.json) binds 5,702 independent source/prediction/loss comparisons, including 1,773 exact rational quantities, and 35 separate actual-bootstrap checks. Every reported check passed within its stated scope; original historical delivery remains unauthenticated.

No trading return, market-consensus surprise, causal CPI effect or data-derived optimal blend was established. No historical observation was inserted as a prospective issued forecast. cTrader remains demo-only. The delivered V1.3 ZIP is preserved.

Result snapshot SHA-256: `f3fb31047e3a56ebf2da07ffab806af3a87b134553f7dc8bcf8cb36ddd1220be`.

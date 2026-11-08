# Cleveland Fed nowcast — current primary-source review

Reviewed through the connected search service during 8 November 2026, 14:01:45–14:02:52 UTC. This is a review note, not archived publisher bytes or proof of the original update minute. No forecast was issued and no master or frozen V1 file was edited.

## Current table and availability

The [official nowcasting page](https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting) displays October 2026 CPI **0.24** and core CPI **0.21**, with update label **11/06**. These are seasonally adjusted, nonannualized monthly percentage changes. Two displayed decimal places do not establish underlying precision. Populated October cells support pending actuals under the page's blank-cell convention; confirm with BLS independently. Business-day updates are normally around 10 a.m. Eastern; no actual publication minute was supplied. The FAQ says core CPI uses past core CPI alone. Its historical chart compares nowcasts with the first available actual release. No explicit nowcast-history download was exposed in the parsed links or targeted primary-domain searches; that is an access/discovery gap, not proof no archive exists.

## Published method and the dependency that matters

The currently linked [technical FAQ PDF](https://www.clevelandfed.org/-/media/project/clevelandfedtenant/clevelandfedsite/indicators-and-data/inflation-nowcasting/nowcasting_faqs.pdf), page 1, fixes `J=12` and describes core CPI forecasts as recursive 12-month moving averages of monthly core inflation. It defines monthly inflation from successive price levels as `100 × (P_t / P_(t−1) − 1)`. The same PDF models gasoline using oil/gasoline observations and combines components for headline CPI. Its core-CPI specification provides no separate high-frequency energy input. This is the published specification; a precise replication still requires the exact current input vintages and unrounded model implementation.

The [December 2025 special-method notice](https://www.clevelandfed.org/-/media/project/clevelandfedtenant/clevelandfedsite/indicators-and-data/inflation-nowcasting/inflation-nowcasting-model-methodological-approach-to-missing-october-and-november-2025-cpi-data.pdf) explains that the model used estimates available on 17 December 2025 to fill October 2025 monthly CPI/core CPI and associated inputs. Those estimated October price levels and published November levels then imply November monthly changes. These substituted October/November monthly readings are model-dependent, not official BLS observations.

**Analyst inference:** Under the published 12-month rule, an October 2026 core forecast averages October 2025–September 2026, so its inputs include the two substituted months. A monthly target avoids the missing official October 2025 year-over-year denominator, but it does not make this baseline free of model-dependent historical inputs. Blending Cleveland with a latest-core-print baseline combines overlapping lagged-core information, rather than two independent measurement processes.

## Historical route and remaining capture requirements

The [official user's guide](https://www.clevelandfed.org/-/media/project/clevelandfedtenant/clevelandfedsite/indicators-and-data/inflation-nowcasting/nowcasting_users_guide.pdf) describes selecting a month/quarter in the chart and viewing daily nowcast sequences against released observations. It does not document a downloadable history file. This review obtained no historical file, intraday receipt log, or independently timestamped copy of the 6 November update. Save a current forward baseline artifact now and record its actual receipt; do not relabel it as a proven 6 November capture.

The [linked working paper](https://www.clevelandfed.org/publications/working-paper/2015/wp-1403r-nowcasting-us-headline-and-core-inflation) is dated 4 November 2015. Historical accuracy discussed there is not evidence that a new custom blend has predictive skill. No error bands were obtained in this review; do not manufacture a distribution from the point nowcast.

## Follow-up: direct publisher captures independently checked

At 14:07:11 UTC, checked the newly downloaded files under `outputs/cpi-pilot-sources-2026-11-08` without changing them. The successful manifest is `direct-capture-manifest-1794146734083.json`; the unsuffixed `direct-capture-manifest.json` retains an earlier failed attempt. All five successful manifest entries have HTTP 200, and their saved byte lengths and SHA-256 values match the actual files.

The saved `cleveland-nowcast.html` monthly table at line 2541 contains the same October values and update label observed through the connected search service. Local extraction of `cleveland-core-method.pdf` confirms the core moving-average specification. Local extraction of `cleveland-missing-input-method.pdf` confirms the December 2025 substitution explanation. No source-content contradiction was found. The successful manifest records the Cleveland HTML received at `2026-11-08T14:05:33.380Z`, establishing this local capture time; it does not establish the original publication minute on 6 November or externally timestamped precommitment.

The proposed fixed blend's arithmetic is correct: `0.5 × 0.21 + 0.5 × 0.30 = 0.255`. This check does not independently reverify the BLS 0.30 input, which belongs to the separate BLS review. Treat the two inputs as overlapping histories, with Cleveland 0.21 as the declared primary comparator and persistence 0.30 as a secondary comparison.

**Single-case interpretation:** Under squared error, 0.255 beats 0.21 only when the observed outcome exceeds 0.2325; it beats 0.30 only when the outcome is below 0.2775. If the resolution target is BLS's one-decimal published monthly change, no possible outcome lies between those thresholds. This single case cannot beat both comparators simultaneously. A fair comparison with the declared primary baseline remains possible, and aggregate rankings across a future cohort can differ. Preserve the distinction between rounded published outcomes and any unrounded index-derived target.

# Gold's reaction to US CPI, NFP and FOMC releases: result

Paper research only. No live rule, size or trade changed. Pre-registration: `preregistration.md` (written before any number below).

## Verdict: FAIL: on CPI days gold's T+5 to T+60 move followed the dollar's first read in 34 of 72 (47%, p 0.722; 2018-21 32%, 2022-26 55%). The playbook labels every reaction statistic descriptive, not a tested edge.

Clock: the M1 files are read as UTC−5, UTC−4 while Europe is on summer time (Amendment 1 in preregistration.md: the release spikes put the files' "EST without DST" label wrong in summer). The first run, on +5 h all year, also failed (CPI 20 of 32, 63%, p 0.11).

Events: 170 with M1 coverage (85 CPI from 2018-02-14, 51 NFP and 34 FOMC from 2022), to 2026-10-28. CPI 2018-21 dates dropped by the spike check: 2018-01-12 (1.69x), 2018-03-13 (0.34x), 2018-04-11 (1.19x), 2018-06-12 (1.67x), 2018-07-12 (1.92x), 2019-12-11 (1.38x), 2020-02-13 (1.21x), 2020-03-11 (0.81x), 2020-04-10 (no barsx), 2020-05-12 (0.98x), 2020-06-10 (1.35x), 2020-07-14 (1.09x), 2020-08-12 (1.18x), 2020-10-13 (0.84x), 2020-11-12 (1.09x), 2021-01-13 (1.93x). Events without bars: FOMC 2022-06-15, NFP 2023-03-10, CPI 2023-03-14, FOMC 2023-03-22, NFP 2023-04-07, CPI 2023-04-12, FOMC 2023-05-03, NFP 2023-05-05, NFP 2023-06-02, CPI 2023-06-13, FOMC 2023-06-14, NFP 2023-07-07, CPI 2023-07-12, FOMC 2023-07-26, NFP 2026-04-03.

## The test (CPI, gold T+5→T+60 against the dollar's first read)

| Type | n | hits | hit rate | p (one-sided) | 2018-21 | 2022-26 | pass |
|---|---|---|---|---|---|---|---|
| CPI | 72 | 34 | 47% | 0.722 | 32% (25) | 55% (47) | no |
| NFP (secondary) | 46 | 20 | 43% | 0.849 | n/a | 43% (46) | not a pass route |
| FOMC (secondary) | 28 | 15 | 54% | 0.4253 | n/a | 54% (28) | not a pass route |

## Descriptive: gold by the dollar's first 5-minute read (±0.05%)

The first-hour split overlaps the first five minutes that define the read, so it shows the size of the reaction, not a forecast.

| Type | Read | n | gold T→T+60 median | up | gold T+5→T+60 median | up |
|---|---|---|---|---|---|---|
| CPI | all | 85 | +0.10% | 58% | -0.00% | 49% |
| CPI | hot read (dollar up) | 31 | -0.24% | 29% | +0.01% | 55% |
| CPI | in line | 13 | +0.06% | 54% | -0.01% | 38% |
| CPI | cool read (dollar down) | 41 | +0.26% | 80% | -0.04% | 49% |
| NFP | all | 51 | +0.13% | 55% | -0.06% | 45% |
| NFP | hot read (dollar up) | 22 | -0.42% | 23% | +0.03% | 50% |
| NFP | in line | 5 | +0.32% | 60% | +0.17% | 60% |
| NFP | cool read (dollar down) | 24 | +0.28% | 83% | -0.09% | 38% |
| FOMC | all | 34 | -0.04% | 47% | -0.01% | 50% |
| FOMC | hot read (dollar up) | 16 | -0.13% | 38% | +0.08% | 56% |
| FOMC | in line | 6 | -0.36% | 17% | -0.31% | 0% |
| FOMC | cool read (dollar down) | 12 | +0.66% | 75% | +0.44% | 67% |

## Descriptive: CPI 2022-24 by core print vs the Cleveland nowcast

| Split | n | gold T→T+60 median | up |
|---|---|---|---|
| hot | 10 | -0.46% | 20% |
| inline | 8 | +0.09% | 50% |
| cool | 14 | +0.30% | 71% |

The nowcast is a model benchmark captured the day before, not survey consensus; the print is the one-decimal first print. Gold's release-day move (UTC daily candle) is computed at run time by `council/playbook.mjs`.

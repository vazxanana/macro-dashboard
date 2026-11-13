# Result: NFP follow or fade, gold and NAS100 (2026-11-13)

**Verdict: FAIL**, 0 of 4 tests pass the pre-registered bar (PREREGISTRATION.md, committed before any number was computed). Best on the decisive window: Fade · gold, +0.096R a trade net (n 40, t 0.512, Holm p 1). Not an edge; nothing live changes.

A new stand-alone event rule (owner decision item 44): it is not a test of the gold book and reads none of its positions or its 2006-17 window.
Release dates: 202 Employment Situation releases 2010-01-01 to 2026-11-06 (BLS rule with its exceptions to 2021, `council/events.mjs` from 2022). Candles: OANDA mid M5 through the keyless candle proxy, 10:00-16:30 UTC of each study day.

| Test | Decisive 2020-now: n | R a trade net | t | Holm p | gross | at 2x cost | Replication 2010-19: n | R a trade net | t | Placebo: beats of 40 (median) | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Follow · gold | 77 | −0.235 | -2.333 | 1 | −0.204 | −0.266 | 115 | −0.050 | -0.6 | 7 (−0.109) | no |
| Fade · gold | 40 | +0.096 | 0.512 | 1 | +0.152 | +0.040 | 77 | +0.018 | 0.139 | 37 (−0.152) | no |
| Follow · NAS100 | 77 | −0.193 | -1.695 | 1 | −0.159 | −0.226 | 120 | −0.249 | -2.807 | 3 (+0.033) | no |
| Fade · NAS100 | 39 | −0.146 | -0.771 | 1 | −0.091 | −0.202 | 89 | −0.014 | -0.105 | 32 (−0.284) | no |

## Checks per test

- **Follow · gold**: decisive n >= 60 met; decisive mean net R > 0 and t >= 2 NOT met; Holm p < 0.05 NOT met; replication 2010-19 mean net R > 0 NOT met; beats >= 38 of 40 placebo draws NOT met.
- **Fade · gold**: decisive n >= 60 NOT met; decisive mean net R > 0 and t >= 2 NOT met; Holm p < 0.05 NOT met; replication 2010-19 mean net R > 0 met; beats >= 38 of 40 placebo draws NOT met.
- **Follow · NAS100**: decisive n >= 60 met; decisive mean net R > 0 and t >= 2 NOT met; Holm p < 0.05 NOT met; replication 2010-19 mean net R > 0 NOT met; beats >= 38 of 40 placebo draws NOT met.
- **Fade · NAS100**: decisive n >= 60 NOT met; decisive mean net R > 0 and t >= 2 NOT met; Holm p < 0.05 NOT met; replication 2010-19 mean net R > 0 NOT met; beats >= 38 of 40 placebo draws NOT met.

## Days, skips and exits

- Follow · gold: 202 release days, 192 trades; skipped: no data 5, flat 0, small range 0, stop too close 5. Exits: time 93, stop 71, target 28. Every other Friday of 2020-now (248 trades): −0.103R a trade net.
- Fade · gold: 202 release days, 117 trades; skipped: no data 5, flat 0, small range 0, stop too close 80. Exits: stop 55, time 21, target 41. Every other Friday of 2020-now (136 trades): −0.169R a trade net.
- Follow · NAS100: 202 release days, 197 trades; skipped: no data 0, flat 0, small range 0, stop too close 5. Exits: stop 92, target 34, time 71. Every other Friday of 2020-now (225 trades): +0.023R a trade net.
- Fade · NAS100: 202 release days, 128 trades; skipped: no data 0, flat 0, small range 0, stop too close 74. Exits: target 55, stop 61, time 12. Every other Friday of 2020-now (128 trades): −0.315R a trade net.

## By year (net R summed)

| Year | Follow · gold | Fade · gold | Follow · NAS100 | Fade · NAS100 |
|---|---|---|---|---|
| 2010 | −4.681 (11) | +3.807 (9) | −1.517 (12) | −2.441 (8) |
| 2011 | +2.237 (12) | −4.987 (7) | −1.490 (12) | −3.084 (9) |
| 2012 | +1.988 (11) | +0.752 (4) | −2.422 (12) | +0.724 (11) |
| 2013 | +1.795 (12) | −0.698 (6) | −1.533 (12) | +0.265 (9) |
| 2014 | +1.231 (11) | −2.936 (10) | −1.226 (12) | +0.028 (8) |
| 2015 | −1.845 (11) | +3.351 (8) | −5.426 (12) | +3.641 (7) |
| 2016 | −1.937 (11) | +1.018 (9) | −2.637 (12) | −5.705 (9) |
| 2017 | −1.831 (12) | +1.257 (8) | −8.456 (12) | −2.196 (11) |
| 2018 | −1.528 (12) | −1.145 (10) | −3.404 (12) | +0.715 (10) |
| 2019 | −1.206 (12) | +0.971 (6) | −1.806 (12) | +6.845 (7) |
| 2020 | −4.057 (12) | −5.206 (7) | +0.770 (10) | −3.947 (6) |
| 2021 | −2.821 (11) | +1.180 (5) | −2.168 (11) | +1.743 (7) |
| 2022 | −4.095 (11) | +5.782 (5) | +1.121 (12) | −0.584 (3) |
| 2023 | +1.667 (11) | +0.407 (2) | −5.341 (10) | −2.269 (8) |
| 2024 | −7.574 (12) | +1.600 (8) | −2.636 (12) | −0.208 (5) |
| 2025 | +0.280 (10) | +1.717 (8) | −0.771 (11) | −2.701 (5) |
| 2026 | −1.486 (10) | −1.641 (5) | −5.821 (11) | +2.270 (5) |

## Notes

- Date check (reported, nothing dropped): 15 of 202 release dates have an 08:30 gold candle under 1.5x the median 08:30 range of the 8 nearest other Fridays, or no candle: 2010-07-02, 2010-08-06, 2011-10-07, 2011-11-04, 2015-04-03, 2019-05-03, 2020-10-02, 2021-04-02, 2022-03-04, 2022-05-06, 2023-03-10, 2023-04-07, 2023-06-02, 2025-12-16, 2026-04-03.
- Fade and follow are near mirror images (same entry, the stop on the other side of the range), so their t values are not independent; Holm treats them as four tests anyway.
- One trade a release, no overlap: t is on trades. Costs: $0.30 a round trip on gold, 2 points on NAS100; no overnight (out by 11:00 New York).
- To repeat: `node --use-env-proxy research/edge/nfp-follow/run.mjs fetch <dir>` (candles kept out of git), then `CANDLES=<dir> node research/edge/nfp-follow/run.mjs run`.

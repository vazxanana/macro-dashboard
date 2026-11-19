# Result: the weekly US natural gas storage report, drift after the first half hour (natgas-storage-day)

**Verdict: FAIL, 0 of 4 checks hold: following the first half hour after the storage report is not an edge on natural gas.** Failed: out-of-sample month-sum t -1.69 (needs >= 2 with mean > 0); in-sample mean net R not above 0; out-of-sample mean not above 0 at 2x cost; beats 29 of 40 placebo means (needs 38). Out of sample −0.078R a trade net (n 446, month-sum t -1.69 over 132 months), at 2x cost −0.178R; in sample −0.084R (n 433, month-sum t -2.13); beats 29 of 40 placebo means.

Pre-registered in PREREGISTRATION.md (pushed alone first). Data: OANDA mid M5 NATGAS_USD via the site proxy, 2005-01-03 to 2026-11-13, 1202952 candles; in sample before 2015-12-09, out of sample from it. Schedule: Thursday 10:30 New York from the rule; 1141 weeks, 223 holiday weeks left out, 918 report days; not traded: 17 warm-up (the first 20 build the stop), 9 without the candles, 13 flat first half hour. Stop 1.5 x the 20-report mean |11:00 to 14:30 move|; cost $0.005 a round trip; no overnight. Research only: nothing live changed.

## Primary (a): follow the first half hour, 11:00 to 14:30 New York

| Window | n | net R a trade | t (trades) | t (month sums) | months | win | total R | worst DD | cost 0 R a trade | x2 cost R a trade |
|---|---|---|---|---|---|---|---|---|---|---|
| in sample | 433 | −0.084 | -2.15 | -2.13 | 127 | 0.448 | -36.3 | -36.3 | −0.023 | −0.144 |
| out of sample | 446 | −0.078 | -1.81 | -1.69 | 132 | 0.413 | -34.7 | -36.1 | +0.023 | −0.178 |
| whole | 879 | −0.081 | -2.78 | -2.67 | 258 | 0.43 | -70.9 | -71.4 | +0.000 | −0.161 |

## Checks

1. Out-of-sample month-sum t >= 2 net: -1.69 (fails).
2. In-sample mean net > 0: −0.084 (fails).
3. Out-of-sample mean > 0 at 2x cost: −0.178 (fails).
4. Beats >= 38 of 40 placebo means: 29 (fails); placebo out-of-sample means −0.171 to −0.012R (median −0.113).

## Detail (reported, not tested)

- In sample: buys −0.102R (n 187), sells −0.070R (n 246).
- Out of sample: buys −0.088R (n 209), sells −0.069R (n 237).
- Exits: stop 203, gap 5, time 671; median risk $0.0635.

| Year | n | net R a trade | total R |
|---|---|---|---|
| 2005 | 22 | −0.171 | -3.8 |
| 2006 | 38 | −0.351 | -13.4 |
| 2007 | 42 | +0.115 | 4.8 |
| 2008 | 42 | −0.069 | -2.9 |
| 2009 | 42 | −0.003 | -0.1 |
| 2010 | 42 | −0.057 | -2.4 |
| 2011 | 43 | −0.224 | -9.6 |
| 2012 | 42 | +0.066 | 2.8 |
| 2013 | 42 | −0.154 | -6.5 |
| 2014 | 39 | −0.034 | -1.3 |
| 2015 | 41 | −0.076 | -3.1 |
| 2016 | 43 | −0.183 | -7.9 |
| 2017 | 40 | −0.157 | -6.3 |
| 2018 | 39 | −0.055 | -2.1 |
| 2019 | 42 | −0.135 | -5.7 |
| 2020 | 40 | −0.092 | -3.7 |
| 2021 | 41 | +0.121 | 4.9 |
| 2022 | 42 | +0.246 | 10.4 |
| 2023 | 41 | −0.080 | -3.3 |
| 2024 | 40 | −0.143 | -5.7 |
| 2025 | 40 | −0.161 | -6.4 |
| 2026 | 36 | −0.271 | -9.8 |

## Reported only (b): Wednesday 14:30 close to Thursday 10:25

- Drift: in sample −0.1767 % (n 457, month-sum t -2.12); out of sample +0.0169 % (n 454, month-sum t 0.17).
- Walk-forward trade (side from the 20 previous reports, spread only, no financing): in sample −0.057R net (n 377, month-sum t -1.22); out of sample −0.097R (n 454, month-sum t -2.21); 2x cost −0.189R.

## Reading

Never call this an edge. Before any cost the rule is flat (in sample −0.023R, out of sample +0.023R a trade), so the first half hour after the report says nothing about the move to the settlement; the $0.005 spread on a median risk of $0.0635 is the loss. No proposal is written and nothing live changed. (b) is a description and cannot pass or fail the study. Not tested: consensus surprises (no consensus data), holiday-week releases, other exits.

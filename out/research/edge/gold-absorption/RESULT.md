# Result: gold absorption days, effort without result (14 Nov 2026)

**Verdict: FAIL: buying after a heavy-activity, small-range day that follows a decline beat the same buy on other days by +0.180R out of sample (n 62, month t 1.62, Holm p 0.12) and lost -0.026R in sample.**

Pre-registered in `PREREGISTRATION.md` (pushed alone, commit 590be1511, before any figure of this study was computed). A
stand-alone rule on spot gold: not a gate, exit, entry or size of the live gold book, and none of its positions was read
(docs/owner-decisions.md item 44 untouched). Not an edge; nothing live changed and no proposal is written.

Data: council-data `research/daily/xau.json` (OANDA mid, UTC days, weekends folded into Monday with `fills.mjs`
`foldWeekend`), 20 Mar 2006 to 13 Nov 2026, 5,369 days; column `v` = OANDA's count of price updates (a proxy for activity,
not traded volume). Absorption day = activity over its 50-day mean divided by range over ATR(20), above the 90th percentile of
the previous 250 days, with activity at least its mean. Enter at that day's close, out five days later or at a 2 x ATR(20)
stop. Net of $0.60 a round trip and overnight financing on buys (`nights` x `FIN.xau.long`). Excess = net R minus the same
year's mean net R of the identical trade on every other day with the same prior 10-day move (the drift control). t on
calendar-month sums; Holm over the three out-of-sample p-values.

Days: 2,530 eligible in sample (222 absorption: 105 after a decline, 117 after an advance), 2,557 out of sample (204: 62 and
142). Out of sample, absorption days came after advances more than twice as often as after declines.

| Test | Window | n | R gross | R net | Statistic | Stat. at 2x costs | Month t | Win | Stops | Baseline n | Baseline net |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 buy after decline, excess (primary) | IS 2007-16 | 105 | -0.003 | -0.047 | -0.026 | -0.024 | -0.31 | 51 % | 19 | 1,076 | -0.024 |
| | OOS 2017-26 | 62 | +0.303 | +0.258 | +0.180 | +0.186 | 1.62 | 65 % | 4 | 1,049 | +0.021 |
| T2 sell after advance, excess | IS 2007-16 | 117 | -0.041 | -0.057 | +0.030 | +0.031 | 0.41 | 50 % | 22 | 1,232 | -0.094 |
| | OOS 2017-26 | 142 | -0.100 | -0.113 | +0.021 | +0.023 | 0.19 | 46 % | 41 | 1,303 | -0.129 |
| T3 buy after decline, net R | IS 2007-16 | 105 | -0.003 | -0.047 | -0.047 | -0.092 | -0.56 | 51 % | 19 | | |
| | OOS 2017-26 | 62 | +0.303 | +0.258 | +0.258 | +0.212 | 2.44 | 65 % | 4 | | |

## The pass bar, check by check

| Check | T1 (primary) | T2 | T3 |
|---|---|---|---|
| OOS statistic > 0 | yes (+0.180) | yes (+0.021) | yes (+0.258) |
| OOS month t >= 2 | **no (1.62)** | no (0.19) | yes (2.44) |
| Holm p < 0.05 | **no (0.115)** | no (0.427) | yes (0.032) |
| In sample same sign | **no (-0.026)** | yes (+0.030) | **no (-0.047)** |
| 2x costs > 0 | yes | yes | yes |
| Placebo beats >= 38 of 40 | yes (40; mean -0.012, max +0.136) | no (28) | yes (40) |
| Pass | **no** | no | no |

T3 clears every out-of-sample check but loses in sample (2012, 2014 and 2016 negative): the out-of-sample buy is mostly
gold's 2017-26 rise inside the same trade (the baseline buy also made money then) plus +0.18R a trade of excess on 62 trades,
in 31 months. The primary excess test is the one that separates the signal from that rise, and it is under t 2 out of sample
and negative in sample. The sell side shows nothing (excess +0.02-0.03R, t under 0.5).

By year (T1 excess): in sample 2007 +0.41, 2008 +0.05, 2009 -0.36, 2010 +0.32, 2011 -0.08 (n 1), 2012 -0.17, 2013 +0.24,
2014 +0.03, 2015 +0.13, 2016 -0.52; out of sample 2017 -0.22, 2018 +0.61, 2019 +0.33, 2020 +0.17, 2021 +0.14, 2022 +1.01,
2023 -0.19, 2024 +0.36, 2025 -0.24, 2026 +0.42 (4 to 19 trades a year).

## Reading

Not an edge, and not a lead by the pre-registered bar: the one window where absorption after a decline looked good is the
window where every gold buy did well, and it rests on 62 trades. The idea ends here, as pre-registered; a silver replication
was promised only for a pass. Caveat said in the pre-registration: OANDA's quote count is not traded volume, so this measures
a proxy and does not judge the tape-reading idea on exchange volume.

Reproduce: `node research/edge/gold-absorption/run.mjs` (git show of council-data, no network, no cache). Test:
`tests/gold-absorption.test.mjs`.

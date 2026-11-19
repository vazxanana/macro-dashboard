# Result: spot gold over the lunar cycle (14 Nov 2026)

**Verdict: FAIL, 0 of 3: long gold around the new moon and short around the full moon made -0.026R a leg net 2017-26 (n 243, month t -0.40), -0.013R in 2007-16; 17 of 40 placebos.**

A stand-alone calendar rule of its own: no rule or position of the live gold book was read, tested or touched
(docs/owner-decisions.md item 44). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure). Code: `run.mjs`.
Every figure: `result.json`; this page is written by `run.mjs` from it. Nothing is an edge here; nothing live changed and no
proposal is written.

## Data and rule

Council-data `research/daily/xau.json` (OANDA mid spot gold, UTC daily candles, weekends folded into the next weekday with
`fills.mjs` `foldWeekend`), 2006-03-20 to 2026-11-06, 5364 trading days. Moon phases: Meeus ch. 49 (periodic terms to 0.00017 day), TD taken as UTC.
Long from the close at or after each last quarter to the close at or after the next first quarter (the half month around
the new moon), short from the first quarter to the next last quarter (around the full moon); a leg exits on the candle the
next one enters (median 10 trading days). Stop 2 x ATR(20) (a gap through it fills at the open; a stopped leg stays flat
until the next phase), $0.60 a round trip and `FIN` financing (0.000148 of price a rollover) on buys; 2x costs = $1.20
and twice the financing. t on calendar-month sums, one-sided, Holm over the three tests.

## The every-day baseline (same side, entered every trading day, out 10 trading days later)

| Window | Side | n | Gross R | Net R | Net at 2x |
|---|---|---|---|---|---|
| in sample 2007-16 | long | 2602 | +0.088 | +0.013 | -0.061 |
| in sample 2007-16 | short | 2602 | -0.084 | -0.101 | -0.118 |
| out of sample 2017-26 | long | 2547 | +0.203 | +0.116 | +0.030 |
| out of sample 2017-26 | short | 2547 | -0.152 | -0.166 | -0.180 |

## The tests (T1 net R a leg; T2 / T3 excess R a leg over the same-side baseline)

| Test | Rule | Window | n | Mean R | Month t | Net R | Gross R | Gross t | Win % | Stops | Median stop $ | Cost share % | Total R | Mean at 2x | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | both legs: long last quarter -> first quarter, short first quarter -> last quarter (net R) | in sample | 247 | -0.013 | -0.21 | -0.013 | +0.035 | 0.55 | 46.15 | 82 | 37.15 | 5.91 | -3.27 | -0.061 |  | |
| T1 | both legs: long last quarter -> first quarter, short first quarter -> last quarter (net R) | out of sample | 243 | -0.026 | -0.40 | -0.026 | +0.027 | 0.41 | 40.33 | 78 | 48.29 | 6.45 | -6.25 | -0.078 | 1 | no |
| T2 | long legs (around the new moon) minus the every-day long baseline (excess R) | in sample | 124 | +0.029 | 0.33 | +0.042 | +0.121 | 1.37 | 50.81 | 36 | 37.49 | 9.68 | +3.60 | +0.025 |  | |
| T2 | long legs (around the new moon) minus the every-day long baseline (excess R) | out of sample | 121 | +0.030 | 0.29 | +0.146 | +0.237 | 2.30 | 47.11 | 31 | 48.29 | 10.37 | +3.61 | +0.025 | 1 | no |
| T3 | short legs (around the full moon) minus the every-day short baseline (excess R) | in sample | 123 | +0.032 | 0.37 | -0.069 | -0.052 | -0.60 | 41.46 | 46 | 37.15 | 2.08 | +3.92 | +0.032 |  | |
| T3 | short legs (around the full moon) minus the every-day short baseline (excess R) | out of sample | 122 | -0.030 | -0.37 | -0.196 | -0.182 | -2.22 | 33.61 | 47 | 48.1 | 1.88 | -3.69 | -0.030 | 1 | no |

Legs dropped because their exit is not on file yet: 2; legs with no trading candle between two phases: 0.

## Checks of each test (all must hold)

| Test | OOS mean > 0 | OOS month t >= 2 | Holm p < 0.05 | in sample > 0 | > 0 at 2x costs | >= 38 of 40 placebos |
|---|---|---|---|---|---|---|
| T1 | no | no | no | no | no | no |
| T2 | yes | no | no | yes | yes | n/a |
| T3 | no | no | no | yes | no | n/a |

## Placebo (40 seeded draws, T1 out of sample)

Every phase time shifted by one random offset (uniform over 0 to 29.53 days) and T1 run again.

| Rule net R | Placebo mean | min | max | Seeds beaten |
|---|---|---|---|---|
| -0.026 | -0.026 | -0.116 | +0.066 | 17 of 40 |

## The opposite direction (long around the full moon, short around the new moon; reported, not judged)

| Window | n | Net R | Month t |
|---|---|---|---|
| in sample | 247 | -0.094 | -1.59 |
| out of sample | 243 | -0.021 | -0.30 |

## T1 by year (net R a leg)

| Year | n | Net R |
|---|---|---|
| 2007 | 25 | +0.250 |
| 2008 | 24 | -0.248 |
| 2009 | 25 | -0.160 |
| 2010 | 25 | -0.086 |
| 2011 | 24 | +0.072 |
| 2012 | 25 | +0.134 |
| 2013 | 25 | -0.108 |
| 2014 | 25 | -0.538 |
| 2015 | 24 | +0.486 |
| 2016 | 25 | +0.080 |
| 2017 | 25 | -0.174 |
| 2018 | 25 | +0.046 |
| 2019 | 24 | +0.043 |
| 2020 | 25 | -0.201 |
| 2021 | 25 | +0.242 |
| 2022 | 25 | -0.059 |
| 2023 | 24 | +0.045 |
| 2024 | 25 | -0.032 |
| 2025 | 25 | -0.232 |
| 2026 | 20 | +0.094 |

## Reading

Not an edge. T1 fails: out-of-sample mean > 0, out-of-sample month t >= 2, Holm p < 0.05, in-sample mean > 0, mean > 0 at 2x costs, 38 of 40 placebos. T2 and T3 fail too. The both-sided stream is long half the time and short half the time, so it cannot ride gold's rise; costs and financing take 6.45 % of the mean absolute gross R a leg out of sample (median stop $48.29). Against the every-day baseline of each side (T2, T3) the half month around the new moon and the half month around the full moon are no measurably different from an ordinary day of the same side. The published index effect does not carry to gold here. No proposal; nothing live changed.


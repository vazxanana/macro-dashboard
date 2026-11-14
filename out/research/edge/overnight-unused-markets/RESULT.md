# Overnight drift on index CFDs no earlier study used: result

Pre-registered in PREREGISTRATION.md (committed and pushed alone before any return was read). Built 2026-11-14. Paper research only: nothing live changed. The rule is index-overnight's, copied byte for byte (`frozen.mjs`); only the session times are each exchange's own.

## Verdict: REPLICATES (gross) / FAIL (net): 14 unused index CFDs pooled, 2016-26: +0.011R a trade before costs (n 36701, month-sum t +2.10; 2005-15 +0.027R, t +4.41), −0.025R after the frozen cost model (t −4.83).

## Gate

- index-overnight's `run.mjs` (as `frozen.mjs`) re-run on a fresh fetch: T1 / T2 rows equal the committed result.json: **yes** (frozen.mjs full on a fresh fetch (US500 258,206 and NAS100 258,176 M30 candles) wrote a result.json byte-identical to the committed one, so every T1 / T2 row (and T3, placebo, pooled) is reproduced exactly).
- The wrapper given New York sessions against the frozen `runMarket`: US500 5464 of 5464 trades, identical yes; NAS100 5464 of 5464, identical yes.

## Primary tests (Holm over the two)

| Test | 2016-26 mean R a trade | n | months | month t | replication mean (markets) | p | Holm p | Holds |
|---|---:|---:|---:|---:|---|---:|---:|---|
| H1 gross | +0.011 | 36701 | 130 | +2.10 | +0.027 (t +4.41, n 27991, 12 markets) | 0.018 | 0.036 | yes |
| H2 net (frozen base cost) | −0.025 | 36701 | 130 | −4.83 | −0.006 (t −1.00) | 1 | 1 | no |

Pooled costs, 2016-26: spread −0.022R, financing −0.014R a trade; at twice the spread −0.048R (t −9.07). Total +409.4R gross, −930.8R net. Without US2000 (non-US only): 2016-26 +0.011R gross (t +1.95), −0.027R net (t −5.00); replication +0.027R gross (t +4.38).

## Per market, 2016-26 (Holm over the qualifying markets, gross and net apart)

| Market | n | win % | Gross R | t gross | Holm p gross | Spread R | Financing R | Net R | t net | Holm p net | Net at 2x spread | Total net R | Max DD R | Stops | Median stop % | Placebo gross p5 / p50 / p95 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| US2000 | 2721 | 51.3 | +0.019 | +2.44 | 0.095 | −0.017 | −0.011 | −0.009 | −1.20 | 1 | −0.027 | −25.4 | 33.5 | 86 | 1.839 | −0.013 / +0.007 / +0.017 |
| DE40 | 2748 | 49.3 | +0.014 | +2.22 | 0.159 | −0.022 | −0.015 | −0.023 | −3.63 | 1 | −0.045 | −62.9 | 65.6 | 99 | 1.334 | 0.000 / +0.014 / +0.029 |
| UK100 | 2706 | 47.6 | −0.002 | −0.30 | 1 | −0.026 | −0.017 | −0.046 | −7.48 | 1 | −0.072 | −123.6 | 128.2 | 96 | 1.12 | −0.011 / +0.005 / +0.018 |
| EU50 | 2753 | 49.4 | +0.013 | +2.12 | 0.187 | −0.022 | −0.015 | −0.024 | −3.94 | 1 | −0.046 | −66.1 | 69.5 | 105 | 1.363 | −0.002 / +0.012 / +0.024 |
| FR40 | 2746 | 48.4 | +0.009 | +1.33 | 0.565 | −0.023 | −0.015 | −0.030 | −4.60 | 1 | −0.053 | −81.2 | 85.4 | 96 | 1.304 | −0.003 / +0.008 / +0.022 |
| CH20 | 2708 | 46.6 | −0.008 | −1.14 | 1 | −0.028 | −0.018 | −0.054 | −7.67 | 1 | −0.082 | −145.9 | 149.2 | 56 | 1.097 | −0.014 / −0.005 / +0.006 |
| NL25 | 2743 | 49.6 | +0.014 | +1.98 | 0.239 | −0.025 | −0.016 | −0.027 | −3.79 | 1 | −0.051 | −73.1 | 77.4 | 96 | 1.202 | −0.005 / +0.010 / +0.023 |
| ES35 | 2472 | 48.3 | +0.004 | +0.54 | 0.884 | −0.023 | −0.015 | −0.034 | −4.79 | 1 | −0.057 | −84.8 | 90.1 | 41 | 1.269 | +0.002 / +0.014 / +0.025 |
| JP225 | 2792 | 51.0 | +0.026 | +2.60 | 0.065 | −0.018 | −0.011 | −0.003 | −0.32 | 1 | −0.022 | −8.9 | 38.9 | 216 | 1.658 | −0.005 / +0.015 / +0.034 |
| AU200 | 2714 | 50.6 | +0.012 | +1.23 | 0.565 | −0.026 | −0.016 | −0.030 | −3.06 | 1 | −0.057 | −82.4 | 90.0 | 208 | 1.11 | −0.008 / +0.008 / +0.021 |
| HK33 | 2608 | 49.2 | +0.012 | +1.33 | 0.565 | −0.017 | −0.011 | −0.016 | −1.87 | 1 | −0.033 | −42.3 | 50.8 | 104 | 1.9 | −0.023 / −0.006 / +0.009 |
| CN50 | 2784 | 47.9 | +0.013 | +1.93 | 0.241 | −0.018 | −0.012 | −0.017 | −2.50 | 1 | −0.035 | −46.8 | 50.1 | 58 | 1.681 | −0.005 / +0.007 / +0.026 |
| SG30 | 2791 | 50.0 | +0.013 | +1.40 | 0.565 | −0.023 | −0.014 | −0.024 | −2.65 | 1 | −0.047 | −67.3 | 72.5 | 163 | 1.341 | −0.009 / +0.013 / +0.033 |
| IN50 | 1415 | 52.0 | +0.021 | +1.62 | 0.421 | −0.023 | −0.012 | −0.014 | −1.11 | 1 | −0.038 | −20.0 | 31.3 | 70 | 1.315 | 0.000 / +0.024 / +0.048 |

## Per market, replication (data start to 2015)

| Market | from | n | Gross R | t gross | Net R | t net | Net at 2x spread | Max DD R |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| US2000 | 2005-02-01 | 2735 | +0.018 | +2.82 | −0.010 | −1.61 | −0.028 | 32.2 |
| DE40 | 2005-02-01 | 2758 | +0.028 | +4.51 | −0.003 | −0.47 | −0.023 | 26.1 |
| UK100 | 2005-02-02 | 2718 | +0.030 | +4.41 | −0.008 | −1.15 | −0.032 | 29.9 |
| EU50 | 2005-02-01 | 2759 | +0.020 | +2.94 | −0.014 | −2.00 | −0.035 | 45.3 |
| FR40 | 2005-02-01 | 2766 | +0.016 | +2.71 | −0.014 | −2.34 | −0.033 | 42.0 |
| CH20 | 2005-02-01 | 2721 | +0.031 | +4.42 | −0.007 | −1.08 | −0.032 | 35.2 |
| NL25 | 2008-02-18 | 1991 | +0.020 | +2.62 | −0.008 | −0.98 | −0.027 | 31.3 |
| ES35 | — | 0 | under 100 trades: no figures | | | | | |
| JP225 | 2010-04-12 | 1385 | +0.033 | +2.04 | +0.010 | +0.60 | −0.008 | 19.7 |
| AU200 | 2005-02-02 | 2389 | +0.034 | +3.07 | −0.002 | −0.19 | −0.025 | 22.2 |
| HK33 | 2005-02-01 | 2629 | +0.030 | +2.77 | −0.001 | −0.07 | −0.020 | 21.0 |
| CN50 | 2011-09-27 | 1019 | +0.031 | +2.70 | +0.011 | +1.02 | −0.002 | 7.9 |
| SG30 | 2005-02-02 | 2121 | +0.033 | +2.47 | −0.006 | −0.47 | −0.031 | 46.0 |
| IN50 | — | 0 | under 100 trades: no figures | | | | | |

## Placebo (40 seeds, random start, each market held for its median weekday overnight hold)

- 2016-26: real pooled gross +0.011R against placebo 0.000 / +0.008 / +0.016 (rank 29 of 40); net −0.025R against −0.030 / −0.022 / −0.015 (rank 9 of 40); placebo month t gross +0.07 / +1.02 / +1.84.
- Replication: real pooled gross +0.027R against placebo +0.008 / +0.014 / +0.020 (rank 40 of 40); net −0.006R against −0.018 / −0.012 / −0.007 (rank 38 of 40); placebo month t gross +1.07 / +1.80 / +2.93.

## By year (gross R a trade, 2016-26 and replication)

| Year | US2000 | DE40 | UK100 | EU50 | FR40 | CH20 | NL25 | ES35 | JP225 | AU200 | HK33 | CN50 | SG30 | IN50 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2005 | +0.053 | +0.026 | +0.033 | +0.064 | +0.021 | +0.061 | — | — | — | +0.048 | +0.062 | — | +0.100 | — |
| 2006 | +0.021 | +0.048 | +0.075 | +0.059 | +0.039 | +0.087 | — | — | — | +0.063 | +0.065 | — | +0.145 | — |
| 2007 | +0.015 | +0.003 | +0.026 | −0.010 | +0.003 | −0.007 | — | — | — | +0.068 | +0.058 | — | +0.125 | — |
| 2008 | −0.012 | −0.008 | +0.001 | −0.025 | +0.001 | −0.006 | −0.011 | — | — | −0.034 | −0.013 | — | −0.306 | — |
| 2009 | +0.030 | +0.042 | +0.059 | +0.037 | +0.039 | +0.040 | +0.061 | — | — | +0.066 | +0.046 | — | +0.055 | — |
| 2010 | +0.034 | +0.056 | +0.047 | +0.031 | +0.033 | +0.050 | +0.050 | — | −0.001 | +0.038 | +0.044 | — | +0.015 | — |
| 2011 | +0.006 | −0.009 | −0.033 | −0.037 | −0.034 | −0.015 | −0.033 | — | −0.042 | −0.034 | −0.016 | −0.013 | −0.042 | — |
| 2012 | +0.028 | +0.048 | +0.013 | +0.036 | +0.019 | +0.012 | +0.006 | — | +0.098 | +0.073 | +0.013 | +0.043 | +0.037 | — |
| 2013 | +0.037 | +0.044 | +0.028 | +0.025 | +0.020 | +0.044 | +0.034 | — | +0.094 | +0.072 | +0.071 | +0.035 | +0.022 | — |
| 2014 | +0.008 | +0.036 | +0.039 | +0.042 | +0.033 | +0.035 | +0.025 | — | +0.020 | +0.030 | +0.008 | +0.042 | +0.020 | — |
| 2015 | −0.021 | +0.023 | +0.042 | +0.006 | +0.008 | +0.046 | +0.026 | — | +0.008 | −0.006 | −0.001 | +0.014 | −0.007 | — |
| 2016 | +0.009 | −0.003 | +0.030 | +0.019 | +0.006 | −0.011 | −0.011 | — | +0.039 | +0.041 | +0.011 | +0.007 | +0.024 | — |
| 2017 | +0.041 | +0.044 | +0.019 | +0.038 | +0.049 | −0.007 | +0.056 | +0.029 | +0.051 | +0.041 | +0.073 | +0.025 | +0.054 | +0.063 |
| 2018 | +0.018 | +0.018 | −0.010 | +0.011 | +0.005 | −0.006 | −0.014 | +0.023 | −0.016 | −0.019 | +0.009 | +0.014 | −0.020 | +0.019 |
| 2019 | +0.043 | +0.010 | +0.006 | +0.019 | +0.025 | +0.010 | +0.027 | +0.010 | +0.024 | +0.021 | +0.013 | +0.032 | +0.008 | +0.011 |
| 2020 | +0.038 | +0.010 | −0.024 | −0.008 | −0.013 | −0.008 | −0.006 | −0.001 | +0.016 | +0.001 | +0.010 | +0.040 | +0.001 | +0.017 |
| 2021 | +0.046 | +0.030 | +0.017 | +0.036 | +0.030 | +0.018 | +0.048 | +0.013 | +0.041 | +0.036 | +0.004 | +0.017 | +0.013 | +0.041 |
| 2022 | −0.025 | −0.032 | −0.040 | −0.029 | −0.025 | −0.043 | −0.026 | −0.020 | −0.039 | −0.006 | −0.041 | −0.012 | −0.042 | −0.066 |
| 2023 | −0.008 | +0.012 | −0.021 | −0.008 | −0.015 | −0.010 | −0.012 | +0.019 | +0.035 | −0.001 | +0.027 | +0.028 | +0.041 | — |
| 2024 | +0.053 | +0.027 | +0.010 | +0.024 | −0.004 | −0.020 | +0.056 | −0.026 | +0.039 | −0.003 | −0.012 | −0.006 | +0.011 | — |
| 2025 | −0.012 | +0.049 | +0.008 | +0.037 | +0.037 | −0.001 | +0.018 | −0.001 | +0.053 | +0.020 | +0.028 | −0.005 | +0.047 | — |
| 2026 | +0.004 | −0.012 | −0.017 | +0.004 | −0.002 | −0.010 | +0.020 | −0.007 | +0.046 | +0.003 | +0.005 | +0.001 | +0.003 | — |

## Data and departures

- Candles: OANDA mid M30 through /md/bars. US2000 2005-01-02 to 2026-10-30 (249434; dropped {"data":15,"atr":20,"gap":0}); DE40 2005-01-03 to 2026-10-30 (179273; dropped {"data":0,"atr":21,"gap":8}); UK100 2005-01-04 to 2026-10-30 (180251; dropped {"data":0,"atr":21,"gap":18}); EU50 2005-01-03 to 2026-10-30 (167875; dropped {"data":0,"atr":20,"gap":6}); FR40 2005-01-03 to 2026-10-30 (151779; dropped {"data":0,"atr":21,"gap":7}); CH20 2005-01-03 to 2026-10-30 (126283; dropped {"data":0,"atr":21,"gap":14}); NL25 2008-01-18 to 2026-10-30 (128724; dropped {"data":0,"atr":20,"gap":7}); ES35 2016-12-01 to 2026-10-30 (52605; dropped {"data":0,"atr":20,"gap":4}); JP225 2005-01-03 to 2026-10-30 (225502; dropped {"data":0,"atr":0,"gap":6}); AU200 2005-01-03 to 2026-10-30 (205651; dropped {"data":0,"atr":20,"gap":44}); HK33 2005-01-03 to 2026-10-30 (121483; dropped {"data":0,"atr":21,"gap":33}); CN50 2011-08-29 to 2026-10-30 (136488; dropped {"data":0,"atr":19,"gap":14}); SG30 2005-01-03 to 2026-10-30 (177922; dropped {"data":0,"atr":18,"gap":45}); IN50 2011-08-25 to 2022-07-12 (73727; dropped {"data":0,"atr":0,"gap":0}).
- Not qualifying (under 300 decisive trades): none.
- All fourteen markets qualified (300 or more decisive trades). The study ran on fourteen, not on a subset chosen after the run.
- IN50: the proxy serves no candle after 12 Jul 2022, so its decisive window is 2016 to mid-2022 (1,415 trades), and its 2011-15 candles give no trade at the pre-registered session (fewer than 100): no replication figures. ES35: candles from 1 Dec 2016 only, no replication.
- JP225, NL25 and CN50 start their replication later than their first candle (Apr 2010, Feb 2008, Sep 2011): before that the file has no candle at one of the cash-session boundaries (candle existence only; the cash-day rule of the pre-registration drops those days). The JP225 file starts in 2005 with candles outside Tokyo hours only.
- The 'gap' drops are cash days whose next cash day was more than five calendar days later (long local holidays such as Lunar New Year, Easter, year end, or holes in the file), as pre-registered.
- Financing is the frozen US-rate model for every market (said in the pre-registration); a non-US CFD is financed on its own currency's rate. Even with financing set to zero the pooled 2016-26 figure is gross minus spread only: +0.011R - 0.022R = about -0.011R a trade, still negative.
- No figure was changed after the run; notes.json holds only the gate record, these lines and the reading.

## Reading

The gross overnight gain replicates on the pre-registered bar, weakly in 2016-26 and clearly before. Pooled over the fourteen index CFDs no overnight study used, the frozen close-to-open long made +0.011R a trade before any cost in 2016-26 (n 36,701, 130 months, month-sum t +2.10, Holm p 0.036) and +0.027R in 2005-15 (n 27,991, twelve markets, t +4.41). It is not a US-only effect: before costs every market but UK100 and CH20 was positive in 2016-26 and all twelve with a replication window were positive there (t +2.0 to +4.5). But two things limit what that means. First, in 2016-26 the pooled gross sits inside the duration-matched random-window placebo (rank 29 of 40; placebo +0.000 / +0.008 / +0.016R): holding these markets long for the same number of hours starting at a random time of day earned nearly as much, so most of the recent gross is the markets' own rise, not a night-specific drift (the month-sum t of +2.10 is above the placebo's 95th percentile of t, +1.84, which rests on a lower spread of monthly sums, not a higher mean). In 2005-15 the night did beat every placebo run (rank 40 of 40). Second, after the frozen cost model the result is a clear loss: -0.025R a trade (t -4.83), every market negative in 2016-26 (UK100 t -7.5, CH20 t -7.7), and still negative at zero financing (spread alone is about 0.022R a trade, twice the gross). The drift is about 0.01-0.03R a night at a one-ATR stop and a 0.03 % round-trip spread takes all of it on every market, as on US500 and NAS100. Net FAIL. Never call this an edge; it is not a council system and nothing live changed. A cheaper route (futures) would need its own pre-registration and, given the 2016-26 placebo, would first have to show the night beats a random hold of the same length.

To repeat: `node --use-env-proxy research/edge/overnight-unused-markets/run.mjs fetch <dir>`, then `node research/edge/overnight-unused-markets/run.mjs full <dir>` (candles kept out of git; the gate also needs index-overnight's `spx500-30m.json.gz` and `nas100-30m.json.gz` in `<dir>`).

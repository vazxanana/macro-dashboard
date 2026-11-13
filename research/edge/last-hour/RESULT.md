# Last hour into the US cash close on a big day: result

**Verdict: FAIL: neither fading nor following a big day into the cash close pays after costs (2016 → now, pooled: fade −0.077R, follow −0.065R a trade).** Fade, pooled 2016 → 2026-11-12: n 2664, −0.077R a trade net of costs, t −5.22 on 131 calendar-month sums (before costs −0.004R); 2010-15 −0.198R (n 1506); placebo 95th percentile −0.088R, beaten by 39 of 40 seeds; Holm p 1.000. Follow, pooled 2016 → 2026-11-12: n 2664, −0.065R a trade net of costs, t −4.33 on 131 calendar-month sums (before costs +0.008R); 2010-15 −0.151R (n 1506); placebo 95th percentile −0.081R, beaten by 39 of 40 seeds; Holm p 1.000.

Pre-registered in `PREREGISTRATION.md` (committed before any figure was computed). Rule: big day = |09:30→15:00 move| > 1.5 x the 20-day median |move|; at 15:00 fade (against) or follow (with) it; stop 0.5 x the day's 09:30-15:00 range; exit 16:00 New York. Costs, round trip in points (spread + 0.5 slippage a side): NAS100 4, SPX500 2, US30 5; no financing (intraday). Data: OANDA mid M5 candles through the candle proxy; NYSE calendar stated in the pre-registration (half days skipped). Not the intraday-momentum study (that one: previous close to 10:00 on every day, traded 15:30-16:00 with it).

## Pass bar, per variant

| variant | net R > 0 (2016 →) | t ≥ 2 (months) | 2010-15 net R > 0 | p (one-sided) | Holm p | Holm < 0.05 | beats placebo 95th pct | pass |
|---|---|---|---|---|---|---|---|---|
| Fade | no (−0.077) | no (−5.22) | no (−0.198) | 1.000 | 1.000 | no | yes (−0.088) | no |
| Follow | no (−0.065) | no (−4.33) | no (−0.151) | 1.000 | 1.000 | no | yes (−0.081) | no |

## Per variant, market and window

| variant | market | window | n | net R a trade | t (months) | t (trades) | gross R | cost R | win | stopped | total net R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Fade | NAS100 | 2010-2015 | 501 | −0.219 | −10.55 | −11.87 | −0.007 | 0.212 | 28.5 % | 15 | −109.7 |
| Fade | NAS100 | 2016 → now | 896 | −0.074 | −4.69 | −5.14 | −0.010 | 0.064 | 41.6 % | 28 | −66.6 |
| Fade | SPX500 | 2010-2015 | 509 | −0.283 | −11.76 | −13.91 | −0.039 | 0.244 | 22.2 % | 22 | −143.9 |
| Fade | SPX500 | 2016 → now | 888 | −0.127 | −6.98 | −7.48 | −0.008 | 0.119 | 37.7 % | 52 | −112.3 |
| Fade | US30 | 2010-2015 | 496 | −0.089 | −4.11 | −4.12 | −0.017 | 0.072 | 43.8 % | 23 | −44.1 |
| Fade | US30 | 2016 → now | 880 | −0.029 | −1.69 | −1.88 | +0.005 | 0.035 | 47.0 % | 44 | −26.0 |
| Fade | pooled | 2010-2015 | 1506 | −0.198 | −11.42 | −16.74 | −0.021 | 0.177 | 31.4 % | 60 | −297.7 |
| Fade | pooled | 2016 → now | 2664 | −0.077 | −5.22 | −8.45 | −0.004 | 0.073 | 42.1 % | 124 | −204.9 |
| Follow | NAS100 | 2010-2015 | 501 | −0.207 | −8.84 | −11.31 | +0.005 | 0.212 | 27.9 % | 10 | −103.7 |
| Follow | NAS100 | 2016 → now | 896 | −0.053 | −3.36 | −3.68 | +0.011 | 0.064 | 43.9 % | 28 | −47.3 |
| Follow | SPX500 | 2010-2015 | 509 | −0.197 | −8.18 | −9.20 | +0.047 | 0.244 | 29.3 % | 13 | −100.5 |
| Follow | SPX500 | 2016 → now | 888 | −0.105 | −5.77 | −6.09 | +0.014 | 0.119 | 39.2 % | 44 | −93.0 |
| Follow | US30 | 2010-2015 | 496 | −0.046 | −1.94 | −2.02 | +0.025 | 0.072 | 43.8 % | 19 | −22.9 |
| Follow | US30 | 2016 → now | 880 | −0.036 | −2.05 | −2.25 | −0.001 | 0.035 | 45.7 % | 42 | −32.0 |
| Follow | pooled | 2010-2015 | 1506 | −0.151 | −7.74 | −12.33 | +0.026 | 0.177 | 33.6 % | 42 | −227.1 |
| Follow | pooled | 2016 → now | 2664 | −0.065 | −4.33 | −7.02 | +0.008 | 0.073 | 42.9 % | 114 | −172.3 |

## Placebo (decisive window)

Per seed and market, as many random eligible days of 2016 → now as the variant has trades there (big or not), same side rule, entry, stop, exit and costs; the statistic is the pooled net R a trade.

| variant | actual | placebo mean | 95th pct (38th of 40) | max | seeds beaten |
|---|---|---|---|---|---|
| Fade | −0.077 | −0.102 | −0.088 | −0.074 | 39 / 40 |
| Follow | −0.065 | −0.096 | −0.081 | −0.063 | 39 / 40 |

## Pooled net R by year (descriptive)

| year | Fade n | Fade net R a trade | Fade total | Follow n | Follow net R a trade | Follow total |
|---|---|---|---|---|---|---|
| 2010 | 242 | −0.187 | −45.3 | 242 | −0.221 | −53.5 |
| 2011 | 260 | −0.155 | −40.4 | 260 | −0.185 | −48.1 |
| 2012 | 242 | −0.261 | −63.1 | 242 | −0.144 | −34.9 |
| 2013 | 245 | −0.256 | −62.6 | 245 | −0.160 | −39.1 |
| 2014 | 260 | −0.185 | −48.1 | 260 | −0.124 | −32.3 |
| 2015 | 257 | −0.149 | −38.2 | 257 | −0.074 | −19.1 |
| 2016 | 250 | −0.063 | −15.8 | 250 | −0.207 | −51.9 |
| 2017 | 250 | −0.196 | −48.9 | 250 | −0.191 | −47.7 |
| 2018 | 264 | −0.197 | −52.0 | 264 | +0.060 | +15.8 |
| 2019 | 237 | −0.012 | −2.8 | 237 | −0.158 | −37.5 |
| 2020 | 253 | −0.084 | −21.4 | 253 | −0.010 | −2.5 |
| 2021 | 264 | −0.029 | −7.6 | 264 | −0.069 | −18.3 |
| 2022 | 224 | −0.107 | −24.0 | 224 | +0.052 | +11.7 |
| 2023 | 226 | −0.115 | −25.9 | 226 | +0.008 | +1.8 |
| 2024 | 253 | +0.009 | +2.3 | 253 | −0.076 | −19.3 |
| 2025 | 231 | −0.025 | −5.8 | 231 | −0.055 | −12.7 |
| 2026 | 212 | −0.015 | −3.1 | 212 | −0.055 | −11.7 |

## Days

- NAS100: 4236 eligible days with a signal after the warm-up (from 1 Oct 2009), 1407 of them big days; 12 days without a 09:30 / 15:00 price or with fewer than 50 of 66 candles, 20 warm-up days, 2 days without a 16:00 price.
- SPX500: 4237 eligible days with a signal after the warm-up (from 1 Oct 2009), 1408 of them big days; 12 days without a 09:30 / 15:00 price or with fewer than 50 of 66 candles, 20 warm-up days, 1 days without a 16:00 price.
- US30: 4236 eligible days with a signal after the warm-up (from 1 Oct 2009), 1388 of them big days; 13 days without a 09:30 / 15:00 price or with fewer than 50 of 66 candles, 20 warm-up days, 1 days without a 16:00 price.

## Reading

No variant met the pre-registered bar. Neither fading nor following a big day into the cash close is an edge on these feeds after costs; no proposal is written and nothing live changes. Never call it an edge.

Post hoc, decides nothing: before costs both variants are within 0.03R of zero (fade −0.021R, t −1.81 / −0.004R, t −0.47; follow +0.026R, t +2.20 / +0.008R, t +0.88, in 2010-15 / 2016 → now, t over trades). The small continuation before costs in 2010-15 did not hold after 2015 and is a fraction of the cost; the net loss is the cost. Both variants beat 39 of 40 placebo seeds only because a big day has a wider 09:30-15:00 range, so a wider stop and a smaller cost in R, than a random day: the placebo's lead is the cost share, not a drift.

To repeat: `node --use-env-proxy research/edge/last-hour/fetch.mjs <dir>`, then `node research/edge/last-hour/run.mjs <dir>`. Test: `tests/last-hour.test.mjs`.

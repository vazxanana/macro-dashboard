# Result: Turnaround Tuesday on the index CFDs neither study used (14 Nov 2026)

**Verdict: DOES NOT REPLICATE: the frozen rule fails #862's bar on the eight index CFDs neither #857 nor #862 used.** On the
equal-risk pool (FR40, NL25, ES35, CH20, AU200, HK33, CN50, SG30), 2016 to 12 Nov 2026, the rule (the week's first local
session closes more than 1 % down → buy that close, sell the next session's close, stop 2 x ATR(20), stated costs and
financing) made **−0.015R a trade net (n 586, trade t −0.91), month-sum t −0.58 over 131 months**: P1 not met. P2 not met
(2 of 8 markets positive, bar 6). P3 not met (the pool beat #862's random down-1 % days in 35 of 40 seeds, bar 38). Before
any cost it made +0.013R a trade (month t 0.51). The Turnaround Tuesday hypothesis (#857 NAS100 R2: +0.098R, t 2.33, n 81)
therefore has no replication on the markets it never saw: #862 (six markets, +0.052R, month t 1.69) and this study (eight
markets, −0.015R, month t −0.58) both miss. **Never call it an edge.** Nothing live changed and no proposal follows.

## Gate: passed exactly
`replicate.mjs` (#862's run file, sha256 `61cb6424…4b18`) on #862's six markets, fetched again with this folder's
`fetch.mjs`: pool 2016-now n 411, +0.052R a trade, trade t 2.63, month-sum t 1.69 (131 months), and every market's n and net R
(US30 55 / +0.018, US2000 93 / +0.061, DE40 64 / +0.054, EU50 74 / +0.024, UK100 50 / +0.036, JP225 75 / +0.103), as
published. `frozen.mjs` (#857's run file, sha256 `74527d36…3871`) and `replicate.mjs` are byte for byte (pinned in the test).

## The unused set
Nine OANDA index CFDs were used by neither study; eight qualified (pre-registered counts: candles from 2017 or earlier, to
October 2026 or later, a cash-close candle on 90 % or more of the local trading days). **IN50 is out**: the proxy serves no
candle after 12 Jul 2022 (closes on 83.6 % of its days).

## Decisive window, 2016 - 12 Nov 2026 (net of the stated costs and financing)

| Market | n | net R a trade | trade t | Holm p | gross R | 2x cost R | won | stopped | worst DD (R) | placebo beaten |
|---|---|---|---|---|---|---|---|---|---|---|
| France 40 (FR40) | 75 | −0.040 | −0.87 | 1.00 | −0.020 | −0.058 | 50.67 % | 5 | −3.92 | 15 of 40 |
| Netherlands 25 (NL25) | 56 | −0.043 | −0.77 | 1.00 | −0.012 | −0.070 | 46.43 % | 2 | −5.36 | 22 of 40 |
| Spain 35 (ES35) | 61 | +0.036 | 0.66 | 1.00 | +0.066 | +0.009 | 60.66 % | 2 | −2.87 | 35 of 40 |
| Switzerland 20 (CH20) | 56 | −0.062 | −0.90 | 1.00 | −0.034 | −0.087 | 48.21 % | 3 | −4.58 | 20 of 40 |
| Australia 200 (AU200) | 47 | −0.017 | −0.23 | 1.00 | +0.011 | −0.040 | 57.45 % | 4 | −5.86 | 28 of 40 |
| Hong Kong 33 (HK33) | 119 | −0.015 | −0.50 | 1.00 | +0.008 | −0.036 | 49.58 % | 3 | −4.54 | 20 of 40 |
| China A50 (CN50) | 96 | +0.025 | 0.80 | 1.00 | +0.054 | −0.001 | 54.17 % | 2 | −3.52 | 36 of 40 |
| Singapore 30 (SG30) | 76 | −0.023 | −0.55 | 1.00 | +0.013 | −0.055 | 46.05 % | 4 | −3.51 | 29 of 40 |
| **Pool (equal risk)** | 586 | **−0.015** | −0.91 | | +0.013 | −0.039 | 51.37 % | 25 | −23.32 | 35 of 40 |

Pool month sums: net −0.066R a month, t **−0.58**; before costs +0.058R, t 0.51; at 2x cost −0.175R, t −1.51 (131 months,
118 with a trade). No market has t above 0.80; Holm over the eight leaves every p at 1.00.

## Replication window, 2008-2015 (reported only)

| Market | n | net R a trade | trade t | gross R |
|---|---|---|---|---|
| France 40 (FR40) | 77 | −0.003 | −0.08 | +0.010 |
| Netherlands 25 (NL25) | 64 | −0.040 | −1.05 | −0.019 |
| Spain 35 (ES35) | 0 | (candles from Dec 2016) | | |
| Switzerland 20 (CH20) | 59 | −0.034 | −0.59 | −0.015 |
| Australia 200 (AU200) | 54 | −0.035 | −0.71 | −0.015 |
| Hong Kong 33 (HK33, 2014-15 only) | 22 | +0.044 | 0.49 | +0.069 |
| China A50 (CN50, from Aug 2011) | 49 | −0.007 | −0.13 | +0.016 |
| Singapore 30 (SG30) | 50 | −0.027 | −0.47 | +0.006 |
| **Pool** | 375 | −0.020 | −1.05 | +0.001 |

Pool month-sum t −0.70 (96 months); worst drawdown −12.97R.

## Placebos
- **P3 (#862's own, judged)**: random local days down more than 1 % (not an entry of the rule), as many per market and year as
  the rule traded: the pool's −0.015R beat the seed's pooled mean in **35 of 40** seeds (median seed −0.032R; bar 38). Not met.
- **Step 5, random weekdays (reported)**: random local trading days that are not the week's first, any direction, same counts,
  hold and exits: the pool beat **39 of 40** seeds (median seed −0.040R). Holding an index CFD for one session from a random
  close loses about the cost and a night's financing; the rule's days lose a little less, but the pool is still below zero
  net and its month-sum t is −0.58, so beating a losing baseline is not evidence of a tradable effect.

## Fisher (as `multiple-testing-update` defines it)
One-sided p = 1 − Φ(t): #857 R2 p 0.0099 (t 2.33), #862 pooled p 0.0455 (month t 1.69), this study p 0.719 (month t −0.58).
- **Calendar-disjoint: none.** #857 read 2008-now; #862's and this study's decisive windows are 2016-now and their 2008-15
  windows are years #857 also read. No combination on years the original never used exists (as `turnaround-early-years`
  found, the years before 2008 are under its floor).
- **All cells (instrument-disjoint, same years: an upper bound only, the markets share the same weeks)**: #857 + #862 + this
  study, χ² 16.07 on 6 df, **p 0.0134** (z 2.21); #857 + this study alone p 0.0423 (z 1.72). Both are far from the family's
  Bonferroni line (1.50e-4 in `multiple-testing-update`), and both overstate the evidence. Adding this study raised the "all
  cells" p from the 0.0039 `multiple-testing-update` listed to 0.0134.

## Departures and notes
- None from the pre-registration in method. Costs for these eight markets are assumed (no measured rate exists in the
  repository); the 2x-cost line is reported and the gross line shows the rule does not carry the effect before costs either
  (pool +0.013R a trade, month t 0.51).
- Local calendars come from the PyPI package `holidays` 0.108 (`holidays.py` → `holidays.json`, committed); Euronext's 24 and
  31 Dec half days are a stated rule. HKEX is defined there from 2014 only, so HK33 has no 2008-13 trades.
- Trades skipped for a missing close or ATR (decisive and replication windows): FR40 9, NL25 10, ES35 2, CH20 4, AU200 7,
  HK33 9, CN50 12, SG30 9 (listed in result.json). The 2008-15 rows are short where the proxy lacks the close candle: AU200
  closes on 525 of 758 days in 2011-13, SG30 on 40 of 252 days in 2008, CN50's candles start 29 Aug 2011.
- The sibling study `rsi2-unused-markets` was not read or touched.

To repeat: `node --use-env-proxy research/edge/turnaround-unused-markets/fetch.mjs <dir>` and
`TU_MARKETS=us30,us2000,de40,eu50,uk100,jp225 node --use-env-proxy research/edge/turnaround-unused-markets/fetch.mjs <dir>`
(candles outside git), then `node research/edge/turnaround-unused-markets/run.mjs <dir>`. Tests:
`tests/turnaround-unused-markets.test.mjs`.

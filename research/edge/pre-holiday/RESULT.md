# Result: the pre-holiday effect on US indices, out of sample (13 Nov 2026)

**Verdict: FAIL** on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). On 2016 to now,
holding one session into the last trading day before an NYSE holiday made +0.023R a holiday, t 1.02 (n 99) pooled over the
three indices after costs and financing (T1 needs t >= 2). The pre-holiday day did rise more than an ordinary day before costs
(+0.140 % against +0.061 %), but not apart from noise (Welch t 1.03), and the rule beat random ordinary days in 30 of 40
placebo seeds (38 needed). T2 (n per market) and T3 (2008-15 the same sign: +0.024R, t 0.78 (n 64)) held; T1, T4 and T5 did
not. All five were required.

| 2016 - Nov 2026, net of costs and financing | n | net R a trade | t | gross R | t gross | net % a trade | won | stopped | Holm p |
|---|---|---|---|---|---|---|---|---|---|
| S&P 500 (SPX500) | 99 | +0.031 | 1.25 | +0.055 | 2.22 | +0.120 | 58.59 % | 1 | 0.3159 |
| Nasdaq 100 (NAS100) | 99 | +0.024 | 0.91 | +0.044 | 1.70 | +0.101 | 63.64 % | 1 | 0.3638 |
| Dow 30 (US30) | 99 | +0.013 | 0.60 | +0.042 | 1.93 | +0.061 | 47.47 % | 0 | 0.3638 |
| **Pooled, one observation a holiday** | 99 | +0.023 | 1.02 | | | | | | |

| 2008 - 2015 (replication, judged on sign) | n | net R a trade | t | gross R | t gross | net % a trade |
|---|---|---|---|---|---|---|
| S&P 500 (SPX500) | 64 | +0.019 | 0.57 | +0.036 | 1.11 | +0.068 |
| Nasdaq 100 (NAS100) | 64 | +0.041 | 1.31 | +0.060 | 1.90 | +0.144 |
| Dow 30 (US30) | 64 | +0.014 | 0.40 | +0.037 | 1.08 | +0.029 |
| **Pooled** | 64 | +0.024 | 0.78 | | | |

- **Checks**: T1 pooled net R t >= 2: not met (+0.023R a holiday, t 1.02 (n 99)). T2 at least 80 trades a market: met (99
  each). T3 2008-15 positive: met (+0.024R, t 0.78 (n 64)). T4 pre-holiday days against ordinary days (pooled daily % before
  costs): not met (+0.140 % against +0.061 % on 2,531 ordinary days, difference +0.080 %, Welch t 1.03; 2008-15 +0.145 % against
  +0.025 %, Welch t 0.91 on that window). T5 placebo: not met (above 30 of 40 seeds; the placebo median is -0.004R).
- **No per-market claim**: no market reaches t 2 net (SPX500 t 1.25, Holm p 0.32). Before costs the S&P 500 day is just over
  t 2 (gross +0.055R, t 2.22), so the published sign is still there, small; the spread and one night of financing (about
  0.055-0.065 % of price a trade, about 0.02-0.03R) take more than half of it, and after them nothing is apart from luck.
- **The pre-holiday day is about one and a half to two ordinary days** on these CFDs since 2016 (+0.14 % against +0.06 %),
  far from the "several times" of the papers' samples, and the Welch test cannot tell it from an ordinary day.
- **By holiday** (pooled net R, 2016-now, about 10 each; descriptive, not tested, chosen after the fact so never a filter):
  Memorial Day +0.115 (t 1.67), Independence Day +0.103 (t 1.86), Labor Day -0.111, New Year's Day -0.113; the rest within
  +/-0.09.
- **Data**: OANDA mid H1 SPX500_USD, NAS100_USD, US30_USD, October 2007 to 12 November 2026 (about 114,000 candles each,
  `fetch.mjs`, kept out of git). The close is the H1 candle ending 16:00 New York (13:00 on a half day), not the UTC daily
  candle (which closes at 19:00 / 20:00 New York and would include after-hours trading). The OANDA files have no candle at
  16:00 New York on 31 December 2012-2015, so 8 trades a market are skipped and counted (`skipped` in result.json: those four
  New Year trades and the four MLK Day trades whose ATR needed that day). Costs 0.04 / 0.05 / 0.05 % a round trip; financing
  = weekly FRED DGS2 (`rates.json`, from council-data) + 2.5 % a year per calendar night (three over a weekend).
- **What this does not test**: the cash index or futures (the CFD tracks the future; the 16:00 close is a proxy), the day after
  a holiday, a short side, or any holiday subset.

Nothing live changed and no proposal is written. To repeat: `node --use-env-proxy research/edge/pre-holiday/fetch.mjs <dir>`,
then `node research/edge/pre-holiday/run.mjs <dir>`. Tests: `tests/pre-holiday.test.mjs`.

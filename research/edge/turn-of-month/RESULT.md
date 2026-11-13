# Result: the turn-of-the-month effect on US indices, out of sample (13 Nov 2026)

**Verdict: FAIL**, 0 of 3 markets, on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). On
2016 to now the published window (buy at the New York close of the month's second-to-last trading day, sell at the close of
the next month's third) made nothing on the S&P 500 after costs: -0.015 % a trade, t -0.10 (n 129). It did not beat random
four-day windows (above the placebo mean in 15 of 40 seeds; 38 needed), and the turn days' own returns were no higher than the
other days' (+0.006 % a day, Welch t 0.11).

| 2016 - Oct 2026, net of costs and financing | n | net % a trade | t | gross % a trade | won | stopped | placebo seeds beaten | turn days minus rest (% a day, Welch t) | Holm p |
|---|---|---|---|---|---|---|---|---|---|
| S&P 500 (SPX500), primary | 129 | -0.015 | -0.10 | +0.102 | 52.71 % | 23 | 15 of 40 | +0.006, t 0.11 | 1 |
| Dow 30 (US30) | 129 | -0.022 | -0.14 | +0.107 | 53.49 % | 17 | 17 of 40 | +0.009, t 0.17 | 1 |
| Nasdaq 100 (NAS100) | 129 | +0.260 | 1.24 | +0.389 | 56.59 % | 19 | 34 of 40 | +0.011, t 0.17 | 0.3225 |

| 2008 - 2015 (reported, not judged) | n | net % a trade | t | gross % a trade | turn days minus rest (% a day, Welch t) |
|---|---|---|---|---|---|
| S&P 500 (SPX500) | 93 | -0.113 | -0.42 | -0.021 | +0.000, t 0.01 |
| Dow 30 (US30) | 93 | -0.193 | -0.81 | -0.091 | -0.023, t -0.33 |
| Nasdaq 100 (NAS100) | 93 | +0.143 | 0.53 | +0.245 | +0.012, t 0.14 |

- **Checks on SPX500**: T1 net return t >= 2: not met (t -0.10). T2 placebo, 38 of 40 seeds: not met (15; the placebo
  median is +0.033 % a trade, above the rule's -0.015 %). T3 turn days against the rest, Welch t >= 2: not met (t 0.11).
  Holm-adjusted p 1. All three were required.
- **The turn days are ordinary days on these CFDs**: on 2016-now a turn day (TD-1, TD+1 to TD+3) averaged +0.060 % on the
  S&P 500 against +0.054 % on the other 2,209 days; 2008-15 the same (+0.026 % against +0.025 %). What the window earns before
  costs is about four ordinary up-drifting days, and costs (0.04 % a round trip) and financing (about 0.08 % a trade) take it.
- **NAS100** is the only positive stream (+0.26 % a trade, t 1.24) and beat 34 of 40 placebo seeds, but its turn days were no
  better than its other days (Welch t 0.17): that is the Nasdaq's own drift over four days, not a calendar effect. It is not a
  finding: it is the third market and fails T1, T2 and T3.
- **By year** (SPX500 net % a trade, 2016-2026): +0.007, +0.291, -0.082, +0.293, +0.068, -0.401, -0.657, +0.192, -0.227,
  -0.264, +0.737. No run of years carries the effect.
- **Data**: OANDA mid H1 SPX500_USD, US30_USD and NAS100_USD, October 2007 to 12 November 2026 (about 114,000 candles each),
  through the site's candle proxy (`fetch.mjs`, kept out of git); the close is the H1 candle ending at 16:00 New York (13:00 on
  a half day), daylight saving read in New York time. The OANDA files have no candle at 16:00 New York on 31 December 2012,
  2013, 2014 and 2015, so the January trades of 2013-2016 (entries 30 / 29 / 28 January) have no ATR and are skipped and
  counted (`skipped` in result.json), as the pre-registration says. Costs 0.04 / 0.05 / 0.05 % a round trip; financing = the
  weekly 2-year yield (`rates.json`, FRED DGS2 from council-data) + 2.5 % a year, per calendar night.
- **What this does not test**: the cash index or futures (a CFD tracks the future, which closes at 17:00 New York; the cash
  close is a proxy), other turn windows (-1 to +3 was fixed in advance, as published), or a short-side complement.

Nothing live changed and no proposal is written. To repeat: `node --use-env-proxy research/edge/turn-of-month/fetch.mjs <dir>`,
then `node research/edge/turn-of-month/run.mjs <dir>`. Tests: `tests/turn-of-month.test.mjs`.

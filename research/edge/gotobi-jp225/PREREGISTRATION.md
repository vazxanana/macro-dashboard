# Gotobi on the Nikkei: the fade after the 09:55 Tokyo fix, moved to JP225 (pre-registration)

Written and pushed on 14 Nov 2026 after the JP225 candles were fetched and their COVERAGE counted (candle counts only, table
below), and before any return, trade or move of JP225 was computed. Nothing below may change after the first result; anything
found later is reported as found later, never folded into the verdict.

## Why

The gotobi fade (`gotobi`, #878 T2: sell USD/JPY at the 09:55 Tokyo fix on gotobi days, buy back at 15:00 Tokyo; replicated on
yen crosses and on 2005-09 USD/JPY in `gotobi-replicate`; robustness in `gotobi-feed`, `gotobi-timing`,
`gotobi-minute-histdata`, `gotobi-limit-entry`, `gotobi-cost`) is the one hypothesis left standing by the multiple-testing
ledger (`multiple-testing-update`). The proposed mechanism is Japanese importers' dollar buying into the 09:55 fix on gotobi
days, which lifts USD/JPY into the fix and lets it fall back after. If that flow moves the yen, the Nikkei, priced in yen and
positively linked to USD/JPY intraday (a weaker yen goes with a higher Nikkei), may show the same pattern on gotobi days. This
is a test of the mechanism on a new asset, not a re-test of USD/JPY.

## The frozen rule

`frozen.mjs` in this folder is a byte-for-byte copy of `research/edge/gotobi/run.mjs` at commit `5f341e069` of branch `gotobi`
(sha256 `645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32`, pinned in `tests/gotobi-jp225.test.mjs`; the same
file and pin as `gotobi-replicate`). `run.mjs` imports from it and changes nothing of the rule: the Tokyo calendar and the gotobi
days (5th, 10th, 15th, 20th, 25th and the last Tokyo business day of the month, each rolled back to the previous Tokyo business
day), the fade leg's times (entry at the open of the M5 candle starting **00:55 UTC** = 09:55 Tokyo; exit at the open of the
candle starting **06:00 UTC** = 15:00 Tokyo, falling back to the close of a candle at most 15 minutes earlier), the stop
(D = 1.5 x the median absolute move of the same window over the 20 Tokyo business days strictly before, at least 15 of them
with data; the stop is entry + D for the sell), stop-first management with gap fills, no target, R, the month t, the seeded
mulberry32 draw and the placebo rank (38th of 40). It uses the frozen `trade`, `stopDist`, `windowMove`, `legTimes`,
`entryPx`, `exitPx`, `index`, `gotobiSet`, `isTokyoBusinessDay`, `summary`, `monthT` and `draw` as they are.

## The side (fixed before any return)

T2 SELLS USD/JPY after the fix: the fix flow has pushed USD/JPY up (the yen weaker) and it falls back after. USD/JPY up = yen
weaker = Nikkei up (the positive USD/JPY-to-Nikkei link), so the same fall-back after the fix means the Nikkei falls back too.
**T2's USD/JPY side maps to the same side on JP225: a SELL at 00:55 UTC, bought back at 06:00 UTC** (`MAP_SIGN = +1`; the
frozen fade leg's side, -1, is used unchanged). The secondary correlation below checks the sign of the link on these windows;
it does not change the side.

## Market, data and coverage

- Market: OANDA `jp225` (JP225_USD, the Nikkei 225 CFD quoted in index points, P&L in USD; not converted at the FX rate), mid
  M5 candles through the site's keyless proxy `/md/bars` (`fetch.mjs`, the gotobi branch's pattern: pages of 4,999 candles,
  paced; only candles starting 00:00-06:55 UTC kept; outside git). The earliest candle served is 12 Apr 2010; last whole day on
  file 11 Nov 2026.
- **Coverage, counted before any return** (a year counts when at least 90 % of its Tokyo business days have both the 00:55 entry
  candle and an exit price under the frozen rule, AND at least 80 % of the 61 five-minute slots 00:55-05:55 are present):

| Year | Tokyo business days | Entry and exit | Day share | Slot share | Covered |
|---|---|---|---|---|---|
| 2010 (from 12 Apr) | 245 | 74 | 30.2 % | 24.2 % | no |
| 2011 | 245 | 89 | 36.3 % | 29.5 % | no |
| 2012 | 248 | 211 | 85.1 % | 81.8 % | no |
| 2013 | 245 | 241 | 98.4 % | 98.3 % | yes |
| 2014 | 244 | 241 | 98.8 % | 97.4 % | yes |
| 2015 | 244 | 243 | 99.6 % | 98.8 % | yes |
| 2016 | 245 | 243 | 99.2 % | 98.9 % | yes |
| 2017 | 247 | 245 | 99.2 % | 96.8 % | yes |
| 2018 | 245 | 243 | 99.2 % | 98.5 % | yes |
| 2019 | 241 | 236 | 97.9 % | 96.8 % | yes |
| 2020 | 243 | 241 | 99.2 % | 99.0 % | yes |
| 2021 | 245 | 244 | 99.6 % | 99.6 % | yes |
| 2022 | 244 | 241 | 98.8 % | 99.1 % | yes |
| 2023 | 246 | 245 | 99.6 % | 99.5 % | yes |
| 2024 | 245 | 243 | 99.2 % | 99.2 % | yes |
| 2025 | 243 | 240 | 98.8 % | 98.9 % | yes |
| 2026 (to 11 Nov) | 208 | 208 | 100 % | 100 % | yes |

  2010-12 are dropped (the Tokyo morning is thin or missing; 2012 fills in from March but misses the year rule).
- **Decisive window: 2016-01-01 to 2026-11-11. Replication window: 2013-01-01 to 2015-12-31** (the covered years before 2016;
  about three years, so about 200 trades: a weak replication, said here before the result). Trades of 2013 whose 20-day lookback
  reaches into 2012 use 2012's candles where they exist (the frozen 15-of-20 rule decides).

## Cost

JP225 round trip **0.04 % of the entry price** (about 18 index points at 45,000: OANDA's typical daytime spread of about 8
points plus one Osaka mini tick of 5 points each way, the figure fixed in `open-run-breadth-2`), assumed, not measured; scaled
by price so a 2010s level of about 15,000-20,000 pays proportionally. Net R = R - 0.0004 x entry / D. Intraday, no financing
(the position is never held over a rollover). Every trade has its stop.

## Primary test and the bar

One test: the fade above on gotobi days. It **PASSES** only if all of these hold:

1. Decisive window: net R a trade > 0.
2. Decisive window: t >= 2 on calendar-month sums of net R (the frozen `monthT`).
3. Replication window: net R a trade > 0.
4. Decisive window: net R a trade > 0 at twice the cost (gross R - 2 x cost R).
5. Placebo: 40 seeds (1-40, frozen `draw`), each draws as many non-gotobi covered Tokyo business days of the decisive window
   (on which the leg can be computed) as the test has decisive trades, runs the identical trade, and records net R a trade; the
   test's net R a trade must be above the 38th of the 40 sorted from lowest (the 95th percentile).

One test, so no Holm inside the study (it is one more line for the multiple-testing ledger).

**Verdict**: PASS if all five hold; FAIL if the decisive window has at least 300 trades and any condition fails; NOT
MEASURABLE (with "(inconclusive: …)" giving the reason) if the decisive window has fewer than 300 trades. A PASS would be a
proposal for the owner and evidence for the mechanism, never a live rule; nothing live changes here.

## Secondary (reported, not conditions)

- **S1, the plain move**: JP225's move from the 00:55 UTC open to the 06:00 UTC price (frozen price rules), in basis points of
  the entry price, on gotobi days against every other covered Tokyo business day, difference and Welch t, decisive and
  replication windows. The mechanism predicts a more negative gotobi mean.
- **S2, the link**: the Pearson correlation, day by day, of the JP225 and USD/JPY moves over the same window (same price rules;
  USD/JPY from the OANDA M5 file of the `gotobi` study), on all covered business days and on gotobi days, decisive and
  replication windows.
- Also reported: gross R, cost R, stop-out share, median stop as a % of price, by year, every non-gotobi day's result, the
  placebo values, the days lost to missing candles.

# Mosha cycle (`mcycle`) on untouched gold history, 2007-2019: result (14 Nov 2026)

**Verdict: FAIL: live Mosha cycle on untouched gold 2007-19, −0.175R a trade net (n 244, t −1.50), 0 of 3 tests pass; placebo beaten 17 of 40.**

Paper research only. No live rule, size, filter, stop, config, baseline or council file was changed; nothing was written to
the Mosha desk. The rule, data, windows, costs, tests, placebo and bar were fixed in `PREREGISTRATION.md` (committed alone,
before any run). A backtest is not a forward record, and this one is not an edge.

## What was run

The live code, imported and unchanged: `council/mosha-cycle.mjs` `cycleTrades` / `cycleBlockers` on BO events from
`council/engine.mjs` `msAnalyze(bars, 6)` over the last 719 closed candles of H4, H1, M15 and M5 (H4 / H1 / M15 built
from M5 in UTC buckets), decided at every M5 close; managed with `council/fills.mjs` `manageLive` on M5 (stop first when one
candle holds both; `spotSkip` candles skipped; fill-and-target candles missed); valid 24 h, out 72 h after the fill;
$0.60 a round trip plus overnight financing on buys (`financing`, today's `FIN` for every year). Signals with a
blocker (room / cap / price) are shadows and are excluded. Candles: OANDA mid XAU/USD M5 2006-06-01 00:00 to 2026-11-13 21:55
(1459980 candles). Windows by exit time; t on calendar-month sums, every month counted.

## The three tests (decisive window 2007-19, Holm over 3)

| Test | n | R a trade gross / net | t (months) | Holm p | 2020-26 net | 2x costs | Placebo beaten | Result |
|---|---|---|---|---|---|---|---|---|
| T1 leg pull (trade the pullback, target the H4 50 %) | 81 | +0.004 / −0.194 | −0.84 | 1 | −0.803 | −0.392 | 16 of 40 (median t −0.70) | FAIL |
| T2 leg main (back with the H4, target the H4 extreme) | 163 | −0.004 / −0.165 | −1.12 | 1 | −0.502 | −0.327 | 16 of 40 (median t −0.80) | FAIL |
| T3 both legs (the system as it trades) | 244 | −0.001 / −0.175 | −1.50 | 1 | −0.615 | −0.348 | 17 of 40 (median t −1.26) | FAIL |

## T3: both legs (the system as it trades)

| | Trades | Win rate | R a trade | Total R | t (months) | Profit factor | Worst drawdown R |
|---|---|---|---|---|---|---|---|
| 2007-19 net (decisive) | 244 | 26.6 % | −0.175 | −42.59 | −1.50 | 0.79 | 48.46 |
| 2007-19 before costs | 244 | 27.5 % | −0.001 | −0.24 | −0.01 | 1 | 36.07 |
| 2007-19 at 2x costs | 244 | 25.4 % | −0.348 | −84.94 | −2.93 | 0.64 | 87.29 |
| 2020-23 net | 64 | 17.2 % | −0.579 | −37.07 | −2.77 | 0.36 | 37.07 |
| 2020-23 before costs | 64 | 18.8 % | −0.452 | −28.93 | −2.28 | 0.43 | 28.93 |
| 2024-Oct 2026 net | 50 | 14.0 % | −0.661 | −33.07 | −3.25 | 0.27 | 33.07 |
| 2024-Oct 2026 before costs | 50 | 14.0 % | −0.584 | −29.19 | −3.00 | 0.31 | 29.19 |
| 2020-Oct 2026 net | 114 | 15.8 % | −0.615 | −70.14 | −4.19 | 0.32 | 70.14 |

## T1: leg `pull`

| | Trades | Win rate | R a trade | Total R | t (months) | Profit factor | Worst drawdown R |
|---|---|---|---|---|---|---|---|
| 2007-19 net (decisive) | 81 | 25.9 % | −0.194 | −15.68 | −0.84 | 0.78 | 23.5 |
| 2007-19 before costs | 81 | 27.2 % | +0.004 | +0.35 | +0.02 | 1.01 | 11.24 |
| 2007-19 at 2x costs | 81 | 24.7 % | −0.392 | −31.71 | −1.64 | 0.62 | 37.03 |
| 2020-23 net | 24 | 20.8 % | −0.590 | −14.15 | −2.94 | 0.29 | 15.14 |
| 2020-23 before costs | 24 | 25.0 % | −0.462 | −11.09 | −2.50 | 0.37 | 12.14 |
| 2024-Oct 2026 net | 19 | 0.0 % | −1.072 | −20.37 | −3.95 | 0 | 20.37 |
| 2024-Oct 2026 before costs | 19 | 0.0 % | −1.003 | −19.05 | −3.95 | 0 | 19.05 |
| 2020-Oct 2026 net | 43 | 11.6 % | −0.803 | −34.52 | −4.84 | 0.15 | 35.5 |

## T2: leg `main`

| | Trades | Win rate | R a trade | Total R | t (months) | Profit factor | Worst drawdown R |
|---|---|---|---|---|---|---|---|
| 2007-19 net (decisive) | 163 | 27.0 % | −0.165 | −26.91 | −1.12 | 0.8 | 38.77 |
| 2007-19 before costs | 163 | 27.6 % | −0.004 | −0.59 | −0.02 | 0.99 | 29.71 |
| 2007-19 at 2x costs | 163 | 25.8 % | −0.327 | −53.23 | −2.20 | 0.66 | 59.36 |
| 2020-23 net | 40 | 15.0 % | −0.573 | −22.92 | −2.15 | 0.39 | 22.92 |
| 2020-23 before costs | 40 | 15.0 % | −0.446 | −17.84 | −1.72 | 0.47 | 17.84 |
| 2024-Oct 2026 net | 31 | 22.6 % | −0.410 | −12.70 | −1.84 | 0.49 | 17.57 |
| 2024-Oct 2026 before costs | 31 | 22.6 % | −0.327 | −10.14 | −1.47 | 0.56 | 16.26 |
| 2020-Oct 2026 net | 71 | 18.3 % | −0.502 | −35.62 | −2.82 | 0.43 | 35.62 |

## Each year (both legs, after costs)

| Year | Trades | pull | main | R a trade | Total R |
|---|---|---|---|---|---|
| 2007 | 17 | 6 | 11 | −1.176 | −19.99 |
| 2008 | 22 | 6 | 16 | +0.893 | +19.64 |
| 2009 | 23 | 6 | 17 | −0.744 | −17.10 |
| 2010 | 30 | 13 | 17 | −0.562 | −16.86 |
| 2011 | 14 | 4 | 10 | −0.117 | −1.64 |
| 2012 | 21 | 6 | 15 | −0.126 | −2.65 |
| 2013 | 15 | 5 | 10 | −0.249 | −3.73 |
| 2014 | 14 | 2 | 12 | +0.393 | +5.50 |
| 2015 | 15 | 4 | 11 | +0.154 | +2.31 |
| 2016 | 17 | 8 | 9 | +0.290 | +4.93 |
| 2017 | 29 | 12 | 17 | −0.027 | −0.79 |
| 2018 | 13 | 5 | 8 | −0.502 | −6.52 |
| 2019 | 14 | 4 | 10 | −0.406 | −5.68 |
| 2020 | 14 | 5 | 9 | −0.354 | −4.96 |
| 2021 | 13 | 7 | 6 | −0.540 | −7.02 |
| 2022 | 19 | 6 | 13 | −0.700 | −13.31 |
| 2023 | 18 | 6 | 12 | −0.655 | −11.79 |
| 2024 | 18 | 8 | 10 | −0.472 | −8.50 |
| 2025 | 20 | 6 | 14 | −0.597 | −11.94 |
| 2026 | 12 | 5 | 7 | −1.052 | −12.62 |

## Signals

- 2007-19: 449 fresh signals; 258 with no blocker (loss 177, win 67, expired 6, missed 8); shadows excluded: room 191.
- 2007-Oct 2026: 643 fresh signals; 380 with no blocker (loss 272, win 86, expired 11, missed 11); shadows excluded: room 263.

## Placebo

Each test's real trades of 2007-19, same side, opening risk and reward:risk, moved to a random M5 moment of the same year and
entered at market (40 seeds). Real t against the 40 placebo t's: T1 beats 16 (placebo t −3.15 to +1.20),
T2 beats 16 (−5.70 to +1.65), T3 beats 17 (−4.10 to +1.04). Pass needs 38.

## Reading

On the window the rule never saw, the cycle made −0.175R a trade after costs (−0.001R before any cost) over 244 trades, t −1.50; on 2020-Oct 2026 −0.615R (n 114). The pullback leg −0.194R (n 81), the main leg −0.165R (n 163).
This is the honest baseline for the cycle's forward record: `positions.json` holds one row per live filled trade 2007-Oct 2026,
`[signal, fill, exit, netR, side, leg]` (unix seconds; net R after $0.60 and financing; +1 buy / -1 sell). It agrees in sign
with `mcycle-base` (2020-26, $0.30, OANDA H4 / H1 / M15 fetched directly: −0.574R, n 115), which this study's 2020-26 rows
re-measure at the brief's $0.60 with candles built from M5. Never quote the cycle as an edge.

## Limits

- M5 fills, not the Trader's 1-minute candles: a candle holding both stop and target is a loss here.
- H4 / H1 / M15 built from M5 in UTC buckets; OANDA's own candles of those timeframes can differ by a print.
- Financing at today's rate for every year (the broker's past rates are not known).
- To repeat: `node --use-env-proxy research/edge/mosha-sweep/run.mjs fetch <dir>`, then `node research/edge/mcycle-oos/run.mjs run <dir>/xau-5m.json.gz`.

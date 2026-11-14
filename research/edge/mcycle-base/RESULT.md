# Mosha cycle (`mcycle`), the live rule's own backtest: result (13 Nov 2026)

**Verdict: FAIL: the live Mosha cycle rule, run as the Trader runs it, made −0.574R a trade after costs over 115 trades on spot gold from 2020 (t −3.99 on 82 calendar-month sums); in sample −0.523R (n 64), out of sample −0.638R (n 51); worst drawdown 66.04R.**

Paper research only. No live rule, size, filter, stop, config, baseline or council file was changed. The rule, data, costs
and pass bar were fixed in `PREREGISTRATION.md` (committed alone, before any candle was read). Pass bar: the combined live
stream net of costs above 0 in both halves AND t >= 2 on calendar-month sums over the whole window. It is not met.
A backtest is not a forward record, and this one is not an edge.

## What was run

The live code, imported and unchanged: `council/mosha-cycle.mjs` `cycleTrades` / `cycleBlockers` on BO events from
`council/engine.mjs` `msAnalyze(bars, 6)` over the last 719 closed OANDA candles of H4, H1, M15 and M5 (the Trader's
720-candle reads less the forming candle), decided at every M5 close; managed with `council/fills.mjs` `manageLive` on M5
(stop first when one candle holds both; spot-shut and rollover candles skipped; fill-and-target candles missed); valid 24 h,
out 72 h after the fill; $0.30 a round trip plus overnight financing on buys (`financing`, today's `FIN` for
every year). Candles: OANDA mid XAU/USD 2019-12-01 23:00 to 2026-11-12 23:55 (M5 492947, M15
165327, H1 42112, H4 11922). Halves by exit time; months 82.

## Combined live stream (both legs)

| | Trades | Win rate | R a trade | Total R | t (months) | Profit factor | Worst drawdown R |
|---|---|---|---|---|---|---|---|
| 2020 to end | 115 | 16.5 % | −0.574 | −66.04 | −3.99 | 0.34 | 66.04 |
| In sample 2020-23 | 64 | 18.8 % | −0.523 | −33.49 | −2.58 | 0.39 | 33.49 |
| Out of sample 2024 on | 51 | 13.7 % | −0.638 | −32.55 | −3.16 | 0.28 | 32.55 |
| Before costs | 115 | 16.5 % | −0.514 | −59.12 | −3.65 | 0.37 | 59.12 |
| Twice the cost | 115 | 15.7 % | −0.619 | −71.20 | −4.19 | 0.32 | 71.2 |

## Leg `pull` (trade the pullback, target the H4 50 %)

| | Trades | Win rate | R a trade | Total R | t (months) | Profit factor | Worst drawdown R |
|---|---|---|---|---|---|---|---|
| 2020 to end | 43 | 14.0 % | −0.756 | −32.50 | −4.72 | 0.16 | 33.5 |
| In sample 2020-23 | 24 | 25.0 % | −0.532 | −12.77 | −2.77 | 0.32 | 13.77 |
| Out of sample 2024 on | 19 | 0.0 % | −1.039 | −19.73 | −3.96 | 0 | 19.73 |
| Before costs | 43 | 14.0 % | −0.701 | −30.14 | −4.52 | 0.18 | 31.19 |
| Twice the cost | 43 | 11.6 % | −0.803 | −34.52 | −4.84 | 0.15 | 35.5 |

## Leg `main` (the ChoCh back with the H4, target the H4 extreme)

| | Trades | Win rate | R a trade | Total R | t (months) | Profit factor | Worst drawdown R |
|---|---|---|---|---|---|---|---|
| 2020 to end | 72 | 18.1 % | −0.466 | −33.53 | −2.61 | 0.45 | 33.53 |
| In sample 2020-23 | 40 | 15.0 % | −0.518 | −20.71 | −1.99 | 0.42 | 20.71 |
| Out of sample 2024 on | 32 | 21.9 % | −0.401 | −12.82 | −1.71 | 0.49 | 18.15 |
| Before costs | 72 | 18.1 % | −0.403 | −28.98 | −2.26 | 0.5 | 28.98 |
| Twice the cost | 72 | 18.1 % | −0.509 | −36.68 | −2.82 | 0.42 | 36.68 |

## Each year (combined, after costs)

| Year | Trades | R a trade | Total R |
|---|---|---|---|
| 2020 | 14 | −0.317 | −4.43 |
| 2021 | 13 | −0.49 | −6.37 |
| 2022 | 19 | −0.643 | −12.21 |
| 2023 | 18 | −0.582 | −10.47 |
| 2024 | 18 | −0.435 | −7.84 |
| 2025 | 20 | −0.568 | −11.37 |
| 2026 | 13 | −1.027 | −13.35 |

## Signals

196 fresh cycle signals were recorded; 123 with no blocker (the live stream: loss 96, win 19, missed 3, expired 5),
73 shadows. Shadows by blocker, descriptive only (after costs, filled ones):

| Blocker | Signals | Filled | R a trade |
|---|---|---|---|
| room | 73 | 68 | +0.024 |

## Reading

Both legs lose in both halves: the pullback leg −0.756R a trade (n 43), the main leg −0.466R (n 72). Before any cost the combined stream is −0.514R a trade, so the loss is the rule, not the cost.
Only the signals the live code takes count here; the 73 signals it records as shadows for want of room
(target under 1R, traded at 2R) are shown above for completeness and are not part of the test. This agrees in sign with
the earlier mechanical readings of the owner's cycle (`mosha-retrace`, `mosha-cycle`), which were different rules.

## How it could be wired (not done here)

`positions.json` holds one row per filled live trade, `[t, o, c, R, side, leg]` (signal, fill, exit in unix seconds; net R
after $0.30 and financing; +1 buy / -1 sell). A later, owner-approved change could add an `mcycle` entry to
`council/decay.mjs` `SYSTEMS` built from these rows by `research/edge/decay-monitor/run.mjs` (its baseline, drawdown
band) and a block in `research/edge/expectations/build.mjs` for "What to expect", and then drop `MS_NO_BASE` for it. Note
that the whole window 2020-26 is the window the rule was written on by eye (the owner's cycle of Nov 2026), so these
figures are in sample for the rule as a whole; the IS / OOS split separates time, not the rule's design.

## Limits

- M5 fills, not the Trader's 1-minute candles: a candle holding both stop and target is a loss here.
- The Trader runs about every minute; here a decision at every M5 close. Signals are only taken while fresh (1 h), as live.
- Financing at today's rate for every year (the broker's past rates are not known).
- To repeat: `node --use-env-proxy research/edge/mcycle-base/run.mjs fetch <dir>`, then `node research/edge/mcycle-base/run.mjs run <dir>`.

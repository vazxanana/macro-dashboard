# Gold volatility squeeze breakout: result (14 Nov 2026)

**Verdict: FAIL, 0 of 3 tests pass: the H4 squeeze release lost out of sample (2021-now −0.086R a trade net, n 108, month t −0.58), D1 and the slope filter lost too.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any candle was fetched). A new stand-alone rule, not a gate, exit,
entry or size of the gold book (docs/owner-decisions.md item 44); nothing of that book was read. Paper research only: nothing
live changed and no proposal is written.

## Rule (as pre-registered)

- Spot gold, OANDA mid XAU/USD through the candle proxy, H4 (18,331 candles) and D1 (2,975 trading days, weekend stubs folded),
  June 2015 (warm-up) to 13 Nov 2026.
- Squeeze: Bollinger 20 / 2 (population sd) inside Keltner 20 / 1.5 × ATR(20) on the same SMA(20) middle line, 6+ candles in a
  row. Release: the first close above the upper / below the lower Bollinger band within 5 candles of the run's last candle.
- Market entry at the next open in that direction; stop 1.5 × ATR(20) (every trade has it); out on a close back through the
  middle line (next open), at the stop (gap at the open), or after 30 H4 / 20 D1 candles. One position at a time.
- Costs: $0.30 spread + $0.15 slippage in + $0.15 out ($0.60 a trade), financing on buys `nights` × `FIN.xau.long` (0.000148 a
  rollover, demo broker swap of 11 Nov 2026) × entry / risk. 2× costs doubles all three.

## Results

| Test | Window | n | Gross R | Net R | Net at 2× | Win % | Total net R | Worst DD R | t net (months) | t gross |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 H4 (primary) | IS 2016-20 | 95 | +0.353 | +0.230 | +0.106 | 36.8 | +21.83 | −11.96 | 1.15 | 1.72 |
| T1 H4 (primary) | OOS 2021-now | 108 | −0.016 | −0.086 | −0.157 | 26.9 | −9.33 | −15.83 | −0.58 | −0.10 |
| T2 D1 | IS 2016-20 | 15 | −0.091 | −0.190 | −0.289 | 26.7 | −2.85 | −3.55 | −0.56 | −0.26 |
| T2 D1 | OOS 2021-now | 17 | −0.391 | −0.479 | −0.567 | 23.5 | −8.14 | −11.54 | −1.81 | −1.49 |
| T3 H4 with SMA(50) slope | IS 2016-20 | 54 | +0.409 | +0.284 | +0.158 | 38.9 | +15.31 | −5.83 | 1.03 | 1.44 |
| T3 H4 with SMA(50) slope | OOS 2021-now | 68 | −0.158 | −0.231 | −0.304 | 25.0 | −15.70 | −18.96 | −1.31 | −0.89 |

## The pre-registered checks

| Test | OOS t ≥ 2 and Holm | IS net > 0 | OOS net > 0 at 2× | OOS net > placebo p95 | Holm-adjusted p | Pass |
|---|---|---|---|---|---|---|
| T1 | no (t −0.58) | yes | no | no | 1.000 | no |
| T2 | no (t −1.81) | no | no | no | 1.000 | no |
| T3 | no (t −1.31) | yes | no | no | 1.000 | no |

## Placebo (OOS, 40 seeds: random candle, same side, 1.5 ATR stop, same hold)

| Test | Real net R a trade | Placebo median | Placebo 95th percentile | Min / max |
|---|---|---|---|---|
| T1 | −0.086 | −0.017 | +0.295 | −0.290 / +0.353 |
| T2 | −0.479 | +0.014 | +0.670 | −0.477 / +0.787 |
| T3 | −0.231 | +0.024 | +0.315 | −0.370 / +0.319 |

Every real stream sits below the placebo's median: entering at a random candle with the same side and hold did as well or better.

## Reading

- The H4 release looked good in 2016-20 (+0.23R net, t 1.15) and did not repeat in 2021-now (−0.09R; years alternate: +1.2R,
  −5.4R, +5.2R, −10.4R, +4.6R, −4.5R). Out of sample, buys made +0.076R (n 55) and sells −0.255R (n 53): the buys' small plus
  is gold's 2021-26 rise, not the squeeze (the slope-aligned T3 is worse, not better).
- The daily version fires about three times a year and lost in both windows.
- Costs are not the reason: OOS gross is −0.016R (T1), −0.391R (T2), −0.158R (T3).
- Not an edge, never a filter or a council rule; no follow-up proposed (a tuned band, run length or exit would be chosen after
  seeing this result).

To repeat: `node --use-env-proxy research/edge/gold-squeeze/fetch.mjs <dir>` (candles outside git), then
`node research/edge/gold-squeeze/run.mjs <dir>`. Tests: `tests/gold-squeeze.test.mjs`.

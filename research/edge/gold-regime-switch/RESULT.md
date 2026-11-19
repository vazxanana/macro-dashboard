# Gold H4 regime switch (trend breakout / range fade): result (14 Nov 2026)

**Verdict: FAIL, 0 of 3 tests pass: the ER switch lost out of sample (2021-now −0.094R a trade net, n 400, month t −1.19) and sat under its shuffled-label placebo's median.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade or regime label was computed). A new stand-alone rule,
not a gate, exit, entry or size of the gold book (Gold trend is a daily, long-only, always-on 20-day breakout with a trail
and an add; this is an H4, two-sided switch between a breakout and a band fade). No candle before 2016 was used
(docs/owner-decisions.md item 44). Paper research only: nothing live changed and no proposal is written.

## Rule (as pre-registered)

- Spot gold, OANDA mid XAU/USD H4 through the candle proxy, 17,386 candles, 1 Jan 2016 to 13 Nov 2026 (20:00 UTC).
- Regime on each closed candle: 20-bar efficiency ratio ER = |C − C₋₂₀| / Σ|ΔC|. TREND ER > 0.35, RANGE ER < 0.20, else
  NEUTRAL (no new trade). ADX not used.
- TREND: buy a close above the prior 20-bar high when C > C₋₂₀ (sell below the prior 20-bar low when C < C₋₂₀); out on a close
  through the opposite 10-bar channel. RANGE: sell a close above the Bollinger 20 / 2 upper band, buy one below the lower; out
  on a close back at the middle band.
- Market at the next open; stop 1.5 × ATR(14) (every trade has it; a gap fills at the open); 30-candle time exit; one position
  at a time per stream.
- Costs: $0.30 spread + $0.15 slippage in + $0.15 out ($0.60 a trade), financing on buys `nights` × `FIN.xau.long` (0.000148 a
  rollover, demo broker swap of 11 Nov 2026) × entry / risk. 2× costs doubles all three.
- Bars in each regime: TREND 28.6 % / RANGE 43.8 % / NEUTRAL 27.5 % in 2016-20, 29.2 % / 44.8 % / 26.0 % in 2021-now.

## Results

| Test | Window | n | Gross R | Net R | Net at 2× | Win % | Total net R | Worst DD R | t net (months) | t gross |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 the switch (primary) | IS 2016-20 | 330 | +0.103 | −0.005 | −0.113 | 37.3 | −1.70 | −34.35 | −0.05 | 1.02 |
| T1 the switch (primary) | OOS 2021-now | 400 | −0.031 | −0.094 | −0.158 | 35.7 | −37.78 | −58.45 | −1.19 | −0.39 |
| T2 breakout in TREND | IS 2016-20 | 181 | +0.222 | +0.100 | −0.022 | 29.8 | +18.08 | −18.61 | 0.63 | 1.37 |
| T2 breakout in TREND | OOS 2021-now | 215 | +0.055 | −0.020 | −0.095 | 28.8 | −4.24 | −23.11 | −0.14 | 0.38 |
| T3 fade in RANGE | IS 2016-20 | 164 | −0.039 | −0.129 | −0.219 | 46.3 | −21.17 | −23.91 | −1.48 | −0.45 |
| T3 fade in RANGE | OOS 2021-now | 199 | −0.125 | −0.177 | −0.229 | 42.7 | −35.18 | −44.78 | −2.34 | −1.66 |

Inside T1 out of sample: the breakout leg 206 trades −0.026R net, the fade leg 194 trades −0.167R net.

## The pre-registered checks

| Test | OOS t ≥ 2 and Holm | IS net > 0 | OOS net > 0 at 2× | OOS net > placebo p95 | Holm-adjusted p | Pass |
|---|---|---|---|---|---|---|
| T1 | no (t −1.19) | no | no | no | 1.000 | no |
| T2 | no (t −0.14) | yes | no | no | 1.000 | no |
| T3 | no (t −2.34) | no | no | no | 1.000 | no |

## Placebo (OOS, 40 seeds: the regime labels shuffled in blocks of 20 candles, every other part real)

| Test | Real net R a trade | Placebo median | Placebo 95th percentile | Min / max |
|---|---|---|---|---|
| T1 | −0.094 | −0.061 | +0.027 | −0.177 / +0.052 |
| T2 | −0.020 | +0.013 | +0.160 | −0.200 / +0.172 |
| T3 | −0.177 | −0.104 | −0.011 | −0.186 / +0.006 |

Every real stream sits below its placebo's median: the efficiency-ratio label did no better than the same labels in random places.

## Descriptive only (not tests): each leg on every candle, whatever the regime

| Stream | Window | n | Gross R | Net R | t net (months) |
|---|---|---|---|---|---|
| Breakout, any regime | IS 2016-20 | 285 | +0.181 | +0.066 | 0.58 |
| Breakout, any regime | OOS 2021-now | 345 | +0.100 | +0.025 | 0.23 |
| Fade, any regime | IS 2016-20 | 509 | −0.097 | −0.187 | −3.76 |
| Fade, any regime | OOS 2021-now | 618 | −0.044 | −0.093 | −1.85 |

## Reading

- The owner's notes are half right on this data: the 20-bar H4 band fade loses in "ranging" candles (T3) and loses in every
  candle, and the fade leg is what sinks the switch. But the trend label does not help the breakout: the breakout taken on
  every candle made +0.025R net out of sample, the same breakout taken only when ER > 0.35 −0.020R. Neither is near t 2.
- Years of T1 (net R): 2016 −13.1, 2017 +15.5, 2018 −16.6, 2019 +1.8, 2020 +10.7, 2021 −5.7, 2022 −6.0, 2023 −14.6,
  2024 −7.0, 2025 −20.0, 2026 +15.6. T2 OOS: buys −0.103R (n 133), sells +0.115R (n 82): no steady side either.
- Costs are not the reason: T1's OOS gross is −0.031R; the fade leg loses before costs in both windows.
- Not an edge, never a filter or a council rule; no follow-up proposed (another ER cut, an ADX version or another channel length
  would be chosen after seeing this result).

To repeat: `node --use-env-proxy research/edge/gold-regime-switch/fetch.mjs <dir>` (candles outside git), then
`node research/edge/gold-regime-switch/run.mjs <dir>`. Tests: `tests/gold-regime-switch.test.mjs`.

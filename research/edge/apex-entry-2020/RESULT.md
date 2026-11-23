# Apex and continuation entries, 18 markets, 2020 to now: result (23 Nov 2026)

**Verdict: FAIL. 0 of 4 tests pass: apex n 2,738, -0.220R a trade, month t -6.07; low-risk apex n 2,282, -0.199R, t -4.80; continuation instant n 4,550, -0.299R, t -11.04; continuation after an H1 DC n 1,207, -0.178R, t -4.59 (after costs).**

Pre-registered in PREREGISTRATION.md (committed alone before any code). OANDA mid 5-minute candles of the shared cache, 18
markets pooled, trades filled 2020-01-01 to 22-23 Nov 2026, discovery 2020-2023, confirmation 2024 on, after the round
trips of `combo-grid-2` `COSTS`. 20 trades were dropped by the data-quality intervals. The cut check (gold cut at
2024-06-01, EUR/USD at 2022-03-15) left every signal, candidate and DC before the cut unchanged.

| Test | Discovery n / R a trade / month t | Confirmation n / R a trade / month t | Twice the cost (conf.) | Before costs (all) | Gold alone (all) |
|---|---|---|---|---|---|
| T1 Apex | 1,594 / -0.275 / -5.83 | 1,144 / -0.144 / -2.63 | -0.303 | -0.035 (t -1.04) | 131 / -0.192 / -1.37 |
| T2 Low-risk apex | 1,341 / -0.241 / -4.47 | 941 / -0.139 / -2.17 | -0.291 | -0.019 (t -0.49) | 113 / -0.067 / -0.38 |
| T3 Continuation, instant | 2,647 / -0.311 / -8.85 | 1,903 / -0.282 / -6.59 | -0.522 | -0.021 (t -0.98) | 238 / -0.182 / -1.81 |
| T4 Continuation, H1 DC | 695 / -0.122 / -2.42 | 512 / -0.253 / -4.30 | -0.425 | +0.002 (t 0.06) | 66 / -0.002 / -0.01 |

No test reaches a positive discovery mean, so none goes on to confirmation (Holm p 1.00 on all four). Before costs every
test sits at zero (-0.035R to +0.002R a trade, |t| under 1.1): waiting for the Daily close (T2 against T1) and the H1
confirmation candle (T4 against T3) move the result by a few hundredths of an R, inside noise. The fixed 20-30 pip stops are
small against the markets' costs, so costs decide the sign: about 0.11R a trade on the apex tests and 0.16R on the instant
continuation without silver.

Descriptive, not judged: gold's low-risk apex made +0.319R a trade in 2024 on (n 43, month t 1.15) after -0.304R in
2020-2023 (n 70); gold's DC continuation -0.002R (n 66). Markets positive over the whole window: 4 of 18 (T1, T2), 1 of 18
(T3), 3 of 18 (T4), none with a month t above 1.4.

What is odd in the data: silver's round trip ($0.03) is larger than its scaled stop (0.05-0.075 % of a $12-55 price, $0.006-0.04),
so every silver trade pays 1R of cost or more (T3 silver -2.28R a trade). Without silver (descriptive): T1 -0.141R (n 2,585, t -4.07),
T2 -0.127R (n 2,164, t -3.13), T3 -0.177R (n 4,286, t -7.58), T4 -0.115R (n 1,138, t -2.67): still losing, before costs still
zero. Of the limit orders of the four tests 41-48 % fill, market by market (gold: 582 of 1,296; 548 trades after the one-at-a-time
rule); about a fifth of apex trades end at break-even.

Not tested (said in the pre-registration): the Weekly form of the apex, the H1 refinement of the apex, the consequent
encroachment entry, the M5 confirmations, the two-feed check and the discretionary hold decisions. These rules were coded as
written; they are not a judgement of the owner's own chart reading. Nothing live changed.

Files: `run.mjs` (`market`, `cut`, `report`), `result.json` (every figure above, per market, exits, the cut check).
Test: `tests/apex-entry-2020.test.mjs`.

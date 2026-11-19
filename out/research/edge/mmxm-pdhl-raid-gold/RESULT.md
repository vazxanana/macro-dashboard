# Result: previous-day high / low raid and reversal to an H1 gap, spot gold (14 Nov 2026)

**Verdict: FAIL: the pre-registered rule trades 12 times in 8.8 years and loses (T1 out of sample -0.131R a trade net, n 7, month t -0.32; in sample -0.400R, n 5).**

PREREGISTRATION.md was committed and pushed alone (44fad6e8e) before any candle was fetched. The test ran once; nothing was
changed after the result. A new stand-alone intraday rule on gold, decided on 2018 to now: not a test of the gold book, and no
candle before 1 Jan 2018 was read (owner decision 44). Nothing live changes and no proposal is written.

## What was tested
The market-maker-model skill's intraday reversal, read mechanically (rules in PREREGISTRATION.md): in the New York kill zone
(08:00-12:00 ET) the previous 17:00 New York day's high (or low) is taken for the first time that day; within 2 h an M15 candle
closes back beyond a 2-a-side M15 swing formed after the raid (the shift); a limit at the 50 % of the shift's leg, stop $0.30
past the raid extreme; target the nearest unfilled opposite-direction H1 fair value gap beyond the previous day's middle (none,
or under 1.5R: no trade); sells only above the 00:00 New York open, buys only below; flat at 16:00 ET. OANDA mid M15 / H1
XAU/USD 2018-01-01 to 2026-11-13, $0.30 a round trip, no financing (intraday).

## Results (net of $0.30; t on calendar-month sums, every month of the window counted)

| Test | IS 2018-20 n | gross | net | month t | OOS 2021-now n | gross | net | total | month t | Holm p | OOS net at 2x cost |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 NY kill zone + midnight filter (primary) | 5 | -0.324 | -0.400 | -1.05 | 7 | -0.081 | -0.131 | -0.91 | -0.32 | 1 | -0.180 |
| T2 NY, no midnight filter | 5 | -0.324 | -0.400 | -1.05 | 8 | -0.196 | -0.246 | -1.97 | -0.65 | 1 | -0.296 |
| T3 London kill zone + filter | 5 | -0.342 | -0.451 | -0.99 | 3 | -0.298 | -0.367 | -1.10 | -0.59 | 1 | -0.436 |
| T4 T1 + silver SMT | 2 | -0.698 | -0.759 | -1.34 | 4 | -0.544 | -0.599 | -2.40 | -1.59 | 1 | -0.655 |

R a trade. T1 out of sample: 2 of 7 won, 3 stops, 1 target, 3 flat at 16:00, median risk $6.10, worst drawdown -3.3R.
T1 by year (n, net R): 2018 2 / -0.29, 2019 1 / -0.47, 2020 2 / -1.23, 2021 1 / -1.05, 2022 3 / -2.25, 2023 1 / +0.52,
2025 1 / -0.17, 2026 1 / +2.04.

**The midnight-open filter** removes one trade (T2 minus T1): it cannot be judged on this n.

**Funnel (T1)**: 2,200 trading days; 515 first-time raids of the previous day's high or low in the New York window; 35 shifts
back within 2 h; 30 with an unfilled H1 gap beyond the previous day's middle; 22 at 1.5R or more; 21 on the right side of the
midnight open; 12 filled (3 cancelled because price reached the target first, 6 expired unfilled). The binding step is the
shift: a 2-a-side M15 swing must form after the raid and be closed through within 2 h, which happens on 7 % of raid days.

**Placebo** (40 seeded draws, random direction from the same fill time and price, same risk, the target rule in the drawn
direction): the real T1 out-of-sample -0.131R a trade beats 24 of 40 draws (draws of 3-7 trades, -0.73R to +0.35R). It is
indistinguishable from a coin flip.

## Reading
- Not an edge, and not testable as a rule at this strictness: 12 trades in 8.8 years cannot show anything (the pass bar needs
  a month t of 2). Every test, in both windows, has a negative net mean.
- The study does not judge the skill as the owner trades it: the shift, the swing size and the order-block entry are read by
  eye, and the skill's SMT is a judgement across markets; the mechanical reading here finds the full sequence very rarely.
  A looser reading (a 1-a-side swing, a longer shift window, the FVG near-edge entry) would be a different rule and needs its
  own pre-registration; picking it after seeing this is not allowed.
- The index-CFD pre-registration of the same model (branch `mmxm-pdhl-raid`) was pushed and not run (gold was made the
  priority).

## Repeat
`node --use-env-proxy research/edge/mmxm-pdhl-raid-gold/run.mjs fetch <dir>` (candles kept outside git, about 6 MB), then
`node research/edge/mmxm-pdhl-raid-gold/run.mjs full <dir>`. Tests: `tests/mmxm-pdhl-raid-gold.test.mjs`.

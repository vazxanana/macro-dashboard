# Result: point-and-figure double-top buys on gold, judged against gold's own drift (14 Nov 2026)

**Verdict: FAIL, 0 of 3: a 0.5 % box double-top buy makes +0.098R net OOS (n 140) but -0.015R against buying every day (t -0.15); the sell and the 20-day hold do no better.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any number was computed; only signal counts per box size were
read beforehand). OANDA mid gold daily candles, council-data `research/daily/xau.json`, weekends folded with
`council/fills.mjs` `foldWeekend`, 5,369 days to 13 November 2026. Log-scale point-and-figure chart, box 0.5 %, three-box
reversal, high / low method; a double-top buy (a rising column one box above the previous rising column's top) read on the
close, order at the next open, a stop of 2 x ATR(14) on every trade, out at the open 10 (or 20) days later. $0.60 a round
trip and overnight financing on buys at `FIN.xau.long`. Each test is judged as an EXCESS over the same trade entered after
every day of the window (the baseline = gold's drift for that trade shape). In sample = entries 2007-16, out of sample =
2017 to 13 Nov 2026. A stand-alone rule of my own choosing: not a gate, exit, entry or size of the gold book; owner decision
44 is untouched. Nothing live changed; no proposal.

| Test | Window | n | R gross | R net | Every-day net | Excess net | Excess t (month) | Net t (month) | Gross t (month) | Excess at 2x costs |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 double-top buy, 10 days (primary) | IS 2007-16 | 167 | +0.082 | +0.014 | +0.018 | -0.003 | -0.04 | 0.17 | 0.94 | +0.001 |
| | OOS 2017-26 | 140 | +0.172 | +0.098 | +0.113 | -0.015 | -0.15 | 0.95 | 1.62 | -0.005 |
| T2 double-bottom sell, 10 days | IS 2007-16 | 156 | -0.113 | -0.128 | -0.096 | -0.032 | -0.42 | -1.70 | -1.50 | -0.030 |
| | OOS 2017-26 | 114 | -0.130 | -0.141 | -0.163 | +0.022 | 0.24 | -1.56 | -1.45 | +0.026 |
| T3 double-top buy, 20 days | IS 2007-16 | 167 | +0.169 | +0.063 | +0.053 | +0.010 | 0.08 | 0.47 | 1.22 | +0.016 |
| | OOS 2017-26 | 140 | +0.321 | +0.200 | +0.230 | -0.030 | -0.20 | 1.32 | 2.02 | -0.013 |

Baselines: 2,602 every-day trades in sample and 2,552 (2,542 at 20 days) out of sample. Month t: the value summed by the
calendar month of entry over every month of the window (IS 120, OOS 119 months). The last out-of-sample buy signal (13 Nov)
has no candles after it yet, so 140 of the 141 counted buys are trades.

## The pass bar, check by check

| Check | T1 | T2 | T3 |
|---|---|---|---|
| OOS excess t >= 2, Holm p < 0.05 | no (t -0.15, Holm p 1.00) | no (t 0.24, Holm p 1.00) | no (t -0.20, Holm p 1.00) |
| IS excess > 0 (same sign) | no (-0.003) | no (-0.032) | yes (+0.010) |
| OOS excess at 2x costs > 0 | no (-0.005) | yes (+0.026) | no (-0.013) |
| Beats >= 38 of 40 placebos | no (22; placebo median -0.021R) | no (18; median +0.035R) | no (19; median -0.012R) |
| n >= 100 in each window | yes (167 / 140) | yes (156 / 114) | yes (167 / 140) |

## Reading

- **The double-top buy is gold's drift.** Out of sample it makes +0.098R a trade net (+0.172R gross; gross month t 1.62),
  and buying after any day with the same stop and holding 10 days makes +0.113R: the signal is 0.015R WORSE (t -0.15). In
  sample the two are equal (+0.014R against +0.018R). The plain figures would have looked like a weak long edge out of
  sample; against the drift baseline nothing is left. OOS halves: 2017-21 +0.025R excess (n 54), 2022 on -0.061R (n 86).
- **The double-bottom sell loses** -0.128R and -0.141R a trade net in the two windows, about what any sell lost while gold
  rose (excess -0.032R in sample, +0.022R out of sample, t 0.24, 18 of 40 placebos).
- **Holding 20 days** makes +0.200R net out of sample (gross month t 2.02), again below the every-day 20-day buy (+0.230R):
  excess -0.030R, t -0.20; 2022 on -0.122R.
- Nothing here is an edge; no proposal is written. Whether a fixed-size swing high was just taken out tells nothing about
  gold's next 10-20 days that buying on any day does not. The box (0.5 %), reversal (3) and holds were fixed before any
  return was read and were not changed.

## Files

- `run.mjs` (`fetch <dir>`: copies council-data's `research/daily/xau.json` with `git show`, no network; `full <dir>`: runs
  the study and writes `result.json`), `result.json` (every statistic, the 40 placebo excesses, the out-of-sample signal
  trades), `tests/gold-point-figure.test.mjs`.

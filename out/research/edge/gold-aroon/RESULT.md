# Result: Aroon crosses on gold's daily chart, judged against gold's own drift (14 Nov 2026)

**Verdict: FAIL, 0 of 3: Aroon(25) crosses come 5 a year (n 48-54, under the 100 needed); the primary buy makes +0.108R net OOS but -0.005R over the every-day buy (t -0.03).**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any number was computed). OANDA mid gold daily candles, council-data
`research/daily/xau.json`, weekends folded with `council/fills.mjs` `foldWeekend`, 5,369 days to 13 November 2026. Aroon(25)
read on the close, order at the next open, a stop of 2 x ATR(14) on every trade, out at the open 10 (or 20) days later.
$0.60 a round trip and overnight financing on buys at `FIN.xau.long`. Each test is judged as an EXCESS over the same trade
entered after every day of the window (the baseline = gold's drift for that trade shape). In sample = entries 2007-16, out
of sample = 2017 to 13 Nov 2026. A stand-alone rule of my own choosing: not a gate, exit, entry or size of the gold book;
owner decision 44 is untouched. Nothing live changed; no proposal.

| Test | Window | n | R gross | R net | Every-day net | Excess net | Excess t (month) | Net t (month) | Excess at 2x costs |
|---|---|---|---|---|---|---|---|---|---|
| T1 up-cross, buy, 10 days (primary) | IS 2007-16 | 48 | +0.027 | -0.050 | +0.018 | -0.067 | -0.45 | -0.33 | -0.071 |
| | OOS 2017-26 | 54 | +0.198 | +0.108 | +0.113 | -0.005 | -0.03 | 0.77 | -0.010 |
| T2 down-cross, sell, 10 days | IS 2007-16 | 48 | +0.279 | +0.263 | -0.096 | +0.359 | 1.67 | 1.23 | +0.360 |
| | OOS 2017-26 | 54 | -0.262 | -0.275 | -0.163 | -0.112 | -1.24 | -2.90 | -0.111 |
| T3 up-cross, buy, 20 days | IS 2007-16 | 48 | +0.104 | -0.014 | +0.053 | -0.066 | -0.32 | -0.07 | -0.072 |
| | OOS 2017-26 | 54 | +0.486 | +0.342 | +0.230 | +0.112 | 0.50 | 1.52 | +0.106 |

Baselines: 2,602 every-day trades in sample and 2,552 (2,542 at 20 days) out of sample. Month t: the excess (net R less the
window's every-day mean) summed by the calendar month of entry over every month of the window (IS 120, OOS 119 months).

## The pass bar, check by check

| Check | T1 | T2 | T3 |
|---|---|---|---|
| OOS excess t >= 2, Holm p < 0.05 | no (t -0.03, Holm p 1.00) | no (t -1.24, Holm p 0.66) | no (t 0.50, Holm p 1.00) |
| IS excess > 0 (same sign) | no (-0.067) | yes (+0.359) | no (-0.066) |
| OOS excess at 2x costs > 0 | no (-0.010) | no (-0.111) | yes (+0.106) |
| Beats >= 38 of 40 placebos | no (19; placebo median +0.002R) | no (7; median +0.040R) | no (28; median -0.031R) |
| n >= 100 in each window | no (48 / 54) | no (48 / 54) | no (48 / 54) |

## Reading

- **The cross is rare.** With N = 25 Aroon-Up and Aroon-Down swap places about five times a year each way, so every test has
  48 signals in sample and 54 out of sample, half the 100 the pre-registration asked for: by its own rule the study can only
  be descriptive, and it fails every other line too. N was not changed after seeing this.
- **The primary buy is gold's drift.** Out of sample it makes +0.108R a trade net, and buying after any day with the same stop
  and holding makes +0.113R: excess -0.005R (2017-21 +0.078R, n 27; 2022 on -0.089R, n 27). In sample it lost to the
  every-day buy by 0.067R. The plain net t (0.77) would have looked better than the excess t: that gap is what the drift
  baseline is for.
- **The sell flipped sign.** In 2007-16 a sell after a down-cross beat the every-day sell by +0.359R (t 1.67); out of sample it
  did 0.112R worse (t -1.24) and lost -0.275R a trade net, beating only 7 of 40 random-day placebos.
- **Holding 20 days** shows +0.112R of excess out of sample but -0.066R in sample, t 0.50 and 28 of 40 placebos.
- Nothing here is an edge; no proposal is written. How recently a 25-day extreme was made tells nothing about gold's next
  10-20 days that buying on any day does not.

## Files

- `run.mjs` (`fetch <dir>`: copies council-data's `research/daily/xau.json` with `git show`, no network; `full <dir>`: runs
  the study and writes `result.json`), `result.json` (every statistic, the 40 placebo excesses, the out-of-sample signal
  trades), `tests/gold-aroon.test.mjs`.

# Result: the money-flow gap on gold's daily chart, judged against gold's own drift (14 Nov 2026)

**Verdict: FAIL, 0 of 3: what volume adds to a 14-day oscillator tells nothing; the primary buy makes +0.107R net OOS but -0.006R over the every-day buy (t -0.04).**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any number was computed). OANDA mid gold daily candles with tick
volume, council-data `research/daily/xau.json`, weekends folded with `council/fills.mjs` `foldWeekend` (their volume added to
Monday's), 5,369 days to 13 November 2026. The gap = MFI(14) minus the same oscillator with every day's volume set to one;
a signal when it is above the 90th (buy) or under the 10th (sell) percentile of the 252 previous gaps, read on the close,
order at the next open, a stop of 2 x ATR(14) on every trade, out at the open 10 (or 20) days later. $0.60 a round trip and
overnight financing on buys at `FIN.xau.long`. Each test is judged as an EXCESS over the same trade entered after every
eligible day of the window (the baseline = gold's drift for that trade shape). In sample = entries 2007-16 (from April 2007,
the first day with 252 earlier gaps), out of sample = 2017 to 13 Nov 2026. A stand-alone rule of my own choosing: not a
gate, exit, entry or size of the gold book; owner decision 44 is untouched. Nothing live changed; no proposal.

| Test | Window | n | R gross | R net | Every-day net | Excess net | Excess t (month) | Net t (month) | Excess at 2x costs |
|---|---|---|---|---|---|---|---|---|---|
| T1 high gap, buy, 10 days (primary) | IS 2007-16 | 294 | +0.013 | -0.058 | +0.011 | -0.069 | -0.58 | -0.49 | -0.068 |
| | OOS 2017-26 | 254 | +0.189 | +0.107 | +0.113 | -0.006 | -0.04 | 0.71 | -0.003 |
| T2 low gap, sell, 10 days | IS 2007-16 | 256 | -0.110 | -0.125 | -0.087 | -0.037 | -0.37 | -1.19 | -0.036 |
| | OOS 2017-26 | 272 | -0.282 | -0.295 | -0.163 | -0.132 | -1.52 | -2.99 | -0.131 |
| T3 high gap, buy, 20 days | IS 2007-16 | 294 | -0.102 | -0.208 | +0.044 | -0.252 | -1.81 | -1.50 | -0.247 |
| | OOS 2017-26 | 254 | +0.307 | +0.176 | +0.230 | -0.054 | -0.20 | 0.65 | -0.047 |

Baselines: 2,540 every-day trades in sample and 2,552 (2,542 at 20 days) out of sample. Month t: the excess (net R less the
window's every-day mean) summed by the calendar month of entry over every month of the window (IS 120, OOS 119 months).

## The pass bar, check by check

| Check | T1 | T2 | T3 |
|---|---|---|---|
| OOS excess t >= 2, Holm p < 0.05 | no (t -0.04, Holm p 1.00) | no (t -1.52, Holm p 0.39) | no (t -0.20, Holm p 1.00) |
| IS excess > 0 (same sign) | no (-0.069) | no (-0.037) | no (-0.252) |
| OOS excess at 2x costs > 0 | no (-0.003) | no (-0.131) | no (-0.047) |
| Beats >= 38 of 40 placebos | no (20; placebo median -0.004R) | no (0; median +0.018R) | no (11; median -0.018R) |
| n >= 100 in each window | yes (294 / 254) | yes (256 / 272) | yes (294 / 254) |

## Reading

- **Enough events, no signal.** The decile rule fires on about one day in nine each way (254-294 signals a window), so the
  study has the power the plain MFI crosses lacked; every excess is still negative in both windows.
- **The primary buy is gold's drift.** Out of sample it makes +0.107R a trade net, and buying after any day makes +0.113R:
  excess -0.006R (2017-21 -0.163R, n 103; 2022 on +0.083R, n 151). In sample it trailed the every-day buy by 0.069R. Its
  plain net t (0.71) is gold's rise, not the gap.
- **The sell after "distribution" did worse than any sell.** -0.132R a trade under the every-day sell out of sample
  (t -1.52; both halves negative, -0.058R and -0.212R) and -0.037R in sample; it beat none of the 40 random-day placebos.
  If anything a low gap came before gold rose, the opposite of the idea, and not at a level that would count.
- **Holding 20 days** trailed the every-day buy in both windows (-0.252R in sample, t -1.81; -0.054R out of sample).
- Nothing here is an edge; no proposal is written. Whether the up days or the down days of the last two weeks carried more
  of OANDA's tick activity says nothing about gold's next 10-20 days that buying or selling on any day does not. Volume is a
  tick count, not traded ounces (the pre-registration's caveat): this does not judge exchange volume.

## Files

- `run.mjs` (`fetch <dir>`: copies council-data's `research/daily/xau.json` with `git show`, no network; `full <dir>`: runs
  the study and writes `result.json`), `result.json` (every statistic, the 40 placebo excesses, the out-of-sample signal
  trades), `tests/gold-mfi.test.mjs`.

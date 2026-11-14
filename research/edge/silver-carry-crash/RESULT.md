# Result: silver after an AUD/JPY carry crash day (14 Nov 2026)

**Verdict: FAIL, 0 of 3: gold's near miss does not replicate on silver; buying silver 5 days after a carry crash trails the year's every-day buy by −0.027R out of sample (n 141, month t −0.34, Holm p 1.00).**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit d8fd3d1b5, pushed alone before any silver outcome was
computed). A replication of `gold-carry-crash` (FAIL, a near miss on gold: OOS excess +0.117R, month t 1.42) with the same
rule on a market it was not found on. Paper research only, a **stand-alone rule on silver**: not a gate, entry, exit or size
of the live gold book, whose records were not read. No live rule, size, filter, stop, config, cost constant or council member
changed. No proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xag.json` and `audjpy.json` at the pre-registered commit
  `d8d68407b` (the gold study's; silver 2006-03-20 to 2026-11-13, AUD/JPY 2004-06-01 to 2026-11-13), weekends folded into
  Monday with `council/fills.mjs` `foldWeekend`.
- Signal (gold-carry-crash's, unchanged): AUD/JPY's close-to-close return divided by the sample sd of its 20 previous daily
  returns. Carry crash below −1.5, carry rally above +1.5. In sample 216 crash and 182 rally days of 2,605; out of sample 191
  and 177 of 2,563 (counted before the pre-registration; identical to the gold study's counts).
- T1 (primary, the gold study's primary rule) crash day, buy silver, 5 candles; T2 rally day, sell silver, 5 candles; T3 crash
  day, buy silver, 10 candles.
- Trade: entry at silver's next UTC daily open, stop 1.5 x ATR(14) of the 14 candles before it (1R; a gap through the stop
  fills at the open), exit at the close of the hold's last candle, one position at a time per test. Costs **$0.05 a round
  trip** (the gold study's $0.60 scaled by `gold-drd-silver`'s silver / gold cost ratio, 0.03 / 0.35), about 0.07R a trade
  (mean stop $1.31-1.37). **No financing**: `council/fills.mjs` has no silver rate, so silver buys are charged nothing; the
  "gold-rate financing" column charges gold's rate per unit of price (`FIN.xau.long`) on silver buys, descriptive only.
- Control: the same trade (same side, hold, stop, costs) after every eligible day of the same calendar year. Excess = a
  trade's net R minus its entry year's control mean.
- Windows: signal days 2007-01-01 to 2016-12-31 (in sample) and 2017-01-01 to 2026-10-31 (out of sample). t on
  calendar-month sums by exit month, every month counted; Holm over T1-T3 on the one-sided out-of-sample p of the excess.

## Results (R a trade)

| Test | Window | n | Won | Stopped | Gross R | Month t gross | Net R | Month t net | Control net | Excess R | Month t excess | Net at 2x costs | Net, gold-rate financing | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 crash, buy 5 d (primary) | IS 2007-16 | 161 | 45.3 % | 42 | +0.057 | +0.79 | −0.010 | −0.14 | −0.034 | +0.019 | +0.28 | −0.077 | −0.032 |  |  |
|  | OOS 2017-26 | 141 | 48.9 % | 44 | +0.045 | +0.55 | −0.027 | −0.33 | +0.014 | −0.027 | −0.34 | −0.099 | −0.053 | 1.00 | no |
| T2 rally, sell 5 d | IS 2007-16 | 144 | 41.0 % | 49 | −0.119 | −1.46 | −0.185 | −2.24 | −0.077 | −0.111 | −1.40 | −0.252 | −0.185 |  |  |
|  | OOS 2017-26 | 140 | 38.6 % | 44 | −0.106 | −1.50 | −0.178 | −2.52 | −0.118 | −0.049 | −0.73 | −0.251 | −0.178 | 1.00 | no |
| T3 crash, buy 10 d | IS 2007-16 | 131 | 44.3 % | 57 | +0.104 | +0.92 | +0.036 | +0.31 | +0.031 | +0.002 | +0.02 | −0.033 | −0.003 |  |  |
|  | OOS 2017-26 | 124 | 46.0 % | 56 | +0.197 | +1.57 | +0.124 | +0.98 | +0.079 | +0.072 | +0.59 | +0.051 | +0.080 | 0.83 | no |

Unadjusted one-sided p of the OOS excess: T1 0.633, T2 0.767, T3 0.278. The control counts every eligible day (2,605 in
sample, 2,563 out of sample) with no one-at-a-time rule.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| OOS excess month t >= 2 and Holm p < 0.05 | no | no | no |
| OOS net R > 0 | no | no | yes |
| OOS net R > 0 at 2x costs | no | no | yes |
| IS excess R > 0 | yes | no | yes |
| Real OOS excess t above 38 of 40 placebos | no (16) | no (10) | no (34) |
| OOS n >= 30 | yes | yes | yes |

## Placebo (40 seeds; random out-of-sample eligible days, as many as the signal days, same side, trade and excess)

| Test | p5 | median | p95 | Real OOS excess month t | Placebos beaten |
|---|---|---|---|---|---|
| T1 | −1.70 | +0.09 | +1.07 | −0.34 | 16 of 40 |
| T2 | −1.52 | +0.02 | +1.79 | −0.73 | 10 of 40 |
| T3 | −1.58 | −0.04 | +1.12 | +0.59 | 34 of 40 |

## Reading

- The gold near miss does not carry to silver. On silver the primary rule's out-of-sample excess over the year's every-day
  buy is −0.027R a trade (month t −0.34), in the middle of its placebo; net of costs it loses in both windows. Whatever lean
  the crash-day gold buy had (+0.117R, t 1.42 on gold) is not a general precious-metal response to a carry unwind: silver's
  industrial, risk-on leg falls with the carry trade as much as its haven leg holds.
- The 10-day crash-day buy is positive out of sample (+0.124R net, still positive at 2x costs), but that is mostly silver's own
  rise in 2017-26 (the control made +0.079R); the excess is +0.072R, month t 0.59, and in sample it is +0.002R. Not apart from
  luck.
- Carry-rally sells of silver lose like any silver sell (control −0.077R / −0.118R), a bit worse in both windows; the rally day
  tells nothing useful.
- Financing: none was charged, because the repository has no silver rate. Charging gold's rate per unit of price on silver buys
  makes every buy test worse (T1 OOS −0.053R, T3 OOS +0.080R); it changes no check.
- This reading also says the gold result is more likely noise than a mechanism: a carry-unwind haven bid would be expected to
  show at least weakly on silver. Not an edge on either metal; never call it one. What this does not cover: other carry
  crosses, thresholds, holds or stops; none was looked at, and none should be tuned on these results.

## Repeat

```sh
node research/edge/silver-carry-crash/run.mjs fetch <dir>   # git show of the pinned council-data commit, no network
node research/edge/silver-carry-crash/run.mjs count <dir>   # the signal days counted before the pre-registration
node research/edge/silver-carry-crash/run.mjs full <dir>    # writes result.json next to run.mjs
node --test tests/silver-carry-crash.test.mjs
```

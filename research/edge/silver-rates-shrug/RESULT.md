# Result: spot silver after a 10-year bond shock it shrugged off (14 Nov 2026)

**Verdict: FAIL, 0 of 3: the gold near miss does not replicate on silver; the 1-day silver buy beats the year's every-day buy by +0.039R out of sample (n 139, month t 1.37) and loses net.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit f0937e0d9, pushed alone before any return was computed; only
the event counts had been looked at). A replication of `research/edge/gold-rates-shrug` T3 (gold, OOS excess +0.072R, month t
1.90, Holm p 0.086) on a market it was not found on, with the same thresholds, window, stop and measure. Paper research only, a
**stand-alone rule on silver**: not a gate, entry, exit or size of the live gold book, and none of its positions was read
(docs/owner-decisions.md item 44). No live rule, size, filter, stop, config, cost constant or council member changed. No proposal.

## What was tested

- Data: council-data `research/daily/xag.json` (traded), `xau.json` (T2's condition) and `usb10y.json` (signal) at commit
  `7a4c629a`, OANDA mid daily candles, UTC days, weekends folded into Monday (`council/fills.mjs` `foldWeekend`). `usb10y` is the
  bond PRICE (down = yields up). First z day 2007-03-14.
- Event: on a common UTC day the bond's return z (sd of its 250 previous common-day returns) is <= -1.0 (yields up hard) AND the
  named metal's own z the same day is within +/-0.5: silver (T1, T3) or gold (T2, gold-rates-shrug's event exactly: 135 / 115
  events, the same counts as there). Silver-flat events: 146 in sample, 139 out of sample.
- Trade: silver's next daily open, stop 2 x ATR(20) of silver (1R; about $1.09 in sample, $1.32 out of sample), gaps fill at the
  open, out at the close of the hold's last candle, one at a time. Costs $0.06 a round trip (silver's $0.03 from
  `gold-drd-silver` plus $0.015 slippage on each market order), about 0.065R a trade. **No financing charged**: no silver rate
  exists in `council/fills.mjs` `FIN` (only a gold long rate is measured).
- Excess = net R minus the mean net R of the same side and hold entered at every silver candle of the same year. t on
  calendar-month sums of excess R; one-sided OOS p, Holm over the three tests.

## The three tests (R a trade)

| Test | Window | Events | n | Gross R | Net R | Excess net | Month t net | Month t excess | Net at 2x | Excess at 2x | Win % |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 yields up, silver flat, buy 1 day (primary) | 2007-16 | 146 | 146 | +0.019 | -0.046 | +0.016 | -1.45 | 0.51 | -0.111 | +0.014 | 43.2 |
| | 2017-26 | 139 | 139 | +0.042 | -0.026 | +0.039 | -0.87 | **1.37** | -0.095 | +0.038 | 52.5 |
| | 2007-26 | 285 | 285 | +0.030 | -0.037 | +0.027 | -1.67 | 1.30 | -0.103 | +0.026 | 47.7 |
| T2 yields up, GOLD flat, buy silver 1 day | 2007-16 | 135 | 135 | +0.052 | -0.011 | +0.047 | -0.34 | 1.55 | -0.074 | +0.046 | 48.1 |
| | 2017-26 | 115 | 115 | +0.054 | -0.011 | +0.049 | -0.38 | **1.72** | -0.076 | +0.047 | 56.5 |
| | 2007-26 | 250 | 250 | +0.053 | -0.011 | +0.048 | -0.50 | 2.29 | -0.075 | +0.047 | 52.0 |
| T3 yields up, silver flat, buy 5 days | 2007-16 | 146 | 122 | +0.013 | -0.052 | -0.003 | -0.72 | -0.04 | -0.116 | -0.004 | 44.3 |
| | 2017-26 | 139 | 105 | +0.019 | -0.050 | -0.019 | -0.78 | **-0.31** | -0.118 | -0.019 | 47.6 |
| | 2007-26 | 285 | 227 | +0.015 | -0.051 | -0.010 | -1.05 | -0.22 | -0.117 | -0.011 | 45.8 |

| Test | OOS p (one-sided) | Holm p | t >= 2 and Holm < 0.05 | IS excess > 0 | OOS net, 2x net and excess > 0 | Events >= 100 | Placebo 38/40 | Control 38/40 | Pass |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 0.0853 (Holm 0.171) | 0.171 | no | yes | no | yes | no (37) | yes (38) | no |
| T2 | 0.0427 (Holm 0.128) | 0.128 | no | yes | no | yes | yes (38) | yes (38) | no |
| T3 | 0.622 (Holm 0.622) | 0.622 | no | no | no | yes | no (14) | no (17) | no |

## Placebo and control (out of sample, 40 seeds each, real month t of excess against the draws)

Placebo = the same number of random eligible OOS days, same side, hold and baseline. Control = the bond's z shuffled among the
days of each calendar year, the metal's days and its quiet-day filter kept real.

| Test | Real t | Placebo: real above | Placebo median / 5th / 95th | Control: real above | Control median / 5th / 95th |
|---|---|---|---|---|---|
| T1 | 1.37 | above 37 of 40 | 0.11 / -1.72 / 1.80 | above 38 of 40 | -0.11 / -1.55 / 1.62 |
| T2 | 1.72 | above 38 of 40 | 0.12 / -1.56 / 2.32 | above 38 of 40 | 0.08 / -1.33 / 1.75 |
| T3 | -0.31 | above 14 of 40 | -0.04 / -1.95 / 2.14 | above 17 of 40 | 0.04 / -1.63 / 1.32 |

## Reading

- The primary does not replicate the gold near miss: silver bought for one day after a yield jump it ignored beats the year's
  plain one-day buy by +0.016R and +0.039R a trade (month t 0.51 and 1.37), well short of t 2, and it LOSES money net in both
  windows (-0.046R, -0.026R): silver's cost is about 0.065R a trade on a one-day 2 x ATR stop, larger than the excess.
- The sign is the hypothesis's in both windows for the one-day tests (T1, T2), and T2, which uses gold's own quiet day as in
  gold-rates-shrug, is the strongest: +0.047R / +0.049R excess, OOS month t 1.72, and 2.29 over 2007-26 (reported only; the bar
  reads the two windows and Holm). But it too is negative net in both windows. A small next-day lean after "metals ignored a yield
  jump" may exist on both metals; on silver it does not pay its costs, and neither study clears its own bar.
- The 5-day hold (T3) is flat to negative: whatever there is fades within the first day.
- Nothing is promoted after the fact. Gold-rates-shrug T3 stays a near miss, now one that did not carry to the closest market.

## Files

- `research/edge/silver-rates-shrug/PREREGISTRATION.md`, `run.mjs`, `RESULT.md`, `result.json`; `tests/silver-rates-shrug.test.mjs`.
- To repeat: `node research/edge/silver-rates-shrug/run.mjs fetch <dir>` (git show from `origin/council-data`, no network),
  then `node research/edge/silver-rates-shrug/run.mjs full <dir>`. The candle copies were deleted after the run.

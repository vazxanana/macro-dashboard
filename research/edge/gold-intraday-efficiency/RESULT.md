# Result: does an efficient intraday path on gold predict the next day? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: after a straight-path day the next-day trade earns no more than the same-side trade of the same month (OOS excess -0.010R, month t -0.46, n 531).**

Pre-registered in `PREREGISTRATION.md` (pushed alone first, commit dd3308aba). The test ran once; nothing was changed after
the result. Paper research only: nothing live changed, no proposal follows. **Item 44**: a new stand-alone daily rule judged on
2017-26; it is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf) and says nothing about it.

Data: OANDA mid XAU/USD H1 through the site's candle proxy, 125,589 candles, 19 Mar 2006 to 6 Nov 2026 (cache outside git,
deleted). Days = UTC days, weekend candles into Monday, at least 18 candles: 5,321 days, 5,071 with a signal reading (250 prior
days). Efficiency E = |close - open| / hourly path length; a signal = E at or above the 80th percentile of the 250 days before
(20.6 % of days, median threshold 0.375). Trade at the next day's first H1 open in the day's direction, stop 1 x ATR(14),
out at the close of the entry day (T1, T2) or the 5th day (T3). Costs $0.60 a round trip plus `FIN.xau.long` financing per
rollover on buys. Excess = signal net R minus the mean net R of every eligible day's SAME-SIDE trade entered in the same month.

## The three tests (OOS = entries 2017-01-01 to 2026-11-07; IS = 2007-03-11 to 2016-12-31)

| Test | Window | n | Signal gross R | Signal net R | Excess R (net) | Excess month t | Excess at 2x costs | Holm p | Placebo beaten |
|---|---|---|---|---|---|---|---|---|---|
| T1 both sides, 1 day (primary) | IS | 512 | +0.038 | -0.002 | -0.035 | -1.60 | -0.036 | | |
| | OOS | 531 | +0.052 | +0.016 | -0.010 | -0.46 | -0.010 | 1.00 | 28 of 40 |
| T2 buys only, 1 day | IS | 281 | +0.035 | -0.010 | -0.043 | -1.65 | -0.044 | | |
| | OOS | 303 | +0.093 | +0.051 | -0.003 | -0.11 | -0.004 | 1.00 | 29 of 40 |
| T3 both sides, 5 days | IS | 512 | +0.119 | +0.060 | -0.134 | -2.76 | -0.135 | | |
| | OOS | 530 | +0.154 | +0.092 | -0.087 | -1.93 | -0.087 | 0.17 | 14 of 40 |

Pass checks of T1: OOS t >= 2 with Holm p < 0.05 no; IS excess > 0 no; 2x costs no (excess -0.010R, signal net -0.020R);
placebo 28 of 40, not 38; n 531 yes. T2 and T3 fail the same checks. OOS halves (T1): 2017-21 excess -0.011R (t -0.38),
2022-26 -0.009R (t -0.27).

## What it says

- The signal trades' own net R is small and positive out of sample (T1 +0.016R, month t +0.68; T2 buys +0.051R, t +1.68),
  but that is gold's drift: every-day buys of the same months earned about as much (OOS every-day buy +0.005R, 1 day;
  +0.113R, 5 days, t 2.01). Against the same side in the same month, the efficient day adds nothing (T1, T2 excess t near 0).
- On the 5-day hold the efficient day's continuation does WORSE than the same-side baseline in both windows (IS -0.134R,
  t -2.76; OOS -0.087R, t -1.93). This is a reading of the table, not a tested fade: a fade was not pre-registered, it would
  have to be its own study on other data, and the T3 placebo (14 of 40) shows the 5-day numbers are noisy.
- Every-day sells lose in both windows after costs (OOS -0.062R a 1-day trade, t -4.63): shorting gold on any rule here
  starts from that hole.

Not an edge, not a filter, not a proposal. Repeat: `node --use-env-proxy research/edge/gold-intraday-efficiency/run.mjs fetch <dir>`
then `node research/edge/gold-intraday-efficiency/run.mjs full <dir>`. Tests: `tests/gold-intraday-efficiency.test.mjs`.

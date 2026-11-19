# Result: does gold trade back to yesterday's volume point of control? (14 Nov 2026)

**Verdict: FAIL: 0 of 2 tests pass; fading an open outside yesterday's value area toward its POC made -0.018R a trade net in 2017-26 (n 1037, month t -0.94), no better than the same side every day.**

Pre-registered in PREREGISTRATION.md (pushed alone first, commit 678adf4dc). The test ran once; nothing was changed after the
result. Paper research: nothing live changed and no proposal follows. **Item 44**: a new stand-alone intraday rule judged on
its own; it is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf) and reads none of its positions.

## Data and rule
OANDA XAU_USD mid H1 candles with OANDA tick volume through `/md/bars` (2006-03-19 to 2026-10-30, 125,474 candles, kept out of
git and deleted), grouped into 5,359 trading days (UTC dates, Saturday / Sunday hours in Monday). Profile of day D-1: bins of
ATR(14) / 25, each H1 candle's volume spread evenly over its low..high; POC = the fullest bin; value area grown from the POC to
70 % of the day's volume. Day D opens above VAH or below VAL on 37 % of days in 2007-16 and 41 % in 2017-26. Entry at day D's
first H1 open, stop 1.0 x ATR(14), out at the close of the 20:00 UTC candle or the stop. Costs $0.60 a round trip and
`FIN.xau.long` financing on buys (`nights`; almost none intraday). t = calendar-month sums, one-sided, Holm over two. Excess =
net R minus the window's mean net R of the same trade, same side, on every profiled day. Placebo: as many random OOS days,
the signal sides shuffled, 40 seeds.

## Tests (R a trade; IS 2007-16, OOS 2017-01 to 2026-10)
| Test | IS n | IS gross | IS net | IS month t | IS excess | IS excess t | OOS n | OOS gross | OOS net | OOS month t | OOS excess | OOS excess t | Holm p | OOS 2x costs | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 fade to the POC (above VAH -> sell, below VAL -> buy) | 971 | -0.040 | -0.073 | -3.50 | -0.047 | -2.25 | 1037 | +0.010 | -0.018 | -0.94 | +0.008 | 0.43 | 1 | -0.046 | 23 of 40 | no |
| T2 acceptance (above VAH -> buy, below VAL -> sell) | 971 | +0.059 | +0.025 | 1.21 | +0.050 | 2.38 | 1037 | -0.001 | -0.029 | -1.49 | -0.010 | -0.53 | 1 | -0.057 | 15 of 40 | no |

Every-day baselines (same entry, stop and exit): buy IS -0.015R net (n 2602), OOS +0.002R net (+0.031R gross, month t 2.27:
gold's rise); sell IS -0.036R, OOS -0.047R. OOS halves (2017-21 | 2022-26): T1 -0.028R | -0.008R; T2 -0.045R | -0.013R. By side
OOS: T1 buys below VAL +0.007R (n 435), sells above VAH -0.036R (n 602); T2 buys -0.023R, sells -0.036R. With the stop at
1.5 x ATR (reported only): T1 IS -0.053R, OOS -0.015R; T2 IS +0.017R, OOS -0.021R. OOS exits: T1 131 stops, 906 at 21:00; T2 114
stops, 1 gap, 922 at 21:00. OOS costs took about 0.028R a trade. Placebo medians -0.024R (T1) and -0.021R (T2).

## Reading
- The "magnet" is not there: fading an open outside yesterday's value area back toward the POC lost before costs in 2007-16
  (-0.040R gross, worse than the same side on every day by 0.047R, t -2.25) and is flat in 2017-26 (+0.010R gross, excess t
  0.43). Its OOS buys merely ride gold's rise; its sells lose.
- Acceptance looked better than the every-day trade in 2007-16 (excess +0.050R, t 2.38) and did not repeat: in 2017-26 it lost
  -0.029R a trade net and trailed the every-day trade (t -0.53) and 25 of 40 placebo draws. A sign that flips between windows
  is noise, not a rule.
- Where gold opens against yesterday's volume profile says nothing usable about the rest of its UTC day. Do not try other bin
  widths, value-area shares, stops or exits on this data: that would be choosing after the result.

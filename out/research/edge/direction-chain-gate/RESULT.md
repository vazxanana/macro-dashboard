# Timeframe-chain direction gate: result (23 Nov 2026)

Verdict: **FAIL** (0 of 4 tests pass). Neither gate turns the plain H1 box-break entry profitable out of sample, and neither
"agree" stream beats its "disagree" stream on the pre-registered bar. Research only: nothing live changed, no rule proposed.

Pre-registered in `PREREGISTRATION.md` (committed before any trade was computed). Run: `node research/edge/direction-chain-gate/run.mjs`
(the toolkit's OANDA mid 5m cache, 2010 on; about 10 seconds). Every number below is in `result.json`; every candidate signal
is in `trades.json`.

## The four tests (out of sample = entries 2024-01-01 to 2026-11-13, five markets pooled, after costs)

| Stream | OOS n | OOS R a trade | OOS month t | OOS 2x costs | OOS before costs | IS 2020-23 n / R | 2010-19 n / R |
|---|---|---|---|---|---|---|---|
| Ungated (every signal) | 1845 | −0.041 | −1.46 | −0.056 | −0.026 | 2600 / −0.003 | 6526 / −0.005 |
| Gate A agree (Daily + H4 + H1 structure) | 782 | −0.049 | −1.27 | −0.065 | −0.033 | 1150 / +0.014 | 2797 / −0.020 |
| Gate A disagree | 1442 | −0.027 | −0.91 | −0.042 | −0.011 | 1982 / −0.015 | 5064 / −0.001 |
| Gate B agree (direction procedure, 3 timeframes) | 786 | −0.002 | −0.05 | −0.018 | +0.014 | 1146 / −0.009 | 2773 / −0.016 |
| Gate B disagree | 1419 | −0.056 | −1.70 | −0.071 | −0.040 | 1989 / −0.017 | 5087 / −0.004 |

- T1 (Gate A agree profitable): FAIL. OOS −0.049R a trade, month t −1.27, Holm p 0.84.
- T2 (Gate A agree beats disagree): FAIL. OOS difference −0.022R (Welch t −0.52), month-sum difference −0.001; the in-sample
  difference was +0.029R and the 2010-2019 one −0.019R. Agreeing with the higher timeframes picked nothing.
- T3 (Gate B agree profitable): FAIL. OOS −0.002R, month t −0.05, Holm p 1.00 (in sample −0.009R, 2010-2019 −0.016R).
- T4 (Gate B agree beats disagree): FAIL. OOS difference +0.054R, Welch t +1.22 (bar 2), Holm p 0.84; in sample +0.008R,
  2010-2019 −0.013R. The direction procedure's gate moved the right way out of sample but is not apart from noise and did not
  hold in the replication decade.

The streams are each run one position at a time per market, so the agree and disagree counts do not add up to the ungated one.

## Each market alone, out of sample (n / R a trade after costs (month t)); reported only, no verdict

| Market | Ungated | Gate A agree | Gate A disagree | Gate B agree | Gate B disagree |
|---|---|---|---|---|---|
| xau | 372 / +0.061 (t +1.20) | 165 / +0.170 (t +2.03) | 267 / −0.012 (t −0.19) | 161 / +0.228 (t +2.68) | 264 / −0.050 (t −0.89) |
| eurusd | 361 / −0.033 (t −0.82) | 165 / −0.033 (t −0.50) | 282 / −0.016 (t −0.34) | 159 / −0.017 (t −0.26) | 284 / −0.059 (t −1.24) |
| gbpusd | 369 / −0.073 (t −1.70) | 144 / −0.155 (t −2.24) | 305 / −0.024 (t −0.53) | 154 / −0.094 (t −1.25) | 293 / −0.057 (t −1.19) |
| usdjpy | 345 / −0.022 (t −0.43) | 142 / −0.054 (t −0.76) | 275 / +0.026 (t +0.43) | 147 / +0.045 (t +0.54) | 270 / −0.002 (t −0.03) |
| audusd | 398 / −0.131 (t −2.39) | 166 / −0.185 (t −2.35) | 313 / −0.098 (t −1.83) | 165 / −0.168 (t −2.15) | 308 / −0.103 (t −1.84) |

Gold is the one market where the gated streams look good out of sample (+0.17R / +0.23R a trade). The same gold streams were
−0.018R (Gate A) and −0.049R (Gate B) in 2020-2023 and +0.013R / +0.037R in 2010-2019 (month t under 1): it is gold's 2024-26
rise, picked after looking at one market of five, and is not evidence. Never quote the gold row as a result of this study.

## In plain words
Following the chain of timeframes (Daily, H4 and H1 on the same side), read either as plain structure or by the direction
procedure (a side changes only on an external break after a tapped higher-timeframe level), did not make the simple H1 box-break
entry pay in 2024-26, did not beat the trades against the chain, and did not do so in 2010-2019 either. Costs take about
0.015R a trade; before costs every pooled stream is within 0.04R of zero.

## Choices the pre-registration left open (also in result.json `choices`)
- Entries Monday to Friday by the UTC weekday of the fill.
- A tap = a working candle whose range touches a swing level (low <= level <= high) or overlaps an alive engulf zone; swing
  levels stay usable once known. A level counts for a candle only if it was known by that candle's start.
- The tap candle itself may close beyond the reference swing (window = the tap candle and the 20 after it).
- Weekly candles = the Daily (17:00 New York) candles grouped by Monday weeks.
- Month-sum difference = the mean over calendar months of (agree month sum − disagree month sum).
- Windows by fill time, month sums by exit month.

## What it does NOT show
- It does not test the owner's own reading of the chain by eye, nor any entry other than this one neutral H1 box break
  (2R, 48 h). A gate can still matter for a different entry; that needs its own pre-registration.
- It does not judge the timeframe chain as a forecast on its own (msnr-direction did that: 0 of 6).
- 2020-now is not untouched data for the idea (it came from 2026 charts); the 2010-2019 replication is the cleaner window,
  and both gates fail there too.
- Costs are today's demo figures for every year, OANDA mid candles, no slippage beyond the round trip.

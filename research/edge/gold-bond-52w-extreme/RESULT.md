# Result: spot gold while the US 30-year bond sits at an extreme of its 52-week range (14 Nov 2026)

**Verdict: FAIL, 0 of 2: a one-day gold buy on days the 30-year bond is in the bottom tenth of its 52-week range beat the year's every-day buy by +0.017R out of sample (n 438, month t 0.87), -0.022R in sample.**

A stand-alone study: no rule of the live gold book was read, tested or touched (docs/owner-decisions.md item 44), and none of
the book's positions was used. Pre-registration: `PREREGISTRATION.md` (pushed alone before any gold figure, commit
`c8920ffea`). Code: `run.mjs`. Every figure: `result.json`. Nothing here is an edge; nothing live changed and no proposal is
written.

Data: council-data `research/daily/xau.json` (OANDA mid spot gold, 20 Mar 2006 to 13 Nov 2026) traded;
`research/daily/usb30y.json` (OANDA mid US 30-year Treasury bond CFD, from 21 Mar 2003) as the signal; UTC days, weekends
folded into Monday (`fills.mjs` `foldWeekend`), joined by date (2 bond zone days had no gold candle). Event day = the bond's
close sits in the bottom (T1) or top (T2) tenth of the range of its last 253 closes, the day included. Trade: long gold at
that day's close, stop 2 x ATR(20), out at the next close; $0.60 a round trip plus nights x `FIN.xau.long` x entry.
Baseline: the same one-day buy on every gold day of the same year; excess = event net R minus that year's baseline mean.
t on calendar-month sums of the excess; Holm over the two out-of-sample p values; placebo = 40 seeded draws of random gold
days of the same year (keeps gold's drift and volatility, removes the bond's information).

## Results (R a trade; IS = 2007-16, OOS = 2017 to Oct 2026)

| Test | Window | n | excess | month t | net | gross | baseline | win % | net 2x costs |
|---|---|---|---|---|---|---|---|---|---|
| T1 bond bottom tenth (primary) | IS | 160 | -0.022 | -0.72 | -0.056 | -0.036 | -0.034 | 45 | -0.075 |
| | OOS | 438 | +0.017 | 0.87 | -0.001 | +0.022 | -0.018 | 49.1 | -0.023 |
| T2 bond top tenth | IS | 449 | +0.020 | 1.27 | +0.005 | +0.027 | -0.015 | 49 | -0.017 |
| | OOS | 154 | +0.033 | 1.05 | +0.046 | +0.068 | +0.013 | 52.6 | +0.024 |

Net-R month t: T1 -1.86 IS, -0.04 OOS; T2 0.34 IS, 1.47 OOS. A one-day hold makes "total net over total days" equal to the
net R a trade (`totalNetPerDay` in result.json).

| Test | OOS n | OOS excess | Holm p | placebo seeds beaten (of 40) | placebo mean | placebo max | pass |
|---|---|---|---|---|---|---|---|
| T1 | 438 | 0.017 | 0.309 | 29 | +0.007 | +0.039 | no |
| T2 | 154 | 0.033 | 0.309 | 36 | -0.004 | +0.043 | no |

## Reading

- T1 (the primary, gold when long yields sit near a one-year high): out of sample the excess is small and positive (t 0.87),
  in sample it is negative, the net R a trade is about zero out of sample and negative in sample, it loses at 2x costs, and
  it beats only 29 of 40 random-day placebos. No sign of a rebound buy.
- T2 (gold when long yields sit near a one-year low): positive in both windows (+0.020R / +0.033R excess) and positive at 2x
  costs, but t 1.27 / 1.05, Holm p 0.31, and 36 of 40 placebos beaten (the bar is 38). The out-of-sample 154 days fall in 16
  months (2019-20 mostly), so it is a few clustered episodes, not many independent ones. Not a lead on this evidence.
- The gross figures follow gold's drift in each window (the baseline moves with it); the one-day $0.60 cost and financing
  take 0.02-0.03R a trade, which is most of every difference seen.

Not tested, said plainly: other quantiles or windows (only q = 0.10 and 252 days were fixed), the 10-year note, and a
fresh-entry version (too few entries: under 30 a window).

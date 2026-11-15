# Result: spot gold when US equity volatility turns (14 Nov 2026)

**Verdict: FAIL, 0 of 3: a 5-day gold buy after S&P 500 volatility jumped against gold's beat the year's plain buy by -0.010R out of sample (n 143, month t -0.16), -0.068R in sample.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed alone and pushed first; event counts fixed before any gold
return was computed: 153 / 143, 131 / 138, 135 / 137, reproduced exactly by the run). A stand-alone study: no gate, exit, entry or
size of the live gold book, none of its positions or 2006-17 records read. Paper only; nothing live changed.

## What was tested

Signal on the S&P 500's own OANDA daily candles (`spx500`), traded on spot gold (`xau`), both UTC days with weekends folded into
Monday. RV5 / RV60 = sample sd of the last 5 / 60 daily log returns. Entry at gold's close of the event day, stop 2 x ATR(20),
out at the stop or the close of the hold's last day; $0.60 a round trip, buys pay `nights` x `FIN.xau.long` x entry. Excess =
event net R minus the same trade's mean net R on every gold day of the same year.

| Test | Event | Side | Hold |
|---|---|---|---|
| T1 (primary) | E1: (SPX RV5/RV60) / (XAU RV5/RV60) crosses up through 1.5 | buy | 5 days |
| T2 | E2: SPX RV5 crosses above its 252-day median | buy | 10 days |
| T3 | E3: SPX RV5 crosses below its 252-day median | sell | 10 days |

## Verdict table

R a trade. "Excess" = over the same year's every-day trade of the same side; t on calendar-month sums. Gross = before any cost.

| Test | Window | n | Excess | t (excess) | Net | t (net) | Gross | t (gross) | Baseline net | Net at 2x costs |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | IS 2007-16 | 153 | -0.068 | -1.21 | -0.071 | -1.21 | -0.021 | -0.36 | -0.002 | -0.120 |
| T1 | OOS 2017-26 | 143 | -0.010 | -0.16 | +0.054 | 0.86 | +0.109 | 1.71 | +0.064 | 0.000 |
| T2 | IS 2007-16 | 131 | -0.069 | -0.80 | -0.069 | -0.78 | +0.007 | 0.08 | -0.001 | -0.146 |
| T2 | OOS 2017-26 | 138 | -0.023 | -0.23 | +0.077 | 0.73 | +0.164 | 1.54 | +0.099 | -0.010 |
| T3 | IS 2007-16 | 135 | +0.076 | 0.86 | -0.013 | -0.14 | +0.005 | 0.05 | -0.089 | -0.031 |
| T3 | OOS 2017-26 | 137 | +0.022 | 0.31 | -0.135 | -1.70 | -0.120 | -1.52 | -0.157 | -0.149 |

Pass checks (out of sample), Holm over the three one-sided p values, 40 placebo seeds (a random gold day of the same month per
event) and 40 control seeds (the real event dates on a within-year day-shuffled gold path, drift and volatility kept):

| Test | OOS n | OOS excess | Holm p | Placebo beaten | Control beaten | Pass |
|---|---|---|---|---|---|---|
| T1 | 143 | -0.010 | 1 | 13 | 14 | no |
| T2 | 138 | -0.023 | 1 | 17 | 10 | no |
| T3 | 137 | 0.022 | 1 | 30 | 25 | no |

Placebo means: T1 +0.009R (range -0.105 to +0.114), T2 -0.013R, T3 -0.001R. Control means: T1 +0.010R (range -0.187 to +0.112),
T2 +0.020R, T3 -0.001R. The real figures sit inside both distributions.

## Reading

- A turn in S&P 500 volatility, whether measured against its own year (E2, E3) or against gold's volatility (E1), tells nothing
  about gold's next 5 or 10 days that an ordinary day of the same year does not. Every excess is within 0.08R of zero, no t
  reaches 1.3, the in-sample and out-of-sample signs disagree for T1 and T2, and both the placebo and the day-shuffled control
  produce figures as large.
- The positive out-of-sample net R of T1 / T2 (+0.054R, +0.077R) is gold's 2017-26 rise: the plain every-day buy made +0.064R and
  +0.099R over the same windows. T3's positive excess is the same in reverse (selling gold lost less on these days than on an
  average day of the same year, -0.135R against -0.157R), and it does not survive the placebo or the control.
- Together with `gold-haven-shock` (shock days), `gold-equity-bear`, `gold-equity-new-depth` (drawdowns) and
  `gold-equity-corr-momentum`, US equity stress read from the index's own candles has now been tested five ways as a gold signal;
  none separates gold's next days.

Not an edge; no proposal is written; nothing live changed. To repeat: `node research/edge/gold-spx-vol-regime/run.mjs` (reads
council-data with `git show`, no network, writes `result.json`, about 70 s).

# Result: trade gold only while H1, H4 and D1 all agree (14 Nov 2026)

**Verdict: FAIL, 0 of 3: the three-timeframe agreement makes about +0.02R a trade before costs and loses after them (T1 OOS -0.023R net, n 3197, month t -2.19); the D1 exit breaks even.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any number was computed). The topic was chosen by the study's
author: none of the seven candidates of the 14 Nov backlog (`research/proposals/2026-11-14-untested-backlog.md`, branch
`untested-backlog`) is a stand-alone gold rule. OANDA mid XAU/USD H1, 19 March 2006 to 13 November 2026 (124,398 H1 candles,
weekend hours dropped); H4 and D1 built on 17:00 New York blocks and read only once closed. State at each H1 close: up when the
H1, H4 and D1 closes are all above their own EMA(20), down when all are below (up 29.6 % of hours, down 21.9 %, mixed 48.5 %).
Entry at the next H1 open after the state turns, a fixed stop 2 x ATR(14) of the last closed H4 candle on every trade, $0.60 a
round trip and overnight financing on buys (`council/fills.mjs` `nights` x `FIN.xau.long`). In sample = entries 2007-16, out of
sample = 2017 to October 2026; t on calendar-month sums of net R, Holm over the three tests. A stand-alone rule: not a gate,
exit, entry or size of the live gold book (owner decision 44 untouched), and it reads nothing of it. Not an edge; no proposal;
nothing live changed.

| Test | Window | n | Win (net) | R a trade, gross | R a trade, net | Net at 2x costs | Total net | Worst DD | Month t gross | Month t net | Hold (H1) | Stops |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 both sides, exit when the agreement ends | IS 2007-16 | 3390 | 20.3 % | +0.014 | -0.037 | -0.088 | -125.1R | -126.6R | 1.56 | -3.67 | 9.4 | 64 |
|  | OOS 2017-26 | 3197 | 22.3 % | +0.018 | -0.023 | -0.065 | -74.5R | -103.7R | 1.76 | -2.19 | 9.2 | 32 |
| T2 buys only, exit when the agreement ends | IS 2007-16 | 1839 | 20.2 % | +0.007 | -0.050 | -0.106 | -91.5R | -91.5R | 0.60 | -4.16 | 9.6 | 37 |
|  | OOS 2017-26 | 1798 | 23.4 % | +0.050 | +0.006 | -0.039 | +10.2R | -27.8R | 3.29 | 0.38 | 9.8 | 19 |
| T3 both sides, exit when D1 turns | IS 2007-16 | 368 | 20.9 % | +0.115 | +0.007 | -0.101 | +2.6R | -25.6R | 0.88 | 0.06 | 161.4 | 162 |
|  | OOS 2017-26 | 368 | 20.1 % | +0.111 | -0.004 | -0.119 | -1.6R | -41.2R | 0.81 | -0.03 | 152.6 | 168 |

Month t: net R summed by exit month over every calendar month of the window (IS 120, OOS 119 months). Costs average 0.041-0.057R
a trade on T1 / T2 (a $0.60 spread against a stop of two H4 ATRs) and 0.11R on T3 (financing on buys held about a week).

## The pass bar, check by check

| Check | T1 (primary) | T2 | T3 |
|---|---|---|---|
| OOS month t >= 2, Holm p < 0.05 | no (t -2.19, p 0.029, Holm p 0.086: a loss) | no (t 0.38, Holm p 1.00) | no (t -0.03, Holm p 1.00) |
| IS net total of the same sign, positive | no (IS -125.1R, OOS -74.5R) | no (IS -91.5R) | no (OOS -1.6R) |
| OOS net > 0 at 2x costs | no (-206.5R) | no (-69.5R) | no (-43.9R) |
| Beats >= 38 of 40 placebos | yes (40; placebo median t -3.71) | yes (40; median t -1.60) | no (28; median t -0.49) |

The placebo (random entry hours, random side, holds drawn from the test's own OOS holds, the same stop and costs) loses even
more than T1 and T2, because a hold of about nine hours pays the full spread for almost no move: beating it shows only that the
agreement picks slightly better hours than chance before costs (T2 OOS gross month t 3.29), never that the rule makes money.

## What the numbers say
- **Before costs there is a small tilt, after costs none.** T1 and T2 earn +0.007 to +0.050R a trade gross in both windows;
  every one of these trades lasts nine hours on average and pays 0.04-0.06R of costs, so the net is negative in sample and at
  best flat out of sample. T2's OOS +0.006R net (t 0.38) is the long gold trend of 2017-26 showing through, not the agreement
  (its monthly net R correlates 0.41 with gold's monthly change).
- **The legs.** T1's buys: IS -0.050R net (n 1839, t -4.16), OOS +0.006R (n 1798, t 0.38); its sells: IS -0.022R (n 1551, t
  -1.38), OOS -0.061R (n 1399, t -4.55). T3's buys: IS +0.158R (n 181, t 0.71), OOS +0.259R (n 184, t 1.11); its sells: IS
  -0.139R (n 187, t -1.06), OOS -0.267R (n 184, t -2.54). The slow D1 exit is a long-gold bet that its own sells cancel: nothing
  in it is new beside the live Gold trend rule and the trend studies listed in the pre-registration (`gold-macd`,
  `gold-ichimoku`, `gold-h4-supertrend`), whose buy legs also showed positive but unproven OOS figures. The buys-only D1 exit
  was not a registered test and is not one now.
- **By year (T1, net R):** positive in 2008 (+1.0), 2013 (+9.5), 2020 (+4.3), 2025 (+15.2) and 2026 (+10.1), negative in the
  other fifteen years. T3: positive in 9 of 20 years, its two best (2011 +21.5R, 2025 +16.0R) are gold's strongest runs.
- Correlation of monthly net R with gold's monthly buy-and-hold change: T1 -0.14 IS / +0.30 OOS, T2 +0.21 / +0.41, T3 -0.11 /
  +0.02.

## What was not tested
Other EMA lengths, other timeframe ladders (M15 / H1 / H4, H4 / D1 / W1), a trailing exit, a minimum hold, or the agreement as
a filter on another entry. Each would be a re-fit of this failed rule on the same data and needs its own pre-registration on
data this study did not read; none is proposed.

To repeat: `node research/edge/gold-mtf-align/run.mjs <xau-h1.json>` (OANDA mid H1 rows `[t, o, h, l, c]`, a cache outside
git). Tests: `tests/gold-mtf-align.test.mjs`.

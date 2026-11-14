# Result: the H4 market cycle as a stand-alone directional bias on gold (14 Nov 2026)

**Verdict: FAIL, 0 of 3: after an H1 pullback ends inside an H4 move, gold goes no further the H4 way than from any hour (T1 OOS excess −0.003R, n 623, t −0.18).**

Pre-registered in `PREREGISTRATION.md` (pushed alone, before any return was computed; only event counts were read). Paper
research only: a stand-alone rule, never a gate, exit, entry or size of the live gold book, and the book's 2006-17 positions
were not used (item 44). Nothing live changed.

The owner's cycle read as direction only: H4 structure (close beyond the last 3-a-side H4 swing), an H1 break against it
after the H4 break, then the first H1 close back beyond the last H1 swing → trade the H4 way from the next H1 open to the
next New York day's 17:00 close, with a wide stop (2 x the daily ATR, median $33 in sample, $47 out of sample; 3-5 % of trades
stopped). Judged as the EXCESS over entering on every H1 open of the same side and year with the same exit and stop, so
gold's drift and the costs are in the baseline. OANDA mid H1 XAU/USD, 19 Mar 2006 to 13 Nov 2026 (125,704 candles). Net of
$0.60 a round trip and financing on buys (`nights` x `FIN.xau.long`). t on calendar-month sums; Holm over three tests
(one-sided p).

| Test | Window | n | Gross R | Net R | Excess R | t gross | t net | t excess | Holm p |
|---|---|---|---|---|---|---|---|---|---|
| T1 pullback end, vs every hour (primary) | IS 2007-16 | 679 | +0.012 | −0.011 | +0.002 | 0.68 | −0.59 | 0.11 | |
| | OOS 2017-26 | 623 | +0.003 | −0.016 | −0.003 | 0.17 | −0.92 | −0.18 | 1.000 |
| T2 H4 state alone, first hour of each NY day | IS | 1,470 | +0.009 | −0.015 | −0.002 | 0.73 | −1.24 | −0.17 | |
| | OOS | 1,282 | +0.032 | +0.013 | +0.025 | 2.41 | 1.01 | 1.95 | 0.077 |
| T3 pullback end, vs every hour in the same H4 state | IS | 679 | +0.012 | −0.011 | +0.001 | 0.68 | −0.59 | 0.08 | |
| | OOS | 623 | +0.003 | −0.016 | −0.010 | 0.17 | −0.92 | −0.65 | 1.000 |

At 2x costs (events and baseline charged twice), OOS: T1 net −0.035R, excess −0.003R; T2 net −0.005R, excess +0.025R;
T3 net −0.035R, excess −0.010R.

- **The bar, T1:** OOS excess −0.003R (needs > 0, t >= 2, Holm <= 0.05), in sample +0.002R (t 0.11), OOS net at 2x costs
  −0.035R: fails. n (679 / 623) passes. The excess is zero in both windows: the pullback's end carries no direction.
- **Placebo (sides shuffled among the OOS T1 times, 40 seeds):** mean −0.010R, 90 % band −0.035 to +0.014R; the real
  −0.003R beats 25 of 40. **Control (same UTC hour on a random day of the same year, side kept, 40 seeds):** mean −0.002R,
  band −0.026 to +0.030R; the real beats 21 of 40. The signal is where its nulls are.
- **T3 (does the pullback's end add to the H4 side alone?):** −0.010R OOS (t −0.65). Waiting for the H1 pullback to end
  adds nothing to simply being on the H4 side, as `cycle-gate` and the index / forex cycle studies found for entries.
- **T2 (the H4 side alone)** made +0.025R excess OOS (t 1.95, Holm 0.077) but −0.002R in sample (t −0.17): it fails its own
  in-sample check, and the OOS figure is mostly buys (+0.033R, t 1.79) in gold's 2017-26 rise. Not a lead: the same
  "trend side of a structure state" read has failed in sample on gold before (the 1-2-3 flip, the three-timeframe EMA).
- **By side, T1:** buys −0.007R IS / −0.013R OOS excess, sells +0.013R / +0.009R (t under 0.5 everywhere).
- **By year, T1 excess:** positive in 13 of 20 years, all within ±0.12R a trade; 2009 −0.12R and 2019 −0.11R the worst.
- Before costs every stream is within 0.04R of zero; with a stop this wide the cost is about 0.02R a trade, so this time
  the costs are not the reason: there is no gross effect.

## What this means

With the small-stop entry studies, the swing, breakout, indicator and gate versions, the owner's market cycle has now also
failed as a pure directional bias with a wide stop and a fixed one-day hold, against a baseline that holds gold's drift
fixed. The H4 / H1 structure state of gold, read this way, does not say which way the next day goes. Not an edge, not a
filter, not a council rule; nothing live changed. Not tested and not proposed: other swing sizes, holds or stop multiples
(each would be a re-fit after this result).

To repeat (candles kept out of git): `node research/edge/gold-h4-cycle-bias/run.mjs full <xau-h1.json>` (OANDA mid H1 rows
`[t, o, h, l, c]` from the site's candle proxy, as `gold-h4-pullback-resume` used); `count` prints the pre-registration's
event counts. Tests: `tests/gold-h4-cycle-bias.test.mjs`.

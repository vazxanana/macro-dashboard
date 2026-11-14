# Result: the first H4 candle of the New York day as gold's direction for the day (14 Nov 2026)

**Verdict: FAIL, 0 of 3: following gold's first H4 of the New York day loses after costs (T1 OOS −0.024R a trade, n 1,116, t −1.22; in sample −0.080R, t −4.42).**

Pre-registered in `PREREGISTRATION.md` (pushed alone, before `run.mjs` existed). Paper research only; a stand-alone intraday
rule, never a gate, exit, entry or size of the live gold book (item 44); nothing live changed.

OANDA mid H1 XAU/USD (March 2006 to 13 Nov 2026, 125,704 candles) grouped into New York days (17:00 to 17:00 New York,
`council/histdata.mjs` `nyOffsetH`). First H4 = the H1 candles starting 17:00-20:59 New York. Entry at the 21:00 New York
open, stop 1 × ATR(20 New York days), out at the 17:00 New York close; stop first, gaps at the open. Usable days 2,584 in
sample / 2,536 out of sample (the count before the run read 2,546: the run also drops a day whose candles are out of order).
Net of $0.60 a round trip and financing on buys (`nights` × `FIN.xau.long`; the hold ends at 17:00 New York, so 0 nights on
every trade: +0.000R charged). t on calendar-month sums of net R; Holm over the three tests.

| Test | IS n | IS R gross / net | IS t gross / net | OOS n | OOS R gross / net | OOS t gross / net | OOS net x2 | OOS lift (t) | Holm p | Placebo beaten |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 follow, \|body\| ≥ 0.1 ATR (primary) | 1324 | −0.042 / −0.080 | −2.30 / −4.42 | 1116 | +0.004 / −0.024 | +0.22 / −1.22 | −0.052 | −0.002 (−0.09) | 1.000 | 18 of 40 |
| T2 fade, \|body\| ≥ 0.3 ATR | 247 | +0.053 / +0.017 | +0.97 / +0.32 | 200 | +0.058 / +0.032 | +1.09 / +0.61 | +0.006 | +0.061 (+1.17) | 0.813 | 38 of 40 |
| T3 follow with the 20-day trend | 574 | −0.023 / −0.062 | −0.78 / −2.08 | 525 | +0.027 / −0.001 | +0.82 / −0.04 | −0.029 | +0.007 (+0.21) | 1.000 | 30 of 40 |

IS = New York days 2007-01 to 2016-12 (120 months), OOS = 2017-01 to 2026-10 (118 months). Lift = net R − the mean net R
of the same-side trade on every usable day of the same year (the baseline).

- **The bar, T1:** OOS net −0.024R a trade (needs > 0), month t −1.22 (needs ≥ 2 after Holm), in sample −0.080R (needs > 0),
  OOS at 2x costs −0.052R, lift over the baseline −0.002R, placebo beaten 18 of 40 (needs 38): six of seven checks fail;
  only n passes. Before costs T1 is zero out of sample (+0.004R, t 0.22) and slightly negative in sample (−0.042R, t −2.30:
  in 2007-16 the first H4's move tended to be given back, which did not repeat after 2016). Negative in 16 of 20 years (2007 to Oct 2026).
- **T2** (fade a large first H4) is the only positive stream: +0.032R net OOS (t 0.61, Holm p 0.81) and +0.017R in sample
  (t 0.32), positive at 2x cost by +0.006R, lift +0.061R (t 1.17), placebo 38 of 40. It fails only on the t, but by a wide
  margin, and its in-sample gain is all from the fade of a down candle (longs +0.200R, n 106) while the fade of an up candle
  lost (−0.120R, n 141); out of sample both sides are small (+0.023R / +0.037R). 11 of 20 years positive. Not an edge.
- **T3** (follow with the 20-day trend): −0.062R in sample, −0.001R out of sample. The trend agreement does not rescue T1.
- **Placebo** (40 seeds, seed 20261114 + s; each OOS trade replaced by a random usable day of the same year on the same side,
  same entry, stop and exit): T1's placebo median −0.023R (5th-95th −0.056 to +0.009R): T1 is exactly where a random day
  is. Costs are small here (0.028R a trade OOS: the stop is a full daily ATR), so the loss is the lack of any direction.

**Reading.** On spot gold, the direction of the first H4 after the 17:00 New York open says nothing measurable about the rest
of that New York day out of sample, followed or faded, with or without the 20-day trend. This joins `gold-us-asia`,
`gold-session-drift` and `gold-asia-break` (all FAIL): gold's sessions do not hand their direction on. Not an edge, not a
filter, not a bias input; nothing here judges the live gold book.

To repeat: `node --use-env-proxy research/edge/gold-h4-day-open/run.mjs fetch <dir>` (cache out of git), then
`node research/edge/gold-h4-day-open/run.mjs full <dir>`. Tests: `tests/gold-h4-day-open.test.mjs`.

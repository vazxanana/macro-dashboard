# Result: buy (sell) the end of a pullback inside an H4 closing-breakout trend on spot gold (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying (selling) the end of a pullback in an H4 breakout trend on gold loses after costs (T1 OOS −0.161R a trade, n 443, t −1.78; in sample −0.151R).**

Pre-registered in `PREREGISTRATION.md` (pushed alone, before `run.mjs` existed). Paper research only; a stand-alone rule,
never a gate, exit, entry or size of the live gold book (item 44); nothing live changed. The owner's idea, "if we are
bullish on H4 and the pullback finished, focus only on buys, and vice versa", written this time without any swing, ChoCh or
indicator: an H4 closing breakout of the prior 20 closes (within the last 30 H4 candles, no opposite breakout since), a
retracement of at least 38.2 % of the breakout leg without an H1 close beyond the leg's start, then the first H1 close beyond
the up-to-5 H1 candles since the pullback extreme; entry at the next H1 open, stop $0.30 past the pullback extreme, out after
48 H1 candles, one position at a time.

OANDA mid H1 XAU/USD (19 Mar 2006 to 13 Nov 2026, 125,704 candles) grouped into H4 on 17:00 New York blocks, daylight-saving
correct (32,770 candles); OANDA mid M5 (from Nov 2006) to manage each hour, stop first when one M5 candle holds both. 1,476
setups triggered (743 buys). Net of $0.60 a round trip and financing on buys (`nights` × `FIN.xau.long`, 0.000148 of price a
rollover). t on calendar-month sums of net R; Holm over the three tests.

| Test | IS n | IS R gross / net | IS t gross / net | OOS n | OOS R gross / net | OOS t gross / net | OOS net x2 | Holm p | Placebo beaten |
|---|---|---|---|---|---|---|---|---|---|
| T1 both sides, target the leg extreme (primary) | 404 | −0.012 / −0.151 | −0.12 / −1.53 | 443 | −0.036 / −0.161 | −0.40 / −1.78 | −0.286 | 1.000 | 39 of 40 |
| T2 both sides, target 2R | 662 | +0.065 / −0.052 | +1.24 / −1.00 | 681 | +0.054 / −0.051 | +1.03 / −0.98 | −0.155 | 1.000 | 40 of 40 |
| T3 buys only, target the leg extreme | 181 | −0.023 / −0.172 | −0.19 / −1.40 | 221 | −0.036 / −0.178 | −0.30 / −1.53 | −0.320 | 1.000 | 25 of 40 |

IS = trades entered 2007-01 to 2016-12 (120 months), OOS = 2017-01 to 2026-10 (118 months).

- **The bar, T1:** OOS net −0.161R a trade (needs > 0), month t −1.78 (needs ≥ 2 after Holm), in-sample net −0.151R (needs
  > 0), OOS at 2x costs −0.286R (needs > 0): four of six checks fail. n (443) and the placebo (39 of 40) pass.
- **Before costs every stream is close to zero**: T1 −0.036R / −0.012R a trade, T2 +0.054R / +0.065R (t 1.03 / 1.24). The
  cost takes 0.09-0.13R a trade (median stop $6.68 OOS, $5.36 IS on T1) and financing 0.01-0.04R on the buys. There is no
  gross effect for costs to eat.
- **By side, OOS (T1):** buys −0.178R net (n 221, t −1.53), sells −0.143R (n 222, t −1.14); in sample buys −0.182R (n 179),
  sells −0.126R (n 225). Gold's long drift does not rescue the buys (T3).
- **Exits, T1 OOS:** 309 stops, 95 targets, 39 time exits; win rate 29 %. Worst drawdown 104.7R OOS, 83.8R IS.
- **By year (T1 net R a trade, n):** 2007 +0.216 (37), 2008 −0.109 (43), 2009 −0.406 (32), 2010 −0.387 (39), 2011 −0.353
  (44), 2012 +0.227 (46), 2013 −0.320 (46), 2014 −0.555 (39), 2015 +0.143 (37), 2016 −0.001 (41), 2017 −0.210 (41), 2018
  −0.139 (50), 2019 −0.434 (43), 2020 +0.157 (41), 2021 −0.472 (53), 2022 −0.278 (47), 2023 −0.429 (37), 2024 −0.387 (38),
  2025 +0.643 (46), 2026 −0.092 (47): positive in 5 of 20 years.

## The placebo, read with care

T1 beats 39 of 40 placebo sets (placebo mean −0.267R, 90 % band −0.366 to −0.197R) while losing −0.161R itself. This is
not evidence of an edge: the placebo enters at a random hour of the same UTC day, and on these days the hours before the
trigger are the pullback itself, against the trade. Measured after the result (descriptive, not a test): on the OOS T1 days,
a same-side entry with the same stop and target distance made −0.439R gross a trade from the hours before the real entry
(4,311 hours) and +0.094R from the hours at or after it (5,587), against the real trades' −0.036R. So waiting for the H1
close beyond the recent highs is better than buying into the pullback, but no better than entering later the same day, and
none of it pays for the cost.

## What this means

The idea fails however it is written down: with swing structure (mosha-retrace +0.02R, mosha-cycle −0.22R, the live Mosha
cycle's backtest −0.574R), on other markets (index-, fx-, crypto-, commodity-cycle, all negative) and now with an
indicator-free closing breakout and a fixed retracement. Not an edge, not a filter, not a council rule; nothing live changed.
Not tested here, and not proposed: other lookbacks, retracement depths or trigger lengths (they would be a re-fit of this
rule after seeing it fail).

To repeat (candles kept out of git): `node research/edge/gold-h4-pullback-resume/run.mjs full <xau-h1.json> <xau-5m.json.gz>`
(OANDA mid H1 rows `[t, o, h, l, c]` from the site's candle proxy, as `gold-h4-pinbar` `fetch` writes them; OANDA mid M5 gzip
JSON rows, as `mosha-sweep` fetches them). Tests: `tests/gold-h4-pullback-resume.test.mjs`.

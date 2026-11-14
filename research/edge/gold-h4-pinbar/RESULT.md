# Result: the pin bar at a new 20-candle extreme on spot gold H4 (14 Nov 2026)

**Verdict: FAIL, 0 of 3: the gold H4 pin bar at a 20-candle extreme loses after costs (T1 OOS −0.065R a trade, n 156, t −0.63; in sample −0.030R).**

Pre-registered in `PREREGISTRATION.md` (pushed alone, before `run.mjs` existed). Paper research only; a stand-alone rule,
never a gate, exit, entry or size of the live gold book (item 44); nothing live changed.

OANDA mid H1 XAU/USD (March 2006 to 13 Nov 2026) aggregated to H4 on fixed UTC boundaries 22 / 02 / 06 / 10 / 14 / 18
(32,312 candles). Pin = wick ≥ 2/3 of the range on the rejection side, body in the far third, range ≥ ATR(14, H4), a new
20-candle low (high). Entry at the next H4 open, stop $0.30 past the pin's extreme, out after 12 H4 candles; stop first when
stop and target share a candle. Net of $0.60 a round trip and financing on buys (`nights` × `FIN.xau.long`, 0.000148 of price
a rollover). t on calendar-month sums of net R; Holm over the three tests; one position at a time per test.

| Test | IS n | IS R gross / net | IS t gross / net | OOS n | OOS R gross / net | OOS t gross / net | OOS net x2 | Holm p | Placebo beaten |
|---|---|---|---|---|---|---|---|---|---|
| T1 both sides, 2R (primary) | 141 | +0.065 / −0.030 | +0.63 / −0.28 | 156 | +0.014 / −0.065 | +0.13 / −0.63 | −0.143 | 1.000 | 40 of 40 |
| T2 both sides, time exit only | 138 | +0.205 / +0.105 | +1.28 / +0.65 | 154 | +0.001 / −0.083 | +0.01 / −0.70 | −0.166 | 1.000 | 23 of 40 |
| T3 bullish, 2R, D1 above SMA100 | 37 | +0.208 / +0.109 | +1.06 / +0.56 | 54 | −0.090 / −0.176 | −0.59 / −1.15 | −0.263 | 1.000 | 34 of 40 |

IS = trades entered 2008-01 to 2016-12 (108 months), OOS = 2017-01 to 2026-10 (118 months).

- **The bar, T1:** OOS net −0.065R a trade (needs > 0), month t −0.63 (needs ≥ 2 after Holm), in-sample net −0.030R (needs
  > 0), OOS at 2x costs −0.143R (needs > 0): four of six checks fail. n (156) and the placebo pass.
- **Before costs T1 is zero** in both windows (+0.065R / +0.014R a trade, t 0.63 / 0.13); the cost ($0.60 on a mean risk
  of 1.2 × ATR) takes 0.06-0.08R a trade and financing on the buys 0.015R. OOS: longs −0.184R net (n 81, t −1.42),
  shorts +0.064R (n 75, t 0.41). Win rate 37 %, 87 of 156 trades stop out, 38 reach 2R.
- **T2** (no target) had a positive in-sample figure (+0.105R net, t 0.65) that did not repeat (−0.083R OOS). **T3** (the
  trend-filtered buy) the same: +0.109R in sample on 37 trades, −0.176R on 54 OOS.
- **Placebo** (40 seeds, seed 20261114 + s; a random H4 candle at a new 20-candle extreme with range ≥ ATR and no wick or body
  condition, same side and calendar year, same stop / target / exit): T1's placebo median −0.442R a trade (5th-95th
  −0.576 to −0.271R), so T1 beats all 40. That is not evidence for the pin: a candle without a long wick usually closes near
  its extreme, so the stop sits just past the entry (risk 0.63 × ATR against the pins' 1.20) and the fixed $0.60 and the
  gaps eat it (the same candidates traded one at a time: −0.206R gross, −0.463R net, n 2,241 OOS). Beating this control
  was necessary, not sufficient; every other check fails.
- **By year (T1 net R a trade):** positive in 9 of 19 years 2008-26; 2024-26 all negative (−0.31, −0.78, −0.22).

**Reading.** On spot gold H4, a pin bar at a new 20-candle extreme does not predict a reversal well enough to pay its costs,
in either window, with or without a target or a Daily trend filter. This matches the daily studies of 14 Nov
(`candle-patterns` on 28 other markets, `gold-key-reversal`, `gold-daily-turtle-soup`: all fail). Not an edge, not a filter,
not a grade point; nothing here judges the live gold book.

To repeat: `node --use-env-proxy research/edge/gold-h4-pinbar/run.mjs fetch <dir>` (cache out of git), then
`node research/edge/gold-h4-pinbar/run.mjs full <dir>`. Tests: `tests/gold-h4-pinbar.test.mjs`.

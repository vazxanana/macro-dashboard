# vb-vol-regime: the gold and USD/JPY breakouts by realised-volatility tercile (result, 24 Nov 2026)

**Verdict: FAIL, 0 of 2. High minus low volatility tercile, net R a trade after costs: gold +0.027R in 2005-14 and −0.056R in 2015 → 20 Nov 2026 (Welch t −0.87, inside the placebo's 95th percentile 0.13R); USD/JPY +0.103R and −0.095R (Welch t −1.46, monthly-difference t −1.25, Holm p 0.221). The sign flips between the windows in both markets: no volatility regime picks the better days of T1.**

Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first). Nothing live changed, nothing is
proposed, no filter or size is adopted. Not an edge.

## What was run

T1 unchanged (`index-vol-breakout/original.mjs`: buy / sell stop at the UTC open ± 0.5 × the previous folded day's range, stop
at the open, out at 21:00 UTC), OANDA mid M5 from the shared cache. Regime of a day, known before its open: the standard
deviation of the 20 daily log returns of the folded UTC closes up to the previous close, ranked against the previous 252 days'
values; low < 1/3, high > 2/3, else mid. Costs after: gold = `gold-vol-breakout-hourcost` C1 (measured hourly spread +
commission + 0.05 × M slippage) and long financing; USD/JPY = `fx-vol-breakout` (0.000045 × price + 0.5 pip). Windows: discovery
2005-14 (gold's first labelled day 5 Apr 2007, USD/JPY 19 Jan 2006: 272 days of history are needed), confirmation 2015 → 20 Nov 2026.

**Gate:** unlabelled T1 from this cache reproduces both published figures exactly: USD/JPY 2005-15 n 2089, +0.079R; gold
2007 → 12 Nov 2026 under C1 n 3713, +0.139R.

## Every tercile (net = after costs; month t of the tercile's own monthly sums)

| Market | Window | Tercile | n | Gross R | Net R | Net 2× cost | Win | Month t |
|---|---|---|---|---|---|---|---|---|
| Gold | 2007-14 | low | 575 | +0.243 | +0.227 | +0.210 | 46.6 % | +4.05 |
| Gold | 2007-14 | mid | 374 | +0.147 | +0.131 | +0.114 | 45.2 % | +1.87 |
| Gold | 2007-14 | high | 471 | +0.266 | +0.254 | +0.242 | 48.0 % | +3.57 |
| Gold | 2015 → | low | 804 | +0.151 | +0.133 | +0.114 | 44.9 % | +2.81 |
| Gold | 2015 → | mid | 679 | +0.098 | +0.081 | +0.065 | 42.9 % | +1.58 |
| Gold | 2015 → | high | 767 | +0.092 | +0.077 | +0.063 | 44.2 % | +1.83 |
| USD/JPY | 2006-14 | low | 692 | +0.076 | +0.040 | +0.003 | 43.9 % | +0.85 |
| USD/JPY | 2006-14 | mid | 468 | +0.110 | +0.084 | +0.057 | 46.2 % | +1.54 |
| USD/JPY | 2006-14 | high | 527 | +0.165 | +0.143 | +0.121 | 48.6 % | +2.70 |
| USD/JPY | 2015 → | low | 872 | +0.186 | +0.148 | +0.109 | 47.5 % | +3.73 |
| USD/JPY | 2015 → | mid | 711 | −0.025 | −0.057 | −0.088 | 41.9 % | −1.19 |
| USD/JPY | 2015 → | high | 692 | +0.078 | +0.053 | +0.027 | 45.2 % | +1.15 |

All days: gold 1420 trades +0.210R (2007-14), 2250 +0.098R (2015 →); USD/JPY 1687 +0.084R, 2275 +0.055R.

## Tests (high − low, net R a trade)

| Test | 2005-14 diff (Welch t) | 2015 → diff (Welch t) | Monthly-difference t, 2015 → (months) / Holm p | Placebo 95th pct of abs diff | Checks failed |
|---|---|---|---|---|---|
| H1 gold | +0.027 (+0.29) | −0.056 (−0.87) | −3.42 (38) / 0.003 | 0.130 | same sign, placebo |
| H2 USD/JPY | +0.103 (+1.41) | −0.095 (−1.46) | −1.25 (35) / 0.221 | 0.096 | same sign, t / Holm, placebo |

## Reading

- The tercile ordering is not stable. In 2005-14 the high-volatility tercile did best in both markets; after 2014 the
  low-volatility tercile did best in both. Each trade difference is within its placebo band (labels shuffled at random among
  the window's days, 40 seeds).
- Gold's monthly-difference t (−3.42, Holm p 0.003) is the one strong figure, and it does not carry the test: the
  pre-registered statistic uses only months that hold trades of both terciles (38 of about 140 confirmation months; 15 in
  discovery), i.e. months in which the regime changed. Its mean (−0.82R a month) is far larger than the trade-level
  difference (−0.056R), and it is negative in discovery too, where the trade-level difference is positive. Read post hoc (not
  tested): in such months the day the volatility arrives is still labelled low by the backward-looking rank and the breakout
  catches that move. A statement about transition days, not about regimes. Whichever "difference" the pre-registration's
  same-sign check is read on, gold fails the placebo check (0.056 < 0.130), so the verdict does not depend on that reading.
- T1 is positive after costs in every tercile and window except USD/JPY's mid tercile after 2014 (−0.057R, n 711, month t −1.19);
  no tercile is worth skipping on this evidence, and no regime is worth sizing up.

Data end: gold and USD/JPY 20 Nov 2026 (cache). Files: `run.mjs`, `result.json`. Test: `tests/vb-vol-regime.test.mjs`.

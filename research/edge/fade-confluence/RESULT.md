# Fade confluence: when two or three of the Equinox fade rules agree (result)

**Verdict: FAIL, 0 of 2. When two or more of the five fade rules agree within 30 minutes, the trade makes −0.272R after costs in 2015-26 (n 118,326, month t −49.82; before costs −0.009R) and −0.224R in 2005-14 (n 109,256); with three or more, −0.342R (n 23,332, t −30.67; before costs −0.040R). Both are WORSE than the same number of random single signals (control 95th percentile −0.191R / −0.185R).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live changed,
nothing is proposed. One run, no variants. Never call any of this an edge.

## What was run

The five Equinox fade / gap rules, each through its own study's exported signal code via the Equinox desks' adapters
(`council/edge-desks-2.mjs`, read only): Break fade (`grid7-wide-fade` m15 none atr 2R), Big-candle fade (`big-candle-fade`
m15 k1.5 nobreak half), Round-number fade (`round-number-breaks` fade other 2R), Box fade (`fade-breaks-holdout` F1), FVG
return (`grid7-fvg-wide` 1h mkt large 1R). OANDA mid 5-minute candles, ten markets (xau, xag, eurusd, gbpusd, usdjpy, audusd,
nzdusd, usdcad, usdchf, eurjpy), fills 2005-01-01 to 2026-10-31, the data-quality exclusions (838 member signals dropped).
1,009,971 member signals in all.

The confluence trade: for every member signal, the number k of DISTINCT rules with a signal of the same market and side whose
fill is in the last 30 minutes (signal included; nothing after its fill is read). At k >= 2 (T2) or k >= 3 (T3): market entry
at that signal's fill, the stricter stop (the nearest of the counted members' stops that is on the losing side with risk >= the
round trip), 1R target, out after 1 day; one position at a time per market and side in each stream. Costs: `combo-grid-2`
`COSTS` (demo figures for gold and the four majors; **ASSUMED, not measured**, for xag, nzdusd, usdcad, usdchf, eurjpy).

Parity with the parent studies (each rule alone, its own exit, 2015-26, before costs): Big-candle fade +0.193R (n 54,443),
Round-number fade +0.051R (n 88,734), exactly their published figures; Break fade +0.042R (n 201,772; published 201,769) and
FVG return +0.035R (n 52,668; published 52,659), the few extra trades from the desk adapters reading candles to 1 Nov 2026.

Cut test: on every market at four dates (2009-2023), the confluence trades known by the date, computed from member signals cut
there, equal the full run's (40 cuts, 0 missing, 0 extra).

## The two tests (R a trade; month t of the after-cost month sums; Holm over 2)

| Test | Window | n | Before costs | After costs | Won | Median cost / risk | Month t | Holm p | Control (single signals, same count) p50 / p95 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| T2, k >= 2 | 2005-14 | 109,256 | +0.007 | −0.224 | 50.2 % | 0.150 | −36.87 | | −0.154 / −0.149 |
| T2, k >= 2 | 2015-26 | 118,326 | −0.009 | −0.272 | 49.4 % | 0.182 | −49.82 | 1 | −0.195 / −0.191 |
| T3, k >= 3 | 2005-14 | 24,701 | −0.020 | −0.275 | 48.9 % | 0.178 | −24.00 | | −0.149 / −0.138 |
| T3, k >= 3 | 2015-26 | 23,332 | −0.040 | −0.342 | 47.9 % | 0.224 | −30.67 | 1 | −0.196 / −0.185 |

Every one of the 1,000 control draws beat each stream in both windows. Every market is negative after costs in both windows in
both streams (T2 2015-26 from −0.212R on EUR/USD to −0.469R on silver).

## Why it is worse, not better

1. **Agreement does not pick better moves.** Before costs the k >= 2 trade makes −0.009R in 2015-26 and k >= 3 −0.040R, against
   +0.008R for all single signals under the same 1R / 1-day exit (n 536,337). More detectors firing at once on one move marks a
   STRONGER move, and fading a stronger move does worse, not better.
2. **The stricter stop raises the cost per R.** The nearest member stop makes the median cost 0.18R (T2) and 0.22R (T3) a trade in
   2015-26, against 0.13R for single signals.
3. **Which rules agree** (T2, 2015-26, before → after costs): Box fade + Break fade, the most common pair (n 32,127), +0.065R →
   −0.140R; Break fade + FVG +0.013R → −0.195R; every pair with the Big-candle fade or the Round-number fade is negative before
   costs (e.g. Break fade + Round-number −0.039R, n 13,649). A before-cost tilt is not an edge, and no pair is positive after costs.

## Each rule alone (2015-26, R a trade)

| Rule | n | Own exit before / after | 1R, 1 day, own stop before / after |
|---|---:|---:|---:|
| Break fade | 201,772 | +0.042 / −0.118 | +0.037 / −0.124 |
| Big-candle fade | 54,443 | +0.193 / −0.246 | −0.135 / −0.574 |
| Round-number fade | 88,734 | +0.051 / −0.307 | −0.054 / −0.412 |
| Box fade | 138,713 | +0.050 / −0.052 | +0.050 / −0.052 |
| FVG return | 52,668 | +0.035 / −0.113 | +0.035 / −0.113 |

## How this differs from grid6-confluence

`grid6-confluence` (FAIL, 0 of 21) scored ten context readings agreeing with one H1 trigger. Here every member is a complete entry
rule that passed before costs alone, and the question is agreement in time. The answer is the same, and stronger: agreement
between these fade detectors makes the trade worse before costs and much worse after.

## Caveats

- The confirmation window is not new data: every parent grid read 2015-26. A pass would have needed a holdout; a fail needs none.
- Five markets carry assumed costs; the result holds before any cost, so it does not rest on them.
- One window (30 min), one exit (1R, 1 day), one stop rule (the stricter). Per the pre-registration no other window, exit or k
  is run on these years.

## To repeat

`node research/edge/fade-confluence/run.mjs market <m> <dir>` for the ten markets (about 20-50 s each, the `edgekit` cache), then
`node research/edge/fade-confluence/run.mjs report <dir>`. Test: `tests/fade-confluence.test.mjs`.

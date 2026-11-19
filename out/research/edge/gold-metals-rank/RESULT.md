# Result: gold's place among the four precious metals by 20-day return (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold when it ranks last of the four made +0.020R a trade over the every-day long OOS (n 146, t 0.33), lost to it in 2007-16 and beat 24 of 40 placebos.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any outcome was computed; only signal and entry
counts were looked at). Paper research only, a **stand-alone rule on spot gold**: not a gate, entry, exit or size of the live
gold book, and that book's 2006-17 positions were not read (owner decision 44). Silver, platinum and palladium were read, never
traded. No live rule, size, filter, stop, config, cost constant or council member changed. No proposal is written. Not an edge.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json`, `xag.json`, `xpt.json`, `xpd.json` at commit
  `338cfb45`, weekends folded with `foldWeekend`; 5,315 common days with a 20-day return for all four.
- Rank of gold = how many of silver, platinum, palladium had a higher 20-day return on the day. T1 (primary): gold last → buy
  gold. T2: gold first → sell gold. T3: gold first → buy gold. Next open, stop 2 x ATR(20), out at the 5th close, one at a time.
- Costs: $0.60 a round trip plus `nights()` x `FIN.xau.long` x entry on buys (sells: nothing).
- Baseline: the same-side trade after every common day of the same calendar year; excess = net R minus that year's baseline.
- Placebo: 40 seeds, the same number of entries per year drawn from that year's common days.
- Control: 40 seeds, the other three metals' 20-day returns shuffled across days of the same year (gold's own path and return
  kept), rank recomputed, test re-run.

## Results (net of costs; t on calendar-month sums)

| Test | Window | n | Gross R | Net R | Net at 2x | Net t | Excess over baseline | Excess t |
|---|---|---|---|---|---|---|---|---|
| T1 last → buy | 2007-16 | 156 | +0.007 | −0.041 | −0.089 | −0.70 | −0.062 | −1.03 |
| T1 last → buy | 2017-26 | 146 | +0.144 | +0.093 | +0.042 | 1.46 | +0.020 | 0.33 |
| T2 first → sell | 2007-16 | 167 | −0.069 | −0.085 | −0.101 | −1.16 | −0.017 | −0.25 |
| T2 first → sell | 2017-26 | 181 | −0.080 | −0.093 | −0.106 | −1.78 | +0.017 | 0.34 |
| T3 first → buy | 2007-16 | 170 | +0.060 | +0.015 | −0.031 | 0.23 | +0.011 | 0.19 |
| T3 first → buy | 2017-26 | 182 | +0.111 | +0.062 | +0.013 | 1.15 | −0.003 | −0.07 |

Holm (one-sided, OOS excess t): T1 p 0.371 → 1, T2 0.367 → 1, T3 0.528 → 1.

Placebo (OOS excess t, real beats n of 40; placebo median): T1 24 (0.15), T2 29 (0.00), T3 18 (−0.01).
Control (other metals shuffled within the year; real beats n of 40; control median): T1 25 (0.23), T2 15 (0.46), T3 31 (−0.37).
The control's runs have about twice the entries (median 315-345 against 146-182), because shuffling also breaks the day-to-day
persistence of the rank; its excess is still within ±0.02R of zero, like the real rule's.

## Reading

- The OOS buys look positive (T1 +0.093R, T3 +0.062R a trade net) only because gold rose in 2017-26: the every-day long of the
  same years made +0.061R, and the excess over it is +0.020R and −0.003R, t 0.33 and −0.07.
- Gold being the laggard of the metals says nothing measurable about its next week: T1 lost to the every-day long in 2007-16
  (−0.062R, t −1.03) and sits at the placebo and control medians out of sample.
- Gold leading the metals neither reverses (T2) nor continues (T3): every excess is within ±0.02R of zero in both windows.
- Pass checks failed: OOS excess t >= 2 with Holm (all three), in-sample excess > 0 (T1, T2), 2x costs (T2), placebo and control
  38 of 40 (all three). Never call the rank of gold among the metals an edge; do not use it as a filter.

To repeat: `node research/edge/gold-metals-rank/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-metals-rank/run.mjs full <dir>`. Test: `tests/gold-metals-rank.test.mjs`.

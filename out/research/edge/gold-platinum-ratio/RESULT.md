# Result: the gold / platinum and gold / palladium ratios as a signal for spot gold (14 Nov 2026)

**Verdict: FAIL, 0 of 3: a gold / platinum ratio extreme does not predict gold (reversion on gold, OOS 2017-26 −0.112R a trade net, n 67, month t −1.13); palladium and monthly relative momentum fail too.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed and pushed alone before any number). Paper research
only, a **standalone cross-asset signal traded on spot gold**: not a gate, entry, exit or size of the live gold book, and
nothing here was compared with or applied to that book (owner decision 44). Platinum and palladium were read, never traded
(`council/fills.mjs` has no cost model for them). No live rule, size, filter, stop, config, cost constant or council member
changed. No proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json`, `xpt.json`, `xpd.json` at commit `4c6e8f7d`
  (gold 2006-03-20 to 2026-11-06; platinum and palladium from 2005-01-04), weekends folded with `foldWeekend`, days matched by
  their UTC stamp (5,331 joint days for each pair).
- T1 / T2: z of ln(gold / metal) against the 250 joint days before; z >= 2 → sell gold, z <= −2 → buy gold, held 10 gold
  candles. T3: on the last joint day of each month, gold's 21-day return against platinum's: gold ahead → long gold for 21
  candles, behind → short. Entry at gold's next daily open; stop 3 x ATR(20), fixed; one position at a time per test.
- Costs: $0.60 a trade ($0.30 spread + $0.15 slippage on each of two market orders) and `nights() x FIN.xau.long` on longs.
  In sample = first signal (2007-03 for T1 / T2, 2006-04 for T3) to 2016-12; out of sample 2017-01 to 2026-10 (signal date).

## The three tests

| Test | Window | n (long / short) | Win % | Gross R a trade | Net R a trade | Net at 2x | Month t gross | Month t net | Total net R |
|---|---|---|---|---|---|---|---|---|---|
| T1 gold / platinum z (primary) | IS 2007-16 | 70 (26 / 44) | 48.6 | −0.023 | −0.048 | −0.072 | −0.24 | −0.49 | −3.33 |
| | OOS 2017-26 | 67 (14 / 53) | 44.8 | −0.093 | −0.112 | −0.131 | −0.94 | −1.13 | −7.50 |
| T2 gold / palladium z | IS 2007-16 | 80 (40 / 40) | 37.5 | −0.103 | −0.137 | −0.171 | −1.10 | −1.46 | −10.95 |
| | OOS 2017-26 | 64 (35 / 29) | 54.7 | +0.036 | −0.011 | −0.059 | +0.40 | −0.13 | −0.73 |
| T3 monthly gold vs platinum momentum | IS 2006-16 | 119 (68 / 51) | 42.0 | +0.061 | +0.005 | −0.051 | +0.66 | +0.06 | +0.61 |
| | OOS 2017-26 | 104 (59 / 45) | 51.0 | +0.129 | +0.064 | −0.002 | +1.26 | +0.64 | +6.62 |

OOS net R a trade, as tested: T1 | −0.112 |, T2 | −0.011 |, T3 | +0.064 |.

| Test | One-sided p | Holm p | OOS t >= 2 and Holm < 0.05 | IS net > 0 | OOS > 0 at 2x | n >= 30 | Above placebo p95 | Pass |
|---|---|---|---|---|---|---|---|---|
| T1 | 0.871 | 1.000 | no | no | no | yes | no | no |
| T2 | 0.552 | 1.000 | no | no | no | yes | no | no |
| T3 | 0.261 | 0.783 | no | yes | no | yes | no | no |

## Placebo (40 seeds: random OOS days, as many as the real trades, the real side mix, same rule)

| Test | Draws | p5 | Median | p95 | Real OOS month t | Seeds at or above the real |
|---|---|---|---|---|---|---|
| T1 | 67 | −2.60 | −1.11 | +0.67 | −1.13 | 20 of 40 |
| T2 | 64 | −1.45 | −0.21 | +1.33 | −0.13 | 17 of 40 |
| T3 | 104 | −2.78 | −0.19 | +1.78 | +0.64 | 10 of 40 |

## Reading

- **T1**: gold sat rich against platinum for most of 2018-25, so the reversion rule was short gold 53 times out of 67 in a
  gold bull market and lost; before costs it already lost (−0.093R). Its month t sits at the placebo's median: random days
  with the same short-heavy side mix do as badly, so the ratio adds nothing beyond "mostly short gold".
- **T2**: palladium's ratio is noise both ways (IS −0.137R, OOS −0.011R).
- **T3**: the one positive stream (+0.064R a trade net OOS, t 0.64) is under a t of 1, is gone at 2x costs (−0.002R) and
  sits inside the placebo band (10 of 40 seeds at or above it). Years swing from −5.5R (2022) to +6.2R (2023).
- Nothing here is an edge; nothing suggests a variant worth a second test on the same data.

To repeat: `node research/edge/gold-platinum-ratio/run.mjs fetch <dir>` (copies the three files out of `origin/council-data`
with `git show`, no network; keep `<dir>` out of git), then `… full <dir>`. Tests: `tests/gold-platinum-ratio.test.mjs`.

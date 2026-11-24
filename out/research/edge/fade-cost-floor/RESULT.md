# Fade rules with a cost floor (result)

**Verdict: FAIL, 0 of 15 tests pass. Keeping only the trades whose round trip is a small share of the risk (cost_R <= 0.03 /
0.05 / 0.10) does not make any of the five Equinox fade / gap rules positive after costs in 2015-26 with month t >= 2; the
nearest, FVG return at cost_R <= 0.03, is +0.026R a trade after costs (n 4,118, month t 1.23, Holm p 1.00). For three of
the five rules the before-cost tilt itself vanishes in the low-cost trades.**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants. A before-cost tilt is not an edge, and none of these rules has one after costs.

## What was run

The five rules' trades from their studies' own exported signal code, unchanged, through the Equinox desks' adapters
(`council/edge-desks-2.mjs`): Break fade (`grid7-wide-fade` m15 none atr 2R all), Big-candle fade (`big-candle-fade` m15 k1.5
nobreak half), Round-number fade (`round-number-breaks` fade other 2R), Box fade (`fade-breaks-holdout` F1), FVG return
(`grid7-fvg-wide` 1h mkt large 1R). Ten markets, OANDA mid 5-minute candles (`edgekit`), fills 2005-01-01 to 2026-10-31, the
data-quality exclusions dropped, open trades dropped. Selection: cost_R = COSTS[market] / |fill - stop|, both as placed at the
entry (the fill is the next 5-minute open); nothing else. Costs `combo-grid-2` `COSTS` (measured demo figures for xau, eurusd,
gbpusd, usdjpy, audusd; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy). Discovery 2005-14, confirmation
2015-26, month-sum t, Holm over the 15 tests, a seeded coin-side control.

## Gate (harness parity): passed for all five

| Rule | Window | Here n / R before costs | Study n / R |
|---|---|---:|---:|
| Break fade | 2005-14 / 2015-26 | 171,515 +0.054 / 201,771 +0.042 | 171,523 +0.054 / 201,769 +0.042 |
| Big-candle fade | 2005-14 / 2015-26 | 47,354 +0.307 / 54,443 +0.193 | 47,354 +0.307 / 54,443 +0.193 |
| Round-number fade | 2005-14 / 2015-26 | 94,177 +0.102 / 88,734 +0.051 | 94,188 +0.102 / 88,734 +0.051 |
| Box fade | holdout set A (5 read markets, 2005-09) | 28,983 +0.0574 | 29,000 +0.0573 |
| FVG return | 2005-14 / 2015-26 | 45,209 +0.042 / 52,668 +0.035 | 45,278 +0.042 / 52,659 +0.035 |

All within 2 % on n and 0.01R on the mean; no harness fix was needed.

## The 15 tests

R a trade; "net" = after costs; t = month-sum t; coin = the same kept trades with the side drawn by a seeded coin; diff t =
month-sum t of the paired difference faded minus coin (2015-26); share = kept trades / all trades of the rule in 2015-26.

| Rule | cost_R <= | n 05-14 | before / net 05-14 (t) | n 15-26 | before / net 15-26 (t) | Holm | coin net 15-26 (t) | diff t | share 15-26 | Pass |
|---|---:|---:|---|---:|---|---:|---|---:|---:|---|
| Break fade | 0.03 | 4,930 | -0.022 / -0.046 (-2.83) | 1,782 | -0.031 / -0.054 (-1.48) | 1.00 | -0.035 (-0.87) | -0.49 | 0.9 % | no |
| Break fade | 0.05 | 24,836 | +0.013 / -0.024 (-2.21) | 11,860 | -0.009 / -0.048 (-3.18) | 1.00 | -0.042 (-2.96) | -0.30 | 5.9 % | no |
| Break fade | 0.10 | 90,287 | +0.036 / -0.028 (-4.27) | 72,710 | +0.020 / -0.050 (-8.08) | 1.00 | -0.081 (-13.66) | 3.92 | 36.0 % | no |
| Big-candle fade | 0.03 | 52 | +0.305 / +0.280 (1.30) | 51 | -0.178 / -0.201 (-1.03) | 1.00 | +0.109 (0.65) | -1.09 | 0.1 % | no |
| Big-candle fade | 0.05 | 366 | +0.021 / -0.019 (-0.28) | 228 | -0.177 / -0.215 (-2.65) | 1.00 | +0.089 (1.03) | -2.68 | 0.4 % | no |
| Big-candle fade | 0.10 | 3,215 | +0.035 / -0.040 (-1.17) | 1,794 | +0.033 / -0.041 (-1.37) | 1.00 | -0.040 (-1.03) | -0.03 | 3.3 % | no |
| Round-number fade | 0.03 | 993 | +0.064 / +0.041 (0.96) | 1,116 | -0.053 / -0.073 (-1.33) | 1.00 | +0.039 (0.86) | -2.11 | 1.3 % | no |
| Round-number fade | 0.05 | 3,851 | +0.023 / -0.013 (-0.49) | 3,099 | -0.007 / -0.040 (-1.55) | 1.00 | -0.044 (-1.96) | 0.18 | 3.5 % | no |
| Round-number fade | 0.10 | 15,610 | +0.039 / -0.027 (-2.34) | 10,262 | +0.004 / -0.059 (-3.74) | 1.00 | -0.047 (-2.71) | -0.64 | 11.6 % | no |
| Box fade | 0.03 | 19,928 | +0.054 / +0.033 (3.12) | 11,987 | +0.018 / -0.003 (-0.21) | 1.00 | -0.015 (-1.67) | 0.73 | 8.6 % | no |
| Box fade | 0.05 | 46,174 | +0.054 / +0.022 (3.03) | 33,614 | +0.027 / -0.006 (-0.76) | 1.00 | -0.027 (-5.10) | 1.88 | 24.2 % | no |
| Box fade | 0.10 | 87,179 | +0.054 / +0.003 (0.59) | 87,469 | +0.046 / -0.012 (-2.24) | 1.00 | -0.064 (-17.31) | 9.18 | 63.1 % | no |
| FVG return | 0.03 | 6,170 | +0.055 / +0.034 (2.50) | 4,118 | +0.046 / +0.026 (1.23) | 1.00 | -0.019 (-1.25) | 1.56 | 7.8 % | no |
| FVG return | 0.05 | 13,888 | +0.057 / +0.026 (2.79) | 10,729 | +0.049 / +0.016 (1.31) | 1.00 | -0.036 (-4.34) | 3.37 | 20.4 % | no |
| FVG return | 0.10 | 27,517 | +0.055 / +0.003 (0.45) | 26,638 | +0.049 / -0.009 (-1.31) | 1.00 | -0.070 (-10.07) | 6.52 | 50.6 % | no |

Checks passed: positive after costs in both windows 2 of 15 (FVG at 0.03 and 0.05); n >= 200 in 2015-26 14 of 15 (Big-candle at
0.03 has 51); month t >= 2 after Holm 0 of 15; the coin control 4 of 15. No test has all four.

## What it shows

- **The tilt does not concentrate where the cost is small.** For Break fade, Big-candle fade and Round-number fade the
  before-cost mean in the kept trades is lower than in all trades and turns negative at the tightest floor (Break fade 2015-26:
  +0.042R on all trades, +0.020R at <= 0.10, -0.009R at <= 0.05, -0.031R at <= 0.03, n 1,782; Big-candle fade +0.193R on all,
  +0.033R at <= 0.10, -0.177R at <= 0.05, n 228). The trades with a wide stop relative to the cost are the volatile ones, and
  in them fading does not pay. So most of these rules' before-cost tilt sits in the small-stop trades the cost eats.
- **Box fade and FVG return keep their tilt** at every floor (+0.018 to +0.049R before costs in 2015-26), but the round trip
  still takes it: at cost_R <= 0.03 the before-cost tilt is about 0.02R, so nothing is left. Their paired difference against
  the coin side is clear at the looser floors (diff t 3.37 to 9.18: the fade side is better than a random side), which says the
  tilt is real before costs, not that it pays.
- **FVG return at cost_R <= 0.03** is the one test positive after costs in both windows: +0.034R (n 6,170, t 2.50) in 2005-14,
  +0.026R (n 4,118, t 1.23) in 2015-26; on the five measured-cost markets alone +0.043R in 2015-26 (n 2,618, t 1.80,
  descriptive). Year by year in 2015-26 it is negative in 6 of 12 years; by market in 2015-26 it is carried by gold (+0.131R)
  and silver (+0.224R, assumed cost), with gbpusd, nzdusd and usdcad negative. Short of the bar, picked from 15 looks, and
  not a candidate.
- The coin control is itself negative after costs nearly everywhere (it pays the cost with no tilt), so "volatile days pay any
  side" is not what is going on; it simply never had a profit to explain.

## Caveats

- Mid candles; one fixed round trip in price units for twenty years (spreads were wider in 2005-10, so discovery net figures
  flatter the rules); no slippage beyond the round trip; five markets' costs are assumed.
- The trades come through the Equinox desks' adapters, not each study's own loop; the gate above reproduces every study's
  published counts and means within 0.2 % and 0.0005R (box fade's set A: 17 fewer trades of 29,000).
- `cost_R` is known at the entry for every rule (market entry at the next 5-minute open; each stop is set at that moment), so
  the selection uses no future data.

Nothing live changed. The five desks stay paper records before costs; never quote a cost-floored subset of them as an edge.

## Files

`run.mjs` (`market <m> <outDir>`, `report <outDir>`), `result.json`, `tests/fade-cost-floor.test.mjs`. Per-market trade files
were kept outside git.

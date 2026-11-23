# Key levels as the fade's targets and stops (result)

**Verdict: PASS. 2 of 6 key-level exits or stops beat the grid's 2R / 1-ATR fade on the same trades before costs; best P3 (zone target and zone stop - grid, all hours) +0.029R a trade in 2015-26 (n 201,769, month t 7.92; 2005-14 +0.053R, t 13.46), only +0.009 in ATR units and -0.060R after costs.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

`grid7-wide-fade`'s M15 fade (the first close beyond the last confirmed M15 swing, faded at the next 5-minute open; its own
code, imported), on the grid's own trades, with three exits and two stops. Exits: **2R** (the grid's); **zone**: the near side
of the nearest standing H1 / H4 level in front of the trade (engulf, dominant, supply / demand zone, or a V / A turn of the
closes), when 1R or more away, else 2R; **swing**: the broken swing's opposite swing, else 2R. Stops: **ATR** (1 x M15 ATR,
the grid's); **zone**: past the far side of the nearest standing level behind the trade + 0.1 ATR, when within 2 ATR, else
the ATR stop. All hours, and the 20-23 UTC block. Ten markets pooled, OANDA mid 5-minute candles, 2005-14 and 2015-26.
Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## Gate and cut test

- grid 2005-14: n 171,523, +0.054 (wanted n 171,523, +0.054): equal.
- grid 2015-26: n 201,769, +0.042 (wanted n 201,769, +0.042): equal.
- fade-conditions 20-23, 2015-26: n 27,671, +0.169 (wanted n 27,671, +0.169): equal.
- Cut test: 6 cuts on xau, eurusd: 122,805 signals with their stop and target levels known by the cut dates, 0 missing or extra when the candles are cut there.
- Every stop on the losing side of its fill and every target on the winning side (the run throws otherwise).
- Trades whose key-level variant was still open when the data ends (closed at the last close, so every cell keeps the same trades): 1.

## Primary tests (paired by trade, before costs)

Mean of R(variant) - R(2R exit, ATR stop) per trade; t of its calendar-month sums. p = the larger one-sided p of the two
windows; Holm over the six. "ATR units" = the same difference in money at a fixed size per M15 ATR (R x risk / ATR).

| Test | What | n 05-14 | diff 05-14 (t) | n 15-26 | diff 15-26 (t) | ATR units 15-26 (t) | after costs 15-26 (t) | Holm | Pass |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| P1 | zone target, ATR stop - grid, all hours | 171,523 | +0.007 (4.38) | 201,769 | +0.001 (0.96) | +0.001 (0.96) | +0.001 (0.96) | 0.341 | no |
| P2 | zone stop, 2R - grid, all hours | 171,523 | +0.017 (5.46) | 201,769 | +0.004 (1.40) | +0.003 (1.13) | -0.084 (-26.16) | 0.244 | no |
| P3 | zone target and zone stop - grid, all hours | 171,523 | +0.053 (13.46) | 201,769 | +0.029 (7.92) | +0.009 (3.11) | -0.060 (-16.15) | 0.000 | yes |
| P4 | zone target, ATR stop - grid, 20-23 UTC | 26,275 | +0.011 (2.39) | 27,671 | -0.005 (-0.95) | -0.005 (-0.95) | -0.005 (-0.95) | 0.828 | no |
| P5 | zone stop, 2R - grid, 20-23 UTC | 26,275 | +0.022 (3.22) | 27,671 | +0.014 (1.99) | -0.009 (-1.22) | -0.049 (-6.96) | 0.096 | no |
| P6 | zone target and zone stop - grid, 20-23 UTC | 26,275 | +0.076 (7.69) | 27,671 | +0.041 (4.40) | -0.006 (-0.82) | -0.023 (-2.47) | 0.000 | yes |

## Every cell

R a trade before costs (month-sum t), median R and share of wins; after costs beside (month-sum t).

| Cell | n 05-14 | R 05-14 (t) | median / wins 05-14 | net 05-14 (t) | n 15-26 | R 15-26 (t) | median / wins 15-26 | net 15-26 (t) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2R exit, atr stop, all | 171,523 | +0.054 (11.38) | -1.000 / 35.5% | -0.088 (-15.56) | 201,769 | +0.042 (11.33) | -1.000 / 35.1% | -0.118 (-28.34) |
| zone exit, atr stop, all | 171,523 | +0.062 (12.45) | -1.000 / 36.7% | -0.081 (-14.37) | 201,769 | +0.044 (11.76) | -1.000 / 36.2% | -0.117 (-27.79) |
| swing exit, atr stop, all | 171,523 | +0.055 (8.85) | -1.000 / 27.3% | -0.088 (-12.64) | 201,769 | +0.038 (8.65) | -1.000 / 27.3% | -0.123 (-25.33) |
| 2R exit, zone stop, all | 171,523 | +0.071 (16.05) | -1.000 / 36.0% | -0.146 (-24.32) | 201,769 | +0.047 (12.77) | -1.000 / 35.2% | -0.203 (-49.86) |
| zone exit, zone stop, all | 171,523 | +0.107 (17.70) | -1.000 / 33.2% | -0.110 (-15.37) | 201,769 | +0.071 (15.38) | -1.000 / 32.5% | -0.178 (-34.93) |
| swing exit, zone stop, all | 171,523 | +0.113 (14.03) | -1.000 / 23.7% | -0.104 (-11.28) | 201,769 | +0.071 (11.58) | -1.000 / 23.7% | -0.178 (-27.60) |
| 2R exit, atr stop, 20-23 | 26,275 | +0.204 (18.01) | -1.000 / 40.8% | +0.046 (4.03) | 27,671 | +0.169 (14.09) | -1.000 / 39.3% | -0.015 (-1.23) |
| zone exit, atr stop, 20-23 | 26,275 | +0.215 (18.14) | -1.000 / 41.8% | +0.057 (4.73) | 27,671 | +0.165 (13.88) | -1.000 / 40.1% | -0.019 (-1.60) |
| swing exit, atr stop, 20-23 | 26,275 | +0.216 (13.03) | -1.000 / 31.4% | +0.059 (3.53) | 27,671 | +0.151 (10.65) | -1.000 / 31.0% | -0.033 (-2.34) |
| 2R exit, zone stop, 20-23 | 26,275 | +0.226 (19.54) | -1.000 / 41.3% | +0.008 (0.68) | 27,671 | +0.183 (15.28) | -1.000 / 39.7% | -0.064 (-5.35) |
| zone exit, zone stop, 20-23 | 26,275 | +0.280 (19.13) | -1.000 / 39.5% | +0.061 (4.16) | 27,671 | +0.210 (15.78) | -1.000 / 37.8% | -0.037 (-2.76) |
| swing exit, zone stop, 20-23 | 26,275 | +0.298 (14.22) | -1.000 / 29.0% | +0.079 (3.83) | 27,671 | +0.193 (10.77) | -1.000 / 28.9% | -0.054 (-3.04) |

## How often the levels were used

| Hours | trades | zone stop used | zone target used (ATR stop) | zone target used (zone stop) | swing fell back to 2R |
|---|---:|---:|---:|---:|---:|
| all | 373,292 | 71.1% | 56.9% | 64.5% | 6.9% |
| 20-23 | 53,946 | 61.7% | 54.8% | 58.8% | 4.5% |

## Per market, primary differences (before costs)

| Market | P1 05-14 / 15-26 | P2 05-14 / 15-26 | P3 05-14 / 15-26 | P4 05-14 / 15-26 | P5 05-14 / 15-26 | P6 05-14 / 15-26 |
|---|---:|---:|---:|---:|---:|---:|
| xau | +0.004 / -0.008 | +0.015 / -0.002 | +0.034 / -0.001 | +0.009 / -0.010 | +0.016 / -0.012 | +0.033 / -0.034 |
| xag* | +0.002 / +0.008 | +0.007 / +0.001 | +0.002 / +0.012 | +0.037 / -0.008 | +0.049 / -0.021 | +0.078 / -0.012 |
| eurusd | +0.005 / -0.000 | +0.007 / +0.005 | +0.042 / +0.030 | +0.018 / -0.010 | +0.024 / +0.010 | +0.043 / +0.041 |
| gbpusd | -0.003 / +0.004 | +0.016 / -0.003 | +0.057 / +0.024 | +0.014 / -0.010 | +0.024 / -0.005 | +0.069 / +0.011 |
| usdjpy | +0.014 / -0.001 | +0.044 / +0.010 | +0.083 / +0.020 | +0.004 / -0.001 | +0.031 / +0.012 | +0.096 / +0.012 |
| audusd | +0.008 / +0.002 | +0.022 / +0.021 | +0.067 / +0.049 | +0.007 / +0.007 | +0.019 / +0.040 | +0.107 / +0.072 |
| nzdusd* | +0.007 / +0.002 | +0.028 / +0.010 | +0.066 / +0.030 | +0.009 / -0.019 | +0.049 / +0.030 | +0.112 / +0.041 |
| usdcad* | +0.007 / +0.005 | -0.001 / -0.000 | +0.060 / +0.046 | -0.003 / +0.008 | -0.008 / +0.040 | +0.088 / +0.110 |
| usdchf* | +0.016 / +0.004 | +0.007 / -0.015 | +0.054 / +0.016 | +0.024 / +0.002 | +0.028 / -0.012 | +0.076 / +0.026 |
| eurjpy* | +0.010 / +0.000 | +0.022 / +0.014 | +0.041 / +0.052 | +0.005 / -0.007 | +0.005 / +0.017 | +0.039 / +0.077 |

* cost ASSUMED.

## Trades

| Market | candles from | M15 signals | H1 / H4 levels | trades |
|---|---|---:|---:|---:|
| xau | 2006-03-19 | 35,387 | 141,717 | 35,212 |
| xag | 2006-03-19 | 35,575 | 140,045 | 23,331 |
| eurusd | 2004-01-01 | 39,580 | 155,589 | 39,526 |
| gbpusd | 2004-01-01 | 39,311 | 155,129 | 39,226 |
| usdjpy | 2004-01-01 | 38,671 | 154,755 | 38,598 |
| audusd | 2004-01-01 | 40,108 | 155,362 | 40,046 |
| nzdusd | 2004-01-01 | 39,757 | 154,662 | 39,724 |
| usdcad | 2004-01-01 | 39,996 | 155,186 | 39,915 |
| usdchf | 2004-01-01 | 39,250 | 152,926 | 39,174 |
| eurjpy | 2004-01-01 | 38,581 | 154,679 | 38,540 |

## What it means

P3 and P6 clear the pre-registered bar: on the grid's own trades, before costs, a key-level target together with a
key-level stop raises R a trade over the fixed 2R / 1-ATR exit in both decades. That is all the pass says, and two columns
take most of it back:

- **P3** (zone target and zone stop - grid, all hours): +0.029R a trade in 2015-26 (t 7.92), but +0.009 in ATR units (t 3.11) and -0.060R after costs (t -16.15).
- **P6** (zone target and zone stop - grid, 20-23 UTC): +0.041R a trade in 2015-26 (t 4.40), but -0.006 in ATR units (t -0.82) and -0.023R after costs (t -2.47).

The zone stop is tighter than the 1-ATR stop on average, so the same move is more R; at a fixed size per ATR the gain
shrinks to a few thousandths of an ATR (all hours) or turns negative (20-23 UTC), and a tighter stop pays the round trip on
a smaller risk, so every zone-stop cell is worse than the grid after costs. The zone target alone (P1, P4) adds nothing in
2015-26. The fade itself still loses after costs in every all-hours cell. Not an edge; nothing is adopted; the levels do
not make this fade tradable. One run, no variants on these years.

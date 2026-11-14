# Result: day-of-week effects in the US dollar basket (2026-11-14)

**Verdict: FAIL** on the pre-registered bar (PREREGISTRATION.md, pushed before any candle was read). No weekday of the long-USD basket (EUR, GBP, AUD, NZD, JPY, CHF, equal weight) is reliably different from the other four in 2016 to now: the smallest Holm-adjusted p is 1 (Monday, Welch t −0.71). Nothing live changed and no proposal follows.

Data: OANDA mid daily candles, council-data research/daily/<key>.json (git show), weekend folded into Monday (council/fills.mjs foldWeekend); basket days 2002-10-24 to 2026-11-06 (6256; decisive 2828, replication 2864; 126 dates skipped where a pair lacked the day or its previous candle differed). Costs: 0.3 pip spread + 0.0045 % commission a round trip per leg a day. Financing: broker swaps from council-data ctrader/symbols.json (frozen 2026-11-14T01:14:58.513Z) for EUR, GBP, AUD, CHF, today's swap for every year; the fx-carry study's approximate policy-rate table less a 1 % markup for NZD and JPY; three nights on the Wednesday-labelled day.

## Per weekday

Side = the direction of the decisive effect (weekday mean above the rest: long USD, below: short USD), used in both windows. % are per day, basket mean of the six legs.

### Decisive window 2016-01-04 to 2026-11-06

| Weekday | n | gross % long USD | rest gross % | Welch t | p | month t | side | gross % side | net % side | net R side | won |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Monday | 566 | −0.0088 | +0.0038 | −0.71 | 0.479 | −0.69 | short USD | +0.0009 | −0.0123 | −0.008 | 48.1 % |
| Tuesday | 566 | +0.0092 | −0.0007 | +0.52 | 0.606 | +0.30 | long USD | +0.0092 | +0.0018 | +0.004 | 51.4 % |
| Wednesday | 566 | −0.0094 | +0.0039 | −0.63 | 0.528 | −0.75 | short USD | +0.0058 | −0.0181 | −0.015 | 47.3 % |
| Thursday | 566 | −0.0009 | +0.0018 | −0.13 | 0.900 | −0.03 | short USD | −0.0005 | −0.0136 | −0.011 | 48.2 % |
| Friday | 564 | +0.0162 | −0.0025 | +0.88 | 0.376 | +1.24 | long USD | +0.0162 | +0.0088 | +0.002 | 50.0 % |

### Replication window 2005-01-04 to 2015-12-31

| Weekday | n | gross % long USD | rest gross % | Welch t | p | month t | side | gross % side | net % side | net R side | won |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Monday | 573 | +0.0339 | −0.0059 | +1.73 | 0.083 | +1.79 | short USD | −0.0365 | −0.0471 | −0.021 | 47.8 % |
| Tuesday | 572 | −0.0094 | +0.0049 | −0.58 | 0.563 | −0.61 | long USD | −0.0094 | −0.0183 | −0.007 | 50.9 % |
| Wednesday | 574 | −0.0067 | +0.0042 | −0.45 | 0.656 | −0.47 | short USD | +0.0051 | −0.0119 | −0.007 | 49.1 % |
| Thursday | 574 | −0.0111 | +0.0053 | −0.69 | 0.492 | −0.70 | short USD | +0.0151 | +0.0045 | −0.002 | 48.1 % |
| Friday | 571 | +0.0035 | +0.0017 | +0.08 | 0.939 | −0.01 | long USD | +0.0035 | −0.0053 | −0.005 | 49.4 % |

## Pass bar

| Weekday | P1 net same sign both windows | P2 decisive Holm p < 0.05 (Holm p) | P3 decisive net R > 0 | pass | at 2x cost: P1 / P3 (net R) |
|---|---|---|---|---|---|
| Monday | no | no (1.000) | no | fail | no / no (−0.014) |
| Tuesday | no | no (1.000) | yes | fail | no / no (−0.002) |
| Wednesday | no | no (1.000) | no | fail | no / no (−0.021) |
| Thursday | no | no (1.000) | no | fail | no / no (−0.017) |
| Friday | no | no (1.000) | yes | fail | no / no (−0.004) |

## Placebo

40 seeds of shuffled weekday labels on the decisive days: 1 of 40 give a Holm p under 0.05 on some label; 35 of 40 have a largest |t| at least the real one (0.88).

## Reading

- The costs are small next to a day's move but the day-of-week differences are smaller still: a few thousandths of a percent of price a day.
- The 2 x ATR stop bound on 26 / 27 / 46 / 36 / 31 leg-days (Monday to Friday, decisive, of about 3396 each), on the side traded; a stop cuts a tail, so the gross % of the long and the short side are not exact mirrors.
- Financing differs by weekday by construction (the Wednesday-labelled day pays three nights), which is why the Welch test is on gross returns and the tradeable checks on net.
- Today's broker swaps are charged on every past year; past swap rates are not on file. The NZD / JPY rate table is approximate (its own about line).
- Paper only. Never call a weekday an edge without its n and t; this scan gives none that passes.

To repeat: `node research/edge/fx-weekday/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `… full <dir>`. Test: `tests/fx-weekday.test.mjs`.

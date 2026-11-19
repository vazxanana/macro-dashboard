# Result: the bond month-end rule, frozen, on four other bond CFDs (14 Nov 2026)

**Verdict: DOES NOT REPLICATE.** #939's frozen rule (long at the close of the month's fourth-to-last trading day, out at the
close of its last, stop 2 x ATR(20), its CFD spread and 3 % a year financing) on the US 2-year and 5-year notes, the German
Bund and the UK Gilt, pooled as one equal-weight value a month, made -0.034R a trade net in 2016 to October 2026 (130 months,
520 trades, t -0.81) and -0.025R in 2003-15 (153 months, t -0.68). It fails three of #939's four checks (net > 0 in both
windows, t >= 2, Holm p < 0.05; one-sided p 0.79) and passes only the random-day placebo. Before costs the same pool shows the
month-end tilt (+0.107R a trade, t 2.66, 2016-26; +0.111R, t 2.91, 2003-15); the CFD costs take all of it, as on the 10-year.
Not an edge on these CFDs; nothing live changed and no proposal is written.

Read with care: #939 had already printed these four markets as unjudged cross-checks, and they were read before the
pre-registration (it says so). This is a formal replication of a visible pattern, not fresh evidence.

Pre-registration: `PREREGISTRATION.md` (pushed alone, before any number of this study was computed). Code: `run.mjs`
(imports `frozen.mjs`, #939's `run.mjs` byte for byte). Every figure: `result.json`.

## Gate (passed)

- G1: `frozen.mjs` `runMarket` on the 7 Nov council-data cache (commit `f6288251…`) reproduces #939's published `usb10y` and
  `usb30y` objects field for field (decisive 10-year +0.036R, t 0.77, n 130; 30-year +0.015R, t 0.32), and its tests block
  and verdict.
- G2: this study's placebo loop reproduces #939's 40 placebo means on both markets.
- G3: the rebuilt day table gives exactly `runMarket`'s trade rows on all four markets.
- Recorded: `runMarket` on the four markets reproduces #939's published cross-check objects too (as JSON).

## Markets and calendars

| Market | OANDA | First candle | US / local calendar | CFD cost (round trip, #939's assumption) | Future (secondary) |
|---|---|---|---|---|---|
| USB02Y | USB02Y_USD | 1 Apr 2003 | frozen US bond-market calendar | 0.02 % | ZT, round trip 0.0058 pt |
| USB05Y | USB05Y_USD | 1 Apr 2003 | frozen US bond-market calendar | 0.03 % | ZF, 0.0115 pt |
| DE10YB | DE10YB_EUR | 7 Mar 2003 | weekdays with a candle (frozen `file` rule) | 0.03 % | FGBL, 0.0137 pt |
| UK10YB | UK10YB_GBP | 27 Jun 2003 | weekdays with a candle (frozen `file` rule) | 0.04 % | Long Gilt, 0.0137 pt |

Financing: 3 % a year of the entry price per calendar night, always charged (#939's fixed assumption; no broker rate history).
OANDA prints **no candle on any of the listed Eurex or English holidays** (0 of either list), so the file calendar already drops
them; the local-holiday sensitivity row below differs only where a weekday has no candle for another reason.

## Primary: the pooled test (#939's bar, one value a month)

| Window | Months | Trades | gross R | net R | t | Check |
|---|---|---|---|---|---|---|
| 2016 - Oct 2026 (decisive) | 130 | 520 | +0.107 | -0.034 | -0.81 | net > 0: no; t >= 2: no; Holm p 0.791: no |
| 2003 - 2015 (replication) | 153 | 607 | +0.111 | -0.025 | -0.68 | net > 0: no |
| Placebo (#939's any-day draw, 40 seeds) | | | | 95th pct -0.107, median -0.173 | | rule above in 40 of 40: yes |

Worst drawdown of the monthly pool, 2016-26: -7.24R. Per-trade pooled t (all 520 trades as one sample, the clustering
ignored): -1.39.

## Departure: the November 2026 trade on the Bund and the Gilt

On the file calendar the frozen code books the month of the last candle too: with candles to 6 November, "the last four
trading days of November" are 3-6 November, so it records a trade entered 3 November on DE10YB (+0.485R net) and UK10YB
(+0.665R), which is not a month-end trade. The pre-registration fixes the decisive window as ending with the last complete
month (October 2026), so the pool and every per-market row here leave those two trades out (both were winners: this makes the
result slightly worse, not better). With them kept, as the frozen rows are: pool -0.029R, t -0.70 (131 months); DE10YB -0.004R,
t -0.08; UK10YB -0.017R, t -0.37 (the figures #939 printed). The verdict is the same either way. On the US calendar the frozen
code does not do this (the month's later trading days exist and have no close yet).

## Secondary: per market (Holm over the four; reported, not judged)

| Market | 2016-26 n | gross R | net R | t | win % | stops | worst DD | 2003-15 n | net R | t | Placebo 95th pct (beaten) | Not month end 95th pct (beaten) | Holm p | Rank of 18 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| USB02Y | 130 | +0.180 | -0.140 | -2.68 | 36.9 | 4 | -20.83 | 152 | -0.183 | -3.90 | -0.284 (40) | -0.343 (40) | 1.000 | 1 |
| USB05Y | 130 | +0.149 | +0.035 | 0.76 | 53.1 | 4 | -4.45 | 152 | -0.005 | -0.12 | -0.081 (40) | -0.133 (40) | 0.896 | 1 |
| DE10YB | 130 | +0.060 | -0.007 | -0.15 | 50.0 | 11 | -5.41 | 153 | +0.045 | 1.07 | -0.044 (40) | -0.044 (40) | 1.000 | 3 |
| UK10YB | 130 | +0.039 | -0.022 | -0.48 | 54.6 | 10 | -9.06 | 150 | +0.044 | 1.01 | -0.008 (36) | -0.064 (39) | 1.000 | 3 |

(Rank of 18 = the frozen day-of-month profile's rank of the TD-4 window, as #939 printed it.) The 2-year note's stop is so
close in price that the CFD spread (0.126R) and financing (0.193R) cost 0.32R a trade.

### Cost sensitivity (net R a trade, t; 2016-26 | 2003-15)

| | 0 x | 1 x (base) | 2 x |
|---|---|---|---|
| Pool (monthly) | +0.107, t 2.66 / +0.111, t 2.91 | -0.034, t -0.81 / -0.025, t -0.68 | -0.174, t -3.96 / -0.161, t -4.27 |
| USB02Y | +0.180, t 3.66 / +0.131, t 2.84 | -0.140, t -2.68 / -0.183, t -3.90 | -0.459, t -7.14 / -0.497, t -8.69 |
| USB05Y | +0.149, t 3.27 / +0.089, t 2.01 | +0.035, t 0.76 / -0.005, t -0.12 | -0.079, t -1.68 / -0.100, t -2.29 |
| DE10YB | +0.060, t 1.26 / +0.111, t 2.66 | -0.007, t -0.15 / +0.045, t 1.07 | -0.075, t -1.57 / -0.022, t -0.52 |
| UK10YB | +0.039, t 0.83 / +0.114, t 2.58 | -0.022, t -0.48 / +0.044, t 1.01 | -0.084, t -1.78 / -0.025, t -0.58 |

### At futures cost (#943's method; secondary, never the verdict)

Futures net R = the frozen gross R - one tick and $3.70 (EUR / GBP 3.70 assumed) a round trip, in points, over the trade's own
CFD stop distance; no financing (carry is in a future's price). Ticks from memory, not opened; one CFD point taken as one
futures point (the main weakness: the Bund and Gilt CFDs may track the cash bond, and USB02Y is not proven to be ZT's price).

| | Cost R a trade | 0 x | 1 x (base) | 2 x | worst DD (1 x) |
|---|---|---|---|---|---|
| Pool (monthly) | | +0.107, t 2.66 / +0.111, t 2.91 | **+0.089, t 2.21** / +0.093, t 2.46 | +0.071, t 1.77 / +0.076, t 2.01 | -2.65 |
| USB02Y at ZT | 0.034 | +0.180, t 3.66 | +0.146, t 2.98 / +0.100, t 2.18 | +0.112, t 2.29 / +0.068, t 1.50 | -3.57 |
| USB05Y at ZF | 0.018 | +0.149, t 3.27 | +0.131, t 2.86 / +0.074, t 1.68 | +0.113, t 2.46 / +0.059, t 1.34 | -2.87 |
| DE10YB at FGBL | 0.009 | +0.060, t 1.26 | +0.050, t 1.06 / +0.099, t 2.39 | +0.041, t 0.86 / +0.088, t 2.12 | -3.70 |
| UK10YB at Long Gilt | 0.010 | +0.039, t 0.83 | +0.029, t 0.62 / +0.102, t 2.33 | +0.019, t 0.41 / +0.091, t 2.08 | -6.66 |

(2016-26 / 2003-15.) At this assumed futures cost the pool would clear #939's numeric bar (decisive +0.089R, t 2.21, one-sided
p 0.014; replication positive; above the futures-costed placebo's 95th percentile, +0.018, in 40 of 40 seeds), carried by the
two US notes; at 2 x the futures cost the decisive t is 1.77. This is a secondary row of a cost model that is not measured and
a price mapping that is not proven: it is **not** the verdict, it is not tradable on the desk's CFD demo accounts (absolute
rule 2), and it would need its own pre-registration (with a measured futures cost and futures prices) before anyone reads it
as more than a reason to look. Never call it an edge.

### Local-holiday calendar (Bund and Gilt; reported, not judged)

| | 2016-26 n | net R | t | 2003-15 n | net R | t |
|---|---|---|---|---|---|---|
| DE10YB, Eurex holidays | 124 | +0.009 | 0.18 | 151 | +0.046 | 1.09 |
| UK10YB, English bank holidays | 128 | -0.017 | -0.35 | 150 | +0.044 | 1.01 |
| Pool with these two | 130 months | -0.032 | -0.78 | 153 months | -0.025 | -0.68 |

No entry day moved; the local calendar only skips months whose needed day has no candle on file (9 and 2 trades).

## Not-month-end placebo (as asked; reported, not judged)

40 seeds, the frozen draw restricted to entries whose three held days are none of the month's last three trading days (entries
at TD-2 to TD-6 excluded): pooled 95th percentile -0.161R, median -0.206R; the rule's -0.034R is above all 40. The placebo
means are this negative because any three-day long pays the same cost and financing and these markets drifted down over the
decade: beating the placebo says the month end is better than other days before costs, not that it pays after them.

## Fisher combination (as `multiple-testing-update` defines it)

#939's 10-year decisive cell, one-sided p 0.2206 (t 0.77), with this pool's decisive one-sided p 0.791: chi-square 3.49 on
4 degrees of freedom, **Fisher p 0.479**, far from the family's Bonferroni line (0.05 / 333 = 1.5e-4). The instruments are
disjoint but the days are the same month ends and US yields move together, so the two p's are positively dependent and this
p, computed as if independent, is too small: an upper bound on the combined evidence. Even that bound shows none. (A Fisher
of the futures-cost rows was not pre-registered and is not computed.)

## What this does and does not say

- The frozen rule does not replicate after CFD costs on four bond CFDs it was not judged on: the month-end tilt is there before
  costs on every US maturity (each US window is the best of #939's 18 three-day windows) and weaker on the Bund and Gilt, but
  the CFDs' fixed spread and the assumed 3 % financing take all of it.
- Not tested: cash or futures closes in New York (OANDA's daily close is 00:00 UTC), the size of each month's index extension,
  a short side, any other day or hold.
- Nothing live changed and no proposal is written. To repeat: `node research/edge/bond-month-end-replicate/run.mjs fetch <dir>`
  (git show, no network), then `node research/edge/bond-month-end-replicate/run.mjs full <dir>`. Tests:
  `tests/bond-month-end-replicate.test.mjs`.

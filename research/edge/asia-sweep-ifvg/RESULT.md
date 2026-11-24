# Asia range swept in the London morning, entered on a 5-minute inversion fair value gap (result)

**Verdict: FAIL. 0 of 2 judged cells pass; the best, ifvg far, made -0.080R a trade after costs in 2015-26 (n 3,425, month t -2.92; discovery -0.048R, n 2,638, t -1.64).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed, nothing is
proposed. One run of `run.mjs`, no variants. OANDA mid 5-minute candles from the shared cache, five markets pooled
(xau 2006-03-19 to 2026-10-30; eurusd 2005-01-02 to 2026-10-30; gbpusd 2005-01-02 to 2026-10-30; usdjpy 2005-01-02 to 2026-10-30; audusd 2005-01-02 to 2026-10-30), fills 2005-01-01 to 2026-10-31. Costs: `combo-grid-2` round trips.

## Cells (R a trade; t = the t of calendar-month sums, 120 months in discovery, 142 in confirmation)

| Cell | Window | Trades | Won | Before costs | Month t | After costs | Month t |
|---|---|---|---|---|---|---|---|
| ifvg mid (judged) | 2005-14 | 1,957 | 51 % | +0.008 | 0.37 | -0.061 | -2.72 |
|  | 2015-26 | 2,661 | 49 % | -0.005 | -0.22 | -0.084 | -3.82 |
| ifvg far (judged) | 2005-14 | 2,638 | 37 % | +0.018 | 0.63 | -0.048 | -1.64 |
|  | 2015-26 | 3,425 | 35 % | -0.004 | -0.16 | -0.080 | -2.92 |
| reclaim mid (control) | 2005-14 | 4,460 | 36 % | +0.070 | 2.50 | -0.085 | -2.99 |
|  | 2015-26 | 5,518 | 35 % | +0.067 | 2.50 | -0.113 | -4.24 |
| reclaim far (control) | 2005-14 | 4,634 | 23 % | +0.075 | 2.01 | -0.077 | -2.02 |
|  | 2015-26 | 5,712 | 23 % | +0.091 | 2.54 | -0.085 | -2.39 |

Holm-adjusted one-sided p of the confirmation month t after costs: ifvg mid 1.00, ifvg far 1.00. Pass bar: 300 trades in each window, after-cost mean above 0 and
month t at least 2 in both windows, Holm p under 0.05. 0 of 2 judged cells meet it.

## Does the gap inversion beat the plain close back inside? (reported, not judged)

- Target mid: inversion -0.084R (n 2,661) against the plain close back -0.113R (n 5,518) after costs in 2015-26, difference +0.028R; in 2005-14 -0.061R against -0.085R. Before costs in 2015-26: -0.005R against +0.067R.
- Target far: inversion -0.080R (n 3,425) against the plain close back -0.085R (n 5,712) after costs in 2015-26, difference +0.004R; in 2005-14 -0.048R against -0.077R. Before costs in 2015-26: -0.004R against +0.091R.

## The judged cells by market and side (after costs)

| Cell | Market | 2005-14 n | R | Month t | 2015-26 n | R | Month t |
|---|---|---|---|---|---|---|---|
| ifvg mid | xau | 349 | -0.164 | -2.75 | 548 | -0.146 | -2.84 |
| ifvg mid | eurusd | 322 | -0.046 | -1.02 | 456 | +0.005 | 0.11 |
| ifvg mid | gbpusd | 326 | -0.020 | -0.36 | 376 | -0.073 | -1.47 |
| ifvg mid | usdjpy | 468 | +0.057 | 1.19 | 602 | -0.112 | -2.32 |
| ifvg mid | audusd | 492 | -0.136 | -2.81 | 679 | -0.077 | -1.81 |
| ifvg far | xau | 505 | -0.160 | -2.18 | 688 | -0.103 | -1.63 |
| ifvg far | eurusd | 476 | +0.092 | 1.39 | 656 | +0.029 | 0.58 |
| ifvg far | gbpusd | 474 | +0.020 | 0.31 | 567 | -0.128 | -2.15 |
| ifvg far | usdjpy | 573 | -0.071 | -1.20 | 720 | -0.147 | -2.84 |
| ifvg far | audusd | 610 | -0.097 | -1.55 | 794 | -0.057 | -1.11 |

- ifvg mid: buys -0.077R (n 923) then -0.068R (n 1,312); sells -0.046R (n 1,034) then -0.100R (n 1,349). Exits: 2,248 targets, 2,262 stops, 108 at the 16:00 UTC time exit. Skipped at entry: target too near 2,755, excluded 4, no next candle 1.
- ifvg far: buys -0.065R (n 1,280) then -0.093R (n 1,694); sells -0.032R (n 1,358) then -0.068R (n 1,731). Exits: 1,770 targets, 3,732 stops, 561 at the 16:00 UTC time exit. Skipped at entry: target too near 1,310, excluded 4, no next candle 1.

## The funnel (all five markets, the whole file)

28,111 market weekdays; 160 without a usable Asia range; 15,227 sides already traded through between 06:00 and 07:00; 14,199 fresh sides swept in 07:00-10:00.
Of those sweeps: 7,640 gave an inversion trigger, 3,005 were cancelled at the middle of the range first, 24 had no gap in the sweep leg by 12:00, 3,530 had a gap that never inverted back inside the range by 12:00.

## What it says

No judged cell meets the bar after costs in both decades. Entering a swept Asia range on the inversion of a sweep-leg gap is not shown to make money on these five markets; the controls show how much of any figure comes from the sweep and the close back inside alone.

Limits: OANDA mid candles (no bid / ask), the same round-trip cost charged in every year, fills at the next 5-minute open, a stop
and a target inside one candle counted as a stop. The gap and leg definitions are this study's own plain reading, fixed before the run.

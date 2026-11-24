# Four more public gauges: policy uncertainty, breakeven inflation, the St. Louis stress index, the curve after an inversion (pre-registration, 24 Nov 2026)

Paper research only. Written and pushed alone before any return was split by any of these gauges. Same design as
`fred-gauges` (its `lastKnown`, `fridays`, `outcome` imported; `rulebook-gauges` `nwSlope`).

## Data
FRED keyless csv: `USEPUINDXD` (daily economic policy uncertainty, lag 2 days), `T10YIE` (10-year breakeven, lag 1), `STLFSI4`
(weekly, dated Friday, published the next Thursday: lag 7), `T10Y3M` (10-year minus 3-month, lag 1). OANDA daily XAU/USD,
SPX500, USD/JPY from the council's candle cache. Fridays from 2007-01-05; each reading uses the last value known by then.

## Signals (0 / 1 each Friday)
- **U, uncertainty spike**: the mean of the last 5 known EPU values is above the 90th percentile of the 5-value means read on
  the previous 52 Fridays.
- **B, breakevens rising**: T10YIE is more than 0.10 points above its reading 4 Fridays before.
- **S, stress rising**: STLFSI4 is above 0 and above its reading 4 Fridays before.
- **Y, steepening after an inversion**: T10Y3M was below 0 on at least one of the previous 52 Fridays and is now more than 0.50
  points above its reading 13 Fridays before.

## Outcome
Log change over 20 sessions from the Friday's close (`fred-gauges` `outcome`).

## Tests (five, Holm)
1. U → gold higher. 2. B → gold higher. 3. S → USD/JPY lower. 4. S → S&P 500 lower. 5. Y → gold higher.
Newey-West t (4 lags) of the outcome on the 0 / 1 signal; pass = |t| >= 2 in the claimed direction, Holm p < 0.05 over the
five, the same sign of the slope in 2007-16 and 2017 on.

## Reported, not tested
Signal weeks and episodes; class means on the three markets.

## Limits, said before the result
STLFSI4 is re-estimated over its history (today's file, not the published one); Y has few episodes by construction; outcomes
of consecutive weeks overlap.

## Reading
A pass is a lean for the narrative layer, never a rule, size or trade. Nothing live changes whatever the result.

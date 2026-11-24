# Four macro gauges the rule book names, never tested here: net liquidity, financial conditions, jobless claims, double tightening (pre-registration, 24 Nov 2026)

Paper research only. Written and pushed alone before any return was split by any of these gauges. These four waited while
FRED could not be reached from the research sandbox.

## Why
The Macro strategist shows net liquidity and the regime as context, the hard-data board shows claims, and the owner's rule book
names "double tightening" (real yields and credit spreads rising together) as gold's worst state; `rulebook-gauges` could not
test it because FRED's high-yield spread history was cut to three years. None of the four has a record on the desk's markets.

## Data
FRED keyless csv: `WALCL` (Fed balance sheet), `WDTGAL` (Treasury general account, Wednesday level), `RRPONTSYD` (overnight
reverse repo; before its first value it counts as 0), `NFCI`, `ICSA`, `DFII10`, `BAA10Y` (Moody's Baa yield minus the 10-year,
daily from 1986: the credit spread that still has history). OANDA daily XAU/USD, SPX500 and USD/JPY from the council's candle
cache (`git show`). A value dated D counts as known `lag` calendar days later: WALCL / WDTGAL 2, NFCI 6, ICSA 6, daily series 1.
Weekly readings on Fridays from 2007-01-05 to the last Friday whose 20 sessions are complete; each reading uses, per series,
the last value known by that Friday.

## Signals (0 / 1 on each Friday)
- **L, net liquidity rising**: WALCL − WDTGAL − RRPONTSYD (all in $bn) is higher than its own reading 4 Fridays before.
- **F, conditions tightening**: NFCI is higher than its reading 4 Fridays before.
- **C, claims rising**: the mean of the last 4 ICSA values is more than 5 % above the mean of the last 26.
- **D, double tightening**: DFII10 is more than 0.25 points above its reading 4 Fridays before AND BAA10Y is above its reading
  4 Fridays before.

## Outcome
Log change over 20 sessions from the Friday's close (the first daily close at or after that Friday, at most 4 days later).

## Tests (seven, Holm)
1. L → gold higher. 2. L → S&P 500 higher. 3. F → gold lower. 4. F → S&P 500 lower. 5. C → gold higher. 6. C → USD/JPY lower.
7. D → gold lower.
Each: Newey-West t (4 lags, `rulebook-gauges` `nwSlope`, imported) of the outcome on the 0 / 1 signal. A test passes with
|t| >= 2 in the claimed direction, Holm p < 0.05 over the seven, and the same sign of the slope in 2007-16 and 2017 on.

## Reported, not tested
Signal weeks and episodes; class means on all three markets for every signal.

## Limits, said before the result
NFCI is re-estimated over its whole history, so today's file is not what was published then; FRED values are today's revised
ones (claims are revised a week later; the balance-sheet series are not). The 20-session outcomes of consecutive weeks overlap,
which the Newey-West t only partly covers; an episode count is reported for that reason.

## Reading
A pass is a lean for the narrative layer and a candidate for a line in "Your research, applied", never a rule, size or trade.
Nothing live changes whatever the result.

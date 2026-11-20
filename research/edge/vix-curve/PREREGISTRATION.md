# An inverted VIX curve: what USD/JPY and gold do next (pre-registration, 20 Nov 2026)

Paper research only. Written and pushed alone before any USD/JPY or gold return was split by the VIX curve.

## Why
The Macro strategist reads the VIX / VIX3M term structure as a stress input, and the rule book's regime section treats fear as
yen-up, gold-dipping-then-rising. When the 30-day VIX sits above the 3-month VIX3M (an inverted curve), stress is acute. Does that
tell anything about the next 20 sessions of the desk's two markets?

## Data
FRED `VIXCLS` and `VXVCLS` (keyless csv; VIX3M starts Dec 2007), a value dated D known at the next weekday's close
(`rulebook-gauges` `knownAt`, imported). OANDA daily USD/JPY and XAU/USD from the council's candle cache (`git show`). Weekly
readings on Fridays from the first Friday of 2008 to the last whose 20 sessions are complete.

## Signal and outcome
- Inverted = VIX > VIX3M on the Friday.
- Outcome: log change over 20 sessions from the first close at or after the known-at time (the next weekday's close).

## Tests (two, Holm)
- **J**: inverted weeks have a lower USD/JPY outcome than the rest (the yen keeps rising after acute stress).
- **G**: inverted weeks have a higher gold outcome than the rest (gold rises after the stress).
Newey-West t on a 0/1 indicator (`rulebook-gauges` `nwSlope`, 4 lags); a test passes with |t| >= 2 in the claimed direction, Holm
p < 0.05, and the same sign in 2008-16 and 2017 on.

## Reported, not tested
Number of inverted weeks and episodes; class means; the same outcome for SPX500 (OANDA daily).

## Reading
A pass is a regime lean for the narrative layer, never a rule, size or trade. Nothing live changes.

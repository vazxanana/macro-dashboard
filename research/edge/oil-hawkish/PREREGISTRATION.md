# A slow, persistent oil rise: hawkish for the dollar and gold? (pre-registration, 20 Nov 2026)

Paper research only. Written and pushed alone before any gold or USD/JPY return was split by oil moves.

## Why
The owner's macro skill: "a slow, persistent rise in oil feeds CPI and makes central banks hawkish. A quick spike usually doesn't."
Hawkish means the dollar up and gold down in its own tables. This tests whether a slow oil rise leads either.

## Data
OANDA daily WTI (`wtico`), USD/JPY and XAU/USD from the council's candle cache (`research/daily/<key>.json`, `git show`). Weekly
readings on Fridays, 2007-01-05 → the last Friday whose 20 sessions are complete.

## Signal (fixed now)
Slow persistent rise = WTI up more than 15 % over the last 63 sessions (about 3 months) AND up over each of the three 21-session
blocks inside them (no single spike), measured on closes up to the Friday.

## Outcome
Log change over the next 20 sessions from the next weekday's close.

## Tests (two, Holm)
- **D**: slow-rise weeks have a higher USD/JPY outcome than the rest (hawkish = dollar up).
- **G**: slow-rise weeks have a lower gold outcome than the rest.
Newey-West t on a 0/1 indicator (`rulebook-gauges` `nwSlope`, 4 lags); a test passes with |t| >= 2 in the claimed direction, Holm
p < 0.05, and the same sign in 2007-16 and 2017 on.

## Reported, not tested
Number of slow-rise weeks and episodes; class means.

## Reading
A pass is a lean for the narrative layer, never a rule, size or trade. Nothing live changes.

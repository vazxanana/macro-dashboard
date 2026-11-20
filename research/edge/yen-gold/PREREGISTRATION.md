# Does a falling USD/JPY lead gold? (pre-registration, 20 Nov 2026)

Paper research only. Written and pushed alone before any gold return was split by USD/JPY moves.

## Why
The owner's macro skill says the yen (a falling USD/JPY over 4 weeks) "had a consistent small positive edge" for gold, and the
gold terminal's driver stack has a yen carry-unwind row (always `dir: null`, a volatility warning). No study in this repository
has tested it on its own.

## Data
OANDA daily XAU/USD and USD/JPY from the council's candle cache (`research/daily/xau.json`, `usdjpy.json`, `git show`). Weekly
readings on Fridays, 2007-01-05 → the last Friday whose 20 sessions are complete.

## Signal and outcome
- `y4` = log change of USD/JPY over the 20 sessions ending at the Friday close.
- Yen strong = `y4 < −0.02` (USD/JPY down more than about 2 %); yen weak = `y4 > +0.02`; else flat.
- Outcome: log change of gold over the next 20 sessions, from the first gold close after the Friday (the next weekday's).

## Tests (two, Holm)
- **S**: yen-strong weeks have a higher gold outcome than the rest (`rulebook-gauges` `nwSlope` on a 0/1 indicator, Newey-West t,
  4 lags).
- **W**: yen-weak weeks have a lower gold outcome than the rest.
- Each passes with |t| >= 2 in the claimed direction, Holm p < 0.05, and the same sign in 2007-16 and 2017 on.

## Reported, not tested
Mean 20-session gold change per class and on all weeks; the same-4-week correlation of `y4` and gold's own 4-week change.

## Reading
A pass is a lean for the narrative layer at most, never a rule, size, gate or trade, and not a change to the Gold Macro Score
(the skill itself says the yen adds nothing beyond its four drivers). Nothing live changes.

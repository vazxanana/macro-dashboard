# Do US yields lead USD/JPY? (pre-registration, 20 Nov 2026)

Paper research only. Written and pushed alone before any USD/JPY return was split by US yield moves.

## Why
The veteran batch's Japan brief has a "global yields dominate" scenario (US 10-year and USD/JPY moving together;
`council/research-watch.mjs` reads it live over 4 weeks). Moving together is not a forecast. This asks whether a large 4-week US
10-year move is followed by USD/JPY going the same way over the next 20 sessions: something a trader could use.

## Data
FRED `DGS10` (keyless csv), a value dated D known at the next weekday's close (`rulebook-gauges` `knownAt`, imported); OANDA daily
USD/JPY from the council's candle cache (`research/daily/usdjpy.json`, `git show`). Weekly readings on Fridays, 2007-01-05 → the
last Friday whose 20 sessions are complete.

## Signal and outcome
- `d10` = DGS10 on the Friday minus DGS10 20 sessions before (the last value on or before each date), in percentage points.
- Up = `d10 > +0.25`; Down = `d10 < −0.25`; else flat.
- Outcome: log change of USD/JPY over the 20 sessions from the first close at or after the known-at time.

## Tests (two, Holm)
- **U**: Up weeks have a higher outcome than the rest (`rulebook-gauges` `nwSlope` on a 0/1 indicator, Newey-West t, 4 lags).
- **D**: Down weeks have a lower outcome than the rest.
- Each passes with |t| >= 2 in the claimed direction, Holm p < 0.05, and the same sign in 2007-16 and 2017 on.

## Reported, not tested
Mean 20-session USD/JPY change for Up / flat / Down and all weeks; the same-week (coincident) 4-week correlation of `d10` with
USD/JPY's own 4-week change, to show the link the brief describes.

## Reading
A pass is a lean for a dollar view, never a rule, size or trade. Nothing live changes.

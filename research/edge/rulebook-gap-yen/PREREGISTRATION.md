# The 2-year against the policy rate, and the yen (pre-registration, 20 Nov 2026)

Paper research only. Written and pushed alone, before any USD/JPY return was split by this gauge.

## Why
The owner's macro rule book reads the US 2-year yield against the Fed's policy rate: more than 25 bp above it = hikes priced
(dollar up), more than 25 bp below = cuts priced (dollar down). `rulebook-gauges` tested it on gold (B2 "cuts priced" PASS, B1
FAIL). The rule book states it for the dollar first. USD/JPY is the dollar pair the desk follows. Same gauge, same test code.

## Data and method
- FRED `DGS2`, `DFEDTARU`, `DFEDTAR` (keyless csv), known at the next weekday's close; OANDA daily USD/JPY from the council's
  candle cache (`research/daily/usdjpy.json`, `git show`), 2007 → now.
- `rulebook-gauges` `gapRows` and `testB` are imported unchanged. They take one price series and test "hikes priced → lower",
  "cuts priced → higher" over the next 20 sessions (Newey-West t, 4 lags, Holm over the two, the same sign in 2007-16 and
  2017 on). The series passed is the yen's price in dollars, **1 / USD/JPY**, so the rule book's dollar claims map onto the
  imported tests with their signs unchanged: B1 = hikes priced → the yen falls (USD/JPY up); B2 = cuts priced → the yen rises
  (USD/JPY down).
- Pass per test exactly as `testB` defines it (|t| >= 2 with the claimed sign, Holm p < 0.05, same sign in both halves).

## Reported, not tested
Mean 20-session USD/JPY change by class (hikes / flat / cuts) and on all weeks.

## Reading
Descriptive leans at most; no rule, call or trade reads it. Nothing live changes.

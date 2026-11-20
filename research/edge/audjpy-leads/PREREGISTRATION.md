# Does AUD/JPY turn before equities? (pre-registration, 20 Nov 2026)

Paper research only. Written and pushed alone before any equity return was split by AUD/JPY moves.

## Why
The owner's macro skill (regime section): "AUDJPY often turns before equities." If AUD/JPY leads, its recent move should tell
something about the S&P 500 and the Nasdaq 100 over the following weeks, beyond what they did themselves.

## Data
OANDA daily AUD/JPY, SPX500 and NAS100 from the council's candle cache (`research/daily/<key>.json`, `git show`). Weekly readings
on Fridays, 2007-01-05 → the last Friday whose 20 sessions are complete for both indices.

## Signal and outcome
- `a4` = log change of AUD/JPY over the 20 sessions ending at the Friday close; `e4` = the index's own change over the same 20.
- Divergence up = `a4 > 0` while `e4 < 0` (AUD/JPY already turned up, the index not yet); divergence down = `a4 < 0` while `e4 > 0`.
- Outcome: the index's log change over the next 20 sessions, from the next weekday's close.

## Tests (four, Holm over all four)
For SPX500 and NAS100 each:
- **Up**: divergence-up weeks have a higher index outcome than the rest.
- **Down**: divergence-down weeks have a lower index outcome than the rest.
Newey-West t on a 0/1 indicator (`rulebook-gauges` `nwSlope`, 4 lags); a test passes with |t| >= 2 in the claimed direction, Holm
p < 0.05, and the same sign in 2007-16 and 2017 on.

## Reported, not tested
Class means and counts; same-4-week correlation of `a4` and `e4`.

## Reading
A pass is a regime lean for the narrative layer, never a rule, size or trade. Nothing live changes.

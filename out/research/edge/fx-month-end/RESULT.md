# Month-end US dollar rebalancing flow into the London 4 pm fix: result

**Verdict: FAIL.** Neither pre-registered rule passes. Base rule, decisive window 2016-01 to 2026-10: **-0.0903R a
basket event after costs (n 130, t -1.06)**; 2008-15: -0.0782R (n 96, t -0.80). Before costs the effect is about zero in
both windows (-0.009R and -0.010R an event). Not an edge; no proposal is written and nothing live changes.

Pre-registration: `PREREGISTRATION.md` (committed before any number was computed). Built 13 Nov 2026 by
`node research/edge/fx-month-end/run.mjs <dir>`; numbers in `result.json`.

## What was tested

On the last London business day of each month (England and Wales bank holidays skipped), at 10:00 London: gap = S&P 500
month-to-date return minus the mean of the DAX, FTSE 100 and Nikkei 225 month-to-date returns, from OANDA daily index
candles that had closed by then (the previous UTC day). Gap > 0 (US outperformed): short USD on EUR/USD, GBP/USD, AUD/USD,
USD/JPY, USD/CHF, USD/CAD; else long USD. Entry at the 10:00 London OANDA mid H1 open, exit at the 16:00 London close (the
fix), London clock with daylight saving. Every leg has a 1.5 x ATR(24 H1) stop; equal risk across the six legs; basket R per
event = mean of the leg R. Costs: the measured raw-spread model (commission 0.0045 % a round trip, measured median spread 0
except USD/JPY at the 1-pip default, 1 pip of slippage a round trip). No financing (no rollover crossed). Second rule
(variant): only events with |gap| above the 2008-15 median |gap| (0.0151, i.e. 1.51 percentage points).

## Numbers

| | n | net R / event | t | total R | worst DD R | win share | gross R / event | legs stopped |
|---|---|---|---|---|---|---|---|---|
| Base, decisive 2016-26 | 130 | -0.0903 | -1.06 | -11.74 | -19.67 | 36.2 % | -0.009 | 54.6 % |
| Base, check 2008-15 | 96 | -0.0782 | -0.80 | -7.51 | -15.18 | 37.5 % | -0.010 | 54.9 % |
| Variant, decisive | 72 | 0.0151 | 0.13 | +1.08 | -13.01 | 41.7 % | +0.093 | 50.7 % |
| Variant, check | 48 | -0.1461 | -1.11 | -7.01 | -10.50 | 31.3 % | -0.078 | 54.5 % |

Pass checks (all needed): base fails every one but n (mean not positive, t -1.06, Holm p 0.86, 2008-15 negative, below the
placebo bar); the variant has a positive decisive mean but t 0.13, 72 events (< 100) and a negative 2008-15.

**Placebo**: the same rule on 40 random non-month-end London business days a year of the decisive window (424 events with
data): mean -0.0795R an event; 2,000 resamples of 130 events give a 95th percentile of **0.0525R** (median -0.080R). The
month-end base mean (-0.0903R) sits at the placebo's median: the last business day is no different from any other day.

Costs took about 0.08R an event (0.0813R decisive). The cost is high in R because the stop is 1.5 x the hourly ATR and the
hold is six hours; the gross figures show there was nothing to pay it with.

Per pair (base, decisive, net R a leg): EUR/USD -0.172, GBP/USD +0.089, AUD/USD -0.062, USD/JPY -0.083, USD/CHF -0.112,
USD/CAD -0.201. US equities outperformed in 53.8 % of the decisive month-ends. Per year (net R, base): positive in 2010,
2011 (+12.3R), 2016, 2017, 2019, 2025, 2026; the rest negative. No month-end was missing data.

## Reading

The published effect (measured on the fix rate in an earlier sample) does not show on OANDA mid
H1 candles from 10:00 London to the fix, 2008 to 2026, gross or net. Possible reasons, not tested: the flow is front-run
or spread across the day once it was published; the paper measured the fix rate itself, which
differs from this six-hour window. Any other window would need its own pre-registration; this study does
not support one. Descriptive splits (per pair, per year, the variant's decisive mean) cannot change the verdict.

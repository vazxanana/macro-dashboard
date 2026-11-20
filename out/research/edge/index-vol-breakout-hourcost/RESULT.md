# Result: the index breakout at the demo's measured hourly spreads (20 Nov 2026)

**Verdict: FAIL, 0 of 2.** `index-vol-breakout`'s own pre-registered bar, with each trade charged the demo broker's measured
spread at its fill hour and exit hour (condition C1: half the spread at each end + 0.05 × M stop slippage):
- **NAS100: +0.043R a trade (n 2,040, 2016 → 11 Nov 2026, month t 2.01, Holm p 0.044), fails on the placebo only**: 35 of 40
  random-entry placebos beaten, 38 needed. 2016-20 +0.050R, 2021 → now +0.038R, at 2x costs +0.031R.
- **SPX500: +0.015R (n 2,015, month t 0.69)**: fails five checks; 2021 → now −0.007R.

The measured cost is about a quarter of what the original study charged (NAS100 0.012R a trade against 0.059R; SPX500 0.017R
against 0.067R), which turns NAS100 from −0.004R into +0.043R. But the same random entries, charged the same way, also gain:
the breakout's timing beats random timing on NAS100 in 35 of 40 seeds, not the 38 the bar asked for. So the index result is
mostly "being long or short an index for part of a US day at a low cost", not the breakout itself. **Not an edge; no paper
shadow is proposed.** Nothing live changed.

Pre-registered in `PREREGISTRATION.md` (pushed alone at ce3db1439, before any hourly index spread was read). Rule, days,
placebo draws and pass bar are imported from `index-vol-breakout` unchanged. **Harness gate held**: at the original constant
costs both markets reproduce `index-vol-breakout/result.json` exactly (n, net, gross, t per window, and all 40 placebo means).

## The measurement

Tick probe (`council/tick-probe.mjs`, `NAS100:hours US500:hours`), council-data commit 46e678088, 20 Nov 2026: the demo's
quoted spread in the first 2 minutes of every UTC hour over the last 44 weekdays (history reaches at least 1,095 days).
NAS100: 2.7 × 10⁻⁵ of price in every hour 00-20 (about 0.7 points at 25,000; 2.9-3.0 at 05-06 UTC); US500: 4.7 × 10⁻⁵ in
Asian hours and 20:00, 3.9 × 10⁻⁵ from 07:00 to 19:00 (about 0.25-0.3 points). Commission 0 on both (council-data
`ctrader/symbols.json`). The original study assumed 3 and 1 points a round trip.

## Numbers (net R a trade, month t)

| Condition | Market | 2016-20 | 2021 → now | All | t | Cost R | Placebos beaten |
|---|---|---|---|---|---|---|---|
| C1 (median + 0.05 M) | NAS100 | +0.050 | +0.038 | +0.043 | 2.01 | 0.012 | 35 / 40 |
| C1 | SPX500 | +0.042 | −0.007 | +0.015 | 0.69 | 0.017 | 27 / 40 |
| C2 (p90 + 0.10 M) | NAS100 | +0.042 | +0.030 | +0.036 | 1.66 | 0.019 | 34 / 40 |
| C2 | SPX500 | +0.035 | −0.014 | +0.008 | 0.36 | 0.024 | 26 / 40 |

Caveats: today's relative spreads are applied to every year; 44 weekdays of one demo account; the first 2 minutes of an hour
stand for the hour; stop slippage assumed (gold's measured stop-order slippage, `gold-vol-breakout-exec`, was 0.011R).

To repeat: candles as the original (`nas100-5m.json.gz`, `spx500-5m.json.gz`, OANDA mid M5 2015-12-01 → 2026-11-12, out of
git), the probe files and `ctrader/symbols.json` in one folder, then `node research/edge/index-vol-breakout-hourcost/run.mjs
<candleDir> <probeDir> [commit]`. Test: `tests/index-vol-breakout-hourcost.test.mjs`.

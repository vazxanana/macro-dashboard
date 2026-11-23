# MSNR direction call on ten markets (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.
A direction test, not a trade test: no entry, stop, exit or cost is simulated.

## Why

`research/edge/msnr-direction` tested the direction call on gold alone (two ladders, 2007-19 / 2020-26) and found nothing
(0 of 6). The desks still use the call (the earlier scalp method trades with it; `grid7-wide-core` used it as an "agree"
filter). This study asks the question once more, wide: is the call, as the desk computes it today, a predictor of direction
on ten markets and three ladders? A positive result would make it a valid filter; a null says it carries no direction.

## The call (imported, never edited)

`council/eg-methods.mjs` `direction(work, keyOf, htfSec)`: key levels one timeframe above (V / A turns of the closes, engulf
zones, failed engulf zones, dominant zones, open-close levels), a switch only after a key level is tapped and the working
chart closes beyond the external A / V level that stood before the tap. `call[i]` is the call known at the close of working
candle i (+1 buy, -1 sell, 0 none yet). The higher-timeframe candles are built inside `direction()` from the working candles
by `keyOf`, and a level is used only after its candle has closed.

Three ladders (working timeframe / key-level timeframe):

- **LH**: working H1, key levels on H4 (H4 = UTC 4-hour buckets of the H1 candles).
- **L4**: working H4, key levels on the Daily (Daily = UTC days, a Saturday / Sunday candle folded into the Monday; the
  same day key as `msnr-direction`).
- **LD**: working Daily, key levels on the Weekly (Daily = 17:00 New York trading days, `edgekit.dailyNY`; Weekly = the
  Monday-UTC week of the trading day's end, built from those Daily candles).

## Data

- OANDA mid 5-minute candles, the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`), loaded from
  2004-01-01 for warm-up. H1 and H4 by `edgekit.resample`, Daily by `dailyNY` (via `combo-grid-3`'s `frames`, imported).
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (gold and silver from where the
  cache starts).
- Exclusions: `combo-grid-2`'s `exclusions(market)`: an observation whose span (its close to its forward close) touches a bad
  interval is dropped.
- Windows by the observation's close: **discovery 2005-01-01 to 2014-12-31**, **confirmation 2015-01-01 to 2026-10-31**; the
  forward close must also fall inside the window.

## Measures (closed candles only)

For working candle i with close C_i and call c_i != 0, horizon h (1, 5, 20 working candles):

- r = ln(C_{i+h} / C_i); m = the mean of r over every candle of that market, window, ladder and h (call or not).
- **Scale**: s_i = sd of the last 100 one-candle log returns ending at candle i, times sqrt(h) (known at the close of i).
  An observation without 100 earlier returns is dropped.
- **Excess** e_i = c_i x (r - m) / s_i (a call-weighted excess return in units of the market's own volatility). Also
  reported in % (unscaled) per market.
- **Hit** g_i = 1 if c_i x r > 0, else 0 (r = 0 counts 0); **base** b_i = share of r > 0 in the window when c_i = +1,
  share of r < 0 when c_i = -1. Hit excess = g_i - b_i.
- **Switch event study**: for every switch (an entry of `events`: the call takes a new side at the close of candle i),
  w_i = c_i x (r - m) / s_i at the same h, with c_i the new side. Raw r in the call's direction is reported too.

**Statistic**: month sums. Each observation goes to the calendar month of its close; per month, the sum over the ten markets
of the market's observations (the pooled test) or of one market (per-market report). t = mean of the monthly sums / its
standard error over every calendar month of the window (an empty month counts 0): 120 months in discovery, 142 in
confirmation. Newey-West t on the observations (lag max(5, 2(h - 1)), as `msnr-direction`) is reported beside it.

## The nine primary tests (pooled over the ten markets, h = 5)

| Test | Ladder | Measure |
|---|---|---|
| LH-x, L4-x, LD-x | each ladder | call-weighted excess e (month-sum t) |
| LH-s, L4-s, LD-s | each ladder | switch event study w (month-sum t) |
| LH-g, L4-g, LD-g | each ladder | hit rate against base, g - b (month-sum t) |

A test **passes** when its mean is positive with month-sum t >= 2 in discovery AND in confirmation, and its Holm-adjusted
one-sided p (normal, from the confirmation t, over the nine) is under 0.05.

**Verdict**: PASS if one or more of the nine pass; INCONCLUSIVE if none passes but at least one has t >= 2 in confirmation
with a positive discovery mean; FAIL otherwise.

## Descriptive only (no verdict)

h = 1 and h = 20 for every measure; every measure per market (in % and in volatility units, with month-sum and Newey-West
t); the share of candles called buy / sell / none; switches a year; the hit rate and its base per market and ladder; the
switch's raw return in the call's direction.

## No look-ahead

A cut test runs before the report: for each market, the 5-minute candles are cut at ten random moments, the frames and
calls rebuilt, and every call of a working candle closed by the cut must equal the full-series call. Any mismatch stops the
run. One run, no variants, no parameter chosen from either window.

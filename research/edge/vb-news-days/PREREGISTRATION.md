# The two volatility breakouts on US top-tier release days (pre-registration, 24 Nov 2026)

Written and committed alone, before any trade of this study is split by release day. Paper research only; nothing live changes.

## Question
Do the gold and USD/JPY volatility breakouts (T1: UTC 00:00 open ± 0.5 × the previous trading day's range, both sides, stop at
the open, out at 21:00 UTC; the rule of `gold-vol-breakout` / `fx-vol-breakout`, imported, never edited) do differently on the
UTC days of a US CPI, payrolls (Employment Situation) or FOMC statement release than on other days?

Already read: `news-filter` (ICT / Meridian streams only, no breakout), `gold-release-quotes` (spreads at the release minute,
N4 after T+5), `red-folder-surprise` and `usdjpy-red-folder` (the first hour after the print, by the consensus miss). None
splits the breakout's trades by release day, so the question is open.

## Data (fixed)
- Candles: OANDA mid M5 from the shared candle cache (`research/edge/_lib/edgekit.mjs` DATA_DIR), xau and usdjpy.
- Trades: gold = `gold-vol-breakout-hourcost/costs.mjs` `tradesIn` (T1) charged C1 (`gold-vol-breakout-hourcost/run.mjs`
  `charge`, the measured demo hourly spread profile + commission from its result.json, slippage 0.05 × the fill candle's median
  range: the forward record's frozen cost). USD/JPY = `usdjpy-vol-breakout-early/run.mjs` `trades` (fx-vol-breakout's `vbTrade` +
  `charge`: 0.000045 of the entry + 0.5 pip a round trip). Gates before any split: gold 2021-01-01 → 2026-11-12 must give n 1121,
  net +0.105R, month t 2.79 (gold-vol-breakout-forward baseline); USD/JPY 2016-01-01 → 2026-11-19 must give n 2079, net +0.063R
  (fx-vol-breakout). A failed gate stops the run.
- Release days: the UTC date of each US CPI, payrolls and FOMC statement time, the union of `council/consensus-history.json`
  ("CPI m/m", "Non-Farm Employment Change", "Federal Funds Rate"; 2018-01 → 2025-04), `council/events.mjs` `HISTORY`
  (2022-01 → 2025-07) and `EVENTS` (types CPI, NFP, FOMC; 2025-08 on, only up to the data's end). Every release falls inside the
  rule's 00:00-21:00 UTC day (08:30 or 14:00 New York).
- **Coverage: release dates exist in the repository from January 2018 only.** The requested 2005-14 / 2015-now split cannot be
  used; windows are those of `red-folder-surprise` for the same reason: **discovery 2018-01-01 → 2021-12-31, confirmation
  2022-01-01 → data end.** Trades of 2005-2017 are not used (no dates to split them by).

## Tests (fixed: three, Holm over three)
Δ = mean net R on release days − mean net R on other days.
- **T1 gold**, **T2 USD/JPY**, **T3 pooled** (both markets' trades together; a day counts for both markets).
- For each: (a) Welch t of Δ on trades; (b) paired month t: for each calendar month with at least one release-day trade and one
  other-day trade, d_m = (mean release-day net) − (mean other-day net); t = mean(d_m) / (sd / √months). The judged statistic is
  (b); its two-sided normal p goes into Holm over T1-T3.
- **Control (random-day sets):** 2,000 draws per test and window, each a set of non-release tradable trades of the same size as
  the release-day trades, mean net R; the release-day mean's two-sided percentile in that distribution is reported.
- **A test holds** when: Δ has the same sign in discovery and confirmation; confirmation month t |t| ≥ 2 with Holm p < 0.05;
  Welch |t| ≥ 2 in confirmation; the release-day mean is outside the 2.5-97.5 % of the random-day sets in confirmation; at least
  100 release-day trades in confirmation for T1 / T2 and 200 for T3 (the 200 of the common bar cannot be reached by one market:
  about 3 releases a month). The question is two-sided: "differently" may be better or worse.
- Verdict: DIFFERENT (worse / better) if at least one test holds, else NO DIFFERENCE SHOWN.

## Reported, not tested
- Release days split by fill time: filled before the release minute vs at or after it (the fill candle's start against the
  release time), by type (CPI, payrolls, FOMC), net and gross, per window.
- Gross R (before costs) for every row.

## Limits said in advance
- The cost model is an hourly median; a fill in the release minute pays far more (`gold-release-quotes`: about 18x at T+5 s).
  So a fill at or just after the release is charged too little here; the descriptive split by fill time shows how many trades
  that concerns.
- OANDA mid candles, not broker ticks; about 280 release days in 2018 → now.

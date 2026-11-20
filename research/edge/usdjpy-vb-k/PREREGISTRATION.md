# USD/JPY T1: is k = 0.5 a lucky peak? (pre-registration, 20 Nov 2026)

Paper research only. A parameter-stability check, written and pushed alone before any USD/JPY figure at a k other than 0.5
was computed. It does **not** choose a new k: the tested rule stays k = 0.5. A setting that looks better here is not adopted.

## Why
USD/JPY's T1 (k 0.5) passed on 2005-15 (`usdjpy-vol-breakout-early`, +0.079R, month t 2.95) and 2016-26 (`fx-vol-breakout`,
+0.063R, t 2.50), at broker ticks and on HistData. `gold-vol-breakout-k` asked the same of gold (BROAD). A result that exists only
at k 0.5 is more likely chance among settings.

## Rule and data
- `index-vol-breakout/original.mjs` `buildDays`, `daySkip`, `vbTrade` and `fx-vol-breakout` `charge('usdjpy', …)` (the same calls
  as `usdjpy-vol-breakout-early` `trades`), with only `k` changed: k in {0.3, 0.4, 0.5, 0.6, 0.7}, both sides, the same skips,
  exit and cost.
- OANDA mid USD/JPY M5, the two study caches (`usdjpy-5m-early.json.gz` 2005-15, `usdjpy-5m.json.gz` 2016 → 2026-11-19).
- Gate first: k 0.5 must reproduce the published studies (2005-15 n 2,089 +0.079R; 2016 → 2026-11-19 n 2,079 +0.063R). If not,
  the study stops.

## Reading (fixed now)
- **BROAD**: pooled 2005 → 2026 net R a trade > 0 at every k of {0.3, 0.4, 0.6, 0.7} AND month t >= 2 at 3 or more of them.
- **NARROW** otherwise.
- Reported: n, net R, month t per k and window; gross R.

Nothing live changes either way.

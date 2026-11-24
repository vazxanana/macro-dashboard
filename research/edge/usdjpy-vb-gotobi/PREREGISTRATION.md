# USD/JPY T1 breakout on gotobi days: pre-registration (24 Nov 2026)

Written and committed alone before any figure of this question was computed. Paper research only; nothing live changes.

## Question

Does the USD/JPY volatility breakout (T1 as run by `usdjpy-vol-breakout-early` and `fx-vol-breakout`) behave differently on
gotobi days, the Tokyo settlement days on which `gotobi` T2 (sell USD/JPY 00:55 -> 06:00 UTC) passed?

## Rule, data, cost (all imported, nothing edited)

- Days, rule and trades: `research/edge/index-vol-breakout/original.mjs` `buildDays`, `daySkip`, `vbTrade` (k 0.5 from
  `fx-vol-breakout` `K`, both sides, stop at the day's 00:00 UTC open, out at 21:00 UTC), exactly as
  `usdjpy-vol-breakout-early` `trades` calls them.
- Cost: `fx-vol-breakout` `charge` (0.000045 of the entry + 0.5 pip a round trip; the demo's commission and a slippage
  allowance, as both USD/JPY studies used). R after costs = `net`.
- Candles: OANDA mid USD/JPY M5 from the shared cache (`research/edge/_lib/edgekit.mjs` `load('usdjpy', '5m')`), 2005-01-01 to
  the last complete day on file.
- Gotobi calendar: `council/gotobi-calendar.mjs` `isGotobi` (the trade day's UTC date = its Tokyo date, since 00:55 UTC is
  09:55 Tokyo the same date). A trade day is "gotobi" when `isGotobi(day)`, else "other".

## Windows

Discovery 2005-01-01 to 2014-12-31, confirmation 2015-01-01 to now (both windows were read by the parent studies for the
rule itself; this is a split by calendar, not a new rule).

## Tests (two, fixed)

- **G1**: T1 net R on gotobi days minus T1 net R on other days, all trades. Welch t (two-sided).
- **G2**: the same difference among SELL fills only (side -1): sell fills on gotobi days minus sell fills on other days. Welch t.
- Holm over G1 and G2 on the confirmation-window Welch p values.
- Also reported for each: month-level t of the monthly difference (mean gotobi net minus mean other net in months with both),
  and both groups' mean R before costs.

## Placebo

For each test and window: 2,000 random day sets of the same size as the gotobi set, drawn without replacement from the trade
days of that window (seeded mulberry32 from `gotobi` run.mjs `draw`/`mulberry32`), the same difference computed. Reported: the
share of random sets whose difference is at least as large in absolute value as the observed one.

## Pass bar (per test)

All of: (a) the difference has the same sign in discovery and confirmation; (b) confirmation |Welch t| >= 2 and Holm-adjusted
p < 0.05; (c) gotobi-group n >= 200 in confirmation; (d) the observed |difference| beats 95 % of the confirmation placebo sets.
And, for the difference to matter as a trade: the gotobi group's own net R must be positive after costs in both windows if the
difference is positive (a negative difference is reported as "worse on gotobi days").
Verdict: DIFFERENT (a test passes), NO DIFFERENCE (none passes).

## Descriptive only (no verdict)

G3: on gotobi days with both trades, the correlation of the T1 daily net R and the `gotobi` T2 fade net R (`gotobi` run.mjs
`trade`, `stopDist`, leg 'fade', imported), and the two as one book (sum of daily R, mean and month t). Same windows.

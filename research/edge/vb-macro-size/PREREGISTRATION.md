# Pre-registration: vb-macro-size (20 Nov 2026)

Paper research only. A test of one claim in the owner's macro rule book (the "Gold Macro Score" document) on the one gold rule
that has passed its own tests: the daily volatility breakout T1 (`gold-vol-breakout`, replicated on untouched 2007-15, filled at
the demo broker's ticks). The book says: **use the score to size, not to permit: full risk on gold longs when the score is above
+0.25, half otherwise; never short gold while the score is above +0.25.** `macro-donchian` tested that sizing on the book's own
Donchian swing rule and found no lift (longs above +0.25 +0.083R a trade against +0.080R, t 0.02). It has not been tested on T1.

Not a gate, exit, entry or size of the live gold book (owner decision 44: none of that book's records are read). Nothing live
changes; a pass is a proposal to add a sized variant to T1's forward record, never a live rule.

Written and pushed alone, before any code for it exists and before any T1 trade has been joined to a score.

## Data (fixed)

- T1 trades: `research/edge/gold-vol-breakout-hourcost/costs.mjs` `tradesIn` (the rule unchanged, `original.mjs` pinned by its
  sha256) on OANDA mid M5 gold read through the candle proxy (`research/edge/gold-gap-open/fetch.mjs`, `GGO_FROM=2006-12-01`,
  `GGO_TO=2026-11-13`), days from 2007-01-01 to 2026-11-12. **Gate**: the pooled 2007-26 stream must reproduce hourcost's
  `GATE.pooled` count and gross R a trade (n 3713, +0.155R) exactly, or the study stops.
- Net R: hourcost's route C1 (the demo's measured hourly spread profile and commission, `charge(…, 'frac', …)`, plus 0.05 × M
  slippage), the cost the forward record uses, from `research/edge/gold-vol-breakout-hourcost/result.json`.
- Score: the weekly Gold Macro Score exactly as `research/edge/blowoff-veto/run.mjs` `weeklyScore` builds it, from council-data
  `macro/cache.json` (FRED) and the dollar pairs' daily candles, as `macro-donchian` loads them. A trade carries the latest weekly
  reading dated **strictly before** its day (the weekly reading is Friday's close; a Friday trade takes the previous week's).

## Hypotheses (two tests, Holm over both)

- **H1, the sizing claim, longs**: T1 long trades with score > +0.25 make more net R a trade than T1 long trades with score
  <= +0.25. Statistic: Welch t of the difference of means (above minus at-or-below). Pass: t >= 2, Holm p < 0.05, and the
  difference positive in both halves (2007-2016 and 2017-2026).
- **H2, the "never short" claim, shorts**: T1 short trades with score > +0.25 make less net R a trade than shorts with score
  <= +0.25. Welch t of (above minus at-or-below) <= −2, Holm p < 0.05, the difference negative in both halves.
- Trades before the first score reading are left out of both and counted.

## Reported, not tested

- The book's sizing applied to T1 as a whole (longs ×1 above +0.25 else ×0.5; shorts ×0 above +0.25 else ×1) against flat 1R:
  total R, R per unit of risk taken, month-sum t and worst closed drawdown, pooled and per half.
- Win rates and counts in each cell; the same split on gross R.

## Limits said in advance

- The score's drivers and the rule book were written knowing 2007-26; no window is untouched by the claim's author. T1 itself was
  found on 2016-26 and replicated on 2007-15.
- About 3,700 trades over twenty years, but the score changes weekly and trades within a week share it: the t of a split is on
  trades, so it overstates independence. A pass is reported with a month-sum version beside it (post hoc, said so).
- Today's cost profile is charged for every year.
- Whatever the result, nothing live changes (absolute rule 3); a pass becomes a proposal, a fail is written up as such.

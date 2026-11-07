# Pre-registration: does the ICT A-setup edge depend on the macro regime?

Written on 7 Nov 2026, before any regime split of the ICT trades was computed. The only numbers seen before writing it were
the replay's overall A-setup totals (257 closed A-setups, +73.0R, +0.28R a trade) and the date range of the macro data.

## Trades

Every closed A-setup in council-data `ict/replay.json` (`aset && closed`, finite `R`): the same set the Coach's
`ictVariantVerdicts` (council/proposals.mjs) judges. R as stored (times size). Halves = each group's trades sorted by close
time and split by count, as in `ictVariantVerdicts`.

## Regime of a trade (no look-ahead)

- Day `D` = the UTC day of the signal (`signalAt`, the inversion candle's close). The regime is `features(data, D)` and
  `drivers(f)` from `council/macro.mjs`, unchanged: daily candles before `D` (the prior day's close) and FRED values only once
  macro.mjs's publication lag has passed.
- One change to the lags: VIX and VIX3M use the prior day's close (lag 1 day instead of 2), because Cboe posts the close the
  same evening, before the UTC day of the trade starts. All other series keep macro.mjs's `LAG`.
- Data is gathered with macro.mjs's own `gather()`. Where FRED or Cboe cannot be reached, it falls back to the last good copy in
  council-data `macro/cache.json`, which the Macro strategist fetched from FRED on GitHub Actions. A trade whose day lacks VIX,
  VIX3M or the HY 5-day change is "no data" and is left out of every split. The report states how many.

## Splits (descriptive, all reported)

| Split | Cells | Definition (thresholds from macro.mjs) |
|---|---|---|
| VIX level | high / low | VIX ≥ 22 (macro.mjs "elevated") vs < 22 |
| VIX curve | inverted / normal | VIX / VIX3M > 1 vs ≤ 1 |
| Dollar Smile side | left / right / trough / mid | `smileRegime()` phase |
| Credit stress | stress / calm | HY OAS 5-day change ≥ +0.08 pts (the macro.mjs `hy` driver on the stress side) vs not |

Each cell reports n, R per trade, t (mean vs 0), and both halves.

## Hypotheses (confirmatory; at most two)

- **H1. Equity-volatility stress.** A-setups taken when VIX ≥ 22 **or** VIX / VIX3M > 1 lose money. The proposed filter
  drops them. Reasoning: the model fades a liquidity sweep; in a stressed tape sweeps more often turn into continuation, and
  the 36-hour hold carries gap risk.
- **H2. Credit stress.** A-setups taken when HY OAS widened by ≥ +0.08 pts over 5 days lose money. The proposed filter drops
  them.

## Pass bar

A hypothesis passes only if the trades its filter drops meet the Coach's bar AND survive the correction:

1. n ≥ 30 dropped trades;
2. mean R with t ≤ −2;
3. negative mean R in both halves;
4. one-sided p ≤ 0.025 (Bonferroni over the 2 hypotheses).

## Multiple testing

Cells counted: 10 descriptive cells (2 + 2 + 4 + 2) plus the 2 hypothesis filters = 12. Every cell's one-sided p for
"mean R < 0" is Holm-adjusted over these 12. A descriptive cell cannot become a filter in this study, whatever its numbers:
only H1 or H2 can.

## If a filter passes

It becomes a paper-only ICT variant next to `nofri` / `h1opp`; the live stream must stay byte-identical. Otherwise the null
result goes to `RESULT.md`. No live rule changes either way.

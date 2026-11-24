# Fade rules with a cost floor: do the trades whose cost is a small share of the risk keep the tilt after costs? (pre-registration)

Written 24 Nov 2026, committed and pushed ALONE before any run of this study. Research only: nothing live reads it, nothing is
placed, no desk, rule or cost model changes from it.

## Why

Five rules shown on the Equinox page passed their own studies BEFORE costs and lose AFTER costs, because the round trip is a
large share of their small stops (mean cost / risk in 2015-26: 0.16 to 0.44R a trade):

| Rule | Study | Cell | Before costs 2015-26 | After costs |
|---|---|---|---:|---:|
| Break fade | `grid7-wide-fade` | m15 none atr 2R all | +0.042R (n 201,769, month t 11.33) | -0.118R |
| Big-candle fade | `big-candle-fade` | m15 k1.5 nobreak half | +0.193R (n 54,443, t 17.68) | -0.246R |
| Round-number fade | `round-number-breaks` | fade other 2R | +0.051R (n 88,734, t 8.68) | -0.307R |
| Box fade | `fade-breaks-holdout` | F1 | +0.057R set A / +0.056R set B | loses |
| FVG return | `grid7-fvg-wide` | 1h mkt large 1R | +0.035R (n 52,659, t 7.27) | -0.113R |

The question: is there a subset, chosen only by what is known at the entry, whose cost is small enough against its risk that
the before-cost tilt survives after costs? The one selector: **cost_R = COSTS[market] / risk at entry**, where risk =
|fill - stop| with the fill (the next 5-minute open) and the stop as the rule places them at the entry. Nothing else (no
outcome, no later candle, no volatility forecast) enters the selection.

## Trades

Each rule's trades are produced by that study's OWN exported signal code, unchanged, through the Equinox desks' adapters in
`council/edge-desks-2.mjs` (`fadeTrades`, `bigTrades`, `roundTrades`, `boxTrades`, `fvgTrades`), which import those studies'
`signals` / `events` / cell constants and manage each position with `walk` (the order of the studies' own `exits()` /
`manage()`, compared trade by trade in `tests/edge-desks-2.test.mjs`). Nothing in those files or in the five studies is edited.
Their rules: market entry at the next 5-minute open; the studies' own "risk under one round trip" skip; their own targets and
time limits. As in the studies: the ten markets `xau xag eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy`, OANDA mid
5-minute candles from `research/edge/_lib/edgekit.mjs` (`load`, default `DATA_DIR`), fills from 2005-01-01 to 2026-10-31, the
data-quality exclusions of `combo-grid-2` `exclusions(market)` dropped by fill time, a trade still open on the last candle read
is dropped.

**Costs**: the round trip `COSTS[market]` of `combo-grid-2` (= `edgekit` `COSTS` for these ten markets), the same for every year;
R after costs = R - cost / risk. Measured demo figures for xau, eurusd, gbpusd, usdjpy, audusd; **ASSUMED, not measured** for
xag, nzdusd, usdcad, usdchf, eurjpy (said beside every pooled figure; the five measured markets are also reported alone,
descriptive, not judged).

**Windows**: discovery = fills 2005-01-01 to 2014-12-31; confirmation = 2015-01-01 to 2026-10-31.

## Gate (harness parity, before anything is judged)

For each rule, the FULL trade set (no cost floor) must reproduce its study's published before-cost figures: n within 2 % and
mean R within 0.01R in each window (fade, big-candle, round-number, FVG: their published 2005-14 and 2015-26 rows; box fade: the
published holdout set A = xau eurusd gbpusd usdjpy audusd fills 2005-2009, n 29,000, +0.0573R). A rule that misses its gate
is reported as INVALID (not judged). One fix of the harness (never of the selection or of the rule) is allowed and is then said
in RESULT.md.

## Tests (15) and the bar

For each rule (5) and each cost floor **cost_R <= 0.03, <= 0.05, <= 0.10** (3, fixed here, nothing else tried), pooled over the
ten markets, the kept trades are judged AFTER costs. A test passes only with all of:

1. mean R after costs > 0 in discovery AND in confirmation;
2. n >= 200 in confirmation;
3. month-sum t >= 2 in confirmation (calendar-month sums of R after costs by fill month, empty months 0), with the one-sided
   p of that t Holm-adjusted over the 15 tests < 0.05;
4. **control**: the same kept trades with the side chosen by a seeded coin (mulberry32 seed 20261124, drawn in trade order per
   rule and floor; the other side = the mirror: same fill, the stop the same distance on the other side, the target the same
   R multiple on the other side, same time limit and fill rule, same cost) must NOT be positive with month t >= 2 in
   confirmation, AND the paired difference faded minus coin (per trade, summed by month) must have month-sum t >= 2 in
   confirmation. This guards against "volatile days pay any side" (the cost floor keeps the high-volatility trades).

Beside, reported and not judged: the WITH-the-break mirror on the same kept trades, the share of trades kept, the kept trades'
before-cost mean (does the tilt itself grow or shrink at high risk?), per market, per year, and the five measured-cost markets alone.

**Verdict**: PASS if at least one of the 15 tests passes; FAIL otherwise; INCONCLUSIVE if every test misses only on n.
A pass is a before-cost tilt that survives the round trip in the kept trades on these candles, nothing more: mid candles, a
fixed cost in price units for twenty years, no slippage beyond the round trip. It is not an edge, nothing live changes from
it, and any use would need its own forward record.

## Disclosure

Before writing this, the five studies' RESULT.md files were read (the figures above), and their mean cost / risk by window.
No cost-floor figure of any rule had been computed or seen. One run; no thresholds other than the three above.

## Files

`run.mjs` (`market <m> <outDir>` one market's trades; `report <outDir>` the pooled tests, writes `result.json`), `RESULT.md`,
`result.json`, `tests/fade-cost-floor.test.mjs`. The per-market trade files stay outside git.

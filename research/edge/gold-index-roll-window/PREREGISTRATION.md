# Pre-registration: spot gold over the commodity-index roll window (14 Nov 2026)

Written and pushed alone, before any return or price change of the test was computed. Only the calendar was read to count
events (the time column of council-data `research/daily/xau.json`). A stand-alone calendar rule on spot gold: not a gate,
exit, entry or size of the live gold book, whose positions are not read (docs/owner-decisions.md item 44). Paper research;
nothing live changes and no proposal follows from this study whatever its result.

## Hypothesis and economic prior
The two large commodity indices (the S&P GSCI and the Bloomberg Commodity Index) roll their futures holdings from the expiring
contract to the next one over the 5th to 9th business days of the month, a fifth of the position a day. Index-tracking money
sells the nearby contract on those days. The documented effect (front-running of the "Goldman roll") is on the calendar spread:
the nearby contract is pressed during the roll window and recovers after it. Spot gold is tied to the nearby COMEX contract by
arbitrage, so if the selling moves the nearby level rather than only the spread, spot gold is weaker over trading days 5-9 than
over an ordinary five days of the same year, and firmer in the five days after. Both indices hold gold in February, April,
June, August and December contracts, so gold itself is rolled only in January, March, May, July and November; in the other
months any effect can only come through other commodities' rolls (a weaker prior, stated now).

Already tested and not repeated: the month-end equities-vs-gold rebalancing flow (`gold-rebalance-flow`, FAIL), the turn of the
month (`gold-turn-of-month`, TD-2 to TD+3, FAIL), the mid-month turn against the month-to-date move (`gold-mid-month-turn`,
FAIL, a reversal rule, not a calendar-window rule), the COMEX options-expiry and first-notice windows (`gold-comex-calendar`,
FAIL), quarter end / quarter open, month of year, and the index CFD roll week (`index-roll-week`, equity futures). No study has
tested gold over the commodity-index roll window. The January index reweight gives one event a year (about 10 a window): too
few, not tested.

## Data
- Council-data `research/daily/xau.json` (OANDA mid spot gold, UTC daily candles), read through `git show origin/council-data`,
  no network. Weekend candles folded into Monday with `council/fills.mjs` `foldWeekend`.
- TDk = the k-th folded candle of the calendar month. Months with fewer than 14 candles are skipped (none expected).
- In sample: entry months 2007-01 to 2016-12. Out of sample: 2017-01 to 2026-10.
- Counted before this file (calendar only): every month 120 in sample, 118 out of sample; gold roll months 50 and 49.

## The trade and the three tests (fixed now; Holm over these three)
Each trade enters at the close of a daily candle and exits at the close of the fifth candle after it, with a stop at
2 x ATR(20) (mean true range of the 20 candles before the entry candle, the entry candle included) from the entry, checked on
the five candles' highs and lows; a candle that opens through the stop fills at its open. R = move / (2 x ATR).
- **T1 (primary): short**, entry close of TD4, exit close of TD9 (holds trading days 5-9), every month.
- **T2: the same short in gold roll months only** (Jan, Mar, May, Jul, Nov). About 50 trades a window: under 100, so it is
  reported as the gold-specific reading and judged by the same bar, knowing its power is lower.
- **T3: long**, entry close of TD9, exit close of TD14 (the five days after the roll), every month.

## Costs
$0.60 a round trip (the $0.30 gold spread plus half a spread of slippage on each market order), and on buys
`nights(entry, exit) x FIN.xau.long x entry price` (today's demo rate, 0.0148 % of price a rollover, charged in every year).
Shorts are credited nothing. All in R.

## Baseline and statistics
- **Same-side every-day baseline of the same year**: the same trade (same side, five candles, same stop, same costs) entered at
  the close of every candle of that calendar year that has five candles after it. Excess = a trade's net R minus the baseline of
  its side and entry year. At 2x costs the baseline is also at 2x.
- t = one-sample t of calendar-month sums (every month of the window counts, a month with no trade counts 0), on gross, net and
  excess. Two-sided p from the out-of-sample excess t, Holm over T1-T3.
- **Placebo**: 40 seeds; each out-of-sample month of T1 enters instead at a random candle of the same month (TD1 to the 5th
  last, TD4 excluded), same side, hold, stop and costs; out-of-sample excess month t per seed.
- **Control keeping drift and volatility**: 40 seeded synthetic gold series, each built by resampling 20-candle blocks of the
  real candles' moves (open, high, low, close relative to the previous close) within each calendar year, keeping that year's
  drift and volatility and the real dates; T1 run on each, out-of-sample excess month t per series.

## Pass bar (all on T1)
1. Out-of-sample excess > 0 with month t >= 2 and Holm-adjusted p < 0.05.
2. In-sample excess > 0 (same sign).
3. Out-of-sample net R a trade > 0 at 2x costs.
4. The real out-of-sample excess t above at least 38 of 40 placebo seeds and at least 38 of 40 control series.
T2 and T3 are reported against the same bar; only T1 can give a PASS. No variant (window, hold, stop, months) will be tried after
the result.

## Deliverables
`run.mjs`, `RESULT.md`, `result.json` in this folder, `tests/gold-index-roll-window.test.mjs`, `out/` rebuilt. Branch
`gold-index-roll-window`, no pull request.

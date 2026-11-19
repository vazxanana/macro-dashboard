# Pre-registration: gold at a 20-day extreme in most other currencies but not in dollars (14 Nov 2026)

Written and pushed alone, before any trade result of this study was computed. Only the signal and trade COUNTS below were
read (to meet the 100-events-per-window floor); no price outcome, R, t or placebo was computed. Paper research only: a
**stand-alone rule on gold**, not a gate, entry, exit or size of the live gold book (Gold trend + Gold daily engulf); its
2006-17 positions are not read and nothing is compared with or applied to that book (docs/owner-decisions.md item 44).
Nothing live changes.

## Hypothesis and why
Gold priced in dollars mixes gold's own move with the dollar's. When gold closes at a new 20-day high in **several** other
currencies at once (EUR, GBP, JPY, CHF, AUD) while it is not at a 20-day high in dollars, demand for gold itself is strong
and only a broadly firm dollar holds the dollar price back. The hypothesis: the dollar price catches up over the next days
(and the mirror for lows). Prior: the practice of reading gold's price across currencies (World Gold Council's gold price by
currency series), and Baur and McDermott 2010 (gold's role differs by currency area). Not opened from this sandbox; nothing
here relies on their numbers.

Dedupe (checked 14 Nov 2026 on every remote branch and `research/edge/`):
- `gold-euro-divergence` (near miss, not re-tested): ONE currency (EUR). This study needs a **count** over five currencies
  (with EUR only one of them), so its signal days differ; it is not a new parameter of that rule.
- `gold-currency-breadth`: the sign of gold's 20-day RETURN agreeing in all six currencies, trend-following until the
  agreement ends; it never asks whether the dollar price lags. This study trades only the lag, for a fixed hold.
- `gold-asia-fx-move`, `gold-aud-haven-day`, `gold-em-fx-stress`, `gold-commodity-fx-lead`: one-day FX moves, not 20-day
  extremes of gold in other currencies.

## Data (named before any result)
council-data `research/daily/<key>.json` (OANDA mid, UTC days) at commit `f2370a08` of `origin/council-data`: `xau`, `eurusd`,
`gbpusd`, `usdjpy`, `usdchf`, `audusd`. Weekends folded into the next weekday with `council/fills.mjs` `foldWeekend`. Gold in
EUR, GBP, AUD = xau / pair; in JPY, CHF = xau x pair; a common day needs all six closes. Trades on XAU/USD. The candle copy is
kept outside git and deleted after the run.

## Rule
- On each common day d (with 20 common days before it; a hole of more than 5 calendar days restarts the count): for each of
  the five non-USD gold prices, a HIGH when its close is above the highest close of the 20 common days before d, a LOW below
  the lowest. nHi, nLo = the counts.
- Long signal: nHi >= `need` and XAU/USD's close is NOT above its own 20-day closing high. Short signal: nLo >= `need` and
  XAU/USD's close is NOT below its own 20-day closing low.
- Entry: the next XAU/USD daily open in the signal's direction; one position at a time per test (a signal while a position
  is open is ignored).
- Stop: 2 x ATR(20) of the 20 gold candles before the entry candle (1R); a candle that opens through the stop exits at its
  open, otherwise at the stop. Exit by time at the close of the `hold`-th candle.
- Costs: $0.60 a round trip, plus `nights(entry, exit)` x `FIN.xau.long` (0.000148, the demo's swap, today's rate for every
  year) x entry price on buys; sells pay and receive nothing. R net = (gross move - costs) / 1R.

## Tests (three, Holm over all three)
| Test | need | sides | hold | stop | IS signal days / trades | OOS signal days / trades |
|---|---|---|---|---|---|---|
| **T1 (primary)** | 2 of 5 | both | 5 candles | 2 x ATR(20) | 306 / 187 | 321 / 183 |
| T2 | 3 of 5 | both | 3 candles | 2 x ATR(20) | 143 / 116 | 132 / 100 |
| T3 | 2 of 5 | both | 3 candles | 2 x ATR(20) | 306 / 224 | 321 / 226 |

Windows by signal date: in sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31.

## Statistics and the bar
- Baseline: the same trade (same side, hold, stop, costs) entered after EVERY eligible day of the same calendar year;
  excess = a trade's net R minus that year-and-side mean. Reported with its month t.
- t = mean / standard error of calendar-month sums of net R (months with no trade count 0), by exit month; one-sided p from
  the normal; Holm over T1-T3.
- **Placebo (seeds 1-40)**: each out-of-sample signal day is moved to a random eligible day of the SAME calendar year with
  the same side, then traded by the same rule.
- **Control (seeds 1001-1040)**: each of the five pairs is shifted in time against gold by its own random circular offset
  (at least 250 common days, at most the series length minus 250), the non-USD gold prices and signals are rebuilt and
  traded. The pairs keep their own drift and volatility and gold is untouched; only the timing link between the currencies
  and gold is removed.
- A test passes only when ALL hold: OOS month t (net) >= 2 with Holm p < 0.05; IS net mean > 0; OOS net mean > 0 at 2x costs;
  OOS excess over the baseline > 0; OOS month t above at least 38 of 40 placebo draws AND at least 38 of 40 control draws;
  n >= 100 in both windows. Verdict PASS only when T1 passes; T2 or T3 alone is PARTIAL and proposes nothing; else FAIL.

## Reported, not tested
Long and short splits, gross figures, stops, median risk. No variant chosen after seeing results becomes a rule, and none is
re-run.

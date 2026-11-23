# The Engulfing desk's zone readings on 18 markets, 2020 to now (pre-registration, 23 Nov 2026)

Written and committed alone, before any trade of this study was computed. Paper research only: nothing live changes,
no desk rule is edited, nothing is placed.

## Question

Do the Engulfing desk's own zone readings, run with the desk's code as it stands today, make money after costs on 18
markets from 2020 to now, in a discovery window and again in a later confirmation window?

`research/edge/desk-rigor` tested some of them on gold, EUR/USD and GBP/USD 2020-2025 before later code changes (the
three-candle engulf, 30 pips in each market's own pip, the targets of 22 Nov, the H4 EF barrier). This is the full test of
today's code on every market of the research cache.

## Tests (six, Holm over all six)

All from `council/eg-methods.mjs`, imported, never edited:

| | Reading | Call | kind |
|---|---|---|---|
| T1 | The plan (with the Daily) | `methodTrades(B, { from, market })` (span 'any') | `eg-plan` |
| T2 | The short method (H4 zone, not with the Daily) | same call | `eg-simple` |
| T3 | The direct entry (fresh zones, trailed stop) | same call | `eg-direct` |
| T4 | The plan, next-candle engulf | `methodTrades(B, { from, market, span: 'next' })` | `eg-plan-n` |
| T5 | The short method, next-candle engulf | same call | `eg-simple-n` |
| T6 | H4 EF barrier to the next H4 EG | `efTrades(B, { from, market })` | `eg-ef` |

T1-T3 come from one call and share its one-position-at-a-time rule, T4-T5 likewise, exactly as the desk records them.
Stops, targets, order lives and exits are the code's today (T1 / T2 / T4 1R, T5 4R, T3 no target with the M5 EF trail,
T6 the nearest opposite H4 zone at 2R or more). The M1 EF entry is out (no one-minute cache).

## Data

- Markets (18): xau eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy xag gbpjpy eurgbp audjpy cadjpy euraud
  nas100 spx500 de40.
- OANDA mid 5-minute candles of the research cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`), from 2019-03-01
  for warm-up; 15-minute, 1-hour and 4-hour candles grouped from them in UTC buckets (a bucket keeps whatever 5-minute
  candles it has); daily candles from the cache's 1d files (raw UTC days; `methodTrades` folds weekends itself). Every
  candle is handed in the code's own `{ time, open, high, low, close }` shape, closed candles only.
- Window: entries (fill time) from 2020-01-01 to the last candle. Discovery 2020-01-01 to 2023-12-31, confirmation
  2024-01-01 to the last candle. Trades still open at the last candle are left out.
- Data quality: a trade whose fill falls inside a bad interval of `research/edge/data-quality/quality.json`
  (`combo-grid-2/run.mjs` `exclusions`) is dropped.
- One in-memory adjustment, no file edited: `pipOfMarket` reads the market's decimals from `assets/mosha-sop.js` `ALL`,
  which lists only 11 markets; for the other eight it falls back to gold's 0.10, which would give EUR/JPY a 300-pip stop.
  Before running, the study adds to that object in memory the decimals OANDA quotes: nzdusd, usdchf, eurgbp, euraud 5;
  eurjpy, gbpjpy, audjpy, cadjpy 3. So every market's stop is 30 of its own pips, the desk's stated rule. The other ten
  markets are untouched.

## Costs

Round trip in price units, `combo-grid-2/run.mjs` `COSTS` (the desk's demo figures for the measured markets, the
grid's assumed figures for the rest). Net R = R − cost / risk, risk = |entry − stop| at the fill. Twice the cost is reported.

## Pass bar (per test)

PASS only if all hold:

1. Discovery (2020-2023): n ≥ 100, mean net R > 0, month-sum t ≥ 2.
2. Confirmation (2024 on): n ≥ 50, mean net R > 0, month-sum t ≥ 2, and the Holm-adjusted one-sided p of the confirmation
   month-sum t over the six tests < 0.05.
3. Mean R at twice the cost > 0 in both windows.

Month-sum t = t of the calendar-month sums of net R (empty months between the first and last trade count as 0), pooled
over the 18 markets. Fewer trades than the bar in either window = FAIL (too few to judge).

## Reported, not judged

- Gold, EUR/USD and GBP/USD alone per test, both windows (descriptive rows: no verdict).
- Each market's confirmation n and mean net R; results before costs; by year.

## Look-ahead check

On one market, the same calls on candles cut at three moments: every trade filled and closed before a cut must be the
same in the cut run and the full run (id, fill, entry, stop, exit, R). Any difference makes the study INVALID.

## Reading

A pass is a candidate for its own forward record, not an edge. A fail closes the question for today's code on these
years: no variants of these readings are tried on 2020-now after this.

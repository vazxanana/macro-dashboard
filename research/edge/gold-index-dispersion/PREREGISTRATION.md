# Pre-registration: spot gold after a day of wide dispersion across world equity indices (14 Nov 2026)

Written and pushed ALONE, before any return, R or t of this rule was computed. Paper research only: a **stand-alone rule
on gold**, never a gate, entry, exit or size of the live gold book, and none of the book's 2006-17 positions is read
(docs/owner-decisions.md item 44). No live rule, size, filter, stop, config or cost constant changes, whatever the result.

## Idea

On most days the world's equity indices move together. On some days they split apart: one region falls while another
rises, or one market gaps on its own news. The cross-sectional dispersion of index returns is a reading of
**disagreement / idiosyncratic risk across countries** (a regional crisis, a currency or policy shock in one bloc). The
hypothesis: such days precede **above-normal gold returns** over the next days, as money looking for a store of value
that belongs to no single country moves into gold. This is a cross-market, structural reading; it is not an oscillator and
not the equity-shock (level) study `gold-haven-shock` (branch `gold-haven-shock`: a large S&P 500 / Nasdaq fall), which reads the average move,
not the spread between markets. Nearest tested topics and the difference:
- `gold-haven-shock`: gold after a large US index fall (level of one market). Here: the SPREAD across 13 markets, whatever
  the average move.
- `gold-equity-bear`, `gold-spx-rs`, `gold-equity-corr-momentum`: US index trend, relative strength, correlation of gold
  with equities. None reads dispersion across countries.
- `gold-currency-breadth`, `gold-metals-confirm`: breadth of gold across currencies / metals, not of equity markets.

## What was looked at before writing this

Only the EVENT COUNT, to meet the 100-event floor (no return was computed): non-overlapping events with the definition
below, 2007-16 / 2017-26: 1-day hold 205 / 200, 5-day hold 123 / 129, 10-day hold 90 / 98 (so 10 days is not tested).

## Data (fixed now)

- council-data `research/daily/<key>.json` (OANDA mid, UTC daily candles), read with `git show origin/council-data:…`, no
  network, no cache kept in git. Each market's candles go through `council/fills.mjs` `foldWeekend` (weekend stubs into
  Monday).
- Gold: `xau` (from March 2006).
- **The index set, fixed now (13 CFDs with history from 2003-04)**: `au200 ch20 de40 eu50 fr40 hk33 jp225 nas100 sg30 spx500
  uk100 us2000 us30`. Left out on purpose because their history starts later: `cn50`, `in50` (2011), `es35` (2016), `nl25`
  (2008). No market is added or dropped after a result.

## Rule (fixed now)

1. A market's return on UTC date D = ln(close_D / close of its previous candle), only when that previous candle is at most
   5 calendar days earlier.
2. Dispersion on D = the sample standard deviation of those returns across the markets that have one on D; at least 10 of
   the 13 must have one, else D has no reading.
3. **Event** = a gold candle date D whose dispersion is above the 90th percentile (sorted value at index floor(0.9 x 250))
   of the 250 previous readings (strictly before D). Everything is known at gold's close of D: no later candle is read.
4. **Trade**: buy gold at the close of D; stop = entry − 2 x ATR(20) of gold (candles up to and including D); out at the
   close of the H-th gold candle after D, or at the stop (checked on each candle's low; a gap through it fills at the open,
   `fills.mjs` `stopFill`). R = (exit − entry) / (2 x ATR).
5. **One at a time**: an event while a trade of the same test is still open is skipped (counts above).
6. **Costs**: $0.60 a round trip (the $0.30 spread plus half a spread of slippage on each market order) / risk, plus
   financing: nights (`fills.mjs` `nights`, Mon-Fri 22:00 UTC rollovers, Wednesday three) x `FIN.xau.long` (0.000148 of
   price a rollover, the demo broker's XAUUSD swap of 11 Nov 2026) x entry / risk. 2x costs = $1.20 and double financing.

## Baseline

For each calendar year, the same long trade (same H, stop, costs) entered at the close of EVERY gold candle of that year
(overlapping, no event filter). An event's **excess** = its net R minus the baseline's mean net R of its entry year. The
rule is judged on the excess, so a test cannot pass merely because gold rose in those years.

## Tests (three, Holm over the three)

- **T1 (primary)**: H = 5 gold candles.
- **T2**: H = 1.
- **T3**: H = 3.

Windows by the entry's month: **in sample 2007-01 to 2016-12, out of sample 2017-01 to 2026-10.**

Statistic: t of the excess on calendar-month sums (events grouped by entry month), one-sided upper p, Holm over T1-T3.
Reported beside it: mean net and gross R, t on month sums of net and of gross R, win rate, stops, the baseline's mean,
and the same in sample.

## Pass bar (a test passes only on all of these)

1. Out of sample mean excess > 0 and its month-sum t >= 2.
2. Holm-adjusted p < 0.05.
3. In sample mean excess > 0 (same sign).
4. Out of sample excess still > 0 at 2x costs (events and baseline both at 2x).
5. Out of sample mean net R > 0 (the trade itself makes money after costs).
6. Placebo: 40 seeded draws (mulberry32, seed 20261114 + s). Each draw replaces the out-of-sample events with random
   non-event gold candles of the same calendar years, as many per year as there were events, then applies the same
   one-at-a-time rule; the statistic is the mean excess. The test must beat at least 38 of 40.

Verdict: PASS if T1 passes; T2 and T3 are reported and can only add a lead, never replace T1. A PASS would be a lead to
replicate on other years or markets, not an edge, and would change nothing live.

## Not done, on purpose

No other threshold (80th, 95th), lookback, index set, hold, short side or volatility scaling is tried; a dispersion
measured on weekly returns is not tried. If the result fails, no variant is run on these data.

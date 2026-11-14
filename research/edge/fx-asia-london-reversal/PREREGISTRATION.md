# Asian-session move reversed in London, forex majors: pre-registration

Written and committed on 14 Nov 2026, before any candle was read for this study and before any trade was computed. Paper
research only: no live rule, size, filter, cost model or mirror setting is changed by this study, whatever it finds.

## Why

A widely taught session effect: the Asian session drifts on thin liquidity, and London, with the bulk of forex volume, takes
back a large Asian move. Not tested in this repository: `fx-london-orb` traded the London opening RANGE (follow and fade of
the 07:00-08:00 London range), `fx-tokyo-orb` the Tokyo opening range, `fx-home-hours` a currency's drift in its own home
hours. None conditioned on the size of the 00:00-07:00 UTC move or faded it at the London open. Tested here once, as one fixed
rule, with the pass bar below written before any result exists.

## Data

- OANDA mid M5 candles through the council's keyless proxy (`/md/bars?sym=<key>&tf=5m&from=&to=`, 4,999-candle windows,
  only rows with `src: 'OANDA'`), the same feed and fetch as `fx-london-orb`. From 2015-11-01 (warm-up for the ATR) to
  2026-11-12 23:55 UTC (the last complete day before this file). Files kept outside git.
- Markets (OANDA keys): `eurusd`, `gbpusd`, `audusd`, `nzdusd`, `usdjpy`, `usdcad`, `usdchf`. Pip 0.0001; 0.01 for USD/JPY.
- **In sample: trades entered 2016-01-01 to 2021-06-30. Out of sample: 2021-07-01 to 2026-11-12** (about half each). Nothing
  is tuned on either: every number below is fixed now.

## Clock (fixed choice: UTC, not London local time)

All times are UTC. A candle belongs to a time by its open time. A trade day is a UTC calendar day Monday to Friday; no
holiday list (a day with too few candles is skipped, below).

## The rule

- **Asia window**: the M5 candles opening 00:00 to 06:55 UTC (84 candles). The day is skipped when fewer than 80 are present.
  `asiaOpen` = the open of the first of them, `asiaClose` = the close of the last, `asiaHigh` / `asiaLow` = highest high /
  lowest low, `asiaRange = asiaHigh - asiaLow`, `asiaMove = asiaClose - asiaOpen`.
- **Size gate**: `ATR20` = the mean true range of the 20 completed daily candles before the day, daily candles being New York
  days (17:00 New York to 17:00 New York, built from the same M5 candles; a New York day with fewer than 100 candles is not a
  daily candle; true range uses the previous daily candle's close). The New York day that ends before 00:00 UTC of the trade
  day is the last one used: nothing of the trade day is read. **k = 0.3**: a trade only when `|asiaMove| > 0.3 x ATR20`.
  Days before 20 daily candles exist are skipped.
- **Entry**: AGAINST the Asian move, at market, at the open of the first M5 candle opening at or after 07:00 UTC; no trade
  when that candle opens at or after 07:30 UTC. Asia up (`asiaMove > 0`) -> sell; Asia down -> buy.
- **Stop (every trade has one)**: one Asia range beyond the Asia extreme on the losing side: sell `stop = asiaHigh + asiaRange`,
  buy `stop = asiaLow - asiaRange`. No trade when the entry open is already at or beyond the stop. `r0 = |entry - stop|` (1R).
- **Exit**: at the stop, or at the close of the last M5 candle opening before 12:00 UTC (normally 11:55). No target. A candle
  that opens beyond the stop exits at its open; a candle that touches the stop exits at the stop; the entry candle is checked
  for the stop (its open is the entry).
- One trade per pair per day at most; no re-entry.

## Costs (net R)

Exactly `fx-london-orb`'s model, the raw-spread demo's measured model (CLAUDE.md "Forex spreads", 12 Nov 2026), charged per
trade in price, then divided by `r0`:
- spread 0.3 pip a round trip;
- commission 22.5 USD per million USD of notional a side: round trip `2 x 22.5e-6 x entry price` in the quote currency per
  unit (true for every one of these pairs, USD base or USD quote);
- slippage 0.5 pip on every market fill: the entry, and the exit (a stop and a time exit are both market fills), so 1 pip.
Reported at cost 0 (gross), base, and 2x base.

## Statistics and the pass bar

t is always on calendar-month sums: the net R of a stream's trades summed per calendar month of the window, every month
counted (a month with no trade is 0), t = mean / (sd / sqrt(months)). One-sided p from the normal approximation. Holm across
the eight tests (seven pairs and the pool) on the out-of-sample one-sided p.

Placebo: 40 seeds (seeded uniform draws, mulberry32, seeds 1-40). For every real out-of-sample trade, a placebo trade on the
same pair and day, same entry candle, same stop DISTANCE and same exit rule and costs, but with its direction drawn at random
(buy or sell with equal chance). Statistic: the pooled out-of-sample mean net R a trade. Percentile by linear interpolation.

**The study PASSES only when the pool (seven pairs together) meets all four:**
1. out-of-sample month-sum t >= 2, net of base costs;
2. in-sample mean net R a trade > 0 (base costs);
3. out-of-sample mean net R a trade > 0 at 2x costs;
4. out-of-sample mean net R a trade above the 95th percentile of the 40 placebo means.

Else FAIL. The Holm-adjusted p of the pool and of each pair, per-pair and per-year figures, and gross figures are reported. A
single pair is reported as passing only when it meets the same four on its own trades AND its Holm-adjusted p < 0.05; it does
not change the study's verdict. A pass would only be a proposal to the owner (`research/proposals/`), never a live change.

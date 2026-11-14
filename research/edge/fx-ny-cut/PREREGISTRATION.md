# The 10:00 New York option cut, forex majors: pre-registration

Written and committed on 14 Nov 2026, before any candle was read for this study and before any trade was computed. Paper
research only: no live rule, size, filter, cost model or mirror setting is changed by this study, whatever it finds. A pass
would only be a proposal to the owner (`research/proposals/`), never a live change.

## Why

Over-the-counter currency options expire every business day at 10:00 New York (the "NY cut"). A widely taught desk story:
dealers who hedge large options struck near the spot price buy and sell around the strike in the last hour, so price is drawn
to ("pinned at") the strike before 10:00 and is released after it. Strikes cluster at round numbers. Not tested in this
repository: `fx-round-numbers` (14 Nov, FAIL) traded a stall and a break at 100-pip levels at any hour on M15 candles;
`london-fix` and `wmr-fix-reversal` the 16:00 London fix; `fx-london-orb` and `fx-asia-london-reversal` the London open. None
conditioned on the hour before 10:00 New York or on 50-pip levels. Tested here once, as one fixed rule, with the pass bar
below written before any result exists.

**Known limitation, said now:** option strike and open-interest data are not available to this repository (no free, keyless
source; the expiry lists published by banks and news services are not archived here). Round numbers are a PROXY for where
strikes sit. A FAIL here does not show that real expiries have no effect; it shows that the round-number proxy does not give
a trade.

## Data

- OANDA mid M5 candles through the council's keyless proxy (`/md/bars?sym=<key>&tf=5m&from=&to=`, 4,999-candle windows,
  only rows with `src: 'OANDA'`): the same feed, range and fetch code as `fx-asia-london-reversal` (2015-11-01 to 2026-11-12
  23:55 UTC, the last complete day before 13 Nov). Copies already fetched by that study in this session may be reused (same
  code, same range); otherwise `run.mjs fetch` fetches them. Files kept outside git.
- Markets (OANDA keys): `eurusd`, `gbpusd`, `audusd`, `nzdusd`, `usdcad`, `usdchf`, `usdjpy`. Pip 0.0001; 0.01 for USD/JPY.
- **In sample: trades entered 2016-01-01 to 2021-06-30. Out of sample: 2021-07-01 to 2026-11-12** (about half each).
  Nothing is tuned on either: every number below is fixed now.

## Clock

New York local time with US daylight saving time: UTC-4 from the second Sunday of March 07:00 UTC to the first Sunday of
November 06:00 UTC, else UTC-5 (the rule in force since 2007, the whole sample). So 09:00 New York is 13:00 UTC in US daylight
time and 14:00 UTC otherwise; 10:00 New York is 14:00 / 15:00 UTC. A candle belongs to a time by its open time. A trade day
is a New York calendar day, Monday to Friday; no holiday list (a day with too few candles is skipped, below).

## The levels

- Grid step `G` = 50 pips: 0.0050 on the six dollar pairs other than USD/JPY, 0.50 on USD/JPY.
- **Round levels**: every multiple of `G` (1.0850, 1.0900, 1.0950, ...; 150.00, 150.50, ...). `L` = the multiple of `G`
  nearest to the price at 09:00 New York (`round(price / G) x G`).

## The primary rule (decides the study)

- **Price at 09:00** (`p9`) = the open of the M5 candle that opens at exactly 09:00 New York. No such candle: no trade.
- **Distance gate, d = 10 pips**: `dist = |p9 - L|`. A trade only when `1 pip <= dist <= 10 pips` (closer than 1 pip the
  direction toward the level is not defined: no trade).
- **Hour present**: at least 10 of the 12 M5 candles opening 09:00-09:55 New York exist; else no trade.
- **Direction: TOWARD the level**: `L > p9` -> buy; `L < p9` -> sell.
- **Entry**: at market, at `p9` (the open of the 09:00 candle).
- **Stop (every trade has one)**: `S = 1.5 x H20`, where `H20` = the mean of the 09:00-10:00 New York range (highest high
  minus lowest low of the candles opening 09:00-09:55) over the 20 most recent EARLIER trade days of that pair whose hour had
  at least 10 candles. Nothing of the trade day is read. Fewer than 20 such days: no trade (warm-up). Buy stop = `p9 - S`,
  sell stop = `p9 + S`. `r0 = S` (1R).
- **Exit**: at the stop, or at the close of the last M5 candle opening before 10:00 New York (normally 09:55). No target.
  The entry candle is checked for the stop (its open is the entry); a later candle that opens beyond the stop exits at its
  open; a candle that touches the stop exits at the stop.
- One trade per pair per day at most.

## Reported only (does not change the verdict)

- **The release after the cut**: on every day the primary rule traded, at 10:00 New York (the open of the candle opening at
  exactly 10:00; none: not counted), a trade AWAY from the same level `L`: price above `L` -> buy, below -> sell, exactly at
  `L` (within 1e-9) -> none; same stop distance `S`; out at the stop or at the close of the last candle opening before 11:00
  New York; same costs and statistics. Shown by window, never judged.
- How often the price touched `L` between 09:00 and 10:00 on primary days, against how often it touched the level 25 pips
  away (the midpoint between two round levels, same distance rule): descriptive.
- The fixed 25-pip control: the whole primary rule on the grid shifted by exactly 25 pips (`L` = the nearest `25 + k x 50`
  pip level). Shown beside the placebo.
- Gross (cost 0) and 2x-cost figures for every stream; per pair and per year.

## Costs (net R)

Exactly the model of `fx-asia-london-reversal` / `fx-london-orb`, the raw-spread demo's measured model (CLAUDE.md "Forex
spreads", 12 Nov 2026), charged per trade in price, then divided by `r0`:
- spread 0.3 pip a round trip;
- commission 22.5 USD per million USD of notional a side: round trip `2 x 22.5e-6 x entry price` in the quote currency per
  unit (true for each of these pairs);
- slippage 0.5 pip on every market fill: the entry and the exit (a stop and a time exit are both market fills), so 1 pip.
Reported at cost 0 (gross), base, and 2x base.

## Statistics and the pass bar

t is always on calendar-month sums: the net R of a stream's trades summed per calendar month of the window, every month
counted (a month with no trade is 0), t = mean / (sd / sqrt(months)). One-sided p from the normal approximation. Holm across
the eight tests (seven pairs and the pool) on the out-of-sample one-sided p.

**Placebo: 40 seeds at non-round levels.** For seed s = 1..40, an offset `o_s = 5 + 40 x u` pips, `u` the first draw of
mulberry32 seeded with s (so every offset lies 5 to 45 pips from the round grid, never on it), the same offset for every
pair. The whole primary rule (gate, direction, entry, stop, exit, costs) is run with the levels `o_s + k x 50` pips instead of
the round levels. Statistic: the pooled out-of-sample mean net R a trade. Percentile by linear interpolation.

**The study PASSES only when the pool (seven pairs together) meets all four:**
1. out-of-sample month-sum t >= 2, net of base costs;
2. in-sample mean net R a trade > 0 (base costs);
3. out-of-sample mean net R a trade > 0 at 2x costs;
4. out-of-sample mean net R a trade above the 95th percentile of the 40 placebo means (beats at least 95 % of them).

Else FAIL. The Holm-adjusted p of the pool and of each pair, per-pair and per-year figures, and gross figures are reported. A
single pair is reported as passing only when it meets the same four on its own trades (its placebo = the same seeds on that
pair alone) AND its Holm-adjusted p < 0.05; it does not change the study's verdict. Another d, stop multiple, grid step or
exit time is not tried on this data without a new pre-registration.

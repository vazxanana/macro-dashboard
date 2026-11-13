# London-open range breakout on forex majors: pre-registration

Written and committed on 13 Nov 2026, before any candle of the test was read for this study and before any trade was
computed. Paper research only: no live rule, size, filter, cost model or mirror setting is changed by this study, whatever it
finds. Forex only (the gold session-range breakouts already tested in this folder are not repeated here).

## Why

The first hour of London is a widely taught session effect: price either runs out of the London opening range ("follow") or
the first push out of it is a false break that comes back ("fade"). Neither has been tested on forex in this repository. Both
are tested here as fixed rules, once, with the pass bar below written before any result exists.

## Data

- OANDA mid M5 candles through the council's keyless proxy (`/md/bars?sym=<key>&tf=5m&from=&to=`, 4,999-candle windows,
  paced), from 2015-11-01 (warm-up for the 20-day median) to the start of the UTC day the run is made. Files kept outside git.
- Markets (OANDA keys of `api/_oanda.js`): `eurusd`, `gbpusd`, `usdjpy`, `audusd`, `usdchf`, `eurjpy`. Pip 0.0001, JPY
  pairs 0.01.
- **Decisive window: trades entered 2020-01-01 to the end of the file. Replication window: 2016-01-01 to 2019-12-31.**
  Nothing is tuned on either: every number below is fixed now.

## Clock

All session times are **London time** (Europe/London): UTC+1 from 01:00 UTC on the last Sunday of March to 01:00 UTC on the
last Sunday of October (British Summer Time), UTC+0 otherwise. So 07:00 London is 06:00 UTC in summer and 07:00 UTC in
winter. A candle belongs to a time by its open time. A trading day is a London calendar day Monday to Friday; there is no
holiday list (a day whose opening range has too few candles is skipped, below).

## The opening range

- Range = highest high and lowest low of the M5 candles opening 07:00 to 07:55 London (12 candles). A day with fewer than
  11 of those 12 candles is skipped. `range = high - low`; `mid = (high + low) / 2`.
- **Size filter (all variants)**: the median of the ranges of the 20 previous days that had a range (this pair, today
  excluded). The day is skipped when `range < 0.25 x median` or `range > 2 x median`. Days before 20 earlier ranges exist
  are skipped. Skipped days still enter later medians.
- One trade a day per pair per variant at most.

## Variant F1: follow, exit 16:00

- From the candle opening 08:00 London to the candle opening 11:55 London: a buy stop at the range high and a sell stop at
  the range low (one cancels the other). A candle whose high reaches the range high fills the buy; whose low reaches the
  range low fills the sell. Fill price = the level, or the candle's open when the candle opens beyond the level (gap).
- Both levels touched in the same candle: the side whose level is nearer that candle's open is filled first, and since the
  other level is its stop, the trade is stopped in the same candle (a 1R loss plus costs).
- Stop = the other side of the range. `r0 = |fill - stop|` (1R). A candle that opens beyond the stop exits at its open; a
  candle that touches the stop exits at the stop.
- Exit at the close of the last candle opening before 16:00 London (normally 15:55) if still open.
- No re-entry after an exit.

## Variant F2: follow, target 1.5R, else 16:00

- F1 with a target at `fill +/- 1.5 x r0`. Target and stop in one candle: the stop counts. In the fill candle only the stop
  is checked. A candle opening beyond the target exits at its open.

## Variant FADE: fade the first close beyond the range

- The first candle opening 08:00 to 11:55 London that CLOSES above the range high (or below the range low) is the break
  candle. Only the first such close of the day counts.
- Enter against it at market at the next M5 candle's open: sell after a close above, buy after a close below.
- Stop = the break candle's high + 0.1 x range (sell), its low - 0.1 x range (buy). Target = the range middle.
- No trade when that open is already at or beyond the stop, or already at or past the target. `r0 = |entry - stop|`.
- Target and stop in one candle: the stop counts; the entry candle is checked for both (stop first). Gap rules as F1.
  Exit at the close of the last candle opening before 16:00 London.

## Costs (net R)

The raw-spread demo's measured model (CLAUDE.md "Forex spreads", 12 Nov 2026), charged per trade in price, then divided by
`r0`:
- spread 0.3 pip a round trip;
- commission 22.5 USD per million USD of notional a side; for every one of these pairs the USD notional converted to the
  quote currency equals the pair's price, so the round trip is `2 x 22.5e-6 x entry price`;
- slippage of half the default 1-pip spread (0.5 pip) on every market or stop fill: the stop-order entry (F1, F2), the market
  entry (FADE), a stop exit and a time exit. None on a target (limit) exit.
Gross R is reported beside net R; a sensitivity at twice the costs is reported, not judged.

## Statistics and the pass bar

For each variant, the six pairs pooled:
1. mean net R a trade in the decisive window > 0;
2. t >= 2 on calendar-month sums in the decisive window (net R of the variant's trades summed per calendar month, every month
   of the window counted, a month with no trade is 0; t = mean / (sd / sqrt(months)));
3. mean net R a trade in 2016-2019 > 0 (same sign);
4. Holm over the three variants (F1, F2, FADE) on the one-sided p of the decisive month-sum t (normal approximation), adjusted
   p < 0.05;
5. the decisive mean net R a trade beats the 95th percentile of a 40-seed placebo: for every real trade of the variant in the
   decisive window, a placebo trade on the same pair and day and the same side, entered at market at the open of a candle
   drawn uniformly from the 48 candles opening 08:00 to 11:55 London, with the real trade's stop distance and target distance
   (none for F1), exit 16:00 London, the same costs and fill rules (seeded random draws, seeds 1-40); the statistic is the
   pooled mean net R a trade; percentile by linear interpolation.

A variant **PASSES** only when all five hold. The study's verdict is PASS if at least one variant passes, else FAIL. Per pair,
per year, gross and twice-cost figures are reported and never judged. A pass would only be a proposal to the owner
(`research/proposals/`), never a live change.

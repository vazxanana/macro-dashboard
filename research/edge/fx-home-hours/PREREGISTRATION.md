# A currency weakens in its own home hours: pre-registration

Written and pushed on 14 Nov 2026, before any trade of this study was computed. Paper research only: no live rule, size,
filter, stop, cost model, config or mirror setting is changed by this study, whatever it finds. Forex only; ICT and the gold
book are not involved.

## The idea (published, not found here)

Breedon and Ranaldo (2013, "Intraday patterns in FX returns and order flow", Journal of Money, Credit and Banking) report that
a currency tends to depreciate during its own domestic business hours and appreciate during foreign hours: local firms and
investors buy foreign currency in their own working day. This study asks once whether that holds on OANDA prices, as plain
clock trades that always carry a stop, after the raw-spread forex costs of `council/fills.mjs`, out of sample.

## What was tested before, said plainly

Other studies of 13-14 Nov on branches (not on main) trade forex by the clock: `fx-london-orb` (London opening range
breakout), `london-fix` (the 16:00 London fix), `gotobi` / `gotobi-replicate` (USD/JPY around the Tokyo fix on 5th / 10th
days), `fx-month-end`, `gold-session-drift` (gold, not forex). None holds a whole home session in one direction on every
weekday. The USD/JPY window below contains the Tokyo fix (00:55 UTC); the gotobi studies traded only its 5th / 10th days.
I have read their pre-registrations' opening sections and no result of any of them. I have computed nothing of this rule on
any candle before writing this file.

## Data

- OANDA mid M5 candles through the site's keyless proxy (`/md/bars?sym=<key>&tf=5m&from=&to=`, pages of 4,999 candles,
  paced; `fetch.mjs`), `eurusd`, `usdjpy`, `gbpusd`, `audusd`, from 1 Nov 2009 (two months of warm-up) to 1 Nov 2026 00:00
  UTC. Files kept out of git. Copies already fetched through the same proxy by the other studies of the week may seed the
  file (`fetch.mjs` reuses a seed file's candles and fetches only what is missing; the candles are the proxy's either way).
- H1 candles are built from the M5 file in UTC hour buckets (`floor(time / 3600)`), open of the first M5, high / low over the
  bucket, close of the last M5.
- **Decisive window: trades entered 1 Jan 2016 to 31 Oct 2026. Replication window: 1 Jan 2010 to 31 Dec 2015.** A trade
  belongs to the window of its entry time. Nothing is tuned on either.

## The rule (fixed: one leg per pair)

All times UTC, fixed all year (no daylight-saving shift; the paper's sessions are written in GMT).

| Test | Pair | Side | Window (UTC) | Session date |
|---|---|---|---|---|
| T1 | EUR/USD | sell (EUR weakens) | 07:00 → 12:00 | the UTC date |
| T2 | USD/JPY | buy (JPY weakens) | 00:00 → 06:00 | the UTC date |
| T3 | GBP/USD | sell (GBP weakens) | 07:00 → 12:00 | the UTC date |
| T4 | AUD/USD | sell (AUD weakens) | 22:00 → 05:00 next day | the UTC date of 05:00 (the Sydney day) |

The other leg the paper implies (long EUR/USD in New York hours, etc.) is not traded.

1. **Days.** Every session date Monday to Friday, except the dates of `council/datacheck.mjs` `usHolidays(year)` (every date
   it lists, `closed` or `early`: New Year, MLK, Presidents', Good Friday, Memorial, Juneteenth, Independence Day, Labor Day,
   Thanksgiving and the day after, Christmas Eve, Christmas). UK and Japanese bank holidays are **not** skipped: no function in
   the repository gives them, and a hand-written list would be a new source; said here, not corrected. The AUD session dated
   Monday starts Sunday 22:00 UTC.
2. **Entry**: a market order at the **open of the M5 candle that opens at the window's start**. If that candle is missing,
   no trade (counted as "no data").
3. **Stop** (every trade has one, on the losing side): `r0` = the 14-period H1 ATR = the plain mean of the true range of the
   last 14 H1 candles whose hour ended at or before the entry (true range with the previous H1 candle's close; past data
   only). Sell: stop = entry + r0. Buy: stop = entry − r0. No trade when fewer than 15 H1 candles exist before the entry or
   r0 is not positive.
4. **Management on M5 candles from the entry candle on** (the entry candle's own high / low count). A candle that opens at
   or beyond the stop exits at its open (gap); a candle that touches the stop exits at the stop. The stop never moves; no
   target.
5. **Time exit**: at the close of the last M5 candle that opens before the window's end. That candle must open at or after
   the window's end minus 30 minutes, else no trade ("no data"; a hole or an early close).
6. **R**: `R = (exit − entry) / r0` for a buy, `(entry − exit) / r0` for a sell.

## Costs (the raw-spread forex model, `council/fills.mjs` / CLAUDE.md "Forex spreads")

- Spread 0.3 pip a round trip (pip 0.0001; 0.01 for USD/JPY), plus half a spread of slippage on each market order (the
  entry, and the exit: every exit here is at market) = 0.3 pip; plus commission 22.5 USD per million USD of notional a side,
  45 USD a million a round trip, = `45e-6 × entry` in price units for all four pairs (an XXX/USD unit is worth `entry` USD;
  a USD/JPY unit is 1 USD, whose commission in yen is `45e-6 × entry`).
- **Financing**: charged when the position is held over the 17:00 New York rollover (21:00 UTC in US summer time, 22:00
  in winter; `council/histdata.mjs` `nyOffsetH`): when `entry time ≤ rollover < exit time`. Three nights when that rollover
  is a Wednesday's. Rate a night = (rate of the currency held long − rate of the currency held short − 1 % markup) / 365, in
  percent a year, times the entry price; a **credit is never booked** (a positive figure counts as 0). Rates: the central
  bank policy rates in force on the entry day, copied from `research/edge/fx-carry/rates.json` (branch `fx-carry`, written by
  hand from known decisions and labelled approximate there) into this folder's `rates.json` (USD, EUR, GBP, JPY, AUD).
  The real rule's windows: EUR, JPY and GBP never hold a rollover; AUD holds the winter 22:00 UTC rollover (entry at that
  instant counts as held, by the rule above) and none in summer (the 21:00 UTC rollover comes before the entry). The
  placebo windows follow the same rule.
- `net R = R − (spread + slippage + commission + financing) / r0`. Also reported at **twice** every cost.

## Statistics

- Per test and window: n, mean R gross and net, win rate, total net R, worst drawdown, exits (time / stop / gap).
- **t on calendar-month sums** of net R (each month with at least one trade is one observation; mean / sd × √months), so
  overlapping or clustered days do not inflate it. One-sided p from the normal approximation.
- **Holm** over the four one-sided p-values T1-T4 of the decisive window.
- **Pooled test T5** (equal weight): each month, the mean over the pairs that traded that month of each pair's month sum of
  net R; t on those monthly values. Not in Holm; its own bar below.
- **Placebo, 40 seeds** (seeded generator): for each pair and each session date the rule trades (same day set), a window of
  the same length and the same direction whose start is a whole UTC hour drawn uniformly from the 23 hours other than the
  rule's own start hour, anchored at 00:00 UTC of the session date; entry, stop, exit, data and cost rules as above. Per seed
  the mean net R of the decisive window; reported: the rule's percentile among the 40 and the placebo 5th / 50th / 95th.

## Pass bar (per test T1-T4)

1. n ≥ 300 in the decisive window and ≥ 150 in the replication window;
2. decisive mean net R > 0 with **month-sum t ≥ 2.0**;
3. Holm-adjusted p < 0.05;
4. replication mean net R > 0;
5. decisive mean net R > 0 at twice the costs;
6. the decisive mean net R is above the placebo's 95th percentile (above at least 38 of the 40 seeds).

T5 passes on 2, 4, 5 (pooled) and 6 (pooled placebo: the equal-weight mean over pairs of each seed's mean net R).

## Verdict (fixed here)

- **PASS**: at least one of T1-T4 meets all six conditions (each passing pair is named; the others are not rescued).
- **FAIL**: no test meets conditions 2 and 4 together.
- **INCONCLUSIVE**: anything else (a test meets 2 and 4 but not the rest, or only T5 passes).

## Reported, not tested (never a verdict)

By year; gross before costs; the AUD test split by US summer / winter (rollover inside or not); the costs' share of the
move; the mean move in pips; the median r0 in pips.

## What I had to decide (the brief leaves it open)

- One fixed UTC clock all year, as the paper's GMT sessions; no daylight-saving shift of the windows.
- Holidays: the US list only (above).
- The ATR as a plain 14-candle mean, on H1 candles built from M5.
- The 30-minute rule for the exit candle and the "no data" days.
- Financing only across 17:00 New York, credits never booked, three nights on Wednesday.
- The placebo's start hours anchored to the session date's 00:00 UTC, one draw per day.

## What happens next

Nothing changes live on any outcome. A PASS is a hypothesis for a forward paper shadow that the owner decides on, never a
live rule. A bug found after the run is fixed, said in RESULT.md, and everything is re-run.

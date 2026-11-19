# The London 16:00 WM/Reuters fix: does the hour into it reverse after it? (pre-registration)

Written and pushed on 14 Nov 2026, before any trade of this rule was computed. Paper research only: no live rule, size,
filter, stop, cost model, config or mirror setting is changed by this study, whatever it finds. Forex only; ICT and the gold
book are not involved. Nothing below may change after the first result; anything found later is reported as found later and
never folded into the verdict.

## The idea (published, not found here)

The WM/Reuters benchmark rates are set over a short window around 16:00 London time. Melvin and Prins (2015, "Equity hedging
and exchange rates at the London 4 p.m. fix", Journal of Financial Markets) and Evans, O'Neill, Rime and Saakvitne (2018,
"Fixing the fix? Assessing the effectiveness of the 4pm fix benchmark") report that major USD pairs tend to move in one
direction into the fix (dealers working fixing orders) and partly reverse after it. This study asks once whether fading the
hour into the fix, after it, makes money on OANDA prices, as a plain clock trade that always carries a stop, after the
raw-spread forex costs (CLAUDE.md "Forex spreads: a raw-spread account, measured"), out of sample.

## What was tested before, said plainly

Branch `london-fix` (not on main) holds an earlier study of the same fix with other, fixed parameters: a 15:30-15:55 run,
an event at 1.5x its 20-day median, entry at 16:05, stop 1x the day's run. I have read only the opening sections of its
pre-registration (to describe it here), none of its result, and computed nothing of this rule on any candle before writing
this file. The two studies read the same candles, so they are not independent evidence of each other; this one's window,
threshold, entry and stop are the ones given in its brief, not chosen after the other's result. Other forex clock studies of
13-14 Nov on branches (`fx-home-hours`, `gotobi*`, `fx-month-end`, `fx-london-orb`) trade other hours or days.

## Data

- OANDA mid M5 candles through the site's keyless proxy (`/md/bars?sym=<key>&tf=5m&from=&to=`, pages of 4,999 candles,
  paced; `fetch.mjs`, the `fx-home-hours` / `gotobi-replicate` pattern copied into this folder), keys `eurusd`, `gbpusd`,
  `usdjpy`, `audusd`, `usdchf`, `usdcad`, from 1 Nov 2009 (two months of warm-up) to 1 Nov 2026 00:00 UTC. Files kept out of
  git. Copies already fetched through the same proxy by another study of the week may seed a file (`fetch.mjs` keeps a seed
  file's candles and fetches only what is missing; the candles are the proxy's either way). Candles are stamped at their
  opening second in UTC. No HistData file is read (so `council/histdata.mjs` converts no label here); its `euSummer` gives
  the London clock below.
- **Decisive window: trades entered 1 Jan 2016 to 31 Oct 2026. Replication window: 1 Jan 2010 to 31 Dec 2015** (as far as
  the data reaches). A trade belongs to the window of its entry time. Nothing is tuned on either.
- Bar size: **M5** for every price, entry, stop check and exit.

## Clock

All rule times are **London time** (Europe/London): UTC in winter, UTC+1 (BST) from 01:00 UTC on the last Sunday of March
to 01:00 UTC on the last Sunday of October (`council/histdata.mjs` `euSummer`, which is exactly those instants). So 16:00
London is 16:00 UTC in winter and 15:00 UTC in summer. A **day** is a London weekday (Monday to Friday by the London date). No
holiday calendar: a day whose candles are missing has no move and no trade.

## The rule (fixed)

For each pair and day:

1. **The move into the fix**: `M = close of the M5 candle opening at 15:55 London − open of the M5 candle opening at 15:00
   London` (the 15:00-15:59 hour). Both candles must exist, else the day has no M.
2. **The reference**: `ref` = the median of `|M|` over the 20 most recent EARLIER London weekdays of that pair that have an M
   (strictly before the day: no look-ahead). Those 20 days must all lie within the 42 calendar days before the day, else no
   trade. With an even count the median is the mean of the 10th and 11th sorted values.
3. **Event**: `|M| > 0.5 × ref` and `ref > 0`.
4. **Entry**: at 16:00 London, a market order AGAINST M (M > 0: sell; M < 0: buy) at the **open of the M5 candle opening at
   16:00 London**. No candle there: no trade ("no data").
5. **Stop** (every trade has one, on the losing side): `1 × ref` beyond the entry (sell: entry + ref; buy: entry − ref). `R`
   is measured in units of `ref`.
6. **Management on M5 candles from the entry candle on** (its own high / low count). A candle that opens at or beyond the stop
   exits at its open (gap); a candle that touches the stop exits at the stop. The stop never moves; no target, no break-even.
7. **Time exit**: at the close of the last M5 candle that opens before the exit time. That candle must open at or after the
   exit time minus 15 minutes, else no trade ("no data").
8. `R = (exit − entry) / ref` for a buy, `(entry − exit) / ref` for a sell.

## The tests

| Test | Stream | Exit |
|---|---|---|
| T1 | the six pairs pooled (EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CHF, USD/CAD) | 17:00 London (close of the 16:55 candle) |
| T2 | EUR/USD alone | 17:00 London |
| T3 | the six pairs pooled | 16:30 London (close of the 16:25 candle; M5 bars, so exact) |

The pooled stream is every trade of the six pairs together (one trade a pair a day at most), each at 1R.

## Costs (the raw-spread forex model)

- Spread **0.3 pip** a round trip (pip 0.0001; 0.01 for USD/JPY), plus half a spread of slippage on each market order (the
  entry, and the exit: every exit, stop or time, is at market) = 0.3 pip; plus commission **22.5 USD per million USD of
  notional a side**, 45 USD a million a round trip = `45e-6 × entry` in price units for all six pairs (an XXX/USD unit is
  worth `entry` USD; a USD/XXX unit is 1 USD, whose commission in the quote currency is `45e-6 × entry`).
- **Financing**: none. Every position is opened and closed between 16:00 and 17:00 London, never over the 17:00 New York
  rollover (21:00 or 22:00 London).
- `net R = R − (0.6 pip + 45e-6 × entry) / ref`, in R. Also reported at **twice** every cost (`net2`).

## Statistics

- Per test and window: n, gross R a trade, cost in R a trade, net R a trade, total net R, win rate, exits by kind, and
  **t = the t-statistic of calendar-month sums of net R** (months with at least one trade; mean / sd × √months).
- **Holm** over T1-T3 on the decisive window: one-sided p of each t (normal approximation), Holm-adjusted.
- **Placebo, 40 seeds**: the same rule at random other hours. For each seed, each pair and each London weekday, one hour `h`
  is drawn uniformly from the London hours 0-19 other than 14, 15 and 16 (17 hours; never touching 15:00-17:00, never holding
  the 17:00 New York rollover). The rule is applied unchanged with the move from h:00 to h:55's close, the reference from the
  same hour's moves on the 20 earlier days that have one, entry at h+1:00, exit at h+2:00 (T1, T2) or h+1:30 (T3). Seed s uses
  a fixed generator (mulberry32, seed `s × 1000 + pair index`). Reported: each test's decisive net R a trade against the 40
  seeds (how many seeds it beats, their 5th / 50th / 95th percentile).
- **2x cost**: decisive net R a trade with every cost doubled.
- Also reported, not judged: each pair alone under T1, every year, summer against winter.

## The pass bar (fixed)

A test **passes** when all three hold:

1. net R a trade > 0 in the decisive window AND in the replication window;
2. decisive month-sum t ≥ 2 after Holm: Holm-adjusted one-sided p ≤ 0.0228 (the p of t = 2);
3. decisive n ≥ 100.

A passing test is called **robust** only if also its decisive net R a trade at 2x cost is > 0 and it beats at least 38 of
the 40 placebo seeds; otherwise it is reported as "PASS, not robust".

**Verdict**: PASS if at least one test passes (named, with robust or not); FAIL if none does. A test with net R > 0 and
t ≥ 2 (before Holm) in the decisive window that fails another condition is named in the report as such, never as a pass.

## What a result would and would not mean

A PASS is a forward-test candidate for the owner, never a live rule: absolute rule 3 holds (the owner approves every live
rule change) and nothing here changes the council, the mirror or any cost. A FAIL says this mechanical fade does not pay
after the raw-spread costs on OANDA mid prices; it says nothing about the benchmark's mechanics or about trading inside the
five-minute fix window itself, which M5 candles cannot resolve.

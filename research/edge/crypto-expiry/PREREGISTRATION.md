# Pre-registration: BTC and ETH around the monthly crypto expiry (14 Nov 2026)

Written and committed on its own, before any expiry window, trade or result of these candles was computed. From the candle
files I know only what the sibling study `crypto-weekend-reversal` (branch of the same name, 14 Nov 2026) states about them:
the number of candles and the first and last times. Paper research only: no live rule, size, filter, stop, config, council
member, page or mirror setting changes, whatever the result.

## Not run before

`git log --all` and a search of `research/edge/` and every crypto branch for "expiry" / "expir" found no study of crypto
option or futures expiry (the hits are forex / gold futures rolls, `futures-roll`, and order expiry in the Trader). This is
the first.

## Why

The largest crypto options venue settles its monthly BTC and ETH options and futures on the **last Friday of each month at
08:00 UTC**; CME's monthly BTC and ETH futures settle the same Friday at 16:00 London. A common story: dealers hedging large
open interest hold price near the strike of most open interest ("max pain") into the settlement, and once the options are
gone the price is "released" and moves more freely. No open-interest or strike data exist in the repository or council-data
(and no exchange API is reachable from the build sandbox), so max pain itself cannot be computed; the test is a pure calendar
test of the release.

## The one primary hypothesis (fixed now)

**Post-expiry release in the direction of the prior trend**: from **Friday 08:00 UTC to the following Monday 08:00 UTC**
after the monthly expiry, price moves in the direction of the **7 days before expiry**. The pinning is assumed to have held
the trend back; the release lets it continue.

- 7-day move `M = P(Fri 08:00) - P(Fri 08:00 seven days earlier)` (UTC). Side = `sign(M)` (long after a rise, short after a
  fall); `M = 0` gives no trade.
- Entry at market at **Friday 08:00 UTC** on the expiry Friday, exit at **Monday 08:00 UTC** (time exit), unless stopped.
- **Stop** (absolute rule 1, every trade has one, on the losing side, never moved): `entry - side x 1.5 x ATR(20)`. No
  target. **1R = 1.5 x ATR(20).**

The other window is **reported only, never a verdict**:

- **(a) Into expiry**, Thursday 08:00 UTC to Friday 08:00 UTC, traded **against** the 7 days before it
  (`P(Thu 08:00) - P(Thu 08:00 seven days earlier)`; the pin is assumed to pull price back), stop 1.5 x ATR(20), time exit at
  Friday 08:00. Plus a descriptive line: the median absolute Thursday 08:00 to Friday 08:00 return in ATR on expiry Fridays
  against all other Fridays (a pin would make it smaller).

## Expiry dates (by rule, no fetch)

The expiry Friday of month `m` = the last Friday of the calendar month (UTC). A holiday does not move it (the options venue
settles on that day; e.g. 29 Mar 2024 was Good Friday, CME was shut, it stays an expiry date). A placebo Friday is any other
Friday.

## Data (what is on file)

- council-data `research/candles/crypto5m/BTCUSDT_5m.json.gz` and `ETHUSDT_5m.json.gz`: Binance spot 5-minute candles
  `[time, open, high, low, close]` UTC, **2022-01-01 00:00 to 2026-10-31 23:55**, read with `git show origin/council-data:…`
  into a folder outside git. No hourly or finer crypto candle before 2022 is in the repository or council-data, and the
  exchange APIs are refused by the sandbox network (Binance checked again on 14 Nov 2026), so the study runs on 2022-2026
  only. Spot prices stand in for the broker's CFD prices.
- A price "at" time `T` = the open of the 5-minute candle that opens at `T`; a missing candle = no trade that month.
- **ATR(20)**: daily candles built from the 5-minute file in UTC days, a day counts with at least 270 of 288 candles; the
  simple mean of the true ranges of the 20 complete UTC days ending before 00:00 of the entry day (21 days needed, all
  complete; nothing on or after the entry day is read). Missing = no trade.
- Management on the 5-minute candles from the entry candle: a candle opening at or beyond the stop exits at its open; one
  touching it exits at the stop; otherwise out at `P(exit time)` (or the open of the first candle after it). At least 95 % of
  the 5-minute candles from entry to exit must be on file.

## Windows (fixed now)

Months 2022-01 to 2026-10 = 58 months. **In sample (IS) = expiries in 2022-01 to 2024-05** (the first 29 months), **out of
sample (OOS) = 2024-06 to 2026-10** (the last 29). The October 2026 expiry (30 Oct) cannot be closed (the file ends on
31 Oct), so OOS has at most 28 events a coin. Nothing is fitted on either half: the rule above is the whole rule.

**Small n, said plainly**: about 12 events a year a coin, so at most about 28 OOS trades a coin and 56 pooled. A month-sum
t of 2 on 28 months needs a large effect; a failure is weak evidence of no effect, not proof of none.

## Costs (in R)

- **Round trip**: `CFD_CRYPTO` of `council/fills.mjs` = 0.04 % of the entry price: `0.0004 x entry / (1.5 x ATR)`.
- **Financing**, as the crypto studies charge it (sibling `crypto-weekend-reversal`): the demo broker's crypto CFD swap
  (council-data `ctrader/symbols.json`, percent a year) longs 15 %, shorts 7.5 % (BTC) / 10 % (ETH), both a cost; one night =
  each 17:00 New York instant in `(entry, exit]`, a Friday counting three (the broker's `rollover3Days`). A Friday 08:00 to
  Monday 08:00 hold therefore pays 5 nights. Charge = `rate / 365 x entry x nights / (1.5 x ATR)`. Today's rates every year.
- `net R = side x (exit - entry) / (1.5 x ATR) - cost - financing`. Reported at 0 x, 1 x (base) and 2 x cost and financing.

## Statistics

- **Event t**: plain t of net R a trade. **Month-sum t**: net R summed by the calendar month (UTC) of the exit, every month of
  the window counted (no trade = 0), `t = mean / (sd / sqrt(months))`. The pass bar uses the month-sum t.
- Three tests on OOS: **BTC**, **ETH**, **POOL** (both coins, month sums added). One-sided p from the month-sum t (normal
  approximation), **Holm over the three**, reported.
- Also: n, win rate, gross / net R a trade, total, worst drawdown, stops, by side, by year, IS and OOS for each.

## Placebo (40 seeds)

For each seed 1-40 (`mulberry32`) and each coin: the same rule (7-day direction, Friday 08:00 to Monday 08:00, stop
1.5 x ATR, costs and financing) on as many **random non-expiry Fridays** of the OOS window as the coin has real OOS trades,
drawn without replacement from the non-expiry Fridays on which a trade can be simulated. POOL's placebo = both coins' draws of
that seed together. Reported: placebo p5 / p50 / p95 of POOL OOS net R a trade and how many of the 40 the real figure beats.

## Pass bar (fixed here, all four)

1. POOL OOS net R a trade > 0 with **month-sum t >= 2.0** at base cost;
2. POOL IS net R a trade **> 0** at base cost;
3. POOL OOS net R a trade **> 0 at 2 x cost and financing**;
4. POOL OOS net R a trade **beats at least 38 of the 40 placebo runs** (>= 95 %).

**Verdict: PASS** when all four hold, else **FAIL**. A pass would make this a hypothesis for a forward paper stream at most
(absolute rule 3: the owner decides); it is not an edge until a forward record exists. BTC and ETH alone are reported with
their Holm p, not judged.

## Decisions the brief left open (mine)

- Primary = (b) after expiry, direction = WITH the 7 days before; (a) reported only, against its 7 days.
- No target on either window (the brief gave a stop only); a time exit.
- 5-minute candles for the management (finer than H1), the only intraday data on file.
- IS / OOS split by months (29 / 29), the pass bar on POOL only.
- Financing on the 17:00 New York clock with Friday x 3, as the sibling crypto study charges it.

## What happens next

Nothing changes live on any outcome. A bug found after the run is fixed, said in RESULT.md, and everything is re-run.

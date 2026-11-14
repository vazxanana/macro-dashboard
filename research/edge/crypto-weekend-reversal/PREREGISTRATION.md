# Pre-registration: do big crypto weekend moves partly reverse once the week starts? (14 Nov 2026)

Written and committed on its own, before any weekend move, trade or result of these candles was computed. From the candle
files I read only the number of candles and the first and last times. Paper research only: no live rule, size, filter, stop,
config, council member, page or mirror setting changes, whatever the result.

## Why

Crypto trades every day, but the large desks, the CME bitcoin and ether futures and the US equity session are shut from Friday
evening to Sunday evening. The hypothesis: a large move made over the weekend on thin books is partly given back once the
week's liquidity returns (the US cash open on Monday). It is a mean-reversion bet on the size of the weekend move, nothing
else.

What I already know, said plainly:
- A sibling study on another branch (`crypto-weekend`, 13 Nov 2026: long the weekend, short Monday, every week) failed on
  the same candles. It is a different rule (no conditioning on the move's size, other hours); this study does not reuse its
  code or its result and does not read its trades.
- The council's crypto trend rule and the engine setups' crypto streams have no proven edge; the costs study puts a crypto CFD
  round trip at 0.04 % of price, and the broker's financing on crypto is large (15 % a year on longs).

## Data (what is on file; every exchange API is refused from the build sandbox)

- **Intraday**: council-data `research/candles/crypto5m/BTCUSDT_5m.json.gz` and `ETHUSDT_5m.json.gz` (Binance spot 5-minute
  candles `[time, open, high, low, close]`, UTC), **2022-01-01 00:00 to 2026-10-31 23:55 UTC**, 508,304 candles each, read
  with `git show origin/council-data:…` into a folder outside git. No hourly or finer crypto candle before 2022 exists in the
  repository or in council-data, and Binance, Kraken, Bitstamp, Coinbase, Bybit, OKX, Bitfinex, Gemini and CryptoCompare were
  all refused by the sandbox's network on 14 Nov 2026. So **the brief's decisive window from January 2021 and its 2017-2020
  replication cannot be run on intraday candles**: the decisive window starts in 2022 (below).
- **Daily**: council-data `research/candles/crypto1d/BTCUSDT_1d.json.gz` and `ETHUSDT_1d.json.gz` (Binance spot, UTC days
  from 2017-08-17). A daily candle cannot place a Friday 21:00, a Sunday 22:00 or a Monday 13:30 price, nor a stop inside the
  hold. They are used only for a **descriptive** 2017-2021 check (below), never for the verdict.
- I use the price candles as the CFD's price (the broker's crypto CFD quotes follow the spot markets; the spread is in the
  cost below).

## Windows (fixed now)

- **Decisive: weekends whose Friday falls in 2022-01-01 to 2026-10-31** (the whole intraday file; the first weekends are lost
  to the ATR's warm-up). A trade belongs to the window of its entry.
- **Halves, inside the decisive window (the in-sample / out-of-sample check)**: H1 = entries in 2022-2023, H2 = entries from
  2024-01-01. Nothing is fitted on either: every number below is fixed here, so both halves are out of sample for the rule;
  the halves test that the sign is not one regime.
- **Descriptive only: 2017-08-17 to 2021-12-31 on daily candles.**

## Candles and prices

- A price "at" a time `T` is the **open of the 5-minute candle that opens at `T`**. If that candle is not on file, the weekend
  has no trade (counted as a data hole).
- **Daily candles for the ATR** are built from the 5-minute file in UTC days (00:00-24:00); a day counts only when at least
  270 of its 288 candles are on file.
- **ATR(20)** for the weekend of Friday `F`: the simple mean of the true ranges of the **20 complete UTC days ending at or
  before Friday 00:00** (the last one is Thursday; true range uses the previous day's close, so 21 days are needed, all of
  them complete). Nothing at or after Friday 00:00 is read, so nothing after Friday 21:00 is either. Missing a day = no trade
  that weekend.

## The rule (fixed; no parameter is chosen from data)

1. **Weekend move** `M = P(Sunday 22:00) - P(Friday 21:00)` (UTC).
2. **Signal** when `|M| > 1.0 x ATR(20)`. Side = **against** the move: a weekend rise gives a short, a fall a long.
3. **Entry**, two pre-registered tests:
   - **T1**: at market at **Monday 13:30 UTC** (`P(Monday 13:30)`), the US cash open in summer; fixed in UTC all year, as the
     brief says (in winter it is an hour before the cash open).
   - **T2**: at market at **Sunday 22:00 UTC** (`P(Sunday 22:00)`), the moment the signal is known.
4. **Stop** (every trade has one, on the losing side): `entry - side x 1.0 x ATR` (long: below, short: above).
   **Target**: `entry + side x 1.0 x ATR`. 1R = ATR.
5. **Management** on the 5-minute candles from the entry candle on, in time order: a candle that opens at or beyond the stop
   exits at its open; one that touches the stop exits at the stop, **before** the target in the same candle; a candle that
   opens at or beyond the target exits at its open; one that touches it exits at the target. **Time exit at Wednesday 21:00
   UTC** at `P(Wednesday 21:00)`, or, if that candle is missing, at the open of the first candle after it. The stop never
   moves. A trade is taken only when at least 95 % of the 5-minute candles from entry to the time exit are on file.
6. **One trade per market, test and weekend**; T1 and T2 are separate streams (they share weekends, never a book).

## Costs and financing (in R)

- **Round trip**: `CFD_CRYPTO` of `council/fills.mjs` = 0.04 % of the entry price (spread and slippage), `0.0004 x entry / ATR`.
- **Financing**: the demo broker's crypto CFD swap (council-data `ctrader/symbols.json` of 14 Nov 2026, type 1 = percent a
  year): **longs 15 %, shorts 7.5 % (BTC) / 10 % (ETH)**, charged on both sides (a cost, never a credit). One night = one
  **17:00 New York** instant inside `(entry, exit]` (the broker's crypto day ends then, every day of the week); a Friday
  counts three (`rollover3Days` 5). Charge = `rate / 365 x entry x nights / ATR`. Today's rates for every year.
- **net R = side x (exit - entry) / ATR - cost - financing.** Also reported at twice the cost and financing.

## Statistics

- **Month-sum t**: the sum of net R of trades by the calendar month (UTC) of their exit, every month of the window counted
  (a month with no trade is 0), `t = mean / (sd / sqrt(months))`. This is the t of every pass condition.
- Also reported: n, win rate, mean R gross and net, the plain per-trade t, total, profit factor, worst drawdown in R, exits
  (stop / target / time), by side, by year, by half.

## Tests (fixed: five) and Holm

1. **T1-BTC**, 2. **T1-ETH**, 3. **T2-BTC**, 4. **T2-ETH**, 5. **POOL** = T1 on BTC and ETH together (month sums added).

One-sided p from the month-sum t (normal approximation); **Holm over the five**.

A test **passes** when all hold:
1. n >= 30 trades (POOL: >= 60) in the decisive window;
2. net R a trade > 0 and **month-sum t >= 2.0**;
3. Holm-adjusted p < 0.05;
4. net R a trade > 0 in **both halves** (2022-23 and 2024-26);
5. net R a trade > 0 at twice the cost and financing;
6. its net R a trade is above the **95th percentile of its placebo** (below).

## Placebo (40 seeds)

For each seed 1-40 (a seeded generator, `mulberry32`), each market and each test: the same number of trades and the same side
mix (the real sides shuffled) are placed on weekends drawn at random **without replacement** from every weekend of the
decisive window on which a trade could be simulated (prices, ATR and 95 % coverage present), whatever the size of its move.
T1's placebo enters on those random **Mondays at 13:30**, T2's on those random **Sundays at 22:00**; stop, target, time exit,
costs and financing as the real rule. POOL's placebo is T1's two markets' placebo trades together. Reported: the 5th, 50th and
95th percentiles of the placebo's net R a trade and the real figure's rank among the 40.

## Verdict (fixed here)

- **PASS**: at least one test passes all six conditions.
- **FAIL**: no test has net R > 0 with month-sum t >= 2.0 (condition 2).
- **INCONCLUSIVE**: anything else.

A pass would make this a hypothesis for a forward paper stream at most (absolute rule 3: the owner decides). It would not be
an edge until a forward record exists.

## Descriptive check on daily candles, 2017-08-17 to 2021-12-31 (never a verdict)

What daily candles allow: weekend move = Sunday's close (Monday 00:00 UTC) minus Friday's close (Saturday 00:00); ATR(20) of
the 20 days through Thursday; when `|move| > 1 ATR`, a position against it from Sunday's close to Wednesday's close (Thursday
00:00), no stop or target (the candles cannot place them), net of the round trip and financing in ATR units. Reported per
market and year with n and the per-trade t, labelled "descriptive, no stop, daily candles".

## Decisions the brief left open (mine)

- The windows (intraday data only from 2022; daily-only before), the halves as the in-sample / out-of-sample check.
- Prices are 5-minute candle opens at the named instants; the management runs on 5-minute candles (finer than H1, the brief's
  suggestion, so a stop and target are placed in their real order more often).
- The ATR is a simple mean of 20 complete UTC days through Thursday (the brief: "20-day ATR of daily candles, data up to
  Friday 21:00 only"); Friday's partial day is not used.
- Financing nights on the broker's 17:00 New York clock with Friday counting three (from the broker's own symbol file), not
  every 22:00 UTC.
- Minimum n 30 per market, 60 pooled; the placebo also for T2 (on Sundays 22:00), and T1's placebo on Mondays 13:30.
- Folder and branch: `research/edge/crypto-weekend-reversal/`, branch `crypto-weekend-reversal`, because a different study
  already uses `research/edge/crypto-weekend/` on the branch `crypto-weekend`.

## What happens next

Nothing changes live on any outcome. The result is published as it is; a bug found after the run is fixed, said in RESULT.md,
and everything is re-run.

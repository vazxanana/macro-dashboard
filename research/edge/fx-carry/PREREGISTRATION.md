# The FX carry trade on the G8 currencies, with a crash filter: pre-registration (revision 2)

Written and committed on 14 Nov 2026, **before any return, R, t or drawdown of this rule was computed** on any data.
Paper research only: no live rule, size, filter, stop, config, cost constant, council member, page or mirror setting changes,
whatever the outcome. Nothing of ICT is read or touched. A PASS leads at most to a written proposal for a paper shadow, for
the owner to decide (absolute rule 3).

## History of this file (read first)

Revision 1 of this pre-registration (commit `cb793a37`, 13 Nov 2026) fixed a different design: OECD 3-month interbank rates
fetched from FRED with a two-month lag, a 3 x ATR stop and a G10-volatility skip. FRED and every other rate host were refused
by the build network, so by its own gate 3 it stopped: **no return, Sharpe, t or drawdown was ever computed** (its RESULT.md,
commit `d45b7719`, says so). Revision 2 replaces it with the design below, set by the brief of 14 Nov 2026: policy rates
written out from known central-bank decisions (approximate, from memory, stated as such), a 2 x ATR stop and an S&P 500
volatility filter. Revision 1's files (`run.mjs`, `RESULT.md`, `result.json`, its test, its `out/` copy) are removed in the
next commit, which also adds this revision's code. Nothing below was chosen after seeing a result: there was none.

## Why

The carry trade (long the currencies with the highest short rates, short those with the lowest) is the best known FX premium
in the literature (Lustig, Roussanov and Verdelhan 2011; Menkhoff, Sarno, Schmeling and Schrimpf 2012), with crashes when
global volatility jumps (2008). The council's forex shadow streams lose after costs; this asks whether the simplest monthly
carry book on the seven USD majors, with a broker-like swap, the measured raw-spread costs and a stop on every leg, earns
anything on the council's own candles, and whether staying out in volatile months helps.

## What I already know (said before any computation)

- The council-data daily candle cache (`research/daily/<key>.json`, OANDA mid, complete UTC days) holds `eurusd gbpusd usdjpy
  audusd usdcad usdchf` from May 2002 and `nzdusd` from 24 Sep 2002, `spx500` from 24 Mar 2003, all to 6 Nov 2026. I read
  only row counts, first and last dates, and the first rows of `eurusd` (2002 rows are single ticks: O = H = L = C).
- From general knowledge: G10 carry crashed in 2008 and was weak through the 2010s, when most G10 rates sat near zero and the
  rate gaps were small; 2022-24 (dollar and yen gaps of 4-5 points) was a good period for long-dollar / short-yen carry. In
  the 2016-26 window the dollar is often one of the two highest-rate currencies, which makes that leg flat. I expect a small
  or no edge after costs; the test is run because the owner's book has no FX premium of this kind tested yet.
- The demo broker is a raw-spread account: majors quoted near bid = ask, commission 22.5 USD per million a side (CLAUDE.md
  "Forex spreads").

## Data and windows

- OANDA mid daily candles from the council-data branch (`node run.mjs fetch <dir>` runs `git show
  origin/council-data:research/daily/<key>.json`; no network). Weekend candles are folded into the next weekday with
  `council/fills.mjs` `foldWeekend` (imported, unchanged): a Sunday stub's open becomes Monday's open.
- Pairs: `eurusd gbpusd audusd nzdusd` (the currency is the base), `usdjpy usdcad usdchf` (the currency is the quote).
- **Decisive window: holding months January 2016 to October 2026** (the last complete month on file; positions opened at
  the end of December 2015 to the end of September 2026). **Replication window: holding months January 2006 to December
  2015.** A month belongs to the window of the month the book is held in.
- Gate (checked before any statistic is read): every pair has at least 15 daily candles in every month from December 2005 to
  October 2026, and every candle used has high >= max(open, close) >= min(open, close) >= low > 0; otherwise the run stops
  and says so.

## Policy rates: `rates.json`

One table per currency of central-bank decisions (effective date, new rate in percent a year), from 31 Dec 2004:
Fed funds target (midpoint of the range from Dec 2008), ECB deposit facility rate, Bank of England Bank Rate, Bank of Japan
overnight call target / policy-rate balance rate, RBA cash rate, RBNZ OCR, Bank of Canada overnight target, SNB (Libor
target midpoint / aim to June 2019, then the policy rate). **Every figure is approximate and written from memory** on
14 Nov 2026 (the build network refuses FRED and the central banks' hosts); each table names the source to check it against.
A date may be off by a day; a small move may be missing. **No 2026 decision is recorded**: every rate is held at its last
listed value (Dec 2025 at the latest) through 2026, so 2026 rankings are the least reliable. `monthEnd` is the rate in force
on each month's last calendar day, derived from the decisions (a test checks it). The study reads the decisions directly:
the rate used on a date is the last decision effective **on or before** that date.

## The rule

- **Rebalance**: the last folded daily candle of each calendar month (a weekday; UTC date). Ranking, ATR and the filter use
  only candles dated on or before that day and the rates in force on that day.
- **Ranking**: the eight currencies `USD EUR GBP JPY AUD NZD CAD CHF` sorted by policy rate, highest first; ties keep this
  fixed list order (a stable sort). **Long the first two, short the last two.** Each pick is traded against the dollar
  through its USD pair: long EUR = buy `eurusd`, long JPY = sell `usdjpy`, short CAD = buy `usdcad`, and so on. **USD in the
  top or bottom two: that leg is flat** (no position, 0 R, not counted as a leg).
- **Entry**: at the close of the rebalance candle (time = the candle's start + 24 h).
- **Stop** (every leg has one, on the losing side): 2 x ATR(20) from the entry, fixed for the month. ATR(20) = the simple
  mean of the true range of the 20 folded candles ending with the rebalance candle (true range = max(high, previous close)
  - min(low, previous close)). `r0` = 2 x ATR(20) = the leg's 1R. **Equal risk**: every leg is 1R.
- **Inside the month**, each candle after the entry candle, in order: a candle that opens at or beyond the stop exits at its
  open; one whose low (long) / high (short) reaches the stop exits at the stop. A stopped leg stays flat to the next
  rebalance. Otherwise the leg is closed at the close of the next rebalance candle, and the new ranking's legs opened at the
  same close. A pick kept from one month to the next is still closed and reopened (a full round trip charged: conservative,
  and every leg gets a fresh stop).
- **Exit times** (for counting nights): month-end close = that candle's start + 24 h; a stop at the open = the candle's
  start; a stop inside the candle = the candle's start + 12 h (the hour is unknown on daily candles; midday is stated).

## Returns, in R of each leg (side s = +1 long the pair, -1 short the pair; price P = the pair's quote)

- **Price part**: `s x (exit - entry) / r0`.
- **Carry part** (the point of the trade, credited and charged like a broker's swap): for each rollover the leg is held over,
  counted with `council/fills.mjs` `nights` (22:00 UTC Monday to Friday, **Wednesday counts three**; imported), the leg earns
  `(s x (r_base - r_quote) - 1.0) / 100 / 365 x entry / r0` per night counted, with `r_base`, `r_quote` the policy rates in
  force on that rollover's UTC date. The **1.0 % a year broker markup is charged on every leg, whichever side** (never
  credited). Example: long AUD at 4.35 % against USD at 5.375 % pays (4.35 - 5.375 - 1) % a year.
- **Cost part** (per round trip, every leg, every month and on a stop), the raw-spread model: a quoted spread of **0.3 pip**,
  **half a spread of slippage on each market order** (entry and exit: 0.3 pip together) and a commission of **22.5 USD per
  million a side** (45 per million a round trip = 0.000045 of the price): `(0.6 x pip + 0.000045 x entry) / r0`, pip =
  0.0001 (0.01 for `usdjpy`).
- **Net R of a leg** = price + carry - cost. **A month's book R** = the sum of its legs' net R (zero to four legs; a flat
  month is 0).
- **Twice the cost**: spread, slippage, commission and the markup doubled (reported, and pass condition 5).

## Tests (fixed: two)

- **T1**: the rule above, every month.
- **T2 (crash filter)**: the same, but **flat for the month** when the S&P 500's 20-day realised volatility at the rebalance
  is above its 1-year median. Realised volatility on a day = the standard deviation (n - 1) of the last 20 daily log
  close-to-close returns of folded `spx500` candles ending that day; the 1-year median = the median of that figure over the
  252 `spx500` candles ending at the rebalance (inclusive). The `spx500` candle used is the last one dated on or before the
  rebalance day. Above the median (strictly) = flat; equal or below = trade.

Statistics per test and window on the **monthly book R series, every holding month of the window, flat months as 0**: n
months, n legs, mean net R a month (with its price, carry and cost parts), standard deviation, **t on monthly sums** = mean /
(sd / sqrt(n)), one-sided p (normal approximation), total, share of months positive, worst drawdown of the cumulative
monthly R, by year, and the same at twice the cost. **Holm** over the two decisive-window p-values.

**Placebo** (40 seeds, `mulberry32(1000 + seed)`): every month a random order of the eight currencies (Fisher-Yates), long
the first two, short the last two, everything else as the rule (stops, carry, costs; for T2 the same flat months). Reported:
the 5th / 50th / 95th percentile of the 40 decisive-window mean net R a month, and how many placebo means the test's mean
beats.

## Pass bar and verdict (fixed here)

A test **passes** when all hold:

1. decisive window: mean net R a month > 0 with **month-sum t >= 2.0**;
2. replication window: mean net R a month > 0;
3. Holm-adjusted p < 0.05;
4. the decisive mean beats at least 38 of the 40 placebo means (the placebo's 95th percentile);
5. decisive mean net R a month > 0 at twice the cost.

**Verdict**: PASS if T1 or T2 passes (named). **FAIL** if neither test meets conditions 1 and 2 together. **INCONCLUSIVE**
otherwise (a test meets 1 and 2 but not all five). Never called an edge without n and t; a PASS on memory-written rates
needs the rates checked against their sources before anything else is proposed.

## What I had to decide (the brief leaves it open)

- Ties in the ranking (common 2009-15 near zero): the fixed list order above.
- Close-and-reopen every month with a full round trip, rather than holding an unchanged pick.
- Exit times for night counting on daily candles (midday for a stop inside a candle).
- Carry rates per rollover date (a decision inside the month changes the carry from that day), but the ranking only at the
  rebalance.
- A month's book R is the sum of its legs (1R each), not their mean: a month with four stopped legs is -4R plus costs.
- The markup applied to both sides of every leg as a flat 1 % a year (a broker's real long / short swaps differ by pair).
- Slippage of half a spread on each of the two market orders, as `council/fills.mjs` does.
- Early 2002-04 candles are thin single ticks; nothing before December 2005 is used except as the 2005 rate history.

## What happens next

Nothing changes live on any outcome. A bug found after the run is fixed, said in RESULT.md, and everything re-run.

## Files

`rates.json` (above), `run.mjs` (`fetch <dir>`, `full <dir>`), `result.json`, `RESULT.md` (verdict first),
`tests/fx-carry.test.mjs` (offline).

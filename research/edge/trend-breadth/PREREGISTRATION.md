# Trend breadth and financing: pre-registration

Written and committed **before** any number below was computed (11 Nov 2026). The criteria decide the verdicts; nothing in
them changes after the results are seen. Anything added later is labelled a post-hoc diagnostic in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes. A pass makes a candidate for a
paper shadow that the owner decides on; it is never a live change.

## Why this study

The evidence review of 11 Nov 2026 found that the only live systems with a positive record on data they were not built on
are the long-only gold systems, led by Gold trend (`gtrend`, +0.49R a position on 2006-17, n 75, t 1.77;
`research/edge/gold-systems-oos`). Two things about that record have never been measured:

- **Part A, financing.** Every cost model in the repository (`council/fills.mjs`, the studies' flat $0.30 a unit) counts the
  spread and slippage only. A long gold position held overnight on the demo broker also pays financing every night: the
  broker's own symbol record (`ctrader/symbols.json`, XAUUSD `swap.long` −5.903 pips, pip 0.1, triple on Wednesday) and the
  demo account's own deals (−$0.59 for one ounce held one night at about $4,100) put it at about 0.0148 % of the price a
  night, about 5.3 % a year. The trend legs hold for weeks. How much of the gold systems' honest expectancy is left after
  financing?
- **Part B, breadth.** Gold trend takes about 6 positions a year. `gold-systems-oos` found its entries no better than random
  long entries with the same exit, so its profit may be "long gold in years gold rose". If the rule is a real trend rule it
  should also earn, unchanged, on other markets; if it does, that is more trades from a rule with evidence. If it does not,
  the gold record is a gold-beta record and should be sized as one.

## Data

- **Part A:** the per-position records committed by `research/edge/gold-systems-oos/result.json` `positions` (`sys`, `t`,
  `c`, `g`, `n`, `n2`, `add`, `r0`; nothing re-run) and gold's daily closes in `research/edge/honest-book/gold-1d.json`.
- **Part B:** the council's daily candle cache, council-data `research/daily/<key>.json` (complete OANDA mid daily candles
  in UTC buckets, Sunday stubs included, as the live Trader's daily feed has them; `node run.mjs fetch <dir>` copies them
  out of the `council-data` branch with `git show`, no network). Files stay out of git.
- **Windows.** Confirmation: positions entered **2020-01-01 to 2026-10-31**. Replication: positions entered from
  **2007-01-01** (or the market's 60th candle, if later) **to 2019-12-31**. The rule's two parameters were chosen on gold
  from 2018 on and nothing is fitted here, so for every market other than gold both windows are data the rule never saw.

## Part A: financing of the gold systems (accounting, no rule tested)

For every recorded position of `gtrend`, `gtrend5`, `gtl` and `geg`:

- **Nights** = the number of financing rollovers between its entry `t` and close `c`: each Monday-to-Friday 22:00 UTC
  (17:00 New York, to the hour) inside the hold counts one, a Wednesday three.
- **Financing in R** = nights × rate × (gold's daily close on the entry day) ÷ `r0`, charged on the **first unit only**
  (the records do not carry the add's time or risk, so this understates the cost of positions with an add).
- **Rates.** F1 = 0.0148 % of price a night (today's broker rate). F½ = half of it (roughly the level when short dollar
  rates were near zero, 2009-15 and 2020-21; the repository has no history of the broker's rate, so both are shown and
  neither is called the truth for the past).
- **Reported** per system for 2006-07 to 2017-12 (the untouched window of `gold-systems-oos`), 2018-01 to 2026-10 and
  2020-01 to 2026-10: n, mean nights, mean net R as recorded (`n`), mean financing R, mean after financing at F1 and F½,
  and the t of the after-financing mean (per position).
- **Reading, fixed now.** A system **survives financing** when, on the untouched window at F1, its mean stays above 0 and
  its t is at least 1; otherwise it **does not survive at today's rate**. Part A cannot make anything an edge: the best it
  can say is that a t of 1.8 became smaller.

## Part B: the Gold trend rule, unchanged, on other markets

### The rule (the live block of `council/trader.mjs`, as replayed in `gold-systems-oos/replay.mjs`)

Long only. When a closed daily candle closes above the highest high of the N daily candles before it (N = 20, the live
`goldTrend`), buy at the next run. Stop 2 × ATR(14, daily) under the entry. After each newly closed day the stop is lifted
to (that close − 2 × ATR14) when that is higher; it is never lowered. No target, no time limit, one position a market. One
add: on the first daily close at least 1 × the initial risk above the entry, buy one more unit at the next run with the
position's current stop. A signal acts only within 24 hours of its day's close.

### Daily harness (stated departures)

The live Trader acts a few minutes after 00:00 UTC, so on daily candles:

- an entry (and an add) fills at the **open of the next daily candle**, and only when that candle starts on the next
  calendar day (a signal on the last candle before a weekend or holiday gap is lost, as it is live, where it is older than
  24 hours by the reopen);
- a stop is checked on every candle from the entry candle on: an open at or under the stop exits at the open (gap),
  otherwise a low at or under the stop exits at the stop; the ratchet and the add are decided after the candle closes;
- a position still open at the end of the data is closed at the last close and marked `atEnd`.

**Parity gate (decides whether Part B is reported at all).** The harness is first run on gold (`xau`). For N = 20 it must
reproduce `gold-systems-oos` `gtrend` in each of 2006-07 to 2017-12 and 2018-01 to 2026-10: the number of positions within
15 %, and the mean gross R a position (`g`, legs summed) within 0.15R. If either window misses, Part B stops there, its
verdict is "harness not validated", and no breadth number is interpreted.

### Symmetric version for currencies

For currency pairs "long only" depends on which currency is quoted first, so the rule is run both ways: the buy rule as
above and its mirror (close under the lowest low of the prior N candles, stop 2 ATR above, ratchet down, one add), one
position a market at a time.

### Costs (per unit, round trip, charged as cost ÷ that unit's risk)

| group | x1 round trip, % of entry price |
|---|---|
| currency majors | 0.015 |
| equity indices | 0.03 |
| silver, copper, energies | 0.10 |
| platinum, palladium, grains and sugar | 0.20 |

x2 doubles the table. **Financing:** a long pays 0.015 % of its entry price for every calendar night held (5.5 % a year); a
short is credited nothing; a currency position pays 0.004 % a night on either side. The verdict is read on x1 costs with
financing.

### The four tests (N = 20)

| test | markets (every one the cache has; none chosen by result) | sides |
|---|---|---|
| B1 | silver, platinum, palladium, copper (`xag xpt xpd xcu`) | long |
| B2 | equity indices (`au200 ch20 cn50 de40 es35 eu50 fr40 hk33 in50 jp225 nas100 nl25 sg30 spx500 uk100 us2000 us30`) | long |
| B3 | energies and agriculturals (`bco wtico natgas corn wheat soybn sugar`) | long |
| B4 | currency majors (`eurusd gbpusd audusd nzdusd usdjpy usdcad usdchf`) | both |

Gold's own crosses (`xaueur xaugbp xauxag`), the bond CFDs, currency crosses and exotics are out of scope. Each test pools
every position of its markets at fixed 1R a unit.

**Statistic.** Markets in a group break out together, so a per-position t would overstate the evidence. Each test's t is
computed on **calendar-month sums** of net R (a position is booked in the month it closes; months without a close count 0):
t = mean ÷ sd × √months. One-sided p from the normal distribution, Holm-corrected over the four tests.

**A test PASSES only if all hold:**
1. confirmation 2020-26: net R a position above 0, monthly t at least 2, Holm-corrected p under 0.05;
2. replication 2007-19: net R a position above 0 and monthly t at least 1;
3. confirmation still above 0 at x2 costs.

Otherwise it FAILS. **Overall verdict:** PASS if at least one test passes, else FAIL.

**Reported, never part of the verdict:** N = 5 (the shadow `gtrend5`) on the same four sets; every market's own row;
the same tables without financing; gold itself on the daily harness with financing (first unit and add); positions a year
for each set.

## What a result may be used for

- A FAIL in Part B says the Gold trend record does not carry to other markets under this harness and these costs; it does
  not change the gold systems. It supports sizing the gold trend legs as one bet on gold rising.
- A PASS in Part B is a candidate for a paper shadow stream on that set, proposed to the owner, with a forward record
  judged against its band before anything else. It is not called an edge without its n and t beside it.
- Part A's figures go to the owner as a cost the "What to expect" figures do not include; adding financing to the live
  cost model is a proposal, not done here.

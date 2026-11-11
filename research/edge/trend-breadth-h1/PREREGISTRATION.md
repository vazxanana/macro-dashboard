# Trend breadth on hourly candles: pre-registration

Written and committed **before** the harness was run on any market, gold included (11 Nov 2026). The harness, the parity
gate, the market list, the costs, the tests and the pass bar are fixed here; nothing in them changes after the results are
seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes. A pass is a hypothesis for a
forward paper shadow that the owner decides on; it is never a live rule.

## Why this study

Gold trend (`gtrend`) is one of the two systems in the owner's paper book and takes about six positions a year.
`research/edge/trend-breadth` asked whether the same rule, unchanged, earns on other markets (more trades from a rule with
some evidence) and could not answer: its daily-candle harness missed the parity gate on gold, because the live rule buys
again **inside a day** after a stop-out and daily candles cannot place those trades. This study asks the same question with
hourly candles, which can.

## What is already known (seen before this was written)

- `trend-breadth` Part B's daily figures, which that study did not interpret because the harness flatters the rule: other
  metals −0.04R a position on 2020-26, equity indices −0.10R, energies and agriculturals +0.24R (monthly t 1.47), currency
  majors −0.23R (t −3.62). They gave no sign of a pass.
- Gold's own record (`gold-systems-oos`, M5 engine): 75 positions, +0.506R gross on 2006-07 to 2017-12; 59 positions,
  +1.347R gross on 2018-01 to 2026-10.
- Hourly history reachable through the candle proxy (checked 11 Nov 2026, before the list below was written, by asking for
  each market's first hourly candle and nothing else): OANDA serves H1 from January 2004 for the indices, the currencies
  and oil, and from March 2006 for gold and silver.
- Nothing from the hourly harness: it had not been run.

## Data

OANDA mid candles through the site's keyless proxy (`/md/bars`), H1 and D1, complete candles, UTC buckets (D1 with the
Sunday stub, as the live Trader's daily feed has it), first candle to 31 October 2026: `node --use-env-proxy fetch.mjs
<dir>`. The files stay out of git.

## The rule (the live block of `council/trader.mjs`, as replayed in `gold-systems-oos/replay.mjs`)

Long only. When the last closed daily candle closes above the highest high of the 20 daily candles before it, buy at the
next run. Stop 2 × ATR(14, daily) under the entry. After each newly closed day the stop is lifted to (that close − 2 ×
ATR14) when that is higher; never lowered. No target, no time limit, one position a market. One add: on the first daily
close at least 1 × the initial risk above the entry, one more unit at the next run with the position's current stop. A
signal acts only within 24 hours of its day's close, and each day's signal is used once. **Every unit has a stop from the
moment it is opened.**

## The hourly harness (stated departures from the M5 engine)

- **One run at every H1 close.** The run sees the daily candles whose bucket has ended (start + 24 h at or before the
  run), exactly as the M5 engine counts them. Order inside a run as live: manage the open units on the candle just closed,
  then the ratchet and the add (once per newly closed day), then a new entry.
- **Entries and adds fill at the open of the H1 candle that starts at the run time**, and only if there is one (no candle
  in progress → nothing is placed, as in the M5 engine). The M5 engine fills about nine minutes after the hour at the M5
  close; this is the departure the parity gate measures.
- **Stops:** on every H1 candle from the unit's entry candle on. A candle after the entry candle that opens at or beyond
  the stop exits at its open (a gap); otherwise a low at or under the stop exits at the stop (`council/fills.mjs`
  `stopFill`). On the entry candle itself a low at or under the stop exits at the stop.
- **Shut hours:** for gold, silver and the currencies an H1 candle that `council/fills.mjs` `spotSkip` marks (the weekend
  window and the 17:00 New York rollover) fills and stops nothing. Other markets: every candle on file counts.
- Because a run happens every hour, a stop-out while the last closed day is still an unused breakout is followed by a new
  entry at the next hour's open: the re-entry the daily harness could not place.
- A position still open at the end of the data is closed at the last H1 close and flagged.
- **Mirror (currencies only):** the same rule with highs and lows exchanged (close under the lowest low of the prior 20
  days, stop 2 ATR above, ratchet down, one add); one position a market at a time, either side.

## Parity gate (decides whether anything else is reported)

The harness is first run on gold. Against `gold-systems-oos` `gtrend`, positions dated by entry, in **each** of 2006-07 to
2017-12 and 2018-01 to 2026-10: the number of positions within **15 %** and the mean gross R a position within **0.15R**
(the tolerance `trend-breadth` pre-registered). If either window misses, the study stops there: verdict "harness not
validated", the reason is reported, and no breadth number is interpreted. The harness is not adjusted after the gate is
read.

## Markets (chosen now, by liquidity and cost, before any run)

| group | markets | sides | round trip, % of entry price (x1) |
|---|---|---|---|
| metals | silver `xag` | long | 0.10 |
| equity indices | `nas100`, `spx500`, `us30`, `de40`, `jp225` | long | 0.03 |
| currency majors | `eurusd`, `gbpusd`, `usdjpy`, `audusd`, `usdcad` | both | 0.015 |
| energy | `wtico`, `bco` | long | 0.10 |

Thirteen markets: the most traded contract of each kind the broker offers, at the cost table `trend-breadth` fixed. Left
out before any run, for cost or thinness: platinum, palladium, copper, natural gas, grains and sugar (0.20 % round trips
or erratic sessions), the minor indices, and `usdchf` / `nzdusd` (close copies of pairs in the list). Gold is the parity
market, not a test.

**Costs:** each unit pays its round trip as cost ÷ its own risk; x2 doubles the table. **Financing:** `council/fills.mjs`
`nights` (Monday-Friday 22:00 UTC rollovers inside the hold, Wednesday three) × 0.015 % of the entry price for a long in
metals, indices and energy (the `trend-breadth` rate, about 5.5 % a year), × 0.004 % for a currency position on either
side, ÷ the unit's risk, on every unit. The broker's real rates per market have not been measured; these are the
`trend-breadth` assumptions. The verdict is read at x1 with financing.

## Windows

Positions are booked on the day their last unit closes. **Confirmation: closed 2020-01-01 to 2026-10-31** ("2020 → now").
**Replication: closed 2005-01-01 to 2019-12-31** (2007-01-01 for silver, whose candles start in 2006). The rule's two
numbers were chosen on gold from 2018 on and nothing is fitted here, so for every market in the list **both** windows are
data the rule never saw; the two are reported side by side as the usual check that a result is not one period's.

## The tests

Fourteen: **one per market**, and **the pooled test** (every position of the thirteen markets at 1R a unit).

**Statistic:** t on calendar-month sums of net R (months without a close count 0): mean ÷ sd × √months. Markets break out
together, so a per-position t would overstate the pooled evidence. One-sided p from the normal distribution,
**Holm-corrected over the fourteen tests**.

**A test PASSES only if all hold:**
1. confirmation: net R a position above 0, monthly t at least 2, Holm-corrected p under 0.05;
2. replication: net R a position above 0 and monthly t at least 1;
3. confirmation still above 0 at x2 costs.

**Overall verdict:** PASS if the pooled test or at least one market passes (named, with n and t); otherwise FAIL.

**Reported, never part of the verdict:** each group pooled; gold on the same harness with costs and financing; the
figures without financing; positions a year; the share of positions that are same-day re-entries; per-position t.

## What a result may be used for

- A FAIL says the Gold trend record does not carry to these markets at these costs: the gold record should be read and
  sized as a bet on gold rising with a trailing exit, not as a general trend rule, and no new stream is proposed.
- A PASS names a market or the pool as a **candidate for a forward paper shadow**, proposed to the owner with its n and t;
  nothing is called an edge on the strength of it, and nothing live changes.
- A missed gate is reported as such, with what a valid harness would need.

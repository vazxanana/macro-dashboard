# Five other central banks: follow the first hour after the decision: pre-registration

Written and committed **before** any trade of this study was computed (14 Nov 2026), together with `dates.json` (the event
list) and `frozen.mjs` (the rule). Nothing in these three files changes after a result is seen. Anything added later is
labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes; ICT is not involved. This is a
stand-alone event rule on five forex pairs; it reads no trade, gate or exit of the gold book (owner decision item 44 is
untouched). A pass would be a hypothesis for a forward paper shadow that the owner decides on, never a live rule.

## Why this study

`ecb-boj-days` (branch of 14 Nov 2026, PR #896) tested "follow the first hour after a central-bank decision" on the ECB
(EUR/USD) and the Bank of Japan (USD/JPY). Verdict FAIL, 0 of 2. The ECB leg was a near miss: +0.631R a trade net, n 71,
month-sum t 1.51 on 2018 to now, +0.471R in 2010-17, above its placebo, but under t 2; BoJ was flat. Its `RESULT.md` says a
follow-up needs its own pre-registration on other data. The decisions of five other central banks are new, independent
events that rule was never run on: this study runs the SAME rule, frozen, on them. It is a replication, not a search: no
parameter is chosen here.

## What is already known (seen before this was written)

- The ecb-boj-days result above (its figures were read; nothing in this study is chosen from them: the rule is copied).
- Another session's GBP/USD, USD/CHF and AUD/USD M5 files (OANDA, from November 2015, fetched on 13 Nov for a study of
  the session opens) are reused here as a cache seed only; its results were not read for this study.
- `gotobi`, `gotobi-replicate`: USD/JPY and yen crosses in the Tokyo morning; not these pairs on these days.
- No figure of this rule on any of the five banks has been computed or looked at. The M5 files were opened only to read
  their first and last candle (to know what had to be fetched).

## Events (`dates.json`)

Scheduled monetary-policy decisions, 2010 to now, of:

| bank | pair | decision minute (local, daylight time included) | exit (UTC, decision date) |
|---|---|---|---|
| Bank of England (BOE) | GBP/USD | 12:00 London | 21:00 |
| Bank of Canada (BOC) | USD/CAD | 09:45 or 10:00 Toronto, per date by the clock check below | 21:00 |
| Swiss National Bank (SNB) | USD/CHF | 09:30 Zurich | 21:00 |
| Reserve Bank of Australia (RBA) | AUD/USD | 14:30 Sydney | 15:00 |
| Reserve Bank of New Zealand (RBNZ) | NZD/USD | 14:00 Wellington (before 2019: 09:00 or 14:00 by the clock check) | 15:00 |

None of these banks is in `council/events.mjs` (US releases, the ECB and the BoJ only), so **every date is written from
memory** of the banks' published calendars; the sandbox cannot reach their sites. `dates.json` names where to check each
bank and lists the dates and stretches I am unsure of (RBA 2010-23 is written by its standing rule, the first Tuesday of
every month but January; any moved meeting is unknown). Unscheduled or emergency announcements are listed apart and are
never events. A wrong date gives a trade on an ordinary day: it dilutes the test toward the placebo, it cannot manufacture
an effect. `RESULT.md` reports how many decision candles the clock check could not confirm. Local times are converted per
date with `council/events.mjs` `zonedToUtc` (read only, imported; daylight time of each zone included). The local date is
the bank's own; for the RBA and the RBNZ the decision minute falls on the same UTC date (01:00 to 04:30 UTC).

## Decision minute D (`frozen.mjs` `decision`)

- One candidate minute (BOE, SNB, RBA, RBNZ from 2019): D = the start of the M5 candle starting at that local minute.
- Two candidates (BOC every date; RBNZ before 2019-01-01, since the move of its announcement from 09:00 to 14:00 Wellington
  is not dated from memory): the ecb-boj-days **direction-free clock check**, D = the candidate whose M5 candle has the
  larger range (high − low), a tie to the earlier minute; only those candles are read. An RBNZ date where 09:00 wins gives
  **no trade** (that announcement falls on the UTC evening before, outside the frozen exit window).
- A chosen candle whose range is under 2x the median range of the same local minute on the 20 previous weekdays (within 45
  calendar days, event dates left out) is counted as "not confirmed": reported, still traded (as in ecb-boj-days).

## The rule (frozen: `frozen.mjs` `trade`, byte for byte the ecb-boj-days function)

- `ref` = the close of the M5 candle ending at D; `c60` = the close of the M5 candle ending at D + 60 min. Direction
  d = sign(c60 − ref); d = 0 or a missing candle → no trade.
- **Entry** at c60 in direction d (market order). **Stop** = entry − d x ATR, ATR = the simple mean true range of the last 14
  one-hour UTC candles (built from M5, hours with candles only) that ENDED at or before D; fewer than 14 in 7 days → no trade.
  No target, no break-even, no trail; every trade has this stop.
- **Management** on M5 candles after the entry: a candle opening beyond the stop exits at its open; else the stop when its
  range reaches it; else out at the close of the last candle ending at or before the exit time. Exits 21:00 UTC (BOE, BOC,
  SNB) or 15:00 UTC (RBA, RBNZ), as the request fixed them; none holds over the 17:00 New York rollover (no financing).
- R = d x (exit − entry) / ATR.

## Costs (unchanged from ecb-boj-days: the raw-spread forex model, CLAUDE.md "Forex spreads")

Per round trip in price: 0.3 pip spread + 0.3 pip slippage (half a spread on each market order) + commission 45 USD per
million USD notional (0.0045 % of the price for every pair here). Pip 0.0001 for all five. Net R = R − cost / ATR. Every
result is also shown at 2x cost.

## Data

OANDA mid M5 candles (`gbpusd`, `usdcad`, `usdchf`, `audusd`, `nzdusd`) through the site's candle proxy (`fetch.mjs`, copied
from ecb-boj-days with the pair list changed), November 2009 to the last candle on file, kept outside git. A candle is used
only once it has closed. Times UTC.

## Windows

- **Decisive**: 2018-01-01 → the last candle on file. **Replication**: 2010-01-01 → 2017-12-31 (sign check).

## The question and the pass bar (the pooled test decides)

**Pooled** = all five banks' trades together. Statistics per window: n, mean net R a trade, the **month-sum t** (every
calendar month of the window gets the sum of the net R of its trades, 0 without a trade; t = mean / (sd / √months)).

The study **PASSES** only if the pooled test meets all of:
1. n ≥ 40 trades in the decisive window;
2. mean net R a trade > 0 and month-sum t ≥ 2 in the decisive window;
3. mean net R a trade > 0 in 2010-17;
4. **placebo**: the same rule (same clock check, ATR, exit) on non-event weekdays at the same local clock minutes, 40 seeds.
   For each event one weekday drawn at random within ±182 days of it, inside the decisive window, not within 3 days of any
   decision of that bank (scheduled or not); a draw that gives no trade is redrawn, up to 50 tries. The pooled placebo mean
   of a seed = the mean over the five banks' draws of that seed. The event mean must be above the 95th percentile of the 40
   seed means;
5. mean net R a trade > 0 at **2x cost** in the decisive window.

Else **FAIL**. Per bank, reported whatever the verdict and never deciding it: n, net R, month-sum t, one-sided p (normal
approximation) with **Holm over the five banks**, 2010-17, placebo p5 / p50 / p95, 2x cost; by year, exits, the clock
check's choices, the skips.

## What follows

- PASS: a proposal in `research/proposals/` for a forward paper shadow; nothing live changes; the owner decides.
- FAIL: no proposal, nothing live changes; the figures are the record, and together with ecb-boj-days they close this rule
  (no other first window, exit, stop, pair or filter is tried on these events; that would need its own pre-registration
  on data not used here).

# Pre-registration: a book-level risk rule for the ICT A-setup book

Written on 13 Nov 2026, **before any of the four rules was run on a trade**. What existed when this file was committed: the
candles (downloaded with `ict-equal-lows`' own fetch stage, kept outside git) and the published `ict-equal-lows` result,
whose unfiltered baseline IS this study's as-is book (declared under "Prior knowledge"). No code of this study had run.
`run.mjs` writes the sha256 of this file into `result.json` (`planSha256`).

Paper research. ICT is its own edge and Fred controls its files: no file under `ict/` or `.claude/skills/ICT/` changes,
whatever the result. Every simulated trade keeps the engine's own stop; a rule here can only skip a trade or scale its size,
never move or remove a stop. A pass becomes a note for Fred, not a change.

## 1. Question

The A-setups fire on four index futures that move together (NQ, ES, YM, RTY) and on gold; the desk sizes each signal on its
own (`sizeOf`) and lets each market hold one position. Does one rule at the level of the BOOK cut the drawdown without
cutting the edge?

## 2. The as-is book (fixed)

- Engine: `api/_ictlab.js` `runMarket` (the desk's `signals()` / `isASetup()` / `sizeOf()` / `P` from `ict/tracker.mjs`,
  `simulate()` from `ict/replay.mjs`), imported, never edited. Rule `A`, no filters, no parameter change, live sizing, costs
  on (the lab's round trip: NQ 1.5, ES 0.5, YM 3, RTY 0.4 points, gold 0.5; net R = size x (R - cost / risk)).
- Markets: NQ, ES, YM, RTY (OANDA NAS100, SPX500, US30, US2000) under the index A-rule, GC (OANDA XAU) under the gold rule.
  One open trade per market (the lab's own rule). The book = the five markets' trades pooled.
- Candles: OANDA mid H1, 1 Jun 2019 (warm-up) to 9 Nov 2026, cleaned as `ict-equal-lows` (`labSource`'s cleaning: the 17:00
  New York hour dropped, D1 = `dailyNY`). Signal closes 2020-01-01 to 2026-10-31. **IS** = entries 2020-23, **OOS** = entries
  2024-01-01 on. Trades still open at the end of the candles are left out.

## 3. The four rules (each against the as-is book; no fifth, no parameter tuning)

Every rule is applied to the as-is book's trade list in entry order (entry = the signal candle's close, `t`; ties: higher
grade first, then NQ, ES, YM, RTY, GC). A skipped trade is simply not taken; it does NOT free its market for a later signal
inside its window (the market's own one-open stream is not rerun). "Open at t" = taken, entered at or before t and closed
after t.

- **R1 cluster**: an index trade (NQ / ES / YM / RTY) is skipped while another TAKEN index trade on the SAME side is open.
  The first signal wins. Gold is outside the cluster and never skipped by R1.
- **R2 daily loss stop**: no new entry once the taken trades CLOSED earlier in the same New York trading day (17:00 to 17:00
  New York, the desk's day) sum to -2R or less (net, as sized).
- **R3 open cap**: a trade is skipped while 2 taken trades are open.
- **R4 inverse volatility**: no trade is skipped; each trade's net R is multiplied by a weight. For each market, a daily
  series of its as-is net R closed per New York trading day (weekdays; 0 on a day with no close), from 2020-01-01. At a
  trade's entry, sigma_m = the sample standard deviation of the last 60 trading days of that series that ENDED before the
  entry's trading day. Raw weight 1 / sigma_m for each market with sigma_m > 0; divided by the mean raw weight over those
  markets (so the average weight across markets is 1: the same average risk); clipped to [1/3, 3]. A market with sigma_m = 0,
  or any trade before 60 trading days of series exist, gets weight 1.

## 4. Measures and the bar

For a book in a half (trades assigned to the half by entry): total net R; **max drawdown** = the deepest fall of the running
sum of net R from its own high (the high starts at 0), in close order; **return / drawdown** = total / max drawdown;
**monthly Sharpe** = mean / standard deviation of the calendar-month sums of net R (by close month, every month from the
half's first month to its last close, zero months included) x sqrt(12).

**PASS**, per rule, only if all hold:
1. return / drawdown better than the as-is book in IS **and** in OOS;
2. OOS monthly Sharpe not lower than the as-is book's;
3. **block bootstrap**: months (by entry month) of 2020-01 to 2026-10 resampled with replacement, the same draw for both
   books (paired), 2,000 draws, seed 20261113; within a month trades stay in close order; P(better) = the share of draws in
   which the rule's return / drawdown is above the as-is book's. P(better) >= 0.9, **and** the Holm-adjusted p (p = 1 -
   P(better), Holm over the 4 rules) <= 0.10.

FAIL otherwise. Reported, not judged: n, win rate, net R a trade, t, per year, and how many trades each rule skipped.

## 5. Prior knowledge, declared

- The as-is book is `ict-equal-lows`' unfiltered stream T1 (published 11 Nov 2026): IS 1,028 trades +86.5R, max drawdown
  33.3R; OOS 679 trades +93.0R, max drawdown 17.8R. So the baseline's totals and drawdowns were known; no rule's effect was.
- The index A-rule was fitted on 2023-26 data and the gold rule on 2019-26 gold: the baseline is not out of sample. Only the
  rules' difference is judged here, and the rules' numbers (-2R, 2 open, 60 days) were chosen before any run, from the task,
  not from data.
- The desk already shows a "one per cluster" view (highest grade within 3 h, skill §16, a display filter); R1 here is the
  simpler first-signal-wins version.

## 6. What follows

A PASS: a short note for Fred in `RESULT.md` (and, if he wants it, a paper shadow first). Nothing under `ict/` changes here.
Anything else: reported as it is. A bug found after the run is fixed, stated in RESULT.md, and everything runs again.

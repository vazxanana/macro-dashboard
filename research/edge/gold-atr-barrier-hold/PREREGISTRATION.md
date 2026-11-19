# Gold held to an ATR barrier against gold held for a fixed time: pre-registration (14 Nov 2026)

Written and pushed **alone, before** `run.mjs` exists and before any return, R or t of the rules below was computed. Only the
number of entries per window was counted (below), from the dates of the candles, no price change read. Anything added later is
labelled post hoc in `RESULT.md`.

Paper research only. A stand-alone question about how a gold trade is HELD: it reads no trade record or position of the live gold
book (Gold trend, Gold daily engulf), uses none of the book's 2006-17 positions, is not a gate, exit, entry or size of it and
proposes none (docs/owner-decisions.md item 44). Nothing live changes whatever the outcome. ICT is not involved.

## Question

Two ways to hold the same gold trade, entered on every day:

- **A, the barrier hold**: out when price has moved a fixed multiple of the daily ATR either way (a target and a stop of equal
  size), whichever is touched first, else after 20 days;
- **B, the time hold**: out at the close of the 10th day, with a 2 x ATR stop (every trade has a stop).

If gold's daily path were a random walk with drift, both holds would earn the same per day in the market (optional stopping: the
expected move of a stopped walk is the drift times the expected time held). A difference per exposure day therefore measures path
dependence: if gold trends once it has moved, the barrier's target cuts winners early and A earns less per day; if gold
mean-reverts after a move of two ATR, A banks the move before it comes back and earns more. The question: **does the barrier hold
earn more net per day held than the time hold, on the same entries?**

## Dedupe (read before writing)

- `gtrend-exits`, `meridian-exits`, `scalp-exits`, `nq-open-exits`, `ict-exits*`, `crypto-mid-exit` (main / branches): exit
  variants of live systems' own trades (the 2006-17 positions, or other systems). Here no system's trade is used: the entry is
  every day, so the holds are compared on gold's own path, not on a selected set.
- `gold-vol-target` (branch): weekly exposure scaled by trailing volatility, Sharpe against a constant holding. No barrier, no
  per-trade hold. FAIL.
- `gold-lowvol-hold` (branch, pre-registration): a buy in the lowest third of realised volatility held 20 / 60 days against every
  day. An entry condition, not a comparison of holds.
- `gold-weekend`, `gold-weekend-gap`, `gold-session-drift`, `overnight-drift`, `gold-weekday`: when in the day or week gold is
  held, not how long or until what move.
- `gold-origin-target`, `gold-eg-barrier`: targets of structure-based setups. Not every day, not ATR barriers against time.
- `research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`): does not list it.

## Data and market (named before any result)

One market: spot gold, OANDA XAU/USD mid daily candles (council-data `research/daily/xau.json`, UTC days, from 20 Mar 2006), read
with `git show origin/council-data:…` (no network, nothing cached in git). Saturday / Sunday candles are folded into the next
weekday (`council/fills.mjs` `foldWeekend`). Nothing else.

## Rules (fixed)

- **Days**: the folded weekday candles. ATR(14) at day i = the simple mean of the true range of the 14 folded days ending at day i
  (high, low, previous close; all known at day i's close).
- **Entry**: for every day i with an ATR, a trade at the OPEN of day i + 1 (E). Long and short arms are separate.
- **A (barrier, ±2)**: stop E − 2·ATR, target E + 2·ATR (short: mirrored). From day i + 1 on: a later day whose open is already
  through the stop or the target fills at that open; then the stop is checked first (low ≤ stop: out at the stop), then the target
  (high ≥ target: out at the target); if neither by the close of the 20th day held, out at that close.
- **A2 (barrier, −1 / +3)**: the same with the stop 1·ATR and the target 3·ATR away.
- **B (time)**: the same entry, stop E − 2·ATR (gap and stop-first as above), no target, out at the close of the 10th day held.
- **Days held** = folded days from day i + 1 to the exit day, both counted (a trade stopped on its entry day held 1 day).
- **Costs**: $0.60 a round trip per ounce, plus on buys `nights(entry, exit)` × `FIN.xau.long` (0.000148 of price a rollover, the
  demo broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) × E. Entry time = day i + 1's start (00:00 UTC); exit time = the
  END of the exit day for every exit (a touch's own rollover is charged: conservative, the same for every arm). Sells are charged
  the spread only (nothing credited). Today's rate for every year.
- **Units**: every figure in ATR units (signed price change, less costs, divided by ATR(14) at day i), so the arms share one unit
  whatever their stop. **Per-trade value** q = net ATR units / days held. **Paired difference** d = q(A) − q(B) for the same
  entry. An entry whose arms have not all exited by the last candle is dropped from every arm.
- **Windows** by entry date: in sample 2007-01-01 to 2016-12-31, out of sample 2017-01-01 to 2026-10-31.

## Entries counted (dates only)

In sample 2,602 entry days, out of sample about 2,542 (a few at the end of October 2026 drop if a 20-day arm has not exited by
13 Nov 2026). Each window has well over 100 per arm.

## Tests (three, Holm over all three)

- **T1 (primary)**: long, A minus B. H1: mean d > 0.
- **T2**: long, A2 minus B. H1: mean d > 0.
- **T3**: short, A minus B (mirrored). H1: mean d > 0.

Statistic: per calendar month (entry month) the sum of d; t = mean / sd × √months over the window's months; one-sided p from the
normal distribution; Holm over T1-T3 in each window (the decision reads the out-of-sample window).

**Placebo** (40 seeded draws, seed 20261114, per test): the barrier arm is replaced by a time exit at a random number of days drawn
with replacement from that arm's OWN days held in the same window (same stop as that arm, no target), so the placebo keeps the
barrier's holding times but not its price-dependent timing. Real OOS mean d against the 40 placebo means.

## Pass bar (a test passes only on all)

1. OOS net month-sum t ≥ 2 and Holm-adjusted one-sided p ≤ 0.05;
2. the same sign (mean d > 0) in sample;
3. OOS mean d > 0 at twice the costs (spread and financing doubled);
4. the real OOS mean d above at least 38 of the 40 placebo means.

**Verdict** = PASS if T1 passes; a T2 / T3 pass without T1 is reported as a lead, not an edge. Reported beside each: n per arm,
mean net and gross ATR units a trade, mean days held, net per day held, IS and OOS, gross and net. Whatever the outcome, no rule of
the live book changes; a pass would be a hypothesis for its own forward-only record, never a change of the book.

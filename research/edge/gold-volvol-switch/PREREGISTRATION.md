# Pre-registration: gold's volatility trend picks the trade, breakout or reversal (14 Nov 2026)

Written and pushed ALONE, before any trade, regime label or return of this rule was computed. The code (`run.mjs`), the
result and the test come in later commits.

## What this is, and what it is not

A **stand-alone, two-sided daily rule of its own** on spot gold. The idea: when gold's volatility is EXPANDING (its 20-day
ATR higher than ten days ago), moves tend to run, so take a 20-day breakout in its direction; when volatility is
CONTRACTING, moves tend to fade, so take a 5-day reversal against the latest push. The volatility trend (the "volatility of
volatility" regime) chooses which of the two trades is taken on a day; nothing else does.

It is **not** a gate, exit, entry or size of the live gold book (Gold trend, Gold daily engulf, the Mosha cycle): it reads
none of their trades or positions, and no rule of the book is tested on any window. docs/owner-decisions.md item 44 stops
further tests ON the book's rules over its 2006-17 window; a standalone rule judged on its own pre-registered windows is not
such a test (the reading `gold-range-expansion`, `gold-streak` and `gold-turn-of-month` used). Paper only; nothing live
changes whatever the verdict. A PASS would only be written up as a proposal for the owner.

**Dedupe** (each RESULT.md read):
- `gold-regime-switch` (FAIL, 0 of 3): an H4 switch on the 20-bar EFFICIENCY RATIO (trend / range by how straight price
  moved) between an H4 breakout and a Bollinger fade, 2016 on. This study's regime is the DIRECTION OF VOLATILITY itself
  (ATR now vs ten days ago), on daily candles, choosing between a 20-day breakout and a 5-day close reversal, 2007-26. A
  day can be a straight, high-ER grind with falling ATR, or a choppy, low-ER day with rising ATR: the two labels differ.
- `gold-squeeze` (FAIL): a breakout out of a LOW volatility level; `nr7-breakout`, `gold-inside-day`: range contraction;
  `gold-vol-breakout*`: an intraday break of open +/- k x yesterday's range; `gold-range-expansion` (FAIL): one wide day;
  `gold-streak` (FAIL): a run of closes; `gold-adx-trend`, `gold-drd-er`: trend strength, not the change in volatility;
  `vol-managed`, `gold-vol-target`: size by volatility level, no direction choice. None conditions a trade on whether
  volatility is rising or falling.
- The untested backlog (`research/proposals/2026-11-14-untested-backlog.md`) does not list it; the scratchpad topics list
  did not hold it when this slug was taken.

## Data, market set, windows

- Market set, fixed now: **spot gold only**: council-data `research/daily/xau.json` (OANDA mid XAU/USD, UTC daily
  candles), read with `git show origin/council-data:...`, no network, no cache. Saturday / Sunday candles are folded into
  the next Monday with `council/fills.mjs` `foldWeekend` (read only), so every candle is a trading day.
- In sample: trades whose SIGNAL candle falls in **2007-01 to 2016-12**. Out of sample (the judged window): **2017-01 to
  2026-10**. A signal whose exit candle is not on file yet is dropped and counted.

## The rule (every setting decided now; no other setting will be run)

On folded daily candle i (all inputs known at its close):
- ATR20(i) = mean true range of the 20 candles ending at i (i included).
- **Regime**: RISING if ATR20(i) > ATR20(i-10), else FALLING.
- **Breakout signal** B(i): +1 if close(i) > the highest high of candles i-20..i-1; -1 if close(i) < the lowest low of
  candles i-20..i-1; else 0.
- **Reversal signal** V(i): +1 (buy) if close(i) < every close of candles i-5..i-1 (a new 5-day closing low); -1 (sell) if
  close(i) > every close of candles i-5..i-1; else 0.
- **The switch**: RISING takes B(i), FALLING takes V(i). The other signal is ignored that day.
- Entry: a market order at the **open of candle i+1**. Stop: **2 x ATR20(i)** from the entry (every trade has one, on the
  losing side; checked on every candle of the hold from i+1; a gap through it fills at the open, `fills.mjs` `stopFill`).
  No target. Time exit at the **close of candle i+10** (ten trading days in the trade).
- One position at a time per test: a signal whose entry candle comes before the previous trade's exit candle is skipped
  and counted.
- R = move in the trade's favour / initial risk (2 x ATR20(i)).

**Size of R and the cost share** (stated before any trade was computed, from the general level of gold's daily range): the
daily ATR of gold has been about 1 to 1.5 % of price, so the stop is about 2-3 % of price: roughly $20-30 at $1,000 gold
and $80-120 at $4,000 gold; the median stop is expected well above $10. The $0.60 round trip is then about 1-3 % of R. The
financing on a ten-day buy (about 14 rollovers) is about 14 x 0.0148 % / 2.5 % = about 0.08R a buy: on the buys the
financing, not the spread, is the cost that matters.

## The three tests (side fixed now, tested one-sided as "the trade makes money")

- **T1 (primary), the switch, both sides**: every signal as above (buys and sells, both legs).
- **T2, the breakout leg alone**: B(i) on RISING days only (both sides).
- **T3, the reversal leg alone**: V(i) on FALLING days only (both sides).

Reported, not judged: the inverted switch (RISING takes V, FALLING takes B), and each leg unconditional (every B signal,
every V signal, whatever the regime), each with the same hold, stop and costs: the unconditional same-trade baselines.

## Costs

- Round trip **$0.60**: the gold spread $0.30 plus half a spread of slippage on each of the two market orders (the
  paper-fill model of `fills.mjs`). Charged in R as $0.60 / initial risk.
- **Financing on buys only**: `nights(entry, exit)` x `FIN.xau.long` (0.0148 % of price a rollover, the demo broker's XAUUSD
  swap of 11 Nov 2026, `council/fills.mjs`, imported) x entry / risk. Sells pay and receive nothing (as every gold study
  here). Today's rate is charged for every year.
- 2x costs check: $1.20 and twice the financing.

## Statistics and the pass bar

- t on **calendar-month sums** of net R (trades grouped by the month of their signal), one-sided p from Student t,
  **Holm over the three tests** (on the out-of-sample p).
- **Placebo, 40 seeded draws** (seed 20261114 + k): the regime label of every candle is replaced by a random one (RISING
  with the probability of RISING over the whole file), the same rule runs with it; the statistic is the out-of-sample mean
  net R a trade. Applied to all three tests.
- A test PASSES only if ALL hold: out-of-sample net R a trade > 0; out-of-sample month t >= 2; Holm p < 0.05; in-sample
  net R a trade > 0 (same sign); out-of-sample net R > 0 at 2x costs; the rule beats at least 38 of the 40 placebos.
- **Verdict = T1.** A pass of T2 or T3 alone is reported as secondary and is not called an edge. Even a T1 pass is one
  study among hundreds run here and would only be a lead for the owner, to be replicated before anyone calls it more.

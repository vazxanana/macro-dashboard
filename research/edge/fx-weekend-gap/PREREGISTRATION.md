# Forex majors' Sunday-open gap: does it fill? Pre-registration

Written and committed **before** `run.mjs` exists and before any candle was read for a result (14 Nov 2026). Everything
below is fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. Nothing here trades, and no live rule, size, filter, stop, config, cost constant or mirror setting
changes, whatever the outcome. A PASS would lead to one written proposal (a paper shadow stream, for the owner); a FAIL to
nothing.

## What this is

The same two rules as `research/edge/gold-weekend-gap` (13 Nov 2026, branch `gold-weekend-gap`, verdict FAIL on gold:
Rule G −0.109R a trade, n 41, t −0.78), copied exactly, with only the **markets** and the **costs** changed. That study's
rules and code are copied into this folder (nothing is imported across branches). It is a stand-alone rule on forex; it
reads no position of the live gold book (owner decision 44 does not apply: no gold, no 2006-17 window).

## Data

OANDA mid M5 candles of six forex pairs, rows `[time, open, high, low, close]` (time = candle start, unix UTC), from
1 Nov 2015 to 12 Nov 2026, kept outside git (one `<pair>-5m.json.gz` per pair, the folder given as `CANDLES`). No fetch.

**Pairs (fixed):** EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CHF, EUR/JPY. Pip = 0.0001, and 0.01 for the two JPY pairs.

## Definitions (New York time with US daylight saving, `council/histdata.mjs` `nyOffsetH`) — copied from gold-weekend-gap

- **Friday close time** `F` = Friday 17:00 New York of each week.
- **Friday's last close** `fc` = the close of the last M5 candle that STARTS before `F`. The week is used only when that
  candle starts on that Friday (New York date) at or after 12:00 New York; otherwise skipped (`skipped.friday`).
- **Reopen** = the first M5 candle starting at or after Sunday 17:00 New York (`F + 48 h` in wall-clock time). Stray prints
  inside the weekend are never used. The week is used only when the reopen candle starts before Sunday 21:00 New York;
  otherwise skipped (`skipped.reopen`).
- **Reopen price** `ro` = the open of the reopen candle. **Gap** = `ro − fc`.
- **ATR** = the simple mean of the true ranges of the last 20 complete 17:00-New-York trading days ending with the day that
  closed at `F` (Sunday-evening candles belong to Monday's day; weekend prints dropped; a day needs at least 12 candles).
  Known at `F`.
- **Eligible week**: `0.25 × ATR ≤ |gap| ≤ 1.5 × ATR`.

## Rules (two, fixed, copied)

- **Rule G (fill)**: at the close of the reopen candle (the first M5 close after the reopen), enter toward Friday's close:
  buy when `fc` is above the entry, sell when below. Target = `fc`. Risk `r0 = |fc − entry|`; stop = `entry − side × r0`
  (1R target, 1R stop). No trade when the reopen candle's close is already at or beyond `fc` (counted) or when
  `r0 < 0.1 × ATR` (counted).
- **Rule H (after the first hour)**: the same eligible weeks; entry at the close of the first M5 candle that ENDS at or
  after one hour after the reopen candle's start, as long as price has not touched `fc` since the reopen (a touch = no
  trade, counted as filled). Target = `fc`; stop the same distance beyond the entry; the same `r0` floor.
- **Exit** (both): on the M5 candles after the entry candle, in order. A candle that opens beyond the stop exits at its
  open; a candle whose range reaches the stop exits at the stop; else one that reaches the target exits at the target.
  **The stop is checked first** when one candle holds both. Otherwise out at the close of the last candle ending at or
  before Monday 12:00 New York (time exit). Every trade has its stop.
- One trade a week per rule per pair; each rule is one stream pooled over the six pairs.

## Costs (the only other change)

`R = side × (exit − entry) / r0`; net R = `R − cost / r0`, with cost in price, a round trip:

- **The measured raw-spread model** (CLAUDE.md "Forex spreads", 12 Nov 2026): quoted spread **0.3 pip** + commission
  **22.5 USD per million a side** = 45 per million round trip = `45e-6 × entry` in price.
- **Plus slippage of 1 pip a side** (2 pips a round trip). Stated: the reopen is the widest-spread minute of the week
  (USD/CAD and USD/CHF quote 2.0 pips at the rollover; the mirror holds market orders 20 minutes after a reopen for this
  reason), so the cheap measured spread does not apply at the entry. **Base cost** = 0.3 pip + 2 pips + commission.
- **Stress cost**: slippage of **2 pips a side** (4 pips a round trip) + 0.3 pip + commission, reported and part of the bar
  (the role gold's $0.60 played).
- **Financing**: none charged. No forex financing rate is measured in the repository (`council/fills.mjs` `FIN` holds gold
  only), and a hold from the Sunday reopen to Monday 12:00 New York crosses no 22:00 UTC Monday-Friday rollover
  (`council/fills.mjs` `nights`, imported, is computed for every trade and reported; a trade with a night is reported).

## Windows

- **Decisive**: weeks whose `F` is in 2020-01-01 to the end of the data (2020 to now).
- **Replication**: weeks whose `F` is in 2016-01-01 to 2019-12-31.

## Statistics and the pass bar

Per rule and window, pooled over the six pairs: n, win rate, mean gross R, mean net R at base and at stress cost, trade t,
**t on calendar-month sums** of base net R (the month of `F`; the pooled trades of all six pairs in a month summed), the
exit mix, worst drawdown (closed, cumulative base net R, trades in time order). Each pair is also reported alone (not in
the bar). One-sided p of each rule's decisive **monthly-sum t** from the normal distribution; Holm over the two rules at the
one-sided level of t = 2 (α = 0.02275: the smaller p ≤ α / 2, the other ≤ α).

**A rule PASSES only if, on the decisive window, pooled over the six pairs, all hold:**

1. mean net R a trade > 0 at base cost, **and** > 0 at stress cost;
2. its monthly-sum t passes Holm over the 2 rules as above (t ≥ 2 after Holm);
3. n ≥ 80;
4. its replication mean net R at base cost is positive on 2016-19.

The study PASSES if at least one rule passes; otherwise FAIL.

## Also reported (not in the bar)

- **The plain fill rate by gap size**, per window, pooled and per pair: the share of weeks in which any candle from the
  reopen candle up to Monday 12:00 New York touches `fc`, by `|gap| / ATR` bin: under 0.25, 0.25-0.5, 0.5-1.0, 1.0-1.5,
  over 1.5; split up / down gaps.
- **How much the reopen spread matters**: gross R, base and stress net R side by side, and the median `r0` in pips.
- **Placebo**: 40 seeded runs (seeds 1-40) on Rule G's own pooled trades (same entry, `r0`, exit time), each trade's
  direction drawn at random: target `entry + side × r0`, stop `entry − side × r0`, same exit order and costs. Reported: the
  placebo distribution of decisive mean base net R and where Rule G sits in it. If a rule passes but its mean does not
  exceed the placebo's 95th percentile, RESULT.md says the pass is not robust.

## Files

`run.mjs` (`CANDLES=<dir> node run.mjs run` → `result.json`), `RESULT.md` (verdict first),
`tests/fx-weekend-gap.test.mjs` (offline: gap detection over the weekend, no look-ahead, stop and target, costs, RESULT.md
against result.json).

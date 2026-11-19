# Pre-registration: the key reversal day and the outside reversal day on spot gold (14 Nov 2026)

Written, committed and pushed alone before any number of this study was computed. Paper research: nothing here is read by
the council, the mirror or the page, and no live rule changes whatever the verdict. Not an ICT study.

**Item 44 (docs/owner-decisions.md) and what this study is not.** This is a NEW stand-alone daily rule on gold, traded both
ways. It is not a gate, an exit, an entry or a size of the gold book (Gold trend / Gold daily engulf), reads none of that book's
trades or signals, and its verdict says nothing about that book. The decisive window is 2017 to the end of October 2026;
2008-16 is the in-sample / replication window (the reading of item 44 used by `gold-ibs`, `gold-shock-revert`, `metals-rsi2`).

## The idea
The classic "key reversal day": a day that makes a new N-day high and then closes below the previous day's close (bearish), or
a new N-day low and closes above the previous day's close (bullish): the market went for the extreme and was refused. The
"outside reversal day": a day whose range takes out BOTH the previous day's high and low and closes in the opposite direction
of the previous close. Question: is the move over the next days in the reversal direction large enough to trade after costs?

## Dedupe (read before writing this)
- `gold-shock-revert` (#850): fade or follow a close-to-close move over 2 x ATR(20). Size of the move, not a new extreme
  refused; FAIL.
- `gold-ibs` (branch): where the close sits in one day's range (IBS < 0.2 long / > 0.8 short): FAIL. A key reversal often
  closes low in its range, so the two overlap in part; the key reversal adds the condition that the day made a new 20-day
  extreme and closed against the previous close. Said here in advance.
- `gold-drd-long` (#763) and its follow-ups: a high-close day in a bullish weekly structure, a continuation buy. Not this.
- `gold-record-high` (branch): long after an all-time closing high (continuation). Not a refusal of a 20-day extreme.
- `gold-week-raid` (branch): previous-WEEK high / low raided and closed back inside, target last week's 50 %: FAIL. A weekly level
  and intraday trigger; here the level is the 20-day extreme and the close comparison is with the previous day.
- `turnaround-*`, `crypto-reversal`, `index-long-reversal`, `fx-reversal`, `fx-weekly-reversal`: other markets, return-based
  reversal (calendar day, N-day return rank); none uses the key reversal or outside day, none on gold.
- **The live Gold daily engulf (`geg`)**: a green daily candle closing above the HIGH of a red base candle within a few days,
  above the 20-day average, LONG only; it places a LIMIT buy at the base candle's high (the zone), stop under the base low,
  2R / trail, up to days to fill. This study's T3 bullish leg (an outside day closing above the previous close) is related in
  spirit (a candle that swallows the previous one) but differs: range engulf (high and low), close only above the previous
  CLOSE, no trend filter, both sides, a market order at the next open, a fixed 3-day hold. Nothing of `geg` is read, gated or
  changed, and this study says nothing about it.
- `untested-backlog` (branch, 14 Nov): lists no key reversal or outside reversal study. `git grep` for "key reversal" /
  "outside day" over research found nothing. So this rule is untested here.

## Data and the day
- OANDA mid H1 XAU_USD through the site's keyless candle proxy (`fetch.mjs`, 2006-03 to the end of the data; cache kept out
  of git; the same source and file as `gold-ibs`). Complete candles only.
- **Days are 17:00 New York trading days** built from H1 with `research/edge/gold-drd-long/run.mjs` `days` / `nyDay`
  (imported, unchanged; weekend hours dropped): gold's daily close is 17:00 New York, and a UTC day carries the Sunday stub.
- ATR(20) at day i = the simple mean of the true ranges of the 20 days ending at day i.

## Signals (on the close of day i; N = 20)
- **Bearish key reversal**: high(i) > the highest high of days i-20 .. i-1, and close(i) < close(i-1).
- **Bullish key reversal**: low(i) < the lowest low of days i-20 .. i-1, and close(i) > close(i-1).
- **Outside reversal**: high(i) > high(i-1) and low(i) < low(i-1); bearish if close(i) < close(i-1), bullish if
  close(i) > close(i-1) (equal close: no signal).

## The trade (every test)
Entry at the open of the first H1 candle of day i+1 (a market order). **Stop beyond the reversal day's extreme**: a short's stop
= high(i) + $0.30, a long's = low(i) - $0.30; if that is less than 0.5 x ATR(20) from the entry, the stop is placed at 0.5 x
ATR(20) from the entry (a floor, so a near-zero risk cannot make R explode); if the entry has already opened beyond the stop
level, the signal is skipped. Stop checked on H1 from the entry candle on: a candle opening through the stop fills at its open,
else at the stop. Otherwise out at the close of day i+3 (three days held). One position at a time per test (a signal while a
trade is open is skipped). 1R = |entry - stop|.

## Three tests, fixed now
- **T1 (primary)**: bearish key reversal -> short.
- **T2**: bullish key reversal -> long.
- **T3**: outside reversal, both sides pooled (short after a bearish one, long after a bullish one).

## Costs (in price, every trade)
- Spread **$0.30** a round trip plus slippage of **half a spread ($0.15) per market order** (entry and exit, the stop exit
  included): **$0.60** a round trip.
- Financing on longs only: `council/fills.mjs` `nights(entryTime, exitTime)` x `FIN.xau.long` (0.000148 of price a rollover,
  the demo broker's XAUUSD swap of 11 Nov 2026) x entry price; today's rate for every year. Shorts pay and earn nothing.
- **2x costs**: spread, slippage and financing all doubled.

## Windows (by entry day)
- **Out of sample (decisive): 2017-01-01 to 2026-10-31.** In sample: 2008-01-01 to 2016-12-31 (2006-07 warm-up only).

## Statistics
- t on calendar-month sums of net R (every month of the window counts, 0 where nothing closed; a trade belongs to its exit
  month); one-sided p from the normal distribution; Holm over the three tests.
- Placebo, 40 seeds (fixed seeded generator): each real out-of-sample trade is replaced by an entry at the open of a random
  trading day of the same calendar year, same side, the same stop distance in ATR units as the real trade (its own |entry -
  stop| / ATR(20)), held three days, same costs; no one-at-a-time rule. The rule's mean net R is compared with the 40 seed means.

## Pass bar (per test; all needed)
1. Out of sample n >= 60.
2. Out of sample mean net R a trade > 0, month-sum t >= 2, Holm-adjusted p < 0.05.
3. In sample mean net R a trade > 0.
4. Out of sample mean net R still > 0 at 2x costs.
5. Above at least 38 of the 40 placebo seed means.

**Verdict**: PASS if T1 passes. If T1 fails the study FAILS whatever T2 / T3 do; a T2 or T3 that passes alone is reported by
name as "passes alone, not an edge until replicated on other data". Reported besides, deciding nothing: gross R, by year, win
rate, stops hit, and the before-cost move in the reversal direction from the next open to the close of days i+1 .. i+5, as a
percentage of price, against the same for every day (the "next 1-5 days" of the question).

## Deliverables
`fetch.mjs`, `run.mjs`, `RESULT.md`, `result.json` in this folder; `tests/gold-key-reversal.test.mjs` (offline, hand-made candles).

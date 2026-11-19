# Pre-registration: the pin bar at a new 20-candle extreme on gold H4 (14 Nov 2026)

Written and pushed alone, before `run.mjs` exists and before any result was seen. Paper research only.

## Question

On spot gold H4, does a pin bar (a rejection candle) that makes a new 20-candle low (or high) predict a reversal, net of
costs, out of sample?

## Status of this rule

A **stand-alone rule**, tested on its own. It is never a gate, exit, entry or size of the live gold book (Gold trend + Gold
daily engulf): CLAUDE.md "Path to live", item 44, forbids testing those on the book's 2006-17 window, and nothing here
reads or changes them. Whatever the verdict, nothing live changes; a pass would only be a candidate for the owner, with a
forward paper record first.

## Dedupe

- `candle-patterns` (branch, 14 Nov): hammer / shooting star etc. on DAILY candles of 28 CFD markets, gold EXCLUDED. Not gold,
  not H4.
- `gold-key-reversal` (branch, 14 Nov): key / outside reversal DAYS on gold, no wick condition. Daily.
- `gold-daily-turtle-soup` (branch, 14 Nov): a false break of a 20-day extreme, daily.
- `mosha-sweep`, `mosha-level`, `ict-*`: sweeps and structure breaks on H1 / M5, no candle-shape rule.
No study in `research/edge/` or on a remote branch tests a pin / hammer rejection candle at a 20-candle extreme on gold H4.

## Data

- OANDA mid H1 XAU/USD from March 2006 (fetched through the site's candle proxy; cache kept out of git), aggregated to H4.
- **H4 boundaries: fixed UTC 22 / 02 / 06 / 10 / 14 / 18** (a candle starting at 22:00 UTC belongs with the next day).
  An H1 candle on Sunday before 22:00 UTC (the summer reopen hour) is put in the Sunday 22:00 candle, so no one-hour Sunday
  stub stands alone. Holidays may leave short candles; they are kept as they are.
- D1 (for T3 only): 22:00 UTC to 22:00 UTC days built from the same H1 candles, Sunday hours with Monday.
- Windows by entry time: warm-up 2006-07; **in sample 2008-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31**.

## The pin bar (all on the CLOSED pin candle; nothing later is read)

Bullish pin, candle i with range R = high − low:
1. lower wick = min(open, close) − low ≥ 2/3 × R;
2. body in the upper third: min(open, close) ≥ low + 2/3 × R (the same bound as 1, stated twice in the question);
3. R ≥ 1 × ATR(14, H4), ATR = the simple mean of the last 14 true ranges ending with candle i;
4. low(i) < the lowest low of the 19 candles before it (a new 20-candle low).
Bearish pin: the mirror (upper wick = high − max(open, close) ≥ 2/3 R, max(open, close) ≤ low + 1/3 R, range ≥ ATR,
high(i) > the highest high of the 19 before).

## The trade

- Entry at the next H4 candle's open, in the reversal direction (long after a bullish pin, short after a bearish one).
- Stop $0.30 beyond the pin's extreme (bull: pin low − 0.30). Every trade has a stop. If the entry open is already at or
  beyond the stop, no trade.
- Target (T1, T3): entry ± 2 × risk. T2: no target.
- Exit at the close of the 12th H4 candle counted from the entry candle (the entry candle is the first) if neither stop nor
  target is hit.
- Managed on H4 candles: a stop gapped through fills at the candle's open; a target gapped through fills at the open (the
  better price); **stop and target in the same candle = the stop**.
- One position at a time per test: the next signal may be the exit candle or later (its entry is after the exit).

## Tests

- **T1 (primary):** both sides, target 2R.
- T2: both sides, no target, time exit only.
- T3: bullish pins only, target 2R, only when the last COMPLETED D1 close at the pin's close is above the simple average of
  the last 100 completed D1 closes.

## Costs

- $0.60 a round trip per trade ($0.30 spread + $0.15 slippage each side), as `gold-key-reversal`.
- Financing on buys only: `nights(entry, exit)` × `FIN.xau.long` (0.000148 of price a rollover, `council/fills.mjs`, the demo
  broker's XAUUSD swap of 11 Nov 2026) × entry / risk. Shorts are charged and credited nothing.
- R = (exit − entry) × side / risk; net = gross − cost − financing; the 2x-cost version doubles both.

## Statistics

- t on calendar-month sums of net R (every month of the window counted, empty months 0; a trade is booked in its exit month).
- One-sided p = 1 − Φ(OOS month t) per test, **Holm over the three tests**.
- **Placebo, 40 seeds** (seed 20261114 + s): candidates = H4 candles at a new 20-candle extreme (same rule 4) with range
  ≥ 1 × ATR(14) and **no wick or body condition**, traded in the reversal direction (T3: new lows only, with the same D1
  filter). For each real OOS trade one candidate of the same side in the same calendar year is drawn at random and traded
  with the same stop, target and exit rules; the draw's mean net R is compared with the test's OOS mean net R.
- 2x costs as above.

## Pass bar (per test; the verdict is T1's)

All of:
1. OOS net R a trade > 0;
2. OOS month t ≥ 2 and Holm-adjusted p < 0.05;
3. in-sample net R a trade > 0 (positive in both halves: 2008-16 and 2017-26);
4. OOS net at 2x costs > 0;
5. OOS mean net beats at least 38 of the 40 placebo draws;
6. OOS n ≥ 30.

T2 or T3 passing alone is reported, never promoted to a verdict on T1's behalf. Whatever the result: not a filter, gate,
exit or size of any council system.

# Pre-registration: the doji after a stretched move, faded, on spot gold daily (14 Nov 2026)

Written and pushed ALONE, before any trade or return of this rule was computed. The only numbers read from the data before
this file: the count of setups (no prices after a setup, no returns), to state the power: 152 setups 2007-16 and 137 from
2017 at the rule below. Paper research only: nothing live changes, nothing of `ict/` or `council/` is edited, and no
proposal follows from a pass.

## Hypothesis

A doji (open and close almost equal inside a full day's range) that ends a stretched five-day move marks a stall: buyers
(after a rise) or sellers (after a fall) could not carry the day, and the move gives back part of itself over the next
days. Fading it (a sell after a stretched rise, a buy after a stretched fall) earns more than gold's own drift: more than the
same-side trade taken on every day, and more than the same-side trade after the same stretch without a doji.

**Not a duplicate.** No study folder, branch, `topics.txt` line or the untested backlog names a doji. Nearest: `gold-key-reversal`
(an outside reversal day), `gold-wick-pressure` (wick share), `gold-ibs` (close location in the range), `gold-capitulation`,
`gold-shock-revert`, `gold-streak`, `gold-three-soldiers`, `gold-heikin-ashi`, `gold-inside-day`: none conditions on the body
being a sliver of the range at the end of a stretched move. Item 44: a new stand-alone rule, not a gate, exit, entry or size of
the live gold book, whose positions are not read.

## Data

Council-data `research/daily/xau.json` (OANDA mid XAU_USD daily candles, UTC days, March 2006 to the last complete day), read
with `git show origin/council-data:…` into a cache kept out of git. Saturday / Sunday candles are folded into the next weekday
with `council/fills.mjs` `foldWeekend` (imported, not edited), so the Sunday stub is never a day. ATR(20) = mean of the 20
daily true ranges ending at a day. Market set: spot gold only, named before any result.

## Rule

1. Day i is a **doji**: range = high − low > 0 and |close − open| <= 0.10 x range.
2. **Stretch**: m = (close of day i − close of day i−5) / ATR(20) of day i−1. m >= +1.0 → a SELL setup; m <= −1.0 → a BUY setup.
3. Entry at the open of day i+1 (market). **Stop = entry ∓ 1.0 x ATR(20) of day i on every trade** (risk = 1 ATR).
4. Exit at the close of day i+3 (three days held). Each held day: from day i+2 on, an open beyond the stop exits at that
   open; otherwise a day whose range reaches the stop exits at the stop (the entry day too, since the entry is its open).
5. One position at a time (a setup whose entry day falls inside an open trade is skipped).

Times for financing: entry = the entry day's start, exit = the exit day's end (a stop exit: the exit day's start + 12 h).

## Costs

$0.60 a round trip on every trade (twice = $1.20), plus financing on buys = `nights(entry, exit)` x `FIN.xau.long` (0.000148 a
night, the demo broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry price, in R of the trade's risk. Sells pay
and earn no financing.

## Tests (Holm over three)

- **T1 (primary)**: both sides, net R a trade.
- **T2 (primary, signal vs drift)**: excess R = the trade's net R minus the mean net R of its CONTROL: the same-side trade
  entered at the open of EVERY eligible day (ATR known) of the same calendar year, same 1-ATR stop, same 3-day hold, same
  costs and financing. Excess at 2x costs uses the control at 2x too.
- **T3 (secondary, the doji vs the stretch alone)**: the same excess, but the control days are only the days of that year
  that follow a stretch the same way (|m| >= 1.0, same sign) and are NOT dojis.

Windows by entry date: in sample 2007-01-01 to 2016-12-31; out of sample (decisive) 2017-01-01 to 2026-10-31. t = mean / SE of
calendar-month sums (every month of the window, 0 when nothing closed). One-sided p from t (normal), Holm over the three OOS p
values. Placebo for T1: 40 seeds (6701-6740); each OOS trade is replaced by the control trade of a random eligible day of the
same year (same side, stop, hold, costs); the seed's mean net R.

**A test passes** when all hold: OOS value > 0; OOS month t >= 2; Holm p <= 0.05; IS value > 0; OOS value at 2x costs > 0; OOS
n >= 30; for T1 also the real OOS mean beats >= 38 of 40 placebo means. **The study passes only when T1 AND T2 pass.** T3
alone is reported, not a pass. A pass is a lead to replicate on other markets or years, never called an edge.

Expected n: about 120-150 trades a window after the one-at-a-time rule.

## Fixed now, never changed after a result

Body share 0.10, stretch 1.0 ATR over five days, ATR(20), the 1-ATR stop, three-day hold, costs, windows, seeds. No re-fit.

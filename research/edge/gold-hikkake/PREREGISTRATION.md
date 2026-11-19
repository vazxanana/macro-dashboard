# Pre-registration: the hikkake (a failed break of an inside day) on spot gold daily (14 Nov 2026)

Written and pushed ALONE, before any trade or return of this rule was computed. The only number read from the data before this
file: the count of setups (no prices after a setup, no returns): 365 setups 2006-16 and 282 from 2017, to state the power.
Paper research only: nothing live changes, nothing of `ict/` or `council/` is edited, and no proposal follows from a pass.

## Hypothesis

An inside day is a pause; when the next day breaks ONE side of it and price then trades back through the OTHER side within a
few days, the traders caught on the first break are trapped and the move runs the other way (the "hikkake", D. Chesler 2004;
cited from memory, not opened here). On spot gold, the stop-order entry back through the inside day earns more than gold's
own drift: more than the same-side trade taken on every day.

**Not a duplicate.** `gold-inside-day` (FAIL, 0 of 3) traded the inside-day BREAKOUT the next day; this trades the failure of
that break, entering only on the far side after the break. `gold-daily-turtle-soup` (FAIL) fades a failed 20-day channel
break; no inside day there. `gold-key-reversal`, `gold-outside-week`, `nr7-breakout`, `gold-inside-week`: other patterns. The
word "hikkake" appears in no study folder, branch or `topics.txt`. Item 44: a new stand-alone rule, not a gate, exit, entry or
size of the live gold book, whose positions are not read.

## Data

OANDA mid H1 XAU_USD through the site's keyless proxy (`fetch.mjs`, March 2006 to the last day on file; cache kept out of git).
Days are 17:00 New York days built by `research/edge/gold-drd-long/run.mjs` `days()` (weekend hours dropped). ATR(20) = mean
of the 20 daily true ranges ending at a day. Market set: spot gold only, named before any result.

## Rule (a buy; a sell mirrors)

1. Day i is an inside day: high < the previous day's high AND low > the previous day's low.
2. Day i+1 breaks ONE side only: low < day i's low and high <= day i's high (buy setup). Mirror for a sell setup.
3. A buy stop at day i's high + $0.30 works from the first H1 candle of day i+2 to the end of day i+4 (three days). It is
   cancelled when an H1 candle trades at or below day i+1's low before the order fills; a candle that reaches both the
   order and that low is cancelled (the order inside the hour is unknown).
4. Fill = the order level, or the candle's open when it gapped through. **Stop = day i+1's low − $0.30 on every trade.**
   The fill candle counts only against the stop (worst case).
5. Exit (T1, T2): the close of the third day after the fill day; a stop gapped through exits at the H1 open. T3 also takes
   a 2R target (stop first when one candle holds both).
6. One position at a time (a setup filling while a trade is open is skipped).

## Costs

$0.60 a round trip on every trade (twice = $1.20), plus financing on buys = `nights(entry, exit)` x `FIN.xau.long`
(0.000148 a night, the demo broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry price, in R of the trade's risk.

## Tests (Holm over three)

- **T1 (primary)**: both sides, net R a trade.
- **T2 (primary, signal vs drift)**: both sides, excess R = the trade's net R minus the mean net R of its CONTROL: the same-side
  trade entered at the first H1 open of every eligible day of the same calendar year, stop at the same multiple of ATR(20)
  (20 days ending the day before), same 3-day hold, same costs and financing. Excess at 2x costs uses the control at 2x too.
- **T3 (variant)**: T1 with a 2R target.

Windows by entry date: in sample 2007-01-01 to 2016-12-31; out of sample (decisive) 2017-01-01 to 2026-10-31. t = mean / SE of
calendar-month sums (every month of the window, 0 when nothing closed). One-sided p from t (normal), Holm over the three OOS
p values. Placebo for T1 and T3: 40 seeds (6301-6340); each OOS trade is replaced by the control trade of a random eligible
day of the same year (same side, stop in ATR, hold, target rule, costs); the seed's mean net R.

**A test passes** when all hold: OOS value > 0; OOS month t >= 2; Holm p <= 0.05; IS value > 0; OOS value at 2x costs > 0;
the real OOS mean beats >= 38 of 40 placebo means (T1, T3); OOS n >= 30. **The study passes only when T1 AND T2 pass.**
T3 passing alone is reported, not a pass. A pass is a lead to replicate elsewhere, never called an edge.

Expected n: about 280-365 setups a window, of which an estimated half fill: about 120-180 trades a window.

## Fixed now, never changed after a result

$0.30 buffer, three waiting days, three-day hold, 2R target (T3), ATR(20), costs, windows, seeds. No re-fit of any of them.

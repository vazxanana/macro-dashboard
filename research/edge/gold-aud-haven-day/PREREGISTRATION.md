# Pre-registration: gold after a "haven day" in Australian-dollar terms (14 Nov 2026)

Written and pushed alone, before any trade result of this rule was computed. Only the number of signal days was counted
(below), to check the pre-registered minimum of 100 events a window; no return, R or t was looked at.

Paper research only, a **stand-alone rule on gold (XAU/USD)**: not a gate, entry, exit or size change of the live gold book,
and none of that book's 2006-17 positions is read (owner decision 44). Nothing live changes. No proposal follows from a pass
without its own owner decision.

## Idea

Gold and the Australian dollar usually move together (both rise when the US dollar weakens or commodity demand grows): their
daily returns are positively correlated, and gold priced in Australian dollars (XAU/AUD = XAU/USD / AUD/USD) is the calmest of
gold's major-currency prices. A day on which gold RISES while the Australian dollar FALLS is a day on which gold's price in
Australian dollars jumps from both legs: gold is being bought for something other than the commodity / weak-dollar trade, the
signature of haven demand. Hypothesis: haven demand persists for a few days, so XAU/USD bought after such a day does better than
XAU/USD bought after an ordinary day of the same year.

Untested here: earlier gold studies used equity shock days (`gold-haven-shock`), the weekly gap to the yen / franc / Treasuries
(`gold-haven-catchup`), a dollar-neutral commodity-currency week (`gold-commodity-fx-lead`), yen surges (`gold-yen-surge`),
20-day extremes in euros (`gold-euro-divergence`) and the six-currency trend (`gold-currency-breadth`). None reads the same-day
sign split between gold and a commodity currency.

## Data (named before any result)

- council-data `research/daily/xau.json` (traded) and `research/daily/audusd.json` (signal only), OANDA mid daily candles,
  UTC days, weekends folded into Monday with `council/fills.mjs` `foldWeekend`; gold and AUD/USD matched on the UTC day.
- No other market. Candles copied with `git show` into a directory outside git and deleted after the run.

## Signal

On each matched day i (closes only, nothing after day i's close):
- rg = ln(gold close i / gold close i-1), ra = ln(AUD/USD close i / AUD/USD close i-1);
- sg, sa = sample standard deviation of the 60 matched daily log returns BEFORE day i (i-60 .. i-1) of gold and AUD/USD;
- **haven day** when rg >= z_g x sg AND ra <= -z_a x sa.

A gap of more than 5 calendar days between matched days restarts the 60-day history.

Counted before pre-registering (signal days only): z_g = z_a = 0.5 gives 115 haven days in 2007-16 and 134 in 2017-26
(85 and 100 non-overlapping 5-day trades); z_g = 1.0, z_a = 0.5 gives 62 and 61.

## Trade

- Buy XAU/USD at the open of the first gold candle after the haven day. Long only (the record of this desk: shorts lose).
- Stop k x ATR(20) below the entry (ATR of the 20 gold candles before the entry candle); this is 1R. A candle opening through
  the stop fills at its open, else a low through the stop fills at the stop. Otherwise out at the close of the hold-th candle
  (entry candle = candle 1).
- One position at a time per test (a signal while a position is open is skipped).
- Costs: $0.60 a round trip, plus financing `nights(entry, exit) x FIN.xau.long x entry` (council/fills.mjs; 0.000148 of price a
  rollover, the demo broker's XAU swap.long of 11 Nov 2026, used for every year). Also reported at 2x costs.

## Tests (three, Holm over all three)

| Test | Haven day | Hold | Stop |
|---|---|---|---|
| T1 (primary) | z_g 0.5, z_a 0.5 | 5 candles | 2 x ATR(20) |
| T2 | z_g 0.5, z_a 0.5 | 10 candles | 3 x ATR(20) |
| T3 | z_g 1.0, z_a 0.5 | 5 candles | 2 x ATR(20) |

## Baseline

The same buy (same hold, same stop, same costs) entered after EVERY matched day of the same calendar year (overlapping);
excess = a trade's net R minus that year's baseline mean. Reported per window with its own month-sum t.

## Windows and statistics

- In sample: signal days 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.
- t on calendar-month sums of net R (month of exit; empty months count 0). One-sided p of the OOS month t (normal), Holm over
  T1-T3.
- Placebo: 40 seeded draws (mulberry32, seeds 1-40) of as many random matched OOS days as the test has signal days, traded the
  same way; reported as how many of the 40 the real OOS month t beats.

## Pass bar (per test; the verdict is about T1)

All of: OOS month t of net R >= 2 and Holm p < 0.05; in-sample net R a trade > 0; OOS net R > 0 at 2x costs; OOS excess over
the year's baseline > 0; the real OOS t beats at least 38 of the 40 placebos; OOS n >= 30.
PASS = T1 passes; PARTIAL = only T2 or T3 passes; FAIL = none. No other threshold, hold, stop or market is tried after the
result; a different reading needs its own pre-registration on other data.

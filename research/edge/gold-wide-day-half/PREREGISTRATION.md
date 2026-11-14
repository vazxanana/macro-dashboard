# Pre-registration: a limit at the midpoint of a wide gold day, traded with that day's direction (14 Nov 2026)

Written and pushed ALONE before any trade was simulated. Only signal and fill COUNTS were looked at (to check the 100-a-window
minimum below); no return, R or win figure was computed. Nothing below changes after the run.

**Item 44**: a new stand-alone daily rule, judged on 2017-26. It is not a gate, exit, entry or size of the live gold book
(Gold trend / Gold daily engulf), is never read as one and says nothing about it; none of the book's 2006-17 positions is read.
Paper research only: nothing live changes, and a PASS would only be written up as a proposal for the owner (absolute rule 3).

## Question
After a wide daily candle that closes near its end (a strong one-way day), gold often pulls back the next days. Is a resting
limit at the MIDPOINT of that wide day (half of its range), traded in the wide day's direction, a continuation that pays after
costs, beyond what the same-side trade earns on any day of the same year?

## Dedupe
- `gold-range-expansion` (branch, 14 Nov, FAIL): a wide day (>= 1.75 x ATR(20), close in the outer quarter) traded WITH its
  close at the next day's OPEN (market). Never tested: waiting for a pullback to half of the wide day and entering there.
- `gold-ote-retrace` (FAIL): a limit at the 0.705 retracement of an H1 structure leg (intraday, ICT legs), not a daily candle.
- `gold-measured-move`, `gold-capitulation`, `gold-day-range-used`, `gold-liquidation-day`, `gold-key-reversal`,
  `gold-daily-engulf` (the live engulf: zone at a body-engulf candle, not a range-width rule): different events.
- No remote branch or topics line has "half", "midpoint" or "wide-day"; the 14 Nov untested backlog does not list it.

## Data (one market, fixed now: spot gold only)
OANDA mid daily XAU_USD, council-data `research/daily/xau.json`, read with `git show origin/council-data:research/daily/xau.json`
(no network; the copy is kept out of git and deleted after the run). Complete UTC days; Saturday / Sunday candles folded into the
next weekday with `council/fills.mjs` `foldWeekend`.

## Rule (all known at the close of the wide day; nothing later is read to make the signal)
- ATR(14) at day i = mean true range of days i-13 .. i. A WIDE UP day i: range(i) = high - low >= 1.25 x ATR(14) at day i-1
  (the 14 days BEFORE it), and the close in the top third of its range ((close - low) / range >= 2/3). A WIDE DOWN day: the
  same range test, close in the bottom third (<= 1/3).
- Order: a limit at mid = (high(i) + low(i)) / 2, live on days i+1 .. i+3 (three days). BUY limit after a wide up day, SELL
  limit after a wide down day. Filled on the first of those days whose low (buy) / high (sell) reaches mid; if that day OPENS
  beyond mid on the filling side (buy: open <= mid), the fill is at the open. Not filled in three days = no trade.
- Stop 1.5 x ATR(14) at day i from the fill price on the losing side. On the fill day the stop counts if that day's low (buy) /
  high (sell) reaches it (worst case: the fill comes first). On later days a gap through the stop fills at that day's open.
- Exit at the close of the 5th day held (the fill day is day 1) or the stop. One position at a time per test: a wide day whose
  close falls on or before the exit day of the open trade is skipped; while a limit is waiting, a newer wide day is skipped
  until the waiting limit fills or expires.
- **T1 (primary)**: BUY the midpoint after a wide UP day, hold 5 days.
- **T2**: SELL the midpoint after a wide DOWN day, hold 5 days.
- **T3**: both, one position at a time over the pooled wide days (side = the wide day's direction), hold 5 days.

Counts seen before writing this (signals and fills only): wide up days with a fill 143 in sample / 144 out of sample, wide down
days 165 / 137, before the one-at-a-time rule. The one-at-a-time rule may take some away; the run reports the counts.

## Baseline (same side, same year)
For each side, the same trade (same stop and 5-day hold) entered at the OPEN of every eligible day (every day with ATR
history), one position at a time; its net R a trade per calendar year. A test's excess per trade = the trade's net R minus the
baseline's net R a trade of the same side in the trade's entry year. Excess t = month-sum t of the excess (below). T3 uses each
trade's own side baseline.

## Costs
$0.60 a round trip on every trade (a limit entry is charged as a market one, on purpose). Buys pay financing:
`council/fills.mjs` `nights(fill, exit)` x `FIN.xau.long` (0.000148 of price a 22:00 UTC rollover, Wednesday three; the demo
broker's XAUUSD swap of 11 Nov 2026, the source named in fills.mjs) x fill price / risk. Sells pay and earn nothing. Today's
rate for every year. 2x costs = both doubled. Fill time for the financing count: noon UTC of the fill day.

## Windows
In sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31 (by fill date). OOS halves: 2017-2021 and
2022-2026-10.

## Statistics
t = mean / standard error of CALENDAR-MONTH sums of net R (every month of the window counts, 0 when nothing closed; by fill
month). One-sided p from that t (normal), Holm over the three tests.
Placebo (does the wide-day midpoint beat a random day?): 40 seeds (1..40); each draws, per test, as many OOS entry days as the
test had trades, at random from the eligible OOS days, and trades them at that day's OPEN with the test's side (T3: the sides
in the test's own proportion, drawn at random), stop and hold, one at a time; the statistic is OOS net R a trade.

## Pass bar (per test; the study passes if any test passes)
1. OOS net R a trade > 0;
2. OOS month t >= 2 AND Holm-adjusted one-sided p <= 0.0228;
3. net R a trade > 0 in sample (same sign) AND in both OOS halves;
4. OOS net R a trade > 0 at 2x costs;
5. OOS excess over the same-side same-year baseline > 0 with excess month t >= 2;
6. OOS net R a trade above at least 38 of the 40 placebo draws.

Also reported, not part of the bar: gross figures, fill rate, exits by kind, years, the number of wide days.

Files: `run.mjs`, `result.json`, `RESULT.md`; tests `tests/gold-wide-day-half.test.mjs`.

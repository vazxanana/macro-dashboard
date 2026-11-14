# Pre-registration: gold's daily Heikin-Ashi colour flip after a run, both sides (14 Nov 2026)

Written and pushed ALONE before any result was computed. Nothing below changes after the run.

**Item 44**: a new stand-alone daily rule, judged on 2017-26. It is not a gate, exit, entry or size of the live gold book
(Gold trend / Gold daily engulf), reads none of its 2006-17 positions, is never read as one and says nothing about it. Paper
research only: nothing live changes, and a PASS would only be written up as a proposal for the owner (absolute rule 3).

## Dedupe
No committed or branch study builds Heikin-Ashi candles. Closest, read first: `gold-streak` (runs of raw closes, 1-3 day holds,
FAIL), `gold-ichimoku` (cloud / TK cross, FAIL), `gold-tsmom`, `gold-weekly-momentum` (return-sign momentum), `gold-macd`,
`gold-h4-supertrend`, `gold-adx-trend` (other trend filters). A Heikin-Ashi candle is a smoothed open / close pair; its colour
run and flip is neither a raw-close streak nor a moving-average cross. No remote branch has "heikin" or "ashi" in its name, the
14 Nov untested backlog does not list it, and the scratchpad topic list had no such slug when it was claimed.

## Data (one market, fixed now: spot gold only)
OANDA mid daily XAU_USD, council-data `research/daily/xau.json`, read with `git show origin/council-data:research/daily/xau.json`
(no network; the copy is kept out of git). Complete UTC days; Saturday / Sunday candles folded into the next weekday with
`council/fills.mjs` `foldWeekend`.

## Heikin-Ashi candles (known at the close of each day)
haClose(i) = (open + high + low + close) / 4 of day i; haOpen(0) = (open + close) / 2 of the first day, then
haOpen(i) = (haOpen(i-1) + haClose(i-1)) / 2. Colour(i) = green when haClose > haOpen, red when below, none when equal (a
"none" day ends a run and is not a flip). Run(i) = the number of days in a row ending at i with the same colour.

## Rule
- **Flip day i**: colour(i) is green or red, colour(i-1) is the other colour, and the run of colour(i-1) ending at day i-1 is at
  least K days long.
- Side = the new colour (green -> BUY, red -> SELL): follow the flip.
- Entry at the open of day i+1 (market). Stop 2 x ATR(14) from the entry on the losing side, ATR(14) = mean true range of days
  i-13 .. i. The stop is never moved.
- Exit (T1, T2): at the open of the day after the first day whose Heikin-Ashi colour is AGAINST the trade (red for a buy, green
  for a sell), or after the close of the 20th day held (time exit at that close), or the stop (checked on the daily high / low;
  a gap through it on a later day fills at that day's open). The stop is checked first on any day.
- Exit (T3): stop or the close of the 10th day held; no colour exit.
- One position at a time per test (a flip while a trade of that test is open is skipped).
- **T1 (primary)**: K = 3, both sides, colour exit.
- **T2**: K = 5, both sides, colour exit.
- **T3**: K = 3, both sides, fixed 10-day hold.
- Baselines (comparison, not tests): unconditional same-side trades: BUY at every day's open, and SELL at every day's open,
  same 2 x ATR stop, 10-day hold, one at a time. Reported beside T1-T3, not part of the bar.

## Costs, and the cost share of R (stated before the run)
$0.60 a round trip ($0.30 spread + $0.15 slippage on each of the two market orders), as gold-streak / gold-ichimoku. Buys pay
financing: `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a 22:00 UTC rollover, Wednesday three;
the demo broker's XAUUSD swap of 11 Nov 2026) x entry / risk. Sells pay and earn nothing. Today's rate for every year.
2x costs = both the round trip and the financing doubled.
Expected size: gold's daily ATR(14) was roughly $12-60 over 2007-26, so the 2 x ATR stop is about $25-120 (median expected
well over $10). The round trip is then about 0.01-0.03R a trade; financing on a buy held about a week costs about 0.04-0.06R
(0.000148 x price x nights / risk). Total cost share expected at about 0.03-0.05R a trade averaged over buys and sells, measured
and reported per test.

## Windows
In sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31 (by entry date). OOS halves: 2017-2021 and
2022-2026-10 (reported).

## Statistics
t = mean / standard error of CALENDAR-MONTH sums of net R (every month of the window counts, 0 when nothing closed). One-sided
p from that t (normal), Holm over the three tests (T1-T3).
Placebo: 40 seeds (1..40); each keeps a test's own OOS entry days and draws the side of every trade at random (buy or sell,
50/50, financing on the buys), with the test's own stop and exit rule; the statistic is OOS net R a trade.

## Pass bar (the verdict is the primary test T1's; T2 and T3 are reported with their own checks)
1. T1 OOS net R a trade > 0;
2. T1 OOS month t >= 2 AND Holm-adjusted one-sided p <= 0.0228 (the p of t = 2);
3. T1 net R a trade > 0 in sample (same sign);
4. T1 OOS net R a trade > 0 at 2x costs;
5. T1 OOS net R a trade above at least 38 of the 40 placebo draws.

Also reported, not part of the bar: gross figures, both OOS halves, the baselines, the OOS difference of each test's buys and
sells to the same-side baseline (Welch t on trades), exits by kind, median stop in dollars, years.

Files: `run.mjs`, `result.json`, `RESULT.md`; tests `tests/gold-heikin-ashi.test.mjs`.

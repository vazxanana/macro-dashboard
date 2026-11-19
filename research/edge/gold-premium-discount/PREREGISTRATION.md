# Pre-registration: premium / discount of the 20-day dealing range on gold (14 Nov 2026)

Written and pushed ALONE before any result was computed. Nothing below changes after the run.

**Item 44**: a new stand-alone daily rule, judged on 2017-26. It is not a gate, exit, entry or size of the live gold book
(Gold trend / Gold daily engulf), is never read as one and says nothing about it. Paper research only: nothing live changes,
and a PASS would only be written up as a proposal for the owner (absolute rule 3).

## The idea, in our own words
The ICT skill's dealing range: inside a range, buy only in its lower half (discount) and sell only in its upper half (premium);
the middle (equilibrium) is where price is drawn back to. Question: on gold, is the place of the close inside the last 20
trading days' range a usable directional signal? Do buys in the lowest quarter and sells in the highest quarter beat buys and
sells taken anywhere?

## Dedupe
No committed or branch study tests buying the bottom quarter / selling the top quarter of a 20-day range on gold as a
stand-alone rule. Read first: `ict-concepts` (premium / discount half of the last 20 daily candles used only as a FILTER on
H1 turtle-soup and gap entries, never alone; FAIL), `gold-ibs` (close inside ONE day's range, FAIL), `gold-shock-revert` (one
day's move over 2 x ATR, FAIL), `gold-streak` (closes in a row, FAIL), `gold-key-reversal` (20-day extreme + reversal candle,
FAIL), `gold-daily-turtle-soup` (a failed break of the 20-day extreme, FAIL), `rsi2-*` (2-day RSI on index CFDs and metals),
`gold-drd-long` (a weekly-bull daily rejection candle). No remote branch has "premium" (other than `announcement-premium` and
`volume-premium`, unrelated), "discount", "dealing" or "range-position" in its name; the 14 Nov untested backlog does not list it.

## Data (one market, fixed now: spot gold only)
OANDA mid daily XAU_USD, council-data `research/daily/xau.json`, read with `git show origin/council-data:research/daily/xau.json`
(no network; the copy is kept out of git). Complete UTC days; Saturday / Sunday candles folded into the next weekday with
`council/fills.mjs` `foldWeekend`.

## Rule (all known at the close of signal day i)
- high20 / low20 = the highest high / lowest low of the 20 trading days i-19 .. i (today included).
- position = (close_i - low20) / (high20 - low20); equilibrium mid = (high20 + low20) / 2, fixed at the signal.
- ATR(14) at day i = mean true range of days i-13 .. i.
- Entry at the open of day i+1 (market). Stop 1.5 x ATR(14) from the entry on the losing side. Target = mid when it lies on the
  winning side of the entry (a buy whose entry open is already at or above mid has no target and exits by stop or time; this is
  the same exit code the baseline uses). Out at the close of the 10th day held (day i+10) if neither is hit.
- Checked on daily high / low from the entry day on. A later day opening through the stop fills at its open; a later day
  opening through the target fills at its open. **If stop and target are both inside one day, the stop is counted.**
- One position at a time per test (a signal while a trade of that test is open is skipped).
- **T1**: position < 0.25 -> BUY.
- **T2**: position > 0.75 -> SELL (mirror: stop above, target = mid below).
- **T3**: T1, only when close_i > the mean of the 100 closes i-99 .. i.
- Baselines (comparison, not tests): BUY every day, and SELL every day, with the same exit code (stop, mid target when on the
  winning side, 10 days), one at a time.

## Costs
$0.60 a round trip ($0.30 spread + $0.15 slippage on each of the two market orders), as gold-ibs / gold-streak. Buys pay
financing: `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a 22:00 UTC rollover, Wednesday three;
the demo broker's XAUUSD swap of 11 Nov 2026) x entry / risk. Sells pay and earn nothing. Today's rate for every year.
2x costs = both the round trip and the financing doubled.

## Windows
In sample 2008-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31 (by entry date). OOS halves: 2017-2021 and
2022-2026-10.

## Statistics
t = mean / standard error of CALENDAR-MONTH sums of net R (every month of the window counts, 0 when nothing closed). One-sided
p from that t (normal), Holm over the three tests (T1-T3).
Placebo: 40 seeds (1..40). Each draws random OOS entry days at the test's own OOS frequency (signal days / eligible days; for
T3 the eligible days are the OOS days with close above the 100-day mean, for T1 / T2 every OOS day), same side, same exit code
(stop, that day's mid as target when on the winning side, 10 days), one at a time. The statistic is OOS net R a trade.

## Pass bar (per test; the study passes if any test passes)
1. OOS net R a trade > 0, with OOS n >= 30;
2. OOS month t >= 2 AND Holm-adjusted one-sided p <= 0.0228 (the p of t = 2);
3. net R a trade > 0 in sample AND in both OOS halves;
4. OOS net R a trade > 0 at 2x costs;
5. OOS net R a trade above at least 38 of the 40 placebo draws.

Also reported, not part of the bar: gross figures, the baselines, the OOS difference of each test to its baseline (Welch t on
trades), exits by kind, years.

Files: `run.mjs`, `result.json`, `RESULT.md`; tests `tests/gold-premium-discount.test.mjs`.

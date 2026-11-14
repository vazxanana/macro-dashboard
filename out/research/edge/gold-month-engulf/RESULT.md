# Result: gold's outside (engulfing) month, held through the next month (14 Nov 2026)

**Verdict: FAIL, 0 of 3: following an outside month made +0.208R a trade net in 2017-26 but on 10 trades (month t 0.59) and -0.097R in 2007-16 (n 9).**

Pre-registered in PREREGISTRATION.md (pushed alone first, commit 07c277e38). The test ran once; nothing in the rule, costs or bar
was changed after the result. Paper research only: no live rule, size, filter, stop, config, cost constant or council member
changed, and no proposal follows. **Item 44**: a new stand-alone monthly rule judged on 2017-26; it is not a gate, exit, entry or
size of the gold book (Gold trend / Gold daily engulf), reads none of its positions and says nothing about it.

## Data and rule
OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (`git show`, no network), 2006-03-20 to 2026-11-06, weekend
candles folded into the next weekday (`council/fills.mjs` `foldWeekend`): 5,364 trading days, 248 complete calendar months
(April 2006 to October 2026; the forming November 2026 is dropped). Outside month = its high above the previous month's high
and its low below the previous month's low; bullish if it closed up, bearish if down. Body-engulfing month (T3) = the previous
month's body has the other colour and this month's body covers it. Entry at the first open of the next month, stop 3 x ATR(20)
(the 20 daily true ranges ending on the signal month's last day), gap fills at the open, out at the next month's last close.
Costs: $0.60 a round trip and `FIN.xau.long` financing on buys (`nights` x 0.000148 of price); sells pay nothing. t =
calendar-month sums of net R (every month of the window counts, 0 when nothing was held), one-sided normal p, Holm over three.

## Tests (R a trade; IS 2007-01 to 2016-12, OOS 2017-01 to 2026-10, by entry month)
| Test | IS n | IS gross | IS net | IS month t | OOS n | OOS gross | OOS net | OOS month t (gross) | OOS month t (net) | Holm p | OOS 2x costs | OOS 2017-21 | OOS 2022-26 | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 outside month, follow both sides (primary) | 9 | -0.028 | -0.097 | -0.22 | 10 | +0.272 | +0.208 | 0.73 | 0.59 | 0.555 | +0.144 | +0.232 | +0.183 | no |
| T2 bullish outside buys, excess over buying every month | 5 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 0 | 0.555 | 0 | 0 | 0 | no |
| T3 body-engulfing month, follow both sides | 15 | +0.478 | +0.425 | 1.16 | 17 | +0.705 | +0.627 | 1.99 | 1.88 | 0.091 | +0.549 | +0.722 | +0.560 | no |

Pass bar (primary T1 must pass): OOS net > 0 (yes), OOS month t >= 2 with Holm p <= 0.0228 (no: t 0.59), IS and both OOS halves
> 0 (no: IS -0.097), OOS > 0 at 2x costs (yes), above 38 of 40 placebo draws (no: 26 of 40).

**Placebo (T1)**: the same 10 OOS entry months with the side drawn at random, 40 seeds: median +0.077R a trade, best +0.803R;
the real +0.208R beats 26 of 40. Gold rose in most of these months, so a random buy-heavy draw does as well.

**Baseline** (buy every month, same stop, hold and costs): IS n 120, +0.054R net (month t 0.56); OOS n 118, +0.238R gross
(month t 2.25: gold's rise), +0.128R net (month t 1.23).

## T2 was degenerate as written (said plainly)
The pre-registration defined T2 as each signal month's buy MINUS the baseline's buy in the same month. The baseline's buy of
that month is the very same trade (same open, same 3 x ATR stop, same exit), so the difference is exactly 0 in every month: the
test could never measure anything. It is reported as written (t 0, p 0.5, inside the Holm family) and the verdict does not
depend on it. The comparison it was meant to make, added after the result and **outside the bar** (`t2PostHoc`): bullish
outside-month buys against the mean of every month's buy, Welch t on trades: IS n 5, +0.206R against +0.054R (t 0.19); OOS
n 4, +1.225R against +0.128R (t 2.32). Four trades; not evidence of anything.

## Costs and stops (OOS)
Median stop $75.67 (T1), $74.71 (T3); $59.99 and $46.69 in sample. The round trip is about 0.01R a trade; financing on buys is
the cost that matters: 0.056R a T1 trade on average (0.562R of the 0.641R T1 paid in all, about 0.14R on each of the 4 OOS buys), as
stated in the pre-registration. Exits OOS: T1 3 stops, 7 at the month's close; T3 2 stops, 15 at the close.

## Reading
Outside months are rare on gold: 19 traded in twenty years (9 buys), so no t on this rule can reach 2 in either window. The
primary lost in sample and does not beat a random side out of sample. T3 (body engulfing, n 32) was positive in both windows
(+0.425R and +0.627R net) and is the closest of the three, but its OOS month t is 1.88 with Holm p 0.09, its buys ride gold's
2017-26 rise (the every-month baseline made +0.238R gross OOS) and it had no placebo by design; it is a description, not an
edge. A follow-up on T3 would need its own pre-registration and a market or window it was not seen on (for example silver, or
gold before 2007 on another feed). Not an edge; nothing live changed.

To repeat: `node research/edge/gold-month-engulf/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`… full <dir>`. Test: `tests/gold-month-engulf.test.mjs`.

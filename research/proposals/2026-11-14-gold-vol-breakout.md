# The gold volatility breakout: what it is, what the evidence says, and three choices (14 Nov 2026)

**Open: waiting on the owner.** Paper research for the owner, after "keep improving dont stop reach our goal". Nothing here
changes a live rule, a size, a filter, a stop, `config.json`, any council member, the cTrader mirror or any code that keeps
the desk on paper and demo accounts. Nothing here recommends real money (absolute rule 2; the 12 Nov answer to item 46
keeps the desk on paper and demo until at least November 2027). No study was run for this document: every figure is copied
from a committed study, named with its branch and pull request. **All twelve pull requests are still open** (not on
`main`): if one of them changes before it is merged, this page follows it, not the other way round.

## In plain words

1. **One gold rule replicated.** Of the 44 gold studies of 13-14 Nov, this intraday breakout is the only rule that is
   positive before costs with a t of 2 or more in both of its windows (`gold-cost-synthesis`, PR #1062). Written on
   2016-26, it then passed on 2007-15, years its author never read: **+0.111R a trade after costs, n 1,657, month t 3.19**
   (PR #1049). It passed on a second price feed and on gold priced in euros.
2. **The margin over costs is thin.** Before costs it makes +0.155R a trade over 2007-26; the studies' cost of $0.60 a
   round trip takes about half of that (pooled +0.073R, t 3.35). At $1.20 it loses. Whether it is worth anything turns
   on what a round trip really costs, and that has been measured on one day of demo quotes only.
3. **Its recent record is weak.** 2017-26 (out of sample for the risk reading): +0.044R a trade, month t 1.49. 2015-2024
   together: +3.25R on 1,883 trades, about nothing. Most of the profit is 2007-14, 2020 and 2025-26. The longest stretch
   under water lasted **4.4 years** (June 2016 to November 2020), the worst drawdown **−42.9R**.
4. **Where the day is cut matters.** With the day starting at 17:00 New York instead of 00:00 UTC, the same rule keeps
   its gross effect but nets only +0.019R a trade (t 0.91). A result that leans on a clock boundary is fragile.
5. **A forward record cannot prove it in any time you would wait.** At the measured mean it needs about 1,460 trades,
   **7.8 years**, before a t of 2. What one to three years of paper or demo CAN show is whether every copy carries its stop,
   whether orders fill near the levels, and above all **what a round trip really costs at 00:00-07:00 UTC**, where two
   thirds of the gross comes from and where spreads are widest.

## 1. The rule, in one paragraph

Each UTC weekday, take the open of the first five-minute candle after 00:00 UTC (O) and the high-to-low range of the
previous day (UTC days, the weekend folded into Monday as `council/fills.mjs` `foldWeekend` does). Place a buy stop at
O + 0.5 × that range and a sell stop at O − 0.5 × that range, live from 00:00 to 20:55 UTC; the first one filled is the
trade and the other is cancelled. **The stop of the trade is O itself** (so 1R = 0.5 × the previous day's range; median
$8.57 over 2007-26, $13.49 over 2021-26), on the losing side by construction. No target: the trade is closed at the
close of the 20:55 candle (21:00 UTC), before the 22:00 UTC rollover, so it never pays financing. At most one trade a day,
about 188 a year. Every trade has a stop at entry (absolute rule 1). Spot XAU/USD only; the tested setting stays k 0.5,
exit 21:00, day from 00:00 UTC (PR #1060 chose nothing new).

## 2. What the evidence shows

Costs are the studies' $0.60 a round trip per ounce unless said. "t" is on calendar-month sums.

| Study (branch, PR) | Question | Result |
|---|---|---|
| `gold-vol-breakout` #1046 | the original find, 2016-20 in sample, 2021-26 out | **FAIL, near miss.** 2021-26: +0.072R, n 1,121, t 1.86 (gross +0.121R, t 3.21); 2016-20: +0.009R, n 935, t 0.22 (gross t 2.87). Beat 40 of 40 placebos. Holm p 0.094 |
| `gold-vol-breakout-replicate` #1049 | the same rule, untouched 2007-15 | **PASS.** +0.111R, n 1,657, t 3.19 (gross +0.203R, t 5.96); 2007-11 +0.120R (n 929), 2012-15 +0.100R (n 728); 40 of 40 placebos; at 2x costs +0.018R. Pooled 2007-26: +0.073R, n 3,713, t 3.35 (2x costs −0.009R). Without 2013 (its best year): +0.093R, t 2.67 |
| `gold-vol-breakout-histdata` #1057 | is it an OANDA artifact? (HistData M1, 2018-26) | **PASS, not an artifact.** HistData +0.042R, n 1,603, gross t 4.21; same side as OANDA on 1,588 of 1,593 common days (99.7 %), daily R correlation 0.91 |
| `gold-eur-vol-breakout` #1068 | gold priced in euros, 2006-26 | **PASS**, +0.067R, n 3,873, t 3.50; but same side as XAU/USD on 86.5 % of days: the same effect without the dollar, **not a second, independent one** |
| `gold-vol-breakout-k` #1060 | is k 0.5 a lucky peak? | **BROAD**: net positive at 7 of 8 k values (0.2-1.0), gross t 6.4-7.2 at k 0.3-0.7. But at 2x costs every k is about zero, 2016-20 is weak at every k, and **the 17:00 New York day nets +0.019R (n 3,549, t 0.91)** |
| `gold-vol-breakout-costs` #1056 | what it earns at realistic costs | **Accounting, no test.** Break-even at **$1.14** a round trip; month t stays ≥ 2 only under **$0.81** (by window: 2007-11 $0.81, 2012-15 $0.48, 2016-20 **$0.19**, 2021-26 $0.54). Measured demo cost: about **$0.17** ($0.07 median spread + commission, 0.42 bp of price; one day of quotes, 12-13 Nov, no slippage measured) → pooled +0.147R, t 6.85. Pessimistic era spreads + slippage → +0.036R, t 1.64 |
| `gold-vol-breakout-risk` #1058 | what to expect, and stop lines | **Descriptive.** 2007-26: +0.072R, n 3,706, t 3.30; 2007-16 +0.101R (t 3.14); **2017-26 +0.044R (t 1.49)**. Worst drawdown −42.9R, under water 4.36 years; worst year 2018 −18.2R. 12-month band −14.9 to +44.3R (median +13.1R; a losing year 23 % of the time). Correlation with gold's same-day return −0.06 |
| `gold-cost-synthesis` #1062 | across all 44 gold studies | **Descriptive.** The only tests with gross t ≥ 2 in both windows are this rule's T1 and T2 (2 of 106) |

**What failed around it** (each fixed in advance, each a fail): the same idea on gold's week, `gold-weekly-vol-breakout`
#1059 (2017-26 +0.054R, n 396, t 0.92); on stock indices, `index-vol-breakout` #1061 (NAS100 −0.004R, n 2,040; SPX500
−0.036R, n 2,015); on silver, `silver-vol-breakout` #1051 (−0.084R, n 2,015, t −3.04: positive before costs, gross t 3.37,
eaten by costs); a filter on the H4 side, `gold-vol-breakout-h4-side` #1067 (did not beat the plain rule in the second half
or the placebo). So it is **not a general breakout effect**: it is a property of gold's own daily path, and nothing found
so far improves it. `gold-vol-breakout-reverse` has a pre-registration on its branch and no result yet.

### What the evidence does not show

- **That it is an edge at real costs.** Every pooled figure above that clears t 2 uses $0.60 or less a round trip. The
  only cost measured is one day of demo quotes across all hours; the hours that carry the profit were not measured apart.
- **That it still works.** 2016-20 is flat (+0.009R) and 2017-26 is t 1.49; the recent strength is 2025-26, gold's widest
  daily ranges. The 2007-15 pass says the rule leans the right way on gold, not that today's gold pays it.
- **That the day cut is a property of gold rather than of a clock.** 00:00 UTC works, 17:00 New York mostly does not;
  no study explains why, and no other cut can be tried now without its own pre-registration on data nobody has read.
- **That the gain comes from big days.** It comes from days after a narrower-than-usual range (2007-15: +0.199R on 975
  such days against −0.015R on 682 wide ones; descriptive, PR #1049).

## 3. Where the profit comes from, and why that is the thing to measure

| Fill in (UTC, 2007-26, PR #1056) | n | Share | Gross R a trade | Net R, measured demo cost | Net R, pessimistic + slippage |
|---|---|---|---|---|---|
| Asia (to 07:00) | 985 | 26.5 % | +0.383 | +0.373 | +0.240 |
| London (07:00-12:00) | 1,066 | 28.7 % | +0.113 | +0.105 | −0.007 |
| New York (12:00-21:00) | 1,662 | 44.8 % | +0.047 | +0.041 | −0.057 |

Asia fills are a quarter of the trades and about two thirds of the gross R (985 × 0.383 ≈ 377R of about 575R). Asia is
also where gold's spread is widest and where a stop order is most likely to fill worse than its level. **No study charged
Asia hours a separate cost.** That one number decides whether the rule is worth anything, and only a demo account can
give it.

## 4. The choice for you

Three options. None of them is a live or real-money step, and none is recommended over the others here: the evidence does
not settle it. **Nothing is built until you choose, and building the chosen option is a separate change you approve**
(absolute rule 3). Nothing in any option costs money: it is build work on the existing Vercel plan and free GitHub minutes,
and a demo account is free (absolute rule 5).

| | (a) Paper shadow only | (b) Paper + its own demo account | (c) Do nothing |
|---|---|---|---|
| What runs | the Trader records the rule as a paper shadow stream on gold (like the LIT and Mosha shadows: `shadow: true`, never alerted, no futures ticket, not in the main systems, not in the live book of item 43) | (a), plus the cTrader DEMO mirror copies it to a demo account of its own (a new book), never the Council account | nothing; the studies stay as they are |
| Build work | one pure module + its Trader block + tests; a forward reading against the risk study's bands and stop lines (read from its `result.json`, never typed in) | (a) + a new mirror book, a demo account you create in the broker's app and map in `mirrorAccounts`, the E-checks below, and a per-hour split of the quote log | none |
| What it measures | whether the live candles reproduce the backtest's fills and days; a forward record against the band | the same, plus what the backtest cannot: a stop on every copy, the copy rate, fill slip against paper, and **the real all-in round trip at 00:00-07:00 UTC** | nothing new |
| What it cannot tell you | the cost (paper fills at the level by assumption) | whether there is an edge (that needs about 7.8 years) | anything |

### Things you should know about (b) before choosing

- **The mirror has no resting stop order today.** It places limit and market orders only. A stop entry would be copied as
  a market order a minute or so after the paper fill (the late-copy check of 1R still applies), so the measured slip is
  that of a market copy, a little worse than a resting stop order would get. Adding a stop-order type to the mirror is
  more build work and would be its own approval.
- **Paper R and the bands use different costs.** The Trader charges its own measured cost model (`fills.mjs`); the risk
  study's bands are drawn at $0.60 a round trip. The reading would report both and judge the stop lines on the $0.60
  basis, as the bands were drawn.
- **Size.** The broker's minimum is 1 ounce: at a median stop of $13.49 (2021-26) a unit risks about $13.50, small enough
  for any demo balance. Demo only; the mirror's demo locks and the bridges' `DemoOnly()` stay as they are.
- **Rule 1 holds end to end.** The paper trade has its stop at O from the fill; the mirror's existing guard sets the stop
  on every copy or closes it at once (section "Mirror stop safety").

### Execution checks proposed for (b), in the style of item 43's E1-E5

Read on the first 30 demo copies; before that, "Counting". Thresholds below are a proposal, fixed by you before anything
runs, never after.

| Check | What it reads | Proposed fail |
|---|---|---|
| E1 stop on every copy | every copy has its stop at the broker, set at the fill (not by the guard later) | any copy without one |
| E2 copy rate | copies made / paper fills, each miss with its reason | under 28 of 30 |
| E3 fill slip | demo fill against the paper fill, in R and in $ | mean over 0.05R worse |
| E4 real round trip | spread + commission + slip on entry and exit, in $ an ounce, split Asia / London / New York | mean over **$0.81** (the line under which the 2007-26 month t stays at 2); reported against the $0.60 assumed |
| E5 nothing foreign | no position or order on that account the mirror did not place | any |

E4 is the point of option (b). If the real round trip comes in under $0.60, the backtest's figures stand as charged; between
$0.60 and $0.81 they shrink but the pooled t holds; over $0.81 the 2007-26 record is under t 2; over $1.14 the rule loses
before anything else is said.

### Stop lines, pre-committed (PR #1058; for (a) and (b) alike)

Drawn from the 2007-26 record before any forward trade exists. A crossed line sends the stream off paper by your rule; it
never closes a trade, and every open trade runs to its own 21:00 exit with its stop.

| Line | Level | False alarm if the rule is as measured | Caught if it has no edge | Caught if it loses |
|---|---|---|---|---|
| S1 | closed drawdown over 40.9R at any time in 36 months | 5.0 % | 33.8 % | 78.6 % |
| S2 | total under −14.9R at 12 months | 5.0 % | 21.1 % | 48.1 % |
| S3 | total under −14.2R at 24 months | 5.0 % | 29.6 % | 69.6 % |
| S4 | total under −10.5R at 36 months | 5.0 % | 36.8 % | 82.7 % |
| any | one of S1-S4 within 36 months | 11.7 % | 51.0 % | 89.4 % |

Said plainly: these lines catch a rule that is losing, most of the time; they catch a rule with no edge only about half the
time in three years, and a rule exactly as good as measured trips one of them about one time in nine. The 12-month band
of a working rule (−14.9 to +44.3R) and of a useless one (−28.6 to +30.8R) overlap almost entirely.

## 5. What it would mean in money, if it ever got that far (it is not proposed)

From PR #1058, simple %, at $0.60 a round trip, 2007-26: 0.25 % risk a trade → +3.4 % a year with a worst drawdown of
10.7 % and 4.4 years under water; at twice the cost, −0.45 % a year. At 0.1 %: +1.4 % a year, worst drawdown 4.3 %. These
figures are the history, not a forecast, and the recent decade is the weaker half. They are here only so that no one reads
the 2007-15 pass as a money machine.

## 6. If you choose

- (a) or (b): a new item at the end of `docs/owner-decisions.md` records the choice and the thresholds; the twelve study
  pull requests are merged first so the band and stop-line figures are read from `main`; the build is one change with its
  tests, shown to you before it runs. The stream stays a separate paper record, never mixed into the
  live book of item 43, its forward reading or its bands.
- (c): nothing happens. The studies stay on their branches as a record.

Sources: `research/edge/<topic>/RESULT.md` and `result.json` on each branch named above (PRs #1046, #1049, #1051,
#1056-#1062, #1067, #1068), as of 14 Nov 2026.

# Where the edges stand, and what would move them (11 Nov 2026)

Paper research for the owner, after "now our edges, we need more improvement so we start make money". Nothing here changes
a live rule, a size, a filter, a stop, `config.json` or any council member: each proposal waits for your yes or no. Paper
trading and demo accounts only. Figures are from council-data as of 11 Nov 2026 21:00 UTC and from the committed studies.

## In plain words

1. **No system has proven it makes money on data it was not built on.** The bar is a t of 2 or more, out of sample, after
   costs. Nothing reaches it. Three long-only gold systems come close (t 1.8 to 1.9); the other five are flat or negative
   out of sample. Almost every large positive number on the site is a replay of rules on the years they were chosen on.
2. **The forward record is far too short to say anything**: 5 main-system paper trades (−2.05R before costs, −2.18R
   after). At their honest pace the systems need years, not weeks, to be judged. Nothing speeds that up.
3. **The best-supported move is to trade fewer systems, not more.** On 2006-17, which no rule saw, a book of only the
   gold systems with a positive honest record made +9R a year with a 29R worst drawdown; the book the council runs today
   made +4R a year with an 83R drawdown and lost money at doubled costs (`research/edge/honest-book`). That proposal was
   never put to you as a decision. It is decision 1 below.
4. **A cost nobody counted: overnight financing on gold.** The demo broker charges about 5.3 % a year on a long gold
   position. Today's study (`research/edge/trend-breadth`) puts it at about 2.8R a year across the gold systems, and it
   pushes the H4 trendline's honest expectancy to nothing (+0.01R a position, t 0.23).
5. **Be ready for the size of the honest answer.** After financing, the supported book earns about **+6R a year, give or
   take 15R**, with a drawdown near 30R. At a risk of 0.25 % a trade that is about +1.5 % a year. That is what the evidence
   supports today; anything bigger on the screen is in-sample.

## The systems, one row each

"Honest" = the study on data the rule was never tuned on, after costs (not after financing). "To judge" = forward trades
needed before the record can confirm that expectancy with t 2 (from `council/expect.mjs`).

| system | honest R a trade (window, n, t) | after financing (today's rate) | trades a year | drawdown to plan for | forward record | to judge | standing |
|---|---|---|---|---|---|---|---|
| Gold trend | +0.49 (2006-17, n 75, t 1.77) | +0.40 (t 1.49) | 6.5 | 5 to 7R | none yet | 96 trades, about 15 years | **nearest to evidence**, unproven; mostly "long gold with a trailing exit" |
| Gold trend fast (shadow) | +0.37 (2006-17, n 129, t 1.92) | +0.29 (t 1.53) | 11 | 9 to 11R | none yet | 141 trades, about 13 years | same bet as Gold trend (0.92 correlated) |
| Gold daily engulf | +0.19 (2006-17, n 256, t 1.89) | +0.14 (t 1.46) | 22 | 15 to 22R | 1 trade, −1.06R | 286 trades, about 13 years | **nearest to evidence**, unproven; near zero when gold is not rising |
| Gold H4 trendline | +0.05 (2006-17, n 402, t 0.83) | +0.01 (t 0.23) | 35 | 21 to 26R | 1 trade, −1.02R | cannot be proven | **no evidence** once financing is counted |
| Mosha BO | +0.14 (2006-17, n 62, t 0.55) | not computed | 5 | 43 to 46R | none (no trade since 4 Nov) | cannot be proven | **no evidence**; the 2018-26 rebuild is −0.06R |
| Gold replica | −0.05 (2017-22, n 115, t −0.17) | not computed | 19 | 24 to 40R | 2 trades, +0.95R | cannot be proven | **failed** before 2023; +0.88R only on the years it was built on |
| Gold momentum pullback | −0.04 (2018-22, n 634, t −0.86) | not computed | 127 | 40 to 50R | none | cannot be proven | **failed** before 2023 |
| NQ New York open run | −0.02 (2004-22, n 1,560, t −0.53) | n/a (intraday) | 82 | 17 to 61R | 1 trade, −1.05R | cannot be proven | **flat for 19 years**, +0.33R since 2023 only |
| ICT A-setups (separate edge) | −0.01 (2008-17, n 2,235, t −0.45) | not computed | 223 | 53 to 83R | 2 closed, +1.13R | 1,065 trades at its backtest edge, about 5 years | **failed** on 2008-17; the replay's +117R since Aug 2025 is in-sample |

Real evidence (t 2 or more out of sample, net): **none**. Unproven but positive: Gold trend, Gold trend fast, Gold daily
engulf. No evidence or failed: the rest.

## Where the R goes

- **Costs.** Live book, 38 closed trades since 1 Nov: −17.4R before costs, −22.9R after; 34 of them are the engine
  retired on 4 Nov. Shadow book, 804 closed: **+133.0R before costs, −24.2R after**: costs took 157R in eleven days.
  Forex shadows: +64.2R → −26.5R. The retrace scalp alone: −26.7R → −82.9R (n 243, t −3.2 after costs). These streams are
  killed by cost, as `research/edge/shadow-cost` said on 9 Nov; they still run and still copy to the Shadows demo account.
- **Financing** (new today): gold systems, about 2.8R a year, not in any figure on the site.
- **Execution on the demo.** Council account: 13 copies, average slippage about zero. Shadows account: 292 copies, market
  orders 0.04R worse than paper (n 122, t 1.4), limit orders 0.05R better (n 170). **Replica account: 121 copies, 0.08R
  worse than paper on every trade (t 3.9)**, on a stream that is already negative before costs (next point). Missed
  copies are few: 1 late-copy skip on the council account, XRP not offered by the broker (4), and one whole afternoon on
  the Replica account (see "One thing to check").
- **The replica on ten markets is losing on paper.** Its forward paper trades since 3 Nov (gold, forex, crypto;
  `research.json`): 568 closed, **−0.08R a trade before costs** (−43R, t −1.3); the ones its own filter passes: −0.09R
  (n 303). The late session is clearly negative (n 65, −0.32R, t −2.1). Since 10 Nov these are copied to the Replica demo
  account.
- **Sizing.** The book-weights paper comparison has 5 trading days and 26 trades (live +15.9R, proposed weights +32.9R).
  The whole difference is the ICT replay's +19R being weighted 1.8 times. Five days say nothing; the study behind it
  found no edge on untouched data. Leave it.
- **Frequency.** The live gold replica and Mosha BO both wait for the weekly structure to agree, and it reads down
  (`goldW1` −1) while the H4 reads up, so neither trades: the replica's last live trades are of 4 Nov, Mosha BO has had
  none. The replica's whole 2017-22 record came in nine months of open gate. This is the rule working as written, on two
  systems without out-of-sample evidence: there is nothing here worth loosening.
- **What the filters block** (shadow trades by the rule that blocked them, after costs): the reward-to-risk band (n 158,
  −0.39R, t −4.5), the minimum reward (n 124, −0.22R, t −2.9) and the market switch (n 60, −0.56R, t −3.3) block losers:
  they are right. The news guard blocked 28 trades that made +0.58R (t 2.0) and the exposure cap 127 that made +0.26R
  (t 1.2): too few and too short (eleven days, one market mood) to act on; look again at 100 each.
- **The cheap-scalp idea** (cost of 0.10R or less): 117 forward trades, +0.53R after costs (t 3.3), but that is still
  mostly the week it was found on; in the two days since the proposal the cheap side made +0.35R (n 13) and the expensive
  side +0.43R (n 87). The judge-at-200 rule stands; it is not evidence yet.

## Ranked plan

| # | Action | Expected effect, a year | Evidence | Risk | Your approval? |
|---|---|---|---|---|---|
| 1 | **Make the live paper book the supported one**: Gold trend and Gold daily engulf stay live; the replica, momentum pullback, NQ open run, H4 trendline and Mosha BO become shadows (recorded, never alerted), judged on their forward records. | The supported book: about **+6R a year after financing** (range about −9 to +20R), worst drawdown probably 15 to 30R. Against the present book it removes an expected −8R a year (replica −1, pullback −5.5, NQ −1.5) and a drawdown that reached 83R. | honest-book, 2006-17: its four-system gold book made +9.4R a year (t 2.4 on daily book R, n 794, positive in both halves and at doubled costs), and Gold trend and the engulf made +79.9R of its +107.6R; the live book +4.3R a year, −20.8R at doubled costs. Financing: trend-breadth Part A. The two-system book itself has not been run as a book. | Gives up the in-sample years' big numbers (+139R a year in 2023-26 for the present book). It is one bet on gold rising: 2012-17 made only +26R in six years. | **Yes** (live rule change) |
| 2 | **Count financing** in the cost model and in "What to expect" for positions held overnight. | No gain: it makes the gold figures about 2.8R a year more honest and shows the trendline as it is. | trend-breadth Part A; the broker's own swap record and the demo deals. | None to trading. The numbers on the page get smaller. | **Yes** (changes what a council member computes) |
| 3 | **Stop the streams that cost more than they can earn**: decisions 11 and 12 as recommended (stop the five expensive engine shadows and LIT, keep the cheap-scalp column), and stop copying the replica's forex and crypto paper trades to the demo account until that stream is positive before costs. | Paper only: the shadow book stops losing about 14R a day to costs, and the demo accounts show the systems you care about. No effect on the main book. | 804 shadow trades: +133R gross, −24R net. Replica paper: 568 trades, −0.08R gross; demo slippage 0.08R (t 3.9). | Losing sight of a stream that turns; the paper record keeps running for the scalp column. | **Yes** |
| 4 | **Wait, and judge on the calendar already written.** Leave ICT (Fred's edge), the NQ trend-on shadow and the five ICT shadows running unchanged; first look at 30 forward trades each. | Unknown: ICT's honest figure is −0.01R a trade (n 2,235), its replay +0.15R. At 223 A-setups a year, 30 trades is about two months and a verdict about five years. | ict-oos-2008, the robustness audit ("fragile"). | Time. | No |
| 5 | **Research with a chance of adding trades**: (a) the Gold trend rule on other markets with hourly candles, pre-registered (today's daily version could not be validated); (b) your own logged Mosha trades (decision 27). | Unknown; the unvalidated daily figures showed no sign of a pass, so expect little from (a). | trend-breadth Part B. | Research time only. | No for (a); (b) needs you |

What is **not** on the list: a new entry rule. Seventy-two studies are on file, forty-nine failed, and thirty-three
mechanical readings of Mosha were tested in one day without a pass. Another rule is the least likely thing to help.

## Decisions for you

1. **Shall the live paper book be Gold trend and Gold daily engulf only, with the other five as shadows?**
   Recommended: **yes**. If you want more weight on the trend idea, bring Gold trend fast back to live as well (that is a
   size decision, not a new idea; C against B in honest-book is within noise).
2. **Shall financing be added to the cost model and the expectations?** Recommended: **yes**.
3. **Decisions 11, 12 and 14 of `docs/owner-decisions.md` (shadow streams, LIT, the replica's size): the recommendations
   there stand.** New with this review: **stop copying the replica's forex and crypto paper trades to the Replica demo
   account?** Recommended: **yes**, until its paper record is positive before costs over 200 trades.
4. **Decision 33 (Mosha BO to shadow):** recommended **yes**; it is part of decision 1 here.
5. **Who placed the 10-lot gold trade on the Replica demo account?** See below.

## One thing to check

On 11 Nov at 13:37 UTC a **10-lot gold buy** on the Replica demo account closed with a loss of **$4,427** (entry 4,040.45,
exit 4,036.12), which took the account from about $10,017 to $5,545. It is not in the mirror's records and the mirror
cannot send more than 5 lots, so it was not a copied trade; it looks placed by hand. Nothing real was lost (a demo
account), but the mirror's daily loss stop then refused every replica copy for the rest of the day ("daily loss stop
(44.8% down today)"), and the account's results no longer measure the replica. If it was not you, change that account's
password. Either way the account should be reset before its record is read.

## What was done today

- `research/edge/trend-breadth/` (pre-registration committed first): Part A, the financing table above. Part B, the Gold
  trend rule on 35 other markets from the council's daily candle cache: **not validated**. The daily harness reproduced
  the gold record on 2006-17 (72 positions against 75, +0.52R against +0.51R) but not on 2018-26 (+1.64R against
  +1.35R): the live rule buys again inside a day after a stop-out, which daily candles cannot place, and those re-entries
  are mostly losers. By the pre-registration no breadth figure is interpreted.

## What could not be verified

- The broker's financing rate in past years (today's rate and half of it are shown).
- Financing on the add units from the committed records (the daily harness suggests the true cost of the trend legs is
  about a third higher than the first-unit table).
- Who placed the 10-lot trade.
- The ICT forward record beyond 8 signals; the live futures feed is not reachable from the build sandbox.
- Anything about live money: there is none, by rule.

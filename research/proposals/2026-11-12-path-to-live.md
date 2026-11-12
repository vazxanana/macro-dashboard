# The path to real money: what is left to improve, and how a forward test would be judged (12 Nov 2026)

**Answered 12 Nov 2026.** The owner was shown items 43 to 46 and answered "Yes to all": the protocol of section 3 is adopted
as written (stop lines in force from 12 Nov 2026; a crossed line sends the book back to a paper shadow, see
`council/forward.mjs` `stopSwitch`), no further tests on this book's 2006-17 window, the bridges refuse a non-demo account,
and paper and demo only until at least November 2027. The text below is the proposal as it was put.

Paper research for the owner, after "now our edges, we need more improvement so we start make money" and "keep improving
dont stop reach our goal". Nothing here changes a live rule, a size, a filter, a stop, `config.json`, any council member or
any code that keeps the desk on paper and demo accounts. Nothing here recommends putting real money on the book now.
Every figure comes from the committed studies or from `2026-11-12-path-to-live.json` (made by the script of the same name
from the supported-book study's own records; a test compares this page with it).

## In plain words

1. **The research on this book is exhausted.** Every lever that could raise the return of the two-system book (a macro
   gate, a different exit, a different entry, a sizing rule, more markets, more systems) has been tested with a rule fixed
   in advance, and none passed. No principled, untested lever is left, and there is no untouched gold history left to test
   one on. No new study was run for this document, on purpose: one more test on the same years would be a coin toss
   dressed as evidence.
2. **What the evidence supports today.** On the eleven and a half years none of its rules saw (2006-17), after spread,
   slippage and overnight financing, the book (Gold trend + Gold daily engulf) made **about +5.2R a year** (330
   positions, 29 a year; the 90 % interval is +0.3 to +10.3R a year; t 1.86, under the bar of 2, so **positive, not
   proven**). Its worst drawdown was **about 20R (22R counting open trades), and it lasted almost four years without
   being regained**. Half the years lost. Almost all the profit came while gold was rising (2006-11: +55R; 2012-17: +4R).
   **What would show it is wrong:** a forward record that falls through the stop lines of section 3, or gold spending
   years falling or flat (the book then earns nothing and pays costs), or the broker's financing rate rising further.
3. **A forward record cannot prove this book in any time you would wait.** At 29 positions a year it needs about 369
   positions, **about 13 years**, before a book that is exactly as good as measured would reach a t of 2. What a forward
   test CAN do in one to three years is catch a book that is broken, and check that the demo fills like the paper. The
   protocol below is built for that and says how weak it is.
4. **The money, honestly.** At a quarter of a per cent risk a trade the book's measured rate is about **+1.3 % a year**
   with a drawdown of about 5 % lasting years. On a $50,000 account that is about +$650 a year, somewhere between +$40
   and +$1,300, with a stretch $2,500 to $2,800 under water. That is very likely less than plain interest on the same cash:
   the broker's own financing charge of 5.3 % a year suggests dollar interest of several per cent (not verified here). Raising the risk raises the drawdown
   in the same proportion. **This book, as measured, is not a way to make a living; it is a small, slow, unproven tilt.**

## 1. What is left to test: nothing (the lever table)

Every study that touches the gold book, a gate, an overlay, an exit or its size. "n" is positions unless said.

| lever | study | tested? | verdict, with n and t | still open? |
|---|---|---|---|---|
| The book itself, run as a book after all costs | `supported-book` | yes | FAIL on the bar: +5.2R a year, n 330, t 1.86 | no |
| Which systems belong in it | `honest-book` | yes | the gold-only books beat the eight-system book (bootstrap P 0.96); you approved it (item 37) | no |
| Gold Macro Score as a size step (full risk above +0.25, half otherwise) | `macroscore-overlay` | yes, on the gold longs and on the gold books | FAIL: keeps 65 % of the R (bar 90 %); the better return per drawdown is within noise (P 0.85); positions above the cut +0.33R against +0.14R, n 128 of 810, t 1.13; nothing at all in 2012-17 | no (see note 1) |
| Gold Macro Score as a gate (trade only above +0.25) | `macroscore-overlay` | yes | keeps 31 % of the R, t falls from 2.41 to 1.92 | no |
| Real yields falling as a gate on Gold trend | `macro-gold` | yes | FAIL: kept +0.76R against skipped +0.12R, p 0.13, reversed in 2012-17 | no |
| Real yields as a long / flat switch on gold | `macro-gold` | yes | FAIL: Sharpe 0.33 against 0.44 for simply holding gold | no |
| Switch by volatility, trend strength, or the system's own last year | `regime-switch` | yes, 9 cells for the three gold systems | FAIL, all 9: second-half t between −0.91 and +1.43. Nearest: the engulf only when gold's six-month trend is up (t 1.43) | no (see note 2) |
| Forecasting the size of the next move, to size by it | `macro-vol` | yes | no model beats the plain 20-day average on gold | no |
| Exits and re-entries of the trend legs | `gtrend-exits` | yes, 12 variants on 2 legs | FAIL: 0 of 24 confirmed; the best difference has a monthly t of 0.4 | no |
| Entry of the daily engulf (averages, zone, market at the close, half-zone limit, order life, depth, sells) | `geg-variants` | yes, 10 variants and the sell mirror | NOT BETTER, 0 of 10; nearest miss: another zone candle (+57R against +43R, n 253, failed 1 of 5 fixed tests); the sell mirror −0.02R a position on 2006-17 | no (see note 2) |
| A limit entry to cut the engulf's cost | `geg-variants`, `supported-book` | yes | the live entry already is a limit; a market entry is worse (+0.115R against +0.168R, n 320); spread and slippage are 0.008R a unit, nothing to save | no |
| Sizing rules (inverse volatility, drawdown throttle, decay throttle) | `sizing` | yes | FAIL: none better in both halves | no |
| Weights between systems, caps | `portfolio`, `portfolio-v2` | yes | no scheme beats equal risk per idea in both halves; on untouched years no book has t above 1.2 | no |
| The trend leg's extra unit (the add) on or off | `book-sizing` | yes | within noise: P(off is better) 0.54; the add alone n 34, t 0.60 | no |
| Adding Gold trend fast | `supported-book` (S3) | yes | 46 % more R, 49 % more drawdown, t 1.77: a size choice, not an improvement | no |
| The Gold trend rule on other markets | `trend-breadth-h1` | yes, 13 markets | FAIL, 0 of 14: pool −0.06R, n 827, t −0.89 | no |
| Weekend handling | `gold-weekend` | yes | trend: keep; engulf: +7R in 20 years, monthly t about 0.2 | no |
| Calendar and clock effects on gold | `seasonality` | yes, 10 tests | 0 pass; gold through the Asian hours +0.004 % a trade, t 0.40 | no |
| Skipping or closing around CPI, jobs, Fed | `event-risk`, `news-filter` | yes | FAIL, 5 of 5; main-system entries almost never fall in a release window (1 of 856) | no |
| Time of day, agreement with ICT, volatility regimes for entries | `timing`, `confluence`, `regime` | yes | FAIL each; they concern the retired intraday setups, not the daily book | no |
| Execution delay and cost assumptions | `costs`, `supported-book` | yes | a 1-3 minute delay costs under 0.02R; at doubled spread and slippage the book keeps +48.7R | no |
| Is the entry signal itself the edge? | `gold-systems-oos`, `robustness` | yes | no: random long entries with the same exit make +0.28R; the breakout sits at the 84th percentile of them | no |

**Note 1, the macro score.** It was the obvious candidate, because the score has a real weekly record (rank correlation
with the next four weeks of gold +0.149, t 3.24, 999 weeks). But that record is on the same years the score was chosen
on, not out of sample, and the study already put the score on the gold longs and on the gold books as a size step and as
a gate. Running it once more on the two-system book after financing would ask the same question of the same positions
(the two systems' positions are among the 810 it used). It is answered.

**Note 2, the near misses.** Two things came close and failed their own fixed bars: the engulf taken only when gold's
six-month trend is up, and a different zone candle for the engulf. Each was found on 2006-17 and 2018-26, which are all
the gold history there is for these rules. There is no third stretch to confirm either on. The window called "untouched"
has by now been read by a dozen studies and over sixty comparisons for these systems; a seventh look that "passes"
would be chance as likely as not. The only honest test left for anything is the future, and at six skipped engulf
trades a year a forward tally would take decades. Not proposed.

**The one cost that can still move** is not a rule: overnight financing took 20.5R of the book's 80R (before financing),
and the test passes at half today's rate (t 2.15). The rate is the dollar interest rate plus the broker's own margin.
You cannot change the first; the second differs between brokers and is worth one question to yours (decision 4).

## 2. What does not help, and the study behind each

- **More rules.** Seventy-odd studies, most failed; thirty-three mechanical readings of Mosha in one day, none passed;
  the entry signal of the book itself is no better than a random long entry (`gold-systems-oos`).
- **More markets.** The trend rule on thirteen other markets: 0 of 14 tests (`trend-breadth-h1`). The replica on ten
  markets: −0.08R a trade before costs over 568 paper trades (edge review).
- **More systems in the book.** The eight-system book made less with four times the drawdown (`honest-book`).
- **Smarter sizing.** `sizing`, `portfolio-v2`, `book-sizing`, `macroscore-overlay`: nothing beats a fixed risk a trade.
- **Leverage, or simply more risk a trade.** It multiplies the return and the drawdown by the same number and changes
  nothing about whether the book is real (table in section 4). At 1 % a trade the measured drawdown is 20 to 22 % for
  four years, and one in twenty ten-year stretches would be 34 % or worse.

## 3. The forward-test protocol: gates fixed now, before the record exists

The book runs on paper and on the Council demo account, as it does today. Clock start: 12 Nov 2026 (the first full day
after item 37). Everything counted **after costs and financing**, in R, from the paper record; closed positions only.
The numbers come from redrawing the 138 untouched months of the book 20,000 times in three worlds: the book **as
measured** (+5.2R a year), **no edge** (0R a year) and **losing** (−5.2R a year).

**What to expect if the book is as measured**

| after | positions | total R: middle (5 % to 95 %) | chance of being below zero | worst drawdown so far: typical / 1 in 20 |
|---|---|---|---|---|
| 6 months | 14 | +1.2 (−7.3 to +17.2) | 43 % | 4.2R / 8.8R |
| 12 months | 29 | +3.5 (−9.7 to +24.5) | 35 % | 6.3R / 12.9R |
| 24 months | 57 | +8.8 (−12.0 to +37.0) | 26 % | 9.1R / 18.3R |
| 36 months | 86 | +14.1 (−12.1 to +47.7) | 21 % | 11.0R / 21.9R |
| 60 months | 144 | +24.6 (−10.6 to +66.9) | 13 % | 13.7R / 26.7R |

Read the second-last column twice: **a book that is exactly as good as measured is still losing after a year one time
in three, and after three years one time in five.** A losing first year proves nothing; so does a winning one.

**The stop rules (any one: the book goes back to a paper shadow and you are told; no trade is closed by it, every open
trade keeps its stop and runs to its own exit)**

| # | rule | line | why this line |
|---|---|---|---|
| S1 | forward drawdown from the forward record's own high | **more than 21.9R** | the 1-in-20 worst drawdown of three years as measured; also the worst the book ever showed (19.8R closed, 22.1R with open trades) |
| S2 | total after 12 months | **below −9.7R** | the 5 % line as measured |
| S3 | total after 24 months | **below −12.0R** | the 5 % line as measured |
| S4 | total after 36 months | **below −12.1R** | the 5 % line as measured |

**How good these rules are, said plainly**

| if the book is really… | stopped within 3 years | by S1 alone, within 1 / 2 / 3 / 5 years |
|---|---|---|
| as measured (+5.2R a year) | **12 %** (a false alarm) | 0 % / 2 % / 5 % / 13 % |
| without an edge (0R a year) | **43 %** | 1 % / 13 % / 29 % / 55 % |
| losing (−5.2R a year) | **77 %** | 5 % / 40 % / 66 % / 90 % |

So three years of forward record catch a losing book three times in four and a book with no edge less than half the
time, at the price of one false alarm in eight. Tighter lines would stop a good book too often; looser ones would catch
nothing. **Three years cannot tell "as measured" from "no edge" with any confidence, and nothing can at 29 positions a
year.** The record is worth keeping because it is the only new evidence there will ever be, not because it will settle
the question soon.

**The per-position check that already runs.** "What to expect" places each system's forward average against its band
from 10 trades. For the book as a whole the 5 % to 95 % band of the average R a position is −0.35 to +0.71 after 29
positions, −0.20 to +0.56 after 57 and −0.13 to +0.49 after 86. Outside the band on the low side at a yearly check is the
same signal as S2 to S4.

**Execution checks on the demo mirror (Council account), from the first 30 copies of the book's trades, about a year**

| # | check | pass | fail |
|---|---|---|---|
| E1 | every copy has a stop at the broker from the fill (`council/ctrader-reconcile.mjs` reports none without) | 30 of 30 | any position found without a stop |
| E2 | copies made: paper trades of the book that reached the demo | at least 28 of 30, each miss with its reason on file | 3 or more missed |
| E3 | fill against paper, average over the 30, in R of the trade's own risk | within 0.03R of paper | worse than paper by more than 0.05R (that is over a quarter of the book's +0.18R a position) |
| E4 | financing: what the demo account was charged on gold buys against the cost model's 0.0148 % a night | within a fifth | the demo charges over a fifth more |
| E5 | no order on the account that the mirror did not place | none | any (item 41 was one, on another account) |

Today: 13 copies on the Council account, average slippage about zero, only 2 of them gold. The Replica account's fills
were 0.08R worse than paper (n 121, t 3.9) on tighter stops; the book's stops are $40 to $140 wide, so its slippage in R
should be far smaller, but that is not measured yet. E3's spread from copy to copy is unknown until there are copies.

**Checkpoints.** A dated note at 6, 12, 24 and 36 months (May 2027, November 2027, 2028, 2029): the table row, the
stop rules, E1 to E5. Nothing is re-tuned at a checkpoint. A stop rule can only be changed before the checkpoint it
governs, in writing, by you.

## 4. If you ever decide on a first live step: the options, with their trade-offs

**This is not allowed today and is not recommended today.** Absolute rule 2 says paper and demo accounts only, and only
you can change it. The earliest moment the evidence could say anything new is the 12-month checkpoint with E1 to E5
passed; even then the book will be unproven, and it will stay unproven for about 13 years. A live step would be a
decision to pay real costs for an unproven small tilt, not something the data will ever ask for.

**What each risk level means** (simple percentages of the account, from the untouched 2006-17 book; not compounded)

| risk a trade | expected a year (90 % interval) | worst drawdown seen: closed / with open trades | a 1-in-20 ten-year drawdown | time under water in that drawdown | most at risk at once (4 units open) |
|---|---|---|---|---|---|
| 0.10 % | +0.5 % (0.0 to +1.0 %) | 2.0 % / 2.2 % | 3.4 % | 3.8 years, not regained by the end of the data | 0.4 % |
| 0.25 % | +1.3 % (+0.1 to +2.6 %) | 5.0 % / 5.5 % | 8.5 % | the same | 1.0 % |
| 0.50 % | +2.6 % (+0.1 to +5.2 %) | 9.9 % / 11.1 % | 17.1 % | the same | 2.0 % |
| 1.00 % | +5.2 % (+0.3 to +10.3 %) | 19.8 % / 22.1 % | 34.1 % | the same | 4.0 % |

On the measured rate, no row of this table clearly beats plain interest on cash once its drawdown is counted. The built-on
years (2018-26) were three times better and must not be planned on.

**The smallest size the broker allows decides the account.** The demo broker's minimum is 0.01 lot of gold = 1 ounce:
a $1 move is $1. The stops, at a gold price of $4,000:

| leg | typical stop (2006-26) | stops since 2025 | risk of the minimum lot | account needed for that lot to be 0.25 % / 0.5 % / 1 % (on the wider, recent stops) |
|---|---|---|---|---|
| Gold trend (and its add) | 2.3 % of price, about $93 | 3.4 %, about $136 | $93 to $136 a unit | $54,500 / $27,300 / $13,600 |
| Gold daily engulf | 1.0 %, about $39 | 1.2 %, about $48 | $39 to $48 a unit | $19,400 / $9,700 / $4,800 |

Below those account sizes the minimum lot is a bigger risk than the row you chose: on $10,000 one Gold trend unit risks
about 1.4 %, which is the bottom row of the risk table and worse. A micro gold future is 10 ounces: ten times these
figures ($545,000 for 0.25 % on the trend leg), so futures are not a small first step.

**Costs at the minimum lot** are the ones already in every figure above, because they scale with size: spread and
slippage about 0.003R (trend) to 0.008R (engulf) a unit; financing about 0.006R a night on a trend unit held a median of
about 12 nights and 0.015R a night on an engulf unit held 2. Financing is the larger cost by far: 1.8R of every year.

| option | what it is | for | against |
|---|---|---|---|
| **A. Stay on paper and demo** (today; recommended) | run section 3 | costs nothing; the only way to learn more | nothing is earned; nothing is lost |
| B. Minimum lot on a small account | 1 ounce a unit, whatever the account | smallest money at risk in dollars ($39 to $136 a unit; a 22R drawdown is about $900 to $3,000) | the risk a trade is not a chosen percentage; on a small account it is the 1 % row or worse; expected gain about $200 to $700 a year, unproven |
| C. A fixed 0.25 % a trade | needs about $55,000 so the trend leg can be sized | the measured 5 % drawdown; the table's second row | expected +$700 a year on $55,000, likely less than plain interest on the same cash; years under water |
| D. Micro futures by hand from the phone tickets | 10 ounces a contract | no broker financing charge (the future's price carries the interest instead: not verified here) | ten times the size; orders placed by hand; needs $270,000 and up for sane risk |

**What in this repository would have to change, so nothing is a surprise.** None of it is changed here.

- **The rule.** `CLAUDE.md`, absolute rule 2 ("Paper trading and cTrader demo accounts only"). Only you can change it.
- **Three locks in the demo mirror** (`council/ctrader-mirror.mjs`), each refusing on its own: the server address must be
  the demo one (`DEMO_HOST`, "refusing a non-demo host"); the setting `CTRADER_ENV` must be `demo`; and the account must
  itself report that it is not live before anything is sent ("refused: the account is not a demo account"). The same
  three are in `council/ctrader-suite.mjs`, and the last two in `council/ctrader-account.mjs` and
  `council/ctrader-symbols.mjs`. Tests pin them (`tests/ctrader-mirror.test.mjs`, `tests/ctrader-suite.test.mjs`).
- **The mirror's limits are demo limits**: up to 40 positions, up to half the balance at risk, a minimum lot allowed up
  to 2 % of the balance, 0.02 % a council trade. None of that is fit for money. A live step should be a separate, small
  program for the two systems only, with its own limits, never a loosened mirror.
- **The mirror copies whole books by account**, shadows included unless switched off. A live account must never be
  given to it.
- **One place where nothing in code holds the rule today:** the two bridge programs you can download from the site
  (`mt5/CouncilBridge.mq5`, `ctrader/CouncilBridge.cs`) read the live signal file and place its orders on whatever
  account they are attached to. They print whether the account is a demo; they do not refuse a real one. Rule 2 is held
  there only by where you attach them (decision 3).
- The phone alerts' futures tickets are text for a person; whoever acts on one by hand is outside the code.

## 5. Decisions for you

They are items 43 to 46 of `docs/owner-decisions.md`.

1. **Adopt the forward-test protocol of section 3 as written (stop rules S1 to S4, checks E1 to E5, checkpoints at 6, 12,
   24 and 36 months, clock from 12 Nov 2026)?** Recommended: **yes**. It changes no trade today; it fixes, before the
   record exists, what will send the book back to a shadow. If nothing is decided, the record runs without pre-set lines
   and any later judgement of it is made after seeing it.
2. **Stop research on new gates, exits, entries and sizes for this book, and stop re-reading 2006-17 for it?**
   Recommended: **yes**. The table in section 1 is the reason. Research time goes to the forward record, the execution
   checks and whatever you bring that is new (your own logged Mosha trades, item 27). If nothing is decided, the next
   "improvement" tested on the same years has a real chance of being luck.
3. **Make the two bridge programs refuse an account that is not a demo?** Recommended: **yes**. Today rule 2 depends
   there on which account the program is attached to. It is a small change to two files that makes the rule hold in code
   everywhere; it needs your word because it touches how orders are placed. If nothing is decided, a bridge attached to
   a real account would trade it.
4. **Real money: keep absolute rule 2 as it is, and look again no earlier than the 12-month checkpoint (November 2027)
   with E1 to E5 passed?** Recommended: **yes, keep the rule**. If you ever change it, option B or C of section 4 and a
   risk row you choose knowing its drawdown; and before that, one question to the broker: what it charges overnight on
   a gold buy compared with two other brokers, since that charge is the book's largest cost and the only one that
   differs between brokers. If nothing is decided, nothing changes: paper and demo only.

## What could not be verified

- The future. The bands and stop rules assume months like 2006-17, redrawn independently; real losing months cluster
  (2012-17 made +4R in six years), so long drawdowns are likelier than the tables say, not less.
- The broker's financing in past years (today's rate is charged throughout), and what part of today's rate is the
  broker's own margin.
- Execution of this book on the demo: 2 gold copies so far.
- The live broker's minimum lot, spread and financing: the figures are the demo account's.
- Whether a gold future avoids the financing cost in practice (the interest is normally inside the future's price).
- Nothing was run against a broker; no order of any kind was placed.

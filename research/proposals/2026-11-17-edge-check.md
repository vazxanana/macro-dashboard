# Which edges can still improve, and the replica in depth (17 Nov 2026)

Paper research for the owner, after "Try to check the edges which ones can we improve and focus like the replica". Nothing
here changes a live rule, a size, a filter, a stop, `config.json`, the Trader or the mirror: each decision below waits for
your yes or no. Paper trading and demo accounts only. ICT is Fred's separate edge and is not reviewed here.

Sources: council-data of 17 Nov 2026 10:05 UTC (`trades.json`, `research.json`, `coach.json`, `config.json`,
`ctrader/*.json`; the trade review `council/trade-review.mjs` run on those files), the committed studies in
`research/edge/`, and one new pre-registered study, `research/edge/replica-sides/`.

## In plain words

1. **Nothing has changed since 12 Nov in what the evidence says.** No system has a t of 2 out of sample after costs. The
   two live systems (Gold trend, Gold daily engulf) are the nearest (as a book +5.2R a year on untouched 2006-17, t 1.86),
   and you agreed on 12 Nov (item 44) to stop testing new rules on them. Their forward record is 2 closed trades.
2. **The replica's "sells win, buys lose" is two weeks of one market, not a rule.** Tested today on 2020-26, ten markets,
   174,316 trades that played no part in noticing it: sells minus buys is +0.007R a trade out of sample (t 0.38). In the
   two forward weeks the dollar rose and the coins fell, and the side that won each market was the side of that move. Over
   2020-26 the side that wins a month is the side of that month's move in 61-84 % of months, which cannot be known in
   advance (following the 20-day move does not help either: −0.194R a trade).
3. **The replica's raw signal is zero before costs on every market** (out of sample −0.05R to +0.02R a trade) and loses after
   them (−0.04R on gold to −0.48R on SOL). There is no side, no market and no 20-day filter to rescue. The live replica rule
   (v5, gold only, a paper shadow since 11 Nov) already failed its own out-of-sample test in `replica-oos`.
4. **Where money leaks without any rule being wrong: costs and copies.** ETH and SOL CFD spreads are 0.17 % and 0.27 % of
   price, so the replica's M5 stops on them are under 5 spreads two times in three and pay 0.45-0.49R a trade. The Replica
   demo account fills 0.062R a trade worse than paper (n 157, t 3.06), 0.19R on ETH and 0.14R on SOL, 0.16R when the copy
   goes out 5 minutes or more after the signal.
5. **What could improve, honestly ranked**: (1) the live book's holding cost (item 49, still open: a cheaper way to hold gold
   lifts the book's t from 1.86 to about 1.96-2.02, a cost, not a rule); (2) the NQ open run, a regime bet with a clean recent
   record and one open fix (item 50); (3) one rule question that item 44 does not block: the Gold daily engulf on silver
   (decision 59). Everything else is either dead on untouched data or waiting on forward trades that cannot be hurried.

## Part 1: every system, what works, what loses and why

"Untouched" = the study on years the rule was never tuned on, after costs (after overnight financing where the system buys
gold). "Forward" = council-data paper trades since the system went live (3-17 Nov 2026), from the trade review.

| System | Standing | Untouched-data result (n, t) | Forward record | Where the R goes | Still open without breaking item 44? |
|---|---|---|---|---|---|
| Gold trend (gtrend) | **live** | 2006-17 +0.313R a position after financing on every unit (n 74, t 1.20); exits, add, gates all tested (gtrend-exits, book-sizing, regime-switch) | 0 trades | Few positions (6 a year), long trailing holds; financing took 0.085R a position | No rule test (item 44). Cost route only (item 49) |
| Gold daily engulf (geg) | **live** | 2006-17 +0.141R (n 256, t 1.46); variants not better (geg-variants) | 2 closed, −2.06R after costs | Stop $0.30 past a daily zone; one short-day stub fixed (item 52) | No rule test on gold (item 44). **On another market: yes** (decision 59) |
| The two as a book | live | +5.16R a year, t 1.86 (supported-book FAIL); worst drawdown 19.8R | 2 closed | Financing 1.8R a year (t 2.43 without it) | Carry route: micro futures t 1.96, GLDM t 2.02 (gold-carry; item 49) |
| Gold trend fast (gtrend5) | shadow | +0.211R a position (n 128, t 1.17); adding it to the book does not improve return per drawdown | 0 | As Gold trend | No (item 44 covers the gold trend family) |
| Gold replica (v5) | shadow since 11 Nov | 2017-22 −0.05R (n 115, t −0.17); D1 and volatility filters flip sign before 2023 (replica-oos FAIL) | live 2 closed +0.95R; shadow none closed since | Built on 2023-26; trades only in rare volatile months | Nothing left worth testing (Part 2) |
| Replica raw research stream (10 markets) | research | 2020-26: zero before costs, −0.20R a trade after (n 86,939 OOS; replica-sides FAIL) | 1,000 closed, −0.094R before costs (t −2.08), −0.30R after | Costs (forex 0.08-0.11R, ETH / SOL 0.45-0.49R); no gross edge | No. Decision 58 (what the Replica demo account copies) |
| NQ New York open run | shadow | 2004-22 −0.018R (n 1,560, t −0.53); 2023-26 +0.318R (n 309, t 3.45): a regime (nq-open-oos) | 1 closed, −1.05R | Gross edge in 2004-13 and 2023-26, none in 2014-22; exits and the regime switch tested and failed | Fix item 50 (its trail reads 1R from the moved stop). Forward trades are the only evidence left |
| Mosha BO | shadow | 2006-17 +0.121R after financing (n 62, t 0.48) | 0 | A null result | No |
| Mosha cycle | shadow since 14 Nov | 2020-26 −0.574R (n 115, t −3.99); 2007-19 −0.175R (n 244, t −1.50) | 1 open | Loses before costs too on 2020-26 | No |
| Gold H4 trendline | shadow | +0.013R after financing (t 0.23) | 1 closed, −1.02R | Financing takes what it had | No |
| Gold momentum pullback | shadow | 2018-22 −0.052R (n 634, t −1.05) | 2 closed, +1.15R | — | No |
| Engine shadow setups (scalp, intraday, retrace scalp / intraday) | shadow, no longer recorded since 12 Nov | 0 of 32 streams kept (shadow-best FAIL) | 970 shadow trades: +182R before costs, −6.3R after | Costs: 0.21-0.23R a scalp; the 15 forward days are luck among 55 streams | No |
| Position / Swing (engine) | shadow | setups-promote, meridian-swing: no robust edge 2018-26 | Position 17 closed, +25.9R after costs (t 3.79) | A rising-gold and falling-coin fortnight; same caution as the replica's sides | No (one regime, 17 trades) |
| Crypto trend | shadow since 7 Nov | decayed: June 2025 - Oct 2026 −0.13R a position (n 20, t −0.56) | 0 | — | No |
| LIT | shadow | Inconclusive: too few fills to judge | 0 fills | — | No |

**Ranking: which systems have a real chance to improve**

1. **The live book, through its holding cost, not its rules** (item 49, open since 12 Nov). It is the only change in this
   whole review that moves a number on untouched data without a new test: at today's demo rate the book is t 1.86; held as
   micro gold futures t 1.96 (8.1R of fees, about half the carry saved), counting what a GLDM-style holding's cash would earn
   t 2.02. Not a new verdict (a cost picked after seeing the result proves nothing), and only relevant if real money is ever
   considered (item 46: not before November 2027).
2. **The NQ New York open run, as a regime bet** (shadow since 11 Nov). It is the one system with a strong record in the
   current regime (2023-26 +0.318R, n 309, t 3.45) and nothing measurable said when that regime started. Improvements are
   tested and failed (exits, the 200-day switch). What is open: item 50 (its trail can put the stop next to the price and
   books a trailed exit as about +1R whatever the profit; no record has hit it yet) and a forward record.
3. **The Gold daily engulf on silver** (decision 59). The only rule question left that item 44 does not block. Low prior:
   the Gold trend rule failed on 13 other markets (trend-breadth-h1, 0 of 14), the playbook long's cuts failed on platinum
   and palladium, and passed on silver only with a t that did not hold on month sums (gold-drd-silver).
4. **Everything else**: the evidence is in and it is negative or null on untouched data. More tests on the same history
   would be mining it. The engine setups, the replica, Mosha BO and cycle, the trendline, the pullback and crypto trend are
   shadows already and should stay so.

## Part 2: the replica in depth

### What the replica rule is

`council/trader.mjs` `replicaSignals` (rebuilt on 3 Nov from four marked gold trades): a leg of at least 2 M15 ATRs in the
last 3 or 6 hours; an M5 close back through the last one-candle swing against the leg (the CHoCH) in one of the last two
closed M5 candles is the signal. The **research stream** (`research.json`, every market, every signal, nothing filtered):
market entry at the signal, stop past the leg's extreme (0.1 M15 ATR; $0.30 floor and round-number stops on gold), target
2R, out after 48 h. The **live gold rule** (`trades.json`, v5, a paper shadow since 11 Nov) takes only signals that are clear
of live H1 Origins or have the starred engulf, have a stop of at least one M15 ATR, go against the H4 trend and with the D1
trend, while gold's 20-day range is in the top fifth of its year, with a −1.5R day stop, a cap of 3, half size under the
equity average, the MSNR size tilt, break-even at +2R, an add at +1.5R and a trail after +4R. Its filters were chosen on
2023-26 gold; on 2017-22 they flip sign (`replica-oos`). On other markets a grid of about 11,000 settings a pair was
searched on 2019-22 on 5 Nov and the best lost on 2023-26 on 7 of 9 pairs (council-data `research/log.md`).

### 1. Is the side split structural? No: a regime artefact

`research/edge/replica-sides/` (pre-registration committed alone before anything ran; three tests, Holm, pass = OOS month
t ≥ 2 and positive in both windows):

| Test | 2020-23 (in sample) | 2024 - Oct 2026 (out of sample) | Pass |
|---|---|---|---|
| Sells only, net R a trade | −0.148 (n 44,409, t −8.19) | −0.196 (n 44,458, t −12.63) | no |
| Sells minus buys, a month | +0.030 (48 months, t 1.77) | +0.007 (34 months, t 0.38) | no |
| With the market's 20-day move | −0.147 (n 43,226, t −8.29) | −0.194 (n 43,140, t −12.72) | no |

- Before costs both sides are zero (sells −0.001R, buys −0.020R out of sample).
- No year 2020-26 has a positive side. Gold's sells did worse than its buys (gold rose).
- In the forward fortnight every forex pair's winning side was the rising dollar's (EUR / GBP / AUD sells and CAD / CHF buys:
  +50.2R on 181 trades; the other side −123.6R on 208). Over 2020-26 the dollar's side made no difference (out of sample
  −0.109R against −0.159R a trade, both losing).
- One market leans: XRP's sells beat its buys in both windows (t 2.08, 2.07), one of ten, untested, both sides losing after
  costs. Something to watch, not a finding.

The trade review's "one side only" proposal for the replica's research stream named exactly this study as its test. It
failed: answer it "no".

### 2. Where the demo slippage comes from

The Replica demo account (council-data `ctrader/mirror-10152148.json`, 157 copies 10-17 Nov, every one a market order
placed after the signal, distances kept from the fill):

| Cut | n | Fill worse than paper, R a trade (t) |
|---|---|---|
| All | 157 | +0.062 (3.06) |
| ETH | 14 | +0.189 (3.26) |
| SOL | 16 | +0.143 (2.29) |
| GBP/USD | 12 | +0.071 (2.01) |
| BTC | 17 | +0.042 (0.87) |
| Gold | 46 | +0.027 (0.58) |
| EUR/USD | 12 | +0.001 (0.06) |
| Copy 5 minutes or more after the signal | 23 | +0.159 (2.14) |
| Buys / sells | 78 / 79 | −0.003 / +0.127 |

- **The coins pay the CFD spread on tight stops.** A market order fills at the bid or ask; the council's paper entry is a mid.
  ETH's spread is 2.98 against a median stop of 12.5, SOL's 0.196 against 0.64: half a spread is 0.1-0.15R before anything
  else. The same arithmetic makes the replica's ETH and SOL research trades pay 0.49R and 0.45R a trade in the backtest.
- **Late copies pay the drift.** 23 copies went out 5 minutes or more after the signal and filled 0.16R worse.
- **Forex is clean** (raw-spread account: 0.0-0.1 pip from paper).
- **The buy / sell gap is mostly a price basis**, not slippage: on gold the broker filled buys $1.33 and sells $0.84 under the
  council's price at the median, so buys look better and sells worse by the same offset. Averaged over sides it cancels.
- Entry type: every copy is a market order (no resting limit for this stream), so no limit-versus-market split exists.

### 3. Each market after the measured costs

The 17 Nov cost model (`council/fills.mjs` `costModel`: measured spreads, commission and demo fills), out of sample 2024 -
Oct 2026, net R a trade (gross in brackets): gold −0.042 (−0.014), EUR/USD −0.166 (−0.048), GBP/USD −0.121 (−0.023),
AUD/USD −0.111 (−0.017), USD/CAD −0.138 (−0.010), USD/CHF −0.135 (−0.030), BTC −0.130 (−0.007), ETH −0.428 (+0.017),
SOL −0.477 (+0.009), XRP −0.100 (−0.003). Forward (3-17 Nov, same model): gold −0.16, EUR/USD −0.30, GBP/USD −0.41,
AUD/USD −0.41, USD/CAD −0.15, USD/CHF −0.19, BTC 0.00, ETH −0.48, SOL −0.61, XRP −0.12. Every market loses in both.

### What is left to try on the replica

Nothing that is honest. The rule was fitted on 2023-26 gold, its filters flip before 2023, its raw signal is zero before
costs on ten markets, and neither side nor the recent direction helps. A further variant would be a new idea, not a repair.

## Decisions for you

These are items 57-59 in `docs/owner-decisions.md`.

- **57. Replica: no side rule.** Recommendation: agree. The forward side split is a regime artefact (replica-sides FAIL,
  0 of 3). Nothing to apply; the trade review's "one side only" proposal for the replica is answered by the study. If nothing
  is decided: the proposal keeps appearing in "Decisions waiting" until the trade review stops flagging the split.
- **58. The Replica demo account copies the replica rule's own trades only, not its raw research signals on gold.**
  Recommendation: yes. Since 11 Nov no new forex or crypto research trade is copied (item 39); the gold research signals
  (every raw signal, not the v5 rule) still are: 46 of the 157 copies. They measure a stream the studies show is zero before
  costs, and they fill the account with trades the replica rule would never take. How: one owner rule setting
  `config.mirrorReplica.markets` to an empty list (no research trade copied; the replica's own records in `trades.json` are
  copied as before; positions already copied run to their exits with their stops). If nothing is decided: the account keeps
  recording raw gold signals at about 0.03R a trade of fill cost.
- **59. One open rule question: the Gold daily engulf on silver.** Recommendation: run it, pre-registered, 2020 to now,
  in sample 2020-23 against out of sample 2024 on, net of the demo broker's silver costs, month-sum t ≥ 2: the only test
  left that does not touch the gold book's history (item 44) and is not already answered. Its chance is low (see the
  ranking), and a pass would make it a paper shadow to watch, never live. If nothing is decided: no further rule research on
  the supported book's systems; the forward record decides.
- **Still open from 12 Nov, the two that matter most here**: item 49 (the holding cost of a gold buy: the one improvement
  to the live book that needs no new test) and item 50 (the NQ open run's trail fix).

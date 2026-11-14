# Pre-registration: gold against its quarter-to-date move in the last days of a quarter (14 Nov 2026)

Written and pushed ALONE, before any return around these dates was computed. The code (`run.mjs`), the result and the test
come in later commits.

## What this is, and what it is not

A **calendar study of its own**: in the last days of a calendar quarter, does spot gold move AGAINST its quarter-to-date
performance (portfolio rebalancing and window dressing: funds sell the quarter's winners and buy its losers before the
quarter's books close)? It is **not** a gate, exit, entry or size of the live gold book (Gold trend, Gold daily engulf, the
Mosha cycle): it reads none of their trades and tests no book rule on any window (docs/owner-decisions.md item 44; the same
reading `gold-turn-of-month` and `gold-month-of-year` used). Paper only; nothing live changes whatever the verdict. A PASS
would only be written up as a proposal for the owner.

Dedupe (each RESULT.md read): `index-quarter-end` (US500 by the quarter's stock-minus-bond return, FAIL, OOS -0.101R, n 47,
t -0.89) and `rebalance-flow` (SPX500 / NAS100 month and quarter ends by a ranked stock-minus-bond return, FAIL, best t 0.24)
are on stock indices, not gold. `gold-turn-of-month` (FAIL; its T2 shorts TD-4 to TD-1 every month whatever the month did)
has no conditioning on the period's own return. `gold-month-of-year` (whole calendar months), `gold-month-levels` (last
month's high / low) and `ict-quarters` (ICT A-setups by quarter of the year) test other things. None conditions gold's last
days of a quarter on its quarter-to-date return. The untested backlog (`untested-backlog`) does not list it.

## Data, market set, windows

- Market set, fixed now: **spot gold only**. Daily: council-data `research/daily/xau.json` (OANDA mid, UTC daily candles,
  read with `git show`, no network, no cache written), weekend candles folded into the next Monday with `council/fills.mjs`
  `foldWeekend` (read only). Stops: OANDA mid XAU/USD H1 candles (a scratch file outside git, read from a path argument).
- **Trading days** = the folded daily candles. A quarter's last trading day (TD-1) is the last folded candle dated in March,
  June, September or December; TD-5 is four candles before it. A month's TD-1 likewise for every month.
- In sample: events whose ENTRY candle is in **2007-01 to 2016-12**. Out of sample (the judged window): **2017-01 to
  2026-09** (the last full quarter, Q3 2026). Expected n: about 40 quarters in each window for T1 (that is SMALL, said now:
  a t of 2 needs a mean near a third of the trades' standard deviation), about 80 / 77 months for T2.

## The three tests

- **T1 (primary), quarter end**: at the close of the quarter's 5th-to-last trading day (TD-5), the quarter-to-date return
  q = close(TD-5) / close(previous quarter's TD-1) - 1. q > 0: SELL; q < 0: BUY; q = 0: no trade. Exit at the close of the
  quarter's TD-1 (4 trading days held).
- **T2, month end (monthly rebalancing)**: the same with month ends that are NOT quarter ends (Jan, Feb, Apr, May, Jul, Aug,
  Oct, Nov), month-to-date from the previous month's TD-1.
- **T3, large quarters only**: T1 only when |q| is above the median of |q| of the 8 previous quarters (each measured the
  same way at its own TD-5; past quarters only). Quarter-to-date values are computed from Q2 2006 (the first quarter with a
  previous quarter end on file), so T3's first possible trade is Q2 2008: its in-sample window has about 35 quarters.

Every trade has a stop (absolute rule 1): **1.5 x ATR(20)** of the folded daily candles up to and including the entry candle
(Wilder's true range, simple mean). It is checked on every H1 candle from the start of the UTC day after the entry candle to
the end of the exit candle's UTC day; an H1 candle that opens through the stop fills at its open (`fills.mjs` `stopFill`),
else at the stop. If the H1 file has no candle in a trade's window, the daily candles are used for that trade (counted and
reported). Without a stop the exit is the exit candle's daily close. R = move in the trade's favour / initial risk.

## Costs

- Round trip **$0.60** (the gold spread $0.30 plus half a spread of slippage on each of two market orders, the paper-fill
  model of `fills.mjs`), charged as $0.60 / initial risk.
- **Financing on buys only**: `nights(entry close, exit)` x `FIN.xau.long` (0.0148 % of price a rollover, the demo broker's
  XAUUSD swap of 11 Nov 2026, imported from `council/fills.mjs`) x entry / risk. Sells pay and receive nothing (as every gold
  study here; today's rate is used for every year).
- 2x costs: $1.20 and twice the financing.

## Statistics and the bar

- t on calendar-month sums of net R (trades grouped by the month of their entry; every test has at most one trade a month,
  so this equals the per-trade t). One-sided p in the rule's sign (net R > 0).
- **Holm over T1, T2, T3** on the out-of-sample one-sided p's.
- **Placebo**: 40 seeded draws (seed 20261114). Each draw replaces every out-of-sample event with a window of the SAME length
  (entry close to the close 4 candles later) whose entry candle is drawn at random among the same quarter's (T1, T3) or
  month's (T2) candles that end at least 5 candles before the event's entry (no overlap with the quarter-end window); the
  side comes from the same rule applied at the placebo entry (quarter- or month-to-date return at that close); same stop,
  costs, financing. The rule beats a seed when its out-of-sample mean net R is above that seed's mean.
- **A test passes only if ALL hold**: out-of-sample net R > 0 with month t >= 2; Holm-adjusted one-sided p < 0.05;
  in-sample net R > 0 (same sign); out-of-sample net R still > 0 at 2x costs; the rule beats at least 38 of 40 placebos.
- **Verdict**: PASS only if T1 passes; T2 and T3 are reported with their own pass / fail. Also reported, not gating: gross
  R, net R at 2x costs, win rate, stops, buys against sells, by year, and the daily-close-to-H1 parity of the files.
- Nothing is called an edge without n and t.

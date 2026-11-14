# Pre-registration: gold after an AUD/JPY carry crash day (14 Nov 2026)

Written and pushed alone, before any gold outcome of this study was computed. Only the number of signal days in each window
was counted first (below), from AUD/JPY closes alone.

## Question

AUD/JPY is the market's carry barometer: long the high-yield Australian dollar against the funding yen. A day on which it
falls far more than usual is a carry unwind, a broad risk-off move in which leveraged positions are cut. Does gold, the
non-yielding haven, rise over the next week after such a day, by more than an ordinary buy of gold in the same year? And
after the opposite day (a carry rally, risk on), does gold do worse than an ordinary sell?

**Scope.** A stand-alone rule on gold. It is never a gate, exit, entry or size of the live gold book (Gold trend, Gold daily
engulf; docs/owner-decisions.md item 44), reads none of its positions or its 2006-17 records, and nothing here is compared
with or applied to that book. Paper research only: no live rule, size, filter, stop, config, cost constant or council
member changes, whatever the verdict.

## What is already known (dedupe, read before this was written)

- `gold-yen-surge` (branch, FAIL 0 of 3): gold after a USD/JPY 1.5 sd day, 1 and 3 days. The signal there is the yen
  against the DOLLAR (a dollar move as much as a risk move); here it is the yen against the Australian dollar, the
  textbook carry cross, with no dollar leg, and the hold is a week.
- `risk-spill-jpy` and `risk-cross` (branches, FAIL): trade AUD/JPY itself (after an S&P session; in a calm S&P uptrend).
  Gold is not traded.
- `fx-carry` (FAIL): a carry basket of currencies. `gold-haven-shock`, `gold-haven-catchup`, `gold-em-fx-stress`,
  `gold-commodity-fx-lead`, `gold-currency-breadth`: other signals (equity shocks, haven gaps, EM currencies, commodity
  currencies' trends, gold in many currencies). None uses an AUD/JPY carry-unwind day as the signal for a gold trade.
- The research topic list and `git branch -r` have no `carry-crash` / AUD/JPY-to-gold topic.

## Data (named before any result)

- OANDA mid complete UTC daily candles from council-data `research/daily/<key>.json` at commit
  `d8d68407bae5e7df75e54d57e4877dea340cc705` (read with `git show`, no network): `xau` (the trade) and `audjpy` (the
  signal). Weekend candles folded into Monday with `council/fills.mjs` `foldWeekend`.
- Market set: gold only (the trade), AUD/JPY only (the signal). No other market.
- Cache kept outside git and deleted at the end.

## Signal

- Daily close-to-close returns `y` of AUD/JPY on its folded candles; a gap of more than 5 calendar days between two candles
  restarts the history.
- `sd` = sample standard deviation of the 20 previous daily returns (the signal day itself excluded); `z = y / sd`.
- Carry crash day: `z < −1.5`. Carry rally day: `z > +1.5`.
- The trade enters at gold's next daily open, after the signal day's close. No later data is read.
- Events counted before this file (AUD/JPY only): in sample 2007-16 216 crash and 182 rally days of 2,605; out of sample
  2017 to Oct 2026 191 crash and 177 rally days of 2,563. Every test has at least 100 events in each window.

## Tests (at most three, Holm over all three)

| Test | Signal | Side | Hold |
|---|---|---|---|
| T1 (primary) | carry crash day | buy gold | 5 gold candles |
| T2 | carry rally day | sell gold | 5 gold candles |
| T3 | carry crash day | buy gold | 10 gold candles |

## Trade

- Entry at the open of gold's first daily candle whose UTC day is after the signal day; exit at the close of the hold's last
  candle.
- Stop 1.5 x ATR(14) of gold's 14 candles before the entry, on the losing side (1R). Every trade has a stop. A candle that
  opens through the stop fills at its open; a candle that touches it fills at the stop.
- One position at a time per test (a signal while a trade of that test is open is skipped).
- Costs: $0.60 a round trip, plus financing on buys: `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long`
  (0.000148 of price a rollover, the demo broker's XAUUSD long swap of 11 Nov 2026; today's rate charged for every year) x
  entry price / risk. Sells pay and are credited nothing. 2x costs = both doubled.

## Baseline: the same-side trade on every day of the same year

For each test and each calendar year, the baseline is the mean net R of the same trade (same side, same hold, same stop and
costs) entered after EVERY AUD/JPY signal-eligible day of that year (no one-at-a-time rule). A signal trade's **excess** =
its net R minus its entry year's baseline mean. The test statistic is the excess.

## Windows and statistics

- In sample: signals of 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.
- t on calendar-month sums of excess R (by exit month, empty months count as 0); one-sided p from the normal; Holm over the
  three tests' out-of-sample p.
- Placebo: 40 seeded draws (seeds 1-40) of as many random eligible days of the out-of-sample window as the test has
  signals, run through the same trade and excess; the real excess month t must beat at least 38 of 40.

## Pass bar (per test; the study passes only if T1 passes)

1. Out of sample excess month t >= 2 and Holm p < 0.05.
2. Out of sample net R a trade > 0, and still > 0 at 2x costs.
3. In sample excess R a trade > 0 (same sign).
4. Placebo beaten at least 38 of 40.
5. Out of sample n >= 30 trades.

Verdict PASS (T1 passes), PARTIAL (only T2 or T3 passes), else FAIL. Nothing is called an edge without n and t; whatever the
verdict, nothing live changes and no proposal is written by this study.

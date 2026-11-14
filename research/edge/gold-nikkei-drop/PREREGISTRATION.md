# Does gold rise after a large Nikkei 225 down day? Pre-registration

Written and committed **before** any return below was computed (14 Nov 2026). Only event COUNTS were read before writing
(`node run.mjs count <dir>`, which reads no price change after a signal); the data, the markets, the signal, the trade, the
costs, the statistics and the pass bar are fixed here. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. **A stand-alone rule on gold (XAU/USD)**: not a gate, filter, size step, entry or exit for the live gold
book (Gold trend, Gold daily engulf, Mosha cycle), never compared with or applied to it, and it does not use the book's
2006-17 positions (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member changes,
whatever the outcome.

## Question and economic reason

A large fall of the Nikkei 225 is a risk-off event that starts in the Asian session (yen repatriation, carry unwinds, Japanese
institutions de-risking) and is often followed by safe-haven demand elsewhere. The hypothesis: **after a day on which the
Nikkei 225 falls by an unusually large amount for its own recent history, gold rises more over the next days than it does
after an ordinary day of the same year.**

## Dedupe (read before writing this)

- `gold-haven-shock` (branch, FAIL): gold after a US index shock day (S&P 500 / Nasdaq 100 below -2 sd). US indices, not Japan.
- `gold-hk-stress` (branch, FAIL): gold after Hong Kong under-runs the S&P 500 over 5 days (a relative China gap).
- `gold-carry-crash` (branch, near miss, AUD/JPY): the yen carry crash; not re-tested here and no FX pair is read.
- `gold-equity-bear`, `gold-liquidation-day`, `gold-em-fx-stress`, `gold-oil-lead`, `risk-spill-jpy`, `gotobi-jp225`: US
  equities, gold's own days, EM FX, oil / copper, the yen after the S&P session, a Nikkei calendar trade. None buys gold on a
  Nikkei down day.
- No study in `research/edge/`, on a remote branch or in the scratch topics list reads a `jp225` down day for a gold trade.

## Data and markets (named before any result)

- council-data `research/daily/xau.json` (traded) and `jp225.json` (Japan 225 CFD, OANDA `JP225_USD`), OANDA mid daily
  candles, UTC days, read with `git show origin/council-data:…` at commit `d5a081937` (no network). Saturday / Sunday candles
  folded into the next weekday with `council/fills.mjs` `foldWeekend`. No other market is read.
- Candle caches are kept outside git (`node run.mjs fetch <dir>`), deleted after the run.

## The rule

- **Nikkei return** of candle day D: `ln(close_D / close of the previous jp225 candle)`, known at the UTC close of D.
- **Drop day**: D is also a gold candle day and its return is at or below the q-quantile (sorted value at index
  floor(q x 249)) of the 250 jp225 returns BEFORE D (D itself not included).
- **Trade**: buy gold at the open of the first gold candle after D. Stop = entry - 2 x ATR(20), the ATR of the 20 gold candles
  before the entry candle. Every trade has this stop. Exit at the close of the H-th candle (the entry candle is the first), or
  at the stop (a candle opening through the stop exits at its open, else a low at or under the stop exits at the stop). No
  target, no break-even, no trail. One trade at a time: a signal while a trade is open is skipped.
- **Costs**: $0.60 a round trip in price, plus financing on the buy: `nights(entry, exit)` x `FIN.xau.long` (council/fills.mjs,
  the demo broker's measured XAUUSD swap of 11 Nov 2026, used for every year) x entry price. R = (exit - entry - costs) /
  (entry - stop). Twice the costs is also reported.
- **Baseline**: the same buy (same stop, hold, costs) after EVERY eligible day, drop days included, each its own trade
  (overlap allowed). Excess of a signal trade = its net R - the baseline's mean net R over the signal days of the SAME
  calendar year (the same-side trade taken after every day of that year, so gold's yearly drift is removed).

## Tests (three, Holm over the three)

| Test | q (quantile) | H (candles held) | events counted before writing (non-overlapping, IS / OOS) |
|---|---|---|---|
| T1 (primary) | 0.10 | 5 | 156 / 170 |
| T2 | 0.05 | 3 | 118 / 122 |
| T3 | 0.15 | 10 | 151 / 156 |

## Windows

Signal days: in sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31.

## Statistics and pass bar

- t on calendar-month sums of the excess (months by exit stamp, empty months 0). One-sided p, normal approximation, Holm over
  the three out-of-sample tests.
- **Placebo**: 40 seeded draws (mulberry32, seeds 1-40) of as many random eligible days as there are drop days out of sample,
  run through the same one-at-a-time simulation; the real month t is ranked against them.
- A test **passes** only if all hold: out-of-sample excess month t >= 2 and Holm p <= 0.05; in-sample excess > 0;
  out-of-sample net R a trade > 0; out-of-sample excess still > 0 at twice the costs; above at least 38 of the 40 placebos.
- **Verdict**: PASS if T1 passes; "lead only" if only T2 or T3 passes; FAIL otherwise. A pass is a lead to replicate, never a
  live rule without the owner.

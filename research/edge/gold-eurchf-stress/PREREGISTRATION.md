# Pre-registration: does European stress, read in EUR/CHF, lead spot gold over the next four weeks? (14 Nov 2026)

Written and pushed alone, before any price of this study was read. Paper research only, a **stand-alone cross-market rule**:
never a gate, entry, exit or size of the live gold book, and it does not use that book's positions or its 2006-17 test window
as a book (owner decision 44). Nothing live changes and no proposal is written whatever the result.

## Hypothesis and economic reason

The Swiss franc and gold are Europe's two classic places to hide. When euro-area stress builds (sovereign spreads, bank
funding, a crisis of the single currency) European money sells euros for francs, and some of the same money buys gold, which
is priced in dollars but is a store of value outside any one currency or banking system. EUR/CHF is a cheap, daily, keyless
reading of that stress: a sharp fall of EUR/CHF = the franc bid = stress rising. The claim: **a sharp four-week fall of EUR/CHF
is followed by gold rising over the next four weeks, and a sharp four-week rise (stress unwinding, the franc sold) by gold
falling**, because the gold leg of the flight to safety is slower and longer-lasting than the currency leg (physical and fund
buying is spread over weeks). Nearest tested topics, and why this is not a duplicate: `chf-haven` (the franc after an S&P 500
shock; no gold), `gold-haven-shock` (gold the day after an equity shock; 1-5 day holds, US equity trigger), `gold-currency-breadth`
and `gold-dollar-lead` (the dollar against gold), `gold-commodity-fx-lead` (commodity currencies). No study has read EUR/CHF as
a lead for gold.

## Data (named before any result)

- Council-data `research/daily/xau.json` and `research/daily/eurchf.json` (OANDA mid, UTC daily candles), read with
  `git show origin/council-data:…` (no network); the commit is recorded in result.json. Weekend candles folded into Monday
  with `council/fills.mjs` `foldWeekend`. Gold from 2006-03-20, EUR/CHF from 2002.
- **Market set: spot gold (XAU/USD) only, signal from EUR/CHF only.** No other market is traded or tested.

## Rule

- **Signal**, once a week at gold's last daily candle of each Monday-based week (normally Friday): `r` = EUR/CHF's return
  over the last 20 EUR/CHF daily closes up to and including that same UTC day (close / close 20 candles earlier - 1). The
  EUR/CHF candle must exist on that day stamp; otherwise no signal that week.
- `r <= -2.0 %` → **long gold** (stress rising). `r >= +2.0 %` → **short gold** (stress unwinding). Otherwise nothing.
  Fixed thresholds, not z-scores, because the Swiss National Bank's 1.20 floor (Sept 2011 - Jan 2015) made EUR/CHF's own
  volatility near zero for three years and a z-score would turn tiny moves into signals. The floor years simply give few signals.
- **Entry** at the open of the first gold candle on a later UTC day (normally the Sunday reopen, folded into Monday).
- **Stop** (every trade has one): 2 x ATR(20) of the 20 gold daily candles before the entry candle, from the entry price; a
  candle that opens through the stop fills at its open, else the stop fills at the stop.
- **Exit** at the close of the 20th gold candle held (about four weeks), unless stopped first. No target, no break-even.
- One position at a time: a signal while a trade is open is skipped; the next trade may start on a signal after the exit.

## Costs

- $0.60 a round trip on every trade ($0.30 spread + $0.15 slippage on each of the two market orders, the same figure the other
  14 Nov gold studies used), plus overnight financing on **buys only**: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of
  price a rollover, the demo broker's long gold swap of 11 Nov 2026, `council/fills.mjs`) x the entry price, in R. Shorts are
  charged and credited nothing (as `FIN.xau.short = 0`). Today's rate is charged for every year. Cost share reported = mean
  cost in R / mean absolute gross R.
- R = price move / the stop distance. Median stop expected well above $10 (2 x ATR(20) of gold is $25-$120 over the years);
  reported.

## Windows

- In sample: signals from 2007-01-01 to 2016-12-31. Out of sample (decisive): 2017-01-01 to 2026-10-31.

## Tests (three, Holm over all three on the one-sided out-of-sample p)

- **T1 (primary)**: the both-sided rule (longs and shorts in one stream, one position at a time).
- **T2**: the long leg alone (only the long signals).
- **T3**: the short leg alone (only the short signals).
- Statistic: t of the calendar-month sums of net R (every month of the window counts; a month with no closed trade is 0),
  one-sided p from the normal approximation, Holm-adjusted over T1-T3.
- **Baselines (reported, not tested)**: the unconditional long (every weekly signal day treated as long, the same hold, stop,
  costs and one-at-a-time rule) and the unconditional short; T2 is read against the first, T3 against the second, and T1 is
  read against a both-sided stream that only follows gold's own four-week sign (informational: a check that EUR/CHF adds
  something to gold's own trend).

## Placebo

- 40 seeded draws (seeds 1-40, mulberry32): the same number of signals and the same multiset of sides as the real T1
  out-of-sample stream, placed on randomly chosen eligible weekly signal days of the out-of-sample window; same trade rules
  and costs. Reported: how many of the 40 placebo month-sum t reach the real one.

## Pass bar (all must hold, for T1 to pass)

1. Out-of-sample net month-sum t >= 2 AND Holm-adjusted p < 0.05.
2. In-sample net R a trade > 0 (same sign).
3. Out-of-sample net R a trade > 0 at twice the costs.
4. Out-of-sample n >= 30 trades.
5. The real out-of-sample t above at least 38 of the 40 placebos.

T1 passing = PASS (a lead to replicate, not an edge). T2 or T3 passing alone = PARTIAL. Otherwise FAIL. Whatever the result:
no live change, no proposal; a pass would need its own replication on other years or another stress gauge before anyone calls
it more.

## Deliverables

`run.mjs` (`fetch <dir>` / `full <dir>`), RESULT.md (verdict in the bold line), result.json, `tests/gold-eurchf-stress.test.mjs`,
`out/` rebuilt. Candle copies stay outside git.

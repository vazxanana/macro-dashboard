# Gold bought in its quiet stretches, held wide: pre-registration (14 Nov 2026)

Written and pushed **alone, before** `run.mjs` exists and before any return, R or t of the rules below was computed. Only
the number of qualifying days per window was counted (below), from the price series' own volatility, no return read.
Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. A stand-alone rule of its own: it reads no trade record or position of the live gold book (Gold trend,
Gold daily engulf), is not a gate, exit, entry or size of it, and proposes none (docs/owner-decisions.md item 44). Nothing
live changes whatever the outcome. ICT is not involved.

## Question

Gold's volatility rises in its rallies (the "inverse leverage" effect of a haven asset: spot and volatility tend to move up
together). If so, a buy made while gold is unusually quiet sits before the moves that lift both price and volatility. Does
a gold buy entered when the 20-day realised volatility is in the **lowest third of the past year**, held with a **wide time
exit**, earn more than the same buy entered on any day of the same year?

## Dedupe (read before writing)

- `gold-vol-target` (branch): exposure of a passive holding scaled weekly by 1 / trailing volatility, judged on Sharpe against a
  constant holding. Continuous scaling of every day, no event, no stop, no comparison with the same trade on other days. FAIL.
- `gold-squeeze` (branch): Bollinger-inside-Keltner squeeze **release** breakout (enter on the break of the squeeze, both
  sides, short holds). FAIL. Here there is no breakout trigger: the quiet state itself is the entry, long only, held 20 / 60
  days.
- `nr7-breakout`, `gold-inside-day` (branches): a single narrow candle and a stop order at its high / low. FAIL.
- `gold-volvol-switch`, `gold-range-expansion`, `gold-vol-breakout*`, `gold-bond-vol-spike`, `gold-silver-vol-ratio`: ATR-trend
  switch, wide-day follow-through, volatility breakouts, a bond-volatility trigger, a ratio. None conditions a buy on the
  percentile of gold's own realised volatility.
- `vol-managed`, `vol-managed-index`, `index-low-vol`: indices, not gold.
- `research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`): does not list it.
No study has bought gold on its own low-volatility percentile and compared it with the same buy on every day of the year.

## Data (named before any result)

- Market set: **spot gold only**, `git show origin/council-data:research/daily/xau.json` (OANDA mid XAU/USD daily candles,
  complete UTC days, 20 Mar 2006 to the file's last day), weekend candles folded into the next weekday with
  `council/fills.mjs` `foldWeekend`. No network, no cache written.
- Windows by the **entry day**: in sample 2007 (first qualifying day 4 Apr 2007, when a full year of volatility exists) to
  Dec 2016; out of sample Jan 2017 to Oct 2026. A trade whose exit is not on file yet is dropped (counted).

## The rule

- `rv20(D)` = sample standard deviation of the 20 daily log close-to-close returns ending at D's close.
- `pct(D)` = share of the 252 previous trading days' `rv20` values strictly below `rv20(D)` (candles up to D only).
- **Quiet day**: `pct(D) < 1/3`. **Loud day** (contrast): `pct(D) >= 2/3`.
- Entry: buy at D's close. Stop: `3 x ATR(20)` below the entry, ATR of the 20 candles ending at D (every trade has a stop
  from the moment it is entered; a gap through it fills at the open, `stopFill`). Exit at the close of the H-th trading day
  after D, or at the stop. 1R = the stop distance.
- **Every qualifying day is a trade** (positions overlap, as the baseline's do).
- Costs: **$0.60 a round trip**, plus financing `nights(entry close, exit) x FIN.xau.long x entry` (`council/fills.mjs`,
  0.000148 of price a rollover, the demo broker's XAUUSD swap of 11 Nov 2026, Wednesday three) on every buy. 2x costs =
  $1.20 and twice the financing. Net R = (exit - entry) / risk - 0.60 / risk - financing in R.
- **Baseline**: the same buy (same stop rule, same H, same costs) entered at the close of **every** trading day of the same
  calendar year. A rule trade's **excess** = its net R minus the mean net R of its year's baseline. This removes gold's drift
  of that year: a rule that only rides the drift has an excess near 0.

## Tests (three, Holm over all three)

| Test | Days | Hold H |
|---|---|---|
| T1 (primary) | quiet days | 20 trading days |
| T2 | quiet days | 60 trading days (the wide exit) |
| T3 | loud days (contrast) | 20 trading days |

Statistic of each test: the **excess**, summed by calendar month of entry; t = mean / standard error of the month sums,
with a Newey-West correction because the holds overlap from one month to the next (lag 1 for H 20, lag 3 for H 60); one-sided
p (excess > 0) from Student's t with months - 1 degrees of freedom; Holm over the three tests. The plain month-sum t (no
correction) and the gross figures are reported beside it.

## Pass bar (all must hold, judged on T1; T2 and T3 are reported with the same checks)

1. Out of sample, excess > 0 with Newey-West month t >= 2 **and** Holm p < 0.05.
2. Out of sample, the rule's own net R a trade > 0.
3. In sample, excess > 0 (same sign).
4. Out of sample, net R a trade > 0 **and** excess > 0 at 2x costs.
5. Placebo: 40 seeded draws (seed 20261194 + k). Each draw replaces every out-of-sample rule trade by the trade of a random
   trading day of the same calendar year (same H, stop, costs); its statistic = mean excess. The rule's mean excess must be
   above at least 38 of 40.

A pass is a lead for the owner, never a live rule, and would need replication on markets or years it did not use. A fail
is reported as a fail; no threshold, hold, percentile or stop is changed after the run.

## Counted before this was written (qualifying days, no returns read)

| Window | Trading days | Quiet days (T1, T2) | Loud days (T3) |
|---|---|---|---|
| 2007-04 to 2016-12 | 2,535 | 968 | 878 |
| 2017-01 to file end (13 Nov 2026) | 2,562 | 918 | 899 |

Every test has well over 100 entries in each window. Because the holds overlap, the effective number of independent
observations is about the number of months (about 117 in each window); the Newey-West month t is what is judged. Also
reported, not judged: the one-position-at-a-time version of T1 (skip a quiet day while the previous trade is open).

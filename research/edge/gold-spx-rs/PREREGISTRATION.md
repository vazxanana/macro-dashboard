# Pre-registration: gold against the S&P 500, 3-month relative strength as a gold timing rule (14 Nov 2026)

Written and pushed before any number of this study is computed. No return of the rule below has been looked at.

## Why
Gold and US stocks compete for the same "risk on / risk off" money. A simple idea that no study in `research/edge/` has tested:
when gold has beaten the S&P 500 over the last three months, keep buying gold for the next month; when it has lagged, sell it.
Nearest studies, and why this is not one of them: `dual-momentum` (allocates between SPX500, gold and cash, judged against a
50/50 portfolio: an allocation rule, not a gold long / short timing); `gold-tsmom` (gold's own 12-month return, 1-6 months
reported); `copper-gold` (the copper / gold ratio as a signal for stocks); `gold-haven-shock` (gold after one S&P shock day);
`risk-cross` (AUD/JPY and NZD/JPY by the S&P 200-day average). Test T3 below isolates what relative strength adds beyond gold's
own 3-month return.

A stand-alone rule. It is NOT a gate, exit, entry or size of the gold book (Gold trend + Gold daily engulf), reads none of its
positions and uses nothing of its 2006-17 position records (owner item 44 stands). Research only: nothing live changes; a PASS
would only be a proposal for a paper shadow that the owner may approve.

## Data (fixed before any result)
OANDA mid daily candles (UTC days), council-data `research/daily/xau.json` (from 20 March 2006) and
`research/daily/spx500.json` (from 2003), read with `git show origin/council-data:…` (no network, kept out of git). Weekend
candles are folded into the next weekday with `council/fills.mjs` `foldWeekend` (each market on its own). Market set: gold
(traded) and SPX500 (signal only). Nothing else.

## The rule
- **Month end** of a market = its last weekday candle of a calendar month; C(m) = that candle's close.
- **Signal** at gold's month end of month M (both markets' month-M closes are known at that time; SPX500's month end is never
  later than gold's): RS = ln(C_gold(M) / C_gold(M-3)) - ln(C_spx(M) / C_spx(M-3)). RS > 0 = buy gold, RS < 0 = sell gold,
  RS = 0 or a missing close = no trade.
- **Holding month M+1**: entry at the OPEN of gold's first weekday candle after its month end M; exit at the OPEN of gold's
  first weekday candle after its month end M+1. Every month is closed and reopened in full (a cost every month).
- **Stop (every trade has one)**: 3 x ATR(20) from the entry, ATR = simple mean of the last 20 true ranges of gold's weekday
  candles up to and including the month-end candle. Fixed for the month, never moved. Checked on every candle of the holding
  month from the entry candle on, stop first: a candle that OPENS through the stop exits at its open (never on the entry
  candle, whose open is the entry), else a candle whose low (buy) / high (sell) reaches it exits at the stop. After a stop the
  trade is flat until the next month end.
- **R** of a trade = direction x (exit - entry) / r0 - costs, r0 = 3 x ATR.
- **Costs**: $0.60 a round trip (spread and slippage) on every trade: 0.60 / r0. Financing on buys only:
  `nights(entry time, exit time)` x `FIN.xau.long` (0.000148 of price a rollover: the demo broker's XAUUSD swap of
  11 Nov 2026, charged for every year as the council's studies do) x entry / r0; entry time = the entry candle's 00:00 UTC
  stamp, exit time = the exit candle's stamp, or 22:00 UTC of the stop day (that day's rollover not charged). Sells are
  charged and credited nothing. **2x costs** = $1.20 and twice the financing.
- **Cost share, stated before any result** (structural, from the ATR rule only): gold's daily ATR is roughly 1-1.5 % of price,
  so r0 is roughly 3-4.5 % of price and at least about $25 in every year since 2006 (median well over $10): the $0.60 is about
  0.01-0.02R a trade; financing on a buy held a full month (about 30 rollovers) is about 0.10-0.15R. So the stop size meets the
  0.06R bar for spread costs; financing is a real carry on the buy months and is charged in full.

## Windows
In sample: holding months January 2007 to December 2016. Out of sample: January 2017 to October 2026 (the last complete
month). Months before 2007 are not used.

## Tests (three, Holm over all three on the out-of-sample p)
t on calendar-month sums: each holding month gives one number (that month's trade R; months with no trade are left out of
the series of that test); t = mean / (sd / sqrt n); two-sided p from Student's t with n - 1 degrees of freedom.
- **T1 (PRIMARY, both-sided)**: the switch above, every month, buy when RS > 0, sell when RS < 0.
- **T2 (against the unconditional same-side baseline)**: a BUY in every month (same entry, exit, stop and costs, the
  unconditional baseline); Welch t of buy R in months with RS > 0 against buy R in months with RS < 0. Does the RS sign
  separate gold's next month?
- **T3 (beyond gold's own momentum)**: T1's trades only in the months where the sign of RS differs from the sign of gold's own
  3-month log return (the months where relative strength says something momentum does not).

## Placebo (40 seeds, fixed: seeds 1..40, mulberry32)
- T1 and T3: each seed gives every month of the test a random side (buy / sell, probability 1/2), same stops and costs; the
  out-of-sample net t of each seed. Reported: the 95th percentile and how many seeds reach the rule's t.
- T2: each seed shuffles the RS signs among the out-of-sample months; the Welch t of each seed, as above.

## Pass bar (verdict on T1)
PASS only if T1 has all of: out-of-sample net t >= 2 and Holm-adjusted p < 0.05; in-sample net mean of the same sign
(positive); out-of-sample net mean still positive at 2x costs; and the rule's out-of-sample t above the placebo's 95th
percentile. Otherwise FAIL. T2 and T3 are reported with their own Holm p and do not rescue a failing T1.
A PASS leads to a proposal for a paper shadow, never a live change.

## Reported, not judged
Gross (before any cost) and net for every test and window; months long / short; stops hit; year by year; the long side and
the short side of T1 apart; the always-buy baseline after costs.

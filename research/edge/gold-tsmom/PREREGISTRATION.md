# Pre-registration: published time-series momentum on gold, out of sample (13 Nov 2026)

Written and pushed before any number of this study is computed.

## Why
Time-series momentum (Moskowitz, Ooi and Pedersen 2012, "Time series momentum", Journal of Financial Economics; Hurst, Ooi and
Pedersen, "A century of evidence on trend-following investing") is one of the best-documented effects across futures markets,
gold included. This study tests the textbook rule on gold, as published, with no parameter chosen by us after seeing data.

It is a stand-alone rule. It is NOT a gate, exit, entry or size of the gold book (Gold trend + Gold daily engulf) and does not
read or change that book (owner decision 44 stands). Research only: nothing live changes; a PASS would only be a proposal for a
paper shadow system that the owner may approve.

## Data
OANDA mid XAU_USD daily candles (UTC days) from March 2006, council-data `research/daily/xau.json` read with
`git show origin/council-data:research/daily/xau.json` (no network); candles dated Saturday or Sunday (the reopen stubs) are
dropped, so Friday's close is followed by Monday's (the stub's move is inside Monday's close-to-close). No other data.

## The rule (fixed here)
- **Month end** = the last weekday candle of a calendar month. **Signal** at a month end = sign of the 12-month return,
  C(this month end) / C(the month end 12 months earlier) - 1. Known at that close.
- **Holding month**: the position opens at the OPEN of the first candle after the month end and closes at the OPEN of the first
  candle after the next month end (then the next month's position opens at that same open). Every month is closed and reopened
  in full.
- **Variants judged**: (A) long / short: long if the signal is > 0, short if < 0; (B) long / flat: long if > 0, flat otherwise.
- **Size**: weight w = min(3, 0.10 / sigma), sigma = annualised (x sqrt 261) exponentially weighted standard deviation of daily
  close-to-close log returns, centre of mass 60 days (lambda = 60/61; the published method), using returns up to and including
  the month-end close only; at least 60 returns before the first month is traded. w is a fraction of capital (notional / capital).
- **Catastrophe stop** (every position has one): 3 x ATR(20) from the month's entry price, ATR = the simple 20-day average true
  range of the daily candles up to and including the month-end candle. Checked on every daily candle of the holding month,
  stop first: a candle whose low (long) / high (short) reaches the stop exits at the stop, or at the candle's open if it opened
  through it. After a stop the position is flat until the next month end, where it is re-entered by the rule.
- **Monthly return** (fraction of capital) = w x direction x (exit - entry) / entry - costs, simple (no compounding).
- **Costs**: $0.30 an ounce a round trip on every month's position (closed and reopened each month): w x 0.30 / entry.
  Financing on longs with `council/fills.mjs`: `nights(entry time, exit time)` x `FIN.xau.long` x w (the demo broker's rate of
  11 Nov 2026, charged for every year, as the council's studies do). A short is charged nothing and credited nothing
  (`FIN.xau.short` = 0).

## Windows
- **Confirmation (judged)**: holding months April 2007 to December 2017 (2006 has no 12-month history; the same untouched
  2006-17 window the council's gold studies use as out of sample).
- **2018 to now**: holding months January 2018 to the last complete month (October 2026), reported apart.

## Pass (each variant on its own)
On the confirmation window, all of:
1. annualised Sharpe of monthly returns (mean / sd x sqrt 12) > 0.3;
2. t of the monthly returns (mean / (sd / sqrt n)) >= 2, and its one-sided p (normal) passes Holm at 0.05 over the two
   variants (A, B);
3. return per unit of drawdown (sum of monthly returns / worst drawdown of their running sum) greater than buy-and-hold gold's
   on the same months; buy-and-hold = long 1x every month, same opens, before any cost or financing (the harder hurdle);
And on 2018 to now: sum of monthly returns > 0.

Verdict: PASS if at least one variant passes; FAIL otherwise. A PASS leads to a proposal
(`research/proposals/2026-11-13-gold-tsmom.md`), never a live change.

## Reported, not judged
1-, 3- and 6-month lookbacks (same sizing, stop and costs) on the same months; buy-and-hold after financing; year by year;
number of stops; the months traded long / short / flat; the result without the stop and before costs.

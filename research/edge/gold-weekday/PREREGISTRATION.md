# Pre-registration: the day-of-the-week effect on spot gold (14 Nov 2026)

Written, committed and pushed alone before any number of this study was computed. Paper research: nothing here is read by
the council, the mirror or the page, and no live rule changes whatever the verdict. Not an ICT study.

**Item 44 (docs/owner-decisions.md) and what this study is not.** A NEW stand-alone calendar rule on gold. It is not a gate,
an exit, an entry or a size of the gold book (Gold trend / Gold daily engulf), reads none of that book's trades or signals,
and its verdict says nothing about that book. Decisive window 2017 to the end of October 2026; 2007-16 is in sample.

## Why this topic, and what is already tested (dedupe)
The backlog of 14 Nov 2026 (`research/proposals/2026-11-14-untested-backlog.md`, branch `untested-backlog`) ranks seven
candidates; none is a stand-alone gold rule (FOMC cycle on US indices, announcement days on indices / bonds, cross-sectional
seasonality, non-US holidays, volume premium and volume reversal on indices, overnight vs intraday across indices). So this
topic is chosen here, as the brief allows, and said so.
- Prior (cited from memory, not opened from this sandbox): Ball, Torous and Tschoegl, "Gold and the weekend effect", Journal of
  Futures Markets 1982; Ma, "A further investigation of the day-of-the-week effect in the gold market", Journal of Futures
  Markets 1986; Blose and Gondhalekar, "Weekend gold returns in bull and bear markets", Accounting and Finance 2013. The
  reading taken here: gold's Monday return was lower than other days'. No figure of those papers is relied on.
- Nearest tested: `fx-weekday` (#919, the dollar basket by weekday, FAIL; forex, not gold); `seasonality` (main: the Friday
  close -> Monday close short on NQ / ES, not gold; gold's PM fix and Asia windows); `gold-weekend-gap` (branch, fading the
  Sunday reopen gap to Friday's close: FAIL) and `gold-weekend` (main, how the systems treat the Sunday stub). None traded
  gold by weekday. `gold-month-of-year` (#907) and `gold-turn-of-month` are other calendar cuts. So this is new.

## Data and the day
- OANDA mid H1 XAU_USD through the site's keyless candle proxy (`fetch.mjs` in this folder, a copy of the `gold-ibs` fetch; cache kept out of git), from
  2006-03 to the end of the data. Complete candles only.
- **Days are 17:00 New York trading days** built with `research/edge/gold-drd-long/run.mjs` `days` / `nyDay` (imported,
  unchanged; weekend hours dropped; Sunday evening hours belong to Monday). A day's weekday is that of its date (the date on
  which it closes at 17:00 New York).

## The rule (two tests, fixed now)
One trade per selected session: entry at the open of the session's first H1 candle (a market order; for Monday that is the
Sunday reopen, so Friday-close-to-reopen gap is NOT in the trade), exit at the close of the session's last H1 candle (a market
order). Stop = entry -/+ 1 x ATR(20), ATR(20) = simple mean of the true ranges of the 20 days ending the day before (true range
uses the previous day's close); checked on H1 from the entry candle on, a candle that opens through the stop fills at its open,
else at the stop. Nothing after the session is read.
- **T1 (primary): short gold on every Monday session** (the published weekend / Monday effect).
- **T2: the in-sample weekday.** On 2007-01-01 to 2016-12-31 only, compute the mean GROSS R of a long held over each weekday's
  session (Monday ... Friday) under the rule above; the weekday with the largest |mean| is chosen, long if its mean is
  positive, short if negative; that weekday and side are traded on 2017-2026. Its in-sample figure is fitted by construction,
  so its "same sign in sample" line is met trivially and is said to be uninformative in the report.

## Costs (every trade, in price)
- Spread $0.30 a round trip plus half a spread ($0.15) of slippage on each of the two market orders = **$0.60 a round trip**.
- Financing on longs only: `council/fills.mjs` `nights(entryTime, exitTime)` x `FIN.xau.long` (0.000148 of price a 22:00 UTC
  rollover, Wednesday three, the demo broker's XAUUSD swap of 11 Nov 2026; today's rate every year) x entry price. A session
  hold opens after one 17:00 New York rollover and closes at the next, so `nights` is expected to be 0 on almost every trade;
  that is reported, not assumed. Shorts pay and earn nothing.
- R = side x (exit - entry) / (1 x ATR) minus cost and financing in R; gross R beside it. **2x costs**: all doubled.

## Windows (by entry day)
- **Out of sample (decisive): 2017-01-01 to 2026-10-31.** In sample: 2007-01-01 to 2016-12-31 (2006 is warm-up).

## Statistics
- t on calendar-month sums of net R (every month of the window counts, 0 when nothing closed; a trade belongs to its exit
  month); one-sided p from the normal distribution; Holm over the two tests.
- Placebo, 40 seeds (fixed seeded generator): each real out-of-sample trade is moved to a random trading day of the same
  calendar year (any weekday), same side, same rule (session open to close, 1 x ATR stop), same costs. The rule's mean net R a
  trade is compared with the 40 seed means.

## Pass bar (per test; all needed)
1. Out of sample n >= 100.
2. Out of sample mean net R a trade > 0 and month-sum t >= 2 with Holm-adjusted p < 0.05.
3. In sample mean net R a trade > 0 (same sign).
4. Out of sample mean net R a trade still > 0 at 2x costs.
5. Beats the placebo: above at least 38 of the 40 seed means.

**Verdict**: PASS if T1 passes; else FAIL whatever T2 does (a T2 that passes alone is named "passes alone, not an edge until
replicated"). Reported besides, deciding nothing: gross R per weekday and side in both windows, by year, win rate, stops.

## Deliverables
`fetch.mjs`, `run.mjs`, `RESULT.md`, `result.json` in this folder; `tests/gold-weekday.test.mjs` (offline, hand-made candles).

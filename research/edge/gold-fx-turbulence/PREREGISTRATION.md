# Pre-registration: gold after a broad currency-turbulence day (14 Nov 2026)

Written and pushed alone, before `run.mjs` exists and before any gold return after a signal was computed. Paper research
only: a **stand-alone rule on gold**, never a gate, entry, exit or size of the live gold book (Gold trend + Gold daily
engulf), and none of that book's 2006-17 positions is read (owner decision 44). No live rule, config, cost constant, council
member or mirror setting changes, whatever the verdict. A pass would lead at most to a written proposal for a paper shadow.

## Why this idea, and why not the gap idea first considered

The idea area offered was gold's reaction to its own large gaps left unfilled during the day. Counted before this file (no
return read): on OANDA daily gold (UTC days, weekend folded into Monday) a day that never traded back into the prior day's
range occurred **3 times in 2007-16** and 15 times in 2017-26; a day that never traded back to the prior close 62 and 89
times. Gold trades almost round the clock, so its daily candles have no real opening gap; the reopen gaps that do exist (the
17:00 New York break, the Sunday reopen) were already tested (`gold-gap-open`, `gold-weekend-gap`, `weekend-gap-*`) and are
too few above a spread or two to reach 100 a window. So the gap idea cannot meet the 100-events bar and another idea is used.

## The idea

Some days the whole currency market moves hard at once: the euro, the pound, the yen, the Australian and Canadian dollars and
the franc all make unusually large moves against the US dollar on the same day (a broad repricing of rates, a policy shock, a
funding scramble). The claim tested: **after such a broad currency-turbulence day, gold rises over the following week by more
than it does on an ordinary day** (turbulence feeds demand for an asset outside the currency system). Two secondary readings:
gold continues its own move of that day, and the effect lasts two weeks.

The signal is the SIZE of the currency moves, not their direction. Nearest earlier studies, and the difference:
`gold-em-fx-stress` (emerging-market currencies falling together, a direction), `gold-carry-crash` (carry pairs falling,
a direction), `gold-haven-catchup` / `gold-yen-surge` / `gold-eurchf-stress` (single haven currencies, direction),
`gold-currency-breadth` / `gold-fx-high-count` (gold priced in other currencies), `gold-dollar-*` and `gold-dxy-month-shock`
(the dollar's direction), `gold-bond-vol-spike` (US 10-year bond volatility), `gold-rv-term` (gold's own volatility),
`gold-driven-day` (whether gold's move showed in EUR and GBP gold). None uses unsigned, simultaneous G10 currency turbulence.

## Data and market set (named before any result)

- council-data `research/daily/{xau,eurusd,gbpusd,usdjpy,audusd,usdcad,usdchf}.json` (OANDA mid daily candles, UTC days),
  read with `git show origin/council-data:…` (commit `338cfb45c` at writing; the run records the commit it read). Cache kept
  outside git and deleted after the run. Saturday / Sunday candles folded into the next weekday with `council/fills.mjs`
  `foldWeekend` (imported, not edited).
- **Gold (XAU/USD) is the only market traded.** The six USD majors are the signal only. No market is added after a result.
- A day is used for the signal only when all seven markets have a candle that day.

## Signal (counted before this file: 181 signal days in 2007-16, 175 in 2017-26, both at least 100)

- For each of the six pairs, log return of day D on folded closes, `r_D`, and `sd_D` = sample sd of the 60 returns of the
  60 common days before D (D excluded). Turbulence `U_D` = mean over the six pairs of `|r_D| / sd_D`. A day needs 61 earlier
  common days.
- **Turbulence day**: `U_D >= 1.5`.

## Tests (three, fixed; Holm over the three)

- **T1 (primary)**: buy gold at the open of the first gold candle after D, hold 5 candles.
- **T2**: trade gold in the direction of gold's own close-to-close move on D (up -> buy, down -> sell; a flat day is no
  trade), hold 5 candles.
- **T3**: buy gold as T1, hold 10 candles.

## Trade (every trade has a stop)

- Entry at the open of gold's first folded candle after D (the FX candles of D close at 00:00 UTC D+1, so D is known then).
- Risk 1R = 2 x ATR20, ATR20 = mean true range of the 20 gold candles before the entry candle. Stop = entry -/+ 1R.
- Each candle from the entry candle on: an open through the stop exits at that open; a low (buy) / high (sell) at or beyond
  the stop exits at the stop; otherwise out at the close of the Hth candle (the entry candle is the first). No target, no
  trail, no break-even.
- One position at a time per test: a signal while that test's position is open is skipped (counted).

## Costs

- $0.60 a round trip, plus financing on buys: `nights(entry time, exit time)` x `FIN.xau.long` (0.000148 of price a
  rollover, the demo broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`; today's rate charged for every year, as earlier
  studies did) x entry price. Exit time = the exit candle's end for a time exit, its start + 12 h for a stop. Sells are charged
  and credited no financing. Net R = gross R - costs / (1R in $). Also reported at 2x costs.

## Baseline, excess and statistics

- Windows by signal day: **in sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31.**
- Baseline per test and window: the same trade (same side, hold, stop and costs) entered after EVERY eligible day of the
  window (every day with a full look-back and a next gold candle), with no one-at-a-time rule. For T2 the side's own
  baseline (every-day buys for a buy, every-day sells for a sell). **Excess** of a trade = net R minus that baseline mean.
- t on calendar-month sums over all months of the window (a month with no trade counts 0), for excess R and for net R. One-
  sided p from the excess t (normal approximation); **Holm over T1-T3 on the out-of-sample p**.
- **Placebo** (40 draws, seed 118): the same number of signal days as the real test's, drawn at random from the window's
  eligible days, through the same trade and one-at-a-time rule (T2 takes gold's own sign of the drawn day). Reported: how many
  of the 40 placebo excess-month t the real one beats.
- **Control** (40 draws, seed 1118), keeps the drift and volatility of each year and removes the signal's information: each
  real signal day is replaced by a random eligible day of the SAME calendar year, then the same trade. Reported the same way.

## Pass bar (T1 decides the verdict)

PASS only if T1 meets all of: out-of-sample excess-month t >= 2 and Holm-adjusted p < 0.05; out-of-sample net R a trade > 0
with net-month t >= 2; in-sample excess of the same sign (> 0); out-of-sample net R a trade > 0 at 2x costs; the real
out-of-sample excess t above at least 38 of 40 placebo draws AND at least 38 of 40 control draws. T2 or T3 passing the same
bar while T1 fails gives INCONCLUSIVE (a hypothesis for a new pre-registration on other data, never a rule). Otherwise FAIL.
Nothing found here is called an edge without its n and t, and no threshold, hold or market is changed after the results.

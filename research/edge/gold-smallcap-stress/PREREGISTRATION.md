# Pre-registration: gold after small caps fall behind large caps (14 Nov 2026)

Written and pushed alone, before `run.mjs` exists and before any gold return after a signal was computed. Paper research
only: a **stand-alone rule on gold**, never a gate, entry, exit or size of the live gold book (Gold trend + Gold daily
engulf), and none of that book's 2006-17 positions is read (owner decision 44). No live rule, config, cost constant, council
member or mirror setting changes, whatever the verdict. A pass would lead at most to a written proposal for a paper shadow.

## Why this idea, and why not the ones first offered

- **Quarter-ends** (the area offered first): already tested in `gold-quarter-end` (fading the quarter-to-date move over the
  last 4 days, FAIL, n 39 out of sample) and `gold-quarter-open`; month-ends by `gold-turn-of-month`, `gold-month-handoff`,
  `gold-month-washout`. One event a quarter is about 40 a ten-year window, under the 100-event floor. Not repeated.
- **The days after the largest move of the past 60 days** (the fallback offered): about 1 day in 61, so about 41 a window,
  under the floor; and the reading is covered by `gold-max-effect` (largest day of the last 20, FAIL, n 133),
  `gold-shock-revert` (2 x ATR day, FAIL) and `gold-capitulation`. Not repeated.

## The idea

US small caps (Russell 2000) depend more on bank credit and on the domestic economy than the S&P 500. A week in which the
small caps fall far behind the large caps is a sign of tightening credit or a growth scare inside the US, which tends to
bring forward expected rate cuts and so lower real yields. The claim tested: **after small caps underperform large caps by an
unusual amount over five days, gold rises over the following week by more than it does after an ordinary day.** The mirror
(small caps far ahead: reflation, risk appetite, gold sold) and a two-week hold are the two secondary tests.

The signal is the RELATIVE move of two equity indices, not their level or direction. Nearest earlier studies and the
difference: `gold-index-dispersion` (dispersion across many indices on one day, unsigned), `gold-equity-bear` /
`gold-equity-new-depth` / `gold-equity-record` (the S&P's own level), `gold-spx-rs` (gold against the S&P),
`gold-spx-vol-regime` (S&P volatility), `gold-liquidation-day` (gold, S&P and the note all down),
`gold-equity-corr-momentum`. None uses the Russell 2000 against the S&P 500. (`smallcap-january` in the topic list is an
index calendar effect, not a gold rule.)

## Data and market set (named before any result)

- council-data `research/daily/{xau,spx500,us2000}.json` (OANDA mid daily candles, UTC days; council-data commit `bd4865a88`
  at writing; the run records the commit it read), read with `git show origin/council-data:…`. Cache kept outside git and
  deleted after the run. Saturday / Sunday candles folded into the next weekday with `council/fills.mjs` `foldWeekend`
  (imported, not edited). A day is used only when all three markets have a candle that day ("common day").
- **Gold (XAU/USD) is the only market traded.** US2000 and SPX500 are the signal only. No market is added after a result.

## Signal

- `rel_D` = 5-common-day log return of US2000 minus that of SPX500, closes of D and of the 5th common day before D.
- `sd_D` = sample sd of the 250 values `rel` of the 250 common days before D (D excluded). `z_D = rel_D / sd_D`. A day needs
  255 earlier common days.
- **Stress day** (T1, T3): `z_D <= -1.25` while `z` of the previous common day was above -1.25 (a fresh crossing).
- **Rally day** (T2): `z_D >= +1.25` while the previous day's `z` was below +1.25.
- Counted before this file, signal days only (no gold return read): stress 121 in 2007-16 and 122 in 2017-26 (to 31 Oct);
  rally 123 and 100. At the first threshold looked at, 1.5, the fresh crossings were 91 / 84 and 85 / 79 (under 100), so
  1.25 was fixed instead, before any gold figure. Both windows reach the floor of 100 events for every test.

## Tests (three, fixed; Holm over the three)

- **T1 (primary)**: after a stress day, buy gold at the open of the first gold candle after D, hold 5 candles.
- **T2**: after a rally day, sell gold the same way, hold 5 candles.
- **T3**: after a stress day, buy gold as T1, hold 10 candles.

## Trade (every trade has a stop)

- Entry at the open of gold's first folded candle after D (the index candles of D close at 00:00 UTC D+1, so D is known then).
- Risk 1R = 2 x ATR20, ATR20 = mean true range of the 20 gold candles before the entry candle. Stop = entry -/+ 1R.
- Each candle from the entry candle on: an open through the stop exits at that open; a low (buy) / high (sell) at or beyond
  the stop exits at the stop; otherwise out at the close of the Hth candle (the entry candle is the first). No target, trail
  or break-even.
- One position at a time per test: a signal while that test's position is open is skipped (counted).

## Costs

- $0.60 a round trip, plus financing on buys: `nights(entry time, exit time)` x `FIN.xau.long` (0.000148 of price a
  rollover, the demo broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`; today's rate charged for every year, as earlier
  studies did) x entry price. Exit time = the exit candle's end for a time exit, its start + 12 h for a stop. Sells are charged
  and credited no financing. Net R = gross R - costs / (1R in $). Also reported at 2x costs.

## Baseline, excess and statistics

- Windows by signal day: **in sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31.**
- Baseline per test and window: the same trade (same side, hold, stop and costs) entered after EVERY eligible common day of
  the window (full look-back and a next gold candle), with no one-at-a-time rule. **Excess** of a trade = net R minus that
  baseline mean of its side.
- t on calendar-month sums over all months of the window (a month with no trade counts 0), for excess R and for net R. One-
  sided p from the excess t (normal approximation); **Holm over T1-T3 on the out-of-sample p**.
- **Placebo** (40 draws, seed 125): the same number of signal days as the real test's, drawn at random from the window's
  eligible days, through the same trade and one-at-a-time rule. Reported: how many of the 40 placebo excess-month t the real
  one beats.
- **Control** (40 draws, seed 1125), keeps the drift and volatility of each year and removes the signal's information: each
  real signal day is replaced by a random eligible day of the SAME calendar year, then the same trade. Reported the same way.

## Pass bar (T1 decides the verdict)

PASS only if T1 meets all of: out-of-sample excess-month t >= 2 and Holm-adjusted p < 0.05; out-of-sample net R a trade > 0
with net-month t >= 2; in-sample excess of the same sign (> 0); out-of-sample net R a trade > 0 at 2x costs; the real
out-of-sample excess t above at least 38 of 40 placebo draws AND at least 38 of 40 control draws. T2 or T3 passing the same
bar while T1 fails gives INCONCLUSIVE (a hypothesis for a new pre-registration on other data, never a rule). Otherwise FAIL.
Nothing found here is called an edge without its n and t, and no threshold, hold or market is changed after the results.

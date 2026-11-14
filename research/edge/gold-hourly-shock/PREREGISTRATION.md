# Pre-registration: gold after a return shock on one H1 candle, fade or follow (14 Nov 2026)

Written and pushed alone, before any trade of this study is computed.

## Question
After an unusually large single H1 candle on spot gold, does price revert or continue over the next six hours?

## Scope (owner decision 44)
A **new stand-alone intraday rule**. It is not a gate, exit, entry or size of the live gold book (Gold trend + Gold daily
engulf), it reads none of that book's positions and it adds nothing to that book's 2006-17 window. Paper research only:
nothing live changes whatever the verdict; a PASS would be a proposal to the owner, never a live change.

## Why it is not a duplicate
- `gold-shock-revert` (13 Nov, FAIL): DAILY candles, a 2 x ATR day, hold three days.
- `gold-volume-spike` (branch, 14 Nov, FAIL): H1, but the event is TICK VOLUME over 3x the same hour's median, from 2016.
- `gold-haven-shock`: equity-index shock days, gold bought the next day. `nfp-follow`, `cpi-follow`: the first 15 minutes after
  a known release. `pre-release-drift`: the 24 hours before CPI / payrolls.
None defines the event as a close-to-close H1 RETURN beyond 3 standard deviations of the recent H1 returns, and none fades /
follows it with these levels.

## Data
OANDA mid H1 XAU_USD (`[t, o, h, l, c]`, UTC hour start), the cache built for this desk's gold research through the site's
candle proxy, 2006-03-19 to 2026-11-13 (kept out of git; `run.mjs` takes its path). No other price data. Candles before 2008
are used only for the warm-up of the volatility estimate.

## The event
- r(i) = ln(C(i) / C(i-1)) between consecutive candles of the file. A return whose candle starts more than 6 hours after the
  previous candle (weekend, holiday closure) is a GAP return: never an event and never in a volatility estimate.
- sd(i) = the sample standard deviation of the 500 previous non-gap returns (strictly before candle i; no look-ahead).
- **Shock** = a non-gap candle with |r(i)| > 3 x sd(i). Up shock if r > 0, down shock if r < 0.
- The candle that follows must start within 3 hours of the shock candle's start (else no trade: the next open would be after a
  closure).

## Release tag (reported both ways)
A shock is tagged a RELEASE shock when its hour [t, t + 3600) contains the release minute of a US CPI, payrolls (Employment
Situation) or scheduled FOMC statement. Dates (written into `run.mjs`, with the source of each list):
- FOMC: 2008-2021 the Federal Reserve's scheduled-meeting calendars as already used by `pre-fomc-drift` / `fomc-follow`
  (14:15 New York to 2012, 12:30 on the 2011-12 press-conference meetings, 14:00 from 2013); 2022 on `council/events.mjs`.
- Payrolls (08:30 New York): the BLS rule (third Friday after the reference week containing the 12th) with the exceptions used by
  `nfp-follow` (January one week later, the 4 July shift, the 2013 shutdown dates) for 2008-2021; 2022 on `council/events.mjs`.
- CPI (08:30 New York): 2012-2017 the list `cpi-follow` wrote from memory (ALL its dates, also the ones it dropped: a wrong
  tag only removes a candle from T3), 2018-2021 the BLS schedule copied in `research/edge/event-reaction/build.mjs`, 2022 on
  `council/events.mjs`. **2008-2011 CPI dates are not in the repository**: in sample those CPI hours are not tagged. To bound
  that, the report also shows T3 with every weekday candle that contains 08:30 New York removed ("broad tag"); report only.

## Trades (fills on H1, one position at a time per test, a shock while a position is open is skipped)
Entry at the open E of the candle after the shock. H, L = the shock candle's high and low; M = (H + L) / 2.
- **T1 fade**: against the shock (sell after an up shock, buy after a down shock). Stop $0.30 beyond the shock's extreme
  (sell: H + 0.30; buy: L - 0.30). Target M. Out at the close of the 6th H1 candle counted from the entry candle.
- **T2 follow**: with the shock. Stop at M. No target. Out at the close of the 6th H1 candle.
- **T3**: T1 on the shocks that are NOT release shocks (its own one-at-a-time stream).
- Skipped (counted in the funnel): the stop not on the losing side of E, or 1R (|E - stop|) under $0.30; for T1 also E already
  at or past M (the target is not ahead).
- Each candle from the entry candle on: a stop gapped through at the open fills at the open; a stop touched fills at the stop;
  the target touched fills at the target; **stop and target in the same candle = the stop**. Time exit at the 6th candle's close.
  A candle more than 6 hours after the previous one (a closure) ends the trade at that candle's open if not already out
  (gap exit, counted).
- R = (exit - E) x side / |E - stop|. **Costs**: $0.60 a round trip (spread and slippage), and on buys `council/fills.mjs`
  `FIN.xau.long` (0.000148 of price a rollover, the demo broker's XAUUSD swap of 11 Nov 2026) x `nights(entry, exit)` x E, in R.
  **2x costs**: $1.20 and twice the financing.

## Windows
In sample (IS) 2008-01-01 to 2016-12-31; out of sample (OOS) 2017-01-01 to the end of the data (2026-11-13). A trade belongs to
the window of its entry. The OOS halves for the halves check: 2017-2021 and 2022-now.

## Statistics
- t = one-sample t of the CALENDAR-MONTH sums of net R (months with at least one trade), per test and window.
- Holm over the 3 tests on the OOS one-sided p (normal approximation of the month t).
- **Placebo**, 40 seeds (mulberry32, seed 1..40), per test: the size class = non-gap candles with |r| / sd at or above the 95th
  percentile of |r| / sd over all eligible candles of 2008-now, and below 3 (so never a shock). For each shock the test could
  trade in the OOS window, draw (without replacement within a seed) a candle of that class from the OOS window with the same UTC
  hour of day (for T3, only from candles that are not release candles); run the same rule (its own direction, levels, costs,
  one at a time). Statistic: OOS net R a trade. "Beats" = the rule's OOS net R a trade above that seed's.
- Also run at 2x costs.

## Pass (all must hold, per test)
1. OOS net R a trade > 0;
2. OOS month t >= 2 AND Holm p <= 0.05;
3. positive in both halves: IS net R a trade > 0, and OOS net > 0 in 2017-2021 and in 2022-now;
4. OOS net R a trade > 0 at 2x costs;
5. beats at least 38 of the 40 placebo seeds;
6. OOS n >= 30.
Verdict PASS if any test passes, else FAIL. Never called an edge without its n and t.

## Reported, not tested
T1 and T2 on release shocks only and on non-release shocks only; T3 with the broad tag; gross figures; exits by kind; year by
year; shocks by hour of day; the median 1R in dollars.

## Repeat
`node research/edge/gold-hourly-shock/run.mjs <xau-h1.json>` writes `result.json` and `RESULT.md` in this folder.

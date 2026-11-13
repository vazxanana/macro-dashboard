# Pre-registration: the weekly US crude inventory report on WTI, fade or follow the first half hour (13 Nov 2026)

Written and pushed before any candle of this study is fetched or any number computed.

## Why
The US government's weekly petroleum status report (crude, gasoline and distillate stocks) is published on Wednesday at 10:30
New York and is the one scheduled weekly release that moves crude oil. No consensus figures are available to the council, so
the test uses only the price's own first reaction, read two pre-stated ways. Research only: nothing live reads this study.

## Data
OANDA mid M30 candles of `WTICO_USD` (the WTI crude CFD) through the site's keyless candle proxy (`/md/bars?sym=wtico&tf=30m`),
2015-11-01 (warm-up) to the last complete candle at the run (13 Nov 2026). Complete candles only; the cache stays out of git.
New York time from UTC by the US daylight-saving rule (`council/histdata.mjs` `nyOffsetH`; 2nd Sunday of March to 1st Sunday
of November, 02:00 local).

## Release calendar (fixed here, written into run.mjs; no other calendar is read)
- Normal week: Wednesday 10:30 New York.
- If any US federal holiday (observed date) falls on the Monday, Tuesday or Wednesday of that week: Thursday 11:00 New York.
  (The task brief names the Monday case; the Tuesday and Wednesday cases are added here because the release is not published on
  a federal holiday and is delayed a day; this is our stated approximation, not the publisher's own list.)
- Federal holidays: New Year's Day, Martin Luther King Jr. Day, Presidents' Day, Memorial Day, Juneteenth (from 2021),
  Independence Day, Labor Day, Columbus Day, Veterans Day, Thanksgiving, Christmas; a Saturday holiday is observed on the Friday
  before, a Sunday holiday on the Monday after.
- If the Thursday release day is itself a holiday, the week is skipped. Known limits, accepted: one-off delays (government
  shutdowns, system problems, the publisher's own schedule changes) are not modelled; they put noise into the reaction candle.

## The reaction candle and the two rules
Reaction candle = the M30 candle that opens at the release time (10:30-11:00, or 11:00-11:30 in a delayed week). Its direction is
up when close > open, down when close < open; a flat candle is no trade. Skip the event when the candle's range (high - low) is
under 0.3 x ATR(20), ATR = the simple mean true range of the 20 M30 candles that CLOSED before the reaction candle opened (the
reaction candle is not in it). Entry = the open of the next M30 candle (11:00, or 11:30), so nothing after the reaction candle's
close is known at the decision.
- **Rule F (fade)**: enter AGAINST the candle's direction; stop $0.01 beyond the candle's extreme on that side (sell: above its high;
  buy: below its low).
- **Rule C (continue)**: enter WITH the candle's direction; stop $0.01 beyond the candle's opposite extreme (buy: below its low;
  sell: above its high).
- No target. Exit at 16:00 New York: the close of the M30 candle that ends at 16:00. Stop first: the first candle from the entry
  candle on whose range reaches the stop exits at the stop, or at that candle's open if it opened beyond the stop. An entry open
  already beyond the stop (risk <= 0) is no trade. A missing candle in the window: the trade is managed on the candles there are;
  an event with no reaction candle or no entry candle is skipped.
- R = (exit - entry) x side / |entry - stop|; cost = $0.03 a round trip (a stated WTI CFD spread; no overnight financing, the
  trade is closed the same day), net R = R - 0.03 / risk.

## Windows
Replication 2016-01-01 to 2020-12-31. Decisive 2021-01-01 to the end of the data. Each event belongs to the window of its date.

## The test (two rules, Holm)
For each rule on the decisive window: mean net R a trade, t = mean / (sd / sqrt n) over trades, two-sided normal p, Holm over the
two rules. A rule **PASSES** only if all hold: (1) decisive mean net R > 0; (2) Holm-adjusted p < 0.05 with t >= 2; (3) decisive
n >= 150; (4) mean net R > 0 on 2016-2020 as well; (5) placebo: the same rule run on a randomly drawn weekday of each report week
that is not the report day and not a holiday, at 10:30 New York, with 40 seeds (1..40, a fixed generator in run.mjs): the real
decisive mean net R must be above at least 38 of the 40 placebo means. The study PASSES if at least one rule passes; otherwise FAIL.

## What follows
A FAIL changes nothing. A PASS is only a proposal to the owner for a paper shadow stream (never a live rule, never alerted, every
trade with its stop); WTI is not a market the council trades today. Reported, not tested: results by year, by side, before costs,
and at x2 costs.

# The 5-minute opening range breakout on NAS100 and SPX500: pre-registration

Written and committed **before** any trade was computed (13 Nov 2026). The candle download (`fetch.mjs`) was started at the
same time; no price, return or trade of it was looked at before this file was committed. The rule, the calendar, the costs,
the windows, the placebo and the pass bar are fixed here; nothing in them changes after the results are seen. Anything
added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes. ICT is not involved and nothing
under `ict/` is read or changed. A pass is a hypothesis for a forward paper shadow that the owner decides on; it is never a
live rule.

## The claim being tested

Zarattini, Barbon and Aziz ("Can Day Trading Really Be Profitable? Evidence of Sustainable Long-term Profits from Opening
Range Breakout (ORB) Day Trading Strategy vs. Benchmark in the US Stock Market", SSRN, 2023/2024) report that a 5-minute
opening range breakout on QQQ was profitable: trade in the direction of the first 5-minute candle after the 09:30 New York
open, stop at the other end of that candle, target 10R, out at the close. **Their sample, as recalled from the paper's
abstract (not re-read for this study; no figure of it is used): January 2016 to February 2023.** So the first window below
lies wholly inside their sample, and the window that decides (2021 → now) overlaps it for its first 26 months; the part
after their sample (March 2023 → now) is reported on its own, descriptive only (fixed here, so it is not a post-hoc cut).

**This is not the council's NQ New York open run** (`nq-open`, `research/edge/nq-open-oos`): that rule fades a short run
through the 09:30 open within 90 minutes on 1-minute candles and is unchanged by this study. The two are different rules
and the ORB is never mixed into the open run's record.

## What is already known (seen before this was written)

- The paper's headline claim, as above.
- The council's open-run studies (`nq-open-oos`, `open-run-breadth`, `open-run-breadth-2`): another rule; no number of
  them is used here.
- That OANDA serves NAS100 and SPX500 M5 candles through the proxy from before 2016 (`pre-fomc-drift` fetched them from
  2008). No ORB trade was computed in this repository before this file.

## Data

OANDA mid M5 candles of NAS100 (the decisive market, the CFD on the Nasdaq-100 future) and SPX500 (second market) through
the site's keyless proxy (`/md/bars`), 1 Dec 2015 to 13 Nov 2026, complete candles only:
`node --use-env-proxy research/edge/orb-nas100/fetch.mjs <dir>`. Files stay out of git. Candle times are UTC buckets.

## Calendar

- **New York time, DST-correct**: UTC−4 from the second Sunday of March 02:00 to the first Sunday of November 02:00, else
  UTC−5 (US rules since 2007). The 09:30 candle is the M5 candle starting 13:30 UTC in summer time, 14:30 UTC in winter.
- **Trading days**: Monday to Friday that are not NYSE full holidays and not NYSE early-close (13:00) days.
- **Full holidays** (written into `run.mjs` by rule): New Year's Day (observed on Monday when it falls on a Sunday; not
  observed when on a Saturday), Martin Luther King Jr. Day (3rd Monday of January), Washington's Birthday (3rd Monday of
  February), Good Friday, Memorial Day (last Monday of May), Juneteenth (19 June, from 2022, Saturday → Friday, Sunday →
  Monday), Independence Day (4 July, same observance), Labor Day (1st Monday of September), Thanksgiving (4th Thursday of
  November), Christmas (25 December, same observance). Special closures: 5 Dec 2018 (national day of mourning, President
  G. H. W. Bush), 9 Jan 2025 (President Carter).
- **Early closes, skipped**: 3 July when it is Monday to Thursday; the Friday after Thanksgiving; 24 December when it is
  Monday to Thursday.

## The rule (at most one trade per day per market)

1. **First candle** F = the M5 candle starting 09:30 New York. **Entry candle** E = the one starting 09:35. Either missing →
   no trade that day (counted as "missing").
2. F closed up (close > open) → **buy**; closed down → **sell**; open = close (a doji) → no trade.
3. **Entry** = the open of E. **Stop** = F's low for a buy, F's high for a sell (the other end of the opening range). Risk
   r = |entry − stop|; r ≤ 0 (the entry already at or past the stop) → no trade (counted).
4. **Target** = entry ± 10 r.
5. Every candle from E (included) to the last candle starting before 16:00 New York (normally the 15:55 candle) is checked
   in order: a candle that OPENS at or past the stop exits at its open (a gap); otherwise a candle whose range reaches the
   stop exits at the stop; a candle that reaches the target exits at the target. **A candle that holds both the stop and the
   target exits at the stop** (worst case). Missing candles inside the day are simply not checked.
6. Not out by then: exit at the **close of the last candle starting before 16:00 New York** (15:55; if that one is missing,
   the last candle of the day before it).
7. **R** = signed move / r. **Costs** (round trip, stated, the same as `pre-fomc-drift`): NAS100 **2 points**, SPX500
   **1 point**; net R = R − cost / r. No financing (the trade is closed before the 17:00 New York rollover).

Every trade has a stop (absolute rule 1). Sizing is a fixed 1R a trade (the paper's leverage cap is not modelled).

## Windows

- **A, 2016-01-01 to 2020-12-31**: reported, does not decide (inside the paper's sample).
- **B, 2021-01-01 to the last candle on file (13 Nov 2026)**: **decides**.
- **B′, 2023-03-01 → end**: after the paper's sample; reported, descriptive, does not decide.

## Statistics

- Per window: n, win rate, net and gross R a trade, total, costs in R, stops / targets / time exits, max drawdown (closed,
  in R), by year.
- **t on calendar-month sums**: the net R of each calendar month in the window that holds at least one trade; t = mean /
  (sd / √months). One-sided p from the normal approximation of that t.
- **Placebo** (decisive window, per market): 40 seeds (1 … 40, a fixed seeded generator); on every day that has a trade by
  step 2-3, the side is drawn at random (½ / ½) instead of F's colour; stop at the other end of F for the drawn side, the
  same entry, target, stop-first, exit and costs. A drawn side whose risk is ≤ 0 is no trade. The placebo statistic is net
  R a trade; its 95th percentile is taken by linear interpolation over the 40 sorted values.
- **Holm** over the two markets (the one-sided p of window B), family 0.05.

## Pass bar (window B, per market)

A market passes when ALL hold: net R a trade > 0; t on calendar-month sums ≥ 2; net R a trade above the placebo's 95th
percentile; Holm-adjusted p ≤ 0.05. **Verdict PASS** when NAS100 or SPX500 passes; otherwise **FAIL**. A pass leads at
most to a proposal (`research/proposals/2026-11-13-orb.md`) for a paper shadow; never to a live change.

## Not done, on purpose

No other range length (15 / 30 / 60 minutes), no other target, no trailing stop, no volume or "stocks in play" filter, no
leverage or size rule, no other market. Any of these would need its own pre-registration.

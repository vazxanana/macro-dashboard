# Pre-registration: gradual information diffusion across markets, monthly leader signals (14 Nov 2026)

Written and pushed ALONE, before any signal, trade, return or statistic of this rule was computed (only `_index.json`, which
lists each file's first and last date, was read). Paper research only: nothing here changes a council rule, a trade, the mirror
or any live file; the gold book is not touched (owner decision 44: this is a cross-market study, not a gate, exit, entry or size
on the gold book). ICT is not involved.

## Question

Slow-moving information means some markets lead others (Hong, Torous and Valkanov 2007, "Do industries lead stock markets?";
Rapach, Strauss and Zhou 2013, "International stock return predictability: what is the role of the United States?"). Three
leads, fixed now:
- **F1 (primary)**: the US500's past-month return leads the other national stock indices (the Rapach result).
- **F2**: copper's past-month return leads the industrial-heavy indices (DE40, AU200, HK33).
- **F3**: the dollar's past-month change (a USD basket from the FX majors) leads the metals, with the sign inverted (dollar up,
  metals down).
Does trading each follower in the leader's direction for the next month make money on the council's OANDA daily candles, as
stop-protected trades, net of spread and financing, and does it beat the follower's OWN past-month return used the same way?

**Related studies read first, and why this is not a repeat** (dedupe words `lead|lag|intermarket|copper|spillover|diffusion`;
`research/proposals/2026-11-14-untested-backlog.md` on branch `untested-backlog` read):
- `us-asia-lead` (branch, FAIL): the US cash SESSION's direction traded in the next ASIAN session of JP225 / HK33, daily,
  intraday. Not a monthly lead and not the other indices.
- `copper-gold` (branch, FAIL): the 13-week copper / gold RATIO as a long / flat regime for SPX500 / NAS100. Copper's own
  return does not lead anything there, and the followers are US indices.
- `commodity-fx-lead` (branch, FAIL): a big WTI / copper DAY leading USD/CAD / AUD/USD the NEXT DAY. Daily, FX followers.
- `index-spread-momentum`, `index-xs-momentum`, `index-pair` (branches, FAIL): spreads and cross-sectional ranks of indices on
  their own past; `tsmom` / `tsmom-portfolio` / `gold-tsmom` (FAIL): each market on its OWN past (that is this study's control,
  not its test). `yield-fx-weekly`, `bond-lead-intraday` (FAIL): rates leading FX / bonds, other leaders and followers.
No study tests a monthly US-leads-world, copper-leads-indices or dollar-leads-metals rule. The harness (month calendar, leg,
stop, statistics, placebo) is rewritten from `index-xs-momentum` (on a branch, so not imported).

What I expect, said plainly: the published US lead is in monthly excess returns over decades; on a dozen CFDs with costs and a
2004-26 sample I expect little.

## Markets (fixed now, from `_index.json` only)

council-data `research/daily/<key>.json` (OANDA mid, complete UTC daily candles), read with `git show
origin/council-data:research/daily/<key>.json` (no network). Saturday / Sunday stubs folded into the next weekday with
`council/fills.mjs` `foldWeekend` (imported). Each market keeps its own calendar.

- **F1**: leader `spx500`; followers = every non-US index key with a first candle in 2008 or earlier:
  `de40 uk100 eu50 fr40 ch20 nl25 jp225 au200 hk33 sg30` (**10 keys**). The brief asked for 12; only 10 exist on file:
  `es35` starts 2016-12, `cn50` and `in50` 2011-08 (and `in50` ends 2022-07), so they are left out by the brief's own date rule.
  `nas100 us30 us2000` are US indices and are not followers.
- **F2**: leader `xcu` (copper); followers `de40 au200 hk33`.
- **F3**: leader = the USD basket from `eurusd gbpusd audusd nzdusd usdjpy usdcad usdchf`; followers `xau xag xpt`.

## Rule

1. **Month ends**: a market's month-end close for calendar month M = the close of its last candle dated in M.
2. **Leader signal** at signal month S (closes up to and including S's last candle only):
   - index / copper: `ret = close(S) / close(S-1) - 1`;
   - USD basket: the mean over the seven pairs of the log change from close(S-1) to close(S), signed so that a rising dollar is
     positive (minus for eurusd, gbpusd, audusd, nzdusd; plus for usdjpy, usdcad, usdchf); computed only when all seven pairs
     have a candle in S and S-1.
   - Side for every follower in holding month H = S+1: F1, F2 `sign(ret)`; F3 `-sign(basket)`. Zero = no trade.
3. **Control signal (own momentum)**: the same rule with the FOLLOWER's own `close(S) / close(S-1) - 1` as the signal (sign not
   inverted for F3: own momentum is always "follow your own past month").
4. **Entry**: the open of the follower's first candle dated in H. A follower with no candle in S-1, S or H, or fewer than 21
   candles up to S's last, is skipped that month (counted).
5. **Size by inverse ATR, every leg 1R**: 1R = the stop distance = **3 x ATR(20)**, ATR = simple mean of the true range of the
   20 candles ending on the follower's last candle of S. Equal risk per leg = size inversely proportional to ATR.
6. **Stop on every leg** (absolute rule 1) at 1R from the entry, below a long, above a short; checked on every daily candle from
   the entry candle to the exit candle; a candle opening beyond the stop fills at its open (gap), otherwise at the stop.
7. **Exit**: the close of the follower's last candle in H. Every month all legs close and open anew.
8. **Month value of a family** = the SUM of its legs' net R that month (a calendar-month sum); a month with no leg counts 0.

## Costs (every leg, in R of that leg)

- **Spread and slippage, a round trip, of the entry price**: index CFDs **0.04 %** (the brief's rate for index CFDs, a third
  above `trend-breadth` `COST.index` 0.03 %); `xau` **$0.30** (the gold studies' flat cost); `xag` **0.10 %** (`trend-breadth`
  `COST.mid`); `xpt` **0.20 %** (`trend-breadth` `COST.wide`). In R = cost / (3 x ATR).
- **Financing** per night held = `council/fills.mjs` `nights(entryTime, exitTime)` (Mon-Fri 22:00 UTC rollovers, Wednesday
  three), each night `rate / 365 x entry / 1R`: a long pays `r + 2.5 %` a year, a short pays `max(0, 2.5 % - r)` (never
  credited): the convention of `tsmom` and `index-xs-momentum`. `r` = the quote currency's approximate year-average policy rate
  of the entry year, floored at 0, from the table of `index-xs-momentum`'s pre-registration (copied below; a year before 2007
  uses 2007). Currency: EUR de40 eu50 fr40 nl25; GBP uk100; CHF ch20; AUD au200; HKD hk33; SGD sg30; USD jp225 (OANDA's
  JP225_USD) and the three metals. Gold is NOT charged `FIN.xau.long` here (one rule for every market, stated).
- Exit time for financing: end of the exit candle for a month-end close, its start for a gap fill, start + 12 h for a stop
  inside a candle. Dividends are not credited or charged (price indices).
- Reported at **0 / base / 2 x costs** (2 x = spread and financing both doubled).

| Year | USD | EUR | GBP | AUD | HKD | CHF | SGD |
|---|---|---|---|---|---|---|---|
| 2007 | 5.0 | 3.9 | 5.5 | 6.5 | 5.0 | 2.5 | 2.4 |
| 2008 | 2.0 | 3.9 | 4.7 | 6.7 | 2.0 | 2.1 | 1.0 |
| 2009 | 0.2 | 1.3 | 0.6 | 3.3 | 0.2 | 0.25 | 0.7 |
| 2010 | 0.2 | 1.0 | 0.5 | 4.4 | 0.2 | 0.25 | 0.4 |
| 2011 | 0.1 | 1.3 | 0.5 | 4.7 | 0.2 | 0.05 | 0.4 |
| 2012 | 0.1 | 0.9 | 0.5 | 3.7 | 0.2 | 0 | 0.4 |
| 2013 | 0.1 | 0.6 | 0.5 | 2.8 | 0.2 | 0 | 0.4 |
| 2014 | 0.1 | 0.2 | 0.5 | 2.5 | 0.2 | 0 | 0.5 |
| 2015 | 0.1 | 0.05 | 0.5 | 2.1 | 0.2 | -0.75 | 1.0 |
| 2016 | 0.4 | 0 | 0.4 | 1.6 | 0.4 | -0.75 | 1.0 |
| 2017 | 1.0 | 0 | 0.3 | 1.5 | 1.0 | -0.75 | 1.1 |
| 2018 | 1.8 | 0 | 0.6 | 1.5 | 1.8 | -0.75 | 1.7 |
| 2019 | 2.2 | 0 | 0.75 | 1.1 | 2.2 | -0.75 | 1.8 |
| 2020 | 0.4 | 0 | 0.2 | 0.3 | 0.5 | -0.75 | 0.6 |
| 2021 | 0.1 | 0 | 0.1 | 0.1 | 0.1 | -0.75 | 0.4 |
| 2022 | 1.7 | 0.3 | 1.5 | 1.3 | 1.8 | 0 | 2.0 |
| 2023 | 5.0 | 3.3 | 4.7 | 3.9 | 4.6 | 1.5 | 3.9 |
| 2024 | 5.1 | 3.9 | 5.1 | 4.35 | 5.0 | 1.25 | 3.6 |
| 2025 | 4.2 | 2.3 | 4.3 | 4.0 | 4.0 | 0.25 | 2.3 |
| 2026 | 3.7 | 2.0 | 3.8 | 3.6 | 3.6 | 0 | 1.6 |

## Windows (fixed now)

- **In sample**: holding months 2004-01 to 2016-12 (156 months; a follower enters when it has the history, e.g. `nl25` 2008,
  metals 2005-06).
- **Out of sample (decisive)**: 2017-01 to 2026-10 (118 months; the cache ends 2026-11-06, so 2026-10 is the last complete month).
A month inside a window with no leg counts as 0; the windows do not move.

## Tests, Holm, pass bar

Six tests, each a one-sided test (> 0) on the OOS calendar-month sums at base costs, t = mean / (sd / sqrt(n)), p from the normal
approximation (n = 118):
- **F1, F2, F3**: the family's net month sums (leader signal).
- **D1, D2, D3**: the family's leader-signal net month sum MINUS its own-momentum net month sum, month by month (paired).
Holm over all six (step-down, family-wise 5 %).

A family **passes** only when ALL hold:
1. its OOS net t >= 2 AND its Holm-adjusted p < 0.05;
2. IS mean net month sum > 0 (the same sign in sample);
3. OOS mean net month sum > 0 at 2 x costs;
4. it beats its control: OOS mean of D > 0 AND D's Holm-adjusted p < 0.05.
**Verdict PASS only when F1 (the primary) passes.** F2 and F3 are reported with the same bar; a pass of either without F1 is a
lead for a new pre-registration on other data, not a pass of this study. A FAIL is not evidence that the opposite works.

## Placebo (reported, not part of the bar)

40 seeded draws (seeds 1-40, mulberry32): per family and holding month, one random sign for the whole family (as a leader
signal would give), same entries, stops and costs, OOS window. Reported per family: real OOS mean month sum against the
placebo 5th / 50th / 95th percentiles and how many of the 40 it beats.

## Reported only, never judged

Per family and window: legs (long / short), gross / cost / financing / net R a leg, win rate, stops and gap fills, month-sum mean,
t, Newey-West t (3 lags), worst drawdown, at 0 / base / 2 x costs; the own-momentum control on the same lines; the share of
months the leader and own signals agree; by follower; by year.

## What it cannot show

Price indices without dividends; each index earns in its own currency (no conversion); approximate policy rates; assumed spreads
not measured on the demo broker for these CFDs; ten followers is a small cross-section next to the published one, and OANDA's
indices close at 21:00-22:00 UTC (a non-US index's month-end close already holds part of the US session, which can only make
the US lead look weaker, never stronger).

To repeat (after the code exists): `node research/edge/intermarket-lead/run.mjs`.

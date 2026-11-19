# Time-series momentum across asset classes: pre-registration

Written and committed on 14 Nov 2026, before any position of this study was simulated. Paper research only: no live rule,
size, filter, council member, page or mirror setting is changed by this study, whatever it finds.

## Why

The gold 20-day breakout rule (the live Gold trend) failed on 13 other markets (`research/edge/trend-breadth-h1`, FAIL 0 of
14): it is a bet on gold, not a general trend rule. This study tests a **different, classic rule** on many markets at once:
time-series momentum as published by Moskowitz, Ooi and Pedersen (2012, "Time series momentum"): each month, be long a market
whose return over the past twelve months is positive and short one whose return is negative, each position sized to the
same risk. The published rule skips the most recent month in some variants; this one does (12-1 months).

What I already know, said plainly.
- `research/edge/trend-breadth-h1` (on main): the gold breakout rule on hourly candles of 13 markets, FAIL; currencies lost
  most (-0.20R a position, t -2.91).
- An unmerged branch `tsmom-portfolio` (not on main) ran a **volatility-targeted** version (40 % a year per market, gross cap
  3x, a 3 x ATR(20) catastrophe stop, 20 markets) and found FAIL: Sharpe -0.26 in 2008-17 and in 2018-26, net of costs and an
  assumed 2.5 % a year financing markup; before financing about +0.19 Sharpe in 2008-17. I have read its RESULT.md (its
  headline and class table) and its cost table; nothing else of it is reused. This study differs in sizing (fixed risk per
  market in R, a 2 x ATR(63) stop that is also the size), in financing (the US 2-year rate plus a markup, rate differentials
  for currencies), in the universe (25 markets) and in its windows. So I expect little; the test is run because the owner's
  question is whether a classic, published cross-asset rule works on this broker's markets and costs.
- Published work reports that time-series momentum weakened after about 2009. Nothing here is tuned to that.
- I have not computed a signal, a position or a return of this rule on any of these files before writing this file. From the
  candle files I read only the row counts and the first and last dates (below).

## Data

- council-data `research/daily/<key>.json` (OANDA mid daily candles, UTC days, the council's weekly cache), read with
  `git show origin/council-data:…` (no network). `node run.mjs fetch <dir>` copies them out; they are kept out of git.
- **Weekend candles are folded into the next weekday** (`council/fills.mjs` `foldWeekend`: Saturday / Sunday stubs into
  Monday; Monday keeps its own time and close). Every count of "days" below is folded trading days.
- **Universe (25 markets, fixed):**

| Class | Markets |
|---|---|
| Indices (7) | nas100 spx500 us30 de40 uk100 jp225 au200 |
| Bonds (3) | usb10y de10yb uk10yb |
| Commodities (8) | xau xag bco wtico natgas corn wheat soybn |
| Forex (7) | eurusd gbpusd usdjpy audusd usdcad usdchf nzdusd |

  First candle of each file (read before this file): every file starts in 2002-2004 except xau and xag (20 March 2006); all
  run to 6 Nov 2026. A market is **dropped** when its file does not reach back to 1 Jan 2008; by those dates **none is
  dropped**. A market is in a month only when it has the 252 + 63 folded days the signal and the size need before that
  month's rebalance (every market has them by the first rebalance, end of December 2007).

## The rule (fixed; not tuned)

At each **rebalance**: the last folded daily candle of a calendar month (UTC) in that market's file, index `i`, close `C[i]`.
A market whose last candle before the month's end is more than 7 days before it has no rebalance that month (flat).

1. **Signal**: `s = sign(C[i - 21] / C[i - 252] - 1)` (the 12-month return skipping the last month, 21 and 252 folded days).
   `s = 0` (equal closes) is flat. Only candles up to `i` are read.
2. **Size and stop**: `ATR = mean of the true range over candles i - 62 .. i` (63 days; true range = max(high - low,
   |high - previous close|, |low - previous close|); past data only). **1R = 2 x ATR.** Every position has a stop:
   `stop = entry - s x 1R` (on the losing side). Equal risk: every position is one R.
3. **Entry**: the **open of the next folded candle** (`i + 1`), the first candle of the new month. No trade if there is none.
4. **Management, daily from the entry candle on**: on a candle after the entry candle that **opens** beyond the stop, exit at
   the open; on any candle whose low (long) / high (short) reaches the stop, exit at the stop. Otherwise the position is closed
   at the **close of the next rebalance candle** (the next month's last candle), where the new signal is set. A stopped
   market is **flat until the next rebalance**. The stop never moves.
5. **R**: `gross R = s x (exit - entry) / 1R`.

## Costs (fixed)

**Trading**: one full round trip per position per month (each month is a separate position, even when the sign does not
change: conservative; a real book would only resize). Round trip as a share of the entry price, charged as
`cost x entry / 1R`:

| Market | Round trip | Source |
|---|---|---|
| Forex majors | 0.015 % | `research/edge/trend-breadth` `COST.fx` (on main) |
| Indices | 0.03 % | `trend-breadth` `COST.index` |
| xag, bco, wtico, natgas | 0.10 % | `trend-breadth` `COST.mid` |
| corn, wheat, soybn | 0.20 % | `trend-breadth` `COST.wide` |
| xau | $0.30 a round trip | the gold studies' flat cost (`gold-systems`, `supported-book`) |
| usb10y, de10yb, uk10yb | 0.10 % | **assumption** (no earlier main study prices these bond CFDs; set at the mid level) |

**Financing**, per night held: `nights(entry time, exit time)` of `council/fills.mjs` (Monday-Friday 22:00 UTC rollovers,
Wednesday counts three), each night `annual rate / 365`, charged as `nights x rate / 365 x entry / 1R`. Entry time = the
entry candle's start (00:00 UTC); exit time = the exit candle's start + 1 day (a stop inside a day is charged that night:
conservative).
- **Indices, bonds, commodities (gold included)**: a long pays `2.5 % + r_US`; a short pays `max(0, 2.5 % - r_US)`, never
  credited. `r_US` = FRED DGS2 (US 2-year Treasury yield), weekly, the last value on or before the entry date, copied from
  branch `turnaround-replicate` (`research/edge/turnaround-replicate/rates.json`, itself from council-data
  `macro/cache.json`) into this study's `rates.json`; never imported. The same rule for every market whatever its currency
  (a simplification, stated). Gold is NOT charged the demo broker's `FIN.xau.long` here (the brief's single rule applies).
- **Forex** (pair base / quote): a long earns `r_base - r_quote - 1 %` a year (a negative earning is a cost), a short earns
  `r_quote - r_base - 1 %`. The 1 % is an assumed broker markup. `r_USD` = DGS2 as above. Other currencies: approximate
  yearly mean policy rates by the entry's year: EUR, GBP, JPY copied from branch `index-spread-momentum`
  (`research/edge/index-spread-momentum/rates.json`, itself copied from `turnaround-replicate`); **CAD (Bank of Canada),
  CHF (Swiss National Bank), NZD (Reserve Bank of New Zealand) written here from memory, stated, not fetched**:

| Year | 2007 | 2008 | 2009 | 2010 | 2011 | 2012 | 2013 | 2014 | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAD | 4.35 | 3.0 | 0.35 | 0.6 | 1.0 | 1.0 | 1.0 | 1.0 | 0.6 | 0.5 | 0.7 | 1.4 | 1.75 | 0.45 | 0.25 | 2.2 | 4.8 | 4.4 | 2.75 | 2.25 |
| CHF | 2.5 | 2.1 | 0.25 | 0.25 | 0.05 | 0 | 0 | 0 | -0.75 | -0.75 | -0.75 | -0.75 | -0.75 | -0.75 | -0.75 | 0 | 1.5 | 1.25 | 0.25 | 0 |
| NZD | 8.0 | 7.5 | 2.8 | 2.75 | 2.5 | 2.5 | 2.5 | 3.2 | 3.0 | 2.0 | 1.75 | 1.75 | 1.3 | 0.3 | 0.4 | 2.6 | 5.4 | 5.2 | 3.3 | 2.25 |

  These are approximate; their error is small next to the 1 % markup and is reported as a sensitivity (no financing).

`net R = gross R - trading cost - financing`.

## Windows and the portfolio

- A position belongs to the **holding month** (the month after its signal's rebalance). **Decisive window: Jan 2016 to Oct
  2026** (130 months). **Replication window: Jan 2008 to Dec 2015** (96 months). November 2026 (incomplete) is not used.
  Nothing is fitted on either window; every number is fixed here.
- **Portfolio month** = the sum of the net R of every position of that holding month (one R a market; flat = 0). A class
  stream sums its own markets only.
- Statistics on the monthly sums: mean net R a month, standard deviation, **month-sum t = mean / (sd / sqrt(months))**,
  Sharpe = mean / sd x sqrt(12), total R, **worst drawdown** in R of the running monthly total (from its own high, starting at
  0), positions, win rate of positions, stops hit.

## Tests (fixed: five)

- **T1 (headline): all 25 markets pooled.**
- **T2 indices, T3 bonds, T4 commodities, T5 forex.**

Each test's one-sided p = normal approximation of its decisive-window t; **Holm** over the five.

**Placebo** (per test and window): 40 seeds (1 .. 40, a fixed seeded generator); each month each market takes a random sign
(+1 / -1 with equal odds) instead of `s`, everything else as the rule (same entry, same 1R, the stop on the losing side of
the random sign, the same costs and financing for that side). Reported: the 5th, 50th and 95th percentiles and the maximum of
the 40 placebo t's and mean net R a month.

A test **passes** when all of these hold:
1. decisive window: mean net R a month > 0 and **month-sum t >= 2.0**;
2. replication window: mean net R a month > 0;
3. Holm-adjusted p < 0.05;
4. decisive t above the 95th percentile of its 40 placebo t's;
5. decisive mean net R a month > 0 at **twice the costs** (trading and financing).

## Verdict (fixed here)

- **PASS**: T1 passes.
- **FAIL**: T1 fails condition 1 or 2, and no class test meets conditions 1 and 2 together.
- **INCONCLUSIVE**: anything else (T1 meets 1 and 2 but not the rest, or only a class test passes; a class passing alone is a
  hypothesis for a new pre-registration on other data, never a result).

## Reported, not tested (never a verdict)

Per market and per class: positions, gross and net R, cost and financing drag, long / short split, stops hit, by year. The
pooled stream before any cost, and with trading costs but no financing. These are descriptive; none changes the verdict.

## What I had to decide (the brief leaves it open)

- Entry at the next candle's open, not the signal close (no trade at the price the signal is read from).
- Month = calendar month UTC; a market's own last candle in the month is its rebalance; 7-day staleness rule.
- A full round trip every month (conservative) instead of charging only changes.
- Stop exit times charged to the end of that day for financing (conservative).
- Bond CFD costs and the CAD / CHF / NZD rates (assumptions above).
- Positions marked only at their exit (a month's R is closed R; drawdown is on monthly sums, so intra-month drawdown is
  not shown).
- Normal approximation for p; Holm over five.

## What happens next

Nothing changes live on any outcome (absolute rules 2 and 3). On PASS the proposal to the owner would be a forward paper
stream, never a live rule before a forward record exists. On FAIL or INCONCLUSIVE the result is published as it is. A bug
found after the run is fixed, said in RESULT.md, and everything is re-run.

# Result: does a sharp M15 move in the US 10-year Treasury lead gold and USD/JPY over the next hour? (14 Nov 2026)

Verdict: **FAIL**. 0 of 3 tests pass. Every test loses after costs in both windows (decisive Holm p 1.00 for all three).
Before costs there IS a small lead in the expected direction (gross t 2.0-2.9 in 2016-26, 4.4-6.1 before 2016, and the real
signals beat almost every placebo seed), but one hour of follow-through is worth about +0.05 to +0.08R a trade since 2016 and
the round trip costs about 0.16-0.18R of a one-ATR(96) M15 stop. Not an edge; nothing to propose.

Scope (item 44): a stand-alone research rule tested on its own trades, never a gate, exit, entry or size of the live gold book.
Paper only; nothing live changed.

## Data
OANDA mid M15 through the site's candle proxy (cache kept out of git): **usb10y from 20 March 2003** (18:00 UTC) to 13 November 2026
(519,415 candles); xau from 19 March 2006 (494,367); usdjpy from 6 May 2002 (550,959). So the replication window is mid-April 2003
(after the 28-day warm-up) to 2015 for USD/JPY, and March 2006 to 2015 for gold. 9,886 signals (4,811 bond up, 5,075 bond down;
2,159 of them on a candle starting at 08:30 or 10:00 New York).

## Tests (one position at a time; t on calendar-month sums of net R)

| Test | Window | n | Gross R | Gross R a trade | Net R | Net R a trade | t (net) | t (gross) | Worst drawdown |
|---|---|---|---|---|---|---|---|---|---|
| T1 | decisive | 3886 | +184.2 | +0.047 | -375.6 | -0.097 | -3.94 | 2.04 | -443.9R |
| T1 | replication | 3739 | +571.8 | +0.153 | -163.0 | -0.044 | -1.46 | 5.27 | -224.6R |
| T2 | decisive | 3846 | +320.2 | +0.083 | -445.6 | -0.116 | -3.98 | 2.89 | -483.4R |
| T2 | replication | 4149 | +718.9 | +0.173 | -52.6 | -0.013 | -0.43 | 6.09 | -248.1R |
| T3 | decisive | 3107 | +222.2 | +0.072 | -221.9 | -0.071 | -2.50 | 2.62 | -287.1R |
| T3 | replication | 3001 | +439.7 | +0.147 | -139.3 | -0.046 | -1.32 | 4.36 | -205.3R |

- T1 gold in the bond's direction; T2 USD/JPY against the bond; T3 = T1 without signal candles starting at 08:30 or 10:00 New
  York (the clock rule: `council/events.mjs` history starts only in January 2022, so release dates were not used).
- Pass bar per test: net R > 0 in both windows (all fail), decisive Holm p < 0.05 (p 1.00, 1.00, 0.99 raw; 1.00 after Holm),
  decisive n >= 150 (all pass).
- Costs: gold $0.30 a round trip = median 0.160R (median stop $1.88); USD/JPY the raw-spread model (commission 22.5 USD a million a
  side, half a 1-pip default spread of slippage in and out, quoted spread 0) = median 0.176R (median stop 8.5 pips).
- **2x costs**: decisive net -0.241R (T1), -0.315R (T2), -0.214R (T3) a trade; replication -0.240R, -0.199R, -0.239R.
- By bond direction (decisive): T1 bond up (buy gold) -0.154R, t -4.01, bond down (sell gold) -0.042R, t -1.07; T2 -0.107R / -0.124R;
  T3 -0.135R / -0.011R.
- Year by year (T1): net positive only in 2008, 2012, 2013, 2015, 2016, 2025, 2026; T2 positive in 2005-06, 2008-10, 2013, 2015, then
  negative every year 2016-26. The gross lead is larger before 2016 than after it.

## Placebo (40 seeds: each signal replaced by a random weekday candle of the same year, same UTC start time, same side)

| Test | Real decisive net R a trade / t | Placebo median R / t | Placebo range of R | Seeds with t >= real |
|---|---|---|---|---|
| T1 | -0.097 / -3.94 | -0.139 / -5.85 | -0.194 to -0.086 | 2 of 40 |
| T2 | -0.116 / -3.98 | -0.196 / -7.71 | -0.243 to -0.132 | 0 of 40 |
| T3 | -0.071 / -2.50 | -0.139 / -5.18 | -0.191 to -0.089 | 0 of 40 |

The real signals do better than random same-hour candles (the gross lead is real, not the hour), but every placebo seed and every
real stream is negative after costs.

## What it means
A sharp Treasury candle is followed, on average, by a small move of gold and USD/JPY the way yields went, and it has weakened since
2016. At one hour it is smaller than the cost of trading it with a one-ATR M15 stop. Not tested and not to be tuned on these data:
other thresholds, holds, stops, hours or markets (each would need its own pre-registration on other data). Nothing live changed; no
proposal was written.

To repeat: `node --use-env-proxy research/edge/bond-lead-intraday/run.mjs fetch <dir>` (about 1.56 million M15 candles, 70 MB, kept
out of git), then `node research/edge/bond-lead-intraday/run.mjs full <dir>`. Tests: `tests/bond-lead-intraday.test.mjs`.

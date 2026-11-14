# Forex majors' Sunday-open gap: does it fill? (14 Nov 2026)

**Verdict: FAIL.** Rule G (fade the gap at the reopen candle's close) made +0.194R a trade after costs on 2020 to now,
pooled over six pairs (n 243, t 2.14 on calendar-month sums), but its p of 0.0161 does not pass Holm over the two rules
(it needs 0.0114, a monthly t of about 2.28), so it misses one line of the pre-registered bar. Rule H (enter after the first
hour) lost: −0.015R a trade (n 222, monthly t −0.16). Not an edge; no proposal; nothing live changed.

Read Rule G's near miss with care: two thirds of its 2020-to-now total is 2026 alone (+33.6R of +47.1R, 71 trades);
2020-25 made +0.079R a trade (n 172, monthly t 0.77), and the 2016-19 replication +0.034R at base cost and −0.047R at the
stress cost (n 173, monthly t 0.39). What the study does show, beyond the bar: Rule G's 2020-to-now mean sits above all 40
random-direction runs on the same trades (placebo 95th percentile +0.000R), so the direction toward Friday's close carried
some information there, unlike on gold.

Paper research only. The rules, costs, windows and the pass bar were committed before this code existed
(`PREREGISTRATION.md`, commit eb940aef). The rules and code are copied from `research/edge/gold-weekend-gap` (branch
`gold-weekend-gap`, FAIL on gold, 13 Nov 2026), nothing imported across branches; only the markets and the costs changed.

## The rule (as pre-registered)

Friday's close = the close of the last M5 candle before Friday 17:00 New York; the reopen = the first M5 candle at or after
Sunday 17:00 New York (stray weekend prints never used); gap = reopen open − Friday's close; ATR = mean true range of the 20
complete 17:00-New-York days to Friday's. Eligible: 0.25 x ATR ≤ |gap| ≤ 1.5 x ATR.

- **Rule G**: at the reopen candle's close, trade toward Friday's close; target = Friday's close, stop the same distance
  beyond the entry (1R), out at Monday 12:00 New York; stop checked first; no trade when the first candle already closed
  through Friday's close or the risk is under 0.1 x ATR.
- **Rule H**: the same, entering at the first M5 close one hour after the reopen, if Friday's close has not been touched yet.

Pairs: EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CHF, EUR/JPY; OANDA mid M5, 1 Nov 2015 to 12 Nov 2026 (about 822,000
candles a pair), read from files outside git. **Costs** (the measured raw-spread model of the demo broker): 0.3 pip spread +
22.5 USD per million a side commission + **1 pip of slippage a side** (base: the reopen is the widest-spread minute of the
week); the stress cost has 2 pips a side. Financing: none charged (no forex rate is measured in the repository), and no
trade crossed a 22:00 UTC weekday rollover (`council/fills.mjs` `nights` = 0 on every trade).

## Results (pooled over the six pairs)

| Rule | Window | n | win | gross R | net R (base) | net R (stress) | t (trades) | t (months) |
|---|---|---|---|---|---|---|---|---|
| G | 2020 to now | 243 | 65 % | +0.292 | +0.194 | +0.123 | 3.42 | 2.14 |
| G | 2016-19 | 173 | 59 % | +0.147 | +0.034 | −0.047 | 0.49 | 0.39 |
| H | 2020 to now | 222 | 57 % | +0.096 | −0.015 | −0.094 | -0.23 | -0.16 |
| H | 2016-19 | 156 | 51 % | +0.033 | −0.090 | −0.179 | -1.18 | -0.93 |

- The bar, decisive window: net R > 0 at base (G yes, H no) and at stress (G yes, H no); Holm over the two rules on the
  monthly-sum t (no: p 0.0161 for G needs ≤ 0.0114; H p 0.56); n ≥ 80 (both yes); positive on 2016-19 at base cost (G yes,
  +0.034R; H no). Rule G misses on Holm alone; Rule H on four lines.
- Totals 2020 to now at base cost: G +47.1R (worst drawdown 11.7R, 49 months with a trade), H −3.2R (24.3R). Exits, G
  2020 to now: 136 targets, 69 stops, 38 time exits.
- **The reopen spread matters**: the median risk is 33 pips, so the base cost is about 0.08R a trade (median), and each
  further pip of slippage a side takes about 0.07R more. Rule G's 2016-19 replication turns negative at 2 pips a side.
- Weeks: 567 Fridays a pair from 2016, 557 used (3 without Friday afternoon trading, 7 without a reopen before 21:00 New
  York); 248 eligible pair-weeks 2020 to now and 173 in 2016-19. Rule G skipped 2 (filled inside the first candle) and 3
  (risk under 0.1 x ATR); Rule H 32 (filled within the hour) and 11.

### By pair (net R at base cost; not in the bar)

| Pair | G 2020 to now: n | net R | t | G 2016-19: n | net R | t |
|---|---|---|---|---|---|---|
| eurusd | 43 | +0.089 | 0.64 | 23 | −0.116 | -0.60 |
| gbpusd | 37 | +0.182 | 1.16 | 32 | −0.173 | -0.98 |
| usdjpy | 37 | +0.110 | 0.76 | 38 | +0.085 | 0.56 |
| audusd | 45 | +0.218 | 1.68 | 29 | +0.294 | 1.93 |
| usdchf | 34 | +0.155 | 0.97 | 19 | +0.010 | 0.04 |
| eurjpy | 47 | +0.371 | 3.15 | 32 | +0.069 | 0.43 |

| Pair | H 2020 to now: n | net R | t | H 2016-19: n | net R | t |
|---|---|---|---|---|---|---|
| eurusd | 43 | −0.037 | -0.27 | 21 | −0.376 | -1.81 |
| gbpusd | 35 | +0.066 | 0.40 | 28 | −0.346 | -1.88 |
| usdjpy | 34 | −0.168 | -1.04 | 37 | +0.052 | 0.34 |
| audusd | 41 | +0.017 | 0.11 | 26 | −0.039 | -0.21 |
| usdchf | 28 | −0.310 | -1.71 | 15 | −0.170 | -0.66 |
| eurjpy | 41 | +0.238 | 1.79 | 29 | +0.177 | 1.05 |

Rule G by year at base cost (n): 2016 −0.01 (47), 2017 −0.01 (51), 2018 +0.23 (34), 2019 −0.03 (41), 2020 −0.27 (38),
2021 +0.68 (12), 2022 +0.36 (25), 2023 −0.29 (18), 2024 +0.20 (31), 2025 +0.12 (48), 2026 +0.47 (71).

## The plain fill rate (every week, pooled over the six pairs)

Share of pair-weeks in which price touched Friday's close between the reopen and Monday 12:00 New York, by |gap| / ATR.

| |gap| / ATR | 2016-19 | 2020 to now |
|---|---|---|
| under 0.25 | 976 of 1047 (93 %) | 1757 of 1867 (94 %) |
| 0.25-0.5 | 86 of 121 (71 %) | 110 of 156 (71 %) |
| 0.5-1.0 | 14 of 43 (33 %) | 40 of 87 (46 %) |
| 1.0-1.5 | 2 of 9 | 2 of 5 |
| over 1.5 | 0 of 4 | 1 of 3 |

Forex gaps fill more often than gold's (0.25-0.5 x ATR: 71 % against gold's 52-60 %), which is where Rule G's gross edge
comes from. In 2020 to now, 0.5-1.0 x ATR, down gaps filled 36 of 61 and up gaps 4 of 26 (a split not tested).

## Placebo (40 seeds, random direction on Rule G's own trades)

Mean net R at base cost, 2020 to now, across the 40 runs: median −0.099, 5th percentile −0.197, 95th percentile +0.000
(min −0.223, max +0.061). Rule G's +0.194 is above every run (0 of 40 did as well). The placebo's mean sits near minus the
cost, as it should.

## Post hoc (not in the bar; chosen after the result, so not evidence)

- 2020-25 alone: Rule G +0.079R a trade (n 172, trade t 1.12, monthly t 0.77); 2026 alone +0.473R (n 71, monthly t 3.12).
  The decisive result rests on one year in which every pair gapped together, often the same weekend.
- The six pairs of one weekend are largely one bet on the dollar: on weekly sums (97 weekends) Rule G's t is 2.47, against
  3.42 counting each trade as independent.

## What this does not say

- It does not say the gap fade is worthless on forex: Rule G was positive before costs in both windows and above its
  placebo; it says this rule did not meet the bar fixed in advance, and its replication at a realistic reopen cost is about
  zero. A further test would need its own pre-registration on other data (other pairs, or 2010-15), not a re-cut of these
  weeks.
- Reopen fills are modelled at the mid plus a fixed slippage; the real reopen spread on a raw-spread account can be several
  pips for minutes, and stops placed then may be hit by the spread alone.

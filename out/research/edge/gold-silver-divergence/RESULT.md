# Result: intraday gold / silver divergence on H1, fade and follow (13 Nov 2026)

**Verdict: FAIL, 0 of 2.** Neither trading against nor with a gold 24-hour extreme that silver does not confirm makes money
after costs. Both variants lose in the decisive window 2020-now (fade −0.084R a trade, n 2,519, monthly t −3.36; follow
−0.075R, n 2,325, monthly t −2.94) and in the replication 2008-2019 (−0.120R and −0.128R); before costs each is within 0.03R
of zero. Neither beats its placebo (the same gold extreme without the silver condition): the silver condition adds nothing
measurable. Not an edge; never a council rule or filter.

A new stand-alone intraday rule on gold, as pre-registered in `PREREGISTRATION.md`: it is not the gold book and reads none of
its positions (item 44 untouched). Not the MMXM study's test either (silver SMT as a condition on a Day-3 gold setup).

OANDA mid H1 XAU_USD and XAG_USD, inner join on the candle start, 19 March 2006 to 11 November 2026 (125,179 joined candles).
Event: gold's close above (below) the max (min) gold close of the prior 24 candles while silver's close stays below its prior-24
max (above its min). Entry at the next H1 open (one hour later, not in 21:00-22:00 UTC), stop 1 x ATR(24), target 1.5R, out after
12 candles, stop first, one trade at a time. $0.30 a round trip and gold-long financing (`council/fills.mjs` `FIN`, `nights`).

| Variant | Window | n | Net R a trade | Gross R a trade | Total net R | Win % | t (monthly sums) | t (trades) | Worst drawdown |
|---|---|---|---|---|---|---|---|---|---|
| Fade | 2020-now (decisive) | 2519 | -0.084 | -0.023 | -211.38 | 39.86 | -3.36 | -3.54 | -228.89R |
| Fade | 2008-2019 (replication) | 4048 | -0.120 | -0.005 | -487.71 | 40.64 | -5.76 | -6.43 | -503.89R |
| Follow | 2020-now (decisive) | 2325 | -0.075 | -0.012 | -174.98 | 39.83 | -2.94 | -3.01 | -253.22R |
| Follow | 2008-2019 (replication) | 3787 | -0.128 | -0.011 | -483.21 | 39.85 | -6.34 | -6.54 | -485.12R |

**Pass bar, each check** (both variants fail every one): net R a trade > 0 in 2020-now: no; monthly t >= 2: no (83 months;
one-sided p 0.9996 fade, 0.9984 follow); Holm over the two: no; same sign in 2008-2019: no (the sign is negative in both
windows); above the placebo's 95th percentile: no.

**Placebo** (40 seeds; as many random gold-only events as divergent ones, 10,156, same side rule, stops, exits, costs and
one-at-a-time filter; decisive-window net R a trade):

| Variant | Variant's net R | Placebo median | Placebo 95th percentile | Placebo range |
|---|---|---|---|---|
| Fade | -0.084 | -0.086 | -0.057 | -0.120 to -0.044 |
| Follow | -0.075 | -0.057 | -0.032 | -0.092 to -0.018 |

The fade sits on the placebo's median and the follow below it: a gold 24-hour extreme that silver fails to confirm behaves
like any gold 24-hour extreme.

**Reported, not tested**
- Events: 10,156 divergent (5,785 highs, 4,371 lows) against 22,899 gold-only extremes over the history: a divergence prints
  about twice a trading day, so it is not a rare signal.
- Costs: $0.30 is 0.056R a trade in 2020-now and 0.109R in 2008-2019 (smaller ATR); financing 0.006-0.008R a trade.
- Highs and lows apart, 2020-now: fade after a high -0.105R (n 1,433), after a low -0.055R (n 1,086, gross +0.014R); follow
  after a high -0.048R (n 1,311, gross +0.022R), after a low -0.111R (n 1,014). The two near-flat halves are the same trade
  (a buy into gold's 2020-26 rise), read twice; none is near t 2 (best t -1.37).
- Exits 2020-now: fade 1,446 stops + 13 gapped stops, 911 targets, 149 time exits; follow 1,340 + 7, 870, 108.
- Year by year, net R (2006-07 are trades of the look-back years, outside both windows): the fade lost every year 2006-2026;
  the follow lost every year but 2025 (+44.70R) and 2026 to date (+19.44R), the years of gold's sharpest rise.

**What it means.** On H1, with a 24-candle look-back, silver's failure to confirm a gold extreme carries no information about
gold's next 12 hours that survives a $0.30 cost, in either direction, in either window. This ends SMT as a stand-alone intraday
rule on gold H1; another reading (another look-back, timeframe, or a divergence used only at a pre-named key level) would need
its own pre-registration. Nothing live changed.

To repeat: `node --use-env-proxy research/edge/gold-silver-divergence/run.mjs fetch <dir>` (candles outside git), then
`node research/edge/gold-silver-divergence/run.mjs full <dir>`. Tests: `tests/gold-silver-divergence.test.mjs`.

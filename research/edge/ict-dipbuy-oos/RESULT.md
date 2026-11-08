# ICT dip-buy (the #431 NQ/ES proposal) on 2008-2017: out of sample, pre-registered

**Verdict: FAIL (pre-registered bar). The 2018-26 dip-buy result does not hold before 2018: on ten years the rule had never seen it made +0.021R a trade after costs (NQ+ES pooled, n 491, t 0.35), lost in the 2008-12 half (−0.141R), and was no better than random longs on the same dips (drift-adjusted +0.002R, 95% CI −0.12..+0.12).** The proposal in `research/edge/ict-index-longonly/proposal.md` (replace the NQ/ES A-rule with gold-rule buys gated on a negative 20-day return) should not be adopted on #431's evidence. Nothing live changes; the paper 'dip' shadow stream the tracker already runs is the right place for it.

The same harness, on the same OANDA data, reproduces #431 on 2018-26 exactly where it should (**+0.277R a trade, n 379, t 3.5**; 2018-23 +0.198, 2024-26 +0.456; drift-adjusted +0.245, CI +0.09..+0.42) and reproduces the index A-rule of #526 / #579 to the last digit. So the data source and the code are not what changed: the edge is a feature of the market since about 2015, not of the signal. In 2008-14 the gated buys lost −40R; from 2015 on they made +156R.

## How it was run

- **Pre-registration first.** `preregistration.md` and `run.mjs` were committed and pushed (0e7c5a69) before the `full` stage,
  the only stage that computes any 2008-17 statistic of the tested streams, ran. The `trades` stage ran once over 2007-26 in one
  pass (it prints only coverage); the `calib` stage printed only the 2018-26 dip-buy figures and the index-rule cells that #526 /
  #579 had already published. The test ran once. The only change after it was a print guard in `run.mjs` (the baseline block has no
  buys-only drift control and the table printer assumed one); no parameter, rule, cost, window or control moved, and `result.json`
  had already been written by the first run with the same seeded numbers.
- **Data.** The OANDA 5-minute mid candle cache of #526 / #545 / #579 (NAS100_USD and SPX500_USD, 2007-06 to 2026-10, through the
  site's keyless proxy). **No candle was refetched** (owner, 8 Nov). Candle handling as #526: `inHalt || cmeShut` bars dropped, H1 =
  `agg()`, D1 = `dailyNY()` (17:00 New York), 5m exits on complete UTC days (>= 200 candles), H1 exits otherwise. Cash/spot vs
  futures differences as declared in #526.
- **Code: the desk's own, imported, unchanged.**
  - H1 'dip': `isDip(g, key, D)` from `ict/tracker.mjs` (the paper 'dip' shadow rule: a buy signal with `grade >= 3`, the gold
    A-rule's stop band 0.3-0.75x the daily ATR, and `dipGate`: the last completed daily close below the daily close 20 trading
    days earlier). Size 1, `simulate(g, { ...M, aRule: 'dip' })` from `ict/replay.mjs` (no break-even, trail from +2R, 36 H1 max),
    one open trade per market, exactly the replay's shadow stream.
  - H2 'goldbuy': the same without the gate, `isASetup(g, 'gc')`.
  - Baseline 'index': the live NQ/ES A-rule as #526 ran it (`isASetup`, `sizeOf`, both sides, break-even, the replay's busy rule).
- **Costs.** One round trip 0.02% of price + 0.25 point (NQ and ES), in R = cost / r0; net = size x (R − cost). About 0.04R a trade
  here. Costs x2 and gross are reported.
- **Control.** Random H1-close buys, 1 in 10 candles (seed 777, as #431), stop 0.3-0.75x the daily ATR14, the gold exit, the same
  costs, each tagged with the same 20-day gate at its own close. Drift-adjusted = net minus the control's mean in the same market,
  year and gate state (H1) or market and year (H2). CI = calendar-month block bootstrap, a month's rule and control trades
  resampled together, control cell means recomputed per resample, 5000 reps.
- **Windows** by signal close (UTC): A = 2008-01-01..2017-12-31 (the test; halves 2008-12 | 2013-17); B = 2018-01-01..2026-10-31
  (#431's window, the confirmation; 2018-23 | 2024-26).

## Calibration gate (read before any 2008-17 number): passes

| cell | this harness | #526 (its code) | #579 (today's code) / #431 |
|---|---|---|---|
| index A-rule NQ 2008-17 | n 538, −0.075 (t −1.37) | n 541, −0.073 | n 538, −0.075 |
| index A-rule NQ 2018-26 | n 423, +0.106 (t 1.35) | n 424, +0.103 | n 423, +0.106 |
| index A-rule ES 2008-17 | n 534, −0.069 (t −1.18) | n 534, −0.068 | n 534, −0.069 |
| index A-rule ES 2018-26 | n 425, +0.039 (t 0.54) | n 422, +0.040 | n 425, +0.039 |
| dip-buy NQ+ES 2018-26 | n 379, **+0.277** (t 3.50) | | #431 (HistData): n 370, +0.29 |
| dip-buy 2018-23 | n 264, +0.198 (t 2.12) | | #431: n 256, +0.21 |
| dip-buy 2024-26 | n 115, +0.456 (t 3.12) | | #431: n 114, +0.48 |

The index rule reproduces #579 to the digit; the dip-buy rule reproduces #431 within 0.02R on a different data source (OANDA CFD
vs HistData cash). Per market 2018-26: NQ n 195 +0.274, ES n 184 +0.279.

## The pre-registered test: H1 dip-buy, NQ+ES pooled, 2008-01 to 2017-12, net, costs x1

| test | result | needed | pass |
|---|---|---|---|
| P1 pooled | n 491, WR 42%, **+0.021R a trade, +10.4R, t 0.35** | > 0 and t >= 2 | no |
| P2 halves | 2008-12: **−0.141** (n 286, t −1.91); 2013-17: +0.247 (n 205, t 2.48) | both > 0 | no |
| P3 vs random gated longs | control +0.006 (n 4,329); drift-adjusted **+0.002R (t 0.04), CI −0.124..+0.115, P(>0) 0.48** | > 0, CI excludes 0 | no |

**FAIL** on all three. Costs x2: −0.022R (t −0.37). Gross: +0.065R (t 1.07). Max drawdown 45.9R, worst streak 16. Monthly-sum t 0.29.

### Key table: the candidate next to the rule it would replace and the ungated rule, same data, same code

| rule (NQ+ES pooled) | 2008-17 n | WR | net exp | R | DD | t | x2 | gross | 2008-12 | 2013-17 | drift-adj (CI) | years + | 2018-26 n | net exp | t | drift-adj (CI) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **H1: dip-buy (gold-rule buys, 20-day return < 0)** | 491 | 42% | **+0.021** | +10.4 | 45.9 | 0.35 | −0.022 | +0.065 | −0.141 | +0.247 | **+0.002 (−0.12..+0.12)** | 5/10 | 379 | **+0.277** | 3.50 | +0.245 (+0.09..+0.42) |
| H2: gold-rule buys, ungated | 1,330 | 43% | −0.002 | −2.6 | 64.7 | −0.05 | −0.059 | +0.055 | −0.042 | +0.041 | +0.012 (−0.06..+0.09) | 4/10 | 1,064 | +0.177 | 3.94 | +0.140 (+0.03..+0.26) |
| baseline: index A-rule (live, both sides) | 1,072 | 32% | −0.072 | −76.9 | 105.9 | −1.80 | −0.131 | −0.013 | −0.131 | −0.006 | (two-sided; #526) | 4/10 | 848 | +0.072 | 1.36 | |
| random gated longs (control, not a rule) | 4,329 | 41% | +0.006 | | | 0.31 | | | | | | | 3,661 | +0.032 | 1.53 | |

- **H2 (secondary): FAIL** as well. Pooled −0.002R (t −0.05), halves −0.042 | +0.041, drift-adjusted +0.012 (CI −0.06..+0.09).
- The dip-buy did beat the live index rule on 2008-17 (+10R vs −77R, drawdown 46R vs 106R), but a rule that beats a losing rule by
  being flat is not a candidate; the bar was an edge on untouched data, and there is none.

### Per market, 2008-17

| market | rule | n | WR | net exp | R | DD | t | x2 | gross | 2008-12 (n, t) | 2013-17 (n, t) | drift-adj (t) | CI |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| NQ | dip-buy | 242 | 44% | +0.112 | +27.0 | 27.4 | 1.25 | +0.077 | +0.147 | −0.176 (142, −1.73) | +0.520 (100, 3.40) | +0.037 (0.42) | −0.15..+0.18 |
| ES | dip-buy | 249 | 39% | −0.067 | −16.6 | 28.8 | −0.82 | −0.118 | −0.015 | −0.106 (144, −0.99) | −0.013 (105, −0.10) | −0.031 (−0.38) | −0.17..+0.10 |
| NQ | ungated buys | 645 | 45% | +0.075 | +48.3 | 22.2 | 1.42 | +0.030 | +0.120 | +0.010 (335) | +0.145 (310, 1.91) | +0.051 (0.97) | −0.04..+0.14 |
| ES | ungated buys | 685 | 41% | −0.074 | −50.8 | 69.0 | −1.52 | −0.142 | −0.006 | −0.091 (353) | −0.056 (332) | −0.024 (−0.50) | −0.11..+0.06 |
| NQ | index A-rule | 538 | 31% | −0.075 | −40.3 | 62.3 | −1.37 | −0.123 | −0.027 | −0.183 (289, −2.59) | +0.051 (249) | | |
| ES | index A-rule | 534 | 32% | −0.069 | −36.6 | 46.7 | −1.18 | −0.139 | +0.002 | −0.076 (271) | −0.061 (263) | | |

Only 1 of 2 markets is positive; ES, which #431 had at 9 of 9 years positive on 2018-26, loses on 2008-17 in both halves.

### Per year, NQ+ES pooled, net R (costs x1)

| year | dip-buy n | exp | R | t | x2 exp | control exp (gated) | drift-adj | ungated buys R | index A-rule R |
|---|---|---|---|---|---|---|---|---|---|
| 2008 | 87 | −0.158 | −13.8 | −1.22 | −0.188 | −0.229 | +0.069 | −19.5 | −32.3 |
| 2009 | 45 | +0.032 | +1.5 | 0.18 | −0.003 | +0.143 | −0.135 | −10.9 | −22.4 |
| 2010 | 46 | −0.049 | −2.2 | −0.25 | −0.089 | −0.111 | +0.062 | +8.0 | −6.5 |
| 2011 | 61 | −0.237 | −14.5 | −1.57 | −0.276 | −0.025 | −0.212 | −0.7 | +3.2 |
| 2012 | 47 | −0.238 | −11.2 | −1.19 | −0.289 | +0.010 | −0.248 | −5.8 | −15.6 |
| 2013 | 23 | +0.122 | +2.8 | 0.44 | +0.055 | +0.288 | −0.167 | −14.1 | −20.7 |
| 2014 | 45 | −0.065 | −2.9 | −0.40 | −0.115 | +0.175 | −0.244 | −11.9 | −4.4 |
| 2015 | 52 | +0.294 | +15.3 | 1.45 | +0.250 | +0.038 | +0.254 | +1.1 | +8.8 |
| 2016 | 62 | +0.411 | +25.5 | 2.14 | +0.364 | +0.193 | +0.224 | +12.0 | +4.1 |
| 2017 | 23 | +0.436 | +10.0 | 1.20 | +0.369 | −0.004 | +0.463 | +39.3 | +9.0 |
| *2018* | *50* | *+0.233* | *+11.7* | | | *−0.184* | *+0.419* | *+31.8* | *+9.6* |
| *2019* | *21* | *+0.326* | *+6.8* | | | *+0.143* | *+0.187* | *+36.3* | *−11.2* |
| *2020* | *29* | *+0.094* | *+2.7* | | | *−0.098* | *+0.193* | *+21.1* | *+7.1* |
| *2021* | *34* | *+0.649* | *+22.1* | | | *+0.316* | *+0.334* | *+27.3* | *−6.4* |
| *2022* | *85* | *−0.153* | *−13.0* | | | *−0.093* | *−0.055* | *−1.4* | *+19.6* |
| *2023* | *45* | *+0.490* | *+22.0* | | | *+0.179* | *+0.320* | *+5.8* | *+1.4* |
| *2024* | *24* | *+0.152* | *+3.6* | | | *+0.227* | *−0.081* | *+35.9* | *+13.1* |
| *2025* | *34* | *+0.702* | *+23.9* | | | *+0.046* | *+0.657* | *+29.5* | *+15.2* |
| *2026\** | *57* | *+0.438* | *+25.0* | | | *+0.072* | *+0.366* | *+2.4* | *+13.0* |

\*2026 to 30 Oct. 2018-26 rows are the confirmation window (italic), already seen by #431.

- 5 of 10 test years positive; the five losing years are 2008, 2010, 2011, 2012, 2014. Drift-adjusted, 5 of 10 years positive.
- 2022, the one bear year in #431's window, is **negative on OANDA (−13.0R, n 85)** where #431 had it at +2.3R on HistData cash.
  It is the only year where the two data sources disagree in sign; #431's "9 of 9 years" is 8 of 9 here.

### Gate state, 2008-17 (descriptive)

| gold-rule buys 2008-17 | n | WR | net exp | t |
|---|---|---|---|---|
| gate on (20-day return < 0) | 490 | 42% | +0.023 | 0.39 |
| gate off (20-day return > 0) | 840 | 43% | −0.017 | −0.37 |
| random buys, gate on | 4,329 | 41% | +0.006 | 0.31 |
| random buys, gate off | 7,856 | 44% | −0.025 | −1.80 |

The gate adds +0.04R a trade over the ungated buys in 2008-17, and random longs taken on the same dips gain about the same (+0.03R)
over random longs on rallies. So on this decade the gate is worth what a dip is worth to any long, not what it is worth to the
signal. In 2018-26 the gated signal beats random gated longs by +0.245R; in 2008-17 by +0.002R.

## Honest reading

- **The dip-buy edge is a post-2015 phenomenon.** 2008-14 pooled: −40R over 354 trades (−0.114R a trade, t −1.74; drift-adjusted
  −0.103). 2015-17: +51R over 137 trades (+0.371R, t 2.85; drift-adjusted +0.275, t 2.16; not pre-registered as a window). 2018-26:
  +105R over 379 trades. The 2013-17 half passes its own t (2.48) only because 2015-17 is in it, and drift-adjusted the half shrinks
  to +0.112R (t 1.14): 2013-14 were years when any long on a dip did well. Twelve good years in a row is a real pattern, but it is a pattern of the market since the
  2015-16 volatility cycle (buy-the-dip in US indices), not something the iFVG signal finds across regimes. This is the same shape
  as every other ICT result on this desk: the unchanged A-rule (#526), the DAX, silver and FX (#545), nine more markets (#579).
- **What the dip-buy is not:** it is not an edge over random longs on the same dips before 2015, and it is not positive on ES before
  2018 in either half. #431's strongest claim ("beats random longs in every bear window") rested on five windows, four of them after
  2018. The two bear markets of the test decade, 2008-09 and 2011, are where it lost most (−13.8R, −14.5R; drift-adjusted 2011
  −0.21R a trade).
- **What the dip-buy is:** on 2015-26 it is the best single rule this desk has run on NQ/ES (+156R, no year below −13R, drawdown
  23R on 2018-26). As a *paper shadow* it is worth keeping: if the post-2015 regime persists, it earns; if it ends, the shadow will
  show it long before a live switch would have. That is what the tracker's 'dip' stream already does.
- **Implications (for the owner; nothing changed here):**
  - Do not replace the NQ/ES A-rule with the dip-buy on #431's evidence. The pre-registered bar on the only untouched decade fails
    on all three counts.
  - Keep the paper 'dip' shadow (`ict/shadow.json`, replay `.shadow`) as a forward test with a stated regime caveat: "positive
    every year since 2015, flat-to-negative 2008-14, no edge over random dip longs before 2015".
  - The robustness label for the ICT desk ("no demonstrated edge outside 2018-26 on its own markets", #526 / #545 / #579) now
    covers its best candidate variant too.
- **Caveats.** Cash/spot CFD mid quotes, not futures (declared in #526); OANDA's overnight quotes before about 2012 are thinner, so
  some Asia-hour H1 candles come from fewer quotes (coverage per year is in result.json, as #526). The index rule's exact
  reproduction and the dip-buy's 2018-26 reproduction say the harness is right; they do not make 2008-12 CFD data equal to CME
  futures of the time. NQ and ES trades fall on the same days; the month-block bootstrap keeps them together, but n 491 overstates
  the independent bets. No market or year was dropped.

## Multiple testing

- One primary (H1) and one secondary (H2) pre-registered hypothesis. Both fail.
- The 2015-17 / 2008-14 split, the gate-state table and the per-year drift figures are descriptive, found after the result, and are
  not evidence for a re-dated rule ("dip-buy since 2015" would be a third look at the same data).

## Files

- `preregistration.md`: rule, data, costs, control, calibration gate and bar, pushed before the run (0e7c5a69).
- `run.mjs`: the desk's code over the cached OANDA candles (`trades`), the calibration gate (`calib`), the test (`full`).
- `result.json`: every table above for both windows, per market and year, the control cells, coverage, the calibration and the verdict.

Re-run (about 40 s for the trades, a minute for the statistics, once the #526 cache exists):

```
node research/edge/ict-dipbuy-oos/run.mjs <cache> trades
node research/edge/ict-dipbuy-oos/run.mjs <cache> calib
node research/edge/ict-dipbuy-oos/run.mjs <cache> full research/edge/ict-dipbuy-oos/result.json
```

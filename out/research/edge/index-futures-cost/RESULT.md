**Verdict:** INCONCLUSIVE (cost accounting, no rule tested; no study's verdict changes): on CME micro futures the same trades net index-overnight US500 +0.001R / NAS100 +0.015R a trade (CFD −0.022 / −0.006), index-ibs SPX500 +0.042 / NAS100 +0.086 / US30 +0.034R (CFD +0.013 / +0.056 / −0.011), turn-of-month SPX500 +0.068 % / NAS100 +0.350 % (CFD −0.015 / +0.260), 2016 on; under each study's own bar with futures costs: index-overnight FAIL, index-ibs PASS, turn-of-month FAIL.

# The same index trades on CME micro futures (14 Nov 2026)

Paper research, **cost accounting only** (`PREREGISTRATION.md`, pushed alone first). The trades are the three studies' own,
produced by their unchanged code and re-costed, never re-selected. No rule is tested here and **no verdict of the three studies
changes**: a micro future is a different instrument, and a route picked after seeing the CFD loss, on the same history the rule
was judged on, is not evidence of an edge. A futures route would need its own pre-registration and its own forward record.

## Gates

- G1: each study's unchanged run.mjs re-run in a temporary directory wrote a result.json byte-identical to its branch's (checked by hand when rows.json.gz was written: index-overnight, index-ibs, turn-of-month).
- G2 / G3: the stored rows reproduce every published n, mean gross, mean CFD net, t and placebo figure used here: **passed**.

## Cost model (pre-registered)

Per trade, in index points, divided by the trade's own 1R (turn-of-month: by its entry price, in %): **2 ticks** a round trip (1 tick a side: MES 0.25, MNQ 0.25, MYM 1 pt),
**$1.24 commission and fees** a round trip a micro contract ($0.62 a side, the figure of `research/edge/costs/RESULT.md`; broker-dependent, not verified),
**carry** (r − q) × days held / 365 × entry (r = FRED DGS2 as of the entry date, 3.85 % before 2006; q = the index's dividend yield, a yearly figure **from memory, not verified**;
not floored, so a credit when q > r), and one more round trip per quarterly roll held through (none in these holds). F2 = the repository's all-in micro round trip
(`ICT_COST_PTS`: MES 1.00, MNQ 1.37, MYM 5.5 pt), F3 = no dividend (q = 0). "CFD + div" = the published CFD net plus the dividend a CFD long is credited, which the published figures leave out.

## index-overnight (R a trade; month-sum t over months with a trade, its own form)

| Test | Window | n | Gross | CFD net (published) | Futures net F1 | F2 all-in | F3 q = 0 | CFD + div | t gross | t CFD | t futures | t F2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 US500 → MES | 2016-26 | 2721 | +0.023 | −0.022 | **+0.001** | −0.006 | −0.004 | −0.017 | +2.87 | −2.86 | **+0.08** | −0.79 |
| T1 US500 → MES | 2005-15 | 2743 | +0.014 | −0.025 | **−0.029** | −0.044 | −0.035 | −0.020 | +2.29 | −3.96 | **−4.66** | −6.95 |
| T2 NAS100 → MNQ | 2016-26 | 2721 | +0.026 | −0.006 | **+0.015** | +0.013 | +0.013 | −0.004 | +3.54 | −0.84 | **+2.02** | +1.78 |
| T2 NAS100 → MNQ | 2005-15 | 2743 | +0.028 | −0.004 | **−0.008** | −0.015 | −0.010 | −0.002 | +4.65 | −0.69 | **−1.31** | −2.55 |

Cost components (R a trade):

| Test | Window | CFD spread | CFD financing | ticks | commission | carry | rolls | median stop % of price | mean days held |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 2016-26 | +0.027 | +0.017 | +0.013 | +0.007 | +0.002 | 0 | 1.166 | 1.17 |
| T1 | 2005-15 | +0.025 | +0.015 | +0.029 | +0.015 | 0.000 | 0 | 1.194 | 1.17 |
| T2 | 2016-26 | +0.020 | +0.013 | +0.004 | +0.005 | +0.003 | 0 | 1.594 | 1.17 |
| T2 | 2005-15 | +0.020 | +0.011 | +0.015 | +0.019 | +0.002 | 0 | 1.463 | 1.17 |

Its own bar with futures costs:

| Test | n ≥ 300 both | net > 0, t ≥ 2 (2016-26) | net > 0 (2005-15) | Holm p < 0.05 | above placebo p95 | net > 0 at 2x trading cost | Pass |
|---|---|---|---|---|---|---|---|
| T1 | yes | no | no | no (p 0.468) | yes (p95 0.000) | no | no |
| T2 | yes | yes | no | yes (p 0.043) | yes (p95 +0.013) | yes | no |

Pooled (monthly sums of T1 + T2, futures): 2016-26 +0.323R a month, t +1.05; 2005-15 −0.776R, t −3.13. Pooled condition met: no. **On futures costs its bar reads FAIL** (published on CFD costs: FAIL).

## index-ibs (R a trade; month-sum t over every calendar month, empty 0, its own form)

| Test | Window | n | Gross | CFD net (published) | Futures net F1 | F2 all-in | F3 q = 0 | CFD + div | t gross | t CFD | t futures | t F2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 SPX500 → MES | 2016-now | 472 | +0.062 | +0.013 | **+0.042** | +0.036 | +0.036 | +0.019 | +1.72 | +0.37 | **+1.16** | +0.99 |
| T1 SPX500 → MES | 2005-15 | 521 | +0.115 | +0.071 | **+0.073** | +0.060 | +0.068 | +0.077 | +4.31 | +2.66 | **+2.75** | +2.23 |
| T2 NAS100 → MNQ | 2016-now | 473 | +0.096 | +0.056 | **+0.086** | +0.084 | +0.084 | +0.058 | +2.89 | +1.65 | **+2.56** | +2.51 |
| T2 NAS100 → MNQ | 2005-15 | 513 | +0.051 | +0.010 | **+0.016** | +0.009 | +0.014 | +0.012 | +1.82 | +0.34 | **+0.56** | +0.30 |
| T3 US30 → MYM | 2016-now | 469 | +0.049 | −0.011 | **+0.034** | +0.031 | +0.027 | −0.004 | +1.44 | −0.31 | **+1.01** | +0.92 |
| T3 US30 → MYM | 2005-15 | 514 | +0.094 | +0.041 | **+0.066** | +0.060 | +0.059 | +0.048 | +3.39 | +1.46 | **+2.38** | +2.14 |
| P pooled | 2016-now | 1414 | +0.069 | +0.020 | **+0.054** | +0.050 | +0.049 | +0.024 | +2.30 | +0.64 | **+1.78** | +1.67 |
| P pooled | 2005-15 | 1548 | +0.087 | +0.041 | **+0.052** | +0.043 | +0.047 | +0.046 | +3.52 | +1.63 | **+2.09** | +1.71 |

Cost components (R a trade):

| Test | Window | CFD spread | CFD financing | ticks | commission | carry | rolls | median stop % of price | mean days held |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 2016-now | +0.033 | +0.016 | +0.012 | +0.006 | +0.003 | 0 | 1.289 | 1.42 |
| T1 | 2005-15 | +0.030 | +0.014 | +0.027 | +0.014 | +0.001 | 0 | 1.348 | 1.44 |
| T2 | 2016-now | +0.029 | +0.012 | +0.003 | +0.004 | +0.004 | 0 | 1.87 | 1.47 |
| T2 | 2005-15 | +0.031 | +0.011 | +0.014 | +0.018 | +0.003 | 0 | 1.604 | 1.46 |
| T3 | 2016-now | +0.043 | +0.017 | +0.006 | +0.007 | +0.002 | 0 | 1.212 | 1.44 |
| T3 | 2005-15 | +0.040 | +0.014 | +0.013 | +0.016 | −0.001 | 0 | 1.268 | 1.4 |
| P | 2016-now | +0.035 | +0.015 | +0.007 | +0.006 | +0.003 | 0 | 1.439 | 1.44 |
| P | 2005-15 | +0.033 | +0.013 | +0.018 | +0.016 | +0.001 | 0 | 1.425 | 1.43 |

Its own bar with futures costs:

| Test | (a) n ≥ 100 | (b) net > 0 | (c) month t ≥ 2, Holm p < 0.05 | (d) 2005-15 net > 0 | (e) placebo beaten ≥ 38 / 40 | Pass |
|---|---|---|---|---|---|---|
| T1 | yes | yes | no (Holm p 0.247) | yes | no (33 / 40) | no |
| T2 | yes | yes | yes (Holm p 0.016) | yes | yes (40 / 40) | PASS |
| T3 | yes | yes | no (Holm p 0.247) | yes | no (32 / 40) | no |
| P | – | yes | no | yes | yes (39 / 40) | no |

**On futures costs its bar reads PASS** (published on CFD costs: FAIL).

## turn-of-month (% of price a trade; its own t is the trade t; month-sum t equals it here, one trade a month)

| Test | Window | n | Gross | CFD net (published) | Futures net F1 | F2 all-in | F3 q = 0 | CFD + div | t gross | t CFD | t futures | t F2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SPX500 → MES | 2016-now | 129 | +0.102 | −0.015 | **+0.068** | +0.061 | +0.042 | +0.010 | +0.63 | −0.10 | **+0.42** | +0.37 |
| SPX500 → MES | 2008-15 | 93 | −0.021 | −0.113 | **−0.055** | −0.074 | −0.088 | −0.079 | −0.08 | −0.42 | **−0.20** | −0.27 |
| US30 → MYM | 2016-now | 129 | +0.107 | −0.022 | **+0.084** | +0.080 | +0.052 | +0.010 | +0.70 | −0.14 | **+0.55** | +0.53 |
| US30 → MYM | 2008-15 | 93 | −0.091 | −0.193 | **−0.099** | −0.107 | −0.139 | −0.153 | −0.38 | −0.81 | **−0.42** | −0.45 |
| NAS100 → MNQ | 2016-now | 129 | +0.389 | +0.260 | **+0.350** | +0.348 | +0.338 | +0.272 | +1.86 | +1.24 | **+1.68** | +1.67 |
| NAS100 → MNQ | 2008-15 | 93 | +0.245 | +0.143 | **+0.200** | +0.189 | +0.185 | +0.158 | +0.92 | +0.53 | **+0.75** | +0.71 |

Cost components (% of price a trade):

| Test | Window | CFD spread | CFD financing | ticks | commission | carry | rolls | median stop % of price (2 x ATR) | mean days held |
|---|---|---|---|---|---|---|---|---|---|
| spx500 | 2016-now | +0.040 | +0.077 | +0.014 | +0.007 | +0.013 | 0 | 2.334 | 5.66 |
| spx500 | 2008-15 | +0.040 | +0.052 | +0.037 | +0.018 | −0.022 | 0 | 2.882 | 5.85 |
| us30 | 2016-now | +0.050 | +0.079 | +0.007 | +0.008 | +0.008 | 0 | 2.354 | 5.73 |
| us30 | 2008-15 | +0.050 | +0.052 | +0.016 | +0.020 | −0.028 | 0 | 2.603 | 5.86 |
| nas100 | 2016-now | +0.050 | +0.079 | +0.005 | +0.006 | +0.027 | 0 | 3.124 | 5.8 |
| nas100 | 2008-15 | +0.050 | +0.052 | +0.022 | +0.027 | −0.003 | 0 | 3.272 | 5.87 |

Its own bar with futures costs (T3, turn days against the rest before costs, is unchanged by any cost):

| Market | T1 net > 0, t ≥ 2 | T2 placebo ≥ 38 / 40 | T3 Welch t ≥ 2 | Holm p | Pass |
|---|---|---|---|---|---|
| spx500 | no | no (15) | no (t 0.11) | 0.582 | no |
| us30 | no | no (17) | no (t 0.17) | 0.582 | no |
| nas100 | no | no (34) | no (t 0.17) | 0.14 | no |

**On futures costs its bar reads FAIL** (published on CFD costs: FAIL; the verdict is on SPX500).

## Reading

- **Where the CFD money went, and what futures keep of it.** On the decisive windows the CFD route paid 0.044R (US500 overnight), 0.033R (NAS100 overnight) and 0.041-0.060R (IBS) a trade in spread and financing; the same trades on micros pay 0.011-0.022R in ticks, commission and carry. Overnight financing is the line that disappears: the futures carry is (r − q), and the dividend offsets most of the rate, so it costs 0.002-0.004R a one-night trade. The ticks and the commission are fixed in points, so they are cheap at 2016-26 index levels and dear at 2005-15 levels (US500 overnight 0.044R on futures against 0.040R on the CFD in 2005-15).
- **Against each study's own bar, with futures costs in place of CFD costs**: index-overnight still FAILS (NAS100 meets every condition on 2016-26, +0.015R, t 2.02, Holm p 0.043, but loses on 2005-15, −0.008R; US500 +0.001R, t 0.08); turn-of-month still FAILS (no market reaches t 2: SPX500 +0.068 %, t 0.42; NAS100 +0.350 %, t 1.68; its T3, turn days against the rest, is before costs and fails whatever the cost); **index-ibs T2 (NAS100) meets all five of its conditions**: +0.086R a trade on 2016-now (n 473, month-sum t 2.56, Holm p 0.016), 2005-15 +0.016R (t 0.56), above 40 of 40 placebo seeds. The all-in sensitivity F2 gives +0.084R, t 2.51; q = 0 gives +0.084R. SPX500, US30 and the pooled test still fall short of t 2.
- **That is not a new verdict and not an edge.** It is a different instrument chosen after the CFD result was seen, on the same 2005-26 history the rule was judged on, with three studies and nine tests looked at here; the NAS100 IBS long never replicated on 2005-15 on any cost basis (gross +0.051R, t 1.82; futures t 0.56); micros did not exist before May 2019 (from June 2019 on, post hoc: +0.073R, t 2.08, n 347); and one MNQ at these stops risked a median of about $1,090 in 2026, so 0.25 % a trade needs an account of about $435,000. index-ibs's own pre-registration said a PASS would at most go to the owner as a forward paper shadow, never a live rule; the most this result can support is that question, put with its own pre-registration and judged only on a forward record. No proposal is written here.
- **The CFD figures were also a little harsher than the CFD itself**: they leave out the dividend a CFD long is credited, worth 0.002-0.007R a one- or two-night trade and 0.01-0.03 % of price a turn-of-month hold. With it the CFD nets move up a little (column "CFD + div") and futures are still ahead on every decisive window.

## Assumptions and limits

- **Micro index futures started trading in May 2019.** Every figure before that assumes the micro tick and fee schedule anyway (a hypothetical instrument). The E-minis (ES, NQ, YM) existed with the same tick in points and ten times the dollars a point, so a tenth of the commission in points, but one E-mini risks ten times a micro (about $4,000-11,000 at these stops in 2026).
- **Whole contracts are ignored**: every trade is 1R, as in the studies. In 2026 one MES at these stops risked about $320-590 (median $430-470), one MNQ $740-1,430 (median $1,000-1,090), one MYM $280-420 (10th to 90th percentile of the trades): at 0.25 % a trade that is an account of $110,000 (MYM) to $435,000 (MNQ). A smaller account cannot hold these trades on micros at the studies' risk.
- **The price path is the OANDA CFD mid**, taken as the cash index; a future trades the same points plus a basis. The 16:00 and 09:30 prices of a future are not the cash index's and the futures spread outside the cash session is wider than one tick (the overnight leg enters at 16:00 and exits at 09:30, both inside or at the edge of the cash session). Slippage beyond one tick a side is in F2 only.
- **r is a 2-year Treasury yield**, not the 3-month rate a front future discounts; q is a yearly approximation from memory. The carry is a few thousandths of an R for one-day holds, so neither moves a figure here by more than about 0.005R.
- **Commission $0.62 a side** is the repository's figure; brokers charge from about $0.25 to over $1 a side a micro, plus exchange and regulatory fees.
- Nothing here touches a stop: every trade keeps the stop its study gave it. Paper only; nothing live changed and no proposal is written.

To repeat: see the head of `dump.mjs` (each branch's own code in a temporary directory, its own fetch), then `node research/edge/index-futures-cost/run.mjs`. Tests: `tests/index-futures-cost.test.mjs`.

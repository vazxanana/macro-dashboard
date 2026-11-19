# Result: one-week cross-sectional reversal in nine currencies against the dollar (14 Nov 2026)

**Verdict: FAIL, 1 of 5 checks** (PREREGISTRATION.md, pushed alone before any number was computed). Buying the two currencies
that fell most against the dollar over the past week and selling the two that rose most lost money net of costs in both
windows: decisive 2016 to 6 Nov 2026 −0.024R a week (566 weeks, month-sum t −1.97), replication mid-2004 to 2015 −0.006R a
week (600 weeks, t −0.49). Before any cost the decisive book is flat (−0.001R a week, t −0.08), and ranking did no better than
picking currencies at random (the placebo). Not an edge; nothing live changed and no proposal is written.

| Book of 4 legs, R a week = sum / 4 (1R = 2 x ATR(20) a leg) | Weeks | Gross R a week | Net R a week | Net total | Month-sum t (net) | Worst drawdown (net) |
|---|---|---|---|---|---|---|
| Decisive, 8 Jan 2016 to 6 Nov 2026 | 566 | −0.0009 | −0.0237 | −13.39R | −1.97 | −15.36R |
| Replication, 9 Jul 2004 to 31 Dec 2015 | 600 | +0.0145 | −0.0064 | −3.82R | −0.49 | −6.07R |

| Check (all required) | Bar | Result |
|---|---|---|
| Decisive mean net R a week | > 0 | −0.0237: **no** |
| Replication mean net R a week | > 0 | −0.0064: **no** |
| Decisive month-sum t | >= 2 | −1.97 (131 months): **no** |
| Decisive weeks | >= 300 | 566: yes |
| Placebo, 40 random rankings | above their 95th percentile (−0.72) | −1.97: **no** (beats 19 of 40; median −1.94) |

- **Cost sensitivity** (decisive, R a week; month-sum t): 0x (gross) −0.0009 (t −0.08); base −0.0237 (t −1.97); 2x (trading
  costs and financing charges doubled, credits at 1x) −0.0483 (t −4.01). Replication: +0.0145 (t 1.11), −0.0064 (t −0.49),
  −0.0287 (t −2.18). The replication years had a small gross reversal, not significant, which the costs remove.
- **Where the R goes** (decisive, a leg, in R of that leg): 2,264 legs, 48.0 % won, 16.7 % stopped, 0 gap fills (29 in the
  replication window); gross −0.001R, trading cost 0.011R, financing charged 0.013R, financing credited 0.002R, 5.6 nights a
  leg; net −0.024R. A weekly round trip and today's swaps take about 0.022R a leg against a gross of about zero.
- **Placebo**: 40 seeded books of 2 random longs and 2 random shorts a week, same stops, exits and costs, 2016 on: month-sum t
  5th percentile −3.44, median −1.94, 95th percentile −0.72, best +0.12; mean net R a week median −0.021. The rule's −1.97 sits
  at the placebo median: ranking by last week's return added nothing over a random pick paying the same costs.
- **Years** (net R, by exit date; reported only): 2004 −2.07 (from July), 2005 −1.89, 2006 +2.37, 2007 +2.47, 2008 −3.06,
  2009 +1.47, 2010 +0.11, 2011 +2.16, 2012 −1.35, 2013 −0.33, 2014 −1.43, 2015 −2.17, 2016 −1.11, 2017 +0.98, 2018 −1.63,
  2019 +0.38, 2020 +2.38, 2021 −2.82, 2022 −2.67, 2023 −1.52, 2024 −3.96, 2025 −0.89, 2026 −2.48 (to 6 Nov). Eight of 23
  years positive; 2021-26 all negative.
- **Which currencies drive it** (decisive, net R contributed to the book, legs / 4): the biggest losers are buying JPY after a
  fall (−4.86R on 201 legs, gross −3.73R), buying CAD after a fall (−3.93R), buying NZD after a fall (−3.10R) and selling GBP
  after a rise (−2.30R); the biggest winners buying AUD after a fall (+3.55R, gross +3.71R) and selling AUD after a rise
  (+1.40R). SEK and NOK, the two currencies added for this study at an assumed wider cost, contributed −1.31R and −2.66R net
  (gross +1.04R and −0.16R). No single currency carries a reversal that survives its costs; JPY, the most traded leg, ran the
  other way (a fall was followed by more fall in 2021-24).
- **The data**: 5,842 common trading days (2004-06-01 to 2026-11-06, the USD/SEK file starting the calendar); flat
  (high = low) candles from 2008 on: none on the seven majors, 1 on SEK, 3 on NOK. council-data commit recorded in
  `result.json`.

## Variants (pre-registered, reported only, never judged)

| Variant | Window | Weeks / days | Gross R | Net R | Month-sum t gross | Month-sum t net |
|---|---|---|---|---|---|---|
| V1 daily rebalance (1-day rank, out at that day's close) | decisive | 2,828 days | +0.0051 a day | −0.0087 | 2.12 | −3.58 |
| V1 | replication | 2,992 days | +0.0002 a day | −0.0136 | 0.07 | −4.80 |
| V2 four currencies (EUR, JPY, GBP, AUD; all four every week) | decisive | 566 weeks | −0.0053 | −0.0212 | −0.48 | −1.91 |
| V2 | replication | 600 weeks | +0.0117 | −0.0015 | 0.99 | −0.13 |

The daily variant shows a gross one-day reversal on 2016-26 (t 2.12 before costs) that is absent in 2004-15 (t 0.07) and is
eaten several times over by a daily round trip (0.011R a leg a day against +0.005R gross). It was not the judged test, it did
not replicate, and it is one of three looks: it is not a lead for a live rule. Its holds run from the open to the close of one
UTC day, so they usually cross one 22:00 rollover; that is charged.

## Related

- `research/edge/fx-xs-momentum/` (branch `fx-xs-momentum`, 13 Nov 2026): MONTHLY cross-sectional MOMENTUM on seven G10
  currencies, FAIL (63-day decisive month t −1.79, 21-day −1.13). This study is the opposite sign at a weekly horizon and is a
  distinct test; its loader, ATR, stop and statistics were copied, not imported.
- `research/edge/fx-reversal/` (branch `fx-reversal`, 13 Nov 2026, not merged): a one-week reversal on the seven USD majors
  with equal-volatility weights, a 3 x ATR(20) stop and a flat financing charge, FAIL 0 of 4 (decisive month-sum t −1.60 net,
  +0.03 gross). Its result was known when this study was pre-registered (said in PREREGISTRATION.md). This one widened the
  universe to nine currencies with SEK and NOK, sized by equal risk, folded the Sunday stubs and used the broker's swaps; the
  answer is the same: no reversal premium before costs since 2016, a loss after them. Two specifications of one idea have now
  failed; a third is not suggested.

## What it means, and what it does not

It means: on the council's OANDA daily candles, a weekly cross-sectional reversal among nine currencies against the dollar has
earned nothing before costs since 2016, a little (not significant) in 2004-15, and loses money at the costs a retail
raw-spread CFD account pays. It is not a council rule and no proposal is written.

It does not mean: that short-horizon reversal is absent in other currency sets (emerging-market currencies, crosses), at
institutional costs, or in a carry-inclusive book. Today's swaps were charged for every past year (past rate differentials are
not reachable here), and SEK / NOK costs are assumptions, not demo measurements. The literature was cited from memory and not
opened (PREREGISTRATION.md). Any further version needs its own pre-registration.

To repeat: `node research/edge/fx-weekly-reversal/run.mjs` (reads council-data with `git show`, no network; writes
`result.json`, about 1 s). Tests: `tests/fx-weekly-reversal.test.mjs`.

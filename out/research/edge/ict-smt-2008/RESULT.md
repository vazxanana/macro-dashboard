# ICT index A-setups: SMT at the sweep, replicated on 2008-2019 (pre-registered)

**Verdict: FAIL. On 2008-19 the A-setups without SMT did not beat those with it: −0.019R a trade net (n 1,936 vs 628, Welch t −0.30); "skip SMT setups" does not replicate.**

`research/edge/ict-smt` found, after the fact, that on 2024-26 the index A-setups without SMT divergence at the sweep made
+0.211R a trade net against −0.158R for those with it (difference −0.369R, t −3.01), while 2020-23 showed almost no gap. This
study asked the reverse rule ("skip the SMT setups") on twelve years ict-smt never read, with ict-smt's detector unchanged. It
is not there: over 2008-2019 the two groups are within noise of each other, the sign flips between the two halves, and 24 of 40
random labellings give a difference at least as large as the one observed. The no-SMT setups alone lost money net too (H2). The
2024-26 gap was one stretch of years. No proposal; no file of the ICT desk changed.

## How it was run

- **Pre-registration first.** `PREREGISTRATION.md` was committed and pushed alone (12a0c6b28) after the candle download only (no
  signal computed, no `count` stage). The runner and the detector followed in the next commit; then `count` and `full` ran once.
  Plan sha256 `7f54ad7b…9599` is in `result.json`.
- **Detector.** `smt.mjs` is `research/edge/ict-smt/smt.mjs` copied byte for byte (sha256 `a52082e7…2dca1e`, checked by the test):
  the most recent confirmed, untouched H1 swing (3 a side, last 96 candles) the sweep took; partners NQ → ES, ES → NQ, YM → ES,
  RTY → ES; the partner holds when none of its candles after the swing's 7-candle window, up to and including the sweep candle,
  trades beyond its extreme of that window. Sells mirror. Only candles at or before the sweep candle are read.
- **Engine.** As ict-smt: the lab's `runMarket` (the desk's `signals` / `isASetup` / `sizeOf`, the replay's `simulate`, imported,
  never edited), one open trade per market per stream, live exit and sizing.
- **Data.** OANDA mid H1 NAS100, SPX500, US30 and **US2000** through the keyless proxy (ict-oos-2008's source; the proxy now
  serves `us2000` from June 2007, so RTY is in, with ES as partner), 1 Jun 2007 warm-up to 14 Jan 2020; the 17:00 New York hour
  and CME closures dropped (as ict-oos-2008 and the live futures feed). Signals closing 2008-01-01 to 2019-12-31. **No overlap
  with ict-smt's 2020-26.** There is no in-sample / out-of-sample split inside this window: the whole window is the replication.
- **Costs.** ict-oos-2008's model: 0.02 % of price + one futures tick a round trip (NQ, ES 0.25; YM 1; RTY 0.1). No financing
  (trades last at most 36 H1 candles; the desk trades futures). The lab's fixed points are reported beside it.
- **Statistics.** H1 one-sided Welch on trades, H2 one-sided t on the 144 calendar-month sums, Holm over the two; placebo of
  40 seeded random labels at each market's SMT share (NQ 28 %, ES 21 %, YM 19 %, RTY 27 %).

## Results (index book, pooled; R a trade after costs, live sizing)

| stream | window | n | win | R a trade | total R | max DD | t (trades) | t (months) |
|---|---|---|---|---|---|---|---|---|
| all A-setups | 2008-19 | 2496 | 32% | −0.032 | −79.1 | 124.1 | −1.19 | −0.86 |
| all A-setups | 2008-13 | 1355 | 31% | −0.076 | −103.6 | 112.3 | −2.16 | −1.56 |
| all A-setups | 2014-19 | 1141 | 34% | +0.021 | +24.5 | 40.8 | 0.53 | 0.39 |
| **SMT** | 2008-19 | 628 | 33% | −0.021 | −13.4 | 63.1 | −0.38 | −0.34 |
| SMT | 2008-13 | 335 | 31% | −0.118 | −39.4 | 41.9 | −1.73 | −1.84 |
| SMT | 2014-19 | 293 | 35% | +0.089 | +26.0 | 23.7 | 0.96 | 0.79 |
| **no SMT** | 2008-19 | 1936 | 32% | −0.040 | −77.9 | 96.7 | −1.36 | −1.06 |
| no SMT | 2008-13 | 1060 | 31% | −0.071 | −75.2 | 93.1 | −1.76 | −1.35 |
| no SMT | 2014-19 | 876 | 34% | −0.003 | −2.7 | 43.2 | −0.07 | −0.06 |

Gross (before costs): SMT +0.035R, no SMT +0.012R, all +0.022R a trade. At 2x costs: SMT −0.078R, no SMT −0.093R (monthly t
−2.42). With the lab's fixed-point costs: SMT −0.029R, no SMT −0.045R.

| test | result | Holm p | passes |
|---|---|---|---|
| H1 no SMT − SMT > 0 (primary) | −0.019R, Welch t −0.30 (one-sided p 0.62); gross −0.023R, 2x costs −0.015R | 1.00 | no |
| H2 no SMT alone > 0 | −0.040R, n 1,936, monthly t −1.06 (one-sided p 0.86) | 1.00 | no |

By half, the H1 difference: +0.047R (t 0.59) in 2008-13, −0.092R (t −0.90) in 2014-19: opposite signs, neither near t 2.

**Placebo** (seeds 1000-1039): random differences ran from −0.155R to +0.113R; 24 of 40 reached the observed −0.019R (the bar
was at most 2). Their t ran from −2.36 to +1.91. 27 of 40 reached the H2 monthly t. The observed split is ordinary noise.

By year (total R, trades), SMT vs no SMT: 2008 −14.4 (59) / −11.6 (189); 2009 −16.6 (49) / −25.1 (187); 2010 +3.4 (51) / −1.8
(176); 2011 +2.1 (51) / +1.0 (185); 2012 −6.4 (69) / −17.7 (152); 2013 −7.4 (56) / −20.1 (171); 2014 −13.9 (44) / +12.6 (147);
2015 +16.5 (43) / +6.6 (141); 2016 +8.3 (54) / −10.6 (165); 2017 +3.7 (57) / +14.0 (142); 2018 +1.2 (52) / +1.0 (142); 2019
+10.3 (43) / −26.3 (139). No SMT did better in 5 of 12 years.

By market (R a trade, n; reported only):

| market | partner | all | SMT | no SMT | no SMT − SMT (t) |
|---|---|---|---|---|---|
| NQ | ES | −0.075 (634) | −0.090 (191) | −0.090 (463) | 0.000 (0.00) |
| ES | NQ | −0.054 (625) | −0.094 (141) | −0.049 (505) | +0.046 (0.35) |
| YM | ES | +0.045 (623) | +0.098 (125) | +0.027 (510) | −0.071 (−0.48) |
| RTY | ES | −0.042 (614) | +0.028 (171) | −0.055 (458) | −0.083 (−0.68) |

Inside the unfiltered stream's own trades (the same trades, tagged): SMT −0.021R (597), no SMT −0.035R (1,899). Tag reasons over
the 2,670 A-setup signals: partner held 637 (SMT), partner took its own extreme too 1,660, no swing taken found by the detector
306, partner candles missing 66, no partner candle at the sweep time 1.

## What it means, and what it does not

- "Skip the SMT setups" is not a rule: on twelve untouched years the no-SMT A-setups were no better than the SMT ones (t −0.30),
  and the 2024-26 gap in ict-smt does not repeat. Together with ict-smt's own FAIL, SMT at the sweep, as defined, carries no
  information about the A-setups' result on the desk's H1 model, in either direction. Not a filter, a grade point or a size step.
- The unfiltered A-rule lost money net over 2008-19 (−0.032R a trade, monthly t −0.86; −0.076R in 2008-13), in line with
  ict-oos-2008's FAILS on 2008-17. That is a reading of the A-rule on OANDA cash CFDs at these costs, not judged here.
- OANDA's pre-2012 overnight quotes are thin; the cash CFDs stand in for the futures the desk trades. A discretionary SMT read on
  a lower timeframe (Fred's judgement, the "SMT" review tag) is not measured by this.

## Repeat

`node --use-env-proxy research/edge/ict-smt-2008/run.mjs fetch <dir>` (candles outside git), then `node
research/edge/ict-smt-2008/run.mjs count <dir>` and `… full <dir>` (about 15 minutes; the placebo is most of it). Tests:
`tests/desk-ict-smt-2008.test.mjs`.

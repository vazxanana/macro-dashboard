# ICT index A-setups: SMT divergence at the sweep (pre-registered)

**Verdict: FAIL. Index A-setups with SMT at the sweep made −0.158R a trade net out of sample (n 149, monthly t −1.91) against +0.211R without (n 367); none of the three tests passes.**

The skill names SMT divergence (the signal index sweeps a low while its partner holds a higher low) as a core confirmation. On the
desk's own mechanical H1 model, 2020 to October 2026, the A-setups that had it did not do better: in sample they were about the
same as the others (+0.024R against +0.073R a trade, difference t −0.46), out of sample clearly worse (difference −0.369R, t
−3.01). The in-sample years do not repeat the out-of-sample gap, so this is not evidence that SMT is a warning sign either; that
would be a new hypothesis needing its own pre-registration on other data. The A-rule stays as it is. No proposal is made, and no
file of the ICT desk changed.

## How it was run

- **Pre-registration first.** `PREREGISTRATION.md` was committed and pushed alone (5ec86669), after the candle download and the
  runner's `count` stage (signal counts only, no trade simulated); the detector `smt.mjs` and the runner `run.mjs` followed in
  the next commit, unchanged since that count. Then the `full` stage ran, once. Plan sha256 `eef3bbf2…1629` is in `result.json`.
- **Prior look, declared.** Skill §28 (7 Nov) had tried a looser "SMT proxy" (a prior-24h extreme taken while ES or YM did not, cash
  NQ / ES / YM 2023-26, totals only, no n or t, not pre-registered) and read "no edge". No study, branch or tracker feature
  computed SMT for a signal; `gold-silver-divergence` is a gold / silver study.
- **Definition.** At the signal's sweep candle: the most recent confirmed, untouched H1 swing (3 a side, last 96 candles;
  `ict-equal-lows`' detector, imported) the sweep took; the partner (NQ → ES, ES → NQ, YM → ES, RTY → ES) holds when none of its
  own candles after the swing's 7-candle window, up to and including the sweep candle, trades beyond its extreme of that window.
  Only candles at or before the sweep candle, on both markets, aligned by time. Sells mirror. GC is excluded: no clean partner in
  the data (silver is a paper-only market).
- **Engine.** The lab's `runMarket` (the desk's `signals` / `isASetup` / `sizeOf` and the replay's `simulate`, imported, never
  edited), one open trade per market per stream, live exit and sizing, OANDA mid H1 NAS100 / SPX500 / US30 / US2000 (the same
  candles as `ict-equal-lows`: the A-setup counts are identical). IS 2020-23, OOS 2024-01-01 to 2026-10-31. Net of the lab's
  round trip (NQ 1.5, ES 0.5, YM 3, RTY 0.4 points); no financing (out within 36 H1 candles; the desk trades futures).
- **Statistics.** T1 on calendar-month sums (34 OOS months), T2 / T3 one-sided Welch on trades, Holm over the three; a placebo
  of 40 seeded random labels with each market's observed SMT share.

## Results (index book, pooled; R a trade after costs, live sizing)

| stream | window | n | win | R a trade | total R | max DD | t (trades) | t (months) |
|---|---|---|---|---|---|---|---|---|
| all A-setups | IS | 805 | 36% | +0.058 | +46.6 | 26.5 | 1.08 | 0.82 |
| all A-setups | OOS | 506 | 38% | +0.117 | +59.3 | 26.9 | 1.70 | 1.43 |
| **SMT** | IS | 224 | 38% | +0.024 | +5.3 | 18.3 | 0.28 | 0.22 |
| **SMT** | OOS | 149 | 30% | −0.158 | −23.6 | 27.3 | −1.86 | −1.91 |
| no SMT | IS | 597 | 35% | +0.073 | +43.7 | 28.4 | 1.11 | 0.85 |
| no SMT | OOS | 367 | 41% | +0.211 | +77.5 | 15.7 | 2.38 | 2.14 |

Gross (before costs) SMT: +0.045R IS, −0.143R OOS; no SMT: +0.093R IS, +0.227R OOS. At 2x costs SMT OOS −0.173R (monthly t −2.08).

| test | result | Holm p | passes |
|---|---|---|---|
| T1 SMT OOS net > 0 | −0.158R, n 149, monthly t −1.91 (one-sided p 0.97) | 1.00 | no |
| T2 SMT − no SMT, OOS | −0.369R, Welch t −3.01 (one-sided p 1.00) | 1.00 | no |
| T3 SMT − no SMT, IS | −0.049R, Welch t −0.46 | 1.00 | no (sign agrees with T2, size does not) |

**Placebo** (40 random labels, seeds 1000-1039): their T1 monthly t ran from −1.51 to +1.73 and their OOS difference from −0.351R
to +0.293R. The observed −1.91 and −0.369R are below every draw: out of sample the SMT trades were unusually poor, not
indistinguishable from random. In sample nothing like it (t −0.46), so the gap is one stretch of years, not a stable property.

By year (total R, trades): SMT +1.4 (54), +8.3 (64), −4.0 (44), −0.4 (62) in 2020-23; −14.8 (47), −4.0 (46), −4.8 (56) in
2024-26: 0 of 3 OOS years positive. No SMT: +22.4, +9.3, +31.0, −19.0; +26.7, +24.9, +25.9.

By market (R a trade, n; IS → OOS; not judged one by one, each under 50 OOS SMT trades):

| market | partner | SMT IS | SMT OOS | no SMT IS | no SMT OOS |
|---|---|---|---|---|---|
| NQ | ES | +0.059 (62) | −0.234 (29) | +0.215 (151) | +0.336 (95) |
| ES | NQ | −0.061 (41) | −0.251 (33) | +0.015 (158) | +0.322 (101) |
| YM | ES | +0.319 (58) | −0.038 (43) | +0.090 (150) | +0.033 (82) |
| RTY | ES | −0.227 (63) | −0.155 (44) | −0.034 (138) | +0.116 (89) |

NQ and ES alone have under 30 OOS SMT trades each: too few to judge per market. Inside the unfiltered stream's own trades (the
same trades, tagged) the split looks the same: SMT +0.032R IS / −0.139R OOS, no SMT +0.067R / +0.217R.

Tag reasons over the 1,381 A-setup signals: partner held 376 (SMT), partner took its own extreme too 824, no swing taken found by
the detector 156, partner candles missing 25 (the last two count as no SMT).

## What it means, and what it does not

- SMT at the sweep, as defined here, does not select better A-setups on the desk's H1 model. Not a filter, not a grade point, not
  a size step.
- The poor out-of-sample SMT record is not a reason to skip SMT setups: the in-sample years show no such gap, and the reverse rule
  was not the pre-registered question. Testing it would need its own pre-registration on data this study did not read.
- It measures a mechanical H1 definition with one fixed partner. A discretionary SMT read on M5 / M15 at the kill zone (the skill's
  use) is Fred's judgement on the desk; the "SMT" review tag (skill §28) is how that would be measured.
- Not tested: gold (no partner in the data), other partner choices, SMT on a lower timeframe, SMT as the entry trigger.

## Repeat

`node --use-env-proxy research/edge/ict-smt/run.mjs fetch <dir>` (candles outside git), then `node research/edge/ict-smt/run.mjs
count <dir>` and `… full <dir>` (about 5 minutes; the placebo is most of it). Tests: `tests/desk-ict-smt.test.mjs`.

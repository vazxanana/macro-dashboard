# Grid 5: the MSNR direction call, a Daily key level and the working-timeframe box (result)

**Verdict: PASS. 2 of 11,625 cells confirmed before costs after Holm (placebo 0), both one rule under two exits: Daily engulf zone, H1 box close-out, H1 structure break, New York hours, market entry: +0.233R a trade in 2015-19, n 317, month t 4.40; the grid as a whole is at chance (237 discovery winners against about 265 expected).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first, commit 70a9fa4). Research only:
nothing live changed. A pass here is a before-cost tilt in one cell on 2010-2019, never an edge.

## What was run

OANDA mid 5-minute candles 2009-2019 (2009 warm-up; fills 2010-2019) for xau, eurusd, gbpusd, usdjpy, audusd, the data-quality
exclusions applied (201 fills dropped), costs of combo-grid-2. Factors: the MSNR call on H4 with Daily key levels
(`council/eg-methods.mjs` `direction()`, imported) with / against / any; the Daily key level touched (V / A turn, engulf zone,
EF, DOM, fresh supply / demand); the box on H1 or M15 (close out with the side, or a false break back in); the trigger (the box
event, an engulf within 1 or within 3 candles, a structure break); time of day (London 07-12, New York 12-17, other UTC);
entry (market at the trigger close, a limit at the box edge, a limit at the engulf's base) x stop (box, or past the key level
+ 0.1 Daily ATR); exit 1R, 2R, 3R, trail, the next opposite Daily key level. Limits fill only when price trades through them
by half the round trip (no touch fills). 115,649 signals, 493,876 trades and 490,926 side-flipped placebo trades (one row per
entry / stop, five exits each). Every trade has its stop on the losing side.

Cut test: each market cut at five moments (2011-2019); the signals before every cut are the same as in the full run (0
missing, 0 extra in all 25 cuts).

The call was never 0 after the 2009 warm-up, so `any` = `with` + `against`.

## The bar (before costs, the pre-registered judgement; after costs beside)

| | Real, before costs | Placebo, before costs | Real, after costs | Placebo, after costs |
|---|---:|---:|---:|---:|
| Cells with n >= 100 in 2010-14 | 11,625 | 11,430 | 11,625 | 11,430 |
| Discovery winners (mean > 0, month t >= 2) | 237 | 119 | 138 | 59 |
| Expected by chance (2.3 %) | about 265 | about 261 | about 265 | about 261 |
| Confirmed in 2015-19 without Holm | 5 | 3 | 2 | 1 |
| Expected by chance (2.3 % of the winners) | about 5.4 | about 2.7 | about 3.1 | about 1.3 |
| Confirmed after Holm | **2** | **0** | **0** | **0** |

By the pre-registered rule this is a PASS (2 confirmed, the placebo 0). Read with the counts beside it, it is close to what
chance gives: fewer discovery winners than one-sided t >= 2 would produce by luck, and 5 raw confirmations against about 5.4
expected. The placebo has even fewer winners because before costs most of this grid loses a little (see below), and the mirror
of a small loss is not a gain once fills and exits are applied.

## The confirmed rule (pooled; two exits of the same trades)

Daily engulf zone touched, H1 box (swing low to swing high, 2 a side) closes out with the zone's side, then an H1 structure
break of that side within 6 candles, signal in New York hours (12-17 UTC), market entry at the next 5-minute open, stop past
the box's other side.

| Exit | 2010-14 | 2015-19 | 2015-19 after costs | Holm p |
|---|---|---|---|---:|
| 1R | +0.141R (n 297, t 2.20) | +0.233R (n 317, t 4.40) | +0.212R (t 4.05) | 0.0055 |
| trail | +0.162R (n 297, t 2.06) | +0.279R (n 317, t 4.39) | +0.258R (t 4.10) | 0.0056 |

By market (1R, 2010-14 / 2015-19): xau -0.123 / +0.300 (n 66 / 79), eurusd +0.129 / +0.262 (49 / 47), gbpusd +0.065 / +0.151
(57 / 68), usdjpy +0.323 / +0.194 (55 / 62), audusd +0.315 / +0.255 (70 / 61). The MSNR call does not carry it: with the call
+0.110 / +0.214 (n 168 / 160), against it +0.180 / +0.252 (n 129 / 157). After costs it is not a discovery winner (its 2010-14
after-cost t is under 2), so it fails the after-cost bar.

About 60 trades a year across five markets, found as one cell of 11,625: a hypothesis for its own pre-registered test on data
this grid did not read (2005-2009 and the holdout markets), not an edge.

## Every trade at a 2R exit, by factor level (pooled, before costs; 2015-19 after costs in brackets)

| Factor | Level: 2010-14 / 2015-19 R a trade |
|---|---|
| MSNR call | with +0.003 / -0.028 [-0.062]; against +0.003 / -0.021 [-0.059] |
| Key level | V / A +0.035 / -0.031; engulf +0.021 / +0.001; EF -0.018 / -0.038; DOM -0.023 / -0.031; fresh S/D -0.031 / -0.043 |
| Box | H1 +0.016 / -0.030; M15 -0.008 / -0.019; out +0.004 / -0.033; false break +0.000 / -0.009 |
| Trigger | box +0.004 / -0.014; engulf 1 -0.005 / -0.036; engulf 3 +0.004 / -0.023; structure +0.007 / -0.030 |
| Time | London +0.014 / -0.015; New York -0.007 / +0.009; other +0.003 / -0.049 |
| Entry / stop | market about +0.01 / -0.01; limits -0.007 to +0.000 / -0.03 to -0.05 |

Before costs every factor sits at zero, and after costs every level loses (-0.024R to -0.107R a trade in 2015-19). Trading with
the MSNR call is no better than against it, the same finding as `ltf-structure`, `direction-chain-gate` and the desks' records.

## What this does not say

It does not test a person's choice of levels, boxes or the call; it tests these mechanical readings of them. Nothing changes on
any desk from this study. Files: `run.mjs`, `result.json`; test `tests/grid5-msnr-box.test.mjs`.

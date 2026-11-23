# Grid 6: failed engulfs (EF) as the signal, market entries (result)

**Verdict: FAIL. 0 of 19,882 cells confirmed before costs after Holm (placebo 0); 8 raw confirmations against about 8.2 by chance; the best, usdjpy H1 EF with an M15 engulf, made +0.153R a trade in 2015-19, n 554, month t 2.36.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first, commit d4e6c4f). Research only:
nothing live changed, nothing is proposed.

## What was run

OANDA mid 5-minute candles 2009-2019 (2009 warm-up; fills 2010-2019) for xau, eurusd, gbpusd, usdjpy, audusd, the
data-quality exclusions applied (296 fills dropped), costs of combo-grid-2. An EF = an engulf zone (`council/eg-methods.mjs`
`zones`, 3-candle span, imported) closed through on its far side, serving the other side until a close back through it
(`turnBack`, imported) or 20 days. Factors: zone timeframe D1 / H4 / H1; trigger = the EF candle itself, or a return into the
EF zone and then, on the confirmation timeframe (one or two steps lower), an engulf, a structure break or a box close-out with
the EF's side; the Daily MSNR call (`direction()` on H4, imported through `grid5-msnr-box` `h4Calls`) with / against / any;
first / later / any return; session; stop past the EF zone + 0.1 ATR or past the confirmation swing; exit 1R, 2R, 3R, trail,
the nearest opposite engulf zone of the zone timeframe (1R or more away only). Market entries only: the open of the next
5-minute candle. 680,454 signals, 1,356,413 trades and 1,356,641 side-flipped placebo trades (one row per stop, five exits
each). Every trade has its stop on the losing side.

Cut test: each market cut at five moments (2011-2019); the signals before every cut are the same as in the full run (0
missing, 0 extra in all 25 cuts).

The MSNR call was never 0 after the 2009 warm-up, so `any` = `with` + `against`.

## The bar (before costs, the pre-registered judgement; after costs beside)

| | Real, before costs | Placebo, before costs | Real, after costs | Placebo, after costs |
|---|---:|---:|---:|---:|
| Cells with n >= 100 in 2010-14 | 19,882 | 20,387 | 19,882 | 20,387 |
| Discovery winners (mean > 0, month t >= 2) | 358 | 987 | 86 | 301 |
| Expected by chance (2.3 %) | about 453 | about 465 | about 453 | about 465 |
| Confirmed in 2015-19 without Holm | 8 | 24 | 0 | 0 |
| Expected by chance (2.3 % of the winners) | about 8.2 | about 22.5 | about 2.0 | about 6.9 |
| Confirmed after Holm | **0** | **0** | **0** | **0** |

No cell survives Holm (every Holm p is 1). The real cells give fewer discovery winners than chance would and exactly the
chance count of raw confirmations. The side-flipped placebo (trading against the EF after the same trigger) has about twice
the chance count of discovery winners in 2010-14, mostly H4 EF zones confirmed by an M15 structure break outside London and
New York hours, but those cells are at zero in 2015-19 (+0.001R, t 0.02 for the best) and its raw confirmations match chance.

The eight raw confirmations, none surviving Holm, are scattered single markets (gbpusd H1 EF with an M15 engulf in London hours
five times under different call / visit / exit cuts, usdjpy H1 EF in New York hours, xau H1 EF candle, audusd H4 EF with an H1
box): the best is usdjpy H1 EF, a later return, an M15 engulf, against the call, New York hours, swing stop, trail: +0.185R
(n 588, t 2.35) in 2010-14, +0.153R (n 554, month t 2.36) in 2015-19, +0.081R after costs (t 1.26).

## Every trade at a 2R exit, by factor level (pooled, before costs; 2015-19 after costs in brackets)

| Factor | Level: 2010-14 / 2015-19 R a trade |
|---|---|
| MSNR call | with +0.001 / -0.002 [-0.061]; against -0.007 / -0.020 [-0.083] |
| Zone timeframe | D1 -0.009 / -0.050 [-0.068]; H4 -0.006 / +0.008 [-0.031]; H1 -0.002 / -0.013 [-0.081] |
| Trigger | EF candle +0.009 / +0.032 [-0.016]; engulf +0.001 / -0.010 [-0.089]; structure -0.006 / -0.018 [-0.069]; box -0.012 / -0.024 [-0.070] |
| Confirmation | one step lower +0.004 / -0.003 [-0.052]; two steps -0.009 / -0.017 [-0.089] |
| Visit | first -0.001 / -0.004 [-0.061]; later -0.005 / -0.016 [-0.081] |
| Session | London +0.021 / +0.001 [-0.059]; New York -0.010 / -0.013 [-0.063]; other -0.010 / -0.014 [-0.082] |
| Stop | zone -0.002 / -0.009 [-0.053]; swing -0.003 / -0.011 [-0.089] |

Before costs every level sits within 0.05R of zero, and after costs every level loses in 2015-19. Entering on the EF candle
itself is the least bad (+0.032R before costs, -0.016R after, about 81,000 trades in 2015-19), not enough for any of its cells
to pass. Trading with the MSNR call is no better than against it (with minus against about +0.02R), as in `grid5-msnr-box`,
`ltf-structure` and `direction-chain-gate`. A first return is no better than a later one.

## What this does not say

It tests mechanical readings of the EF, the return and the confirmations, with market entries only; it does not test a
person's choice of which EF to trade. Nothing changes on any desk from this study, and the H4 EF reading on the Engulfing desk
(`eg-ef`, a limit at the zone with an M15 A / V break) is a different rule that this grid did not test. Files: `run.mjs`,
`result.json`; test `tests/grid6-msnr-ef-market.test.mjs`.

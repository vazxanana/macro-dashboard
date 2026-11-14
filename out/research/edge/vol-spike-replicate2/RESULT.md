# Result: second frozen replication of the vol-spike rebound, on markets and years neither study used (14 Nov 2026)

**Verdict: DOES NOT REPLICATE.** By the pre-registered bar (PREREGISTRATION.md, committed and pushed alone before any
number): on 475 trades in cells neither #860 nor #920 used, the frozen 10-day rule makes +0.062R a trade net, but t on
calendar-month sums is 1.17 (bar 2) and at 2x costs it is +0.022R a trade (month t 0.40). The direction is the same as #860's,
the size is not apart from luck once trades are counted by month. The pre-registered Fisher combination moves from p 0.026 to
p 0.0167, still two orders of magnitude above the family's Bonferroni line (1.50e-4). Not an edge; nothing live changed.

## Gate (before anything else was read)
`frozen.mjs` is #860's `run.mjs` byte for byte (sha256 `339077aa…b8c1`) and `gate920.mjs` is #920's `run.mjs` byte for byte
(sha256 `7b723b64…495d`), both pinned in the test. #920's own `replicate()` on its markets and data reproduces its committed
`result.json` exactly: `reading`, `lastDay`, `R1`, `R2`, `R3`, `placebo`, `costs2x`, `markets` all JSON-equal (R1 n 278,
+0.056R, t 1.20; R2 n 303, -0.022R, t -0.52; R3 105 weeks, t 1.48). The rebuilt R2 trades used in the pooled Fisher test Q
also match (n 303, -0.022R).

## The replication set (fixed in the pre-registration)
- **N, new index markets, all entries**: US2000, CH20, NL25, ES35, CN50, SG30, IN50 (IN50's candles end 2022-07-12).
- **E, earlier entries of the used markets**: SPX500 / NAS100 / US30 before 2008-01-01; DE40, UK100, EU50, FR40, AU200, JP225,
  HK33 before 2005-01-01 (#920's warm-up years: 10 trades in all, as expected).
- Candles end 2026-11-06. Spreads stated, not measured (points a round trip: US2000 0.5, CH20 4.0, NL25 0.3, ES35 8.0, CN50
  10.0, SG30 0.4, IN50 6.0; the used markets keep #860's / #920's). Financing #860's way for every market: DGS2 + 2.5 % a
  year per calendar night.

## Primary test (pooled, 10-day hold)

| Cost | n | R a trade | total R | won | t trades | **t months** | stops | worst drawdown |
|---|---|---|---|---|---|---|---|---|
| none (no spread, no financing) | 475 | +0.102 | +48.66 | 60.84 % | 3.02 | 1.94 | 93 | -23.27R |
| **base (the bar)** | 475 | **+0.062** | +29.48 | 59.37 % | 1.84 | **1.17** | 93 | -23.67R |
| 2x | 475 | +0.022 | +10.31 | 57.26 % | 0.64 | 0.40 | 93 | -26.15R |

Bar: mean > 0 (met), month t >= 2 (**missed: 1.17**), mean > 0 at 2x costs (met, +0.022R). Base: +0.501 % of price a trade
net, +0.715 % before costs. Months counted from 2003-09 to 2026-11, zero months included.

Split (reported): **C1** = N from 2016 (the same calendar as #860's decisive window): n 239, +0.080R, t 1.68, month t 1.02,
2x +0.041R. **C2** = N before 2016 plus all of E: n 236, +0.044R, t 0.92, month t 0.61, 2x +0.003R.

## Per market (secondary; Holm over the 10 rows with n >= 10)

| Market | set | candles from | n | R a trade | t | Holm p | worst DD R: none / base / 2x | R a trade: none / 2x |
|---|---|---|---|---|---|---|---|---|
| US2000 | N | 2003-03-24 | 75 | +0.086 | 1.05 | 1.00 | -6.47 / -7.22 / -7.96 | +0.113 / +0.058 |
| CH20 | N | 2003-03-24 | 84 | +0.166 | 1.94 | 0.26 | -4.74 / -4.80 / -4.85 | +0.206 / +0.126 |
| NL25 | N | 2008-01-21 | 75 | +0.086 | 1.03 | 1.00 | -4.81 / -5.03 / -5.25 | +0.122 / +0.050 |
| ES35 | N | 2016-12-02 | 32 | -0.034 | -0.23 | 1.00 | -4.86 / -5.33 / -5.83 | +0.006 / -0.073 |
| CN50 | N | 2011-08-30 | 42 | +0.080 | 0.86 | 1.00 | -1.65 / -1.69 / -2.07 | +0.112 / +0.047 |
| SG30 | N | 2004-01-21 | 86 | -0.016 | -0.19 | 1.00 | -7.53 / -8.36 / -10.84 | +0.033 / -0.066 |
| IN50 | N | 2011-08-26 | 35 | +0.008 | 0.06 | 1.00 | -3.73 / -3.87 / -4.47 | +0.045 / -0.029 |
| SPX500 < 2008 | E | 2003-03-24 | 12 | +0.104 | 0.61 | 1.00 | -0.71 / -1.01 / -1.63 | +0.176 / +0.033 |
| NAS100 < 2008 | E | 2003-03-24 | 10 | -0.212 | -1.06 | 1.00 | -2.95 / -3.35 / -3.75 | -0.144 / -0.280 |
| US30 < 2008 | E | 2003-03-24 | 14 | +0.001 | 0.01 | 1.00 | -1.00 / -1.52 / -2.36 | +0.069 / -0.067 |
| #920's seven < 2005 | E | 2003 | 10 (DE40 0, UK100 3, EU50 1, FR40 0, AU200 0, JP225 3, HK33 3) | | | not tested | | |

No market passes Holm. Five of seven new markets are positive, none with t >= 2; the best (CH20, t 1.94) is one of ten looks.

## Placebo (40 seeds, `rng(9001…9040)`, random NON-signal days of each market's cell, same count, hold, stop and costs)
Seeds' mean +0.003R, 95th percentile +0.060R. The rule (+0.062R) beats 38 of 40 seeds: just over the 95th percentile, as
#860's was (and #920's was not).

## Fisher combination (the rule of `multiple-testing-update`)

| Reading | inputs (one-sided p) | Fisher p | z | under Bonferroni 1.50e-4 |
|---|---|---|---|---|
| Before this study (the update) | #860 0.0057 + #920 R2 0.6985 | 0.0260 | 1.94 | no |
| **Pre-registered: #860 + Q** (C2 pooled with #920 R2: 539 trades, +0.007R, t 0.21) | 0.0057 + 0.4168 | **0.0167** | 2.13 | no |
| Paired separately, the weaker shown | #860 + #920 R2 (0.0260) / #860 + C2 (t 0.92, 0.0080) | 0.0260 | 1.94 | no |
| All cells, upper bound (same days on other instruments counted again) | #860, #920 R1, #920 R2, C1 (t 1.68), C2 | 0.0054 | 2.55 | no |

Read plainly: years and markets the rule never saw add little. Most of the combined evidence is still #860's own p.

## By year (all cells, sum of net R by entry year)
2003 +3.3, 2004 +1.4, 2005 +5.3, 2006 -3.3, 2007 -5.8, 2008 -6.0, 2009 none, 2010 -1.1, 2011 -2.4, 2012 +0.6, 2013 +10.1,
2014 +0.7, 2015 +7.6, 2016 +2.9, 2017 +0.7, 2018 +1.8, 2019 +4.0, 2020 -10.0, 2021 +2.8, 2022 -2.4, 2023 +1.0, 2024 +4.0,
2025 +8.7, 2026 +5.7. As in #860 and #920 the crash years (2007-08, 2020) are the worst.

## Said plainly
- **Dependence**: the indices signal in the same weeks; the month-sum t (the bar) counts that, the trade t (1.84) does not.
- **Costs** take about 40 % of the gross: before costs month t is 1.94, still under 2.
- **Departures from the pre-registration**: none in the rule, set, bar or seeds. In the 2x and no-cost rows only R fields are
  reported (the frozen `summary`'s % fields come from the stored net figure and would be wrong for a re-costed copy).
- Not tested: the 5-day hold, any other parameter, the VIX, the cash closes. No market added or dropped after the first run.

## To repeat
`node research/edge/vol-spike-replicate2/run.mjs fetch <dir>` (git show from `origin/council-data` and
`origin/vol-spike-replicate`, no network), then `node research/edge/vol-spike-replicate2/run.mjs full <dir>` (about a
minute). Tests: `tests/vol-spike-replicate2.test.mjs`.

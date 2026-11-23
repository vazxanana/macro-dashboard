# Daily storyline on gold: result

**Verdict: FAIL** (pre-registered bar, PREREGISTRATION.md). 0 of 4 tests pass; every Holm p is 1.00.

The primary rule (a Daily rejection of a fresh Daily key level, an H4 external break the same way, a limit at the H1 pullback
QM's broken level, stop beyond the QM head, target the next fresh Daily level) lost after costs in every window: 2024 to
15 Oct 2026 -0.333R a trade (n 16, month t -0.95), 2020-23 -0.312R (n 29, month t -0.89), 2010-19 -0.067R (n 73,
month t -0.35). By the pre-registration that is a FAIL: the OOS mean is negative and the IS mean is negative. It is also very
rare: about 7 trades a year (229 candidates in 17 years; 74 dropped because the next Daily level was under 1.5R away, 32
limits never filled).

Gold OANDA mid 5-minute candles, 3 Jan 2010 to 22 Nov 2026 (toolkit cache); Daily = 17:00 New York trading days; H4 / H1
resampled in UTC buckets; trades simulated on 5-minute candles; $0.30 a round trip plus overnight financing on buys.

| Test | Window | n | Won | R a trade, before costs | after costs | at 2x costs | Total R after costs | Month t |
|---|---|---|---|---|---|---|---|---|
| P | 2010-19 | 73 | 29 % | +0.018 | −0.067 | −0.153 | −4.9 | −0.35 |
| P | 2020-23 | 29 | 17 % | −0.264 | −0.312 | −0.361 | −9.1 | −0.89 |
| P | 2024 - 15 Oct 2026 | 16 | 25 % | −0.294 | −0.333 | −0.372 | −5.3 | −0.95 (Holm p 1.00) |
| S1 market at the QM close | 2010-19 | 81 | 30 % | −0.018 | −0.096 | −0.173 | −7.7 | −0.54 |
| S1 | 2020-23 | 28 | 21 % | −0.353 | −0.397 | −0.442 | −11.1 | −1.48 |
| S1 | 2024 - 15 Oct 2026 | 18 | 28 % | −0.110 | −0.143 | −0.176 | −2.6 | −0.32 (Holm p 1.00) |
| S2 P + Weekly agrees | 2010-19 | 37 | 35 % | +0.201 | +0.116 | +0.031 | +4.3 | +0.41 |
| S2 | 2020-23 | 15 | 27 % | +0.221 | +0.170 | +0.120 | +2.6 | +0.28 |
| S2 | 2024 - 15 Oct 2026 | 7 | 29 % | −0.258 | −0.326 | −0.393 | −2.3 | −0.67 (Holm p 1.00) |
| S3 P with a fixed 3R target | 2010-19 | 106 | 33 % | +0.175 | +0.096 | +0.017 | +10.2 | +0.59 |
| S3 | 2020-23 | 38 | 16 % | −0.368 | −0.421 | −0.474 | −16.0 | −1.76 |
| S3 | 2024 - 15 Oct 2026 | 19 | 26 % | −0.055 | −0.101 | −0.146 | −1.9 | −0.25 (Holm p 1.00) |

Reported, not part of the verdict (P): buys 34 / 14 / 7 trades at −0.103 / −0.326 / −0.246R and sells 39 / 15 / 9 at
−0.037 / −0.299 / −0.401R (2010-19 / 2020-23 / OOS); positive years 2010-12, 2014, 2016 and 2023, negative
in the other eleven; median stop $9.39 on gold (wide H1 heads), median planned target 3.6R; no trade fell in the 15 Oct - Nov 2026 weeks
left out of the test. S2 (Weekly agrees) is positive in 2010-23 but on 52 trades with month t under 0.5 and negative out of
sample: noise, not a lead. Per year and per side figures for every test are in result.json; every trade is in trades.json.

## Readings the pre-registration left open (decided before the run, in run.mjs READINGS)
- A level is reached by the first 5-minute candle after it is known that touches it; that candle's trading day is the
  rejection candidate; the level is spent there whether it rejects or not.
- The external H4 level is the most recently confirmed H4 swing on that side at the touch, whether or not price had already
  traded through it.
- A bias gives one candidate: its first H1 QM. If that QM gives no trade (no target, under 1.5R, a position open), the bias
  gives none. One position at a time across buys and sells; a resting limit counts until it fills or is cancelled.
- The limit is cancelled at the first 5-minute candle that reaches the target, at the close of an H1 candle beyond the head,
  or after 12 H1 candles; a fill and a target in the cancelling candle count as no fill.
- S1 tests 1.5R from the QM close; S3 drops the next-level and 1.5R checks; S2 reads the Weekly side at the last complete week
  (Friday 17:00 New York).
The no-look-ahead test (tests/storyline-daily-gold.test.mjs: every price after a moment changed, the orders known by then do
not move) ran and passed before the windows were read. No threshold was changed after the run.

## What it does NOT show
- It does not judge the method as a person reads it on a chart (which level is fresh, which break is "external", which QM is
  clean): this is one mechanical reading of the rule. Picked chart examples are not evidence either way.
- It does not test other markets, other timeframe pairs (Weekly + H4), other entries inside the H1 move, or management (break
  even, partials). Trying them now on these years would be a search after a failed result.
- The samples are small (16 OOS trades); the verdict rests on every window being negative, not on a large-n estimate.
- Costs are today's demo figures for every year.
Nothing live changed.

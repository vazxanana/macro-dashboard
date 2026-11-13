# Result: the 2-day RSI pullback, frozen, on six non-US indices (13 Nov 2026)

**Verdict: FAIL** on the pre-registered single test (PREREGISTRATION.md, committed and pushed before any number was computed).
The pooled six-market book made +0.027R a trade after costs in 2016 to 6 Nov 2026 (n 521), with a calendar-month t of only
0.85 (bar 2). Three of the four checks held (positive, 5 of 6 markets positive, above the placebo's 95th percentile of
+0.015R), the decisive one did not. **This does not support the US near miss**: the same rule, unchanged, earns about a quarter
of what it showed on the S&P 500 (+0.112R) and the Dow (+0.087R) and is indistinguishable from luck. Not an edge; nothing live
changed and no proposal is written.

| Pooled book, net, equal risk per trade | n | R a trade | R a trade before costs | won | t trades | t months | total R | worst drawdown |
|---|---|---|---|---|---|---|---|---|
| B: 2016 - Nov 2026 (decisive) | 521 | +0.027 | +0.052 | 69.48 % | 1.35 | 0.85 | +14.26 | -16.75R |
| A: 2008 - 2015 (reported) | 339 | +0.021 | +0.045 | 64.31 % | 0.81 | 0.49 | +7.03 | -7.24R |

| Window B, per market (reported, not the verdict) | n | % a trade net | R a trade | won | t trades | t months (R) |
|---|---|---|---|---|---|---|
| DE40 | 89 | +0.308 | +0.074 | 73.03 % | 1.57 | 1.73 |
| UK100 | 84 | -0.036 | -0.024 | 63.1 % | -0.21 | -0.48 |
| JP225 | 90 | +0.250 | +0.014 | 68.89 % | 1.13 | 0.31 |
| AU200 | 94 | +0.210 | +0.059 | 74.47 % | 1.52 | 1.29 |
| EU50 | 80 | +0.131 | +0.033 | 70 % | 0.69 | 0.57 |
| FR40 | 84 | +0.010 | +0.004 | 66.67 % | 0.05 | 0.07 |

- **Checks, window B** (all four needed): pooled R a trade > 0 yes; month-sum t >= 2 **no** (0.85); at least 4 of 6 markets
  positive yes (5: all but UK100); beats the placebo yes (40 seeds of random days above the 200-day average, same holds, stop
  and costs: pooled mean -0.011R, 95th percentile +0.015R). One pooled test, so no Holm correction (as pre-registered).
- **Window A** (2008-15): +0.021R a trade, t months 0.49; FR40 alone had t 2.24 there and +0.004R since 2016. Nothing in either
  window reaches the bar.
- **What it says about the US near miss**: the rule's sign survives out of market (a small positive mean, more trades won than
  lost, a little better than a random entry in an uptrend), but the size does not. The US result was three highly correlated
  indices in one market regime; on six others it is about +0.03R a trade, which costs (about 0.025R a trade, half of the gross
  +0.052R) nearly erase. Treat the US figures as the upper end of noise, not as an edge waiting for more data.
- **The six markets move together too**: 521 window-B trades fell on 331 entry days, and 301 trades shared their entry day with
  another market, so the pooled n overstates independence; the month-sum t is the honest measure and it is 0.85.
- **Costs**: round trip DE40 2.5, UK100 2.0, JP225 14.0, AU200 2.0, EU50 2.5, FR40 2.0 points (stated, not measured);
  financing (local policy rate + 2.5 %) per calendar night, about 0.03-0.06 % a trade at about 4-5 nights. JP225_USD with a
  USD benchmark (DGS2 + 2.5 %) instead of the Bank of Japan's: +0.007R a trade instead of +0.014R (sensitivity, not decisive).
- **The rule is the original's, unchanged**: `rsi2-pullback.mjs` is a byte-for-byte copy of `research/edge/rsi2-pullback/run.mjs`
  from branch `rsi2-pullback` (PR #838, not merged into `main` when this ran; sha256 pinned in the test). Only the placebo had to
  return trades instead of a mean (to read it in R): `placeboTrades` repeats its steps and the test checks it gives the original
  `placebo()`'s mean for the same seed.
- Caveats: OANDA's daily close (00:00 UTC) is not the exchange close; the policy-rate series were written from the published
  decision histories without a live source (a date may be off by a meeting; negligible at 4 nights a trade); spreads are stated.
- Not tested, and not to be tuned on these windows: other thresholds, exits, filters or market selections (dropping UK100 or
  FR40 after seeing this would be curve-fitting). This was the replication; it failed, so the RSI(2) pullback on index CFDs is
  closed unless a new idea gets its own pre-registration on data neither study read.

To repeat: `node research/edge/rsi2-replicate/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/rsi2-replicate/run.mjs full <dir>`. Tests: `tests/rsi2-replicate.test.mjs`.

# Result: the 2-day RSI pullback on US index CFDs, out of the book's sample (13 Nov 2026)

**Verdict: FAIL** on the pre-registered bar (PREREGISTRATION.md, committed and pushed before any number was computed). No market
meets all five checks in the decisive window (2016 to 6 Nov 2026). The rule made money after costs on all three indices in
both windows, but not by enough to be told apart from luck once the three markets are tested together: the S&P 500 has t 2.02
on trades but 1.83 on month sums; the Dow has 2.28 on month sums but 1.88 on trades; after Holm neither is under 5 %
(p 0.065 each). Not an edge here; nothing live changed and no proposal is written.

| Window B, 2016 - Nov 2026, net | n | % a trade net | R a trade | won | t trades | t months | placebo p95 | Holm p |
|---|---|---|---|---|---|---|---|---|
| SPX500 | 99 | +0.318 | +0.112 | 81.82 % | 2.02 | 1.83 | +0.233 | 0.0651 |
| NAS100 | 99 | +0.292 | +0.061 | 67.68 % | 1.24 | 1.29 | +0.477 | 0.1073 |
| US30 | 102 | +0.288 | +0.087 | 77.45 % | 1.88 | 2.28 | +0.175 | 0.0651 |

| Window A, 2008 - 2015, net (reported) | n | % a trade net | R a trade | t trades | t months |
|---|---|---|---|---|---|
| SPX500 | 67 | +0.559 | +0.134 | 3.15 | 3.23 |
| NAS100 | 75 | +0.444 | +0.104 | 2.02 | 1.97 |
| US30 | 67 | +0.228 | +0.052 | 1.22 | 1.39 |

- **Checks, window B** (all five needed): SPX500 positive yes, t trades yes, t months **no**, placebo yes, Holm **no**; NAS100
  only positive; US30 positive yes, t trades **no**, t months yes, placebo yes, Holm **no**.
- **The placebo** (40 seeds of random days above the 200-day average, same holds, stop and costs) averaged +0.042 % (SPX),
  +0.090 % (NAS) and +0.005 % (US30) a trade: on the S&P and the Dow the oversold entry beats a random entry in an uptrend at
  its 95th percentile, on the Nasdaq it does not.
- **Weaker after the book**: the S&P's net return a trade fell from +0.559 % (2008-15) to +0.318 % (2016-26), the same fading
  that is often reported for this rule. A trade holds about 3 trading days (4 calendar nights); costs take about 0.08-0.09 % a
  trade, of which financing (2Y yield + 2.5 %) is about 0.06 %.
- Losing years in window B: S&P 2018, 2019 (R), 2020, 2022, 2023; Nasdaq 2016, 2018, 2022, 2025; Dow 2019 (R), 2020, 2022. The
  rule rarely fires in a bear year (2 to 4 trades in 2022), so it says little about falling markets.
- The three markets move together: of the S&P's 99 window-B entries, 50 fell on the same day as a Nasdaq entry and 46 on the
  same day as a Dow entry, so "three markets" is closer to one bet than three. The Holm correction treats them as separate tests, as pre-registered.
- Caveats: OANDA's daily close (00:00 UTC) is a few hours after the cash close, not the close the book used; spreads are
  stated, not measured on the broker; DGS2 is weekly and stands in for the broker's overnight benchmark.
- Not tested, and not to be tuned on these windows: other RSI thresholds, exits, the cumulative RSI or "double 7s" variants.
  Any of them needs its own pre-registration on data this study did not read.

To repeat: `node research/edge/rsi2-pullback/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/rsi2-pullback/run.mjs full <dir>`. Tests: `tests/rsi2-pullback.test.mjs`.

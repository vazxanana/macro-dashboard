# Result: the 2-day RSI pullback on US index CFDs, the years before the original study (14 Nov 2026)

**Verdict: NOT MEASURABLE (inconclusive: OANDA daily candles start 2003-03-24, so after the 200-day warm-up only 4.00 years
of entries exist before 2008, under the pre-registered 5-year floor; the financing benchmark starts 2006-01-06; and 2004-07
lies inside the rule's own development sample).** The study stopped where its pre-registration (PREREGISTRATION.md, pushed
alone first) said it would: no trade, return, t, placebo or Fisher figure for 2004-07 was computed or read. The 2-day RSI
pullback (`rsi2-pullback`, #838) still has **no replication on years it never used**; the multiple-testing ledger's "none on
other years" stands, and nothing here is evidence for or against it. Nothing live changed.

## Gate: the original reproduced exactly
`frozen.mjs` is `research/edge/rsi2-pullback/run.mjs` of branch `rsi2-pullback` (commit 4e1b4e1dd), byte for byte (sha256
`edade889…d5ab65`, pinned in the test; the same bytes as `rsi2-replicate`'s frozen copy). Run on today's council-data
candles and `DGS2`, it gives every published figure of the original, and its verdict FAIL:

| Market | Window A (2008-15): n, % net, R, total R, t trades, t months | Window B (2016-26): n, % net, R, total R, t trades, t months, placebo p95, p | Holm p | Same |
|---|---|---|---|---|
| SPX500 | 67, +0.559, +0.134, +8.95, 3.15, 3.23 | 99, +0.318, +0.112, +11.14, 2.02, 1.83, +0.233, 0.0217 | 0.0651 | yes |
| NAS100 | 75, +0.444, +0.104, +7.82, 2.02, 1.97 | 99, +0.292, +0.061, +6.03, 1.24, 1.29, +0.477, 0.1073 | 0.1073 | yes |
| US30 | 67, +0.228, +0.052, +3.45, 1.22, 1.39 | 102, +0.288, +0.087, +8.82, 1.88, 2.28, +0.175, 0.0301 | 0.0651 | yes |

## The window that exists
| Market | First OANDA daily candle | First possible signal (200 weekday closes) | Years of entries to 2007-12-31 | Gaps over 4 days |
|---|---|---|---|---|
| SPX500 | 2003-03-24 | 2004-01-02 | 4.00 | 0 |
| NAS100 | 2003-03-24 | 2004-01-02 | 4.00 | 0 |
| US30 | 2003-03-24 | 2004-01-07 | 3.98 | 0 |

- OANDA serves nothing earlier: the council's daily cache is its full history, and a proxy request for 2000-01-01 to
  2003-06-01 returns its first candle on 2003-03-24. No other source this repository allows covers these indices earlier.
- Even a looser reading of "about 5 years" (4.5) is not met. At the original's trade rate four years would give about 35
  trades a market, half of them on the same days across the three markets.
- `DGS2` starts 2006-01-06: the frozen cost model would charge 2.5 % a year without the benchmark for 2004-05.
- The rule was published in 2009 on data up to 2008, so 2004-07 is inside the sample it was designed on: even with enough
  years, a result there would not be independent of how the rule was chosen.

## Not computed, on purpose
The pooled and per-market tests, the run at the demo broker's measured index cost, 2x costs, drawdown, the 40-seed
placebo and the Fisher combination with #838 (one-sided p 0.0217). The frozen study does build per-year sums from 2004
inside its own code (the original's `result.json` publishes them under `years`); this study neither read nor reports them,
and they are not evidence (no test, the rule's own development years).

## What could replicate it instead
Only data the original never read: a market or a period outside OANDA's 2003-26 US index history, chosen and
pre-registered before any return is seen (for example, exchange index closes before 2003 from a keyless source, if one
is found). The same-years replications (#844 six non-US indices, #873 metals) both failed and cannot be combined with the
original as independent evidence.

To repeat: `node research/edge/rsi2-early-years/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/rsi2-early-years/run.mjs full <dir>`. Tests: `tests/rsi2-early-years.test.mjs`.

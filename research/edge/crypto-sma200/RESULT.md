# Result: Bitcoin / Ether long only above the 200-day average (13 Nov 2026)

**Verdict: FAIL, 0 of 4 tests pass.** Long BTC or ETH only while the daily close is above its 200-day (or 100-day) average,
with a 3 x ATR20 catastrophe stop, `CFD_CRYPTO` on every switch and the demo broker's 15 % a year long swap, beat buy and hold
on Sharpe and drawdown in 2022-26 in all four tests, but no test clears the paired monthly bootstrap after Holm (best: BTC
SMA200, P 0.932, Holm p 0.272), and BTC SMA200, the main rule, also lost to holding in 2018-21. Not an edge; no proposal;
nothing live changed. Rules, windows and pass bar: `PREREGISTRATION.md` (committed before this run).

## Decisive window 2022-01-01 to 2026-10-31 (1,765 days; daily net returns; Holm over four)

| Test | Sharpe rule | Sharpe hold | CAGR rule | CAGR hold | Max DD rule | Max DD hold | In market | Entries | Stops | P (bootstrap) | Holm p | Discovery Sharpe rule / hold | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| btc-sma200 | 0.61 | 0.08 | +16.0 % | -8.2 % | 36.3 % | 72.2 % | 53 % | 17 | 0 | 0.932 | 0.272 | 0.49 / 0.61 | no |
| btc-sma100 | 0.43 | 0.08 | +9.2 % | -8.2 % | 39.6 % | 72.2 % | 52 % | 32 | 2 | 0.840 | 0.429 | 1.11 / 0.61 | no |
| eth-sma200 | 0.30 | -0.09 | +4.3 % | -25.5 % | 42.9 % | 82.8 % | 45 % | 14 | 0 | 0.857 | 0.429 | 1.02 / 0.69 | no |
| eth-sma100 | 0.13 | -0.09 | -3.3 % | -25.5 % | 54.2 % | 82.8 % | 51 % | 40 | 1 | 0.722 | 0.429 | 1.05 / 0.69 | no |

Which checks failed: the bootstrap (P >= 0.9 and Holm p <= 0.10) in all four; the discovery sign in btc-sma200. The Sharpe and
drawdown checks passed in all four (eth-sma100's drawdown 54.2 % against a limit of 55.2 %, by a hair).

## What it means

- **The filter does what it is known for, not more than chance can explain on five years**: it sat out most of 2022 (BTC
  SMA200 was flat all year while holding lost 71 %) and halved the drawdown. But 2022-26 holds about two bear stretches; a
  monthly block bootstrap of 58 months gives the rule's better Sharpe a P of 0.72 to 0.93, and four tests need more.
- **Financing decides the benchmark**: 15 % a year on every night, a Friday counted three, is about 19 % a year held. Holding
  BTC on the CFD returned -8.2 % a year in 2022-26 against about +11 % a year for the spot price; the swap summed to 0.93 of
  the starting value over the window for holding and 0.49 for the rule (in the market half the time). The rule's lead over
  holding is largely the swap it does not pay while flat. A Friday counted once: the same order (rule Sharpe 0.68 against
  0.17 for BTC SMA200).
- **Main rule, main coin, wrong in discovery**: BTC SMA200 had a lower Sharpe than holding in 2018-21 (0.49 against 0.61) with
  a 66.5 % drawdown against 76.1 %. The other three were ahead in 2018-21.
- Per year in 2022-26 (compounded, net): BTC SMA200 0 %, +67 %, +57 %, -27 %, +8 % against holding -71 %, +111 %, +82 %, -23 %,
  -25 %.

## Not tested

Leverage, shorts below the average, other coins, other lengths, a trailing stop, interest on cash while flat (none is
counted: the costlier reading for the rule). Any of these needs its own pre-registration. Spot holding without the CFD swap is
a different product and was not the benchmark.

To repeat: `git fetch origin council-data`, then `node research/edge/crypto-sma200/run.mjs` (reads with `git show`, no
network). Tests: `tests/crypto-sma200.test.mjs`.

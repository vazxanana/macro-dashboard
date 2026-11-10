# ICT A-setups x Dollar Smile: out-of-sample test of the #507 lead

## Clock re-run (9 Nov 2026)

The HistData M1 files were read with a fixed +5 h ("EST without DST"). They are UTC−5, UTC−4 while Europe is on summer time, and New York time in 2018 (`council/histdata.mjs`; release spikes and Sunday opens), so every European summer was an hour late. Not re-run in the 9 Nov clock pass. It cannot run here: `analyse.mjs` needs FRED, which this sandbox cannot reach (the test ran
on GitHub Actions). On the corrected clock `build.mjs` gives 1,156 A-setups (was 1,137) and only 397 keep the same signal hour, so
the committed `trades.json` / `fx-daily.json` are the +5 h inputs. To re-run: `ict-universe/universe.mjs` → `build.mjs` →
dispatch `.github/workflows/ict-smile.yml` with force. The verdict below (FAIL, null result) is the +5 h run.

**Verdict: FAIL. Null result. The lead is closed.**

Out of sample (2018 to July 2025), the A-setups taken when the Smile was on its left or right side did not lose money. They
made **+0.118R a trade** (n 483, t +1.67), and both halves were positive. That is about the same as the mid and trough
A-setups, at +0.133R a trade (n 654). The gap #507 saw (−0.185R against +0.663R) does not appear on data it had not seen.
`nosmilex` is not added. No live rule changed.

## How it was run

- **Pre-registration first.** `preregistration.md` was committed and pushed (9a113d62) before any out-of-sample trade was
  generated or classified. It holds one hypothesis, a fixed bar and fixed lags.
- **The test ran once,** on GitHub Actions (`.github/workflows/ict-smile.yml`), on 7 Nov 2026 at 21:07 UTC. Every FRED series
  answered. The output is in council-data `research/ict-smile.json` and `.md`, with a copy in `result.json`.
- **Trades.** 1,137 closed A-setups whose signal closed from 1 Jan 2018 to 31 Jul 2025. #507's sample starts on 4 Aug 2025,
  so no trade is shared.
  - The trades were made with the ict-universe code (the desk's own `signals()` / `isASetup()` / `sizeOf()` / `simulate()`),
    run on HistData M1.
  - GC: 456 trades, XAUUSD, gold A-rule.
  - NQ: 339 trades, NAS100 cash, index A-rule.
  - ES: 342 trades, SPX cash, index A-rule.
- **R.** Gross R x size, the replay's convention.
- **Halves.** Each group's trades sorted by close time and split by count.
- **Regime.** `council/macro.mjs` `features()` / `drivers()`, imported unchanged, on the signal's UTC day:
  - FRED series are used only after macro.mjs's publication lags (VIX 2 days).
  - The DXY uses macro.mjs's own formula on UTC-day FX closes from HistData.
  - Every trade got a phase.

## The pre-registered hypothesis

| | n | R a trade | t | 1st half | 2nd half | Bar (n ≥ 30, t ≤ −2, both halves < 0) |
|---|---|---|---|---|---|---|
| **Dropped: Smile left or right** | 483 | **+0.118** | +1.67 | +0.176 | +0.060 | **fail** (t is positive and both halves are positive) |
| Kept: mid or trough | 654 | +0.133 | +2.24 | +0.003 | +0.263 | |
| Difference | | −0.015 | Welch t −0.16 | | | |

## By Smile phase

| Phase | n | R a trade | t | Halves |
|---|---|---|---|---|
| left (stress) | 266 | +0.202 | +2.09 | +0.183 / +0.220 |
| right (US outperformance) | 217 | +0.015 | +0.15 | +0.073 / −0.042 |
| trough (global growth) | 305 | +0.122 | +1.44 | −0.146 / +0.388 |
| mid (transitional) | 349 | +0.143 | +1.72 | +0.120 / +0.165 |

The left side, which #507 flagged, was the best of the four phases out of sample. The right side was the weakest, but it
still made a small positive return.

## By market (dollar bid vs the rest)

| Market | Bid n | Bid R a trade (t) | Rest n | Rest R a trade (t) | Difference (Welch t) |
|---|---|---|---|---|---|
| ES (SPX cash) | 137 | +0.088 (0.60) | 205 | +0.051 (0.56) | +0.037 (0.21) |
| GC | 184 | +0.225 (2.10) | 272 | +0.159 (1.61) | +0.066 (0.46) |
| NQ (NAS100 cash) | 162 | +0.021 (0.18) | 177 | +0.188 (1.59) | −0.167 (−0.99) |

Only NQ points the way #507 found, and not significantly. In #507, ES and GC were lower when the dollar was bid. Out of
sample they were higher.

## By year (dollar bid vs the rest)

| Year | Bid n | Bid R a trade | Rest n | Rest R a trade | Difference (Welch t) |
|---|---|---|---|---|---|
| 2018 | 45 | +0.032 | 105 | −0.103 | +0.134 (0.68) |
| 2019 | 40 | +0.517 | 115 | +0.027 | +0.490 (1.28) |
| 2020 | 137 | +0.157 | 21 | +0.818 | −0.661 (−1.09) |
| 2021 | 52 | −0.137 | 103 | −0.037 | −0.100 (−0.48) |
| 2022 | 68 | +0.219 | 90 | +0.240 | −0.021 (−0.08) |
| 2023 | 55 | −0.121 | 81 | +0.463 | −0.584 (−2.08) |
| 2024 | 59 | +0.007 | 92 | +0.295 | −0.288 (−1.11) |
| 2025 (Jan-Jul) | 27 | +0.437 | 47 | −0.103 | +0.540 (1.35) |

- **Where the pattern appeared.** The dollar-bid trades did worse in 4 of 8 years: 2020, 2021, 2023 and 2024. They did
  better in 2018, 2019 and 2025, and about the same in 2022.
- **Only one year was significant.** 2023 is the only year with |t| ≥ 2, and with 8 years tested that is about what chance
  gives.
- **The dollar-bid trades lost money in only 2 of 8 years.**

## Sensitivities (pre-registered as descriptive, not pass routes)

| Version | Dropped n | R a trade | t | Halves | Kept n | Kept R a trade | Meets the bar? |
|---|---|---|---|---|---|---|---|
| Net of costs | 483 | +0.074 | +1.04 | +0.128 / +0.019 | 654 | +0.078 | no |
| VIX at #507's 1-day lag | 491 | +0.132 | +1.83 | +0.146 / +0.119 | 646 | +0.122 | no |
| HY-covered days only (Nov 2023 to Jul 2025) | 87 | +0.132 | +0.73 | −0.084 / +0.343 | 151 | +0.223 | no |

## Caveat, declared in advance

**HY coverage.** FRED serves ICE BofA HY OAS only from 7 Nov 2023, which covers 183 of the 859 trade days. On the other days
macro.mjs sees `hy = null`, exactly as it would live:

- **Left side.** It could then come only from VIX ≥ 28, swap lines ≥ $5bn or SOFR − EFFR ≥ 15bp. Most of it fell in 2020.
- **Trough.** Its HY condition is met by default.
- **Right side.** It does not use HY, so this caveat does not touch it. Right-side trades made +0.015R a trade over 217
  trades, which is not a loss.

**The window closest to #507.** The HY-covered days are the window most like #507's, with HY driving the left side. There
the dollar-bid trades were also positive (+0.132R, n 87).

**Market proxies.** NQ and ES are cash-index proxies (HistData NAS100 / SPX), not the futures. GC is spot XAUUSD. This
sample has no YM or RTY.

## Files

- `preregistration.md`: the hypothesis, the bar and the classification, fixed before the run.
- `build.mjs`: writes `trades.json` (the trades, with no regime) and `fx-daily.json` (UTC-day FX closes for the DXY).
- `analyse.mjs`: the test. The Actions job runs it: `node research/edge/ict-smile/analyse.mjs <outDir>`.
- `result.json`: the full output, including each trade's phase (`perTrade`).
- `.github/workflows/ict-smile.yml`: the one-shot job. Now that a complete result exists, every later run skips unless
  dispatched with `force`.

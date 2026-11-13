# ICT A-setup book: a book-level risk rule (13 Nov 2026)

**Verdict: FAIL. None of the 4 pre-registered book rules passes; the A-setup book stays sized as it is.** No rule beats the
book as the desk runs it on return / drawdown in both halves, and no rule's paired monthly bootstrap reaches P(better) 0.9
(best 0.62, all Holm p 1.0). The cluster rule (R1) cuts the edge with the drawdown: it skips 444 trades worth +71.2R.

Pre-registered in `PREREGISTRATION.md` (committed and pushed alone before any rule ran; sha256 in `result.json`). Paper
research on the ICT edge, which Fred controls: nothing under `ict/` or the ICT rule book changed, and no note for Fred is
needed (nothing passed). Every simulated trade keeps the engine's own stop; a rule only skips a trade or scales its size.

## Setup

The lab's A-setup trades (`api/_ictlab.js` `runMarket`: the desk's `signals`, `isASetup`, `sizeOf`, `simulate`, imported,
never edited), OANDA mid H1 NAS100 / SPX500 / US30 / US2000 / XAU, signal closes 2020-01-01 to 2026-10-31, live sizing, net
of the lab's round-trip costs, one open trade per market. IS = entries 2020-23, OOS = entries 2024 on. The as-is book is
`ict-equal-lows`' unfiltered T1 stream (same 1,028 / 679 trades and totals). Its OOS drawdown reads 18.3R here (17.8R
there) because this study runs the sum in close order, as pre-registered.

## Results

| book | half | n | net R | R a trade | max DD | return / DD | monthly Sharpe | t |
|---|---|---|---|---|---|---|---|---|
| as is | IS | 1028 | +86.5 | +0.084 | 33.3 | 2.596 | 0.677 | 1.73 |
| as is | OOS | 679 | +93.0 | +0.137 | 18.3 | 5.075 | 1.364 | 2.28 |
| R1 | IS | 747 | +52.1 | +0.070 | 29.5 | 1.769 | 0.609 | 1.24 |
| R1 | OOS | 516 | +56.2 | +0.109 | 12.5 | 4.483 | 1.194 | 1.66 |
| R2 | IS | 1008 | +85.6 | +0.085 | 35.3 | 2.422 | 0.66 | 1.73 |
| R2 | OOS | 658 | +97.6 | +0.148 | 17.1 | 5.713 | 1.417 | 2.41 |
| R3 | IS | 857 | +69.2 | +0.081 | 27.2 | 2.542 | 0.692 | 1.52 |
| R3 | OOS | 583 | +82.1 | +0.141 | 14.2 | 5.786 | 1.465 | 2.16 |
| R4 | IS | 1028 | +97.3 | +0.095 | 34.6 | 2.813 | 0.761 | 1.86 |
| R4 | OOS | 679 | +82.8 | +0.122 | 22.3 | 3.721 | 1.093 | 2 |

| rule | skipped (their R as is) | return / DD better IS | better OOS | OOS Sharpe not lower | P(better), 2,000 draws | Holm p | verdict |
|---|---|---|---|---|---|---|---|
| R1 one same-side index position at a time | 444 (+71.2R) | no | no | no | 0.33 | 1 | FAIL |
| R2 stop after -2R closed in the New York day | 41 (-3.7R) | no | yes | yes | 0.6225 | 1 | FAIL |
| R3 at most 2 open positions | 267 (+28.2R) | no | yes | yes | 0.513 | 1 | FAIL |
| R4 inverse-volatility weights (median 1.00, 0.33 to 2.64) | 0 | yes | no | no | 0.4115 | 1 | FAIL |

Net R by entry year (as is | R1 | R2 | R3 | R4): 2020 +37.5 | +31.1 | +39.1 | +32.7 | +41.0; 2021 +14.6 | +2.0 | +17.4 |
+11.2 | +20.8; 2022 +36.1 | +21.4 | +32.4 | +29.9 | +41.7; 2023 -1.7 | -2.3 | -3.3 | -4.6 | -6.2; 2024 +25.1 | +15.9 | +25.8 |
+19.2 | +16.7; 2025 +43.2 | +38.6 | +45.4 | +36.4 | +43.0; 2026 +24.7 | +1.7 | +26.4 | +26.6 | +23.1.

## Reading

- **R1 (cluster)** lowers the drawdown (33.3 to 29.5R IS, 18.3 to 12.5R OOS) but takes away far more return (+71.2R of the
  skipped trades): the second and third index signals of a same-side burst are not worse trades than the first. Return /
  drawdown falls in both halves.
- **R2 (daily loss stop)** and **R3 (two open)** improve the OOS ratio (5.71 and 5.79 against 5.08) and the OOS Sharpe, but are
  worse in sample, and the bootstrap cannot tell them from the as-is book (P 0.62 and 0.51). R2 touches only 41 trades.
- **R4 (inverse volatility)** helps in sample and hurts out of sample; with daily R mostly zero, the weights mostly track how
  often a market trades, not how risky it is.
- Nothing here is an edge claim about the book itself: the as-is A-rule was fitted on 2023-26 (indices) and 2019-26 (gold), so
  its own numbers are in sample. Only the rules' differences were judged.

## Repeat

`node --use-env-proxy research/edge/ict-equal-lows/run.mjs fetch <dir>` (candles outside git), then
`node research/edge/ict-book-risk/run.mjs full <dir>`. Tests: `tests/desk-ict-book-risk.test.mjs`.

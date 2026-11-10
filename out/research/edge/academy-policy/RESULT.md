# Academy decision policy against taking every setup: diagnosis and five candidates

Run 10 Nov 2026 on the corrected research clock. Pre-registration: `PREREGISTRATION.md` (committed before any script
of this study existed; no amendment). Data: the Academy's train pool, flagged setups left out, `policy-1.0` with no
lessons and no model. Net R a trade after costs throughout. Paper research: no edge's trading rule, no council code
and no live system is touched.

**Verdict: no candidate passes. The shipped policy stays and the exam pool was not read.**
None of the five pre-registered candidates beats "take every setup" on validation: 0 of 16 candidate × scope tests is
accepted, and the largest validation t is 1.00 where the rule needs 2 before the Holm correction and about 3 after it.
Two candidates are rejected, three are inconclusive. `policy-1.0` stays the shipped policy; zero exam reads are logged
in `academy/data/exam-ledger.json`.

In plain words:

- **The policy's evidence score does not rank trades.** On replica and gmp the rank correlation between the evidence
  margin and net R is about zero and slightly negative in both parts (replica −0.07 and −0.10, gmp −0.06 and −0.02;
  no t beyond 1.2). A policy that takes the high-margin setups therefore picks at random with respect to results.
- **The replica gap is a discovery-period result that did not repeat.** Whole train pool: takes +0.15 R against waits
  +0.69 R (t −1.53). Discovery (to May 2025): −0.73 R (t −1.43). Validation (Jun 2025 to Apr 2026): −0.07 R
  (t −0.19). In discovery the setups *without* momentum and lower-timeframe structure behind them were the big
  winners (t −2.84 and −4.57 against those support votes); on validation both signs flipped.
- **The gmp gap has the same sign in both parts but is not significant in either** (−0.08 R, t −0.43; −0.27 R,
  t −1.47; harm check adjusted p 0.73). On gmp no vote separates trades in both parts, and the edge itself has almost
  no mean to select from (+0.01 R in discovery, +0.17 R on validation).
- **Two votes are constants, not evidence.** Every candidate except gtrend's carries the edge's 10R cap as its
  "target". So "reward to risk at least 2" supports every setup, and "a resting level in the way" contradicts nearly
  every setup (replica 324 of 325, gmp 510 of 513). Together they only move the bar.
- **This data cannot show a modest improvement.** The smallest take-minus-wait difference that reaches t = 2 on
  validation is 0.35 R on gmp, 0.51 R on nq-open, 0.62 R on gtl and 1.28 R on replica, each several times the edge's own
  average trade. A real +0.1 R would be reported as inconclusive. That is what "inconclusive" means below.

## 1. Splits

Discovery = the earliest 60 % of each edge's usable train setups by count, validation = the latest 40 %, cut by time.
A trade is a setup whose order filled.

| Edge | Cut (UTC) | Discovery setups / trades | Validation setups / trades |
|---|---|---|---|
| replica | 2025-06-02 11:29 | 195 / 195 | 130 / 130 |
| mosha-bo | 2023-09-11 07:19 | 19 / 15 | 14 / 13 |
| gtrend | 2024-10-18 00:04 | 10 / 10 | 8 / 8 |
| gtl | 2024-05-27 16:04 | 99 / 99 | 67 / 67 |
| geg | 2024-08-17 00:04 | 67 / 51 | 46 / 31 |
| gmp | 2023-08-30 13:15 | 307 / 307 | 206 / 206 |
| nq-open | 2024-05-31 13:37 | 206 / 206 | 138 / 138 |

Pooled = the seven edges together, each with its own cut. Pooled tests use net R with each edge's discovery mean taken
out, so a policy gets no credit for preferring a high-mean edge; the plain net R figure is shown beside it.

## 2. `policy-1.0` against taking every setup

Each set: n, net R a trade, t, win rate, maximum drawdown in R (closed trades in exit order).

**Discovery**

Each set: n, net R a trade, t, win rate, max drawdown in R.

| Scope | Every setup | Policy takes | Policy waits | Take minus wait | Welch t |
|---|---|---|---|---|---|
| replica | 195, +0.62, 2.38, 23 %, 26.63 | 90, +0.23, 0.77, 19 %, 15.99 | 105, +0.96, 2.34, 27 %, 18.36 | −0.73 | −1.43 |
| mosha-bo | 15, +0.58, 1.03, 40 %, 4.57 | 9, +0.87, n/a, 44 %, 2.52 | 6, +0.14, n/a, 33 %, 2.05 | +0.73 | 0.65 |
| gtrend | 10, +0.48, 0.67, 40 %, 5.26 | 10, +0.48, 0.67, 40 %, 5.26 | 0 | n/a | n/a |
| gtl | 99, +0.09, 0.69, 50 %, 13.48 | 31, +0.28, 1.02, 52 %, 5.47 | 68, 0.00, 0.00, 49 %, 11.21 | +0.28 | 0.91 |
| geg | 51, +0.74, 2.23, 49 %, 7.33 | 34, +0.72, 1.95, 53 %, 4.07 | 17, +0.77, 1.14, 41 %, 4.89 | −0.05 | −0.06 |
| gmp | 307, +0.01, 0.18, 44 %, 16.06 | 67, −0.05, −0.30, 42 %, 11.88 | 240, +0.03, 0.38, 44 %, 13.87 | −0.08 | −0.43 |
| nq-open | 206, +0.05, 0.46, 39 %, 16.29 | 44, +0.34, 1.52, 52 %, 4.94 | 162, −0.03, −0.27, 35 %, 16.02 | +0.37 | 1.47 |
| pooled | 883, +0.22, 3.03, 39 %, 32.45 | 285, +0.27, 2.20, 39 %, 17.17 | 598, +0.20, 2.18, 39 %, 24.00 | −0.10 (plain net R +0.08) | −0.62 (plain 0.52) |

**Validation**

Each set: n, net R a trade, t, win rate, max drawdown in R.

| Scope | Every setup | Policy takes | Policy waits | Take minus wait | Welch t | Harm check (two-sided, Holm) |
|---|---|---|---|---|---|---|
| replica | 130, +0.08, 0.45, 25 %, 21.21 | 79, +0.06, 0.23, 27 %, 17.13 | 51, +0.13, 0.45, 24 %, 10.38 | −0.07 | −0.19 | no measurable difference (adjusted p 1.000) |
| mosha-bo | 13, +1.09, 1.45, 46 %, 2.02 | 6, +1.77, n/a, 50 %, 2.02 | 7, +0.51, n/a, 43 %, 2.36 | +1.25 | 0.78 | cannot be tested: too few trades on one side |
| gtrend | 8, +3.64, n/a, 63 %, 2.01 | 8, +3.64, n/a, 63 %, 2.01 | 0 | n/a | n/a | cannot be tested: too few trades on one side |
| gtl | 67, +0.40, 2.47, 54 %, 10.40 | 28, +0.53, 2.42, 64 %, 5.21 | 39, +0.31, 1.34, 46 %, 7.39 | +0.22 | 0.68 | no measurable difference (adjusted p 1.000) |
| geg | 31, +0.03, 0.10, 39 %, 6.94 | 20, +0.02, 0.07, 40 %, 7.64 | 11, +0.03, 0.08, 36 %, 2.10 | −0.01 | −0.02 | cannot be tested: too few trades on one side |
| gmp | 206, +0.17, 1.88, 48 %, 7.80 | 53, −0.03, −0.21, 43 %, 10.83 | 153, +0.24, 2.18, 49 %, 6.09 | −0.27 | −1.47 | no measurable difference (adjusted p 0.728) |
| nq-open | 138, +0.44, 3.02, 50 %, 8.55 | 43, +0.62, 2.27, 54 %, 4.74 | 95, +0.35, 2.08, 48 %, 5.80 | +0.27 | 0.84 | no measurable difference (adjusted p 1.000) |
| pooled | 593, +0.30, 3.94, 44 %, 21.45 | 237, +0.36, 2.48, 43 %, 24.07 | 356, +0.26, 3.15, 44 %, 7.81 | −0.07 (plain net R +0.10) | −0.44 (plain 0.59) | no measurable difference (adjusted p 1.000) |

**Whole train pool** (the figures of `academy/data/eval.json`, which now also carries the drawdowns)

Each set: n, net R a trade, t, win rate, max drawdown in R.

| Scope | Every setup | Policy takes | Policy waits | Take minus wait | Welch t |
|---|---|---|---|---|---|
| replica | 325, +0.41, 2.34, 24 %, 26.63 | 169, +0.15, 0.76, 23 %, 17.13 | 156, +0.69, 2.35, 26 %, 18.36 | −0.54 | −1.53 |
| mosha-bo | 28, +0.81, 1.79, 43 %, 4.57 | 15, +1.23, 1.67, 47 %, 3.11 | 13, +0.34, 0.70, 39 %, 3.40 | +0.89 | 1.01 |
| gtrend | 18, +1.89, 1.60, 50 %, 5.26 | 18, +1.89, 1.60, 50 %, 5.26 | 0 | n/a | n/a |
| gtl | 166, +0.22, 2.13, 51 %, 13.48 | 59, +0.40, 2.24, 58 %, 5.47 | 107, +0.11, 0.94, 48 %, 12.23 | +0.29 | 1.33 |
| geg | 82, +0.47, 2.05, 45 %, 7.33 | 54, +0.46, 1.75, 48 %, 7.64 | 28, +0.48, 1.09, 39 %, 4.89 | −0.02 | −0.03 |
| gmp | 513, +0.07, 1.35, 45 %, 16.06 | 120, −0.04, −0.37, 43 %, 11.88 | 393, +0.11, 1.73, 46 %, 13.87 | −0.15 | −1.17 |
| nq-open | 344, +0.20, 2.39, 43 %, 16.29 | 87, +0.48, 2.72, 53 %, 4.94 | 257, +0.11, 1.14, 40 %, 16.02 | +0.37 | 1.84 |
| pooled | 1476, +0.25, 4.74, 41 %, 32.45 | 522, +0.31, 3.30, 40 %, 24.07 | 954, +0.22, 3.43, 41 %, 24.00 | −0.08 (plain net R +0.09) | −0.69 (plain 0.82) |

Reading it:

- No scope is measurably different from taking every setup, in either part. The harm check on validation (two-sided,
  Holm over the five scopes that can be tested) finds nothing: the smallest adjusted p is 0.73 (gmp).
- The pooled "+0.09 R" of `eval.json` (t 0.82) is the policy preferring high-mean edges (it takes every gtrend setup).
  With each edge's mean taken out the pooled difference is −0.08 R (t −0.69).
- **Drawdown.** The take-set's drawdown is smaller than the mechanical one on most edges (nq-open 4.94 against 16.29,
  gtl 5.47 against 13.48, gmp 11.88 against 16.06, replica 17.13 against 26.63), but it holds a third of the trades, and
  a subset usually falls less in R. It is not smaller where it would matter: on geg it is larger (7.64 against 7.33), on
  gmp's validation part it is larger (10.83 against 7.80), and on the pooled validation trades the take-set fell 24.07 R
  against 21.45 R for every setup. Fewer trades also earn less in total: the waits made +208.59 R on the whole pool.

## 3. Diagnosis

A vote is one evidence item (a factor on the support or the contradiction side); the four judgement gates are tabled
as votes too. "Diff" is net R a trade with the vote minus without it. Wrong-signed = a support vote whose trades did
worse, or a contradiction vote or gate whose trades did better. A vote needs 20 trades on each side for a t. The
validation columns are the same table on later trades, with nothing re-fitted.

### 3.1 replica

**discovery**: 195 setups, 195 trades; policy-1.0 waited on 105 (54 %), and those trades made +0.96 R a trade (n 105, t 2.34).
Decided by: evidenceOnly 77 (+0.82 R, n 77); both 18 (+0.92 R, n 18); gateOnly 10 (+2.05 R, n 10). Evidence short on: margin only 74 (+0.94 R, n 74); margin and support 21 (+0.48 R, n 21).
Top contradiction of a wait: location 57 (+0.71 R, n 57, t 1.36); oppLiq 19 (+0.34 R, n 19, t 0.55); htfBias 17 (+2.09 R, n 17, t 1.53); event 12 (+1.48 R, n 12, t 1.03).
Gates among waits: event 12 (+1.48 R, n 12, t 1.03); volatility 6 (−0.73 R, n 6, t n/a); unfamiliar 16 (+0.97 R, n 16, t 1.06).
Margin against net R: Spearman −0.068 (t −0.95, n 195); margin below 0: n 51, +0.72 R; 0 to under the line: n 44, +0.98 R; at or over the line: n 100, +0.41 R.

**validation**: 130 setups, 130 trades; policy-1.0 waited on 51 (39 %), and those trades made +0.13 R a trade (n 51, t 0.45).
Decided by: evidenceOnly 36 (−0.01 R, n 36); both 12 (+0.17 R, n 12); gateOnly 3 (+1.60 R, n 3). Evidence short on: margin only 39 (−0.14 R, n 39); margin and support 9 (+0.77 R, n 9).
Top contradiction of a wait: location 31 (−0.14 R, n 31, t −0.51); oppLiq 10 (+0.13 R, n 10, t 0.21); event 6 (+1.26 R, n 6, t n/a); htfBias 3 (+1.13 R, n 3, t n/a); displacement 1 (−1.50 R, n 1, t n/a).
Gates among waits: event 6 (+1.26 R, n 6, t n/a); volatility 9 (−0.08 R, n 9, t n/a).
Margin against net R: Spearman −0.101 (t −1.15, n 130); margin below 0: n 29, +0.33 R; 0 to under the line: n 19, −0.42 R; at or over the line: n 82, +0.11 R.

| Vote | Kind | Discovery: n with / without | R with | R without | Diff | t | Wrong-signed | Validation: n with / without | Diff | t | Wrong-signed | Dropped by C4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| con:confirmation | contradiction | 54 / 141 | +1.18 | +0.41 | +0.77 | 1.17 | yes | 36 / 94 | +0.30 | 0.70 | yes | yes |
| con:displacement | contradiction | 6 / 189 | n/a | n/a | n/a | n/a | too few | 4 / 126 | n/a | n/a | too few |  |
| con:event | contradiction | 12 / 183 | n/a | n/a | n/a | n/a | too few | 6 / 124 | n/a | n/a | too few |  |
| con:htfBias | contradiction | 57 / 138 | +1.15 | +0.40 | +0.74 | 1.11 | yes | 36 / 94 | +0.35 | 0.68 | yes | yes |
| con:location | contradiction | 93 / 102 | +0.42 | +0.80 | −0.38 | −0.73 | no | 68 / 62 | −0.63 | −1.68 | no |  |
| con:oppLiq | contradiction | 194 / 1 | n/a | n/a | n/a | n/a | too few | 130 / 0 | n/a | n/a | too few |  |
| con:regime | contradiction | 13 / 182 | n/a | n/a | n/a | n/a | too few | 9 / 121 | n/a | n/a | too few |  |
| con:session | contradiction | 5 / 190 | n/a | n/a | n/a | n/a | too few | 8 / 122 | n/a | n/a | too few |  |
| con:similar | contradiction | 24 / 171 | +1.27 | +0.53 | +0.75 | 0.84 | yes | 24 / 106 | −0.35 | −0.87 | no |  |
| con:stop | contradiction | 61 / 134 | +0.21 | +0.81 | −0.60 | −1.20 | no | 37 / 93 | −0.12 | −0.32 | no |  |
| con:sweep | contradiction | 24 / 171 | +0.67 | +0.61 | +0.05 | 0.07 | yes | 14 / 116 | n/a | n/a | too few |  |
| con:volatility | contradiction | 49 / 146 | +0.21 | +0.76 | −0.55 | −1.07 | no | 32 / 98 | −0.42 | −1.10 | no |  |
| gate:event | gate | 12 / 183 | n/a | n/a | n/a | n/a | too few | 6 / 124 | n/a | n/a | too few |  |
| gate:unfamiliar | gate | 16 / 179 | n/a | n/a | n/a | n/a | too few | 0 | n/a | n/a | too few |  |
| gate:volatility | gate | 6 / 189 | n/a | n/a | n/a | n/a | too few | 9 / 121 | n/a | n/a | too few |  |
| sup:confirmation | support | 141 / 54 | +0.41 | +1.18 | −0.77 | −1.17 | yes | 94 / 36 | −0.30 | −0.70 | yes | yes |
| sup:displacement | support | 79 / 116 | +0.27 | +0.86 | −0.59 | −1.14 | yes | 46 / 84 | −0.14 | −0.35 | yes | yes |
| sup:htfBias | support | 64 / 131 | +0.42 | +0.72 | −0.30 | −0.57 | yes | 64 / 66 | −0.42 | −1.13 | yes |  |
| sup:location | support | 51 / 144 | +1.12 | +0.44 | +0.68 | 1.01 | no | 23 / 107 | −0.02 | −0.05 | yes |  |
| sup:ltfStructure | support | 28 / 167 | −0.67 | +0.84 | −1.51 | −4.57 | yes | 26 / 104 | +0.28 | 0.60 | no | yes |
| sup:momentum | support | 120 / 75 | −0.02 | +1.65 | −1.67 | −2.84 | yes | 75 / 55 | +0.27 | 0.71 | no | yes |
| sup:oppLiq | support | 1 / 194 | n/a | n/a | n/a | n/a | too few | 0 | n/a | n/a | too few |  |
| sup:regime | support | 109 / 86 | +0.66 | +0.58 | +0.08 | 0.15 | no | 77 / 53 | +0.41 | 1.12 | no |  |
| sup:rr | support | 195 / 0 | n/a | n/a | n/a | n/a | too few | 130 / 0 | n/a | n/a | too few |  |
| sup:session | support | 119 / 76 | +0.49 | +0.82 | −0.32 | −0.58 | yes | 79 / 51 | +0.18 | 0.47 | no |  |
| sup:similar | support | 43 / 152 | +0.60 | +0.63 | −0.02 | −0.03 | yes | 83 / 47 | +0.18 | 0.48 | no |  |
| sup:sweep | support | 60 / 135 | +0.76 | +0.56 | +0.21 | 0.34 | no | 51 / 79 | −0.90 | −2.57 | yes |  |

What it shows:

- **Why it waits.** 54 % of discovery setups were waited on, three quarters of them on evidence alone, and almost
  always because the margin was short (the minimum support was rarely the reason). "Poor location" is the leading
  contradiction of a wait (57 of 105 in discovery, 31 of 51 on validation).
- **Where the discovery gap came from.** Four support votes were wrong-signed in discovery at |t| over 1: momentum with the trade
  (120 trades at −0.02 R against 75 without at +1.65 R, t −2.84), lower-timeframe structure with the trade (t −4.57),
  a strong trigger bar (t −1.17) and displacement with the trade (t −1.14). The replica is a reversal: when momentum
  and structure already agree with the trade, the turn has already run. That story fits discovery. It does not survive:
  on validation momentum is +0.27 R (t 0.71) and structure +0.28 R (t 0.60), and the other two shrink to t −0.70 and −0.35.
- **Location (H3) was the wrong suspect.** Trades carrying "poor location" made less in both parts (−0.38 R, t −0.73;
  −0.63 R, t −1.68). Not significant, but the right way round both times. The a-priori candidate that removed it (C3)
  is rejected.
- **Heavy tails.** 23 % of replica trades win and the SD is 3.6 R. A handful of large winners decides any
  take-against-wait comparison: a gap of 0.7 R is inside what chance gives (the smallest detectable difference on
  validation is 1.28 R).

### 3.2 gmp

**discovery**: 307 setups, 307 trades; policy-1.0 waited on 240 (78 %), and those trades made +0.03 R a trade (n 240, t 0.38).
Decided by: evidenceOnly 183 (+0.02 R, n 183); both 49 (+0.00 R, n 49); gateOnly 8 (+0.52 R, n 8). Evidence short on: margin only 192 (+0.01 R, n 192); margin and support 40 (+0.03 R, n 40).
Top contradiction of a wait: oppLiq 133 (+0.05 R, n 133, t 0.44); displacement 89 (−0.07 R, n 89, t −0.54); htfBias 10 (+0.55 R, n 10, t 1.40); event 8 (+0.23 R, n 8, t n/a).
Gates among waits: event 8 (+0.23 R, n 8, t n/a); volatility 43 (+0.10 R, n 43, t 0.58); unfamiliar 16 (+0.09 R, n 16, t 0.30).
Margin against net R: Spearman −0.057 (t −1.00, n 307); margin below 0: n 133, +0.04 R; 0 to under the line: n 99, −0.03 R; at or over the line: n 75, +0.01 R.

**validation**: 206 setups, 206 trades; policy-1.0 waited on 153 (74 %), and those trades made +0.24 R a trade (n 153, t 2.18).
Decided by: evidenceOnly 100 (+0.30 R, n 100); both 46 (+0.15 R, n 46); gateOnly 7 (−0.04 R, n 7). Evidence short on: margin only 126 (+0.25 R, n 126); margin and support 20 (+0.22 R, n 20).
Top contradiction of a wait: oppLiq 73 (+0.26 R, n 73, t 1.56); displacement 51 (+0.16 R, n 51, t 0.98); event 22 (+0.30 R, n 22, t 0.96); htfBias 7 (+0.31 R, n 7, t n/a).
Gates among waits: event 22 (+0.30 R, n 22, t 0.96); volatility 34 (+0.12 R, n 34, t 0.63); unfamiliar 1 (−1.03 R, n 1, t n/a).
Margin against net R: Spearman −0.019 (t −0.27, n 206); margin below 0: n 74, +0.16 R; 0 to under the line: n 72, +0.34 R; at or over the line: n 60, −0.03 R.

| Vote | Kind | Discovery: n with / without | R with | R without | Diff | t | Wrong-signed | Validation: n with / without | Diff | t | Wrong-signed | Dropped by C4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| con:confirmation | contradiction | 176 / 131 | −0.03 | +0.07 | −0.10 | −0.74 | no | 116 / 90 | +0.07 | 0.37 | yes |  |
| con:displacement | contradiction | 107 / 200 | −0.02 | +0.03 | −0.05 | −0.36 | no | 67 / 139 | −0.05 | −0.27 | no |  |
| con:event | contradiction | 8 / 299 | n/a | n/a | n/a | n/a | too few | 22 / 184 | +0.15 | 0.45 | yes |  |
| con:htfBias | contradiction | 10 / 297 | n/a | n/a | n/a | n/a | too few | 7 / 199 | n/a | n/a | too few |  |
| con:location | contradiction | 156 / 151 | +0.03 | −0.01 | +0.04 | 0.27 | yes | 97 / 109 | +0.12 | 0.68 | yes |  |
| con:oppLiq | contradiction | 306 / 1 | n/a | n/a | n/a | n/a | too few | 204 / 2 | n/a | n/a | too few |  |
| con:regime | contradiction | 219 / 88 | +0.04 | −0.06 | +0.10 | 0.64 | yes | 132 / 74 | −0.01 | −0.02 | no |  |
| con:similar | contradiction | 37 / 270 | +0.41 | −0.04 | +0.45 | 2.06 | yes | 5 / 201 | n/a | n/a | too few | yes |
| con:stop | contradiction | 49 / 258 | −0.19 | +0.05 | −0.24 | −1.55 | no | 50 / 156 | +0.09 | 0.44 | yes |  |
| con:sweep | contradiction | 62 / 245 | +0.15 | −0.02 | +0.17 | 0.94 | yes | 49 / 157 | +0.10 | 0.39 | yes |  |
| con:volatility | contradiction | 207 / 100 | −0.00 | +0.04 | −0.04 | −0.28 | no | 109 / 97 | +0.06 | 0.34 | yes |  |
| gate:event | gate | 8 / 299 | n/a | n/a | n/a | n/a | too few | 22 / 184 | +0.15 | 0.45 | yes |  |
| gate:unfamiliar | gate | 16 / 291 | n/a | n/a | n/a | n/a | too few | 1 / 205 | n/a | n/a | too few |  |
| gate:volatility | gate | 43 / 264 | +0.10 | −0.00 | +0.10 | 0.54 | yes | 34 / 172 | −0.06 | −0.30 | no |  |
| sup:confirmation | support | 131 / 176 | +0.07 | −0.03 | +0.10 | 0.74 | no | 90 / 116 | −0.07 | −0.37 | yes |  |
| sup:displacement | support | 36 / 271 | +0.09 | +0.00 | +0.09 | 0.46 | no | 21 / 185 | +0.20 | 0.67 | no |  |
| sup:htfBias | support | 237 / 70 | −0.02 | +0.12 | −0.14 | −0.83 | yes | 162 / 44 | +0.07 | 0.33 | no |  |
| sup:location | support | 58 / 249 | −0.11 | +0.04 | −0.15 | −0.85 | yes | 43 / 163 | −0.09 | −0.40 | yes |  |
| sup:ltfStructure | support | 73 / 234 | +0.09 | −0.01 | +0.10 | 0.56 | no | 54 / 152 | −0.42 | −2.33 | yes |  |
| sup:momentum | support | 72 / 235 | +0.16 | −0.03 | +0.20 | 1.13 | no | 43 / 163 | +0.01 | 0.06 | no |  |
| sup:oppLiq | support | 1 / 306 | n/a | n/a | n/a | n/a | too few | 2 / 204 | n/a | n/a | too few |  |
| sup:regime | support | 39 / 268 | +0.06 | +0.01 | +0.05 | 0.20 | no | 22 / 184 | +0.02 | 0.07 | no |  |
| sup:rr | support | 307 / 0 | n/a | n/a | n/a | n/a | too few | 206 / 0 | n/a | n/a | too few |  |
| sup:session | support | 307 / 0 | n/a | n/a | n/a | n/a | too few | 206 / 0 | n/a | n/a | too few |  |
| sup:similar | support | 35 / 272 | −0.24 | +0.04 | −0.29 | −1.18 | yes | 71 / 135 | −0.04 | −0.23 | yes | yes |
| sup:sweep | support | 48 / 259 | +0.05 | +0.01 | +0.05 | 0.27 | no | 29 / 177 | −0.18 | −0.80 | yes |  |

What it shows:

- **Why it waits.** Three quarters of gmp setups are waited on. The contradiction side is large by construction:
  "a level in the way" on 99.7 % of setups, a bad regime on 71 %, high volatility on 67 %, a weak trigger bar on 57 %,
  poor location on 51 %. Displacement against the trade fires on 35 % (H1 predicted at least 40 %).
- **Nothing separates.** No vote reaches |t| 2 the right way in either part. The one discovery t over 2 is the
  similar-cases contradiction, wrong-signed (+0.45 R, t 2.06, n 37), with only 5 such trades on validation. On
  validation the largest is lower-timeframe structure, wrong-signed (−0.42 R, t −2.33), which was +0.10 R in discovery.
- **The gates (H2, H6).** Trades held back by the volatility gate made +0.10 R (n 43) and +0.12 R (n 34): no worse
  than the rest (t 0.54 and −0.30). Event-gated trades on validation made +0.30 R (n 22). No gate marks a losing group.
- **More evidence is not better here.** Trades at or over the take line made +0.01 R (n 75) in discovery and −0.03 R
  (n 60) on validation, against +0.16 R and +0.34 R for the two bands below the line on validation. The confidence
  candidate (C5) is at its worst on gmp: −0.50 R on validation (t −2.29, 25 takes), −0.12 R in discovery (t −0.43).
  Same sign twice, significant once, on a test that was not registered as a harm test: an observation, not a finding.

### 3.3 The other edges, briefly

**mosha-bo** (too few trades for any vote table)

**discovery**: 19 setups, 15 trades; policy-1.0 waited on 8 (42 %), and those trades made +0.14 R a trade (n 6, t n/a).
Decided by: evidenceOnly 5 (−0.56 R, n 5); gateOnly 2 (n/a R, n 0); both 1 (+3.63 R, n 1). Evidence short on: margin only 6 (+0.14 R, n 6).
Top contradiction of a wait: ltfStructure 3 (−1.04 R, n 1, t n/a); htfBias 2 (−1.02 R, n 2, t n/a); sweep 2 (+0.14 R, n 2, t n/a); event 1 (+3.63 R, n 1, t n/a).
Gates among waits: event 1 (+3.63 R, n 1, t n/a); conflict 2 (n/a R, n 0, t n/a).
Margin against net R: Spearman −0.188 (t −0.69, n 15); margin below 0: n 3, −0.25 R; 0 to under the line: n 3, +0.52 R; at or over the line: n 9, +0.87 R.

**validation**: 14 setups, 13 trades; policy-1.0 waited on 7 (50 %), and those trades made +0.51 R a trade (n 7, t n/a).
Decided by: evidenceOnly 4 (+0.58 R, n 4); both 3 (+0.42 R, n 3). Evidence short on: margin only 7 (+0.51 R, n 7).
Top contradiction of a wait: htfBias 7 (+0.51 R, n 7, t n/a).
Gates among waits: conflict 3 (+0.42 R, n 3, t n/a).
Margin against net R: Spearman 0.365 (t 1.30, n 13); margin below 0: n 3, −0.79 R; 0 to under the line: n 4, +1.48 R; at or over the line: n 6, +1.77 R.

**gtrend** (the policy takes every setup; nothing to diagnose)

**discovery**: 10 setups, 10 trades; policy-1.0 waited on 0 (0 %), and those trades made n/a R a trade (n 0, t n/a).
Decided by: n/a. Evidence short on: n/a.
Top contradiction of a wait: n/a.
Gates among waits: none.
Margin against net R: Spearman 0.107 (t 0.30, n 10); margin below 0: n 0, n/a R; 0 to under the line: n 0, n/a R; at or over the line: n 10, +0.48 R.

**validation**: 8 setups, 8 trades; policy-1.0 waited on 0 (0 %), and those trades made n/a R a trade (n 0, t n/a).
Decided by: n/a. Evidence short on: n/a.
Top contradiction of a wait: n/a.
Gates among waits: none.
Margin against net R: Spearman 0.077 (t 0.19, n 8); margin below 0: n 0, n/a R; 0 to under the line: n 0, n/a R; at or over the line: n 8, +3.64 R.

**gtl**

**discovery**: 99 setups, 99 trades; policy-1.0 waited on 68 (69 %), and those trades made 0.00 R a trade (n 68, t 0.00).
Decided by: evidenceOnly 55 (−0.07 R, n 55); both 11 (+0.45 R, n 11); gateOnly 2 (−0.42 R, n 2). Evidence short on: margin only 49 (+0.05 R, n 49); margin and support 17 (−0.10 R, n 17).
Top contradiction of a wait: oppLiq 31 (+0.05 R, n 31, t 0.25); htfBias 28 (+0.07 R, n 28, t 0.34); event 5 (−0.14 R, n 5, t n/a); confirmation 2 (−0.43 R, n 2, t n/a); momentum 1 (−1.03 R, n 1, t n/a); regime 1 (−1.01 R, n 1, t n/a).
Gates among waits: event 5 (−0.14 R, n 5, t n/a); volatility 3 (−0.43 R, n 3, t n/a); unfamiliar 10 (+0.54 R, n 10, t 1.33).
Margin against net R: Spearman 0.172 (t 1.72, n 99); margin below 0: n 45, −0.02 R; 0 to under the line: n 21, +0.08 R; at or over the line: n 33, +0.24 R.

**validation**: 67 setups, 67 trades; policy-1.0 waited on 39 (58 %), and those trades made +0.31 R a trade (n 39, t 1.34).
Decided by: evidenceOnly 35 (+0.38 R, n 35); both 4 (−0.24 R, n 4). Evidence short on: margin only 29 (+0.21 R, n 29); margin and support 10 (+0.59 R, n 10).
Top contradiction of a wait: oppLiq 20 (+0.61 R, n 20, t 2.01); htfBias 17 (+0.08 R, n 17, t 0.20); displacement 1 (−0.37 R, n 1, t n/a); event 1 (−1.00 R, n 1, t n/a).
Gates among waits: event 1 (−1.00 R, n 1, t n/a); volatility 3 (+0.01 R, n 3, t n/a); unfamiliar 2 (+0.15 R, n 2, t n/a).
Margin against net R: Spearman 0.165 (t 1.35, n 67); margin below 0: n 23, +0.38 R; 0 to under the line: n 16, +0.22 R; at or over the line: n 28, +0.53 R.

**geg** (too few trades on validation for a vote table)

**discovery**: 67 setups, 51 trades; policy-1.0 waited on 23 (34 %), and those trades made +0.77 R a trade (n 17, t 1.14).
Decided by: evidenceOnly 12 (+1.75 R, n 11); gateOnly 9 (−1.02 R, n 4); both 2 (−1.02 R, n 2). Evidence short on: margin only 10 (+1.20 R, n 9); margin and support 4 (+1.60 R, n 4).
Top contradiction of a wait: oppLiq 19 (+1.15 R, n 14, t 1.47); momentum 4 (−1.02 R, n 3, t n/a).
Gates among waits: volatility 1 (−1.01 R, n 1, t n/a); unfamiliar 10 (−1.02 R, n 5, t n/a).
Margin against net R: Spearman −0.197 (t −1.41, n 51); margin below 0: n 6, +1.13 R; 0 to under the line: n 7, +1.49 R; at or over the line: n 38, +0.54 R.

**validation**: 46 setups, 31 trades; policy-1.0 waited on 15 (33 %), and those trades made +0.03 R a trade (n 11, t 0.08).
Decided by: evidenceOnly 7 (+0.10 R, n 5); both 4 (−0.70 R, n 3); gateOnly 4 (+0.65 R, n 3). Evidence short on: margin only 9 (−0.43 R, n 7); margin and support 2 (+1.41 R, n 1).
Top contradiction of a wait: oppLiq 12 (−0.24 R, n 9, t n/a); momentum 2 (−0.10 R, n 1, t n/a); volatility 1 (+2.65 R, n 1, t n/a).
Gates among waits: volatility 6 (+0.17 R, n 5, t n/a); unfamiliar 6 (−0.09 R, n 4, t n/a).
Margin against net R: Spearman 0.080 (t 0.43, n 31); margin below 0: n 2, +1.01 R; 0 to under the line: n 6, −0.60 R; at or over the line: n 23, +0.10 R.

**nq-open**

**discovery**: 206 setups, 206 trades; policy-1.0 waited on 162 (79 %), and those trades made −0.03 R a trade (n 162, t −0.27).
Decided by: evidenceOnly 120 (−0.00 R, n 120); both 33 (−0.25 R, n 33); gateOnly 9 (+0.37 R, n 9). Evidence short on: margin only 131 (−0.08 R, n 131); margin and support 22 (+0.07 R, n 22).
Top contradiction of a wait: htfBias 65 (−0.09 R, n 65, t −0.47); confirmation 48 (+0.25 R, n 48, t 1.05); ltfStructure 16 (−0.58 R, n 16, t −2.30); momentum 13 (+0.33 R, n 13, t 0.75); oppLiq 13 (−0.26 R, n 13, t −0.70); event 7 (−0.46 R, n 7, t n/a).
Gates among waits: event 7 (−0.46 R, n 7, t n/a); volatility 5 (+0.56 R, n 5, t n/a); unfamiliar 14 (−0.48 R, n 14, t −1.26); conflict 26 (0.00 R, n 26, t 0.00).
Margin against net R: Spearman 0.135 (t 1.95, n 206); margin below 0: n 104, −0.15 R; 0 to under the line: n 49, +0.14 R; at or over the line: n 53, +0.35 R.

**validation**: 138 setups, 138 trades; policy-1.0 waited on 95 (69 %), and those trades made +0.35 R a trade (n 95, t 2.08).
Decided by: evidenceOnly 71 (+0.31 R, n 71); both 22 (+0.38 R, n 22); gateOnly 2 (+1.57 R, n 2). Evidence short on: margin only 89 (+0.31 R, n 89); margin and support 4 (+0.62 R, n 4).
Top contradiction of a wait: htfBias 29 (+0.29 R, n 29, t 0.98); confirmation 25 (+0.50 R, n 25, t 1.29); event 13 (+0.51 R, n 13, t 1.02); oppLiq 12 (+0.04 R, n 12, t 0.12); ltfStructure 9 (+0.20 R, n 9, t n/a); momentum 7 (+0.55 R, n 7, t n/a).
Gates among waits: event 13 (+0.51 R, n 13, t 1.02); volatility 2 (−0.06 R, n 2, t n/a); unfamiliar 1 (+2.13 R, n 1, t n/a); conflict 12 (+0.06 R, n 12, t 0.11).
Margin against net R: Spearman 0.001 (t 0.01, n 138); margin below 0: n 54, +0.36 R; 0 to under the line: n 39, +0.28 R; at or over the line: n 45, +0.67 R.

gtl is the one edge whose margin correlates positively with net R in both parts (+0.17, t 1.72; +0.17, t 1.35), and
nq-open does in discovery only (+0.14, t 1.95; then 0.00). Neither reaches the t line. The full vote tables of every
edge are in `result.json` (`diagnosis.<edge>`).

### 3.4 Do the signs repeat?

55 votes have 20 trades on each side in both parts (replica 16, gtl 8, gmp 17, nq-open 14). **33 of the 55 kept the
sign of their difference** from discovery to validation; a coin gives 27 or 28. Of the 20 that were wrong-signed in
discovery, 11 were still wrong-signed on validation. Eight votes reach |t| 2 in one part; none reaches it in both.
(The votes overlap, so these counts are a description, not a test.)

### 3.5 The hypotheses

| | Stated before the run | What the data says |
|---|---|---|
| H1 | gmp: displacement against and a level in the way each fire on at least 40 % of setups, and those trades are not worse | Half right. "A level in the way" fires on 99.7 % (a constant: it cannot even be compared). Displacement against fires on 35 %, under the 40 % predicted; its trades are no different (−0.05 R, t −0.36; −0.05 R, t −0.27). |
| H2 | gmp: trades the volatility gate holds back are not worse | Holds in both parts (+0.10 R, t 0.54; −0.06 R, t −0.30). |
| H3 | replica: poor location is the leading wait reason and marks trades that are not worse | It is the leading reason. But those trades made less in both parts (−0.38 R, t −0.73; −0.63 R, t −1.68): not significant, and not the misplaced vote the author expected. |
| H4 | the margin's rank correlation with net R is not positive on replica and gmp | Holds in both parts (replica −0.07, −0.10; gmp −0.06, −0.02). |
| H5 | the similar-cases vote separates nothing on any edge | Holds: it never separates the right way at t 2. On gmp its contradiction side is wrong-signed in discovery (t 2.06). |
| H6 | no judgement gate marks a losing group (20 or more gated trades) | Holds: the four groups large enough (gmp volatility twice, gmp event, nq-open conflict) average +0.10, +0.12, +0.30 and 0.00 R. |

## 4. The candidates

The decision is made on validation. Discovery is shown for information. p is one-sided; the Holm correction runs over
the 16 tests that differ from `policy-1.0` and have 20 trades on each side (the smallest p would need t of about 2.98).

| Id | Candidate | Verdict | Tested scopes on validation: take minus wait (Welch t) |
|---|---|---|---|
| C1 | defer to the edge | inconclusive (cannot be tested) | none: no non-overridable gate fires on any of the 1,512 setups, so C1 is exactly "take every setup" and has no wait-set |
| C2 | gates only | rejected | gmp +0.06 (0.30), drawdown worse; nq-open −0.05 (−0.13); pooled +0.01 (0.06), drawdown worse |
| C3 | edge-logic table (a priori) | rejected | replica −0.10 (−0.24); gmp −0.15 (−0.77); pooled −0.07 (−0.49) |
| C4 | discovery sign audit | inconclusive | replica −0.29 (−0.80) rejected; gtl +0.27 (0.83); gmp −0.29 (−1.58) rejected; nq-open +0.30 (1.00); pooled −0.02 (−0.12) rejected |
| C5 | confidence threshold | inconclusive | replica +0.26 (0.70); gtl +0.15 (0.47); gmp −0.50 (−2.29) rejected; nq-open +0.07 (0.20); pooled −0.02 (−0.11) rejected |

"Inconclusive" for C4 and C5 means: on some scopes the difference points the right way, the take-set is above the
baseline and its drawdown is not worse, but the t is far below the line (0.20 to 1.00). It is not a weak pass.
Two things did not generalise and are worth naming: C5 on nq-open looked strong in discovery (+0.76 R, t 2.85, 24
takes) and is +0.07 R (t 0.20) on validation; C4's replica drop list (six votes, fitted on discovery) made its
validation take-set worse than its wait-set.

C4's drop lists, fixed on discovery: replica `con:confirmation`, `con:htfBias`, `sup:confirmation`,
`sup:displacement`, `sup:ltfStructure`, `sup:momentum`; gtl `sup:ltfStructure`; geg `con:location`, `sup:momentum`;
gmp `con:similar`, `sup:similar`; nq-open `con:volatility`; mosha-bo and gtrend none.

**C2 gates only**

| Scope | Part | Every setup | Takes | Waits | Take minus wait | Welch t | p | Holm p | Above baseline | Drawdown not worse | Smallest detectable diff (t 2 / after Holm) | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| replica | discovery | 195, +0.62, 2.38, 23 %, 26.63 | 167, +0.50, 1.83, 22 %, 33.09 | 28, +1.32, 1.71, 29 %, 4.21 | −0.82 | −1.00 | 0.838 | | | | | (information) |
| replica | validation | 130, +0.08, 0.45, 25 %, 21.21 | 115, +0.04, 0.18, 25 %, 21.36 | 15, +0.46, 0.69, 27 %, 5.03 | −0.42 | −0.61 | 0.726 | not tested | no | no | 2.00 / 2.98 | inconclusive: too few trades |
| mosha-bo | discovery | 15, +0.58, 1.03, 40 %, 4.57 | 14, +0.36, 0.65, 36 %, 4.57 | 1, +3.63, n/a, 100 %, 0.00 | −3.27 | n/a | n/a | | | | | (information) |
| mosha-bo | validation | 13, +1.09, 1.45, 46 %, 2.02 | 10, +1.29, 1.38, 50 %, 2.02 | 3, +0.42, n/a, 33 %, 1.01 | +0.88 | 0.60 | 0.286 | not tested | yes | yes | 2.85 / 4.25 | inconclusive: too few trades |
| gtrend | both | | | | | | | | | | | identical to policy-1.0 |
| gtl | discovery | 99, +0.09, 0.69, 50 %, 13.48 | 86, +0.05, 0.39, 48 %, 13.68 | 13, +0.32, 0.90, 62 %, 2.05 | −0.26 | −0.70 | 0.752 | | | | | (information) |
| gtl | validation | 67, +0.40, 2.47, 54 %, 10.40 | 63, +0.45, 2.59, 56 %, 10.14 | 4, −0.24, n/a, 25 %, 1.27 | +0.69 | 1.79 | 0.069 | not tested | yes | yes | 1.31 / 1.95 | inconclusive: too few trades |
| geg | discovery | 51, +0.74, 2.23, 49 %, 7.33 | 45, +0.97, 2.69, 56 %, 4.26 | 6, −1.02, n/a, 0 %, 6.11 | +1.99 | 5.51 | 0.000 | | | | | (information) |
| geg | validation | 31, +0.03, 0.10, 39 %, 6.94 | 25, +0.04, 0.13, 40 %, 7.16 | 6, −0.02, n/a, 33 %, 2.01 | +0.06 | 0.10 | 0.463 | not tested | yes | no | 2.15 / 3.20 | inconclusive: too few trades |
| gmp | discovery | 307, +0.01, 0.18, 44 %, 16.06 | 250, −0.00, −0.02, 43 %, 18.63 | 57, +0.07, 0.49, 46 %, 6.46 | −0.08 | −0.44 | 0.670 | | | | | (information) |
| gmp | validation | 206, +0.17, 1.88, 48 %, 7.80 | 153, +0.18, 1.74, 49 %, 9.45 | 53, +0.12, 0.72, 43 %, 6.81 | +0.06 | 0.30 | 0.384 | 1.000 | yes | no | 0.39 / 0.59 | rejected |
| nq-open | discovery | 206, +0.05, 0.46, 39 %, 16.29 | 164, +0.09, 0.77, 41 %, 12.37 | 42, −0.11, −0.48, 31 %, 13.48 | +0.20 | 0.77 | 0.221 | | | | | (information) |
| nq-open | validation | 138, +0.44, 3.02, 50 %, 8.55 | 114, +0.43, 2.71, 50 %, 9.19 | 24, +0.48, 1.31, 50 %, 3.06 | −0.05 | −0.13 | 0.549 | 1.000 | no | no | 0.67 / 1.00 | rejected |
| pooled | discovery | 883, +0.22, 3.03, 39 %, 32.45 | 736, +0.21, 2.68, 39 %, 40.71 | 147, +0.26, 1.44, 38 %, 9.89 | −0.10 (plain net R −0.05) | −0.50 (plain −0.24) | 0.691 | | | | | (information) |
| pooled | validation | 593, +0.30, 3.94, 44 %, 21.45 | 488, +0.31, 3.63, 44 %, 26.91 | 105, +0.24, 1.52, 41 %, 6.32 | +0.01 (plain net R +0.07) | 0.06 (plain 0.41) | 0.476 | 1.000 | yes | no | 0.46 / 0.69 | rejected |

**C3 edge-logic table (a priori)**

| Scope | Part | Every setup | Takes | Waits | Take minus wait | Welch t | p | Holm p | Above baseline | Drawdown not worse | Smallest detectable diff (t 2 / after Holm) | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| replica | discovery | 195, +0.62, 2.38, 23 %, 26.63 | 116, +0.19, 0.67, 18 %, 31.50 | 79, +1.26, 2.56, 30 %, 13.34 | −1.07 | −1.90 | 0.970 | | | | | (information) |
| replica | validation | 130, +0.08, 0.45, 25 %, 21.21 | 94, +0.06, 0.26, 26 %, 16.65 | 36, +0.15, 0.44, 25 %, 8.34 | −0.10 | −0.24 | 0.595 | 1.000 | no | yes | 1.43 / 2.13 | rejected |
| mosha-bo | both | | | | | | | | | | | identical to policy-1.0 |
| gtrend | both | | | | | | | | | | | identical to policy-1.0 |
| gtl | both | | | | | | | | | | | identical to policy-1.0 |
| geg | both | | | | | | | | | | | identical to policy-1.0 |
| gmp | discovery | 307, +0.01, 0.18, 44 %, 16.06 | 198, −0.00, −0.04, 42 %, 17.51 | 109, +0.04, 0.38, 47 %, 9.40 | −0.05 | −0.32 | 0.626 | | | | | (information) |
| gmp | validation | 206, +0.17, 1.88, 48 %, 7.80 | 130, +0.11, 1.09, 47 %, 11.11 | 76, +0.26, 1.58, 49 %, 6.13 | −0.15 | −0.77 | 0.779 | 1.000 | no | no | 0.36 / 0.53 | rejected |
| nq-open | both | | | | | | | | | | | identical to policy-1.0 |
| pooled | discovery | 883, +0.22, 3.03, 39 %, 32.45 | 442, +0.18, 1.94, 38 %, 31.89 | 441, +0.26, 2.33, 40 %, 20.20 | −0.15 (plain net R −0.07) | −1.03 (plain −0.49) | 0.848 | | | | | (information) |
| pooled | validation | 593, +0.30, 3.94, 44 %, 21.45 | 329, +0.31, 2.79, 43 %, 17.40 | 264, +0.28, 2.86, 44 %, 9.67 | −0.07 (plain net R +0.02) | −0.49 (plain 0.16) | 0.689 | 1.000 | no | yes | 0.35 / 0.53 | rejected |

**C4 discovery sign audit** (its discovery rows are in-sample by construction)

| Scope | Part | Every setup | Takes | Waits | Take minus wait | Welch t | p | Holm p | Above baseline | Drawdown not worse | Smallest detectable diff (t 2 / after Holm) | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| replica | discovery | 195, +0.62, 2.38, 23 %, 26.63 | 56, +0.53, 1.07, 20 %, 15.07 | 139, +0.66, 2.14, 25 %, 19.53 | −0.13 | −0.22 | 0.585 | | | | | (information) |
| replica | validation | 130, +0.08, 0.45, 25 %, 21.21 | 63, −0.07, −0.28, 25 %, 15.60 | 67, +0.23, 0.83, 25 %, 10.63 | −0.29 | −0.80 | 0.788 | 1.000 | no | yes | 1.28 / 1.90 | rejected |
| mosha-bo | both | | | | | | | | | | | identical to policy-1.0 |
| gtrend | both | | | | | | | | | | | identical to policy-1.0 |
| gtl | discovery | 99, +0.09, 0.69, 50 %, 13.48 | 31, +0.28, 1.02, 52 %, 5.47 | 68, 0.00, 0.00, 49 %, 11.21 | +0.28 | 0.91 | 0.183 | | | | | (information) |
| gtl | validation | 67, +0.40, 2.47, 54 %, 10.40 | 27, +0.56, 2.50, 67 %, 5.21 | 40, +0.30, 1.30, 45 %, 7.39 | +0.27 | 0.83 | 0.204 | 1.000 | yes | yes | 0.63 / 0.94 | inconclusive |
| geg | discovery | 51, +0.74, 2.23, 49 %, 7.33 | 33, +0.75, 2.00, 55 %, 4.07 | 18, +0.71, 1.10, 39 %, 4.89 | +0.04 | 0.05 | 0.481 | | | | | (information) |
| geg | validation | 31, +0.03, 0.10, 39 %, 6.94 | 19, +0.02, 0.06, 37 %, 7.64 | 12, +0.03, 0.09, 42 %, 2.10 | −0.01 | −0.02 | 0.509 | not tested | no | no | 1.74 / 2.60 | inconclusive: too few trades |
| gmp | discovery | 307, +0.01, 0.18, 44 %, 16.06 | 63, −0.03, −0.16, 43 %, 10.82 | 244, +0.02, 0.30, 44 %, 13.87 | −0.05 | −0.27 | 0.605 | | | | | (information) |
| gmp | validation | 206, +0.17, 1.88, 48 %, 7.80 | 47, −0.06, −0.38, 43 %, 11.54 | 159, +0.23, 2.20, 49 %, 6.09 | −0.29 | −1.58 | 0.941 | 1.000 | no | no | 0.41 / 0.61 | rejected |
| nq-open | discovery | 206, +0.05, 0.46, 39 %, 16.29 | 49, +0.36, 1.74, 51 %, 4.94 | 157, −0.05, −0.42, 35 %, 16.99 | +0.41 | 1.71 | 0.045 | | | | | (information) |
| nq-open | validation | 138, +0.44, 3.02, 50 %, 8.55 | 51, +0.63, 2.56, 55 %, 3.73 | 87, +0.33, 1.82, 47 %, 6.16 | +0.30 | 1.00 | 0.159 | 1.000 | yes | yes | 0.53 / 0.78 | inconclusive |
| pooled | discovery | 883, +0.22, 3.03, 39 %, 32.45 | 251, +0.36, 2.53, 42 %, 16.68 | 632, +0.16, 1.95, 38 %, 27.56 | +0.09 (plain net R +0.20) | 0.56 (plain 1.21) | 0.287 | | | | | (information) |
| pooled | validation | 593, +0.30, 3.94, 44 %, 21.45 | 221, +0.36, 2.48, 44 %, 17.43 | 372, +0.26, 3.09, 44 %, 11.09 | −0.02 (plain net R +0.10) | −0.12 (plain 0.62) | 0.548 | 1.000 | no | yes | 0.36 / 0.54 | rejected |

**C5 confidence threshold**

| Scope | Part | Every setup | Takes | Waits | Take minus wait | Welch t | p | Holm p | Above baseline | Drawdown not worse | Smallest detectable diff (t 2 / after Holm) | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| replica | discovery | 195, +0.62, 2.38, 23 %, 26.63 | 63, +0.42, 1.07, 21 %, 14.56 | 132, +0.71, 2.13, 24 %, 25.52 | −0.29 | −0.56 | 0.713 | | | | | (information) |
| replica | validation | 130, +0.08, 0.45, 25 %, 21.21 | 66, +0.21, 0.76, 29 %, 9.53 | 64, −0.05, −0.20, 22 %, 14.94 | +0.26 | 0.70 | 0.242 | 1.000 | yes | yes | 1.28 / 1.90 | inconclusive |
| mosha-bo | discovery | 15, +0.58, 1.03, 40 %, 4.57 | 2, −1.04, n/a, 0 %, 2.08 | 13, +0.82, 1.33, 46 %, 4.57 | −1.87 | −3.02 | 0.995 | | | | | (information) |
| mosha-bo | validation | 13, +1.09, 1.45, 46 %, 2.02 | 3, +3.38, n/a, 67 %, 1.01 | 10, +0.40, 0.75, 40 %, 2.02 | +2.97 | 1.10 | 0.189 | not tested | yes | yes | 2.85 / 4.25 | inconclusive: too few trades |
| gtrend | discovery | 10, +0.48, 0.67, 40 %, 5.26 | 4, −0.34, n/a, 25 %, 2.36 | 6, +1.02, n/a, 50 %, 2.91 | −1.37 | −1.12 | 0.849 | | | | | (information) |
| gtrend | validation | 8, +3.64, n/a, 63 %, 2.01 | 8, +3.64, n/a, 63 %, 2.01 | 0 | n/a | n/a | n/a | not tested | no | yes | n/a / n/a | inconclusive: too few trades |
| gtl | discovery | 99, +0.09, 0.69, 50 %, 13.48 | 15, +0.16, 0.56, 53 %, 3.05 | 84, +0.08, 0.53, 49 %, 12.20 | +0.08 | 0.26 | 0.398 | | | | | (information) |
| gtl | validation | 67, +0.40, 2.47, 54 %, 10.40 | 21, +0.51, 2.10, 67 %, 4.20 | 46, +0.36, 1.68, 48 %, 7.42 | +0.15 | 0.47 | 0.319 | 1.000 | yes | yes | 0.67 / 1.00 | inconclusive |
| geg | discovery | 51, +0.74, 2.23, 49 %, 7.33 | 16, −0.02, −0.07, 44 %, 4.38 | 35, +1.09, 2.40, 51 %, 4.68 | −1.11 | −2.04 | 0.976 | | | | | (information) |
| geg | validation | 31, +0.03, 0.10, 39 %, 6.94 | 16, +0.06, 0.16, 38 %, 6.63 | 15, −0.01, −0.03, 40 %, 3.11 | +0.07 | 0.14 | 0.444 | not tested | yes | yes | 1.70 / 2.53 | inconclusive: too few trades |
| gmp | discovery | 307, +0.01, 0.18, 44 %, 16.06 | 28, −0.09, −0.36, 39 %, 9.97 | 279, +0.02, 0.31, 44 %, 14.20 | −0.12 | −0.43 | 0.666 | | | | | (information) |
| gmp | validation | 206, +0.17, 1.88, 48 %, 7.80 | 25, −0.27, −1.39, 36 %, 8.30 | 181, +0.23, 2.35, 49 %, 6.09 | −0.50 | −2.29 | 0.986 | 1.000 | no | no | 0.53 / 0.79 | rejected |
| nq-open | discovery | 206, +0.05, 0.46, 39 %, 16.29 | 24, +0.72, 2.97, 71 %, 2.04 | 182, −0.04, −0.37, 35 %, 19.31 | +0.76 | 2.85 | 0.004 | | | | | (information) |
| nq-open | validation | 138, +0.44, 3.02, 50 %, 8.55 | 29, +0.49, 1.59, 52 %, 4.11 | 109, +0.42, 2.57, 50 %, 6.63 | +0.07 | 0.20 | 0.419 | 1.000 | yes | yes | 0.62 / 0.93 | inconclusive |
| pooled | discovery | 883, +0.22, 3.03, 39 %, 32.45 | 152, +0.26, 1.46, 38 %, 14.91 | 731, +0.21, 2.67, 39 %, 36.90 | −0.13 (plain net R +0.05) | −0.67 (plain 0.26) | 0.750 | | | | | (information) |
| pooled | validation | 593, +0.30, 3.94, 44 %, 21.45 | 168, +0.43, 2.28, 42 %, 18.55 | 425, +0.25, 3.28, 45 %, 9.90 | −0.02 (plain net R +0.18) | −0.11 (plain 0.91) | 0.546 | 1.000 | no | yes | 0.39 / 0.58 | rejected |

C1's table is the mechanical baseline repeated (every take-set equals "every setup"); it is in `result.json`.

## 5. Power

| Scope | SD of net R on discovery | Validation trades | Smallest difference at t = 2, even split | After Holm | The edge's own mean (whole train pool) |
|---|---|---|---|---|---|
| replica | 3.64 | 130 | 1.28 R | 1.90 R | +0.41 R |
| mosha-bo | 2.17 | 13 | cannot be tested | cannot be tested | +0.81 R |
| gtrend | 2.25 | 8 | cannot be tested | cannot be tested | +1.89 R |
| gtl | 1.27 | 67 | 0.62 R | 0.92 R | +0.22 R |
| geg | 2.36 | 31 | cannot be tested | cannot be tested | +0.47 R |
| gmp | 1.24 | 206 | 0.35 R | 0.51 R | +0.07 R |
| nq-open | 1.49 | 138 | 0.51 R | 0.76 R | +0.20 R |
| pooled | 2.14 | 593 | 0.35 R | 0.52 R | +0.25 R |

The pre-registration gave these figures in advance from published whole-train numbers (0.35 R to 1.1 R); the
discovery SDs give the same picture. mosha-bo, gtrend and geg cannot be tested at all on a 40 % validation part. On
the four edges that can, a candidate must separate takes from waits by about 2.5 to 5 times the edge's average trade to reach
t = 2, and by about half as much again after the correction.

## 6. The exam pool

**Read zero times.** No candidate passed validation, so the rule of the pre-registration (section 6) never allowed a
read. The study's loader keeps an outcome only when it belongs to a usable train setup; the test replaces every exam
and flagged outcome with wild values and gets `result.json` back byte for byte.

Earlier uses of exam outcomes found in the code (none of them this study's, none used to tune anything): the trained
scorers' one-off exam block in `ml/train.py`; the mechanical "usable" figures of `docs/academy/DATA-CLOCK.md`, which
cover both pools; and thirteen setups scored one at a time through the page's "Test on new setups" in temporary stores
(3 gmp in the page audit's fixture, 10 nq-open in the lead's live walk). They are listed in the ledger as prior uses.

## 7. What changes

- **Shipped behaviour: nothing.** `MXA.decide` and `policy-1.0` are untouched. No `policy-1.1` exists.
- `academy/data/eval.json` gains `drawdown` per edge and overall (mechanical, take-set, wait-set); every existing field
  and the version hash are unchanged. `academy/data/eval-trades.json` lists the policy's action on each train setup
  with no outcome field, so the take-set's figures can be recomputed by anyone.

For the owner to decide (nothing here was done):

1. **Read the policy as a tutor's baseline, not as a filter.** It has no measurable selection value on any edge, and
   the data cannot rule out that it costs something on gmp. The honest default for someone trading these edges is the
   mechanical one; the policy's waits are the mentor's raw material, which is what the Academy says already.
2. **The 10R cap is read as a target.** That makes two votes constants. Treating a cap as "no fixed target" would be
   a policy change that alters decisions, so it needs its own pre-registration; it was noticed after this run and is
   deliberately not among the five candidates. C3 removed the contradiction half on gmp only, and was rejected.
3. **More data is the only route to a verdict on modest effects.** The edges produce from about 5 usable trades a
   year (gtrend, mosha-bo) to about 100 (gmp). Lessons from the mentor can still be judged setup by setup on the exam pool.

## 8. Limits

- **Prior knowledge.** The author had read `eval.json` (whole train pool, validation period included) before writing
  the candidates, so validation is clean with respect to the candidates, not with respect to what was known about
  `policy-1.0`. C3 and C5 were shaped by that knowledge. Both failed anyway.
- **One cut in time.** Discovery and validation are one split, not a walk-forward. The edges' own means moved between
  the parts (replica +0.62 to +0.08 R, nq-open +0.05 to +0.44 R), so the parts differ in more than time.
- **Validation decisions lean on discovery trades** as "similar past cases", as the page does. No outcome reaches a
  decision before its trade has finished.
- **Overlapping votes and scopes.** The pooled scope contains the edges; votes share trades. The Holm correction is
  conservative here, and the result does not depend on it: no test reaches t = 2 before any correction.
- **Research candles.** HistData, "usable" not "certified", 2023 thin; weeks nobody could verify are left out
  (`docs/academy/DATA-CLOCK.md`). gmp is the robustness study's port of a system that is on test live.
- **No lessons, no model.** This is the policy alone. What a mentor's lessons add is a separate question, answered on
  the exam pool one setup at a time.

## 9. Reproduce

```sh
ACADEMY_CANDLES=<folder outside the repo> node academy/gen/evaluate.mjs                  # eval.json, eval-trades.json
ACADEMY_CANDLES=<folder outside the repo> node research/edge/academy-policy/walk.mjs     # decisions.json (no outcomes)
node research/edge/academy-policy/run.mjs --md                                           # result.json and these tables
node --test tests/academy-policy.test.mjs
```

The code was committed before its first run. After that run only display fields were added (the plain net R
difference beside the pooled one, a t hidden under 10 trades, the direction line of H3); every verdict and every
figure of the first run is unchanged.

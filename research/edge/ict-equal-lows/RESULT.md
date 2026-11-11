# ICT A-setups: does it matter what the sweep took? Relative equal lows / highs vs a single low (pre-registered)

**Verdict: FAIL. A-setups whose sweep took relative equal lows / highs made +0.092R a trade net out of sample (n 107, t 0.72) against +0.138R for the other A-setups (n 579, t 2.07): difference −0.046R, t −0.32.** In sample they made −0.007R (n 172) against +0.092R (n 873). None of the three pre-registered tests passes (all five markets, the index book, gold; Holm-adjusted p 1.00 for each). The index book fails the same way; gold is one trade short of the sample-size line and shows no difference (+0.029R, t 0.09). The A-rule stays as it is. No proposal is made, and no file of the ICT desk changed.

The skill calls engineered liquidity (equal highs and lows) the preferred pool to see swept before an iFVG entry. On the desk's own mechanical H1 model, 2020 to October 2026, that preference does not show up in the results. If anything the lone-swing sweeps did a little better, but that difference is not significant either (in sample t −0.74), so this is a null result, not a reason to skip equal-pool sweeps.

## How it was run

- **Pre-registration first.** `PREREGISTRATION.md`, the detector `eq.mjs` and the runner `run.mjs` were committed and pushed
  (83f20407) after the candle download and the runner's `count` stage (signal counts only, no trade simulated), and before the
  `full` stage ran. The test ran once. Nothing was changed after it. Plan sha256 `fb3e0f34…ac1c` is in `result.json`.
  One label was reworded after the run (the `system` text in `result.json`, so the research ledger files the study under the
  ICT desk only); the runner was run again on the same candles and every number came out identical.
- **Why this concept.** The pre-registration lists every concept of the skill against the fourteen earlier ICT studies. What
  the signal swept (an equal pool or one swing) was the one concept the skill itself puts first (§1, §9.1, §13) that had never
  been computed for a signal. `ict-concepts` traded equal lows as a different entry without the iFVG; skill §28 looked at
  equal highs as a target.
- **Definition.** At the signal's sweep candle, on H1 candles at or before it: two or more confirmed swing lows (3 candles
  each side, the last 96 candles, at least 4 candles apart), each untouched until then, each traded through by that candle,
  with lows within 0.1 x the daily ATR(14) of each other. Sells mirror. About one A-setup in six qualifies.
- **Engine.** The research lab's `runMarket` (`api/_ictlab.js`): the desk's own `signals()`, `isASetup()`, `sizeOf()`
  (`ict/tracker.mjs`) and `simulate()` (`ict/replay.mjs`), imported and never edited. Live exit, live sizing, one open trade
  per market per stream. Every trade keeps the engine's own stop.
- **Streams.** Unfiltered = every A-setup. Equal pool = A-setups whose sweep took an equal pool. Others = the rest. Each is
  its own one-open stream.
- **Data.** OANDA mid H1 through the site's keyless candle proxy: NAS100, SPX500, US30, US2000 (for NQ, ES, YM, RTY) and
  XAU (for GC), 2 Jun 2019 to 9 Nov 2026, about 43,900 candles a market, cleaned as the lab does. OANDA times are UTC. No
  trade was left unresolved and none was dropped for a data hole.
- **Window.** Signals 1 Jan 2020 to 31 Oct 2026. In sample 2020-23, out of sample 2024 on.
- **Costs.** The lab's round trip: NQ 1.5, ES 0.5, YM 3, RTY 0.4 points, gold 0.5. All R below is net and sized as live.

## The three tests

| test | stream | IS n | IS R a trade | IS t | OOS n | OOS win | OOS R a trade | OOS total | OOS max DD | OOS t | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 all five markets | unfiltered | 1,028 | +0.084 | 1.73 | 679 | 40% | +0.137 | +93.0R | 17.8R | 2.28 | baseline |
| | **equal pool** | 172 | −0.007 | −0.05 | 107 | 40% | +0.092 | +9.8R | 11.2R | 0.72 | **FAIL** |
| | others | 873 | +0.092 | 1.76 | 579 | 39% | +0.138 | +79.7R | 16.7R | 2.07 | |
| T2 index book | unfiltered | 805 | +0.058 | 1.08 | 506 | 38% | +0.117 | +59.3R | 26.9R | 1.70 | baseline |
| | **equal pool** | 123 | −0.026 | −0.18 | 78 | 37% | +0.047 | +3.7R | 11.4R | 0.33 | **FAIL** |
| | others | 692 | +0.062 | 1.09 | 434 | 38% | +0.122 | +53.2R | 24.3R | 1.60 | |
| T3 gold | unfiltered | 223 | +0.179 | 1.59 | 173 | 44% | +0.195 | +33.7R | 8.4R | 1.61 | baseline |
| | **equal pool** | 49 | +0.042 | 0.19 | 29 | 48% | +0.212 | +6.2R | 7.1R | 0.76 | **INCONCLUSIVE** |
| | others | 181 | +0.207 | 1.62 | 145 | 43% | +0.183 | +26.6R | 14.8R | 1.37 | |

Equal pool against the others (Welch, one-sided for "equal pool is better", Holm over the three tests):

| test | IS difference | IS t | OOS difference | OOS t | p | Holm p |
|---|---|---|---|---|---|---|
| T1 | −0.099R | −0.74 | −0.046R | −0.32 | 0.63 | 1.00 |
| T2 | −0.088R | −0.56 | −0.076R | −0.47 | 0.68 | 1.00 |
| T3 | −0.165R | −0.65 | +0.029R | +0.09 | 0.46 | 1.00 |

The bar, check by check:

| check | T1 | T2 | T3 |
|---|---|---|---|
| OOS n ≥ 30 | yes (107) | yes (78) | **no (29)** |
| R a trade > 0 in sample | **no** | **no** | yes |
| R a trade > 0 out of sample | yes | yes | yes |
| 2 of 3 OOS years positive | yes (2) | yes (2) | yes (3) |
| beats the unfiltered stream out of sample | **no** | **no** | yes (+0.017R) |
| beats the unfiltered stream in sample | **no** | **no** | **no** |
| Holm p < 0.05 against the others | **no** | **no** | **no** |

T3 is called inconclusive only because the bar's FAIL line is "not above the unfiltered stream out of sample" and gold's
equal-pool stream is +0.017R above it on 29 trades. It is worse in sample and the out-of-sample difference has t 0.09: there
is nothing there.

## By year (total net R, trades)

| stream | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| T1 unfiltered | +37.5 (229) | +14.6 (260) | +36.1 (272) | −1.7 (267) | +25.1 (234) | +43.2 (237) | +24.7 (208) |
| T1 equal pool | −5.6 (32) | −11.6 (47) | +10.3 (40) | +5.7 (53) | +6.1 (39) | −5.8 (31) | +9.4 (37) |
| T1 others | +42.6 (199) | +26.6 (219) | +20.9 (237) | −9.7 (218) | +18.5 (196) | +48.4 (207) | +12.8 (176) |
| T2 equal pool | −0.7 (23) | −9.6 (33) | +8.6 (27) | −1.4 (40) | +5.9 (28) | −6.8 (21) | +4.6 (29) |
| T3 equal pool | −4.9 (9) | −1.9 (14) | +1.7 (13) | +7.2 (13) | +0.3 (11) | +1.1 (10) | +4.8 (8) |

The equal-pool stream is positive in 4 of 7 years, the others in 6 of 7. The sign of the difference changes from year to year.

## By market (net R a trade, trades): unfiltered | equal pool | others

| market | IS | OOS |
|---|---|---|
| NQ | +0.151 (207) \| +0.191 (34) \| +0.123 (177) | +0.225 (121) \| +0.058 (19) \| +0.260 (103) |
| ES | 0.000 (197) \| +0.098 (36) \| −0.027 (162) | +0.181 (134) \| +0.110 (22) \| +0.194 (113) |
| YM | +0.156 (206) \| +0.041 (25) \| +0.158 (184) | +0.028 (120) \| −0.235 (14) \| +0.048 (107) |
| RTY | −0.085 (195) \| −0.508 (28) \| −0.020 (169) | +0.035 (131) \| +0.148 (23) \| −0.006 (111) |
| GC | +0.179 (223) \| +0.042 (49) \| +0.207 (181) | +0.195 (173) \| +0.212 (29) \| +0.183 (145) |

No market shows the equal pool ahead in both windows.

## Reported, not judged

- **Other tolerances**, all five markets. 0.05 x ATR: equal pool −0.075R in sample (128), +0.170R out of sample (79); others
  +0.100R and +0.129R; out-of-sample difference +0.042R, t 0.25. 0.2 x ATR: equal pool −0.013R (193) and +0.062R (120);
  others +0.093R and +0.142R; difference −0.080R, t −0.57. Tighter or looser, the answer is the same: no difference that
  holds in both windows.
- **Inside the unfiltered stream's own trades** (the same trades, tagged; per unit, no sizing): equal pool −0.021R in sample
  (162, t −0.15) and +0.100R out of sample (106, t 0.71); others +0.129R (866, t 2.31) and +0.109R (573, t 1.68).
- **Before costs**, out of sample: unfiltered +0.155R, equal pool +0.109R a trade.

## What to conclude, and what not to

- **Do not add "equal lows / highs swept" as a filter, a grade point or a size-up** on this mechanical H1 model. It did not
  help in either window, on either book.
- **Do not read it as "equal pools are bad".** The lone-swing sweeps were ahead by 0.05-0.10R a trade, with t under 1 in
  both windows. That is noise at this sample size.
- **It says nothing about a trader choosing an obvious pool by eye.** The detector calls two H1 swing lows within a tenth of
  a daily range "equal". The skill's equal highs and lows are a chart reading, often on M15 or M5, and about a clean double
  top or bottom. Fred's own review tag "REH/REL" on the desk is the measurement for that; this study cannot stand in for it.
- **The baseline here is not new evidence for the A-rule.** The unfiltered stream (+0.137R a trade out of sample, t 2.28;
  +0.084R in sample, t 1.73) was fitted on part of these years, as the rule book says (§19), and `ict-oos-2008` found it
  does not carry back to 2008-17.
- OANDA cash CFDs stand in for the futures the desk trades; H1 swings on the two feeds differ (skill §19).

## Next-best untested concepts (for a later study, each with its own pre-registration)

1. **NWOG / NDOG as the key level the sweep runs into** (skill §4: "buy at a discount key level: FVG, order block, NWOG /
   NDOG"). Only the gap FILL was tested, as an entry. It needs futures candles with the real 17:00-18:00 and weekend gaps;
   the cash CFDs here open differently, which is why it was not chosen now.
2. **Quarter of the month and of the year** (skill §10: accumulation, manipulation, distribution by week of the month).
   Cheap to compute, but four cells on about 1,700 trades is thin, and `ict-sessions` found the model's timing effects flip
   between regimes, so the prior is low.

## Files

`PREREGISTRATION.md` (the concept table, the definition, the bar), `eq.mjs` (the detector, pure), `run.mjs` (stages `fetch`,
`count`, `full`; candles are cached outside git), `result.json`. Test: `tests/desk-ict-equal-lows.test.mjs`. To repeat:
`node --use-env-proxy research/edge/ict-equal-lows/run.mjs fetch <dir> && node research/edge/ict-equal-lows/run.mjs full <dir>`
(later candles extend the last days only; the window ends 31 Oct 2026).

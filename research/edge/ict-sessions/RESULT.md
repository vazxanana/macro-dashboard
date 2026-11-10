# When does the ICT A-setup edge live? Session, opening hours, weekday, post-halt (pre-registered)

> **Clock correction, 10 Nov 2026.** NOT RE-RUN: the published numbers were computed on the old candle clock for the HistData part. Details: the last section of this page.

**Verdict: nothing passes. All four hypotheses FAIL the pre-registered bar; no shadow variant is added and no code outside this
folder changes.** The timing of the edge is not stable across regimes: the cells that lost on 2008-17 are the cells that won on
2018-26, and vice versa. Over the 12 cells with n ≥ 100 in the selection window, the 2008-17 and 2018-26 cell means agree in
sign in only 4, and their rank correlation is **−0.55**. The two 2018-26 vendors agree with each other (sign in 10 of 12,
rank correlation +0.58), so the flip is not noise in one data set. "When" the rule works changed with the regime, like
whether it works at all (`research/edge/ict-oos-2008`).

| hypothesis | 2008-17 picked (drop → keep) | OANDA 2018-21 | OANDA 2022-26 | HistData 2018-21 | HistData 2022-26 | live replay | verdict |
|---|---|---|---|---|---|---|---|
| H1 session | drop London + NY AM → keep Asia + NY PM (35% of trades) | kept −0.086 vs full +0.057; dropped **+0.136** | kept +0.146 vs full +0.122; dropped +0.109 | kept −0.174 vs +0.010; dropped +0.127 | kept +0.227 vs +0.152; dropped +0.104 | kept +0.527 vs +0.246; dropped +0.079 | **FAIL** (dropped set positive everywhere) |
| H2 opening hours | drop first2 (closes 10, 11 ET) → keep rest (80%) | kept +0.051 vs +0.057; dropped +0.081 | kept +0.124 vs +0.122; dropped +0.113 | kept +0.023 vs +0.010; dropped −0.037 | kept +0.179 vs +0.152; dropped +0.052 | kept +0.221 vs +0.246; dropped **+0.345** | **FAIL** (1 of 5 windows) |
| H3 weekday | drop Tue + Thu → keep Sun/Mon/Wed/Fri (57%) | kept −0.029 vs +0.057; dropped **+0.169** | kept +0.117 vs +0.122; dropped +0.128 | kept −0.087 vs +0.010; dropped +0.146 | kept +0.112 vs +0.152; dropped +0.207 | kept +0.230 vs +0.246; dropped +0.267 | **FAIL** (0 of 5) |
| H4 post-halt | the only positive 2008-17 cell was post-halt itself → drop rest, keep post-halt (4%) | kept −0.118 vs +0.057 | kept −0.208 vs +0.122 | kept +0.106 vs +0.010 | kept −0.286 vs +0.152 | kept +0.490 vs +0.246 (n 17) | **FAIL** (0 of 5) |

Net R a trade at costs x1 (OANDA, HistData); the desk's own R on the replay. "full" = the whole A-setup stream of that window.
The bar for a pass was: kept beats full **and** dropped mean ≤ 0 with n ≥ 30, in every one of the five windows.

## How it was run

- **Pre-registration first.** `preregistration.md` was committed and pushed (2ba6e060) before any hour, weekday or session cell
  of the 2018-26 or replay trades was computed. The four hypotheses, the cell boundaries, the mechanical selection rule, the
  windows and the bar are all in it. The test ran once (`run.mjs`); nothing was changed after.
- **Trade histories, reused, not rebuilt differently.**
  - OANDA 2008-26 (4 markets: GC, NQ, ES, YM stand-ins): the unchanged `research/edge/ict-oos-2008/run.mjs` over that study's
    OANDA 5m cache (scratchpad, not in git). 4,106 A-setups 2007-06 .. 2026-10; 2,235 in 2008-17, 1,786 in 2018-26, the same
    counts and the same pooled figures as #526 (−0.013R and +0.093R a trade).
  - HistData 2018-26 (`research/edge/ict-universe`, GC under the gold rule, NAS100 and SPX under the index rule): 1,324 A-setups.
  - Live replay: council-data `ict/replay.json` fetched 7 Nov 2026 21:16 UTC, 251 closed A-setups since 1 Aug 2025 on NQ, ES,
    YM, RTY, GC (+61.9R, +0.246R a trade, the desk's own stat).
- **Time of a trade** = the close of its signal H1 candle, converted with the tracker's own New York clock (Intl,
  `America/New_York`, DST-aware). H1 candles close on the UTC hour, so the New York hour is an integer; no candle closes at
  18:00 ET (the 17:00 halt hour is dropped by the feed).
- **Cells.** H1: Asia (closes 19:00-02:00 ET), London (03:00-09:00), NY AM (10:00, 11:00, 12:00 = the candles inside the
  09:30-12:00 cash morning), NY PM (13:00-17:00). H2: first2 = closes at 10:00 and 11:00 (the two H1 closes inside the first two
  cash hours) vs rest. H3: New York calendar weekday of the close (Sun = the Sunday 18:00 reopen). H4: post-halt = closes at
  19:00 and 20:00 (the first two candles after the 18:00 reopen) vs rest.
- **Selection (2008-17 only):** drop every cell with mean net R < 0 and n ≥ 100; keep the rest; a candidate only if that makes the
  kept set beat the full stream in 2008-17. All four hypotheses produced a candidate.
- **Costs** as the source studies (OANDA: GC 0.50; NQ/ES 0.02% + 0.25; YM 0.02% + 1 per round trip; HistData: ict-universe's).
  Net R = size × (R − cost/risk). Costs x2 and gross are in `result.json`.

## The cells, every window (n / net R a trade / t)

### H1: session of entry

| cell | 2008-17 (selection) | OANDA 2018-21 | OANDA 2022-26 | HistData 2018-21 | HistData 2022-26 | replay |
|---|---|---|---|---|---|---|
| Asia | 364 / +0.082 / 1.04 | 155 / +0.070 / 0.60 | 158 / +0.141 / 0.97 | 116 / −0.055 / −0.47 | 121 / +0.115 / 0.76 | 51 / **+0.561** / 2.04 |
| London | 870 / −0.032 / −0.64 | 312 / **+0.158** / 1.74 | 355 / +0.096 / 1.12 | 207 / **+0.203** / 1.73 | 228 / +0.139 / 1.30 | 84 / −0.079 / −0.50 |
| NY AM | 562 / **−0.087** / −1.81 | 204 / +0.102 / 1.15 | 286 / +0.125 / 1.43 | 171 / +0.036 / 0.33 | 203 / +0.064 / 0.54 | 73 / +0.260 / 1.91 |
| NY PM | 439 / +0.041 / 0.68 | 132 / **−0.269** / −2.84 | 184 / +0.150 / 1.34 | 124 / **−0.285** / −3.32 | 154 / **+0.315** / 2.63 | 43 / +0.486 / 1.75 |

- 2008-17 said: London and the cash morning lose, Asia and the afternoon win. 2018-26 said the opposite for London (the best
  session on both vendors, t 2.0 / 2.1 pooled) and for NY AM.
- NY PM is the clearest regime story: strongly negative in 2018-21 on both vendors (t −2.8 / −3.3), strongly positive in
  2022-26 on both (t 1.3 / 2.6), positive on the replay. `research/edge/ict-filters` already found that "NY PM is negative"
  did not survive out of sample; this shows why. (The tracker's A+ tier excludes NY PM on the indices; that exclusion was
  built on 2023-26 data and is not touched by this study.)

### H2: first two cash hours vs rest

| cell | 2008-17 | OANDA 2018-21 | OANDA 2022-26 | HistData 2018-21 | HistData 2022-26 | replay |
|---|---|---|---|---|---|---|
| first2 (closes 10, 11 ET) | 426 / **−0.141** / −2.64 | 148 / +0.081 / 0.76 | 217 / +0.113 / 1.19 | 127 / −0.037 / −0.29 | 151 / +0.052 / 0.38 | 52 / **+0.345** / 2.10 |
| rest | 1,809 / +0.017 / 0.52 | 655 / +0.051 / 0.90 | 766 / +0.124 / 2.09 | 491 / +0.023 / 0.35 | 555 / +0.179 / 2.64 | 199 / +0.221 / 1.87 |

- The opening hours were the worst cell of the whole study on 2008-17 (t −2.6) and are about equal to the rest on 2018-26
  (OANDA +0.100 vs +0.091) and the best part of the live replay. Dropping them passes only HistData 2018-21 (1 window of 5).
- Per market 2018-26 (OANDA): GC first2 +0.147 vs rest +0.150; NQ +0.123 vs +0.096; ES −0.065 vs +0.068; YM +0.199 vs +0.030.
  No consistent direction.

### H3: New York weekday

| cell | 2008-17 | OANDA 2018-21 | OANDA 2022-26 | HistData 2018-21 | HistData 2022-26 | replay |
|---|---|---|---|---|---|---|
| Sun | 70 / +0.188 / 0.93 | 31 / −0.102 / −0.40 | 32 / +0.841 / 1.61 | 24 / +0.193 / 0.58 | 28 / +0.200 / 0.45 | 13 / +0.068 / 0.24 |
| Mon | 433 / +0.023 / 0.34 | 128 / +0.203 / 1.71 | 179 / +0.045 / 0.45 | 105 / −0.017 / −0.16 | 125 / +0.009 / 0.07 | 37 / +0.118 / 0.56 |
| Tue | 457 / −0.044 / −0.72 | 174 / +0.078 / 0.73 | 208 / **+0.228** / 2.26 | 129 / +0.088 / 0.66 | 137 / **+0.352** / 2.44 | 57 / +0.121 / 0.73 |
| Wed | 473 / +0.002 / 0.03 | 194 / −0.058 / −0.62 | 212 / +0.095 / 0.87 | 138 / −0.034 / −0.27 | 145 / +0.228 / 1.73 | 57 / **+0.548** / 2.20 |
| Thu | 452 / **−0.129** / −2.19 | 173 / **+0.261** / 2.05 | 210 / +0.029 / 0.24 | 129 / +0.205 / 1.43 | 160 / +0.082 / 0.63 | 55 / +0.418 / 1.60 |
| Fri | 350 / +0.074 / 0.97 | 103 / **−0.241** / −1.96 | 142 / +0.079 / 0.66 | 93 / **−0.317** / −2.95 | 111 / +0.055 / 0.38 | 32 / −0.140 / −0.67 |

- Thursday: the worst weekday of 2008-17 (t −2.2) and the best of OANDA 2018-21 (t +2.1). Tuesday: negative 2008-17, the best
  weekday of 2022-26 on both vendors.
- **Friday, the `nofri` variant's basis:** negative in 2018-21 on both vendors (t −2.0 / −3.0), roughly flat in 2022-26
  (+0.079 / +0.055), negative on the replay (n 32), but **positive on 2008-17 (+0.074, n 350)**. The Friday effect behind
  `nofri` does not exist in the ten years before 2018. `nofri` stays what it is, a paper shadow stream; this is one more reason
  not to promote it.

### H4: post-halt (closes 19:00, 20:00 ET) vs rest

| cell | 2008-17 | OANDA 2018-21 | OANDA 2022-26 | HistData 2018-21 | HistData 2022-26 | replay |
|---|---|---|---|---|---|---|
| post-halt | 77 / **+0.305** / 1.54 | 39 / −0.118 / −0.58 | 37 / −0.208 / −0.87 | 23 / +0.106 / 0.37 | 30 / −0.286 / −1.42 | 17 / +0.490 / 1.28 |
| rest | 2,158 / −0.024 / −0.83 | 764 / +0.066 / 1.27 | 946 / +0.135 / 2.59 | 595 / +0.007 / 0.12 | 676 / +0.171 / 2.73 | 234 / +0.229 / 2.22 |

- The hypothesis was that post-halt signals are thin-market noise. On 2008-17 they were the only positive cell (small n, t 1.5),
  so the mechanical rule produced the candidate "take only post-halt signals" (4% of the stream), which then lost in 3 of the 4
  2018-26 halves. The reverse filter ("skip post-halt") was not a pre-registered candidate; descriptively it would have kept
  96% of the trades and lifted 2018-26 OANDA from +0.093 to +0.104R a trade, within noise (Welch t 1.7 pooled, and post-halt
  was positive in HistData 2018-21 and on the replay). It is not proposed.

## The bar, every candidate, every window

| hyp | window | full n / exp | kept n / exp (t) | dropped n / exp (t) | kept share | Welch kept−dropped | kept > full | dropped ≤ 0, n ≥ 30 | pass |
|---|---|---|---|---|---|---|---|---|---|
| H1 | OANDA 2018-21 | 803 / +0.057 | 287 / −0.086 (−1.11) | 516 / +0.136 (2.09) | 36% | −2.20 | no | no | no |
| H1 | OANDA 2022-26 | 983 / +0.122 | 342 / +0.146 (1.62) | 641 / +0.109 (1.78) | 35% | 0.34 | yes | no | no |
| H1 | HistData 2018-21 | 618 / +0.010 | 240 / −0.174 (−2.42) | 378 / +0.127 (1.57) | 39% | −2.78 | no | no | no |
| H1 | HistData 2022-26 | 706 / +0.152 | 275 / +0.227 (2.41) | 431 / +0.104 (1.31) | 39% | 1.00 | yes | no | no |
| H1 | replay | 251 / +0.246 | 94 / +0.527 (2.70) | 157 / +0.079 (0.74) | 37% | 2.02 | yes | no | no |
| H2 | OANDA 2018-21 | 803 / +0.057 | 655 / +0.051 (0.90) | 148 / +0.081 (0.76) | 82% | −0.25 | no | no | no |
| H2 | OANDA 2022-26 | 983 / +0.122 | 766 / +0.124 (2.09) | 217 / +0.113 (1.19) | 78% | 0.10 | yes | no | no |
| H2 | HistData 2018-21 | 618 / +0.010 | 491 / +0.023 (0.35) | 127 / −0.037 (−0.29) | 79% | 0.43 | yes | yes | **yes** |
| H2 | HistData 2022-26 | 706 / +0.152 | 555 / +0.179 (2.64) | 151 / +0.052 (0.38) | 79% | 0.83 | yes | no | no |
| H2 | replay | 251 / +0.246 | 199 / +0.221 (1.87) | 52 / +0.345 (2.10) | 79% | −0.61 | no | no | no |
| H3 | OANDA 2018-21 | 803 / +0.057 | 456 / −0.029 (−0.47) | 347 / +0.169 (2.05) | 57% | −1.92 | no | no | no |
| H3 | OANDA 2022-26 | 983 / +0.122 | 565 / +0.117 (1.76) | 418 / +0.128 (1.63) | 57% | −0.11 | no | no | no |
| H3 | HistData 2018-21 | 618 / +0.010 | 360 / −0.087 (−1.27) | 258 / +0.146 (1.50) | 58% | −1.95 | no | no | no |
| H3 | HistData 2022-26 | 706 / +0.152 | 409 / +0.112 (1.44) | 297 / +0.207 (2.12) | 58% | −0.76 | no | no | no |
| H3 | replay | 251 / +0.246 | 139 / +0.230 (1.77) | 112 / +0.267 (1.73) | 55% | −0.18 | no | no | no |
| H4 | OANDA 2018-21 | 803 / +0.057 | 39 / −0.118 (−0.58) | 764 / +0.066 (1.27) | 5% | −0.88 | no | no | no |
| H4 | OANDA 2022-26 | 983 / +0.122 | 37 / −0.208 (−0.87) | 946 / +0.135 (2.59) | 4% | −1.40 | no | no | no |
| H4 | HistData 2018-21 | 618 / +0.010 | 23 / +0.106 (0.37) | 595 / +0.007 (0.12) | 4% | 0.34 | yes | no | no |
| H4 | HistData 2022-26 | 706 / +0.152 | 30 / −0.286 (−1.42) | 676 / +0.171 (2.73) | 4% | −2.17 | no | no | no |
| H4 | replay | 251 / +0.246 | 17 / +0.490 (1.28) | 234 / +0.229 (2.22) | 7% | 0.66 | yes | no | no |

One window of twenty meets the bar (H2 on HistData 2018-21, where the dropped set is −0.037R on 127 trades, t −0.3). One
hit in twenty window-tests is what noise gives. **No candidate passes a single data set in both halves.**

## Honest reading

- **The desk's timing is not a stable property of the rule.** The 2008-17 timing map is the mirror image of the 2018-26 one
  (rank correlation −0.55 across the 12 big cells), while OANDA and HistData 2018-26 agree with each other (+0.58). A session or
  weekday filter chosen on one regime would have been wrong in the next. This is the same lesson as #526, #530 and #541, one
  level down: not only *whether* the A-setups work changes with the regime, but also *when*.
- **The live replay's strongest cells (Asia +0.56, NY PM +0.49, Wednesday +0.55, first two cash hours +0.35, all n 43-57)**
  are the kind of 15-month, 50-trade cells that this study was designed to stop us acting on. Asia and NY PM were negative on
  HistData 2018-21; the first two hours were the worst cell of 2008-17.
- **For `nofri`:** its Friday effect is a 2018-21 effect (both vendors, t −2 to −3), absent in 2008-17 and faint in 2022-26.
  Treat the shadow stream as a forward test of a regime-specific pattern, nothing more.
- **Implications.** No session, hour or weekday filter is proposed, as a shadow or otherwise. Do not size any part of the
  desk's clock up or down on replay cells. Keep the desk at its current small size as a forward test. No live rule, config,
  tracker or replay code changed; nothing outside `research/edge/ict-sessions/` changed.

## Multiple testing

- Four pre-registered hypotheses, one mechanical selection each, judged once on five windows. All four fail.
- The rank correlations, the "skip post-halt" reverse filter and the per-market lines are descriptive, found after the
  verdict, and are not proposals.
- Prior knowledge disclosed in the pre-registration: the tracker-labelled "NY AM" (08-12 ET) cell of #526 (−0.131R on 2008-17,
  +0.085R on 2018-26) had been seen; the `ict-filters` session findings (NY PM claim did not survive; London unstable) were known.
  The cells here use the cash-open definition and the selection was mechanical, but H1 was not blind to that one cell.

## Files

- `preregistration.md`: hypotheses, cells, selection rule, windows and bar, committed before the run (2ba6e060).
- `run.mjs`: loads the three trade files (A-setups only), stamps each trade with its New York hour and weekday, applies the
  selection on 2008-17, judges the bar on the five windows, writes `result.json` and prints the tables above.
- `result.json`: every cell in every window (net x1, net x2, gross: n, win rate, mean, total R, max drawdown, worst streak, t),
  the selection, the bar per window with Welch t and kept share, per-market kept/dropped for OANDA and HistData 2018-26, and
  the verdicts.

Re-run (the first two inputs are the unchanged outputs of the source studies; the candle caches are not in git):

```
node research/edge/ict-oos-2008/run.mjs <oanda cache> <oanda>/trades.json
node research/edge/ict-universe/universe.mjs ...  -> <histdata>/trades.json      (as in ict-universe/RESULT.md)
curl -o replay.json https://meridianx.dev/cdata/ict/replay.json
node research/edge/ict-sessions/run.mjs <oanda>/trades.json <histdata>/trades.json replay.json research/edge/ict-sessions/result.json
```

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`. This study used the documented "EST, no daylight saving" reading (label + 5 hours all year), which is one hour late for the whole of Europe's summer, about seven months a year.

**Not re-run: computed on the old clock.** Reason: the result also rests on an OANDA trade file and the desk replay, and today's caches do not reproduce the first run's inputs (4,098 OANDA A-setups against 4,106; 254 replay trades against 251), so a fresh `result.json` would mix the clock with other changes. What was checked: `run.mjs` was run twice on today's inputs, once with the HistData trades of the old loader and once with the corrected ones. **None of its 32 verdict fields differs between the two.** The HistData trades themselves are in the ict-universe re-run.

# Parameter-drift audit: does the live code run what the studies tested?

Paper research only. No live rule was changed; the two code changes below are display/label bugs and comments.

**Question.** For every LIVE system, list the exact parameters the live code runs today (`council/trader.mjs`, `ict/tracker.mjs` and the council-data `config.json` of 7 Nov 2026 22:10 UTC) next to the parameters each out-of-sample study tested, and flag every drift: a live value that differs from the tested one, a filter the study did not include, a cost model that differs, or a data feed that differs.

**Verdict: the live parameters of all seven systems equal the tested ones. The four pre-registered / untouched-data studies (#512 replica, #530 gold systems, #511 NQ, #526 ICT) tested the CURRENT live combination, so their verdicts stand. Three bugs were found, none in a trading rule: the page showed the replica's retired 1.5% gate, the Mosha weekly-structure fallback was labelled PAXG under the OANDA feed, and three comments described retired rules. One live system, Mosha BO, has never been tested on untouched data in its current form; that study must be run before its forward record is read as evidence.**

What "live" means here: `replicaLive ['xau']`, `moshaBo`, `goldTrend` (N20), `goldEG`, `goldTL`, the NQ `nyflip` block (`NQ_ON.nyflip`), and the ICT A-setups. Shadow since 7 Nov (owner): gold trend fast (N5), crypto trend, Scalp, Swing; `gmp` is a test stream. The live `config.json` carries exactly the values the `USER_RULES` chain produces (checked field by field); no Coach knob touches these systems (`be`, `newsGuard`, `buf`, `minRisk`, `filters` apply to the engine setups only, and the replica, Mosha and the daily systems carry `noBe`).

## The table

Live = `council/trader.mjs` on `main` (32720e31) + council-data `config.json`. Tested = the study's harness (its `replay.mjs` / `lib.mjs` / `run.mjs` and the RESULT). Effect = what the drift does to the study's verdict.

### Gold replica (live on XAU only) vs #512 `research/edge/replica-oos` (OANDA 2017–22, FAIL)

| system | parameter | live | tested (#512) | drift? | effect |
|---|---|---|---|---|---|
| replica | signal code | `replicaSignals`, `platformEngulfs`, `goldLevels`, `h1EgZones`, `msnrDirection` in trader.mjs | copied verbatim at run time (`gold-systems/live.mjs`) | no | – |
| replica | v5 filter | `(h1clear \|\| star) && riskAtr >= 1 && h4 === 'against'`, msAnalyze N=6 on 720-candle windows (last one forming) | same, 720-candle windows rebuilt per decision | no | – |
| replica | stop | `max(0.1·ATR15, 0.30)` past the extreme; round-number rule: within $2 of a $10 level → $0.50 past it | same | no | – |
| replica | direction | `goldD1With true`, `goldEgBarrier false`; D1 label = OANDA 720 D1, msAnalyze 6 | D1 with, EG exception off, same window | no | – |
| replica | volatility gate | `goldVolMin null`, `goldVolPct 80`: 20-day mean range/close ≥ 80th pct of `ser.slice(-367, -2)` (≥ 200 points) | identical code (`CFG.volPct 80`, `-367, -2`) | no | – |
| replica | entry filters | news veto 505–525 min ET weekdays; `lag = now − tc − 300 > 480` skipped | same | no | – |
| replica | risk rules | cap 3 open (adds excluded); day stop −1.5R (UTC day); half size when equity < 50-trade average, history seeded from `research/replay-2w.json` | same; equity history starts empty in 2017 | minor | documented departure in #512; sizing only |
| replica | size tilt | `replicaMsnrSize {against 1.5, with 0.5}`, `msnrDirection(H4 closed, D1 closed, 5, 2)` | same | no | – |
| replica | exits | `beAt 2`; add at +1.5R size 1 (stop at first entry, trail re-expressed); run `trail [4, 1]`, `t1` 10R; 48 h | same (`beR 2, add 1.5, run {4,1}, maxHold 48 h`) | no | – |
| replica | `goldFixedR 4` | set in config, but overridden by the `goldRun` spread (t1 10R, trail [4,1]) — a dead knob | not modelled (behaviour modelled) | no (behaviour) | none; it only steers the note text. Left as is: removing it would change the note branch |
| replica | entry timing | market at the last 1-min close, ~4 min after the M5 close | M5 close of the decision candle, ~1 min later | declared | reproduces in sample (+0.58 vs +0.62) |
| replica | data feed | OANDA (since 7 Nov 16:01 UTC); **fallback: Kraken PAXG + spot basis for every TF if one OANDA TF fails** | OANDA only | **feed** | the fallback path is untested; live gold ran on Kraken+basis until 7 Nov (the 2 closed live replica trades and the pending `geg` order are Kraken-priced: entry 3979.36 vs 3971.36 on OANDA) |
| replica | cost model | live record is raw R; `Rnet` = `fills.mjs` spread 0.30 + ½ spread slippage on market entry and non-target exits (~0.60/unit) | x1 0.30 (the council replay's), "fills" ≈ 0.60 and x2 0.60 all reported | no | all three columns in #512; the verdict holds at each |
| replica | rule set tested = today's? | last replica change: `gold-add-1.5` (6 Nov 12:31) and `replica-msnr-size` (6 Nov 09:30) | run 6–7 Nov on the 7 Nov config (RESULT "Live config as of 7 Nov 2026") | **no drift** | #512 tested the CURRENT combination (gate 80, D1-with, no EG, BE 2, add 1.5, run 4/1, tilt). Not pre-registered (no `preregistration.md`); the verdict is a FAIL, so there was no pass to protect |

### Mosha BO (live) vs the claims and `research/edge/gold-systems` (HistData 2018–26) — **no untouched-data test exists**

| system | parameter | live | tested | drift? | effect |
|---|---|---|---|---|---|
| mosha-bo | chain | H4 BO d → H1 BO −d after it → M15 BO d (newest, ≤ 1 h old); events from msAnalyze N=6 on 720-candle windows; limit at the M15 level; stop ±0.3 past the M15 Origin; `r0 > 0.5`; valid 24 h; out 72 h | `gold-systems/mosha.mjs` same constants, events on the full history (not 720 windows) | declared | study departure |
| mosha-bo | weekly filter | `moshaBoWeekly`: CNBC `XAU=` daily (720 d), Monday weeks, msAnalyze swing 3; **fallback = `src['1d']`, which is OANDA daily under the OANDA feed** | HistData daily (UTC weekdays) | feed | small; the comment and `snapshot.goldW1Src = 'paxg'` said PAXG — **label bug, fixed** (now `oanda`/`paxg` by feed; the page says which) |
| mosha-bo | slow rule | `moshaSlow 12`: pull < 12 H1 bars → shadow `momentum` | claim 2023–26 only; gold-systems: does not replicate (fast arrivals +0.15 / +0.47R in 2023–24 / 2025–26); OOS 2024–26 n 18 with it | **not supported** | claim rests on the data it was picked on |
| mosha-bo | cap / exits | cap 2 open+pending incl. adds; `beAt 1.5`, add 1.5 size 1, `trail [3, 1]`, t1 10R | gold-systems `live` variant: weekly + cap + slow 12 + live exits | no | – |
| mosha-bo | cost | raw R live; `fills.mjs` 0.30 + slippage | 0.30 | no | – |
| mosha-bo | untouched data | claims used 2019–26 (weekly), 2023–26 (add, slow): every window was used to pick a component | robustness audit (#486): independent rebuild +0.08 / −0.14R, weekly filter hurts | **study must be re-run** | pre-registered test of the live combination on OANDA 2006–17 (as #530), like the other gold systems |

### Gold trend N20 (+add), Gold daily engulf, Gold H4 trendline vs #530 `research/edge/gold-systems-oos` (OANDA 2006–17, pre-registered, all regime-bound)

| system | parameter | live | tested (#530) | drift? | effect |
|---|---|---|---|---|---|
| gtrend | breakout / stop | `goldTrend {n 20, k 2}`: close > max high of the prior 20 closed days, within 24 h; stop entry − 2·ATR(14); ratchet to close − 2·ATR each closed day; no target; one position | `CFG.goldTrend {20, 2}`, same block | no | – |
| gtrend | add | `goldTrendAdd {atR 1}`: at market when a closed day is ≥ +1R, same stop, exits with the first unit | same | no | – |
| gtrend5 | – | shadow since 7 Nov (`goldTrendFastShadow`) | tested as live (N5) | owner decision | not a drift |
| gtl | line / gate | `goldTL {n 3, span 120, n4 2, pad 0.3, hold 96}`; within 1 h of the H4 close; `msnrDirection(H4, D1, 2, 2) === 1`; stop lowest low since anchor b − 0.3; `trail [2, 1]`, 10R cap; 96 h | identical, `msnrDirection` copied verbatim | no | – |
| geg | zone / order | `goldEG {k 3, life 20, hold 240, sma 20, pad 0.3, maxOpen 3}`; limit at the zone high only if `price > entry`; cancel on a close under the zone low; stop zone low − 0.3; `trail [2, 1]`; 240 h | identical, incl. `price > entry` | no | – |
| all three | windows / data | 720 OANDA candles per TF, last one forming; Kraken fallback as above | 719 closed + forming, OANDA; verified to the cent against the live snapshot (hi20 4200.63, SMA 4047.51, zone 3895.57–3971.355) | feed fallback only | – |
| all three | cost | raw R live; `fills.mjs` ~0.60 | x1 0.30, x2 0.60 | no | both reported |

### NQ New York open run vs #511 `research/edge/nq-open-oos` (OANDA NAS100 2004–26, regime-dependent)

| system | parameter | live | tested (#511) | drift? | effect |
|---|---|---|---|---|---|
| nq-open nyflip | sweep | `nqOpenSweep(bars, day, 570, 0, 0.0008)`: O = 09:30 open; 09:31–10:59; run ≥ 0.08%·O; reclaim close within 900 s in the reclaim colour | `lib.mjs nqOpenSweep(D, 570, 0.0008)` | no | – |
| nq-open nyflip | stop buffer | **fixed 2 points** past the extreme (`v.ext ∓ 2`); the unused 0.011%-of-price `buf` found by the earlier audit is gone (comment at trader.mjs 1791–1794) | 2 points primary; 0.011% as a sensitivity only (2004–22 −0.060 vs −0.018R; 2023–26 +0.312 vs +0.318) | no (fixed) | the council's 2023–26 replay used the 0.011% buffer: +0.006R a trade difference |
| nq-open nyflip | flip / filter | trade WITH the run, stop mirrored at the same distance; midnight filter: 00:00 ET candle open ahead of the trade | same | no | – |
| nq-open nyflip | exits | `nqRun {2, 1}` → t1 10R, tp1 2R, trail [2, 1]; out at the open of the first candle at/after 11:00 ET (`exitAt = g.t + (660 − g.m)·60`); the candle at `checked` (fill minute) is not checked | same ("strict" variant checks it: +0.039 vs +0.038R) | no | – |
| nq-open nyflip | signal window | `ny.m > 571 && ny.m < 660`, weekdays | all days with a 09:30 candle | no | – |
| nq-open nyflip | data feed | Yahoo `NQ=F` 1m (~10 min late) → CNBC `@ND.1` fallback (front-month futures) | OANDA NAS100 CFD mid | **feed** | declared; calibrated: on 286 shared council trades +93.2R vs +93.18R |
| nq-open nyflip | cost | research record is raw R | 1 point round trip (0.5 and 2 also reported) | no | – |

### ICT A-setups vs #526 `research/edge/ict-oos-2008` (OANDA 2008–17, pre-registered, FAIL)

| system | parameter | live (`ict/tracker.mjs`) | tested (#526) | drift? | effect |
|---|---|---|---|---|---|
| ict | model | `P = {piv 3, look 96, vmax 6, rr 3, trail [2, 1.5], mark 2, holdH 36, maxAtr 8, fresh 10800, be 1.5}`; `MIN_GRADE 3` | imported from the tracker | no | by construction |
| ict | A rule | index: against the 50-day bias, grade ≥ 7, `atrR` in [0.3, 0.75) or tight A+ [0.15, 0.3) at size 0.5, not an NFP morning; DOL sizing 0.5 / 1.5 at 2R room; BE +1.5R. Gold (`aRule 'gold'`): buys, `atrR` in [0.3, 0.75), size 1, no BE | `isASetup`, `sizeOf`, `isAPlus` imported | no | – |
| ict | busy rule | one open per market; an A-setup is blocked only by an open A-setup | replay's `busyAll` / `busyA` (same logic) | no | – |
| ict | `P.rr 3` | published in `snapshot.model`, unused: `t1: null`, the exit is the trail | unused | no (dead knob) | none |
| ict | entry | tracker's price when it sees the signal (≤ 3 h after the H1 close), skipped if `r0 > 1.6·g.r0`; stop 2 ticks past the sweep | signal-candle close, `r0 = g.r0` | declared | costs study: 2-min and 10-min latency move ICT expectancy < 0.02R; the one live record has |entry − signal| = 0.008R |
| ict | NFP filter | `council/events.mjs` calendar, first-Friday fallback outside its range | first-Friday fallback (2008–17 is outside the calendar) | declared | – |
| ict | data feed | CNBC front-month futures (10 min late), Yahoo fallback; halt hour and CME closures dropped | OANDA CFD/spot mid; RTY untested (no free source) | **feed** | declared; 2018–26 on OANDA matches the HistData studies market by market |
| ict | cost | live record is gross R | GC 0.50; NQ/ES 0.02%·price + 0.25; YM 0.02%·price + 1 | no (declared) | the desk's live totals are gross; the costs study puts costs at 0.02–0.03R a trade |

## Drift found, and what was done

1. **Page showed the retired 1.5% gate (bug, fixed).** `market-structure.html` rendered the replica's volatility line as `gate ${sn.goldVolMin || 1.5}%` and judged "trading live / calm" against it. The live gate has been the top-fifth percentile since 5 Nov (`goldVolMin null`, `goldVolPct 80`); on 7 Nov the page said "1.68% ≥ 1.5%: trading live" while the Trader's gate was 2.47% and every v5 signal was recorded `calm: true`. The page now reads `snapshot.goldVolP` (the percentile gate the Trader publishes) and falls back to `goldVolMin` only when a fixed leg is set.
2. **Mosha weekly fallback labelled PAXG under the OANDA feed (label bug, fixed).** `snapshot.goldW1Src` was `'paxg'` whenever CNBC failed, but since 7 Nov the stand-in daily candles are OANDA's (`src['1d']` follows the market feed). The label now says `oanda` or `paxg` by feed, and the page text names the right source. No trade decision reads the label.
3. **Stale comments (fixed, comments only):** the volatility-gate comments in trader.mjs still described the 1.5% gate ("Gold keeps its 1.5% gate"); the crypto-trend header described v1 (4 ATR trail, 27-day low) while the code is v3 (5 ATR catastrophe stop, channel-midpoint exit), as the 7 Nov history catch-up already noted.
4. **Mosha BO has no untouched-data test (study must be re-run).** Every component (weekly filter 2019–26, add/run 2023–26, slow rule 2023–26) was chosen on the only data tested; the HistData replay leaves 18 out-of-sample trades and the slow rule does not replicate; the robustness audit's independent rebuild has the weekly filter hurting. A pre-registered run of the live combination on OANDA 2006–17 (the #530 harness already has the M5/H4/D1 data; the weekly needs D1 only) is the missing study.
5. **Feed drift on the live record, not on the parameters.** All four OOS studies ran on OANDA mid candles. The live gold systems traded Kraken PAXG + a spot basis until 7 Nov 16:01 UTC; the Kraken fallback is still in the code and untested; NQ runs on 10-minute-late futures prints; the ICT desk on CNBC front-month futures. Each study declares its feed and calibrates against the council's own record where one exists.
6. **Dead knobs (documented, not changed):** `goldFixedR 4` (overridden by `goldRun`), ICT `P.rr 3` (the exit is the trail). Both are harmless; removing `goldFixedR` would change the replica's note text, which is not a bug fix.
7. **Prose drift, not changed:** the page's volatility-gate note still says "the add at +2R" (it moved to +1.5R on 6 Nov); the paragraph quotes the 5 Nov replay, whose numbers belong to the +2R add, so the sentence is left for the owner. The live ICT `ict/trades.json` holds a single open ES trade and no closed A-setup; the desk's evidence is `ict/replay.json`.

Costs: no live system charges a cost on its own record; `fills.mjs` annotates `Rnet` after the fact (gold 0.30 + ½-spread slippage on market legs). Every study reports at least the council's 0.30 (x1) and a doubled figure, and #512 also the `fills.mjs` figure, so no verdict depends on the cost model.

## The pin test

`tests/param-pins.test.mjs` fails CI when any of these moves without this file being updated:

- the `USER_RULES` lines that set `goldVolPct`, `goldVolMin`, `goldBeR`, `goldAdd`, `goldRun`, `goldNewsVeto`, `replicaMsnrSize`, `goldTrend`, `goldTrendAdd`, `goldTL`, `goldEG`, `nqRun`, `moshaBeR` / `moshaAdd` / `moshaRun`, `moshaSlow`;
- the replica constants in the code path: 0.30 stop floor, `riskAtr >= 1`, round-number $2 / $0.50, 8-minute stale rule, 3-open cap, −1.5R day stop, 50-trade equity filter, the `-367, -2` percentile window, 48 h;
- the Mosha constants: ±0.3 stop, `r0 > 0.5`, 24 h / 72 h, cap 2, weekly swing 3, N=6 structure;
- the NQ call `nqOpenSweep(bars, ny.d, 570, 0, 0.0008)`, the 2-point buffer, the 15-min reclaim, the 571–660 window and the 11:00 ET exit;
- the ICT exports `P`, `MIN_GRADE`, `RISK_FLOOR`, `RISK_CAP`, `RISK_TIGHT`, `TIGHT_SIZE`, `DOL_ROOM`, `ROOM_SIZE` and the `1.6 * g.r0` entry guard;
- the studies' own config lines (`replica-oos/replay.mjs` CFG, `gold-systems-oos/replay.mjs` CFG, `nq-open-oos/lib.mjs` defaults), so a change on either side shows up as a live-vs-tested mismatch;
- the page's gate line reading `goldVolP`.

When the owner changes a rule, the pin must be moved in the same PR, and the RESULT of the study it drifts from must say the study no longer covers the live rule.

## Files

- `RESULT.md` (this file).
- `tests/param-pins.test.mjs`: the pins.
- Code: `council/trader.mjs` (comments; `goldW1Src` label by feed), `market-structure.html` (gate display reads `goldVolP`; weekly-source text).

# Pre-registration: SMT divergence at the sweep of an ICT index A-setup

Written on 14 Nov 2026, **before any outcome of this split was computed**. What existed when this file was committed: the
detector (`smt.mjs`), the runner (`run.mjs`), the downloaded candles and the output of the runner's `count` stage, which counts
signals and never simulates a trade (the table under "Sample size"). This file is committed and pushed ALONE, first; the code
follows in the next commit; the `full` stage, the only one that reads an outcome, runs after both. The sha256 of this file is
written into `result.json` (`planSha256`).

Paper research. ICT is its own edge, run by Fred: this study proposes at most. No file under `ict/`, no rule of the tracker, the
replay, the desk or the rule book changes, whatever the result. Nothing of ICT is mixed into a council system. Every simulated
trade keeps the engine's own stop.

## 1. Has this been tested?

- **Studies** (`research/edge/`, every remote branch named like smt / diverg, `claude/ict-concepts`, `claude/edge-ict-filters`):
  no study computes SMT for a signal. `gold-silver-divergence` is a gold / silver study, not an ICT split.
- **The tracker** (`ict/tracker.mjs`, read only): no SMT feature in `feat`.
- **Skill §28** (7 Nov, the rule book's notes, not a pre-registered study): an "SMT proxy" on cash NQ + ES + YM, 2023-24 | 2025-26:
  "this index took its prior-24h low / high while ES or YM did not", totals only (−0.7 | +12.2R with, −0.1 | +11.4R without),
  no n, no t, no costs table, no out-of-sample split, and a different definition (a 24-hour extreme, not the confirmed swing the
  sweep took; either of two partners; no RTY). It is the one prior look, declared here. It does not meet the repository's
  standard (pre-registered, 2020 → now, n and t), so this study is not a duplicate of it; its reading ("no edge") is prior
  knowledge, written down before the run.

## 2. Definition (fixed; `smt.mjs`)

For a **buy** A-setup of `signals()` on an index, at its sweep candle `s` (the candle at `sweepT`):

1. **The swing the sweep took**: the detector of `research/edge/ict-equal-lows/eq.mjs` (`sweptSwings`, imported unchanged):
   confirmed H1 swing lows (3 candles each side, right-hand candles all closed before `s`), at most 96 candles old, untouched
   until `s`, traded through by `s`. The swing judged is the **most recent** one taken. If the detector finds none (the
   tracker keeps a swing alive through its lock-out, the detector does not), the signal is "not judged" = no SMT.
2. **The partner** (fixed): NQ → ES, ES → NQ, YM → ES, RTY → ES.
3. **The partner's own low of those hours**: its lowest low over the 7 H1 candles centred on the swing's time (± 3 h, the
   swing's own window), on its own candles, aligned by time. At least 5 of the 7 must exist, else "not judged".
4. **SMT**: the partner has a candle at the sweep time, and NO partner candle after that window, up to and including the
   candle at the sweep time, trades below that low. The signal market made a lower low; the partner held a higher low.

Sells mirror (highs). Only candles at or before the sweep candle are read, on both markets. **GC is excluded**: the data
has no clean partner for gold (silver is a paper-only market of the desk and moves with gold on its own news). Said here so a
missing gold row is not read as a result.

## 3. Engine, data, costs (fixed)

- **Engine**: `api/_ictlab.js` `runMarket` with the desk's own `signals()`, `isASetup()`, `sizeOf()`, `P` (`ict/tracker.mjs`) and
  `simulate()` (`ict/replay.mjs`), imported, never edited, exactly as `ict-equal-lows`. Live exit, live sizing. Streams, each
  its own one-open stream per market: **unfiltered** (every A-setup), **SMT**, **no SMT** (the other A-setups, not-judged ones
  included).
- **Markets**: NQ, ES, YM, RTY = OANDA mid NAS100, SPX500, US30, US2000 H1 through the keyless proxy, 1 Jun 2019 (warm-up) →
  9 Nov 2026, cleaned as the lab does (17:00 New York hour dropped, D1 = `dailyNY`); UTC times, no HistData clock involved.
- **Window**: signal candle closes 2020-01-01 → 2026-10-31. **IS** 2020-23, **OOS** 2024-01-01 on (the lab's split; the
  task's ICT windows, which differ from the 2016 cut used for daily-candle studies because these H1 candles start in 2019).
- **Costs**: the lab's round trip (NQ 1.5, ES 0.5, YM 3, RTY 0.4 points). Net R = size x (R − cost / risk). **2x costs** =
  2 x net − gross. **No financing**: the trades are out within 36 H1 candles and the desk trades futures (the lab charges
  none; `ict-equal-lows` charged none); stated, not hidden.

## 4. Sample size (the `count` stage: signals only, no outcome)

| market | partner | A-setup signals | IS | OOS | SMT IS | SMT OOS | share | not judged |
|---|---|---|---|---|---|---|---|---|
| NQ | ES | 345 | 217 | 128 | 62 | 29 | 26% | 44 |
| ES | NQ | 347 | 206 | 141 | 43 | 33 | 22% | 44 |
| YM | ES | 346 | 216 | 130 | 58 | 43 | 29% | 44 |
| RTY | ES | 343 | 205 | 138 | 63 | 45 | 31% | 49 |
| all | | 1,381 | 844 | 537 | 226 | 150 | 27% | 181 |

About one A-setup in four has SMT. Out of sample about 150 signals, fewer trades after the one-open rule. Not judged: 156 where
the detector finds no swing taken, 25 with partner candles missing. The definition is not loosened after this.

## 5. Tests (three, no fourth), statistic and bar

| test | what | statistic |
|---|---|---|
| **T1 (primary)** | SMT A-setups, pooled index book, OOS net R > 0 | t on calendar-month sums (all 34 OOS months, a month without a trade = 0), one-sided |
| T2 | SMT minus no-SMT A-setups, OOS | one-sided Welch on trades (normal approximation) |
| T3 | the same difference, IS (sign agreement) | one-sided Welch on trades |

Holm over the three p-values. Placebo: **40 seeded random labels** (mulberry32, seeds 1000-1039): each A-setup signal is called
"SMT" with its market's observed SMT share; the same streams and T1 / T2 statistics are computed for each draw.

**PASS** only if all hold: OOS SMT n ≥ 30; T1 Holm p < 0.05 with monthly t ≥ 2; SMT net R a trade > 0 in sample (same sign);
OOS net R a trade still > 0 at 2x costs; T2 Holm p < 0.05; T3 difference > 0; at most 2 of the 40 placebo draws reach the
observed T1 monthly t. **FAIL** when the SMT stream's OOS net R a trade is not positive or the OOS difference (T2) is not
positive. **INCONCLUSIVE** otherwise, and "too few to judge" (INCONCLUSIVE) when OOS SMT trades are under 30.

Reported, not judged: n, win rate, R a trade, total R, drawdown, trade t and month t for every stream and window, gross and per
unit; by year; per market (each under 30 OOS trades: not judged one by one); the split inside the unfiltered stream's own
trades; the reason counts of the tag.

## 6. What follows

- A PASS becomes a short proposal in `research/proposals/` for Fred and the owner (a forward tag or a paper shadow first), never
  a live change made here. Fred decides on the ICT edge (owner, 10 Nov).
- Anything else: the result is reported as it is, no proposal. Nothing is tuned after the run. A bug found after the run is fixed,
  stated in RESULT.md, and everything is run again.

## Prior knowledge, declared

The index A-rule was fitted on 2023-26 data, so the unfiltered baseline is not out of sample; only the split is judged. Skill §28
found no edge in a looser SMT proxy (above). `ict-equal-lows` (same engine, same candles) found the A-setups +0.138R a trade net
OOS when the sweep did not take an equal pool and +0.092R when it did. No outcome by SMT was seen before this file.

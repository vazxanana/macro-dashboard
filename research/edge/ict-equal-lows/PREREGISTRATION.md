# Pre-registration: does it matter WHAT the ICT A-setup swept? Relative equal lows / highs vs one swing

Written on 11 Nov 2026, **before any outcome of this split was computed**. What existed when this file was committed: the
detector (`eq.mjs`), the runner (`run.mjs`), the downloaded candles, and the output of the runner's `count` stage, which
counts signals and never simulates a trade (the table under "Sample size"). The `full` stage, the only one that reads an
outcome, runs after this file is pushed. The sha256 of this file is written into `result.json` (`planSha256`).

Paper research. ICT is its own edge, run by Fred: this study proposes at most. No file under `ict/`, no rule of the tracker,
the replay, the desk or the rule book changes, whatever the result. Every simulated trade keeps the engine's own stop.

## 1. What the owner's ICT skill holds, and what has been tested

| Concept (skill section) | Where it stands | Verdict there |
|---|---|---|
| iFVG reversal after a sweep (§9) | the live model; `ict-oos-2008`, `ict-breadth`, `ict-breadth-2`, `ict-universe` | positive 2018-26 on the desk's markets only; fails 2008-17 and on 20 other markets |
| Candle-closure grade (§9.9) | `ict-grades` | grade order does not hold |
| Daily bias, LTP direction (§3, §8) | A-rule goes against it (§14); `ict-filters`, `ict-trend-side`, shadow `h1opp` | with-bias loses; 200-day gate fails |
| Premium / discount of the 20-day range (§4) | `ict-filters`, `ict-variants` V4 | not chosen in sample; inconclusive |
| Sweep into a D1 / H4 FVG (§5, §29) | `feat.htfFvg`; `ict-filters`, `ict-variants` V3 | weak pass on the index book, not strong |
| Daily candle closure, OLHC (§6, §29) | `feat.cc`; skill §29 | flips between halves |
| Previous-day high / low swept, one-candle range on D1 (§4) | `feat.pdSweep`; `ict-filters`, skill §14, §17, §32 | no stable effect |
| Turtle soup at equal lows, "low that broke the high", NWOG / NDOG fill (§5, §1) | `ict-concepts`, as three NEW entries without the iFVG | fail |
| Opening prices, midnight / 08:30 (§18, §28) | skill §18, §28 | rejected |
| Time: sessions, kill zones, weekday, quarters of the day (§10) | `ict-sessions`, `ict-variants` V2, `ict-filters` (Friday → shadow `nofri`) | nothing stable but the weak Friday filter |
| Room to the draw on liquidity; equal highs as the TARGET (§9.8, §28) | live sizing (§27); skill §28 | sizing kept; "equal highs beyond the entry" is not a filter |
| Exits, break-even, stops (§9.6, §9.7) | `ict-exits`, `ict-exits-replay`, `ict-variants` V1 / V5, shadow `strail` | live exit stays |
| Macro regime, Dollar Smile | `ict-macro`, `ict-smile` | null |
| **Relative equal lows / highs as the liquidity the signal SWEPT (§1, §5, §9.1)** | **never computed for a signal, never tested** | **this study** |
| NWOG / NDOG as the key level a sweep runs into (§4) | not implemented (only as an entry, above) | untested |
| Quarter of the month / of the year (§10) | not implemented | untested |
| Deferred delivery at a high-resistance level (§7) | not implemented | untested |
| Dealing range built from swings (not the fixed 20-day range) (§4) | not implemented | untested; close to the tested 20-day version |
| Market profile, consolidation vs expansion (§2); institutional order flow (§3) | not implemented | untested; needs definitions the skill does not give |

## 2. The pick, and why

**Relative equal lows / highs as the swept liquidity.** The skill's first step of the model is "an obvious pool taken:
EQH / EQL, session high / low, swing high / low" (§9.1), it calls engineered liquidity "preferred" (§1) and says the course
is built around equal highs and lows "engineered daily" (§13). The desk's signal starts at ANY swept H1 swing and never
records whether that sweep took a pool of equal lows or a lone swing. The two earlier touches of the idea are different
questions: `ict-concepts` traded a turtle soup at equal lows with no iFVG (a new entry), and skill §28 looked at equal highs
beyond the entry (a target). It can be computed from H1 candles before the entry, with nothing to tune that an earlier study
did not already fix (the tolerance is `ict-concepts`' 0.1 x daily ATR; swing width and look-back are the tracker's own).

Why not the others: NWOG / NDOG levels are opening gaps, and the cash CFDs this test must use open differently from the
futures the desk trades (`ict-concepts` found stub-candle artefacts there). Month and year quarters cut 1,800 signals into
cells too thin for a 2/3-of-years bar and sit next to `ict-sessions`, which found timing unstable. Deferred delivery, market
profile and order flow need definitions the skill does not give, so any version would be mine, not the skill's. A swing-built
dealing range is a variant of the premium / discount filter already tested twice.

## 3. Definition (fixed; `eq.mjs`)

For a buy signal of `signals()`, at its sweep candle `s` (the candle at `sweepT`), on closed H1 candles at or before `s` only:

1. **Swing low**: a candle with no lower low among the 3 candles on each side (the tracker's `P.piv`), whose right-hand
   3 candles all closed before the sweep candle, at most 96 candles old (`P.look`).
2. **Untouched**: no candle between it and `s` traded below its low.
3. **Swept**: candle `s` trades below its low.
4. **Equal pool**: at least two such swept swings, at least 4 candles apart, with lows within **0.1 x the daily ATR(14)** of
   each other (the 14 daily candles closed before the signal candle's close: the same value behind `feat.atrR`).

Sells mirror (equal highs). A signal with no daily ATR yet is "not an equal pool". The detector is mine and is not the
tracker's internal sweep list (the tracker keeps a swept swing alive during its 6-candle lock-out; this detector does not);
the signals themselves are untouched.

## 4. Engine, data, costs (fixed)

- **Engine**: `api/_ictlab.js` `runMarket` with the desk's own `signals()`, `isASetup()`, `sizeOf()`, `P`
  (`ict/tracker.mjs`) and `simulate()` (`ict/replay.mjs`), imported, never edited. One open trade per market per stream.
  Live exit (1.5R trail from +2R, break-even at +1.5R on indices, 36 closed H1 candles), live sizing.
- **Streams**, each its own one-open stream per market: **unfiltered** = every A-setup (the lab's baseline);
  **equal pool** = A-setups whose sweep took an equal pool; **others** = A-setups whose sweep did not.
- **Markets**: NQ, ES, YM, RTY (OANDA NAS100, SPX500, US30, US2000) under the index A-rule; GC (OANDA XAU) under the gold rule.
- **Candles**: OANDA mid H1 through the keyless proxy, 1 Jun 2019 (warm-up) → 9 Nov 2026, complete candles, cleaned as the
  lab's `labSource` (17:00 New York hour dropped, D1 = `dailyNY`). OANDA times are UTC: the HistData clock is not involved.
- **Window**: signal candle closes 2020-01-01 → 2026-10-31. **IS** 2020-23, **OOS** 2024-01-01 on (the lab's split).
- **Costs**: the lab's round trip (NQ 1.5, ES 0.5, YM 3, RTY 0.4 points, gold 0.5). Net R = size x (R − cost / risk).

## 5. Sample size (the `count` stage: signals only, no outcome)

| market | A-setup signals | IS | OOS | equal pool IS | equal pool OOS | share |
|---|---|---|---|---|---|---|
| NQ | 345 | 217 | 128 | 34 | 19 | 15% |
| ES | 347 | 206 | 141 | 36 | 22 | 17% |
| YM | 346 | 216 | 130 | 25 | 14 | 11% |
| RTY | 343 | 205 | 138 | 28 | 23 | 15% |
| GC | 425 | 242 | 183 | 50 | 30 | 19% |
| all | 1,806 | 1,086 | 720 | 173 | 108 | 16% |

About one A-setup in six swept an equal pool. Pooled, there are enough (about 100 out of sample) to say something; the index
book has about 78; gold has 30 signals out of sample, so after the one-open rule it may fall under the n ≥ 30 line and then
cannot pass. That is stated now and the definition is not loosened to help it.

## 6. Tests (three, no fourth), statistic and bar

| test | book |
|---|---|
| **T1 (primary)** | all five markets pooled |
| T2 | index book: NQ + ES + YM + RTY |
| T3 | gold: GC |

Reported for every stream, book, window: n, win rate, net R a trade, total net R, max drawdown, t, by year; per market;
the difference equal pool − others (Welch t), in sample and out of sample.

**PASS**, per test, only if all hold for the equal-pool stream:
1. the lab's own screen: OOS n ≥ 30; net R a trade > 0 in sample and out of sample; at least 2 of the 3 OOS years
   (2024, 2025, 2026) with total net R > 0;
2. it beats the unfiltered stream on net R a trade out of sample AND in sample (the lab's `compare` rule);
3. out of sample, the equal-pool stream beats the other A-setups with a one-sided Welch p (normal approximation) under 0.05
   **after Holm over the three tests**.

"Strong" is noted when the equal-pool stream's own OOS t ≥ 2. **FAIL** when its OOS R a trade is not above the unfiltered
stream's, or is not positive. **INCONCLUSIVE** otherwise.

Reported, not judged (no verdict hangs on them): tolerances 0.05 and 0.2 x ATR on the pooled markets; the same split inside
the unfiltered stream's own trades, sized and per unit; flat-size and gross figures.

## 7. What follows

- A PASS becomes a short proposal in `research/proposals/` for Fred and the owner (a forward tag or a paper shadow first),
  never a live change made here.
- Anything else: the result is reported as it is, no proposal file. Nothing is tuned after the run. A bug found after the run
  is fixed, stated in RESULT.md, and everything is run again.

## Prior knowledge, declared

The index A-rule was fitted on 2023-26 data and the gold rule on 2019-26 gold, so the unfiltered baseline is not out of
sample; only the split is judged. `ict-concepts` showed turtle soups at equal lows without the iFVG do not work; skill §28
found equal highs beyond the entry are near-universal. Neither computed this split. No outcome by pool was seen before this file.

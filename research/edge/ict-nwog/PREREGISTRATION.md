# Pre-registration: ICT A-setups whose sweep ran into an open NWOG / NDOG, against the rest

Written on 14 Nov 2026, **before any outcome of this split was computed**. What existed when this file was committed: the
detector (`gap.mjs`), the runner (`run.mjs`), the downloaded candles, and the output of the runner's `count` stage, which counts
gaps and signals and never simulates a trade (the table under "Sample size"). The `full` stage, the only one that reads an
outcome, runs after this file is pushed. The sha256 of this file is written into `result.json` (`planSha256`).
This file is committed alone; the detector and runner follow in the next commit unchanged: `gap.mjs` sha256
`bccb8ff2677e718e78772ab9ccd72a7005faced8d18a6495547f3f443f3619ce`, `run.mjs` sha256 `70cb21ff18b4d4e568dc7349e26fadd6b828c268e349fc4e17c6a21f8578243c`.

Paper research. ICT is its own edge, run by Fred: this study proposes at most. No file under `ict/`, no rule of the tracker,
the replay, the desk or the rule book changes, whatever the result, and nothing of ICT is mixed into a council system. Every
simulated trade keeps the engine's own stop.

## 1. Why this, and what it is not

`research/edge/ict-equal-lows` (11 Nov 2026) listed every concept of the ICT skill against the earlier ICT studies. Two were
left "untested": NWOG / NDOG as the key level a sweep runs into, and the quarter of the month / year. This study takes the
first. It is a split of the desk's own A-setups, the same design as `ict-equal-lows`.

What was tested before, and why this is different: `research/edge/ict-concepts` traded the opening gap itself as a NEW entry
(fade the first H1 candle after a break toward the prior close, no iFVG): NWOG fade lost (2018-26 −0.24R a trade), NDOG was
stub-candle artefacts. That is a gap-fill entry. This study keeps the desk's iFVG entry and asks only whether the liquidity the
sweep ran into was an open opening gap. Branches `claude/ict-gap` (= the equal-lows study) and `claude/ict-concepts` (the gap
fill entry, on main) were read: neither computes this split.

## 2. Definition (fixed; `gap.mjs`)

On the lab's cleaned OANDA H1 candles (the 17:00 New York hour dropped), with CME hours from `ict/calendar.mjs` (`cmeShut`):

1. **A break**: a candle that is not CME-shut, whose previous hour was CME-shut or the 17:00 New York halt, is a **reopen
   candle**. Its **close candle** is the last earlier candle that is not CME-shut. CFD candles printed while CME is shut are
   ignored: the gap is measured on the CME session.
2. **NWOG** = the range between the close candle's close and the reopen candle's open, when the break contains a Saturday (the
   weekend, or the weekend joined to a holiday). **NDOG** = the same for every other break (the 17:00 New York close to the
   18:00 reopen; 13:00 on an early-close day; the eve's 17:00 before a weekday full holiday). A gap with open = close is none.
3. **Fully filled** before the sweep candle `s`: a candle from the reopen candle to `s − 1` traded back to the prior close
   (up gap: low ≤ close; down gap: high ≥ close).
4. **Live gaps** at `s`: of the 5 most recent NWOGs and the 5 most recent NDOGs whose reopen candle is before `s`, the ones not
   fully filled before `s`.
5. **Ran into**: a buy signal's sweep candle (`sweepT` of `signals()`) has low ≤ the gap's top AND the top of its body ≥ the
   gap's bottom (its down-wick reached into or through the gap from above). Sells mirror: high ≥ the gap's bottom AND the bottom
   of its body ≤ the gap's top.
6. **WITH-gap** A-setup: its sweep candle ran into at least one live gap. **WITHOUT-gap**: the rest.

Only candles before `s` decide which gaps exist and whether they are filled; the sweep candle itself is read only for step 5. The
signals, their entries and stops are the engine's, untouched.

**Limitation, stated now.** OANDA cash CFDs stand in for the futures the desk trades. Their weekend and daily opening gaps are
CFD gaps: a CFD quotes through some CME shut hours (dropped here), its reopen price is the CFD's, and it carries no contract roll.
A futures NWOG / NDOG would differ in size and sometimes in sign. What is tested is the CFD version of the concept.

## 3. Engine, data, costs (fixed; as `ict-equal-lows`)

- **Engine**: `api/_ictlab.js` `runMarket` with the desk's own `signals()`, `isASetup()`, `sizeOf()`, `P` (`ict/tracker.mjs`)
  and `simulate()` (`ict/replay.mjs`), imported, never edited. One open trade per market per stream. Live exit, live sizing.
- **Streams**, each its own one-open stream per market: **unfiltered** (every A-setup), **WITH-gap**, **WITHOUT-gap**.
- **Markets** (named before any result): NQ, ES, YM, RTY (OANDA NAS100, SPX500, US30, US2000) under the index A-rule; GC (OANDA
  XAU) under the gold rule.
- **Candles**: OANDA mid H1 through the keyless proxy, 1 Jun 2019 (warm-up) → 9 Nov 2026, cached outside git.
- **Window**: signal closes 2020-01-01 → 2026-10-31. **IS 2020-23, OOS 2024-01-01 on** (the lab's split, as `ict-equal-lows`;
  the common research brief's 2017 split cannot be used: the lab's window starts in 2020 and the A-rule's markets are judged on
  its own split).
- **Costs**: the lab's round trip (NQ 1.5, ES 0.5, YM 3, RTY 0.4 points, gold 0.5); net R = size × (R − cost / risk). **2x
  costs** = net R − (gross − net). **Financing** (reported, not judged; the lab charges none, as for futures): a CFD would pay
  overnight; charged at `council/fills.mjs` `FIN.xau.long` (0.000148 of price a night, the demo broker's measured gold swap, the
  only measured CFD rate in the repository) on every market and both sides, per `nights()` of `council/fills.mjs`.

## 4. Sample size (the `count` stage: gaps and signals only, no outcome)

| market | H1 | NWOGs | NDOGs | A-setup signals | IS | OOS | WITH-gap IS | WITH-gap OOS | share | into an NWOG | into an NDOG |
|---|---|---|---|---|---|---|---|---|---|---|---|
| NQ | 43,928 | 353 | 1,394 | 345 | 217 | 128 | 15 | 13 | 8% | 8 | 20 |
| ES | 43,930 | 351 | 1,357 | 347 | 206 | 141 | 14 | 13 | 8% | 13 | 14 |
| YM | 43,932 | 353 | 1,392 | 346 | 216 | 130 | 10 | 9 | 5% | 9 | 11 |
| RTY | 43,916 | 352 | 1,407 | 343 | 205 | 138 | 11 | 9 | 6% | 9 | 11 |
| GC | 44,011 | 349 | 1,394 | 425 | 242 | 183 | 11 | 6 | 4% | 8 | 9 |
| all | | 1,758 | 6,944 | 1,806 | 1,086 | 720 | 61 | 50 | 6% | 47 | 65 |

About one A-setup in seventeen ran into an open gap. Out of sample there are about 50 such signals across the five markets and
44 on the index book, before the one-open rule; gold has 6 and is not tested on its own. The sample is thin: a pass needs a large
effect. That is stated now and the definition is not loosened to help it.

## 5. Tests (three, Holm over all three), statistic and bar

| test | what | statistic |
|---|---|---|
| **T1 (primary)** | WITH-gap A-setups, all five markets, OOS net R a trade > 0 | t on calendar-month sums of net R (every calendar month of the window, a month with no trade = 0), one-sided p, normal approximation |
| T2 | WITH-gap minus WITHOUT-gap, all five markets, OOS | one-sided Welch t on trades (WITH better), normal approximation |
| T3 | WITH-gap A-setups, index book (NQ, ES, YM, RTY), OOS net R a trade > 0 | as T1 |

Holm over the three p-values. **T1 and T3 pass** only if all hold: OOS n ≥ 30; month t ≥ 2; Holm-adjusted one-sided p < 0.025
(the t ≥ 2 line after Holm); net R a trade > 0 in sample (the same sign); OOS net R a trade > 0 at 2x costs. **T2 passes** when
the OOS and IS differences are both > 0 and its Holm p < 0.025.

**Verdict**: PASS only if T1 passes; otherwise FAIL (T2, T3 are reported with their own pass / fail).

**Placebo**: 40 seeded random taggings (seed 20261114 + draw): each A-setup signal is tagged WITH at random with its market's
own observed WITH share; the WITH stream is run as T1. Reported: in how many draws the OOS month t reaches the real one, and how
many reach 2.

Reported, not judged: gross figures; trade-level t; per market; the split inside the unfiltered stream's own trades (WITH, NWOG
only, NDOG only); financing.

## 6. What follows

- A PASS becomes a short proposal in `research/proposals/` for Fred and the owner (a forward tag or a paper shadow first),
  never a live change made here.
- Anything else: the result is reported as it is, no proposal file. Nothing is tuned after the run. A bug found after the run is
  fixed, stated in RESULT.md, and everything is run again.

## Prior knowledge, declared

The index A-rule was fitted on 2023-26 data and the gold rule on 2019-26 gold, so the unfiltered baseline is not out of sample;
only the split is judged. `ict-equal-lows` gave the unfiltered baseline on the same candles (+0.137R OOS, n 679). `ict-concepts`
found that fading the NWOG loses. No outcome split by gap was seen before this file.

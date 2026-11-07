# Pre-registration: exits for the NQ New York open run (five variants, same entries)

Written on 7 Nov 2026, **before any exit variant was computed on this data**. The only numbers that exist are the ones
#511 (`research/edge/nq-open-oos`) already published for the live exit and for a fixed 2R target (declared below). Nothing in
this file may change after the first run of `run.mjs`. The test runs once and its result is reported whatever it is.

## The system under test (unchanged, `council/trader.mjs` + `config.nqRun`)

`nqOpenSweep(bars, day, 570, 0, 0.0008)` + the `nyflip` block: between 09:31 and 10:59 ET price runs ≥ 0.08% of the 09:30 open
through it and a 1-minute candle closes back across it within 15 minutes; trade **with** the run at that close; stop the same
distance on the other side (extreme ∓ 2 points); only when the 00:00 ET open lies ahead of the trade. **Live exit (baseline B):**
10R cap, after +2R the stop trails 1R behind the best price (`nqRun = { atR: 2, trail: 1 }`), out at the open of the 11:00 ET
candle. The trade loop is the live one (stop before target within a candle, a gap fills at the open, the first minute after
the fill is not checked), copied in `research/edge/nq-open-oos/lib.mjs`, which this study reuses for the **entries**.

**Entries are identical for every variant.** Only the exit changes. The study asks one question: is there an exit that does
better than the live one on the 19 years where the entry makes about nothing, and that also does better on the four years
where it works?

## The five variants (fixed now)

| id | exit | everything else |
|---|---|---|
| `fixed2R` | target 2R, no trail | out 11:00 ET |
| `trail1` | trail 1R behind the best price from +1R (so breakeven at +1R), 10R cap | out 11:00 ET |
| `trail3` | trail 1R behind the best price from +3R, 10R cap | out 11:00 ET |
| `time` | the live exit, but out at the open of the **10:30** ET candle (`t1030`) or the **12:00** ET candle (`t1200`) | 10R cap, trail [2, 1] |
| `half` | at +2R half the position is closed at the 2R price (at the candle open if a gap carries through it); the other half trails 1R behind the best price from then on (the live trail), 10R cap; out 11:00 ET | trade R = 0.5 × 2 + 0.5 × rest |

The `time` family has two settings, earlier and later, because the direction is unknown; this makes **six cells** in five
families, and the report counts six when it talks about chance. A cell is judged on its own. No other value (trail distance,
other trail start, other time, other split) will be tried.

Mechanics shared with the live loop: within a candle the stop is checked first, then the target / the 2R half-off, then the
trail is updated from the candle's best price. For `half`, a candle that reaches 2R closes half at the 2R price and arms the
trail for the rest in that same candle; the rest is managed from the next candle on. The time exit fills at the open of the
exit candle. 10R cap for all trailing variants (as live).

## Data and windows (fixed now)

- **OANDA NAS100_USD 1-minute mid candles**, the #511 cache (`research/edge/nq-open-oos/fetch.mjs`): 09:30-11:05 ET candles plus
  the midnight price, clean years **2004-2026** (2003 dropped, the #511 cleanliness rule). The cache runs to 6 Nov 2026.
- The 12:00 exit needs the 11:05-12:05 ET candles, which the cache does not hold. `fetch-noon.mjs` (committed with this file)
  fetches them for every cached weekday through the same proxy into `nas100-noon-<year>.json`. A trade whose candles end
  before its exit is not counted for that cell (as #511), and the report says how many.
- **Selection period: 2004-01-01 to 2022-12-31** (1,560 baseline trades, −0.018R a trade). **Confirmation period: 2023-01-01
  to 6 Nov 2026** (309 baseline trades, +0.318R). **Halves of the confirmation period: 2023-2024 and 2025-2026** (calendar).
- **Costs:** 1 point round trip, taken off every trade as 1 / stop (points) in R, the same for every variant (the half-off
  trades the same notional). 2 points (x2) and gross are reported, they do not change the verdict.
- The statistic is **net R a trade**, and **max drawdown** is the largest peak-to-trough fall of the cumulative net R by trade
  within the period.

## Pass bar (fixed now)

A cell **PASSES** if all of these hold, net of 1 point:

1. **Selection (2004-22):** its R a trade > the baseline's (−0.018R) **and** its max drawdown ≤ 1.2 × the baseline's.
2. **Confirmation (2023-26):** its R a trade > the baseline's (+0.318R) **and** its R a trade > the baseline's in **both** halves
   (2023-24 and 2025-26) **and** its max drawdown ≤ 1.2 × the baseline's.

Each cell is judged on its own against the baseline; there is no t requirement (t is reported). If more than one cell passes,
the one **implemented** is the one with the highest 2004-22 R a trade (the choice is made on the period where the rule makes
nothing, never on 2023-26). The others are reported as passing but are not built.

**FAILS** otherwise. A cell that is better on 2023-26 but not on 2004-22 is a fit to the good regime and fails. A cell that is
better on 2004-22 but not on 2023-26 fails too (it would cost money in the regime that pays).

## What is already known (declared)

- #511 computed a **fixed 2R exit** on this data: **2004-22 −0.025R vs −0.018R** (baseline), **2023-26 +0.253R vs +0.318R**.
  Unless the halves or drawdown change the picture, `fixed2R` is expected to **fail** both conditions. It stays in the study
  because the owner asked for it and because it is the natural floor for the other variants.
- `nq-runner` (config history, 5 Nov) was chosen on Nasdaq cash 2018-26: runner +0.048R (2018-22) / +0.341R (2023-26) vs fixed
  2R +0.017R / +0.280R. Nothing about trails from +1R or +3R, time exits or a half-off has been computed on this data.
- The 09:30-11:05 window was chosen by the live rule's 11:00 exit; the time of day is not a free parameter here beyond the two
  pre-registered settings.

## What happens after

- **FAIL (no cell passes):** reported. Nothing is built; the live rule, `config.nqRun` and the `nyflip` stream are untouched.
- **PASS:** the chosen cell is added to `council/trader.mjs` **only as a paper shadow stream** in `research.json`, following the
  `nyflip-x` pattern (its own id `nq-nyflip-<variant>-<day>`, session `nyflip-<variant>`, same entry, stop and side as the live
  `nyflip` row, different exit parameters). It must not send phone alerts or futures tickets, and the live `nyflip` row must be
  byte-identical with and without the change (a chained-run test proves it). `decay.mjs`, `robustness.mjs`, the EA mirror and
  the dashboard select `session === 'nyflip'`, so they do not see the shadow. The live rule is never changed; the owner decides.

## What will not happen

- No parameter, cost, window, half split or pass bar changes after the first run.
- No seventh cell. No combination of cells. No per-side, per-weekday or per-year exit.
- No live rule, config or replay code changes.

# Pre-registration: five ICT A-setup variants from the skill, 2020 → Oct 2026, IS / OOS

Written on 9 Nov 2026, **before any variant was run on any data** (in-sample or out-of-sample). Only the code of
`api/_ictlab.js`, `ict/tracker.mjs`, `ict/replay.mjs`, the ICT skill and the earlier ICT studies were read. The runner
(`run.mjs`) is written after this file; its first execution is the test. The sha256 of this file is recorded in
`result.json` (`planSha256`) by the runner so any later edit is visible. Nothing below changes after the first run.

## Question

The live A-setup rule (`ict/tracker.mjs` `isASetup` / `sizeOf`, exit from `ict/replay.mjs` `simulate`: trail 1.5R from +2R,
break-even at +1.5R on index markets, 36 closed H1 candles) is the baseline. Does any of five changes, each taken from the ICT
skill (`.claude/skills/ICT/SKILL.md`), improve it both in sample and out of sample, net of costs? Paper research only: the
live rules, the tracker, the replay and the desk do not change in this study, whatever the result.

## Engine (fixed)

The ICT lab of the research MCP (`api/_ictlab.js`, PR #689): `runMarket` (the desk's own `signals()`, `isASetup()`,
`sizeOf()`, `P` from the tracker, `simulate()` from the replay; one open trade per market; parameters applied inside one
synchronous run), `effectiveP`, `filterFn`, `stats`, `summarize`, and its round-trip costs (`COST`: NQ 1.5, ES 0.5, YM 3
points, gold 0.5). Net R of a trade = size × (R per unit − cost / risk). Sizing as live (`sizeOf`: room-to-DOL 1.5× / 0.5×,
tight-stop A+ half size on indices; gold 1×). The lab's OANDA download is replaced by the research candles below, cleaned
exactly as the lab's `labSource` does (complete candles, positive prices, the 17:00 New York halt hour dropped, D1 = the
tracker's `dailyNY` of the H1 candles).

## Data (fixed)

Council-data `research/candles/` (the repo's research candles), H1 built from them on the UTC hour:

| market | file | stands in for | span |
|---|---|---|---|
| NQ | HistData `nsxusd-histdata` NSXUSD M1 (EST without DST → UTC +5 h) | NQ futures | 2019-01 → 2026-10 |
| ES | HistData `spxusd-histdata` SPXUSD M1 | ES futures | 2019-01 → 2026-10 |
| YM | Dukascopy `idx/USA30IDXUSD_<year>.json.gz` 5m (UTC) | YM futures | 2023-01 → 2026 (no older YM exists here) |
| GC | HistData `xau-histdata` XAUUSD M1 | GC futures | 2019-01 → 2026-10 |

2019 is warm-up only (daily bias needs 50 closed daily candles). Trades are counted by the close of the signal candle.
YM has no 2020-2022 data, so its in-sample part is 2023 only; it is reported, and pooled into the index book as it is.
RTY has no research candles and is left out.

## Windows (fixed)

- **In-sample (IS):** signal close 2020-01-01 → 2023-12-31.
- **Out-of-sample (OOS):** 2024-01-01 → the end of the data (30-31 Oct 2026). "Now" in the brief means the end of the
  research candles; nothing after them is available offline.
- By calendar year 2020 … 2026 for every row.

## Books (fixed)

Verdicts are given per variant and per **book**: the **index book** = NQ + ES + YM pooled (the index A-rule), and **gold** =
GC (its own gold A-rule: buys, stop 0.3-0.75× daily ATR). Per-market rows are reported for every book.

## The five variants (fixed; no sixth)

Each is the live A-setup rule plus one change. Skill sections in brackets.

| id | variant | books | how (lab terms) |
|---|---|---|---|
| **V1 `atr50`** | **Stop-size cap at 0.5× daily ATR** instead of 0.75× (a wide stop on an hourly sweep = a late, stretched entry; §20, §22) | index, gold | filter `atr_max: 0.5` on `feat.atrR` (r0 / ATR14 of closed daily candles). The index half-size tight tier (0.15-0.3×) is unchanged. |
| **V2 `killzone`** | **ICT kill zones only**: London 02:00-05:00 and New York AM 07:00-11:00 New York time (§10, §18: "outside the kill zones the probabilities reduce drastically") | index, gold | keep a signal only when its H1 candle closes at 03, 04, 05, 08, 09, 10 or 11 h New York time (`feat.etHour`, DST-aware). |
| **V3 `htffvg`** | **HTF FVG confluence**: the sweep ran into an unfilled D1 or H4 fair value gap (§5 "highest probability: the swept swing sits inside a HTF FVG", §29) | index, gold | filter `htf_fvg: true` (`feat.htfFvg` is 'D1' or 'H4'). |
| **V4 `pd`** | **Premium / discount**: buys only in the discount half, sells only in the premium half, of the last 20 daily candles' range (§4 "buy only in discount, sell only in premium", §12) | index, gold | keep a signal only when the side-mirrored `feat.pd` < 0.5 (equivalently `feat.zone` is 'discount' for a buy, 'premium' for a sell). |
| **V5 `be1`** | **Break-even at +1R** instead of +1.5R (§9.7 break-even at the next internal high/low, about 1R on these H1 legs; §32) | index only (gold has no break-even in the live exit) | parameter `be: 1`. |

The baseline is the same run with no filter and no parameter override (the lab's `compare` base: rule A, live sizing, costs).

## Statistics (reported for every book, market, window)

n, win rate, average net R a trade, total net R, profit factor, max drawdown (R, on the time-ordered trades), t = mean /
(sd / √n); by year; gross R; costs × 2 as a stress; for the filters V1-V4 the OOS Welch t of the kept trades vs the A-setups
the filter drops (the baseline trades not in the variant), and for V5 the paired t of the R difference on the trades both
runs take (same signal).

## The bar (per variant × book, judged once; net R at costs × 1, live sizing)

**PASS** only if all hold:

1. OOS n ≥ 30.
2. OOS average R > 0 **and** at least **+0.05R** above the baseline's OOS average R.
3. IS average R above the baseline's IS average R.
4. OOS return over drawdown (total net R / max DD) at least the baseline's.
5. At least 2 of the 3 OOS years (2024, 2025, 2026) with total net R > 0.
6. Index book only: the OOS average R beats that market's own baseline on at least 2 of the 3 markets (markets with
   OOS n ≥ 10 in both runs; if fewer than 2 such markets, this check fails).

**FAIL** if the OOS average R is not above the baseline's OOS average R, or is ≤ 0.

**INCONCLUSIVE** otherwise (better out of sample, but short of one of the checks above).

Nine verdicts are given (V1-V4 × two books, V5 × index). With nine tries, one PASS by luck is plausible; t-stats are shown
so the owner can judge the strength. A t ≥ 2 on the OOS variant stream is noted as "strong", not required.

## Prior knowledge, declared

These overlap the data used here and were read before this plan was written; the contamination is disclosed, not removed:

- `research/edge/ict-filters` (HistData 2018-26, IS 2018-23 / OOS 2024-26, per-unit R, different costs and exits): "sweep into an
  unfilled D1/H4 FVG" passed weakly (OOS +0.237 vs +0.125, 2024 negative); "PD right half" was +0.316 OOS but not chosen in
  sample; "drop NY PM" failed. V3 and V4 therefore carry known OOS information on 2024-26 HistData. The kill-zone hours of V2
  are a different, narrower cut than the tracker's session labels tested there and in `research/edge/ict-sessions`.
- Skill §22: a 0.3-0.5× band had the best R a trade on 2023-26 cash indices but less total R in 2025-26 (V1 overlaps it).
- Skill §32 and `research/edge/ict-exits-replay` (§33): break-even at +1R was rejected on 2023-26 cash, NQ futures 2023-25 and
  the 2025-26 replay (V5 overlaps them).
- The index A-rule itself was fitted on 2023-26 cash data and the gold rule on 2019-26 spot gold, so the baseline is not
  out-of-sample; only the five changes are judged here.

## If a variant passes

It goes into `research/proposals/2026-11-09-ict-variants.md` for the owner, with the numbers and the change it would need.
No edit to `ict/*.mjs`, the skill's live rules, the replay or the desk. The owner approves any live change; a passing variant
would at most start as a paper shadow variant (the `nofri` pattern) after that.

## If nothing passes

The study reports the null result with every row, and no file outside `research/edge/ict-variants/` changes (no proposal file).

## What will not happen

- No variant, threshold, hour, window, cost, sizing or bar changes after the first run.
- No sixth variant, no combination of variants, no per-market selection of what to keep.

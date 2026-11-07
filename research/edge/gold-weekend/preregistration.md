# Gold daily systems: weekend handling — pre-registration

Written and committed **before** any replay of the variant below was run. The rules here decide the result; nothing in them is changed after the numbers are seen. Anything added later is labelled as a post-hoc diagnostic in `RESULT.md`.

## Question

Meridian's gold daily systems in `council/trader.mjs` read OANDA XAU/USD daily candles from the site proxy (`/md/bars?sym=xau&tf=1d`). These candles are bucketed in UTC. Every week they include a Sunday candle that only covers the 2-hour reopen, 22:00–24:00 UTC: the "stub". The live blocks have two weekend quirks. The research replay of #530 (`research/edge/gold-systems-oos/replay.mjs`) reproduces both, so live and research agree today.

1. **A Friday-close signal is never traded.**
   - The blocks drop the last daily candle as "forming" (`bars.slice(0, -1)`), even at the weekend.
   - Entry also requires `now - (last.time + 86400) < 86400`.
   - The window for Friday's candle therefore ends Saturday 00:00 UTC. The market reopens Sunday ~22:00 UTC, after the window has closed.
2. **The Sunday stub counts as a day.**
   - It is one of the N days in the lookbacks and one of the 14 days in ATR(14).
   - From Monday 00:00 UTC, the stub can itself be the signal candle.

Does the **intended** rule do better or worse than the current one? The intended rule acts on each real trading day's close. A Friday-close breakout buys at the Sunday reopen, and the Sunday stub is folded into Monday.

Systems tested:
- Gold trend N20 (`gtrend`): live. Judged.
- Gold daily engulf (`geg`): live. Judged.
- Gold trend fast N5 (`gtrend5`): shadow. Reported for reference only, with no verdict.

## Baseline: the current rule

The baseline is #530's `replay.mjs`, run **unchanged** from `research/edge/gold-systems-oos/` on #530's OANDA candle cache. #530's `analyze.mjs` applies its statistics unchanged.

Reproduction check, made before any comparison is read: the baseline must reproduce #530's committed `result.json` for `gtrend`, `gtrend5` and `geg`. That means the same n, mean, total R, t and max DD in every period (`oos`, `h1`, `h2`, `cal`, and the in-sample splits) at x1, x2 and gross. If it does not, the study stops and reports why.

## Variant: the intended rule (`replay-intended.mjs`)

The variant is a copy of #530's `replay.mjs`. Only the following weekend handling changes, and only for the Gold trend legs and Gold daily engulf. Gold H4 trendline keeps the raw daily candles; it is not in scope, and the systems do not interact.

1. **Weekend candles are folded into the next weekday.**
   - A daily candle whose UTC bucket starts on a Saturday or a Sunday is merged into the next weekday candle. That covers the Sunday stub every week, and the stray weekend quotes of 2006–13: 58 Saturday candles plus pre-reopen Sunday prints.
   - The merged candle takes the weekday's time and close, the open of the first weekend candle merged in, and the high and low across all of them.
   - Every N-day lookback, the 20-day average, ATR(14), the engulf base search (k = 3) and the daily stop ratchet run on these trading-day candles. The stub is no longer a day, and it can no longer be a signal candle.
2. **A day counts as closed when its UTC bucket ends.** This is unchanged. The Friday candle is therefore closed at the first run after Friday's close, which is the Sunday reopen.
3. **Freshness window.**
   - A daily signal acts within 24 h of the **reopen after its day's close**. The reopen is the start of the first M5 candle at or after the day's UTC end that is not in the spot-shut window (`spotClosed` from `council/fills.mjs`: Friday 17:00 to Sunday 17:00 New York).
   - For Monday to Thursday this is the day's end itself, so the window is unchanged.
   - For Friday it is the Sunday reopen, so a Friday-close breakout buys at the Sunday reopen.
   - The same rule applies after a holiday closure.
4. **No market entry or add during the spot-shut window.** No entry and no add is placed on a run whose M5 candle is a stray weekend quote (`spotClosed`). In the baseline, such a candle could serve as the entry price. Management already ignores these candles in both versions, through `spotSkip`.

Everything else is identical to the baseline:
- the run times;
- the entry prices: the close of the M5 candle the run falls in;
- stops, the add, the trail, the hold;
- the 20-day limit life of the engulf, the cap of 3 open engulf orders;
- costs and management.

## Windows

- **2006–17 (out of sample for this question):** positions entered from 2006-07-01 to 2017-12-31. This is #530's `oos` window. #530 used these years for the systems, but no weekend variant has been run on them.
- **2018–26:** positions entered from 2018-01-01 to 2026-11-06. This is #530's `cal` window, the period the rules were built on.
- Both windows count equally in the decision.

## Costs and unit

As #530:
- x1 costs $0.30 per unit per round trip; x2 costs $0.60. Each is charged as `cost / r0` R on every leg.
- A position is the first unit plus its add (trend legs), with R summed over the legs, dated by entry.
- Expired or missed limit orders are not positions.

## Decision bar, for `gtrend` and `geg` separately

**ADOPT the intended rule** for a system only if **all** of the following hold:

1. **2006–17:** the variant's mean net R per position is **not lower** than the baseline's, at x1 **and** at x2.
2. **2018–26:** the same, at x1 **and** at x2.
3. The variant's **total** net R at x1 over both windows together (2006-07-01 to 2026-11-06) is **higher** than the baseline's.

Otherwise the verdict is **KEEP** the current rule. Means are compared as `analyze.mjs` rounds them, to 3 decimals; an equal mean counts as "not lower".

`gtrend5` gets the same numbers, labelled reference. It gets no verdict.

## Reported alongside (not part of the decision)

- For each system and window: n, win%, mean net R per position (x1 / x2), total R, t and max DD, baseline next to variant.
- **The share of the variant's signals that are Friday closes.** A signal's day is the last closed trading day at the entry run.
- The share of the baseline's signals whose signal candle is a Sunday stub.
- Paired breakdown:
  - positions identical in both versions (same id, entry and stop);
  - positions changed;
  - positions only in the baseline;
  - positions only in the variant;
  - with each group's net R.
- The number of baseline entries placed on a spot-shut (stray weekend) M5 candle.

## What the result feeds

- No live code is changed by this study. It is paper research only.
- If a system passes, `RESULT.md` will write out the exact code change for `council/trader.mjs` as a proposal for the owner.

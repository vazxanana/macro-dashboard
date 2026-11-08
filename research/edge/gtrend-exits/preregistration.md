# Gold trend exits and re-entries: pre-registration

Written and committed **before** any variant was run. The grid, the data windows, the costs and the pass bar below decide the verdict; nothing in them changes after the results are seen. Anything added later is labelled a post-hoc diagnostic in `RESULT.md`.

## Question

Gold trend (`gtrend`, N20, live) and Gold trend fast (`gtrend5`, N5, shadow) are the council's two systems with the best honest out-of-sample edge: +0.49R and +0.37R a position on 2006–17 gold they never saw (t 1.8 / 1.9, `research/edge/gold-systems-oos`, #530). Their **entry** is a daily close above the prior N daily highs. Their **exit** is a chandelier: stop 2 × ATR(D1, 14) under the entry, lifted to (daily close − 2 ATR) on every newly closed day, one add at +1R with the same stop, no target, no time limit, and an immediate re-entry on the next qualifying daily close after a stop.

Can the **exit and re-entry side** be improved robustly, with the entry rule and the initial 2 ATR stop left exactly as live? The earlier studies tested the entry (N, random-entry control), the add on / off and the shorts; they never varied the trail, a time stop, break-even or the re-entry rule.

## Data

- OANDA XAU/USD mid candles through the site's free `/md/bars` proxy (`research/edge/gold-systems-oos/fetch.mjs`, same layout): **M5** for management and entries, **D1** for signals and the daily ratchet. UTC buckets, with OANDA's Sunday-evening daily stub, as live. From 2006-03-20, the first candle served, to 2026-11-06.
- Candles stay out of git.

## Harness: the live rule, replayed as in #530

- The run loop, windows, entry, management and fills are those of `research/edge/gold-systems-oos/replay.mjs`, restricted to the two trend legs: one run 4 minutes after every M5 close, 719 closed daily candles a window, a market entry at the close of the M5 candle the run falls in, a daily signal valid for 24 h after its day's close, stops checked on M5 candles with `stopFill` / `exitR` / `spotSkip` from `council/fills.mjs` (a gapped stop fills at the open; shut-market and rollover candles fill and stop nothing), the daily ratchet after management, as live.
- **Calibration gate, read before any variant number.** The `live` variant must reproduce the #530 figures for both legs on the same cost ($0.30 a unit round trip): 2006–17 n 75 / +0.489R a position / t 1.77 / max DD −5.38 for `gtrend` and n 129 / +0.372 / t 1.92 / −10.75 for `gtrend5`, with the halves +0.574 / +0.353 and +0.544 / +0.187, and the calibration window +1.336 (n 59) and +0.986 (n 99). A mismatch beyond rounding stops the study until it is explained.

## Costs (the council's paper-fill model, `council/fills.mjs`)

- **x1:** spread $0.30 a unit round trip (`spreadOf`, spot) plus slippage of half a spread on every market order (`SLIP_SPREADS` 0.5): the market entry pays $0.15, and any exit that is not a resting target pays $0.15. Every exit of these systems is a stop, trail, break-even, time or marked exit, so **x1 = $0.60 a unit round trip**, charged as 0.60 / r0 R on each unit (the first unit and the add each pay it).
- **x2 = $1.20 a unit round trip.**
- Gross and the #530 cost ($0.30) are also reported, the latter only for the calibration gate.

## Windows (positions dated by entry)

- **Untouched test window, decides the bar:** 2006-07-01 to 2017-12-31. Halves H1 2006-07 to 2011-12 and H2 2012-01 to 2017-12, as in #530.
- **Confirmation window, confirms and never chooses:** 2018-01-01 to 2026-11-06 (the period the live rule was built on). A position still open at the end of the data is marked at the last close.

## Variants (12, applied to each leg; the entry rule and the initial 2 ATR stop never change)

| Id | Change against live | Exact rule |
|---|---|---|
| `live` | none | Daily ratchet to (close − 2 ATR14), stop only rises; add one unit at market when a closed day is ≥ +1R above the first entry, same stop; re-entry allowed on the next qualifying daily close. |
| `T1.5` | tighter trail | Ratchet to (close − 1.5 ATR14). |
| `T3` | wider trail | Ratchet to (close − 3 ATR14). The stop stays at the initial 2 ATR until the ratchet exceeds it. |
| `T4` | wider trail | Ratchet to (close − 4 ATR14). |
| `TL10` | Donchian trail | Ratchet to the lowest low of the last 10 closed days (stop only rises). |
| `TL20` | Donchian trail | Ratchet to the lowest low of the last 20 closed days. |
| `S20` | time stop | As live, and the position (both units) exits at market on the first run after its 20th closed day since entry. |
| `S40` | time stop | As live, with 40 closed days. |
| `A0` | no add | As live, with no add. |
| `A2` | later add | As live, with the add when a closed day is ≥ +2R above the first entry. |
| `BE1` | break-even | As live, and once a closed day is ≥ +1R above the first entry the shared stop is at least the first entry. |
| `RF` | fresh-high re-entry | As live, and after a stop the next entry of that leg also needs the signal day's close above the highest daily high reached during the stopped position. |
| `C1` | combination fixed now | `T3` + `BE1`. |

The variants are run exactly as listed. No other variant, parameter or combination is added after the results are seen; anything else computed is a diagnostic and cannot pass.

## Statistics reported for each leg and variant

- n, win%, mean net R a position, total net R, t (mean / sd × √n), worst drawdown on the closed-position equity curve, return / drawdown (total R ÷ |max DD|), at x1, x2 and gross, for the test window, H1, H2 and the confirmation window.
- Per calendar year, positive years.
- Median days held; the share of exits by kind (stop, trail, break-even, time, marked).
- Difference against live: monthly net R of the variant minus live over every calendar month of the test window (0 in a month with no closed position), its t and a calendar-month block bootstrap P(difference ≤ 0), 10,000 resamples. Diagnostic, not part of the bar.

## Pass bar (fixed now)

A variant **beats live on the untouched window** if, at **both** x1 and x2 costs:

1. its total net R on 2006–17 is higher than live's, and
2. its return / drawdown (total net R ÷ |max DD|) on 2006–17 is higher than live's, and
3. its total net R is higher than live's in **both** halves (H1 and H2), and
4. its mean net R a position is above 0 on 2006–17 and in both halves.

A variant that beats live on the untouched window is then **confirmed** if, at both x1 and x2 costs on 2018–26:

5. its total net R is higher than live's, and
6. its return / drawdown is higher than live's.

The confirmation window confirms and never chooses: a variant that beats live out of sample but is not confirmed is reported as such and does not pass.

- **PASS:** at least one variant beats live on the untouched window and is confirmed, for the leg named. If several pass for a leg, the one with the highest 2006–17 return / drawdown at x2 is the proposal; the others are listed.
- **FAIL / keep the live exit:** no variant does so for either leg.

24 comparisons are made (12 variants × 2 legs). With that many, one or two chance passes of tests 1–4 are expected under no true improvement; the confirmation window and the x2 requirement are the guard, and the count of variants that clear the untouched window before confirmation is reported.

## What the result feeds

- A written proposal to the owner, nothing more. No live rule, config, trader, replay or site code changes. If a variant passes, it is at most a paper shadow proposal; the owner decides.

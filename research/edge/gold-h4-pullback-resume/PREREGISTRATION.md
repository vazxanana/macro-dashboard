# Gold: buy (sell) the end of a pullback inside an H4 closing-breakout trend: pre-registration

Written and committed on 14 Nov 2026, alone, before `run.mjs` existed and before any trade of this rule was computed. Paper
research only. A **stand-alone gold rule**: never a gate, exit, entry or size of the live gold book (Gold trend, Gold daily
engulf; owner item 44 forbids testing that book on 2006-17 again). No live rule, size, filter, stop, config, mirror setting
or council file changes, whatever this finds.

## The idea

The owner, in plain words: "if we are bullish on H4 and the pullback finished, focus only on buys, and vice versa".

## Duplicate check (done before writing this)

The same sentence has been tested several times, always with **structure-break** definitions (swing-based BO / ChoCh / VR /
CF) or an indicator:

- On gold: `mosha-retrace` (+0.02R a trade net, n 445, t 0.17), `mosha-cycle` (−0.22R, n 132), `mosha-sweep`,
  `mosha-select`, and the live rule's own backtest `mcycle-base` (branch `mcycle-base-study`, −0.574R, n 115, t −3.99): H4
  BO by swing, H1 ChoCh for the pullback, M15 / M5 break back for the entry.
- Off gold, the same frozen structure rule: `index-cycle`, `fx-cycle` (exit A −0.135R, n 1,892, t −4.48), `crypto-cycle`,
  `commodity-cycle` (gold left out); as a gate on the council's systems: `cycle-gate` (0 of 11).
- Indicator pullbacks: `rsi2-pullback`, `metals-rsi2` (daily RSI(2)), the gold momentum pullback (H1 momentum candle). Other
  H4 gold rules: `gold-h4-pinbar` (reversal at a 20-candle extreme), `gold-h4-trendline` (branch).
- Direction filters: `msnr-direction`, `msnr-entry` (key-level / engulf structure).

What is new here, and the only reason this study exists: **no swing, ChoCh, engulf or indicator is used**. The trend is a
20-candle closing breakout on H4 (a Donchian close), the pullback is a fixed 38.2 % retracement of the breakout leg, and its
end is a close above the recent H1 high. If the result says nothing different from the structure studies, that is itself the
answer: the idea fails however it is written down. The prior is weak (every reading above failed), and is said so here.

## Data (fixed)

- OANDA mid H1 XAU/USD, March 2006 to 13 Nov 2026, rows `[t, o, h, l, c]` (the copy fetched through the site's keyless
  candle proxy for an earlier study; kept out of git; read only). 125,704 candles.
- OANDA mid M5 XAU/USD, November 2006 to 13 Nov 2026 (the mosha-sweep copy, gzip JSON rows `[t, o, h, l, c]`, out of git),
  used only to manage trades inside each H1 hour (fills, stop, target). Where an hour has no M5 candle, the H1 candle is
  used, stop first.
- **H4 candles from H1, anchored at 17:00 New York, daylight-saving correct**: blocks start at 17, 21, 01, 05, 09, 13 New
  York time (`council/histdata.mjs` `nyOffsetH`, imported: UTC−4 in US daylight time, else UTC−5; 2006's old US calendar
  is warm-up only). An H4 candle is used only once closed: at its block's end (start + 4 h). No forming candle is read.

## The rule (buys; sells are the exact mirror)

1. **H4 breakout**: H4 candle j closes above the highest close of the 20 H4 candles before it (j−20 … j−1). Each new
   breakout (up or down) replaces any setup in progress.
2. **H4 bullish** at a moment T: the last closed H4 candle i (end ≤ T) has the breakout j among its last 30 (j ≥ i − 29),
   and no H4 candle in (j, i] closed below the lowest close of its own 20 prior candles (a down-breakout, which would have
   replaced the setup anyway).
3. **The leg**: start L = the lowest low of H4 candles j−20 … j−1; extreme X = the highest high since the break (the break
   candle's high, then every later H1 high). Each new extreme restarts the pullback.
4. **Pullback**: on H1 candles after the break candle's end, P = the lowest low since the extreme was set (its candle p).
   The pullback is "on" once X − P ≥ 0.382 × (X − L). **Any H1 close below L ends the setup** (no trade).
5. **Pullback finished (trigger)**, checked at each H1 close k after step 3-4 are updated with candle k: the pullback is on,
   k > p, and the close of k is above the highest high of the H1 candles max(p, k−5) … k−1 (the up-to-5 candles from the
   pullback low to the one before k). H4 bias must still be bullish at k's close (step 2).
6. **One signal per breakout**: a setup's first trigger is its only signal; if a position is open then, it is skipped.
   **One position at a time** across both sides.
7. **Entry** at the next H1 candle's open. **Stop** = P − $0.30 (sells: the pullback high + $0.30). Skip if the entry is
   already at or past the stop.
8. **Exits**:
   - **T1 (primary)**: target = X (the leg extreme at the trigger), taken only if X − entry ≥ 1.5 × (entry − stop), else
     no trade. Both sides.
   - **T2**: target = entry + 2R fixed (no distance filter). Both sides.
   - **T3**: T1's rule, buys only (gold's long drift).
   - All: out at the close of the 48th H1 candle counted from the entry candle. Managed on M5: a stop or target gapped
     through fills at the candle's open; stop first when one M5 candle holds both.

## Costs (fixed)

- $0.60 a round trip (spread $0.30 + $0.15 slippage an order, the gold-h4-pinbar study's figure), in R = 0.60 / risk.
- Financing on buys only: `council/fills.mjs` `nights(entry, exit)` × `FIN.xau.long` (0.000148 of price a rollover, the
  demo broker's measured swap, 11 Nov 2026) × entry / risk; imported, not copied. Shorts credited nothing. Today's rate is
  charged for every year (an assumption; the broker's past rates are not known).
- 2x costs = both charges doubled.

## Windows and statistics (fixed)

- A trade belongs to a window by its entry time. **In sample 2007-01-01 → 2016-12-31; out of sample 2017-01-01 →
  2026-10-31** (decisive). 2006 is warm-up only.
- t on calendar-month sums of net R (exit month; every month of the window counted, zero when empty). One-sided p from t
  (normal), **Holm over the three tests**.
- **Placebo, 40 seeds** (seed 20261114 + s): for each real out-of-sample trade, an entry at a random H1 candle's open on the
  same UTC day (any hour with a candle), same side, same stop distance in $, same target distance in $ (T1, T3) or 2R (T2),
  same 48-candle time exit and costs. Score = the mean net R of the 40 placebo sets.
- **Pass (per test)**: OOS net R a trade > 0 with month-sum t ≥ 2 and Holm p < 0.05; in-sample net > 0 (same sign); OOS
  net > 0 at 2x costs; OOS n ≥ 100; OOS net above at least 38 of 40 placebo means. **The verdict is T1's**; T2 and T3 are
  reported, and a T2 / T3 pass alone is a lead, never an edge.
- Reported for each test and window: n, gross / net / 2x net R a trade, t gross and net, win rate, drawdown, by year, by
  side, median stop in $.

## What would not change anything

A pass is a lead to be replicated on years or markets it did not use (silver is the natural one), never a council rule and
never part of the gold book. A fail ends this reading of the idea.

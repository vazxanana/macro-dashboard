# Big-candle fade plus: two complemented fades on markets never read for it (pre-registration, 24 Nov 2026)

Written and pushed alone BEFORE any run on the markets below. Research only: nothing live reads it, nothing is placed, no rule
is proposed.

## Why

`research/edge/big-candle-fade` (PASS before costs, negative after) showed that an outsized M15 candle gives part of itself back,
but the bid / ask takes more than the tilt. `EXPLORATION.md` tried pieces of the desk's other methods on the ten markets already
read (in sample, after the result was known) and kept two weak candidates that were positive after costs in both decades. This
study asks once, on markets the big-candle work never read, whether either survives costs.

## Data

- OANDA mid 5-minute candles from the shared cache (`EDGE_DATA`, `fetch-cache.mjs`), loaded from 2004-01-01 for warm-up.
- **Markets (10, none read by `big-candle-fade` or `EXPLORATION.md`)**: eurgbp, euraud, eurchf, gbpjpy, audjpy, cadjpy, gbpaud,
  nas100, spx500, de40 (each from where OANDA's 5-minute history starts). INCONCLUSIVE if fewer than 8 load.
- Frames from `combo-grid-3` `frames` (M15 UTC buckets; D1 = the 17:00 New York day). Exclusions: `combo-grid-2` `exclusions`.
- Windows by fill time: **2005-01-01 to 2014-12-31** (120 months) and **2015-01-01 to 2026-10-31** (142 months).
- **Costs (round trip, price units)**: `combo-grid-2` `COSTS` as written there for gbpjpy 0.014, eurgbp 0.00009, audjpy 0.010,
  cadjpy 0.010, euraud 0.00013, nas100 1.0, spx500 0.4, de40 1.5; **assumed here** eurchf 0.00010 and gbpaud 0.00016. All are
  assumed, not measured on these markets at these hours (overnight spreads are wider than these): the robustness check below
  charges 1.5x.

## The signal (common)

A closed M15 candle j with body > 1.5 x ATR(14) of the 14 M15 candles before it and range (high - low) >= 0.5 x ATR(14) of the
last CLOSED D1 candle at its close. d = the body's direction; the trade is the FADE, side -d. Signals, features and fills are
those of `explore.mjs` `rows` (committed before this file), which uses closed candles only.

## Rule A: overnight shock fade

The candle starts in **21:00-06:59 UTC**. Market entry at the open of the first 5-minute candle starting at or after its close.
Stop past the candle's extreme by 0.1 x the M15 ATR. Target: the candle's OPEN (full retrace), taken only when it is 1R or more
away; otherwise no trade. Time limit 1 day from the fill (out at that 5-minute close).

## Rule B: rejection wick + confirmation

The candle's wick beyond its close (extreme minus close, as a share of its range) is **>= 25 %**, and the next M15 candle closes
the other colour. Market entry at the open of the first 5-minute candle starting at or after that next candle's close. Stop past
the big candle's extreme by 0.5 x the M15 ATR. Target 2R. Time limit 1 day.

Both: every trade has a stop on its losing side (else no trade); a risk under the round-trip cost is no trade; stop first when one
5-minute candle holds stop and target; a gap through either fills at the open; trades overlap freely.

## The bar (judged AFTER costs this time, pooled over the ten markets)

A rule passes when ALL hold:
1. n >= 300 in each window;
2. mean R after costs > 0 in each window;
3. month-sum t of R after costs >= 2 over the whole 262 months, and Holm-adjusted one-sided p < 0.05 over the 2 rules;
4. robustness: mean R after costs > 0 with the best 1 % of trades removed, and > 0 at 1.5x costs.

Verdict: **PASS** if either rule passes; **FAIL** otherwise. Reported beside: before-cost figures, per-market rows, the median
trade, the 10 best trades' share.

## What a result means

A pass would be the first after-cost result of this fade, on markets it never saw, with assumed costs: a candidate for a forward
paper record that needs the owner, never a live rule and never called an edge without its n and t. A fail closes the big-candle
fade line on these timeframes. One run, no variants.

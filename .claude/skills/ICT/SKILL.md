---
name: ICT
description: ICT liquidity concepts as testable rules - IPDA market profiles (consolidation, expansion, reversal, retracement), internal vs external range liquidity, institutional order flow, dealing ranges with premium/discount, one-candle ranges, turtle soup at "lows that broke highs / highs that broke lows", deferred delivery, relative equal highs/lows, NWOG/NDOG, candle anatomy (OHLC/OLHC), LTP/ITP/STP alignment, Daye's quarterly theory, and the iFVG (inversion fair value gap) entry model with its stops, break-even and grading. Use when analysing gold/NQ/forex direction or entries with ICT terms, when coding or backtesting an ICT/iFVG/turtle-soup rule, or when the owner asks about premium/discount, DOL, sweeps or inversions.
---

# ICT — liquidity, ranges and the iFVG entry

Owner-supplied study material (6 Nov 2026): "Premium & Discount" (IPDA profiling, IRL/ERL, order flow,
ranges, premium/discount, equal highs/lows, NWOG/NDOG, sponsorship, market-maker models), "DOL & Turtle
Soup" (LTP/ITP/STP, candle anatomy, deferred delivery, turtle soup) and "iFVG Trading Concepts" (complete
iFVG strategy, V-shape recovery, candle closure ratings, quarterly theory). The course files are not in
this repo (paid material, public repo); this file restates the rules in our own words as a spec.

## 1. Vocabulary
- **FVG** (fair value gap, internal range liquidity, IRL): 3-candle gap. Bullish: low[i] > high[i-2]; bearish: high[i] < low[i-2]. A **volume imbalance** (gap between one body's close and the next body's open, wicks overlapping) counts as an FVG. NDOG = previous day close → new day open; NWOG = Friday close → Sunday open.
- **External range liquidity (ERL)**: old highs/lows (buy stops above highs = BSL, sell stops below lows = SSL). Engineered liquidity is preferred: relative equal highs/lows (EQH/EQL), trendline lows/highs (LRLR = low-resistance liquidity run).
- **HRLR**: high-resistance level — highs/lows already run several times; price tends to *defer* there (see 7).
- **Ebb and flow**: after ERL is taken, price seeks IRL (an FVG); after IRL is filled, it seeks the next ERL.
- **Market only does two things**: rebalance an imbalance, or run an old high/low.

## 2. Market profile (IPDA)
- Four profiles: consolidation, expansion, reversal, retracement → two states: ranging or trending. Do not trade inside consolidation.
- Consolidation is always followed by expansion (never directly a reversal/retracement). After a range: either (a) breakout in the bias direction → retrace → expansion (continuation), or (b) stop hunt against the bias → reversal → expansion (AMD: accumulation, manipulation, distribution).
- Sequences: reversal = accumulation → manipulation (false expansion) → reversal → retracement → expansion; continuation = accumulation → expansion → retracement → expansion. If the prior trend was up, a range should NOT break its low as a "reversal"; it should run its highs and then reverse.

## 3. Institutional order flow (IOF) — the trend
Bearish IOF only if ALL: lows are broken while highs are rejected; up-close candles (bearish order blocks) hold price down; bearish FVGs hold while bullish FVGs fail. Bullish is the mirror. Trade with IOF until a HTF key level is reached.

## 4. Ranges, dealing range, premium/discount
- A range runs stops-to-stops: sell stops → buy stops = bullish range; buy → sell = bearish.
- Levels: range high, 50% (equilibrium), range low. 50% = take-profit for counter-trend trades, and a close beyond 50% = continuation to the far side. Consolidation at 50% tends to precede a fast run to the opposite end.
- **Dealing range**: bullish = a swing low is taken, then an expansion leg breaks a swing high; the leg low→new high is the range. Bearish mirror. Above 50% = premium, below = discount.
- Buy only in discount (at a discount key level: FVG, order block, NWOG/NDOG), sell only in premium. Counter-trend LTF trades inside the range aim for equilibrium only.
- **One-candle range** (D1/H4/W1 candle): with a bullish bias, price runs the candle's low, taps a HTF key level, closes back inside the candle range (= turtle soup) → wait for a LTF change in state of delivery → target the candle's 50% then high. Bearish mirror.

## 5. Turtle soup / DOL ("lows that broke highs")
- Every liquidity level has two uses: a target (DOL) or a reversal point (turtle soup). Bias decides which.
- When a high breaks, the swing low that produced that break ("low that broke the high") holds retail stops.
  - Bullish HTF bias: expect that low to be swept INTO a HTF discount key level below it, then an aggressive move up (low-resistance run).
  - Bearish bias: that low is the target (DOL) after a HTF premium key level is hit.
- Highest probability: the swept swing sits inside/near a HTF FVG in the right half of the dealing range.
- Relative equal highs/lows: bullish → target EQH; if EQL sit below, wait for them to be taken first, then buy. Bearish mirror.

## 6. Candle anatomy (daily/weekly bias)
- Bullish candle prints open → low → high → close (OLHC); bearish open → high → low → close (OHLC). Reversal candles have the long wick into a key level / liquidity first. Consolidation candles: avoid.
- Opportunities: around the open (the manipulation wick), mid-candle (expansion), the close.

## 7. Deferred delivery
At an HRLR level the market may first run the OPPOSITE liquidity (e.g. bullish bias: highest up-close candle at the HRLR sends price down through sell stops) before the main run to the DOL. Don't chase into HRLR; expect the opposite sweep, then enter.

## 8. Perspective alignment
LTP (MN/W1/D1: what will the next daily candle do, where is the DOL) → ITP (H4/H1, sometimes M30: route via ranges, PD arrays) → STP (M15/M5/M1: entry, time of day). All three must agree; if one is unclear, no trade.

## 9. The iFVG entry model (STP)
1. **Liquidity sweep first** (mandatory): an obvious pool taken — EQH/EQL, session high/low, swing high/low, LRLR.
2. **Reversal**: after SSL is swept, a bearish FVG created in the down-leg is **inverted** = a candle BODY closes above its top → buy. Mirror after BSL. Prefer a single obvious FVG; a series of consecutive gaps counts as one big gap (all must be closed through).
3. **Continuation**: after a reversal leg, wait for a retrace to the leg's 50% and/or into an FVG, then invert an opposing FVG in the trend direction.
4. **V-shape** (most common winner): ≤ 6 candles from the sweep to the inversion; single iFVG; a rejection off another FVG makes it better.
5. **Validity**: the next internal high/low (the break-even point) must not already be taken by the inversion candle.
6. **Stops**: fail stop (recommended) = a candle body closing back through the iFVG → out, hard stop at/between the swing; swing stop = beyond the sweep extreme; tight stop = beyond the iFVG on very strong closes.
7. **Break-even**: when the next internal high/low (or the next FVG if none) is reached.
8. **Targets**: the DOL — preferably engineered liquidity (EQH/EQL, untested highs/lows); ≥ 1R. HTF iFVG gives the HTF DOL; the LTF model enters toward it (e.g. H1 iFVG → M1 entry, H4 → M5).
9. **Grade** (candle closure rating, /10): candle strength /4 (body size and close location of the inversion candle), inversion speed /3 (candles from sweep to inversion), risk-to-reward /3. A+ 10, A 9, A- 8, B+ 7, B 6, B- 5, C 3-4, F 0.
10. "No model" = no sweep and not in a reversal/continuation → skip.

## 10. Time (Daye's quarterly theory)
Time is fractal in quarters: year (Q1-Q4 by quarter), month (weeks 1-4, partial first week ignored), week (Mon-Thu, Friday separate), day (6 h: Asia, London, NY AM, NY PM), session (90 min). Typical shape inside a cycle: Q1 accumulation, Q2 manipulation (Judas swing), Q3 distribution (the real move), Q4 continuation/reversal. NY AM for gold ~ 12:00–18:00 UTC; the 9:30 ET equity open is the key NQ event.

## 11. Separate edge — never mixed with the council systems
Owner, 6 Nov 2026: ICT is a different edge and approach. Do not merge its rules into the council
trader's systems (replica, Mosha BO, trend, H4 trendline, daily engulf, momentum pullback), do not add
it to their reports or filters, and do not use their rules to filter ICT. Results live apart:
council-data `research/ict/` and this file.

## 12. First test (6 Nov 2026) — spot gold M1 2023-01 → 2026-10, halves 2023-24 | 2025-26
Mechanical iFVG reversal: a confirmed swing low (3-bar pivot, last 96 bars) is swept; within 6 candles a
body closes back through the most recent bearish FVG of the down-leg (inversion) → buy at that close;
stop 0.10 under the sweep low; mirror for sells. Costs 0.30 spread + 0.20 extra per trade.
- Raw model, every sweep + inversion: M5 −0.16R | −0.04R a trade (≈2,500 a year) — loses; M15 ≈ 0.
- **LTP bias + premium/discount makes it work** (bias = prior daily close vs its 50-day average; buys only in
  the discount half, sells only in the premium half, of the last 20 daily candles' range):
  - **H1 entry, 2R target**: +0.54R | +0.64R a trade (n 32 | 40), worst drawdown 3.6R | 3.1R; every year
    positive (2023 +1.4R, 2024 +15.8R, 2025 +13.3R, 2026 +12.2R); ~19 trades a year, win rate ~60%.
  - **M15 entry, 3R target**: +0.28R | +0.25R (n 171 | 169), drawdown 14R | 12R; every year positive; ~90 a year.
  - Deeper discount is better (pd < 0.4 beats < 0.5 beats < 0.6; ≥ 0.7 loses) — consistent with the theory.
  - Holds for a 10/20/50-day bias average with the 20-day range; a 10- or 40-day range is weaker.
  - Both sides positive (buys stronger over 2023-26's bull market).
- Break-even at the internal high, the "valid entry" check, V-speed ≤ 3 candles and candle-strength grades
  added nothing on top. M5 entries lose with every filter (noise + spread).
- Turtle soup on the previous day's range (H1 runs PDL/PDH and closes back inside): weak and inconsistent
  (best +0.18R | +0.04R with the discount filter); not an edge alone.
- Status: research result only; nothing trades it.

## 13. Target markets: US indices (owner, 6 Nov 2026): NQ, S&P 500, Dow and similar
Gold was only the first test bed. The edge is meant for index futures/CFDs (the course is NQ-centred:
9:30 ET open, relative equal highs/lows engineered daily).
- NQ futures 1m (owner file, Dec 2022 → Dec 2025, cost 0.5 pt a trade), same mechanical iFVG:
  - H1, 3R: +0.08R | +0.09R a trade (n 450 | 203), every year positive (2023 +24.8R, 2024 +12.6R, 2025 +18.7R);
    buys +0.22R | +0.37R, sells lose (−0.05 | −0.16) — most of the edge is NQ's 2023-25 up-drift.
  - M15 / M5: about zero or negative in every session; the 9-11 ET window is +0.05R (2R), not enough.
  - The gold filter (daily trend + discount/premium of the 20-day range) leaves too few NQ trades
    (NQ rarely sits in discount while trending up) and does not hold on NQ.
- S&P 500 and Dow: Dukascopy 1m → 5m pulled by the research probe into council-data
  research/candles/idx/ (USATECHIDXUSD, USA500IDXUSD, USA30IDXUSD, 2023 → today); results to follow.

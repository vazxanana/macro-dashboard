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

## 14. Best filter: the A-setup (6 Nov 2026)
Search: ~30 features (side, daily bias, premium/discount, depth, previous-day sweep, session, grade and its parts,
validity, body, close location) alone and in pairs, ranked on NQ futures 2023-24, judged ONLY on unseen data: NQ 2025
and the 2026 CNBC replay of NQ, ES, YM and RTY (cost 0.5 / 0.5 / 2 / 0.2 points a trade).
- The best-looking filters on 2023-24 (e.g. deep discount without a previous-day sweep: +0.68R) mostly FAILED out of
  sample: classic overfitting. Only filters positive in all three sets count.
- **A-setup = the signal goes AGAINST the daily bias (prior close vs its 50-day average) AND grades >= 7/10 (B+).**
  3R target, R a signal: NQ 2023-24 +0.20 (n 94), NQ 2025 +0.16 (36), 2026 replay all indices +0.23 (111),
  vs all signals +0.04 / +0.07 / +0.02. NQ by year +10.8R, +7.5R, +5.8R; replay ES +16.1, YM +6.8, RTY +6.5, NQ −4.5.
  Both sides positive. Grade >= 8 is similar with fewer trades; >= 5-6 breaks in NQ 2025. 2R target is weaker.
- Control: the same grade WITH the bias loses (−0.28R / +0.13R / −0.14R) — the bias side is what matters. A reversal
  model works as a turn at an extended move (ICT: turtle soup at a HTF key level), not as a with-trend pullback.
- In the tracker: `isASetup()`; records carry `aset`; an A-setup is never blocked by a weaker open signal; all signals are
  still recorded. The desk defaults to "A-setups" (switch to "All signals").
- Forward samples are small; keep watching "What works" per market (NQ was the weak one in 2026).

## 15. Better exit: trail from +2R (6 Nov 2026)
Each signal's next 72 H1 candles ([best, worst, close] in R) were replayed under other exits, on NQ 2023 / 2024 / 2025
(every signal as its own trade, cost 0.5 pt) and the 2026 replay of all four indices.
- Fixed 3R (old): all signals +0.07 / +0.12 / +0.06 / +0.06R a signal. Fixed 2R is worse; 4R is better.
- **No fixed target; from +2R the stop trails 1.5R behind the best price; 48 h max**: all signals +0.09 / +0.12 / +0.08 /
  +0.16R; A-setups +0.13 / +0.12 / +0.01 / +0.42R (3R gave +0.12 / +0.15 / −0.11 / +0.29). Every trail between +1.5R and
  +3R start and 1-2R distance beats the fixed 3R on all signals (a plateau, not a lucky point); this one has the best
  worst-year for A-setups. Break-even at +1R / +1.5R adds nothing; 72 h holds help 2023-24 but hurt 2025.
- A-setups on NQ alone, every signal counted: 2023 +, 2024 +, 2025 ~0 (with the 3R target 2025 was −0.11R): the
  against-the-bias filter weakened in NQ's 2025 trend year; the 2026 replay on all four indices is strongly positive.
- Tracker and replay: `P.trail = [2, 1.5]`, records carry `trail`, `stop0`, `trailMoved`, exit 'trail'; `t1` is null.

## 16. Clusters: one bet, not four (6 Nov 2026)
The indices move together: in the 2026 replay 154 A-setups fell into 120 clusters (same side, different indices, within
3 h of the first): 93 single, 20 of two, 7 of three. With the trailing exit:
- every trade at 1R: +66.8R, worst drawdown 12.9R; one bet per cluster at 1R split across its trades: +43.5R, DD 8.9R;
  **the highest-grade index of each cluster only: +53.2R (+0.44R a bet), DD 8.9R** (best return per drawdown); first to
  signal +46.2R. No index is a reliably better pick than the grade.
- Tested and rejected the same day: a limit entry on a pullback toward the stop (0.25-0.5R, 3-12 h) — mixed on all signals,
  worse on A-setups; session filters for A-setups — no pattern holds in all four sets (Asia positive but small samples).
- Desk: "One per cluster" view (A-setups, ★ pick of n); clusters are computed on the page.

## 17. A+ tier: strong displacement, not the NY afternoon (6 Nov 2026)
Second-filter search inside A-setups (trailing exit, cost included), 20 features, kept only those better in ALL four sets
(NQ 2023 / 2024 / 2025, every signal independent; 2026 replay of four indices):
- body of the inversion candle >= 70% of its range: 4/4; not in NY PM (12-16 ET): 4/4; everything else (sweep of the
  previous day, depth in the range, validity, speed, room, grade >= 8, side, DOL) at most 3/4.
- Body threshold plateau 0.6-0.7 (0.8 too strict). **A+ = A-setup + body >= 0.6 + not NY PM**: total R
  NQ23 +17.1 (A +9.5), NQ24 +12.2 (+9.6), NQ25 +3.1 (+0.6), 2026 +66.1 (+67.3, fewer trades); worst drawdown lower in all
  four (10.4 / 8.0 / 8.6 / 9.5 vs 11.4 / 14.0 / 11.9 / 12.9). R a trade +0.37 / +0.24 / +0.08 / +0.62.
- Fits ICT: displacement (a strong body) shows intent; the afternoon session is the low-quality part of the NY day.
- About 20 features were tried, so expect some shrinkage live. Tracker/replay: `isAPlus`, records carry `aplus`;
  desk filter "A+" (A-setups stay the default until the forward sample confirms).

## 18. Cross-check with the MMXM skill (owner's skill collection, 6 Nov 2026)
The `mmxm-market-maker-model` skill (ICT Market Maker Model) is the closest relative of this edge. Its rules, tested here on
the H1 iFVG model (NQ 2023-25, every signal independent, trailing exit):
- **Kill zones** ("outside the kill zones the probabilities reduce drastically"): agrees with §17 — NY PM signals are the
  weak ones; the A+ tier already drops them.
- **Midnight-open filter** (buy below the 00:00 NY open, sell above): does NOT help this model. A-setups on the "wrong"
  side did better in 2023 (+0.34R vs −0.06R) and 2025 (+0.17R vs −0.31R), equal in 2024; same for all signals. That rule
  belongs to MMXM's intraday M5/M1 models, not to an H1 reversal; not adopted.
- Still to test: previous-day high/low as the target (MMXM: the easiest daily target, ~90% of days), the Day-4 model, and
  the NY 08:00-12:00 window with a 09:00-10:30 reversal sweet spot for an M5 version of the desk.

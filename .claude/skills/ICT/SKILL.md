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

## 19. Reality check: S&P 500 and Dow 2023-26 (6 Nov 2026) — the edge is NOT proven
Dukascopy cash-index CFDs (USATECHIDXUSD, USA500IDXUSD, USA30IDXUSD) 1m → 5m → H1, Jan 2023 - Nov 2026, the tracker's
own signals(), every signal independent, CFD costs NQ 1 / ES 0.5 / YM 2.5 points, R a signal:
| | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|
| NQ A+ trail | +0.51 | +0.27 | −0.04 | 0.00 |
| ES A+ trail | −0.13 | +0.08 | −0.43 | −0.07 |
| YM A+ trail | +0.41 | +0.18 | −0.03 | −0.13 |
| 3 indices A+ trail (sum) | +23.5R | +22.2R | −23.3R | −6.8R |
| 3 indices A trail (sum) | +2.2R | +27.2R | −23.6R | −2.2R |
| 3 indices all signals trail | +36.4R | +70.8R | −19.0R | −71.1R |
- Futures (CNBC 2026, owner's NQ file 2023-25) and cash CFDs give DIFFERENT H1 signals: only ~40% of signal times match
  in Apr-Nov 2026, and 2026 A-setups were +0.49R (NQ futures) vs +0.09R (NQ cash), +0.14R vs −0.24R (YM). The model is
  sensitive to the data feed; the tracker trades futures, so futures results matter most, but our futures history is short.
- Honest summary: positive in 2023-24, flat to negative in 2025, feed-dependent in 2026. The A / A+ filters and the trail
  were chosen on data that now looks favourable; treat them as hypotheses. **Paper only; forward-test before any risk.**
  S&P (ES) is the weakest index on cash data in every year but 2024.
- Replay records from the January-February Dukascopy fill carry `cash: true`.

## 20. Stop floor: stop >= 0.3x the daily ATR (7 Nov 2026) — now part of the A-setup
Walk-forward on NQ, S&P 500 and Dow cash 2023-26 (chosen on 2023-24, judged on 2025-26), every signal independent,
trailing exit, CFD costs. New regime features: daily efficiency ratio, volatility percentile, stretch from the 20-day mean,
weekday, and the stop as a share of the daily ATR (`feat.atrR` = r0 / ATR14 of closed daily candles).
- Most in-sample winners failed out of sample again (e.g. trend days + Asia: +0.62R → −0.20R).
- The one theme that held: **tight stops lose**. Hourly sweeps with a stop under ~0.3 daily ATR get hunted by noise.
- A-setups, 3 indices: all → 2023 −1.0R, 2024 +27.2R, 2025 −23.6R, 2026 −2.2R (worst DD 33 / 46);
  **with stop >= 0.3 ATR → +20.4R, +25.9R, +1.3R, +16.8R (DD 12 / 16)**; about 45% of A-setups remain (~90 a year).
  Thresholds 0.2-0.4 all positive in both halves; >= 0.5 loses again (a band, not "the wider the better").
- NQ futures 2023-25 (independent data): A → +9.5 / +9.6 / +0.6R (DD 11.4 / 14.0 / 11.9); A + floor →
  +11.1 / +13.8 / +8.3R (DD 7.5 / 6.5 / 9.2): more profit and less drawdown in every year.
- A+ adds little once the floor is in (cash: +25.6 / +20.3 / −3.8 / +14.1 vs A +20.4 / +25.9 / +1.3 / +16.8); kept as a tier.
- Code: `feat.atrR`, `RISK_FLOOR = 0.3` and `isASetup()` in ict/tracker.mjs (the replay re-runs on tracker changes).

## 21. Exits and portfolio controls re-checked with the stop floor (7 Nov 2026)
On A-setups with the stop floor (§20), cash NQ/ES/YM 2023-24 | 2025-26 and NQ futures 2023 / 2024 / 2025:
- **Time exit 36 trading hours (36 closed H1 candles) instead of 48** — cash +37.0R dd 10.1 | +36.0R dd 11.7 (48 h:
  +46.3R dd 12.3 | +18.0R dd 16.3); NQ futures +10.9 / +13.9 / +9.8R, dd 4.2 / 5.6 / 6.5 (48 h: +11.1 / +13.8 / +8.3R,
  dd 7.5 / 6.5 / 9.2). Plateau 30-40 h; 60-72 h collapses in 2025-26. Total profit up, drawdown down in every set; only
  2023-24 cash profit is lower, so it would NOT pass the council's strict both-halves rule (ICT is a separate edge).
  The live tracker and the replay now count the hold in closed H1 candles (weekends don't count), as in the research.
- Fixed 2R / 3R / 4R targets: less profit than the trail in 2023-24 and no better in 2025-26 (4R: dd 31). The trail stays.
- Portfolio controls did not help: one bet per cluster (2025-26 return/DD 0.4 vs 1.1 for every trade), 1R split across a
  cluster 0.8, daily loss caps 1-3R no change, half size after 3 losses 0.2. Take every A-setup at the same 1R.
- External evidence (deep research report "ICT and gold system improvements"): stops placed just beyond swept levels sit
  in stop-cascade zones (Osler); intraday momentum into the close argues against afternoon reversals; no peer-reviewed
  test of FVG / iFVG / kill zones exists.

## 22. Stop band: 0.3x to 0.75x the daily ATR (7 Nov 2026) — now part of the A-setup
- Idea from the deep-research report (volatility-scaled stops): a stop far wider than the day's range is a late, stretched entry.
- Test, A-setups (against bias + grade >= 7), trail from +2R, 36 H1 hold, costs in:
  - Cash NQ+ES+YM 2023-24 | 2025-26: floor 0.3 only +37.0R dd 10.1 | +36.0R dd 11.7; band 0.3-0.75 +37.7R dd 7.6 | +48.6R dd 10.8 (more R, less drawdown in both halves). Band 0.3-0.5 has the best R per trade but fewer trades and less total R in 2025-26.
  - NQ futures 2023 / 2024 / 2025: drawdown 5.0 / 5.4 / 3.0 vs 6.3 / 7.5 / 6.1; R +8.9 / +13.1 / +20.1 vs +9.6 / +9.9 / +13.7.
- Rejected: widening stops under 0.3 ATR to 0.3 ATR instead of skipping (-1.6R | +4.0R, dd 41): tight-stop signals are bad trades, not just noise-stopped ones.
- Code: `RISK_CAP = 0.75` in `isASetup()` (ict/tracker.mjs).

## 23. News days (7 Nov 2026): skip jobs-report mornings, keep FOMC days
- A-setups with the §22 band, 2023-24 | 2025-26 cash NQ+ES+YM: live +37.7R dd 7.6 | +48.6R dd 10.8.
- Skip signals on the first Friday of the month before 10:00 ET (the 08:30 jobs report): +41.8R dd 6.9 | +51.7R dd 10.8. NQ futures 2023 / 2024 / 2025: +9.9 / +15.2 / +21.1R vs +8.9 / +13.1 / +20.1R; all 4 such futures signals lost. Small sample (about 3 signals a year) but the logic fits: a sweep made by the release candle is news, not a liquidity run. Adopted (`nfpMorning` in `isASetup`).
- FOMC days are NOT skipped: skipping them costs 20R in 2023-24 (6 signals, +20.4R); skipping only shorts, only before 14:00 ET, or the day before also fails.
- First Friday of the month is a proxy for the jobs report (it can move to the second Friday); the proxy is what was tested.

## 24. Why the 2026 desk replay looks worse (7 Nov 2026) — rules unchanged
- 2026 futures replay (CNBC, Jan–Nov): all signals +51.2R (406) but A-setups only +12.8R (93), dd 13.4. Owner: "ICT results only look worse".
- The gap is the tight-stop slice (stop < 0.3x daily ATR, against bias): +64R on the 2026 futures replay, from about 10 outliers (top 10 = +53R).
  The same slice loses everywhere else: cash 2023-24 −37.4R, cash 2025-26 −56.5R, NQ futures 2023-25 −8.1R, and cash over the very same 2026 months −18.6R.
  It is feed- and luck-dependent, so the §20 floor stays.
- A-setups are the only filter positive in all four datasets (cash 23-24 +37.7 dd 7.6 | cash 25-26 +48.6 dd 10.8 | NQ fut +42.1 dd 5.4 | 2026 replay +11.8 dd 14.0 after costs).
  A+ is also positive in all four (+37.6 dd 5.7 | +28.8 dd 9.0 | +26.9 dd 7.2 | +20.7 dd 7.7) and is the steadier view for 2026, but it is not better in every set.
- Exits: 2026 prefers quicker exits (trail from +1.5R by 1R: +18.5R dd 9.5; 24 h: +21.0 dd 7.2). Both lose profit on 2025-26 cash and NQ futures. Unchanged.
- Read: 2026 is the edge's weakest stretch (≈ +0.1R a signal), not a broken rule. Judge it on the forward A+ count (§19), not on the replay's all-signals line.

## 25. Tight stops back in at half size when they have A+ quality (7 Nov 2026)
- Owner: "we had way better results before". The desk's 2026 replay history (council-data `ict/replay.json` per commit):
  - before 7 Nov: A-setups 166 trades +72.8R, A+ +74.9R;
  - after the §20 floor: 104 trades +17.6R;
  - after the 36 h hold: +10.4R;
  - after the §22 cap: +2.6R;
  - after §23: +12.8R.
  The floor removed 62 A-setups worth about +55R in 2026. No code bug; the floor was tuned on 2023-26 cash and NQ futures 2023-25, where tight stops lose.
- Four datasets (against + grade >= 7, cap 0.75, trail 2/1.5, 36 h, costs): cash 23-24 | cash 25-26 | NQ fut 23-25 | 2026 futures replay.

  | rule | cash 23-24 | cash 25-26 | NQ fut 23-25 | 2026 replay | total |
  |---|---|---|---|---|---|
  | floor 0.3 | +37.7 dd 7.6 | +48.6 dd 10.8 | +42.1 dd 5.4 | +9.2 dd 16.2 | +137.6 |
  | floor 0.15 | +12.0 dd 24.3 | +23.5 dd 19.6 | +24.0 dd 11.1 | +62.7 dd 14.5 | +122.2 |
  | **floor 0.3 + tight 0.15-0.3 only with A+ quality (body >= 0.6, not NY PM) at half size** | +35.2 dd 9.8 | +39.3 dd 12.7 | +40.2 dd 7.4 | +29.8 dd 13.2 | +144.5 |
  | same at full size | +32.8 dd 14.6 | +29.9 dd 19.7 | +38.3 dd 10.0 | +50.5 dd 12.8 | +151.5 |
  | all tight at half size | +24.9 | +36.1 | +33.0 | +35.9 | +129.9 |

- Adopted: the half-size A+ version. It is the only one positive in all four, best total at a moderate drawdown, and 2026 rises from +9 to +30R.
- Code: `RISK_TIGHT = 0.15`, `TIGHT_SIZE = 0.5`, `sizeOf()` in ict/tracker.mjs. Records carry `size`; R is stored × size (`Rraw` = per unit), so every desk total counts them at half weight. The desk shows a "½ size" pill.

## 26. Gold futures (GC), EUR/USD and GBP/USD (7 Nov 2026) — each market its own A-setup rule
Owner: add GC, EURUSD and GBPUSD. The tracker's own signals() run over HistData 1m 2018 → Oct 2026 (FX in EST → UTC; spot gold for GC).
Every signal independent, live exit (trail 1.5R from +2R, 36 H1 hold). Costs: gold 0.30, EUR/USD 0.6 pip, GBP/USD 0.9 pip.
Windows: 2019-22 | 2023-24 | 2025-26.
- **The index A-setup does not carry over.**
  - Gold A-setups: −5.3 | −3.3 | −9.4R.
  - EUR/USD: −13.1 | +7.4 | −5.7R.
  - GBP/USD: −4.0 | +23.2 | −0.5R.
- **Gold:** signals WITH the daily bias win (+9.2 | +36.4 | +37.8R), like the first gold test (§12).
  - About 1,000 single filters and filter pairs/triples were scanned; only simple ones that held every year were kept.
  - **Gold A-setup = buys only, stop 0.3-0.75x the daily ATR**: +56.7R dd 10.8 | +36.0R dd 8.3 | +32.8R dd 8.1.
  - Positive every year: 2019 +21.9, 2020 +15.8, 2021 +7.2, 2022 +11.8, 2023 +23.1, 2024 +13.0, 2025 +32.7, 2026 +0.1 (44 signals).
  - The same tight-stop lesson as the indices.
- **EUR/USD:** London-session signals only: +28.6R | +11.7R | +14.9R, 7 of 8 years positive (2020 −4.6R), about +0.09R a trade.
  - London + fast inversion looked best in the scan but flips by year; rejected.
- **GBP/USD:**
  - London only loses in 4 of 8 years.
  - Against bias + grade >= 8 + previous-day sweep (turtle soup) is positive in 6 of 8 years (2022 −11.3, 2025 −5.1) and fails on EUR/USD.
  - No A-setups: GBP/USD is tracked and shows under All signals only.
- **No A+ tier on gold and FX:** strong-body / grade filters made both worse (gold A + body/not-PM +8.5 | +11.0 | +13.4R; EUR/USD −8.6 | +9.5 | −3.2R).
- **MMXM fit:** London is the FX kill zone (MMXM: London open model); gold's secular up-drift makes buys the side to trade (IOF bullish, §3).
- **Code:** MARKETS gc (@GC.1 / GC=F), eurusd (EUR= / EURUSD=X), gbpusd (GBP= / GBPUSD=X), each with `aRule` (gold / london / none); `isASetup(g, mk)`, `isAPlus(g, mk)`, `sizeOf(g, mk)`.
  - Desk clusters stay index-only.
  - The replay has CNBC history only for these (no cash fill).
- **Caveat:** spot gold and HistData FX stand in for the futures/broker feed; the forward sample decides.

## 27. Size by room to the draw on liquidity (7 Nov 2026) — index A-setups
MMXM / §9.8: the target is the DOL (the next untaken high/low).
Tested on the core index A-setups (against, grade >= 7, stop 0.3-0.75 ATR, live trail, costs).
Datasets: cash 23-24 | cash 25-26 | NQ futures 23-25 | 2026 replay.
- **Exit at the DOL:** worse than the trail everywhere.
  - All off at the DOL (1-8R): +28.8 | +40.4 | +32.9 | −1.8R.
  - Half at the DOL: +33.2 | +44.5 | +37.5 | +0.7R.
  - Live trail: +37.7 | +48.6 | +42.1 | +3.2R.
- **Room as a filter:** only DOL >= 2R away gives +24.0 dd 4.6 | +26.4 dd 5.3 | +27.5 dd 4.0 | +9.5 dd 5.5. Better per trade and in drawdown, less total.
- **Room as size: 1.5x when the DOL is >= 2R away, 0.5x otherwise (or unknown).**
  - With sizing: +42.9 dd 7.5 | +50.7 dd 10.7 | +48.6 dd 6.7 | +11.0 dd 9.1.
  - Live: +37.7 dd 7.6 | +48.6 dd 10.8 | +42.1 dd 5.4 | +3.2 dd 16.2.
  - More R in all four, smaller drawdown in three (NQ futures dd +1.3R). Average size about 0.94x, so total risk is about the same.
  - Other splits: 1/0.5 and 1/0.75 have less total; 1.5/1 has the same ratio with more drawdown.
- **Gold and FX exits (§26 rules) re-checked:** trails 1-3R, 12-72 h and fixed 1.5-3R targets.
  - Nothing beats the live trail 2/1.5, 36 h in every window (gold 3/2 trail and 48 h win one window and lose another).
  - Unchanged; gold and FX stay at 1x (no DOL test on them yet).
- **Code:** `DOL_ROOM = 2`, `ROOM_SIZE = [0.5, 1.5]`, `sizeOf(g, mk)`.
  - The size multiplies with the §25 tight-stop half, giving 0.25 / 0.5 / 0.75 / 1.5.
  - R is stored x size; the desk pill shows "1.5× size" etc.

## 28. Intraday course rules tested on the H1 iFVG model (7 Nov 2026) — none adopted as filters
The owner uploaded a second, longer study spec (an NQ-focused intraday course, kept outside this public repo as a local
skill). Its codable rules were tested on cash NQ+ES+YM, 2023-24 | 2025-26, live exit, costs.
The tracker's signals were rebuilt with the sweep time, the 00:00 / 08:30 ET opens, an SMT proxy and a relative-equal-high/low scan.
A-setups base: +39.3R dd 14.6 | +35.0R dd 19.7.
- **SMT** (at the sweep candle this index took its prior-24h low/high while ES or YM did not): −0.7 | +12.2R. Without SMT: −0.1 | +11.4R. No edge.
- **Opening prices** (buys below both the 00:00 and 08:30 opens, sells above): +7.3 | −3.9R. The other side did better (+35.2 | +34.3R). Same as the midnight-only test (§18). Rejected.
- **Equity window** (signal closes 10:00 ET): best per trade (+0.21 | +0.28R, n 28 | 29). As a 1.5x size-up on top of §27 it is better on cash and NQ futures but worse on the 2026 replay (+9.9 vs +11.0R, dd 11.0 vs 9.1). Rejected.
- **London kill zone only:** +6.1 | 0.0R. **Skip the Asian session:** +30.3 | +24.1R (worse). **Skip Mondays:** mixed.
- **NQ month seasonality** (no buys in Feb/Sep, no sells in May-Jul/Nov): +50.5 dd 12.6 | +28.0 dd 12.4. Rejected: the course's month map comes from the same years we test on (look-ahead), with no clean later window.
- **Relative equal highs/lows beyond the entry:** almost every signal has them (+30.2 | +32.6R with vs +9.1 | +2.4R without). Not a filter. At >= 2R away it is close to the §27 room-to-DOL sizing already live.
- **Read:** the course is a discretionary M5-M1 intraday framework built around a trader reading the higher, intermediate and short timeframes in order. Its codable pieces do not improve this mechanical H1 model.
  - The pieces that agree are already in it: no NY afternoon (§17), the jobs-report morning (§23), room to the draw on liquidity (§27).
- **Best use:** its sponsorship checklist as Fred's judgement on the desk. New review tags: beyond 00:00 & 08:30 opens, inducement, SMT, CISD body close, displacement + FVG, REH/REL target, 09:00-10:30 window. With ~50 reviewed trades, test which tags separate winners from losers.

## 29. Course update: H4/H1 reading (owner upload, 7 Nov 2026) — tested, recorded as forward features
The updated course spec (kept as a local skill) adds the missing H4/H1 chapter.
On the intermediate timeframe, price heading to the daily draw does one of two things: rebalance an imbalance, or run stops.
The best version is both: stops run INTO an imbalance. Each day the bias is re-read from the daily candle closure (wick beyond the prior day and close back, or a close beyond it).
Tested on cash NQ+ES+YM (`idxrec5.mjs`), live exit, costs, 2023-24 | 2025-26. A-setups base +39.3R | +35.0R.
- **Sweep candle traded into an unfilled D1 FVG:** +2.6R (12) | +29.7R (25). Into an H4 FVG: +1.7R (29) | +9.0R (51). Either: −0.9R | +30.1R. None: +40.2R | +4.9R. Inconsistent and thin (37 D1 cases in four years). Not a filter.
- **Daily candle-closure bias agrees with the signal:** +18.3R | +4.9R. Against: +16.2R | +27.8R. Flips between halves. Not a filter.
- All signals: the H4-FVG sweep +44.3R | −22.0R; no stable pattern.
- **Kept as forward-test features, not rules:** every signal now records `feat.htfFvg` ('D1' / 'H4' / null) and `feat.cc` (+1 agrees, −1 against, 0).
  - The desk's "What works" table splits by both; review tag "Stops run into a D1/H4 FVG".
  - Re-judge with ~100 forward A-setups, judging D1 separately.

## 30. M5 entry inside the H1 A-setup (7 Nov 2026) — Fred's manual entry, not automatable
The course pairs an H1 setup with an M5/M1 entry. Tested on index A-setups (cash NQ/ES/YM 2023-26 and NQ futures 2023-25), simulated on M5 candles, costs in, results at the same money risk.
- **Rule:** after the H1 A-setup closes, wait up to 6 h for the first M5 iFVG signal (the tracker's own `signals()` on M5) on the same side, with its stop no worse than the H1 stop.
  - The setup is dead if the H1 stop trades first (24 of 438 cases).
  - Enter at that M5 close, keep the H1 stop, same trail (+2R / 1.5R) and 36 h hold.
  - No M5 signal = no trade.
- **Cash 2023-24 | 2025-26:** H1 entry +33.8R dd 15.7 | +23.1R dd 18.4; **M5 entry + H1 stop +56.5R dd 9.1 | +93.5R dd 6.7**.
  - By year: 2023 +18.5 vs +16.0, 2024 +38.0 vs +17.8, 2025 +42.0 vs +15.5, 2026 +51.5 vs +7.6.
  - About 62% of A-setups get an M5 entry.
- **NQ futures 2023 / 2024 / 2025:** H1 +10.0 / +10.7 / +8.4R (dd 8.8 / 7.2 / 6.7); M5 entry +10.4 / +21.6 / +15.4R (dd 2.0 / 6.8 / 2.3).
- **M5 entry with the M5 stop** (a third of the H1 stop): +32.8 | +93.6R on cash but −0.9R in NQ futures 2024. Keep the H1 stop.
- **Latency kills it:**
  - entering one M5 bar late: cash +26.5 | +32.5R, futures +4.8 / +6.3 / +2.3R;
  - entering three bars (15 min) late: cash +8.5 | +24.3R.
  - The edge is in the inversion candle's own close. The tracker (15-min cadence, GitHub cron delays) cannot take it.
- **Use:** Fred's execution method at the screen. The desk shows it on every index A-setup's checklist. His Taken trades (fill + own R) measure it live.
- **Also tested 7 Nov:** room-to-DOL sizing (§27) on gold and EUR/USD hurts both (gold +43.6 | +20.7 | +24.2R vs +56.7 | +36.0 | +32.8R; EUR/USD drawdown doubles in 2019-22). They stay at 1x.
- **RTY:** no history beyond the 2026 replay, too few trades to judge; unchanged.
- **Replay:** now starts 1 Aug 2025 (5 more months).
  - NQ/ES/YM back-fill from Dukascopy cash; EUR/USD and GBP/USD back-fill from HistData M1 in council-data.
  - GC and RTY start where CNBC history begins.
- **Replay back-fill fix (7 Nov):** CNBC returns a few stray hourly bars months before its continuous history.
  - The back-fill only ran before the first bar and calibrated on the 20 days after it, so NQ / ES / RTY / GC started only in April-May ("overlap too small").
  - The replay now keeps CNBC's continuous part (the last run of 10-day chunks with >= 50 bars) and back-fills everything earlier.
  - Gold back-fills from council-data spot gold 1m (xau-jan-jun.json.gz, 20 Dec 2025 → 7 Jun 2026). RTY has no back-fill source.

## 31. Markets and grades trimmed (7 Nov 2026, owner)
- EUR/USD and GBP/USD removed from the tracker, the replay and the desk (owner: "remove gbpusd and eurusd"). §26's FX results
  stay above as history only; the gold (GC) rule is unchanged.
- Grade F signals (total < 3 of 10, `MIN_GRADE`) are no longer recorded by the tracker or the replay, and older F records are
  filtered on the desk. Cost on the Aug 2025 – Oct 2026 replay: 14 signals, −4.6R in all; one was an A-setup (+2.5R).

## 32. Break-even at +1.5R on index futures (7 Nov 2026, owner: "can we improve the ict stats?")
Tested on index A-setups (cash NQ/ES/YM 2023-24 | 2025-26 | NQ futures 2023-25 | futures replay Aug 2025 – Oct 2026, costs in):
- Live trail: +37.7 dd 7.6 | +48.6 dd 10.8 | +42.1 dd 5.4 | +19.5 dd 16.2.
- Stop to entry at +1.5R, then the same trail: +37.8 dd 8.0 | +51.1 dd 9.4 | +44.3 dd 5.4 | +26.6 dd 11.3 → adopted (`P.be`).
- On gold buys it cost R (2023-24 +35.5 → +29.1, 2025-26 +33.8 → +29.9), so gold keeps the plain trail (`be` null for aRule markets).
- Rejected the same day: BE at +1R, half off at 1 / 1.5 / 2R, grade >= 8 (2025-26 flat), weekday or hour skips (skipping 07-09 ET
  helped the three history sets but failed the replay), speed / close-location filters, previous-day sweep only, zone match,
  buys or sells only, max 1-2 A-setups a day.

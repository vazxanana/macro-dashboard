# Pre-registration: gold's T1 breakout on the yen crosses (20 Nov 2026)

Written and pushed alone, before any candle of these markets is fetched or any trade computed. The test runs once; nothing below
changes after a result is seen. Paper research only: nothing live changes. Not part of the ICT edge.

## Why
T1 (UTC open ± 0.5 × the previous day's range, stop at the open, out at 21:00 UTC) failed on six forex majors pooled
(`fx-vol-breakout`) but held on USD/JPY in 2016-26 (+0.063R, t 2.50) and in 2005-15 (`usdjpy-vol-breakout-early`, +0.079R,
t 2.95). **The question:** is that a yen effect (the yen's daily flows: the Tokyo fix, carry unwinds) or a USD/JPY one? Test: the
same rule, unchanged, on the yen crosses, which share the yen leg and not the dollar.

## Data
- Markets, fixed now: **EUR/JPY, GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY** (OANDA keys `eurjpy gbpjpy audjpy cadjpy chfjpy`),
  OANDA mid M5 through the keyless candle proxy, 2004-12-01 to the fetch time (cache out of git). Days and skips as
  `fx-vol-breakout` (original `buildDays` / `daySkip`; last calendar day on file dropped).
- Windows: **2005-2015** and **2016 → now**, each judged; a market whose candles start after 2005-06 is judged from its first
  complete month (reported).

## Rule and cost
- `vbTrade` of the pinned `index-vol-breakout/original.mjs` (sha256 afa36e03…276f), k 0.5, both sides, through the
  window-free loop of `usdjpy-vol-breakout-early/run.mjs` (`trades`, `placeboTrades`).
- Cost `fx-vol-breakout` `costPx` for a JPY quote: 0.000045 × entry + 0.005 (half a pip of 0.01) a round trip; 2x reported. No
  financing (out before the 22:00 UTC rollover). The crosses' real spreads are wider than USD/JPY's: the 2x line is the check.

## Tests and pass bar
- **Primary: the pool** of the five crosses over **2005 → now** (both windows together). PASS only if ALL hold:
  1. net R a trade > 0 in 2005-2015 AND in 2016 → now;
  2. month-sum t of net R (2005 → now) ≥ 2;
  3. net R a trade > 0 at 2x cost;
  4. the pool's mean net R beats at least 38 of 40 placebo seed means (each seed's mean over all five markets' placebo trades).
- Per market, reported with the same four checks and Holm over the five (2005 → now month t): descriptive, never a pass of
  the question on their own.

**Reading:** a pool PASS says the effect is the yen's (T1 then stays a candidate on the yen pairs, for a forward record only).
A pool FAIL says it is USD/JPY's alone (one market of eleven tested), which weakens the USD/JPY lead without ending it: its
forward record (`usdjpy-vol-breakout-forward`) is the judge. Nothing live changes either way.

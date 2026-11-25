# Pre-registration: the H1 fair value gap tapped after a continuation move, then an H1 QM, target the low of the move (25 Nov 2026)

Written before any code or any read of a test window. Paper research only: a stand-alone rule, never a gate, exit, entry or
size of a live system. Nothing live changes, whatever the result.

## Where it comes from
The owner's own reading of a gold chart (25 Nov 2026): after a continuation move, price taps a fair value gap (FVG), a QM
shows, enter, target the low. Owner's answers: any timeframe is fine, use H1 for the gap and the QM; at the tap either wait
for an M15 CHoCH or just enter; "continue move" = a break in the trade's direction before the pullback; the target is the low
the move came from. Nothing this exact has been tested: `fvg-*` studies enter at the tap with no QM, and no study targets the
low of the move. The prior is weak (every FVG, QM and cycle study here sits at zero before costs) and is said so.

## The rule (fixed; sells shown, buys mirror)
- Candles: the toolkit's cached OANDA mid M5 (`research/edge/_lib/edgekit.mjs` `load`), grouped with `resample` into M15 and
  H1 (UTC blocks). Closed candles only. Structure = toolkit `structure(bars, 3)`; QM = toolkit `qms(bars, 3)` (H1).
- Continuation move: an H1 break of kind BO (a close below the last unbroken swing low while the H1 side was already down;
  buys mirror). `from` = the broken swing's candle, `i` = the break candle.
- FVG: three consecutive H1 candles a, b, c with b's index from `from` to `i + 3`, whose gap is c.high < a.low (bearish).
  Zone = [c.high, a.low]. Known when c closes. Size filter: gap >= 0.25 x ATR(14) of H1 at c (mean true range of the 14
  closed H1 candles up to c). One setup per FVG.
- Tap: the first M5 candle starting at or after the later of the break's close and c's close whose high reaches the zone's
  low (c.high). Must come within 120 H1 candles (432,000 s) of the break's close, else void.
- Void before an entry: an H1 candle closes above the zone's top (a.low) after the tap (the gap is inverted); nothing is
  entered more than 48 H1 candles (172,800 s) after the tap.
- Entry A, "just enter" (QM confirms): the first H1 QM sell whose close is after the tap, and whose head (the high it swept)
  reached the zone's low. Market order at the next M5 open after that H1 close.
- Entry B, "wait for M15 CHoCH": the first M15 ChoCh sell (toolkit `structure`, a close below the last M15 swing low while the
  M15 side was up) that closes after the tap. Market order at the next M5 open after that M15 close. No H1 QM needed.
- Stop: the highest M5 high from the tap candle to the entry close, plus one round-trip cost (sells; mirrored for buys).
- Target: the low the move came from = the lowest H1 low from `from` to the last H1 candle closed at the entry. Skip when the
  target is less than 1R from the filled entry, or the stop is less than 3 round-trip costs away.
- Out after 10 days (864,000 s) at the next M5 close. One position at a time per market and per entry mode.
- Trades run by toolkit `simulate` on M5 (market fill at the next M5 open; a candle holding stop and target is a stop; gaps
  at the open).

## Markets, windows, costs
- Gold, EUR/USD, GBP/USD, USD/JPY, AUD/USD (toolkit `MARKETS`), the data the cache holds (2010 on).
- In sample 2020-01-01 to 2023-12-31; out of sample 2024-01-01 to the end of the cache. The rule was shaped on a 2026 chart,
  so a replication window 2010-01-01 to 2019-12-31 is part of the bar.
- Cost: toolkit `COSTS` round trip on every trade (R after costs = `Rnet`); a 2x-costs run is a check. Financing not charged.

## Tests and statistic
Statistic: mean R a trade after costs; t on calendar-month sums (empty months 0), toolkit `stats`. One-sided p (mean > 0).
- T1 (primary): entry A, the five markets pooled.
- T2 (primary): entry B, the five markets pooled.
Holm across T1-T2. Reported, not tested: gold alone, forex pooled, buys against sells, each entry mode.

## Pass bar (a test passes only if every line holds)
OOS mean > 0; OOS month t >= 2 and Holm p < 0.05; IS mean > 0; OOS mean > 0 at 2x costs; at least 30 OOS trades; replication
2010-2019 mean > 0 after costs. **PASS** = T1 or T2 passes. **FAIL** = neither passes and at least one has 30 OOS trades.
**INCONCLUSIVE** = fewer than 30 OOS trades in both, or a defect found in the harness after the run (then a new
pre-registration, never a fix and re-run under this one).
No variant (other swing size, FVG size, tap rule, stop, target or timeframe) is tried under this pre-registration; anything
seen after the result is a hypothesis for other data. Never called an edge without its n and t.

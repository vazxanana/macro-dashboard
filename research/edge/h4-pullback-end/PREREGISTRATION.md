# Pre-registration: the end of an H1 pullback inside an H4 trend, taken only from the right half of the range (23 Nov 2026)

Written before any code or any read of a test window. Paper research only: a stand-alone rule, never a gate, exit, entry or
size of a live system. Nothing live changes, whatever the result.

## Why, and what is new
The market-cycle reading (an H4 trend, an H1 break against it = the H4 pullback has started, the H1 break back = it has
ended) has failed here several ways: `mosha-retrace` (break-even), `mosha-cycle` (FAIL), `gold-h4-cycle-bias` (no direction
edge, FAIL), `gold-h4-pullback-resume` (FAIL, no structure), `cycle-gate` (FAIL as a filter), `ltf-structure` (FAIL). Those
were gold only, and none asked WHERE in the H4 range the pullback ends. The new and only reason for this test: the rule says
to buy only in the lower half (sell only in the upper half) of the H4 move's range, falling back to the pullback's own range
when the 50 % line was never reached, and to aim at the H4 move's extreme. The prior is weak and is said so.

## The rule (fixed)
- Candles: the toolkit's cached OANDA mid M5 (`research/edge/_lib/edgekit.mjs` `load`), grouped with `resample` into H1 and
  H4 (UTC blocks). Closed candles only. Structure = toolkit `structure(bars, 3)` (swings 3 a side; a close beyond the last
  unbroken swing is a break; a break against the side held before is a ChoCh, with it a BO) on H1 and on H4.
- H4 trend s = the H4 side after the last closed H4 candle (+1 up, -1 down). Its leg: the last H4 break in direction s;
  the external origin O = the lowest low (s = +1) of the H4 candles from that break's broken swing to the break candle; the
  external extreme X = the highest H1 high from the H4 break's close to the moment the pullback starts (sells mirror).
- Pullback start: the first H1 ChoCh against s that closes after the H4 break's close while the H4 side is still s.
- Pullback extreme P = the lowest H1 low (s = +1) from the pullback start up to the entry candle included.
- Pullback end = the entry: the next H1 break in direction s after the pullback start. Market order at its close.
- Location (the new part). The 50 % line of the external range is M = (O + X) / 2. If P went to or past M (buys: P <= M),
  enter only when the entry close is at or below M. If P never reached M, use the pullback's own range: enter only when the
  entry close is at or below (P + X) / 2. Sells mirror (upper half).
- Void before an entry when: the H4 side flips, an H1 candle closes beyond O, or 120 H1 candles pass without an entry. One
  entry per pullback start.
- Stop: P minus one round-trip cost of the market (buys; plus for sells). Target: X. Skip when the target is less than 1R
  away or the stop is less than 3 round-trip costs away. Out after 10 days (864,000 s) at the next M5 close. One position at
  a time per market.
- Trades run by toolkit `simulate` on M5 (market fill at the next M5 open; a candle holding stop and target is a stop; gaps at
  the open).

## Markets, windows, costs
- Gold, EUR/USD, GBP/USD, USD/JPY, AUD/USD (toolkit `MARKETS`), the data the cache holds (2010 on).
- In sample 2020-01-01 to 2023-12-31; out of sample 2024-01-01 to the end of the cache. Because the rule was shaped today on
  charts of 2026, a replication window 2010-01-01 to 2019-12-31 is part of the bar.
- Cost: toolkit `COSTS` round trip on every trade (R after costs = `Rnet`); a 2x-costs run is a check. Financing is not
  charged (said, not hidden: gold buys pay it on the demo account).

## Tests and statistic
Statistic: mean R a trade after costs; t on calendar-month sums (empty months 0), toolkit `stats`. One-sided p (mean > 0).
- T1 (primary): the five markets pooled, the rule as written.
- T2: gold alone. T3: the four forex pairs pooled.
- T4: does the location filter pick better trades? Out of sample, the trades it kept against those it rejected (the same rule
  without the location step, one position at a time per stream), Welch t on per-trade R after costs, one-sided.
Holm across T1-T4.

## Pass bar (a test passes only if every line holds)
OOS mean > 0; OOS month t >= 2 and Holm p < 0.05 (T4: Welch t >= 2 and Holm p < 0.05); IS mean > 0; OOS mean > 0 at 2x costs;
at least 30 OOS trades; replication 2010-2019 mean > 0 after costs. **PASS** = T1 passes (T2-T4 report which part carries it).
**FAIL** = T1 misses any line with at least 30 OOS trades. **INCONCLUSIVE** = fewer than 30 OOS trades in T1, or a defect
found in the harness after the run (then a new pre-registration, never a fix and re-run under this one).
No variant (other swing size, other half, other target, other stop) is tried under this pre-registration; anything seen after
the result is a hypothesis for other data. Never called an edge without its n and t.

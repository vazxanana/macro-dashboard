# Pre-registration: the FVG tap after a continuation move, QM or CHoCH, on other timeframes, judged on the untouched holdout (25 Nov 2026)

Written before any code or any read of a candle for this study. Paper research only: a stand-alone rule, never a gate, exit,
entry or size of a live system. Nothing live changes, whatever the result.

## Where it comes from
The owner's chart idea (25 Nov 2026): after a continuation move, price taps a fair value gap (FVG), a QM confirms, enter, target
the low the move came from. `fvg-qm-continuation` tested only H1 FVG + H1 QM (A) and H1 FVG + M15 CHoCH (B) on gold, EUR/USD,
GBP/USD, USD/JPY, AUD/USD, 2010 to now: FAIL (A: 81 trades in 15 years; B: -0.146R since 2024). Its pre-registration forbids
variants on those years, so **2010 onward on those five markets is spent for this idea and is not loaded here.** The owner said
any timeframe is fine. This study tests the other timeframes and a relaxed QM, only on data nobody has read for the idea.
Prior: weak (every FVG, QM and cycle study here sits at zero before costs).

## The rule (fixed; sells shown, buys mirror; one parameter set per reading, no other setting is tried)
Candles: the toolkit's cached OANDA mid M5 (`edgekit.load`), grouped with `resample` where a higher timeframe is named.
Closed candles only. "Gap timeframe" G, "entry timeframe" E, with H = 10 days when G is H1, scaled by candles for the others.
- Continuation move: a toolkit `structure(G, 3)` event of kind BO in the trade's direction (a close beyond the last unbroken
  swing while the G side was already that way). `from` = the broken swing's candle, `i` = the break candle.
- FVG: three consecutive G candles a, b, c, b from `from` to `i + 3`, gap c.high < a.low (sells; buys mirror). Zone =
  [c.high, a.low]. Gap >= 0.25 x ATR(14) of G at c. One setup per FVG.
- Tap: the first M5 candle starting at or after the later of the break's close and c's close whose high reaches the zone's low,
  within 120 G candles of the break's close, else void.
- Void: a G candle closes beyond the zone's far side after the tap; no entry within 48 G candles of the tap.
- Entry: market at the next M5 open after the confirming E candle closes (confirmation must close after the tap).
- Stop: the highest M5 high from the tap to the entry close + one round-trip cost. Target: the lowest G low from `from` to the
  last G candle closed at the entry. Skip when the target is under 1R from the fill or the stop under 3 round-trip costs.
- Out after 240 G candles (H1: 10 days; H4: 40 days; M15: 2.5 days) at the next M5 close. One position at a time per market and
  reading. Run by toolkit `simulate` (market fill at the next M5 open, a candle holding stop and target is a stop, gaps at the open).

## Five readings (all tested; no others)
- R1: G = H4, E = H1 QM sell/buy (toolkit `qms(H1, 3)`; its head reached the zone).
- R2: G = H4, E = H1 ChoCh (toolkit `structure(H1, 3)`).
- R3: G = M15, E = M5 QM (`qms(M5, 3)`; head reached the zone).
- R4: G = M15, E = M5 ChoCh.
- R5: G = H1, E = H1 QM with the zone-reach condition dropped (any H1 QM of the side closing after the tap, within 48 G candles);
  the relaxation is exactly that one clause, so entries are R1's cousin on H1 and more frequent than `fvg-qm-continuation` A.

## Data: the untouched holdout only
- Set A: gold, EUR/USD, GBP/USD, USD/JPY, AUD/USD, 2005-01-01 to 2009-12-31 (`HOLDOUT.early`).
- Set B: NZD/USD, USD/CAD, USD/CHF, EUR/JPY, silver, 2005-01-01 to the end of the cache (`HOLDOUT.fresh`).
- Costs: toolkit `COSTS` round trip on every trade. **Set B costs are ASSUMED, not measured on the demo account** (said in the
  result). Financing not charged. Gold's cache may start after 2005 (INDEX.json); what exists is used.
- The five Set A markets are NOT loaded for 2010 or later.

## Statistic and tests
Mean R a trade after costs; t on calendar-month sums by exit month (empty months 0), toolkit `stats`. One-sided p (mean > 0)
from the pooled holdout (Set A + Set B trades together), Holm across R1-R5. Reported, not tested: Set A and Set B apart,
buys against sells, each market, the before-cost R.

## Pass bar (a reading passes only if every line holds)
Pooled holdout mean > 0 after costs; month t >= 2 and Holm p < 0.05; mean > 0 in Set A AND in Set B; mean > 0 at 2x costs;
at least 100 pooled trades; mean > 0 in both halves of the pooled trades by entry time (split at the median entry time).
**PASS** = any reading passes. **FAIL** = none passes and at least one has 100 trades. **INCONCLUSIVE** = no reading has 100
trades, or a harness defect is found after the run (then a new pre-registration, never a fix and re-run under this one).
No variant (swing size, FVG size, tap rule, stop, target, hold, other timeframes) is tried under this pre-registration.
A reading that fails is not retried; anything seen after the result is a hypothesis for other data. A pass would still be a
holdout paper result at assumed costs for Set B, never called an edge without its n and t, never a live rule without the owner.

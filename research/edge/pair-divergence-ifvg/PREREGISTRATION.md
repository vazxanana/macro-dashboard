# Pair divergence at an H1 sweep, entered by an M15 inversion gap (pre-registration)

Written 24 Nov 2026, committed alone before `run.mjs` exists or any candle is read for this study. Research only: nothing
live changes, no rule is proposed, no order code is touched. The ICT desk is not read or used; this is a stand-alone rule.

## Why

A common discretionary claim: when two markets that normally move together reach a swing and only ONE of them trades through
its last swing high (or low), the one that did is "weak" there and tends to turn. Existing studies near this:
`ict-smt` / `ict-smt-2008` (index futures pairs, as a condition on the ICT desk's H1 A-setups: FAIL, no difference),
`gold-silver-divergence` (gold 24-hour extremes that silver does not confirm, plain H1 entry: FAIL), `smc-sweep-fvg`
(sweep, change of character, gap limit, no pair condition: FAIL). Not tested anywhere: the divergence on the two classic
pairs (EUR/USD with GBP/USD, gold with silver) at the last H1 swing, with an M15 inversion-gap entry, against the SAME sweep
and entry without the divergence. That is this study. One run, no variants.

## Data

OANDA mid 5-minute candles from the shared `edgekit` cache (no fetch): `eurusd`, `gbpusd` (2005 on), `xau`, `xag` (March 2006
on). M15 and H1 candles are built from them (`edgekit.resample`, UTC-aligned). Costs: `combo-grid-2` `COSTS` round trips in
price units (eurusd 0.00006, gbpusd 0.00008, xau 0.30 from the demo account; xag 0.03 ASSUMED, not measured). The data-quality
exclusions of `combo-grid-2` `exclusions()` drop a trade whose entry falls in a bad interval.

Windows by ENTRY time: discovery 2005-01-01 to 2014-12-31, confirmation 2015-01-01 to 2026-10-31.

## The rule (short side; the long side is the mirror)

Everything reads closed candles only.

1. **Last H1 swing high.** A swing high = an H1 candle whose high is above the 3 highs before it and at or above the 3 after
   it (`edgekit.swings`, K = 3), known when the third candle after it closes. At H1 candle j the "last swing high" is the
   most recent one confirmed by the close of candle j−1. It is live when no candle after the swing candle and before j traded
   above it.
2. **Sweep.** H1 candle j trades above the live last swing high (high > level) and CLOSES below the level. (A close above it
   is a break, not a sweep: no signal.) The sweep is known at the close of j, time T.
3. **The partner** (EUR/USD ↔ GBP/USD, gold ↔ silver). The window is the three H1 candles that start at t(j)−2h, t(j)−1h and
   t(j). The partner must have an H1 candle at all three times, else no signal at all. The partner's level = its most recent
   swing high confirmed at or before the window's start; it is live when no partner candle after that swing candle and
   before the window traded above it. Classes:
   - **div** (divergence): the partner's level is live and none of the partner's three window candles trades above it;
   - **conf** (confirmed): the partner's level is live and a window candle trades above it;
   - **nolevel**: the partner's last swing high was already traded through before the window.
4. **Sweep leg and its gaps (M15).** x = the M15 candle with the highest high inside H1 candle j. Leg start = the M15 candle
   with the lowest low among the 32 M15 candles ending at x. A rising gap = three consecutive M15 candles a, b, c, all from
   the leg start to x, with low(c) > high(a); the gap is the band from high(a) to low(c).
5. **Entry: the inversion.** From the M15 candle that closes at T on, for at most 24 M15 candles (6 hours): the first M15
   candle k (after x) that CLOSES below the lower edge high(a) of a leg gap which no M15 candle between c and k has closed
   below. Before k, an M15 close above the highest high made from the leg start to T cancels the signal. Entry = market at the
   open of the first 5-minute candle starting at or after the close of k. No leg gap, or no inversion in 6 hours: no trade.
6. **Stop.** Above the highest high from the leg start to the close of k, plus one round-trip cost of the market. The stop
   must be above the fill (else no trade), and a risk smaller than 3 round-trip costs is no trade.
7. **Targets.** (a) 2R. (b) "swing": the most recent H1 swing low confirmed by T, among the last 10, that lies at least 1R
   below the fill; none = no trade in the swing cells.
8. **Exit.** 5-minute candles. A candle that opens past the stop or the target exits at its open; a candle holding both stop
   and target is a stop; out at the close of the first 5-minute candle closing 5 days after the fill. Trades not resolved by
   the end of the data are left out. Each sweep is one trade; trades may overlap (month sums are what is judged).

R = (fill − exit) / (stop − fill) for a short; after costs R − cost / risk.

## Cells (12, all fixed)

group {`div`, `all` = every sweep whatever the partner did (div + conf + nolevel)} × target {`2R`, `swing`} × scope {`fx` =
eurusd + gbpusd, `metals` = xau + xag, `pooled` = the four}.

## Pass bar

A cell passes when: n ≥ 300 in each window; mean R AFTER costs > 0 in both windows; t of calendar-month sums of after-cost R
(every month from the cell's first to its last trade month in the window, empty months 0) ≥ 2 in both windows; Holm-adjusted
two-sided p of the confirmation month t < 0.05 over the 12 cells. Verdict PASS if any `div` cell passes (an `all` cell
passing is reported as a pass of the plain sweep rule, not of the divergence); FAIL otherwise; INCONCLUSIVE if every `div`
cell has n < 300 in a window.

## Reported

For every cell and window: n, win share, mean R before costs and after, month t after costs (and before), Holm p. Beside the
cells, not judged: `conf` and `nolevel` on their own, and the difference `div` minus (`conf` + `nolevel`) with a Welch t per
window and target; the same per market; mean cost in R; counts of sweeps, of sweeps with a leg gap, of inversions; a cut test
(the signals known by a cut date equal those found when the candles end there). Nothing else is run on these years.

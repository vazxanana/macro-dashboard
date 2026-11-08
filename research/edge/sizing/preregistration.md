# Position sizing for the live systems: pre-registration

Written and committed **before** any sizing result was computed. The rules, inputs, splits and the decision rule below are
fixed; nothing in them changes after the results are seen. Anything added later is labelled post hoc in `RESULT.md`.
Paper research only: no live rule, size, config or tracker changes, whatever the outcome. At most a written proposal.

## Question

Every live system risks a fixed R per trade (fixed size, or the size its own live rule sets). Would a simple sizing overlay
have given a better return per unit of drawdown, **in both halves** of the long out-of-sample histories, given that every
edge found so far is regime-bound? Four overlays are tested, and only these four.

## Systems and per-trade histories (already computed by earlier studies; unchanged)

| System | Decay id | History (entries) | Source of the per-trade record | Net R x1 / x2 |
|---|---|---|---|---|
| ICT A-setups (GC, NQ, ES, YM pooled) | `ict-a` | 2008-01-01 .. 2026-10-31 | `research/edge/ict-oos-2008/run.mjs` output (`cfg` rule, `aset` 1), the desk's own code on OANDA 5m | size × (R − costR) / size × (R − 2 costR) |
| NQ New York open run | `nq-open` | 2004-01-01 .. 2026-11-03 | `research/edge/nq-open-oos/result.json` `trades` (live rule, OANDA 1m, clean years) | R at 1 pt / R − 1 pt ÷ stop |
| Gold replica | `replica` | 2017-01-01 .. 2026-11-06 | `research/edge/replica-oos` replay positions (live sizing: MSNR tilt, equity filter, add) | legs at 0.30 / 0.60 a unit |
| Gold trend N20 | `gtrend` | 2006-07-01 .. 2026-11-06 | `research/edge/gold-systems-oos/result.json` `positions` (`sys` gtrend, first unit + add) | `n` / `n2` |
| Gold daily engulf | `geg` | 2006-07-01 .. 2026-11-06 | same file, `sys` geg | `n` / `n2` |

- One record point = one position (a gold add is folded into its first unit, as the decay monitor counts them).
- The baseline size of each system is what its live rule already does (ICT tight A+ quarter/three-quarter size, the
  replica's MSNR tilt and equity filter). The overlays below multiply that baseline size.
- A compact copy of these records (entry time, close time, market, net R x1 and x2, and the two inverse-volatility inputs)
  is written to `research/edge/sizing/inputs.json` by `run.mjs build`, so the study re-runs without the candle caches.
- Note: the later part of every history is the period the rule was built on (ICT 2018+ partly, NQ 2023+, replica 2023+,
  gold systems 2018+). The comparison between overlays is relative, on the same trades, so this affects all four alike in
  sign, but the second halves are not out of sample for the rules themselves.

## The four sizing rules (multiplier m on each position, known strictly before its entry)

1. **Fixed 1R** (baseline): m = 1.
2. **Inverse volatility.** vol = standard deviation of daily close-to-close log returns over the last 20 completed daily
   candles of the system's market before the entry (OANDA daily candles via the site proxy `meridianx.dev/md/bars`, UTC
   buckets; Saturday/Sunday-dated stub candles dropped). target = the median of that same 20-day vol over the trailing
   756 completed days (3 years). m = clamp(target / vol, 0.5, 2). Warm-up: m = 1 while fewer than 120 values of the 20-day
   vol exist. Markets: GC/gold systems = XAU_USD, NQ open and ICT NQ = NAS100_USD, ICT ES = SPX500_USD, ICT YM = US30_USD.
3. **Drawdown throttle.** On the system's own fixed-1R record (positions closed before the entry): when the record is more
   than X R below its running peak, m = 0.5; it stays 0.5 until the record makes a new peak, then m = 1.
   X is fixed upfront from data that predates this study and is not these histories: **X = 0.5 × the system's worst
   drawdown in its build-period baseline record, `maxDD` in `council/decay-base.json`** (as of 7 Nov 2026):
   ICT 11.15 → X 5.575R; NQ open 20 → 10R; replica 40.2 → 20.1R; Gold trend 3.7 → 1.85R; Gold daily engulf 14.78 → 7.39R.
   Sensitivity, reported only (cannot change the verdict): X = 0.25 × and 1.0 × `maxDD`.
4. **Decay-monitor throttle.** Before each entry, `assess()` from `council/decay.mjs` (imported, unchanged) is run on the
   system's fixed-1R record of positions closed before the entry, from the start of its history, with the system's live
   entry in `council/decay-base.json` (ref, sd, k, h, ddLimit, W). Status healthy → m = 1, watch → 0.5, decaying → 0.
   Fewer than 10 positions → healthy (as the monitor). The monitor watches the rule's own record, so the record it reads is
   the unthrottled one (the system keeps paper trading at 0x). Caveat declared now: the decay baselines are built on the
   recent, in-sample records, so this replay asks "what would today's monitor, with today's limits, have done".

The throttles of rules 3 and 4 also read the unthrottled 1R record (the rule's own equity), never the sized equity.

## Halves (whole calendar years, nearest the midpoint of each history; by entry date)

| | First half | Second half |
|---|---|---|
| ICT A-setups | 2008-2016 | 2017-2026 |
| NQ open | 2004-2014 | 2015-2026 |
| Gold replica | 2017-2021 | 2022-2026 |
| Gold trend N20, Gold daily engulf | 2006-2016 | 2017-2026 |
| Equal-risk portfolio of all five | 2004-2014 | 2015-2026 |

Throttle state carries across the split (it is causal over the whole history); only the measured positions are split.

## Portfolio

Equal risk per position: every system trades its own positions at its own (sized) multiplier, 1R base each, and the
portfolio is the sum of all five systems' net R, ordered by close time. Each system's overlay is its own (no portfolio-level
overlay). Systems absent from a period (replica before 2017) simply contribute nothing.

## Measures (per system, and for the portfolio; full history, each half; costs x1 primary, x2 reported)

- Total R (sum of m × net R).
- Max drawdown in R on the closed-position equity curve (equity starting at 0 at the start of the period).
- Return / drawdown = total R ÷ max drawdown.
- Worst calendar year (sum of R of positions closed that year).
- Share of calendar years positive (years with at least one closed position).
- Mean multiplier (exposure), so totals can be read against size.

## Decision rule (fixed now)

A sizing rule is **recommended over fixed 1R** only if all of these hold:

1. The portfolio's return/drawdown at x1 costs beats fixed 1R by at least 10% (relative) in **both** halves.
2. The same at x2 costs, in both halves.
3. The portfolio's share of positive years is not lower than fixed 1R's in either half.
4. Return/drawdown is higher than fixed 1R for at least 3 of the 5 systems in **each** half (x1).

If none passes: keep fixed 1R. If more than one passes: prefer the one with the higher worse-half portfolio return/drawdown.
A rule that passes would become, at most, a written proposal for the owner (or a paper shadow stream); nothing live changes.

## Files

- `run.mjs`: `fetch` (daily candles to a scratch cache), `build` (writes `inputs.json` from the earlier studies' records),
  and the run (writes `result.json`, prints the tables).
- `result.json`, `RESULT.md`: after the run.

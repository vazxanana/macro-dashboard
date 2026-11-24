# Fade confluence: when two or three of the Equinox fade rules agree (pre-registration)

Written 24 Nov 2026 before any run. Committed and pushed ALONE, before `run.mjs` exists. Research only: nothing live changes,
nothing is proposed by this file.

## Question

The five Equinox fade / gap rules each pass before costs on 2005-2026 and each LOSES after costs (figures from each study's
RESULT.md, R a trade, confirmation 2015-26):

| Rule (desk) | Study and cell | Before costs | After costs |
|---|---|---|---|
| Break fade (`fade`) | `grid7-wide-fade`, m15 none atr 2R all | +0.042R (n 201,769) | −0.118R |
| Big-candle fade (`bigfade`) | `big-candle-fade`, m15 k1.5 nobreak half | +0.193R (n 54,443) | −0.246R |
| Round-number fade (`roundfade`) | `round-number-breaks`, fade other 2R | +0.051R (n 88,734) | −0.307R |
| Box fade (`boxfade`) | `fade-breaks-holdout` F1 | +0.056R (holdout B, n 55,510) | negative |
| FVG return (`fvg`) | `grid7-fvg-wide`, 1h mkt large 1R | +0.035R (n 52,659) | −0.113R |

When two or more DIFFERENT rules signal the same market and the same direction within 30 minutes, is one trade, entered once at
the later signal with the stricter stop, positive AFTER costs, and better than the same number of single signals?

## How this differs from grid6-confluence

`grid6-confluence` (FAIL, 0 of 21) counted ten CONTEXT readings (zones, structure sides, the MSNR call, the session) agreeing with
one H1 trigger: a score used as a filter on a single entry; none of the context readings is an entry rule of its own and none was
shown positive before costs. Here every member is itself a complete, pre-registered ENTRY rule that passed before costs on its
own, all of one family (fading an extended short-term move), and the question is agreement IN TIME between separate detectors
(several of them firing on the same move within 30 minutes), not a static score. It also asks the after-cost question directly:
the members' common problem is cost per R, so stacking only helps if it lifts R a trade by more than the cost.

## Signals (each rule's OWN code, imported, never edited)

Through `council/edge-desks-2.mjs` (the Equinox desks' adapters, which run each study's exported signal code with the cell the
desk uses; read only): `fadeTrades`, `bigTrades`, `roundTrades`, `boxTrades`, `fvgTrades`. Each gives records with side, fill
time (the 5-minute open after the trigger candle closed), fill price and stop. Candles: OANDA mid 5-minute, the `edgekit` cache,
loaded 2004-01-01 to 2026-11-01 (2004 warm-up). Markets: the grids' ten (xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd,
usdcad, usdchf, eurjpy). Fills 2005-01-01 to 2026-10-31. The data-quality exclusions (`combo-grid-2` `exclusions`) drop a member
signal whose fill falls in a bad interval.

## The confluence trade (one rule, fixed now)

- **Window** W = 1,800 s. For a member signal X (market m, side s, fill time t), its count k = the number of DISTINCT rules with a
  signal of market m and side s whose fill time is in [t − W, t] (X included). Only signals whose fill is at or before t are
  read, so k is known at t.
- **Entry**: at X's own fill (the 5-minute open at t), once.
- **Stop**: the stricter one: among the stops of the counted members (the latest signal of each counted rule), those strictly on
  the losing side of the entry with risk >= the market's round-trip cost; the one NEAREST the entry. None valid: no trade.
- **Target**: 1R from the entry. **Time limit**: 1 day (86,400 s) from the fill, out at that candle's close.
- **Management**: `walk()` of `council/edge-desks-2.mjs` (the studies' order of checks: an open beyond the stop exits at the
  open; stop before target in one candle), market entry (the fill candle counts in full).
- **One position at a time per market and side** in each stream: a qualifying signal while that stream's position on that market
  and side is open is skipped.
- Two streams: **k >= 2** and **k >= 3** (each built separately with its own one-position rule).

## Costs

R after costs = R − cost / risk, cost = `combo-grid-2` `COSTS` (round trip, price units): the demo figures for xau, eurusd,
gbpusd, usdjpy, audusd; **ASSUMED, not measured**, for xag, nzdusd, usdcad, usdchf, eurjpy.

## Windows

Discovery 2005-01-01 to 2014-12-31, confirmation 2015-01-01 to 2026-10-31: the five parent grids' windows (the FVG rule's "large"
medians come from 2005-14). Not new data for the members: the confirmation window was read by every parent grid, so a pass here
is a pass on read years. Assigned by fill time. Month sums over every calendar month of the window (empty months 0): 120
discovery months, 142 confirmation months.

## Tests (2), Holm over both

- **T2**: the k >= 2 stream. **T3**: the k >= 3 stream.
- Statistic: month-sum t of R after costs, pooled over the ten markets, one-sided p (mean > 0).
- **Pass** (each test): (1) mean R after costs > 0 in discovery AND in confirmation; (2) confirmation month t >= 2 and Holm-adjusted
  one-sided p < 0.05 over the two tests; (3) confirmation n >= 200; (4) the control below.

## Control (same count of random single signals)

For each test and window: draw, per market, the same number of trades as the stream has in that market and window from ALL
member signals of that market and window (any rule, with or without confluence), each traded with the SAME exit rule as the
confluence trade but its own single stop (own stop, 1R, 1 day, after costs). 1,000 draws, seeded. Condition (4): the stream's
mean R after costs in confirmation is above the 95th percentile of the control means.

## Reported, not tested

R before costs; each rule alone (its own exit, after costs; and under the common 1R / 1-day exit); k >= 2 split by pair of rules;
the median cost / risk of the confluence trade against single signals (the stricter stop raises the cost per R); a cut test
(confluence trades known by a date, computed from member signals cut there, equal the full run's).

## What a result would mean

A FAIL: agreement between these fade detectors does not make them pay after costs; no variant (other windows, exits, k) will be
run on these years. A PASS: a hypothesis for a forward paper record only, never an edge by itself, nothing live.

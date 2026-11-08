# Pre-registration: LIT (Liquidity Inducement Theory) on gold and NAS100, 2008-2026

Written on 8 Nov 2026, **before any LIT trade statistic was computed**. This file, `run.mjs` and the fixed skill text `SKILL-v2.md`
(sha256 `68482ea5cab125a70254d731287ea95a62a24d15a912ca25fbce9cae75b40f2d`, the owner's upload of 8 Nov) are committed, pushed and merged
first (PR 1); the full run happens once afterwards and its result is reported whatever it is (PR 2). Nothing below changes after that run.

## Why

The owner uploaded the LIT skill (Arctic / kev.futures, v2) and asked to "add this new edge". The skill itself says every gold rule is
**untested inference** (§7), that the owner's earlier gold OB/zone and 09:30-candle tests found no edge, and "backtest before live risk":
*"Start with the cleanest subset: M15 manipulation of a session/pd extreme → M5 RBOS → limit at the IDM POI → accumulation target. Run it
with and without the XAG-div filter. Data: M5, multi-year, split by session and direction"*, against *"a random-entry baseline with the same
stops/targets, walk-forward split"* (§7, §8). That is what this study does, with §8's "(our default)" values and nothing tuned. Every live
edge found so far on this desk is regime-bound (#508, #511, #512, #526, #530), so both the long untouched history and the recent years are
required to pass.

## Data (fixed now; no candle is refetched)

- OANDA 5-minute mid candles from the scratch cache (`oanda5m/{xau,xag,nas100}-<year>.json.gz`, rows `[t, o, h, l, c]`, 2007-06-01 to
  2026-10-30), the cache of #526 / #545 / #579. **No volume**, see the deviation below. 2007 is warm-up only (no window).
- Gold / silver: candles while spot is shut (Fri 17:00 – Sun 17:00 New York, `spotClosed` of council/fills.mjs) and the 17:00 New York hour
  (`inHalt`) are dropped. NAS100: `inHalt || cmeShut` candles dropped (the ICT desk's `closedBar`, as #526). Candles with a non-positive
  price are dropped; high / low are widened to cover open and close.
- M15 = 5m candles aggregated on UTC quarter-hours. All times in America/New_York (bar start). Trading day = 18:00 → 18:00 New York;
  trading week = Sunday 18:00 → Friday 17:00; "previous day / week" extremes are taken on those boundaries.
- **Windows** by the trade's fill time: **A = 2008-01-01 … 2017-12-31** (halves 2008-12 | 2013-17 by the fill's trading-day year),
  **B = 2018-01-01 … 2026-10-30** (halves 2018-21 | 2022-26). Both windows are untouched by LIT: no LIT rule has been run on this desk.

## The rule under test (`run.mjs`, the skill's §8 defaults; bearish side written out, the long side is the exact mirror)

Sessions (New York): ASIA [18:00, 01:00), LONDON [02:00, 05:00), NY_AM [08:00, 12:00), NY_PM [12:00, 16:00). Trades come only from sweeps
whose M15 sweep bar starts inside LONDON or NY_AM, never the 09:30 bar.

1. **Swings**: fractal pivots L = R = 2 (`high[i] > high[i-1], high[i-2]` and `>= high[i+1], high[i+2]`), confirmed only at the close of the
   second right bar; M15 for the narrative, M5 for the execution. ATR(14) = the simple mean of the last 14 true ranges.
2. **Vector** (deviation, data): the cache has no tick volume, so the skill's volume test cannot run. A vector is a bar with
   **body >= 1.5 x the mean body of the preceding 10 bars** (§8: Base Body Size Multiplier 1.5, N = 10; the volume multiplier is dropped).
   The skill calls both thresholds tunable defaults. This is the primary and only vector definition here.
3. **Accumulation** (M15): at the sweep bar s, the longest run of >= 8 consecutive bars ending at s-1 whose range (max high − min low) is
   <= 3 x ATR(14) at s-1, at most 96 bars. None → no setup. `acc_high` / `acc_low` = that run's extremes.
4. **External levels** (one list, bearish side = highs): the high of each **completed session of the current trading day** (ASIA after 01:00,
   LONDON after 05:00, NY_AM after 12:00), the **previous trading day's high**, the **previous trading week's high**, **`acc_high`**, and
   **equal highs** (two confirmed M15 pivot highs within the last 96 bars whose highs are within 0.1 x ATR(14), no higher bar between or since;
   level = the higher one). A level is live from its formation until the first bar whose high exceeds it; that bar is its sweep.
5. **FBOS**: the sweep bar s has `high >= L + 1 tick` (gold tick 0.01, NAS100 0.1); when one bar sweeps several levels the most external one
   is L. Then (a) a **close back below L within 3 bars** (s, s+1 or s+2; the rejection bar r), (b) **no two consecutive closes above L**,
   (c) **>= 1 vector in [s−2, r+2]** (confirmed at r if one already exists, else at the first vector bar of r+1, r+2; a bar after r whose high
   exceeds MX voids the candidate), (d) **L in the premium half** of the running weekly range through s−1 (the running trading-day range
   through s−1 while the week has < 48 M15 bars). **MX** = the max high of bars s … r.
   Not applied (the owner's brief omits it; the skill says "test both" FVG timeframes, which would double the variants): the
   "price inside an unfilled FVG" exclusion. Not modelled: POI-tap manipulation ends, order flow, SMTs, news filters, the weekly process.
6. **RBOS** (M5): the level = the low of the last confirmed M5 swing low before the MX bar. From the bar after MX, within **48 M5 bars**, the
   first bar that triggers — **wick** (`low <= level`, the teacher's rule) or **close** (`close < level`), the two variants — before any bar
   whose high exceeds MX (that voids the setup). Quality: the break bar is a vector **or** MX → break takes <= 6 bars; reject if > 50% of the
   bars MX+1 … break overlap the previous bar's range by > 70% of their own range; reject if the bar after the break closes back above the
   level ("the candle flipped itself"). The order can be placed from the bar after that check (break + 2) and not before the FBOS is
   confirmed (the first M5 bar at or after the confirming M15 bar's close).
7. **IDM POI / order block**: the displacement start d = the first bearish vector bar in [MX bar, break bar], else the break bar; the OB = the
   last bullish candle (close > open) before d, searched back to the MX bar; fallback (kev): the smallest-body bar of the 3 bars before d;
   none → no setup. Zone = its full range. Entry **at the OB candle's open** (variant: **50% of the zone**).
8. **Stop** = MX + spread + buffer: gold **MX + $0.30 + max(0.1 x ATR(14) on M5 at order time, $0.30)**; NAS100 **MX + 1 point**. **Skip if the
   stop distance exceeds 0.08% of price.** **Target** = `acc_low` (the accumulation's far extreme). **Skip if R:R <= 3.**
9. **Order**: a resting limit; fills on the first bar whose high reaches entry + 1 tick (fill at the limit, or at the open when the bar opens
   through it); the 09:30 New York M5 bar fills nothing. Before a fill the order is cancelled on a break of MX (high > MX), when the target
   is reached first, or **after 24 M5 bars**. A fill bar that also reaches the stop is a loss; one that also reaches the target without the
   stop is ambiguous and counted as missed (the live engine's rule, council/fills.mjs `fillBarAmbiguous`).
10. **Position**: from the bar after the fill: stop first, then target. **Break-even** after **two post-entry M5 swing breaks** (a confirmed
    post-entry pivot low is broken by a later low; a new pivot replaces the tracked one only when it is lower): the stop moves to the entry.
    A position still open at the trading day's last M5 bar is closed at that bar's close (harness default; the skill names no time stop).
11. **Trader**: one pending or open order at a time per market; **<= 1 London fill + 1 NY_AM fill per trading day**; no new order on a day after
    a net win or once the day's net R <= −1.5R. An expired order frees the trader. The two directions run through one time line.

**Markets**: XAUUSD and NAS100, both directions. **Variants (4, fixed)**: RBOS {wick, close} x entry {OB open, 50%}; the **primary is
wick + OB open** and is judged first; the others are reported next to it.

## Costs (net x1 = the primary; x2 and gross reported)

- Gold: the Trader's model (council/fills.mjs): **$0.30 spread** per round trip; a limit entry pays no slippage; a target exit pays none;
  a stop, break-even, or day-end exit pays **half a spread ($0.15)** of slippage. x2 doubles the whole cost.
- NAS100: **0.02% of price + 0.25 point** per round trip (#431 / #526). x2 doubles it.
- R = (entry − exit) / (stop − entry) with the fill price as entry; net R = R − cost / risk.

## The random-entry control (same stops, targets, management, costs; 1,000 draws)

For every taken trade, a random M5 bar of the **same market, year, session (LONDON / NY_AM) and direction**, never the 09:30 bar, entered
at that bar's close with the **same stop distance as a share of price**, the **same R:R target distance**, the same break-even and
day-end rules and the same cost model (no entry slippage, so the two sets pay the same costs). Seed 20261108 (mulberry32). Per group:
**margin = rule expectancy − control expectancy**; **CI** = 1,000 draws, each pairing a bootstrap resample of the rule trades with one
control draw, 2.5–97.5 percentiles. Reported per window, session and direction.

## The bar (per market, primary variant, capped set, net x1) — fixed now

**PASS** when, in **both** windows A and B: (1) expectancy > 0 and t >= 2 (t = mean / (sd / √n) over trades); (2) net expectancy > 0 in
**each half** of the window; (3) the control margin > 0 with a 95% CI that excludes 0; (4) expectancy at x2 costs > 0.
**FAIL** when, in a window with >= 30 trades, expectancy <= 0, or a half <= 0, or the margin <= 0.
**INCONCLUSIVE** otherwise, with the reason stated (a window with < 30 trades = "too few": the rule did not produce a testable sample
under its own defaults; positive but t < 2; CI includes 0 with a positive margin).

Study verdict: PASS if either market passes (named per market); FAIL if both fail; else INCONCLUSIVE. PASS = a **proposal to the owner for
a paper shadow stream** with the exact rule above. Nothing goes live.

## Secondaries (reported with the same bar, named now; they do not change the primary verdict)

- **S1, uncapped**: the same four variants without the 0.08% stop cap. Reason, stated before running: gold's fixed spread + buffer is
  >= $0.60, so at 0.08% the cap leaves no room for MX → entry below ~$1,500 gold (nothing can trade in 2007-2010 and little before 2019);
  the skill's own gold guidance is "calibrate the cap from history" (§7), and 0.08% is §8's starting value. S1 is the skill's rule with
  the cap removed, not a calibration. The count of setups the cap removes is reported.
- **S2, XAG/XAU divergence (gold only)**: the §7 proposal as a filter: a XAG FBOS (the same level definitions and tests on silver, `acc_high` excluded as market-specific) whose
  comparable XAU level (that session's XAU high, XAU's previous-day / week high, or XAU's highest confirmed pivot high of the last 96 bars
  for equal highs) **holds** — XAU's high within ±3 M15 bars of the XAG sweep stays at or below its level and within 0.5 x ATR(14) of it;
  veto when the 20-bar M15 close-return correlation of XAU and XAG before the sweep is < 0.3. XAU then trades with MX = its high over that
  window, its own accumulation target, and steps 6-11 unchanged. "Without the filter" = the primary set; "with" = this set (they are
  disjoint by construction: the primary needs XAU to sweep, the filter needs it to hold). Expected to be thin.
- Reported, not judged: per session, direction, year, level kind and exit kind; win rate, average gross R, net expectancy, t, total R, max
  drawdown (net equity in fill order), longest losing streak, trades per year; costs x2 and gross; the funnel (sweeps → in session → with
  accumulation → premium → FBOS → RBOS reasons → orders → fills → taken) and the unfilled orders by reason.

## Multiplicity

Four variants on the primary set, pre-named, the primary judged first; S1 doubles them (cap on / off) and S2 adds the gold filter set. No
other parameter, threshold, window, cost, session or filter will be tried, and none above changes after the run.

## What was done before this commit

`run.mjs` was syntax-checked and exercised end to end on the **2007 warm-up year only** (outside both windows): the funnel counts and the
order / fill / taken counts were read to confirm the detector fires and the code runs (xau: ~200 FBOS candidates in Jun-Dec 2007, 0 capped
orders; nas100: 3 capped orders, 1 fill). No R, expectancy or any 2008-2026 number was computed or seen.

## What will not happen

No live rule, config, trader, replay or site code changes: paper research only. No candle is refetched. No parameter is tuned after the
run; a bug fix to `run.mjs` after the result exists would be a new pre-registration.

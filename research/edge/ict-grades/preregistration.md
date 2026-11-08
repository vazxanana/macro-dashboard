# Pre-registration: do the desk's untraded B and C grades carry any edge, and does the grade order hold?

Written on 7 Nov 2026, **before any B- or C-setup trade was computed**. Only `ict-oos-2008`'s candle cache (OANDA 5m, 2007-06
to 2026-10, already on disk in the scratchpad and reused read-only) and the published A-setup figures of #526 existed when
this was committed. Nothing below may change after the first computation. The test runs once and its result is reported
whatever it is.

## Why

The ICT desk records every H1 iFVG signal with a candle-closure grade of at least 3/10 (`MIN_GRADE` in `ict/tracker.mjs`) and
trades only **A-setups** (`isASetup`: against the daily bias, grade >= 7, stop 0.3-0.75x the daily ATR, not an NFP morning;
gold: buys with a 0.3-0.75x ATR stop). The B and C grades are logged but never traded or sized. #526 (`research/edge/ict-oos-2008`)
rebuilt the desk's own code on OANDA 5m for GC/NQ/ES/YM 2008-26 and found the A-setups fail 2008-17 (−0.013R, t −0.45) and
make +0.093R a trade in 2018-26 (n 1,786, t 2.58). The same run already simulates the non-A signals, so the question "is
there anything in the grades the desk throws away" can be answered on the same clean data without any new rule.

## Definitions (fixed now, the desk's own code)

- **Grade tiers** come from the desk's `letter()` in `ict/tracker.mjs`: A-tier = total >= 8 (A+/A/A-), B-tier = total 5-7
  (B+/B/B-), C-tier = total 3-4 (C). F (< 3) is not recorded by the desk and is not simulated.
- **A-setups** = `isASetup(g, key)` with the desk's own key (gc, nq, es, ym), sized by `sizeOf(g, key)`: the traded set,
  exactly as in #526. They must reproduce #526's reference figures (1,786 closed trades, +0.093R a trade net, 2018-26)
  before anything else is read.
- **B-setups** = recorded signals that are **not** A-setups and have letter B-/B/B+ (total 5-7). Note a B+ (7) that goes against
  the bias with a 0.3-0.75x ATR stop *is* an A-setup; so B-setups are the grade-5-7 signals the desk logs but will not trade
  (with the bias, stop outside the band, or an NFP morning).
- **C-setups** = recorded signals with letter C (total 3-4). None is an A-setup.
- **Untraded A-letter** = total >= 8 and not an A-setup. Reported as a descriptive row only, not part of any hypothesis.
- Exits, costs, candle handling, the NFP fallback, H1/D1 construction and the gap guard are those of #526's `run.mjs`
  (`signals()`, `isASetup()`, `isAPlus()`, `sizeOf()`, `inHalt()`, `cmeShut()`, `agg()`, `dailyNY()` from `ict/tracker.mjs`,
  `simulate()` from `ict/replay.mjs`), unchanged. Break-even at +1.5R on the indices and the 1.5R trail from +2R apply to every
  simulated signal, as the live tracker applies them to every record it opens.

## Data and windows (fixed now)

- OANDA 5m mid candles through `meridianx.dev/md/bars` (XAU_USD, NAS100_USD, SPX500_USD, US30_USD = GC, NQ, ES, YM), the
  `ict-oos-2008` cache, read-only. RTY has no free pre-2018 source (see #526).
- Two windows by the signal candle's close (UTC): **W1 = 2008-01-01 .. 2017-12-31** and **W2 = 2018-01-01 .. 2026-10-31**.
  Halves: W1 → 2008-12 / 2013-17; W2 → 2018-21 / 2022-26 (the #526 splits).
- Every recorded signal (total >= 3) is simulated once, independently. Streams then pick which simulated trades count:
  - **Stream A** (the desk): A-setups, one open A-setup per market (an A is blocked only by an open A). Must equal #526.
  - **Stream B**: B-setups alone, one open B per market, size 1 per unit of risk.
  - **Stream C**: C-setups alone, one open C per market, size 1.
  - **Stream A+B½** (H3): the desk rule plus B-setups at **half size** (0.5 per unit of risk): an A-setup is blocked only by an
    open A-setup (as live); a B-setup is blocked by any open trade on the market (A or B), which is the tracker's and the
    replay's own rule for non-A records. A strict one-open-per-market variant is reported too.
- **Costs**, as #526: one round trip GC 0.50; NQ, ES 0.0002 x price + 0.25; YM 0.0002 x price + 1; cost in R = cost / r0.
  Net R = size x (R per unit − k x cost in R), k = 1 (primary) and 2.

## Hypotheses and pass bars

- **H1 (B-setups have a net edge).** Stream B, net at costs x1. **PASS** only if all of: net expectancy > 0 **and** t >= 2.0
  (t = mean / (sd / √n) over trades) in **both** W1 and W2; net expectancy > 0 at costs x2 in both windows; at least **3 of
  4** markets have net expectancy > 0 in both windows. Anything less is a **FAIL** (including "positive but not significant").
- **H2 (the grade order holds).** Net expectancy at costs x1: Stream A > Stream B > Stream C in **both** windows → **HOLDS**;
  the order holds in one window only → **REGIME-BOUND**; otherwise **DOES NOT HOLD**. Reported alongside: the same order by
  letter tier over all recorded signals (A-letter incl. untraded > B-letter > C-letter, each as its own one-open stream),
  and a per-grade-total table (3..10).
- **H3 (adding B at half size).** Stream A+B½ versus Stream A, same window, net x1: total R, max drawdown of the pooled equity
  in close order, R / max DD, and the monthly-sum t. **IMPROVES** only if total R and R / max DD are both higher in both
  windows; **HURTS** if total R or R / max DD is lower in both windows; otherwise **MIXED**. Descriptive: no live rule changes
  on this result; a pass would at most be a written proposal for a paper shadow stream.

## Reported, not part of the verdict

- Per market, per half, per year (pooled net R), costs x1 and x2, gross, win rate, max drawdown, worst losing streak, monthly-sum
  t (dependence check), by letter and by grade total, by side, by session, B-setups split by why they are not A-setups (with
  the bias / stop outside the band / NFP morning), and the untraded A-letter row.

## What will not happen

- No parameter, rule, filter, cost or window changes after the first computation. No market is dropped for its result.
- No live rule, config, tracker or replay code changes. Paper research only. Research files only.

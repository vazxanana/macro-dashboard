# Pre-registration: ICT's "Silver Bullet" time-window entry on spot gold

Written on 14 Nov 2026, **before any trade of this rule was simulated or any outcome computed**. This file is pushed alone,
first; `fetch.mjs`, `run.mjs`, `RESULT.md`, `result.json` and the test come after it. Its sha256 is written into `result.json`
(`planSha256`).

Paper research only. ICT is its own edge (CLAUDE.md, absolute rule 4): nothing under `ict/` is changed or imported for
trading logic (only the read-only CME calendar `ict/calendar.mjs`), nothing is mixed into a council system, and nothing live
changes whatever the result. A pass would at most be a note for the ICT desk's owner, never a live change.

**Item 44 (docs/owner-decisions.md).** This is a new, standalone intraday rule on gold. It is NOT a gate, exit, entry or size of
the live gold book (Gold trend, Gold daily engulf) and reads none of that book's positions. The book's untouched 2006-17 test
window is not used: no candle before 1 Jan 2016 is read, and no record of `gold-systems-oos`, `supported-book` or their kin is
opened. (The candles of 2016-17 are read as in-sample data of THIS different intraday rule.)

## 1. Why this, and what was tested before

The owner's ICT notes name a one-hour "silver bullet" window as an entry model: after price has taken an obvious liquidity
level, the first M5 fair value gap that forms in the window, in the direction of the draw, is the entry. The desk's live model
is a different one (an H1 inversion-FVG reversal, any time of day). Dedupe, read before writing this:
- `ict-sessions`: split the desk's own H1 A-setups by session; it never tested this entry model. FAIL.
- `ict-concepts`, `ict-filters`, `ict-variants`: other entries / filters on the desk's markets; no silver-bullet entry.
- `orb-nas100`, `intraday-momentum`: other intraday index rules, not ICT, not gold.
- No study in `research/edge/` or on any branch implements a silver-bullet entry (searched by name and text, 14 Nov 2026).
- An index version of this study was planned the same day and dropped before any pre-registration was pushed (owner: gold
  first).

## 2. Data

- OANDA mid **XAU/USD M5** candles through the site's keyless candle proxy (`/md/bars?sym=xau&tf=5m`), paged in 4,999-candle
  windows as `research/edge/orb-nas100/fetch.mjs` does; complete candles only. Window used: **1 Jan 2016 to 13 Nov 2026**.
  The cache is kept out of git (`node --use-env-proxy research/edge/ict-silver-bullet-gold/fetch.mjs <dir>`).
- Clock: candles are UTC; New York time comes from `ict/calendar.mjs` `nyParts` (the IANA zone, so US daylight saving is
  handled on its real dates).
- Calendar: `ict/calendar.mjs`, read only. A candle where `cmeShut(t)` is true is dropped. A trading day D (New York date) is
  used only when it is a Monday to Friday whose `dayInfo(D).kind` is `'open'` (CME full holidays and early-close days are
  skipped).

## 3. The rule (fixed here, in my own words)

Times are New York. For a trading day D:

1. **Draw on liquidity.** Prior day = the previous Monday-to-Friday that is not a CME full holiday; its session runs from
   18:00 of the evening before it to 17:00 of that day (the 17:00-New York day). Asian range = 18:00 on the evening before D
   to 00:00 on D. **Buy-side level** BSL = the higher of the prior day's high and the Asian high; **sell-side level** SSL = the
   lower of the prior day's low and the Asian low. A day missing either part (no candle in the prior day or in the Asian
   range) is skipped.
2. **Sweep.** From 00:00 on D, a candle whose high is above BSL has swept the buy side; one whose low is below SSL the sell
   side. The FIRST side swept sets the direction: buy side swept → look for **sells**; sell side swept → **buys**. If both
   sides are swept in the same candle, or the opposite side is swept later but before the entry fills, the day has no trade.
   The sweep must happen at or before the close of the gap's third candle (step 3).
3. **Fair value gap.** Three consecutive M5 candles c1, c2, c3. A sell gap: c3's high is below c1's low, and c2 closes below
   its open. A buy gap: c3's low is above c1's high, and c2 closes above its open. The gap counts only when c3 OPENS between
   the window's start and 10 minutes before its end (AM: c3 opens 10:00 to 10:50), so it is complete by 5 minutes before the
   window ends. The **first** such gap in the trade direction whose c3 closes at or after the sweep candle is taken; later
   gaps of that day are ignored (even if the first does not fill).
4. **Entry.** A limit at the gap's near edge: sells at c3's high, buys at c3's low. It may fill on any candle after c3 that
   opens before the window's end (AM: up to the candle opening 10:55, so valid until 11:00). Filled when the candle trades
   at or through the limit; the fill price is the limit, or the candle's open when the open is already beyond it (a real
   limit fills at the better open). Not filled by the window's end → no trade.
5. **Stop** at c1's extreme: sells at c1's high, buys at c1's low (the far side of the gap's first candle). Risk r = |entry −
   stop|; a setup with r ≤ 0 is skipped. No minimum stop.
6. **Target (one choice, fixed here): the nearer of the opposite draw and 2R.** Sells: the higher of SSL and entry − 2r; buys:
   the lower of BSL and entry + 2r. If the opposite draw is less than 1R from the entry the setup is skipped (no room).
7. **Management.** Stop first when one candle holds both stop and target. In the fill candle only the stop is checked (a
   target in the fill candle is not taken). A candle that opens beyond the stop fills the stop at its open. **Flat at 16:00**:
   the close of the 15:55 candle (the last candle before 16:00 if that one is missing).
8. **At most one trade a day** per window test.

## 4. Tests (three, Holm across them)

- **T1 (primary): AM window, 10:00-11:00.**
- T2 (secondary): PM window, 14:00-15:00.
- T3 (secondary): London window, 03:00-04:00.

Each is a separate stream with the same rule; only the window changes (and so the gap's time limits and the entry's
validity). A secondary pass alone is a hypothesis for a new pre-registration, not a finding.

## 5. Costs

$0.30 a round trip per ounce, charged once per trade and converted to R by the trade's own risk: the gold studies' figure
(`research/edge/gold-systems`, from `spreadOf` for spot in `council/fills.mjs`, the typical spread). Every figure is also
reported at 2x costs ($0.60, room for a wider spread and slippage). No financing: every trade is flat at 16:00, before the
17:00 rollover.

## 6. Windows and statistics

- In sample **2016-01-01 to 2020-12-31**; out of sample **2021-01-01 to 2026-11-13** (decides).
- t = mean / standard error of **calendar-month sums** of net R. One-sided p = 1 − Φ(t). Holm over T1, T2, T3 (out of sample).
- **Placebo**: the same rule with the one-hour window replaced, per day, by a random hour whose start is drawn uniformly on
  the 5-minute grid from 00:30 to 14:55 New York (40 seeds, seeded generator; one draw per day per seed). The statistic is the
  out-of-sample mean net R a trade of each seed; its 95th percentile is the bar. One placebo distribution serves all three
  tests.
- Reported, not judged: gross figures, per year, exits, longs vs shorts, median stop in dollars, worst drawdown.

## 7. Pass bar (T1 decides the verdict)

T1 passes only if ALL hold: out-of-sample net R a trade > 0 **and** month t ≥ 2; Holm-adjusted p < 0.05; in-sample net R a
trade > 0 (same sign); out-of-sample net R a trade > 0 at 2x costs; out-of-sample net R a trade above the placebo's 95th
percentile. T2 and T3 are judged on the same bar as secondary. Verdict: PASS (T1 passes), FAIL otherwise. Nothing is tuned
after this file: the run happens once.

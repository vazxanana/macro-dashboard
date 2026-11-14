# Pre-registration: gold's London move faded in New York (the "Judas swing")

Written on 14 Nov 2026, **before any trade of this rule was simulated or any outcome computed**. This file is pushed alone,
first; `fetch.mjs`, `run.mjs`, `RESULT.md`, `result.json` and the test come after it. Its sha256 is written into `result.json`
(`planSha256`).

Paper research only. Nothing live changes whatever the result; a pass would at most be a proposal for the owner.

**Item 44 (docs/owner-decisions.md).** This is a new, standalone intraday rule on spot gold. It is NOT a gate, exit, entry or
size of the live gold book (Gold trend, Gold daily engulf) and reads none of that book's positions. No candle before
1 Jan 2016 is read (the ATR warm-up is taken from January 2016 itself), and no record of `gold-systems-oos`,
`supported-book` or their kin is opened.

## 1. Why this, and what was tested before

The owner's market-maker-model material says London often makes the day's high or low and New York reverses it (the
"Judas swing"), with a New York reversal "sweet spot" of 09:00-10:30 New York, selling above the midnight open and buying
below it. Dedupe, read before writing this (14 Nov 2026):
- `fx-asia-london-reversal` (branch): the FX version one session earlier: the Asian move faded in London on seven majors.
  FAIL (pool OOS −0.048R a trade, t −3.24). Its design (move threshold 0.3 x ATR20, fade at the next session's open, stop
  beyond the session extreme, flat at a fixed time) is mirrored here, moved one session later and onto gold.
- `gold-session-drift`: fixed-session longs / shorts with a trend filter, no fade of a measured move. FAIL.
- `gold-us-asia`, `gold-late-ny`: the New York move followed / faded into Asia. FAIL.
- `gold-asia-break`: the Asian range broken or faded in London. FAIL.
- `mmxm-pdhl-raid-gold`: the previous day's high / low raided in the New York kill zone, an M15 shift and an H1-gap target.
  FAIL (12 trades). It reads the prior day's extremes, not London's, and needs a structure shift.
- `ict-silver-bullet-gold`, `gold-comex-orb`, `intraday-momentum`, `metals-intraday-momentum`: other windows / entries. FAIL.
- None fades the London session's own move during New York on gold; T2 (midnight-open side) and T3 (a New York raid of the
  London extreme, then a close back inside) are not tested anywhere.

## 2. Data

- OANDA mid **XAU/USD M5** candles through the site's keyless candle proxy (`/md/bars?sym=xau&tf=5m`), 4,999-candle windows,
  complete candles only. Window read: **1 Jan 2016 to 13 Nov 2026**. Cache kept out of git
  (`node --use-env-proxy research/edge/gold-london-reversal/fetch.mjs <dir>` → `xau-5m.json.gz`; the run also accepts the
  same file made by the `ict-silver-bullet-gold` fetch and drops every candle before 2016).
- Clock: candles are UTC; New York time from `ict/calendar.mjs` `nyParts` (IANA zone).
- Calendar: `ict/calendar.mjs`, read only. Candles where `cmeShut(t)` is true are dropped. A trading day D (New York date)
  is used only when it is Monday to Friday and `dayInfo(D).kind === 'open'` (full holidays and early closes skipped).
- Market set: spot gold only (XAU/USD). Nothing else is run.

## 3. The rule (fixed here)

Times are New York. For a trading day D:

1. **Levels.** Midnight open MO = the open of the first candle at or after 00:00 on D, if that candle opens before 00:30
   (else the day is skipped). London = the candles opening 02:00 to 07:55. London open LO = open of the first London candle,
   London close LC = close of the last; LH / LL = the highest high / lowest low of London. At least 60 of the 72 London
   candles are needed. London move M = LC − LO.
2. **ATR20.** The mean true range of the 20 most recent complete 17:00-New York sessions before D (session = 18:00 the
   evening before to 17:00; true range uses the previous session's close). Fewer than 20 sessions on file → no trade.
3. **Trade day.** |M| > 0.3 x ATR20 (the FX study's threshold). The trade side s is AGAINST the London move: London up →
   sell (s = −1), London down → buy (s = +1).
4. **Stop** (every trade has one). For a sell: the highest high of the candles from 02:00 up to and including the candle
   before entry, plus $0.30; for a buy: the lowest low over the same candles, minus $0.30. If the stop is closer to the entry
   than 0.1 x ATR20, it is moved out to 0.1 x ATR20 from the entry. Risk r = |entry − stop|.
5. **Exit.** The stop (a candle that opens beyond it fills at its open; otherwise at the stop), or the close of the 15:55
   candle (flat at 16:00). Checked from the candle after the entry; in the entry candle itself only the stop is checked
   (stop first). No target. One trade a day per test. No financing (flat the same day).

The three tests (all market orders):
- **T1 (primary): fade London at the cash open.** Entry at the open of the 09:30 candle.
- **T2: T1, only on the midnight open's side.** As T1, and only when both London's extreme in its own direction and the
  entry price are beyond the midnight open: a sell needs LH > MO and entry > MO; a buy needs LL < MO and entry < MO.
- **T3: New York raids the London extreme first.** Same trade days and side as T1. A raid = a candle opening 08:00 or later
  that trades beyond the London extreme in London's direction (sell: high > LH; buy: low < LL). The signal is the first
  candle that opens 09:00 to 10:25 and closes back inside (sell: close < LH; buy: close > LL) while it or the candle before
  it is beyond the extreme (sell: its high > LH or the previous close > LH; mirror for buys), with a raid at or before it.
  Entry at the open of the next candle (by 10:30). No signal → no trade. Stop rule 4 (it includes the raid's extreme).

## 4. Costs

$0.30 spread a round trip per ounce (`research/edge/gold-systems`, `spreadOf` for spot) plus half a spread ($0.15) of
slippage on each market order (entry and exit): **$0.60 a round trip**. Net R = gross R − 0.60 / r. Reported also at 2x
($1.20). No financing (no position is held over 17:00).

## 5. Windows and statistics

- **In sample 2016-01-01 to 2020-12-31; out of sample 2021-01-01 to 2026-11-13.** (This task's split; the 2016 floor
  is item 44.)
- t = mean / standard error of **calendar-month sums** of net R. One-sided p from the normal; **Holm over the three
  tests** (out of sample).
- **Placebo**: 40 seeded draws (seeds 1-40); in each, every trade day of a test gets a random side (fair coin) with the
  same entry time, stop rule (applied for that side: a random sell's stop above, a random buy's below) and exit; mean net
  R a trade out of sample per seed; the 95th percentile is the bar.
- **Pass (each test)**: out of sample net R a trade > 0, month-sum t ≥ 2, Holm p < 0.05, in sample net R a trade > 0,
  out of sample net > 0 at 2x costs, and out of sample net above the placebo's 95th percentile. **Verdict PASS when at least one test passes
  every check** (the bold line names which; T1 is the primary). Anything else is FAIL. No rule, threshold, time or cost
  is changed after the first run.
- Also reported (descriptive only): gross R, buys / sells, by year, stops / time exits, max drawdown, median stop.

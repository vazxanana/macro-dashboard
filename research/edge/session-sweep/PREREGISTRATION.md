# Asia range sweep, then a 5-minute QM back inside: pre-registration

Written 23 Nov 2026, before any candle of any test window was read for this question. Research only: nothing live reads this
folder, no rule, size, stop or config changes, paper and demo only. Not a repeat of the failed session studies here
(`fx-asia-london-reversal`: fade the Asia move at a fixed hour; `gold-asia-break`: trade the Asia break; `gold-london-reversal`;
`ict-sessions` / `ict-oos-2008`: the H1 iFVG): this rule needs a sweep of one side of the Asia range AND a structure break
(QM) back inside it, and targets the other side of the range.

## The rule (every clock below is New York local time, from the toolkit's `nyOffsetH`; candles are OANDA mid M5)
1. **Asia range** of a New York day D = highest high and lowest low of the M5 candles starting 20:00 (on D−1) to 23:55. Known at
   00:00. A day is skipped when fewer than 36 of those 48 candles exist, or the range is zero.
2. **Windows**: London 02:00-05:00, New York morning 09:00-10:30 (a candle belongs to a window when it starts and closes inside).
3. **Fresh side**: a side of the Asia range (its high or its low) is fresh in a window when no M5 candle has traded beyond it
   between 00:00 and the window's first candle.
4. **Sweep**: inside a window, the first M5 candle whose high trades above a fresh Asia high (low below a fresh Asia low).
5. **QM back inside**: after the sweep candle, the first QM of the toolkit's `qms(M5, 3)` against the sweep (a QM sell after a
   high sweep, a QM buy after a low sweep) whose breaking candle closes inside the same window, whose close is back inside the
   Asia range, and whose head lies beyond the swept side. If the other side of the range is swept first, or price reaches the
   target before the QM, the setup is cancelled.
6. **Entry**: market at the open of the M5 candle after the QM's breaking candle. **Stop**: beyond the sweep extreme (the
   highest high / lowest low from the sweep candle to the QM close) by one round-trip cost of that market. **Target**: the other
   side of the Asia range. Skipped when the target is under 1.0R away or the entry is already past it.
7. **Exits** (toolkit `simulate` on M5): stop, target, or a time exit at the close of the 16:00 candle of day D. Every trade has a
   stop on its losing side. One trade a market a day: the London window first; the New York window only when London gave none.

## Markets, data, windows
Gold (`xau`) and EUR/USD (`eurusd`), the toolkit's M5 cache. In sample 2020-01-01 to 2023-12-31; out of sample 2024-01-01 to the
last candle on file at run time (recorded in result.json). The candidate was shaped on an owner chart of November 2026, so a
**replication window 2010-01-01 to 2019-12-31** is required as well. Each window is read once, by one run of the final code.

## Costs and statistic
Round trip = toolkit `COSTS` (gold $0.30, EUR/USD 0.00006), taken off every trade in R; no financing (every trade ends before
17:00). Also reported at 2x costs. Statistic: mean R a trade after costs, t on calendar-month sums (toolkit `stats`).

## Tests (Holm over all four)
- **Primary P**: gold and EUR/USD pooled, both windows, both sides.
- S1: gold alone. S2: EUR/USD alone.
- S3: the pool, only trades WITH the daily bias (the last completed 17:00 New York trading day closed above its 50-day average
  of closes = buys only; below = sells only).

## Pass bar (each test, judged on its own)
Out-of-sample mean > 0, out-of-sample month t >= 2 with Holm-adjusted p < 0.05, in-sample mean > 0, out-of-sample mean > 0 at 2x
costs, and at least 30 out-of-sample trades. The primary also needs a positive mean on 2010-2019.

## Verdicts
- **PASS**: the primary meets the whole bar (a secondary passing alone is reported as a hypothesis for its own test, not an edge).
- **INCONCLUSIVE**: the primary has fewer than 30 out-of-sample trades, or the data has holes over 10 % of the days of a window.
- **FAIL**: anything else, including a primary that passes 2020-26 but is not positive on 2010-2019.
Reported, never judged: by year, by window (London / New York), by side, win rate, worst drawdown, exits by type, and a
month-block bootstrap of the out-of-sample mean. No setting (hours, K, buffer, 1.0R floor, exit time) is changed after a result.

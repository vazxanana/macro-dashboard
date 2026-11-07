# Pre-registration: do ICT A-setups lose when the Dollar Smile is at an extreme? (out-of-sample test)

Written on 7 Nov 2026, before any out-of-sample trade was generated or classified. Nothing in this file may change after
the first computation. The run happens once, on GitHub Actions (FRED and Cboe are reachable there, not in the sandbox), and
its result is reported whatever it is.

## Where the idea came from

PR #507 (`research/edge/ict-macro`) tested two pre-registered macro filters on the desk replay (Aug 2025 to Nov 2026) and
both failed. After seeing the Dollar Smile cells it grouped the two dollar-bid sides together:

- Smile **left or right**: n 106, −0.185R a trade (t −1.44).
- Smile **mid or trough**: n 136, +0.663R a trade.
- Lower on the dollar-bid side in 4 of 5 markets.

The grouping was chosen after looking, so that sample is spent. This study tests the same grouping on trades it has never
seen: everything before the replay's first trade.

## Trades (out-of-sample)

- **Code.** `research/edge/ict-universe/universe.mjs`, unchanged: the desk's own `signals()`, `isASetup()`, `sizeOf()`,
  `MIN_GRADE` (ict/tracker.mjs) and `simulate()` (ict/replay.mjs, post-#413 gap guard), the replay's busy rule.
- **Data.** HistData M1 from council-data `research/candles/` (EST without DST, +5 h to UTC), the files the robustness audit
  and the ict-universe study used:
  - GC: XAUUSD spot, the gold A-rule (`aRule: 'gold'`, buys, stop 0.3-0.75x the daily ATR, size 1).
  - NQ: NAS100 cash (NSXUSD), the index default A-rule (DOL sizing, break-even at +1.5R).
  - ES: SPX500 cash (SPXUSD), the index default A-rule.
- **Set.** Every closed A-setup (`aset = 1`) under the rule set the desk uses for that market (the ict-universe "primary"
  cells) whose signal candle closes from **1 Jan 2018 00:00 UTC to 31 Jul 2025 23:59 UTC**. The #507 sample starts on
  4 Aug 2025, so the two samples share no trade.
- **R.** Primary: R as the replay stores it, gross R x size (the R the lead and the Coach's `ictVariantVerdicts` use).
  Sensitivity (reported, not a pass route): net R = size x (R − cost/risk), with ict-universe's costs.
- **Halves.** Each group's trades sorted by close time and split by count, as in `ictVariantVerdicts`.

## Regime of a trade (no look-ahead)

The Dollar Smile phase is `drivers(features(data, D)).smile.phase` from `council/macro.mjs`, **imported, unchanged**:

```
stress = HY OAS 5-day change >= +0.15 or swap lines >= $5bn or VIX >= 28 or SOFR − EFFR >= 15bp      → left
DXY 5-day change >= +0.25, VIX < 22 (or none), and (real 10Y 5-day change >= +0.02 or 2Y 5-day change >= +0.03) → right
DXY 5-day change <= −0.15, VIX < 22 (or none), and (HY OAS 5-day change <= +0.05 or no HY data)                → trough
otherwise                                                                                             → mid
```

- **Day.** `D` = the UTC day of the signal candle's close.
- **FRED inputs.** BAMLH0A0HYM2 (HY OAS), SWPT (swap lines), VIXCLS, SOFR, EFFR, DFII10, DGS2, and the rest of macro.mjs's
  FRED list. Each is used only after macro.mjs's publication lag (`LAG`, unchanged: 2 days for all of these, VIX included)
  and its staleness limit (`MAX_AGE`).
- **Fetching.** FRED `fredgraph.csv` from 2017-01-01, using macro.mjs's own parser. If FRED does not answer for VIXCLS or
  VXVCLS, the Cboe CSV is used, as `gather()` does.
- **DXY.** macro.mjs's `dxySeries()` (ICE formula) on daily EUR/USD, USD/JPY, GBP/USD, USD/CAD and USD/CHF candles. The
  OANDA feed that macro.mjs reads does not reach back to 2018, so these candles are built from the same HistData M1 files
  as UTC-midnight daily candles. That is the stamp the OANDA feed uses (candle time = 00:00 UTC of its day), so
  `barsBefore(D)` sees only candles that closed by 00:00 UTC on day D.
- **Missing data.** A day with no Smile phase (macro.mjs returns null) is "no data" and is left out. Any input macro.mjs
  receives as null is handled the way macro.mjs handles it live.
- **Known gap, declared now.** FRED limits ICE BofA series such as HY OAS to roughly the last three years. If HY OAS does
  not cover a day, macro.mjs sees `hy = null`. Then the left side can only come from VIX >= 28, swap lines or SOFR − EFFR,
  and the trough's HY condition is met by default. The right side does not use HY at all. The report states the HY
  coverage, and it shows the HY-covered days on their own as a descriptive cell. That cell is not a pass route.

## Hypothesis (one, confirmatory)

**H. A-setups taken when the Smile is on the left or right side lose money.** The proposed filter `nosmilex` drops them and
keeps the mid and trough A-setups.

## Pass bar (all three, on the dropped trades, pooled over GC, NQ and ES, primary R)

1. n >= 30 dropped trades;
2. mean R with t <= −2 (mean R / standard error);
3. mean R < 0 in both halves.

There is one hypothesis, so there is no multiple-testing correction. At these sample sizes, t <= −2 is a one-sided p of
about 0.023.

## Reported, but none of it is a pass route

- Every Smile phase (left, right, trough, mid): n, R a trade, t, both halves.
- Dollar bid (left + right) against mid + trough: Welch t of the difference.
- By market (GC, NQ, ES) and by year (2018 to 2025; 2025 is January to July), dollar bid against the rest.
- Net-of-cost R.
- VIX at a 1-day lag (the lag #507 used) instead of macro.mjs's 2 days.
- The HY-covered days only.

## No tuning

The thresholds, the lags, the window, the markets, the rule sets and the pass bar are fixed above. The analysis runs once.
If the job has to run again because a fetch failed, it runs the same code on the same trades. Nothing is re-chosen after
the result is seen.

## What follows

- **Pass:** `nosmilex` becomes a paper-only ICT variant beside `nofri` / `h1opp` (as #467 did). The live A-stream must
  stay byte-identical, shown by a before/after run.
- **Fail:** the null result goes to `RESULT.md` and the lead is closed.

No live rule changes either way.

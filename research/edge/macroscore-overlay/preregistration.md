# Gold Macro Score as a sizing overlay: pre-registration

Written and committed **before** any number that joins the score to a position was computed. FRED cannot be reached from the research sandbox, so the study runs once on GitHub Actions (`.github/workflows/macroscore-overlay.yml`, the `macro-gold` pattern) and writes council-data `research/macroscore-overlay.json`; `RESULT.md` is written after that file exists. The rules, windows, costs and pass bars below decide the verdict. Nothing in them changes after the results are seen; anything added later is labelled post hoc in `RESULT.md`. Paper research only: no live rule, size, filter, trader, replay or site code changes. A PASS is a proposal for the owner.

## Question

`council/macroscore.mjs` (#592) ports the macro-agent-demo skill's **Gold Macro Score**: four drivers (fall in the 10y real yield over 4 weeks, FRED `DFII10`; fall in the ICE dollar index over 4 weeks, log; fall in the 2Y over 13 weeks, `DGS2`; 10y–2y steepening over 13 weeks, `DGS10 − DGS2`), weekly at the Friday close, expanding z-scores (52-week minimum), clipped ±3, averaged. The skill's own test (2007–2026 weekly): rank IC +0.15 with the next 4-week gold return, score > +0.25 → +2.2% over 4 weeks, up 69%; ≤ +0.25 no edge; negative scores do not predict falls. The skill's execution rule for a long-only gold swing system is **"use the score to size, not to permit: half risk normally, full planned risk when the score is above +0.25"** (its Donchian test: win rate 65% against 56%).

Does that rule help the council's honest-positive, long-only gold systems on gold they never saw? And does the score hold up as a calibration on this data at all?

Context: every edge found so far is regime-bound (#508, #511, #512, #526, #530, #592's own caveats); the macro-gold study (`research/edge/macro-gold`) found the 20-day real-yield change does **not** time gold or the Gold trend entries out of sample. This study asks a different, weekly, four-driver question, and it asks it about sizing, not permission.

## Data (nothing re-run, no candle refetch)

- **FRED** `DFII10`, `DGS2`, `DGS10`: `fredgraph.csv` from `cosd=2003-01-01`, fetched inside the workflow.
- **DXY**: the council's own ICE formula (`dxyDaily` in `council/macroscore.mjs`) on the daily candle caches council-data `research/daily/{eurusd,usdjpy,gbpusd,usdcad,usdchf}.json` (OANDA D1 mid, since 2002), sparse-checked-out in the workflow.
- **Gold**: daily closes from council-data `research/daily/xau.json` (OANDA, from 2006-03-20).
- **Score**: computed by `council/macroscore.mjs` itself (`weeklyFrame`, `expandingZ`, the same raw diffs as `goldMacroScore`; frame from `FROM = 2006-06-01`, 52-week minimum, clip ±3). The weekly series is self-checked against `goldMacroScore(..., { asOf: friday })` at every week (the two must agree to 2 decimals or the run reports a failed self-check and the result is `incomplete`).
- **Positions** (as committed, not re-run): `research/edge/gold-systems-oos/result.json` `positions` (gtrend, gtrend5, geg, gtl; fields `t` entry UTC minute, `c` close, `n` net R at ×1 = $0.30 a unit a round trip, `n2` at ×2 = $0.60) and `research/edge/mosha-oos/result.json` `positions` (Mosha BO, `side` buy / sell, same fields).

## The score at a position (no look-ahead)

- The weekly score of the Friday week *W* is dated *W* (Friday 00:00 UTC label; the week's last observation is Friday's).
- **Primary lag (the macro-gold convention):** a week's score is usable from **24:00 UTC of the second weekday after its Friday**, i.e. from Wednesday 00:00 UTC (*W* + 5 days). H.15 posts Friday's value on Monday around 16:15 New York; the trend systems enter at 00:04–00:09 UTC, so a Monday entry must not see Friday's value. Every FRED observation in the week is then at least 5 days old.
- **Sensitivity lag (reported, not the verdict):** usable from *W* + 2 days (Sunday 00:00 UTC): every observation at least 2 days old, Monday entries included.
- The score at an entry at time *t* = the score of the latest week usable at *t*. Positions entered before the first usable score week (the expanding z needs 13 + 52 weeks after 2006-06, so scores begin in the second half of 2007) are **excluded from both arms** of every comparison (like for like); their count is reported.
- **Sensitivity S2 (reported, not the verdict):** the frame started at 2003-06-01 instead of 2006-06-01, so a score exists for every position from 2006-07. It changes every z-score's expanding window, so it is not the council's reading; it only shows whether the excluded 2006–07 positions change the picture.

## Windows and costs

- **Untouched (verdict):** positions entered **2006-07-01 to 2017-12-31**; halves **H1 2006-07 to 2011-12**, **H2 2012-01 to 2017-12** (as #530, #580).
- **Built-on (confirmation, not choice):** entered **2018-01-01 to 2026-10-31**.
- **Recent (reported):** entered **2023-01-01 to 2026-10-31**.
- Costs: ×1 (`n`) and ×2 (`n2`) as the source studies recorded them. Sizes multiply the recorded net R (the position's add and live size are inside it).
- Daily equity as `research/edge/honest-book/run.mjs`: each position's R is booked on its close day (UTC; Saturday / Sunday rolled to Monday) at its size; metrics on the window's weekdays (extended to the last close day of a position entered in the window): total R, worst drawdown, return / drawdown, Sharpe-like t = mean / sd × √days, positive months, by year.

## H0 · calibration (must pass or the overlay test is VOID)

Weekly, Friday weeks from **2007-01-05 to the last week with a realised 4-week return**; gold's weekly close = the last daily close of the week; forward return = close 4 weeks later / close − 1.

- Spearman rank IC of the score with the next 4-week return, Newey–West t (Bartlett, 3 lags, for the 4-week overlap), plus the plain t.
- **H0 passes when:** IC > 0, Newey–West t ≥ 2, **IC within ±0.05 of the skill's +0.15** (0.10 to 0.20), and the mean 4-week return of weeks with score > +0.25 is **higher** than that of the other weeks.
- Reported too: hit rate and mean return of > +0.25 weeks (skill: +2.2%, 69%), of ≤ +0.25 weeks, and of < −0.75 weeks (skill: no fall predicted); the IC in the skill's three periods 2007–14 / 2015–21 / 2022–26; the share of weeks above +0.25.

## H1 · the skill's sizing rule (the verdict)

Pooled **long** positions of the honest-positive gold systems: `gtrend`, `gtrend5`, `geg`, `gtl`, Mosha BO **buys**. Fixed arm: 1R a position (as recorded). Sized arm: **1R when the score at entry is > +0.25, 0.5R otherwise.** Both arms over the same positions (those with a score).

Untouched window, all of:

1. return / drawdown of the sized arm **higher** than the fixed arm at **×1 and ×2**;
2. higher in **both halves** 2006-07..2011-12 and 2012-01..2017-12 (×1);
3. total R of the sized arm **not lower than 90%** of the fixed arm's (×1).

Then **confirmed (not chosen)** on 2018-01..2026-10: tests 1 and 3 reported; "confirmed" when both hold.

Also reported, informational: the same three tests per system; per-position mean R of > +0.25 against ≤ +0.25 positions (n, win rate, mean R at ×1 / ×2, Welch t, a 10,000-draw label-permutation P of the difference in mean ×1 R); a paired 2,000-draw month-block bootstrap (seed 1) of the difference in return / drawdown and in t between the arms, P(diff > 0) (≥ 0.95 reads "more than noise"; it does not decide the verdict); the sized arm normalised to the same average risk (so return / drawdown and t are unchanged and total R is comparable); the 2023-01..2026-10 window; the share of positions above and below +0.25 per window and per system.

## H2 · gate (reported, expected to lose trades)

Longs taken only when the score at entry is > +0.25, skipped otherwise; same positions, same booking. Report n kept / skipped, total R, return / drawdown, t against the fixed arm, on the three windows at ×1 and ×2.

## H3 · the score for Mosha SELLS (reported)

Mosha BO sells by score at entry: > +0.25 against ≤ +0.25: n, win rate, mean R at ×1 / ×2, total, Welch t. The skill says never short gold while the score is above +0.25; with about 30 sells in 20 years this can only be descriptive.

## Book effect (reported)

The honest-book books **B** (gtrend, geg, mosha-bo, gtl) and **C** (B + gtrend5) at the council's fixed 1R, against the same books with the H1 sizing applied to their long positions (Mosha sells unchanged at 1R): total R, worst drawdown, return / drawdown, t, both costs, on the three windows, with the paired month-block bootstrap of the difference.

## Verdict

- **VOID** if H0 fails (the score is not calibrated on this data; the overlay test is not read).
- **PASS** if H0 passes and H1's three untouched tests all pass. The 2018–26 confirmation and the bootstrap P qualify the sentence ("confirmed" / "not confirmed on 2018–26"; "more than noise" / "within noise"); they do not change the class. A PASS is a written proposal for the owner, at most a paper shadow stream: nothing goes live.
- **FAIL** otherwise.

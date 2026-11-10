# Gold systems on 8 years of spot gold — robustness check

> **Clock correction, 10 Nov 2026.** Re-run on the corrected candle clock. The numbers moved slightly (replica live 391 trades at +0.479R became 394 at +0.462R); the FAIL verdict did not. The text below quotes the old numbers. Details: the last section of this page.

**Question.** How robust are the council's gold systems on 2018–2026 gold M1 history? For each system: results by year, out-of-sample 2024–2026, and worst drawdown compared with what its approval claimed. Then: is the replica's volatility gate too strict? Gold's 20-day range is 1.48% today and the gate needs 2.416%, so the gate blocks every trade.

**Short answer.**
- **The gate is not too strict. Keep the top fifth (`goldVolPct: 80`).**
  - A walk-forward choice made on 2018–2023 picks the live top-fifth gate.
  - The top-third gate and no gate both do worse in-sample.
  - The signals that a looser gate would add (calm-to-normal gold) lost out-of-sample: −0.26 to −0.31R a trade.
  - Even a median gate would be shut today. Gold's 20-day range is in the bottom half of its last year.
- **Every system is positive over the 8 years, but each one is weaker than its approval claimed, and two have worse drawdowns than claimed.**
  - Replica: worst drawdown −40R, against claims of −10 to −18R.
  - Mosha's "slow arrival" rule is not supported out-of-sample.
  - H4 trendline: flat before 2023.

**Verdict: FAIL. No setting change is recommended.** Every gate variant tested fails the walk-forward rule. This is a robustness audit, so the useful output is the corrected expectations below.

## Method

- **Data.**
  - HistData XAUUSD M1, 2018-01-01 to 2026-10-30 (3.08 M bars, from council-data `research/candles/xau-histdata`).
  - The labels are New York wall-clock time with daylight saving; they are converted to UTC.
  - Bars are UTC buckets. Daily candles are UTC weekdays, with Sunday evening folded into Monday.
- **Same code as live.**
  - `replicaSignals`, `platformEngulfs`, `goldLevels` and `msnrDirection` are copied word for word out of `council/trader.mjs` at run time (`live.mjs`).
  - `msAnalyze` is imported from `council/engine.mjs`.
  - The trade-management loop is a per-bar port of trader.mjs "Manage open trades" (`core.mjs: step`). That covers stop before target, the 48/72/96/240 h time exits, trail, breakeven and the pyramid add with its re-expressed trail and size.
  - The gold trend, trendline, engulf and Mosha blocks are ports of their live blocks (`daily.mjs`, `mosha.mjs`).
- **Timing.** Each decision runs 4 minutes after the bar close it reacts to, which matches the live cron and lag. A market entry takes the last M1 close at that moment. Limit orders fill on an M1 touch.
- **Costs.** $0.30 per round trip per unit, from `spreadOf` for spot in council/backtest.mjs. Net and gross are both reported.
- **Statistics.** One row per position (first unit plus its add, sized). R is net of costs. maxDD is measured on the closed-trade equity curve.
- **Split.** In-sample 2018–2023, out-of-sample 2024–2026. **Caveat:** the approvals were judged on 2023 onwards, so 2024–26 was used to design these rules. It is not a clean out-of-sample for them; 2018–2022 is the less-contaminated check.
- **Departures from live, which are approximations.**
  - Engine events and trends are computed on the full history, not on a rolling 720-candle Kraken window. Live H1 Origins are limited to the last 720 H1 bars.
  - D1 candles come from spot UTC weekdays. Live uses OANDA for the D1 trend label and Kraken PAXG daily candles, which include weekends, for the volatility gate and the daily systems.
  - The replica's equity-filter history starts empty; live seeds it from a replay.
- **Variants tried:** 24 in total (replica 9, Mosha 7, daily systems 8). Only the 5 gate variants were candidates; the rest are diagnostics.

## Summary table (net R, per position)

| System (live config) | IS 2018–23 n / exp / R / maxDD | OOS 2024–26 n / exp / R / maxDD / t | OOS years + | 8-yr maxDD | Claimed maxDD |
|---|---|---|---|---|---|
| Gold replica | 159 / +0.28 / +44.3 / −40.2 | 232 / +0.62 / +143.2 / −18.6 / 2.84 | 3/3 | **−40.2** | −10.3 (23–24), −14.4 (25–26) |
| Mosha BO (weekly + slow, BE/add/run) | 46 / +0.49 / +22.5 / −10.7 | **18** / +0.64 / +11.5 / −4.6 / 1.10 | 2/3 | −10.7 | slow: −3.5 / −11.3 |
| Mosha BO weekly, 3R (as approved 4 Nov) | 106 / +0.14 / +14.5 / −8.0 | 61 / +0.36 / +21.7 / −12.2 / 1.73 | 3/3 | −12.2 | −18.4 |
| Gold daily engulf | 109 / +0.21 / +22.4 / −10.2 | 65 / +0.44 / +28.8 / −6.5 / 1.81 | 2/3 | −10.2 | −9.8 / −6.3 |
| Gold trend N20 + add | 26 / +1.06 / +27.7 / −3.7 | 15 / +2.55 / +38.3 / −2.0 / 1.77 | 3/3 | −3.7 | −2.5 / −1.0 |
| Gold trend N5 + add | 53 / +0.63 / +33.2 / −6.6 | 23 / +2.02 / +46.4 / −3.3 / 2.04 | 3/3 | −6.6 | −4.5 / −2.4 / −2.9 |
| Gold H4 trendline | 210 / +0.05 / +9.5 / −14.1 | 104 / +0.33 / +34.8 / −9.9 / 2.51 | 2/3 | −14.1 | −4.1 / −6.6 |

## Per year (net R; trade count in brackets)

| System | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 (to Oct) |
|---|---|---|---|---|---|---|---|---|---|
| Replica live | – (0)¹ | −1.7 (1) | +37.5 (69) | +2.6 (5) | +20.7 (62) | **−14.8** (22) | +79.1 (72) | +59.3 (89) | +4.8 (71) |
| Mosha live | −6.9 (12) | +12.2 (3) | +9.9 (11) | +2.4 (3) | −0.3 (11) | +5.3 (6) | +11.2 (5) | +0.4 (9) | −0.0 (4) |
| Mosha weekly 3R | −7.0 (21) | +17.0 (14) | +4.5 (19) | −1.3 (18) | +0.4 (19) | +1.0 (15) | +8.6 (11) | +4.7 (39) | +8.4 (11) |
| Daily engulf | −2.4 (16) | +5.3 (22) | +11.5 (23) | +13.4 (15) | −5.1 (18) | −0.4 (15) | +10.7 (25) | +21.7 (28) | −3.7 (12) |
| Trend N20 + add | +5.3 (3) | +12.7 (4) | +3.7 (6) | +1.3 (3) | +6.7 (5) | −2.1 (5) | +8.6 (5) | +23.1 (7) | +6.6 (3) |
| Trend N5 + add | −0.0 (9) | +13.5 (8) | +6.3 (10) | +0.3 (9) | +10.0 (7) | +3.2 (10) | +11.7 (9) | +26.6 (9) | +8.1 (5) |
| H4 trendline | +4.3 (30) | +1.8 (42) | +2.7 (36) | +3.2 (37) | −5.8 (31) | +3.3 (34) | +12.8 (36) | +25.9 (36) | −3.9 (32) |

¹ The percentile gate needs 200 days of history, so 2018 has no trades.

## Each system compared with its approval claim

- **Gold replica (live).**
  - Claimed: 2023–24 +120.2R (drawdown −10.3), 2025–26 +170.3R (drawdown −14.4).
  - Replicated: +64.3R (−21.9) and +64.1R (−18.6).
  - The worst drawdown over all 8 years is **−40.2R**, inside 2018–23, which is 2–4× the claim. 2023 loses −14.8R, and 2026 to October makes only +4.8R.
  - The approvals overstate this system by about 2×.
  - The edge rests on the MSNR size tilt plus the risk rules:
    - Without the 1.5/0.5 tilt, in-sample falls from +44R to +8R and out-of-sample from +143R to +107R.
    - The raw v5 + D1-with signals, taken as single units with no gate, lose −0.12R a trade in 2018–23. In-sample t is 0.93.
  - **Robustness: moderate out-of-sample, weak in-sample.**
- **Mosha BO.**
  - The weekly-filter base (3R) is the sturdiest version:
    - Positive in both periods: +0.14R in-sample, +0.36R out-of-sample.
    - Positive in 3 of 3 out-of-sample years, with a worst drawdown of −12.2R, better than the −18.4R claimed.
    - Its totals are lower than claimed: 2019–22 +20.5R (70 trades) against +32.2R (87), and 2023–26 +22.7R (76) against +34.2R (99).
  - The live **mosha-slow** rule (skip arrivals under 12 H1 bars) cuts out-of-sample trades from 61 to 18. That sample is too small to judge.
    - The claim that fast arrivals lose does **not** replicate: fast arrivals made +0.15R a trade in 2023–24 and +0.47R in 2025–26 (n 18 / 49, 3R).
    - Slow beats fast only in 2018–22.
    - Not robust. Flag it for re-testing; do not change it on this evidence alone.
- **Gold daily engulf.**
  - In-sample +0.21R a trade and out-of-sample +0.44R (65 trades).
  - Positive in 5 of 9 years; 2026 is −3.7R so far.
  - Worst drawdown −10.2R, in line with the claim.
  - Fewer trades than claimed (about 40 per two years against 69–77), and the claimed "every year positive" does not hold (2023 −0.4R, 2026 −3.7R).
  - The 20-day-average filter is in-sample-worse than no filter (+0.21 against +0.25) and better out-of-sample (+0.44 against +0.27). It is neutral overall.
  - **Robustness: reasonable.**
- **Gold trend N20 and N5 (long only, with the add).**
  - Positive in almost every year, with small drawdowns (−3.7R and −6.6R), close to the claims.
  - Very few trades: 15 and 23 out-of-sample. These are long-only breakouts during a secular gold bull (about $1,300 to $4,000), so they mostly measure that bull.
  - **Robust in sign, small sample, and dependent on the regime.**
- **Gold H4 trendline.**
  - 2018–2022 is flat: +0.01R a trade over 146 trades.
  - All of the edge is in 2023–25 (2023 +3.3R, 2024 +12.8R, 2025 +25.9R), and 2026 is −3.9R so far, against the claimed +3.5R.
  - The worst drawdown, −14.1R, is about twice the claim.
  - The MSNR direction filter adds nothing: without it, out-of-sample is +0.37R over 134 trades, against +0.33R over 104 with it.
  - **Not robust over 8 years. It is a 2023+ bull-market effect.**

## Volatility gate test (replica, everything else live)

| Gate | IS 2018–23 n / exp / R / maxDD | OOS 2024–26 n / exp / R / maxDD | OOS years + | Gate open (share of days, 2019–26) |
|---|---|---|---|---|
| **top fifth (live, p80)** | 159 / **+0.28** / **+44.3** / −40.2 | 232 / +0.62 / +143.2 / −18.6 | 3/3 | 2–35% |
| top third (p67) | 308 / +0.04 / +11.6 / −62.0 | 290 / +0.63 / +181.4 / −23.4 | 3/3 | 14–57% |
| median (p50) | 414 / −0.06 / −24.4 / −95.3 | 399 / +0.45 / +179.2 / −21.1 | 3/3 | 20–85% |
| none | 1,024 / +0.02 / +19.0 / −71.7 | 535 / +0.25 / +133.4 / −40.9 | 3/3 | 100% |
| fixed 1.5% (old) | 281 / +0.03 / +8.0 / −54.0 | 349 / +0.49 / +172.0 / −39.7 | 3/3 | 11–100% |

- **Walk-forward.** Choosing on 2018–23 picks the top fifth: best per trade, best total and smallest drawdown in-sample.
  - The top third makes more out-of-sample (+181R against +143R) at the same per-trade rate (+0.63 against +0.62), but it was much worse in-sample (+0.04R a trade, drawdown −62R). It fails the walk-forward rule.
- **Signal level.** Each v5 + D1-with signal taken as one unit with the live exits and no risk rules, split by the 20-day range's rank in its own past year:

  | Rank | IS (R / trade) | OOS (R / trade) |
  |---|---|---|
  | 0–50 | +0.03 | **−0.31** (193 trades) |
  | 50–67 | −0.11 | **−0.26** (178 trades) |
  | 67–80 | −0.36 | +0.35 (108 trades) |
  | 80–100 | −0.15 | +0.44 (298 trades) |

  - Out-of-sample, calm gold loses and only the top third pays.
  - In-sample, no rank band pays. The volatility split itself was found on 2023+ data, and the in-sample portfolio profit comes from the MSNR tilt and the equity filter, not from the gate.
- **Gate today.** On spot weekdays (last day 2026-10-30) the 20-day range is **1.69%**. The thresholds are p80 2.73%, p67 2.40% and p50 2.15%, so **all three percentile gates are shut**. Only no gate, or the old fixed 1.5% leg, would trade now.
  - Live reads 1.48% against 2.416% because the Kraken PAXG daily candles include weekend candles, which lowers both numbers. The conclusion is the same.
  - 2026 was the most volatile year in the sample, so a one-year percentile now sets a high bar. The gate is doing its job: it keeps the replica out of the normal-volatility regime, where its signals lost in 2024–26.

## Verdict

- **FAIL. No gate change.** No candidate beats the live gate under the walk-forward rule. Loosening to the top third or removing the gate would add the regime that loses.
- **Recalibrate expectations to these numbers, not the approval claims:**
  - Replica drawdown about −40R. Per-trade profit is about half of what was claimed.
  - H4 trendline edge exists only since 2023.
  - Mosha's slow-arrival filter is not supported out-of-sample.
- **Most robust:** the gold trend legs (small n), the daily engulf, and the Mosha weekly base.
- **Least robust:** the replica, which is regime-dependent and has a large in-sample drawdown, and the H4 trendline.

## Reproduce

```
git archive --format=tar -o xau.tar origin/council-data research/candles/xau-histdata && tar -xf xau.tar
export GOLD_DIR=$PWD/research/candles/xau-histdata OUT_DIR=/tmp/gold-out
node research/edge/gold-systems/replica.mjs   # ~10 min (caches replica-signals.json in OUT_DIR)
node research/edge/gold-systems/mosha.mjs
node research/edge/gold-systems/daily.mjs
node research/edge/gold-systems/summarize.mjs > research/edge/gold-systems/result.json
```

The raw outputs are committed next to this file as `replica.json`, `mosha.json` and `daily.json`.

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`. This study read every year as New York time, so from 2019 its bars were one hour early in about four weeks a year (the weeks the US is on daylight time and Europe is not).

**Re-run on the corrected clock on 10 Nov 2026. No rule, parameter, filter or cost was changed.** `replica.json`, `mosha.json`, `daily.json` and `result.json` hold the new numbers; the text above is the original write-up and quotes the old ones. The files of the old run are in git at `81f35f51`.

| Variant (all years, net) | Before: n, R a trade, total R, t | After |
|---|---|---|
| Replica, live | 391, +0.479, +187.5, 2.71 | 394, +0.462, +182.0, 2.66 |
| Replica, top-third gate | 598, +0.323, +193.0, 2.39 | 603, +0.313, +188.9, 2.33 |
| Replica, no gate | 1,559, +0.098, +152.4, 1.27 | 1,564, +0.097, +150.9, 1.26 |
| Mosha BO, live | 64, +0.531, +34.0, 1.91 | 64, +0.531, +34.0, 1.91 |
| Gold trend N20 + add | 41, +1.609, +66.0, 2.56 | 41, +1.609, +66.0, 2.56 |
| Gold trend N5 + add | 76, +1.047, +79.6, 2.73 | 76, +1.048, +79.6, 2.73 |
| H4 trendline, live | 314, +0.141, +44.2, 2.03 | 315, +0.159, +50.1, 2.24 |
| Daily engulf, live | 174, +0.294, +51.1, 2.12 | 175, +0.304, +53.2, 2.21 |

**The verdict is unchanged: FAIL, no setting change.** Every gate candidate gets the same verdict from the same walk-forward rule. Gold 2023 is not a certified year in the clock audit (the files have a hole from 20 Feb to 30 Jul 2023); every week of 2023 that could be read agrees with the converter.

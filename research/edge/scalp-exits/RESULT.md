# Scalp exits: which exit, entry and stop buffer work best for the live Scalp rule?

> **Clock correction, 10 Nov 2026.** NOT RE-RUN: the published numbers were computed on the old candle clock. Details: the last section of this page.

**Verdict: FAIL. No exit rule found an edge.** All 23 variants lose money after costs, both in-sample (Jun 2018 to 2023) and out-of-sample (2024 to Oct 2026), on all five markets and in every year. The best exit (a fixed 1R target) and the best add-on (a 15-minute time stop) lose less than the live exit. Neither turns the setup positive. The problem is the entry, not the exit: before the stop is hit, price reaches each R level about as often as a coin flip would. No exit can create an edge in that case. Spread then takes about 0.13R per trade.

## What was tested

- **Signals.** I ran the live engine itself (`council/engine.mjs` `buildSetup` + `msAnalyze`), not a copy. The Scalp pair is M15 to M1. Every 5 minutes the engine saw the last 720 M1 candles, plus the closed M15 candles and the one still forming, the same view as `backtest.mjs`. Settings are the live `config.json` (7 Nov): stop buffer 0.15 ATR, minimum stop 1.1 x M1 ATR, minimum reward:risk 1.2, signals at most 12 candles old. Bad prints are removed with `clean.mjs` (lone-wick rule for forex). Repeat signals are dropped: the same signature is taken once, and a new signal with the same side and target is skipped while the first is still open.
- **Live rule.** Against the D1 trend only (D1 trend from `msAnalyze` on the last 720 closed daily candles, day rolling at 22:00 UTC). No signals in Asia (00-07 UTC) or overlap (12-16 UTC). AUD/USD is not in the data, so it is excluded.
- **Markets.** XAU/USD, EUR/USD, GBP/USD, USD/CAD, USD/CHF. Data is histdata M1 from Jun 2018 to Oct 2026, converted from EST to UTC by adding 5 hours.
- **Size.** 35,427 Scalp signals in total. 16,188 pass the live rule, of which 15,627 also pass the 1.2 reward:risk gate. With the live limit entry, 14,540 filled (9,630 in-sample, 4,910 out-of-sample).
- **Costs.** One spread per trade, as in `backtest.mjs` `spreadOf`: 1 pip on forex, $0.30 on gold. In R this averages about 0.13R per trade, because the stops are small.
- **Fills.** Simulated on M1 candles. A limit order fills when price touches it. When one candle touches both the stop and the target, the stop counts. A gap through the stop exits at the candle's open. A trade still open after 5 days is closed at market.
- **Scope.** Each signal is judged on its own. The portfolio rules (2 open trades per market, USD cap, 3-hour re-entry block, news guard) are left out because they depend on the exit being tested. The comparison is paired: every exit is applied to the same fills.
- **Walk-forward.** In-sample is Jun 2018 to Dec 2023 and out-of-sample is Jan 2024 to Oct 2026. Each rule was chosen on in-sample results only. 23 variants were tried (20 exits, 2 entries, 2 stop buffers), so a few would look better by chance alone.

## Baseline: the live management

The live management is: limit order at the CF level (market if price is already through it), the engine's stop, exit at the engine's target, no break-even.

| | n | win rate | net exp R/trade | total R | max DD (R) | worst losing streak | t |
|---|---|---|---|---|---|---|---|
| IS 2018-23 | 9,630 | 27.1% | **-0.202** | -1,941 | -1,964 | 37 | -11.3 |
| OOS 2024-26 | 4,910 | 25.6% | **-0.243** | -1,192 | -1,216 | 31 | -9.5 |

Before costs (gross) the baseline makes -0.069R a trade in-sample and -0.108R out-of-sample. Every year from 2018 to 2026 is negative, between -0.16 and -0.28R a trade. Every market is negative in both periods: OOS gold -0.18, EUR/USD -0.31, GBP/USD -0.15, USD/CAD -0.29, USD/CHF -0.27.

As a cross-check, the live 30-day replay (`backtest.json`, 8 Oct to 7 Nov 2026, same rule and same five markets, 139 trades) agrees: +0.037R gross, -0.072R net. The +0.33R quoted when the rule went live came from a different stop setting (minimum stop 0.6 ATR) and included crypto.

## Exits (live entry and stop)

Net expectancy is in R per trade. "Paired vs baseline" is the average change per trade on the same fills, with its t-statistic.

| exit | IS exp | OOS exp | OOS total R | OOS max DD | paired vs baseline IS (t) | paired vs baseline OOS (t) |
|---|---|---|---|---|---|---|
| **engine target (live)** | -0.202 | -0.243 | -1,192 | -1,216 | | |
| fixed 1R *(best in-sample)* | **-0.155** | -0.198 | -974 | -985 | +0.046 (3.1) | +0.044 (2.1) |
| fixed 1.5R | -0.168 | -0.223 | -1,095 | -1,121 | +0.034 (2.6) | +0.020 (1.1) |
| fixed 2R | -0.175 | -0.242 | -1,191 | -1,214 | +0.027 (2.4) | 0.000 |
| fixed 3R | -0.210 | -0.243 | -1,194 | -1,222 | -0.009 | 0.000 |
| break-even at +0.5R | -0.193 | -0.215 | -1,058 | -1,071 | +0.008 (0.6) | +0.027 (1.4) |
| break-even at +1R | -0.201 | -0.262 | -1,287 | -1,310 | 0.000 | -0.019 |
| break-even at +1.5R | -0.198 | -0.257 | -1,264 | -1,292 | +0.004 | -0.015 |
| 50% at 1R, rest to engine target | -0.178 | -0.221 | -1,083 | -1,099 | +0.023 (3.1) | +0.022 (2.1) |
| 50% at 1R, rest to target, then break-even | -0.178 | -0.230 | -1,130 | -1,146 | +0.023 (2.0) | +0.013 (0.7) |
| trail M5 structure from +1R, keep target | -0.190 | -0.241 | -1,183 | -1,206 | +0.012 | +0.002 |
| trail M15 structure from +1R, keep target | -0.202 | -0.255 | -1,250 | -1,277 | 0.000 | -0.012 |
| trail M5 structure from +1R, no target | -0.213 | -0.259 | -1,272 | -1,319 | -0.011 | -0.016 |
| trail M15 structure from +1R, no target | -0.236 | -0.301 | -1,476 | -1,513 | -0.035 | -0.058 (-2.5) |
| trail 1x M15 ATR from +1R, keep target | -0.173 | -0.229 | -1,124 | -1,138 | +0.028 (2.2) | +0.014 (0.7) |
| trail 2x M15 ATR from +1R, no target | -0.239 | -0.263 | -1,291 | -1,331 | -0.038 | -0.020 |
| time stop: out after 15 min unless +0.5R | -0.174 | **-0.182** | -894 | -904 | +0.028 (2.3) | **+0.061 (3.5)** |
| time stop 30 min | -0.183 | -0.214 | -1,052 | -1,065 | +0.018 (2.0) | +0.028 (2.0) |
| time stop 60 min | -0.196 | -0.229 | -1,125 | -1,142 | +0.006 | +0.014 |
| time stop 120 min | -0.195 | -0.246 | -1,210 | -1,233 | +0.007 | -0.004 |

The in-sample pick, fixed 1R, holds out-of-sample in relative terms: +0.044R a trade, t 2.1, about 22% less drawdown, and the worst losing streak drops from 31 to 16 trades. A 15-minute time stop does about as well (+0.061R out-of-sample, t 3.5). Both still lose about 0.18 to 0.20R a trade in every year from 2018 to 2026. Neither meets the candidate rule, which requires a positive out-of-sample expectancy after costs.

## Entry style and stop buffer (live exit)

| variant | signals | unfilled | IS exp | OOS exp | OOS total R |
|---|---|---|---|---|---|
| **limit at the CF level, market if through (live)** | 15,627 | 1,087 | -0.202 | -0.243 | -1,192 |
| market at the signal | 15,627 | 5 | -0.186 | -0.222 | -1,162 |
| limit at 50% of the M1 Origin (market if through) | 15,627 | 4,205 | -0.282 | -0.290 | -1,126 |
| stop buffer 0.10 ATR | 15,626 | 1,087 | -0.202 | -0.242 | -1,190 |
| stop buffer 0.25 ATR | 15,628 | 1,087 | -0.201 | -0.241 | -1,184 |

- **Market vs limit.** Entering at market is about 0.02R a trade better than the limit, but still negative. The deeper 50% limit misses 27% of signals and loses more on the ones that fill. The orders that fill are the trades that keep going against you.
- **Stop buffer.** The buffer makes almost no difference. In 93% of signals the stop is set by the minimum-stop floor (1.1 x M1 ATR), not by buffer + swing. So 0.10, 0.15 and 0.25 ATR give nearly identical stops. The stop logic is unchanged everywhere else.

## Why no exit helps: how far trades move for and against

These numbers use the live trades with the target removed, held until the stop is hit (5-day cap). n = 9,630 in-sample and 4,910 out-of-sample.

| best move before the stop | reached it (IS) | reached it (OOS) | a coin flip would give 1/(1+x) |
|---|---|---|---|
| +0.5R | 65.1% | 65.6% | 66.7% |
| +1R | 49.1% | 47.6% | 50.0% |
| +1.5R | 38.9% | 37.3% | 40.0% |
| +2R | 32.2% | 30.4% | 33.3% |
| +3R | 23.3% | 22.5% | 25.0% |
| +5R | 14.9% | 14.7% | 16.7% |

The median best move before the stop is +0.97R (IS) and +0.92R (OOS). The 90th percentile is about +7R.

At every level, reaching it before -1R is slightly less likely than a coin flip. That is what an entry with no edge looks like, and any fixed exit then has a gross expectancy of zero or a little below. The tighter exits do better here only because they give back less to that small negative drift.

Other measurements:
- **Winners' worst move against them:** median 0.42R, 90th percentile 0.86R. 15% of winners first went to -0.8R. A tighter stop would cut real winners.
- **Losers' best move first:** 53% of losers were at +0.5R first and 30% were at +1R first (median +0.54R). Break-even at +1R or later still hurts out-of-sample: it stops trades out that the target would have caught. Break-even at +0.5R is about neutral.
- **Time:** the median loser is stopped after 71 minutes and the median winner reaches its target after 169 minutes. 16% of losers are stopped inside 15 minutes. The 15-minute time stop helps because trades that don't move quickly drift the wrong way.
- **Engine reward:risk** at fill: median 2.07, interquartile range 2.0 to 3.2. The engine target often falls back to the 2R default (`t1 = entry + 2r` when the H1/M15 extreme is too close).

## Conclusion

1. Under the live rule, Scalp has no positive expectancy on 8 years of M1 data, under any exit, entry or stop buffer tested. The 30-day result that put it live is not supported by the longer history, and the live 30-day replay at the current minimum stop is already negative (-0.07R).
2. If Scalp stays on paper anyway, the least-bad management is a **fixed 1R target** (chosen in-sample, better out-of-sample by +0.04R a trade, t 2.1, about 20% less drawdown) and/or a **15-minute time stop** (out unless +0.5R). Neither is proposed, because both still lose about 0.2R a trade.
3. The bigger issue is cost against a small stop. One spread is about 0.13R. Gross expectancy is only -0.07 to -0.11R, so improvements should look at the entry or signal quality, or at wider stops relative to spread, not at exits.

No `proposal.md`: no candidate passed.

Files: `scan.mjs` (stage 1: engine replay to signals), `exits.mjs` (stage 2: entry/exit/stop simulation, stats, result.json), `lib.mjs`, `extract.mjs` (copies the M1 data from the council-data branch). To reproduce: `node extract.mjs <data>`, then `node scan.mjs <data> <mkt> 2018-06-01 2026-11-01 <sig>/<mkt>.json` for each market, then `node exits.mjs <data> <sig> <out>`. A scan takes about 8 minutes per market on a free core.

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`. This study used the documented "EST, no daylight saving" reading (label + 5 hours all year), which is one hour late for the whole of Europe's summer, about seven months a year.

**Not re-run: computed on the old clock.** Reason: this is a long engine replay over 8 years of M1 candles for several markets, and the machine time was spent on the studies that feed a live system or the Academy. The loader is fixed, so the next run is on the corrected clock; the commands are on this page. Until then every number here is an old-clock number. What the old clock touched here: session tags and the time-based exits were an hour late in Europe's summer. The verdict (FAIL: all 23 exits negative) is about a setup that is not live.

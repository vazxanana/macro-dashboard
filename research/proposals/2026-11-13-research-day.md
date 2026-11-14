# Research day, 13 Nov 2026: what was tested, what held, what to do next

Owner's request: "do improvements on all the edges based on what happened this week, and knowing market cycles … achieve the
perfect edge". Every idea below was **pre-registered** (the plan committed alone before any result), tested **net of costs**
in two windows, with n and t, in its own folder under `research/edge/`, each in its own draft pull request. Nothing live
changed today. One finding needs your decision (item 54).

## The one finding that needs you
| Study | Result | PR |
|---|---|---|
| **Mosha cycle (`mcycle`), the live rule's own backtest** | 115 trades on gold 2020 → now, **−0.574R a trade after costs, t −3.99**, both halves negative, every year negative, still −0.51R before costs | #818 |

Proposal: make it a paper shadow again (item 54, `research/proposals/2026-11-13-mcycle-shadow.md`). It is the only live
paper system with a measured, clearly negative record.

## Everything else tested today (all FAIL unless said)
| # | Idea (where it came from) | n | Result | PR |
|---|---|---|---|---|
| 1 | **Your market-cycle rule**: trade only the H4 side, not during the H1 pullback | 11 systems, ~100,000 trades | best t 0.99; blocks two of this week's three losing buys, but nothing over 2020-26 | #815 |
| 2 | Weekly-bull daily rejection long, gold + silver as one book | 486 / 236 / 244 | monthly t 0.67 / 1.47 / 1.09 | #816 |
| 3 | ICT quarterly theory (Q2 "manipulation" quarter) on Fred's A-setups | 698 OOS | t −0.01 / 0.49 / −0.64 | #817 |
| 4 | Mosha BO + Daily ER ≥ 0.2 (playbook's "best edge"); market entry on the CF close | 38 | keeps 7 of 38; t 1.27 / −0.09 | #819 |
| 5 | 411 trendline third touch inside an engulf zone | 42 | −0.44R a trade, t −2.87; the zones lose too | #820 |
| 6 | The 12 Nov shadow cut re-checked on measured (lower) costs | 107,735 | 0 of 32 at 1x and 2x: no gold or forex cell is positive even before costs | #821 |
| 7 | EKF Daily → H4 → H1 engulf ladder | 140 | −0.07R a trade, t −0.59; sideways / 50 % entry add nothing | #822 |
| 8 | Gold 12-month time-series momentum (published effect) | 129 months | Sharpe 0.26 / 0.31, below buy-and-hold | #823 |
| 9 | ICT A-setup book risk caps (cluster, day stop, max open, inverse vol) | 1,707 | 0 of 4: each helps one half and hurts the other | #824 |
| 10 | MMXM Day-3 swing failure on gold (+ silver SMT, midnight open) | 262 | −0.001R a trade, t −0.01; SMT made it worse | #825 |
| 11 | Turn of the month on US indices (published effect) | 129 | SPX −0.015 % a trade, t −0.10; turn days no different | #826 |
| 12 | SPX timed by the VIX term structure (published effect) | — | **not run**: Cboe not reachable from the build sandbox | #827 |
| 13 | Diversified time-series momentum, 20 markets (published effect) | 2 windows | Sharpe −0.26 / −0.26 after costs; 0.33-0.36 before | #828 |
| 14 | Gold/silver ratio mean reversion | 18 / 16 | −0.98 % / −1.27 % a trade, t −1.20 / −2.03; loses before costs | #829 |
| 15 | Pre-FOMC announcement drift on US indices (published effect) | 86 (2016 →) | SPX +0.044R a trade, t 1.35, under its placebo; NAS100 t 2.45 but under its placebo too: mostly the indices' own drift | #831 |
| 16 | G10 FX carry (published effect) | 448 legs (2016 →) | revision 2 run on an approximate policy-rate table (from memory, marked): **FAIL, 0 of 2**: +0.066R a month (t 0.34), 2006-15 +0.124R (t 0.51); carry ~+0.07R a month against 1.5 %-of-price stops; the S&P volatility filter made it worse | #830 |
| 17 | One-week time-series momentum in crypto (published effect) | 4 coins, 2022 → | long/flat Sharpe 0.37 (t 0.77), long/short 0.20, below buy-and-hold 0.44; worked 2018-21, faded since | #833 |
| 18 | One-week cross-sectional reversal in G10 FX (published effect) | 7 currencies, 2016 → | Sharpe −0.51, t −1.60; flat even before costs; 29 of 40 placebos | #834 |
| 19 | Intraday momentum: first half-hour predicts the last (published effect) | 2,672 / 2,682 | SPX −0.159R, NAS100 −0.093R a trade net (t −9.1 / −5.5); about zero before costs; the effect faded after 2015 | #835 |
| 20 | Overnight drift: hold US indices from close to open (published effect) | 2,722 nights each | net −0.009 / +0.001 / −0.010R a night (t −1.4 / 0.2 / −1.4); positive before costs, spread and financing take it all | #836 |
| 21 | 5-minute opening range breakout on NAS100 / SPX500 (published effect) | 1,460 / 1,456 (2021 →) | NAS100 +0.075R net (t 1.27), SPX −0.053R; the first candle does point the day before costs (≈ +0.14R), the CFD round trip takes it | #837 |
| 22 | RSI(2) pullback above the 200-day average on US indices (published) | ~100 each (2016 →) | **near miss**: SPX +0.112R (month t 1.83), Dow +0.087R (month t 2.28, trade t 1.88), NAS100 +0.061R; Holm p 0.065; the three fire together (one bet) | #838 |
| 23 | Volatility-managed exposure on US indices (published effect) | 130 months | Sharpe 0.40 / 0.46 against 0.51 for plain holding; only a shallower drawdown, at a lower return | #839 |
| 24 | AUD/NZD daily z-score fade | 160 / 48 / 122 | −0.143 / +0.061 / −0.104R a trade (t −1.7 / 0.4 / −1.0); loses before costs and in 2008-15 | #840 |
| 25 | 10-month moving-average timing on indices + gold (published effect) | 135 positions | book Sharpe 0.40 against 0.63 for holding; only the drawdown is smaller (14.9 % vs 26.7 %) | #841 |
| 26 | Bitcoin / Ether hour-of-day returns (published effect) | 1,035 a leg (2024 →) | long 20:00 UTC −0.064 / −0.048R a trade; short 01:00 UTC −0.016 / −0.007R; the late-UTC strength exists before costs but flipped sign between windows | #842 |
| 27 | Gold: fade a raid of last week's high / low (market-maker school) | 233 / 190 / 235 | −0.014 / +0.116 / +0.162R a trade (t −0.1 / 0.6 / 0.8); all three lose in 2008-19 | #843 |
| 28 | The RSI(2) rule (#22), frozen, on six non-US indices | 521 pooled | +0.027R a trade (month t 0.85); the sign holds, the size does not: the US near miss reads as noise | #844 |
| 29 | Pre-holiday session on US indices (published effect) | 99 holidays | +0.023R a holiday net (t 1.02); before costs the S&P day just clears t 2, spread + financing take half | #845 |
| 30 | Month-end US dollar rebalancing flow into the London fix (published effect) | 130 month-ends | −0.090R per event net (t −1.06), about zero before costs; month-end looks like any other day | #846 |
| 31 | Gold Asian-range breakout into London (breakout and fade) | 1,169 / 484 | +0.015 / −0.012R a trade (t 0.5 / −0.1); both lose in 2010-19; $0.30 takes the little there is | #848 |
| 32 | Fade the opening gap on NAS100 / SPX500 | 852 / 913 (2021 →) | −0.059 / −0.121R a trade (t −1.8 / −4.4); gaps do fill, but the stop is hit about as often | #849 |
| 33 | Gold after an extreme day: fade it or follow it for three days | 27 / 28 (2020 →) | +0.053 / +0.040R a trade (t 0.1 / 0.2); both negative in 2006-19; about three events a year | #850 |
| 34 | Sell in May (Halloween effect) on nine indices (published effect) | 11 year-pairs | winter minus summer +1.26 % a year (t 0.32); winter-only Sharpe 0.21 against 0.31 holding | #851 |
| 35 | Crypto weekend long / Monday short (published effect) | ~147 a leg (2024 →) | weekend long BTC +0.000R, ETH +0.063R; Monday short −0.076 / −0.139R; each flips sign between windows | #852 |
| 36 | 52-week-high rotation across 11 equity indices (published effect) | 130 months | excess +0.046 % a month (t 0.38); negative in 2008-15; 7 of 40 random picks did as well | #853 |
| 37 | Copper/gold ratio as a risk-on signal for US indices | 565 weeks | on-weeks minus off-weeks −0.20 % a week (t −0.92); Sharpe 0.14 against 0.62 for holding | #854 |
| 38 | Dual momentum: SPX500 or gold or flat (published effect) | 131 months | Sharpe 0.36 / 0.41 against 0.65 for a plain 50/50; worked in 2008-15, flipped since | #855 |
| 39 | Bitcoin / Ether long only above the 200-day average (published) | 2022 → | beat holding on Sharpe and drawdown (BTC 0.61 vs 0.08) but best bootstrap P 0.93, Holm p 0.27, and trailed holding in 2018-21; mostly the 15 %/yr swap it avoids while flat | #856 |
| 40 | **Turnaround Tuesday** on US indices | 81 (NAS100 > 1 %) | **one cell of four passes, narrowly**: NAS100 after a Monday down more than 1 %, +0.098R a trade, t 2.33 (Holm p 0.039), 2008-15 t 2.12; the other three cells fail. One pass in about 40 studies is what chance gives, and the replication (#45) failed: read it as chance | #857 |
| 41 | WTI around the weekly US crude inventory report (fade / follow) | 304 / 306 (2021 →) | −0.096 / −0.013R a trade (t −0.2 / −0.1); both negative in 2016-20 | #858 |
| 42 | Big S&P sessions spilling into the yen overnight (USD/JPY, AUD/JPY) | 725 each | −0.093 / +0.011R a trade (t −2.4 / 0.3); both negative in 2008-15 | #859 |
| 43 | US indices after a volatility spike (5-day vol over 2x its median, below the 20-day average) | 216 / 165 (2016 →) | 5-day hold fails (+0.076R, t 1.96); 10-day hold passes its bar (+0.151R, t 2.53, Holm p 0.011) but is weak: 2008-15 +0.013R, t 1.68 by entry week (the three indices fire together), just over the placebo's 95th percentile. A paper shadow at most; the study leans to nothing | #860 |
| 44 | Follow or fade the first 30 minutes after the FOMC statement (NAS100, SPX500, gold) | 54 each (2020 →) | 0 of 6; best fade NAS100 +0.095R (t 0.56), −0.313R in 2010-19 | #861 |
| 45 | The turnaround rule (#40), frozen, on US30, US2000, DE40, EU50, UK100, JP225 | 411 pooled | +0.052R a trade, month t 1.69 (bar 2); all six positive, none at t 2; 2008-15 t 1.03. The NAS100 pass does not replicate | #862 |
| 46 | Gold and NAS100 after the payrolls release: follow or fade the first 15 minutes | 77 / 40 / 77 / 39 (2020 →) | 0 of 4; following loses on both (gold −0.235R, t −2.33); the gold fade +0.096R, t 0.51, too few trades | #863 |
| 47 | Gold: fade the Sunday reopen gap back to Friday's close | 41 / 38 (2020 →) | −0.109 / −0.110R a trade (t −0.8); small gaps fill but are too small to trade, larger ones mostly do not fill | #864 |
| 48 | Month- and quarter-end stock/bond rebalancing flow on SPX500 / NAS100 (published effect) | 93 / 30 a market (2016 →) | 0 of 4; +0.013 / +0.006R on all months (t 0.2 / 0.1), negative on quarter-ends; at the median of a random side | #865 |
| 49 | Crypto: buy after a sharp three-day drop (published short-term reversal) | ~109 (2022 →) | 0 of 4; day-3 −0.095R, day-7 −0.124R a trade (month t −1.7); loses before costs and in 2018-21 | #866 |
| 50 | NR7 breakout (narrowest of 7 days) on gold, NAS100, SPX500, three forex majors (published) | 2,191 (2016 →) | +0.013R a trade (month t 0.38), negative at 2x spread; a random day does as well | #867 |
| 51 | London-open range breakout on six forex pairs (follow or fade) | 9,875 (2020 →) | 0 of 3; follow +0.08R gross but −0.050R net (t −2.3) and worse than random entries; fade −0.81R | #868 |
| 52 | G10 currency momentum, monthly: buy the 2 strongest, sell the 2 weakest against USD (published) | 130 months (2016 →) | −0.244 / −0.152R a month (t −1.8 / −1.1); flat before costs; random picks do as well (carry not measurable) | #869 |
| 53 | Gold/silver H1 divergence ("SMT" as a plain rule): fade or follow gold's unconfirmed new high / low | 2,519 / 2,325 (2020 →) | −0.084 / −0.075R a trade (month t −3.4 / −2.9); flat before costs; gold-only new highs do as well, so silver adds nothing | #870 |
| 54 | Follow or fade the first 15 minutes after US CPI (gold, EUR/USD, USD/JPY, NAS100) | 81 events (2020 →) | 0 of 4; following loses (−0.20 / −0.25R an event, as on random days), fading is flat (+0.001R) | #871 |
| 55 | The last hour into the US close after a big day: fade or follow (NAS100, SPX500, US30) | 2,664 (2016 →) | −0.077 / −0.065R a trade (month t −5.2 / −4.3); near zero before costs; every market loses in both windows | #872 |
| 56 | The RSI(2) rule (#22), frozen, on gold and silver | 137 (2016 →) | −0.077R a trade (month t −1.8); loses before costs; random uptrend days do better; silver lost every year | #873 |
| 57 | **Your market-cycle rule as an entry** on NAS100, SPX500, US30 (H4 bias, H1 pullback finished, trade with the H4) | 1,174 / 2,907 (2016 →) | −0.227 / −0.155R a trade (month t −4.3 / −5.6), negative before costs; random entries in the same H4 direction did better in 39 of 40 seeds: waiting for the pullback to finish makes it worse | #874 |
| 58 | Gold session drift: short London afternoon + New York, long Asia with a 50-day trend filter | 1,718 / 1,063 / 683 (2020 →) | 0 of 3; best +0.023R a trade (t 1.37), every positive stream negative in 2008-19; the Asia gain is real before costs but under $0.30 | #875 |
| 59 | Big NAS100 sessions spilling into BTC / ETH overnight (follow or fade) | 764 (2022 →) | 0 of 2; −0.043 / −0.070R a trade, at the placebo's middle; 2018-20 replication could not be run (no older crypto intraday data reachable) | #876 |
| 60 | **Your market-cycle rule as an entry** on five forex majors (the index rule, unchanged) | 1,892 / 4,677 (2016 →) | −0.135 / −0.089R a trade (month t −4.5 / −4.3), every pair negative in both windows; random entries with the same H4 bias do better | #877 |
| 61 | **Gotobi**: USD/JPY and EUR/JPY around the 09:55 Tokyo fix on Japanese settlement days (published) | 771 (2016 →) | **one cell of four passes**: sell USD/JPY at the fix, buy back 15:00 Tokyo, +0.148R a trade, month t 2.74, Holm p 0.012, 2010-15 +0.131R (t 2.45), beats all 40 placebos; thin over costs (+0.035R at 2x costs). **Frozen replication (#889) REPLICATES**: four yen crosses pooled 2010-now +0.099R (n 4784, t 2.75), USD/JPY 2005-09 +0.261R (t 3.80), both beat every placebo; but at 2x the assumed cost the crosses are flat, so the real broker cost at that hour decides it (being measured next) | #878, #889 |
| 62 | Energy seasonality: crude long Feb-Apr, natural gas Sep-Oct long and Feb-Mar short | ~11 years each | 0 of 4; crude +0.96 / +1.08R a year (t 1.4) but 2026 carries it; Holm p 0.35 | #879 |
| 63 | Forex: fade the Sunday reopen gap on six majors (the gold rule, unchanged) | 243 / 222 (2020 →) | near miss, FAIL: rule G +0.194R a trade (month t 2.14, Holm needed ~2.28), but 2026 carries it and 2016-19 is about zero; rule H −0.015R | #880 |
| 64 | US index pair spread reversion: US2000/NAS100 and SPX500/US30, fade a 2-sd z-score | 71 each (2016 →) | −0.775 / −0.846R a trade (month t −2.0 / −2.2); loses before costs; stretched spreads kept running | #881 |
| 65 | Monthly options-expiry week on SPX500 / NAS100 (published effect) | 130 each (2016 →) | 0 of 4; expiry-week longs −0.016 / +0.026R, week-after shorts lose (−0.11 / −0.15R); no better than the month's other weeks | #882 |
| 66 | The London 4 pm fix on six forex majors: follow the run into it or fade after it | 3,510 (2020 →) | 0 of 2; about zero before costs, −0.15 / −0.16R a trade after (month t −7 / −10) | #883 |
| 67 | Following 2-sd stretches of non-US index spreads (DE40/UK100, EU50/UK100, JP225/AU200, DE40/FR40) | FAIL, 0 of 5: −0.107R net (n 244, t −1.56) 2016-now, −0.072R 2009-15; ~+0.02R before costs, financing turns it negative | #884 |
| 68 | AUD/JPY and NZD/JPY long only while the S&P is above its 200d and calm | FAIL, 0 of 3: T1 −0.154R (n 52, t −1.30), T2 −0.102R, trend-only −0.053R; all below their placebo median | #886 |
| 69 | ETH/BTC ratio trend (long one, short the other) and weekly ETH-or-BTC rotation | FAIL, 0 of 2: +0.014 / +0.018R a week (t 0.68 / 0.35) 2022-now; swap takes over half the gross; rotation no better than a random coin or BTC held | #887 |
| 70 | The owner's market-cycle rule (H4 BO, H1 pullback, H1 BO back) on BTC, ETH, SOL | FAIL, 0 of 2: −0.079R (n 830, t −1.80) to H4 extreme, −0.055R at 2R; random same-bias entries did better; third market where it fails | #888 |
| 71 | Gotobi replication: the frozen #878 rule on GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY and USD/JPY 2005-09 | **REPLICATES**: pooled crosses +0.099R (t 2.75), USD/JPY 2005-09 +0.261R (t 3.80), all placebos beaten; cost-sensitive (≈0 at 2x cost), crosses correlate 0.5-0.8 with the USD/JPY leg | #889 |
| 72 | Fading crypto weekend moves over 1 ATR (BTC, ETH; Monday 13:30 or Sunday 22:00 entry) | FAIL, 0 of 5: pooled −0.032R (n 46, t −0.19); rare signal, below the minimum n; 2017-21 daily check says big weekend moves continue | #890 |
| 73 | US index overnight drift: long US500 / NAS100 from the 16:00 NY close to the 09:30 open | FAIL, 0 of 2: real before costs (+0.02-0.03R, gross month t +2.3 to +4.7) but the 0.03 % spread and financing take it all: US500 −0.022R (t −2.86), NAS100 −0.006R | #891 |
| 74 | Time-series momentum (12-1 month sign) on 25 CFD markets, ATR-risked | FAIL, 0 of 5: pool −1.39R a month (t −1.44) 2016-26; +0.033R a position before costs, 0.027R trading cost and 0.062R financing; every class negative 2016-26 | #892 |
| 75 | Gotobi cost accounting (no rule tested) | break-even ~3.7 pips round trip on USD/JPY, t stays ≥ 2 up to ~1.95 pips (assumed 1.3); published all-day spreads (USD/JPY 0.08 pip) keep t 2.99, but nothing measured at 00:55 / 06:00 UTC: recording yen bid/ask at those minutes is the deciding step (needs the owner) | #893 |
| 76 | Gotobi fade on an independent feed (HistData USD/JPY M1, frozen rule) | **FEED-ROBUST**: +0.127R (n 623, t 2.34) vs OANDA +0.143R (t 2.66) on 2018-26; per-trade correlation 0.997; still gone at 2x cost on both feeds | #894 |
| 77 | IBS reversal: buy US500 / NAS100 / US30 at the close when it sits in the bottom 20 % of the day's range | FAIL, 0 of 4: pooled +0.020R (t 0.64) 2016-now; real before costs (+0.05 to +0.10R) but spread and financing take most; US500 strong 2005-15 (t 2.66), faded since | #895 |
| 78 | Follow the first hour after ECB (EUR/USD) and BoJ (USD/JPY) decisions | FAIL, 0 of 2: ECB a near miss, +0.631R (n 71, t 1.51), positive 2010-17 and at 2x cost but 18 big time exits carry it; BoJ flat (+0.064R); pre-2025 dates from memory | #896 |
| 79 | Read-only yen-pair spread log (build, not a study) | records the demo broker's USD/JPY and yen-cross spreads at 00:55 / 06:00 UTC each weekday, the measurement that decides the gotobi fade; **owner item 54 (shared number with #818: the second to merge becomes 55), waiting for approval to merge** | #897 |
| 80 | Fade the Sunday reopen gap (> 0.5 ATR) on US500 / NAS100 / US30 back to Friday's close | FAIL, 0 of 4: pooled −0.126R (n 102, t −1.59), negative before costs too; big weekend gaps hold (7 of 80 filled 2016-26); below all 40 placebo runs | #898 |
| 81 | Next-day lead: big WTI day → USD/CAD, big copper day → AUD/USD | FAIL, 0 of 2: pooled +0.012R (t 0.46); the link is same-day only (corr −0.33 to +0.53 same day, ~0 next day); 2006-15 negative | #899 |
| 82 | Index studies re-costed on CME micro futures (cost accounting, no new verdict) | futures cost 0.011-0.022R vs CFD 0.033-0.060R a trade; overnight and turn-of-month still FAIL; IBS NAS100 meets its own bar on futures (+0.086R, t 2.56) but chosen after the fact, never replicated 2005-15 (t 0.56), micros only since 2019, ~$435k account needed: not an edge | #900 |
| 83 | The ECB first-hour rule, frozen, on BoE / BoC / SNB / RBA / RBNZ | FAIL: pooled +0.208R (n 320, t 1.77), 2010-17 negative; the ECB near miss (#896) did not repeat on independent decisions; dates from memory | #901 |
| 84 | Currencies weaken in their own business hours (sell EUR/GBP 07-12 UTC, buy USD/JPY 00-06, sell AUD 22-05) | FAIL, 0 of 4: pooled −0.076R (t −4.31); European sells +0.06R gross but costs 0.10-0.13R take it; Tokyo/Sydney no effect | #902 |
| 85 | The whole day against multiple testing (248 decisive tests of #815-#899, Holm and BH across all) | **0 of 248 survive**: 6 tests at t ≥ 2 against 5.6 expected by chance, 11 at p < 0.05 against 12.4; gotobi T2 alone BH q 0.71, but with its 2005-09 replication (Fisher p 3.6e-6) it clears the family's Bonferroni line: the raw gotobi effect is the day's one result that is not chance, and its edge after costs still waits on the measured spread (#897) | #904 |

Studies #12 and #16 are ready to run once `cdn.cboe.com` and `fred.stlouisfed.org` are allowed in the repository's
environment (the saved "macro-dashboard" environment; a new session on it).

## What the evidence says
1. **The course setups, written as mechanical rules, do not make money on gold after costs, and your market-cycle rule (H4 bias, wait for the H1 pullback to finish) loses on indices (#57), forex (#60) and crypto (#70) as well.** Today adds MSNR-style
   direction (#1), Mosha (#4, and the cycle's −0.57R), 411 (#5), EKF (#7), MMXM (#10) and ICT timing (#3) to the earlier
   list. Your playbook reached the same conclusion: any bigger edge is in the trader's selection, which only a journal of
   your own trades can measure (item 27).
2. **Published effects mostly do not survive on these instruments with retail costs.** Spot CFDs pay financing and miss the
   futures carry the papers earn (#8, #13); the calendar effects (#11) did not repeat after publication.
3. **What stays live is the gold book (Gold trend + Gold daily engulf) under the forward-test protocol (item 43)**, judged by
   its own stop lines, not by new tests on its history (item 44).

## Recommended next steps (none taken without you)
- Decide item 54 (Mosha cycle → paper shadow).
- Start logging your own trades on the Mosha desk (item 27): it is the one measurement nothing else can replace.
- Keep the gold book running unchanged and read it against the protocol's bands.

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
| 16 | G10 FX carry (published effect) | — | **not run**: interest-rate data (FRED and others) not reachable from the build sandbox | #830 |
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
| 40 | **Turnaround Tuesday** on US indices | 81 (NAS100 > 1 %) | **one cell of four passes, narrowly**: NAS100 after a Monday down more than 1 %, +0.098R a trade, t 2.33 (Holm p 0.039), 2008-15 t 2.12; the other three cells fail. One pass in about 40 studies is what chance gives: a replication on six other indices is running before anyone acts on it | #857 |
| 41 | WTI around the weekly US crude inventory report (fade / follow) | 304 / 306 (2021 →) | −0.096 / −0.013R a trade (t −0.2 / −0.1); both negative in 2016-20 | #858 |

Studies #12 and #16 are ready to run once `cdn.cboe.com` and `fred.stlouisfed.org` are allowed in the repository's
environment (the saved "macro-dashboard" environment; a new session on it).

## What the evidence says
1. **The course setups, written as mechanical rules, do not make money on gold after costs.** Today adds MSNR-style
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

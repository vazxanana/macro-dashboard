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

# Study index: every pre-registered study, merged or not

Generated from `origin/main` at c2102a57dd (2026-11-13T22:13:07+00:00) and 632 remote branches, 177 open pull requests. Paper research only: this list changes no rule or trade.

**246 studies** (82 on main, 164 only on a branch): 9 PASS · 194 FAIL · 32 inconclusive · 6 not measurable · 5 verdict not read · 10 replicate-type.

By asset class: Gold 42 · Indices 53 · Forex 39 · Rates 10 · Commodities 12 · Crypto 13 · Cross-asset 51 · Accounting / meta 26.

Regenerate: `git fetch origin && node scripts/study-index.mjs` (read only; writes this file and study-index.json).

Verdicts are the Edge lab's reading of each study (`research/edge/verdict.mjs`); "not measurable" and "replicate-type" are read from the study's own words. Figures are the first n, R and t the verdict text states, nothing recomputed; read the study before quoting one. A PASS is never a live rule without the owner.

## Gold (42)

| Topic | PR | Rule | Verdict | Key figures |
|---|---|---|---|---|
| `council-edge` | main | Council edge: gold replica, trend, trendline and engulf on OANDA gold 2020–26, three pre-registered changes,… | FAIL. |  |
| `cycle-gate` | #819 | The market-cycle gate | FAIL, 0 of 11 systems. |  |
| `drd-metals-book` | #816 | the weekly-bull daily rejection long as one book on gold and silver, one position at a time | FAIL, 0 of 3. |  |
| `engulf-ladder` | #822 | Engulf ladder on gold (Daily → H4 → H1) | FAIL. |  |
| `geg-variants` | main | Gold daily engulf: entry-side variants | FAIL: NOT BETTER. | -0.02R a position |
| `gold-asia-break` | #848 | Asian range breakout into London on gold | FAIL, neither rule passes the pre-registered bar. |  |
| `gold-drd-er` | main | the Daily-regime filter on the weekly-bull daily rejection long | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). |  |
| `gold-drd-long` | main | the playbook's weekly-bull daily rejection long, out of its own sample | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). |  |
| `gold-drd-silver` | main | the playbook's weekly-bull daily rejection long and its two Daily-regime cuts, on silver | PASS on the pre-registered bar, and not robust. |  |
| `gold-haven-shock` | #905 | Gold as a safe haven after equity shock days | FAIL: 0 of 3 tests pass. | n 92, +0.108R a trade, t -0.07 |
| `gold-month-of-year` | #907 | gold's month of the year, as the gold terminal encodes it | FAIL, 0 of 3 tests pass: the page's seasonal months are not reliably different from the rest of the year. |  |
| `gold-session-drift` | #875 | Gold session drift | FAIL, 0 of 3 tests pass. |  |
| `gold-shock-revert` | #850 | after an extreme gold day, does the next day revert or continue? | FAIL. | n 27, +0.053R a trade, t 0.14 |
| `gold-silver-divergence` | #870 | intraday gold / silver divergence on H1, fade and follow | FAIL, 0 of 2. |  |
| `gold-silver-ratio` | #829 | mean reversion of the gold / silver ratio, out of sample | FAIL, on all three pre-registered checks. |  |
| `gold-systems` | main | Gold systems on 8 years of spot gold — robustness check | FAIL. |  |
| `gold-systems-oos` | main | Gold systems: out-of-sample test on 2006–2017 | Inconclusive: Gold trend (gtrend, N20 + add): regime-bound; Gold trend fast (gtrend5, N5 + add): regime-bound; Gold H4 trendline (gtl): regime-bound (at the edge of fails);… | n 20 |
| `gold-tsmom` | #823 | published time-series momentum on gold, out of sample | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). |  |
| `gold-us-asia` | #923 | Gold: the Asian session after the New York cash session | FAIL: 0 of 3 tests pass. | n 1928, +0.02R, t -1.42 |
| `gold-week-raid` | #843 | previous-week high / low raid and reversal on gold | FAIL, 0 of 3 rules on the pre-registered bar (PREREGISTRATION.md, committed before any candle was read). |  |
| `gold-weekend` | main | Gold daily systems: weekend handling, current rule against the intended rule | Inconclusive: Gold trend N20 (gtrend, live): KEEP the current rule; Gold daily engulf (geg, live): ADOPT the intended rule, but the gain is within noise; Gold trend fast N5… | n 20 |
| `gold-weekend-gap` | #864 | Gold's Sunday-open gap: does it fill? | FAIL. | n 41, -0.109R a trade, t -0.78 |
| `gtrend-exits` | main | Gold trend exits and re-entries: 12 variants against the live chandelier, untouched 2006–17 | FAIL / keep the live exit. | n 5, +1R, t 0.4 |
| `ict-breadth` | main | ICT breadth test: the unchanged A-setup rule on markets the desk was never tuned on | FAIL (pre-registered bar), for the primary set and for the secondary set. |  |
| `ict-oos-2008` | main | ICT A-setups on 2008-2017: a clean out-of-sample test of the live rule | FAILS (pre-registered bar). |  |
| `ict-universe` | main | ICT universe: does the iFVG model work outside gold? | FAIL: No new market passes. |  |
| `macro-gold` | main | Macro gold rule: can real yields, known the day before, time gold? | FAIL: no. |  |
| `macroscore-overlay` | main | Gold Macro Score as a sizing overlay: the skill's rule on the council's gold systems, out of sample | FAIL on the pre-registered rule. | t 3.24 |
| `mcycle-base` | #818 | Mosha cycle (mcycle), the live rule's own backtest | FAIL: the live Mosha cycle rule, run as the Trader runs it, made −0.574R a trade after costs over 115 trades on spot gold from 2020 (t −3.99 on 82… | n 64, -0.574R a trade, t -3.99 |
| `mosha-bo-er` | #819 | Mosha BO: the Daily regime filter, a market entry on the confirmation, and where the confirmation forms… | FAIL: Arm A (Daily ER20 >= 0.2) FAIL; Arm B (market on the confirmation close) FAIL. |  |
| `mosha-cycle` | main | Mosha cycle, second half (the buy at the barrier) | FAIL. | n 74, -0.22R a trade, t -0.99 |
| `mosha-level` | main | Mosha level reversal | FAIL. | n 221, -0.353R a trade, t -3.1 |
| `mosha-oos` | main | Mosha BO: out-of-sample test on 2006–2017 | Inconclusive: REGIME-BOUND on the pre-registered rule, and in substance a null result. | n 38, +0.14R a position, t 0.55 |
| `mosha-retrace` | main | Mosha retracement chain | FAIL on the pre-registered rule, and in substance break-even. | n 249, +0.022R a trade, t 0.17 |
| `mosha-select` | main | Mosha selection: which sweeps are worth taking? | FAIL. | -0.05R a trade |
| `mosha-sweep` | main | Mosha sweep, VR and CF | FAIL, both entries. | -0.109R a trade, t -4.62 |
| `msnr-direction` | main | MSNR direction call | FAIL, 0 of 6 tests: the direction call says nothing measurable about gold's next 1, 5 or 20 daily closes beyond the base rate (largest t in 2020-26 +1.35;… | n 1768, t 1.35 |
| `msnr-entry` | main | MSNR direction as a gate in front of the engulfing entry | FAIL, 0 of 3 tests: the engulfing entry taken with the direction call loses after costs in both windows (main test −0.110R a trade in 2020-26, n 795, t −2.51;… | n 795, -0.11R a trade, t -2.51 |
| `replica-oos` | main | Gold replica: out-of-sample test on 2017–2022 | FAIL. |  |
| `swing-day3` | #825 | a daily three-candle swing failure on gold | FAIL, 0 of 3 tests. | n 262, -0.001R a trade, t -0.01 |
| `tl-third-touch` | #820 | Trendline third touch inside an engulf zone, gold | FAIL, on every condition: the trendline entry lost −0.441R a trade after costs over 2020-26 (n 42, month-sum t −2.87; 2020-23 −0.258R, n 25; 2024-26 −0.709R,… | n 42, -0.441R a trade, t -2.87 |
| `trend-breadth` | main | Trend breadth and financing | Not measurable: INCONCLUSIVE: overnight financing, which no cost model here counts, takes Gold trend from +0.49R to +0.40R a position on untouched 2006-17 (n 75, t 1.77 →… | n 75, +0.489R, t 1.774 |

## Indices (53)

| Topic | PR | Rule | Verdict | Key figures |
|---|---|---|---|---|
| `eu-gap-fade` | #916 | Fading the overnight gap on European indices (DE40, UK100, EU50) | FAIL: fading the European index overnight gap from the 08:00 London open to the 16:30 close, stop 1 x ATR20, after a 0.04 % round trip, 2016 → now: DE40… | n 1964, -0.048R a trade, t -4.06 |
| `gap-fill` | #849 | Fading the opening gap on NAS100 and SPX500 | FAIL: 0 of 4 tests pass in 2021 → now; NAS100 fade of every gap −0.059R a trade net (n 852, monthly t −1.84, gross −0.012R), SPX500 fade of every gap −0.121R… | n 852, -0.059R a trade, t -1.84 |
| `gotobi-jp225` | #959 | Gotobi on the Nikkei: the fade after the 09:55 Tokyo fix, moved to JP225 | FAIL. | n 760, -0.045R a trade, t -1.09 |
| `high52-rotation` | #853 | 52-week-high proximity rotation across equity indices | FAIL (pre-registered bar: decisive excess > 0 with Newey-West t >= 2 missed; 2008-15 excess > 0 missed; decisive Sharpe >= benchmark met; above the placebo's… |  |
| `ibs-replicate` | #924 | the IBS daily reversal, frozen and replicated on seven other indices | FAIL: DOES NOT REPLICATE (fails the pre-registered reading). (replicate-type) | n 3543, -0.041R a trade, t -1.97 |
| `ict-dipbuy-oos` | main | ICT dip-buy (the #431 NQ/ES proposal) on 2008-2017: out of sample, pre-registered | FAIL (pre-registered bar). | n 491, +0.021R a trade, t 0.35 |
| `ict-index-longonly` | main | ICT index long-only: a real edge, or just being long equities? | PASS. |  |
| `ict-macro` | main | Does the ICT A-setup edge depend on the macro regime? | FAIL: null result. |  |
| `ict-trend-side` | main | ICT index A-setups: sells only below the 200-day average (pre-registered test on 2018-26) | FAILS. |  |
| `index-52w-high` | #911 | the 52-week-high anchor on equity indices | FAIL, 0 of 3. | n 90, -0.084R a trade, t -0.64 |
| `index-cycle` | #874 | The owner's market cycle as an entry on US indices | FAIL, 0 of 2 exits pass. | n 1174, -0.227R a trade, t -4.26 |
| `index-friday-pm` | #985 | US index CFDs into the Friday close | FAIL: Friday 14:00-15:55 US500 short: OOS −0.180R a trade net (n 474, month t −4.44); OOS t −4.44 < 2, in sample −0.152R, −0.313R at 2x cost, beats 2/40… | n 474, -0.18R a trade, t -4.44 |
| `index-ibs` | #895 | the IBS daily reversal on US indices | FAIL. |  |
| `index-long-reversal` | #941 | long-term reversal across national stock indices | FAIL. | -0.047R a month, t -3.8 |
| `index-low-vol` | #945 | the low-volatility anomaly across national stock indices | FAIL, 0 of 2 tests pass: holding the three least volatile national indices against the three most volatile is not an edge after costs (T1 equal risk long /… | -0.094R a month, t -2.69 |
| `index-midday-turn` | #914 | The US cash-session midday turn on index CFDs | FAIL. | n 2308, -0.042R a trade, t -7.14 |
| `index-overnight` | #891 | Overnight drift on US index CFDs: close-to-open longs on US500 and NAS100 | FAIL: the overnight long after spread and financing, 2016-26: US500 −0.022R a trade (n 2721, month-sum t −2.86), NAS100 −0.006R (n 2721, t −0.84); before… | n 2721, -0.022R a trade, t -2.86 |
| `index-pair` | #881 | US equity index pairs, log-spread z-score mean reversion | FAIL, 0 of 2 pairs: fading a 2-sd stretch of the US index spreads is not an edge after costs. | n 71, -0.775R a trade, t -2.01 |
| `index-quarter-end` | #981 | quarter-end rebalancing flow on US500, by the quarter's stock-minus-bond return | FAIL: on US500 out of sample (2015-26) the rule lost -0.101R a trade net (n 47, t -0.89), -0.119R at 2x cost, and beat only 24 of 40 random-window placebos… | n 47, -0.101R a trade, t -0.89 |
| `index-spread-momentum` | #884 | non-US equity index pairs, log-spread z-score momentum | FAIL, 0 of 5 pre-registered checks: following a 2-sd stretch of these non-US index spreads is not an edge after costs. | n 244, -0.107R a trade, t -1.56 |
| `index-weekend-gap` | #898 | US index CFDs' Sunday-reopen gap fade | FAIL: pooled −0.126R a trade after costs on 2016-26 (n 102, month-sum t −1.59), −0.067R on 2008-15 (n 42) | n 102, -0.126R a trade, t -1.59 |
| `index-xs-momentum` | #974 | Cross-sectional momentum across national stock indices (12-1, monthly) | FAIL (pre-registered bar: OOS month-sum t >= 2 missed; IS net > 0 missed; OOS net > 0 at 2x costs missed; beats >= 38 of 40 placebo runs missed). |  |
| `intraday-momentum` | #835 | Market intraday momentum, out of sample | FAIL. | n 2672, -0.159R a trade, t -9.09 |
| `nq-open-exits` | main | NQ New York open run: five pre-registered exits, same entries. | FAIL, all six cells. |  |
| `nq-open-oos` | main (revision on #593) | NQ New York open run: 22 years out of sample | Inconclusive: regime-dependent, not robust, not dead |  |
| `open-run-breadth` | main | Open run breadth: does the NQ open run work on other index opens? | FAIL: NQ-ONLY. |  |
| `open-run-breadth-2` | main | Open run breadth 2: the NQ open run at seven more cash opens | FAIL: NQ-ONLY (FAIL): none of the seven cash opens (FTSE, Nikkei, Hang Seng, ASX 200, Euro Stoxx 50, CAC 40, Russell 2000) passes even the 2023-26 half of the bar,… | +0.01R |
| `opex-week` | #882 | the monthly options-expiry week on US indices, out of sample | FAIL, 0 of 4 tests. | -0.016R |
| `orb-nas100` | #837 | The 5-minute opening range breakout on NAS100 and SPX500, out of sample | FAIL: 0 of 2 markets pass in 2021 → now; NAS100 +0.075R a trade net (n 1460, monthly t +1.27, gross +0.135R), SPX500 −0.053R a trade net (n 1456, monthly t… | n 1460, +0.075R a trade, t 1.27 |
| `overnight-drift` | #836 | Overnight drift on US index CFDs | FAIL (0 of 3 indices pass; pre-registration in PREREGISTRATION.md, committed and pushed before any result). |  |
| `overnight-unused-markets` | #964 | Overnight drift on index CFDs no earlier study used | FAIL: REPLICATES (gross) / FAIL (net): 14 unused index CFDs pooled, 2016-26: +0.011R a trade before costs (n 36701, month-sum t +2.10; 2005-15 +0.027R, t +4.41),… | n 36701, +0.011R a trade, t 2.1 |
| `pre-holiday` | #845 | the pre-holiday effect on US indices, out of sample | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). |  |
| `rebalance-flow` | #865 | the month-end rebalancing flow on US indices, out of sample | FAIL, 0 of 4 tests. |  |
| `rsi2-early-years` | #952 | the 2-day RSI pullback on US index CFDs, the years before the original study | NOT MEASURABLE (inconclusive: OANDA daily candles start 2003-03-24, so after the 200-day warm-up only 4.00 years |  |
| `rsi2-pullback` | #838 | the 2-day RSI pullback on US index CFDs, out of the book's sample | FAIL on the pre-registered bar (PREREGISTRATION.md, committed and pushed before any number was computed). |  |
| `rsi2-replicate` | #844 | the 2-day RSI pullback, frozen, on six non-US indices | FAIL on the pre-registered single test (PREREGISTRATION.md, committed and pushed before any number was computed). (replicate-type) |  |
| `rsi2-unused-markets` | #955 | the 2-day RSI pullback, frozen, on the OANDA index CFDs no earlier study used | FAIL: DOES NOT REPLICATE (a fail of the pre-registered single test: -0.016R a trade after costs, month t -0.50, 0 of 4 checks). | -0.016R a trade, t -0.5 |
| `santa-rally` | #922 | the Santa Claus rally window on index CFDs | FAIL, 0 of 3 tests pass: the Santa window does not beat an ordinary 7-day window of the same year. |  |
| `sell-in-may` | #851 | the Halloween effect on equity index CFDs | FAIL on the pre-registered bar (PREREGISTRATION.md, committed before any number was computed). | n 11, t 0.32 |
| `smallcap-january` | #947 | Small caps at the turn of the year: long US2000, short SPX500 on OANDA CFDs | FAIL, 0 of 2. |  |
| `tsmom` | #892 | Time-series momentum across asset classes | FAIL. | -1.389R a month, t -1.44 |
| `tsmom-portfolio` | #828 | Diversified time-series momentum portfolio | FAIL (pre-registered bar: 2008-17 Sharpe > 0.4 missed, t >= 2 missed; 2018-26 total > 0 missed). |  |
| `turn-of-month` | #826 | the turn-of-the-month effect on US indices, out of sample | FAIL, 0 of 3 markets, on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). |  |
| `turnaround-early-years` | #953 | Turnaround Tuesday on the years neither study used | NOT MEASURABLE (inconclusive: about 4.7 years of candles before 2008, under the 5-year floor). |  |
| `turnaround-replicate` | #862 | the NAS100 "Turnaround Tuesday" cell on six markets it never saw | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed before any candle was read). (replicate-type) |  |
| `turnaround-tuesday` | #857 | "Turnaround Tuesday" on US indices, out of sample | PASS on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed), by one cell of |  |
| `turnaround-unused-markets` | #958 | Turnaround Tuesday on the index CFDs neither study used | FAIL: DOES NOT REPLICATE: the frozen rule fails #862's bar on the eight index CFDs neither #857 nor #862 used. |  |
| `us-asia-lead` | #913 | US cash session leading the Asian index session: JP225 and HK33 from the Asian open | FAIL: the Asian session in the US cash session's direction, entered at the Asian open, after a 0.04 % round trip, 2016-26: JP225 −0.041R a trade (n 2679,… | n 2679, -0.041R a trade, t -5.31 |
| `vix-term` | #827 | Equity exposure timed by the VIX term structure | INCONCLUSIVE, data not reachable: the Cboe VIX and VIX3M history files could not be fetched from the build environment, so the pre-registered rule was not run… |  |
| `vol-managed` | #839 | volatility-managed exposure on US index CFDs | FAIL on the pre-registered bar (PREREGISTRATION.md, committed before any number was computed). |  |
| `vol-managed-index` | #909 | volatility-managed exposure on equity index CFDs | FAIL, 0 of 3 tests pass: net of CFD costs, volatility scaling lowers the Sharpe ratio on the S&P 500 and on the four indices pooled. |  |
| `vol-spike-rebound` | #860 | buy US index CFDs after a realised-volatility spike | PASS on the pre-registered bar (PREREGISTRATION.md, committed and pushed before any number was computed), by the |  |
| `vol-spike-replicate` | #920 | frozen replication of the vol-spike rebound on seven other index markets | Inconclusive: PARTLY. (replicate-type) |  |

## Forex (39)

| Topic | PR | Rule | Verdict | Key figures |
|---|---|---|---|---|
| `audnzd-revert` | #840 | AUD/NZD daily z-score mean reversion | FAIL, 0 of 3 variants: the AUD/NZD z-score fade is not an edge after costs. | n 48, +0.061R a trade |
| `chf-haven` | #930 | The Swiss franc after a sharp S&P 500 fall | FAIL, 0 of 3 tests. short USD/CHF −0.046R a trade net on 2016-26 (n 74, t −0.48, month t −0.52, fails: net R not above 0, negative before 2016, t under 2,… | n 74, -0.046R a trade, t -0.48 |
| `cnh-fix` | #927 | The PBoC USD/CNY fix at 01:15 UTC: following or fading USD/CNH's first quarter hour after it (result) | FAIL. | n 1667, -0.548R a trade, t -7.65 |
| `ecb-ref-fix` | #921 | The ECB euro reference rate: fading the half hour into the 14:10 CET concertation (result) | FAIL. | n 2018, -0.136R a trade, t -2.93 |
| `fx-asia-london-reversal` | #973 | Asian-session move reversed in London, forex majors | FAIL. | n 2250, -0.048R a trade, t -3.24 |
| `fx-cycle` | #877 | The owner's market cycle as an entry on forex majors | FAIL. | n 1892, -0.135R a trade, t -4.48 |
| `fx-december-usd` | #918 | the year-end US dollar seasonal | FAIL, 0 of 3 tests pass: neither a weaker dollar in the second half of December nor a stronger dollar in the first |  |
| `fx-home-hours` | #902 | A currency weakens in its own home hours | FAIL. | n 2703, -0.063R, t -1.69 |
| `fx-london-orb` | #868 | London-open range breakout on forex majors | FAIL: 0 of 3 variants pass. | n 9875, -0.05R a trade, t -2.28 |
| `fx-max-effect` | #969 | the MAX (lottery) effect across currencies, monthly rebalance | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). |  |
| `fx-month-end` | #846 | Month-end US dollar rebalancing flow into the London 4 pm fix | FAIL. | -0.0903R |
| `fx-month-start` | #982 | the US dollar on the first two trading days of a month (2026-11-14) | FAIL: the dollar basket over the first two days of a month, short USD (learned 2005-14): out of sample −0.030R a month (n 143, t −0.74), placebo 16 of 40. | n 143, -0.03R a month, t -0.74 |
| `fx-ny-cut` | #979 | The 10:00 New York option cut, forex majors | FAIL. | n 3575, -0.054R a trade, t -7.86 |
| `fx-post-holiday-replicate` | #980 | the US dollar on the day after a US market holiday, replicated on other dollar pairs (2026-11-14) | FAIL: long USD on the day after a US holiday against six other currencies makes +0.026R a holiday net 2005-26 (n 198, t +1.00). (replicate-type) | n 198, +0.026R, t 1 |
| `fx-reversal` | #834 | cross-sectional 1-week reversal in G10 FX | FAIL, 0 of 4 checks. |  |
| `fx-round-numbers` | #931 | Round numbers on forex majors (stall and break) | FAIL: 0 of 2 rules pass. | n 5966, -0.12R a trade, t -8.4 |
| `fx-tokyo-orb` | #929 | Tokyo-open range breakout on USD/JPY, AUD/USD and NZD/USD | FAIL: 0 of 3 tests pass. | n 862, -0.08R a trade, t -3.9 |
| `fx-us-holiday` | #975 | the US dollar on the day before a US market holiday (2026-11-14) | FAIL: the long USD dollar basket on the day before a US holiday (side learned 2005-14) makes +0.015R a holiday out of sample (n 109, t +0.53). | n 109, +0.015R, t 0.53 |
| `fx-value` | #968 | forex "value" as a five-year cross-sectional reversal, monthly rebalance | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed alone before any number was computed). |  |
| `fx-weekday` | #919 | day-of-week effects in the US dollar basket (2026-11-14) | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed before any candle was read). | t -0.71 |
| `fx-weekend-gap` | #880 | Forex majors' Sunday-open gap: does it fill? | FAIL. | +0.194R a trade |
| `fx-weekend-gap-replicate` | #928 | Forex Sunday-open gap fade, Rule G frozen: replication | Inconclusive: PARTLY. (replicate-type) | +0.238R a trade |
| `fx-weekend-gap-replicate2` | #938 | Forex Sunday-open gap fade, Rule G frozen: second replication | Inconclusive: PARTLY. (replicate-type) | n 481 |
| `fx-weekly-reversal` | #940 | one-week cross-sectional reversal in nine currencies against the dollar | FAIL, 1 of 5 checks (PREREGISTRATION.md, pushed alone before any number was computed). |  |
| `fx-xs-momentum` | #869 | forex cross-sectional momentum, monthly rebalance | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). |  |
| `gotobi` | #878 | Gotobi: USD/JPY and EUR/JPY into the 09:55 Tokyo fix on settlement days, and the fade after it | PASS (T2). |  |
| `gotobi-duka-spread` | #950 | Gotobi on bid and ask: the fade after the 09:55 Tokyo fix filled on the side that trades | NOT MEASURABLE (inconclusive: Dukascopy's datafeed host refused every connection from this build sandbox, 30 of 30 probe files failed; no bid / ask candle… | t 2 |
| `gotobi-early-years` | #957 | Gotobi early years: the frozen T2 fade on yen pair-years no gotobi study has used | FAIL: DOES NOT REPLICATE. | n 2129, +0.053R a trade, t 1.12 |
| `gotobi-feed` | #894 | Gotobi feed check: the frozen T2 fade on HistData USD/JPY M1 against OANDA, same days | Inconclusive: FEED-ROBUST. | n 623, +0.127R a trade, t 2.34 |
| `gotobi-limit-entry` | #915 | Gotobi fade: can a resting sell limit placed before the fix capture the 00:55 result? | FAIL: NOT CAPTURABLE. | +0.008R, t 0.24 |
| `gotobi-replicate` | #889 | Gotobi replication: the fade after the 09:55 Tokyo fix on four other yen crosses, and on USD/JPY before 2010 | PASS: REPLICATES. (replicate-type) | n 4784, +0.099R a trade, t 2.75 |
| `ict-smile` | main | ICT A-setups x Dollar Smile: out-of-sample test of the #507 lead | FAIL. |  |
| `jp-fiscal-yearend` | #936 | the Japanese fiscal year-end yen seasonal | FAIL, 0 of 2 tests pass: USD/JPY did not fall in March before the Japanese fiscal year-end, and did not rise in the |  |
| `london-fix` | #883 | London fix: the run into the 16:00 WM/Reuters fix on six forex majors, and the fade after it | FAIL. | n 3510, -0.152R a trade, t -7.44 |
| `risk-spill-jpy` | #859 | risk spillover into the yen after a strong S&P 500 cash session | FAIL, 0 of 2 pairs. | n 725, -0.093R a trade, t -2.36 |
| `tokyo-fix-daily` | #917 | Tokyo fix every day: is the fix-minute effect special to gotobi days? | Inconclusive: UNCLEAR. | n 1870, -0.0629R a trade, t -2.37 |
| `vol-spike-replicate2` | #951 | second frozen replication of the vol-spike rebound, on markets and years neither study used | Inconclusive: DOES NOT REPLICATE. (replicate-type) |  |
| `weekend-gap-late-entry` | #954 | Forex Sunday-gap fade entered later, after the reopen spread settles | FAIL. | -0.126R a trade |
| `wmr-fix-reversal` | #910 | The London 16:00 WM/Reuters fix: fading the hour into it (result) | FAIL. | n 12272, -0.083R a trade, t -6.01 |

## Rates (10)

| Topic | PR | Rule | Verdict | Key figures |
|---|---|---|---|---|
| `bond-fomc-drift` | #906 | Treasuries after the FOMC, following the 2-year's reading of the decision | FAIL. | n 79, -0.167R a trade, t -2.09 |
| `bond-intraday-momentum` | #970 | Intraday momentum in US Treasury CFDs | FAIL (the pooled 10-year + 30-year primary meets 1 of the 4 pre-registered lines). | n 4983, -0.547R a trade, t -23.81 |
| `bond-lead-intraday` | #926 | does a sharp M15 move in the US 10-year Treasury lead gold and USD/JPY over the next hour? | FAIL. 0 of 3 tests pass. |  |
| `bond-month-end` | #939 | the month-end index-extension effect in US Treasuries, out of sample | FAIL, 0 of 2 tests. |  |
| `bond-month-end-futures` | #943 | the bond month-end rule at Treasury futures cost | FAILS AT FUTURES COST, 0 of 2 tests. |  |
| `bond-month-end-replicate` | #961 | the bond month-end rule, frozen, on four other bond CFDs | FAIL: DOES NOT REPLICATE. #939's frozen rule (long at the close of the month's fourth-to-last trading day, out at the (replicate-type) |  |
| `event-risk` | main | Event risk manager: does skipping or flattening trades around CPI, NFP and FOMC help? | FAIL on all five pre-registered tests. |  |
| `fomc-follow` | #861 | Follow or fade the first 30 minutes after the FOMC statement | FAIL, 0 of 6 tests. | n 54, +0.095R a trade, t 0.56 |
| `pre-fomc-drift` | #831 | The pre-FOMC announcement drift, out of sample | FAIL. | n 86, +0.044R a trade, t 1.35 |
| `treasury-auction-cycle` | #978 | the Treasury auction cycle in bond CFD prices | FAIL. |  |

## Commodities (12)

| Topic | PR | Rule | Verdict | Key figures |
|---|---|---|---|---|
| `brent-wti-spread` | #933 | Brent - WTI crude spread, log-spread z-score mean reversion | FAIL: fading a 2-sd stretch of the Brent - WTI spread is not an edge after costs. | n 87, -0.199R a trade, t -1.42 |
| `commodity-cycle` | #956 | The owner's market cycle as an entry on commodity CFDs (gold excluded) | FAIL. | n 2425, -0.317R a trade, t -10.07 |
| `commodity-skewness` | #971 | Commodity cross-sectional skewness (12 months, most negative third long / most positive third short) | FAIL. | -0.06R a month, t -1.38 |
| `commodity-xs-momentum` | #935 | Commodity cross-sectional momentum (12-1, top 3 / bottom 3) | FAIL. 2016-01 to 2026-10: −0.071R a month net (130 months, Newey-West t −1.30, worst drawdown −13.33R); 2006-02 to 2015-12: +0.029R a month (119 months, t… | -0.071R a month, t -1.3 |
| `energy-seasonal` | #879 | Energy seasonal windows | FAIL, 0 of 4 tests pass. |  |
| `grain-seasonality` | #934 | Grain seasonality: the pre-harvest decline as a short on OANDA CFDs | PASS on the pre-registered bar, by one test of three, and thin. |  |
| `metals-intraday-momentum` | #932 | Intraday momentum on gold, silver and crude oil | FAIL (0 of 3 tests pass). | n 2713, -0.157R a trade, t -9.24 |
| `metals-rsi2` | #873 | the frozen 2-day RSI pullback on gold and silver | FAIL — gold and silver together lose −0.077R a trade after costs in 2016-26 (n 137, month t −1.79), 4 of the 5 pre-registered checks fail. | n 137, -0.077R a trade, t -1.79 |
| `natgas-storage-day` | #976 | the weekly US natural gas storage report, drift after the first half hour (natgas-storage-day) | FAIL, 0 of 4 checks hold: following the first half hour after the storage report is not an edge on natural gas. | n 446, -0.078R a trade, t -1.69 |
| `oil-wednesday` | #858 | the weekly US crude inventory report on WTI, fade or follow the first half hour (oil-wednesday) | FAIL, 0 of 2 rules pass: neither fading nor following the first half hour after the report is an edge on WTI. | n 304, -0.096R a trade, t -0.21 |
| `post-holiday-metals` | #984 | the US dollar on the day after a US market holiday, read on dollar-priced metals (2026-11-14) | FAIL (T1, T2, T3, T4 not met): short gold and silver on the day after a US holiday makes −0.092R a holiday net 2006-26 (n 185, t −2.78). | n 185, -0.092R, t -2.78 |
| `soybean-short-robust` | #937 | Soybean short: frozen robustness checks of the grain-seasonality pass | Inconclusive: FRAGILE. |  |

## Crypto (13)

| Topic | PR | Rule | Verdict | Key figures |
|---|---|---|---|---|
| `crypto-cycle` | #888 | The owner's market cycle as an entry on crypto | FAIL. | n 830, -0.079R a trade, t -1.8 |
| `crypto-expiry` | #977 | Crypto monthly expiry | FAIL. | n 56, +0.052R a trade, t 0.6 |
| `crypto-hour` | #842 | Bitcoin / Ether hour-of-day returns, out of sample | FAIL, 0 of 4 tests. |  |
| `crypto-reversal` | #866 | crypto short-term reversal after a sharp three-day drop | FAIL, 0 of 4 tests pass. |  |
| `crypto-sma200` | #856 | Bitcoin / Ether long only above the 200-day average | FAIL, 0 of 4 tests pass. |  |
| `crypto-trend-decay` | main | Crypto trend v3: does the edge still hold? | FAIL: decayed. | +3.7R a position |
| `crypto-weekend` | #852 | the weekend vs weekday split in Bitcoin and Ether | FAIL, 0 of 4 tests pass. |  |
| `crypto-weekend-reversal` | #890 | Crypto weekend reversal | FAIL. 0 of 5 tests pass; T1-BTC -0.016R a trade (n 19, month t -0.08); T1-ETH -0.044R a trade (n 27, month t -0.24); T2-BTC -0.141R a trade (n 19, month t… | n 19, -0.016R a trade, t -0.08 |
| `crypto-weekly-mom` | #833 | weekly time-series momentum in crypto, out of sample | FAIL, 0 of 2. |  |
| `crypto-xs-momentum` | #986 | Cross-sectional momentum among coins (3-week look-back, weekly, top third / bottom third) | FAIL, 1 of 4 conditions met: out of sample +0.0113R a week net (217 weeks, month-sum t +0.55), −0.0201R at 2x cost, above only 28 of 40 random rankings; in… | +0.0113R, t 0.55 |
| `eth-btc-ratio` | #887 | relative momentum between Ether and Bitcoin | FAIL, 0 of 2 tests pass. |  |
| `nas-crypto-spill` | #876 | big NAS100 cash sessions into BTC / ETH overnight | FAIL, 0 of 2 variants clear the checks that could be run. | n 764, -0.043R a trade, t -0.49 |
| `vol-spike-crypto` | #962 | the frozen vol-spike rebound on crypto | FAIL. #860's rule, frozen byte for byte (buy after the 5-day realised volatility exceeds twice its prior 120-day |  |

## Cross-asset (51)

| Topic | PR | Rule | Verdict | Key figures |
|---|---|---|---|---|
| `cb-days-other` | #901 | Five other central banks: follow the first hour after the decision | FAIL. | n 320, +0.208R a trade, t 1.77 |
| `commodity-fx-lead` | #899 | Does a big commodity day lead its commodity currency the next day? | FAIL: 0 of 2. | -0.009R a trade, t -0.29 |
| `confluence` | main | When MERIDIAN and ICT agree, is the edge larger? | FAIL (no robust edge from confluence). |  |
| `copper-gold` | #854 | The copper / gold ratio as a risk-on signal for US indices | FAIL: in the decisive window (2016 to 23 Oct 2026, 565 weeks) the equal-weight SPX500 / NAS100 index rose LESS in the weeks after a rising 13-week copper /… | t -0.92 |
| `cot-positioning` | main | COT positioning: does large-speculator positioning predict 1- and 4-week returns? | FAIL. |  |
| `cpi-follow` | #871 | US CPI: follow or fade the first 15 minutes, held to the New York close | FAIL. 0 of 4 tests pass. | n 81, +0.001R, t 0.02 |
| `dual-momentum` | #855 | Dual momentum, gold against US stocks against cash | FAIL. |  |
| `ecb-boj-days` | #896 | ECB and BoJ decision days: follow the first hour | FAIL, 0 of 2 tests. 2018 → now: T1 ECB, EUR/USD: n 71, +0.631R a trade net, month t +1.51, Holm p 0.1315, 2010-17 +0.471R; T2 BoJ, USD/JPY: n 67, +0.064R a… | n 71, +0.631R a trade, t 1.51 |
| `event-reaction` | main | Gold's reaction to US CPI, NFP and FOMC releases | FAIL: on CPI days gold's T+5 to T+60 move followed the dollar's first read in 34 of 73 (47%, p 0.7586; 2018-21 31%, 2022-26 55%). |  |
| `gold-lbma-fix` | #960 | Gold LBMA auctions: the run into the PM auction and the fade after it | FAIL: T1 FAIL (out of sample −0.020R a trade net, n 1472, month t -2.36; in sample −0.051R, n 1259); T2 FAIL (out of sample −0.163R a trade net, n 1472, month… | n 1472, -0.02R a trade, t -2.36 |
| `gotobi-minute-histdata` | #912 | Gotobi fade: the entry-minute grid on HistData M1 (is the 00:55 spike a feed artefact?) | Inconclusive: FEED-CONFIRMED: on HistData too the 00:55 entry is the clear maximum (+0.127R a trade, +0.027R above the next row, 00:54) and one minute late keeps 35 % of it… | +0.127R a trade |
| `gotobi-timing` | #908 | Gotobi fade: how sensitive the result is to execution timing | Inconclusive: sensitivity report, no class (gate held): the result sits on the 00:55 entry minute; one minute late net R a trade is +0.048 against +0.148 at the base, month… | t 1.07 |
| `ict-book-risk` | #824 | ICT A-setup book: a book-level risk rule | FAIL. |  |
| `ict-breadth-2` | main | ICT breadth test, part 2: the unchanged A-setup rule on the nine markets #545 could not test | FAIL (pre-registered bar), for the primary set (all nine new markets pooled) and for both secondary sets (seven |  |
| `ict-concepts` | main | New ICT entry concepts: turtle soup at equal highs/lows, "lows that broke highs", NWOG/NDOG fill (edge… | FAIL. |  |
| `ict-equal-lows` | main | ICT A-setups: does it matter what the sweep took? | FAIL. | n 107, +0.092R a trade, t 0.72 |
| `ict-exits` | main | ICT iFVG exits: what to do after entry (edge research, ict-exits) | FAIL. |  |
| `ict-exits-replay` | main | ict-exits-replay | FAIL: struct passes the gate on the replay (+0.058R a trade, t 1.44; halves +3.6R / +10.9R; better on ES, YM, RTY, GC, worse on NQ). | +0.058R a trade, t 1.44 |
| `ict-filters` | main | ICT iFVG filters: which hold up out-of-sample (2018 to Oct 2026) | PASS, but weak. |  |
| `ict-grades` | main | ICT grades: do the untraded B and C setups carry an edge, and does the grade order hold? | FAIL: H1 FAILS, H2 DOES NOT HOLD, H3 HURTS (all pre-registered bars). |  |
| `ict-markets` | main | ict-markets | Verdict not read |  |
| `ict-quarters` | #817 | ICT A-setups by quarter of the week, month and year (quarterly theory, pre-registered) | FAIL. | n 152, +0.134R a trade, t -0.01 |
| `ict-sessions` | main | When does the ICT A-setup edge live? | FAIL: nothing passes. |  |
| `ict-variants` | main | Five ICT A-setup variants from the skill, 2020 → Nov 2026, IS / OOS (pre-registered, 9 Nov 2026) | PASS for one of nine on the corrected clock (10 Nov 2026), not strong. | n 80, +0.273R, t 1.44 |
| `last-hour` | #872 | Last hour into the US cash close on a big day | FAIL: neither fading nor following a big day into the cash close pays after costs (2016 → now, pooled: fade −0.077R, follow −0.065R a trade). | n 2664, -0.077R, t -5.22 |
| `lit` | main | LIT (Liquidity Inducement Theory) on gold and NAS100, 2008-2026 | INCONCLUSIVE — under the skill's own defaults the rule produces too few trades to judge (XAUUSD 27 and NAS100 35 fills in 19 years, one order in five fills),… | n 39, +0.7R a trade, t -2.7 |
| `macro-vol` | main | macro-vol | Verdict not read |  |
| `meridian-swing` | main | MERIDIAN Swing: do filters or exits give it an edge? | FAIL. |  |
| `news-filter` | main | news-filter | Verdict not read |  |
| `nfp-follow` | #863 | NFP follow or fade, gold and NAS100 (2026-11-13) | FAIL, 0 of 4 tests pass the pre-registered bar (PREREGISTRATION.md, committed before any number was computed). | n 40, +0.096R a trade, t 0.512 |
| `nr7-breakout` | #867 | NR7 breakout on gold, two US indices and three currency pairs | FAIL. | n 2191, +0.013R a trade, t 0.38 |
| `portfolio` | main | Portfolio rules: caps, sizing, correlation and drawdown (edge research, paper only) | Inconclusive: no rule change passes. |  |
| `portfolio-v2` | main | Portfolio v2: every council stream with a long history, weighted walk-forward (paper only, proposal) | FAIL: Passes the letter of the pre-registered bars, but is not an edge on untouched data: in the clean 2009-17 half no book |  |
| `pre-fomc-gold-usd` | #925 | The pre-FOMC drift in gold and the US dollar | FAIL. 0 of 2 tests meet the pre-registered bar. | n 86, +0.07R a trade, t 1.26 |
| `pre-release-drift` | #963 | Drift in the 24 hours before US CPI and payrolls (gold and the dollar) | FAIL (0 of 10 cells pass). |  |
| `regime` | main | Does market regime decide when MERIDIAN's setups work? | Inconclusive: Scalp (live rule): FAIL.; Intraday: FAIL.; Swing: INCONCLUSIVE. |  |
| `regime-switch` | main | Regime switch: can a simple causal indicator tell in advance when the council's edges work? | FAIL as a tradable regime switch. |  |
| `risk-cross` | #886 | AUD/JPY and NZD/JPY held only while the S&P 500 is in a calm uptrend | FAIL, 0 of 3. |  |
| `scalp-exits` | main | Scalp exits: which exit, entry and stop buffer work best for the live Scalp rule? | FAIL. | +0.13R a trade |
| `scalp-filters` | main | Scalp filters on 8 years of M1 (edge research: scalp-filters) | FAIL. |  |
| `seasonality` | main | Structural seasonality on NQ, ES and gold | FAIL: nothing passes. |  |
| `setups-promote` | main | Which engine setups are worth promoting from shadow to live? | FAIL: no engine setup has a robust edge on 2018–2026. |  |
| `shadow-best` | main | Which shadow streams to keep | FAIL, 0 of 32 cells: no engine shadow stream is worth keeping |  |
| `shadow-best-raw` | #821 | The shadow cut on the measured raw-spread costs | FAIL, 0 of 32 cells at the measured costs (0 of 32 at 2x): the cut was not decided on wrong costs |  |
| `shadow-scalp-filters` | main | Five filters on the shadow scalp / intraday setups | INCONCLUSIVE: the pre-registered bar passes 4 of 5, but a random filter of the same size passes it too (4 of 5 placebos) |  |
| `sma10-timing` | #841 | The 10-month moving-average timing rule, out of sample | FAIL: on the equal-weight book (SPX500, NAS100, US30, gold), in the decisive window 2016 to 6 Nov 2026 the 10-month average rule cut the worst drawdown from… |  |
| `supported-book` | main | The supported book, run as a book | FAIL: on untouched 2006-17, after costs and financing on every unit, the two-system book (Gold trend + Gold daily engulf) made +59.3R, +5.2R a year (330… | +59.3R, t 1.86 |
| `timing` | main | Edge research · timing — time-of-day windows for Scalp / Intraday | FAIL — no time window passes. | -0.18R a trade |
| `trend-breadth-h1` | main | Trend breadth on hourly candles | FAIL: the Gold trend rule does not carry to other markets: 0 of 14 tests pass; pooled over thirteen markets −0.059R a position net on 2020-26 (n 827, monthly… | n 827, -0.059R a position, t -0.89 |
| `weekend-gap-duka` | #949 | Rule G on Dukascopy bid / ask, and the real Sunday-reopen spread | NOT MEASURABLE (inconclusive: Dukascopy is not reachable from this runner). |  |
| `yield-fx-weekly` | #942 | Do weekly moves in US 2-year yields lead the dollar against low-yielding currencies? | FAIL, 0 of 3: a weekly 2-year Treasury move does not lead the dollar over the next week; decisive 2016-26 net a trade T1 USD/JPY +0.019R (n 301, t 0.43); T2… | n 301, +0.019R, t 0.43 |

## Accounting / meta (26)

| Topic | PR | Rule | Verdict | Key figures |
|---|---|---|---|---|
| `academy-ml-review` | main | Academy scorer: training review | FAIL: No scorer passes: all 20 (the reference and the four pre-registered challenger configurations) are rejected challengers; none is promoted. | n 206 |
| `academy-policy` | main | Academy decision policy against taking every setup: diagnosis and five candidates | FAIL: no candidate passes. |  |
| `book-sizing` | main | Book sizing: the trend leg's pyramid add, on against off | FAIL: within noise (no proposal, the live rule stays). | +59.3R |
| `coach-learning` | main | Does the Coach's self-learning help or hurt? | FAIL. |  |
| `cost-floor-map` | #948 | Cost floor map: the 13-14 Nov studies, what cost each pre-cost effect can carry | Inconclusive: ACCOUNTING (no rule tested). |  |
| `costs` | main | Are the cost assumptions realistic? | FAIL. |  |
| `decay-monitor` | main | Edge-decay monitor: how it works and how it does on the record | Verdict not read |  |
| `expectations` | main | What to expect: the live systems on the data they never saw | Verdict not read |  |
| `futures-roll` | main | Futures rolls in the ICT desk's CNBC candles (data integrity, 7 Nov 2026) | Inconclusive: real, but not where #505 suspected it. | +1.07R |
| `futures-route-map` | #972 | Futures route map: the cost-blocked tests of 13-14 Nov at exchange-futures cost (2026-11-14) | Inconclusive: ROUTE-SENSITIVE: 10 tests would pass at futures cost (Holm 0) (accounting, no rule tested: inconclusive as evidence for any rule). 4 of the 10 already passed… |  |
| `fx-carry` | #830 | The FX carry trade on the G8 currencies, with a crash filter | FAIL (neither test makes money with month-sum t ≥ 2 in 2016-26 AND makes money in 2006-15). | n 130, +0.066R a month, t 0.34 |
| `gold-carry` | main | What it costs to hold a gold buy, route by route | INCONCLUSIVE (cost accounting, no rule tested): holding the book's gold buys costs 5.4 % a year at the demo broker (book +5.16R a year, t 1.86, 330 positions,… | +5.16R a year, t 1.86 |
| `gold-fidelity` | main | gold-fidelity | Inconclusive: the forward record of the four gold daily/H4 systems is too thin to diff trade by trade (no live trade yet for Gold trend, Gold trend fast, the H4 trendline… |  |
| `gotobi-cost` | #893 | Gotobi cost: what the fade after the 09:55 Tokyo fix costs, and where it breaks even | inconclusive on cost (cost accounting only, no rule tested). | +0.223R, t 4.13 |
| `histdata-clock` | main | HistData M1 clock audit | Inconclusive: data audit, no trading rule tested. |  |
| `honest-book` | main | The honest book: three paper books on data none of the rules saw | Inconclusive: On the untouched 2006-17 window, book C (honest-positive + Gold trend fast N5) is best by return/drawdown (3.9), book B (honest-positive) is a hair behind… | n 5 |
| `index-futures-cost` | #900 | The same index trades on CME micro futures | INCONCLUSIVE (cost accounting, no rule tested; no study's verdict changes): on CME micro futures the same trades net index-overnight US500 +0.001R / NAS100… | +0.001R |
| `lead-forward-plan` | #967 | What a forward paper record could show for each open lead, and how long it would take | Inconclusive: PLAN COMPUTED (no rule tested). |  |
| `multiple-testing-1314nov` | #904 | multiple testing across the studies of 13-14 Nov 2026 | FAIL: no decisive test of the day survives a correction across all 248 (Holm 0, BH q 0.10 0); gotobi T2: (a) BH q 0.7068 fails q 0.10, (b) Holm 0.7618 fails; with… |  |
| `multiple-testing-update` | #946 | multiple testing, update of the 13-14 Nov count with the studies pushed since | FAIL: no test survives a correction across all 333 (the 248 of #904 plus 85 new): Holm 0, BH q 0.10 0; t >= 2 in 6 against 7.6 expected by chance; with an… |  |
| `param-drift` | main | Parameter-drift audit: does the live code run what the studies tested? | Inconclusive: the live parameters of all seven systems equal the tested ones. |  |
| `robustness` | main | Robustness audit: how much of the claimed edge is real? | Inconclusive |  |
| `shadow-audit` | main | shadow-audit | Inconclusive: the shadow book's −300R week is 100% costs, not trading. | -287.94R |
| `shadow-cost` | main | Shadow streams at realistic costs: which ones cost at most 0.10R and still make money out of sample | INCONCLUSIVE. | +0.35R, t 2.5 |
| `sizing` | main | Position sizing for the live systems: fixed 1R stays | FAIL: keep fixed 1R. |  |
| `weekend-reopen-cost` | #944 | What a Sunday-reopen fade really costs: the spread at Rule G's entry and exit | NOT MEASURABLE (inconclusive: a cost that could not be measured, not a failed rule). |  |

## Verdict not read

`ict-markets`, `macro-vol`, `news-filter`, `decay-monitor`, `expectations`

# Futures route map: the cost-blocked tests of 13-14 Nov at exchange-futures cost (2026-11-14)

**Verdict: ROUTE-SENSITIVE: 10 tests would pass at futures cost (Holm 0) (accounting, no rule tested: inconclusive as evidence for any rule).** 4 of the 10 already passed their own bar at the CFD cost; 6 pass only at futures cost; none survives Holm over the 32 re-costed family tests. Accounting, no rule tested. **The demo accounts trade CFDs only (absolute rule 2): no route, account or broker change is proposed, and nothing here is called an edge.** A route chosen after seeing the CFD loss, on the same history each rule was judged on, is not evidence of an edge; it would need its own pre-registration and a forward record.

Pre-registration: `PREREGISTRATION.md` (pushed alone first). Inputs: `collected.json` (`collect.mjs`, `git show` of each branch, no network). Every figure: `result.json`.

## What was read

- 44 tests: the 43 of cost-floor-map (#948) classed cost-blocked (31) or net t ≥ 2 (12), plus bond-month-end-replicate's pooled test (added by name).
- **No route: 7** (a forex cross in the test, section 2). **Re-costed: 37** (7 per trade from a stored list, 30 by the constant-cost approximation, labelled "approx").
- **Step A** (decisive futures net > 0 and t ≥ 2): **12**. **Would pass the study's own bar at futures cost: 10.** Holm over the re-costed family tests: **0** survive.

## The futures equivalents (section 2 of the pre-registration)

| Instrument | Contract | Tick | Value | Fee a side | Round trip at the reference price, % of price | Source |
|---|---|---|---|---|---|---|
| usdjpy | 6J | 5e-7 | 12,500,000 units | 2.5 | 0.0159 % (at 113.696) | from memory, not opened; fee assumed |
| eurusd | 6E | 0.00005 | 125,000 units | 2.5 | 0.0125 % (at 1.12268) | from memory, not opened; fee assumed |
| gbpusd | 6B | 0.0001 | 62,500 units | 2.5 | 0.0215 % (at 1.30301) | from memory, not opened; fee assumed |
| audusd | 6A | 0.00005 | 100,000 units | 2.5 | 0.0213 % (at 0.70548) | from memory, not opened; fee assumed |
| usdchf | 6S | 0.00005 | 125,000 units | 2.5 | 0.0130 % (at 0.93076) | from memory, not opened; fee assumed |
| usdcad | 6C | 0.00005 | 100,000 units | 2.5 | 0.0200 % (at 1.33214) | from memory, not opened; fee assumed |
| usdcnh | CNH (USD/offshore RMB) | 0.0001 | 100,000 units | 2.5 | 0.0079 % (at 6.91753) | from memory, not opened; fee assumed; thin |
| nas100 | MNQ | 0.25 | 2 a point | 0.62 | 0.0093 % (at 12101.9) | index-futures-cost (#900) |
| spx500 | MES | 0.25 | 5 a point | 0.62 | 0.0192 % (at 3887.8) | index-futures-cost (#900) |
| us30 | MYM | 1 | 0.5 a point | 0.62 | 0.0141 % (at 31661.2) | index-futures-cost (#900) |
| us2000 | M2K | 0.1 | 5 a point | 0.62 | 0.0252 % (at 1776.83) | assumed (tick, value); fee #900 |
| de40 | FDXM | 1 | 5 a point | 1 | 0.0175 % (at 13720.1) | assumed |
| eu50 | FESX | 1 | 10 a point | 1 | 0.0593 % (at 3712.3) | assumed |
| uk100 | Z (FTSE 100) | 0.5 | 10 a point | 1 | 0.0162 % (at 7421.65) | assumed |
| jp225 | Nikkei 225 mini | 5 | 100 a point | 150 | 0.0483 % (at 26924.4) | assumed |
| xau | MGC | 0.1 | 10 a point | 1.06 | 0.0230 % (at 1791.655) | council/futures.mjs (tick, value); gold-carry ($2.12 a round trip) |
| btc | MBT | 5 | 0.1 a point | 3.35 | 0.1239 % (at 62135.47) | assumed (from memory, not opened) |
| eth | MET | 0.5 | 0.1 a point | 3.35 | 2.9181 % (at 2330.26) | assumed (from memory, not opened) |

One tick of slippage a side and the fee a side, twice; no financing; no roll charge. Crosses: no route. Reference price = the median daily close of the decisive window (council-data, pinned commit).

## Per test (decisive window; R a trade unless the unit says %)

| Study | Test | Role | Family | Unit | n | Gross | CFD net | CFD t | Futures cost | Futures net | Futures t | 2 x futures cost: net, t | Method | Step A | Own bar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gotobi-replicate (#889) | R2 USD/JPY 2005-09 | replication | gotobi | R | 355 | +0.357 | +0.261 | 3.80 | +0.090 | +0.266 | 3.88 | +0.176, 2.56 | approx (constant cost) | yes | PASS (passed at CFD cost too) |
| vol-spike-rebound (#860) | 10-day hold | family | index short-term reversal | % | 165 | +1.063 | +0.899 | 2.53 | +0.014 | +1.049 | 2.95 | +1.035, 2.91 | approx (constant cost, % of price) | yes | PASS (passed at CFD cost too) |
| overnight-drift (#836) | nas100 | family | index overnight | R | 2722 | +0.021 | +0.001 | 0.20 | +0.007 | +0.014 | 2.86 | +0.008, 1.51 | approx (constant cost) | yes | no (overnight beats the cash session per hour held, both legs at futures cost) |
| gotobi (#878) | T2 | family | gotobi | R | 771 | +0.261 | +0.148 | 2.74 | +0.113 | +0.148 | 2.74 | +0.036, 0.66 | approx (constant cost) | yes | PASS (passed at CFD cost too) |
| turnaround-tuesday (#857) | nas100-r2 | family | index short-term reversal | R | 81 | +0.114 | +0.098 | 2.33 | +0.002 | +0.112 | 2.72 | +0.109, 2.66 | approx (the trade list failed its gate; mean futures cost of the list, constant cost) | yes | PASS (passed at CFD cost too) |
| index-ibs (#895) | T2 | family | index short-term reversal | R | 473 | +0.096 | +0.056 | 1.65 | +0.007 | +0.089 | 2.68 | +0.083, 2.47 | per trade | yes | **PASS** (fails at CFD cost) |
| index-overnight (#891) | T2 | family | index overnight | R | 2721 | +0.026 | −0.006 | −0.84 | +0.008 | +0.018 | 2.45 | +0.010, 1.35 | per trade | yes | no (net > 0 (2005-15); pooled T1 + T2 condition (#900)) |
| rsi2-pullback (#838) | spx500 | family | index short-term reversal | % | 99 | +0.402 | +0.318 | 2.02 | +0.019 | +0.383 | 2.43 | +0.364, 2.31 | approx (constant cost, % of price) | yes | **PASS** (fails at CFD cost) |
| rsi2-pullback (#838) | us30 | family | index short-term reversal | % | 102 | +0.364 | +0.288 | 1.88 | +0.014 | +0.350 | 2.28 | +0.336, 2.19 | approx (constant cost, % of price) | yes | **PASS** (fails at CFD cost) |
| vol-spike-rebound (#860) | 5-day hold | family | index short-term reversal | % | 216 | +0.588 | +0.497 | 1.96 | +0.014 | +0.574 | 2.26 | +0.560, 2.21 | approx (constant cost, % of price) | yes | **PASS** (fails at CFD cost) |
| gotobi (#878) | T3 | family | gotobi | R | 765 | +0.214 | +0.095 | 2.20 | +0.118 | +0.095 | 2.20 | −0.023, −0.53 | approx (constant cost) | yes | **PASS** (fails at CFD cost) |
| turnaround-replicate (#862) | pooled | replication | index short-term reversal | R | 411 | +0.072 | +0.052 | 1.69 | +0.009 | +0.063 | 2.03 | +0.053, 1.73 | approx (the trade list failed its gate; mean futures cost of the list, constant cost) | yes | **PASS** (fails at CFD cost) |
| turnaround-tuesday (#857) | nas100-r1 | family | index short-term reversal | R | 224 | +0.049 | +0.030 | 1.23 | +0.003 | +0.046 | 1.97 | +0.043, 1.85 | approx (the trade list failed its gate; mean futures cost of the list, constant cost) | no | no |
| bond-month-end-replicate | pool | replication | bond month-end | R | 130 | +0.107 | −0.034 | −0.81 | +0.030 | +0.077 | 1.90 | +0.047, 1.15 | per trade | no | no |
| gotobi (#878) | T4 | family | gotobi | R | 771 | +0.202 | +0.102 | 1.84 | +0.100 | +0.102 | 1.84 | +0.002, 0.04 | approx (constant cost) | no | no |
| pre-fomc-drift (#831) | spx500 | family | scheduled-event drift | R | 86 | +0.073 | +0.044 | 1.35 | +0.014 | +0.059 | 1.82 | +0.045, 1.38 | per trade | no | no |
| gotobi-feed (#894) | HistData USD/JPY | robustness | gotobi | R | 623 | +0.243 | +0.127 | 2.34 | +0.146 | +0.097 | 1.79 | −0.049, −0.91 | approx (constant cost) | no | no |
| gotobi-minute-histdata (#912) | gotobi T2 on M1 | robustness | gotobi | R | 623 | +0.243 | +0.127 | 2.34 | +0.146 | +0.097 | 1.79 | −0.049, −0.91 | approx (constant cost) | no | no |
| orb-nas100 (#837) | nas100 | family | index intraday breakout and momentum | R | 1460 | +0.135 | +0.075 | 1.27 | +0.034 | +0.101 | 1.69 | +0.068, 1.13 | approx (constant cost) | no | no |
| index-midday-turn (#914) | T2 | family | index intraday breakout and momentum | R | 2308 | +0.016 | −0.010 | −1.60 | +0.006 | +0.010 | 1.62 | +0.004, 0.64 | approx (constant cost) | no | no |
| bond-month-end (#939) | USB10Y | family | bond month-end | R | 130 | +0.107 | +0.036 | 0.77 | +0.033 | +0.074 | 1.60 | +0.041, 0.89 | per trade | no | no |
| cb-days-other (#901) | pooled five banks | family | scheduled-event drift | R | 320 | +0.300 | +0.208 | 1.77 | +0.171 | +0.129 | 1.10 | −0.042, −0.36 | per trade | no | no |
| gold-session-drift (#875) | T2 | family | cross-asset lead and session drift | R | 1063 | +0.040 | +0.023 | 1.37 | +0.023 | +0.017 | 1.00 | −0.006, −0.38 | approx (constant cost) | no | no |
| gotobi (#878) | T1 | family | gotobi | R | 760 | +0.158 | +0.036 | 0.93 | +0.122 | +0.036 | 0.93 | −0.087, −2.26 | approx (constant cost) | no | no |
| nr7-breakout (#867) | B | family | index intraday breakout and momentum | R | 2191 | +0.056 | +0.008 | 0.29 | +0.038 | +0.018 | 0.66 | −0.019, −0.71 | approx (constant cost) | no | no |
| index-overnight (#891) | T1 | family | index overnight | R | 2721 | +0.023 | −0.022 | −2.86 | +0.020 | +0.003 | 0.35 | −0.017, −2.20 | per trade | no | no |
| overnight-drift (#836) | spx500 | family | index overnight | R | 2722 | +0.016 | −0.009 | −1.39 | +0.017 | −0.001 | −0.07 | −0.017, −2.60 | approx (constant cost) | no | no |
| orb-nas100 (#837) | spx500 | family | index intraday breakout and momentum | R | 1456 | +0.138 | −0.053 | −0.79 | +0.143 | −0.005 | −0.07 | −0.148, −2.22 | approx (constant cost) | no | no |
| cnh-fix (#927) | T2 | family | FX fixes | R | 1667 | +0.248 | −0.406 | −5.54 | +0.392 | −0.144 | −2.05 | −0.535, −7.63 | approx (constant cost) | no | no |
| ecb-ref-fix (#921) | T1 | family | FX fixes | R | 2018 | +0.119 | −0.136 | −2.93 | +0.323 | −0.204 | −4.42 | −0.527, −11.41 | approx (constant cost) | no | no |
| bond-lead-intraday (#926) | T3 | family | cross-asset lead and session drift | R | 3107 | +0.072 | −0.071 | −2.50 | +0.196 | −0.124 | −4.46 | −0.321, −11.50 | approx (constant cost) | no | no |
| ecb-ref-fix (#921) | T2 | family | FX fixes | R | 2018 | +0.131 | −0.124 | −2.88 | +0.323 | −0.192 | −4.49 | −0.515, −12.03 | approx (constant cost) | no | no |
| eth-btc-ratio (#887) | test 1 | family | cross-asset lead and session drift | R | 251 | +0.047 | +0.014 | 0.68 | +0.152 | −0.105 | −5.13 | −0.257, −12.55 | approx (constant cost) | no | no |
| bond-lead-intraday (#926) | T2 | family | cross-asset lead and session drift | R | 3846 | +0.083 | −0.116 | −3.98 | +0.238 | −0.155 | −5.35 | −0.394, −13.57 | approx (constant cost) | no | no |
| bond-lead-intraday (#926) | T1 | family | cross-asset lead and session drift | R | 3886 | +0.047 | −0.097 | −3.94 | +0.198 | −0.151 | −6.26 | −0.348, −14.46 | approx (constant cost) | no | no |
| wmr-fix-reversal (#910) | T1 | family | FX fixes | R | 12272 | +0.041 | −0.083 | −6.01 | +0.213 | −0.172 | −12.45 | −0.385, −27.88 | approx (constant cost) | no | no |
| wmr-fix-reversal (#910) | T3 | family | FX fixes | R | 12272 | +0.044 | −0.080 | −6.72 | +0.213 | −0.169 | −14.43 | −0.382, −32.62 | approx (constant cost) | no | no |
| gotobi-replicate (#889) | R1 crosses pooled | replication | gotobi | R | 4784 | +0.193 | +0.099 | 2.75 | — | — | — | — | no route: yen crosses (EUR/JPY and others): no route | — | no route |
| fx-weekend-gap (#880) | G | family | weekend gap | R | 243 | +0.292 | +0.194 | 2.14 | — | — | — | — | no route: EUR/JPY (a cross) is one of its six pairs; also CME Globex FX reopens on Sunday after spot FX (from memory, not opened), so the reopen entry has no futures twin | — | no route |
| fx-weekend-gap-replicate (#928) | R1 | replication | weekend gap | R | 294 | +0.365 | +0.238 | 2.99 | — | — | — | — | no route: all six pairs are crosses (AUD/JPY, EUR/AUD, EUR/CHF, GBP/JPY, GBP/AUD, EUR/GBP) | — | no route |
| fx-weekend-gap-replicate2 (#938) | S1 | replication | weekend gap | R | 588 | +0.179 | +0.061 | 1.02 | — | — | — | — | no route: all six pairs are crosses | — | no route |
| fx-weekend-gap-replicate2 (#938) | S2 | replication | weekend gap | R | 481 | +0.293 | +0.153 | 3.19 | — | — | — | — | no route: four of its six pairs are crosses (CAD/JPY, NZD/JPY, AUD/NZD, AUD/CAD) | — | no route |
| fx-london-orb (#868) | F1 | family | London opening range | R | 9875 | +0.080 | −0.050 | −2.28 | — | — | — | — | no route: EUR/JPY (a cross) is one of the six pairs of the pooled test (cost-floor-map's label "eurusd / gbpusd" is short) | — | no route |
| fx-london-orb (#868) | F2 | family | London opening range | R | 9875 | +0.040 | −0.075 | −5.36 | — | — | — | — | no route: EUR/JPY (a cross) is one of the six pairs of the pooled test (cost-floor-map's label "eurusd / gbpusd" is short) | — | no route |

## Gates of the per-trade re-costs

| Test | n | gross | CFD net | CFD t (its form) | Published | Gate |
|---|---|---|---|---|---|---|
| #891 index-overnight T1 | 2721 | +0.022 | −0.022 | −2.86 | n 2721, +0.023, −0.022, t −2.86 | passed |
| #891 index-overnight T2 | 2721 | +0.026 | −0.006 | −0.84 | n 2721, +0.026, −0.006, t −0.84 | passed |
| #895 index-ibs T2 | 473 | +0.096 | +0.056 | 1.65 | n 473, +0.096, +0.056, t 1.65 | passed |
| #857 turnaround-tuesday nas100-r2 | 81 | — | +0.098 | 2.33 | n 81, +0.114, +0.098, t 2.33 | failed (gross; 1 trades with no recoverable stop): falls back to the approximation |
| #857 turnaround-tuesday nas100-r1 | 224 | — | +0.030 | 1.23 | n 224, +0.049, +0.030, t 1.23 | failed (gross; 1 trades with no recoverable stop): falls back to the approximation |
| #862 turnaround-replicate pooled | 411 | — | +0.052 | 1.69 | n 411, +0.072, +0.052, t 1.69 | failed (gross; 5 trades with no recoverable stop): falls back to the approximation |
| #831 pre-fomc-drift spx500 | 86 | +0.073 | +0.044 | 1.35 | n 86, +0.073, +0.044, t 1.35 | passed |
| #901 cb-days-other pooled five banks | 320 | +0.300 | +0.208 | 1.77 | n 320, +0.300, +0.208, t 1.77 | passed |
| #939 bond-month-end USB10Y | 130 | +0.106 | +0.036 | 0.77 | n 130, +0.107, +0.036, t 0.77 | passed |
| bond-month-end-replicate pool | 130 | +0.107 | −0.034 | −0.81 | n 130, +0.107, −0.034, t −0.81 | passed |

## Multiple testing (the counting rule of multiple-testing-update)

- **Primary, the 32 re-costed family tests:** at futures cost Holm 0.05: 0 (none); BH q 0.05: 10; q 0.10: 13; t ≥ 2: 10 (#878 gotobi T2; #878 gotobi T3; #836 overnight-drift nas100; #891 index-overnight T2; #895 index-ibs T2; #838 rsi2-pullback spx500; #838 rsi2-pullback us30; #860 vol-spike-rebound 10-day hold; #860 vol-spike-rebound 5-day hold; #857 turnaround-tuesday nas100-r2). At the CFD cost: Holm 0, BH q 0.10 2, t ≥ 2 5.
- Sensitivity, every re-costed test (37, replication and robustness rows included): Holm 1 (#889 gotobi-replicate R2 USD/JPY 2005-09), BH q 0.10 21.
- Sensitivity, the full family of multiple-testing-update (N 333; 31 re-costed family tests replaced by their futures p): Holm 0 (none), BH q 0.05 0, q 0.10 0; Bonferroni needs t ≥ 3.62. Not in that family (counted per bank there): #901 cb-days-other pooled five banks.

## Families as a whole (Stouffer of the family-role tests, Holm across families)

| Family | Tests | No route | Re-costed (family role) | Step A | Would pass | Stouffer z futures | Holm p | z CFD | Holm p CFD | Survives | Replication / robustness rows (futures t) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gotobi | 8 | 1 | 4 | 3 | 3 | 3.86 | 0.0007 | 3.86 | 0.0007 | yes | #889 gotobi-replicate R2 USD/JPY 2005-09 3.88; #894 gotobi-feed HistData USD/JPY 1.79; #912 gotobi-minute-histdata gotobi T2 on M1 1.79 |
| weekend gap | 4 | 4 | 0 | 0 | 0 | — | — | — | — | — | — |
| London opening range | 2 | 2 | 0 | 0 | 0 | — | — | — | — | — | — |
| FX fixes | 5 | 0 | 5 | 0 | 0 | −16.92 | 1 | −10.77 | 1 | no | — |
| index overnight | 4 | 0 | 4 | 2 | 0 | 2.79 | 0.0156 | −2.44 | 1 | yes | — |
| index short-term reversal | 8 | 0 | 7 | 7 | 7 | 6.54 | 0 | 5.14 | 0 | yes | #862 turnaround-replicate pooled 2.03 |
| index intraday breakout and momentum | 4 | 0 | 4 | 0 | 0 | 1.95 | 0.1024 | −0.41 | 1 | no | — |
| scheduled-event drift | 2 | 0 | 2 | 0 | 0 | 2.06 | 0.0975 | 2.21 | 0.0822 | no | — |
| cross-asset lead and session drift | 5 | 0 | 5 | 0 | 0 | −9.03 | 1 | −3.74 | 1 | no | — |
| bond month-end | 2 | 0 | 1 | 0 | 0 | 1.60 | 0.1644 | 0.77 | 1 | no | bond-month-end-replicate pool 1.90 |

The tests of one family share days and markets: the Stouffer z treats them as independent and overstates the evidence (an upper bound).

## Reading, in plain words

- **Where a futures route changes the answer: index trades held one night to two weeks.** 6 tests pass their own bar only at futures cost. 5 are index tests: #895 index-ibs T2 (futures +0.089R, t 2.68; CFD t 1.65); #838 rsi2-pullback spx500 (futures +0.383 %, t 2.43; CFD t 2.02); #838 rsi2-pullback us30 (futures +0.350 %, t 2.28; CFD t 1.88); #860 vol-spike-rebound 5-day hold (futures +0.574 %, t 2.26; CFD t 1.96); #862 turnaround-replicate pooled (futures +0.063R, t 2.03; CFD t 1.69). What the route removes there is mostly the CFD's overnight financing and its spread; micro index futures cost 0.01-0.03 % of price a round trip at 2016-26 levels. The other, #878 gotobi T3, does not move on its decisive window (t 2.20 either way): it passes only because its 2010-15 replication turns positive (futures +0.017R a trade against −0.016R on the CFD), since the 6J tick, fixed in USD per JPY, is cheaper in pips at the lower yen prices of those years. A margin that thin is the cost model, not the market. 4 tests already passed at the CFD cost and still do: #878 gotobi T2; #889 gotobi-replicate R2 USD/JPY 2005-09; #860 vol-spike-rebound 10-day hold; #857 turnaround-tuesday nas100-r2.
- **Where it does not: forex, gold and the intraday tests.** CME currency futures at one tick a side plus fees cost about as much as, or more than, the ECN costs the forex studies assumed (0.3-pip spread, 0.3-0.5 pip slippage a side, 45 USD a million): the FX fixes get worse (family z −16.92 against −10.77 at the CFD cost), and the gotobi rows move by nothing at 2016-26 yen levels (6J's tick is fixed in USD per JPY, so its cost in pips grows with the price). Micro gold at $0.20 of ticks plus $0.21 of fees an ounce costs more than the $0.30 the gold studies charged (bond-lead-intraday, gold-session-drift get worse). Seven tests have no route at all: every weekend-gap test and the London opening range hold a forex cross.
- **No test survives a correction for the number of tests.** Over the 32 re-costed family tests, Holm leaves 0 at futures cost (the smallest Holm p is 0.0508); in the whole family of multiple-testing-update (333 tests, the re-costed ones at their futures p) Holm leaves 0 and BH at q 0.10 0. BH at q 0.05 over the 32 re-costed tests alone keeps 10, but those 32 were chosen for a gross t of at least 2 out of hundreds, so that count is inflated by the selection and is not the family count.
- **Families as a whole** (Stouffer, Holm across the families with a re-costed test): gotobi (z 3.86 at futures cost, 3.86 at the CFD cost); index overnight (z 2.79 at futures cost, −2.44 at the CFD cost); index short-term reversal (z 6.54 at futures cost, 5.14 at the CFD cost) pass the pre-registered line. Read with three cautions: the tests of a family share days and markets (the z overstates), the family holds only the tests that cost-floor-map selected for a gross t of at least 2 (the family's other tests, e.g. the RSI(2) NASDAQ row, the turnaround S&P cells, index-ibs T1 / T3, are not in it), and gotobi passes at the CFD cost already. Only "index overnight" turns from a loss to a pass because of the route, and none of its four tests passes its own bar on futures (index-overnight T2 loses in 2005-15; overnight-drift NAS100 fails its own per-hour comparison).
- **What this is not.** Each futures figure is computed on the same 2016-26 history the rule was chosen and judged on, with a cost route picked after the CFD result was seen; it is not a new verdict on any rule and not evidence of an edge. A futures route would need its own pre-registration with a measured futures cost (not the assumed fees above) and a forward record. The council's demo accounts trade CFDs only; nothing here proposes a route, an account or a broker.

## Sensitivities (reported, not judged)

- **Index futures carry.** #900 charged a carry line (r − q) that this study leaves out (the brief fixes no financing on futures). Beside its figures: index-overnight T1 here +0.003R, t 0.35; #900 +0.001R, t 0.08 (carry +0.002R); index-overnight T2 here +0.018R, t 2.45; #900 +0.015R, t 2.02 (carry +0.003R); index-ibs T2 here +0.089R, t 2.68; #900 +0.086R, t 2.56 (carry +0.004R). For the multi-night index tests that pass, the mean carry over 2016-26 would be: #838 rsi2-pullback spx500 0.0091 % of price; #838 rsi2-pullback us30 0.0053 % of price; #860 vol-spike-rebound 10-day hold 0.0295 % of price; #860 vol-spike-rebound 5-day hold 0.0137 % of price, small against their futures net.
- **Bonds, one tick a side here, one tick a round trip in #943 and bond-month-end-replicate:** bond-month-end USB10Y here +0.074R, t 1.60; theirs +0.088R, t 1.91; bond-month-end-replicate pool here +0.077R, t 1.90; theirs +0.089R, t 2.21. Neither reaches t 2 here.
- **eth-btc-ratio at a tick-only route**: the pre-registered fee ($3.35 a side, assumed) is 0.1 ETH's notional of about $233 a contract at the median price, so the Micro Ether leg costs 2.92 % a round trip; with no fee at all the test nets +0.044R, t 2.15 (pre-registered: −0.105R, t −5.13). The crypto row turns on a fee nobody here has checked, and CME crypto futures are shut at the weekend and carry a basis of several % a year: read it as not measured.

## Assumptions

- **Fees and ticks** not taken from a committed study are from memory and not opened (CME, Eurex, ICE and broker pages are not reachable from the build sandbox): every currency future, M2K, the European and Japanese index futures, MBT / MET. The CME currency-future fee of $2.50 a side is an assumption. The index micros (#900), MGC (gold-carry, `council/futures.mjs`) and the Treasury fees (#943) reuse committed figures, themselves from search summaries.
- **One tick of slippage a side** on every route, also on limit and target exits; no partial fills; one contract per trade, whole-contract sizing ignored (one 6J or 6E is about $85,000-140,000 of notional; one MNQ at these stops risks about $1,000).
- **The price path is the CFD / spot mid** of each study; a future trades the same points plus a basis, and outside its main session its spread is wider than one tick (the gotobi fix at 00:55 UTC, the overnight entries at the cash close).
- **Constant-cost approximation** (30 tests): the CFD transaction cost a trade is scaled by the ratio of the two round trips at the window's median price, financing dropped, and the t moved in proportion to the mean (cost-floor-map's rule). For the tests in % of price (RSI(2), volatility spike) the t is the study's t on R moved by the % change: an approximation, said beside each.
- **No financing, no roll** on futures (the brief): the carry a long future pays is in its price and is reported above for the index tests only; for crypto the basis is not modelled at all.

## Departures from the pre-registration

- The crypto reference prices come from council-data `research/candles/crypto1d` (Binance daily), because the daily OANDA cache holds no crypto.
- The turnaround tuples store net R and net % rounded to three decimals: for trades with a net R near zero the stop cannot be recovered, so the three turnaround gates fail and those tests use the constant-cost approximation with the mean futures cost of the recoverable trades (as section 3 says).
- Step B, where a condition needed a figure no file stores: placebo thresholds are shifted by the change in cost a trade (gotobi, RSI(2), both turnaround studies); the volatility-spike 2008-15 condition is decided by a bound (its futures cost in % is below the CFD's all-in cost there, so its net R can only rise); RSI(2)'s month t is moved with the mean; Holm within a study uses the futures p of every test of that study, the ones outside the 43 re-costed the same way (overnight-drift US30, RSI(2) NAS100, the turnaround S&P cells).
- cost-floor-map's instrument labels were short in two places and the study files were followed: bond-lead-intraday trades gold (T1, T3) and USD/JPY (T2), not indices; fx-london-orb pools six pairs including EUR/JPY.
- "Passed at the CFD cost" is read from each study's own result (gotobi T2, gotobi-replicate R2, vol-spike-rebound 10-day, turnaround-tuesday NAS100 r2); the verdict line keeps the pre-registered wording and says how many of its n are route-only.
- The verdict line carries "(accounting, no rule tested: inconclusive as evidence for any rule)" after the pre-registered words, so that the Edge lab and the research ledger (`research/edge/verdict.mjs`) do not file a cost re-count as a passing study.

Tests: `tests/futures-route-map.test.mjs` (offline, on the committed `collected.json`). To repeat: `node research/edge/futures-route-map/collect.mjs` (needs the study branches fetched), then `node research/edge/futures-route-map/run.mjs`.

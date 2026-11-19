# Cost floor map: the 13-14 Nov studies, what cost each pre-cost effect can carry

Built 2026-11-14. Pre-registration: PREREGISTRATION.md (committed and pushed alone first). Inputs: collected.json (read from each study's own branch by collect.mjs).

**Verdict: ACCOUNTING (no rule tested).** This is accounting of committed results, not a test of any market: no data was fetched, no rule was run, no study's verdict changes, and no row below is an edge.

## What was read

- 118 studies of pull requests #815-#943, 339 decisive tests. 229 tests could be read (gross, net and a t stored on the decisive object), in 81 studies; 110 could not (listed at the end with the reason).
- Of the tests read, 134 have a POSITIVE decisive gross mean (the ranked table) and 95 have none (gross zero or negative).
- Left out (not a study, or not run): gotobi-cost (#893), index-futures-cost (#900), bond-month-end-futures (#943), multiple-testing-1314nov (#904), gotobi-timing (#908), vix-term (#827).

## The two floors

Cost is taken as a constant a trade (section 3 of the pre-registration). **Break-even cost** = the cost a trade at which the decisive net mean is 0 (= the gross mean). **t-2 cost** = the cost at which the decisive net t is 2 (= gross − 2·s, s = the mean per unit of t). A t-2 cost below zero means the effect does not reach t 2 even with no cost at all. "Cost charged" = gross − net (spread, commission, slippage and financing as the study charged them). A dagger on a demo cost = financing unknown and not added (the transaction cost alone). An asterisk on t gross = derived from the stored net t under the same assumption (not stored by the study).

Demo cost (measured): council-data ctrader/symbols.json of 2026-11-14T02:19:02.433Z (median quoted spread over its quotes + commission, no slippage), converted to R with the study's stored median stop as % of price (or pips), plus the study's own financing where it is stored apart. Round trip as % of price: XAUUSD 0.0042%, EURUSD 0.0045%, GBPUSD 0.0045%, AUDUSD 0.0045%, USDCAD 0.0045%, USDCHF 0.0045%, BTCUSD 0.0297%, ETHUSD 0.1605%, SOLUSD 0.2567%, NAS100 0.0029%, US500 0.004%, US30 0.0031%, US2000 0.0108%. The spread is the median of only 110-132 quotes a symbol taken between 2026-11-12T22:39:23.000Z and 2026-11-14T02:19:02.000Z (about one trading day, all hours outside the rollover): a snapshot of this account, not a history. The median stop understates the mean cost in R (cost / stop is convex), and no slippage is in it: read the demo figure as a floor, not the full cost.

## Ranked table (tests with a positive decisive gross, strongest pre-cost t first)

| # | Study | Test | Instrument | Unit | n | Gross | t gross | Cost charged | Net t | Break-even cost | t-2 cost | Demo cost (measured) | Fits on the demo? | Would need futures? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | fx-weekend-gap-replicate2 (#938) | S2 | forex (other pairs) | R | 481 | +0.293 | 6.10* | 0.140 | 3.19 | 0.293 | 0.197 | unknown | unknown | no |
| 2 | gotobi-replicate (#889) | R1 crosses pooled | yen crosses | R | 4784 | +0.193 | 5.35* | 0.094 | 2.75 | 0.193 | 0.121 | unknown | unknown | no |
| 3 | gotobi-replicate (#889) | R2 USD/JPY 2005-09 | usdjpy | R | 355 | +0.357 | 5.20* | 0.096 | 3.80 | 0.357 | 0.220 | unknown | unknown | no |
| 4 | gotobi (#878) | T3 | usdjpy | R | 765 | +0.214 | 4.93* | 0.118 | 2.20 | 0.214 | 0.127 | unknown | unknown | no |
| 5 | gotobi (#878) | T2 | usdjpy | R | 771 | +0.261 | 4.82* | 0.113 | 2.74 | 0.261 | 0.153 | unknown | unknown | no |
| 6 | fx-weekend-gap-replicate (#928) | R1 | forex (other pairs) | R | 294 | +0.365 | 4.57* | 0.126 | 2.99 | 0.365 | 0.205 | unknown | unknown | no |
| 7 | gotobi-feed (#894) | HistData USD/JPY | usdjpy | R | 623 | +0.243 | 4.50* | 0.117 | 2.34 | 0.243 | 0.135 | unknown | unknown | no |
| 8 | gotobi-minute-histdata (#912) | gotobi T2 on M1 | usdjpy | R | 623 | +0.243 | 4.50* | 0.117 | 2.34 | 0.243 | 0.135 | unknown | unknown | no |
| 9 | overnight-drift (#836) | nas100 | nas100 | R | 2722 | +0.021 | 4.20* | 0.020 | 0.20 | 0.021 | 0.011 | unknown | unknown | no |
| 10 | gotobi (#878) | T1 | usdjpy | R | 760 | +0.158 | 4.12* | 0.123 | 0.93 | 0.158 | 0.082 | unknown | unknown | no |
| 11 | wmr-fix-reversal (#910) | T3 | forex majors | R | 12272 | +0.044 | 3.87 | 0.124 | −6.72 | 0.044 | 0.021 | unknown | unknown | yes |
| 12 | cnh-fix (#927) | T2 | usdcnh | R | 1667 | +0.248 | 3.78 | 0.654 | −5.54 | 0.248 | 0.108 | unknown | unknown | yes |
| 13 | fx-london-orb (#868) | F1 | eurusd / gbpusd | R | 9875 | +0.080 | 3.74 | 0.130 | −2.28 | 0.080 | 0.037 | unknown | unknown | yes |
| 14 | gotobi (#878) | T4 | usdjpy | R | 771 | +0.202 | 3.64* | 0.100 | 1.84 | 0.202 | 0.091 | unknown | unknown | no |
| 15 | index-overnight (#891) | T2 | nas100 | R | 2721 | +0.026 | 3.54 | 0.032 | −0.84 | 0.026 | 0.011 | 0.014 | yes | no |
| 16 | fx-weekend-gap (#880) | G | forex majors | R | 243 | +0.292 | 3.23* | 0.098 | 2.14 | 0.292 | 0.111 | unknown | unknown | no |
| 17 | ecb-ref-fix (#921) | T2 | eurusd and crosses | R | 2018 | +0.131 | 3.08 | 0.255 | −2.88 | 0.131 | 0.045 | unknown | unknown | yes |
| 18 | fx-london-orb (#868) | F2 | eurusd / gbpusd | R | 9875 | +0.040 | 3.04 | 0.115 | −5.36 | 0.040 | 0.013 | unknown | unknown | yes |
| 19 | fx-weekend-gap-replicate2 (#938) | S1 | forex (other pairs) | R | 588 | +0.179 | 3.01* | 0.118 | 1.02 | 0.179 | 0.060 | unknown | unknown | no |
| 20 | vol-spike-rebound (#860) | 10-day hold | spx500 / nas100 / us30 | % | 165 | +1.063 | 2.99* | 0.164 | 2.53 | 1.063 | 0.352 | unknown | unknown | no |
| 21 | wmr-fix-reversal (#910) | T1 | forex majors | R | 12272 | +0.041 | 2.99 | 0.124 | −6.01 | 0.041 | 0.013 | unknown | unknown | yes |
| 22 | bond-lead-intraday (#926) | T2 | spx500 / nas100 (bond lead) | R | 3846 | +0.083 | 2.89 | 0.199 | −3.98 | 0.083 | 0.025 | unknown | unknown | yes |
| 23 | index-overnight (#891) | T1 | spx500 | R | 2721 | +0.023 | 2.87 | 0.045 | −2.86 | 0.023 | 0.007 | 0.021 | yes | no |
| 24 | index-ibs (#895) | T2 | nas100 | R | 473 | +0.096 | 2.83* | 0.040 | 1.65 | 0.096 | 0.028 | 0.013 | yes | no |
| 25 | turnaround-tuesday (#857) | nas100-r2 | nas100 | R | 81 | +0.114 | 2.72 | 0.016 | 2.33 | 0.114 | 0.032 | unknown | unknown | no |
| 26 | index-midday-turn (#914) | T2 | spx500 / nas100 | R | 2308 | +0.016 | 2.64 | 0.026 | −1.60 | 0.016 | 0.004 | unknown | unknown | yes |
| 27 | bond-lead-intraday (#926) | T3 | spx500 / nas100 (bond lead) | R | 3107 | +0.072 | 2.62 | 0.143 | −2.50 | 0.072 | 0.016 | unknown | unknown | yes |
| 28 | ecb-ref-fix (#921) | T1 | eurusd and crosses | R | 2018 | +0.119 | 2.59 | 0.255 | −2.93 | 0.119 | 0.027 | unknown | unknown | yes |
| 29 | rsi2-pullback (#838) | spx500 | spx500 | % | 99 | +0.402 | 2.55* | 0.084 | 2.02 | 0.402 | 0.087 | 0.062 | yes | no |
| 30 | cb-days-other (#901) | pooled five banks | gbp / cad / chf / aud / nzd | R | 320 | +0.300 | 2.55* | 0.092 | 1.77 | 0.300 | 0.065 | unknown | unknown | no |
| 31 | overnight-drift (#836) | spx500 | spx500 | R | 2722 | +0.016 | 2.47* | 0.025 | −1.39 | 0.016 | 0.003 | unknown | unknown | yes |
| 32 | rsi2-pullback (#838) | us30 | us30 | % | 102 | +0.364 | 2.38* | 0.076 | 1.88 | 0.364 | 0.058 | 0.066 | yes | no |
| 33 | gold-session-drift (#875) | T2 | xau | R | 1063 | +0.040 | 2.37* | 0.017 | 1.37 | 0.040 | 0.006 | unknown | unknown | no |
| 34 | turnaround-replicate (#862) | pooled | indices (6) | R | 411 | +0.072 | 2.34* | 0.020 | 1.69 | 0.072 | 0.011 | unknown | unknown | no |
| 35 | vol-spike-rebound (#860) | 5-day hold | spx500 / nas100 / us30 | % | 216 | +0.588 | 2.32* | 0.091 | 1.96 | 0.588 | 0.081 | unknown | unknown | no |
| 36 | bond-month-end (#939) | USB10Y | usb10y | R | 130 | +0.107 | 2.31 | 0.071 | 0.77 | 0.107 | 0.015 | unknown | unknown | no |
| 37 | eth-btc-ratio (#887) | test 1 | eth / btc | R | 251 | +0.047 | 2.29* | 0.033 | 0.68 | 0.047 | 0.006 | unknown | unknown | no |
| 38 | orb-nas100 (#837) | nas100 | nas100 | R | 1460 | +0.135 | 2.27 | 0.060 | 1.27 | 0.135 | 0.015 | unknown | unknown | no |
| 39 | pre-fomc-drift (#831) | spx500 | spx500 | R | 86 | +0.073 | 2.25 | 0.029 | 1.35 | 0.073 | 0.009 | unknown | unknown | no |
| 40 | orb-nas100 (#837) | spx500 | spx500 | R | 1456 | +0.138 | 2.08 | 0.191 | −0.79 | 0.138 | 0.005 | unknown | unknown | yes |
| 41 | turnaround-tuesday (#857) | nas100-r1 | nas100 | R | 224 | +0.049 | 2.04 | 0.019 | 1.23 | 0.049 | 0.002 | unknown | unknown | no |
| 42 | bond-lead-intraday (#926) | T1 | spx500 / nas100 (bond lead) | R | 3886 | +0.047 | 2.04 | 0.144 | −3.94 | 0.047 | not reached (−0.001) | unknown | unknown | yes |
| 43 | nr7-breakout (#867) | B | indices | R | 2191 | +0.056 | 2.03* | 0.048 | 0.29 | 0.056 | 0.001 | unknown | unknown | no |
| 44 | nr7-breakout (#867) | A | indices | R | 2191 | +0.065 | 1.90* | 0.052 | 0.38 | 0.065 | not reached (−0.003) | unknown | unknown | no |
| 45 | turn-of-month (#826) | nas100 | nas100 | R | 129 | +0.389 | 1.86 | 0.129 | 1.24 | 0.389 | not reached (−0.027) | 0.080 | yes | no |
| 46 | tokyo-fix-daily (#917) | T1 every day | usdjpy | R | 1870 | +0.049 | 1.86* | 0.112 | −2.37 | 0.049 | not reached (−0.004) | unknown | unknown | yes |
| 47 | pre-fomc-gold-usd (#925) | T2 dollar | usd (dxy pairs) | R | 86 | +0.084 | 1.81 | 0.023 | 1.32 | 0.084 | not reached (−0.010) | unknown | unknown | no |
| 48 | index-midday-turn (#914) | T4 | spx500 / nas100 | R | 2329 | +0.011 | 1.79 | 0.036 | −4.07 | 0.011 | not reached (−0.002) | unknown | unknown | yes |
| 49 | index-ibs (#895) | T1 | spx500 | R | 472 | +0.062 | 1.76* | 0.049 | 0.37 | 0.062 | not reached (−0.008) | 0.019 | yes | no |
| 50 | pre-fomc-gold-usd (#925) | T1 gold | xau | R | 86 | +0.098 | 1.75 | 0.028 | 1.26 | 0.098 | not reached (−0.016) | unknown | unknown | no |
| 51 | grain-seasonality (#934) | T2 soybn | soybn | R | 11 | +0.658 | 1.74* | 0.138 | 1.38 | 0.658 | not reached (−0.097) | unknown | unknown | no |
| 52 | soybean-short-robust (#937) | frozen short | soybn | R | 11 | +0.658 | 1.74* | 0.138 | 1.38 | 0.658 | not reached (−0.097) | unknown | unknown | no |
| 53 | risk-spill-jpy (#859) | audjpy | audjpy | R | 725 | +0.074 | 1.69* | 0.063 | 0.25 | 0.074 | not reached (−0.013) | unknown | unknown | no |
| 54 | fx-home-hours (#902) | T1 EUR/USD sell | eurusd | R | 2703 | +0.062 | 1.68 | 0.125 | −1.69 | 0.062 | not reached (−0.012) | 0.054 | yes | no |
| 55 | gold-asia-break (#848) | breakout | xau | R | 1169 | +0.048 | 1.68* | 0.033 | 0.53 | 0.048 | not reached (−0.009) | unknown | unknown | no |
| 56 | cnh-fix (#927) | T1 | usdcnh | R | 1667 | +0.107 | 1.66 | 0.655 | −7.65 | 0.107 | not reached (−0.034) | unknown | unknown | yes |
| 57 | gold-haven-shock (#905) | T3 | xau | R | 93 | +0.253 | 1.65* | 0.072 | 1.18 | 0.253 | not reached (−0.053) | unknown | unknown | no |
| 58 | rsi2-replicate (#844) | pooled | indices (6 non-US) | R | 521 | +0.052 | 1.64* | 0.025 | 0.85 | 0.052 | not reached (−0.011) | unknown | unknown | no |
| 59 | rsi2-pullback (#838) | nas100 | nas100 | % | 99 | +0.382 | 1.62* | 0.090 | 1.24 | 0.382 | not reached (−0.089) | 0.065 | yes | no |
| 60 | gold-session-drift (#875) | T3 | xau | R | 683 | +0.027 | 1.62* | 0.011 | 0.96 | 0.027 | not reached (−0.006) | unknown | unknown | no |
| 61 | overnight-drift (#836) | us30 | us30 | R | 2722 | +0.011 | 1.58* | 0.021 | −1.44 | 0.011 | not reached (−0.003) | unknown | unknown | yes |
| 62 | crypto-hour (#842) | test 3 | btc | R | 1035 | +0.021 | 1.54* | 0.037 | −1.20 | 0.021 | not reached (−0.006) | unknown | unknown | yes |
| 63 | vol-spike-replicate (#920) | R1 | de40 / uk100 / eu50 / ... | % | 278 | +0.827 | 1.52* | 0.175 | 1.20 | 0.827 | not reached (−0.260) | unknown | unknown | no |
| 64 | turnaround-tuesday (#857) | spx500-r1 | spx500 | R | 237 | +0.036 | 1.50 | 0.023 | 0.54 | 0.036 | not reached (−0.012) | unknown | unknown | no |
| 65 | fx-home-hours (#902) | T3 GBP/USD sell | gbpusd | R | 2703 | +0.055 | 1.47 | 0.098 | −1.17 | 0.055 | not reached (−0.019) | 0.048 | yes | no |
| 66 | commodity-fx-lead (#899) | T2 | audusd / usdcad | R | 375 | +0.051 | 1.38* | 0.018 | 0.89 | 0.051 | not reached (−0.023) | unknown | unknown | no |
| 67 | index-ibs (#895) | T3 | us30 | R | 469 | +0.049 | 1.38* | 0.060 | −0.31 | 0.049 | not reached (−0.022) | 0.019 | yes | no |
| 68 | tsmom (#892) | T3 | multi-asset | R | 390 | +0.140 | 1.37* | 0.220 | −0.78 | 0.140 | not reached (−0.065) | unknown | unknown | yes |
| 69 | turnaround-tuesday (#857) | spx500-r2 | spx500 | R | 51 | +0.086 | 1.36 | 0.017 | 1.10 | 0.086 | not reached (−0.045) | unknown | unknown | no |
| 70 | crypto-hour (#842) | test 4 | btc | R | 1035 | +0.018 | 1.31* | 0.025 | −0.50 | 0.018 | not reached (−0.010) | unknown | unknown | yes |
| 71 | crypto-weekend (#852) | test 2 | btc / eth | R | 147 | +0.133 | 1.30* | 0.071 | 0.61 | 0.133 | not reached (−0.072) | unknown | unknown | no |
| 72 | bond-month-end (#939) | USB30Y | usb30y | R | 130 | +0.061 | 1.28 | 0.046 | 0.32 | 0.061 | not reached (−0.035) | unknown | unknown | no |
| 73 | tsmom (#892) | T2 | multi-asset | R | 910 | +0.078 | 1.16* | 0.105 | −0.39 | 0.078 | not reached (−0.057) | unknown | unknown | yes |
| 74 | eth-btc-ratio (#887) | test 2 | eth / btc | R | 251 | +0.060 | 1.16* | 0.042 | 0.35 | 0.060 | not reached (−0.043) | unknown | unknown | no |
| 75 | gold-haven-shock (#905) | T2 | xau | R | 92 | +0.180 | 1.13* | 0.072 | 0.68 | 0.180 | not reached (−0.137) | unknown | unknown | no |
| 76 | cpi-follow (#871) | fade-11:00 | xau / nas100 | R an event | 81 | +0.056 | 1.12 | 0.055 | 0.02 | 0.056 | not reached (−0.044) | unknown | unknown | no |
| 77 | gold-haven-shock (#905) | T1 | xau | R | 110 | +0.085 | 1.11* | 0.028 | 0.74 | 0.085 | not reached (−0.068) | unknown | unknown | no |
| 78 | opex-week (#882) | T3 | spx500 | R | 130 | +0.059 | 1.11 | 0.033 | 0.50 | 0.059 | not reached (−0.049) | unknown | unknown | no |
| 79 | gold-week-raid (#843) | R3 | xau | R | 235 | +0.234 | 1.10* | 0.072 | 0.76 | 0.234 | not reached (−0.192) | unknown | unknown | no |
| 80 | audnzd-revert (#840) | variant 2 | audnzd | R | 48 | +0.150 | 1.06* | 0.089 | 0.43 | 0.150 | not reached (−0.134) | unknown | unknown | no |
| 81 | cnh-fix (#927) | T3 | usdcnh | R | 1664 | +0.069 | 1.06 | 0.379 | −4.72 | 0.069 | not reached (−0.062) | unknown | unknown | yes |
| 82 | gold-week-raid (#843) | R2 | xau | R | 190 | +0.181 | 1.00* | 0.065 | 0.64 | 0.181 | not reached (−0.181) | unknown | unknown | no |
| 83 | last-hour (#872) | follow | spx500 / nas100 | R | 2664 | +0.008 | 0.88 | 0.073 | −4.33 | 0.008 | not reached (−0.020) | unknown | unknown | yes |
| 84 | tsmom (#892) | T1 | multi-asset | R | 3250 | +0.033 | 0.87* | 0.089 | −1.44 | 0.033 | not reached (−0.044) | unknown | unknown | yes |
| 85 | crypto-hour (#842) | test 1 | btc | R | 1035 | +0.008 | 0.87* | 0.071 | −7.24 | 0.008 | not reached (−0.010) | unknown | unknown | yes |
| 86 | grain-seasonality (#934) | T1 corn | corn | R | 11 | +0.226 | 0.86* | 0.105 | 0.46 | 0.226 | not reached (−0.302) | unknown | unknown | no |
| 87 | crypto-reversal (#866) | day7-sma200 | btc / eth | R | 23 | +0.150 | 0.86* | 0.028 | 0.70 | 0.150 | not reached (−0.201) | unknown | unknown | no |
| 88 | yield-fx-weekly (#942) | T1 USD/JPY | usdjpy | R | 301 | +0.036 | 0.82 | 0.017 | 0.43 | 0.036 | not reached (−0.051) | unknown | unknown | no |
| 89 | nfp-follow (#863) | R-xau | xau | R | 40 | +0.152 | 0.81* | 0.056 | 0.51 | 0.152 | not reached (−0.223) | unknown | unknown | no |
| 90 | fx-month-end (#846) | variant | forex majors | R | 72 | +0.093 | 0.80 | 0.078 | 0.13 | 0.093 | not reached (−0.139) | unknown | unknown | no |
| 91 | shadow-best-raw (#821) | rintra xau | xau | R | 424 | +0.074 | 0.74* | 0.026 | 0.49 | 0.074 | not reached (−0.126) | unknown | unknown | no |
| 92 | turn-of-month (#826) | us30 | us30 | R | 129 | +0.107 | 0.70 | 0.129 | −0.14 | 0.107 | not reached (−0.200) | 0.080 | yes | no |
| 93 | shadow-best-raw (#821) | rintra gbpusd | gbpusd | R | 446 | +0.042 | 0.70* | 0.085 | −0.71 | 0.042 | not reached (−0.078) | unknown | unknown | yes |
| 94 | wmr-fix-reversal (#910) | T2 | forex majors | R | 2049 | +0.016 | 0.67 | 0.137 | −5.17 | 0.016 | not reached (−0.031) | unknown | unknown | yes |
| 95 | shadow-best-raw (#821) | rscalp usdcad | usdcad | R | 1967 | +0.022 | 0.65* | 0.200 | −5.27 | 0.022 | not reached (−0.046) | unknown | unknown | yes |
| 96 | turn-of-month (#826) | spx500 | spx500 | R | 129 | +0.102 | 0.63 | 0.117 | −0.10 | 0.102 | not reached (−0.218) | 0.079 | yes | no |
| 97 | rebalance-flow (#865) | A | spx500 | R | 93 | +0.032 | 0.61 | 0.019 | 0.24 | 0.032 | not reached (−0.071) | unknown | unknown | no |
| 98 | gold-session-drift (#875) | T1 | xau | R | 1718 | +0.007 | 0.60* | 0.010 | −0.27 | 0.007 | not reached (−0.017) | unknown | unknown | yes |
| 99 | oil-wednesday (#858) | follow | wtico | R | 306 | +0.056 | 0.59 | 0.068 | −0.13 | 0.056 | not reached (−0.134) | unknown | unknown | yes |
| 100 | ecb-ref-fix (#921) | T3 | eurusd and crosses | R | 6127 | +0.015 | 0.58 | 0.311 | −11.21 | 0.015 | not reached (−0.038) | unknown | unknown | yes |
| 101 | opex-week (#882) | T1 | spx500 | R | 130 | +0.028 | 0.54 | 0.044 | −0.32 | 0.028 | not reached (−0.074) | unknown | unknown | yes |
| 102 | oil-wednesday (#858) | fade | wtico | R | 304 | +0.243 | 0.53 | 0.339 | −0.21 | 0.243 | not reached (−0.672) | unknown | unknown | yes |
| 103 | shadow-best-raw (#821) | scalp xau | xau | R | 3310 | +0.022 | 0.53* | 0.050 | −0.69 | 0.022 | not reached (−0.060) | unknown | unknown | yes |
| 104 | gold-us-asia (#923) | T1 | xau | R | 1928 | +0.004 | 0.50 | 0.014 | −1.42 | 0.004 | not reached (−0.011) | unknown | unknown | yes |
| 105 | brent-wti-spread (#933) | base | bco / wtico | R | 87 | +0.060 | 0.43* | 0.259 | −1.42 | 0.060 | not reached (−0.220) | unknown | unknown | yes |
| 106 | rebalance-flow (#865) | C | spx500 | R | 93 | +0.022 | 0.39 | 0.016 | 0.11 | 0.022 | not reached (−0.092) | unknown | unknown | no |
| 107 | yield-fx-weekly (#942) | T3 EUR/USD | eurusd | R | 301 | +0.016 | 0.39 | 0.013 | 0.07 | 0.016 | not reached (−0.065) | unknown | unknown | no |
| 108 | shadow-best-raw (#821) | rintra xrp | xrp | R | 421 | +0.022 | 0.38* | 0.056 | −0.58 | 0.022 | not reached (−0.094) | unknown | unknown | yes |
| 109 | ibs-replicate (#924) | R1 pooled | indices (7 non-US) | R | 3543 | +0.008 | 0.38* | 0.049 | −1.97 | 0.008 | not reached (−0.034) | unknown | unknown | yes |
| 110 | commodity-fx-lead (#899) | T1 | audusd / usdcad | R | 366 | +0.011 | 0.37* | 0.021 | −0.29 | 0.011 | not reached (−0.050) | unknown | unknown | yes |
| 111 | chf-haven (#930) | T1 | chf pairs | R | 74 | +0.032 | 0.33* | 0.078 | −0.48 | 0.032 | not reached (−0.163) | unknown | unknown | yes |
| 112 | shadow-best-raw (#821) | rscalp gbpusd | gbpusd | R | 1991 | +0.015 | 0.33* | 0.172 | −3.52 | 0.015 | not reached (−0.074) | unknown | unknown | yes |
| 113 | index-spread-momentum (#884) | pooled | index spreads | R | 244 | +0.022 | 0.32* | 0.129 | −1.56 | 0.022 | not reached (−0.115) | unknown | unknown | yes |
| 114 | fx-tokyo-orb (#929) | T3 NZD/USD | nzdusd | R | 585 | +0.008 | 0.32 | 0.078 | −2.63 | 0.008 | not reached (−0.045) | unknown | unknown | yes |
| 115 | tsmom (#892) | T5 | multi-asset | R | 910 | +0.019 | 0.29* | 0.042 | −0.36 | 0.019 | not reached (−0.111) | unknown | unknown | yes |
| 116 | eu-gap-fade (#916) | T2 UK100 + EU50 | uk100 / eu50 | R | 4010 | +0.002 | 0.23 | 0.033 | −3.18 | 0.002 | not reached (−0.017) | unknown | unknown | yes |
| 117 | gold-us-asia (#923) | T3 | xau | R | 898 | +0.003 | 0.22 | 0.014 | −0.93 | 0.003 | not reached (−0.022) | unknown | unknown | yes |
| 118 | yield-fx-weekly (#942) | T2 USD/CHF | usdchf | R | 301 | +0.009 | 0.20 | 0.024 | −0.36 | 0.009 | not reached (−0.077) | unknown | unknown | yes |
| 119 | shadow-best-raw (#821) | intraday audusd | audusd | R | 850 | +0.013 | 0.19* | 0.060 | −0.69 | 0.013 | not reached (−0.125) | unknown | unknown | yes |
| 120 | intraday-momentum (#835) | nas100 | nas100 | R | 2682 | +0.003 | 0.19 | 0.096 | −5.45 | 0.003 | not reached (−0.031) | unknown | unknown | yes |
| 121 | bond-fomc-drift (#906) | T1 USB10Y | usb10y | R | 79 | +0.013 | 0.16 | 0.180 | −2.09 | 0.013 | not reached (−0.147) | unknown | unknown | yes |
| 122 | fx-london-orb (#868) | FADE | eurusd / gbpusd | R | 9739 | +0.002 | 0.08 | 0.810 | −22.00 | 0.002 | not reached (−0.071) | unknown | unknown | yes |
| 123 | gap-fill (#849) | nas100 against | nas100 | R | 431 | +0.002 | 0.06 | 0.043 | −0.94 | 0.002 | not reached (−0.084) | unknown | unknown | yes |
| 124 | fx-home-hours (#902) | T2 USD/JPY buy | usdjpy | R | 2701 | +0.001 | 0.06 | 0.080 | −3.46 | 0.001 | not reached (−0.044) | unknown | unknown | yes |
| 125 | shadow-best-raw (#821) | intraday eth | eth | R | 751 | +0.003 | 0.04* | 0.043 | −0.49 | 0.003 | not reached (−0.161) | unknown | unknown | yes |
| 126 | fx-reversal (#834) | reversal | forex | % a week | 566 | +0.001 | 0.03 | 0.034 | −1.60 | 0.001 | not reached (−0.042) | unknown | unknown | yes |
| 127 | crypto-hour (#842) | test 2 | btc | R | 1035 | +0.000 | 0.02* | 0.048 | −4.98 | 0.000 | not reached (−0.019) | unknown | unknown | yes |
| 128 | crypto-weekend (#852) | test 1 | btc / eth | R | 147 | +0.099 | —* | 0.098 | 0.00 | 0.099 | — | unknown | unknown | no |
| 129 | fx-weekend-gap (#880) | H | forex majors | R | 222 | +0.096 | —* | 0.110 | −0.16 | 0.096 | — | unknown | unknown | yes |
| 130 | gold-asia-break (#848) | fade | xau | R | 484 | +0.095 | —* | 0.107 | −0.14 | 0.095 | — | unknown | unknown | yes |
| 131 | fx-weekend-gap-replicate (#928) | R2 | forex (other pairs) | R | 297 | +0.088 | —* | 0.086 | 0.03 | 0.088 | — | unknown | unknown | no |
| 132 | gold-week-raid (#843) | R1 | xau | R | 233 | +0.048 | —* | 0.062 | −0.09 | 0.048 | — | unknown | unknown | yes |
| 133 | shadow-best-raw (#821) | intraday xau | xau | R | 725 | +0.024 | —* | 0.029 | −0.07 | 0.024 | — | unknown | unknown | yes |
| 134 | crypto-weekend-reversal (#890) | T1-BTC | BTC | R | 19 | +0.003 | —* | 0.019 | −0.08 | 0.003 | — | unknown | unknown | yes |

Units: R = R a trade; % = % of price a trade; "R a month" / "% a week" / "R an event" = the study's own book unit (the floors are in the same unit). "Fits on the demo?" = gross minus the measured demo cost above zero; "unknown" = the demo does not quote the instrument, or the study stored no stop size to convert the cost to R.

## Reading for the owner

**Blocked only by cost (gross t ≥ 2, net t under 2): 31 tests.** overnight-drift nas100 (#836): gross +0.021 R (t 4.20), charged 0.020, break-even 0.021, t-2 cost 0.011, demo cost unknown; gotobi T1 (#878): gross +0.158 R (t 4.12), charged 0.123, break-even 0.158, t-2 cost 0.082, demo cost unknown; wmr-fix-reversal T3 (#910): gross +0.044 R (t 3.87), charged 0.124, break-even 0.044, t-2 cost 0.021, demo cost unknown; cnh-fix T2 (#927): gross +0.248 R (t 3.78), charged 0.654, break-even 0.248, t-2 cost 0.108, demo cost unknown; fx-london-orb F1 (#868): gross +0.080 R (t 3.74), charged 0.130, break-even 0.080, t-2 cost 0.037, demo cost unknown; gotobi T4 (#878): gross +0.202 R (t 3.64), charged 0.100, break-even 0.202, t-2 cost 0.091, demo cost unknown; index-overnight T2 (#891): gross +0.026 R (t 3.54), charged 0.032, break-even 0.026, t-2 cost 0.011, measured demo 0.014 (fits, t 1.67 at that cost); futures route (index-futures-cost): net +0.015 t 2.02; ecb-ref-fix T2 (#921): gross +0.131 R (t 3.08), charged 0.255, break-even 0.131, t-2 cost 0.045, demo cost unknown; fx-london-orb F2 (#868): gross +0.040 R (t 3.04), charged 0.115, break-even 0.040, t-2 cost 0.013, demo cost unknown; fx-weekend-gap-replicate2 S1 (#938): gross +0.179 R (t 3.01), charged 0.118, break-even 0.179, t-2 cost 0.060, demo cost unknown; wmr-fix-reversal T1 (#910): gross +0.041 R (t 2.99), charged 0.124, break-even 0.041, t-2 cost 0.013, demo cost unknown; bond-lead-intraday T2 (#926): gross +0.083 R (t 2.89), charged 0.199, break-even 0.083, t-2 cost 0.025, demo cost unknown; index-overnight T1 (#891): gross +0.023 R (t 2.87), charged 0.045, break-even 0.023, t-2 cost 0.007, measured demo 0.021 (fits, t 0.20 at that cost); futures route (index-futures-cost): net +0.001 t 0.08; index-ibs T2 (#895): gross +0.096 R (t 2.83), charged 0.040, break-even 0.096, t-2 cost 0.028, measured demo 0.013 (fits, t 2.46 at that cost); futures route (index-futures-cost): net +0.086 t 2.56; index-midday-turn T2 (#914): gross +0.016 R (t 2.64), charged 0.026, break-even 0.016, t-2 cost 0.004, demo cost unknown; bond-lead-intraday T3 (#926): gross +0.072 R (t 2.62), charged 0.143, break-even 0.072, t-2 cost 0.016, demo cost unknown; ecb-ref-fix T1 (#921): gross +0.119 R (t 2.59), charged 0.255, break-even 0.119, t-2 cost 0.027, demo cost unknown; cb-days-other pooled five banks (#901): gross +0.300 R (t 2.55), charged 0.092, break-even 0.300, t-2 cost 0.065, demo cost unknown; overnight-drift spx500 (#836): gross +0.016 R (t 2.47), charged 0.025, break-even 0.016, t-2 cost 0.003, demo cost unknown; rsi2-pullback us30 (#838): gross +0.364 % (t 2.38), charged 0.076, break-even 0.364, t-2 cost 0.058, measured demo 0.066 (fits, t 1.94 at that cost); gold-session-drift T2 (#875): gross +0.040 R (t 2.37), charged 0.017, break-even 0.040, t-2 cost 0.006, demo cost unknown; turnaround-replicate pooled (#862): gross +0.072 R (t 2.34), charged 0.020, break-even 0.072, t-2 cost 0.011, demo cost unknown; vol-spike-rebound 5-day hold (#860): gross +0.588 % (t 2.32), charged 0.091, break-even 0.588, t-2 cost 0.081, demo cost unknown; bond-month-end USB10Y (#939): gross +0.107 R (t 2.31), charged 0.071, break-even 0.107, t-2 cost 0.015, demo cost unknown; futures route (bond-month-end-futures): net +0.088 t 1.91; eth-btc-ratio test 1 (#887): gross +0.047 R (t 2.29), charged 0.033, break-even 0.047, t-2 cost 0.006, demo cost unknown; orb-nas100 nas100 (#837): gross +0.135 R (t 2.27), charged 0.060, break-even 0.135, t-2 cost 0.015, demo cost unknown; pre-fomc-drift spx500 (#831): gross +0.073 R (t 2.25), charged 0.029, break-even 0.073, t-2 cost 0.009, demo cost unknown; orb-nas100 spx500 (#837): gross +0.138 R (t 2.08), charged 0.191, break-even 0.138, t-2 cost 0.005, demo cost unknown; turnaround-tuesday nas100-r1 (#857): gross +0.049 R (t 2.04), charged 0.019, break-even 0.049, t-2 cost 0.002, demo cost unknown; bond-lead-intraday T1 (#926): gross +0.047 R (t 2.04), charged 0.144, break-even 0.047, t-2 cost not reached, demo cost unknown; nr7-breakout B (#867): gross +0.056 R (t 2.03), charged 0.048, break-even 0.056, t-2 cost 0.001, demo cost unknown.

These effects are present before costs and the costs each study charged take them away. A cheaper route only helps where it cuts the cost below the t-2 cost: for 22 of these 31 the t-2 cost is under half of what was charged (the route would have to cost less than half as much), and 1 of them does not reach t 2 even at zero cost by this rule. Each gross t was measured once, before any correction for the many tests of these two days (the multiple-testing recount is separate work).

**Net t ≥ 2 at the cost the study charged: 12 tests.** fx-weekend-gap-replicate2 S2 (#938) (net +0.153, t 3.19, headroom 0.153 over the charged cost; demo cost unknown); gotobi-replicate R1 crosses pooled (#889) (net +0.099, t 2.75, headroom 0.099 over the charged cost; demo cost unknown); gotobi-replicate R2 USD/JPY 2005-09 (#889) (net +0.261, t 3.80, headroom 0.261 over the charged cost; demo cost unknown); gotobi T3 (#878) (net +0.095, t 2.20, headroom 0.095 over the charged cost; demo cost unknown); gotobi T2 (#878) (net +0.148, t 2.74, headroom 0.148 over the charged cost; demo cost unknown); fx-weekend-gap-replicate R1 (#928) (net +0.238, t 2.99, headroom 0.238 over the charged cost; demo cost unknown); gotobi-feed HistData USD/JPY (#894) (net +0.127, t 2.34, headroom 0.127 over the charged cost; demo cost unknown); gotobi-minute-histdata gotobi T2 on M1 (#912) (net +0.127, t 2.34, headroom 0.127 over the charged cost; demo cost unknown); fx-weekend-gap G (#880) (net +0.194, t 2.14, headroom 0.194 over the charged cost; demo cost unknown); vol-spike-rebound 10-day hold (#860) (net +0.899, t 2.53, headroom 0.899 over the charged cost; demo cost unknown); turnaround-tuesday nas100-r2 (#857) (net +0.098, t 2.33, headroom 0.098 over the charged cost; demo cost unknown); rsi2-pullback spx500 (#838) (net +0.318, t 2.02, headroom 0.318 over the charged cost; demo yes). Each study's own verdict stands (none was called an edge: they failed other pre-registered checks such as the other window, Holm, or a placebo); the floors only say how much cost they could carry.

**Fits on the demo at its measured cost: 13 of the 134 positive-gross tests** (0 do not, 121 unknown). index-overnight T2 (#891) (gross +0.026, demo 0.014, t at that cost 1.67); index-overnight T1 (#891) (gross +0.023, demo 0.021, t at that cost 0.20); index-ibs T2 (#895) (gross +0.096, demo 0.013, t at that cost 2.46); rsi2-pullback spx500 (#838) (gross +0.402, demo 0.062, t at that cost 2.16); rsi2-pullback us30 (#838) (gross +0.364, demo 0.066, t at that cost 1.94); turn-of-month nas100 (#826) (gross +0.389, demo 0.080, t at that cost 1.49); index-ibs T1 (#895) (gross +0.062, demo 0.019, t at that cost 1.22); fx-home-hours T1 EUR/USD sell (#902) (gross +0.062, demo 0.054, t at that cost 0.23); rsi2-pullback nas100 (#838) (gross +0.382, demo 0.065, t at that cost 1.35); fx-home-hours T3 GBP/USD sell (#902) (gross +0.055, demo 0.048, t at that cost 0.19); index-ibs T3 (#895) (gross +0.049, demo 0.019, t at that cost 0.83); turn-of-month us30 (#826) (gross +0.107, demo 0.080, t at that cost 0.17); turn-of-month spx500 (#826) (gross +0.102, demo 0.079, t at that cost 0.15). "Fits" means the mean stays above zero at the measured spread and commission; it says nothing about t, and the demo figure has no slippage in it.

**Net t at least 2 at the measured demo cost: 2 tests** (index-ibs T2 (#895), t 2.46; rsi2-pullback spx500 (#838), t 2.16). Read with care: the demo spread is one day of quotes, no slippage is in it, and each study's own verdict (FAIL or not proven) stands for reasons beyond cost.

**Unproven at any cost (gross positive but gross t under 2): 91 tests.** A cheaper route cannot make these proven: even at zero cost their t is under 2. nr7-breakout A (#867), turn-of-month nas100 (#826), tokyo-fix-daily T1 every day (#917), pre-fomc-gold-usd T2 dollar (#925), index-midday-turn T4 (#914), index-ibs T1 (#895), pre-fomc-gold-usd T1 gold (#925), grain-seasonality T2 soybn (#934), soybean-short-robust frozen short (#937), risk-spill-jpy audjpy (#859), fx-home-hours T1 EUR/USD sell (#902), gold-asia-break breakout (#848), cnh-fix T1 (#927), gold-haven-shock T3 (#905), rsi2-replicate pooled (#844), rsi2-pullback nas100 (#838), gold-session-drift T3 (#875), overnight-drift us30 (#836), crypto-hour test 3 (#842), vol-spike-replicate R1 (#920), turnaround-tuesday spx500-r1 (#857), fx-home-hours T3 GBP/USD sell (#902), commodity-fx-lead T2 (#899), index-ibs T3 (#895), tsmom T3 (#892), turnaround-tuesday spx500-r2 (#857), crypto-hour test 4 (#842), crypto-weekend test 2 (#852), bond-month-end USB30Y (#939), tsmom T2 (#892), eth-btc-ratio test 2 (#887), gold-haven-shock T2 (#905), cpi-follow fade-11:00 (#871), gold-haven-shock T1 (#905), opex-week T3 (#882), gold-week-raid R3 (#843), audnzd-revert variant 2 (#840), cnh-fix T3 (#927), gold-week-raid R2 (#843), last-hour follow (#872), ….

**No gross effect (gross zero or negative): 95 tests.** Cost is not what stops them: shadow-best-raw rscalp xau, shadow-best-raw scalp eurusd, shadow-best-raw intraday eurusd, shadow-best-raw rscalp eurusd, shadow-best-raw rintra eurusd, shadow-best-raw scalp gbpusd, shadow-best-raw intraday gbpusd, shadow-best-raw scalp audusd, shadow-best-raw rscalp audusd, shadow-best-raw rintra audusd, shadow-best-raw scalp usdcad, shadow-best-raw intraday usdcad, shadow-best-raw rintra usdcad, shadow-best-raw scalp usdchf, shadow-best-raw intraday usdchf, shadow-best-raw rscalp usdchf, shadow-best-raw rintra usdchf, shadow-best-raw intraday btc, shadow-best-raw rintra btc, shadow-best-raw rintra eth, shadow-best-raw intraday sol, shadow-best-raw rintra sol, shadow-best-raw intraday xrp, intraday-momentum spx500, audnzd-revert variant 1, audnzd-revert variant 3, fx-month-end base, gap-fill nas100 all, gap-fill spx500 all, gap-fill spx500 against, crypto-weekend test 3, crypto-weekend test 4, risk-spill-jpy usdjpy, nfp-follow F-xau, nfp-follow F-nas100, nfp-follow R-nas100, gold-weekend-gap G, gold-weekend-gap H, rebalance-flow B, rebalance-flow D, crypto-reversal day3, crypto-reversal day3-sma200, crypto-reversal day7, gold-silver-divergence fade, gold-silver-divergence follow, cpi-follow follow-16:00, cpi-follow follow-11:00, cpi-follow fade-16:00, last-hour fade, metals-rsi2 pooled, fx-cycle exit A, fx-cycle exit B, index-pair pair 1, index-pair pair 2, opex-week T2, opex-week T4, london-fix T1, london-fix T2, crypto-cycle exit A, crypto-cycle exit B, crypto-weekend-reversal T1-ETH, crypto-weekend-reversal T2-BTC, crypto-weekend-reversal T2-ETH, crypto-weekend-reversal POOL, tsmom T4, index-weekend-gap T1, index-weekend-gap T2, index-weekend-gap T3, index-weekend-gap P, fx-home-hours T4 AUD/USD sell, bond-fomc-drift T2 USB30Y, us-asia-lead T1 JP225, us-asia-lead T2 JP225 strong US days, us-asia-lead T3 HK33, index-midday-turn T1, index-midday-turn T3, eu-gap-fade T1 DE40, eu-gap-fade T3 DE40 US-led gaps, vol-spike-replicate R2, gold-us-asia T2, fx-tokyo-orb T1 USD/JPY, fx-tokyo-orb T2 AUD/USD, chf-haven T2, chf-haven T3, fx-round-numbers T1, fx-round-numbers T2, metals-intraday-momentum gold, metals-intraday-momentum silver, metals-intraday-momentum WTI, grain-seasonality T3 wheat, commodity-xs-momentum book, jp-fiscal-yearend T1, jp-fiscal-yearend T2, fx-weekly-reversal primary, index-long-reversal main.

**Yen (gotobi T2, the strongest yen row).** The demo quotes no yen pair, so its cost there is unknown. The committed gotobi-cost study (#893) put the break-even at 3.73 pips a round trip and net month t 2 at 1.951 pips; the published average USD/JPY spread it cites is 0.08 pips (its sources: web search summaries of 14 Nov 2026, pages not opened). That study, not this one, is the place to read the yen route.

**Futures.** Only figures a committed cost study computed for the same trades are shown: index-futures-cost (#900, CME micro index futures; its own sources) for index-overnight, index-ibs and turn-of-month, and bond-month-end-futures (#943, Treasury futures) for bond-month-end. For any other row a futures contract may exist (from memory, not opened) but its cost was not measured here and carries no number.

## Caveats

- The constant-cost assumption moves the t in proportion to the mean. On a month-sum t (most studies judged on months) it is an approximation: months hold different numbers of trades. A cost in R also depends on each trade's stop.
- Every gross t above is a single, uncorrected test among the many of these two days. "Blocked only by cost" is a statement about cost, not evidence of an edge.
- Financing is part of "cost charged" (the demo charges a swap too); the demo figure adds the study's own financing only where the study stored it apart from the spread.

## Could not be read

- cycle-gate (#815) gtrend G2: no gross mean stored on the decisive object
- cycle-gate (#815) gtrend G1: decisive figure only in tests.1.welch.t
- cycle-gate (#815) gtrend G3: no gross mean stored on the decisive object
- cycle-gate (#815) geg G2: no gross mean stored on the decisive object
- cycle-gate (#815) geg G1: no gross mean stored on the decisive object
- cycle-gate (#815) geg G3: no gross mean stored on the decisive object
- cycle-gate (#815) gtrend5 G2: no gross mean stored on the decisive object
- cycle-gate (#815) gtrend5 G1: decisive figure only in tests.7.welch.t
- cycle-gate (#815) gtrend5 G3: no gross mean stored on the decisive object
- cycle-gate (#815) gtl G2: no gross mean stored on the decisive object
- cycle-gate (#815) gtl G1: no gross mean stored on the decisive object
- cycle-gate (#815) gtl G3: no gross mean stored on the decisive object
- cycle-gate (#815) gmp G2: no gross mean stored on the decisive object
- cycle-gate (#815) gmp G1: no gross mean stored on the decisive object
- cycle-gate (#815) gmp G3: no gross mean stored on the decisive object
- cycle-gate (#815) replica G2: no gross mean stored on the decisive object
- cycle-gate (#815) replica G1: no gross mean stored on the decisive object
- cycle-gate (#815) replica G3: no gross mean stored on the decisive object
- cycle-gate (#815) mosha-bo G2: no gross mean stored on the decisive object
- cycle-gate (#815) mosha-bo G1: no gross mean stored on the decisive object
- cycle-gate (#815) mosha-bo G3: no gross mean stored on the decisive object
- cycle-gate (#815) scalp G2: no gross mean stored on the decisive object
- cycle-gate (#815) scalp G1: no gross mean stored on the decisive object
- cycle-gate (#815) scalp G3: no gross mean stored on the decisive object
- cycle-gate (#815) intraday G2: no gross mean stored on the decisive object
- cycle-gate (#815) intraday G1: no gross mean stored on the decisive object
- cycle-gate (#815) intraday G3: no gross mean stored on the decisive object
- cycle-gate (#815) rscalp G2: no gross mean stored on the decisive object
- cycle-gate (#815) rscalp G1: no gross mean stored on the decisive object
- cycle-gate (#815) rscalp G3: no gross mean stored on the decisive object
- cycle-gate (#815) rintra G2: no gross mean stored on the decisive object
- cycle-gate (#815) rintra G1: no gross mean stored on the decisive object
- cycle-gate (#815) rintra G3: no gross mean stored on the decisive object
- drd-metals-book (#816) T1: no gross mean stored on the decisive object
- drd-metals-book (#816) T2: no gross mean stored on the decisive object
- drd-metals-book (#816) T3: no gross mean stored on the decisive object
- ict-quarters (#817) T1 week: no gross mean stored on the decisive object
- ict-quarters (#817) T2 month: no gross mean stored on the decisive object
- ict-quarters (#817) T3 year: no gross mean stored on the decisive object
- mcycle-base (#818) combined: no gross mean stored on the decisive object
- mosha-bo-er (#819) A ER20 filter: no gross mean stored on the decisive object
- mosha-bo-er (#819) B market entry: no gross mean stored on the decisive object
- tl-third-touch (#820) T1 trendline: no gross mean stored on the decisive object
- tl-third-touch (#820) T2 vs control: no gross mean stored on the decisive object
- engulf-ladder (#822) T1 ladder: no gross mean stored on the decisive object
- engulf-ladder (#822) T2 sideways vs momentum: no gross mean stored on the decisive object
- engulf-ladder (#822) T3 50% vs edge: no gross mean stored on the decisive object
- gold-tsmom (#823) long/short: monthly % returns; gross not stored apart from cost (costPct and finPct are sums over the window)
- gold-tsmom (#823) long/flat: monthly % returns; gross not stored apart from cost (costPct and finPct are sums over the window)
- ict-book-risk (#824) R1: decisive test stored as a p or bootstrap probability, no gross / net stream
- ict-book-risk (#824) R2: decisive test stored as a p or bootstrap probability, no gross / net stream
- ict-book-risk (#824) R3: decisive test stored as a p or bootstrap probability, no gross / net stream
- ict-book-risk (#824) R4: decisive test stored as a p or bootstrap probability, no gross / net stream
- swing-day3 (#825) T1: no gross mean stored on the decisive object
- swing-day3 (#825) T2: decisive test stored as a p or bootstrap probability, no gross / net stream
- swing-day3 (#825) T3: decisive test stored as a p or bootstrap probability, no gross / net stream
- tsmom-portfolio (#828) book: no gross mean stored on the decisive object
- gold-silver-ratio (#829) ratio fade: no gross mean stored on the decisive object
- fx-carry (#830) T1: no gross mean stored on the decisive object
- fx-carry (#830) T2: no gross mean stored on the decisive object
- crypto-weekly-mom (#833) V1 long/flat: no gross mean stored on the decisive object
- crypto-weekly-mom (#833) V2 long/short: no gross mean stored on the decisive object
- vol-managed (#839) V c/variance: decisive test stored as a p or bootstrap probability, no gross / net stream
- vol-managed (#839) S c/volatility: decisive test stored as a p or bootstrap probability, no gross / net stream
- sma10-timing (#841) book: decisive test stored as a p or bootstrap probability, no gross / net stream
- pre-holiday (#845) T1 pooled: no gross mean stored on the decisive object
- pre-holiday (#845) T4 vs ordinary days: no gross mean stored on the decisive object
- gold-shock-revert (#850) revert: no gross mean stored on the decisive object
- gold-shock-revert (#850) continue: no gross mean stored on the decisive object
- sell-in-may (#851) pooled: no gross mean stored on the decisive object
- high52-rotation (#853) excess: no gross mean stored on the decisive object
- copper-gold (#854) equal weight: no gross mean stored on the decisive object
- dual-momentum (#855) L12: decisive test stored as a p or bootstrap probability, no gross / net stream
- dual-momentum (#855) L6: decisive test stored as a p or bootstrap probability, no gross / net stream
- crypto-sma200 (#856) btc-sma200: decisive test stored as a p or bootstrap probability, no gross / net stream
- crypto-sma200 (#856) btc-sma100: decisive test stored as a p or bootstrap probability, no gross / net stream
- crypto-sma200 (#856) eth-sma200: decisive test stored as a p or bootstrap probability, no gross / net stream
- crypto-sma200 (#856) eth-sma100: decisive test stored as a p or bootstrap probability, no gross / net stream
- fomc-follow (#861) nas100 F: no gross mean stored on the decisive object
- fomc-follow (#861) nas100 R: no gross mean stored on the decisive object
- fomc-follow (#861) spx500 F: no gross mean stored on the decisive object
- fomc-follow (#861) spx500 R: no gross mean stored on the decisive object
- fomc-follow (#861) xau F: no gross mean stored on the decisive object
- fomc-follow (#861) xau R: no gross mean stored on the decisive object
- fx-xs-momentum (#869) lookback 21: no gross mean stored on the decisive object
- fx-xs-momentum (#869) lookback 63: no gross mean stored on the decisive object
- index-cycle (#874) exit A: decisive figure only in verdict text
- index-cycle (#874) exit B: decisive figure only in verdict text
- nas-crypto-spill (#876) follow: no gross mean stored on the decisive object
- nas-crypto-spill (#876) fade: no gross mean stored on the decisive object
- energy-seasonal (#879) T1 WTI long: no object at RESULT
- energy-seasonal (#879) T2 Brent long: no object at RESULT
- energy-seasonal (#879) T3 natgas long: no object at RESULT
- energy-seasonal (#879) T4 natgas short: no object at RESULT
- risk-cross (#886) T1 AUD/JPY: no object at RESULT
- risk-cross (#886) T2 NZD/JPY: no object at RESULT
- risk-cross (#886) T3 trend only: no object at RESULT
- ecb-boj-days (#896) ECB EUR/USD: no gross mean stored on the decisive object
- ecb-boj-days (#896) BoJ USD/JPY: no gross mean stored on the decisive object
- gold-month-of-year (#907) T1 strong months vs the rest: a Welch difference between month books; the book figures carry a trade t only, not the decisive t
- gold-month-of-year (#907) T2: a difference in % between month books, no cost split
- gold-month-of-year (#907) T3: a difference between month books, no cost split
- vol-managed-index (#909) T1-T3: Sharpe differences of daily books; no gross / cost a trade
- index-52w-high (#911) T1-T3: a difference (signal minus base) in R; the decisive t is on that difference, not on a net stream
- gotobi-limit-entry (#915) limit entries: a capture study of the gotobi T2 entry (rows of entry prices), no pre-registered test of its own
- tokyo-fix-daily (#917) T2 gotobi vs other days: a difference of daily moves in pips, no cost
- tokyo-fix-daily (#917) T3 month means: a difference of month means, no cost
- fx-december-usd (#918) T1-T3: excess returns in basis points against a base; cost and financing not split from the gross
- fx-weekday (#919) weekdays: Welch t of one weekday against the rest; the per-side gross and net carry no t of their own
- santa-rally (#922) T1-T3: one row a year with excess over a base; no decisive t on a net stream stored


# Evening box fade plus: can the 20-23 UTC M15 box close-out fade pay its costs? (result)

**Verdict: FAIL. chosen variant S3 box +fade: screen +0.079R / +0.040R a trade after costs; holdout crosses +0.038R a trade after costs (n 11,258, month t 2.67), holdout checks not all met.**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants outside the 48. Judged AFTER costs (one flat round trip a market; ASSUMED
for xag, nzdusd, usdcad, usdchf, eurjpy and all five holdout crosses).

## What was run

The evening-methods R5 signal (fade the M15 box close-out when the close-out candle starts 20:00-23:59 UTC) with 3 stops
(S1 past the close-out candle, S2 1 ATR, S3 2 ATR), 4 targets (1R, 2R, 3R, the box's other edge) and 4 filters (none; +fade =
the same candle is a first-break fade; +other = another of the owner's fades on the same side in the hour; no-roll = fill
outside 21:00-22:59 UTC). Screen on the ten markets evening-methods read; the eligible variant (after costs > 0 in 2005-14 and
2015-26, n >= 300 each) with the largest weaker after-cost month t is tested once on gbpjpy, audjpy, cadjpy, eurgbp, euraud.

## Checks

- Gate, base S1 2R none = evening-methods R5 evening, 2005-14: n 15,326 mean +0.245 (want n 15,326, +0.245): equal.
- Gate, base S1 2R none = evening-methods R5 evening, 2015-26: n 14,586 mean +0.236 (want n 14,586, +0.236): equal.
- Cut test (10 cuts): equal on cut candles (xau 2006-06-14 n 42; xau 2007-03-21 n 171; xau 2007-11-14 n 254; xau 2008-08-20 n 373; xau 2009-05-13 n 489; eurusd 2006-06-14 n 298; eurusd 2007-03-21 n 416; eurusd 2007-11-14 n 537; eurusd 2008-08-20 n 686; eurusd 2009-05-13 n 853).
- Every trade has its stop on the losing side (the run throws otherwise).

## The screen (ten markets, in sample)

After costs R a trade (month t) | before costs, n. Eligible = after costs > 0 in both windows with n >= 300 each.

| Variant | n A | A after (t) | A before | n B | B after (t) | B before | cost R | Eligible |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| S1 1R none | 15,326 | -0.280 (-27.93) | +0.073 | 14,586 | -0.342 (-26.63) | +0.079 | 0.386 | no |
| S1 1R +fade | 8,909 | -0.280 (-20.58) | +0.077 | 8,530 | -0.339 (-20.10) | +0.080 | 0.388 | no |
| S1 1R +other | 3,618 | -0.293 (-13.98) | +0.063 | 3,181 | -0.347 (-16.37) | +0.085 | 0.392 | no |
| S1 1R no-roll | 8,229 | -0.323 (-21.55) | +0.037 | 7,814 | -0.433 (-25.58) | +0.019 | 0.405 | no |
| S1 2R none | 15,326 | -0.108 (-8.39) | +0.245 | 14,586 | -0.185 (-12.25) | +0.236 | 0.386 | no |
| S1 2R +fade | 8,909 | -0.107 (-6.09) | +0.250 | 8,530 | -0.180 (-9.00) | +0.239 | 0.388 | no |
| S1 2R +other | 3,618 | -0.136 (-4.92) | +0.220 | 3,181 | -0.191 (-7.01) | +0.242 | 0.392 | no |
| S1 2R no-roll | 8,229 | -0.161 (-8.57) | +0.200 | 7,814 | -0.278 (-13.66) | +0.174 | 0.405 | no |
| S1 3R none | 15,326 | -0.026 (-1.54) | +0.327 | 14,586 | -0.108 (-5.80) | +0.313 | 0.386 | no |
| S1 3R +fade | 8,909 | -0.019 (-0.81) | +0.338 | 8,530 | -0.104 (-4.52) | +0.315 | 0.388 | no |
| S1 3R +other | 3,618 | -0.056 (-1.66) | +0.300 | 3,181 | -0.134 (-3.69) | +0.299 | 0.392 | no |
| S1 3R no-roll | 8,229 | -0.089 (-3.96) | +0.271 | 7,814 | -0.191 (-7.51) | +0.262 | 0.405 | no |
| S1 box none | 15,197 | +0.133 (3.40) | +0.488 | 14,284 | +0.072 (1.69) | +0.500 | 0.390 | yes |
| S1 box +fade | 8,854 | +0.151 (2.89) | +0.509 | 8,357 | +0.089 (1.66) | +0.515 | 0.392 | yes |
| S1 box +other | 3,589 | +0.081 (1.13) | +0.439 | 3,131 | -0.015 (-0.21) | +0.424 | 0.395 | no |
| S1 box no-roll | 8,185 | +0.110 (2.20) | +0.472 | 7,783 | +0.063 (1.06) | +0.517 | 0.407 | yes |
| S2 1R none | 18,728 | +0.012 (1.30) | +0.158 | 19,352 | -0.019 (-2.08) | +0.157 | 0.162 | no |
| S2 1R +fade | 10,923 | +0.026 (2.29) | +0.171 | 11,376 | -0.006 (-0.53) | +0.170 | 0.161 | no |
| S2 1R +other | 4,430 | +0.011 (0.65) | +0.153 | 4,233 | -0.037 (-2.04) | +0.139 | 0.159 | no |
| S2 1R no-roll | 10,137 | -0.026 (-2.29) | +0.124 | 10,657 | -0.066 (-5.21) | +0.116 | 0.166 | no |
| S2 2R none | 18,728 | +0.059 (4.80) | +0.205 | 19,352 | -0.009 (-0.67) | +0.168 | 0.162 | no |
| S2 2R +fade | 10,923 | +0.075 (5.17) | +0.221 | 11,376 | +0.002 (0.09) | +0.178 | 0.161 | yes |
| S2 2R +other | 4,430 | +0.030 (1.30) | +0.172 | 4,233 | -0.051 (-2.19) | +0.125 | 0.159 | no |
| S2 2R no-roll | 10,137 | +0.022 (1.55) | +0.172 | 10,657 | -0.061 (-3.64) | +0.120 | 0.166 | no |
| S2 3R none | 18,728 | +0.058 (3.63) | +0.204 | 19,352 | -0.019 (-1.24) | +0.158 | 0.162 | no |
| S2 3R +fade | 10,923 | +0.074 (3.72) | +0.219 | 11,376 | -0.004 (-0.23) | +0.172 | 0.161 | no |
| S2 3R +other | 4,430 | +0.024 (0.81) | +0.166 | 4,233 | -0.061 (-2.00) | +0.115 | 0.159 | no |
| S2 3R no-roll | 10,137 | +0.031 (1.54) | +0.181 | 10,657 | -0.061 (-2.90) | +0.121 | 0.166 | no |
| S2 box none | 18,613 | +0.067 (4.12) | +0.213 | 19,152 | +0.005 (0.28) | +0.181 | 0.161 | yes |
| S2 box +fade | 10,894 | +0.081 (4.06) | +0.226 | 11,291 | +0.013 (0.56) | +0.189 | 0.161 | yes |
| S2 box +other | 4,414 | +0.035 (1.17) | +0.177 | 4,205 | -0.034 (-1.12) | +0.143 | 0.158 | no |
| S2 box no-roll | 10,091 | +0.036 (1.71) | +0.186 | 10,626 | -0.045 (-2.17) | +0.136 | 0.166 | no |
| S3 1R none | 19,182 | +0.057 (6.26) | +0.144 | 19,784 | +0.011 (1.28) | +0.112 | 0.095 | yes |
| S3 1R +fade | 11,193 | +0.062 (5.75) | +0.150 | 11,603 | +0.017 (1.61) | +0.118 | 0.094 | yes |
| S3 1R +other | 4,516 | +0.036 (2.10) | +0.118 | 4,322 | +0.004 (0.28) | +0.105 | 0.091 | yes |
| S3 1R no-roll | 10,395 | +0.031 (2.89) | +0.121 | 10,957 | -0.019 (-1.79) | +0.088 | 0.099 | no |
| S3 2R none | 19,182 | +0.065 (4.75) | +0.152 | 19,784 | +0.011 (1.09) | +0.113 | 0.095 | yes |
| S3 2R +fade | 11,193 | +0.074 (4.37) | +0.162 | 11,603 | +0.021 (1.46) | +0.122 | 0.094 | yes |
| S3 2R +other | 4,516 | +0.032 (1.32) | +0.114 | 4,322 | +0.035 (1.56) | +0.135 | 0.091 | yes |
| S3 2R no-roll | 10,395 | +0.047 (2.71) | +0.137 | 10,957 | -0.017 (-1.10) | +0.091 | 0.099 | no |
| S3 3R none | 19,182 | +0.067 (4.03) | +0.155 | 19,784 | +0.002 (0.16) | +0.104 | 0.095 | yes |
| S3 3R +fade | 11,193 | +0.074 (3.69) | +0.161 | 11,603 | +0.019 (1.08) | +0.119 | 0.094 | yes |
| S3 3R +other | 4,516 | +0.042 (1.45) | +0.124 | 4,322 | +0.011 (0.38) | +0.111 | 0.091 | yes |
| S3 3R no-roll | 10,395 | +0.062 (2.80) | +0.152 | 10,957 | -0.018 (-1.01) | +0.090 | 0.099 | no |
| S3 box none | 16,250 | +0.078 (6.01) | +0.166 | 16,238 | +0.024 (1.88) | +0.126 | 0.095 | yes |
| S3 box +fade | 10,015 | +0.079 (4.93) | +0.166 | 10,123 | +0.040 (2.60) | +0.141 | 0.094 | chosen |
| S3 box +other | 3,893 | +0.058 (2.38) | +0.140 | 3,588 | +0.030 (1.22) | +0.131 | 0.091 | yes |
| S3 box no-roll | 9,015 | +0.057 (3.25) | +0.147 | 9,300 | -0.019 (-1.23) | +0.088 | 0.099 | no |

## The holdout test (five crosses, one variant)

Variant: S3 box +fade.

- Pooled 2005-26: +0.038R a trade after costs (n 11,258, month t 2.67); +0.122R before costs.
- 2005-14: +0.068R after costs (n 5,440); 2015-26: +0.010R (n 5,818).
- At 1.5 x the cost: -0.004R a trade.

| Check | Met |
|---|---|
| pooled after costs: mean > 0 and month t >= 2 | yes |
| after costs mean > 0 in 2005-14 and in 2015-26 | yes |
| after 1.5 x the cost: mean > 0 | no |
| positive after costs in at least 3 of 5 markets | yes |

| Market | n | after costs (t) | before | cost R |
|---|---:|---:|---:|---:|
| gbpjpy | 2,300 | +0.027 (0.97) | +0.095 | 0.068 |
| audjpy | 2,547 | +0.041 (1.50) | +0.120 | 0.079 |
| cadjpy | 2,292 | +0.053 (1.94) | +0.133 | 0.080 |
| eurgbp | 1,788 | +0.002 (0.06) | +0.138 | 0.136 |
| euraud | 2,331 | +0.057 (1.99) | +0.130 | 0.072 |

## What it means

A near miss. On the five holdout crosses the chosen variant (S3 box +fade) stayed positive after costs,
+0.038R a trade (n 11,258, month t 2.67), in both windows and in 5 of 5 markets, but it failed one check: after 1.5 x the cost: mean > 0
(-0.004R a trade). The margin over the cost is about a third of one round trip, and 2015-26 alone is +0.010R a trade:
too thin to survive costs that are only assumed for these crosses. What made it closer than R5: a stop of 2 ATR (one round trip
is about 0.07-0.14R instead of about 0.4R), the box's other edge as the target, and taking only the close-outs the plain fade of
the first break agrees with. It is not an edge and nothing is built on it.

Nothing live changed and no rule is proposed. Never call this an edge without the broker's own evening bid / ask:
the flat cost a market does not see the wider spreads around the 21:00-22:59 UTC rollover.

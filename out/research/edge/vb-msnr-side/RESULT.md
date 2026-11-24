# The breakout, WITH against AGAINST the key-level direction call (vb-msnr-side, 24 Nov 2026)

**Verdict: FAIL. Best WITH cell xau WITH +0.068R a trade after costs in 2015-26 (n 1107, month t 1.81) against +0.121R AGAINST the call (n 1132); WITH minus AGAINST -0.054R (Welch t -0.96), 2005-14 +0.040R (t 0.55).**

Run as pre-registered (`PREREGISTRATION.md`, committed alone first; its sha256 is in `result.json`). Research only: nothing live
changed, nothing is proposed, the forward records of the two breakouts run on unchanged. One run, no variants. This page is
written by `run.mjs` from `result.json`.

## What was run

The daily breakout T1 (open of the UTC day plus or minus half the previous day's range, stop back at the open, out before
21:00 UTC) on gold and USD/JPY, each at its study's measured cost. Each day's trade was labelled by the desk's direction call
(`council/eg-methods.mjs` `direction()`, H4 working chart, Daily key levels) as it stood after the last H4 candle closed at or
before 00:00 UTC: WITH = the fill is on the call's side, AGAINST = on the other side, NONE = no call yet.

## The cells (R a trade; month t on calendar-month sums of after-cost R)

| Cell | 2005-14 n | before costs | after costs | month t | 2015-26 n | before costs | after costs | month t | Holm p | Profit bar | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| xau WITH | 806 | +0.227 | +0.212 | 4.06 | 1107 | +0.084 | +0.068 | 1.81 | 0.106 | no | no |
| xau AGAINST | 795 | +0.187 | +0.172 | 3.56 | 1132 | +0.138 | +0.121 | 2.99 | 0.007 | yes | no |
| usdjpy WITH | 941 | +0.168 | +0.139 | 3.51 | 1150 | +0.089 | +0.056 | 1.48 | 0.139 | no | no |
| usdjpy AGAINST | 940 | +0.068 | +0.039 | 0.90 | 1113 | +0.082 | +0.050 | 1.38 | 0.139 | no | no |
| both WITH | 1747 | +0.195 | +0.173 | 5.12 | 2257 | +0.087 | +0.062 | 2.15 | 0.063 | no | no |
| both AGAINST | 1735 | +0.123 | +0.100 | 2.95 | 2245 | +0.110 | +0.086 | 3.04 | 0.007 | yes | no |

## Does the call add anything? WITH minus AGAINST, after costs (Welch t on trades)

| Market set | 2005-14 difference | Welch t | 2015-26 difference | Welch t | Both > 0 with t >= 2 |
|---|---|---|---|---|---|
| xau | +0.040 | 0.55 | -0.054 | -0.96 | no |
| usdjpy | +0.100 | 1.72 | +0.006 | 0.11 | no |
| both | +0.072 | 1.58 | -0.024 | -0.63 | no |

## In plain words

Cells meeting the profit bar: xau AGAINST, both AGAINST. Every cell is a subset of a rule that is already profitable at these costs, so that alone says nothing about the call. The question is the difference, WITH minus AGAINST after costs: xau: +0.040R (Welch t 0.55) in 2005-14 and -0.054R (t -0.96) in 2015-26; usdjpy: +0.100R (Welch t 1.72) in 2005-14 and +0.006R (t 0.11) in 2015-26; both: +0.072R (Welch t 1.58) in 2005-14 and -0.024R (t -0.63) in 2015-26. No market set has the difference above zero with a Welch t of 2 in both windows, so by the pre-registered reading the key-level direction call adds nothing to the breakouts that can be told from chance. The breakouts stay as they are, with no direction gate.

## The unsplit rule, the days with no call, and the sides (after costs)

| Market set | Window | All trades n | All after costs | month t | NONE n | NONE after costs | WITH buys | WITH sells | AGAINST buys | AGAINST sells | Call days buy / sell / none |
|---|---|---|---|---|---|---|---|---|---|---|---|
| xau | 2005-14 | 1611 | +0.189 | 5.42 | 10 | -0.318 | +0.244 (437) | +0.173 (369) | +0.246 (328) | +0.120 (467) | 904 / 697 / 10 |
| xau | 2015-26 | 2239 | +0.095 | 3.72 | 0 | n/a | +0.047 (724) | +0.108 (383) | +0.160 (414) | +0.099 (718) | 1442 / 797 / 0 |
| usdjpy | 2005-14 | 1894 | +0.092 | 3.32 | 13 | +0.538 | +0.206 (442) | +0.080 (499) | +0.091 (434) | -0.005 (506) | 948 / 933 / 13 |
| usdjpy | 2015-26 | 2263 | +0.053 | 2.14 | 0 | n/a | +0.206 (583) | -0.098 (567) | +0.065 (526) | +0.037 (587) | 1170 / 1093 / 0 |
| both | 2005-14 | 3505 | +0.137 | 5.69 | 23 | +0.166 | +0.225 (879) | +0.120 (868) | +0.158 (762) | +0.055 (973) | 1852 / 1630 / 23 |
| both | 2015-26 | 4502 | +0.074 | 3.81 | 0 | n/a | +0.118 (1307) | -0.015 (950) | +0.107 (940) | +0.071 (1305) | 2612 / 1890 / 0 |

## Harness gate (the unsplit rules at these costs against the published studies)

| Market | Window | Published n / after costs | Here n / after costs | Within 2 % and 0.01R |
|---|---|---|---|---|
| xau | 2007-01-01 to 2011-12-31 | 929 / +0.202 | 929 / +0.202 | yes |
| xau | 2012-01-01 to 2015-12-31 | 728 / +0.170 | 728 / +0.170 | yes |
| xau | 2016-01-01 to 2020-12-31 | 935 / +0.094 | 935 / +0.094 | yes |
| xau | 2021-01-01 to 2026-11-12 | 1121 / +0.105 | 1121 / +0.105 | yes |
| usdjpy | 2005-01-04 to 2015-12-31 | 2089 / +0.079 | 2089 / +0.079 | yes |
| usdjpy | 2016-01-01 to 2026-11-19 | 2079 / +0.063 | 2079 / +0.063 | yes |

## What this does not show

- It does not re-test the breakouts: their trades were read before on every year here. Only the split by the call is new, and a WITH or AGAINST cell that is profitable is a subset of a rule that already is.
- One fixed reading of the call (UTC-aligned H4 candles, UTC days with the weekend folded into Monday as the Daily, the function's own constants). Other ladders were not tried, and trying them on these trades now would be a search.
- Today's measured cost is charged on every year; candles are OANDA mid, not broker ticks. Gold has no candles before March 2006.
- Whatever the verdict, nothing here is an edge and nothing live changes.

## Data and method

- xau: 1474565 five-minute candles 2006-03-19 to 2026-11-21, 33675 H4 candles, 518 direction switches, 3861 breakout trades; usdjpy: 1644664 five-minute candles 2005-01-02 to 2026-11-20, 36069 H4 candles, 566 direction switches, 4169 breakout trades. Source: the shared toolkit's OANDA mid 5-minute cache.
- Month t: calendar months with a trade; p one-sided normal; Holm over the six cells on the 2015-26 p. Profit bar: n >= 300, after-cost mean > 0 and month t >= 2 in both windows, Holm p < 0.05. Pass: a WITH cell meets it and WITH minus AGAINST is > 0 with Welch t >= 2 in both windows.
- To repeat: `node --max-old-space-size=3500 research/edge/vb-msnr-side/run.mjs` (the candle cache is kept out of git).


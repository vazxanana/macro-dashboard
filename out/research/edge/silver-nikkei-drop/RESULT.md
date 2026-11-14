# Result: buying silver after a large Nikkei 225 down day, a replication of gold-nikkei-drop (14 Nov 2026)

**Verdict: FAIL, 0 of 3: the gold near miss does not carry to silver; a silver buy after a Nikkei worst-10 % day made +0.008R over the same-year any-day buy 2017-26 (n 179, month t 0.14).**

Pre-registered in `PREREGISTRATION.md` (committed and pushed alone before any return was computed; only event counts were
read first). Paper research only: a stand-alone silver rule, nothing live reads it, nothing live changed, no proposal written.

## The rule and the data

- `gold-nikkei-drop`'s rule unchanged, traded on silver: OANDA mid daily candles (UTC) from council-data `research/daily/xag.json`
  and `jp225.json` (fetched at commit `ebbe3e26a`; both files are byte-identical at `61aa34da`, the commit `result.json` names),
  weekends folded into Monday (`foldWeekend`). Silver 2006-03 to 2026-11.
- Drop day: the Nikkei 225's one-day log return at or below the q-quantile of its 250 previous daily returns.
- Trade: buy silver at the next silver candle's open, stop 2 x ATR(20) below, out at the close of the H-th candle or at the
  stop, one at a time. Cost $0.03 a round trip (gold-drd-silver's silver cost; about 0.03R on a median stop of $1.04-1.19).
  **No financing is charged**: `council/fills.mjs` has no silver rate. A sensitivity with gold's long rate is given below.
- Baseline: the same buy after every eligible day (overlap allowed); excess = a trade's net R minus the baseline's mean net R
  over the days of the same calendar year. "Base net" is the baseline's mean over the whole window, for reference.

## Results

| Test | window | drop days | n | gross R | net R | base net | excess | month t | excess x2 costs |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 2007-16 | 262 | 166 | +0.027 | -0.003 | -0.003 | +0.010 | 0.16 | +0.010 |
| T1 | 2017-26 | 266 | 179 | +0.064 | +0.034 | +0.036 | +0.008 | 0.14 | +0.007 |
| T1 | 2007-26 | 528 | 345 | +0.046 | +0.016 | +0.016 | +0.009 | 0.22 | +0.009 |
| T3 | 2007-16 | 393 | 171 | +0.097 | +0.066 | +0.032 | +0.035 | 0.45 | +0.035 |
| T3 | 2017-26 | 405 | 176 | +0.145 | +0.114 | +0.100 | +0.028 | 0.39 | +0.028 |
| T3 | 2007-26 | 798 | 346 | +0.119 | +0.089 | +0.066 | +0.030 | 0.57 | +0.030 |

T1 = worst 10 %, held 5 candles, judged 2017-26 (primary); T2 = the same rule judged on 2007-26 pooled (the T1 2007-26 row);
T3 = worst 15 %, 10 candles (the gold study's own variant), judged 2017-26.

| Test | judged on | Holm p | placebo (real month t above) | checks failed |
|---|---|---|---|---|
| T1 | 2017-26 | 1.000 | 25 of 40 | t under 2, Holm p over 0.05, placebo |
| T2 | 2007-26 | 1.000 | 28 of 40 | t under 2, Holm p over 0.05, placebo |
| T3 | 2017-26 | 1.000 | 28 of 40 | t under 2, Holm p over 0.05, placebo |

Sensitivity (not a test): with gold's measured long financing (`FIN.xau.long`) charged on every silver buy, T1's net R a trade
is -0.020R (2007-16) and +0.014R (2017-26), the excess unchanged (+0.010R / +0.008R, month t 0.17 / 0.15), since signal and
baseline pay alike.

## Reading

- On silver the signal days are ordinary days: the primary rule's excess over the same-year any-day buy is +0.010R and
  +0.008R a trade (month t 0.16 and 0.14), and the random-day placebos do as well (25 of 40 below). The net R a trade is
  almost exactly the baseline's (+0.034R against +0.036R out of sample): silver's own drift, not the Nikkei.
- The gold study's primary had +0.079R / +0.099R (t 1.32 / 1.80). Silver, the closer market, does not show even a tenth of it,
  so the gold near miss gains no support from a second market. Read together with its absent dose response on gold, it is
  more likely noise than a haven flow after Japanese sell-offs.
- T3 is a little better (+0.035R / +0.028R) but its t is under 0.6 in every window.
- Nothing in this study is a gate, filter, size or exit for any live system.

To repeat: `node research/edge/silver-nikkei-drop/run.mjs fetch <dir>` (git show, no network), then `… full <dir>`.
Tests: `tests/silver-nikkei-drop.test.mjs`.

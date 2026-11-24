# Pre-registration: where should the volatility breakout's stop go? (vb-stop-place, 24 Nov 2026)

Paper research only. Nothing live changes, nothing is adopted, no proposal is written by this study. This file is committed and
pushed alone, before any figure of a moved stop is computed.

## Question

The gold and USD/JPY volatility breakouts (T1 of `gold-vol-breakout` / `index-vol-breakout`: buy stop at the 00:00 UTC open + 0.5 x
the previous folded day's range, sell stop at the open − 0.5 x that range, stop back at the OPEN, out at 21:00 UTC) put the stop at
the day's open. Would another stop place have been better after costs? Checked first, not answered by an earlier study:
`usdjpy-vb-manage` moved the stop only after +1R (break-even / trail / half), `gold-vb-exit` and `usdjpy-vb-exit` moved the exit
time, `gold-vol-breakout-reverse` added the opposite trade; no study moved the opening stop.

## Variants (same entry, same day, same fill; only the stop differs)

- **O, the rule**: stop at the day's open.
- **A, half way**: stop half way between the open and the trigger level the trade filled at (buy: (open + up) / 2; sell: (open + dn) / 2).
  With k 0.5 that is 0.25 x the previous range from the open.
- **B, 1 x ATR(14) of H1 from the fill**: stop = entry − side x ATR, ATR = the plain mean of the true ranges of the 14 H1 candles
  (built from the 5-minute candles, `edgekit.resample`) that ENDED at or before the fill candle's start (true range uses each
  candle's previous H1 close). A day with fewer than 15 such H1 candles on file is skipped for all four variants alike.
- **C, the opposite trigger**: stop at the other side's trigger level (buy: open − 0.5 x range; sell: open + 0.5 x range), about
  twice the rule's distance (the stop-and-reverse distance; no reverse trade is taken).

Management, the rule's own for all four (functions `vbTrade` / its walk, imported unchanged from `index-vol-breakout/original.mjs` =
`gold-vol-breakout-hourcost/original.mjs`, sha256 afa36e03…): on the fill candle, if it also reaches the stop the trade is out at
the stop (worst case); from the next candle a candle opening beyond the stop exits at its open, one touching it exits at the stop;
otherwise out at the close of the 20:55 UTC candle. **R of each variant is measured on its own opening risk** r = |entry − stop|.

## Costs (they grow in R as the stop tightens)

- Gold: `gold-vol-breakout-hourcost`'s C1, frozen from its `result.json` (sha256 fd599041…): round trip =
  (0.5 x the demo's median quoted spread share of the fill hour + 0.5 x that of hour 20 + commission 0.000024) x entry + 0.05 x M
  (M = median high − low of the 12 M5 candles ending with the fill candle), divided by the VARIANT'S r; financing of a buy held
  over the 22:00 UTC rollover (none here: every trade is out by 21:00).
- USD/JPY: `fx-vol-breakout` `costPx` (0.000045 x entry + 0.5 pip a round trip), divided by the variant's r.
- 2x cost reported for every cell. The cost in money is the same for every variant of one trade; in R it is cost / r.

## Windows

- Discovery 2005-01-04 → 2014-12-31 for USD/JPY (usdjpy-vb-exit's start); 2007-01-01 → 2014-12-31 for gold (the cache starts in
  March 2006; the gold studies start in 2007, 2006 is warm-up).
- Confirmation 2015-01-01 → 2026-11-20 for both.
- Both windows have been read for the rule itself by the parent studies; only the moved stops are new.

## Tests (6 = 3 variants x 2 markets, Holm over the six)

Money at equal risk per trade: every trade risks the same money, so a trade's money = its net R x the risk unit, and a day's money =
the day's net R (one trade a day at most; the four variants trade the same days). The paired statistic is
d = net R(variant) − net R(O) for each trade-day, month-sum t of d (calendar months), one-sided p (normal), Holm over the six.

A variant **IMPROVES** on a market only when all hold:
1. mean d > 0 in both windows;
2. confirmation month-sum t of d ≥ 2 and Holm p < 0.05;
3. the variant's own net R a trade > 0 in both windows and its confirmation month-sum t ≥ 2;
4. n ≥ 200 trades in each window.

Otherwise **WORSE** when the confirmation month t of d ≤ −2, else **NO BETTER**. Verdict: PASS if any of the six IMPROVES, else FAIL.

Reported, no test: before-cost R, 2x cost, max closed drawdown in R, the share stopped, and a descriptive "same position size"
view (each variant's day P&L in units of the rule's distance, R_v x r_v / r_O).

## Gates (run stops if either fails)

- O at the frozen C1 cost reproduces `gold-vol-breakout-hourcost`'s published C1 (slippage 0.05) grid: POOLED 2007-01-01 →
  2026-11-12 n 3713, +0.139R, month t 6.47 (and W1-W4).
- O at fx-vol-breakout's cost reproduces `usdjpy-vb-exit`'s gate: 2005-01-04 → 2015-12-31 n 2089 +0.079R; 2016-01-01 → 2026-11-19
  n 2079 +0.063R.
- The variant walker with the open stop gives the same exit and R as `vbTrade` on every trade.

## Control (reported, not in the verdict)

The parent studies' placebo: on every tradable day one market entry at a random 5-minute mark 01:00-18:00 UTC with a fair-coin
side (40 seeds), out at 21:00; stops O' = 0.5 x previous range (the rule's typical distance), A' = 0.25 x range, B = 1 x ATR(14) H1,
C' = 1.0 x range; the same costs. Mean d of each variant against O' over the whole span, median and 5-95 % band over the seeds,
and whether the T1 d lies inside the band. It shows how much of any difference a stop distance gives on a random entry.

## Data

OANDA mid M5 from the shared candle cache (`research/edge/_lib/edgekit.mjs` `load`), xau and usdjpy. Cautions known before the run:
today's demo cost is charged on every past year; stop slippage is modelled (gold 0.05 x M), not measured; mid candles are not
broker fills; a tighter stop is touched more often inside the fill candle (worst case taken), which is conservative for A and B.

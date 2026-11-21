# Desk partial exits: half closed at +1R, the rest left to run (pre-registration, 21 Nov 2026)

Owner, 21 Nov 2026, after `research/edge/desk-exits` showed about half of the desks' trades reach +1R before their stop and a
third of the Mosha losers were +1R first: "plenty of them could be winner"; asked to test closing half at +1R and letting the
rest run ("yes"). Written and committed before either exit below is computed on any trade.

## Exits (each run on each trade alone, from its own fill, its own entry and opening stop; 1R = |entry - stop|)

- **PT (half, then trail)**: half the position closes at +1R; at that moment the other half's stop moves to the entry and from
  then trails 1R behind the best price (never back); no target for the second half.
- **P3 (half, then 3R)**: half closes at +1R; the other half's stop moves to the entry; its target is +3R.
- Result in R of the whole position = 0.5 x the first half + 0.5 x the second. Before +1R is reached the whole position has the
  opening stop (a loss is -1R, or worse on a gap).
- The common rules of `desk-exits` hold unchanged: the 5-minute candle holding the fill can only stop the trade; the stop is
  taken before a target within a candle (so a candle that reaches both +1R and the opening stop is a full -1R); a candle that opens
  beyond the stop exits at its open; stops move after a candle is read, never inside it; 5-day cap at the candle's close; a trade
  whose candles end before an exit is left out and counted.
- Reported beside them, not tested: the booked exit, X1 (all at +1R) and XT (the desk-exits trailing stop).

## Stage A: the desks' own 2026 trades (in sample)

The same 30,904 closed records and candles as `desk-exits` (council-data desk files of 21 Nov 2026 19:57 UTC). Per group (the
same 15 groups) and exit: n, win %, mean R before costs and after the desk-rigor cost model, month t; against the booked R the
paired month t, Holm over 30 (15 x 2). Descriptive: stage A gives no verdict.

## Stage B: 2020-2025, the verdict

- **Trades**: the desks' code on `main` as of 21 Nov 2026 (`assets/mosha-sop.js` `sopTrades` / `barrierTrades`,
  `council/eg-methods.mjs` `methodTrades` / `snrTrades`, `council/edge-desks.mjs` `egTrades` / `msnrTrades` / `litTrades`), run
  on OANDA mid candles (5m, 1h, 4h, 1d; 15m and 30m grouped from 5m) of gold, EUR/USD and GBP/USD, the files of
  `research/edge/desk-rigor` (2019-06 warm-up to 2026). Trades with a fill from 2020-01-01 to 2025-12-31. Groups as in stage A
  (a group with no trade is left out). Their booked R is the desk code's own.
- **Windows**: in sample 2020-2023, out of sample 2024-2025.
- **Costs**: the desk-rigor cost model, once a round trip (a partial exit pays it once: the half closed early does not add a
  second spread; said here so the figures are not read as charging two).
- **The bar, per group and exit** (Holm over every group x 2 exits):
  - **better than the desk's own exit**: out of sample, the paired monthly mean of (exit - booked) after costs is positive with
    month t >= 2 and Holm p < 0.05, and the in-sample paired mean is positive too;
  - **profitable**: out of sample, the exit's own mean R after costs is above 0 with month t >= 2 (Holm over the same family),
    and the in-sample mean after costs is above 0 too.
- **Verdict**: PASS for a group and exit that is both better and profitable; otherwise FAIL for it. The study PASSES if one group
  and exit passes.

## What this is not

- Each trade is run alone: a desk holding one position at a time would have taken other later trades.
- Three markets only in stage B (gold, EUR/USD, GBP/USD); 5-minute candles (an M1-confirmed barrier is read on 5m fills).
- A PASS is a candidate for a forward paper record of its own, never a live rule without the owner, and never "an edge" before
  that record. Nothing live changes from this study.

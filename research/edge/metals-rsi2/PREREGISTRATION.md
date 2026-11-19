# Pre-registration: the 2-day RSI pullback, frozen, on gold and silver (13 Nov 2026)

Written, committed and pushed before any number of this study was computed. Paper research: nothing here is read by the
council, the mirror or the page, and no live rule changes whatever the verdict. Not an ICT study.

**Item 44 (docs/owner-decisions.md) and what this study is not.** This is a NEW stand-alone rule on gold and silver. It is not
a gate, an exit, an entry or a size of the gold book (Gold trend / Gold daily engulf) and reads none of that book's trades. It is
decided on 2016 to now (the book's untouched 2006-17 window is not the decisive window); 2008-15 is a replication window only.

## Why
The 2-day RSI pullback was tested on US index CFDs (`research/edge/rsi2-pullback`, branch `rsi2-pullback`, PR #838: FAIL, a near
miss, SPX500 month t 1.83, US30 trade t 1.88, Holm p 0.065) and, unchanged, on six non-US indices (`research/edge/rsi2-replicate`,
branch `rsi2-replicate`, PR #844: FAIL). It has never been run on metals. The question is whether the SAME frozen rule, with no
parameter changed, makes money after costs on gold and silver.

## The rule: byte for byte the original
`rsi2-pullback.mjs` in this folder is `research/edge/rsi2-pullback/run.mjs` of the `rsi2-pullback` branch, copied unchanged (that
branch is not merged into `main`; nothing is imported from a sibling branch). Its sha256
`edade889f2825fa71d911e039bfe5b9fdaaf5677e7b2fd55742e742830d5ab65` is pinned in the test; it is the same file #844 copied. The
functions `sma`, `rsi`, `atr`, `simulate`, `tstat`, `rng`, `pct` are used from it as they are. The rule therefore stays:

- Signal on the close of day i: close(i) > SMA200(i) and Wilder RSI(2)(i) < 10.
- **Buy at day i+1's open** (the frozen rule; never at the signal close).
- Stop: entry - **3 x ATR(20)** taken at the signal close, checked from the entry day; a day that opens below the stop exits at
  its open (gap fill), otherwise at the stop.
- Exit: at the open of the day after the first close above SMA5 (the stop wins on its day). **No time exit.**
- One position per market; a trade open at the end of the data is closed at the last close (`end`).

**Differences from the brief that asked for this study, said plainly.** The brief listed "buy at the close", "exit after 10 days"
and "stop at 2.5 x ATR(20)" and also said: copy the rule exactly as frozen on the `rsi2-pullback` branch, and use the listed
numbers only if that branch cannot be fetched. It was fetched, so the frozen rule above is used (next-open fill, 3 x ATR, no time
exit). The point is the same frozen rule on new markets.

## Data
- OANDA mid daily candles, council-data `research/daily/xau.json` (XAU_USD) and `xag.json` (XAG_USD), `git show
  origin/council-data:…`, no network. UTC-aligned daily candles, both from 20 Mar 2006 to 6 Nov 2026.
- Weekend candles (the Sunday reopen stubs) are **folded** into the next weekday with `council/fills.mjs` `foldWeekend` (the
  stub's open becomes Monday's open, high / low over both; a trailing weekend candle is left out) before anything is computed.
  This replaces the original's "drop weekend candles" (indices have almost none; gold has one every week). After the fold the
  original `candles()` filter drops nothing.

## Costs (every trade)
- Round trip, in price: gold **$0.30**, silver **$0.03** (spread plus slippage, stated, not measured on a broker).
- Financing on the long: `council/fills.mjs` `nights` (Monday-Friday 22:00 UTC rollovers strictly between entry and exit,
  Wednesday counts three) x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's XAUUSD swap of 11 Nov 2026) x entry
  price. **Silver is charged the same rate as a fraction of its price** (0.000148 x entry a rollover; no silver swap is measured
  in the repository). Today's rate is used for every year.
- Times for `nights`: entry = the entry day's 00:00 UTC (its open); an exit at a day's open or at its stop = that day's 00:00 UTC
  (a stop is taken as hit before that day's 22:00 rollover); an exit at a day's close (`end`, and a placebo trade held 0 days) =
  the next day's 00:00 UTC.
- R a trade = (exit - entry - round trip - financing) / (3 x ATR(20)). Also reported: net % of entry price.

## Windows (by entry day)
- **B: 2016-01-01 to the end of the data (decisive).**
- A: 2008-01-01 to 2015-12-31 (replication).

## Pass (all of, window B unless said)
1. Pooled net R a trade (gold and silver trades together) > 0.
2. t >= 2 on calendar-month sums of pooled net R (every month of the window counts, 0 where nothing closed; a trade's month is
   its exit month).
3. Same sign in window A: pooled net R a trade in 2008-15 > 0.
4. Both markets positive: net R a trade > 0 for gold and for silver separately.
5. Beats the placebo: 40 seeds (1..40); for each seed every real window-B trade of each market is replaced by the original's
   placebo trade (an entry at the next open after a day drawn at random from that market's window-B days with close > SMA200,
   held for the same number of trading days, exit at that day's open, the same 3 x ATR(20) stop, the same costs and financing);
   the pooled real net R a trade must exceed the 95th percentile of the 40 seeds' pooled means.

**Verdict**: PASS only if all five hold; FAIL otherwise. Also reported, not part of the bar: per market and window n, net R a
trade, net %, win rate, t on trades, t on month sums, stops, hold, financing share, worst drawdown in R, and results by year.
A PASS leads to a paper-shadow proposal only (`research/proposals/`), never a live change; a FAIL needs no proposal.

## Not changed after seeing results
The rule's parameters (10, 200, 5, 2, 3 x ATR20), the fill, the costs, the financing rule, the windows, the placebo and the pass
bar are fixed by this file. Anything looked at afterwards is labelled as such and is not evidence.

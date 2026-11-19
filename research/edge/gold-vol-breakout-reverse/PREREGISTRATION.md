# Pre-registration: gold-vol-breakout-reverse (14 Nov 2026)

Paper research only. A stand-alone question about a stand-alone intraday rule on spot gold. It is **not** a gate, exit,
entry or size of the live gold book (Gold trend + Gold daily engulf): owner decision 44 forbids further tests of that book
on its 2006-17 window, and this study reads none of the book's records or positions. Nothing live changes; no proposal
follows from this study alone.

Written and pushed alone, before any figure of the reverse trade was computed.

## Why

The daily gold volatility breakout (`gold-vol-breakout`, T1) passed its replication on 2007-15
(`gold-vol-breakout-replicate`: n 1,657, +0.111R a trade net, month t 3.19); pooled 2007-26 +0.073R (t 3.35), broad across
k (`gold-vol-breakout-k`). T1 places a buy stop and a sell stop around the UTC open; the first fill wins and **the other
order is cancelled**. The question here: on the days the T1 trade is stopped back at the open, is the cancelled order worth
keeping (a stop-and-reverse straddle)? It is a separate question about the days the base rule already loses on.

**Honesty.** Every window of the base rule has been read (2007-26, by three studies). The reverse trade has not: no study
in the repository has computed a single reverse trade. The test below is therefore a new question on read days, and its
in-sample / out-of-sample split guards against nothing about the base rule; it only splits the reverse trade's own record.

## The base rule (T1, unchanged)

`original.mjs` is a verbatim copy of `gold-vol-breakout`'s `run.mjs` (sha256
afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f, the same file the replicate and k studies copied). This
study's `run.mjs` imports its functions (`buildDays`, `daySkip`, `vbTrade`, `placeboTrade`, `rng`, `monthT`, `summary`,
`normP`, `holm`, `quantile`, `COST`, `EXIT_S`, `SEEDS`) and changes none of them.

- O = open of the first M5 candle from 00:00 UTC (before 01:00, else no trade); a day needs 200 candles 00:00-20:55.
- range = high − low of the previous UTC D1, weekend-folded (`council/fills.mjs` `foldWeekend`).
- Buy stop O + 0.5 × range, sell stop O − 0.5 × range, live on the 00:00-20:55 UTC candles; first filled wins (gap fills
  at the open; both in one candle: the level nearer its open). Stop at O; a fill candle that also reaches O is booked as a
  stop; a later candle opening through O exits at its open. Out at the close of the 20:55 candle (21:00 UTC).
- Costs $0.60 a round trip per ounce; financing `FIN.xau.long` × `nights` on buys (no trade crosses 22:00 UTC: 0). 2x reported.

Harness gate, before any reverse figure is read: T1 on 2007-01-01 → 2015-12-31 must equal the replicate's published T1
exactly (n 1657, net +0.111, gross +0.203, 2x +0.018, month t 3.19, gross t 5.96). If not, the study stops.

## The reverse trade (new)

On a day whose T1 trade is booked `how: 'stop'` (stopped at O before 21:00):

- The **stop-out candle** = the first candle, from the T1 fill candle on, whose range reaches O (the fill candle itself
  when it reaches O; this is exactly where the original books the stop).
- The opposite stop order, at its **unchanged** level (sell stop O − 0.5 × range after a stopped buy; buy stop
  O + 0.5 × range after a stopped sell), is live from the **candle after** the stop-out candle to the 20:55 candle.
  (Inside one 5-minute candle the order of prices is unknown, so the reverse order never fills in the stop-out candle.)
- Fill: the first candle whose range reaches the level; a candle opening through it fills at its open.
- Stop at O. A fill candle that also reaches O is booked as a stop at O; a later candle opening through O exits at its
  open. Out at the close of the 20:55 candle. Same costs, same financing rule (buys), 1R = |entry − O|.
- A day whose T1 trade ends at 21:00, or that has no T1 trade, has no reverse trade.

## Data

`xau-5m.json.gz`: OANDA mid XAU/USD M5, rows `[t, o, h, l, c]`, 2006-11-01 → 2026-11-13 (the replicate study's cache,
kept out of git). The day of the last candle is dropped as forming, as the original does.

## Windows

In sample **2007-01-01 → 2016-12-31**; out of sample **2017-01-01 → 2026-10-31** (the brief's split; November 2026 is
left out).

## Tests (out of sample, Holm over the three)

- **R1 (primary)**: the reverse trades alone. Statistic: net R a trade, t on calendar-month sums of net R.
- **R2**: the combined day against T1 alone. On every day with a T1 trade, d = (T1 net + reverse net, 0 if none) − T1 net;
  t on calendar-month sums of d over the months with a T1 trade; also reported: combined vs T1-alone net R a day, total,
  month t and worst drawdown.
- **R3**: the reverse trades whose first stop-out candle starts before 12:00 UTC.

p = one-sided normal p of each month t (the original's `normP`); Holm over R1, R2, R3.

**PASS (R1)** only if all hold:

1. Out-of-sample net month t ≥ 2 and Holm p < 0.05.
2. In-sample net R a trade of the same sign (> 0).
3. Out-of-sample net R a trade > 0 at 2x costs.
4. Out-of-sample n ≥ 150.
5. Beats at least 38 of 40 placebo seeds (real out-of-sample net R a trade above the seed's mean).

R2 and R3 are judged by the same five checks (R2: n = days; its placebo = R1's placebo trades added to the T1 days) and
reported; only R1 decides the verdict. A R3 pass without R1 is a hypothesis for its own pre-registration, not an edge.

## Placebo (40 seeds, the original's `rng`, seeds 1-40)

For every real reverse trade: a market entry at the **open of the same fill candle**, side by a fair coin, stop the same
distance away (the real trade's 1R), out at 21:00 UTC or the stop, the same costs (the original's `placeboTrade`). One
mean net R a trade per seed, out of sample. R3's placebo is the same draws restricted to R3's trades.

## Reported, not judged

- Gross, net and 2x-cost R a trade, month t (net, gross, 2x) per window; win rate; stops / time exits; median stop $.
- By year; by UTC hour of the first stop-out (n, how many reverse orders filled, net R a trade).
- How often the reverse fills: reverse fills / T1 stop-outs, per window.
- Buys vs sells.

A PASS would make the reverse order a candidate for its own forward paper record by the owner's decision; never a live
change. A FAIL closes the straddle question for this rule.

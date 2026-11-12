# What to expect: the live systems on the data they never saw

> **Clock correction, 10 Nov 2026.** `council/expect-base.json` was rebuilt on the corrected candle clock. The "backtest" block of four systems moved (Mosha BO, gold H4 trendline, daily engulf, momentum pullback); every untouched-data ("honest") figure except one trade of the momentum pullback is identical. Details: the last section of this page.

> **Financing and the supported book, 11 Nov 2026.** `council/expect-base.json` was rebuilt after the owner approved the edge review's decisions (docs/owner-decisions.md items 37 and 38). The figures of the four long-only gold systems are now AFTER overnight financing, by the method and rate of `research/edge/trend-breadth` Part A; five systems are marked shadow. The table below is the 8 Nov table, before financing. Details: the last section, "Financing (11 Nov 2026)".

Paper research only. No live rule, size, filter or mirror setting was changed. This folder builds `council/expect-base.json`,
which the Trader's Coach build turns into coach.json `expect` (pure `council/expect.mjs`, every 6 hours with the edge-decay
reading) and the Council research pane shows as the card **What to expect** next to the edge-decay statuses.

**Question.** The owner judges the forward paper record of each live system against its backtest, and every backtest here was
built on 2018+ or 2023+ data. The untouched-data studies (#508, #511, #512, #526, #530, #560 and the robustness audit #486) say
what each rule did, unchanged and after costs, on history it never saw. What should the owner expect per trade, per year and in
drawdown, and after how many trades can a forward record be judged at all?

## The table (8 Nov 2026; x1 costs; one point = one position)

| System | Honest window | n | R a trade (5–95% of the estimate) | In a year (5–95%) | Drawdown to plan for | Trades a year | Verdict in | Built on |
|---|---|---|---|---|---|---|---|---|
| Gold replica | 2017-22 out of sample | 115 | **−0.05R** (−0.55 to +0.45) | −24 to +22R | −24 to −40R | 19 | 59 trades (~8 months) only if it repeats its backtest +0.88R; the honest edge cannot be proven | +0.58R 2023-26 |
| Mosha BO | 2006-17 out of sample | 62 | **+0.14R** (−0.28 to +0.55) | −7 to +8R | −37 to −39R | 5 | never: +0.14R at t 0.55 would need 833 trades (~155 years); the backtest edge +0.01R cannot be proven | +0.25R 2018-26 |
| Gold trend | 2006-17 out of sample | 75 | **+0.49R** (+0.04 to +0.94) | −7 to +13R | −5 to −7R | 7 | not within 2 years (96 trades ≈ 15 years; 24 trades ≈ 5 years even at its backtest +1.64R) | +1.34R 2018-26 |
| Gold trend fast (shadow) | 2006-17 out of sample | 129 | +0.37R (+0.05 to +0.69) | −8 to +16R | −9 to −11R | 11 | not within 2 years (141 trades; 41 at its backtest) | +0.99R 2018-26 |
| Gold H4 trendline | 2006-17 out of sample | 402 | **+0.05R** (−0.05 to +0.14) | −10 to +13R | −19 to −26R | 35 | not within 2 years (306 trades ≈ 9 years even at its backtest +0.14R) | +0.17R 2018-26 |
| Gold daily engulf | 2006-17 out of sample | 256 | **+0.19R** (+0.02 to +0.35) | −8 to +16R | −16 to −22R | 22 | not within 2 years (286 trades ≈ 13 years) | +0.28R 2018-26 |
| Gold momentum pullback | 2018-22, before the rule was judged | 633 | **−0.04R** (−0.13 to +0.04) | −29 to +18R | −40 to −51R | 127 | not within 2 years (3,911 trades even at its backtest +0.04R) | +0.18R 2023-26 |
| NQ New York open run | 2004-22 untouched | 1,560 | **−0.02R** (−0.07 to +0.04) | −21 to +18R | −17 to −61R | 82 | 89 trades (~14 months) only if it repeats its backtest +0.33R; the honest edge cannot be proven | +0.32R 2023-26 |
| ICT A-setups | 2008-17 out of sample | 2,235 | **−0.01R** (−0.06 to +0.04) | −37 to +31R | −53 to −83R | 223 | not within 2 years (1,065 trades ≈ 5 years even at its backtest +0.09R) | +0.09R 2018-26 |
| Crypto trend (shadow) | June 2025 on, the decayed window | 20 | −0.13R (−0.53 to +0.26) | −8 to +5R | −11 to −14R | 14 | not within 2 years (37 trades ≈ 2.6 years at its 2017-26 backtest +2.80R) | +3.71R 2017-23 |

Reading it:

- **Only the two gold trend legs and the daily engulf kept a clearly positive edge out of sample**, and the trend legs are
  mostly a long-gold bet with a trailing exit (random long entries with the same exit made +0.28R; #530).
- **Six of the eight live systems made about nothing on untouched data** (Mosha BO's +0.14R has t 0.55 and loses −16.5R
  without its best 5 positions). Their forward record can only ever confirm or deny the *backtest*, never prove the honest
  edge: for the replica and the NQ run that takes 59 and 89 trades (8 and 14 months) if they keep doing what 2023-26 did. For
  the others not even that fits into 2 years.
- **Drawdowns to plan for are larger than the approvals said**: −24 to −40R for the replica, −17 to −61R for the NQ run
  (the 2014-22 flat years), −53 to −83R for the ICT A-setups.
- A forward record is placed against its band from 10 trades; the daily digest names a live system only when its record
  leaves that band (above or below), so the owner hears about it once it means something.

## Method

- **Records.** Each study's own per-position net R at x1 costs, unchanged: `research/edge/sizing/inputs.json` (ICT A-setups
  2008-26, NQ open run 2004-26, gold replica 2018-26, gold trend N20 and daily engulf 2006-26, copied there from #526, #511,
  #512 and #530), `gold-systems-oos/result.json` positions (gold trend N5, H4 trendline), `mosha-oos/result.json` positions
  (Mosha BO, OANDA 2006-26, #560), `robustness/out/gmp.json` (the audit's 2018-26 rebuild), `crypto-trend-decay/result.json`
  (closed positions). `tests/expect.test.mjs` checks every window's n, mean, t and drawdown against the published result.json tables.
- **Windows.** Honest = the data the rule never saw (for the crypto trend the window after the edge faded). Built on = the
  period the rule was built or judged on, from the same record and harness.
- **Per trade band**: mean ± 1.645 · sd / √n of the honest window (5–95% of the estimate). **In a year**: N · mean ± 1.645 ·
  sd · √N with N = the honest window's trades a year (what one year can realise). **Drawdown**: from the decay monitor's
  baseline MC95 (`council/decay.mjs` `mcDrawdown`: the 95th percentile of the worst drawdown over reshuffled orders of the
  baseline record, `council/decay-base.json` `mcDD`, i.e. what luck alone does if the backtest regime holds) to the worst
  drawdown the untouched history or the 8-year rebuild produced. **Verdict in**: n = (2 · sd / mean)², the trade count at
  which a forward record with that edge reaches t ≥ 2, at the window's trade rate, reported up to 2 years; given for the
  honest edge and for the backtest edge the decay monitor watches (`decay-base.json` `ref`, `sd`, `perYear`). An edge that
  needs more than 50 years of trades is reported as one that cannot be proven. **Forward**: the live record (coach.json
  `decay` `fwd`) against the honest band for its own n; placed from 10 trades.
- **Costs**: each study's own x1 (gold $0.30 a unit, NQ 1 point, ICT the micro-futures round trip, crypto Kraken fees).

## Files

- `build.mjs`: reads the records, writes `council/expect-base.json`, prints the table.
- `council/expect.mjs`: the pure maths and the coach.json block; `council/expect-base.json`: the numbers.
- `tests/expect.test.mjs`: the maths against the studies, the digest line, the trader and page wiring.

Re-run after a study changes: `node research/edge/expectations/build.mjs`.

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`.

**`build.mjs` was run again on 10 Nov 2026, after the decay baselines were rebuilt. Nothing in the method changed.** A control build on the old files reproduced the published `council/expect-base.json` exactly. `council/expect-base.json` holds the new numbers. What moved:

| System | Source | Before: n, R a trade, SD, worst drawdown, MC95 drawdown, drawdown limit | After |
|---|---|---|---|
| Mosha BO | robustness rebuild | 147, +0.009, 2.040, 39.2R, 37.5R, 39.2R | 157, −0.064, 1.969, 46.0R, 43.4R, 46.0R |
| Gold H4 trendline | robustness rebuild | 302, +0.142, 1.241, 19.2R, 19.4R, 19.4R | 304, +0.106, 1.169, 20.2R, 21.0R, 21.0R |
| Gold daily engulf | robustness rebuild | 217, +0.197, 1.698, 14.8R, 22.3R, 22.3R | 217, +0.198, 1.698, 14.7R, 22.3R, 22.3R |
| Gold momentum pullback | robustness rebuild | 1,003, +0.041, 1.282, 40.0R, 50.6R, 50.6R | 1,004, +0.043, 1.286, 40.1R, 49.7R, 49.7R |
| Gold replica, gold trend N20 / N5, NQ open run, ICT A-setups, crypto trend | council replays, daily candles, OANDA | unchanged | identical |

The momentum pullback's own two windows also moved by one trade: untouched 2018-22 window 633 trades at −0.043R became 634 at −0.043R; built-on 2023-26 window 370 at +0.185R (t 2.74) became 370 at +0.191R (t 2.80). No other untouched-data figure changed: they come from OANDA and daily-candle studies that never read the HistData files.

## Financing (11 Nov 2026)

The owner approved counting overnight financing in the paper costs and in these expectations ("yes anything that is better for
the system and that applies it", on `research/proposals/2026-11-11-edge-review.md`). `build.mjs` now charges every recorded
position of Gold trend, Gold trend fast, Gold daily engulf and the Gold H4 trendline (`gold-systems-oos/result.json`
`positions`; Gold trend and the engulf were read from `sizing/inputs.json` before, the same 134 and 451 records) with
nights x 0.0148 % x gold's daily close on the entry day / the position's initial risk: the rollover count (`nights`) and the rate
(`FIN.xau.long`) are those of `council/fills.mjs`, the same as `trend-breadth` Part A, first unit only. Nothing else in the method
changed; the other six systems' figures are identical to the 10 Nov file.

| System | Untouched window | n | Before financing: R a trade (t) | Financing a position | After: R a trade (t) | Built-on window after |
|---|---|---|---|---|---|---|
| Gold trend | 2006-17 | 75 | +0.489 (1.77) | 0.090R, 14.3 nights | **+0.398 (1.49)** | +1.23R |
| Gold trend fast (shadow) | 2006-17 | 129 | +0.372 (1.92) | 0.083R, 14.6 nights | **+0.289 (1.53)** | +0.88R |
| Gold daily engulf | 2006-17 | 256 | +0.186 (1.89) | 0.045R, 3.7 nights | **+0.141 (1.46)** | +0.23R |
| Gold H4 trendline (shadow) | 2006-17 | 402 | +0.048 (0.83) | 0.035R, 3.0 nights | **+0.013 (0.23)** | +0.13R |

These equal Part A of `research/edge/trend-breadth/result.json` (tests/expect.test.mjs compares them). Each system's entry in the
file carries `fin` (what financing took per position, the mean nights, the figure before it); the other systems carry
`fin: null`, and the file's `financing.notComputed` says why: the replica's, Mosha BO's and the momentum pullback's study records
carry no per-position risk, so their figures are still before financing (it would lower them); the NQ open run is out before
the rollover.

Limits: today's rate applied to every past year (the repository has no history of the broker's rate; at half the rate the
figures sit about halfway back); the add units are not charged (Part A puts the true cost of the trend legs about a third
higher); the "backtest" block, which comes from the decay monitor's baselines, is unchanged and does not carry financing.

`live` in the file now follows the owner's decision of the same day (item 37): Gold trend, Gold daily engulf and the ICT
A-setups; the gold replica, Mosha BO, the H4 trendline, the momentum pullback and the NQ open run carry `shadowSince`
`2026-11-11`. An expectation is not a rule: nothing here changes a trade.

### Follow-up, the same day: the replica, Mosha BO, the momentum pullback and the "backtest" block

The three systems left at `fin: null` above are now charged as well. What the note above said was missing is in the records
after all: `mosha-oos/result.json` `positions` carry the side, entry and exit time and `r0`; the replica's
`replica-oos/positions.json` (side, legs with their size and risk) lines up row for row with `sizing/inputs.json` (entry and
close time, 341 of 341); and the momentum pullback's entry price, risk and exit time are read from the rebuild's own functions
(`research/edge/decay-monitor/positions.json`). Same method: a buy pays nights x 0.0148 % x price / risk on its first unit (gold's
daily close on the entry day for the replica and Mosha BO, the rebuild's own entry price for the momentum pullback); a sell
pays nothing and is credited nothing. These three trade both sides and hold hours, so the charge is small.

| System | Untouched window | n | Before: R a trade (t) | Financing a position | After: R a trade (t) | Built-on window, before → after |
|---|---|---|---|---|---|---|
| Gold replica (shadow) | 2017-22 | 115 | −0.052 (−0.17) | 0.005R, 0.2 nights | **−0.057 (−0.19)** | +0.579 → +0.567 |
| Mosha BO (shadow) | 2006-17 | 62 | +0.137 (0.55) | 0.016R, 1.0 nights | **+0.121 (0.48)** | +0.253 → +0.216 |
| Gold momentum pullback (shadow) | 2018-22 | 634 | −0.043 (−0.86) | 0.009R, 0.2 nights | **−0.052 (−1.05)** | +0.191 → +0.178 |

No verdict changes: all three were flat or negative on untouched data and still are. The four long-only gold systems' figures
are identical to the table above. The "backtest" block now carries financing too, because the decay monitor's baselines were
rebuilt with it (`research/edge/decay-monitor/RESULT.md`, last section): Gold trend +1.64 → +1.50R a trade, Gold trend fast
+1.06 → +0.94R, daily engulf +0.20 → +0.14R, H4 trendline +0.11 → +0.07R, momentum pullback +0.04 → +0.03R, Mosha BO
−0.06 → −0.09R, replica +0.88 → +0.86R; the drawdown bands' lower ends follow (Gold trend 6.9R → 7.5R, daily engulf
22.3R → 25.5R). `financing.notComputed` now names only the NQ open run (out before the rollover), ICT and crypto (no rate
measured). Tests: `tests/expect.test.mjs` recomputes the three from their records with the study's own night counter.

# Pre-registration: the breakout sequence with QM breaks only (storyline-qm-sop)

Written 23 Nov 2026, before any code was written or any candle of a test window was read for this rule. Paper research
only: nothing live, no desk, no council member reads it. The rule is written in this repository's own words.

## Why
The breakout-sequence method (a break, a reversal break one timeframe lower, a confirmation break back) has been coded here
several times and failed (Mosha studies of 10 Nov, `desk-rigor` sequence −0.17R out of sample, `ltf-structure`). Those
versions took the reversal and confirmation from any break, read the confirmation on another timeframe than the reversal,
entered on an engulf close, and did not drop the two "bad confirmation" cases. This test is the sequence as the method
states it most strictly, once.

## The rule (closed candles only; a break = a body close beyond the level)
Swings: `edgekit.swings(bars, 3)` (3 candles a side, usable from their confirming candle). Structure breaks:
`edgekit.structure(bars, 3)`. QM ("BO Structure"): `edgekit.qms(bars, 3)`. Timeframes are UTC buckets of 5-minute candles
(`resample`). For a setup timeframe S the lower timeframe L is: H4 → H1, H1 → M30, M30 → M15.
1. **BO** = the latest break (BO or ChoCh, either type) on S; side = its direction. **BO zone** = from the broken level to the
   extreme of the leg the break came from (lowest low since the swing it broke, for a buy; mirror for a sell).
2. **VR** = the FIRST QM on L against the BO, completed after the BO candle closed and before any newer break on S. One VR
   per BO. **VR box** = the QM's zone (head to shoulder); **VR extreme** = its head (the top for a buy setup).
3. **CF** = the first QM on L with the BO after the VR, before a newer break on S and before a close on L beyond the VR
   extreme. Rejected (no trade, no second CF waited for), each counted: (a) the CF zone overlaps the VR box; (b) the CF zone
   does not touch the BO zone (no barrier).
4. **Entry**: a limit at the CF zone's near edge (its shoulder) placed at the CF candle's close; alive 24 L-candles;
   cancelled by a close on L beyond the CF head, or by price reaching the target first.
5. **Stop**: the CF head plus a buffer of one round-trip cost of the market (`COSTS`). **Target**: the VR extreme. Skip when
   the target is under 1R from the entry or the risk is under 3x the round-trip cost.
6. Fills and exits on 5-minute candles (`simulate`): stop first when one candle holds both; on the fill candle only the stop
   counts; a gap through the stop books the open; time exit after 5 trading days. One position at a time per market and S.

## Data, markets, timeframes
OANDA mid 5-minute candles in the toolkit cache, UTC. Gold (XAU/USD) is primary; EUR/USD, GBP/USD, USD/JPY, AUD/USD
secondary. In sample 2020-01-01 to 2023-12-31; out of sample 2024-01-01 to the last complete day in the cache.
The owner's lessons that shaped this rule came from 2026 charts, and earlier versions read 2020-25, so a **replication
window 2010-01-01 to 2019-12-31** is part of the pass bar.

## Costs and statistic
Round trip = `edgekit.COSTS` (gold $0.30, EUR/USD 0.6 pip, GBP/USD 0.8 pip, USD/JPY 0.8 pip, AUD/USD 0.6 pip), charged as
cost / initial risk on every trade; also run at 2x. Statistic: mean R a trade after costs; t of calendar-month sums of R
(months with no trade count as 0 inside each window). Also reported: n, win rate, by year, worst drawdown, R before costs.

## Tests (Holm over all four, on the out-of-sample month-t p values)
- **T1 (primary)**: gold, setup H1 (BO H1, VR and CF M30).
- T2: gold, setup H4 (VR and CF H1).
- T3: gold, setup M30 (VR and CF M15).
- T4: the four majors pooled, setup H1.

## Pass bar (each test, all must hold)
Out-of-sample mean > 0; out-of-sample month t >= 2 with Holm-adjusted p < 0.05; in-sample mean > 0; replication 2010-19
mean > 0; out-of-sample mean > 0 at 2x costs; at least 30 out-of-sample trades.

## Verdict words
- **PASS**: a test meets every line. It becomes a candidate for a forward paper record with its own pre-registration;
  never a live rule without the owner, never called an edge before that record.
- **FAIL**: T1 has 30+ out-of-sample trades and misses any line (secondary tests reported, not interpreted, unless they
  pass alone, which then names a hypothesis for new data only).
- **INCONCLUSIVE**: T1 has fewer than 30 out-of-sample trades, or a data hole over 5 days in a window.

## Not allowed after results
No change of swing size, timeframes, order life, buffer, target, filters or windows. No retry with the rejected CFs put
back, a direction filter or another exit on these years. Descriptive splits (rejection counts, case 2 trades, by year) may be
reported, labelled as such.

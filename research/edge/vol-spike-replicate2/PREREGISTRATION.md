# Pre-registration: second frozen replication of the volatility-spike rebound, on markets and years neither study used (14 Nov 2026)

Written and committed (alone) before any number of this study was computed. Paper research: nothing here is read by the
council, the mirror or the page, and no live rule changes whatever the reading. Not an ICT study.

## Why
`vol-spike-rebound` (#860, branch `vol-spike-rebound`) passed its bar on the pre-stated 10-day hold only (US indices
2016-26: +0.151R a trade, n 165, t 2.53). The first frozen replication `vol-spike-replicate` (#920) read PARTLY on seven
other indices (2016-26 t 1.20; 2005-15 -0.022R a trade, t -0.52). The multiple-testing update (branch
`multiple-testing-update`) put the hypothesis at a calendar-disjoint Fisher p of 0.026 (#860 p 0.0057 with #920 R2 p
0.698): suggestive, not standing (the family's Bonferroni line is 1.50e-4). This study runs the same frozen rule a second
time, on every (market, year) cell of the council's daily index cache that NEITHER study used, to see whether the evidence
firms up or fades.

## The frozen rule
- `frozen.mjs` = #860's `research/edge/vol-spike-rebound/run.mjs`, the same file #920 froze, copied byte for byte (sha256
  `339077aa9b4193eed610095fd75862195cf259c7ed29f78d4a26ac8f71beb8c1`, pinned in `tests/vol-spike-replicate2.test.mjs`).
  Never edited; this study's `run.mjs` imports its functions.
- Unchanged: RV5 > 2 x MED120 (values before the day) AND close < SMA20 on the signal close; fill at the next open; stop
  3 x ATR(20) below the fill, checked from the entry day, gap at the open; **hold 10 trading days only** (the hold that
  passed and that #920 froze), exit at the close of the 10th day; one position per market; a trade open on the last candle
  closed at its close. Weekend candles dropped. Indicators warm up on whatever history precedes a cell (as in #860 / #920).
  No parameter is chosen here.
- Costs: the frozen `net()`: spread in points a round trip (stated below) plus financing (DGS2 + 2.5 %) / 365 x entry a
  calendar night, the last DGS2 on or before the entry (none before 2006-01-06: 2.5 % alone, as the code does). #920 used
  the same US rate for every currency (no other rate series on file); so does this study.

## Gate (before anything else is read)
`gate920.mjs` = #920's `research/edge/vol-spike-replicate/run.mjs` copied byte for byte (sha256
`7b723b642a28104d81a0b61f8a0c475b1c337c66246304fadfd60ab30541495d`, pinned in the test; it imports the same `frozen.mjs`).
Its own `replicate()` run on #920's data (council-data `research/daily/{de40,uk100,eu50,fr40,au200,jp225,hk33}.json` and
`macro/cache.json` DGS2) must reproduce #920's committed `result.json` (branch `vol-spike-replicate`) exactly: `reading`,
`lastDay`, `R1`, `R2`, `R3`, `placebo`, `costs2x` and `markets`, JSON-equal (in particular R1 n 278, +0.056R, t 1.20; R2
n 303, -0.022R, t -0.52; R3 105 weeks, t 1.48). If it does not, nothing below is read and the study is reported as
"gate failed".

## The replication set (listed before any return was read)
Every index on file in council-data `research/daily/_index.json` (updated 7 Nov 2026; all candles end 2026-11-06 except
IN50) was checked against the cells #860 and #920 used. #860: SPX500, NAS100, US30, entries 2008-01-01 to 2026-11-06.
#920: DE40, UK100, EU50, FR40, AU200, JP225, HK33, entries 2005-01-01 to 2026-11-06. Unused, and so the replication set:

**N, new markets (all their entries; neither study used them):**

| key | OANDA instrument | candles on file | spread, points a round trip (stated) |
|---|---|---|---|
| us2000 | US2000_USD | 2003-03-24 to 2026-11-06 | 0.5 |
| ch20 | CH20_CHF | 2003-03-24 to 2026-11-06 | 4.0 |
| nl25 | NL25_EUR | 2008-01-21 to 2026-11-06 | 0.3 |
| es35 | ESPIX_EUR | 2016-12-02 to 2026-11-06 | 8.0 |
| cn50 | CN50_USD | 2011-08-30 to 2026-11-06 | 10.0 |
| sg30 | SG30_SGD | 2004-01-21 to 2026-11-06 | 0.4 |
| in50 | IN50_USD | 2011-08-26 to 2022-07-12 | 6.0 |

**E, earlier years of the markets the two studies used (entries those studies never counted):**
- SPX500 (1.0), NAS100 (3.0), US30 (4.0): entries before 2008-01-01 (#860's spreads).
- DE40 (2.0), UK100 (2.0), EU50 (2.0), FR40 (2.0), AU200 (3.0), JP225 (10.0), HK33 (15.0): entries before 2005-01-01
  (#920's spreads; these are #920's warm-up years, outside both its windows, so few trades are expected).

The spreads are stated, not measured, as #860's and #920's were: about 0.01-0.08 % of today's price (US2000 is a larger share
of its 2003 price; the cost is in points, as in the frozen code). The 2x-cost run covers the doubt. Entries after 2026-11-06
do not exist (no candle on file after it).

## Primary test (decides the verdict)
P = the frozen rule's trades of every cell of N and E, pooled (each market one stream, as the frozen `simulate` makes it; a
market of E is the same stream with entries before its cut kept). Month sums = the frozen `monthSums`: net R summed by exit
month, every calendar month from the month of the pool's first entry to 2026-11 counted (zero where no trade closed).
- **REPLICATES** if: pooled mean net R a trade > 0, AND t on the calendar-month sums >= 2, AND the pooled mean net R a trade
  is still > 0 at 2x costs (spread and financing doubled, R recomputed from the stored parts as #920's `twice`).
- **DOES NOT REPLICATE** otherwise.
- **NOT MEASURABLE** if the pool has fewer than 40 trades (the frozen `MIN_N`), with "(inconclusive: …)" naming why.

## Secondary (reported, not part of the verdict)
- Per market: n, mean net R, trade t, one-sided normal p, worst drawdown in R (closed trades in exit order) at 0 cost (no
  spread, no financing), base cost and 2x cost; Holm over every market row with n >= 10 (rows under 10 trades are reported
  and not tested).
- The pool split into C1 = N's entries from 2016-01-01 (the same calendar as #860's decisive window) and C2 = N's entries
  before 2016-01-01 together with all of E (years #860's decisive window did not cover): n, mean net R, trade t, month t,
  at base and 2x cost. Win rate, stops, by year.
- Trade t of the whole pool beside the month t.

## Placebo (reported beside the verdict)
40 seeds (`rng(9001)` … `rng(9040)`, the frozen generator): per market, the same number of trades as the rule took in that
market's replication cell, on signal days drawn uniformly from that cell's days that are NOT signal days of the rule (fill
at the next open), with the frozen `hold` (10 days, 3 x ATR(20) stop) and the frozen `net()` costs. The seeds' pooled mean
net R, 95th percentile, and how many seeds the rule's pooled mean beats. If the rule meets the bar but sits under the
placebo's 95th percentile, RESULT.md says so plainly.

## Fisher combination (the rule of `multiple-testing-update`, applied as it defined it)
Inputs as that study read them: #860 original p 0.0057 (its stored one-sided p of the 10-day hold, t 2.53, cell US indices
x 2016-26); #920 R1 t 1.20 (other indices x 2016-26, same calendar), R2 t -0.52 (other indices x 2005-15, calendar-disjoint);
a replication's p = 1 - Phi(t) from its stored two-decimal trade t (normal, one-sided). Fisher: -2 sum ln p on 2k degrees of
freedom. Overlapping data are never combined twice; replications on the same calendar stretch on other instruments are
combined only as a study pooled them. This study's cells:
- C1 (N x 2016-26) shares #860's decisive calendar: enters only the "all cells" upper bound.
- C2 (N before 2016 + E) is calendar-disjoint from #860's decisive window but shares 2005-15 with #920 R2 on other
  instruments. So this study pre-registers its own **pooled test Q = C2's trades together with #920 R2's trades** (the same
  frozen rule; #920's R2 trades rebuilt by the gated code), trade t, and the **pre-registered combined reading is Fisher over
  #860's p and Q's p** (k = 2). Beside it, as the update's code would pair them without the pooled test: Fisher of #860 with
  #920 R2 and of #860 with C2, each on its own, the weaker shown; and the all-cells upper bound (#860, #920 R1, #920 R2, C1,
  C2; it counts the same days on other instruments, so it overstates). Each compared with the family's Bonferroni line
  1.50e-4 (`multiple-testing-update`, N 333).

## What a result means
None of these readings changes anything live. REPLICATES would support #860's paper-shadow proposal (owner decision);
DOES NOT REPLICATE is written beside it as evidence against. The rule is not tuned on these data: no other vol multiple,
median length, SMA, stop or hold, no market added or dropped after the first run.

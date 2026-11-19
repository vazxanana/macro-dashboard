# Pre-registration: gold-vol-breakout-h4-side (14 Nov 2026)

Pushed alone, before any trade of this study was split by the H4 state. Paper research only: a filter question on a
stand-alone intraday rule, not a gate, exit, entry or size of the live gold book (owner decision 44 concerns that book; none of
its records are read). Nothing live changes; at most a proposal for the owner.

## Question

The owner's market-cycle idea: "if we are bullish on H4 and the pullback finished, focus only on buys, and vice versa". Does
taking the gold volatility breakout only on the side of the H4 trend improve it?

## The base rule (unchanged)

The `gold-vol-breakout` study's T1, as replicated on 2007-2015 by `gold-vol-breakout-replicate` (PASS, 2007-15 +0.111R a trade
net, n 1657, month t 3.19; pooled 2007 → 2026-11 +0.073R, n 3713, month t 3.35). Its `run.mjs` is copied verbatim into this
folder as `original.mjs` (sha256 `afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f`, pinned in `run.mjs` and the
test); its functions (`buildDays`, `daySkip`, `vbTrade`, `summary`, `monthT`, `normP`, `holm`, `rng`, `quantile`) are imported
and none is changed. O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC
D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins; stop back at O; out
at the 20:55 candle close; $0.60 a round trip per ounce, 2x reported; financing `FIN.xau.long` × `nights` on buys (0: no trade
crosses the rollover).

## Honesty about what has been read

Every window of the base rule has already been read: 2016-26 by `gold-vol-breakout`, 2007-15 by its replication, and the pooled
2007-26 record. Its per-trade results on every date are known. **The H4 filter has not been computed on any of it**: no study
has split these trades by an H4 state. So this is a test of the filter, not a fresh test of the breakout; a pass would say the
filter separates the base rule's trades on history already seen for the rule, and would need a forward record before anything
else. The verdict is judged on the whole record AND on both halves, so that one good stretch cannot carry it.

## The H4 state (known at 00:00 UTC)

- H4 candles are built from the M5 candles on 4-hour blocks aligned to 17:00 New York (block starts at 17:00, 21:00, 01:00,
  05:00, 09:00, 13:00 New York wall clock; New York offset by the US daylight-saving rule, `council/histdata.mjs`
  `nyOffsetH`, so 21:00 or 22:00 UTC for the 17:00 block). A block's close is the close of its last M5 candle. Blocks with
  fewer than 12 M5 candles (stubs at holidays or data holes) are dropped.
- Only blocks whose nominal end (start + 4 h) is at or before the day's 00:00 UTC are used: the block that holds 00:00 UTC is
  forming and never read.
- Break: H4 candle i breaks up when its close is above the highest close of the 20 H4 candles before it; down when below the
  lowest close of those 20.
- State: **bullish** when the most recent break among the used H4 candles is up, **bearish** when it is down, **none** when no
  break occurred among the last 60 used H4 candles (or fewer than 21 exist).

## Tests (two, Holm over two)

- **T1 (primary)**: the base rule's trade is taken only when its fill side agrees with the H4 state (buy on bullish, sell on
  bearish). Both stop orders stay placed; if the first fill is against the state, there is no trade that day and the other
  order is cancelled. A "none" day has no trade. So T1's trades are exactly the base rule's trades whose side agrees.
- **T2**: the same, but "none" days trade normally.
- **Comparison, not a test**: the against-side trades (the base trades T1 drops because their side disagrees).

## Windows and data

- Whole record 2007-01-01 → 2026-10-31. Halves: H1 2007-01-01 → 2016-12-31, H2 2017-01-01 → 2026-10-31.
- Data: OANDA mid XAU/USD M5 from the keyless candle proxy, 2006-11 on (the replication's cache, kept out of git).
- Market: spot gold only. Nothing else is tested.

## Statistics

- t on calendar-month sums of net R (the original's `monthT`), p one-sided from a normal approximation (`normP`), Holm over T1
  and T2 on the whole record.
- Kept against dropped: net R a trade of T1's trades minus the against-side trades, Welch t per half and whole (per trade;
  descriptive, trades of a day do not overlap).
- Placebo: 40 seeds (`rng(seed)`, seeds 1-40); each draws, from the base rule's trades of the whole record, a random subset of
  the same size as T1's kept set (without replacement), and its net R a trade is recorded.

## Pass bar (T1)

All of:
1. T1 net month-sum t ≥ 2 on the whole record, Holm p < 0.05 (over T1, T2);
2. T1 net R a trade higher than the unfiltered base rule's in H1 AND in H2;
3. T1 net R a trade > 0 in H1 and in H2;
4. T1 net R a trade > 0 at 2x costs on the whole record;
5. the against-side trades' net R a trade lower than T1's kept trades' in H1 AND in H2 (Welch t reported, not required ≥ 2);
6. T1's net R a trade above at least 38 of the 40 placebo subsets;
7. n ≥ 30.

T2 is reported with the same checks; a T2 pass alone is a hypothesis for its own pre-registration, not an edge.

## Reported

n, gross / net / 2x-cost R a trade, month t, by half and by year, worst drawdown, how many traded days the filter drops (and
how many are "none"), the state's share of days, the against-side comparison, the placebo distribution.

## Deliverables

`research/edge/gold-vol-breakout-h4-side/{PREREGISTRATION.md, original.mjs, run.mjs, RESULT.md, result.json}`,
`tests/gold-vol-breakout-h4-side.test.mjs`, `out/` rebuilt. Nothing else is touched.

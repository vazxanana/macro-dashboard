# Pre-registration: Daily storyline on gold (Daily rejection + H4 external break, H1 pullback QM entry)

Written 23 Nov 2026, before any code or any read of the test windows. Research only: no live rule, size, stop or council
file changes, whatever the result. The method is the owner's private material; this file describes the rule in its own words.

## Why this test, and how it differs from what failed
Earlier studies here failed on parts of this idea: `msnr-direction` (the direction call alone, 0 of 6), `msnr-entry` (that call as
a gate in front of an engulf entry), the desks' gold plan in `desk-rigor` (a Daily rejection + H4 break, then a 15-minute engulf
with a fixed 30-pip stop and 90-pip target: +0.079R out of sample, -0.042R in sample, FAIL), and `gold-drd-long` (Weekly bull +
a strong Daily close, buy the next open). This test keeps the same direction idea and changes only what none of them did: the
entry is the H1 pullback reversal (a QM), the stop is structural (beyond the QM head), and the target is the next fresh Daily
level, not a fixed number. One rule, fixed below; no variant is chosen after the result.

## Data
Gold (`xau`), OANDA mid 5-minute candles from the toolkit cache (`research/edge/_lib/edgekit.mjs`). Daily = `dailyNY` (17:00
New York trading days); H4 and H1 = `resample` of the 5-minute candles (UTC buckets); trades are simulated on the 5-minute
candles with `simulate`. Windows (by fill time):
- **In sample (IS)**: 2020-01-01 to 2023-12-31.
- **Out of sample (OOS)**: 2024-01-01 to 2026-10-15. The weeks from 15 Oct 2026 on are left out of every test because the
  owner's example that shaped this rule (the gold sell of late Oct to Nov 2026) sits there; they are reported apart.
- **Replication**: 2010-01-01 to 2019-12-31 (the rule was shaped on 2020-26 charts today, so it must also hold on older years).

## The rule (sells written out; buys mirror every step)
1. **Daily key levels.** (a) Daily swing highs: `swings(daily, 3)`, the high of the swing day, known from its confirming day's
   close. (b) Daily supply engulf zones: a bullish day, then within the next 3 days a day that closes below its low; the zone is
   the bullish day's range (low to high), known from that close. A level is **fresh** until any later day's high reaches it
   (a swing high: high >= its price; a zone: high >= the zone's low).
2. **Daily rejection.** The first day that reaches a fresh level (above) and closes back below it (below the swing high, or below
   the zone's low). Known at that day's close. The level is then spent.
3. **H4 external break.** The external low = the last H4 swing low (`swings(h4, 3)`) confirmed before the first 5-minute candle
   that reached the level. Bias = sell once an H4 candle closes below that low, at or after the touch and no later than the end
   of the next trading day after the rejection day. Bias starts at the later of the rejection day's close and that H4 close.
4. **Bias ends** at the first of: an opposite bias, a Daily close above the rejected level (the zone's high for a zone), a trade
   of this bias, or 10 trading days.
5. **Entry.** The first H1 QM sell (`qms(h1, 3)`, side -1) whose breaking candle closes after the bias starts and before it ends.
   A **limit sell at the QM's broken level** (the pullback into the QM zone), resting 12 H1 candles; cancelled if an H1 candle
   closes above the head first, or price reaches the target first.
6. **Stop** = the QM head + 0.01 % of price. **Target** = the nearest fresh Daily support below the entry (a Daily swing low, or
   the top of a fresh Daily demand engulf zone), known at the QM close. No target, or a target under 1.5R away = no trade.
7. **Time exit**: 10 trading days (240 hours) after the fill. One position at a time. Stop first when one candle holds both.

## Costs and statistic
Round trip `COSTS.xau` ($0.30) on every trade, plus overnight financing on buys (`council/fills.mjs` `nights` x `FIN.xau.long`,
today's rate for every year). Second check: 2x costs. Statistic: mean R a trade after costs; t of calendar-month sums
(`stats` `tMonth`, empty months count 0); p two-sided from that t.

## Tests (Holm over these four, on the OOS month-sum p)
- **Primary P**: the rule above.
- **S1**: entry at market at the QM close instead of the limit (same stop, target, exits).
- **S2**: P only when the Weekly structure agrees (`structure` on weeks built from `dailyNY` days, K 2, side known at the last
  completed week).
- **S3**: P with a fixed 3R target instead of the next Daily level.

## Pass bar (for P; a secondary passes only by the same bar and is then a hypothesis for its own test, never adopted here)
OOS mean > 0, OOS month t >= 2 with a Holm-adjusted p < 0.05, IS mean > 0, OOS mean > 0 at 2x costs, at least 30 OOS trades,
**and** the 2010-19 replication mean > 0.
- **FAIL**: the OOS mean is zero or negative, or the OOS month t is under 1, or the IS mean is negative.
- **INCONCLUSIVE**: positive in OOS but short of the bar (t under 2 after Holm, under 30 OOS trades, negative at 2x costs, or a
  negative 2010-19 replication).
Reported, never part of the verdict: buys and sells apart, by year, win rate, median stop and target in R, the 15 Oct - Nov 2026
weeks, the share of R from the ten best trades.

## What would not change after a result
Swing size 3, the 3-day engulf, the 1-day break window, the 12-candle limit life, the 1.5R minimum, the 10-day exit, the costs.
If a definition proves wrong in code (a bug), it is fixed and said in RESULT.md; no threshold is tuned. A no-look-ahead test
(change every price after a moment, the earlier signals must not move) runs before the windows are read.

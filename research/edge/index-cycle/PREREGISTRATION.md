# The owner's market cycle as an entry on US indices: pre-registration

Written and committed on 13 Nov 2026, before any trade of this study was computed. Paper research only: no live rule, size,
filter, stop, config or mirror setting is changed by this study, whatever it finds.

## Why

The owner's rule, in his words: "if we are bullish on H4 and the pullback finished, focus only on buys, and vice versa". Its
mechanical versions failed on gold: `research/edge/mosha-retrace/` (the retracement itself, +0.02R a trade, t 0.17),
`research/edge/mosha-cycle/` (the buy back with the H4 at the barrier, -0.22R, t -0.99) and the 13 Nov filter study (#815).
It has never been tested on US indices, which trend more and have a different cost structure. This study tests it once, as an
ENTRY: the moment the H1 pullback against the H4 move is over, trade with the H4.

What I already know, said plainly: I have read the gold results above. I have NOT computed anything of this rule on index
candles. Every definition below is taken from the gold studies or the live Mosha cycle (`council/mosha-cycle.mjs`
`cycleState`) or fixed by the brief I was given; nothing was tuned.

## Data

- OANDA mid H1 candles of `nas100`, `spx500`, `us30` (the CFDs on the Nasdaq 100, S&P 500 and Dow, 23 hours a day as OANDA
  serves them), fetched through the site's keyless candle proxy (`/md/bars`, 4,999-candle windows, complete candles only),
  October 2007 to 13 November 2026. Kept out of git (`fetch.mjs <dir>` writes `<market>-1h.json.gz`, rows `[t, o, h, l, c]`,
  `t` = the candle's UTC start).
- H4 candles are built from the H1 candles in UTC buckets (`floor(t / 14400)`); an H4 candle's close time is its bucket end.
- The 2-year Treasury yield, weekly, from council-data `macro/cache.json` `score.fred.DGS2` (FRED), copied once into
  `rates.json` beside this file.

## Windows

A trade belongs to a window by its EXIT time (as `trend-breadth-h1`). **Decisive: 1 Jan 2016 to the last candle (13 Nov
2026).** Replication: 1 Jan 2010 to 31 Dec 2015. Candles before 2010 are warm-up only.

## The rule. Written for a bullish H4 move (a BUY); a bearish one is the mirror image.

Constants: `W4 = 3` (H4 swing: 3 candles a side), `W1 = 1` (H1 swing: 1 candle a side, a three-candle swing, as mosha-retrace and
mosha-cycle), `ATR_N = 14`, `BUF = 0.1` x ATR, `MIN_R = 1`, `FIXED_R = 2`, `HOLD = 48` H1 candles.

1. **Swings** (as `research/edge/mosha-level/run.mjs` `swings`): a swing high at candle j is a high not below the `w` highs
   before it and strictly above the `w` highs after it; a swing low the mirror image. It exists from the close of candle `j + w`.
2. **BO** (as `research/edge/mosha-retrace/run.mjs` `boEvents`): a candle that closes above the most recent swing high that
   existed when the candle opened is a BO up; below the most recent swing low a BO down. Each level is broken once. The BO's
   time is the candle's close. Closed candles only.
3. **H4 bias:** the direction of the latest H4 BO (W4 = 3) whose time is at or before the moment considered.
4. **Pullback start (the H1 ChoCh):** after that H4 BO (H1 BO time strictly later than the H4 BO time), the first H1 BO
   (W1 = 1) against the bias.
5. **Pullback finished:** after the ChoCh, the first H1 BO back with the bias. If a newer H4 BO happened at or before this
   moment, the cycle belongs to the newer H4 BO and starts over (the older one gives no trade). Each H4 BO gives at most one
   signal.
6. **Entry:** at the open of the next H1 candle in the data after the "pullback finished" candle, in the bias direction only.
   No entry when that candle starts in the 17:00-18:00 New York hour (DST-aware), or more than 72 hours after the signal.
7. **Stop:** for a buy, the lowest low of the H1 candles from the ChoCh candle through the "pullback finished" candle, minus
   0.1 x ATR(14) H1 (the mean true range of the 14 H1 candles ending with the "pullback finished" candle). Sell: the highest
   high plus the same. Risk `r0 = entry - stop`. **No trade when the stop is not strictly on the losing side of the entry**
   (a gap past it).
8. **The H4 move's extreme** (as `cycleState`): the highest high (buy) of the H1 candles from the start of the H4 BO candle to
   the ChoCh candle, inclusive.
9. **Exit A:** target = the H4 move's extreme, only if it is at least 1R above the entry; otherwise no trade in this stream.
   **Exit B:** target = entry + 2R (always). Both: out at the close of the 48th H1 candle (the entry candle is the first).
10. **Fills on H1:** from the entry candle on, a candle that holds both the stop and the target is a stop (stop first); a candle
    that opens past the stop exits at its open; a candle that opens past the target exits at the target. No break-even, trail,
    partial or add.
11. **One trade at a time per market and per exit stream:** a signal whose entry is before the open trade's exit is skipped.

## Costs (per trade, in index points, then divided by r0)

- Spread round trip: NAS100 3, SPX500 1, US30 4 points; plus 1 point of slippage. So 4 / 2 / 5 points a round trip.
- Financing for every 22:00 UTC passed while the trade is open (entry before it, exit at or after it), weekends included (a
  calendar-day charge): `rate / 365 x entry price`. Long: `DGS2 + 2.5 %` a year; short: pays `max(0, 2.5 % - DGS2)` (no
  credit). DGS2 = the last weekly value on or before the entry date.
- `net R = gross R - (cost points + financing points) / r0`.

## Statistics

- Per exit stream, the three markets pooled (one row per trade). Per trade: n, mean net R, t of the trade means. **t used for the
  verdict: on calendar-month sums** of net R (months by exit, every calendar month of the window counted, empty months 0),
  t = mean / (sd / sqrt(months)).
- p = two-sided normal p of the monthly t. Holm over the 2 exits (A and B) in the decisive window.

## Placebo (40 seeds)

For each exit and each seed (seeded generator, seeds 1-40): every real trade of the decisive window is replaced by a random
one on the same market, in the same direction, entered at the open of a random H1 candle of the decisive window (uniform
over the candles whose open is not in the 17:00-18:00 New York hour and whose H4 bias at that open equals the trade's
direction), with the same stop distance r0 in points, the same target in R (Exit A: the real trade's planned R multiple;
Exit B: 2R), the same 48-candle exit, fills, costs and financing. The placebo trades are independent (no one-at-a-time). The
seed's statistic is the mean net R a trade; the 95th percentile of the 40 (linear between ranks) is the bar. This asks
whether waiting for "the pullback finished" adds anything over simply trading with the H4 bias.

## Pass bar (per exit)

All of: decisive pooled mean net R a trade > 0; monthly t >= 2; Holm-adjusted p < 0.05 (over the 2 exits); replication
2010-2015 pooled mean net R a trade > 0; decisive mean net R a trade above the placebo's 95th percentile.
**Verdict: PASS if at least one exit passes every line, else FAIL.** Per market figures and the twice-the-costs line are
reported, never decisive.

## What follows

A PASS is a proposal to the owner (`research/proposals/`), never a live rule (absolute rule 3). A FAIL ends this reading on
indices: no parameter will be varied after seeing the result.

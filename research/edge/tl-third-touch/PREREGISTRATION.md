# Trendline third touch inside an engulf zone, gold: pre-registration

Written and committed on 13 Nov 2026, before any trade of this study was simulated and before any candle of it was read.
Paper research only: no live rule, size, filter, council member, page or mirror setting is changed by this study, whatever
it finds.

## Why

The owner asked for a test of an entry the repository has never measured: a trendline drawn through the pullback back into a
4-hour engulf zone, taken on its third touch while price is inside the zone. The idea comes from the owner's private course
material; everything below is my own mechanical wording of it, and none of that material is copied here.

What I already know, said plainly.
- Zone mechanics alone found nothing on gold in the repository's earlier work (the engulf zone tests behind the live Gold daily
  engulf aside, which use a Daily zone and another entry). The 10 Nov Mosha studies (break-of-swing entries on gold) and the
  11 Nov MSNR entry study (engulfing entries) all lost after costs. I expect this one to lose too; it is run because the
  trendline is the one element none of them held.
- Gold rose strongly over 2020-26, so a buy-heavy stream that makes money proves little. That is why the test is read against
  a **control**: the same zones, entered on their first touch with no trendline. The question is whether the line adds
  anything.
- I have not computed a zone, a line or a trade of this rule on any data before writing this file.

## Data and windows

- OANDA spot gold (XAU/USD) mid candles, **H1**, UTC, through the keyless candle proxy (`/md/bars?sym=xau&tf=1h`), from
  1 Oct 2019 (warm-up) to the day of the run, fetched in windows of at most 4,999 candles, kept out of git
  (`node --use-env-proxy run.mjs fetch <dir>`). Candles the proxy marks `live` (still forming) are dropped.
- **H4 candles are built from the H1 file** in UTC buckets (`floor(time / 14400)`). An H4 candle counts as known at the end
  of its bucket (bucket start + 4 hours), never earlier.
- **Halves: A = 1 Jan 2020 to 31 Dec 2023, B = 1 Jan 2024 to 31 Oct 2026** (the last whole month before the run). A trade
  belongs to the half of its entry time; trades entering after 31 Oct 2026 are not counted. Nothing is fitted on either half:
  every number below is fixed here.

## The zone (H4), buy side; the sell side is the exact mirror

Swings on H4: a candle is a swing high when its high is at or above the highs of the 2 candles before it and strictly above
the highs of the 2 after it (swing low: mirror). It is **known** at the close of the second candle after it.

1. **First break.** At each H4 close, take the most recent swing high known at that moment that no close has gone above yet.
   An H4 candle that closes above it is the first break (level `S`).
2. **The zone candle.** The leg runs from the swing high's candle to the break candle. Its origin is the candle with the lowest
   low in the leg (the first one on a tie). The zone candle `Z` is the last **red** H4 candle (close below open) at or before
   the origin, searching back no further than the swing high's candle; none found = no zone. **Zone = Z's high to Z's low.**
   One zone per zone candle (a later first break naming the same `Z` adds nothing).
3. **ISL.** The high of the H4 candle right before `Z`. Some H4 close after `Z`, up to and including the second break, must be
   above it.
4. **Second break.** After the first break, wait for a swing high whose candle is at or after the first break candle and whose
   level is above `S`; the first H4 close above the most recent such swing high (known at that close) is the second break.
   It must come within **30 H4 candles** of the first break, and its close must be above the zone's high.
5. **Dead before it lives.** An H4 close below `Z`'s low before the second break kills the zone.
6. **Live.** The zone is live from the end of the second break's H4 candle (`Tc`) until the first of: an H4 close below `Z`'s
   low (known at that candle's end), 120 H4 candles after `Tc` (20 trading days), or the stream's trade on that zone.

Sell side: a green zone candle at or before the leg's highest high before a close below a swing low, ISL = the low of the candle
before `Z`, two breaks down, the zone killed by an H4 close above `Z`'s high.

## The trendline entry (H1), buy side

H1 pivots: a candle is a pivot high when its high is at or above the highs of the 3 candles before it and strictly above the
highs of the 3 after it; it is known at the close of the third candle after it.

- Only pivot highs whose candle opens at or after the start of the second break's H4 candle count (the pullback after the
  move).
- Each time a new counting pivot high `p2` becomes known, a line is drawn through it and the counting pivot high before it,
  `p1`, when `p1`'s high is **above** `p2`'s (a falling line) and `p2` is at least **N = 6** H1 candles after `p1`. The new
  line replaces any earlier one. If one of the three candles that confirmed `p2` already had a high at or above the line's
  value at that candle, the line was touched before it was known: it is dropped.
- `p1` and `p2` are the first two touches. The **third touch** is the first H1 candle after `p2` was known whose high reaches
  the line's value at that candle (the line projected straight through `p1` and `p2`, by candle count). A touch consumes the
  line whatever happens.
- **Inside the zone**: the trade is taken only when the line's value at the touch candle is within the zone (at or above `Z`'s
  low and at or below `Z`'s high) and the zone is live. Otherwise no trade from that line.
- **Entry at the line price**: a buy when price trades up to the line (a stop-type order resting at the line). The fill is the
  line's value at that candle, or the candle's open when it opens at or above the line; a fill above the zone's high is no
  trade.

Sell side: rising line through two higher pivot lows, the third touch from above, a sell at the line, a fill under the zone's
low is no trade.

## The control

The **same zones**, no trendline: a buy limit at the zone's high from `Tc`; the first H1 candle (opening at or after `Tc`)
whose low reaches the zone's high while the zone is live fills it at the zone's high, or at its open when it opens below the
zone's high. Same stop, target, time exit and costs.

## The trade (both streams)

- **Stop**: $0.30 beyond the zone's far side (buy: `Z`'s low - 0.30), from the zone only, never from the line. A fill at or
  through the stop is no trade. Every trade has a stop.
- **Minimum risk**: no trade when the fill is under $1.00 from the stop.
- **Target**: 2R from the fill. **Time exit**: the first H1 candle opening 72 hours or more after the entry candle's open
  exits at its open. The stop never moves.
- **Candle by candle**: a candle opening through the stop exits at its open; a candle reaching both the stop and the target
  counts the stop; on the entry candle only the stop is checked (worst case; the target is not credited there).
- **One trade at a time** in each stream: a candidate entering at or before the close of the stream's previous trade is
  skipped. Candidates are taken in entry-time order.
- **Costs**: $0.30 a round trip, in R of the trade's own risk. **Financing on buys** by `council/fills.mjs` (`nights` from
  entry to exit, times `FIN.xau.long`, times the fill price, over the risk); sells are charged and credited nothing.
- R per trade = gross R less the two costs ("net").

## The tests (fixed: two, Holm over both)

- **T1, the trendline stream on its own**: net R a trade above 0 in A **and** in B, and the t of the calendar-month sums of net
  R over Jan 2020 to Oct 2026 (a month with no trade counts 0) at least 2.0. p = one-sided normal p of that t.
- **T2, the line adds something**: the trendline stream's mean net R a trade over 2020-26 above the control's, Welch t at least
  2.0. p = one-sided normal p of that Welch t.
- **Holm** over the two p values; each must be under 0.05 after Holm.
- **Placebo**, 40 seeds (seed 20261113 + k): for each seed, the same live zones get a random entry instead of the line: one
  H1 candle drawn uniformly among the candles that open after `Tc`, while the zone is live, and whose range overlaps the zone;
  the fill is uniform inside the overlap of that candle's range and the zone; then the same trade rules, costs and one-at-a-time
  rule. The trendline stream's mean net R a trade over 2020-26 must be above the placebo's in at least **38 of 40** seeds.

**PASS** = T1 and T2 both hold and both survive Holm, and the placebo condition holds. Anything else is **FAIL** (there is no
inconclusive grade). Reported, not tested: each half for both streams, buys and sells apart, gross R, the funnel (zones,
lines, touches, touches inside the zone), year by year.

## What follows

A FAIL is reported as such: no proposal, no live change. A PASS gets a proposal
(`research/proposals/2026-11-13-tl-third-touch.md`) for the owner to read; it still changes nothing live. Any later variant
(another N, another pivot size, a fixed line rule of another kind) needs its own pre-registration on data this study did not
read.

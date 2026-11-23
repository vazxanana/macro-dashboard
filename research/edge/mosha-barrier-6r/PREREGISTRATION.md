# The Mosha desk's barrier entries at 1R, 3R and 6R targets, gold 2010-2019 (pre-registered 23 Nov 2026)

Written and committed alone, before any trade of this study was computed. Paper research only: nothing live reads it.

## Why

The Mosha desk records its barrier entries three times, with a 1R, a 3R and a 6R target (CLAUDE.md, "The barrier with a 6R
target"). The 6R reading was chosen after a 60-day look at gold, EUR/USD and GBP/USD (+0.112R a trade before costs, 2026) and
is now copied to a cTrader demo account ("Mosha 6R barrier on a demo account"). No year before 2026 has been read for it. This
study runs the desk's own code on gold 2010-2019, years none of the barrier picks looked at.

## Data

OANDA mid gold (`xau`) candles from the edgekit cache (`research/edge/_lib/edgekit.mjs`, filled by `fetch-cache.mjs`): 1-minute
and 5-minute 2009-2020, daily (raw UTC days, as the desk reads them) 2008-2019. 15-minute, 30-minute, 1-hour and 4-hour candles
are built from the 5-minute ones in UTC buckets (a bucket only once its last 5-minute candle is on file). If the 1-minute
history does not reach a year, that year's M1 confirmations are read on M5 and RESULT.md says so. The data-quality exclusions
(`research/edge/data-quality`) concern 2020 on; none falls in 2010-2019 for gold.

## The entries (the desk's code, imported, not edited)

`assets/mosha-sop.js` and the page's own analysis functions (`council/mosha-desk.mjs` `loadFns`), exactly as the desk runs the
6R reading in `deskTrades`: the one-candle structure (`oneCandle(F)`), the CF / VR zones handed over by `sopTrades` on the same
structure (`cfOut` → `extra`), `barrierTrades(B, F1, { extra, rr })`, `uniq`, and only the entries whose target is the fixed one
(|target − entry| / r0 = rr), which is what `r6BarrierTrades` keeps. The same call is made with rr = 1, 3 and 6. Entry, stop
and fill are the code's; the outcome is the code's own `outcome` (stop first in one candle, a candle opening beyond the stop
exits at its open, a limit's fill candle can only stop it, no time exit).

Run year by year: for year Y the candles start early enough for every timeframe's look-back (`SOP.BACK`, the daily as far as the
cache reaches) and end 6 months after Y so trades can finish; a trade is kept when its entry time t is in Y. A trade still open
at the end of its candles is left out and counted.

Pairing: an entry is the same entry under two targets when side, entry time, entry price and stop are equal.

## Tests (judged BEFORE costs; R a trade; t on calendar-month sums)

Discovery 2010-2014, confirmation 2015-2019.

- **T1**: the 6R reading. Pass: mean R > 0 and month-sum t >= 2 in BOTH halves.
- **T2**: 6R minus 1R, paired by entry (each paired entry's R at 6R minus its R at 1R; summed by month). Pass: mean difference
  > 0 and month-sum t >= 2 in both halves.
- **T3**: the 3R reading, as T1.

Holm over the three tests: each test's p = the one-sided p of its month-sum t over 2010-2019 pooled; a test passes only if its
two halves pass AND its Holm-adjusted p < 0.05.

**Placebo** (T1 and T3): the same entries with the side flipped (same entry price and time, the stop mirrored to entry +
(entry − stop), the target mirrored at the same R), run through the same `outcome` on the same candles. A test that passes is
called INCONCLUSIVE instead if its placebo also has mean R > 0 with month t >= 2 in both halves, or if the placebo's mean R is
at or above the real one.

**Verdict**: PASS if T1 passes (the 6R reading itself); FAIL if no test passes; INCONCLUSIVE if only T2 or T3 passes, a placebo
fails the test above, or fewer than 100 6R trades a half.

## Reported beside, not judged

- After costs: COSTS.xau of `research/edge/combo-grid-2/run.mjs` (0.30 a round trip), R − 0.30 / r0.
- By barrier timeframe (`h`: D1, H4, H1, M30, M15) and with / against the direction (`withDir`: true, false, none), for 1R, 3R
  and 6R.
- Win rate, worst drawdown, by year; how many entries pair across targets.
- A cut test: the run on candles cut at a fixed moment gives the same entries (side, time, entry, stop, target) before it.

No variant (another target, another structure, another market) is tested on these years after this run.

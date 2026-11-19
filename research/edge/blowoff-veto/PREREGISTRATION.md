# Blow-off veto on the Gold Macro Score (pre-registration, 19 Nov 2026)

Written and committed before any result is computed. Owner (19 Nov 2026): "there still other documents I've sent you that you can
learn fundamental strategies and how to predict or increase the chances to be correct". The owner's macro skill (the Gold Macro
Score's own rule book) lists a **blow-off veto**: no new BUY while gold is stretched, and calls the round-6 vetoes "fitted to
those misses, so provisional" (the misses were 28 Jan 2026 and 20 Oct 2025). Nothing in the repository has tested it. This study
asks whether it raises the chance that a BUY reading is right, on data it was not fitted to.

## Data (fixed)
- Gold: council-data `research/daily/xau.json` (OANDA daily closes, 2006 on). Dollar index: `council/macroscore.mjs` `dxyDaily` on
  the five pairs of `research/daily/`. Yields: council-data `macro/cache.json` `score.fred` (weekly DFII10, DGS2, DGS10, 2006 on).
- The score: the council's own `council/macroscore.mjs` pieces (`weeklyFrame`, `expandingZ`, the four drivers), one value each
  Friday, expanding z-scores (no look-ahead). A parity check: the last value equals `goldMacroScore(...)`'s.
- Outcome: gold's log return from that Friday's close to the close four Fridays later (the score's own 4-week horizon).

## The veto (the skill's numbers; the implied-volatility clause is left out: no gold volatility history is on file)
Flag a Friday when, on daily closes up to and including it: close > 1.15 x its 50-day average, OR the 20-session change > +20 %,
OR the 7-session change > +10 %.

## Test
- **Window**: 2007 to the end of 2024, before the misses the veto was fitted to. 2025-26 is reported apart, as in sample.
- BUY weeks = score > +0.25. **Primary**: among BUY weeks, the 4-week return of flagged weeks minus unflagged weeks; slope of a
  regression of the return on the flag, Newey-West t with 4 lags (the windows overlap). **Pass** = slope < 0 with t <= -2, AND the
  long-or-flat book (long gold 4 weeks after each BUY week, weekly-rebalanced, overlapping quarters) has a Sharpe with the veto not
  below the one without.
- Reported, not tested: each of the three clauses alone; all weeks (not only BUY weeks); the number of separate episodes (runs of
  consecutive flagged weeks), since a few episodes can carry the result.

## Limits said in advance
- Flagged weeks are rare (a handful of episodes in twenty years); a pass on few episodes would still be thin evidence.
- No costs (the score is a weekly reading, not a trade); nothing live changes whatever the result (absolute rule 3).

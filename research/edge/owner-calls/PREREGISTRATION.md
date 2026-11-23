# Owner calls: how the decision journal will be judged (pre-registration)

Written 23 Nov 2026, before the journal holds a single call. Nothing below may be changed once the first call is stamped;
a change after that is a new study with its own date, and the old reading is reported beside it.

## The question

Does the owner's choosing add value? When the owner looks at a setup and says "take" or "skip", do the taken setups do
better than the skipped ones, and do the taken ones make money after costs? The studies so far found no mechanical rule
that passes on untouched data; the hypothesis left is that the edge, if there is one, is in the choosing
(`research/proposals/2026-11-20-discretion.md`, `research/edge/discretion`, which found 0 decisions stamped before their
outcome). The journal (`api/journal.js`, rules in `assets/ms-journal.js`, private store file `journal/decisions.json`)
exists to collect those decisions. This file fixes, now, how they will be read.

## The unit

- One **call** = one record of `journal/decisions.json`: market, side, action (`take` / `skip`), entry, a stop on the
  losing side, optional target, timeframe, method, reason, confidence, and `at` = the SERVER's clock at the moment the call
  was saved. The page cannot set `at`; side, levels, action, method, reason and confidence cannot change after it.
- Only calls of the owner's account are judged here. Another account's calls, if any, are read the same way, each account
  apart, and are never pooled with the owner's.
- A call counts only when it was stamped **before its outcome**: its result is read on candles that START at or after `at`
  (the journal's `outcome`), and the entry must be reached from the stamp on. A call whose result cannot be read from
  candles after its stamp is not a unit.

## Exclusions (fixed now)

- **Withdrawn** calls (taken back within the journal's 2 minutes; the record stays, marked `withdrawn`) are excluded from
  every test. Their count is reported beside the result, with how many of them would have been stops, so a habit of
  withdrawing after a bad first move is visible.
- **Pending** calls (the entry was never reached) are excluded: no trade, no result. Their count is reported per side.
- **Open** calls (entry reached, neither stop nor target yet) are not judged until they resolve; counted and reported.
- Invalid records (no distance between entry and stop) are excluded and counted.
- Nothing else is excluded: no call is dropped for being large, early, late, on a news day, or on a market that did
  unusually well or badly.

## The result of a call

- R = the journal's `outcome` on 5-minute candles joined to hourly ones (`joinBars`): on the fill candle only the stop
  counts; after it stop first when one candle holds both, a gap through the stop fills at the open; R = move / opening
  risk (`|entry - stop|`). A call with no target can only end at its stop (it stays open, then is reported as open).
- A **skip** is scored exactly as if it had been taken (the counterfactual): same entry, stop, target, same candles.
- **Before costs**: R as above.
- **After costs**: R minus the round trip in R, cost / `|entry - stop|`, with the toolkit's figures
  (`research/edge/_lib/edgekit.mjs` `COSTS`, price units a round trip: gold 0.30, EUR/USD 0.00006, GBP/USD 0.00008,
  USD/JPY 0.008, AUD/USD 0.00006, silver 0.03). The journal also allows the Nasdaq 100, which has no entry there: it is
  charged 1.5 index points a round trip (the ICT lab's NQ figure), fixed now. Gold buys held over a rollover also pay
  `council/fills.mjs` `financing`. Skips are charged the same costs as takes. The cost table in force on 23 Nov 2026 is
  the one used, even if the toolkit's figures change later.

## The primary test (the only one judged)

Taken minus skipped: mean R of resolved **taken** calls minus mean R of resolved **skipped** calls, after costs, Welch t.

- **When**: first at **100 resolved calls on each side** (taken and skipped), then again at **200 a side**. Not before:
  under 100 a side every report says "too few to judge" (the journal page's own 20-a-side floor is a display rule, not
  this test). Between and after the checkpoints the figures may be shown, never judged.
- **Pass** (all three, after costs):
  1. taken mean R > 0;
  2. taken minus skipped > 0 with Welch t >= 2;
  3. both hold in sign in each half by time: the resolved calls split at the median stamp `at` into an earlier and a
     later half, and in each half taken mean > 0 and taken minus skipped > 0.
- **Fail**: any of the three not met. A fail at 100 a side is reported as such; the 200-a-side reading is still made and
  reported, and the later reading stands as the verdict (the first is not overwritten in the record; both are shown).
  There is no third checkpoint and no "nearly passed".
- Before-costs figures are reported beside every after-costs one, never judged.
- **What a pass means**: the owner's taken calls beat the skipped ones by more than chance on this record, after costs.
  It is still a forward record of one person's choices on the markets and months it covers, not a tested rule, and it
  changes no live rule, size or system by itself (absolute rule 3).

## Reported, not judged

- **By method** (the call's `method` text, as written) and **by confidence**: n, mean R before and after costs, taken
  minus skipped. A group under 20 resolved calls a side says "too few". No group is tested, ranked for a verdict, or
  picked as "the one that works": with many groups one will look good by chance. A group that looks good is at most a
  hypothesis for its own pre-registration on later calls.
- By market, side, timeframe, hour (UTC) and desk source: the same, reported only.
- Whether higher confidence goes with higher R: shown as a table, not tested.
- Counts of pending, open, withdrawn and invalid calls, per side.

## Picked examples are never evidence

- A winning call shown on a chart, a screenshot of a good trade, a lesson sent with a trade, a "look at this one":
  none of these is a unit of this study, and none is ever quoted as evidence that the owner's choosing works. They are
  chosen after the outcome is known; a hundred losing look-alikes can sit behind each one (the 10 Nov Mosha studies found
  the owner's five winning examples among thousands of mechanical look-alikes that lost).
- Only calls stamped by the server before their outcome count. A trade written down after it closed, a call added from
  memory, a desk's paper record, a ChronosTrade replay trade or a backtest is not a call.
- No subset is ever selected after looking (best month, best method, best market, "the calls I was sure about") and
  reported as the result. The result is the whole record under the rules above.

## What this does not do

Read-only on the journal file; nothing here places, sizes, copies or blocks a trade, and no council member reads it.
No call or its text is ever committed to the repository (public): only aggregate counts and figures are published.
The analysis script is written after this file and before the first checkpoint, and implements exactly these rules.

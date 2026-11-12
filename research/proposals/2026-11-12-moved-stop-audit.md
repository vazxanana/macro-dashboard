# Moved stops: where else 1R is read from a stop that has already moved (12 Nov 2026)

An audit, four small accounting / display fixes, and one proposal for the owner (docs/owner-decisions.md item 51, which follows
item 50 of the NQ open-run report). It follows `research/proposals/2026-11-12-nq-open-r0.md` (branch `nq-open-r0`, item 50),
which found that the NQ open run's loop works out its risk as `|entry - stop|` from a stop its trail has already moved. The
question here: does the same defect sit anywhere else? Proof: `tests/moved-stop-audit.test.mjs` and the "moved-stop audit"
tests at the end of `tests/ctrader-mirror.test.mjs` (offline, hand-made candles, one management call per candle as the live
runner and the quick pass run the Trader). Nothing of ICT was edited (Fred's edge: read and reported only). No entry, stop,
target or exit of any system changed; no stored record was rewritten.

## In plain words

1. **The Trader's own management is sound everywhere but the NQ open run.** Every other loop that moves a stop (the generic
   "Manage open trades" loop: trails, the Coach's break-even, `beAt`, the pyramid add; and the three moves made outside it:
   the gold trend ratchet, the crypto trend ratchet, the LIT swing break-even) reads a risk `r0` that was stamped before the
   stop could move: at the push for every system with a moving stop, or on the first managed candle for the engine setups
   (`tr.r0 || (tr.r0 = ...)`, before any trail or break-even line runs). The two research loops (replica research, the other
   research rows) work out `|entry - stop|` on every run but never move a stop. The tests run each case candle by candle and
   all at once, from records saved and read back between runs, and get the same result.
2. **Costs, financing, the daily replay and ICT are sound.** `tradeCost` / `financing` divide by the record's `r0`; the only
   path to `|entry - stop|` is a closed trade with no `r0`, and the Trader stamps `r0` on every trade it manages (council-data
   of 12 Nov: 0 of 15 closed trades with a moved stop lack `r0`; the NQ open run's records are never costed by
   `annotateCosts`). The replay (`council/backtest.mjs`) keeps its stop and `r0` fixed and moves only each exit variant's own
   stop. ICT (`ict/tracker.mjs`, `ict/replay.mjs`) stores `r0` with every signal and reads it for R, mfe and the trail.
3. **Four readers read 1R from the moved stop: fixed** (display / measurement only):
   - the mirror's fill quality (`slipR`, read by the forward protocol's E3 check and `executionStats`) divided the fill's
     slippage by the distance to the council's stop at the moment of the copy (a gold trend position copied after its daily
     ratchet read 2 points worse on a 40-point risk as 0.2R instead of 0.05R);
   - the daily digest's floating R and the Edge analyst's "stop it opened with" for the NQ open run (no `r0` on file: the
     analyst would have been shown the trailed stop, above the entry of a buy);
   - the Desk's floating / live R on the Active trades card, the trade table, the guest's gold trade card and the "R now"
     list (a stop at the entry gave "+InfinityR now");
   - the reconciliation report called an ICT copy whose trail passed the entry "on the wrong side of the entry" when the
     record had no `stop0` (the older ones).
   One helper, `openRisk(x)` in `council/fills.mjs` (copies in `api/_edge-analyst.js` and the page, compared by a test): the
   stamped `r0`; else `|entry - stop|` while the stop has not moved; else the first stop `stop0`; else, for the NQ open run,
   half the distance to its 2R mark; else unknown (the figure is left out).
4. **Two copy decisions of the demo mirror read 1R from the moved stop: proposed, not changed** (item 51, below). One of them
   can leave a demo copy with its stop on the losing side while the council's trade has a profit locked in.
5. **Effect so far: none.** On council-data of 12 Nov (all five mirror accounts, 495 copies kept, 30 days): no copy was made
   of a trade whose stop sat past its entry, no copy was skipped because of the moved-stop reading (two "has run" skips, both
   of trades whose stop never moved), and none of the 354 stored `slipR` values changes under the fix (largest difference
   under 0.0015R). No closed record is affected anywhere. The fixes and the proposal are about the next trade that reaches
   a trail or a ratchet before it is copied or read.

## Every place checked

| Place (line numbers on this branch) | What it computes after the stop can move | Verdict | Proof |
|---|---|---|---|
| `council/trader.mjs:641` generic "Manage open trades" loop (replica live, Mosha BO + run, Mosha cycle, gtl, geg, gmp, gtrend / gtrend5 exits, crypto exits, LIT, engine setups) | R at stop / time exit, gapR, mfe, mae, trail, Coach break-even, `beAt`, add level | Sound: `r0` stamped before the first stop move | `generic Trader loop …`, `generic loop: a record pushed WITHOUT r0 …` |
| `council/trader.mjs:659-669` pyramid add | add entry `E ± addAt × r0`, add `r0` | Sound | `pyramid add (addUnit) …` |
| `council/trader.mjs:804` gold trend ratchet (+ its add) | stop lifted outside the loop | Sound: `r0` at the push | `stops moved OUTSIDE the loop …` |
| `council/trader.mjs:762` crypto trend midpoint ratchet | same | Sound: `r0` at the push | same (text check) |
| `council/lit.mjs:346` LIT swing break-even | stop to entry outside the loop | Sound: `r0` in `litRecord` | same |
| `council/trader.mjs:613` retire legacy | R at retirement | Sound: `tr.r0 \|\|`, stamped while managed | text check of every stop move |
| `council/trader.mjs:692` replica research loop | R from `|entry - stop|` each run | Sound: the stop never moves | `Trader text: …` |
| `council/trader.mjs:1138` other research rows (Daily Cycle, gold New York run) | same | Sound: the stop never moves | same |
| `council/trader.mjs:1998` NQ open run (+ regime shadow) | R, mfe, trail from `|entry - stop|` | **Defect: item 50** (branch `nq-open-r0`) | its own test; pinned as found here |
| `council/fills.mjs` `manageLive`, `addUnit`, `sizeR`, `expireOrder` | as the Trader's loop | Sound (parity-tested to the trader's text) | as above |
| `council/fills.mjs` `tradeCost`, `financing`, `annotateCosts` | cost and financing in R | Sound: `r0`; no closed moved record lacks it | `costs and financing …` |
| `council/fills.mjs` `rowFinancing` | financing of replay rows | Sound for moved stops (replay rows keep the opening stop); see "Left as is" for `stop0` | same |
| `council/fills.mjs` `replayBar` / `manageVariant`, `council/backtest.mjs` | variants' stops, mfe | Sound: `tr.stop` / `tr.r0` never move | `the daily replay …` |
| `council/ctrader-mirror.mjs:413` `fillQuality` | `slipR` | **Fixed** (opening risk) | `moved-stop audit: fill quality …` |
| `council/ctrader-mirror.mjs:267` `riskVolume` | lots and cash at risk of a NEW copy | Sound: the copy's real risk is from its fill to the council's stop now | n/a |
| `council/ctrader-mirror.mjs:719` late-copy check | "run more than 1R" | **Proposal 51 (b)**: reads R from the moved stop | `… item 51 (b) …` |
| `council/ctrader-mirror.mjs:737` market copy's relative stop | the demo stop of a new copy | **Proposal 51 (a)**: a stop past the entry is placed on the losing side | `… item 51 (a) …` |
| `council/ctrader-mirror.mjs:579` `ensureStop`, 2c stop moves | absolute stop, ICT moved by the same distance | Sound (signed) | existing mirror tests |
| `council/ctrader-reconcile.mjs:71-97` | tolerances, ICT "moved", wrong-side check | **Fixed** (report only) | `reconciliation: …` |
| `council/forward.mjs:74` | floating R of the book | Sound: gtrend / geg carry `r0` | n/a |
| `council/digest.mjs:88` `r0Of` (floating R, ICT net) | floating R | **Fixed** for the NQ open run | `digest: …` |
| `council/review.mjs`, `council/spotcheck.mjs`, `council/alerts.mjs` `levels`, `council/futures.mjs` | post-mortem R, alert text, tickets | Sound (`r0`) or sent before a move (open tickets within 15 min of the fill) | read |
| `api/_edge-analyst.js` `stopAtEntry` | the stop the model is told the trade opened with | **Fixed** for the NQ open run; an unknown opening stop is not studied | `edge analyst: …` |
| `market-structure.html` (7189, 7309, 7752, 8407) | floating / live R, planned R:R | **Fixed** (display) | `page: …` |
| `market-structure.html:7840` trade chart dialog | its own `r0` / `stop0` reading | Sound (already handles moves) | read |
| `ict/tracker.mjs`, `ict/replay.mjs` (report only) | R, mfe, trail | Sound: stored `r0` | read |

## The proposal: item 51

**(a) A market copy of a trade whose stop already sits past its entry.** The mirror copies an open council trade with a
RELATIVE stop: `relativeStopLoss = relative(from - t.stop)`, and `relative()` keeps only the distance. When the council's stop
has moved past the entry (a trail that locked a profit) the broker therefore puts the demo stop the same distance on the
LOSING side of its fill. The council's trade cannot lose any more; the copy can lose that whole distance, and it is sized as
if that tiny distance were its risk. Nothing corrects it later: the fill carries a stop (so the stop guard is not called) and
the mirror records the council's level, so step 2c sees no move to follow (test: a council buy from 1.1000 with its stop
trailed to 1.1012 gets a demo stop at 1.09892 under its 1.10012 fill, and still has it a round later).
When it happens: for a council trade only when the snapshot has no fresh price for the market (otherwise the late-copy check
skips any trade whose stop is past its entry: it always reads as more than 1R run); for an **ICT A-setup always**, because
ICT copies never have a council price (futures levels) and skip that check. An ICT A-setup is copied late after a wait
(market closed, the 20-minute settle after a reopen, the open-copy cap, the daily loss stop, a new or reset account); if its
trail passed the entry meanwhile, the copy goes out this way. A break-even stop exactly at the entry is never copied (the
mirror refuses a zero distance). This is absolute rule 1 ground ("never loosen a trailed stop"), on the demo account.

Proposed change (`council/ctrader-mirror.mjs`, step 3, before the market order is built):

```diff
         const sell = t.side === 'sell', sgn = sell ? -1 : 1, isIct = String(t.id).startsWith('ict:');
+        // a trade whose stop already locks a profit is not copied as a market order: the copy's stop would sit on the losing side
+        if (!pending && sgn * (t.stop - t.entry) >= 0) { skip(`the council's stop ${t.stop} is already past the entry ${t.entry}: a copy now would be a different trade`); continue; }
```

**(b) The late-copy check reads "1R" from the moved stop.** `ran = (mark - entry) / |entry - stop|` with the stop as it is
now. After a ratchet that is still under the entry (Gold trend's daily lift, a crypto midpoint) the distance is shorter
than the opening risk, so a trade 0.8R (of its opening risk) into its move reads as 1.6R and is skipped, against the rule's
own "more than 1R into the trade is skipped". The copy it prevents would be correct: it is measured from the council's
price to the council's current stop and sized on that distance. Proposed: `const R = riskAtOpen(t) || Math.abs(t.entry - t.stop)`
on that line (`fills.mjs` `openRisk`, imported in the mirror as `riskAtOpen`, because the round already has a local `openRisk`
= cash at risk). Effect: more catch-up copies of ratcheted trades (zero so far).

- Recommended: (a) and (b) together. (a) only removes copies that cannot be right; (b) makes the guard measure what it
  says. Both are demo-mirror decisions (which trades the demo account opens), so they wait for the owner.
- If applied: the two "item 51" tests at the end of `tests/ctrader-mirror.test.mjs` change on purpose (they record today's
  behaviour); nothing else in the suite reads these lines.
- If nothing is decided: nothing has happened yet on council-data; the first ICT A-setup copied after its trail passed the
  entry gets a demo stop on the losing side.

## Left as is, said

- **`stop0` on the replica's rows is not the opening stop.** On the replica (live and research) `stop0` is the level BEFORE
  the round-number step (`trader.mjs` line 1067); the opening stop is `stop`. `rowFinancing` reads `r0`, else `stop0`, else
  `stop`, so 16 of the 212 replica rows of `research/replay-2w.json` are charged financing on a risk up to 10 % too small:
  -0.036R in all (10.835R charged against 10.799R). Changing it would need the decay baselines rebuilt with it (a record and
  its baseline are costed alike), which is more than the amount is worth; `openRisk` (the readers' helper) already prefers
  `stop` while the stop has not moved. The live replica carries `r0`, so its costs are right.
- The open-alert text (`alerts.mjs` `levels`) and the futures ticket show the stop at the time of the alert; both are sent
  within 15 minutes of the fill.
- The copy ticket on the trade dialog ("Stop … (risk …)") shows the distance to the stop now, which is the risk of a copy
  made now; unchanged.

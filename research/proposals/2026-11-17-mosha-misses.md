# Why the council's Mosha systems did not take the Mosha trades you took (17 Nov 2026)

You asked: "I've been taking good trades on mosha so I don't understand why u not catching them." This is the answer, trade by
trade in a private file and as counts here. **Nothing live was changed**: no rule, no Trader line, no config. The repository
is public, so no trade's time, price or note is written here; the trade-by-trade table was given to you in the session.

## What there was to compare

- **Your trade log on the Mosha desk is empty.** The log file was never written (it is not in the store's backup of every
  file, nor in the new file store). So: **0 trades logged, 0 logged before the outcome (`pre`)**; no n, R or t to show. The
  desk's verdict needs 20 `pre` trades to say anything, and the arithmetic of 14 Nov says about 150 to judge (item 27).
- **Luxus's lessons: 4, none with levels** ("Give the levels" was never used). One lesson's levels exist only as the desk's
  reading of his picture, with five yes / no questions still unanswered.
- So the trades compared are **six**: the five worked examples you and Luxus shared (late October to 10 November, all gold),
  and the one trade in Luxus's lessons that the desk could read levels from. All six were picked after the fact.
- The council's own records: every version of `trades.json` and `research.json` since council-data's history starts
  (1 Nov), and the Mosha chain state every two hours. And a replay: the Trader's own Mosha BO block and `council/mosha-cycle.mjs`
  run every 5 minutes on OANDA gold candles from 20 Oct, closed candles only, the same 720-candle windows the Trader reads;
  its chain states match what the live council published.

## What the council did

- **Mosha BO recorded nothing from 1 to 17 Nov**, not even a shadow: its chain (H4 BO, then an H1 BO the other way, then an
  M15 BO back) never completed. From 5 to 12 Nov it waited for an H1 sell BO; from 12 Nov for an H1 buy BO.
- **The Mosha cycle recorded one trade**, and it came from bad data: gold's feed fell back to the crypto exchange's gold
  token from Sunday 15 Nov to Monday 16 Nov evening, whose weekend candles made an H4 break on a Saturday and an H1 turn
  that spot gold does not have. On spot candles the replay finds **no signal of either system from 5 to 17 Nov**.
- None of the six trades happened while the system that could have taken it was live (Mosha BO from the night of 4 Nov,
  the cycle from 11 Nov); the replay answers what each would have done.

## Why each of the six was missed, counted

| Reason | Trades |
|---|---|
| **No H1 break in the engine's sense** (the trade's turn was on M5; the engine's H1 break needs a close past the protected swing of a 6-candles-a-side structure, which came days later and $140-250 away) | 4 of 6 |
| — of those, against the H4 (a retracement trade: Mosha BO never trades against the H4; the cycle only after the H1 turn) | 2 |
| — of those, with the H4 inside a pullback the engine never saw on H1 | 2 |
| **Seen: same move, same side, within a day** | 2 of 6 |
| — the cycle took the earlier entry of the same move, before your sweep; the sweep stopped it, and the cycle takes one trade per leg per H4 move, so it did not sell again | 2 (both) |
| — Mosha BO signalled 20 minutes after your entry, blocked by the **weekly filter** and the **slow-pullback filter**, with a stop past the M15 origin **5.5 times** wider than yours | 1 |
| Blockers on the signals seen: weekly 2, slow pullback 2, one-per-leg cap 2, target room 0, price 0 | — |

Stops: yours ran $4 to $28 (median about $9); the council's signals $9, $9 and $56.
Results: your five examples +2.1R to +16.4R (one closed by hand); the sixth's result was not given. The council's versions on
the same candles: −1R and 0R on the earlier entry, +2.35R on the wide-stop signal (which would have been a shadow); four no trade.

## What your trades share that the rules lack

1. **The trigger is on M5**: a sweep of a prior high or low, the M5 VR, the CF out of it, an M5 break; the engine waits for a
   break of major structure on H1 (6 candles a side), which in these weeks came two days late or not at all.
2. **Half of them trade the retracement against the H4** (the "first half" of the cycle), on that M5 trigger, without
   waiting for H1 to turn.
3. **The stop sits just past the zone of the break** (a few dollars), not past the origin of the break.
4. **You take the second chance**: after a failed first entry, the same move again once the sweep is done.

## Would one rule change catch most of them?

**Yes, by construction, and it is already tested.** Replace the H1 turn with your M5 trigger (sweep, VR, CF, entry at the
zone of the break, stop past the zone) and all six are in. That is what `research/edge/mosha-sweep` tested (2006 to 2026, net
of $0.30: about 6,300 trades at the CF, −0.11R a trade, t −4.6; about 6,500 at the zone, −0.21R), and `mosha-select` split it
by with / against the H4 break, session and target distance (0 of 18 cells positive), and `mosha-retrace` tested a 3-candle
H1 turn (+0.02R, break-even). The pattern prints about five times a trading day; these six are among the winners of those.
**That these six would be caught proves nothing**: they are picked after the fact, and any rule built to catch them would
be fitted to them. A change goes live only after its own pre-registered study (2020 to now, net of costs, in sample against
out of sample) and your decision (absolute rules 3 and 4).

## The one study left, written as a proposal (not run)

What none of the 33 Mosha tests combined: the cycle's **live H4 leg and its two targets** with your **M5 trigger**, and **a
second entry per H4 move**. If you want it run (item 55, option b):

- **Pre-registration first** (`research/edge/mosha-m5-cycle/PREREGISTRATION.md`, pushed before any result).
- Data: OANDA mid gold, M5 / M15 / H1 / H4, 2020-01-01 to the day of the run; in sample 2020-2023, out of sample 2024 on.
- H4 move = the last H4 BO of `msAnalyze(bars, 6)` (the live engine, unchanged). Inside it, on M5: a sweep of the last
  3-candle swing high (low), the VR (from the extreme to the last 3-candle swing before it), the CF (a close out of the VR
  within 12 hours), then a limit at the next M5 swing broken after the CF (the zone of the break), stop $0.30 past the zone.
  Leg A (against the H4): target the H4 50%. Leg B (with the H4, after a leg-A trade closed or the H4 50% traded): target
  the H4 extreme. A target under 2R away: no trade. At most one open trade; up to three entries per H4 move.
- Costs $0.30 a round trip (and $0.60 as a check), stop first when one candle holds both, fills on M5.
- Bar: out-of-sample t ≥ 2 on calendar-month sums after Holm over the two legs; positive in both halves; positive at
  twice the cost; not carried by one year.
- **Prior, said plainly**: `mosha-sweep` and `mosha-select` cover the trigger and the H4 split, so a pass is unlikely.
  The recommendation is option (a): measure your own selection by logging trades before they close (item 27), which no rule
  can stand in for.

## Found on the way (a plumbing question, item 56)

The Mosha detectors read whatever feed the round has. On the fallback feed (the gold token, which trades on weekends) they
build H4 and H1 structure from weekend candles. Proposal: gold's two Mosha systems record nothing while gold is on the
fallback feed (one condition at the top of each block). No rule changes on spot candles.

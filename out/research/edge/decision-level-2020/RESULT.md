# Decision Level after the Daily close, 18 markets, 2020 to now (pre-registered)

**Verdict: FAIL. 0 of 2 pass: confirmation 2024-now T1 (strict) n 2,635, -0.015R a trade after costs, month t -0.59; T2 (broad) n 16,371, -0.020R, month t -1.25.**

Pre-registration: `PREREGISTRATION.md` (committed alone before any code). Run: `node research/edge/decision-level-2020/run.mjs run <dir>`
on the edgekit candle cache (OANDA mid 5-minute candles, 2019-01-01 to 22-23 Nov 2026), 18 markets pooled, costs of
`research/edge/combo-grid-2/run.mjs`, fills in the data-quality bad intervals dropped. Figures are R a trade after costs,
month-sum t (calendar months by fill month). Research only: nothing live changed.

## The rule, in one line

A trading day rejects a fresh Daily key level (wicks it, body wholly on the other side; known at the Daily close); the newest
H4 approach gap breaks; a limit at that gap is placed after the close; stop beyond the reversal extreme; 2R.

## Tested (pooled, 18 markets)

| Test | Discovery 2020-23 | Confirmation 2024-now | At twice the cost | Holm p | Pass |
|---|---|---|---|---|---|
| T1 strict (newest untouched gap, one order, 2 days) | n 3,622, -0.035R, t -1.44, PF 0.95 | n 2,635, -0.015R, t -0.59, PF 0.98 | -0.054R | 1 | no |
| T2 broad (every broken gap, retests, 5 days) | n 22,479, -0.050R, t -3.37, PF 0.92 | n 16,371, -0.020R, t -1.25, PF 0.97 | -0.053R | 1 | no |

Neither version is positive in discovery, so neither reaches the confirmation step on the bar. Win rate about 35 % at a 2R
target, close to the 33 % a 2R target needs to break even before costs.

## Descriptive (not tests)

- **Other targets**, confirmation: T1 1R -0.020R (t -0.98), 3R +0.010R (t 0.33), 4R +0.010R (t 0.27); T2 1R -0.022R,
  3R -0.027R, 4R -0.028R. Discovery is negative at every target for both.
- **Gold alone**: T1 n 318, -0.010R, PF 0.98 (2020-23 n 192, -0.020R; 2024-now n 126, +0.005R, t 0.03); T2 n 1,946,
  -0.008R (2020-23 +0.021R; 2024-now -0.053R, t -0.82). About 45 T1 trades a year on gold, against the dozen a year of the
  owner's notes: this coding is wider than theirs, which also used another feed and 2012-2026.
- **Per market (T1, all years)**: best usdjpy +0.153R (n 332, t 1.72) and audusd +0.132R (n 378, t 1.78); worst eurusd
  -0.215R (n 374, t -2.98) and xag -0.177R (n 328, t -2.48). Seven of 18 markets above zero: the spread of a null.
- **Control C, entered before the Daily close** (break before the close, the day's outcome unknown): n 5,748, -0.038R,
  month t -1.78 (2024-now -0.059R, t -1.81). Split by how the day then closed (a label that uses the close, so not a rule):
  days that closed as a rejection +0.228R (n 4,197, PF 1.39), days that did not -0.757R (n 1,551, PF 0.20). This repeats
  the owner's warning exactly: the intraday entry looks good only on the days one already knows rejected, and waiting for the
  close (T1) gives the move away: the reaction happens before the close.

## Checks

- **No look-ahead**: the gold orders rebuilt on candles cut at 2023-06-01 equal those of the full run for every order that
  expires before the cut (T1 291, T2 1,342, C 257 orders: identical). Only complete trading days and H4 candles are read;
  everything an order uses is closed by its placement. `tests/decision-level-2020.test.mjs` repeats the cut test on made-up
  candles.
- **Stops**: every order has its stop on the losing side of its entry (checked before each simulation).
- Fills whose stop distance at the fill was under twice the cost (an open just beyond the entry next to the stop) are not
  counted: 46 of 7,174 T1 fills, 164 of 44,157 T2 fills, 3 of 6,572 C fills. Orders still open at the end of the data: 2.

## A coding defect found after the first run, fixed before this report

The first run set the target at 2R from the planned entry, so a limit filled at a better open (a gap through the entry)
had its target measured from the wrong price (a few trades booked 20R), and one GBP/USD fill at an open exactly on the stop
divided the cost by a risk of 2e-16. The pre-registration says 2R from the fill; the simulation was rewritten to measure every
target from the fill and to skip fills thinner than twice the cost (above). The first run also failed: confirmation T1
n 2,663, -0.024R, t -0.85; T2 n 16,156, -0.018R, t -1.13.

## What it means

Coded this way, on 2020-2026 and 18 markets, the Decision Level entry after the Daily close is about zero before costs and
slightly negative after them; no market or target makes it pass. Do not test variants of it on these years. Never call it an
edge. What the owner's notes report as a profit factor near 1.2 on gold did not repeat here (gold T1 PF 0.98).

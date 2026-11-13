# Mosha cycle (`mcycle`), the live rule's own backtest: pre-registration

Written and committed on 13 Nov 2026, alone, before any candle of this study was read and before any number was computed.
Paper research only: no live rule, size, filter, stop, config, baseline or council file is changed by this study, whatever
it finds. The live paper system `mcycle` stays as the owner chose it (docs/owner-decisions.md item 48).

## Why

The Mosha cycle has traded on paper as a main system since 11 Nov 2026 with **no base study**: the decay monitor and "What
to expect" say so (`MS_NO_BASE`), and the rule book says never to invent a baseline for it. The earlier studies of the
owner's cycle (`research/edge/mosha-retrace`, `research/edge/mosha-cycle`, 10 Nov) tested related but DIFFERENT rules (H1
entries, an engulf barrier, HistData candles); none of them is the code that trades. This study measures the code that
trades, exactly as it trades, so that a forward record could one day be read against an honest baseline.

What I already know, said plainly: mosha-retrace broke even (+0.02R a trade, t 0.17) and mosha-cycle lost (-0.22R, t -0.99)
on gold 2020-26. Nothing below was chosen from them: every number of the rule is the live code's, and the test, window,
costs and bar are fixed here before any run.

## The rule: the live code, imported, never copied

- `council/mosha-cycle.mjs` `cycleTrades` and `cycleBlockers` are IMPORTED and run unchanged (H4 move = last H4 BO; the H1
  ChoCh = first H1 BO the other way; leg `pull` = first M15 / M5 BO with the pullback after it, limit at the broken level,
  stop $0.30 past its origin, target the H4 50%; leg `main` = after that, the first M15 / M5 structure flip back with the
  H4, target the H4 extreme; `MIN_RISK` $0.50; `FRESH` 1 h).
- The BO events come from `council/engine.mjs` `msAnalyze(bars, 6)`, imported, run as the Trader runs it: on the last
  OANDA candles of each timeframe (the Trader reads 720 a timeframe, the last one still forming; here the 719 closed ones,
  which give the same kept events because the Trader drops any event on the forming candle; the test proves it), mapped to
  events by the Trader's own `ev` mapping (event time = the close of the break candle; `flip` = `structure`).
- The Trader's block is reproduced by a harness of a few lines (the id `xau-mcycle-<leg>-<H4 break time>` taken once, only
  `fresh` signals, the target `t1` = the cycle's target when `room`, else 2R; `cycleBlockers` with the price at that moment,
  no owner shadow). The harness is checked against the Trader's text in the test.
- Decision clock: the Trader runs about every minute; here once at every M5 close (a trigger becomes visible to the Trader
  only when its candle has closed, which is always an M5 close). The H1 candles handed in are the closed ones (the Trader's
  `slice(0, -1)`).

## Data

OANDA mid spot gold (XAU/USD) through the keyless candle proxy (`/md/bars`, UTC alignment), M5, M15, H1 and H4 fetched
directly (no candle built here), from enough history before 2020 to fill the 720-candle windows, to the last complete UTC
day. `node --use-env-proxy run.mjs fetch <dir>`; the cache stays out of git.

## Fills and exits (the Trader's management loop, `council/fills.mjs` `manageLive`, imported)

- On M5 candles (the Trader uses 1-minute candles when it has them; M5 here, by choice: when one candle holds both the stop
  and the target, the stop is taken first, as `manageLive` does).
- Orders are placed at the decision close and managed from the next candle; candles while spot is shut or in the rollover
  minutes (`spotSkip`) are skipped; a fill candle that also reaches the target without opening through the entry is
  `missed` (0R, not a trade); the order expires 24 h after it was placed (checked after the candles, as the Trader does);
  out after 72 h from the fill at that candle's close; no break-even, no trail, no add.
- The cap blocker reads the system's own stream as it stands at that moment (the trades this harness has placed and not
  yet closed); a shadow (any blocker) is managed too but is not part of the stream judged here.
- Costs: $0.30 a round trip on every filled trade, in R of its opening risk; plus overnight financing on buys from
  `council/fills.mjs` `financing` (`nights` x `FIN.xau.long`, today's rate for every year); sells pay and earn nothing.
  Sensitivity: twice the cost. A trade still open at the data's end is left out and counted.

## What is judged

The live stream (signals with no blocker), filled trades only. Reported: leg `pull`, leg `main`, and the combined stream;
each in sample 2020-01-01 to 2023-12-31 and out of sample 2024-01-01 to the end, by the trade's EXIT time: n, win rate,
net R a trade, total, profit factor, worst drawdown (closed, trade order), t on calendar-month sums (every calendar month of
the window counts, a month with no closed trade counts 0). Also, descriptive only: the shadow signals by blocker, before-cost
figures, twice the cost, and each year.

**Pass bar (one test, the combined live stream):** net R a trade above 0 in BOTH halves AND t >= 2 on the calendar-month
sums over the whole window 2020-01 to the last complete month. Anything else is FAIL. The legs alone and every other figure
are descriptive and cannot turn a FAIL into a PASS. Even a PASS would be a backtest, not a forward record, and changes
nothing live: the owner decides.

## Outputs

`run.mjs`, `result.json`, `RESULT.md` (verdict line first, with n and t), and `positions.json`: one row per filled live
trade, `[t, o, c, R, side, leg]` = signal time, fill time, exit time (unix seconds), net R, +1 buy / -1 sell, leg. Not wired
into `council/decay.mjs`, `council/expect-base.json` or any live file; RESULT.md says how it could be, as a separate,
owner-approved change.

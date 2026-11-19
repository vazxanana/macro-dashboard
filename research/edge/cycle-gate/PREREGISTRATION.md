# The market-cycle gate: trade only with the H4 move once its pullback is over: pre-registration

Written and committed on 13 Nov 2026, alone, before any trade of this study was split, any gate state was computed on a trade,
or any figure of this study existed. Paper research only: no live rule, size, filter, council member, page, config or mirror
setting is changed by this study, whatever it finds (absolute rule 3). A system that passes gets at most a **proposal** in
`research/proposals/` for the owner to decide.

## Why

The owner, 13 Nov 2026: "Do improvements on all the edges based on what happened this week, and now knowing market cycles:
if we are bullish on H4 and the pullback finished, focus only on buys, and vice versa." In the week of 9-13 Nov the live
paper book lost three trades, all gold BUYS (Gold daily engulf `xau-geg-1793664000` and `xau-geg-1794096000`, H4 trendline
`xau-gtl-1793836800-1794182400`) while gold fell from about 4,150 to about 3,870 in an H4 down move.

What I already know, said plainly.
- Three losses in one week are an anecdote: the question is whether the gate separates good trades from bad ones over years.
- Earlier direction filters failed here: `msnr-direction` (0 of 6, a direction call as a filter on forward returns),
  `mosha-retrace` (the H4 BO / H1 retracement chain as its own trade, break-even), `mosha-cycle` (FAIL), `regime-switch`
  (a near miss on the engulf only, second half t 1.43), `macroscore-overlay`. So I expect this gate to fail too.
- I have not split any system's trades by this gate, nor looked at a gate state on any trade.

## Item 44 and the windows

Item 44 (owner, 12 Nov 2026): no further gate is tested on the gold book's 2006-17 window. This study reads **2020-01-01 to
now only**. Every trade source below is cut at its entry time >= 2020-01-01. The gold book's systems (Gold trend, Gold daily
engulf) ARE in this study, but only on 2020 → now: those years are in sample for those rules (built on), so even a pass on
them is weak evidence, and the RESULT says so.

- **First half**: entries 2020-01-01 to 2023-12-31. **Second half**: entries 2024-01-01 to the end of each source.
- The Gold replica's only record is the council replay (`research/replay-2w.json`, 2022-12-27 to 2026-11-03): its first
  half is 2023 alone. It is tested on what it has; said in the result.

## The gate (mechanical, closed candles only, no look-ahead)

Candles: OANDA mid H1 and H4 of the trade's market through the site's keyless candle proxy (`/md/bars`, UTC buckets as
served), from 2019-06-01 to the run date, complete candles only (the forming one is dropped), fetched once by
`run.mjs candles <dir>` into a scratch folder outside git. The same candles for every system of a market.

Breaks of structure are `boEvents` of `research/edge/mosha-retrace/run.mjs`, **imported, not copied**: a break is a candle
CLOSE beyond the most recent swing high (low) that was confirmed when that candle opened (a swing of `w` candles a side,
confirmed once the `w` candles after it have closed), each swing level broken once; the event's time is the close of the
breaking candle. H4 uses `w = 3` (the H4 swings of mosha-retrace / mosha-level), H1 uses `w = 1` (mosha-retrace's H1).

The state at a time `T` uses only events whose time is `<= T`:
- **H4 direction `d`** = the direction of the last H4 break with time `<= T` (+1 up, −1 down; none = no direction).
- **H1 state** relative to that H4 break (time `t4`), the reading of the Desk's `msCycle` (market-structure.html) on the H4 /
  H1 pair: take the H1 breaks with `t4 <= time <= T`, oldest first.
  - `move`: none of them is against `d`.
  - `pullback`: the first H1 break against `d` (the H1 ChoCh) happened and no H1 break with `d` came after it.
  - `resumed`: after that first break against `d`, an H1 break with `d` happened (the pullback is over). It stays `resumed`
    until the next H4 break (a later H1 break against `d` does not reopen it, as `msCycle`).
- A new H4 break (either way) starts a new move: the state is read again from it.

**When the gate is read**: at the trade's entry time (fill time for the positions of the study engines, which is when the
trade comes into being; a limit filled while the gate says no is a trade the gate would not take). For the engine setups'
rows, which carry only their signal / order time `opened`, at `opened`. A trade with no H4 direction yet (none in practice
after June 2019) is kept.

**The gates** (side = +1 buy, −1 sell):
- **G2 (primary)**: keep a trade only if `side == d` AND the H1 state is not `pullback` (it is `move` or `resumed`).
- **G1 (secondary)**: keep only if `side == d` (any H1 state).
- **G3 (secondary)**: keep only if `side == d` AND the state is `resumed`.

Long-only systems (Gold trend, Gold trend fast, Gold daily engulf, H4 trendline) can only lose trades to the gate.

## The trades (each system's own historical trades, nothing re-tuned, no system file edited)

Net R a position after the system's own costs, with overnight financing on gold buys (`council/fills.mjs` `nights` x
`FIN.xau.long` x entry / risk) where the source does not already carry it.

1. **The live book**
   - `gtrend` Gold trend and `geg` Gold daily engulf: `research/edge/supported-book/legs.json` (the committed
     `gold-systems-oos` engine on OANDA gold, units to 6 Nov 2026), made into positions by that study's own `positions()`
     (imported): net of $0.30 a unit and financing on every unit. Entry time = the first unit's fill.
2. **The shadowed gold systems**
   - `gtrend5` Gold trend fast: the same `legs.json`, same way.
   - `gtl` H4 trendline, `gmp` momentum pullback, `mosha-bo` Mosha BO: the robustness rebuilds
     (`research/edge/robustness/out/{gtl,gmp,mosha}.json`, net R per position after the spread) with entry time, exit time,
     entry and risk from `research/edge/decay-monitor/positions.json` (row for row, checked), less financing on buys exactly
     as `research/edge/decay-monitor/run.mjs` charges it. Entry time = `o`.
   - `replica` Gold replica: council-data `research/replay-2w.json` rows `k: 'replica'`, closed (win / loss / be), folded
     into positions and costed by `council/decay.mjs` `fold` + `replayNet` (spread and financing, as the decay monitor reads
     them). Entry time = `filled` (else `opened`).
3. **The engine setups' shadow streams**: `scalp`, `intraday`, `rscalp`, `rintra` on gold and the five forex markets
   (`xau eurusd gbpusd audusd usdcad usdchf`), the per-trade rows of `research/edge/shadow-best/run.mjs market <key>` (the
   `shadow-scalp-filters` replay, unchanged; net = `R − costR`), read with shadow-best's `loadTrades` (imported). They are
   accepted only if their totals equal shadow-best's committed result.json (n and net per window). One stream per setup, the
   six markets pooled. Coins are left out (the owner named the H4 / H1 cycle of the markets the book trades).

**Left out**: ICT (a separate edge, never mixed in); the NQ open run (index, its own regime study); the Mosha cycle (no
committed engine: it trades live since 11 Nov only); crypto trend.

## Tests and the pass rule (fixed here)

11 streams (gtrend, geg, gtrend5, gtl, gmp, replica, mosha-bo, scalp, intraday, rscalp, rintra) x 3 gates = **33 tests**.
For each: `kept` = trades the gate keeps, `blocked` = the others, `all` = both.

A gate **passes for a stream** only if ALL hold:
1. R a trade of `kept` > R a trade of `all`, in the first half AND in the second half;
2. Welch t of mean(`kept`) − mean(`blocked`) on the whole 2020 → now set >= 2.0;
3. that test's one-sided p (Student t, Welch degrees of freedom) survives **Holm over all 33 tests** at 0.05;
4. the worst drawdown of `kept` (cumulative net R in order of exit time, the peak floored at 0) is not deeper than that of
   `all`;
5. at least 30 trades kept and at least 10 blocked.

**Verdict per system = G2.** G1 and G3 are reported and counted in the Holm correction; they never make a system pass on
their own. A proposal is written only for a system whose G2 passes.

Caveat fixed in advance: trades of one stream overlap in time (several open together; engine setups by the dozen), so a
per-trade t treats correlated trades as independent and flatters both sides of the test. The result also reports the
difference on calendar-month means (kept minus blocked, months with both), descriptive only.

**Placebo** (per stream, G2): 40 seeded draws that block a random set of trades of the same size as G2's blocked set; for
each, the same rules 1, 2, 4 and 5 (no Holm). Reported: how many draws pass, and the 95th percentile of their Welch t.

## Also reported, descriptive only

- What the gate said (d, H1 state, G1 / G2 / G3) for each of this week's three live losses and for every non-shadow trade of
  the live book in council-data `trades.json` since 1 Nov 2026, read at its entry time on the same candles.
- Per stream and gate: n kept / blocked, R a trade kept / blocked / all per half, total R, worst drawdowns, share blocked.

## Files

`PREREGISTRATION.md` (this, first), then `run.mjs` (`candles <dir>`, `study <candleDir> <shadowDir> <councilDataDir>`),
`result.json`, `RESULT.md` (verdict first), `tests/cycle-gate.test.mjs` (the state machine on hand-made candles, no
look-ahead, RESULT.md figures equal result.json).

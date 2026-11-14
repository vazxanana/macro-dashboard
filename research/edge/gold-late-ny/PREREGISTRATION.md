# Gold: does the late New York session predict the next Asian session? (pre-registration)

Written and pushed alone, before any candle of this study was fetched or any trade computed. Paper research only.

**A new stand-alone intraday rule, not a gate, exit, entry or size of the gold book** (Gold trend + Gold daily engulf). Item 44
of `docs/owner-decisions.md` is respected: nothing here reads, filters or changes the book's trades, no candle before 2016 is
read, and no live rule, config, council member or mirror setting changes whatever the result.

## Dedupe: what was already tested, and what is new here

Read before writing (RESULT.md of each, on their branches):
- `gold-us-asia`: the whole New York cash session (09:30 → 16:00 New York) as the signal, traded 00:00 → 07:00 UTC. FAIL,
  0 of 3: before costs every stream within 0.02R of zero; correlation of the NY move with the next Asian session −0.004
  (2016-26). Its descriptive line: in 2006-15 a slice of the NY move was given back between the NY close and 00:00 UTC
  (correlation −0.154), hours that study never traded.
- `metals-intraday-momentum` / `intraday-momentum`: the first half hour of the floor session predicting the last half hour of
  the same session (gold 08:20-08:50 → 13:00-13:30). FAIL.
- `gold-session-drift`: unconditional session drifts. FAIL. `gold-asia-break`: the Asian range breakout into London. FAIL.
  `gold-lbma-fix`: the run into and fade after the London PM auction. FAIL.

None of them used **the afternoon after the COMEX pit close** (13:30 → 16:30 New York, when the US floor has settled and
volume is thin) as the signal, and none traded **from the 18:00 New York reopen** (the evening hours `gold-us-asia` left out).
That pair is the question here. It is close to `gold-us-asia` and is expected to be weak; it is tested once, as written.

## Question

Does the sign of spot gold's move from 13:30 to 16:30 New York (after the COMEX settlement) predict the move of the next
Asian session, 18:00 → 02:00 New York (the Globex reopen to the eve of London): continuation, or reversal?

## Definitions (New York wall-clock time; US daylight time by `council/histdata.mjs` `nyOffsetH`)

- **Signal day S** = a New York weekday (Monday-Friday) from 2016-01-04 on.
- **Late-NY move** of S = close of the M15 candle starting 16:15 − open of the M15 candle starting 13:30, New York time.
  Both candles must be on file. S is skipped (and counted) when `ict/calendar.mjs` `cmeShut` is true at any 15-minute point of
  13:30 → 16:30 (early-close and holiday days), or when the move is exactly 0.
- **Trade window** of S = 18:00 New York of the next session → 02:00 New York: for a Monday-Thursday S, 18:00 of S to 02:00 of
  S + 1 day; for a Friday S, 18:00 Sunday to 02:00 Monday. The trade is skipped (and counted) when `cmeShut` is true at its
  entry time (a holiday: never rolled to a later session), or the 18:00 entry candle or the 01:45 exit candle is missing.
- **Late-NY size** = the mean of |late-NY move| over the 20 signal days with a move before S (S itself excluded).
- **Asia range** of a trade window = highest high − lowest low of its M15 candles. **Stop distance** of S = the mean Asia range
  of the 20 trade windows that ended before S's entry. No trade before 20 of each exist.

## The tests (3, fixed)

| # | Name | Side | Days |
|---|---|---|---|
| T1 | Follow the late-NY move into Asia | with the late-NY move (up → buy, down → sell) | every signal day |
| T2 | Follow, sizeable late-NY moves only | with the move | \|late-NY move\| > 0.5 × its 20-day mean size |
| T3 | Fade the late-NY move in Asia | against the move (up → sell, down → buy) | every signal day |

- **Entry:** market at the open of the 18:00 New York M15 candle. **Exit:** market at the close of the 01:45 candle (02:00).
- **Stop (every trade has one):** entry ∓ 1 × the stop distance (long below, short above). No target, break-even or trail.
- **Fills:** the window's M15 candles in order. A long is stopped when a candle's low ≤ stop and fills at min(candle open,
  stop) (a gap through fills at the open); a short when high ≥ stop, at max(open, stop). Otherwise out at the 01:45 close. A
  hole inside the window is not read.
- **R** = side × (exit − entry) / stop distance.
- **Costs:** $0.30 spread a round trip plus half a spread ($0.15) of slippage on each market order (the entry, and the exit or
  the stop): **$0.60 a round trip**. Net R = R − 0.60 / stop distance. At 2× costs: $1.20.
- **Financing:** `council/fills.mjs` `nights` x `FIN.xau.long` on longs (shorts pay and receive nothing). The rollover is
  17:00 New York (`nights` counts 22:00 UTC); a trade from 18:00 to 02:00 New York crosses none, so the charge is expected to
  be 0. It is computed for every long and reported, not assumed.

## Data

OANDA mid M15 XAU/USD through the site's keyless candle proxy (`https://meridianx.dev/md/bars?sym=xau&tf=15m`), from
2015-12-01 (the only pre-2016 candles: the warm-up of the 20-day means; no signal or trade before 2016-01-04) to the end of
the latest complete day. `node --use-env-proxy research/edge/gold-late-ny/fetch.mjs <dir>`, cache kept out of git.

## Windows

- **In sample:** signal days 2016-01-04 → 2020-12-31.
- **Out of sample (decides):** signal days 2021-01-01 → end of data.

## Statistics and the pass bar

- Per test and window: n, buys / sells, gross R, net R, net R at 2× costs, total, win rate, stopped count, worst closed
  drawdown, and **t on calendar-month sums** of net R (every month of the window, 0 for one without a trade); one-sided p from
  Student t with months − 1 degrees of freedom. Months are the signal day's.
- **Holm** over the 3 tests on the out-of-sample one-sided p.
- **A test passes** when all hold: out-of-sample net R > 0; out-of-sample month-sum t ≥ 2; Holm-adjusted p < 0.05; in-sample
  net R > 0 (the same sign); out-of-sample net R at 2× costs > 0; out-of-sample n ≥ 200.
- **Verdict:** PASS if at least one test passes, else FAIL. T1 and T3 are mirror images (one can pass at most).
- **Placebo (40 seeds, mulberry32, seed 1..40):** the same trade days of each test, the same entry, stop and exit, the side drawn
  at random per trade; reported as p5 / p50 / p95 of the seeds' mean net R and how many seeds the real mean beats, per window.
  Reported, not a pass condition.
- **Descriptive, not tests:** correlation of the late-NY move with the trade window's return (open 18:00 → close 02:00), and
  with the move from 16:30 to 18:00 (the halt and the last half hour), per window; T1 by weekday of S.

Nothing else is tested. No parameter is changed after a result is seen; a variant that looks better afterwards needs its own
pre-registration on other data.

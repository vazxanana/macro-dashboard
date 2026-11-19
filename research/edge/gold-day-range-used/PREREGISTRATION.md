# Pre-registration: gold's day range already used up by 15:00 UTC, faded to 21:00 UTC (14 Nov 2026)

Written and pushed alone, before any candle of this study was fetched or any trade computed. Paper research only: nothing
live reads it, and no rule, size, filter, stop, config, council member or mirror setting changes whatever the result.

**A new stand-alone intraday rule, not a gate, exit, entry or size of the live gold book** (Gold trend + Gold daily engulf).
Owner decision 44 is respected: none of the book's positions or records are read, and nothing here changes how the book
trades.

## Question

Intraday traders say a day's range "gets used up": once gold has already travelled a normal day's whole range by the middle
of the New York morning and sits at that day's extreme, the rest of the session tends to give some of it back. Does fading
such a day, from 15:00 UTC to 21:00 UTC, make money net of costs, **and more than the same side taken over the same hours on
every eligible day of the same month** (so gold's drift, which lifts any buy, is taken out)?

## Dedupe (read before writing)

- `gold-week-exhaustion`: the same idea on the calendar WEEK (the week's move by Monday-Wednesday against a normal weekly
  range, held to Friday). Daily candles only; it never looks inside a day.
- `gold-range-expansion`: one completed wide DAY (range >= 1.75 x ATR, close at an extreme), traded from that close for 5 days.
  It reads finished daily candles; this study reads the day while it is still forming and is flat by 21:00 UTC.
- `gold-hourly-shock` (one large H1 candle), `gold-intraday-momentum` (first half hour → last half hour),
  `gold-ny-impulse-pullback`, `gold-london-displacement` (one large M15 candle followed), `gold-late-ny` (after-pit move →
  Asia), `gold-pm-fix-close` (15:00 London price → close), `gold-session-drift` (unconditional session drifts),
  `gold-shock-revert` (one extreme day, next day): none conditions on how much of a normal day's range is ALREADY used at a
  fixed intraday time together with where price sits inside it.

## Data (named before any result)

- One market: **XAU/USD**, OANDA mid H1 candles through the site's keyless candle proxy (`/md/bars?sym=xau&tf=1h`), from the
  first candle served (March 2006) to 2026-10-31, UTC hour buckets, complete candles only. Kept out of git (scratch cache,
  deleted at the end).
- Days: UTC weekdays (Monday-Friday). The Sunday reopen hours are not part of any day.

## Definitions

- **Day range so far** of weekday D at the checkpoint: highest high `Hs` and lowest low `Ls` of D's H1 candles starting
  00:00 to 14:00 UTC (15 candles; at least 12 must be on file, else D is skipped and counted). Checkpoint price `C` = the close
  of D's 14:00 UTC candle (must be on file).
- **ADR** of D = the mean of (highest high − lowest low) of the H1 candles of each of the 20 latest complete weekdays before
  D (a weekday counts when at least 18 of its 24 hours are on file). No day of D is read. No trade before 20 exist.
- **Used share** `U = (Hs − Ls) / ADR`. **Position** `P = (C − Ls) / (Hs − Ls)` (D skipped when `Hs = Ls`).
- **Eligible day**: a weekday with an ADR, the morning candles above, and the 15:00 and 20:00 UTC candles on file.

## Trade (every trade has a stop)

- Entry: market at the open of D's 15:00 UTC candle. Exit: market at the close of D's 20:00 UTC candle (21:00 UTC).
- Stop: entry ∓ **0.5 x ADR** (below a buy, above a sell). No target, no break-even, no trail.
- Fills on D's H1 candles 15:00 to 20:00 in order: a buy is stopped when a candle's low <= stop and fills at
  min(candle open, stop) (a gap through fills at the open); a sell when high >= stop, at max(open, stop). A missing candle
  inside the window is skipped.
- R = side x (exit − entry) / (0.5 x ADR).
- **Costs:** $0.60 a round trip per ounce (spread + slippage). Net R = R − 0.60 / (0.5 x ADR). 2x costs: $1.20.
  **Financing:** `council/fills.mjs` `nights` x `FIN.xau.long` x entry / risk on buys (the demo broker's XAUUSD swap.long,
  0.000148 of price a rollover, source and date in `FIN`); shorts pay nothing. Every trade is out at 21:00 UTC, before the
  22:00 UTC rollover `nights` counts, so the charge is expected to be 0; it is computed anyway.

## The tests (3, fixed; Holm over the three)

| # | Name | Days | Side |
|---|---|---|---|
| T1 (primary) | Fade a used-up day | U >= 1.0 and (P >= 0.8 → sell; P <= 0.2 → buy) | against the extreme |
| T2 | Fade a well over-used day | U >= 1.5 and the same P bands | against the extreme |
| T3 | Follow a used-up day | U >= 1.0 and the same P bands | with the extreme (P >= 0.8 → buy; P <= 0.2 → sell) |

- **Same-side baseline** (the yardstick for every test): the same trade (15:00 → 21:00 UTC, stop 0.5 x ADR, same costs) on
  every eligible day, buys and sells computed apart.
- **Excess** of a trade = its net R − the mean net R of the same-side baseline trades of the same calendar month (all
  eligible days of that month, the signal day included). Monthly sums of excess remove the month's drift.
- **Statistics:** t on calendar-month sums (net, gross, net at 2x, excess), months with no trade left out. One-sided p from
  the normal on the OOS excess t; Holm over T1-T3.
- **Windows:** in sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31 (halves 2017-21 / 2022-26
  reported, not judged).
- **Placebo** (40 seeds, mulberry32 seeds 1-40): each OOS trade of a test moved to a random other eligible OOS weekday, same
  side, same rule mechanics; the test's OOS mean net R must beat at least 38 of the 40 seed means.

## Pass bar (per test; the study passes when T1 passes)

All of: OOS mean excess > 0 with month-sum t >= 2 and Holm p < 0.05; IS mean excess > 0; OOS mean net R > 0; OOS mean net R
at 2x costs > 0; placebo beaten >= 38 of 40; OOS n >= 30. Anything else is FAIL. A pass would only be a lead to replicate
on years or markets it did not use; never an edge on its own, never a council rule without the owner.

## What will be reported whatever the result

n, win rate, gross / net / 2x-cost / excess R a trade, month-sum t of each, IS and OOS and the two halves, buys and sells
apart, by year, skipped days by reason, the baseline means, the placebo distribution. RESULT.md is written by `run.mjs` from
`result.json`; `tests/gold-day-range-used.test.mjs` checks the rule on hand-made candles, that nothing after 15:00 UTC is
read for the signal, and the report against `result.json`.

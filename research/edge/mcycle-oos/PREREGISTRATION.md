# Mosha cycle (`mcycle`) on untouched gold history, 2007-2019: pre-registration

Written and committed on 14 Nov 2026, alone, before any candle of this study was run through the rule and before any number
was computed. Paper research only: no live rule, size, filter, stop, config, baseline or council file is changed by this study,
whatever it finds. Nothing is written to the Mosha desk or its lessons.

## Why

The Mosha cycle has traded on paper as a main system since 11 Nov 2026 (docs/owner-decisions.md item 48) with no base study.
The study `mcycle-base` (branch `mcycle-base-study`, 13 Nov 2026) ran the live code on OANDA gold 2020 to Nov 2026: FAIL,
-0.574R a trade after $0.30 and financing (n 115, t -3.99). But 2020-26 is the window the rule was written on by eye (the
owner's charts of Oct-Nov 2026), so that figure is in sample for the rule's design. **2007-2019 has never been run through
this rule**: it is the decisive, untouched window here. The purpose is an honest baseline the owner can compare the cycle's
forward record with.

What I already know, said plainly: `mcycle-base` (2020-26, above); `mosha-retrace` (+0.02R, t 0.17) and `mosha-cycle`
(-0.22R, t -0.99), different rules on 2020-26. Nothing below is chosen from them: the rule is the live code, and the windows,
costs, tests, placebo and bar are the ones the brief fixed before this file was written.

## The rule: the live code, imported, never copied

- `council/mosha-cycle.mjs` `cycleTrades` and `cycleBlockers`, imported and run unchanged (H4 move = last H4 BO; H1 ChoCh =
  first H1 BO the other way; leg `pull` = first M15 / M5 BO with the pullback after it, limit at the broken level, stop $0.30
  past its origin, target the H4 50 %; leg `main` = after that, the first M15 / M5 structure flip back with the H4, target the
  H4 extreme; `MIN_RISK` $0.50; `FRESH` 1 h).
- BO events from `council/engine.mjs` `msAnalyze(bars, 6)`, imported, on the last 719 CLOSED candles of each timeframe, mapped
  by the Trader's own `ev` mapping (council/trader.mjs, the mcycle block: event time = the close of the break candle, `flip` =
  `structure`). The harness (the replay loop, the record the Trader builds) is the `mcycle-base` harness, copied with its
  provenance (that branch is not merged); the test checks it against the Trader's text.
- Decision clock: once at every M5 close. Only `fresh` signals are taken, each id `xau-mcycle-<leg>-<H4 break time>` once.
  The record's target is the cycle's target when `room` (>= 1R), else 2R; `cycleBlockers` at the price of that moment, no
  owner shadow. **A signal with any blocker (`room`: target under 1R; `cap`: the leg already has an open or pending trade;
  `price`: price already past the stop) is a shadow and excluded from every test.** Its count is reported.

## Data

OANDA mid spot gold M5 through the keyless candle proxy (`/md/bars`, UTC), June 2006 to the last complete day (the cache of
study 144, `xau-5m.json.gz`, kept out of git; refetched the same way if missing). **H4, H1 and M15 are built from M5** (UTC
buckets of 4 h, 1 h, 15 min: open of the first M5, high / low over all, close of the last). A candle of any timeframe counts as
closed once the next candle of that timeframe has started at or before the decision moment (the Trader's rule).

## Fills, exits, costs

- `council/fills.mjs` `manageLive` on M5 (stop first when one candle holds both; a fill candle that also reaches the target
  without opening through the entry is `missed`, 0R, not a trade); `spotSkip` candles skipped; the order expires 24 h after
  it was placed; out 72 h after the fill at that candle's close; no break-even, trail or add.
- Cost: **$0.60 a round trip** on every filled trade, in R of its opening risk (`r0`), plus overnight financing on buys:
  `council/fills.mjs` `financing` = `nights(fill, exit)` x `FIN.xau.long` (0.000148 a rollover, the demo broker's swap of
  11 Nov 2026) x entry / r0; sells pay and earn nothing. Today's rate for every year (the broker's past rates are unknown).
- 2x costs = $1.20 and twice the financing. Gross = before any cost.

## Windows (by a trade's EXIT time)

- **Decisive (untouched): 2007-01-01 to 2019-12-31.** Decisions start 2007-01-01 (the half-year from June 2006 fills the
  719-candle windows).
- Reported: 2020-01-01 to 2023-12-31 and 2024-01-01 to 2026-10-31 (the rule's design window; not evidence).
- t = mean / sd x sqrt(n) of calendar-month sums of net R, every calendar month of the window counted (empty = 0).

## Tests (Holm over 3, decisive window)

- **T1** leg `pull`, live trades only.
- **T2** leg `main`, live trades only.
- **T3** both legs together (the system as it trades).

One-sided p from the month-sum t (normal approximation), Holm-adjusted over the three. A test **passes** only if all hold:
1. decisive-window net t >= 2 AND its Holm-adjusted one-sided p < 0.05;
2. the same sign (net R a trade > 0) in 2020-26 (2020-01 to 2026-10 together);
3. decisive-window net R a trade > 0 at 2x costs;
4. its decisive-window net t beats the t of at least 38 of 40 seeded placebos (below).

The verdict is PASS if T3 passes (T1 / T2 say which leg carries it), else FAIL. No other test, variant, filter or window will be
added after the run; anything else shown is descriptive and labelled so.

## Placebo (40 seeds, 1 to 40, decisive window, per test)

For each live filled trade of the test in 2007-19: same side, same opening risk `r0`, same target distance in R (its
recorded `rr`), but its signal moment moved to a random M5 candle of the same calendar year that is not `spotSkip`; entered
at market at the next M5 candle's open (stop and target placed from that open), managed by the same `manageLive` with the same
72 h exit, same costs and financing. Statistic: decisive-window net month-sum t. Seeded generator (mulberry32, seed s).

## What is reported

Per test and window: n, win rate, R a trade gross / net / 2x cost, total, profit factor, worst drawdown, t (months); each year
2007-2026 (net); the signal funnel (live, shadows by blocker); the placebo distribution (min, median, max of t, how many the
real t beats); `positions.json` = one row per live filled trade `[signal, fill, exit, netR, side, leg]` for 2007-2026, the
baseline a forward record can be read against.

# Pre-registration: spot gold over the lunar cycle (14 Nov 2026)

Written and pushed ALONE, before any gold return over a moon phase was computed. The code (`run.mjs`), the result and the
test come in later commits.

## What this is, and what it is not

A **stand-alone calendar rule of its own**, chosen because its primary test cannot ride gold's long rise: it is long half of
every lunar month and short the other half, so a stream with no lunar effect earns about zero before costs whatever gold's
drift. The prior is a published one, not a mechanism: Dichev and Janes (2003) and Yuan, Zheng and Zhu (2006, Journal of
Empirical Finance) report higher stock-index returns in the half month around the NEW moon than around the full moon, and
Lucey (2010, Applied Economics Letters) looked for the same in precious metals. Many readers see it as a data-mined
curiosity; this study is a clean out-of-sample check on gold, nothing more. The direction (long around the new moon) is the
indices papers' and is fixed now.

It is **not** a gate, exit, entry or size of the live gold book (Gold trend, Gold daily engulf, the Mosha cycle): it reads
none of their trades or positions and uses none of the book's 2006-17 positions (docs/owner-decisions.md item 44). Paper only;
nothing live changes whatever the verdict. A PASS would only be written up as a proposal for the owner.

Dedupe: `research/edge/` and the study branches hold no lunar, moon-phase or 29.5-day study (checked by name and by text);
`research/proposals/2026-11-14-untested-backlog.md` lists "Lunar cycle in index returns" among the ideas NOT run (low prior),
on indices. The nearest gold calendar studies (`gold-month-of-year`, `gold-turn-of-month`, `gold-mid-month-turn`,
`gold-weekday`, `gold-first-week`, `seasonality`) all key on the civil calendar, which drifts against the 29.53-day synodic
month, so none of them can contain this signal.

## Data, market set, windows

- Market set, fixed now: **spot gold only** (council-data `research/daily/xau.json`, OANDA mid, UTC daily candles, read with
  `git show`, no network, no cache), weekend candles folded into the next weekday with `council/fills.mjs` `foldWeekend`
  (read only). A candle's close time = 23:00 UTC (Friday 21:00 UTC).
- In sample: legs whose ENTRY candle falls in **2007-01 to 2016-12**. Out of sample (the judged window): **2017-01 to
  2026-10**. Legs whose exit candle is not yet on file are dropped and counted.

## The moon phases (computed, no table, decided now)

Times of new moon, first quarter, full moon and last quarter from Meeus, *Astronomical Algorithms* (2nd ed.), chapter 49,
with the periodic terms down to 0.00017 day (the planetary "additional corrections", each under 0.0004 day, and Delta T, about
a minute, are left out: a few minutes of error against a daily candle). Checked in the test against Meeus's worked example
(new moon of 18 Feb 1977, 03:37:42 TD) and published 2024 phase times.

## The rule

- **Long leg** ("around the new moon"): from the last quarter to the next first quarter. Enter long at the close of the first
  folded daily candle whose close time is at or after the last quarter; exit at the close of the first candle whose close time
  is at or after the next first quarter.
- **Short leg** ("around the full moon"): from the first quarter to the next last quarter, the same way.
- The legs alternate, each about 14.8 days (about 10 trading days); a leg exits on the candle the next one enters.
- Every trade has a stop (absolute rule 1): **2 x ATR(20)** (mean true range of the 20 folded candles up to and including the
  entry candle), checked on every candle of the hold; a gap through it fills at the open (`fills.mjs` `stopFill`). A stopped
  leg stays flat until the next phase. R = move in the trade's favour / initial risk.

## The every-day baseline (same side, same costs)

For each side: a trade of that side entered at the close of EVERY trading day of the window, out at the close 10 trading days
later (the legs' typical length, fixed now), same stop and costs (these overlap; they only give the side's unconditional mean).
A leg's **excess** = its net R minus that side's baseline mean net R in the same window (in sample or out of sample).

## The three tests (tested one-sided as "positive")

- **T1 (primary), the both-sided stream**: every long leg and every short leg, net R. Drift-neutral by construction (half the
  time long, half short).
- **T2, long legs against the long baseline**: excess R of the long legs.
- **T3, short legs against the short baseline**: excess R of the short legs.

## Costs

- Round trip **$0.60** (spread $0.30 plus half a spread of slippage on each market order, the paper-fill model of
  `fills.mjs`), charged in R as $0.60 / initial risk.
- **Financing on buys only**: `nights(entry, exit)` x `FIN.xau.long` (0.0148 % of price a rollover, the demo broker's XAUUSD
  swap of 11 Nov 2026, `council/fills.mjs`, imported) x entry / risk. Sells pay and receive nothing.
- 2x costs check: $1.20 and twice the financing. The cost share (costs and financing as a share of the mean absolute gross R)
  and the median stop in dollars are reported.

## Statistics and the bar

- t on calendar-month sums (net R for T1, excess R for T2 / T3; legs grouped by the month of their entry).
- One-sided p; **Holm over T1, T2, T3** (out-of-sample p's).
- **Placebo**: 40 seeded draws (seed 20261114). Each draw shifts every phase time by one random offset, uniform over 0 to
  29.53 days, and runs T1 again; the rule beats a seed when its out-of-sample T1 mean net R is above that seed's.
- Also reported, not gating: gross figures, win rate, stops, by year, the opposite direction (long around the full moon).
- **A test passes only if ALL hold**: out-of-sample mean > 0 with month t >= 2; Holm-adjusted one-sided p < 0.05; in-sample
  mean > 0 (same sign); out-of-sample still > 0 at 2x costs; T1 beats at least 38 of 40 placebo seeds (T1 only; T2 / T3 are
  already measured against a baseline).
- **Verdict**: PASS only if T1 passes; T2 and T3 are reported with their own pass / fail. Nothing is called an edge without n
  and t.

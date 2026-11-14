# Pre-registration: is gold stretched against Brent crude a signal for gold? (14 Nov 2026)

Written and pushed ALONE, before any candle of this study was read or any number computed. Paper research only: a
**stand-alone rule on spot gold**, never a gate, entry, exit or size of the live gold book, and it does not use the book's
2006-17 window or its positions (owner decision 44). Nothing live changes; no proposal follows a pass without the owner.

## Idea

Gold and crude oil are both priced in dollars and share inflation and dollar drivers, so the log ratio gold / Brent swings
around a slowly moving level. The hypothesis: when gold is unusually EXPENSIVE against Brent (the ratio far above its own
one-year mean) gold under-performs over the next month, and when it is unusually CHEAP gold out-performs (a relative-value
pull on the gold leg). Only gold is traded. Because the rule goes both long and short, and because it is judged against the
same-side every-day baseline, gold's own drift cannot pass it on its own. Not a duplicate: `gold-oil-lead` (big oil DAYS as a
lead, FAIL), `gold-commodity-inflation` (commodity-basket momentum, FAIL), `gold-silver-ratio`, `gold-platinum-ratio`
(other ratios) and `brent-wti-spread` (oil spread) test other things; no study here reads the gold / oil price LEVEL ratio.

## Data (fixed now)

- OANDA mid daily candles (UTC) from council-data `research/daily/xau.json` and `research/daily/bco.json` (Brent; WTI is
  not used because it printed below zero in April 2020 and has no log ratio), read with `git show origin/council-data:…`,
  no network. Weekends folded into Monday with `council/fills.mjs` `foldWeekend` on both. Days matched by UTC day stamp;
  a gold day with no Brent candle of the same stamp has no ratio (no signal that day).
- Market set: spot gold only (XAU/USD). Brent is a signal input only.

## Rule

- `x_D = ln(gold close_D / Brent close_D)`; `z_D = (x_D − mean) / sd` over the 250 ratio values ending at D (D included),
  needing 250 values. Known at D's close.
- Signal: SHORT gold when z crosses above +2 (z_D > +2 while armed); LONG gold when z crosses below −2. A side is armed at
  the start and re-armed once |z| has come back under 1 after its last signal.
- Entry: the open of the first gold candle later than D. Stop: 3 x ATR(20) of gold (true ranges of the 20 candles before the
  entry) from the entry; a gap through the stop fills at the open. Exit: the close of the 20th gold candle (entry = 1),
  or the stop. One position at a time (a signal while a position is open is skipped).
- Every trade has a stop.

## Costs

- $0.60 a round trip ($0.30 spread + $0.15 slippage on each of the two market orders), plus, on longs only,
  `nights(entry, exit) x FIN.xau.long x entry price` (council/fills.mjs: the demo broker's XAUUSD swap of 11 Nov 2026);
  shorts are credited nothing. R = per unit of the initial risk (3 x ATR). The cost share (mean cost / mean |gross R|) and
  the median stop in dollars are reported.

## Windows

In sample 2007-01-01 to 2016-12-31 (signals by entry date), out of sample 2017-01-01 to 2026-10-31. Gold starts
2006-03-20, so the first z exists in early 2007.

## Tests (three, Holm over the three)

- **T1 (primary)**: both sides pooled, net R.
- T2: longs only (gold cheap against Brent).
- T3: shorts only (gold expensive against Brent).

Statistic: t of the calendar-month sums of net R (by exit date; empty months count as 0), one-sided upper p from the
normal, Holm over T1-T3 on the out-of-sample t.

**Baseline**: for each side, the same trade (entry at every gold open of the window, same stop and 20-candle exit, same costs,
overlapping, not one at a time) gives the unconditional same-side mean net R. A test's **excess** = the mean over its trades
of (net R − the baseline mean of that trade's side in that window).

**Placebo**: 40 seeded draws (mulberry32, seeds 1-40) of random eligible out-of-sample days with the real trades' side mix,
simulated by the same one-at-a-time rule; reported as how many draws reach the real month t and how many reach t >= 2.

## Pass bar (a test passes only if all hold)

1. Out-of-sample month t >= 2 and Holm p < 0.05.
2. In-sample mean net R > 0 (the same sign).
3. Out-of-sample mean net R > 0 at 2x costs.
4. Out-of-sample excess over the same-side baseline > 0.
5. Out-of-sample n >= 30.

**Verdict**: PASS if T1 passes; PARTIAL if only T2 or T3 passes; FAIL otherwise. Whatever the result, nothing live changes.

## Not decided after the fact

The 250-day window, ±2 entry, ±1 re-arm, 20-candle hold, 3 x ATR stop, costs, windows and the pass bar are fixed here.
Other values may be shown in RESULT.md only as labelled sensitivity, never as the verdict.

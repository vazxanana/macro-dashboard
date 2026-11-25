# NAS100 breakout, long: the auto-researcher's best lead, tested on its own (pre-registered 25 Nov 2026)

Written and committed BEFORE any of this study's numbers exist. Owner, 25 Nov 2026: "NAS100 breakout, long, focus on that."
Paper research only: nothing here trades, alerts or changes a rule.

## The rule (copied from the auto-researcher's lead, never changed here)
`nas100|brk|long` from worker 10 lane 5: on OANDA NAS100 H1 mid candles, at the close of bar i go long at the next open when
close > the highest high of the previous 20 bars, the entry bar opens 14:00-21:59 UTC, and the close is above its 200-bar average;
stop 1 x ATR(14) (Wilder) from the entry, target 4R, out after 96 hours, one position at a time, a candle that opens beyond the
stop exits at its open, stop first when one candle holds both. Genome: `{ trig: [{ kind: 'brk', N: 20 }], side: 'long',
hours: [14, 22], dows: null, trend: 'with', vol: 'none', stop: 1, rr: 4, hold: 96 }`.
The auto-researcher saw it at no cost (owner: futures) with windows A 2010-14 (n 1,018, +0.198R, t 3.17), B 2015-19 (n 473,
+0.370R, t 3.34), C 2020 on (n 645, +0.484R, t 5.06, Holm p 0 over the C looks made that day). Its C window is spent: it chose
the rule. Nothing below is a new window for THIS rule on NAS100 except as said.

## Honest limits, said first
1. NAS100 rose strongly through 2010-26 and every long rule on it rides that drift. The controls below exist to separate the
   breakout from the drift; they cannot make the C window fresh.
2. The only data this rule has not been chosen on is OTHER markets (T4) and the future (a forward record, proposed after).
3. Costs were zero in the search. T1 prices them.

## Data and method
OANDA H1 mid candles through the website's `/md/bars` (the engine's own loader, `loadMarket`), the engine's `simulate` and
`summary` (month-sum t) for every figure; a second implementation in `run.mjs` returns per-trade results for the controls and
must equal the engine on A, B and C (gate: same n, same sum within 1e-6 at cost 0 and at 4e-5). Windows as the engine:
A 2005-14, B 2015-19, C 2020 on. R is net of the cost named in each test. Month-sum t as everywhere in this repository.

## Tests (five; each a yes / no; the verdict needs all five)
**Gate.** The engine on the live candles reproduces A and B exactly (n and mean to 3 decimals; the past does not change) and C
within 5 % of n 645 (C grows with time). If not: INVALID, nothing else is read.

**T1, costs.** C-window mean after a round trip of 6e-5 of the entry price (the measured NAS100 demo spread 2.7e-5, plus an
assumed 3.3e-5 for a futures commission and a tick of slippage), month t >= 2, mean > 0 in A, B and C. Also shown, not judged:
2.7e-5 and 1.2e-4.

**T2, against the drift.** Two controls on the C window with the rule's own filters (long, entry hour 14-22 UTC, close above the
200-bar average, same stop, target, hold and one-position rule) but NO breakout trigger:
(a) filter-only: every bar that passes the filters is a candidate, taken one at a time;
(b) 2,000 random draws of as many non-overlapping filter-only entries as the rule took in C (seeded).
Pass: the rule's C mean is above the 95th percentile of the draws AND the rule minus filter-only difference is positive with a
Welch t >= 2 on trade R.

**T3, a plateau, not a spike.** One-at-a-time neighbours of the rule: N in {10, 15, 30, 50}, stop in {0.75, 1.5}, target in
{2, 3, 6}, hold in {48, 240}, hours [13, 22], [15, 22], [14, 21], trend filter off, 200-bar average replaced by the 100-bar.
Pass: at least 80 % of the neighbours have a positive mean in A, in B and in C (all three), at the 6e-5 cost.

**T4, other indices (the only fresh data).** The same rule, no change, on US500 (spx500), US30, DE40, JP225 and US2000 over their
own C window (2020 on) at 6e-5. Pass: the five pooled (month sums, markets added) have a positive mean and t >= 2, and at least
three of the five markets have a positive mean. The per-market lines are reported either way.

**T5, where the R comes from.** Reported, not judged: by year 2010-2026, the share of the C-window total made in its best three
months, the maximum drawdown in R, and the rule's mean in the 2022 bear year. A verdict of PASS still needs the worst calendar
year of C not to hold more than 40 % of the C-window loss-free total (a single year carrying the result is a fail of T5).

## Verdict
PASS = the gate and T1-T5 all hold: the rule is a CANDIDATE for a pre-registered forward record, never an edge. Anything else:
"does not hold up", with the failing tests named. No parameter, filter or window is changed after seeing a result; any further
idea gets its own pre-registration. Nothing live changes.

## Amendment before any result (25 Nov 2026, same day, run.mjs not yet run)
T5's last sentence read "the worst calendar year ... of the C-window loss-free total", which is not a defined quantity. What is
meant, and what the run uses: **no single calendar year of the C window may hold more than 40 % of the C window's total R**
(the year with the largest R; if the total is not positive the test fails). Nothing else changed.

# Pre-registration: gold-pre-holiday-hourcost (23 Nov 2026)

Paper research only. **Cost accounting of one fixed rule; no rule is tested.** `gold-pre-holiday` (14 Nov 2026) passed T1
(long spot gold from the open to the close of the last trading day before an NYSE holiday, stop 1 × ATR(14)): out of sample
2017 → Oct 2026 +0.133R a trade net, t 2.35 per event, n 92, Holm p 0.021; T2 (the last two days) passed too; T3 failed. Its
round trip was **assumed**: $0.60 an ounce. The demo broker's own quoted gold spreads are now measured hour by hour (tick
probe). This study asks: **does the study's own pre-registered bar still pass for T1 (and T2, reported with it) when each
trade is charged the demo's measured spread at the UTC hour of its entry and of its exit, plus the demo's commission?** It is
accounting on years the study already read: a pass is not new evidence of an edge. Not a gate, entry, exit or size of the gold
book (owner item 44); not ICT. Nothing live changes and no proposal is written.

## What the author has seen before writing this

- `gold-pre-holiday`'s PREREGISTRATION, RESULT and result.json (every figure above).
- The XAUUSD hour profile of the tick probe's first run (council-data commit 0459ec37e, 2026-11-20T00:58Z, the one
  `gold-vol-breakout-hourcost` used; the current council-data copy of that file no longer carries the hour profile):
  $0.07-0.11 median spread in every UTC hour, 1.7-2.6 × 10⁻⁵ of price; hours 21, 22, 23 have 14, 24, 36 windows. Commission
  `commissionRT` 0.000024 of price (council-data `ctrader/symbols.json`). No result of this study has been computed.

## Trades (unchanged)

Imported unchanged from `research/edge/gold-pre-holiday/run.mjs`: `holidays`, `buildDays`, `atrBefore`, `trade`, `eventDays`,
`st`, `welch`, `pOne`, `holm`, `rng`, `summary`, `COST`, `ATR_N`, `WIN`, `OOS_END`, `SEEDS`. The study's `study()` holds its
cost as a constant; it is re-written here with one change only: the cost of each trade (events, placebo days, ordinary days)
comes from a function. Financing exactly as the study charged it (`council/fills.mjs` `nights` × `FIN.xau.long`). Data: OANDA
mid H1 XAU/USD from 2006 through the site's candle proxy (the study's own fetch, address aureumdesk.co.uk since the old one is
gone), cut at 2026-11-13 as the study's file ended, kept out of git.

**Harness gate:** with $0.60 the re-written study reproduces `gold-pre-holiday/result.json` exactly (every test's is / oos /
whole summary, placebo, Holm p, checks, verdict). If not, the study stops and says so.

## The measured cost

- **Hour of a price** = the UTC start hour of the H1 candle the price comes from: the entry at the day's first H1 open (the
  New York reopen, 22:00 / 23:00 UTC), a close exit at the day's last H1 candle (20:00 / 21:00 UTC, earlier on an early close),
  a stop exit the candle in which it was hit.
- **C1**: round trip = (0.5 × frac[h_entry] + 0.5 × frac[h_exit] + commissionRT) × entry price. **C2** (stress): `frac90`,
  plus on a stop exit 0.10 × the median high − low of the 12 H1 candles ending with the stop candle. Today's relative spread is
  charged to every year. 2x costs = twice the C1 cost and twice the financing (as the study's 2x).
- **Not measurable** (stops and says so): no hour profile, or any hour a trade needs with fewer than 10 windows.

## Reading, fixed now

**PASS = T1 meets every check of the study's own bar under C1** (OOS 2017 → Oct 2026 net t ≥ 2 per event and Holm over T1-T3
one-sided p < 0.05; in-sample 2007-16 net > 0; OOS net > 0 at 2x costs; OOS net above ≥ 38 of 40 placebo means charged the same
way). T2 and T3 are recosted and reported on the same bar. Reported, not judged: C2, the month-sum t, the break-even round
trip. Limits: 60 weekdays of one demo account; the spread of the first 2 minutes of an hour stands for that hour (the reopen
and the last minutes before the close can be wider); OANDA mid candles; no slippage at C1.

## Deliverables

`research/edge/gold-pre-holiday-hourcost/{PREREGISTRATION.md, run.mjs, RESULT.md, result.json}`,
`tests/gold-pre-holiday-hourcost.test.mjs` (offline).

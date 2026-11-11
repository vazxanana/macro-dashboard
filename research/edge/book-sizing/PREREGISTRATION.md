# Book sizing: the trend leg's pyramid add, on against off: pre-registration

Written and committed **before** any number of this comparison was computed (11 Nov 2026). The comparison itself was fixed
earlier still, in `research/edge/supported-book/PREREGISTRATION.md` (before that study's results existed): it is run because
the supported book came out positive on untouched data. Nothing here changes after the results are seen; anything added
later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes, whatever the outcome.

## The question

The live Gold trend rule buys **one more unit** on the first daily close at least 1R above the entry, with the position's
current stop (`goldTrendAdd { atR: 1 }`). Is the supported two-system book (Gold trend + Gold daily engulf) a better book,
on data the rule never saw and after financing, **with that add (as live) or without it**?

## What is already known (seen before this was written)

- Per position, 2006-17, before financing (`gold-systems-oos` diagnostics): Gold trend's first unit alone +0.362R
  (n 75, t 2.09, worst drawdown 3.4R); with the add +0.489R (t 1.77, 5.4R).
- `supported-book`: with financing on every unit Gold trend is +0.313R a position (n 74, t 1.20, by close day); the leg's
  financing is 9.1R with the add against 6.8R on first units alone; the book with the add: +59.3R, t 1.86, worst
  drawdown 19.8R closed and 22.1R marked.
- Not known: the book without the add after financing, its drawdown, or how the two books compare beyond noise.

## Records and costs

`research/edge/supported-book/legs.json` (the committed engine's units; gated there against `gold-systems-oos`), and that
study's functions, imported and not edited. **Off** = the same records with every Gold trend add unit left out. That is
exact, not an approximation: in the engine and in the live Trader the add never changes the first unit's entry, stop or
exit (it shares the stop the first unit already has), and the daily engulf has no add. Costs: $0.30 a unit round trip (x1;
x2 = $0.60) and financing on every unit by `council/fills.mjs` `nights` × `FIN.xau.long` (F1), as in `supported-book`.

## The one comparison

| book | units |
|---|---|
| **ON** (as live) | Gold trend first units and adds, Gold daily engulf |
| **OFF** | Gold trend first units only, Gold daily engulf |

Window: **W1, untouched, 2006-07-01 to 2017-12-31** (booked on the close day, weekdays, as `supported-book`), halves
2006-07 to 2011-12 and 2012-01 to 2017-12. Cost basis x1, F1.

**Statistic:** return ÷ worst drawdown of the closed-trade daily series (total net R ÷ the largest peak-to-trough fall,
the peak floored at 0). Difference D = OFF − ON.

**Noise test:** paired month-block bootstrap, 2,000 draws, seed 1 (the same draw of months for both books): the 90 %
interval of D and P(D > 0).

**Reading, fixed now:**
- **OFF is better, beyond noise** only if all three hold: P(D > 0) ≥ 0.95; D > 0 in both halves; D > 0 at x2 costs.
- **ON is better, beyond noise** only if the mirror holds: P(D > 0) ≤ 0.05; D < 0 in both halves; D < 0 at x2 costs.
- Otherwise **within noise**: the evidence does not separate them, and the live rule stays as it is with no proposal.

One comparison, one window, one statistic: no selection, so no multiple-test correction applies.

**Reported, never part of the reading:** total R, R a year, t on daily book R, worst drawdown (closed and marked to
market) and its length for both books; the same on 2018-26 and 2020-26 (built-on years, in sample, not a test); the same
with Gold trend fast in the book (its add on / off too); F½ and F0; the add units by themselves (n, mean net R, t, their
financing).

## What the result may be used for

"OFF is better, beyond noise" becomes a written proposal to the owner to switch the add off on paper (absolute rule 3: the
owner decides; no code changes here). "ON is better" or "within noise" changes nothing. Neither outcome makes the book an
edge: `supported-book` put its t at 1.86.

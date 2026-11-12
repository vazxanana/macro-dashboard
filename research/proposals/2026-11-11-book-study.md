# The supported book, measured: what to expect, and one small correction (11 Nov 2026)

Paper research for the owner, after "we need more improvement so we start make money". Nothing here changes a live rule, a
size, a filter, a stop, `config.json` or any council member: the one proposal below waits for your yes or no. Paper trading
and demo accounts only. Three pre-registered studies were run today; every figure is from their committed results.

## In plain words

1. **The book you approved (Gold trend + Gold daily engulf) has now been run as a book.** On the eleven and a half years
   none of its rules saw (2006-17), after spread, slippage and overnight financing on every unit, it made **+59.3R, about
   +5.2R a year** (330 positions; t 1.86 on daily book R over 3,000 weekdays). The bar for "proven" was a t of 2: **it does not
   reach it.** It is positive in both halves and at doubled costs, so it is a positive, unproven book, not a losing one.
2. **What a year looks like at 0.25 % risk a trade: about +1.3 % (somewhere between +0.1 % and +2.6 %), with a worst
   drawdown of about 5 % that lasted almost four years** (from March 2014, not regained by the end of 2017). Half the
   years lost. Almost all the profit came in 2006-11, when gold rose; 2012-17 made +4R in six years.
3. **Nothing tested today raises it.**
   - *Sizing* (`book-sizing`): the trend leg's extra unit (the add) on against off: no difference the data can see
     (return ÷ drawdown 2.99 against 2.87, bootstrap interval of the difference −0.99 to +0.99). The add stays.
   - *More markets* (`trend-breadth-h1`): the Gold trend rule, unchanged, on thirteen other liquid markets with hourly
     candles, with a harness that reproduces the gold record (75 of 75 and 59 of 59 positions): **0 of 14 tests pass**;
     pooled −0.06R a position after costs on 2020-26 (n 827, monthly t −0.89), +0.04R before any cost. The rule is not a
     general trend rule; its gold record is a bet on gold rising with a trailing exit. It cannot be multiplied.
   - *Adding Gold trend fast*: +46 % more R and +49 % more drawdown on untouched data, and a lower t (1.77): a bigger
     position in the same idea (0.91 correlated), no better per unit of drawdown. A size choice, yours, with no evidence
     either way.
4. **So "making money" with this book means: a small, slow, positive expectation that depends on gold trending, sized by
   how much drawdown you accept, judged over years.** The built-on years (2018-26: +13R a year) are three times the honest
   rate and should not be planned on.

| study | question | verdict | key numbers (untouched data unless said) |
|---|---|---|---|
| `supported-book` | Is the two-system book's return distinguishable from zero after all costs? | **FAIL** (positive, unproven) | +59.3R, +5.2R a year (90 % interval +0.3 to +10.3), n 330, t 1.86; drawdown 19.8R closed / 22.1R marked, 3.8 years; worst year −8.1R |
| `book-sizing` | Is the book better with or without the trend leg's add? | **FAIL** (within noise, nothing to change) | with +59.3R on 19.8R; without +54.3R on 18.9R; P(without better) 0.54; the add alone: 34 units, +5.0R, t 0.60 |
| `trend-breadth-h1` | Does the Gold trend rule earn on 13 other markets? | **FAIL** (0 of 14) | pooled 2020-26: −0.059R a position, n 827, t −0.89; 2005-19: −0.028R, n 1,690, t −0.52; best market Brent +0.59R (n 39, t 1.64) but −0.13R before 2020 |

## The one proposal

**"What to expect" undercounts the trend legs' financing.** Since this morning the expectations charge financing on a
position's first unit only, because the study records did not carry the add. Today's unit-level records do. With every
unit charged, on untouched data:

| system | first unit charged (shown today) | every unit charged | 
|---|---|---|
| Gold trend | +0.398R a position (t 1.49) | **+0.313R (n 74, t 1.20)** |
| Gold trend fast (shadow) | +0.289R (t 1.53) | **+0.211R (n 128, t 1.17)** |
| Gold daily engulf (no add) | +0.141R (t 1.46) | +0.141R (n 256, t 1.46) |

(The every-unit figures are by close day, as the book is; the first-unit ones by entry day, so n differs by one.)

**Decision for you: shall the "What to expect" figures for the two trend legs be rebuilt from the unit-level records, so
the add's financing is counted?** Recommended: **yes**. It changes no trade: it makes the page's expectation for Gold
trend about a fifth lower (+0.40R → +0.31R a position) and its "trades until it can be judged" longer, which is the
honest state. If nothing is decided, the page keeps the first-unit figure and overstates the trend leg a little.

## What is not proposed, and why

- **No size change.** The per-trade risk scales return and drawdown together (+1.3 % a year with a 5 % drawdown at
  0.25 %; double both at 0.5 %). That is your choice of how much drawdown to live with, not something a study can pick.
- **No new market, no shadow stream.** Silver and the two oils were positive on 2020-26 (n 50, 39, 39; t 0.95, 1.14,
  1.64), none near the pre-registered bar, and Brent lost before 2020.
- **No new entry rule.** The review's point stands: seventy-odd studies, and the two systems kept are the ones with the
  nearest thing to evidence.

## What could not be verified

- The broker's financing rate in past years. Today's rate (5.3 % a year on gold) is charged for every year; it is
  the highest of the sample. At half the rate the book's t is 2.15, with no financing 2.43: **financing at today's rate
  is the difference between "proven" and "not proven" on this test.** If dollar rates fall, the cost falls.
- The financing rates of the other thirteen markets (assumed at 5.5 % a year for a long and 1.5 % for a currency
  position; the result does not depend on them: the pool is +0.02R a position without any financing).
- Anything forward: the book's live paper record is 1 engulf trade. At its honest pace a verdict takes years.

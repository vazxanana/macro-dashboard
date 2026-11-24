# The five rules that passed, as one paper book since 2016 (24 Nov 2026)

Accounting for the owner, not a study: **no rule is tested and there is no verdict.** Nothing live changes and no decision is
asked for. Figures from `research/edge/passing-rules-book/` (pre-registered, `run.mjs` → `result.json` / `RESULT.md`).

## Read this first

Every year shown (2016 to 19 Nov 2026) is a year at least one of these rules was found or judged on. So this is what the record
**looked like**, not what it will do. The forward records that started this month are the real judges. The earlier note of
23 Nov (`2026-11-23-edge-book.md`) grades the rules: only the two breakouts have strong evidence; gotobi is close; the
pre-holiday long and Turnaround Tuesday are weak (their replications were not independent or failed). They are in this book
because the owner's question named them.

## The rules, 1R a trade each, after each study's own costs

| Rule | Trades | R a year | Month t | Worst drawdown | Longest under water | Worst year | Cost |
|---|---|---|---|---|---|---|---|
| Gold breakout | 2,059 | +19.2R | 3.75 | −28.3R | 597 days (2023-24) | 2023 −8.2R | measured |
| USD/JPY breakout | 2,079 | +12.1R | 2.50 | −33.8R | 574 days (2022-24) | 2023 −15.4R | demo cost, pre-set |
| Gotobi fade | 772 | +10.4R | 2.72 | −18.9R | 981 days (2016-19) | 2018 −2.8R | assumed (higher than measured) |
| Gold before a US holiday | 100 | +1.1R | 2.21 | −2.8R | 672 days, still under water | 2025 −1.4R | assumed |
| Turnaround Tuesday (Nasdaq) | 82 | +0.7R | 1.98 | −1.2R | 1,051 days (2021-24) | 2022 −0.7R | assumed |
| **All five together** | 5,092 | **+43.6R** | **4.81** | **−49.8R** | 469 days | **2023 −23.0R** | |

In plain words: almost all of the book is the two breakouts and gotobi. The holiday and Tuesday rules add about 2R a year
between them. 2023 was the one losing year for the book: both breakouts lost that year at the same time.

**How linked are they?** Hardly at all day by day (largest daily correlation 0.14, gold breakout with USD/JPY breakout). By month
the two breakouts move together a little more (0.22). The USD/JPY breakout and gotobi trade the same pair on the same morning on
569 days, so on those days the book holds two USD/JPY positions.

## What three years could look like (a resampling of the same months)

Drawing 36 months at random from the 131 on record, 20,000 times:

| | Bad case (5 %) | Middle | Good case (95 %) | Chance of a losing 3 years |
|---|---|---|---|---|
| All five, R | +46R | +130R | +217R | 0.4 % |
| At 0.25 % a trade | +11.6 % | +32.4 % | +54.2 % | |

The worst drawdown inside those three years was about −20R in the middle case and −41R in the bad case (−5 % and −10 % at
0.25 %). **This resampling treats every month as independent**, so a run of bad months like 2023 is likely understated, and it is
built from years the rules were found on. Read it as the spread of the old record, not a forecast.

## At 0.25 % of the account a trade (simple, not compounded)

About **+11 % a year** for the whole book, with a worst drawdown of **−12.4 %** and a worst year of **−5.7 %** (2023). Each rule
alone: gold breakout +4.8 % a year (drawdown −7.1 %), USD/JPY breakout +3.0 % (−8.4 %), gotobi +2.6 % (−4.7 %), the other two
under 0.5 %. Slippage beyond what each study charged is not counted.

## What changes nothing

- No rule, size, weight or filter was chosen from these figures; nothing here is called an edge.
- With gotobi priced at the broker's own quotes from Nov 2023 the book is a little better (+44.5R a year): the gotobi study's
  assumed cost is higher than what the demo broker quotes.
- The forward records (gold breakout from 13 Nov, USD/JPY breakout from 20 Nov, the holiday long from Thanksgiving, Turnaround
  Tuesday from 12 Nov) and the demo jobs are what will tell whether any of this holds.

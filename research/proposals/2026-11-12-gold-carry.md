# What a gold buy costs to hold, and which route is cheapest (12 Nov 2026)

For the owner. From the study `research/edge/gold-carry` (pre-registered, committed before any number). Nothing was changed:
no rule, size, filter, stop, setting, cost figure or demo-mirror setting. Decision: `docs/owner-decisions.md` item 49.

## Why this was looked at

Your paper book (Gold trend + Gold daily engulf) buys gold and holds it for a few nights (4 at the median; Gold trend about
12). Every night held costs money. At the demo broker's rate that charge took 20.5R of the book's 80R over 2006-17 and is the
reason its test reads 1.86 instead of 2.43. In item 46 you agreed to "ask your broker what it charges overnight on a gold
buy, against two other brokers". This is that comparison, with two other ways of holding gold added.

## The answer in one table

The book over the years none of its rules were built on (2006-07 to 2017-12, 330 trades), after the usual trading cost and
each route's holding cost. "Cost a year" is what holding one ounce for a year costs as a share of its price.

| how you hold the gold buy | cost a year today | the book, R a year | test (t) |
|---|---|---|---|
| no holding cost at all (for reference) | 0 | +6.9 | 2.43 |
| **your demo broker (CFD)**, what the paper book is charged now | **5.4 %** | **+5.2** | **1.86** |
| IC Markets, Raw account (CFD) | 4.7 % | +5.4 | 1.94 |
| Afterprime (CFD) | 5.7 % | +5.1 | 1.83 |
| Pepperstone UK (CFD) | 7.8 % | +4.4 | 1.60 |
| **micro gold futures** (COMEX MGC, 10 ounces), plus commissions | **about 2.2 %**, up to 3.8 % | **+5.5** | **1.96** |
| a gold ETF (GLDM), counting the interest its cash no longer earns | 4.0 % | +5.6 | 2.02 |

What you can rely on in this table:

- **Your demo broker is in the middle of the pack, not expensive.** All 32 retail accounts in a September 2026 survey charged a
  gold buy; the three named there sit at 4.7 %, 5.7 % and 7.8 % a year. Yours charges about 1.5 points over the dollar's
  overnight rate.
- **The cheapest route that can be explained is micro gold futures**: the holding cost is built into the futures price,
  about the dollar rate minus what gold lenders charge. Measured this year on the December contract against spot: about
  3.6 % a year on average, about 2.2 % in the last four weeks (that late figure is uncertain: it could be as high as 3.8 %).
  But a futures trade pays a commission (about $2 a contract each way round) and must be rolled every two months; over the
  test years those fees gave back about half of what the lower holding cost saved.
- **An ETF looks almost free on the statement (0.1 % a year) but is not**: you pay the whole price in cash, which then earns
  no interest. Counted honestly it costs about 4 % a year, and its stop can only fill while the stock exchange is open.
- **The route is worth about a third to a half of an R a year to this book.** That is real money, but it does not turn an
  unproven book into a proven one: the book's own yearly result could be anywhere from about +0.3R to +10R by chance, far
  wider than any difference between routes. A test of 2 reached by picking the cheapest cost after seeing the results would
  prove nothing.
- **Rates matter more than brokers.** In 2009-15, when dollar rates were near zero, every route was cheap; following the
  rates of each year, the demo broker's charge would have averaged about 2.8 % and the book reads t 2.13. Today's charge is
  the highest the book's history has seen, and it falls when rates fall.

## What changing route would mean in practice

- **The paper book.** Its cost model (`FIN`, the demo broker's own rate) is the charge the demo account really pays. The
  forward-test protocol you adopted (item 43) checks the demo account's financing against that figure (check E4). Charging
  the paper book a cheaper route's rate would make the paper record look better than the account that copies it, and break
  that check. So the paper book should keep the demo broker's rate.
- **The demo mirror** trades CFDs on cTrader. It cannot hold futures or an ETF. Moving it to another CFD broker's demo would
  save about 0.7 point a year at best (IC Markets' level) and means new demo accounts, new symbol specifications and a
  restart of the execution checks: not worth it for a paper desk.
- **The futures tickets already exist.** Every phone alert for a live gold trade carries a micro gold futures ticket
  (`council/futures.mjs`: contract, size, stop and target as futures prices, rolled a week before the delivery month). They
  are for placing by hand on TradingView; nothing places them automatically. The obstacle is size, not the ticket: one MGC
  contract is 10 ounces, so at today's stops one contract risks about $390 to $1,360, and a quarter of a per cent of risk a
  trade needs an account of roughly $160,000 to $540,000.
- **Real money stays off** (item 46: paper and demo only, look again no earlier than November 2027). This study changes
  none of that; it tells you what to ask a broker when that look comes.

## The decision (item 49)

**Keep charging the paper book at your demo broker's rate (5.4 % a year), and when real money is looked at again, choose the
broker partly by what it charges overnight on a gold buy: about 4.7 % a year or less (IC Markets' level today), or micro
gold futures if the account is large enough for 10-ounce contracts?**

- **(a) Yes** (recommended): nothing changes now; the condition is written into item 46's November 2027 review.
- (b) Charge the paper book a cheaper route's rate now: not recommended (it would flatter the record and break check E4).
- (c) Move the demo mirror to another broker or to futures now: not recommended (small saving, new setup, futures too large
  for the account).

**If nothing is decided**: nothing changes; the paper book keeps the demo rate, and the comparison stays on file for 2027.

## What could not be checked

No broker, CME or ETF issuer page could be opened from here; every broker swap, commission and ETF fee above comes from web
search summaries of publishers' pages (dated in the study), none from memory. Before any real account is opened, read the
live swap in that broker's own platform. The lowest figure found (one broker at 0.3 % a year, in one January review) is
below the dollar rate and could not be read, so it is listed in the study and not relied on. The dollar's overnight rate
before August 2025 and gold's lending rate before 2026 could not be reached; the study uses the 2-year Treasury yield and
zero instead, and says so.

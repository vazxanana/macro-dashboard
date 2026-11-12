**Verdict:** INCONCLUSIVE (cost accounting, no rule tested): holding the book's gold buys costs 5.4 % a year at the demo broker (book +5.16R a year, t 1.86, 330 positions, untouched 2006-17); the cheapest route that could be checked, micro gold futures, carried 2.2 % a year in Oct-Nov 2026 (3.6 % over the year) plus commissions and rolls, and leaves the book at +5.51R a year, t 1.96: the route is worth about half an R a year, not the difference between a proven and an unproven book.

# What it costs to hold a gold buy, route by route (12 Nov 2026)

Paper research only. **No trading rule was tested** (no entry, exit, gate, filter, stop or size; owner decision 44), and no
live rule, size, filter, stop, config, cost constant (`council/fills.mjs` `FIN`) or mirror setting was changed. The routes,
data, arithmetic and the three statements were committed before any number (`PREREGISTRATION.md`, commit 7aae6a08).

**The question** (owner decision 46: "ask what your broker charges overnight on a gold buy, against two other brokers"):
what does it cost, a night and a year, to hold a long gold position the way the live paper book (Gold trend + Gold daily
engulf) holds it, through each realistic retail route, and what are the book's figures at each?

## How the book holds gold

From `research/edge/supported-book/legs.json`, untouched 2006-07 to 2017-12 (330 positions, 364 units; a night is a
Monday-Friday 22:00 UTC rollover, a Wednesday counts three, as `council/fills.mjs` `nights`):

| | median nights | mean nights |
|---|---|---|
| a position (both legs) | 4 | 6.0 |
| a Gold trend first unit | 12.5 | 14.1 |
| a Gold daily engulf unit | 2 | 3.7 |

At the demo rate one night costs 0.0148 % of the price; a median position (4 nights) 0.06 %; a median Gold trend hold
(12.5 nights) 0.19 %. Small against the price, large against the risk: a unit's stop is about 1-3 % of the price away, so a
week's financing is several hundredths of an R.

## The routes, today, and the book at each (S2, untouched 2006-07 to 2017-12, net of the $0.30 round trip and the route's cost)

| route | cost a year today | book R a year (90 % band) | t daily | net R | worst drawdown closed / marked | 2006-11 / 2012-17 |
|---|---|---|---|---|---|---|
| no financing (reference, supported-book F0) | 0 | +6.94 (+1.9 to +12.3) | 2.43 | +79.8 | 18.0 / 19.9 | +66.4 / +13.4 |
| **demo broker CFD swap** (the paper cost model, `FIN`) | **5.40 %** | **+5.16** (+0.3 to +10.3) | **1.86** | +59.3 | 19.8 / 22.1 | +55.3 / +4.0 |
| IC Markets, Raw account, CFD swap | 4.69 % | +5.39 (+0.5 to +10.5) | 1.94 | +62.0 | 19.6 / 21.8 | +56.8 / +5.3 |
| Afterprime, CFD swap | 5.72 % | +5.05 (+0.2 to +10.2) | 1.83 | +58.1 | 19.9 / 22.3 | +54.6 / +3.4 |
| Pepperstone UK, CFD swap | 7.79 % | +4.37 (−0.4 to +9.4) | 1.60 | +50.2 | 20.7 / 23.1 | +50.4 / −0.1 |
| DLSM (one monthly review's lowest; see below) | 0.34 % | +6.83 | 2.40 | +78.5 | 18.1 / 20.0 | +65.7 / +12.8 |
| **micro gold futures (MGC)**: basis Oct-Nov 2026 + $2.12 a round trip and a roll | **2.20 %** + fees | **+5.51** (+0.6 to +10.8) | **1.96** | +63.4 | 19.8 / 21.9 | +57.5 / +5.8 |
| the same, expiry taken as 1 Dec (sensitivity, post hoc) | 3.81 % + fees | +4.98 | 1.79 | +57.2 | 20.3 / 22.5 | +54.2 / +3.0 |
| gold ETF GLDM, statement charge only | 0.10 % | +6.91 | 2.42 | +79.5 | 18.0 / 19.9 | +66.2 / +13.2 |
| **GLDM counting the interest its cash would earn** | **3.98 %** | **+5.62** (+0.8 to +10.8) | **2.02** | +64.7 | 19.3 / 21.5 | +58.2 / +6.5 |
| IAU, counting interest | 4.13 % | +5.58 | 2.00 | +64.1 | 19.4 / 21.6 | +57.9 / +6.2 |
| GLD, counting interest | 4.28 % | +5.53 | 1.98 | +63.6 | 19.4 / 21.6 | +57.6 / +6.0 |

Financing taken over the window (R): demo 20.5, IC Markets 17.8, Afterprime 21.8, Pepperstone 29.6, futures 8.4 of carry
**plus 8.1 of commissions and rolls**, GLDM with interest 15.1. Every route keeps the same 330 positions, the same worst
year (2013, −6.8R to −8.1R) and 6 positive years of 12.

**The rate grid** (flat rate a year → t on daily book R): 0 % 2.43, 1 % 2.33, 2 % 2.23, 3 % 2.12, 4 % 2.01, 5 % 1.91,
6 % 1.80, 7 % 1.69. **Break-even: the book's t reads 2 at a flat 4.1 % a year or less.** Each percentage point of yearly
carry is worth about a third of an R a year to the book (and 0.1 of t).

## What each route's figure is, and where it comes from

- **Demo broker.** `FIN.xau.long` = 0.000148 of the price a night (the broker's own XAUUSD record, swap.long −5.903 pips, read
  11 Nov 2026, confirmed by the demo account's own deals), × 365 = 5.40 % a year. SOFR that day was 3.88 %, so the broker
  charges about **1.5 points over the overnight dollar rate**.
- **Other CFD brokers.** The broker sites could not be opened from this session; the figures are those in web search
  summaries of two publisher pages, **not opened and not verified**: IC Markets Raw −$57.55, Afterprime −$70.26 and
  Pepperstone UK −$95.58 a 100-ounce lot a night (Finance Magnates article "The battle for gold traders moves overnight: 32
  accounts charge, one offers positive swaps", ForexBenchmark data, republished on coinspectator.com, 3 Sep 2026; all 32
  accounts in it charged a gold buy); DLSM −$4.33 (FastBull BrokersView "January 2026 swap rates review", "lowest among all
  brokers", day not given: mid-January used). Each is turned into a rate with OANDA's gold close of its date ($4,480 on
  3 Sep, $4,610 mid-January). Over SOFR on those dates: IC Markets +1.0 point, Afterprime +2.1, Pepperstone +4.1, DLSM
  **−3.3** (below the cash rate: a broker cannot do that for long without a subsidy; it is one figure in one review and
  the page could not be read, so it is listed and not relied on). Not found: the demo broker's own published live-account
  rate; a figure for any other broker the desk has used. One account type (Born2trade "Dynamic") was reported to *pay* a
  gold buy up to $19.99 a lot a night as a promotion until 31 Dec 2026: a promotion, not a cost to plan on, not computed.
  Brokers change these rates without notice, usually weekly; every figure above is a snapshot.
- **Micro gold futures (MGC, 10 oz; carry measured).** A futures buyer pays no swap: the carry is in the price, which sits
  above spot by about the dollar rate minus gold's lease rate and drifts down to spot by expiry. Measured on 198 weekdays
  of 2026: COMEX December 2026 gold (`GCZ26`, the one contract in council-data `research/probe/cnbc-gc`: CNBC's `@GC.1`
  intraday prints are the current contract's own) against OANDA spot at the same minute, 14:00-17:00 UTC, median ln(F/S)
  a day ÷ years to 29 Dec 2026. **Implied carry by month**: Jan 3.78 %, Feb 3.67, Mar 3.75, Apr 3.75, May 3.68, Jun 3.63,
  Jul 3.48, Aug 3.48, Sep 3.25, Oct 2.47, Nov (3 days) 1.66 %; whole year 3.59 %; **last 20 days 2.20 %** (the figure the
  route uses). SOFR was 3.60-3.95 % all year, so the implied lease rate was about zero until June and rose to about
  1.7 % in Oct-Nov. **This late figure is fragile**: with two months to expiry a small error in the matched prices, or in
  the expiry date, moves it a lot (to 1 Dec instead of 29 Dec: 3.81 %). Read the futures carry as "between about 2 % and
  3.8 % a year today, close to the overnight rate". Commissions: $2.12 all-in a round trip a contract (a Tradeify help
  page, a prop firm; Interactive Brokers lists $0.10-0.25 a side plus exchange and regulatory fees; the last CME micro gold
  non-member fee found was $0.50 a side in a 2021 notice; all from search summaries, not opened), charged at entry and at
  every even-month roll inside a hold (`council/futures.mjs`'s dates) plus one tick ($0.10 an ounce) a roll: **8.1R over
  the window**, about as much as the carry saved against the demo broker. They weigh less at today's prices (a dollar fee
  is a smaller share of a stop when gold is $4,000 than when it was $600).
- **Gold ETF.** Expense ratios GLDM 0.10 %, IAU 0.25 %, GLD 0.40 % (Snowball Analytics, Nasdaq, 247wallst, July 2026; search
  summaries, the issuers' pages not reached). That is all the statement shows, but the ETF is bought outright: the whole
  price leaves the cash, which then earns nothing, while a CFD or futures position ties up only a margin. **Counting that
  interest (SOFR, 3.88 %) is the honest comparison**: 3.98-4.28 % a year. The statement-only rows are shown so the
  difference is visible, not as a route.

## The past was cheaper: rates following short rates (history)

A flat charge at today's rate overstates the past: dollar rates were near zero from 2009 to 2015. The overnight rate's
history could not be reached from here (FRED, the Treasury and the New York Fed refuse this session's network); the only
rate history at hand is the **2-year Treasury yield** (FRED `DGS2`, weekly, the council's own cache), used as of the last
week before each night. Its yearly means: 2006 4.82 %, 2007 4.36, 2008 2.01, 2009 0.96, 2010 0.70, 2011 0.44, 2012 0.28,
2013 0.31, 2014 0.46, 2015 0.68, 2016 0.84, 2017 1.40. It is a 2-year yield, not an overnight rate: on the overlap with SOFR
(Sep 2025 to Nov 2026) it sat 0.15 point above SOFR at the median (−0.95 to +1.01). When rates were expected to rise
(2010-17) a 2-year yield sits above the overnight rate, so these rows likely still **overstate** the past cost.

| route, rate = 2-year yield + the route's margin over SOFR today | mean rate 2006-17 | book R a year | t daily | 2006-11 / 2012-17 |
|---|---|---|---|---|
| demo broker (+1.52) | 2.82 % | +5.99 | 2.13 | +59.2 / +9.7 |
| IC Markets (+1.03) | 2.32 % | +6.15 | 2.18 | +60.2 / +10.5 |
| Afterprime (+2.06) | 3.36 % | +5.81 | 2.07 | +58.1 / +8.7 |
| Pepperstone UK (+4.13) | 5.42 % | +5.13 | 1.85 | +53.9 / +5.2 |
| micro gold futures (lease taken as 0; + fees) | 1.29 % | +5.79 | 2.05 | +58.0 / +8.6 |
| GLDM counting interest (+0.10) | 1.39 % | +6.46 | 2.28 | +62.2 / +12.2 |

Gold's lease rate before 2026 could not be reached either; taking it as zero overstates the futures carry wherever it was
positive.

## The three pre-registered statements

1. **The table** is above (flat today, and following short rates).
2. **The cheapest honest route**, by the true carrying cost today: the lowest figure found is DLSM's (0.34 %), one number
   in one review, below the cash rate and not readable here, so **not relied on**. Of the routes whose cost can be
   explained, **micro gold futures** (2.2 % measured, up to 3.8 % with the other expiry date) are cheapest, then a gold ETF
   counting the interest on its cash (4.0-4.3 %), then IC Markets' CFD (4.7 %), the demo broker (5.4 %), Afterprime
   (5.7 %), Pepperstone UK (7.8 %). The futures' commissions and rolls give back about half of their carry advantage over
   this window, and one MGC contract is 10 ounces: at today's stops (about $39-48 an ounce on the engulf, $93-136 on Gold
   trend, `research/proposals/2026-11-12-path-to-live.md`) one contract risks $390-1,360, so 0.25 % a unit needs an account
   of roughly $160,000-540,000. An ETF's stop is a market order during exchange hours only (the book's stops are on spot,
   around the clock), so gaps between sessions would fill worse than the backtest.
3. **Below the break-even rate (4.1 %)**: futures (2.2 %), GLDM counting interest (3.98 %, by 0.1 point) and the
   unreliable DLSM figure; with rates following short rates, every route except Pepperstone. **This is not a new verdict
   on the book.** The supported-book verdict stands as it was fixed (FAIL on t, 1.86 at today's demo rate): a t of 2 on a
   window that has been read many times, with a cost picked after seeing it, proves nothing new, and the band of the
   book's yearly return (+0.3 to +10.3R) is far wider than any difference between routes (at most 1.3R a year between the dearest and the
   cheapest explainable route).

## What this says, in plain words

- The demo broker's 5.4 % sits in the middle of what retail CFD brokers charge (4.7 % to 7.8 % in the September survey);
  it is not an outlier, and it is the rate the demo account really pays, so it stays the honest paper cost.
- The cheapest routes (futures, an ETF with its cash counted) are cheaper by about 1-3 points a year, worth +0.2 to +0.5R a
  year to the book: real money, not a different book.
- Rates matter more than brokers: at the near-zero rates of 2009-15 every route was cheap. Today's 5.4 % is the highest in
  the sample's history, and it falls when dollar rates fall.

## Not verified, said plainly

- No broker page, CME fee page or ETF issuer page could be opened (the hosts are refused by this session's network); every
  CFD, commission and expense figure is a search summary of a publisher's page. None was taken from memory.
- The overnight dollar rate before August 2025 and gold's lease rate before 2026 could not be reached: the 2-year yield
  stands in for the first, zero for the second.
- The futures basis is one contract over one year, matched on 1-minute prints that can be stale on a thin far contract;
  the latest weeks' figure depends on the expiry date assumed.
- Contract size is ignored in the arithmetic (the book's units are fractional); the ETF's stop hours and the futures'
  10-ounce lot are stated, not modelled. Interest the cash in a CFD or futures account might earn is not counted for those
  routes (it would make them cheaper still).

## To repeat

`node --use-env-proxy research/edge/gold-carry/run.mjs fetch` (reads council-data `macro/cache.json` and
`research/probe/cnbc-gc/` with `git show`, OANDA candles through the candle proxy; writes `rates.json`, `basis.json`), then
`node research/edge/gold-carry/run.mjs` (offline; the gate against `supported-book/result.json` first). Tests:
`tests/gold-carry.test.mjs`.

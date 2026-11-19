# Lead standings, update 2 (14 Nov 2026)

Written 14 Nov 2026 for the owner. An update to the first standings document (`research/proposals/2026-11-14-lead-standings.md`,
#965), covering the sixteen pull requests that landed after it (#966 to #981). A summary, not a study: no test was run for it,
no rule, size, stop, config or live system changed, and **nothing here is an edge**. Every figure is copied from a study's
RESULT.md / result.json on its own branch, or from the research-day table (`research/proposals/2026-11-13-research-day.md`,
branch `research-day-13nov`, rows 147-162), with its pull request number. Paper trading and cTrader demo accounts only.

The short answer: thirteen more studies, **all FAIL on their own bars**. One of them leaves a new lead: **long USD on the
first New York trading day after a US holiday** is real before costs on two independent sets of currencies, and dies after
the (assumed) spreads, like the others. The futures route map shows that the cheaper route rescues nothing that has held up
out of sample. The pattern of #965 holds without exception: **costs decide**.

## 1. What changed since #965

**New lead (section 2)**
| Study | Verdict | Key figures | PR |
|---|---|---|---|
| The dollar around US market holidays (fx-us-holiday) | FAIL on its judged test (the day BEFORE the holiday) | Day before: out of sample 2015-26 +0.015R a holiday net (n 109, t 0.53). Reported only: long USD the day AFTER, out of sample +0.089R (n 110, t 2.65), in sample −0.004R (n 88, t −0.10) | #975 |
| The day after, frozen, on six dollar pairs #975 never read (fx-post-holiday-replicate) | FAIL, 1 of 4 | 2005-26 +0.026R a holiday net (n 198, t 1.00); gross +0.075R, Welch t 2.72 against ordinary days; first half −0.006R, second half +0.058R | #980 |

**Closed (each FAIL on its own pre-registered bar)**
| Study | Key figures | PR |
|---|---|---|
| FX value (long the two majors most down over 60 months, short the two most up) | OOS 2015-26 −0.118R a month net (n 142, t −0.89), +0.094R before costs; financing exceeds the gross effect | #968 |
| FX MAX (lottery) effect | OOS −0.138R a month net (n 142, t −1.10), +0.077R before costs; IS −0.261R (t −1.91) | #969 |
| Bond intraday momentum (overnight-to-08:50 move predicts 14:30-15:00 New York, US 10y + 30y) | **Real before costs**: 2016-now +0.038R a trade gross (n 4,983, t 2.89), 2010-15 +0.045R (n 2,864, t 2.82), hit rate 53.3 % above all 40 placebos. After the CFD spread −0.547R (month t −23.8); at Treasury futures cost −0.263R. Bund and Gilt nothing | #970 |
| Commodity skewness | OOS 2016-26 −0.060R a month net (125 months, t −1.38), gross −0.010R | #971 |
| FX Asia-to-London reversal | OOS −0.048R a trade net (n 2,250, month t −3.24), gross −0.011R; no pair positive | #973 |
| Cross-country index momentum | OOS −0.065R a trade net (1,039 trades, month t −1.53), gross +0.003R; financing 0.057R | #974 |
| Natural gas after the storage report | OOS −0.078R a trade net (n 446, month t −1.69), +0.023R before costs | #976 |
| BTC / ETH around the monthly crypto expiry | OOS +0.052R a trade net (n 56, month t 0.60); 2022-26 data only | #977 |
| Treasury auction cycle (short the 10y into the auction) | OOS +0.012R net (n 107, t 0.13); IS −0.217R (t −2.63); auction dates approximated | #978 |
| FX toward round numbers before the 10:00 New York cut | OOS −0.054R a trade net (n 3,575, month t −7.86), +0.002R before costs; no pinning | #979 |
| Quarter-end rebalancing (US500 against USB10Y) | OOS −0.101R a trade net (n 47, t −0.89) | #981 |

**Accounting (no rule tested)**
| Document | What it says | PR |
|---|---|---|
| Spread measurement (owner proposal `2026-11-14-spread-measurement.md`) | Three free routes to measure the spread at the Tokyo fix and the Sunday reopen: A log the demo broker's ticks per window (recommended), B a hand-run GitHub Actions job for the two committed Dukascopy pre-registrations (recommended beside A), C OANDA bid / ask through `api/bars.js` (held: changes a served file) | #966 |
| Forward-test arithmetic for the leads (lead-forward-plan) | At each study's own cost no lead reaches an expected t of 2 within three years of forward record: gotobi 70 months, rule G majors 75, rule G new pairs 53 (27 at half cost), bond month-end CFD over 50 years, index overnight never. A 2-3 year demo record can measure the real cost and stop a bad stream; it cannot prove a lead | #967 |
| Futures route map (section 3) | 10 tests would pass their own bar at futures cost, 6 of them only there; Holm 0; 7 tests have no futures route | #972 |

## 2. The new lead: long USD on the first NYSE trading day after a US holiday

**Not an edge.** It is a second-look observation that has now been seen before costs on two independent sets of currencies.
The evidence, in order:

1. **Where it came from: #975, reported only.** That study's judged test was the day BEFORE a US holiday, and it failed
   (+0.015R a holiday out of sample, t 0.53). The day AFTER was pre-registered as reported only. On the seven majors, long
   USD: **out of sample 2015-26 +0.089R a holiday net (n 110, t 2.65; Welch t 2.59 against ordinary days); in sample 2005-14
   −0.004R (n 88, t −0.10).** The side was learned in a sample where it made nothing; the study itself says this is not
   evidence and would need its own pre-registration on data not yet read.
2. **The frozen replication: #980, on six dollar pairs #975 never read** (USD against MXN, ZAR, SEK, NOK, SGD, PLN; side,
   day, hold, stop and bar fixed from #975 before a candle was read). 2005-26:
   - **Before costs it is there again:** gross +0.075R a holiday, +0.070R with financing but no spread (t 2.67), Welch t
     **2.72** against 5,097 ordinary days, and **every one of the six legs positive gross** (+0.041R to +0.100R).
   - **After costs it is not:** +0.026R a holiday net (n 198, event t 1.00, month-sum t 0.95); −0.020R at 2x cost;
     first half (to 2015) −0.006R (n 97), second half +0.058R (n 101). It passes 1 of 4 checks (above 40 of 40 placebos,
     which mostly says ordinary days lose the same costs).
   - **The spreads are assumed, not measured** (the demo broker does not quote these pairs): 0.03 % to 0.10 % a round trip,
     +0.044R a holiday on the basket. The rates behind the financing are approximate.
   - Holidays are about nine a year; one holiday is one observation (the six legs of a basket are one bet).
3. **Pending: a third check on metals** (branch `post-holiday-metals`; only its pre-registration is pushed, no result yet).

What this adds up to, plainly: the same sign before costs on two separate currency sets is more than one lucky window, but
the net figure has never reached t 2 on data it was not found on, the first half of the replication is negative, and the
cost that kills it is a guess. It is blocked by cost like gotobi and rule G, with weaker evidence than either: neither its
original window (no in-sample support) nor its replication (net t 1.00) would pass a bar on its own. The real spreads on
these pairs at the UTC daily close are the missing figure (section 5).

## 3. The futures route (#972): it rescues nothing that has held up

The route map re-costed the 44 cost-blocked or near-bar tests at the nearest exchange future (fees mostly assumed, from
memory, not opened). **10 would pass their own bar at futures cost; Holm over the 32 re-costed family tests leaves 0**
(smallest Holm p 0.0508), and over the whole family of 333 tests also 0.

- **4 already passed at CFD cost** and still do: gotobi T2 (#878), gotobi USD/JPY 2005-09 (#889), vol-spike 10-day hold
  (#860), turnaround NAS100 r2 (#857). Nothing new there.
- **6 pass only at futures cost, and each had already failed out of sample:**

  | Test, futures figure (#972) | Its own replication |
  |---|---|
  | index IBS T2 (#895): +0.089R, t 2.68 | ibs-replicate (#924): DOES NOT REPLICATE, −0.041R a trade net on seven other indices 2016-now (n 3,543, month t −1.97) |
  | RSI(2) SPX500 (#838): +0.383 %, t 2.43 | rsi2-replicate (#844): FAIL, +0.027R a trade on six non-US indices (n 521, month t 0.85); also #873, #955 fail (#965) |
  | RSI(2) US30 (#838): +0.350 %, t 2.28 | the same replication (#844) |
  | vol-spike 5-day hold (#860): +0.574 %, t 2.26 | vol-spike-replicate2 (#951): DOES NOT REPLICATE, +0.062R a trade net (n 475) but month t 1.17; earlier #920 t 1.20 (#965) |
  | turnaround replicate pooled (#862): +0.063R, t 2.03 | this row IS the replication, and it failed its own bar at CFD cost (+0.052R, month t 1.69); the later frozen run on eight unused CFDs, #958, −0.015R a trade (n 586, month t −0.58) |
  | gotobi T3 (#878): t 2.20 either way | #972 itself calls it a cost-model artefact: it passes only because its 2010-15 replication turns from −0.016R to +0.017R at the cheaper 6J tick of those years |

- **No futures route for forex crosses**: all four Sunday-gap (rule G) tests, the gotobi crosses and the London opening
  range have none (7 tests). CME currency futures cost about as much as the ECN costs the forex studies assumed or more,
  so the FX fixes get worse; micro gold costs more than the $0.30 the gold studies charged.
- Bond month-end on 10-year futures: t 1.60 (one tick a side) to 1.90 (the replication's pool); it does not reach t 2 here.

So the cheaper route changes the answer only for index trades held overnight to two weeks, and every one of those had
already failed on data it was not chosen on. A futures route chosen after seeing the CFD loss, on the same history, is not
evidence (#972's own words). Item 4 of #965 (futures prices as a paper cost model) loses most of its reason: it would cost
correctly only effects that have not held up.

## 4. What is still standing, and the pattern

**Still standing (none is an edge; none is ready for a forward stream until its real cost is measured):**
1. **Gotobi fade**, USD/JPY at the 09:55 Tokyo fix: +0.148R a trade, month t 2.74 (#878), replicated on 2005-09 (#889). Blocked
   by the 00:55:00 fill and the unmeasured spread at that minute (#965, unchanged). Forward arithmetic: 70 months of record
   for an expected t of 2 (#967).
2. **Rule G, the forex Sunday-gap fade**: +0.194R, month t 2.14 (#880), borderline; failed on years never used (#928, #938).
   Blocked by the reopen spread; no futures route (#972). Forward arithmetic: 75 months (#967).
3. **Long USD the day after a US holiday** (new, section 2): gross real on two sets (#975, #980), net t 1.00 on the
   replication with assumed spreads. Metals check pending.
4. **Real before costs, dead after costs** (the family of #965 section 1C, now one larger): overnight index drift (#964),
   bond month-end rise (#961), London / ECB fix reversals (#910, #921), and now **bond intraday momentum (#970)**: gross
   t 2.89 and 2.82 in two windows, killed by a CFD spread of about 0.58R a trade and still −0.263R at futures cost.

**The pattern, updated.** Of the thirteen new studies, several were positive before costs (#968 +0.094R a month, #969
+0.077R, #970 +0.038R a trade at t 2.89, #976 +0.023R, #978 +0.134R, #980 +0.075R) and none kept t 2 after costs; the
others had little or nothing even before costs (#971, #973, #974, #977, #979, #981). Financing alone exceeded the gross
effect in the two FX ranking studies (#968, #969) and the index momentum study (#974). Where a real effect was found in
this batch (#970, #980) it died on the spread, the financing, or both. The cost of the trade, not the idea, decides.

## 5. Decisions only you can make

Unchanged from #965 except where marked. Paper and demo only until at least November 2027 (item 46); none of these opens a
live account or a live rule. Nothing here is added to `docs/owner-decisions.md`.

1. **Item 54: put the Mosha cycle back as a paper shadow** (#818). Unchanged.
2. **Measure the real spreads** (#965 item 2, now with routes): #966 sets out three free routes and recommends A (log the
   demo broker's ticks at the Tokyo fix and the Sunday reopen, read-only) with B beside it (a GitHub Actions run of the two
   committed Dukascopy pre-registrations), C held. **Changed:** the post-holiday lead depends on spreads too, and they were
   assumed: the six pairs of #980 (MXN, ZAR, SEK, NOK, SGD, PLN) are not quoted by the demo broker, so route A cannot read
   them; route B or C would have to include those pairs, at the UTC daily close, for the lead to be judged at all.
3. **A forward paper stream for a lead, once item 2 says its cost fits.** **Changed by #967:** at each study's own cost no
   lead reaches an expected t of 2 within three years, so a forward stream would measure the cost and could stop a bad
   stream, not prove a lead. The post-holiday lead is not a candidate for one until its metals check (pending) and a
   measured spread exist.
4. **Futures prices as a paper cost model.** **Changed by #972:** the effects it would help (index short-term reversals, the
   overnight drift) have each failed out of sample, and there is no futures route for the forex crosses; this decision now
   unblocks little.
5. **Allow `cdn.cboe.com` and `fred.stlouisfed.org` in the repository's environment** (#827, #830). Unchanged.
6. **Log your own trades on the Mosha desk (item 27).** Unchanged.

**Pending when this was written:** the metals check of the post-holiday lead (`post-holiday-metals`, pre-registration
only). Suggestion, not a decision: as in #965, measuring cost (item 2) is worth more than another family of rules; every
lead still standing waits on a spread nobody has measured.

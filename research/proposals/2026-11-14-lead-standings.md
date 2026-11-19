# Lead standings after the research days of 13-14 Nov 2026

Written 14 Nov 2026 for the owner. A summary, not a study: no test was run for it, no rule, size, stop, config or live
system changed, and nothing here is an edge. Every figure is copied from a study's RESULT.md / result.json or from the
research-day table (`research/proposals/2026-11-13-research-day.md`, branch `research-day-13nov`), with its pull request
number. The multiple-testing counts are #904 and #946, the cost figures #948 (cost floor map). Two pieces of work were still
running when this was written: **the futures route map** (no branch yet: pending) and **the forward plan for the leads**
(`lead-forward-plan`: only its pre-registration is pushed, no result: pending).

The short answer: about 145 pre-registered studies, 333 decisive tests counted together, **nothing survives the correction
for testing so many ideas** (Holm 0, BH q 0.10: 0; 6 tests at t ≥ 2 against 7.6 expected by chance, #946). One effect is
not chance (gotobi), one is borderline (the forex Sunday-gap fade), and a handful are real before costs but cannot be
traded on our route. None is ready for a forward paper stream until its real cost is measured.

## 1. What is still standing

**A. Gotobi fade (sell USD/JPY at the 09:55 Tokyo fix on Japanese settlement days, out at 15:00 Tokyo).** The day's one
result that is not chance.
- Best number: #878 T2, n 771, **+0.148R a trade after the assumed cost, month t 2.74** (+0.261R before costs, #948).
- Replicated: USD/JPY 2005-09, n 355, +0.261R, t 3.80 (#889, years never used); four yen crosses 2010-now, n 4,784,
  +0.099R, t 2.75 (#889, same days); a second data feed gives +0.127R, t 2.34, per-trade correlation 0.997 (#894, #912).
  Original plus the 2005-09 replication: combined p 3.6e-6, under the family's Bonferroni line (#904, #946).
- Failed: six crosses 2005-09, +0.135R before costs (month t 2.87) but +0.053R after (t 1.12) and negative at 2x cost
  (#957); the Nikkei shows no fix effect after costs (#959); on ordinary days the same trade loses, −0.063R, t −2.37 (#917).
- **What blocks it, two things.** (1) The minute: one minute late keeps +0.048R (t 1.07, #908, confirmed on the second feed
  #912), a resting limit placed before the fix keeps 5 % (#915). The mirror cannot fill at 00:55:00. (2) The cost at that
  minute: break-even 3.73 pips a round trip, t 2 only up to 1.95 pips (#893); at twice the assumed spread it is about zero on
  every feed (#878, #893, #894). Nobody has measured the spread at 00:55 / 06:00 UTC: Dukascopy is refused from the build
  sandbox (#950), and the demo's quote file of 14 Nov holds no yen pair (#948).

**B. Forex Sunday-open gap fade, rule G (fade the reopen gap on forex pairs back towards Friday's close).** Borderline.
- Best number: #880, n 243, **+0.194R a trade, month t 2.14**: a near miss on its own Holm bar (about 2.28 needed).
- Replicated on the same weekends: other pairs 2020-now, n 294, +0.238R, t 2.99 (#928); six untraded pairs 2016-now,
  n 481, +0.153R, t 3.19, every year positive, AUD/NZD half of it (#938).
- Failed on years never used: the majors 2010-15, +0.003R (#928); the crosses 2010-19, +0.061R, t 1.02 (#938). Combined on
  years never used: p 0.046, far from the Bonferroni line (#946). Entering an hour later, after the spread settles, leaves
  nothing (−0.005R before costs, n 1,203, #954). 2026 carries much of the 2020-26 total (#928: +39.7R of +70.1R).
- **What blocks it: the real spread at Sunday 17:05 New York.** #880 falls under t 2 at a 1.4-pip entry spread; the demo's
  only Sunday on file (8 Nov) read 14.5 pips on USD/CHF and 4.6 on USD/CAD against 0.3 assumed (#944). Not measurable from
  the sandbox (#944, #949).

**C. Real before costs, replicated before costs, dead after costs on CFDs (blocked by the route, not by chance).**
- **Overnight index drift** (long the close, out at the open): 14 index CFDs no earlier study used, n 36,701, +0.011R before
  costs (month t 2.10; 2005-15 t 4.41) and −0.025R after (t −4.83): spread −0.022R and financing −0.014R a trade (#964;
  earlier #836, #891). On CME micro futures the NAS100 leg would be +0.015R, t 2.02 (#900 as read by #948).
- **Bond month-end rise** (last three days of the month): US 2y, 5y, Bund, Gilt pooled +0.11R before costs (t 2.7-2.9, beats
  every placebo), −0.03R after (t −0.81) (#961; first seen #939). At an assumed futures cost +0.089R, t 2.21 (#961); the
  10-year on futures +0.088R, t 1.91 (#943).
- **Fix reversals**: the London 16:00 fix reverses before costs (+0.044R, t 3.87) but costs 0.124R a trade (#910); the ECB
  14:10 concertation the same shape, gross t 2.5-3.1, cost about 0.26R (#921). Costs are two to three times the effect: no
  retail route is cheap enough.

Everything else that once looked close has since failed a replication (section 2).

## 2. What is closed

Each line: failed everywhere it was tried. Studies that were "not measurable" are named where they matter.
- **Your market-cycle entry (H4 bias, wait for the H1 pullback to finish)**: as a gate on the gold systems (best t 0.99,
  #815), as an entry on indices (#874), forex (#877), crypto (#888) and commodities (#956); random entries with the same H4
  bias did better each time. **The Mosha cycle as traded live**: 115 trades, −0.574R, t −3.99 (#818; item 54 proposed).
- **Course setups written as rules, on gold**: weekly-bull rejection book (#816), ICT quarters (#817), Mosha BO + ER (#819),
  411 trendline (#820), EKF ladder (#822), MMXM day 3 (#825), last week's raid (#843), gold/silver divergence (#870).
- **Index reversals and rebounds**: Turnaround Tuesday (#857 pass, then #862 t 1.69, #958 −0.015R; #953 not measurable);
  RSI(2) pullback (#838 near miss, then #844, #873, #955 all fail; #952 not measurable); IBS close (#895, then #924
  −0.041R, n 3,543; meets its bar on futures only after the fact, #900); vol-spike rebound (#860, then #920 t 1.20, #951
  t 1.17, #962 absent on crypto); opening and weekend gap fades (#849, #898, #916); index pair spreads (#881, #884).
- **Calendar effects**: turn of the month (#826), pre-holiday (#845), Sell in May (#851), rebalancing flows (#846, #865),
  options expiry (#882), year-end dollar (#918), day of week (#919), Santa rally (#922), Japan's fiscal year-end (#936),
  small-cap January (#947), gold's seasonal months (#907), energy seasonality (#879); the soybean short passed its bar
  (#934) but moves with its dates by ten days (#937).
- **Around news**: FOMC drift and follow (#831, #861, #906, #925), payrolls (#863), CPI (#871), central-bank first hour
  (#896, then #901), the 24 hours before CPI / payrolls (#963).
- **Published trend, momentum and carry**: #823, #828, #830, #833, #839, #841, #853, #855, #856, #869, #892, #911, #935;
  weekly reversals (#834, #940), long-term reversal (#941).
- **Session breakouts and intraday momentum**: #835, #837, #848, #867, #868, #872, #914, #929, #932; other forex fixes and
  flows: #883, #902, #927, #931; spill-overs between markets: #859, #876, #899, #905, #913, #923, #926, #930, #942.
- **Crypto**: #842, #852, #866, #887, #890 (and the cycle entry #888, the rebound #962).
- **Shadow engine setups**: 0 of 32 even on the measured lower costs (#821; the 12 Nov cut stands).

## 3. The single pattern: real before costs, killed by spread and financing

Of 229 decisive tests whose costs could be read (#948):
- **134 were positive before costs.** 95 had no effect even before costs.
- **31 were blocked only by cost**: t ≥ 2 before costs, under 2 after. For 22 of them the cost would have to fall to under
  half of what the study charged.
- **91 were too weak to prove at any cost** (t under 2 even at zero cost).
- **12 kept net t ≥ 2 at the cost charged**: every one failed its study on another check (the other window, Holm, a
  placebo, or a replication).
- **At the demo's own measured cost only 2 reach t 2** (index IBS T2 2.46, RSI(2) on SPX500 2.16, #948), and both
  rules failed their replications (#924, #844, #873, #955). The demo figure is one day of quotes with no slippage: a floor.

Financing is often the deciding part on CFDs: the overnight drift loses −0.014R a trade to it (#964), time-series momentum
earned +0.033R a position before costs and paid 0.027R in trading cost and 0.062R in financing (#892). Fix and session
reversals are real and are two to three times smaller than the round trip (#910, #921). The CFD route, not the idea, decides
most of these results, which is why futures appear as "the cheaper route" for several of them (#900, #943, #961); the
futures route map that would set those figures side by side is still pending.

## 4. Decisions only you can make

Paper and demo only until at least November 2027 (item 46). None of these opens a live account or a live rule.
1. **Item 54 (proposed with #818): put the Mosha cycle back as a paper shadow.** It is the only live paper system with a
   measured, clearly negative record (−0.574R, t −3.99). Unblocks: nothing new; stops a known loss on paper.
2. **Measure the real spread at the two minutes that decide the two leads.** Let a GitHub Actions run (free minutes) fetch
   Dukascopy bid/ask: #949 (Sunday reopen) and #950 (Tokyo fix) are pre-registered and run unchanged there. Alternatives:
   an OANDA bid/ask change to the candle proxy (#944), or merging the yen spread log (#897, built, waiting) and about 20
   more Sundays of demo quotes. Unblocks: whether gotobi (t 2 up to 1.95 pips) and rule G (t 2 up to 1.4 pips) survive
   their real cost. If either does not, it closes.
3. **A forward paper stream for a lead, once item 2 says its cost fits.** The design is being written
   (`lead-forward-plan`, pending). For gotobi it only makes sense if the paper stream can take the 00:55:00 price itself,
   since the mirror's minute cadence cannot (#908, #915). Unblocks: a forward record on days no study has seen, the only
   evidence left that is not a re-read of history.
4. **Whether futures prices may be used as a paper cost model** for the route-blocked effects (overnight drift, bond
   month-end), with no futures account. Unblocks: a costed paper reading at t 2.02 (#900) and t 2.21 (#961, assumed cost);
   the route map is pending. A real micro-futures account for these is far off: #900 put the IBS rule at about $435,000.
5. **Allow `cdn.cboe.com` and `fred.stlouisfed.org` in the repository's environment** so the two studies that could not run
   (#827 VIX term structure; #830's real policy-rate table) can. Unblocks: two published-effect tests, nothing more.
6. **Log your own trades on the Mosha desk (item 27).** Every mechanical version of the course methods has now failed; what
   remains is your own selection, and only your logged trades can measure it.

Suggestion, not a decision: with 333 decisive tests and nothing standing after correction, a new idea now has to clear a
higher bar than one more pre-registered test. Measuring cost (item 2) and forward records (item 3) are worth more than new
families of rules.

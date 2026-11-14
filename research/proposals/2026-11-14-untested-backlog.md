# What has not been tested yet: a backlog of hypotheses (14 Nov 2026)

Written 14 Nov 2026 for the owner. A planning document, not a study: no test was run for it, no candle was read for a
result, no rule, size, stop, config or live system changed, and **nothing here is an edge**. Paper trading and cTrader demo
accounts only. Every figure about a past study is copied from that study's RESULT.md / result.json on its own branch, from
the two standings documents (`research/proposals/2026-11-14-lead-standings.md`, branch `lead-standings`, #965;
`research/proposals/2026-11-14-lead-standings-2.md`, branch `lead-standings-2`) or from the cost floor map
(`research/edge/cost-floor-map`, branch `cost-floor-map`, #948). Nothing is added to `docs/owner-decisions.md`.

**The short answer.** 247 study folders under `research/edge/` exist on `main` or on a remote branch (appendix). Of the
ideas a pre-registration could still test with the data this sandbox can reach, **seven** pass the three filters below
(published prior, reachable data, a cost hurdle the effect could plausibly clear), and only the first three are worth the
next slot. The space reachable with free OANDA mid candles is **close to exhausted**: the families with real published
evidence (calendar, news, momentum, carry, value, reversal, gaps, fixes, sessions, spill-overs, pair spreads, volatility
timing) have each been tested at least once, often three or four times, and what was real before costs died on the CFD
spread and financing (#948, #965). The leads that stand (gotobi, the Sunday-gap fade, the day after US holidays) are waiting
on a **measured spread**, not on more rules. Spending a slot on cost measurement (section 4) is worth more than any item
below.

## 1. How this list was built

- **Tested** = every folder `research/edge/<topic>/` on `origin/main` (83) plus every topic a remote branch adds over
  `origin/main` (`git for-each-ref refs/remotes/origin`, `git diff --name-only origin/main...origin/<branch>`): 247
  distinct topics, 242 with a RESULT.md "Verdict" line (5 older ones on `main` keep their verdict in result.json only). Pull
  request numbers come from the GitHub list of pull requests by head branch. By the verdict line: 197 FAIL / do not
  replicate, 14 pass or partly, 7 inconclusive, 6 not measurable (data refused), 9 accounting, 9 tools or audits, 5 in
  result.json. No branch holds a pre-registration without a result today, so no study is in flight.
- **Duplicate check.** For each candidate the nearest tested topic is named with the difference. A new market for a rule
  already tested, a new parameter of a rule already tested, or a rule chosen after reading a failed study's tables is a
  replication or a re-fit, not a new hypothesis, and is left out (section 3 lists the ones considered).
- **Prior evidence.** The papers are cited from memory: **none could be opened from this sandbox** (no journal or preprint
  host was tried; FRED, Cboe, CFTC, ECB, Dukascopy and Binance futures were tried on 14 Nov and every request was refused by
  the proxy). The papers' figures are therefore not quoted; a pre-registration must not rely on them either.
- **Data reachable (checked 14 Nov):** the OANDA candle proxy (`/md/bars`, mid prices with OANDA's quote-count volume; one
  request `sym=eurusd&tf=1h&n=3` answered 200); council-data `research/daily/_index.json` (76 markets of daily mid candles:
  17 index CFDs from 2003 (CN50 / IN50 2011, ES35 2016), 37 forex pairs from 2002-2004 (USD/CNH 2011, USD/TRY 2007), 3
  energies, 4 agriculturals and 6 bond CFDs from 2003, 8 metals from 2003-2006; column `v` = quote count); council-data
  `research/candles/` (HistData M1 for six majors, XAU, XAG, SPX, NSX, the dollar index; crypto 1d / 5m; NQ, index M5);
  council-data `macro/cache.json` (FRED DGS2, DGS10, DFII10 weekly since January 2006, 1,089 rows: the only rates on
  file); `council/event-base.json` (CPI from 2018, NFP and FOMC from 2022) and `research/edge/pre-fomc-drift/events.mjs`
  (FOMC 2008-2021, on branch `pre-fomc-drift`). **Refused:** `fred.stlouisfed.org`, `cdn.cboe.com`, `cftc.gov`,
  `data-api.ecb.europa.eu`, `datafeed.dukascopy.com`, `fapi.binance.com`. No bid / ask history, no futures curve, no
  options data.
- **Cost hurdle** = the cost a trade the study's own route would charge, from measured or charged figures of the studies:
  demo round trip US500 0.004 %, NAS100 0.0029 %, US30 0.0031 %, US2000 0.0108 %, forex majors 0.0045 %, XAU 0.0042 % of
  price (#948, one day of quotes, no slippage: a floor); a one-night index hold with a 1 x ATR stop about 0.036R (spread
  0.022R + financing 0.014R, #964); a one-month index leg with a 2 x ATR(20) stop about 0.068R (spread 0.011R + financing
  0.057R, #974); a one-month forex leg with a 3 x ATR(20) stop about 0.053R (trading 0.008R + financing 0.045R, #968). A
  five-day index hold is put at about 0.025R (the #974 month scaled to five trading days plus one spread): an estimate, said
  as one.
- **The bar every candidate takes**, as the 13-14 Nov studies did: pre-registration pushed alone first; decisive window
  2016 to now net of costs with month-sum t >= 2; the earlier window (2005 or 2008 to 2015) net > 0; net > 0 at twice the
  cost; above at least 38 of 40 seeded placebos; Holm over the study's own tests. Because 333 decisive tests have been run
  and none survives a family correction (#946), **a pass would still only be a lead**, to be replicated on markets or years
  it did not use before anyone calls it more.

## 2. The candidates, ranked

Ranked by (a) the strength of the published prior, (b) how much of the needed data is reachable, (c) whether the effect
could clear the cost hurdle on the CFD route. Each line of "Why not a duplicate" names the nearest tested topic.

### 1. The FOMC cycle: US equity returns in the even weeks between meetings

- **Hypothesis.** US index CFDs earn more in weeks 2, 4 and 6 after an FOMC meeting (day 0 = the statement day; week k =
  trading days 5k-1 to 5k+3) than in the odd weeks; long in the even weeks only.
- **Prior.** Cieslak, Morse and Vissing-Jorgensen, "Stock returns over the FOMC cycle", Journal of Finance 2019 (not
  opened): the equity premium since 1994 was earned mostly in the even weeks, linked to Fed communication.
- **Market(s), data.** US500, NAS100, US30 pooled (decisive); the other 14 index CFDs as a later replication.
  `research/daily/*.json` from 2003 and `/md/bars`; FOMC dates 2008-2021 from `pre-fomc-drift/events.mjs`, 2022 on from
  `council/event-base.json` / `council/events.mjs`. First usable date: January 2008.
- **Expected n.** About 24 even-week holds a year per index (three a cycle, eight cycles); 72 a year pooled, about 24
  independent weeks.
- **Cost hurdle.** About 0.025R a five-day hold with a 2 x ATR(20) stop (estimate above).
- **Why not a duplicate.** Nearest: `pre-fomc-drift` (#831, the 24 hours before the statement, SPX500 +0.044R net, t
  1.35), `seasonality` H2 (main, the same window), `fomc-follow` (#861) and `bond-fomc-drift` (#906, minutes to days after).
  The primary test leaves week 0 out on purpose, so not one day of it overlaps a tested window; weeks 2, 4, 6 have never
  been read.
- **Pass bar.** The common bar (section 1), plus: even weeks minus odd weeks > 0 (Welch t reported), and the placebo shifts
  the FOMC calendar by a random 1-4 weeks.

### 2. Equities and Treasuries on scheduled announcement days

- **Hypothesis.** Long US index CFDs and the US 10-year / 30-year CFDs from the close before a CPI or payrolls release to
  the close of the release day earns more than the same hold on ordinary days.
- **Prior.** Savor and Wilson, "How much do investors care about macroeconomic risk? Evidence from scheduled economic
  announcements", Journal of Financial and Quantitative Analysis 2013; Jones, Lamont and Lumsdaine, "Macroeconomic news and
  bond market volatility", Journal of Financial Economics 1998 (neither opened): a premium on announcement days in stocks and
  in Treasuries.
- **Market(s), data.** US500, NAS100 (T1); USB10Y, USB30Y (T2). Daily candles from 2003. Release dates: CPI from 2018 in
  `council/event-base.json`; payrolls 2008-2021 computed by the first-Friday rule and checked on the OANDA M5 release-minute
  spike (as #963 checked its dates), 2022 on from event-base. **FOMC days excluded** (tested in #831). CPI before 2018 is
  not reachable (BLS / FRED refused), so 2008-17 is payrolls only: said in the pre-registration, not repaired by hand.
- **Expected n.** About 12 a year 2008-17, about 24 from 2018, per instrument.
- **Cost hurdle.** About 0.036R a trade (one night and a day, #964).
- **Why not a duplicate.** Nearest: `nfp-follow` (#863) and `cpi-follow` (#871) trade the first minutes' direction intraday
  on gold and NAS100; `pre-release-drift` (#963) the 24 hours before CPI / payrolls on gold and the dollar. None holds an
  unconditional long through the release day, and none reads bonds on these days.
- **Pass bar.** The common bar; plus release days minus ordinary days > 0 with Welch t >= 2 in 2016-now; placebo = random
  ordinary days of the same weekday.

### 3. Cross-sectional return seasonality: the same calendar month in past years

- **Hypothesis.** Among OANDA instruments of one asset class, those whose average return in the coming calendar month over
  the past 5-10 years was highest beat those where it was lowest; long top third, short bottom third, monthly.
- **Prior.** Keloharju, Linnainmaa and Nyberg, "Return seasonalities", Journal of Finance 2016 (not opened): the pattern
  shows across commodities, country indices and currencies, not only stocks; for stocks Heston and Sadka, Journal of
  Financial Economics 2008.
- **Market(s), data.** Three books, one test each: 17 index CFDs; 37 forex pairs against USD where a pair is a USD cross;
  15 commodities (energies, agriculturals, metals). `research/daily/*.json` from 2002-2006; with a 5-year minimum history the
  first signal month is about 2008 (2011 for the late markets).
- **Expected n.** 12 rebalances a year; 10-12 legs a month a book; 130 decisive months.
- **Cost hurdle.** About 0.068R a leg-month on indices (#974), 0.053R on forex (#968); commodities about the same as
  indices plus wider spreads on agriculturals. **This is the weak point**: the three monthly cross-sectional books already
  tested lost on financing alone (#968 value, #969 MAX, #974 index momentum: financing 0.045-0.057R a leg-month exceeded the
  gross effect). The long-short structure only offsets part of it on CFDs.
- **Why not a duplicate.** Nearest: `gold-month-of-year` (#907), `energy-seasonal` (#879), `grain-seasonality` (#934),
  `sell-in-may` (#851): fixed windows on single markets chosen from folklore. The cross-sectional books (#869, #935, #974,
  #968, #969, #971, #945, #941) rank on past 1-60 month returns, volatility or skewness, never on the same month of past
  years.
- **Pass bar.** The common bar per book, Holm over three books; placebo = rankings on a randomly chosen OTHER calendar month.

### 4. Own-market holidays outside the US: the day before a local holiday

- **Hypothesis.** A national index CFD rises on the last trading day before its own exchange's holiday more than on
  ordinary days.
- **Prior.** Ariel, Journal of Finance 1990 (US); Kim and Park, Journal of Financial and Quantitative Analysis 1994 (UK and
  Japan, each on its own holidays) (not opened).
- **Market(s), data.** UK100, DE40, JP225, AU200, HK33 (and EU50 / FR40 on Euronext closures). Daily candles from 2003.
  Holiday calendars computed from each exchange's published rules (UK bank holidays, Xetra / Euronext closures, the
  Japanese holiday law, ASX, HKEX including lunar dates) and checked against the OANDA candles (a full closure shows as a
  missing or flat cash session); the code has no network to a holiday list, so the rules are written into the study and
  tested date by date, as `ict/calendar.mjs` was.
- **Expected n.** About 50 holidays a year pooled (UK 8, Germany 9, Japan 16, Australia 8, Hong Kong 12).
- **Cost hurdle.** About 0.036R a trade (#964).
- **Why not a duplicate.** Nearest: `pre-holiday` (#845, US indices and US holidays: FAIL), `fx-us-holiday` / `fx-post-holiday-replicate`
  / `post-holiday-metals` (#975, #980, #984: the dollar and metals around US holidays). No study has read a market on its
  own non-US holidays. Honest note: the US version failed out of sample, which lowers the prior.
- **Pass bar.** The common bar, pooled; placebo = random ordinary days of the same weekday per market.

### 5. The high-volume return premium across index CFDs

- **Hypothesis.** An index CFD whose activity last week was unusually high (quote count over its own 50-day mean, top of the
  cross-section) outperforms over the next one to four weeks; long the top third, short the bottom third, weekly.
- **Prior.** Gervais, Kaniel and Mingelgrin, "The high-volume return premium", Journal of Finance 2001 (stocks); Kaniel,
  Ozoguz and Starks, Journal of Financial Economics 2012 (across countries, still within each country's stocks) (not opened).
- **Market(s), data.** 17 index CFDs, `research/daily/*.json` column `v` from 2003. **Data caveat:** OANDA's volume is a
  count of price updates, not traded volume, and it grows sixteen-fold on DE40 from 2003 to 2026; only a detrended
  measure (own 50-day mean) is usable, and the pre-registration must say the proxy may not carry the papers' effect.
- **Expected n.** 52 rebalances a year, 10-12 legs a week; about 560 decisive weeks.
- **Cost hurdle.** About 0.025R a leg-week (the five-day figure); financing on the long legs is the larger part.
- **Why not a duplicate.** Nearest: `vol-spike-rebound` (#860, realised volatility, not activity), `index-xs-momentum`
  (#974), `index-low-vol` (#945). No study has used the volume column at all.
- **Pass bar.** The common bar; placebo = random rankings with the same thirds.

### 6. Volume and the next day: high-activity days reverse, quiet days continue

- **Hypothesis.** On index CFDs a large daily move on high activity (quote count over its own 50-day mean) partly reverses
  the next day, while the same move on low activity continues; trade the next day in the predicted direction.
- **Prior.** Campbell, Grossman and Wang, Quarterly Journal of Economics 1993; Llorente, Michaely, Saar and Wang, Review of
  Financial Studies 2002 (not opened).
- **Market(s), data.** 17 index CFDs, daily candles with `v` from 2003 (same caveat as 5).
- **Expected n.** About 25 signals a year per index on a top-decile move filter, about 400 pooled (correlated across
  markets).
- **Cost hurdle.** About 0.036R a trade (#964).
- **Why not a duplicate.** Nearest: `index-ibs` / `ibs-replicate` (#895, #924), `rsi2-*` (#838, #844, #873, #955),
  `turnaround-*` (#857, #862, #958), `vol-spike-*`: every daily reversal on indices, none conditioned on activity. Honest
  note: that family failed every replication, so the prior that a volume split rescues it is weak; ranked low for that.
- **Pass bar.** The common bar for the high-volume reversal and the low-volume continuation as two tests, Holm over two.

### 7. Overnight against intraday across national indices ("tug of war")

- **Hypothesis.** Across national index CFDs, last month's overnight (close-to-open) return predicts next month's overnight
  return positively and the intraday return negatively; long the top third overnight only, short the bottom third.
- **Prior.** Lou, Polk and Skouras, "A tug of war: overnight versus intraday expected returns", Journal of Financial
  Economics 2019 (stocks; not opened). Whether it holds for whole national indices is not known to the author of this list.
- **Market(s), data.** The 14-17 index CFDs with cash sessions, H1 from `/md/bars` (each market's own cash open and close,
  as `overnight-unused-markets` defined them), 2005 on.
- **Expected n.** About 250 days a year, 10 legs a day; 130 decisive months.
- **Cost hurdle.** About 0.036R a leg-night plus a second spread for the day leg. **Probably fatal:** the plain overnight
  long was real before costs (+0.011R, t 2.10) and lost 0.036R a trade to spread and financing (#964); a cross-sectional
  split of the same move has to beat that by three times.
- **Why not a duplicate.** Nearest: `overnight-drift` (#836), `index-overnight` (#891), `overnight-unused-markets` (#964):
  time-series longs of every market; no study ranked markets on their overnight component.
- **Pass bar.** The common bar; listed so it is not proposed again as new, and so its cost is known before anyone builds it.

Not a candidate, said plainly: none of the seven has a futures-like cost route that changes the picture (#972), and none
should go into a forward paper stream on a pass alone.

## 3. Considered and left out

| Idea | Why it is left out |
|---|---|
| Lunar cycle in index returns (Yuan, Zheng and Zhu, Journal of Empirical Finance 2006) | Prior widely read as a data-mined curiosity; the effect reported is about the size of 15 days of CFD financing |
| Intraday periodicity, the same half hour on past days (Heston, Korajczyk and Sadka, Journal of Finance 2010) | Effect of a few basis points a half hour against an intraday round trip of 0.1R or more (#868, #910, #948): cannot clear the cost |
| Dollar carry and EM carry with a crash filter (Lustig, Roussanov and Verdelhan 2014; Menkhoff et al. 2012) | Needs foreign short rates by month: FRED and ECB refused; only US rates are on file. Nearest tested `fx-carry` (#830) |
| Crypto perpetual funding as a crowding signal | Binance futures API refused; no history on file |
| VIX term structure timing | Already pre-registered (#827), not run: Cboe refused |
| COT positioning | Tested (`cot-positioning`, main, FAIL); CFTC refused for a longer history |
| The day after UK or Japanese holidays for GBP / JPY | Same family as #975 / #980 / #984 (chosen after reading #975's reported-only line): a replication, not new |
| Sunday-gap fade on oil or natural gas | Rule G on another market, no published prior; gold (#864) and indices (#898) already failed it |
| Commodity-currency spread fade (CAD against oil, AUD against metals) | Ferraro, Rogoff and Rossi (2015) find the link contemporaneous, not predictive; every pair-spread fade failed (#840, #829, #881, #933) |
| Treasury auctions on 2y / 5y / 7y | Same idea as `treasury-auction-cycle` (#978) on other tenors; auction dates not reachable (TreasuryDirect refused) |
| Daylight-saving weekends, Chinese New Year gold, election cycle | One or two events a year: under the n any bar here needs |
| Commodity basis / term-structure carry, options-implied signals | No futures curves, no options data reachable |
| Crypto "CME gap" fills | No published evidence; folklore |

## 4. What would change the picture

The binding constraint is not ideas, it is **what a trade really costs and which prices can be read**. In order of what
each would unblock (decision numbers are those of #965 section 4 and its update):

1. **A measured spread at the minutes that decide the standing leads** (#965 item 2; routes in #966): the demo broker's
   ticks at the Tokyo fix and the Sunday reopen (route A), a GitHub Actions run of the two committed Dukascopy
   pre-registrations #949 / #950 (route B), or OANDA bid / ask through the candle proxy (route C, held because it changes a
   served file). Only routes B or C reach the six currencies of the post-holiday lead (#980). This decides gotobi (t 2 up
   to 1.95 pips), rule G (t 2 up to 1.4 pips) and the post-holiday lead, more than any candidate above can.
2. **Bid / ask history in general** (Dukascopy via Actions, or route C) would also turn every "assumed spread" in the
   ranked cost table (#948) into a measured one, and would let candidates 2, 4 and 6 be costed at the close they trade.
3. **Rates and macro series** (`fred.stlouisfed.org`, and an ECB / BIS source for foreign rates; #965 item 5 asks for FRED
   and Cboe): would unblock dollar carry, the real policy-rate table #830 could not read, CPI dates before 2018 for
   candidate 2, and the VIX term-structure study #827.
4. **Futures prices as a cost model** (#965 item 4): #972 showed it rescues nothing that held up out of sample and has no
   route for the forex crosses; it would matter for candidates 1, 2 and 5 only if they pass on CFD costs first.
5. **Options data** (Cboe, Deribit): none reachable; it would open the variance-premium and skew families, untouched here.
6. **The owner's own logged trades** (item 27): every mechanical version of the course methods failed; the selection that
   remains is only measurable from logged trades.

Suggestion, not a decision: run candidates 1 and 2 (cheap, one study each, data in hand), hold 3 until a cost route for
monthly long-short books exists, and treat 4-7 as low priority. If 1 and 2 also fail, the honest reading is that the free
mid-price data has been searched through, and further slots go to cost measurement and forward records.

## Appendix: every topic tested (247)

One row per folder `research/edge/<topic>/`. "Where" = `main`, or the first remote branch that adds it. "PR" = the pull
request(s) of the branches that touch the folder (older topics on `main` may list the pull request that added or re-ran
them). "Class" is read from the verdict line and is a sorting aid, not a re-judgement; the verdict text is shortened from the
study's own RESULT.md. Built from `git ls-tree` / `git diff --name-only` on 14 Nov 2026.

| # | Topic | Where | PR | Class | Verdict line (shortened) |
|---|---|---|---|---|---|
| 1 | `academy-ml-review` | main | — | fail | No scorer passes: all 20 (the reference and the four pre-registered challenger configurations) are rejected challengers; none is promoted. The best … |
| 2 | `academy-policy` | main | — | fail | no candidate passes. The shipped policy stays and the exam pool was not read. |
| 3 | `audnzd-revert` | branch `audnzd-revert` | #840 | fail | FAIL, 0 of 3 variants: the AUD/NZD z-score fade is not an edge after costs. Pre-registered in PREREGISTRATION.md (committed alone first). The best … |
| 4 | `bond-fomc-drift` | branch `bond-fomc-drift` | #906 | fail | FAIL. Neither test passes the pre-registered bar. 2016 → now, net of costs: USB10Y −0.167R a trade (n 79, month t −2.09), USB30Y −0.117R (n 79, month … |
| 5 | `bond-intraday-momentum` | branch `bond-intraday-momentum` | #970 | fail | FAIL (the pooled 10-year + 30-year primary meets 1 of the 4 pre-registered lines). Primary, usb10y + usb30y pooled, 2016 → now: n 4983, −0.547R a … |
| 6 | `bond-lead-intraday` | branch `bond-lead-intraday` | #926 | fail | FAIL. 0 of 3 tests pass. Every test loses after costs in both windows (decisive Holm p 1.00 for all three). |
| 7 | `bond-month-end` | branch `bond-month-end` | #939 | fail | FAIL, 0 of 2 tests. Long the 10-year note CFD from the close of the month's fourth-to-last US trading day to the |
| 8 | `bond-month-end-futures` | branch `bond-month-end-futures` | #943 | fail | FAILS AT FUTURES COST, 0 of 2 tests. The same frozen trades of bond-month-end (#939), re-costed as CBOT |
| 9 | `bond-month-end-replicate` | branch `bond-month-end-replicate` | #961 | fail | DOES NOT REPLICATE. #939's frozen rule (long at the close of the month's fourth-to-last trading day, out at the |
| 10 | `book-sizing` | main | #766 | fail | FAIL: within noise (no proposal, the live rule stays). On untouched 2006-17, after costs and financing, the two-system book with the Gold trend add … |
| 11 | `brent-wti-spread` | branch `brent-wti-spread` | #933 | fail | FAIL: fading a 2-sd stretch of the Brent - WTI spread is not an edge after costs. Pre-registered in PREREGISTRATION.md (committed alone and pushed … |
| 12 | `cb-days-other` | branch `cb-days-other` | #901 | fail | FAIL. Pooled over the five banks, 2018 → now: n 320, +0.208R a trade net, month t +1.77; 2010-17 −0.030R (n 273); placebo p95 +0.068R; at 2x cost … |
| 13 | `chf-haven` | branch `chf-haven` | #930 | fail | FAIL, 0 of 3 tests. short USD/CHF −0.046R a trade net on 2016-26 (n 74, t −0.48, month t −0.52, fails: net R not above 0, negative before 2016, t … |
| 14 | `cnh-fix` | branch `cnh-fix` | #927 | fail | FAIL. No test is positive after costs in either window. In 2018-26 following USD/CNH's 01:15-01:30 UTC move loses |
| 15 | `coach-learning` | main | #438 | fail | FAIL. No variant passes, so there is no proposal.md. No variant has positive OOS expectancy, and only the Coach-with-pauses variant beats the coded … |
| 16 | `commodity-cycle` | branch `commodity-cycle` | #956 | fail | FAIL. Neither exit passed every pre-registered line. Exit A (target the H4 move's extreme): −0.317R a trade net on 2016-2026 (n 2425, monthly t … |
| 17 | `commodity-fx-lead` | branch `commodity-fx-lead` | #899 | fail | FAIL: 0 of 2. A big WTI day did not lead USD/CAD the next day (2016 to 13 Nov 2026: 366 trades, −0.009R a trade after costs, month-sum t −0.29; … |
| 18 | `commodity-skewness` | branch `commodity-skewness` | #971 | fail | FAIL. Out of sample 2016-06 to 2026-10: −0.060R a month net (125 months, Newey-West t −1.38). Out of sample 1000 legs at −0.060R net a leg; in sample … |
| 19 | `commodity-xs-momentum` | branch `commodity-xs-momentum` | #935 | fail | FAIL. 2016-01 to 2026-10: −0.071R a month net (130 months, Newey-West t −1.30, worst drawdown −13.33R); 2006-02 to 2015-12: +0.029R a month (119 … |
| 20 | `confluence` | main | #452 | fail | FAIL (no robust edge from confluence). We wrote no proposal. Separately, the owner's ICT skill §11 says council rules must not filter ICT, so even a … |
| 21 | `copper-gold` | branch `copper-gold` | #854 | fail | FAIL: in the decisive window (2016 to 23 Oct 2026, 565 weeks) the equal-weight SPX500 / NAS100 index rose LESS in the weeks after a rising 13-week … |
| 22 | `cost-floor-map` | branch `cost-floor-map` | #948 | accounting | ACCOUNTING (no rule tested). This is accounting of committed results, not a test of any market: no data was fetched, no rule was run, no study's … |
| 23 | `costs` | main | #443 | fail | FAIL. No rule passes as a candidate, but the answer to the question is clear. |
| 24 | `cot-positioning` | main | #697 | fail | FAIL. No pooled positioning signal (1-year or 3-year crowding, weekly flow, or 90/10 extremes) passed in and out of sample at 1 or 4 weeks. Two … |
| 25 | `council-edge` | main | — | fail | FAIL. None of the three pre-registered changes passes; keep the live rules. The time exit at the deadline |
| 26 | `cpi-follow` | branch `cpi-follow` | #871 | fail | FAIL. 0 of 4 tests pass. Best on 2020-now: fade-11:00, +0.001R an event net (n 81, t 0.02); 2012-19 -0.098R (n 78). |
| 27 | `crypto-cycle` | branch `crypto-cycle` | #888 | fail | FAIL. Neither exit passed every pre-registered line. Exit A (target the H4 move's extreme): −0.079R a trade net on 2022-2026 (n 830, monthly t … |
| 28 | `crypto-expiry` | branch `crypto-expiry` | #977 | fail | FAIL. After the monthly crypto expiry, BTC and ETH with the 7-day trend made +0.052R a trade net out of sample (n 56, month t 0.6), +0.086R in sample. |
| 29 | `crypto-hour` | branch `crypto-hour` | #842 | fail | FAIL, 0 of 4 tests. The hours picked on 2022-23 (long 20:00 UTC, short 01:00 UTC) lost money after costs on |
| 30 | `crypto-reversal` | branch `crypto-reversal` | #866 | fail | FAIL, 0 of 4 tests pass. Buying BTC, ETH, SOL or XRP at the next open after a three-day return below −2 x its |
| 31 | `crypto-sma200` | branch `crypto-sma200` | #856 | fail | FAIL, 0 of 4 tests pass. Long BTC or ETH only while the daily close is above its 200-day (or 100-day) average, |
| 32 | `crypto-trend-decay` | main | #508 | fail | decayed. The rule earned well from 2017 to May 2025 (+3.7R a position before 2024, +2.2R from Jan 2024 to May 2025). |
| 33 | `crypto-weekend` | branch `crypto-weekend` | #852 | fail | FAIL, 0 of 4 tests pass. Long the weekend (Friday 21:00 to Sunday 23:00 UTC) and short Monday (Monday 00:00 to |
| 34 | `crypto-weekend-reversal` | branch `crypto-weekend-reversal` | #890 | fail | FAIL. 0 of 5 tests pass; T1-BTC -0.016R a trade (n 19, month t -0.08); T1-ETH -0.044R a trade (n 27, month t -0.24); T2-BTC -0.141R a trade (n 19, … |
| 35 | `crypto-weekly-mom` | branch `crypto-weekly-mom` | #833 | fail | FAIL, 0 of 2. On 2022-26 (the decisive window, fully after the paper's sample) the one-week momentum book did |
| 36 | `crypto-xs-momentum` | branch `crypto-xs-momentum` | #986 | fail | FAIL, 1 of 4 conditions met: out of sample +0.0113R a week net (217 weeks, month-sum t +0.55), −0.0201R at 2x cost, above only 28 of 40 random … |
| 37 | `cycle-gate` | branch `cycle-gate-study` | #815, #819 | fail | FAIL, 0 of 11 systems. The primary gate G2 (trade only on the side of the last H4 break, and not while H1 is |
| 38 | `decay-monitor` | main | #531, #767 | tool / audit | monitor, not a test: a record under 10 trades gets no verdict, then judged against its baseline |
| 39 | `drd-metals-book` | branch `drd-metals-book` | #816 | fail | FAIL, 0 of 3. Held one position at a time across gold and silver and counted on calendar-month sums, no stream |
| 40 | `dual-momentum` | branch `dual-momentum` | #855 | fail | FAIL. Neither lookback passes the pre-registered bar. On the decisive window (2016 to 6 Nov 2026, 131 months) |
| 41 | `ecb-boj-days` | branch `ecb-boj-days` | #896 | fail | FAIL, 0 of 2 tests. 2018 → now: T1 ECB, EUR/USD: n 71, +0.631R a trade net, month t +1.51, Holm p 0.1315, 2010-17 +0.471R; T2 BoJ, USD/JPY: n 67, … |
| 42 | `ecb-ref-fix` | branch `ecb-ref-fix` | #921 | fail | FAIL. No test is positive after costs in either window. EUR/USD loses −0.136R a trade (exit 15:00 CET) and |
| 43 | `energy-seasonal` | branch `energy-seasonal` | #879 | fail | FAIL, 0 of 4 tests pass. No calendar window here is an edge. The crude "driving season" (WTI, Brent) and |
| 44 | `engulf-ladder` | branch `engulf-ladder` | #822 | fail | FAIL. T1, the ladder (limit at the 50 % of the H1 engulf, stop $0.30 past the H4 zone, 2R, 5 days), made |
| 45 | `eth-btc-ratio` | branch `eth-btc-ratio` | #887 | fail | FAIL, 0 of 2 tests pass. Trading the 4-week trend of the ETH/BTC ratio for one more week as an equal-notional |
| 46 | `eu-gap-fade` | branch `eu-gap-fade` | #916 | fail | FAIL: fading the European index overnight gap from the 08:00 London open to the 16:30 close, stop 1 x ATR20, after a 0.04 % round trip, 2016 → now: … |
| 47 | `event-reaction` | main | #701 | fail | FAIL: on CPI days gold's T+5 to T+60 move followed the dollar's first read in 34 of 73 (47%, p 0.7586; 2018-21 31%, 2022-26 55%). The playbook labels … |
| 48 | `event-risk` | main | #528 | fail | FAIL on all five pre-registered tests. Null result. No shadow variant is added and no rule changes. |
| 49 | `expectations` | main | #762, #566, #767, #785 | tool / audit | expectation bands per live system on untouched data, not a test |
| 50 | `fomc-follow` | branch `fomc-follow` | #861 | fail | FAIL, 0 of 6 tests. Best in 2020 → now: R (fade) on NAS100, n 54, +0.095R a trade net of costs, t +0.56, Holm p 1; 2010-19 −0.313R; placebo 95th … |
| 51 | `futures-roll` | main | #578 | tool / audit | real, but not where #505 suspected it. The H1 / 5m candles the desk uses never jump at a roll, so no roll step |
| 52 | `futures-route-map` | branch `futures-route-map` | #972 | accounting | ROUTE-SENSITIVE: 10 tests would pass at futures cost (Holm 0) (accounting, no rule tested: inconclusive as evidence for any rule). 4 of the 10 … |
| 53 | `fx-asia-london-reversal` | branch `fx-asia-london-reversal` | #973 | fail | FAIL. The pool made -0.048R a trade net out of sample (n 2250, month-sum t -3.24; gross -0.011R, at 2x costs -0.085R), in sample -0.031R (n 2183, t … |
| 54 | `fx-carry` | branch `fx-carry` | #830 | fail | FAIL (neither test makes money with month-sum t ≥ 2 in 2016-26 AND makes money in 2006-15). T1 (carry, every month): +0.066R a month net in 2016-26 … |
| 55 | `fx-cycle` | branch `fx-cycle` | #877 | fail | FAIL. Neither exit passed every pre-registered line. Exit A (target the H4 move's extreme): −0.135R a trade net on 2016-2026 (n 1892, monthly t … |
| 56 | `fx-december-usd` | branch `fx-december-usd` | #918 | fail | FAIL, 0 of 3 tests pass: neither a weaker dollar in the second half of December nor a stronger dollar in the first |
| 57 | `fx-home-hours` | branch `fx-home-hours` | #902 | fail | FAIL. No pair is positive after costs with a month-sum t of 2 in 2016-26 and positive in 2010-15. Before costs |
| 58 | `fx-london-orb` | branch `fx-london-orb` | #868 | fail | FAIL: 0 of 3 variants pass. F1 FAIL (2020 on -0.05R a trade net, n 9875, t -2.28; 2016-19 -0.103R, n 5847); F2 FAIL (2020 on -0.075R a trade net, n … |
| 59 | `fx-max-effect` | branch `fx-max-effect` | #969 | fail | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). Selling the two of the |
| 60 | `fx-month-end` | branch `fx-month-end` | #846 | fail | FAIL. Neither pre-registered rule passes. Base rule, decisive window 2016-01 to 2026-10: -0.0903R a |
| 61 | `fx-month-start` | branch `fx-month-start` | #982 | fail | FAIL: the dollar basket over the first two days of a month, short USD (learned 2005-14): out of sample −0.030R a month (n 143, t −0.74), placebo 16 … |
| 62 | `fx-ny-cut` | branch `fx-ny-cut` | #979 | fail | FAIL. Trading toward a round level from 09:00 to the 10:00 New York cut made -0.054R a trade net out of sample (n 3575, t -7.86). In sample -0.057R … |
| 63 | `fx-post-holiday-replicate` | branch `fx-post-holiday-replicate` | #980 | fail | FAIL: long USD on the day after a US holiday against six other currencies makes +0.026R a holiday net 2005-26 (n 198, t +1.00). |
| 64 | `fx-reversal` | branch `fx-reversal` | #834 | fail | FAIL, 0 of 4 checks. On 2016 to 6 Nov 2026 (decisive) the reversal book lost 19.08 % net (566 weeks, annualised |
| 65 | `fx-round-numbers` | branch `fx-round-numbers` | #931 | fail | FAIL: 0 of 2 rules pass. T1 FAIL (2016 on -0.12R a trade net, n 5966, t -8.4; 2006-15 -0.151R, n 7383); T2 FAIL (2016 on -0.112R a trade net, n 9341, … |
| 66 | `fx-tokyo-orb` | branch `fx-tokyo-orb` | #929 | fail | FAIL: 0 of 3 tests pass. T1 usdjpy FAIL (2016 on -0.08R a trade net, n 862, t -3.9; to 2015 -0.088R, n 456); T2 audusd FAIL (2016 on -0.08R a trade … |
| 67 | `fx-us-holiday` | branch `fx-us-holiday` | #975 | fail | FAIL: the long USD dollar basket on the day before a US holiday (side learned 2005-14) makes +0.015R a holiday out of sample (n 109, t +0.53). |
| 68 | `fx-value` | branch `fx-value` | #968 | fail | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed alone before any number was computed). Buying the two |
| 69 | `fx-weekday` | branch `fx-weekday` | #919 | fail | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed before any candle was read). No weekday of the long-USD basket (EUR, GBP, AUD, NZD, JPY, … |
| 70 | `fx-weekend-gap` | branch `fx-weekend-gap` | #880 | fail | FAIL. Rule G (fade the gap at the reopen candle's close) made +0.194R a trade after costs on 2020 to now, |
| 71 | `fx-weekend-gap-replicate` | branch `fx-weekend-gap-replicate` | #928 | pass or partly | PARTLY. Rule G, frozen byte for byte, made +0.238R a trade after costs on six forex crosses over 2020 to now |
| 72 | `fx-weekend-gap-replicate2` | branch `fx-weekend-gap-replicate2` | #938 | pass or partly | PARTLY. Rule G, frozen byte for byte, held on six pairs neither earlier study traded, 2016 to now (S2: n 481, |
| 73 | `fx-weekly-reversal` | branch `fx-weekly-reversal` | #940 | fail | FAIL, 1 of 5 checks (PREREGISTRATION.md, pushed alone before any number was computed). Buying the two currencies |
| 74 | `fx-xs-momentum` | branch `fx-xs-momentum` | #869 | fail | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). Buying the two |
| 75 | `gap-fill` | branch `gap-fill` | #849 | fail | FAIL: 0 of 4 tests pass in 2021 → now; NAS100 fade of every gap −0.059R a trade net (n 852, monthly t −1.84, gross −0.012R), SPX500 fade of every gap … |
| 76 | `geg-variants` | main | #588 | fail | NOT BETTER. None of the ten pre-registered entry variants beats the live Gold daily engulf rule on the untouched 2006–17 window by return/drawdown in … |
| 77 | `gold-asia-break` | branch `gold-asia-break` | #848 | fail | FAIL, neither rule passes the pre-registered bar. Research only: no live rule, size, filter, stop or config changed. |
| 78 | `gold-carry` | main | #787 | accounting | INCONCLUSIVE (cost accounting, no rule tested): holding the book's gold buys costs 5.4 % a year at the demo broker (book +5.16R a year, t 1.86, 330 … |
| 79 | `gold-drd-er` | main | #770 | fail | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). On March 2006 to |
| 80 | `gold-drd-long` | main | #764 | fail | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). Out of the skill's |
| 81 | `gold-drd-silver` | main | #771 | pass or partly | PASS on the pre-registered bar, and not robust. All three tests pass as registered (mean net R > 0, Holm-adjusted |
| 82 | `gold-fidelity` | main | #572 | tool / audit | the forward record of the four gold daily/H4 systems is too thin to diff trade by trade (no live trade yet for Gold trend, Gold trend fast, the H4 … |
| 83 | `gold-haven-shock` | branch `gold-haven-shock` | #905 | fail | FAIL: 0 of 3 tests pass. After an S&P 500 (or Nasdaq 100) shock day, a gold buy at the next UTC open does no better than the same buy on ordinary … |
| 84 | `gold-lbma-fix` | branch `gold-lbma-fix` | #960 | fail | FAIL: T1 FAIL (out of sample −0.020R a trade net, n 1472, month t -2.36; in sample −0.051R, n 1259); T2 FAIL (out of sample −0.163R a trade net, n … |
| 85 | `gold-month-of-year` | branch `gold-month-of-year` | #907 | fail | FAIL, 0 of 3 tests pass: the page's seasonal months are not reliably different from the rest of the year. |
| 86 | `gold-session-drift` | branch `gold-session-drift` | #875 | fail | FAIL, 0 of 3 tests pass. No session of gold's day is a trade after costs on this test: the session short |
| 87 | `gold-shock-revert` | branch `gold-shock-revert` | #850 | fail | FAIL. Neither rule passes: reversal (R) +0.053R a trade net on 2020 → now (n 27, t 0.14), continuation (C) |
| 88 | `gold-silver-divergence` | branch `gold-silver-divergence` | #870 | fail | FAIL, 0 of 2. Neither trading against nor with a gold 24-hour extreme that silver does not confirm makes money |
| 89 | `gold-silver-ratio` | branch `gold-silver-ratio` | #829 | fail | FAIL, on all three pre-registered checks. Trading the gold / silver ratio back to its 250-day mean when it is two |
| 90 | `gold-systems` | main | #424 | fail | FAIL. No setting change is recommended. Every gate variant tested fails the walk-forward rule. This is a robustness audit, so the useful output is … |
| 91 | `gold-systems-oos` | main | #530 | inconclusive | per system, 2006-17 untouched: Gold trend, Gold trend fast and the daily engulf positive after costs but t < 2; the others flat or negative |
| 92 | `gold-tsmom` | branch `gold-tsmom` | #823 | fail | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). On the untouched |
| 93 | `gold-us-asia` | branch `gold-us-asia` | #923 | fail | FAIL: 0 of 3 tests pass. Gold's Asian session (00:00 → 07:00 UTC) neither continues nor reverses the New York cash session's move: before costs every … |
| 94 | `gold-week-raid` | branch `gold-week-raid` | #843 | fail | FAIL, 0 of 3 rules on the pre-registered bar (PREREGISTRATION.md, committed before any candle was read). No rule |
| 95 | `gold-weekend` | main | #536 | tool / audit | rule fidelity: the daily engulf adopts trading days; the trend legs keep raw UTC days |
| 96 | `gold-weekend-gap` | branch `gold-weekend-gap` | #864 | fail | FAIL. Fading gold's Sunday reopen gap back to Friday's close lost money on 2020 to now (Rule G −0.109R a trade after $0.30, n 41, t −0.78; Rule H … |
| 97 | `gotobi` | branch `gotobi` | #878 | pass or partly | PASS (T2). T2 met all five pre-registered conditions. Pre-registered in PREREGISTRATION.md (first commit of the branch), OANDA mid M5, net of the … |
| 98 | `gotobi-cost` | branch `gotobi-cost` | #893 | accounting | inconclusive on cost (cost accounting only, no rule tested). The gotobi T2 fade breaks even at 3.73 pips a round trip (spread + 2 x slippage, … |
| 99 | `gotobi-duka-spread` | branch `gotobi-duka-spread` | #950 | not measurable | NOT MEASURABLE (inconclusive: Dukascopy's datafeed host refused every connection from this build sandbox, 30 of 30 probe files failed; no bid / ask … |
| 100 | `gotobi-early-years` | branch `gotobi-early-years` | #957 | fail | DOES NOT REPLICATE. It fails on pooled month t >= 2 at the base cost, pooled net R a trade > 0 at 2 x cost: the six yen crosses EUR/JPY, GBP/JPY, … |
| 101 | `gotobi-feed` | branch `gotobi-feed` | #894 | pass or partly | FEED-ROBUST. On HistData USD/JPY (bid, M1 aggregated to M5) the frozen T2 makes +0.127R a trade net over 2018-01-01 to 2026-10-29 (n 623, month t … |
| 102 | `gotobi-jp225` | branch `gotobi-jp225` | #959 | fail | FAIL. Decisive window: n 760, −0.045R a trade net (+0.043 gross), month t −1.09; replication n 208, −0.024R; at 2x cost −0.134R; placebo 95th pct … |
| 103 | `gotobi-limit-entry` | branch `gotobi-limit-entry` | #915 | fail | NOT CAPTURABLE. Read on the strict fill rule as pre-registered: E1 k=2 strict keeps 5.4 % of E3's net R per day (+0.0080R against +0.1481R), month t … |
| 104 | `gotobi-minute-histdata` | branch `gotobi-minute-histdata` | #912 | pass or partly | FEED-CONFIRMED: on HistData too the 00:55 entry is the clear maximum (+0.127R a trade, +0.027R above the next row, 00:54) and one minute late keeps … |
| 105 | `gotobi-replicate` | branch `gotobi-replicate` | #889 | pass or partly | REPLICATES. All four R1 conditions hold: pooled GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY 2010-01-01 to 2026-11-11, n 4784, +0.099R a trade net, month t … |
| 106 | `gotobi-timing` | branch `gotobi-timing` | #908 | accounting | sensitivity report, no class (gate held): the result sits on the 00:55 entry minute; one minute late net R a trade is +0.048 against +0.148 at the … |
| 107 | `grain-seasonality` | branch `grain-seasonality` | #934 | pass or partly | PASS on the pre-registered bar, by one test of three, and thin. T2 soybeans (short July to September) passes: |
| 108 | `gtrend-exits` | main | #587 | fail | FAIL / keep the live exit. No exit or re-entry variant beats the live chandelier on the untouched 2006–17 window at x1 and x2 costs and then confirms … |
| 109 | `high52-rotation` | branch `high52-rotation` | #853 | fail | FAIL (pre-registered bar: decisive excess > 0 with Newey-West t >= 2 missed; 2008-15 excess > 0 missed; decisive Sharpe >= benchmark met; above the … |
| 110 | `histdata-clock` | main | — | tool / audit | data audit, no trading rule tested. The HistData files are stamped on rule R4 (hybrid): New York time in 2018, Europe's summer-time dates from 2019. … |
| 111 | `honest-book` | main | #586 | tool / audit | On the untouched 2006-17 window, book C (honest-positive + Gold trend fast N5) is best by return/drawdown (3.9), book B (honest-positive) is a hair … |
| 112 | `ibs-replicate` | branch `ibs-replicate` | #924 | fail | DOES NOT REPLICATE (fails the pre-registered reading). Pooled over seven indices #895 never used, 2016-now: R1 -0.041R a trade net (n 3543, month-sum … |
| 113 | `ict-book-risk` | branch `ict-book-risk` | #824 | fail | FAIL. None of the 4 pre-registered book rules passes; the A-setup book stays sized as it is. No rule beats the |
| 114 | `ict-breadth` | main | #545, #579 | fail | FAIL (pre-registered bar), for the primary set and for the secondary set. The desk's A-setup rule, unchanged, has |
| 115 | `ict-breadth-2` | main | #579 | fail | FAIL (pre-registered bar), for the primary set (all nine new markets pooled) and for both secondary sets (seven |
| 116 | `ict-concepts` | main | #479 | fail | FAIL. No concept becomes a paper candidate. Nothing on the desk changes. The live A-stream, the tracker and the replay are untouched: this study adds … |
| 117 | `ict-dipbuy-oos` | main | #591 | fail | FAIL (pre-registered bar). The 2018-26 dip-buy result does not hold before 2018: on ten years the rule had never seen it made +0.021R a trade after … |
| 118 | `ict-equal-lows` | main | #747, #735 | fail | FAIL. A-setups whose sweep took relative equal lows / highs made +0.092R a trade net out of sample (n 107, t 0.72) against +0.138R for the other … |
| 119 | `ict-exits` | main | #421 | fail | FAIL. The live exit stays. No exit variant beat the current one in-sample by more than noise. The variants that did best out-of-sample (fixed 4R … |
| 120 | `ict-exits-replay` | main | #505 | see result.json | see result.json (no RESULT.md verdict line) |
| 121 | `ict-filters` | main | #423 | pass or partly | PASS, but weak. One simple filter passes every test: don't take A-setups on Fridays (New York day). A second filter also passes: only take A-setups … |
| 122 | `ict-grades` | main | #559 | fail | H1 FAILS, H2 DOES NOT HOLD, H3 HURTS (all pre-registered bars). The B-setups the desk logs but does not trade |
| 123 | `ict-index-longonly` | main | #431 | pass or partly | PASS. The edge is real, but it is a dip-buying edge, not an all-weather long. |
| 124 | `ict-macro` | main | #507 | fail | null result. No regime filter passes. Neither pre-registered hypothesis holds. The A-setups made money in high |
| 125 | `ict-markets` | main | #504 | see result.json | see result.json (no RESULT.md verdict line) |
| 126 | `ict-oos-2008` | main | #526 | fail | FAILS (pre-registered bar). On ten years the rule had never seen, the unchanged live A-setup rule made |
| 127 | `ict-quarters` | branch `ict-quarters` | #817 | fail | FAIL. None of the three pre-registered tests passes. A-setups whose sweep fell in the "manipulation" quarter (Q2) did no better than the rest out of … |
| 128 | `ict-sessions` | main | #547 | fail | nothing passes. All four hypotheses FAIL the pre-registered bar; no shadow variant is added and no code outside this |
| 129 | `ict-smile` | main | #516, #519 | fail | FAIL. Null result. The lead is closed. |
| 130 | `ict-trend-side` | main | #533 | fail | FAILS. The filter came from the 2008-17 observation that the index rule's sells lost in the bull market. On |
| 131 | `ict-universe` | main | #429, #516 | fail | No new market passes. Do not add any FX pair or silver to the ICT desk. Of the eight new markets, none passes the |
| 132 | `ict-variants` | main | #692 | pass or partly | PASS for one of nine on the corrected clock (10 Nov 2026), not strong. V3 htffvg on the index book passes the pre-registered bar (in-sample n 80, … |
| 133 | `index-52w-high` | branch `index-52w-high` | #911 | fail | FAIL, 0 of 3. An index closing at or within 1 % of its prior 252-day closing high did NOT beat its own average over |
| 134 | `index-cycle` | branch `index-cycle` | #874 | fail | FAIL, 0 of 2 exits pass. Trading with the H4 move once the H1 pullback against it is over lost on NAS100, SPX500 |
| 135 | `index-friday-pm` | branch `index-friday-pm` | #985 | fail | FAIL: Friday 14:00-15:55 US500 short: OOS −0.180R a trade net (n 474, month t −4.44); OOS t −4.44 < 2, in sample −0.152R, −0.313R at 2x cost, beats … |
| 136 | `index-futures-cost` | branch `index-futures-cost` | #900 | accounting | INCONCLUSIVE (cost accounting, no rule tested; no study's verdict changes): on CME micro futures the same trades net index-overnight US500 +0.001R / … |
| 137 | `index-ibs` | branch `index-ibs` | #895 | fail | FAIL. Pre-registered in PREREGISTRATION.md (pushed alone first, commit 4274ca30b). Four chances in all: T1-T3 (Holm over three) and the pooled test P. |
| 138 | `index-long-reversal` | branch `index-long-reversal` | #941 | fail | FAIL. Buying the three national indices with the worst 36-month return and shorting the three best is not an edge after costs (decisive 2016-now … |
| 139 | `index-low-vol` | branch `index-low-vol` | #945 | fail | FAIL, 0 of 2 tests pass: holding the three least volatile national indices against the three most volatile is not an edge after costs (T1 equal risk … |
| 140 | `index-midday-turn` | branch `index-midday-turn` | #914 | fail | FAIL. Decisive window 2016 → now: T1 NAS100 fade: n 2308, −0.042R a trade net (month-sum t −7.14), before costs −0.016R; Holm p 1.000. T2 NAS100 … |
| 141 | `index-overnight` | branch `index-overnight` | #891 | fail | FAIL: the overnight long after spread and financing, 2016-26: US500 −0.022R a trade (n 2721, month-sum t −2.86), NAS100 −0.006R (n 2721, t −0.84); … |
| 142 | `index-pair` | branch `index-pair` | #881 | fail | FAIL, 0 of 2 pairs: fading a 2-sd stretch of the US index spreads is not an edge after costs. Pre-registered in PREREGISTRATION.md (committed alone … |
| 143 | `index-quarter-end` | branch `index-quarter-end` | #981 | fail | FAIL: on US500 out of sample (2015-26) the rule lost -0.101R a trade net (n 47, t -0.89), -0.119R at 2x cost, and beat only 24 of 40 random-window … |
| 144 | `index-spread-momentum` | branch `index-spread-momentum` | #884 | fail | FAIL, 0 of 5 pre-registered checks: following a 2-sd stretch of these non-US index spreads is not an edge after costs. Pre-registered in … |
| 145 | `index-weekend-gap` | branch `index-weekend-gap` | #898 | fail | FAIL: pooled −0.126R a trade after costs on 2016-26 (n 102, month-sum t −1.59), −0.067R on 2008-15 (n 42) |
| 146 | `index-xs-momentum` | branch `index-xs-momentum` | #974 | fail | FAIL (pre-registered bar: OOS month-sum t >= 2 missed; IS net > 0 missed; OOS net > 0 at 2x costs missed; beats >= 38 of 40 placebo runs missed). |
| 147 | `intraday-momentum` | branch `intraday-momentum` | #835 | fail | FAIL. SPX500, 2016 → now: n 2672, −0.159R a trade net of costs, t −9.09 (before costs −0.012R, t −0.70); sign hit rate 48.5 % against a placebo 95th … |
| 148 | `jp-fiscal-yearend` | branch `jp-fiscal-yearend` | #936 | fail | FAIL, 0 of 2 tests pass: USD/JPY did not fall in March before the Japanese fiscal year-end, and did not rise in the |
| 149 | `last-hour` | branch `last-hour` | #872 | fail | FAIL: neither fading nor following a big day into the cash close pays after costs (2016 → now, pooled: fade −0.077R, follow −0.065R a trade). Fade, … |
| 150 | `lead-forward-plan` | branch `lead-forward-plan` | #967 | accounting | PLAN COMPUTED (no rule tested). This is accounting, not a test: no rule is tested, no rule is proposed, and nothing live changed. No lead is an edge. … |
| 151 | `lit` | main | #597, #599 | inconclusive | INCONCLUSIVE, not an edge at the skill defaults (#597); kept as a paper shadow by the owner |
| 152 | `london-fix` | branch `london-fix` | #883 | fail | FAIL. Neither test met the pre-registered bar (T1 −0.152R a trade net, n 3510, month t −7.44; T2 −0.164R a trade net, n 3510, month t −10.32, … |
| 153 | `macro-gold` | main | #539 | fail | no. Both pre-registered rules FAIL on untouched 2006–2017 gold. There is no candidate and no shadow stream. |
| 154 | `macro-vol` | main | #515 | see result.json | see result.json (no RESULT.md verdict line) |
| 155 | `macroscore-overlay` | main | #595 | fail | FAIL on the pre-registered rule. The calibration (H0) passes and replicates the skill almost exactly (weekly IC +0.149, Newey–West t 3.24; score > … |
| 156 | `mcycle-base` | branch `mcycle-base-study` | #818 | fail | FAIL: the live Mosha cycle rule, run as the Trader runs it, made −0.574R a trade after costs over 115 trades on spot gold from 2020 (t −3.99 on 82 … |
| 157 | `meridian-exits` | main | #502 | see result.json | see result.json (no RESULT.md verdict line) |
| 158 | `meridian-swing` | main | #481 | fail | - FAIL. Nothing is added as a shadow stream, and no live rule changes. |
| 159 | `metals-intraday-momentum` | branch `metals-intraday-momentum` | #932 | fail | FAIL (0 of 3 tests pass). T1 Gold, 2016 → now: n 2713, −0.157R a trade net of costs (before costs −0.015R), month-sum t −9.24, Holm p 1.000; … |
| 160 | `metals-rsi2` | branch `metals-rsi2` | #873 | fail | FAIL — gold and silver together lose −0.077R a trade after costs in 2016-26 (n 137, month t −1.79), 4 of the 5 pre-registered checks fail. |
| 161 | `mosha-bo-er` | branch `mosha-bo-er` | #819 | fail | Arm A (Daily ER20 >= 0.2) FAIL; Arm B (market on the confirmation close) FAIL. On 38 live-rule Mosha BO positions |
| 162 | `mosha-cycle` | main | #714 | fail | FAIL. The buy at the barrier lost −0.22R a trade after costs over 132 trades on spot gold, 2020 to October 2026 (t −0.99, win rate 14.4 %); in sample … |
| 163 | `mosha-level` | main | #714 | fail | FAIL. The pre-registered rule lost −0.35R a trade after costs over 365 trades on spot gold, 2020 to October 2026 (t −3.10, win rate 14.5 %); in … |
| 164 | `mosha-oos` | main | #560 | fail | REGIME-BOUND on the pre-registered rule, and in substance a null result. The live Mosha BO combination makes +0.14R a position at ×1 costs and +0.06R … |
| 165 | `mosha-retrace` | main | #714 | fail | FAIL on the pre-registered rule, and in substance break-even. The chain made +0.02R a trade after costs over 445 trades on spot gold, 2020 to October … |
| 166 | `mosha-select` | main | #714 | fail | FAIL. None of the eighteen cells made money on the discovery years (2006-12), so none was selected, validated or confirmed. Every cell loses in all … |
| 167 | `mosha-sweep` | main | #714 | fail | FAIL, both entries. Selling (or buying) at the CF lost −0.11R a trade after costs over 6,260 trades (t −4.62); entering on the return to the zone of … |
| 168 | `msnr-direction` | main | #735 | fail | FAIL, 0 of 6 tests: the direction call says nothing measurable about gold's next 1, 5 or 20 daily closes beyond the base rate (largest t in 2020-26 … |
| 169 | `msnr-entry` | main | #746, #735 | fail | FAIL, 0 of 3 tests: the engulfing entry taken with the direction call loses after costs in both windows (main test −0.110R a trade in 2020-26, n 795, … |
| 170 | `multiple-testing-1314nov` | branch `multiple-testing-1314nov` | #904 | accounting | no decisive test of the day survives a correction across all 248 (Holm 0, BH q 0.10 0); gotobi T2: (a) BH q 0.7068 fails q 0.10, (b) Holm 0.7618 … |
| 171 | `multiple-testing-update` | branch `multiple-testing-update` | #946 | accounting | no test survives a correction across all 333 (the 248 of #904 plus 85 new): Holm 0, BH q 0.10 0; t >= 2 in 6 against 7.6 expected by chance; with an … |
| 172 | `nas-crypto-spill` | branch `nas-crypto-spill` | #876 | fail | FAIL, 0 of 2 variants clear the checks that could be run. Follow −0.043R a trade net on 2022-01 to 2026-10 (BTC + ETH pooled, n 764, monthly t −0.49, … |
| 173 | `natgas-storage-day` | branch `natgas-storage-day` | #976 | fail | FAIL, 0 of 4 checks hold: following the first half hour after the storage report is not an edge on natural gas. Failed: out-of-sample month-sum t … |
| 174 | `news-filter` | main | #488 | see result.json | see result.json (no RESULT.md verdict line) |
| 175 | `nfp-follow` | branch `nfp-follow` | #863 | fail | FAIL, 0 of 4 tests pass the pre-registered bar (PREREGISTRATION.md, committed before any number was computed). Best on the decisive window: Fade · … |
| 176 | `nq-open-exits` | main | #546 | fail | FAIL, all six cells. The live exit is the best of the seven on 2023-26 and no variant beats it on 2004-22. |
| 177 | `nq-open-oos` | main | #593, #511 | inconclusive | regime-dependent, not robust, not dead |
| 178 | `nr7-breakout` | branch `nr7-breakout` | #867 | fail | FAIL. Neither exit passes the pre-registered bar (PREREGISTRATION.md, committed before any trade was computed). Pooled over the six markets in the … |
| 179 | `oil-wednesday` | branch `oil-wednesday` | #858 | fail | FAIL, 0 of 2 rules pass: neither fading nor following the first half hour after the report is an edge on WTI. Rule F (fade): decisive 2021 on −0.096R … |
| 180 | `open-run-breadth` | main | #543 | fail | NQ-ONLY. The rule does not carry over to any other market, in either period |
| 181 | `open-run-breadth-2` | main | #584 | fail | NQ-ONLY (FAIL): none of the seven cash opens (FTSE, Nikkei, Hang Seng, ASX 200, Euro Stoxx 50, CAC 40, Russell 2000) passes even the 2023-26 half of … |
| 182 | `opex-week` | branch `opex-week` | #882 | fail | FAIL, 0 of 4 tests. Buying the week that ends on the monthly options expiration (the third Friday) made -0.016R a |
| 183 | `orb-nas100` | branch `orb-nas100` | #837 | fail | FAIL: 0 of 2 markets pass in 2021 → now; NAS100 +0.075R a trade net (n 1460, monthly t +1.27, gross +0.135R), SPX500 −0.053R a trade net (n 1456, … |
| 184 | `overnight-drift` | branch `overnight-drift` | #836 | fail | FAIL (0 of 3 indices pass; pre-registration in PREREGISTRATION.md, committed and pushed before any result). |
| 185 | `overnight-unused-markets` | branch `overnight-unused-markets` | #964 | fail | REPLICATES (gross) / FAIL (net): 14 unused index CFDs pooled, 2016-26: +0.011R a trade before costs (n 36701, month-sum t +2.10; 2005-15 +0.027R, t … |
| 186 | `param-drift` | main | #550 | tool / audit | the live parameters of all seven systems equal the tested ones. The four pre-registered / untouched-data studies (#512 replica, #530 gold systems, … |
| 187 | `portfolio` | main | #430 | fail | no rule change passes. The live caps hold up: a dollar cap of 2 and a 3-hour Scalp re-entry wait each scored best in-sample, and both held … |
| 188 | `portfolio-v2` | main | #542 | inconclusive | Passes the letter of the pre-registered bars, but is not an edge on untouched data: in the clean 2009-17 half no book |
| 189 | `post-holiday-metals` | branch `post-holiday-metals` | #984 | fail | FAIL (T1, T2, T3, T4 not met): short gold and silver on the day after a US holiday makes −0.092R a holiday net 2006-26 (n 185, t −2.78). |
| 190 | `pre-fomc-drift` | branch `pre-fomc-drift` | #831 | fail | FAIL. SPX500, 2016 → now (the window that decides): n 86, +0.044R a trade net of costs, t +1.35; the 40-seed placebo's 95th percentile is +0.092R … |
| 191 | `pre-fomc-gold-usd` | branch `pre-fomc-gold-usd` | #925 | fail | FAIL. 0 of 2 tests meet the pre-registered bar. T1 long gold, 2016 → now: n 86, +0.070R a trade net, t +1.26, Holm p 0.19; 2008-15 −0.049R (n 64). T2 … |
| 192 | `pre-holiday` | branch `pre-holiday` | #845 | fail | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). On 2016 to now, |
| 193 | `pre-release-drift` | branch `pre-release-drift` | #963 | fail | FAIL (0 of 10 cells pass). Pre-registered in PREREGISTRATION.md (committed and pushed before any candle was fetched). Paper research only; nothing … |
| 194 | `rebalance-flow` | branch `rebalance-flow` | #865 | fail | FAIL, 0 of 4 tests. The rule (rank the month's SPX500-minus-10-year-note return at the fifth-to-last NYSE trading |
| 195 | `regime` | main | #445 | fail | per-system table; no regime rule adopted (see the file) |
| 196 | `regime-switch` | main | #541 | fail | FAIL as a tradable regime switch. Two of 21 cells pass the letter of the bar (META on the NQ open run and the gold |
| 197 | `replica-oos` | main | #512 | fail | FAIL. The replica does not hold before 2023. |
| 198 | `risk-cross` | branch `risk-cross` | #886 | fail | FAIL, 0 of 3. Holding AUD/JPY (T1) or NZD/JPY (T2) long while the S&P 500 is above its 200-day average and calm |
| 199 | `risk-spill-jpy` | branch `risk-spill-jpy` | #859 | fail | FAIL, 0 of 2 pairs. USD/JPY −0.093R a trade net on 2016-26 (n 725, t −2.36, fails: net R not above 0, t under 2, Holm p over 0.05, negative on … |
| 200 | `robustness` | main | #435 | fail | No verdict in result.json changed. The largest move is this audit's own port of Mosha BO: all years 147 trades at +0.009R became 157 at −0.064R. Its … |
| 201 | `rsi2-early-years` | branch `rsi2-early-years` | #952 | not measurable | NOT MEASURABLE (inconclusive: OANDA daily candles start 2003-03-24, so after the 200-day warm-up only 4.00 years |
| 202 | `rsi2-pullback` | branch `rsi2-pullback` | #838 | fail | FAIL on the pre-registered bar (PREREGISTRATION.md, committed and pushed before any number was computed). No market |
| 203 | `rsi2-replicate` | branch `rsi2-replicate` | #844 | fail | FAIL on the pre-registered single test (PREREGISTRATION.md, committed and pushed before any number was computed). |
| 204 | `rsi2-unused-markets` | branch `rsi2-unused-markets` | #955 | fail | DOES NOT REPLICATE (a fail of the pre-registered single test: -0.016R a trade after costs, month t -0.50, 0 of 4 checks). |
| 205 | `santa-rally` | branch `santa-rally` | #922 | fail | FAIL, 0 of 3 tests pass: the Santa window does not beat an ordinary 7-day window of the same year. |
| 206 | `scalp-exits` | main | #439 | fail | FAIL. No exit rule found an edge. All 23 variants lose money after costs, both in-sample (Jun 2018 to 2023) and out-of-sample (2024 to Oct 2026), on … |
| 207 | `scalp-filters` | main | #459 | fail | FAIL. The Scalp has no robust edge on any of the 10 markets tested, under any single or pairwise filter. |
| 208 | `seasonality` | main | #540 | fail | nothing passes. No candidate shadow stream. |
| 209 | `sell-in-may` | branch `sell-in-may` | #851 | fail | FAIL on the pre-registered bar (PREREGISTRATION.md, committed before any number was computed). Nine index CFDs, decisive pairs 2016-2026 (n 11): … |
| 210 | `setups-promote` | main | #451 | fail | no engine setup has a robust edge on 2018–2026. Promote none to live. A formal PASS (gold M30→M1, London session only) is weak and is explained … |
| 211 | `shadow-audit` | main | #563 | tool / audit | the shadow book's −300R week is 100% costs, not trading. On 515 closed shadow trades (2–8 Nov) the book made +92.6R gross and paid 380.5R of modelled … |
| 212 | `shadow-best` | main | — | fail | FAIL, 0 of 32 cells: no engine shadow stream is worth keeping |
| 213 | `shadow-best-raw` | branch `shadow-best-raw` | #821 | fail | FAIL, 0 of 32 cells at the measured costs (0 of 32 at 2x): the cut was not decided on wrong costs |
| 214 | `shadow-cost` | main | #696 | fail | INCONCLUSIVE. No shadow stream passes as a whole. Seven streams fail on cost (the engine's scalp 0.35R, retrace scalp 0.40R, intraday 0.14R, retrace … |
| 215 | `shadow-scalp-filters` | main | #800 | inconclusive | INCONCLUSIVE: the pre-registered bar passes 4 of 5, but a random filter of the same size passes it too (4 of 5 placebos) |
| 216 | `sizing` | main | #538 | fail | keep fixed 1R. No overlay passes the pre-registered bar. |
| 217 | `sma10-timing` | branch `sma10-timing` | #841 | fail | FAIL: on the equal-weight book (SPX500, NAS100, US30, gold), in the decisive window 2016 to 6 Nov 2026 the 10-month average rule cut the worst … |
| 218 | `smallcap-january` | branch `smallcap-january` | #947 | fail | FAIL, 0 of 2. Long US2000 against short SPX500 at the turn of the year lost after costs in both samples and both |
| 219 | `soybean-short-robust` | branch `soybean-short-robust` | #937 | fail | FRAGILE. With the grain-seasonality soybean short frozen (that study's code, byte for byte), moving the July to |
| 220 | `supported-book` | main | #766 | fail | FAIL: on untouched 2006-17, after costs and financing on every unit, the two-system book (Gold trend + Gold daily engulf) made +59.3R, +5.2R a year … |
| 221 | `swing-day3` | branch `swing-day3` | #825 | fail | FAIL, 0 of 3 tests. The model (T1): n 262 trades, -0.001R a trade net of costs (PF 1.00), month-sum t -0.01 over 83 |
| 222 | `timing` | main | #456 | fail | FAIL — no time window passes. No window turns any of the four engine setups positive out of sample, so none meets the bar for a candidate. One … |
| 223 | `tl-third-touch` | branch `tl-third-touch` | #820 | fail | FAIL, on every condition: the trendline entry lost −0.441R a trade after costs over 2020-26 (n 42, month-sum t −2.87; 2020-23 −0.258R, n 25; 2024-26 … |
| 224 | `tokyo-fix-daily` | branch `tokyo-fix-daily` | #917 | inconclusive | UNCLEAR. T1 (the frozen 00:55 sell / 06:00 buy-back on every non-gotobi Tokyo business day, 2016-now): −0.0629R a trade net, n 1870, month t −2.37. … |
| 225 | `treasury-auction-cycle` | branch `treasury-auction-cycle` | #978 | fail | FAIL. Short usb10y from the close five US trading days before the 10-year note auction to the auction day's |
| 226 | `trend-breadth` | main | #762, #758 | inconclusive | INCONCLUSIVE: overnight financing, which no cost model here counts, takes Gold trend from +0.49R to +0.40R a position on untouched 2006-17 (n 75, t … |
| 227 | `trend-breadth-h1` | main | #766 | fail | FAIL: the Gold trend rule does not carry to other markets: 0 of 14 tests pass; pooled over thirteen markets −0.059R a position net on 2020-26 (n 827, … |
| 228 | `tsmom` | branch `tsmom` | #892 | fail | FAIL. All 25 markets pooled: −1.389R a month net in 2016-26 (t −1.44, Sharpe −0.44, worst drawdown −232.0R, 3250 positions) and +0.288R in 2008-15 (t … |
| 229 | `tsmom-portfolio` | branch `tsmom-portfolio` | #828 | fail | FAIL (pre-registered bar: 2008-17 Sharpe > 0.4 missed, t >= 2 missed; 2018-26 total > 0 missed). |
| 230 | `turn-of-month` | branch `turn-of-month` | #826 | fail | FAIL, 0 of 3 markets, on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). On |
| 231 | `turnaround-early-years` | branch `turnaround-early-years` | #953 | not measurable | NOT MEASURABLE (inconclusive: about 4.7 years of candles before 2008, under the 5-year floor). As |
| 232 | `turnaround-replicate` | branch `turnaround-replicate` | #862 | fail | FAIL on the pre-registered bar (PREREGISTRATION.md, pushed before any candle was read). The frozen rule (the |
| 233 | `turnaround-tuesday` | branch `turnaround-tuesday` | #857 | pass or partly | PASS on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed), by one cell of |
| 234 | `turnaround-unused-markets` | branch `turnaround-unused-markets` | #958 | fail | DOES NOT REPLICATE: the frozen rule fails #862's bar on the eight index CFDs neither #857 nor #862 used. On the |
| 235 | `us-asia-lead` | branch `us-asia-lead` | #913 | fail | FAIL: the Asian session in the US cash session's direction, entered at the Asian open, after a 0.04 % round trip, 2016-26: JP225 −0.041R a trade (n … |
| 236 | `vix-term` | branch `vix-term` | #827 | not measurable | INCONCLUSIVE, data not reachable: the Cboe VIX and VIX3M history files could not be fetched from the build environment, so the pre-registered rule … |
| 237 | `vol-managed` | branch `vol-managed` | #839 | fail | FAIL on the pre-registered bar (PREREGISTRATION.md, committed before any number was computed). Equal-weight book of S&P 500, Nasdaq 100 and Dow 30, … |
| 238 | `vol-managed-index` | branch `vol-managed-index` | #909 | fail | FAIL, 0 of 3 tests pass: net of CFD costs, volatility scaling lowers the Sharpe ratio on the S&P 500 and on the four indices pooled. |
| 239 | `vol-spike-crypto` | branch `vol-spike-crypto` | #962 | fail | FAIL. #860's rule, frozen byte for byte (buy after the 5-day realised volatility exceeds twice its prior 120-day |
| 240 | `vol-spike-rebound` | branch `vol-spike-rebound` | #860 | pass or partly | PASS on the pre-registered bar (PREREGISTRATION.md, committed and pushed before any number was computed), by the |
| 241 | `vol-spike-replicate` | branch `vol-spike-replicate` | #920 | pass or partly | PARTLY. By the pre-registered reading (PREREGISTRATION.md, committed and pushed alone before any number): on the |
| 242 | `vol-spike-replicate2` | branch `vol-spike-replicate2` | #951 | fail | DOES NOT REPLICATE. By the pre-registered bar (PREREGISTRATION.md, committed and pushed alone before any |
| 243 | `weekend-gap-duka` | branch `weekend-gap-duka` | #949 | not measurable | NOT MEASURABLE (inconclusive: Dukascopy is not reachable from this runner). No spread measured, no test run. |
| 244 | `weekend-gap-late-entry` | branch `weekend-gap-late-entry` | #954 | fail | FAIL. Entered one hour later (18:05 New York) Rule G loses on all four lines of the bar: −0.126R a trade after |
| 245 | `weekend-reopen-cost` | branch `weekend-reopen-cost` | #944 | not measurable | NOT MEASURABLE (inconclusive: a cost that could not be measured, not a failed rule). No real spread source covers the Sunday reopen for the pairs and … |
| 246 | `wmr-fix-reversal` | branch `wmr-fix-reversal` | #910 | fail | FAIL. None of the three tests is positive after costs in either window: the fade loses about 0.08R a trade in |
| 247 | `yield-fx-weekly` | branch `yield-fx-weekly` | #942 | fail | FAIL, 0 of 3: a weekly 2-year Treasury move does not lead the dollar over the next week; decisive 2016-26 net a trade T1 USD/JPY +0.019R (n 301, t … |

# Result: mean reversion of the gold / silver ratio, out of sample (13 Nov 2026)

**Verdict: FAIL, on all three pre-registered checks.** Trading the gold / silver ratio back to its 250-day mean when it is two
standard deviations away lost money in 2006-17 (18 trades, -0.98 % of gross notional a trade net, t -1.20) and in 2018 to now
(16 trades, -1.27 % a trade, t -2.03), and it did not beat random entry days with the same holding periods (better than 16 of 40
placebo seeds; the bar was 38). Not an edge; no proposal; nothing live changed.

OANDA mid daily XAU_USD and XAG_USD from council-data `research/daily` (UTC-aligned days, weekends dropped, 20 March 2006 to
6 November 2026; first z-score 5 March 2007). z of ln(gold / silver) against the 250 days before; enter at the next open when
|z| >= 2 (z >= 2 sell gold / buy silver, z <= -2 the reverse), legs of equal 60-day volatility, out at the open after z crosses 0,
after 60 trading days, or at the stop (the log ratio at |z| = 3.5 on the entry day's statistics, fixed at entry). Costs: $0.35 a
round trip on gold and $0.03 on silver, financing on long legs at `council/fills.mjs` `FIN.xau.long` (silver assumed at the same
rate), nothing credited on shorts.

| Window | n | Net a trade | Gross a trade | Cost a trade | t (trades) | t (monthly sums) | Win rate | Stop / target / time | Worst drawdown |
|---|---|---|---|---|---|---|---|---|---|
| 2006-17 (confirmation) | 18 | -0.98 % | -0.56 % | 0.42 % | -1.20 | -1.20 | 33 % | 8 / 3 / 7 | -17.8 % |
| 2018 to now (reported apart) | 16 | -1.27 % | -0.81 % | 0.46 % | -2.03 | -2.03 | 25 % | 6 / 4 / 6 | -21.1 % |
| All | 34 | -1.12 % | -0.68 % | 0.44 % | -2.16 | -2.16 | 29 % | 14 / 7 / 13 | -38.0 % |

- **The checks**: (1) 2006-17 mean net > 0 with the stricter t >= 2: no, -0.98 %, t -1.20 (each trade sits in its own month, so the
  two t's are the same). (2) 2018 to now positive: no, -1.27 %. (3) Placebo: the 2006-17 mean beats 16 of 40 seeds (placebo median
  -0.76 %, 95th percentile +0.67 %); needed 38.
- **Why**: the ratio did not come back inside 60 days often enough. Only 7 of 34 trades reached z = 0; 14 hit the 3.5 stop (the ratio
  kept running: 2008, 2020) and 13 ran out of time. Before any cost the trades lost -0.68 % each, so this is not a cost story.
- 23 of 34 trades were ratio shorts (gold rich against silver); 15 of 18 entry years lost; only 2009, 2015 and 2022 were positive.
- Few trades (34 in nineteen years), so the figures are wide; nothing here suggests a version worth a second test on the same data.

Scope: a stand-alone relative-value rule on two metals, not a change to any gold book system, so the owner's 12 Nov 2026 rule
(docs/owner-decisions.md item 44: no further gate, exit, entry or size tested on the gold book's 2006-17 window) did not apply.
Deviation stated in the pre-registration: the daily close is the cache's 00:00 UTC close, not 17:00 New York.

To repeat: `node research/edge/gold-silver-ratio/run.mjs` (reads `origin/council-data` with `git show`, no network; fetch
council-data first). Tests: `tests/gold-silver-ratio.test.mjs`.

# Stress and reaction rules of the macro rule book and gold: result (19 Nov 2026)

Pre-registered in PREREGISTRATION.md (committed first). Data: FRED DGS2, DFII10, VIXCLS, DTWEXBGS (keyless) and OANDA daily gold,
2007 to November 2026. Outcome: gold's next 20 sessions from the close after each reading was known. Gold's mean 20-session
return over all days: +0.60 %.

**Verdict: 1 of 5 passes, on a handful of episodes.** C2 (stress exception) PASS on its count bar; C1, C3, C4, C5 FAIL.

| Claim of the rule book | Test | n | Result | Verdict |
|---|---|---|---|---|
| C1 2-year down > 30 bp in 2 sessions = rescue setup for gold | episodes | 10 | mean +2.35 %, but only 5 of 10 above the all-days mean | FAIL |
| C2 real yield +25 bp in 5 sessions, VIX > 30, dollar lower = gold-bullish stress | episodes | 6 | mean +3.05 %, 4 of 6 above | PASS (count bar) |
| C3 gold within 3 % of its 52-week high while the real yield rises 15 bp in 4 weeks = bullish | weekly dummy | 25 of 1,014 weeks | t 0.33; halves +2.8 % / −1.2 % | FAIL |
| C4 gold down 3 % in a week while real yield and 2-year fall = deleveraging, hold | weekly dummy | 13 of 1,014 weeks | t 1.23 (+1.6 %), same sign in both halves, only 2 weeks after 2016 | FAIL |
| C5 gold closes up on a day the 2-year rose 15 bp = cancel the sell bias | Welch, up vs down days | 12 vs 40 | after up-close days −3.12 %, after down-close days −0.35 % (t −1.04): the wrong way | FAIL |

Holm over C3, C4, C5: 0.74, 0.66, 0.66.

## What it means
- **C2 is consistent with the claim and proves little.** Four of the six episodes are 2008-09 (18 Sep, 29 Oct, 10 Dec 2008, 1 May
  2009); the others are 5 May 2022 (−1.7 %) and 11 Apr 2025 (+3.2 %). Shown on the Macro desk as a live check with this record,
  never as a tested edge.
- **The rescue setup** gave a higher mean only because of two crises (Aug 2007 +6.7 %, Sep 2008 +15.9 %, Mar 2023 +5.5 %); half
  the episodes were flat or down (Jun 2022 −6.0 %).
- **"Reaction beats forecast" is not supported**: on the 12 days gold rose while the 2-year jumped 15 bp or more, gold did worse
  over the next 20 sessions than after the 40 days it fell (8 of the 12 are 2007-16). Do not cancel a sell bias on it.
- **Resilience and deleveraging** are too rare to read (25 and 13 weeks) and neither is significant.

Nothing live changed. The live check is `council/research-watch.mjs` `stressCheck` (C1 and C2 conditions on the latest sessions).
To repeat: `node --use-env-proxy research/edge/rulebook-stress/run.mjs fetch <dir>`, then `… run <dir>`.
Test: `tests/rulebook-stress.test.mjs`.

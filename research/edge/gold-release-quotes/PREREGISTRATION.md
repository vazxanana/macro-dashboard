# Pre-registration: gold-release-quotes (20 Nov 2026)

Paper research only. What gold really costs to trade around US releases, read from the demo broker's own bid and ask, and one
small fixed test of the owner's news register N4 ("post-release continuation versus reversal", register V2,
`research/macro-veteran/references/news-trading-strategy-register-v2-2026-11-19.md`) on **executable** prices. Nothing live
changes, no rule or council member reads it. Written and pushed alone, **before the data exists**: the demo tick probe
(`council/tick-probe.mjs`, PR #1285) has not run, so no tick of any release is known to the author.

## Data

council-data `research/probe/ticks-XAUUSD.json`, its first run (commit named in result.json): `events` = every US CPI, payrolls
and FOMC statement of `council/events.mjs` inside the broker's tick history, each with the last bid and ask at or before
T-10 … T+65 minutes (each whole minute) and T+5 s, T+15 s, T+30 s, and the widest spread of each minute. An event whose quote at
any mark used below is missing is left out and counted. Events closer than 75 minutes to another event of the list count once
(the earlier one).

## Part A, the cost of the news minutes (descriptive, no test)

Per release type and all together: the median and 90th percentile of the quoted spread (ask − bid) at T−5 min, T−1 min,
T+5 s, T+15 s, T+30 s, T+1 min, T+5 min, T+15 min, T+60 min, and the widest spread of minute T (as a share of price and in $),
against the hour profile's median for the same UTC hour (the probe's `hourProfile`). This is the number the council's news
guard and any news trade must pay.

## Part B, one test of N4 on executable quotes

Direction D = sign of mid(T+5 min) − mid(T−1 min) (0 = no trade). Entry at T+5 min on the executable side (buy at the ask,
sell at the bid), exit at T+60 min on the other side (sell at the bid, buy at the ask). Stop: 1 × |mid(T+5) − mid(T−1)| beyond
the entry, checked on the executable quote at every whole minute T+6 … T+59 (a crossed stop exits at that minute's executable
price; minute marks only, so a stop is checked late, said in the result). Every trade has its stop (absolute rule 1). R = the
P/L divided by the stop distance.

- **B1 continuation**: trade in direction D. **B2 reversal**: trade against D (stop the same distance).
- Statistic: mean R and t of R (events are weeks apart, so per-event t; no month sums needed when n < 60, said). One-sided
  p, Holm over B1 and B2.
- **Pass bar** (each): n ≥ 30, mean R > 0, Holm p < 0.05, and mean R > 0 on CPI + payrolls without FOMC. Also reported: the
  same trades on the mid (no spread), to show what the spread takes.
- Prior said now: `red-folder-surprise` (HistData mid, 2018-25) found the first 5 minutes go with the consensus miss 72 % of
  the time and that following it from T+5 to T+60 lost (−0.144 % in 2018-21, −0.007 % in 2022-25). A pass of B1 would
  contradict that study; B2 has no prior either way. The expected n is small (the history depth decides it); a failed bar
  for lack of n is reported as "too few", not as a fail.

## Deliverables

`research/edge/gold-release-quotes/{PREREGISTRATION.md, run.mjs, RESULT.md, result.json}`, `tests/gold-release-quotes.test.mjs`.

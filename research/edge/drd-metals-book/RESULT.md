# Result: the weekly-bull daily rejection long as one book on gold and silver, one position at a time (13 Nov 2026)

**Verdict: FAIL, 0 of 3.** Held one position at a time across gold and silver and counted on calendar-month sums, no stream
reaches the bar on 2006 to October 2022: monthly t 0.67 (every signal, n 486), 1.47 (ER20 >= 0.3, n 236) and 1.09 (ER20 >= 0.2
and up over 20 days, n 244), Holm p 0.21-0.28. The silver result of `gold-drd-silver` does not survive the honest count: in this
book silver's trades make +0.013R to +0.111R a trade on 2006-22 and lose in November 2022 to now.

Pre-registration: `PREREGISTRATION.md` (pushed before any number). OANDA mid H1 XAU/USD and XAG/USD, March 2006 to 11 November
2026 (the gold-drd-long and gold-drd-silver caches). Net of $0.35 (gold) / $0.03 (silver) a round trip and financing on gold buys
(`council/fills.mjs` `financing`, today's rate for every year; silver charged none). A trade belongs to the month of its entry.

## The three books on 2006-01 to 2022-10 (window A, 202 months)

| Stream | n | R a trade, net | PF | Worst drawdown | Monthly t | Holm p | A1 PF (2006-01 to 2014-05) | A2 PF (2014-06 to 2022-10) | Nov 2022 to now | Pass |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 every signal | 486 | +0.054 | 1.08 | -58.3R | 0.67 | 0.2757 | 1.22 | 0.95 | +40.3R (n 127) | no |
| T2 ER20 >= 0.3 | 236 | +0.163 | 1.26 | -28R | 1.47 | 0.2123 | 1.41 | 1.11 | +19.6R (n 71) | no |
| T3 ER20 >= 0.2 and up over 20 days | 244 | +0.128 | 1.20 | -17.9R | 1.09 | 0.2757 | 1.55 | 0.90 | +19.5R (n 70) | no |

- **What failed**: the monthly t on every stream (bar 2 after Holm), and for T1 and T3 the second half of 2006-22 lost (PF 0.95
  and 0.90). Only the later window (November 2022 to now, the window the gold rule was found on) is positive for all three.
- **One position at a time keeps a fraction of the signals**: 486 of 2,350 candidates on T1 (1,737 skipped as overlapping), 307
  of 905 on T2, 314 of 1,099 on T3, over the whole file. The trade-level t of `gold-drd-silver` (1.90-2.52) came from counting
  those overlapping trades as separate evidence.
- **By market in window A**: gold +0.031R (T1, n 346), +0.267R (T2, n 139, t 1.86), +0.143R (T3, n 154); silver +0.111R (T1,
  n 140), +0.013R (T2, n 97), +0.101R (T3, n 90). In November 2022 to now gold's trades carry the books (+47.2R, +27.9R, +29.2R)
  and silver's lose (-7.0R, -8.4R, -9.7R).
- **Costs and financing**: financing took 23.6R (T1), 9.0R (T2) and 9.4R (T3) of window A; with costs doubled T1 is +3.2R, T2
  +25.6R, T3 +20.2R. Without financing T2 would read about +47R; it would still not meet the monthly bar (the t was not recomputed).
- **Years** (T2, the strongest): losing in 2010, 2012-15, 2017, 2021-23; 2016, 2020, 2011 and 2007 carry the total.

## What it means
The rule is a long-gold-in-a-bull-week bet with the same sideways years as before; on silver it adds nothing once trades cannot
overlap. The two ER cuts were chosen after the fact on gold 2006-22, so their gold figures here are in sample for the cut; even so
they do not pass. This ends this line of work: no proposal, no council rule, nothing live changed. Item 44 (no new gate, exit,
entry or size on the gold book's 2006-17 window) was respected: this study tests neither Gold trend nor Gold daily engulf, and
every rule, cut and window in it was fixed by earlier studies.

To repeat: fetch with `node --use-env-proxy research/edge/gold-drd-long/run.mjs fetch <dir>` and
`node --use-env-proxy research/edge/gold-drd-silver/run.mjs fetch <dir>` (candles kept out of git), then
`node research/edge/drd-metals-book/run.mjs full <dir>`. Tests: `tests/drd-metals-book.test.mjs`.

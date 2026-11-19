# Mosha BO: the Daily regime filter, a market entry on the confirmation, and where the confirmation forms (result, 13 Nov 2026)

**Verdict: Arm A (Daily ER20 >= 0.2) FAIL; Arm B (market on the confirmation close) FAIL.** On 38 live-rule Mosha BO positions
filled 2020-01 to 13 Nov 2026 (OANDA gold, net of $0.30 a unit and financing on buys; +0.192R a position, t 0.597), the
course's Daily filter keeps only 7 of them: +1.149R a position against −0.024R for the 31 it blocks, kept − blocked Welch t
1.268 (month-sum t 0.054, Holm p 0.2406), and it does not beat the unfiltered stream in the second half (+0.761 against +0.824).
A market entry on the confirmation close makes +0.156R a position (n 41) against the limit's +0.192R (n 38), Welch t −0.087
(month-sum t −0.057, Holm p 0.5345), better in the first half and worse in the second. No proposal is written; nothing live changed.

Pre-registration: `PREREGISTRATION.md` (committed and pushed alone, before any trade was simulated). Paper research only.
2020 → now is partly in sample for Mosha BO (its weekly filter and exits were picked on 2019-26).

## Arm A: the Daily regime split (ER20 of 17:00 New York daily closes at the order's time)

| stream | n | R a position | first half 2020-23 (n, R) | second half 2024 → (n, R) | t | worst closed DD (R) | gross R a position |
|---|---|---|---|---|---|---|---|
| all positions | 38 | +0.192 | 24, −0.176 | 14, +0.824 | 0.597 | 11.925 | +0.273 |
| kept (ER20 >= 0.2) | 7 | +1.149 | 4, +1.440 | 3, +0.761 | 1.335 | 1.034 | +1.234 |
| blocked (ER20 < 0.2) | 31 | −0.024 | 20, −0.500 | 11, +0.841 | -0.071 | 10.891 | +0.056 |

Rules: (a) kept above all in both halves: no (second half +0.761 < +0.824); (b) kept − blocked Welch t 1.268 (bar 2): no;
(c) month-sum Welch t, kept stream against the unfiltered stream, 0.054: no; (d) Holm p 0.2406: no; (e) drawdown not deeper:
yes; (f) at least 30 kept and 10 blocked: no (7 kept); (g) placebo: 0 / 40 random splits of the same size pass, their 95th
percentile t is 1.439, above the real 1.268: no.

What it says: Mosha BO fires almost only in a ranging Daily. Half of all 17:00 New York days of 2020-26 have ER20 >= 0.2, but
31 of the 38 orders came on a Daily under 0.2 (median 0.08): the H4 break, H1 pullback, M15 break back chain is a range pattern.
The 7 kept positions look good and are too few to tell from luck (the random splits do as well). The course's "PF 1.35-1.42
over 14 years" is not reproduced or refuted here: with 7 positions there is nothing to measure.

## Arm B: market on the confirmation close vs the live limit (same stop price, R in each entry's own risk)

| stream | n | R a position | first half (n, R) | second half (n, R) | t | worst closed DD (R) | gross R a position |
|---|---|---|---|---|---|---|---|
| market on the M15 confirmation close | 41 | +0.156 | 25, −0.018 | 16, +0.429 | 0.605 | 9.001 | +0.228 |
| limit at the broken level (live) | 38 | +0.192 | 24, −0.176 | 14, +0.824 | 0.597 | 11.925 | +0.273 |

Rules: (a) market above limit in both halves: no (better in 2020-23, worse in 2024 →); (b) Welch t −0.087: no; (c) month-sum
Welch t −0.057: no; (d) Holm p 0.5345: no; (e) drawdown not deeper: yes (9.0R against 11.9R).

What it says: the two entries are nearly the same trade. On this harness the M15 confirmation closes a median 0.073R beyond the
broken level (median stop distance $18.15 limit, $18.48 market), so the "deep limit" the course warns about hardly exists: the
limit fills on 37 of the 38 chains the market arm also takes. On those 37 the market entry made −0.058R and the limit +0.225R a
position; the market arm's lead in total comes from 4 chains the limit never filled (price left without coming back), all 4
winners (+2.138R a position). Over the whole window the difference is noise.

## Arm C: where the confirmation forms (descriptive only, no test)

| stream | n | R a position | first half (n, R) | second half (n, R) | t | worst DD |
|---|---|---|---|---|---|---|
| limit, confirmation inside the reversal range ("case 2") | 7 | +1.280 | 3, +0.228 | 4, +2.068 | 1.042 | 2.152 |
| limit, beyond it (pullback deeper than the box) | 31 | −0.053 | 21, −0.234 | 10, +0.326 | -0.192 | 12.61 |
| market, case 2 | 8 | −0.173 | 4, +0.211 | 4, −0.557 | -0.427 | 2.263 |
| market, beyond | 33 | +0.236 | 21, −0.062 | 12, +0.758 | 0.772 | 9.845 |

Case 2 vs the rest: Welch t 1.058 on the limit's positions, −0.806 on the market's; the sign does not hold across the two
entries of the same chains. Not a filter, never counted.

## Data and method, as run

- Candles: OANDA mid gold M5 / M15 / H1 / H4 from 2 Jun 2019 and D1 from 1 Jan 2016 to 13 Nov 2026 22:00 UTC
  (`fetch.mjs`, kept out of git).
- Trades: the replay of `research/edge/mosha-oos/run.mjs` (the live block line for line on 720-candle windows, one run 4 minutes
  after each M5 close, live management on M5), loaded from that file's own text, not edited. **Parity gate passed**: the live
  arm equals `mosha-oos/run.mjs replay` leg for leg (576 legs). The market arm changes only the order line: filled at the close
  of the last M5 candle closed at the run (at the first run, the M15 confirmation candle's close), the stop price unchanged,
  target cap / break-even / add / trail measured in the market entry's own risk; 0 market entries on the wrong side of the stop.
- Positions: first unit + its add, net of $0.30 a unit and financing on buy units (`council/fills.mjs` `nights` x `FIN.xau.long`;
  2.1R in total on each arm); only the rule's own trades (no weekly / cap / price / slow-arrival blocks); none marked at the end.
- ER: `gold-drd-er` `er` on `gold-drd-long` `days` (17:00 New York days from H1, Sunday folded into Monday), the last day closed
  at the order's time. Statistics: `cycle-gate` `welch`, `maxDD`, `splitStats`, `placebo` (merged from `origin/cycle-gate-study`),
  `shadow-best` `holm`.
- Why not cycle-gate's Mosha BO stream: it is the HistData robustness rebuild (122 trades 2020 →, time / side / R only), on
  which no entry can be changed; this study's 38 positions are the OANDA live-window harness, which is the one that matches
  the live code.
- To repeat: `node --use-env-proxy research/edge/mosha-bo-er/fetch.mjs <dir>`, then `node research/edge/mosha-bo-er/run.mjs
  replay <dir> <out>` and `… study <dir> <out>` (writes result.json). Tests: `tests/mosha-bo-er.test.mjs`.

# Result: gold's demo quotes around US CPI, payrolls and FOMC (20 Nov 2026)

**Verdict: B1 continuation FAIL (n 93, +0.030R a trade on executable quotes, t 0.12; without FOMC -0.158R); B2 reversal FAIL (n 93, -0.332R, t -0.76). The news minutes cost far more than any other: the quoted spread at T+5 s is about 18x the same hour's usual median, back near normal by T+1 min.**

Pre-registered in `PREREGISTRATION.md` (pushed alone, before the data existed). Data: council-data `research/probe/ticks-XAUUSD.json` (commit 0459ec37, the demo broker's own bid and ask ticks), 94 US releases from 2023-12-08 to 2026-11-10 (NFP 35, CPI 35, FOMC 24: every one of these in `council/events.mjs` inside the probe's window of about 1,095 days). Paper research only; nothing live changed.

## Part A: the quoted spread around the release (ask − bid as a share of price, in units of 10⁻⁴; in $ at $4,000 gold)

| Type | n | Usual (same hour) | T−5 min | T−1 min | T+5 s | T+15 s | T+30 s | T+1 min | T+5 min | T+15 min | T+60 min | Widest in minute T |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CPI | 35 | 0.20 ($0.08) | 0.25 ($0.10) | 0.30 ($0.12) | 2.87 ($1.15) | 0.82 ($0.33) | 0.48 ($0.19) | 0.45 ($0.18) | 0.34 ($0.14) | 0.22 ($0.09) | 0.24 ($0.10) | 13.32 ($5.33); p90 $20.50 |
| NFP | 35 | 0.20 ($0.08) | 0.28 ($0.11) | 0.24 ($0.10) | 4.44 ($1.78) | 1.09 ($0.44) | 0.65 ($0.26) | 0.45 ($0.18) | 0.32 ($0.13) | 0.24 ($0.10) | 0.27 ($0.11) | 19.86 ($7.94); p90 $19.01 |
| FOMC | 24 | 0.17 ($0.07) | 0.21 ($0.08) | 0.24 ($0.10) | 3.17 ($1.27) | 0.61 ($0.24) | 0.53 ($0.21) | 0.44 ($0.17) | 0.29 ($0.11) | 0.20 ($0.08) | 0.26 ($0.10) | 11.03 ($4.41); p90 $10.96 |
| ALL | 94 | 0.20 ($0.08) | 0.26 ($0.10) | 0.26 ($0.10) | 3.70 ($1.48) | 0.89 ($0.36) | 0.56 ($0.23) | 0.45 ($0.18) | 0.32 ($0.13) | 0.23 ($0.09) | 0.26 ($0.10) | 16.78 ($6.71); p90 $19.36 |

Medians; the 90th percentiles are in result.json (all releases at T+5 s: $4.47). Two things follow for anything the desk does near a release: an order sent in the first seconds pays about $1-2 of spread instead of $0.08-0.10, and one sent inside minute T can meet a spread of $7 (median) to $19 (p90). By T+1 min the spread is about twice normal, by T+15 min normal.

## Part B: N4 of the news register on executable quotes

Direction = sign of the mid's move from T−1 min to T+5 min; entry at T+5 min on the executable side, exit at T+60 min on the other side; stop one first-five-minute move beyond the entry, checked on the executable quote at each whole minute.

| Test | n | Mean R (executable) | t | Mean R (mid) | Won | Stopped | Without FOMC (n) | Holm p | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| B1 continuation | 93 | +0.030 | 0.12 | +0.061 | 37 | 38 | -0.158 (69) | 0.907 | FAIL |
| B2 reversal | 93 | -0.332 | -0.76 | -0.301 | 34 | 47 | -0.418 (69) | 0.907 | FAIL |

Neither direction after the first five minutes has an edge on gold, as `red-folder-surprise` found on HistData mid prices; with executable quotes the reversal is worse still. The stop is checked once a minute, so a stop is filled late (stated in the pre-registration); the t values are far from any bar either way.

## What it means

- Do not trade gold in the first minute of a US release on this account: the spread alone can be 20-80x normal.
- After T+5 min there is no direction to follow or fade (n 93, both t under 1).
- The figures are for one demo account, Dec 2023 to Nov 2026.

To repeat: `node research/edge/gold-release-quotes/run.mjs <ticks-XAUUSD.json> [probeCommit]`.

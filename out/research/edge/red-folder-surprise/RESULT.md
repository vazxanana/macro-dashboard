# Red folder surprise: gold's first hour after US CPI and payrolls, by the miss against the calendar consensus

**Verdict: FAIL** (pre-registered test T2, 19 Nov 2026). Gold's first five minutes follow the miss; after that there is
nothing left to trade on average.

Pre-registration: `PREREGISTRATION.md` (committed before this run). Data: `council/event-base.json` (HistData M1 gold),
`council/consensus-history.json` (Forex Factory via a community dataset), first prints from the veteran batch where present.
83 events with a non-zero miss: core CPI 2018 to Apr 2025 (48), payrolls 2022 to Apr 2025 (35). Hot = above consensus,
expected gold down.

| | n | result |
|---|---|---|
| T1: first 5 minutes in the expected direction, all | 83 | 60 of 83 (72 %), binomial p 0.0001 |
| T1, 2018-2021 / 2022-Apr 2025 | 24 / 59 | 67 % (p 0.15) / 75 % (p 0.0002) |
| **T2: trade T+5 to T+60 with the miss, after 0.03 %**, 2018-2021 | 24 | −0.144 % a release, t −2.03, 21 % won |
| **T2, 2022-Apr 2025** | 59 | −0.007 %, t −0.11, 53 % won |
| T2 by type, out of sample: CPI / payrolls | 24 / 35 | +0.111 % (t 1.23) / −0.087 % (t −1.11) |
| Reported: release minute to T+60 (not tradable), 2022-Apr 2025 | 59 | +0.332 %, t 4.01 |

What it means for preparing a release: the direction of the miss against consensus shows in gold within the first minutes
(about three releases in four), and most of the hour's move is already done by T+5. Entering after the first five minutes in the
direction of the miss made nothing on average (in sample it lost). So: know the consensus and which side a miss sends gold
before the release; do not chase after the print. Bigger misses (above the median) were no better (−0.004 %, n 23).

Limits: about 80 events; a calendar consensus collected by a third party; HistData mid prices with no release-minute spread or
slippage; payrolls only from 2022 in the gold reaction file. Nothing live changed.

To repeat: `node research/edge/red-folder-surprise/run.mjs` (committed files only, no network).

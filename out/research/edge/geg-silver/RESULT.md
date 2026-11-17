# The Gold daily engulf rule on silver (17 Nov 2026)

Pre-registered in `PREREGISTRATION.md` (committed alone before any result). The owner's question: `docs/owner-decisions.md`
item 59. Research only: nothing live changed.

**Verdict: FAIL.** The live Gold daily engulf rule, unchanged but for its $0.30 buffer scaled to $0.004, does not make money on
silver out of sample. Out of sample (entries 2024 to 17 Nov 2026) it made +0.098R a position after costs and financing (n 63,
month-sum t 0.52, bar 2.0), and in sample (2020-23) it lost −0.158R a position (n 85). Two of the five pre-registered tests
missed (the OOS month-sum t and a positive in-sample mean). Not an edge on silver; nothing is proposed, nothing is tuned.

## Parity gate on gold (passed)

The same harness with gold's own numbers (pad $0.30, a flat $0.30 a round trip, no financing, candles cut at 7 Nov 2026)
reproduces the committed gold engulf figures of `research/edge/gold-weekend/result.json` exactly:

| Window | Committed | This harness |
|---|---|---|
| 2006-07 to 2017-12 | n 247, +0.207R | n 247, +0.207R (t 2.06) |
| 2018-01 to 2026-11-06 | n 176, +0.326R | n 176, +0.326R (t 2.38) |

So the silver figures below come from the rule as the gold studies ran it.

## Silver (OANDA mid XAG/USD, M5 and D1, March 2006 to 16 Nov 2026)

Net R a position: x1 = 0.10 % of the entry price a round trip + financing on every rollover night (0.015 % of price a night);
x2 = the round trip twice. Month t = the t of calendar-month sums, every month of the window counted (empty ones as 0).

| Window | n | x1 R a position | x2 R a position | t (per position) | month-sum t |
|---|---|---|---|---|---|
| Replication 2006-07 to 2019-12 | 252 | +0.060 | +0.006 | 0.64 | 0.55 |
| In sample 2020-23 | 85 | −0.158 | −0.207 | −1.01 | −0.89 |
| Out of sample 2024 to 17 Nov 2026 | 63 | +0.098 | +0.058 | 0.53 | 0.52 |

Pre-registered tests: (1) OOS mean > 0: yes; (2) OOS month-sum t >= 2: **no** (0.52); (3) IS mean > 0: **no** (−0.158);
(4) OOS mean > 0 at x2: yes; (5) OOS n >= 30: yes (63).

## What else the run shows (reported, not part of the verdict)

- **Before any cost** the rule is barely positive on silver: +0.146R a position on 2006-19 (t 1.55), −0.082R on 2020-23,
  +0.163R on 2024-26 (t 0.88). Costs and financing take about 0.05R and 0.03R a position (median stop 2.2 % of price).
- **Years**: the replication window's profit is 2007-10 (+37.2R over four years) and 2016; 2012-14, 2017-18 and 2023 lost.
  It follows silver's big rallies, as the engulf follows gold's.
- **One position at a time** (the brief's wording; the live rule allows three): OOS −0.066R a position (n 45, month t −0.31),
  IS −0.172R (n 49), replication +0.053R (n 145). Worse, not better.
- Exits: 229 stops, 102 trailing stops, 69 time exits, no 10R target reached; 77 orders expired (zone failed or 20 days), 24
  missed (fill and target in one candle). No position was open at the end of the data.

## Assumptions, said plainly

- The demo broker's `ctrader/symbols.json` holds no XAGUSD symbol, so the round trip is the repository's stated silver figure
  (0.10 % of price, `trend-breadth`), not a measured spread and commission; financing is the `trend-breadth` assumption for a
  non-gold long (0.015 % a night), not a measured swap. At zero cost the verdict would still fail (in sample −0.082R; OOS
  month t well under 2).
- The buffer scale ($0.30 to $0.004) is `gold-drd-silver`'s; prices at 4 decimals.

## To repeat

`node --use-env-proxy research/edge/geg-silver/fetch.mjs <dir>` (candles out of git, about 35 MB), then
`node research/edge/geg-silver/run.mjs <dir> > research/edge/geg-silver/result.json` (about a minute).
Test: `tests/geg-silver.test.mjs`.

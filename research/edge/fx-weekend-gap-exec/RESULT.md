# Result: the forex Sunday-gap fade at the demo's measured spreads (20 Nov 2026)

**Verdict: FAIL on the pre-registered bar. Rule G (frozen) on 18 pairs, weeks from 24 Nov 2023 to 13 Nov 2026, at the demo broker's measured spreads: +0.165R a trade net (n 251, per-trade t 3.07, month t 1.52 over 29 months; the bar is 2), +0.128R with 0.5 pip of slippage a side. The reopen is expensive on this account: the quoted spread at the entry minute is 10.9 pips (median; 90th percentile 17.55), and a round trip costs 6.2 pips (median) against the 2.3 the studies assumed. On 237 of 488 weekends the broker had no quote yet at the entry minute, so the trade could not be placed as the rule says.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any reopen quote was read). Trades: `trades.json`, Rule G of `fx-weekend-gap-replicate2/frozen.mjs` (byte for byte, imported) on OANDA mid M5 of the 18 pairs; the moments read: `marks.json`. Quotes: council-data `research/probe/ticks-<PAIR>.json` (commit 5949b854), the demo broker's own last bid and ask at or before each mark and the median quoted spread in ±60 s. Nothing live changed.

## What the measurement showed

- **The entry minute is the most expensive of the week.** At the close of the first M5 candle after the Sunday reopen, the demo quotes a median 10.9 pips (90th percentile 17.55, max 20). The exit, on Monday, is cheap. Half of each plus commission: 6.2 pips median, 10.1 at the 90th percentile.
- **The broker opens later than OANDA's candles.** On 237 of the 488 trades there was no demo quote at or within 60 seconds before the entry mark (Sunday 21:05 or 22:05 UTC: 174 and 63 cases); 20 of them also lacked one at the exit. Those trades are dropped, as pre-registered. The 251 kept are the weekends on which this broker was already quoting 5 minutes after the reopen, which is not a random half.

## The result

| Group | n | Gross R | Net R | Per-trade t | Month t | Won |
|---|---|---|---|---|---|---|
| All 18 pairs | 251 | +0.377 | +0.165 | 3.07 | 1.52 | 66% |
| Stress (+0.5 pip a side) | 251 | +0.377 | +0.128 | 2.39 | 1.19 | 66% |
| #880's majors | 106 | +0.297 | +0.186 | 2.23 | 1.39 | 64% |
| #928's crosses | 75 | +0.595 | +0.247 | 2.81 | 2.21 | 72% |
| #938's S2 pairs | 70 | +0.263 | +0.043 | 0.39 | 0.30 | 63% |

Per pair (n, net R) in result.json `byPair`.

## What it means

- The fade stays positive after the real reopen spread on the weekends it can be placed, but it does not reach the pre-registered month t of 2 over these three years, and the S2 pairs, which carried #938's pass, net about zero here.
- The rule as written needs a quote 5 minutes after the reopen; on this broker that quote often does not exist yet, and when it does the spread is around 11 pips. A version entered later (Rule H, after the first hour) would meet normal spreads, but that is another rule, already tested (#880: Rule H failed), and choosing it now would be a choice made after this result.
- Not an edge to trade on this account. The years here were read by the earlier studies; this study adds only the cost and the broker's opening time.

To repeat: `node research/edge/fx-weekend-gap-exec/run.mjs marks <fxDir>` (OANDA mid M5 of the 18 pairs from September 2023, kept out of git) and `node research/edge/fx-weekend-gap-exec/run.mjs report <dir with ticks-<PAIR>.json> [commit]`.

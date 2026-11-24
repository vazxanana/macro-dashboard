# Big-candle fade at the demo broker's measured hourly spreads (pre-registration)

Written 24 Nov 2026, committed and pushed alone before any run. Paper research only: nothing live changes, no rule is proposed.

## Question

The Equinox desk "Big-candle fade" is `big-candle-fade` cell **m15 k1.5 nobreak half** (fade a closed M15 candle whose body is
over 1.5 x ATR(14) of the 14 candles before it and which broke no structure the same way; market entry against it at the next
5-minute open; stop past its extreme + 0.1 ATR; target its 50 %, only when that is 1R or more away; out after one day). It passed
before costs (+0.193R a trade 2015-26, n 54,443) and lost after the study's flat costs (-0.246R; `combo-grid-2` `COSTS`, ASSUMED on
five markets). `fade-cost-floor` and `bigfade-htf` did not re-cost it at measured spreads. Question: at the demo broker's MEASURED
spread by UTC hour plus its commission, is it positive after costs?

## Measured spreads available (checked before writing this, nothing else read)

council-data `research/probe/ticks-<SYMBOL>.json` `hourProfile` with data (n > 0) exists in the file history for **gold**
(XAUUSD, commit 0459ec37e2, 44 readings an hour, 14-36 at 21-23 UTC) and **silver** (XAGUSD, commit 19c2477d5b). Every other
market of the ten has an empty `hourProfile`. **USD/JPY** has a measured spread by UTC hour of another kind: the median of the
broker's bid / ask at `fade-tick-exec`'s fills and exits (`research/edge/fade-late-hourcost/profile.json`, 53-144 readings an hour);
it is used, said so. Commission: council-data `ctrader/symbols.json` `commissionRT` (round trip, share of price) at commit
853060f780: gold 0.000024, silver 0.000024, USD/JPY 0.000045.

## Trades

`big-candle-fade`'s own `signals()` and `trade()` (imported, not edited) on OANDA mid 5-minute candles (`edgekit`, the cached
copy), the cell's filter as `council/edge-desks-2.mjs` `bigTrades` (tf M15, kmax >= k1.5, brk false, half >= 1R), the study's
skips (data exclusions; risk under `COSTS[market]` = the study's "small" skip, kept so the trade set is the cell's), exit by the
study's `exits()`; the exit time and kind (stop / target / time) from a single-target walk that must equal `exits()`'s R for
every trade. Fills 2005-01-01 to 2026-10-31. Gate: the ten-market pooled n and mean R before costs per window equal
`big-candle-fade` result.json (47,354 / +0.307; 54,443 / +0.193) within 0.5 % on n and 0.005R; else INCONCLUSIVE.

## Cost a trade (share of price x fill, in R)

0.5 x spread(entry UTC hour) + 0.5 x spread(exit UTC hour) + commission; on a stop exit another 0.5 x spread(exit hour)
(slippage), as `fade-late-hourcost`. Spreads are the median (share of price) of the hour. Applied to every year at today's
relative spread (past spreads unknown).

## Tests (4), judged AFTER measured costs

- T1 gold, T2 silver, T3 USD/JPY, T4 the three pooled.
- Discovery 2005-01 .. 2014-12, confirmation 2015-01 .. 2026-10 (the parent study's windows).
- A test passes when: n >= 200 in confirmation; mean R after cost > 0 in BOTH windows; month-sum t >= 2 in confirmation
  (calendar months, empty months 0); Holm-adjusted one-sided p (from that t) < 0.05 over the 4 tests; mean R at 2 x the
  measured cost >= 0 in confirmation.
- Verdict: PASS if any test passes (naming which), else FAIL. Gate failure: INCONCLUSIVE.

## Control and reported-only rows

- Control: the mirror (the same trade WITH the candle, `exits()` mirror) at the same measured cost; reported beside each test.
- Sensitivity, not judged: the 90th percentile spread of each hour; halves 2015-19 / 2020-26.
- The seven markets without a measured profile (eurusd, gbpusd, audusd, nzdusd, usdcad, usdchf, eurjpy) are reported apart,
  never in the verdict: before costs, after the study's flat `COSTS`, and at commission only (a floor no real spread is below).

## Limits stated now

OANDA mid candles, not fills (`fade-tick-exec`: real fills about 0.02R worse on a similar fade); spreads measured on 2023-26
quotes (gold / silver: the first two minutes of each hour, last 60 weekdays); a PASS would be a hypothesis for a forward paper
record, never an edge, and these years were read by the parent study.

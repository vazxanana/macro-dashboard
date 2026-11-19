# Soybean short, frozen robustness checks: pre-registration

Written and committed **before** any new figure was computed (14 Nov 2026). The only figures known when this was written are
the published ones of `research/edge/grain-seasonality` (PR #934, branch `grain-seasonality`, commits b0848cd6 and dde599ff).
Nothing below changes after a result is seen; anything added later is labelled post-hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config, market list or council member changes. Whatever the outcome,
the soybean short is **never called an edge**: at most it stays a candidate paper shadow for the owner to decide on.

## What is checked

grain-seasonality passed its bar on one test of three: **T2, short soybeans** (OANDA CFD `soybn`, council-data
`research/daily/soybn.json`) from the open of the first trading day of July to the close of the last trading day of
September, fixed stop at entry + 3 x ATR(20), base costs (0.20 % round trip, financing 3 % a year on the short). Published:
2016-26 mean net R +0.520 a year (8 of 11 years won, permutation p 0.01195, Holm 0.03585), 2003-15 +1.186 (7 of 13, p 0.00067).
The evidence is thin (11 decisive years, per-year t 1.38) and the pattern has been in print for decades. These checks ask
whether the result is a knife-edge of the exact dates, the exact stop or the data source. **The rule is frozen**: nothing of
it is tuned, and no variant below is a new candidate.

## The frozen code

`frozen.mjs` is that study's `run.mjs` copied byte for byte (sha256
`e9ba1c2776dacb6df7f2759ea4f7caa5644e156cca7d51308438cccc90b80159`, pinned by the test). `run.mjs` here imports its functions
(`prep`, `atrBefore`, `windowOf`, `trade`, `runTest`, `summarize`, `P`, `TESTS`) and never edits them. The only change of
behaviour used is R2's stop multiple, set through the frozen `P.K` for one run and put back in `finally`.

## Gate (first, before any check)

The frozen code, run on the same candle file (`git show origin/council-data:research/daily/soybn.json`), must reproduce the
published T2 figures **exactly** (as rounded in its `result.json`): decisive n 11, won 8, mean net R 0.520, permutation p
(base) 0.01195; replication n 13, won 7, mean net R 1.186, p 0.00067. If any differs, the checks are not run and the result
is "gate failed".

## The checks (all at base costs; per-year tables reported for every variant)

- **R1, entry-date wobble.** For each year, [i0, i1] = the frozen `windowOf(B, year, 7)` (first weekday candle of July, last
  of September). The variant enters at the open of candle i0 + s and exits at the close of candle i1 + s, same frozen `trade`
  (its stop = 3 x ATR(20) of the 20 candles before the new entry), for **s = -10, -5, +5, +10** trading days (weekday
  candles). A year counts when i0 + s >= 21 and i1 + s lies inside the data. Reported for 2016-26 and 2003-15: n, years won,
  mean gross and net R, per-year t. **Bar: all four variants have mean net R above 0 on 2016-26.** A robustness bar, not a
  new test: no p values, no Holm.
- **R2, stop wobble.** The base window with the stop at **2 x** and **4 x** ATR(20) instead of 3 x (costs in R of that
  stop). **Bar: both have mean net R above 0 on 2016-26.**
- **R3, crop-year conditioning (descriptive only).** For each year, the April-June move = close of the last weekday candle of
  June / open of the first weekday candle of April - 1 (from the frozen `windowOf(B, year, 4)`). Years are split into
  "rose" (move > 0) and "fell" (move <= 0); the base trade's net R is reported per half, for 2016-26 and 2003-15. No pass or
  fail: each half holds about 5-7 years, far too few to say anything; it is shown only so the owner sees whether the result
  leans on one kind of year.
- **R4, an independent bar.** The same window, stop and base costs on daily candles of soybean futures from a second source
  that is not OANDA, reachable without a key from the build sandbox. Sources in this order; the first that answers with
  daily candles covering at least 8 of the 11 decisive years is used: (1) the stooq daily CSV `zs.f`; (2) the Yahoo chart
  API `ZS=F`; (3) CNBC's bar service (`ts-api.cnbc.com`, the one `ict/tracker.mjs` reads), the continuous front-month
  soybean symbol `@S.1`, daily bars. When this was written, (1) and (2) were refused by the sandbox's network proxy (a
  connection check only; no price was read). A source's candles are used as they are (continuous front month, unadjusted:
  a roll gap counts as price movement, as in the main study), each daily candle placed at 00:00 UTC of its trading date,
  then the frozen `prep` / `windowOf` / `trade`. **Agreement: mean net R above 0 on the 2016-26 years it covers.** The years
  covered and a per-year comparison with the CFD are reported. If no source qualifies, R4 is reported as skipped with the
  reason; **no data is invented or reconstructed**.

## Verdict (wording fixed now)

- **ROBUST** if every R1 variant and both R2 variants have mean net R above 0 on 2016-26, and R4 agrees when it is
  available (R4 skipped does not block ROBUST, and is said beside the verdict).
- **FRAGILE** otherwise (any R1 or R2 variant at or below 0, or R4 available and at or below 0).
- Either way: n is 11 years, the pattern is long published, and the soybean short is not an edge. ROBUST only means the
  published pass is not a knife-edge of the dates, the stop or the feed; it leaves it a candidate paper shadow for the owner.

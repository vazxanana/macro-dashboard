# Rule G on a second feed with bid / ask fills, and the real Sunday-reopen spread (Dukascopy). Pre-registration

Written and committed **alone** (14 Nov 2026) before `frozen.mjs`, `run.mjs` or any measurement code exists in this folder,
and before any price, spread or return of the data below was read. The one thing done before this file is the **coverage
probe** the brief asks for first (step 1 below): it asks whether the files can be fetched at all and reads no price. Its
outcome is recorded here, in "Coverage probe (done before this file)". Everything else below is fixed here; anything added
later is labelled post hoc in `RESULT.md`.

Paper research only. Nothing here trades, and no live rule, size, filter, stop, config, cost constant, `api/` file, council
member or mirror setting changes, whatever the outcome. Even a PASS leads at most to one written proposal for the owner (a
paper shadow stream); anything else leads to nothing. Never call anything an edge without n and t.

## Why

The forex Sunday-gap fade **Rule G** (`research/edge/fx-weekend-gap`, #880, branch `fx-weekend-gap`; frozen replications
`fx-weekend-gap-replicate` #928 and `fx-weekend-gap-replicate2` #938) is the strongest forex lead on file: its three
headline tests made +0.194R (n 243, monthly t 2.14), +0.238R (n 294, monthly t 2.99) and +0.153R (n 481, monthly t 3.19) a
trade after an ASSUMED cost. It trades at the close of the first M5 candle after Sunday 17:00 New York, the widest-spread
minute of the forex week. `research/edge/weekend-reopen-cost` (#944, branch `weekend-reopen-cost`) found that spread **NOT
MEASURABLE** from the sources on file: the site's candle proxy serves OANDA mid only, and the demo broker's quote file holds
one Sunday. All three studies ran on one feed (OANDA mid M5).

Dukascopy publishes free historical BID and ASK minute candles and ticks. This study would use them for (A) the real
ask-minus-bid spread at Rule G's entry minute, Sunday by Sunday, and (B) Rule G rerun on a second, independent feed with
bid / ask fills.

## Coverage probe (done before this file; no prices read)

Run 14 Nov 2026 from this build sandbox, `node --use-env-proxy` (Node fetch through the session's egress proxy) and `curl`
through the same proxy, on these files (the URL scheme of `council/duka.mjs`, months 0-based):
`datafeed.dukascopy.com/datafeed/<SYM>/<yyyy>/<mm>/<dd>/{BID,ASK}_candles_min_1.bi5` (EURUSD 2024-03-10, EURUSD 2012-02-08,
USDJPY and AUDNZD 2024-03-10), the hour tick file `…/EURUSD/2024/02/10/22h_ticks.bi5`, the same path on `www.dukascopy.com`,
plain `http://` and `freeserv.dukascopy.com` (the chart JSON service).

**Result: no file reachable.** Every `https` request was refused by the egress proxy before reaching Dukascopy
(`CONNECT tunnel failed, response 403`; the proxy's status page logs `connect_rejected` for `datafeed.dukascopy.com:443`:
"the host is not allowed for this session"); plain `http` does not resolve inside the sandbox (`ENOTFOUND`). No bid, ask or
tick byte was received, for any pair or year.

Also looked for, without the network: a Dukascopy forex bid / ask file anywhere in the repository, in the `council-data`
branch, or on this machine. None: council-data holds only two Dukascopy NQ candle files (`research/candles/nq-duka-*`) and
two probe logs; `council/duka.mjs` reads and caches BID files only and its cache (`DUKA_CACHE`) is not on this machine.

So, by the brief's own step 2, **the study stops here**: `RESULT.md` will carry the verdict
**NOT MEASURABLE (inconclusive: Dukascopy is not reachable from this runner)**, with no spread, no return and no placebo
figure. The method below is fixed anyway, so that a runner that can reach Dukascopy runs exactly this, unchanged, with this
file as its pre-registration (a later run must say in its RESULT.md that the probe passed there, and on which date).

## The frozen code

- `frozen.mjs` = #880's `research/edge/fx-weekend-gap/run.mjs` **byte for byte** (read with
  `git show origin/fx-weekend-gap:research/edge/fx-weekend-gap/run.mjs`, never imported across branches), sha256
  `3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273` (the file #928, #938 and #944 also copied), pinned by
  the test; never edited. Its `weeks`, `nyDays`, `atrAt`, `ruleG`, `pipOf`, `K`, `stats`, `tOf`, `normP`, `mulberry`,
  `lowerT` are used as they are. Rule H is not tested.

## Data (would be read; kept outside git, e.g. /tmp)

- Dukascopy BID and ASK **M1 candles**, one file per UTC day and side, `datafeed.dukascopy.com/datafeed/<SYM>/<yyyy>/<mm 0-based>/<dd>/{BID,ASK}_candles_min_1.bi5`,
  decoded by `council/duka.mjs` `decodeBi5` (imported, not edited; point 1e5, 1e3 for the JPY pairs). Timestamps are UTC
  (the file's day start + the row's seconds). Zero-volume rows are dropped (as `decodeBi5` does). No HistData clock applies.
- **Coverage gate per pair and side**: a pair is used only when both its BID and ASK minute files exist for at least 95 % of
  the Sundays (and the following Mondays) of each window; else that pair is reported as not covered and leaves every test
  (its set is then tested on the pairs left, said in RESULT.md).
- Range: 1 Nov 2009 (ATR warm-up) to the last complete Monday before the run. Weekdays and Sundays are needed (the ATR uses
  20 trading days), so whole weeks are fetched.
- **Mid candles** (the signal feed): per UTC minute present on both sides, mid open / high / low / close = (bid + ask) / 2
  of each field; a minute on one side only is dropped. M5 = the five M1 minutes of each 5-minute UTC bucket (open of the
  first, high max, low min, close of the last; a bucket needs at least one minute). Rows `[time, open, high, low, close]`,
  exactly the shape the frozen code reads. The BID M5 and ASK M5 are built the same way from each side alone.

## Pairs and windows (the union of the three headline tests)

| Set | Pairs (Dukascopy symbol) | From |
|---|---|---|
| **M** (#880 headline) | EURUSD, GBPUSD, USDJPY, AUDUSD, USDCHF, EURJPY | #880 |
| **X** (#928 R1) | EURGBP, GBPJPY, AUDJPY, EURAUD, GBPAUD, EURCHF | #928 |
| **N** (#938 S2) | NZDUSD, USDCAD, CADJPY, NZDJPY, AUDNZD, AUDCAD | #938 |

- **Decisive**: weeks whose Friday close time `F` is from 2016-01-01 to the end of the data (2016 to now, every set).
- **Replication**: weeks with `F` from 2010-01-01 to 2015-12-31.

## Measurement A (descriptive, not in the verdict)

For every pair and every Sunday on which the frozen `weeks()` finds a reopen candle on the mid feed (eligible or not): the
spread `ask − bid`, in pips (`pipOf`), of the **close** of the last M1 minute present at or before each of these moments,
with `S` = the start of the reopen M5 candle:

- `S + 5 min` (Rule G's entry: the reopen candle's close), `S + 35 min`, `S + 65 min`, `S + 125 min` (+30, +60, +120 min).

Per pair and calendar year of `F`, and per pair over each window: n, median, 75th and 95th percentile, and the share of
Sundays over 2, 5 and 10 pips. A pair-year with under 20 measured Sundays is shown but marked "too few". The same for the
Rule G entries only (eligible weeks that trade). This is the number #944 could not get. It is Dukascopy's spread (an ECN
feed), not the demo broker's; RESULT.md says so.

## Test B (primary): Rule G with bid / ask fills

- **Signals exactly as frozen, on mid**: the frozen `weeks()` and `ruleG()` run on the mid M5 candles (so `fc`, the gap,
  ATR, eligibility `0.25 ≤ |gap| / ATR ≤ 1.5`, the side, `r0 = |fc − entry_mid|`, the `filled` and `small` skips are the
  frozen definitions). Target level = `fc` (mid); stop level = `entry_mid − side × r0` (mid). The levels never change.
- **Fills on the side that trades**: entry at the reopen candle's close on the ASK for a buy, the BID for a sell. After the
  entry candle, on each M5 candle in order up to the last one ending at or before Monday 12:00 New York, on the EXIT side
  (BID candles for a buy, ASK candles for a sell): an open beyond the stop exits at that open; else a low (buy) / high
  (sell) reaching the stop exits at the stop level; else a high (buy) / low (sell) reaching the target exits at the target
  level; **stop first** when one candle holds both; else out at the exit side's close of the last candle (time exit). Every
  trade has its stop. Where an exit-side M5 candle is missing for a time the mid candle has, the trade is checked on the
  next one present (counted, reported).
- `R = side × (exitFill − entryFill) / r0` (the spread paid at both ends is inside R). **Net R** = R − cost / r0, with cost
  = the frozen model's slippage and commission and **no assumed spread**: `pip × 2 × 1` (1 pip slippage a side, frozen
  `K.SLIP_PIPS`) + `2 × 22.5e-6 × entryFill` (frozen `K.COMM_SIDE`). **Stress**: + 0.5 pip a side more (cost
  `pip × 2 × 1.5` + commission). Financing none (as #880; the frozen `nights` would be reported; a Sunday-to-Monday-noon
  hold crosses no weekday 22:00 UTC rollover).
- Statistics per set and window, pooled over the set's pairs: n, win rate, mean R, mean net R at base and stress, trade t,
  **t on calendar-month sums** of base net R (month of `F`; the frozen `stats`), total, worst closed drawdown, exit mix; per
  pair and per year (not in the bar). One-sided p of each set's decisive monthly-sum t (frozen `normP`).
- **Holm across the three sets** (M, X, N) on the decisive one-sided p: sorted p(1) ≤ p(2) ≤ p(3), adjusted
  p(1)' = 3 p(1), p(2)' = max(p(1)', 2 p(2)), p(3)' = max(p(2)', p(3)), each capped at 1.

**A set PASSES only if all hold:**

1. mean net R a trade > 0 at base cost on 2016 to now **and** on 2010-15;
2. its 2016-to-now monthly-sum t ≥ 2 **and** its Holm-adjusted p < 0.05;
3. mean net R a trade > 0 on 2016 to now at the stress cost (+0.5 pip a side);
4. n ≥ 80 on 2016 to now.

**Verdict**: **PASS** if at least one set passes (RESULT.md names which, and says whether the others did); **FAIL** if none
passes; **NOT MEASURABLE (inconclusive: …)** if the coverage probe fails or no set keeps a covered pair. A pass whose
decisive mean does not exceed its placebo 95th percentile (below) is reported as "PASS (not robust: inside the placebo band)".

## Feed check (descriptive, not in the verdict)

Against the frozen trade lists published in #880 (`result.json` `trades.G`, 2016 to now), #928 (R1 2020 to now, R2 majors
2010-15) and #938 (S1 crosses 2010-19, S2 2016 to now), matched by pair and Friday: how many OANDA trades also fire on
Dukascopy mid, with the same side; how many Dukascopy trades OANDA did not have; and on matched trades the correlation of
R (Dukascopy R at MID fills, i.e. the frozen `book` on the mid candles, against the published OANDA R), and the mean
difference. Disagreement is reported as a feed fact, not repaired.

## Placebo (not in the bar, decides "robust")

40 seeded runs (seeds 1-40, frozen `mulberry`) per set, decisive window: for each Rule G trade of the set, a **non-gap
Sunday** of the same pair is drawn at random (a week the frozen `weeks()` uses whose `|gap| / ATR` is under 0.25; without
replacement within a run while any is left), with a random side; entry at that reopen candle's close on the side's fill,
`r0` = the donor trade's `r0 / ATR` times that week's ATR, target `entry_mid + side × r0`, stop `entry_mid − side × r0`, the
same bid / ask exits, costs and Monday-noon cut. Reported: 5th / 50th / 95th percentile of the mean base net R and how many
runs did as well as Rule G.

## Files

`frozen.mjs` (byte copy, pinned), `run.mjs` (`node --use-env-proxy run.mjs probe` = the coverage probe; the measurement and
test only once the probe passes), `RESULT.md` (verdict line first), `result.json`, `tests/weekend-gap-duka.test.mjs`
(offline: the frozen hash, the fill and spread helpers on a small pinned fixture, RESULT.md against result.json).

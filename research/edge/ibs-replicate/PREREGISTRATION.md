# Pre-registration: the IBS daily reversal, frozen and replicated on seven other indices (14 Nov 2026)

Written and pushed alone, before any price of the new markets is read and before any number of this study is computed.
Research only, paper only: no rule, size, filter, stop, config, mirror setting or council member changes, whatever the
reading. Not an ICT study (`ict/calendar.mjs` is only read by the frozen code, for the New York clock of the gate).

## Why
`index-ibs` (#895, branch `index-ibs`, not on `main`) bought SPX500, NAS100 and US30 at the New York close when the close sat in
the bottom 20 % of the session's range (IBS < 0.2) and sold the next close. Verdict FAIL: pooled +0.020R a trade net on
2016-now (n 1,414, month-sum t 0.64); before costs +0.05 to +0.10R; SPX500 strong on 2005-15 (t 2.66) and faded since. The
futures-cost study (#900, branch `index-futures-cost`) re-costed it on CME micro futures and NAS100 met its bar there, but that
route was chosen after seeing the CFD result. The honest next step is a frozen replication: the same rule, its code unchanged,
on markets it was never run on.

## The frozen code and the gate
- `frozen.mjs` = #895's `research/edge/index-ibs/run.mjs` at commit `4053ff27a`, copied **byte for byte**; its sha256 is
  pinned in `tests/ibs-replicate.test.mjs`. `rates.json` (FRED DGS2 weekly, the stated 3.85 % before 2006) is #895's file,
  byte for byte. Nothing in either is edited.
- **Gate**: `frozen.mjs` `study()` + `verdictOf()`, run on #895's own three markets (OANDA mid H1 of spx500, nas100, us30,
  1 Jan 2004 to 14 Nov 2026, fetched with #895's own `fetch.mjs` through the site's keyless candle proxy, kept out of git),
  must reproduce #895's published `result.json` **exactly**: the pooled block (decisive, replication, placebo) and the
  three tests' decisive and replication blocks, deep-equal. If the gate fails, the new-market figures are still written but
  the reading is "gate failed: not interpreted", and nothing below is judged.

## New markets (fixed now; none was used by #895)
`de40` (DE30_EUR), `uk100` (UK100_GBP), `eu50` (EU50_EUR), `fr40` (FR40_EUR), `jp225` (JP225_USD), `au200` (AU200_AUD),
`hk33` (HK33_HKD). Data: OANDA mid **daily** candles from council-data `research/daily/<key>.json` (read with `git show`,
council-data commit `1fc946e73`, written 7 Nov 2026, last candle 6 Nov 2026). Before writing this file I read only the files'
structure (columns `[t, o, h, l, c, v]`, UTC midnight starts, row counts, first and last dates, how many candles fall on
each weekday: jp225 and au200 carry Sunday stubs, the others a handful of weekend rows); no price was looked at or computed on.

## The one necessary change: the day
The frozen `buildDays` builds the day from H1 candles of the New York cash session (09:00 to the 16:00 close) on the NYSE
calendar. Those candles are not in council-data for these markets, and the New York session is not these markets' day (it is
the night in Tokyo, Hong Kong and Sydney). So the new markets use their own **UTC daily candle** as the day, and everything
else is the frozen code:
- Saturday / Sunday candles are folded into the next weekday candle (its time and close; the first weekend open; high / low
  over all), the form of `council/fills.mjs` `foldWeekend` (imported from `main`). A trailing weekend candle is dropped.
- Day k: `hi` / `lo` / `close` = the folded candle's high, low, close; **IBS = (close - low) / (high - low)**, none when high <=
  low. The trading days are the candles on file; the "next trading day" is the next candle. A next candle more than 5 calendar
  days later (a data hole) = no trade, counted as skipped.
- The day's close time is the candle's end (start + 24 h), except a Friday candle, which closes at 21:00 UTC (the CFD's weekend
  close, before the 22:00 UTC rollover the frozen `nights` counts). `D[k].t` = close time - 3600, so the frozen `trade()` charges
  financing for exactly the rollovers between entry close and exit close (its `E.t + 3600` / `X.t + 3600`). `D[k].i` = the
  candle's index; the frozen stop loop then checks the next day's candle: an open at or below the stop fills at the open, else a
  low at or below it fills at the stop.
- Called unchanged from `frozen.mjs`: `trade`, `atrAt` (ATR(20) of the 20 days before, true range against the previous close),
  `nights` (Friday counts three), `finRate`, `rateOf`, `stats`, `monthT`, `monthsBetween`, `summ`, `holm`, `pOneSided`, `rng`,
  `pctile`, and the constants `LO` 0.2, `ATR_N`, `STOP_ATR`, `SEEDS` 40, `SEEDS_NEED` 38, `FIRST` 2005, `SPLIT` 2016.

## Rule (frozen)
IBS(d) < 0.2 → buy at close(d), sell at close(d+1) unless stopped; stop = entry - 1 x ATR(20). 1R = entry - stop. Net R =
(exit - entry - (cost + financing) x entry) / 1R.
- **Cost** (#895's CFD model): a round trip as a share of the entry price, **0.05 %** on every one of the seven (#895 charged
  0.04 % only on SPX500, the tightest CFD, and 0.05 % on NAS100 and US30; none of the seven is assumed cheaper than SPX500).
- **Financing** (#895's method, unchanged): long (DGS2 + 2.5 %) / 365 a rollover night at 22:00 UTC Monday-Friday, Friday
  three, DGS2 = the last weekly value on or before the entry date. The US rate is used for every market (the local
  overnight rates are not on file; EUR, JPY, HKD, AUD and GBP rates were mostly at or below the US rate, so this overstates
  the charge for most of the sample: conservative). Stated, not changed after the results.

## Windows (by entry date)
Decisive: 1 Jan 2016 to the last close on file. Replication: 1 Jan 2005 to 31 Dec 2015. 2003-04 is warm-up.

## Tests
- **R1**: the seven markets' decisive trades pooled (every trade 1R): mean net R a trade; t = the frozen month-sum t (every
  calendar month from Jan 2016 to the last day's month, an empty month 0); one-sided p (normal approximation, `pOneSided`).
- **R2**: the same pool on 2005-2015: mean net R a trade (month-sum t reported).
- **R3**: R1 counted by entry day: one observation per UTC date on which at least one market fired, = the mean net R of the
  markets that fired that day; t = mean / (sd / sqrt(days)); one-sided p (normal approximation).
- **Holm** over the two p values of R1 and R3.

## Pre-registered reading
- **"REPLICATES"**: R1 and R3 have mean net R > 0 with Holm p < 0.05, and R2 mean net R > 0.
- **"PARTLY"**: not the above, and R1 mean net R > 0 with month-sum t >= 1.
- **"DOES NOT REPLICATE"**: otherwise.

## Reported, judged by nothing
- **Placebo**: 40 seeds (1 to 40), per market and calendar year as many random decisive-window days as the rule traded, drawn
  from the days that are not a rule entry and trade (close, next close, ATR), traded exactly like the rule (#895's method, its
  `rng`); pooled; how many seed means the rule's R1 mean beats, and the 5th / 50th / 95th percentile.
- **2x cost**: R1, R2, R3 with the round trip doubled (0.10 %), financing unchanged.
- **Half cost**: R1, R2, R3 with the round trip halved (0.025 %), financing unchanged, as a stand-in for a cheaper futures
  route. Descriptive only: it decides nothing (a route picked after a result is not evidence).
- Per market: n, gross / net R, month-sum t on both windows; by year; the rule's days against every day before costs; skipped
  signals and days without IBS.

## After
`frozen.mjs`, `run.mjs`, `rates.json`, `result.json`, `RESULT.md` (with a Verdict line in the words above),
`tests/ibs-replicate.test.mjs` (offline). No proposal whatever the reading: at most a forward paper shadow for the owner to
consider, never a live rule.

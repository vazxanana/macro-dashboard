# Pre-registration: Turnaround Tuesday on the index CFDs neither study used (14 Nov 2026)

Written and pushed alone, before any return, trade or price change of this study's markets is computed. Before writing it,
only these were read: (a) the gate (#862's own study on #862's six markets through its frozen run file: #862's published
figures, not this study's); (b) per candidate market, the first and last candle dates and the COUNT of local trading days
that have a cash-close candle (no price, no return). Research only: no rule, size, filter, stop, config or council member
changes, and no proposal follows whatever the verdict. Not an ICT study.

## Why
`turnaround-tuesday` (branch, PR #857) passed one cell of four: NAS100 R2 (the week's first session down more than 1 % close
to close → buy that close, sell the next session's close, stop 2 x ATR(20)): 2016-now +0.098R a trade net, t 2.33, n 81.
`turnaround-replicate` (#862) ran the frozen rule on US30, US2000, DE40, EU50, UK100, JP225 and failed its bar (pool n 411,
+0.052R, trade t 2.63, month-sum t 1.69). `turnaround-early-years` found the years before 2008 NOT MEASURABLE (index candles
start March 2003). The remaining clean check: the same frozen rule on the OANDA index CFDs that neither study used.

## The rule, frozen
- `frozen.mjs` = `research/edge/turnaround-tuesday/run.mjs` of branch `turnaround-tuesday`, byte for byte, sha256
  `74527d362f9d65c996cdd4df25abadbbc6b723b9aa49141d6a29c88b19693871`.
- `replicate.mjs` = `research/edge/turnaround-replicate/run.mjs` of branch `turnaround-replicate`, byte for byte, sha256
  `61cb6424546a299e3fd8f626c72a1f2cc0ec1f57a422bc438e2a9d4c263d4b18`. Both pinned by the test, never edited.
- `run.mjs` uses their functions as they are (`weekPairs`, `dayChg`, `ruleOn` with R2's -1 %, `trade`, `atrAt`, `stats`,
  `holm`, `rng`, `rateOf`; `buildDaysAt`, `placeboDraw`, `summ`, `monthT`) and adds only each new market's local calendar,
  cash close, cost and rate. Its `marketRun` is #862's `marketRun` with the calendar and close lookups swapped (it also keeps
  the step-5 placebo pool).

## Gate (run before this file was written; it passed)
#862's `study()` from `replicate.mjs` on #862's six markets (fetched again with this folder's `fetch.mjs`, the #862 fetch with
the market list as an environment variable) and #862's `rates.json` reproduces #862's published pool exactly: 2016-now n 411,
net +0.052R a trade, trade t 2.63, month-sum t 1.69 over 131 months, and every market's n and net R (US30 55 / +0.018, US2000
93 / +0.061, DE40 64 / +0.054, EU50 74 / +0.024, UK100 50 / +0.036, JP225 75 / +0.103). `run.mjs` re-runs it and a miss makes
the verdict NOT MEASURABLE (gate).

## The unused set (fixed now)
Every OANDA index CFD key in `api/_oanda.js`: `nas100 spx500` (#857), `us30 us2000 de40 eu50 uk100 jp225` (#862), and nine
unused: `fr40 nl25 es35 ch20 au200 hk33 cn50 sg30 in50`. OANDA mid H1 via the candle proxy (`fetch.mjs`, 1 Oct 2007 to
12 Nov 2026, kept out of git; the council-data daily cache is not used, it has no intraday close).

A candidate **qualifies** when (counts only) its candles start by 1 Jan 2017, run to at least 1 Oct 2026, and a cash-close
candle exists on at least 90 % of its local trading days from 2016 (or its first candle) to its last candle. Read before
writing this:

| Market (key, instrument) | Local calendar | Cash close (half day) | candles | close candles 2016-now | 2008-15 | Qualifies |
|---|---|---|---|---|---|---|
| France 40 (`fr40`, FR40_EUR) | Euronext = TARGET days (`TAR`) | 17:30 Paris (14:05 on 24 and 31 Dec) | 2007-10-01 → 2026-11-12 | 2,773 of 2,782 | 2,044 of 2,049 | yes |
| Netherlands 25 (`nl25`, NL25_EUR) | Euronext (`TAR`) | 17:30 Amsterdam (14:05 on 24 and 31 Dec) | 2008-01-18 → | 2,771 of 2,782 | 2,032 of 2,049 | yes |
| Spain 35 (`es35`, ESPIX_EUR) | BME (`XMAD`) | 17:30 Madrid (14:00 on its half days) | 2016-12-01 → | 2,518 of 2,546 | 0 | yes |
| Switzerland 20 (`ch20`, CH20_CHF) | SIX (`XSWX`) | 17:30 Zurich | 2007-10-01 → | 2,724 of 2,732 | 2,008 of 2,009 | yes |
| Australia 200 (`au200`, AU200_AUD) | ASX (`XASX`) | 16:00 Sydney (14:10 on its half days) | 2007-10-01 → | 2,751 of 2,751 | 1,779 of 2,026 | yes |
| Hong Kong 33 (`hk33`, HK33_HKD) | HKEX (`XHKG`, defined from 2014) | 16:00 Hong Kong (12:00 on its half days) | 2007-10-02 → | 2,666 of 2,672 | 492 of 494 (2014-15 only) | yes |
| China A50 (`cn50`, CN50_USD) | Shanghai (`XSHG`) | 15:00 Shanghai | 2011-08-29 → | 2,626 of 2,637 | 1,052 of 1,946 | yes |
| Singapore 30 (`sg30`, SG30_SGD) | SGX (`XSES`) | 17:00 Singapore (12:00 on its half days) | 2007-10-01 → | 2,728 of 2,728 | 1,778 of 2,007 | yes |
| India 50 (`in50`, IN50_USD) | NSE (`XNSE`) | 15:30 India | 2011-08-25 → **2022-07-12** | 1,347 of 1,612 | 0 | **no**: candles end July 2022, closes on 83.6 % |

**Eight markets qualify**: FR40, NL25, ES35, CH20, AU200, HK33, CN50, SG30. IN50 is excluded (the proxy serves no candle
after 12 Jul 2022). Three or more qualify, so the study runs; with fewer than 3 it would stop as NOT MEASURABLE.

- **Close**: the last H1 candle that ENDS at or before the local cash close (`closeCandleAt`; for a 17:30 close the candle
  ending 17:00, as #862 did for DE40 / EU50; India's 15:30 is the candle ending 10:00 UTC), local time and daylight saving read
  with `Intl` for the zone named. A day without that candle has no close (frozen behaviour: a trade needing it is skipped).
- **Calendars** (`holidays.json`, written once by `holidays.py` from the PyPI package `holidays` version 0.108, financial
  calendars, closed days and half days; committed so the test runs offline): weekdays not listed as closed are trading days.
  Euronext's half days are 24 and 31 Dec (stated rule; the package has none for TARGET). The package defines HKEX (`XHKG`)
  from 2014 only, so HK33's days start 1 Jan 2014: its 2008-13 trades are not computed (reported window only; the decisive
  window is whole).
- **Costs** (assumed, not measured: no rate for these markets exists in the repository; a round trip as a share of the entry
  price, #862's model): FR40 0.05 %, NL25 0.08 %, ES35 0.08 %, CH20 0.06 %, AU200 0.06 %, HK33 0.08 %, CN50 0.10 %, SG30
  0.10 %. The 2x-cost line is reported for every figure.
- **Financing** (#862's model: one charge per calendar night at (rate + 2.5 %) / 365, the frozen `trade`, a negative rate
  floored at 0): EUR markets #862's yearly euro rates (`RATES.eur` of `replicate.mjs`); HK33 (HKD pegged to the dollar),
  CN50 and IN50 (USD instruments) the US 2-year (DGS2, #862's `rates.json`); CH20, AU200, SG30 a stated yearly mean policy /
  overnight rate (SNB, RBA cash rate, SORA; `RATES` in `run.mjs`). One night is about 0.01R: a point of rate error moves a
  trade by under 0.002R.

## Windows (fixed now)
- **Decisive: entries from 1 Jan 2016 to 12 Nov 2026.**
- Replication: entries 2008-2015, reported only (ES35 has none; HK33 from 2014; AU200, SG30 and CN50 have gaps where the
  proxy has no Asian-hours candle).

## Primary test: #862's bar, verbatim (pooled book, decisive window)
Equal risk, every trade 1R:
- **P1**: all qualifying markets' trades together; mean net R a trade > 0 AND the t of the calendar-month sums >= 2 (every
  month January 2016 to November 2026, a month without a trade counts 0, a trade in its entry month; t = mean / (sd / sqrt
  months)).
- **P2, breadth**: at least two thirds of the markets (#862: 4 of 6; here ceil(2 x 8 / 3) = **6 of 8**) with mean net R > 0.
- **P3, placebo of random down days** (#862's own): 40 seeds (1-40), per seed, market (table order) and year as many days as
  that market traded that year, drawn uniformly with replacement from the local trading days down more than 1 % that are not
  an entry day of the rule and have a next trading day, each traded like the rule. Holds when the pool's mean net R beats the
  seed's pooled mean in at least 38 of 40 seeds.
- **Verdict REPLICATES** when P1, P2 and P3 all hold; otherwise **DOES NOT REPLICATE**. **NOT MEASURABLE** (with
  "(inconclusive: …)") only on a gate miss or fewer than 3 qualifying markets.

## Secondary (reported, not judged)
- Per market: n, net R, trade t, one-sided p and Holm over the 8; gross R, win rate, stops, skipped trades.
- The 2008-15 window: per market and pooled (month-sum t over 2008-01 to 2015-12).
- Costs: before costs and financing (gross R), base, 2x the stated round trip; for the pool and each market.
- Worst closed drawdown in R (trades in exit order), pool and each market, decisive window.
- **Step-5 placebo of random weekdays**: 40 seeds (1-40, `rng(seed)`), per seed, market and year as many days as the rule
  traded, drawn uniformly with replacement from the local trading days that are NOT the week's first trading day (the rule's
  day) and have a next trading day, any direction, each traded like the rule (buy the close, sell the next trading day's
  close, the same stop, costs and financing). Reported: seeds beaten (of 40) and the median seed.
- **Fisher, as `multiple-testing-update` defines it** (one-sided p = 1 - Phi(t); -2 sum ln p on 2k degrees of freedom;
  calendar-disjoint = cells on years the original never used; cells on the same years and other instruments are an upper
  bound only): #857 R2 (t 2.33), #862 pooled (month t 1.69), this study pooled (its month-sum t). All three share the
  2016-now years, so **no calendar-disjoint combination exists** (stated, not computed); the instrument-disjoint "all cells"
  Fisher is reported as the upper bound it is, with #857 + this study alone beside it.

## Verdict wording
REPLICATES / DOES NOT REPLICATE / NOT MEASURABLE (inconclusive: …). Never an edge without n and t.

## After
`run.mjs`, `result.json`, `RESULT.md` (verdict first), `tests/turnaround-unused-markets.test.mjs` (offline), rebuilt `out/`.

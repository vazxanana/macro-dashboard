# Gotobi early years: the frozen T2 fade on yen pair-years no gotobi study has used (pre-registration)

Written and pushed alone on 14 Nov 2026, before `run.mjs` exists and before any trade, return or price move of the data named
below was computed. Only data coverage was looked at (which candles the proxy serves, step 3 below). Nothing below may change
after the first result; anything found later is reported as found later, never folded into the verdict. Paper research only:
no live rule, size, filter, stop, config, council member or mirror setting changes, whatever the result.

## Why

The gotobi fade (`research/edge/gotobi`, PR #878, rule T2: on gotobi days sell USD/JPY at 00:55 UTC, the 09:55 Tokyo fix, and
buy back at 06:00 UTC; 2016-now n 771, +0.148R a trade net, month t 2.74) is the only hypothesis left standing after the
multiple-testing ledger (`research/edge/multiple-testing-update`, branch `multiple-testing-update`: calendar-disjoint Fisher
p 3.6e-6 with `gotobi-replicate` R2, USD/JPY 2005-09). A further replication on data no gotobi study has used is the most
useful check left of whether it is real.

## Every pair-year the gotobi studies used (read from their pre-registrations and results)

| Study (branch) | Data | Pair-years used |
|---|---|---|
| `gotobi` (#878) | OANDA mid M5 | USD/JPY and EUR/JPY 2010-01 to 2026-11-11 (2009-11/12 as lookback) |
| `gotobi-replicate` (#889) | OANDA mid M5 | GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY 2010-01 to 2026-11-11; USD/JPY 2005-01 to 2009-12 (R2) |
| `gotobi-feed` (#894) | HistData M1 (council-data) + OANDA M5 | USD/JPY 2018-01 to 2026-10 (HistData), 2017-11 to 2026-11 (OANDA) |
| `gotobi-timing` (#908), `gotobi-minute-histdata` (#912), `gotobi-limit-entry` (#915) | OANDA M1 / HistData M1 | USD/JPY, inside 2010-2026 |
| `gotobi-cost` (#893) | the files of #878 / #889 | the same pair-years (re-costed) |
| `tokyo-fix-daily` (#917) | OANDA M1 | USD/JPY 2010-2026 |
| `gotobi-duka-spread` | Dukascopy | none (no file could be read) |
| `multiple-testing-update` | stored results only | none |

So **every USD/JPY day from 2005-01 to 2026-11 has been used**, on OANDA and (2018 on) on HistData, and EUR/JPY, GBP/JPY,
AUD/JPY, CAD/JPY and CHF/JPY are used from 2010-01. NZD/JPY was never used by any gotobi study.

## Coverage, looked at before any return (step 3)

- **USD/JPY before 2005 on OANDA**: the proxy (`/md/bars?sym=usdjpy&tf=5m`) returns, for 2002-2004, one stub candle a day at
  20:55 UTC (volume 1-2) and nothing at 00:55 or 06:00 UTC; 2001 returns nothing. **The fade cannot be computed on USD/JPY
  before 2005.**
- **HistData in council-data** (`research/candles/USDJPY/`): USD/JPY M1 2018 to October 2026 only, all used by #894 / #912. No
  yen cross is in council-data's HistData folders.
- **Yen crosses on OANDA M5 from 2005**: EUR/JPY, GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY and NZD/JPY each return a full day of
  288 M5 candles from 00:00 UTC on test days in January 2005, June 2005 and June 2007 (the counts only; no price was read).
- Dukascopy is not reachable from this sandbox (`gotobi-duka-spread`) and is not tried.

**The unused set, therefore:**

1. **Primary set U**: the six yen crosses EUR/JPY, GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY, NZD/JPY, OANDA mid M5, trade days
   from the first day with a frozen stop distance (data are fetched from 2004-12-01; the first candle on file is stated) to
   **2009-12-31**. Thirty pair-years (six crosses x five years) that no gotobi study has used.
2. **Supporting set N** (reported, never in the verdict or in Fisher): NZD/JPY 2010-01-01 to 2026-11-11, a pair no gotobi
   study used, on calendar years the original and #889 R1 did use.

**What U is not, said before the result**: U shares its calendar days (2005-09) with #889 R2 (USD/JPY 2005-09), and #889
measured that a cross's gotobi-day net R correlates 0.5-0.8 with USD/JPY's on the same day (one yen flow). So U is a
replication on unused pair-years, **not on unused calendar years**: no calendar year with computable USD/JPY intraday data is
left unused. U is about five calendar years on six crosses, above the "about three years of USD/JPY or equivalent" floor that
would make the study NOT MEASURABLE; if fewer than 3 crosses have at least 3 years of trades on file, or the pooled U has
fewer than 400 trades, the verdict is NOT MEASURABLE instead.

## The frozen rule

`frozen.mjs` will be a byte-for-byte copy of `research/edge/gotobi-cost/frozen.mjs` (branch `gotobi-cost`), itself
`research/edge/gotobi/run.mjs` at commit `5f341e069` of branch `gotobi`: sha256
`645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32`, pinned in `tests/gotobi-early-years.test.mjs`, never
edited. `run.mjs` imports from it and re-implements none of the rule: the Tokyo calendar and gotobi days (`gotobiSet`,
`isTokyoBusinessDay`), the fade leg's times (`legTimes('fade', …)`: sell at the open of the 00:55 UTC M5 candle, buy back at
the open of the 06:00 UTC candle, else the close of the last candle up to 15 minutes before), the stop (`stopDist`: 1.5 x the
median absolute move of the same window over the 20 Tokyo business days strictly before, at least 15 of them on file), the
stop-first management with gap fills (`trade`), R, the cost (`costPx`), `summary`, `monthT`, `draw`, `normCdf`. The loop over
days is #889's `runLeg` (every Tokyo business day of the window through the frozen `trade`), copied into `run.mjs`. Only
candles starting 00:00-06:55 UTC are kept (as #889; the leg and its lookback read 00:40-06:00 UTC).

## Data

OANDA mid M5 through the site's keyless candle proxy (`/md/bars`, `node --use-env-proxy`), the `gotobi-replicate/fetch.mjs`
pattern (pages of 4,999 candles, paced, progress saved), kept outside git (`/tmp`):

- the six crosses from 2004-12-01 to 2010-01-01 (U);
- NZD/JPY from 2009-11-01 to 2026-11-12 07:00 UTC (N; trade days to 2026-11-11, the original's last day);
- USD/JPY from 2015-11-01 to 2026-11-12 07:00 UTC (the gate).

## Gate (before any figure of U is read)

The frozen file's own `runPair(usdjpy, 'fade', '2026-11-11')` on the USD/JPY file above, gotobi days of 2016-01-01 to
2026-11-11, must give #878's published T2 figures to its published rounding: **n 771, net R a trade +0.148, month t 2.74.** If
it does not, the study stops, reports the gate and computes nothing on U.

## Costs

- **Base (C1)**: the frozen `costPx`, the original 1.30-pip assumption: 0.3 pip spread + 2 x 0.5 pip slippage a round trip, plus
  USD 22.5 per million of notional a side (22.5e-6 x the cross's price per unit a side; a pip is 0.01 on every yen cross). The
  0.3 pip spread is assumed for every cross, not measured.
- **2 x cost**: gross R - 2 x the trade's base cost in R (the #878 / #889 definition: twice spread, slippage and commission).
- **0 cost**: gross R.
- **Published-average case (C2b of `gotobi-cost`)**: x = the published all-day average spread + 2 x 0.5 pip slippage, plus
  the same commission; `gotobi-cost`'s published figures GBP/JPY 0.49, AUD/JPY 0.29, CAD/JPY 0.49, CHF/JPY 1.39 pips (web
  search summaries of 14 Nov 2026, pages not opened, not measured). `gotobi-cost` has no published figure for EUR/JPY or
  NZD/JPY: the C2b pooled row is given over the four crosses with a figure, and a second row over all six with EUR/JPY and
  NZD/JPY at the largest published cross figure, 1.39 pips (assumed). C2a (published spread, no slippage) is shown beside it.
  The C2 rows are reported, not conditions.

## Primary test and bar (U)

Pooled as #889 R1: all gotobi-day trades of the six crosses together; net R a trade = the mean over all pooled trades; month
t = the frozen `monthT` on the pooled trades (calendar-month sums of net R across the six crosses; t = mean / (sd / sqrt n)).

**REPLICATES** only if all three hold on U:

1. pooled net R a trade at the base cost > 0;
2. pooled month t at the base cost >= 2;
3. pooled net R a trade at 2 x cost > 0.

**DOES NOT REPLICATE** if U is measurable and any of the three fails. **NOT MEASURABLE** if the gate fails or U falls under
the floor above, with "(inconclusive: <reason>)" appended.

Reported for U at 0 / base / 2 x cost: n, mean R a trade, trade t (frozen `tradeT`, trades taken as independent, shown only),
month t, worst drawdown (the largest peak-to-trough fall of cumulative R, trades in order of entry time then pair, starting
from 0). Also per cross (the same figures), by year, stop-out share, median stop in pips, gotobi days lost to missing
candles, and the C2 rows.

## Placebo (reported, not a condition)

#889's pooled design: seeds 1-40; for each seed and each cross, the frozen `draw` takes, from that cross's Tokyo business days
of U's window that are NOT gotobi days and on which the leg can be computed, as many days as that cross has gotobi trades; the
seed's value is the pooled net R a trade of those draws at the base cost. Reported: the 40 values, their median, the 95th
percentile (the 38th of the 40 sorted from lowest) and how many U beats; also "every other day" (the leg on every non-gotobi
day) per cross. The placebo is not in the bar because the bar given for this study is the three conditions above; the report
says plainly whether U beats the placebo's 95th percentile.

## Fisher (exactly as `multiple-testing-update` defined it)

p of a test = 1 - Phi(month t) (one-sided, the frozen direction "fade makes money"), Phi by the ledger's `erfc`; Fisher
= -2 sum ln p on 2k degrees of freedom, `chi2SfEven`; copied from `multiple-testing-update/run.mjs`, not imported.

- The ledger's pre-registered reading is **calendar-disjoint**: the original plus replications on years it never used; two
  replications that share years on other instruments and that no study pooled are each combined with the original on their
  own, and the weaker result is shown. U shares 2005-09 with #889 R2 on another instrument and no study pools them, so this
  reading is: Fisher(#878 T2, #889 R2) and Fisher(#878 T2, U), **the weaker of the two**. Inputs: #878 T2 t 2.74 (p 0.003072),
  #889 R2 t 3.80 (p 0.000072), as stored in the ledger.
- Also shown, labelled an upper bound that counts the same days twice: Fisher(#878 T2, #889 R2, U) (the three the task names)
  and Fisher over all cells (#878 T2, #889 R2, #889 R1, U).
- Each compared with the ledger's Bonferroni line p < 1.50e-4.
- N (NZD/JPY 2010-now) is never in Fisher: it shares every calendar day with #878 / #889 R1.

## Supporting set N (reported only)

The same frozen trade on NZD/JPY 2010-01-01 to 2026-11-11, with the 2016-now and 2010-15 halves, at 0 / base / 2 x cost, and
its correlation of gotobi-day net R with the gate's USD/JPY T2 trades on the same days. Not a condition, not in Fisher.

## What the result can and cannot say

Whatever the verdict, it is still **not a net edge**: the spread and slippage at 00:55 and 06:00 UTC have not been measured on
any yen pair (`gotobi-cost`, `gotobi-duka-spread`), and the crosses' 0.3 pip spread is an assumption. A REPLICATES would be a
proposal for the owner, never a live rule (absolute rule 3). Nothing outside `research/edge/gotobi-early-years/`, its test and
the rebuilt `out/` changes.

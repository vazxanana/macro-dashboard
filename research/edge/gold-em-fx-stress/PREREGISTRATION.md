# Pre-registration: spot gold after an emerging-market currency stress day (14 Nov 2026)

Written and pushed alone, before any gold outcome was computed. Paper research only: a **stand-alone rule on gold**, not a
gate, entry, exit or size of the live gold book; the live book's positions are not read (owner decision 44). Nothing live
changes; no file under `ict/`, `council/` or any live path is edited (the study imports `foldWeekend`, `financing` and `FIN`
from `council/fills.mjs` read-only).

## The claim

When emerging-market currencies sell off together (the rand, the peso and the lira falling against the dollar on the same
day), the move is a dollar-funding squeeze: holders in those markets and leveraged funds sell what is liquid, gold among it.
If that selling is forced rather than informed, gold should be cheap the day after and recover over the following week.
The competing reading (liquidation goes on) is tested too. No earlier study here used an emerging-market currency trigger:
`gold-commodity-fx-lead` traded gold the way of a weekly dollar-neutral AUD/NZD/CAD/ZAR basket (a terms-of-trade lead, not a
stress day), `gold-haven-shock` used S&P 500 / Nasdaq 100 shock days, `risk-spill-jpy` and `risk-cross` the yen.

## Data (named before any result)

- council-data `research/daily/{xau,usdzar,usdmxn,usdtry}.json` (OANDA mid daily candles, UTC days, read with `git show
  origin/council-data:…` at commit `d1b493d4c`), weekend candles folded into Monday (`foldWeekend`, as `gold-eid-demand`).
- Market set: **gold (XAU/USD) is the only market traded**; USD/ZAR, USD/MXN, USD/TRY are the trigger only. No other market
  is added after a result.

## The trigger

- Day d's basket move = the mean of the three daily log changes ln(C_d / C_{d-1}) (all three must exist that day).
- z_d = basket move / standard deviation of the 60 basket moves before d (days d-60 … d-1; none of d or later).
- **Stress day: z_d >= 1.5** (the currencies weakened together by one and a half of their recent daily spreads). From the
  currency files alone (no gold read) this gives about 204 days in 2007-16 and 200 in 2017-26.

## The trade (every trade has a stop)

- Entry at the **open of the next gold candle** after the stress day (known at d's close, nothing later used).
- Stop 2 x ATR(20) of the daily gold candles up to and including d, checked on daily candles from the entry candle on: an
  open beyond the stop fills at that open, otherwise a touch fills at the stop (stop first: a candle touching the stop is a
  stop whatever else it did). Otherwise out at the close of the H-th candle (the entry candle is candle 1).
- One position at a time per test: a stress day whose entry falls before the open trade's exit candle has closed is skipped.
- Cost $0.60 an ounce round trip; financing on buys only: `nights(entry, exit) x FIN.xau.long (0.000148, the demo
  broker's XAUUSD swap of 11 Nov 2026) x entry`; sells pay and are credited nothing. R = net move / (2 x ATR).

## The tests (Holm over these three, on the out-of-sample p)

| Test | Side | Hold H | Reading |
|---|---|---|---|
| **T1 (primary)** | buy | 5 candles | forced selling reverses over the week |
| T2 | sell | 1 candle | the liquidation goes on the next day |
| T3 | buy | 20 candles | a slower haven bid after the stress |

## The measure that separates signal from drift

- **Excess R** of a trade = its net R minus the mean net R of the **same trade (side, H, stop, cost) entered after every
  ordinary day** of the same calendar year (ordinary = not a stress day; every such day, overlapping holds allowed). This
  removes gold's drift of that year and the average cost of a hold of that length.
- t = t of the **calendar-month sums** of excess R (months with at least one trade), df = months - 1.
- Windows by the entry's year: **in sample 2007-2016, out of sample 2017 to 2026-10** (entries after 31 Oct 2026 dropped).
- Placebo: 40 seeds (seeded generator); each seed draws, per out-of-sample year, as many ordinary entry days as the test took
  trades that year, runs the same trade on them and computes the same month-sum t of excess. Reported as the number of seeds
  whose t the real out-of-sample t beats.

## Pass bar (per test; the study PASSES only if T1 passes; T2 / T3 passing alone are reported as hypotheses)

1. Out-of-sample excess month-sum t >= 2 and Holm-adjusted p < 0.05 (two-sided, three tests).
2. In-sample excess R of the same sign (positive).
3. At 2x costs ($1.20 and 2x financing) out-of-sample mean net R > 0 and excess R > 0.
4. The real out-of-sample t beats at least 38 of the 40 placebo seeds.

Also reported, not judged: gross R and gross t (trade-level), net R and net t on month sums, stop count, the number of stress
days skipped by the one-position rule.

## What a result means

A FAIL means the effect is not shown at this power, not that it is absent. A PASS is a hypothesis for the owner, never a
rule; it would need its own forward record. Nothing here is called an edge without its n and t.

## Files

`run.mjs` (`fetch <dir>`: the four files by `git show`, kept out of git; `full <dir>`: writes `result.json` and
`RESULT.md`), `tests/gold-em-fx-stress.test.mjs` (offline: the trigger, the trade and the stop on hand-made candles, no
look-ahead, the report against `result.json`).

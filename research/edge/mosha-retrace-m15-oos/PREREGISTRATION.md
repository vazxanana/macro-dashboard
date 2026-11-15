# Mosha retracement chain, M15 zone, out of its own sample: pre-registration

Written and committed on 14 Nov 2026, alone, before any number of this study was computed. Paper research only: no live rule,
size, filter, mirror setting or Mosha desk content is changed by this study, whatever it finds.

## Why

`research/edge/mosha-retrace/` (10 Nov 2026, spot gold HistData M1, 2020 to October 2026) reported one variant, reported
only: the entry zone refined on **M15** instead of M5. It made +0.099R a trade after a $0.30 round trip (n 418, t 0.81),
positive in sample (+0.078R) and out of sample (+0.126R), Holm p 1.00. Its RESULT.md says: "a hypothesis; any follow-up
needs its own pre-registration on other data (OANDA 2006-17 as mosha-oos used)". This is that follow-up, and nothing else.

## The rule, unchanged

The code is `research/edge/mosha-retrace/run.mjs` `run(C, 'M15')`, **imported, not copied or edited** (it imports its swing,
barrier, H4 context and order simulation from `research/edge/mosha-level/run.mjs`, also unedited). In words, for a sell
(buys mirror it):

1. H4 BO buy: an H4 close above the last H4 swing high (3 a side), each level broken once.
2. The first H1 BO sell after it (an H1 close below the last H1 swing low, 1 a side). One signal per H4 BO.
3. Sell limit at the broken H1 level. Zone top = the highest high of the M15 candle that first closed through the level and
   the three M15 candles before it; stop $0.30 above. A stop under $1.00 away: no order. Valid 24 hours.
4. Target: the top of the nearest live H4 bullish engulf zone below (the barrier, born within 30 days, not closed through),
   at least 2R away, else no order. Out after 72 hours.
5. One order or position at a time (both sides share it).

No parameter, filter, threshold or level is changed.

## Data and window

- OANDA mid spot gold M5 through the candle proxy (`node --use-env-proxy research/edge/mosha-sweep/run.mjs fetch <dir>`;
  the cache `xau-5m.json.gz` is kept out of git). M15, H1 and H4 candles are built from the M5 in UTC buckets (the
  `gold-systems/data.mjs` `aggregate` rule). The study reads only candles before 2020-01-06 (a few days past the report
  window so late-December trades can close); 2020 on was the source study's data and is not read.
- **Fills and exits on M5** (the source study used M1; no M1 history exists for 2006-17 here). Same order logic: a touch of
  the limit fills at the limit; stop first when one candle holds both; fill and target in one candle = missed; a stop gapped
  through fills at the open.
- **Decisive window**: orders placed 2006-07-01 to 2017-12-31 (June 2006 is warm-up). **Report window**: 2018-01-01 to
  2019-12-31, shown, not judged.

## Costs

R is per unit of the opening risk r0 = |entry − stop|.

- Gross: R before any cost.
- Net (primary): R − $0.60 / r0 (the newer standard round trip) − financing on buys.
- Also shown: R − $0.30 / r0 (the source study's cost) − financing on buys.
- Twice the costs: R − $1.20 / r0 − 2 × financing.
- Financing on buys only: `nights(filled, closed)` × `FIN.xau.long` (0.000148 of price a rollover, `council/fills.mjs`,
  imported) × entry / r0. Sells are charged and credited nothing. Today's rate for every year.

## Tests and statistics

Three tests, Holm over the three: **T1** every trade of the stream, **T2** its sells, **T3** its buys (T2 and T3 are the
side subsets of the one-at-a-time stream of T1, not separate streams).

- Statistic: t of the calendar-month sums of net R over every calendar month of the window (a month without a trade counts
  0), mean / (sd / √months).
- p: one-sided, from the normal tail of t; Holm-adjusted over T1-T3.
- Placebo, 40 seeded draws (seeds 1-40): every trade of a test is replaced by a trade of the same side, the same r0 and the
  same target distance, entered at the open of an M5 candle drawn at random within the same calendar month, managed by the
  same order simulation (market entry, same stop / target / 72-hour exit / fills) and charged the same costs. The draw's
  decisive net month-sum t is computed the same way.

**Pass, per test**: decisive net month-sum t ≥ 2 AND Holm-adjusted p < 0.05 AND decisive mean at twice the costs > 0 AND
the real t above at least 38 of its 40 placebo t's. **Verdict**: PASS when T1 passes; T2 or T3 passing alone is reported as
a side finding, not a verdict on the rule (it needs its own pre-registration). Otherwise FAIL. The 2018-19 report window and
gross figures never change the verdict.

## What is reported

Per test, decisive and report windows: n, win rate, R a trade gross / net $0.30 / net $0.60 / 2x, month-sum t of each,
Holm p, placebo rank; by year; funnel; financing total. Never called an edge without n and t. A PASS would make it a
candidate for a forward paper shadow only with the owner's approval; it changes nothing by itself.

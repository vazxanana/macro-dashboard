# Mosha retracement chain, M15 zone, out of its own sample: result (14 Nov 2026)

**Verdict: FAIL, 0 of 3 tests. On untouched gold 2006-17 the M15-zone chain lost 0.50R a trade net (n 762, month-sum t −6.00) and 0.22R before any cost (t −2.74).**

Paper research only. No live rule, size, filter, mirror setting or Mosha desk content was changed. The rule, costs, tests and
verdict were fixed in `PREREGISTRATION.md`, committed and pushed alone before `run.mjs` produced a number.

## What was tested

`research/edge/mosha-retrace/` reported one variant as "a hypothesis": the entry zone refined on M15 instead of M5 (+0.099R a
trade after $0.30, n 418, t 0.81, spot gold 2020 to October 2026). This study runs that variant, its code imported unchanged
(`mosha-retrace/run.mjs` `run(C, 'M15')`), on OANDA mid spot gold M5 from June 2006, data the source study never read: H4 BO,
the first H1 BO the other way, a limit at the broken H1 level, stop $0.30 past the M15 break candle and the three before,
target the nearest live H4 engulf barrier at least 2R away, 24-hour order life, 72-hour hold, one at a time. Fills on M5
(no M1 history for these years; the source study filled on M1).

## Results (orders placed in the window; R per unit of the opening risk)

Net = R − $0.60 / r0 − financing on buys (`nights` × `FIN.xau.long`, 0.000148 of price a rollover). t = calendar-month sums,
every month of the window, empty months 0.

| Test | Window | n | Win % | Gross R (t) | Net $0.30 (t) | **Net $0.60 (t)** | 2x costs (t) | Total net | Holm p | Placebo beaten |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 both sides | 2006-17 decisive | 762 | 15.0 | −0.223 (−2.74) | −0.366 (−4.46) | **−0.499 (−6.00)** | −0.774 (−9.00) | −379.9R | 1.00 | 2 of 40 |
| T1 both sides | 2018-19 report | 114 | 24.6 | +0.098 (0.51) | −0.074 (−0.40) | −0.234 (−1.28) | −0.565 (−3.13) | −26.6R | | |
| T2 sells | 2006-17 decisive | 408 | 16.2 | −0.178 (−1.69) | −0.308 (−2.87) | **−0.438 (−4.00)** | −0.698 (−6.06) | −178.6R | 1.00 | 12 of 40 |
| T2 sells | 2018-19 report | 59 | 27.1 | +0.248 (0.94) | +0.097 (0.38) | −0.053 (−0.20) | −0.353 (−1.36) | −3.1R | | |
| T3 buys | 2006-17 decisive | 354 | 13.6 | −0.275 (−2.35) | −0.433 (−3.64) | **−0.569 (−4.68)** | −0.862 (−6.70) | −201.3R | 1.00 | 0 of 40 |
| T3 buys | 2018-19 report | 55 | 21.8 | −0.063 (−0.18) | −0.258 (−0.73) | −0.428 (−1.20) | −0.793 (−2.16) | −23.5R | | |

Financing charged on the buys: 8.3R over 2006-17, 1.4R over 2018-19. Placebo (40 seeded draws: same side, r0 and target
distance, market entry at a random M5 open in the same month): median decisive net t −4.06 (T1), −3.17 (T2), −2.71 (T3);
the real stream is worse than most of its own placebos.

Net R a trade ($0.60) by year, T1: 2006 −0.54, 2007 −0.67, 2008 −0.59, 2009 −0.02, 2010 −0.75, 2011 −0.29, 2012 −0.23,
2013 −0.24, 2014 −0.60, 2015 −0.60, 2016 −0.68, 2017 −0.95; report 2018 −0.44, 2019 −0.02. No year positive.

Funnel (2006 to 2019): 1,693 H4 BOs, 1,574 signals, 978 orders (456 dropped with the barrier under 2R, 77 with no barrier,
54 with a stop under $1, 9 busy). Decisive window: 762 closed, 52 missed, 24 expired.

## Reading

- Every pre-registered condition fails for all three tests: t far below 2, Holm p 1.00, negative at twice the costs, and
  beaten by most placebos.
- It is not only costs. Before any cost the chain lost 0.22R a trade (t −2.74) on 2006-17, against about +0.17R gross in
  the source study's 2020-26 window. Stops are smaller here (median $2.42 against $4.38), so a fixed dollar cost weighs
  more, but the gross loss alone settles it.
- The +0.10R of the source study's M15 variant was the best of five variants on one window; on twelve untouched years it
  does not repeat. Sells lose less than buys; no side passes, and no side is proposed.
- What this does not say: it judges this mechanical rule only, not the owner's or the teacher's own choice of which chains
  to take. Nothing about it is shown on the Mosha desk.

## Reproduce

```sh
node --use-env-proxy research/edge/mosha-sweep/run.mjs fetch /tmp/candles      # OANDA M5 from June 2006, kept out of git
CANDLES=/tmp/candles node research/edge/mosha-retrace-m15-oos/run.mjs run       # writes result.json (reads candles before 2020-01-06 only)
```

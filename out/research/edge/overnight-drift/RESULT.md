# Overnight drift on US index CFDs: result (13 Nov 2026)

**Verdict: FAIL** (0 of 3 indices pass; pre-registration in `PREREGISTRATION.md`, committed and pushed before any result).

Buying SPX500, NAS100 or US30 at the 16:00 New York close and selling at the next 09:30 open, with a 2 × ATR20 stop, does
not pay on OANDA mid M30 candles after a CFD's costs. In the decisive window (2016-01-01 to 2026-10-31, 2,722 nights a market,
130 months) the net result is −0.009R (SPX500), +0.001R (NAS100) and −0.010R (US30) a night, month t −1.39, +0.20, −1.44:
none is above zero with t ≥ 2, Holm p for NAS100 0.42. The night is positive BEFORE costs (+0.011R to +0.021R a night,
+0.020 % to +0.039 % of price), but the spread and the financing take all of it: on SPX500 the spread takes 0.014 % and the
financing 0.020 % of a 0.025 % gross night. And on these CFD prices the intraday leg (09:30 → 16:00) earned MORE than the
night per hour held in 2016-26, before and after costs (SPX500 +0.0046 % an hour gross against +0.0009 % for the night), so
the second pass condition fails too. 2008-15 is worse: every index loses after costs (t −2.8 to −3.5).

## Overnight leg (the trade), R a night

Gross, the spread and the financing as R a night, the net, and t on calendar-month sums of net R.

| Market, window | n | gross R | spread R | financing R | net R | month t |
|---|---|---|---|---|---|---|
| SPX500 2008-15 | 2010 | +0.006 | −0.021 | −0.008 | −0.022 | -3.51 |
| SPX500 2016-26 | 2722 | +0.016 | −0.011 | −0.014 | −0.009 | -1.39 |
| NAS100 2008-15 | 2010 | +0.020 | −0.033 | −0.007 | −0.021 | -3.12 |
| NAS100 2016-26 | 2722 | +0.021 | −0.009 | −0.010 | +0.001 | 0.2 |
| US30 2008-15 | 2010 | +0.003 | −0.013 | −0.008 | −0.018 | -2.83 |
| US30 2016-26 | 2722 | +0.011 | −0.006 | −0.015 | −0.010 | -1.44 |

Decisive window, more: total net −24.2R / +3.3R / −26.9R, worst drawdown −25.5R / −15.4R / −47.7R, stopped 70 / 61 / 64
nights, win rate 52.1 % / 53.1 % / 50.7 %. At twice the spread every index is negative (t −3.06, −1.30, −2.39). Positive
years 2016-26 (net R): SPX500 5 of 11, NAS100 6 of 11, US30 6 of 11; 2022 and 2023 lost on all three. Five nights a market
were skipped for a missing candle at a boundary.

## Per hour held, decisive window (% of price)

| Market | night gross / h | night net / h | day gross / h | day net / h |
|---|---|---|---|---|
| SPX500 | +0.00089 | −0.00032 | +0.00456 | +0.00236 |
| NAS100 | +0.00137 | +0.00012 | +0.00614 | +0.00376 |
| US30 | +0.00072 | −0.00028 | +0.00413 | +0.00281 |

A night is held 28.2 hours on average (weekends 64.5); a day leg 6.5 hours. The intraday leg's net is the spread only; it is a
measurement, not a position. Its month t on net % is 1.09 / 1.35 / 1.40 in 2016-26: not significant either.

## Gold (descriptive, its own sessions: day 08:00 → 16:00, night 16:00 → 08:00 New York, H1)

Night: 2008-15 −0.013R a night net (n 2,035, t −1.81; gross +0.010R), 2016-26 +0.008R (n 2,710, t 1.32; gross +0.032R,
spread 0.011R, financing 0.013R at today's demo rate). Day leg: −0.0072 % and −0.0012 % gross in the two windows. Gold's
night is where its rise happened in 2016-26, but after costs it is not apart from zero. No verdict was pre-registered for gold.

## Why this need not contradict the papers

The papers measure the cash index from its official close to its official open. A CFD quote at 16:00 and 09:30 follows the
futures (basis, dividends) and the 09:30 candle's open is not the opening auction; the overnight gross here is small
(+0.025 % a night on SPX500 in 2016-26). On what this desk can trade, the effect is too small for a CFD's spread plus a
financing charge of the 2Y + 2.5 % a year. Assumed, not measured: the spreads (0.5 / 1.5 / 2.5 points) and the financing
rule; DGS2 stands in for the overnight rate.

Nothing live changed; no proposal is written (the study failed). To repeat:
`node --use-env-proxy research/edge/overnight-drift/fetch.mjs <dir>`, then `node research/edge/overnight-drift/run.mjs full <dir>`.
Tests: `tests/overnight-drift.test.mjs`.
